"""Mandate-bounded follow-through: what happens after the number.

Stage 3 of the pipeline in .claude/rules/fairslip-domain.md. The engines say
what the month should have paid; this module is what the worker may then do
about it, and - more importantly - what it may not.

    DISCREPANCY_FOUND -> MESSAGE_DRAFTED -> SENT (tap only) -> AWAITING_NEXT_PAYSLIP
      -> VERIFYING -> CORRECTED | PARTIALLY_CORRECTED | NOT_CORRECTED -> ESCALATION_PREPARED
                   -> UNVERIFIABLE -> (back to AWAITING_NEXT_PAYSLIP or VERIFYING)

Three properties this module is built to hold, each with a test:

1. THE MANDATE IS A RUNTIME CHOKEPOINT, NOT A TYPE-LEVEL GUARANTEE.
   Read that literally. `allowed_actions(level)` is a pure function and
   `Mandate.act()` is the single place an action is dispatched, so there is one
   line to audit rather than five. But the level arrives as data - a JSON field
   from a browser - and Python cannot make an ungranted action UNREPRESENTABLE
   at type-check time. What this module gives you is: one guard, on one path,
   checked by tests derived from the Action enum. It does not give you a proof.
   Do not describe it as one.

   Related, and worse: THIS BUILD HAS NO AUTHENTICATION. Nothing establishes
   that the worker granted the level the caller claims. See
   NO_AUTHENTICATION_NOTICE, which the API returns so a screen can say it.

2. VERIFY IS ARITHMETIC. No model participates in a verdict. `Verdict` is a
   derived property of three Decimals, never a stored field, so no code path can
   construct a result that claims CORRECTED without the numbers closing.

3. THE AGENT PREPARES; IT NEVER FILES. There is no network client in this
   module and no call that posts anywhere. Enforced by an AST test rather than
   by review (tests/test_agent_never_files.py), because the module will grow.

## Why UNVERIFIABLE exists

The domain contract names three verdicts. All three are assertions about the
employer's conduct in month 2. When month 2 cannot be established - readers
disagreed, a field is MISSING, a worker typed something that is not a number -
none of the three is available, and the tempting default, NOT_CORRECTED, is the
worst of them: it accuses on input the system never established, which is the
governing rule inverted. So verify() returns a fourth outcome carrying the
blocking field names and their statuses, so the screen can say WHICH fact is
missing rather than that something is (docs/debt.md, missing-narrated-as-settled).

UNVERIFIABLE is also not terminal. A worker whose month-2 payslip photographed
badly has not reached the end of anything; the state machine routes back to
AWAITING_NEXT_PAYSLIP and VERIFYING.

## What this cut does NOT build

`draft()` (the one place a model speaks) and the escalation pack's CONTENT are
deliberately absent. The mandate table below is the full specification - all
five actions at all five levels - because the table is the contract. The
dispatch is partial, and a permitted-but-unbuilt action raises
ActionNotBuiltError naming itself. It never returns an empty draft, and never
silently succeeds. TADM's evidence list and CPF Board's report fields must be
read from the published pages before they are typed; typing them from memory is
docs/debt.md, contested-secondary-source.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from enum import Enum

from fairslip.rules import (
    Fact,
    PayBreakdown,
    PayInputs,
    UnverifiedInputError,
    compute_expected,
)

# --------------------------------------------------------------------------
# What this build cannot establish, stated where a screen can show it
# --------------------------------------------------------------------------

NO_AUTHENTICATION_NOTICE = (
    "This build has no authentication. The mandate level is whatever the caller "
    "sends: nothing here establishes that the worker granted it. The refusals "
    "below are a guard against the software exceeding a level, not against a "
    "person claiming one."
)

# Pages a worker is pointed to so they can go to the authority themselves.
# These are DISPLAY ONLY. Nothing in this module fetches a URL, and
# tests/test_agent_never_files.py asserts that every URL literal appearing in
# this file is a member of this mapping.
REFERENCE_LINKS: dict[str, str] = {
    "mom_salary": "https://www.mom.gov.sg/employment-practices/salary",
    "mom_hours": "https://www.mom.gov.sg/employment-practices/hours-of-work-overtime-and-rest-days",
    "tadm": "https://www.tadm.sg/",
    "cpf_employer_obligations": "https://www.cpf.gov.sg/employer/employer-obligations",
    "mwc": "https://www.mwc.org.sg/",
}


# --------------------------------------------------------------------------
# The mandate
# --------------------------------------------------------------------------


class Action(str, Enum):
    """Everything the agent can be asked to do. The set is closed: adding a
    member without placing it in MANDATE_TABLE fails the mandate tests."""

    DRAFT = "draft"
    SEND = "send"
    TRACK = "track"
    VERIFY = "verify"
    PREPARE_ESCALATION = "prepare_escalation"


# Levels 0-4 exactly as .claude/rules/fairslip-domain.md specifies them.
# Cumulative by construction: each level is the one below it plus what it adds,
# so an action granted at N is granted at every level above N and
# required_level() is a well-defined minimum rather than a convention.
_L0: frozenset[Action] = frozenset()  # show me only
_L1: frozenset[Action] = _L0 | {Action.DRAFT}  # draft for me
_L2: frozenset[Action] = _L1 | {Action.SEND, Action.TRACK}  # draft and track
_L3: frozenset[Action] = _L2 | {Action.VERIFY}  # verify
_L4: frozenset[Action] = _L3 | {Action.PREPARE_ESCALATION}  # prepare escalation

MANDATE_TABLE: dict[int, frozenset[Action]] = {0: _L0, 1: _L1, 2: _L2, 3: _L3, 4: _L4}
MANDATE_LEVELS: frozenset[int] = frozenset(MANDATE_TABLE)

MANDATE_LABELS: dict[int, str] = {
    0: "Show me only",
    1: "Draft for me",
    2: "Draft and track",
    3: "Verify",
    4: "Prepare escalation",
}


class MandateError(ValueError):
    """Base for every refusal that is about the mandate rather than the facts."""


class MandateExceededError(MandateError):
    """An action outside the granted level.

    Carries the level that WOULD have permitted it, so a screen can offer the
    worker the choice rather than reporting a dead end. Same class of refusal as
    the engines' UnverifiedInputError / OutOfScopeError: a plain ValueError
    subclass whose message names what was refused and why."""

    def __init__(self, action: Action, granted_level: int) -> None:
        self.action = action
        self.granted_level = granted_level
        self.required_level = required_level(action)
        super().__init__(
            f"{action.value} is not available at mandate level {granted_level} "
            f"({MANDATE_LABELS[granted_level]}); it requires level {self.required_level} "
            f"({MANDATE_LABELS[self.required_level]})"
        )


class ActionNotBuiltError(MandateError):
    """Within the mandate, but this build does not implement it.

    Distinct from MandateExceededError on purpose: one says "you did not grant
    this", the other says "we did not build this". Collapsing them would tell a
    worker to raise their mandate level to reach something that would not work
    at any level."""


def _check_level(level: int) -> int:
    if level not in MANDATE_LEVELS:
        raise MandateError(
            f"unknown mandate level {level!r}; the levels are {sorted(MANDATE_LEVELS)}"
        )
    return level


def allowed_actions(level: int) -> frozenset[Action]:
    """Pure. The action set is a function of the level and of nothing else."""
    return MANDATE_TABLE[_check_level(level)]


def required_level(action: Action) -> int:
    """The lowest level that grants this action."""
    return min(level for level, actions in MANDATE_TABLE.items() if action in actions)


# --------------------------------------------------------------------------
# The tap. SENT cannot exist without one.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class TapEvent:
    """A worker's explicit approval, at a moment.

    `at` has NO DEFAULT, and in particular no default_factory of datetime.now:
    a minted timestamp would be a fake timestamp for a tap nobody made
    (.claude/rules/honesty.md - no placeholder values that look real). The
    moment recorded is the moment of the tap, never the moment of recording."""

    at: datetime
    surface: str

    def __post_init__(self) -> None:
        if self.at.tzinfo is None or self.at.tzinfo.utcoffset(self.at) is None:
            raise ValueError(
                "tap timestamp must carry a timezone; a naive datetime is a moment "
                "in an unstated zone, not a moment"
            )
        if not self.surface.strip():
            raise ValueError("tap must record the surface the worker tapped")


@dataclass(frozen=True)
class Sent:
    """The record that a message was sent, which requires a tap to exist.

    `tap` has no default, so there is no way to construct this without one, and
    no code path can therefore record SENT without a tap. That is the structural
    half of the guard; Mandate.act() refusing a missing tap is the runtime half."""

    tap: TapEvent
    message_id: str
    state: AgentState = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        # Set here rather than as a default so the value is derived from the
        # class's meaning, not supplied by a caller who could pass anything.
        object.__setattr__(self, "state", AgentState.SENT)


# --------------------------------------------------------------------------
# The state machine
# --------------------------------------------------------------------------


class AgentState(str, Enum):
    DISCREPANCY_FOUND = "DISCREPANCY_FOUND"
    MESSAGE_DRAFTED = "MESSAGE_DRAFTED"
    SENT = "SENT"
    AWAITING_NEXT_PAYSLIP = "AWAITING_NEXT_PAYSLIP"
    VERIFYING = "VERIFYING"
    CORRECTED = "CORRECTED"
    PARTIALLY_CORRECTED = "PARTIALLY_CORRECTED"
    NOT_CORRECTED = "NOT_CORRECTED"
    UNVERIFIABLE = "UNVERIFIABLE"
    ESCALATION_PREPARED = "ESCALATION_PREPARED"


TRANSITIONS: dict[AgentState, frozenset[AgentState]] = {
    AgentState.DISCREPANCY_FOUND: frozenset({AgentState.MESSAGE_DRAFTED}),
    AgentState.MESSAGE_DRAFTED: frozenset({AgentState.SENT}),
    # AWAITING is reachable ONLY through SENT. A drafted message is not a sent one.
    AgentState.SENT: frozenset({AgentState.AWAITING_NEXT_PAYSLIP}),
    AgentState.AWAITING_NEXT_PAYSLIP: frozenset({AgentState.VERIFYING}),
    AgentState.VERIFYING: frozenset(
        {
            AgentState.CORRECTED,
            AgentState.PARTIALLY_CORRECTED,
            AgentState.NOT_CORRECTED,
            AgentState.UNVERIFIABLE,
        }
    ),
    # UNVERIFIABLE is NOT terminal. A worker whose month-2 payslip could not be
    # read has not reached the end of anything: they can supply it again, or
    # wait for the next salary period.
    AgentState.UNVERIFIABLE: frozenset(
        {AgentState.AWAITING_NEXT_PAYSLIP, AgentState.VERIFYING}
    ),
    AgentState.PARTIALLY_CORRECTED: frozenset({AgentState.ESCALATION_PREPARED}),
    AgentState.NOT_CORRECTED: frozenset({AgentState.ESCALATION_PREPARED}),
    # Terminal: the arithmetic closed. This is the only state in which the word
    # "resolved" would be defensible, and even here the UI says what closed.
    AgentState.CORRECTED: frozenset(),
    AgentState.ESCALATION_PREPARED: frozenset(),
}


def reachable_states(
    start: AgentState, excluding: frozenset[AgentState] | set[AgentState] = frozenset()
) -> frozenset[AgentState]:
    """Every state reachable from `start`, optionally with some states deleted
    from the graph. Deleting SENT and asking whether AWAITING_NEXT_PAYSLIP is
    still reachable is how the tests prove no edge routes around the tap."""
    seen: set[AgentState] = set()
    queue = [s for s in TRANSITIONS.get(start, frozenset()) if s not in excluding]
    while queue:
        state = queue.pop()
        if state in seen or state in excluding:
            continue
        seen.add(state)
        queue.extend(s for s in TRANSITIONS.get(state, frozenset()) if s not in excluding)
    return frozenset(seen)


# --------------------------------------------------------------------------
# verify(): arithmetic, and only arithmetic
# --------------------------------------------------------------------------

# "Within one cent". Money is Decimal throughout, so this is an exact bound on
# rounding residue, not a tolerance for approximation.
CLOSING_TOLERANCE = Decimal("0.01")


class Verdict(str, Enum):
    CORRECTED = "CORRECTED"
    PARTIALLY_CORRECTED = "PARTIALLY_CORRECTED"
    NOT_CORRECTED = "NOT_CORRECTED"
    UNVERIFIABLE = "UNVERIFIABLE"


@dataclass(frozen=True)
class VerifyResult:
    """An arithmetic verdict, and the numbers that produced it.

    There is NO `verdict` field. It is a derived property, so there is no
    parameter anybody could set to CORRECTED: the only way to get CORRECTED out
    of this class is for the arithmetic to close. Turning `verdict` into a field
    reddens test_verdict_is_derived_and_not_a_settable_field.

    The arithmetic, in full:

        month1_difference   expected_net - net_paid, month 1   (+ve = short)
        month2_difference   expected_net - net_paid, month 2
        adjustment_found    -month2_difference: what month 2 paid ABOVE its own
                            expected net, i.e. what looks like back-pay
        remaining_gap       month1_difference - adjustment_found

    On the corrected fixture: 62.24 - 62.24 = 0.00.
    On the uncorrected one:   62.24 - (-62.24) = 124.48 - month 2 repeated the
    same shortfall, so the cumulative gap grew rather than narrowed."""

    month1_difference: Decimal
    month2_difference: Decimal
    month1_expected_net: Decimal
    month2_expected_net: Decimal
    month2_net_paid: Decimal

    @property
    def adjustment_found(self) -> Decimal:
        """What month 2 paid above what month 2 alone required. Negative means
        month 2 was short too."""
        return -self.month2_difference

    @property
    def remaining_gap(self) -> Decimal:
        return self.month1_difference - self.adjustment_found

    @property
    def verdict(self) -> Verdict:
        """The single place a verdict is decided, from three Decimals. No model,
        no heuristic, no threshold beyond one cent."""
        if abs(self.remaining_gap) <= CLOSING_TOLERANCE:
            return Verdict.CORRECTED
        if abs(self.remaining_gap) < abs(self.month1_difference):
            return Verdict.PARTIALLY_CORRECTED
        return Verdict.NOT_CORRECTED

    @property
    def state(self) -> AgentState:
        return AgentState(self.verdict.value)


@dataclass(frozen=True)
class BlockedField:
    """One reason month 2 could not be verified. `status` is a Status value where
    the fact was simply not established, or UNUSABLE_VALUE where a person
    answered with something the engine cannot compute on."""

    name: str
    status: str
    detail: str


UNUSABLE_VALUE = "UNUSABLE_VALUE"


@dataclass(frozen=True)
class Unverifiable:
    """Month 2 could not be established, so no claim is made about month 2.

    Deliberately carries NO remaining_gap and no month-2 figures: it did not
    compute any, and a zero would read as "nothing outstanding". The month-1
    difference is still reportable, because month 1 WAS established.

    Not an error and not a failure - it is an outcome, and the worker can try
    again. See the module docstring for why NOT_CORRECTED is not an acceptable
    fallback here."""

    month1_difference: Decimal
    blocked_by: tuple[BlockedField, ...]

    @property
    def verdict(self) -> Verdict:
        return Verdict.UNVERIFIABLE

    @property
    def state(self) -> AgentState:
        return AgentState.UNVERIFIABLE


def _unestablished_fields(inp: PayInputs) -> tuple[BlockedField, ...]:
    """The status gate, applied at the boundary rather than inside a formula.

    Checking here rather than relying on compute_expected()'s first refusal means
    the worker is told about EVERY blocking field at once, not the first one
    alphabetically - and it fires on every field, not only those a particular
    month's branch happens to reach (docs/debt.md,
    guard-that-only-fires-on-some-paths)."""
    blocked: list[BlockedField] = []
    for f in dataclasses.fields(PayInputs):
        fact = getattr(inp, f.name)
        if fact is None:
            continue  # an optional fact that was not supplied is not a blocker
        if not isinstance(fact, Fact):
            blocked.append(
                BlockedField(f.name, UNUSABLE_VALUE, f"{f.name} is not a Fact")
            )
            continue
        if not fact.established:
            blocked.append(
                BlockedField(
                    f.name,
                    fact.status.value,
                    fact.source or f"{f.name} is {fact.status.value}",
                )
            )
    return tuple(blocked)


def _blocked_from_engine_refusal(exc: UnverifiedInputError) -> tuple[BlockedField, ...]:
    """Turn the engine's refusal into a named field where - and only where - the
    message actually begins with a real PayInputs field name. Claiming a field
    name parsed out of prose that did not contain one would be inventing the
    cause of a refusal (docs/debt.md, ui-invents-a-cause)."""
    message = str(exc)
    known = {f.name for f in dataclasses.fields(PayInputs)}
    head = message.split(":", 1)[0].split(" ", 1)[0].strip()
    name = head if head in known else ""
    return (BlockedField(name=name, status=UNUSABLE_VALUE, detail=message),)


def verify(month1: PayBreakdown, month2: PayInputs) -> VerifyResult | Unverifiable:
    """Did month 2 make good the month-1 difference?

    Takes month 1 as an already-computed PayBreakdown and month 2 as established
    facts, and runs month 2 through the SAME engine. The two-reader extraction
    happens upstream, on the same /extract route month 1 used - not from inside
    this function, which has no model in it and no network access at all.

    Returns Unverifiable rather than raising when month 2 is not established:
    the caller asked a question with four honest answers, and one of them is
    "we cannot say"."""
    blocked = _unestablished_fields(month2)
    if blocked:
        return Unverifiable(month1_difference=month1.difference, blocked_by=blocked)

    try:
        b2 = compute_expected(month2)
    except (UnverifiedInputError, InvalidOperation, ValueError) as exc:
        # The value gate. A status of HUMAN_CONFIRMED said a person answered; it
        # did not say the answer was a number this engine can use.
        if isinstance(exc, UnverifiedInputError):
            return Unverifiable(
                month1_difference=month1.difference,
                blocked_by=_blocked_from_engine_refusal(exc),
            )
        return Unverifiable(
            month1_difference=month1.difference,
            blocked_by=(BlockedField("", UNUSABLE_VALUE, str(exc)),),
        )

    return VerifyResult(
        month1_difference=month1.difference,
        month2_difference=b2.difference,
        month1_expected_net=month1.expected_net,
        month2_expected_net=b2.expected_net,
        month2_net_paid=b2.net_paid,
    )


# --------------------------------------------------------------------------
# The single chokepoint
# --------------------------------------------------------------------------


def _send(tap: TapEvent | None = None, message_id: str = "") -> Sent:
    """Record that the worker sent the message.

    This does not transmit anything: there is no client in this module. It
    records the worker's tap, and the worker sends the message from their own
    phone. Two guards, one structural and one here: Sent cannot be built without
    a tap, and this refuses a missing one before trying."""
    if tap is None:
        raise MandateError(
            "send requires a tap: there is no path that records SENT without an "
            "explicit approval carrying a timestamp"
        )
    if not isinstance(tap, TapEvent):
        raise MandateError(f"tap must be a TapEvent, not {type(tap).__name__}")
    return Sent(tap=tap, message_id=message_id or f"msg-{tap.at.isoformat()}")


def _track(**_: object) -> None:
    raise ActionNotBuiltError(
        "track is within this mandate level but is not built in this cut; "
        "the tracking window is the next salary period"
    )


def _not_built(action: Action) -> ActionNotBuiltError:
    return ActionNotBuiltError(
        f"{action.value} is within this mandate level but is not built in this "
        f"cut of FairSlip. It is not disabled by your mandate, and raising your "
        f"mandate level will not enable it."
    )


@dataclass(frozen=True)
class Mandate:
    """The level the worker granted, and the only way to act under it.

    `act()` is the ONE place an action is dispatched. That is a runtime
    chokepoint on a single path - deliberately one line to audit - and it is not
    a type-level guarantee that an ungranted action cannot be expressed. See the
    module docstring."""

    level: int

    def __post_init__(self) -> None:
        _check_level(self.level)

    @property
    def label(self) -> str:
        return MANDATE_LABELS[self.level]

    @property
    def allowed(self) -> frozenset[Action]:
        return allowed_actions(self.level)

    def permits(self, action: Action) -> bool:
        return action in self.allowed

    def act(self, action: Action, **kwargs: object):
        """The chokepoint. Every action goes through here, and the guard is the
        first thing that happens - before any argument is looked at, so an
        ungranted action cannot have a side effect on its way to being refused."""
        if action not in allowed_actions(self.level):
            raise MandateExceededError(action, self.level)

        if action is Action.SEND:
            return _send(**kwargs)  # type: ignore[arg-type]
        if action is Action.VERIFY:
            return verify(**kwargs)  # type: ignore[arg-type]
        raise _not_built(action)
