"""Deterministic CPF contribution rule pack.

Pure arithmetic on established facts. Nothing here reads a document or calls a model.

Rate source: https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay
(page "Last updated 11 Aug 2026"; rates effective 1 Jan 2026). Verified 6 Sept 2026.
RE-VERIFY BEFORE THE PITCH. Quoted text lives in .claude/rules/cpf-rules.md.

Scope (v1): Singapore Citizens and PRs in their 3rd year onwards, monthly wages above $750,
Ordinary Wages only. Everything else either returns NO_CPF (correct: not liable) or raises
OutOfScopeError (honest: we did not verify the rule, so we refuse to compute it).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from enum import Enum


class OutOfScopeError(ValueError):
    """Raised when v1 cannot compute this case correctly. Refusing beats guessing."""


class Residency(str, Enum):
    CITIZEN = "CITIZEN"
    PR_YEAR_3_PLUS = "PR_YEAR_3_PLUS"
    PR_YEAR_1 = "PR_YEAR_1"  # graduated rates - out of scope v1
    PR_YEAR_2 = "PR_YEAR_2"  # graduated rates - out of scope v1 (secondary sources conflict)
    WORK_PERMIT = "WORK_PERMIT"  # no CPF
    S_PASS = "S_PASS"  # no CPF
    EMPLOYMENT_PASS = "EMPLOYMENT_PASS"  # no CPF


class AgeBand(str, Enum):
    UP_TO_55 = "55 and below"
    ABOVE_55_TO_60 = "Above 55 to 60"
    ABOVE_60_TO_65 = "Above 60 to 65"
    ABOVE_65_TO_70 = "Above 65 to 70"
    ABOVE_70 = "Above 70"


# Bands in threshold order. band_for() indexes this, NOT list(AgeBand): relying on the
# enum's declaration order means reordering the enum would silently shift every worker
# into the wrong band. BAND_ORDER is asserted against AGE_THRESHOLDS in the test suite.
AGE_THRESHOLDS = (55, 60, 65, 70)
BAND_ORDER = (
    AgeBand.UP_TO_55,
    AgeBand.ABOVE_55_TO_60,
    AgeBand.ABOVE_60_TO_65,
    AgeBand.ABOVE_65_TO_70,
    AgeBand.ABOVE_70,
)

# CPF Board table, from 1 Jan 2026, monthly wages > $750, SC / PR 3rd year+.
# (employer %, employee %, total %)
RATES_2026: dict[AgeBand, tuple[Decimal, Decimal, Decimal]] = {
    AgeBand.UP_TO_55: (Decimal(17), Decimal(20), Decimal(37)),
    AgeBand.ABOVE_55_TO_60: (Decimal(16), Decimal(18), Decimal(34)),
    AgeBand.ABOVE_60_TO_65: (Decimal("12.5"), Decimal("12.5"), Decimal(25)),
    AgeBand.ABOVE_65_TO_70: (Decimal(9), Decimal("7.5"), Decimal("16.5")),
    AgeBand.ABOVE_70: (Decimal("7.5"), Decimal(5), Decimal("12.5")),
}

OW_CEILING_2026 = Decimal(8000)  # monthly Ordinary Wage ceiling from 1 Jan 2026 (was 7,400)
GRADUATED_WAGE_LIMIT = Decimal(750)  # at or below this, graduated formulas apply (v1: out of scope)

NO_CPF = frozenset({Residency.WORK_PERMIT, Residency.S_PASS, Residency.EMPLOYMENT_PASS})
GRADUATED_PR = frozenset({Residency.PR_YEAR_1, Residency.PR_YEAR_2})
FULL_RATE = frozenset({Residency.CITIZEN, Residency.PR_YEAR_3_PLUS})

ONE_DOLLAR = Decimal(1)


def band_for(dob: date, contribution_month: date) -> AgeBand:
    """CPF verbatim: "New contribution rates apply from the first day of the month after the
    employee's 55th, 60th, 65th or 70th birthday."

    contribution_month may be any date inside the month being computed.
    """
    month_start = contribution_month.replace(day=1)
    passed = 0
    for threshold in AGE_THRESHOLDS:
        try:
            birthday = dob.replace(year=dob.year + threshold)
        except ValueError:  # 29 Feb
            birthday = dob.replace(year=dob.year + threshold, day=28)
        # first day of the month after the birthday
        if birthday.month == 12:
            step_up = date(birthday.year + 1, 1, 1)
        else:
            step_up = date(birthday.year, birthday.month + 1, 1)
        if month_start >= step_up:
            passed += 1
    return BAND_ORDER[passed]


@dataclass(frozen=True)
class CpfResult:
    ow_used: Decimal  # OW after the ceiling
    ow_capped: bool
    band: AgeBand
    residency: Residency
    total: Decimal  # rounded to nearest dollar (CPF rule)
    employee: Decimal  # cents dropped (CPF rule)
    employer: Decimal  # total - employee (CPF rule)
    formula: str
    flags: tuple[str, ...] = ()


def cpf_contribution(ow: Decimal, band: AgeBand, residency: Residency) -> CpfResult:
    """Monthly CPF on Ordinary Wages, CPF Board's own rounding method:
    total = nearest dollar; employee share = cents dropped; employer = total - employee.
    """
    ow = Decimal(ow)
    if residency in NO_CPF:
        return CpfResult(
            ow,
            False,
            band,
            residency,
            Decimal(0),
            Decimal(0),
            Decimal(0),
            "no CPF liability for this pass type",
            ("NO_CPF: Work Permit / S Pass / EP holders are not CPF members",),
        )
    if residency in GRADUATED_PR:
        raise OutOfScopeError(
            f"{residency.value}: 1st/2nd-year PR graduated rates are not encoded in v1 "
            "(secondary sources conflict on the Year-2 employer rate; not verified against CPF Table 3)"
        )
    if residency not in FULL_RATE:
        raise OutOfScopeError(f"unknown residency {residency}")
    if ow <= GRADUATED_WAGE_LIMIT:
        raise OutOfScopeError(
            f"wages of ${ow} are at or below $750: graduated contribution formulas apply and are not encoded in v1"
        )

    flags: list[str] = []
    ow_used = ow
    capped = False
    if ow > OW_CEILING_2026:
        ow_used = OW_CEILING_2026
        capped = True
        flags.append(
            f"OW_CAPPED: ${ow} exceeds the ${OW_CEILING_2026} monthly Ordinary Wage ceiling"
        )

    # employer % is kept in the table for display; CPF derives the employer share as total - employee
    _er_pct, ee_pct, total_pct = RATES_2026[band]
    total = (ow_used * total_pct / 100).quantize(ONE_DOLLAR, rounding=ROUND_HALF_UP)
    employee = (ow_used * ee_pct / 100).quantize(ONE_DOLLAR, rounding=ROUND_DOWN)
    employer = total - employee

    return CpfResult(
        ow_used=ow_used,
        ow_capped=capped,
        band=band,
        residency=residency,
        total=total,
        employee=employee,
        employer=employer,
        formula=(
            f"total = {total_pct}% x {ow_used} -> nearest $; "
            f"employee = {ee_pct}% x {ow_used} -> cents dropped; employer = total - employee"
        ),
        flags=tuple(flags),
    )


@dataclass(frozen=True)
class CpfDelta:
    declared: CpfResult
    expected: CpfResult
    total: Decimal
    employee: Decimal
    employer: Decimal


def cpf_shortfall(
    declared_ow: Decimal, expected_ow: Decimal, band: AgeBand, residency: Residency
) -> CpfDelta:
    """CPF that would have been contributed on the reconstructed wage, minus CPF on the wage the
    employer actually used. This is how an OT shortfall compounds into a CPF shortfall.
    Both sides use CPF's month-level rounding, so the delta is what CPF Board would compute,
    not a naive percentage of the wage difference."""
    d = cpf_contribution(declared_ow, band, residency)
    e = cpf_contribution(expected_ow, band, residency)
    return CpfDelta(d, e, e.total - d.total, e.employee - d.employee, e.employer - d.employer)


@dataclass(frozen=True)
class ShortfallSplit:
    """What a gross wage shortfall actually cost the worker, without double-counting.

    Naively adding the gross shortfall to the CPF shortfall counts the employee's CPF
    share twice: it is part of the gross the worker never received AND part of the CPF
    that never reached the account. This splits it into two non-overlapping amounts.

        gross_shortfall           the wage that was not paid
        employee_cpf_on_shortfall the part of it that would have gone to CPF, not cash
        cash_shortfall            gross - employee share: what the bank account is missing
        cpf_shortfall             employee + employer share: what the CPF account is missing
        total_withheld            cash + cpf, which is also gross + employer share
    """

    gross_shortfall: Decimal
    employee_cpf_on_shortfall: Decimal
    cash_shortfall: Decimal
    cpf_shortfall: Decimal
    employer_cpf_on_shortfall: Decimal
    total_withheld: Decimal
    delta: CpfDelta


def shortfall_split(
    declared_ow: Decimal, expected_ow: Decimal, band: AgeBand, residency: Residency
) -> ShortfallSplit:
    """Decompose a wage shortfall into the cash and the CPF the worker did not receive.

    All CPF figures use CPF's month-level rounding, so they are what CPF Board would
    compute - not a percentage of the difference.
    """
    d = cpf_shortfall(declared_ow, expected_ow, band, residency)
    gross = Decimal(expected_ow) - Decimal(declared_ow)
    cash = gross - d.employee
    total = cash + d.total
    return ShortfallSplit(
        gross_shortfall=gross,
        employee_cpf_on_shortfall=d.employee,
        cash_shortfall=cash,
        cpf_shortfall=d.total,
        employer_cpf_on_shortfall=d.employer,
        total_withheld=total,
        delta=d,
    )
