"""Deterministic MOM pay rules engine.

Every function here is pure arithmetic on established facts. Nothing in this
module reads a document, calls a model, or guesses. If an input is not
established (agreed by two independent readers, or confirmed by the worker),
compute_expected() refuses to run.

Rule source: https://www.mom.gov.sg/employment-practices/hours-of-work-overtime-and-rest-days
Page last updated 24 July 2025. Verified against the page on 6 Sept 2026.
RE-VERIFY BEFORE THE PITCH. See .claude/rules/mom-pay-rules.md for the quoted text.

Scope (v1): monthly-rated employees covered by Part 4 of the Employment Act.
Out of scope, and the engine says so rather than guessing: daily/piece-rated
workers, public-holiday pay, shift-work averaging, CPF recomputation,
domestic workers, and any determination of legal liability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from enum import Enum
from typing import Literal

# --------------------------------------------------------------------------
# Facts and their provenance
# --------------------------------------------------------------------------


class Status(str, Enum):
    AGREED = "AGREED"  # both independent readers returned the same value
    DISAGREED = "DISAGREED"  # readers returned different values
    MISSING = "MISSING"  # at least one reader found nothing
    HUMAN_CONFIRMED = "HUMAN_CONFIRMED"  # the worker confirmed or corrected it


ESTABLISHED = frozenset({Status.AGREED, Status.HUMAN_CONFIRMED})


@dataclass(frozen=True)
class Fact:
    """A single input with its provenance. `source` is a human-readable label
    such as 'payslip.jpg region 3' or 'worker confirmed 2026-09-08'."""

    value: object
    status: Status
    source: str = ""

    @property
    def established(self) -> bool:
        return self.status in ESTABLISHED


class UnverifiedInputError(ValueError):
    """Raised when compute_expected() is asked to calculate on a fact that was
    never established. This is the honesty rule enforced in the type system."""


# --------------------------------------------------------------------------
# Rate formulas (MOM, monthly-rated)
# --------------------------------------------------------------------------

HOURS_PER_WEEK = Decimal(44)
WEEKS_PER_YEAR = Decimal(52)
MONTHS_PER_YEAR = Decimal(12)
OT_MULTIPLIER = Decimal("1.5")
MONTHLY_OT_CAP_HOURS = Decimal(72)
DEDUCTION_CAP_RATIO = Decimal("0.5")

# Part 4 coverage thresholds (monthly basic salary)
WORKMAN_BASIC_CAP = Decimal(4500)
NON_WORKMAN_BASIC_CAP = Decimal(2600)


def hourly_basic_rate(monthly_basic: Decimal) -> Decimal:
    """MOM: hourly basic rate = (12 x monthly basic) / (52 x 44)."""
    return (MONTHS_PER_YEAR * Decimal(monthly_basic)) / (WEEKS_PER_YEAR * HOURS_PER_WEEK)


def daily_rate(monthly_basic: Decimal, days_per_week: int) -> Decimal:
    """Daily rate = (12 x monthly basic) / (52 x days worked per week).
    NOT single-valued: a 5-day and a 6-day week give different answers.
    The caller must supply days_per_week as an established fact."""
    if days_per_week not in ALLOWED_DAYS_PER_WEEK:
        raise ValueError(f"days_per_week must be one of {sorted(ALLOWED_DAYS_PER_WEEK)} for v1")
    return (MONTHS_PER_YEAR * Decimal(monthly_basic)) / (WEEKS_PER_YEAR * Decimal(days_per_week))


def overtime_pay(monthly_basic: Decimal, ot_hours: Decimal) -> Decimal:
    """OT pay = hourly basic rate x 1.5 x hours. The 72-hour monthly cap is
    reported as a flag by compute_expected(), not silently truncated here."""
    return hourly_basic_rate(monthly_basic) * OT_MULTIPLIER * Decimal(ot_hours)


def rest_day_pay(
    monthly_basic: Decimal,
    days_per_week: int,
    hours_worked: Decimal,
    normal_daily_hours: Decimal,
    requested_by: Literal["employer", "employee"],
) -> Decimal:
    """Rest-day pay per the MOM table, EXCLUDING any overtime for hours beyond
    normal daily hours (the caller adds that via overtime_pay on the excess).

        At employer's request:  up to half day -> 1 day's salary
                                more than half -> 2 days' salary
        At employee's request:  up to half day -> half day's salary
                                more than half -> 1 day's salary
    """
    if Decimal(hours_worked) <= 0:
        # MOM's table prices work DONE on a rest day. Zero hours is not "up to half a
        # day"; it means the rest day was not worked, and there is no component at all.
        # compute_expected() omits the component rather than calling this with 0.
        raise ValueError("rest_day_pay called with no hours worked; omit the component instead")
    d = daily_rate(monthly_basic, days_per_week)
    half = Decimal(normal_daily_hours) / 2
    more_than_half = Decimal(hours_worked) > half
    if requested_by == "employer":
        return 2 * d if more_than_half else d
    if requested_by == "employee":
        return d if more_than_half else d / 2
    raise ValueError("requested_by must be 'employer' or 'employee'")


def is_covered_by_part4(monthly_basic: Decimal, is_workman: bool) -> bool:
    cap = WORKMAN_BASIC_CAP if is_workman else NON_WORKMAN_BASIC_CAP
    return Decimal(monthly_basic) <= cap


# --------------------------------------------------------------------------
# Full computation on established facts only
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class PayInputs:
    monthly_basic: Fact  # Decimal
    ot_hours: Fact  # Decimal
    days_per_week: Fact  # int (5 or 6)
    normal_daily_hours: Fact  # Decimal
    is_workman: Fact  # bool
    deductions_total: Fact  # Decimal, as stated on the payslip
    net_paid: Fact  # Decimal, amount that reached the bank
    rest_day_hours: Fact | None = None  # Decimal, hours worked on the rest day
    rest_day_requested_by: Fact | None = None  # "employer" | "employee"


@dataclass(frozen=True)
class Component:
    label: str
    amount: Decimal
    formula: str
    inputs: tuple[str, ...]  # source labels of the facts used


@dataclass(frozen=True)
class PayBreakdown:
    components: tuple[Component, ...]
    expected_gross: Decimal
    deductions_total: Decimal
    expected_net: Decimal
    net_paid: Decimal
    difference: Decimal  # expected_net - net_paid; positive = possibly under-received
    flags: tuple[str, ...] = field(default_factory=tuple)

    def component(self, label: str) -> Component:
        for c in self.components:
            if c.label == label:
                return c
        raise KeyError(label)


ALLOWED_DAYS_PER_WEEK: frozenset[int] = frozenset({5, 6})
REST_DAY_REQUESTERS: frozenset[str] = frozenset({"employer", "employee"})


def _require(fact: Fact, name: str) -> object:
    """The status gate: was this fact established at all?"""
    if not fact.established:
        raise UnverifiedInputError(
            f"{name} is {fact.status.value}; refusing to calculate on an unestablished fact"
        )
    return fact.value


# --------------------------------------------------------------------------
# The value gate.
#
# A status of HUMAN_CONFIRMED says a person answered; it does not say the answer
# is a number, or a number this engine can compute with. Those are two separate
# claims and only one of them was being checked, so a worker typing "NaN" into a
# box produced a 500, and "-5" produced overtime of -$47.20 - a figure the
# engine invented from an input nobody established.
#
# The rule is the same as for status: refuse rather than approximate. A value
# the engine cannot establish as its field's type is UNESTABLISHED_INPUT, and
# the caller sees a refusal naming the field, exactly as for an unconfirmed one.
#
# See docs/debt.md, established-status-mistaken-for-established-value.
# --------------------------------------------------------------------------


def _require_decimal(fact: Fact, name: str, *, allow_negative: bool = False) -> Decimal:
    """A finite, displayable, non-negative amount.

    Three ways a Decimal can exist and still not be a value:
      - "NaN" and "Infinity" parse happily and then poison every comparison and
        sum they touch, silently, all the way to the screen.
      - "1e400" parses and is finite, then raises the moment it is rounded for
        display. A number the engine cannot express in cents is a number it
        cannot show, and one it cannot show it has not established.
      - a negative wage, hour count or deduction. Nothing this engine models can
        be negative, and MOM's formulas have no meaning on one.
    """
    raw = _require(fact, name)
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as e:
        raise UnverifiedInputError(
            f"{name}: {raw!r} is not a number; refusing to calculate on it"
        ) from e

    if not value.is_finite():
        raise UnverifiedInputError(
            f"{name}: {raw!r} is not a finite number; refusing to calculate on it"
        )

    try:
        to_cents(value)
    except InvalidOperation as e:
        raise UnverifiedInputError(
            f"{name}: {value} cannot be expressed in cents; refusing to calculate on it"
        ) from e

    if value < 0 and not allow_negative:
        raise UnverifiedInputError(
            f"{name}: {value} is negative. Wages, hours and deductions cannot be, "
            f"and this engine will not produce a figure from one"
        )
    return value


def _require_days_per_week(fact: Fact, name: str = "days_per_week") -> int:
    """Checked HERE, at the boundary, not inside daily_rate().

    daily_rate() guards itself, but it is only called when a rest day was
    worked - so a month without one accepted days_per_week=7 in silence and
    computed a gross from it. A guard that only fires on some paths is not a
    guard on the input."""
    raw = _require(fact, name)
    if isinstance(raw, bool) or not isinstance(raw, (int, str)):
        raise UnverifiedInputError(f"{name}: {raw!r} is not a whole number of days")
    try:
        value = int(raw)
    except (TypeError, ValueError) as e:
        raise UnverifiedInputError(f"{name}: {raw!r} is not a whole number of days") from e
    if value not in ALLOWED_DAYS_PER_WEEK:
        raise UnverifiedInputError(
            f"{name}: {value} is outside {sorted(ALLOWED_DAYS_PER_WEEK)}. MOM's daily rate is "
            f"(12 x monthly basic) / (52 x days per week) and v1 encodes only the 5- and "
            f"6-day week; refusing rather than extending the formula"
        )
    return value


def _require_bool(fact: Fact, name: str) -> bool:
    """`bool("false")` is True. A string that looks like an answer is not one."""
    raw = _require(fact, name)
    if not isinstance(raw, bool):
        raise UnverifiedInputError(f"{name}: {raw!r} is not true or false")
    return raw


def _require_choice(fact: Fact, name: str, allowed: frozenset[str]) -> str:
    raw = _require(fact, name)
    if not isinstance(raw, str) or raw not in allowed:
        raise UnverifiedInputError(f"{name}: {raw!r} is not one of {sorted(allowed)}")
    return raw


def compute_expected(inp: PayInputs) -> PayBreakdown:
    """Refuses to run unless every fact it touches is ESTABLISHED - in status AND
    in value. A confirmed answer that is not a number of the right shape is
    refused the same way an unconfirmed one is."""
    basic = _require_decimal(inp.monthly_basic, "monthly_basic")
    ot_h = _require_decimal(inp.ot_hours, "ot_hours")
    dpw = _require_days_per_week(inp.days_per_week)
    ndh = _require_decimal(inp.normal_daily_hours, "normal_daily_hours")
    workman = _require_bool(inp.is_workman, "is_workman")
    ded = _require_decimal(inp.deductions_total, "deductions_total")
    paid = _require_decimal(inp.net_paid, "net_paid")

    flags: list[str] = []
    comps: list[Component] = []

    if not is_covered_by_part4(basic, workman):
        flags.append("NOT_COVERED_BY_PART4: OT and rest-day rules may not apply; verify with MOM")

    hr = hourly_basic_rate(basic)
    comps.append(Component("basic", basic, "monthly basic as stated", (inp.monthly_basic.source,)))

    ot = overtime_pay(basic, ot_h)
    comps.append(
        Component(
            "overtime",
            ot,
            f"({hr:.4f}/h) x 1.5 x {ot_h}h",
            (inp.monthly_basic.source, inp.ot_hours.source),
        )
    )
    if ot_h > MONTHLY_OT_CAP_HOURS:
        flags.append(f"OT_HOURS_EXCEED_72: {ot_h}h recorded; MOM monthly cap is 72h")

    if inp.rest_day_hours is not None and inp.rest_day_requested_by is not None:
        rdh = _require_decimal(inp.rest_day_hours, "rest_day_hours")
        who = _require_choice(
            inp.rest_day_requested_by, "rest_day_requested_by", REST_DAY_REQUESTERS
        )
    else:
        rdh = None
        who = None

    if rdh is not None and rdh > 0:
        rd = rest_day_pay(basic, dpw, rdh, ndh, who)  # type: ignore[arg-type]
        comps.append(
            Component(
                "rest_day",
                rd,
                f"rest-day table, {who}'s request, {rdh}h of {ndh}h, {dpw}-day week",
                (
                    inp.monthly_basic.source,
                    inp.days_per_week.source,
                    inp.rest_day_hours.source,
                    inp.rest_day_requested_by.source,
                    # The rest-day table branches on HALF the normal daily hours,
                    # and this component's own formula string prints it. It was
                    # consumed and not recorded, so anything reading `inputs` as
                    # the dependency graph got a smaller graph than the truth.
                    inp.normal_daily_hours.source,
                ),
            )
        )
        excess = rdh - ndh
        if excess > 0:
            rd_ot = overtime_pay(basic, excess)
            comps.append(
                Component(
                    "rest_day_overtime",
                    rd_ot,
                    f"({hr:.4f}/h) x 1.5 x {excess}h beyond normal hours",
                    (
                        inp.monthly_basic.source,
                        inp.rest_day_hours.source,
                        # `excess` is rest_day_hours MINUS normal_daily_hours.
                        # Omitting it made this the one component that could move
                        # without declaring what moved it.
                        inp.normal_daily_hours.source,
                    ),
                )
            )

    gross = sum((c.amount for c in comps), Decimal(0))

    if gross > 0 and ded > gross * DEDUCTION_CAP_RATIO:
        flags.append(f"DEDUCTIONS_EXCEED_50PCT: {ded} of gross {gross:.2f}")

    net = gross - ded
    diff = net - paid

    return PayBreakdown(
        components=tuple(comps),
        expected_gross=gross,
        deductions_total=ded,
        expected_net=net,
        net_paid=paid,
        difference=diff,
        flags=tuple(flags),
    )


def to_cents(x: Decimal) -> Decimal:
    """Round for DISPLAY only. Internal arithmetic keeps full precision."""
    return Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def days_of_pay(amount: Decimal, monthly_basic: Decimal, days_per_week: int) -> Decimal:
    """Express a dollar amount in days of the worker's basic pay. Display only."""
    return Decimal(amount) / daily_rate(monthly_basic, days_per_week)
