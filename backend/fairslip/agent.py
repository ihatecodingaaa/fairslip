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
import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from enum import Enum
from pathlib import Path

from fairslip.rules import (
    Fact,
    PayBreakdown,
    PayInputs,
    UnverifiedInputError,
    compute_expected,
    to_cents,
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
# TADM moved from tadm.sg to tal.sg: every tadm.sg URL now 301s, and the old
# user-guide PDF path 404s outright. These are the destinations verified by
# fetching them on 7 Sept 2026, not the redirect sources.
REFERENCE_LINKS: dict[str, str] = {
    "mom_salary": "https://www.mom.gov.sg/employment-practices/salary",
    "mom_hours": "https://www.mom.gov.sg/employment-practices/hours-of-work-overtime-and-rest-days",
    "mom_disputes": "https://www.mom.gov.sg/employment-practices/managing-employment-disputes",
    "tadm": "https://www.tal.sg/tadm",
    "tadm_file_claim": "https://www.tal.sg/tadm/eservices/employees-file-employment-claim",
    "cpf_employer_obligations": "https://www.cpf.gov.sg/employer/employer-obligations",
    "cpf_report_underpayment": "https://www.cpf.gov.sg/service/article/how-can-i-lodge-a-report-for-non-payment-or-underpayment-of-cpf-contributions",
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

# The mandate table is the specification. This is what the build implements.
# Keeping them separate matters on screen: a level card that lists an action as
# something the worker "may" allow is making a claim about the software, and
# "specified" is not "built".
BUILT_ACTIONS: frozenset[Action] = frozenset(
    {Action.DRAFT, Action.SEND, Action.VERIFY, Action.PREPARE_ESCALATION}
)


def is_built(action: Action) -> bool:
    return action in BUILT_ACTIONS


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


# WHICH ACTION ENTERS EACH STATE.
#
# TRANSITIONS says which state may follow which. This says what the worker must
# have ALLOWED for each one to be reachable at all, and the two together are
# what lets a screen strike a state through and name the level that would permit
# it - rather than drawing a graph that ignores the mandate it exists to
# illustrate.
#
# DISCREPANCY_FOUND has no action. It is where the reconciliation leaves you,
# and no mandate is needed to be told that a number does not add up.
#
# The four verdicts are all entered by VERIFY: they are its outcomes, not
# separate things the worker allows. So at level 2 the whole of the right-hand
# side of the diagram is struck through by one missing permission, which is the
# mandate argument in a single picture.
ENTERED_BY: dict[AgentState, Action | None] = {
    AgentState.DISCREPANCY_FOUND: None,
    AgentState.MESSAGE_DRAFTED: Action.DRAFT,
    AgentState.SENT: Action.SEND,
    AgentState.AWAITING_NEXT_PAYSLIP: Action.TRACK,
    AgentState.VERIFYING: Action.VERIFY,
    AgentState.CORRECTED: Action.VERIFY,
    AgentState.PARTIALLY_CORRECTED: Action.VERIFY,
    AgentState.NOT_CORRECTED: Action.VERIFY,
    AgentState.UNVERIFIABLE: Action.VERIFY,
    AgentState.ESCALATION_PREPARED: Action.PREPARE_ESCALATION,
}


def state_requires_level(state: AgentState) -> int | None:
    """The lowest mandate level at which this state can be reached at all.

    None for DISCREPANCY_FOUND, which needs no permission. Derived from
    ENTERED_BY and required_level(), so a level that moves in MANDATE_TABLE
    moves here too and cannot be restated wrongly on a diagram.
    """
    action = ENTERED_BY[state]
    return None if action is None else required_level(action)


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
        if action is Action.DRAFT:
            return read_draft_with_cache(**kwargs)  # type: ignore[arg-type]
        if action is Action.PREPARE_ESCALATION:
            return prepare_escalation(**kwargs)  # type: ignore[arg-type]
        raise _not_built(action)


# --------------------------------------------------------------------------
# draft(): the ONE place a model speaks
#
# Everything above this line is arithmetic and refusals. Below it, a model
# writes prose - and every constraint that matters is enforced in code AFTER
# the model has spoken, not merely requested of it in the prompt:
#
#   - Every dollar figure in the text must be one an engine produced. A figure
#     the model invented fails the check and the draft is REJECTED, not returned
#     with a warning.
#   - The forbidden words from the UI copy contract are checked against the
#     output. A draft containing "owed" never reaches a worker.
#   - The NGO / MWC alternative is a field with no default, so a Draft cannot be
#     constructed without it. It is shown alongside every draft, not buried.
#
# A prompt is a request. A check is a guarantee. These are checks.
# --------------------------------------------------------------------------

# Bump when the template, the constraints, or the figure set changes. Part of
# the cache key, so a cached draft can never be replayed as though a different
# template produced it.
DRAFT_TEMPLATE_VERSION = "2026-09-07.2"

# The same Haiku tier as reader A. The reason is cost and latency on a path a
# worker waits on, and it is defensible ONLY because nothing about the draft's
# correctness rests on the model: the figures are the engines', the arithmetic
# is checked after the fact, and a draft citing a number no engine produced is
# rejected rather than shown. If the model writes clumsy Bengali that is a
# quality problem a human reviewer catches before the demo; if it invents a
# number, the code catches it every time.
DRAFT_MODEL_ENV = "FAIRSLIP_DRAFT_MODEL"
DEFAULT_DRAFT_MODEL = "claude-haiku-4-5"

DEFAULT_DRAFT_CACHE_DIR = Path(__file__).resolve().parent.parent / "demo" / "draft_cache"

DRAFT_CACHE_HIT = "HIT"
DRAFT_CACHE_MISS = "MISS"

DRAFT_MAX_TOKENS = 2048

# Phrases that claim to know what a document shows. The draft is written from
# ENGINE OUTPUT, not from the payslip: the overtime and rest-day figures were
# reconstructed from MOM's rules and a payslip that printed them would not be in
# dispute. A message a worker sends to their employer must not open by
# misdescribing their own payslip.
FORBIDDEN_DOCUMENT_CLAIMS: tuple[str, ...] = (
    "my payslip shows",
    "my payslip says",
    "the payslip shows",
    "the payslip says",
    "my payslip states",
    "as shown on my payslip",
    "according to my payslip",
)

# From .claude/rules/fairslip-domain.md, "UI copy contract".
FORBIDDEN_WORDS: tuple[str, ...] = (
    "owed",
    "underpaid",
    "breach",
    "illegal",
    "entitled",
    "resolved",
    "must pay",
    "you must",
)


class DraftError(RuntimeError):
    """The draft could not be produced, or was produced and rejected."""


class DraftRejectedError(DraftError):
    """The model wrote something the copy contract forbids, or cited a figure no
    engine produced. The draft is discarded. It is never returned with the
    offending part stripped: a message that had to be censored to be shown is
    not a message this system should put in a worker's hands."""


class DraftCacheMissError(DraftError):
    """No committed entry, and live calls were not permitted."""


@dataclass(frozen=True)
class CitedFigure:
    """One number the draft may use, and where it came from.

    `amount` is an engine's own Decimal. `formula` and `source` are the engine's
    own strings - this module never composes an explanation of a number."""

    label: str
    amount: Decimal
    formula: str
    source: str

    @property
    def display(self) -> str:
        return f"{to_cents(self.amount) + Decimal(0):,.2f}"


@dataclass(frozen=True)
class NgoOption:
    name: str
    what_they_do: str
    link: str


@dataclass(frozen=True)
class NgoAlternative:
    """Shown ALONGSIDE every draft. `Draft.alternative` has no default, so a
    draft cannot be constructed without it - the structural form of "not
    buried"."""

    heading: str
    options: tuple[NgoOption, ...]


def ngo_alternative(*, migrant_worker: bool = False) -> NgoAlternative:
    """The worker does not have to send anything. Named every time a draft is shown.

    Each line says only what the organisation's name and published remit
    establish, and links out so the worker reads their terms rather than
    FairSlip's summary of them. The previous version told a worker that
    mediation is free, that a mediator checks the figures with both sides, and
    that MWC will talk to an employer for them - three claims about a third
    party's service that nothing in this repo establishes, stated in FairSlip's
    voice beside figures that ARE established.

    MWC appears only for the workers it exists for. Offering "free help for
    migrant workers" to a Singapore Citizen asserts something about the reader
    that nothing established.
    """
    options = [
        NgoOption(
            name="Tripartite Alliance for Dispute Management (TADM)",
            what_they_do=(
                "Singapore's body for employment and salary disputes. Their page "
                "sets out who can file and what to bring."
            ),
            link=REFERENCE_LINKS["tadm_file_claim"],
        ),
        NgoOption(
            name="Ministry of Manpower (MOM)",
            what_they_do="MOM's guidance on salary disputes and what the rules require.",
            link=REFERENCE_LINKS["mom_disputes"],
        ),
    ]
    if migrant_worker:
        options.insert(
            0,
            NgoOption(
                name="Migrant Workers' Centre (MWC)",
                what_they_do=(
                    "A Singapore organisation for migrant workers. Their page sets "
                    "out the help they offer and how to reach them."
                ),
                link=REFERENCE_LINKS["mwc"],
            ),
        )
    return NgoAlternative(
        heading="You do not have to send this. You can ask someone to help instead:",
        options=tuple(options),
    )


@dataclass(frozen=True)
class DraftSpec:
    """Everything a draft may cite, and nothing else.

    THE KEY RULE: if a value can change a word of the draft, it is in here, and
    therefore in the cache key. A spec that omitted the salary period would let a
    cached September draft be replayed for October with the wrong month in its
    first sentence."""

    figures: tuple[CitedFigure, ...]
    expected_net: Decimal
    net_paid: Decimal
    difference: Decimal
    flags: tuple[str, ...]
    salary_period: str
    language: str  # the worker's language, named in English, e.g. "Bengali"
    employer_name: str = ""

    def canonical(self) -> str:
        """ONE canonical form, named here so the tests can cite it: JSON, keys
        sorted, every Decimal rendered by str() on the engine's own Decimal - not
        rounded, not floated, never via repr. docs/debt.md,
        equal-objects-different-canonical-forms."""
        return json.dumps(
            {
                "figures": [
                    {
                        "label": f.label,
                        "amount": str(f.amount),
                        "formula": f.formula,
                        "source": f.source,
                    }
                    for f in self.figures
                ],
                "expected_net": str(self.expected_net),
                "net_paid": str(self.net_paid),
                "difference": str(self.difference),
                "flags": list(self.flags),
                "salary_period": self.salary_period,
                "language": self.language,
                "employer_name": self.employer_name,
            },
            sort_keys=True,
            separators=(",", ":"),
        )


def draft_model() -> str:
    return os.getenv(DRAFT_MODEL_ENV, DEFAULT_DRAFT_MODEL)


def draft_cache_key(spec: DraftSpec, model: str | None = None) -> str:
    """Covers the template version, the model, and every figure and label the
    draft may cite. Change any one and the key changes and the cache misses.

    Deliberately NOT a refactor of extract.cache_key(). Their inputs have nothing
    in common - one hashes image bytes, the other engine output - and unifying
    them would mean touching the byte layout that six committed extraction
    entries are already keyed by. The saving is a few lines; the risk is silently
    orphaning the offline demo."""
    h = hashlib.sha256()
    h.update(DRAFT_TEMPLATE_VERSION.encode())
    h.update(b"\0")
    h.update((model or draft_model()).encode())
    h.update(b"\0")
    h.update(spec.canonical().encode())
    return h.hexdigest()


@dataclass(frozen=True)
class Draft:
    """A message to the employer, in English and the worker's language.

    `alternative` has no default: every draft carries the NGO route beside it.
    `figures_cited` is what the text was checked against - not decoration, but
    the evidence the check ran."""

    english: str
    translated: str
    language: str
    figures_cited: tuple[CitedFigure, ...]
    alternative: NgoAlternative
    model: str
    cache: str
    cache_key: str
    # The DATE a cached draft was generated. Deliberately not a latency: a stored
    # duration rendered beside a cache status reads as timing the request in
    # front of the viewer (docs/debt.md, cached-path-wearing-a-live-timing).
    generated_on: str = ""

    @property
    def from_cache(self) -> bool:
        return self.cache == DRAFT_CACHE_HIT


_MONEY_IN_TEXT = re.compile(r"\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)")


def _figures_in_text(text: str) -> set[str]:
    """Every dollar amount the model wrote, normalised to a bare number string."""
    return {m.group(1).replace(",", "") for m in _MONEY_IN_TEXT.finditer(text)}


def _allowed_figure_strings(spec: DraftSpec) -> set[str]:
    """Exactly the amounts an engine produced, in the two spellings a model might
    write them: bare cents, and with thousands separators stripped back off."""
    amounts = [f.amount for f in spec.figures]
    amounts += [spec.expected_net, spec.net_paid, spec.difference]
    allowed: set[str] = set()
    for a in amounts:
        cents = to_cents(a) + Decimal(0)
        allowed.add(f"{cents:.2f}")
        allowed.add(f"{cents:,.2f}".replace(",", ""))
    return allowed


def _check_draft_text(text: str, spec: DraftSpec, where: str) -> None:
    """The guarantee. Runs on the model's output, in both languages.

    Two checks, both refusals rather than warnings:
      1. No forbidden word from the UI copy contract.
      2. Every dollar figure in the text is one an engine produced."""
    lowered = text.lower()
    hits = [w for w in FORBIDDEN_WORDS if w in lowered]
    if hits:
        raise DraftRejectedError(
            f"{where}: the draft used {hits}, which the copy contract forbids. "
            f"Rejected rather than edited."
        )

    claims = [c for c in FORBIDDEN_DOCUMENT_CLAIMS if c in lowered]
    if claims:
        raise DraftRejectedError(
            f"{where}: the draft says {claims}, claiming to know what a document "
            f"shows. These figures were reconstructed from the rules, not read "
            f"off a payslip."
        )

    allowed = _allowed_figure_strings(spec)
    invented = sorted(_figures_in_text(text) - allowed)
    if invented:
        raise DraftRejectedError(
            f"{where}: the draft cites {invented}, which no engine produced. "
            f"The figures it may use are {sorted(allowed)}."
        )


def draft_prompt(spec: DraftSpec) -> str:
    """The instruction. Note what it does NOT ask for: it never asks the model to
    calculate. It supplies finished figures and asks for sentences around them."""
    lines = "\n".join(
        f"- {f.label}: ${f.display}  (worked out as: {f.formula}; read from: {f.source})"
        for f in spec.figures
    )
    expected = f"{to_cents(spec.expected_net) + Decimal(0):,.2f}"
    paid = f"{to_cents(spec.net_paid) + Decimal(0):,.2f}"
    diff = f"{to_cents(spec.difference) + Decimal(0):,.2f}"
    return f"""Write a short, factual, NON-ACCUSATORY message from an employee to their
employer about a possible difference in one month of pay.

Salary period: {spec.salary_period}

These figures were computed by a rules engine from the Singapore Ministry of
Manpower published rules. They are the ONLY figures you may use:

{lines}
- What the documents imply the month should have paid, after deductions: ${expected}
- What the employee says reached their bank account: ${paid}
- The difference between those two: ${diff}

HARD RULES. A message that breaks any of these is discarded:

1. Do not calculate anything. Every dollar figure you write must be one of the
   figures above, copied exactly. Do not add them up, do not convert them, do
   not round them differently, do not introduce a total.
2. Do not assert that the employer did anything wrong. This is a request to
   check a difference together, not an allegation. The employee does not know
   why the figures differ, and neither do you.
3. Never use the words: owed, underpaid, breach, illegal, entitled, resolved,
   "must pay", "you must". Do not use synonyms that make the same accusation.
4. Say where the expectation comes from: the Ministry of Manpower published
   rules on overtime and rest-day pay. Do not cite a section number, and do not
   claim any legal consequence.
5. Ask the employer to check and explain, and say plainly that the employee may
   have misunderstood something and would welcome being corrected.
6. DO NOT SAY WHAT ANY DOCUMENT SHOWS. You have not seen the payslip. The
   figures above were RECONSTRUCTED by a rules engine, and most of them are not
   printed on any document - "my payslip shows: overtime $169.93" is a claim
   about a document you cannot make. Write "I worked out" or "the rules say the
   month should have paid", never "my payslip shows" or "my payslip says".

Write it twice.

FIRST, in plain English, at roughly a primary-school reading level. Short
sentences, no jargon.

SECOND, the same message in {spec.language}, written naturally in that language -
a translation a native speaker would find normal, not word-for-word. Keep the
dollar figures in the same "$1,234.56" form in both versions.

Return ONLY a JSON object: {{"english": "...", "translated": "..."}}"""


def _parse_draft_json(raw: str) -> tuple[str, str]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise DraftError(f"the model did not return JSON: {e}") from e
    if not isinstance(parsed, dict):
        raise DraftError(f"the model returned {type(parsed).__name__}, not a JSON object")
    english = parsed.get("english")
    translated = parsed.get("translated")
    if not isinstance(english, str) or not english.strip():
        raise DraftError("the model returned no English text")
    if not isinstance(translated, str) or not translated.strip():
        raise DraftError("the model returned no translated text")
    return english, translated


def _build_draft(
    spec: DraftSpec,
    english: str,
    translated: str,
    model: str,
    cache: str,
    key: str,
    generated_on: str = "",
    *,
    migrant_worker: bool = False,
) -> Draft:
    """The single construction point, so the checks cannot be bypassed by a
    caller who builds a Draft straight from a cache file. A committed entry gets
    exactly the same scrutiny as a live answer: an entry generated before a rule
    tightened must not sail through on the strength of having been committed."""
    _check_draft_text(english, spec, "english")
    _check_draft_text(translated, spec, spec.language.lower())
    return Draft(
        english=english,
        translated=translated,
        language=spec.language,
        figures_cited=spec.figures,
        alternative=ngo_alternative(migrant_worker=migrant_worker),
        model=model,
        cache=cache,
        cache_key=key,
        generated_on=generated_on,
    )


def call_draft_model(spec: DraftSpec, model: str, api_key: str | None = None) -> tuple[str, str]:
    """The one network call in this module, and the only one there will be.

    Imported inside the function, exactly as fairslip/extract.py does it, so the
    module's import surface stays free of anything that opens a socket - which is
    what tests/test_agent_never_files.py asserts."""
    try:
        import anthropic
    except ImportError as e:  # pragma: no cover - dependency is declared
        raise DraftError(f"anthropic SDK not installed: {e}") from e

    key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise DraftError("ANTHROPIC_API_KEY is not set")

    client = anthropic.Anthropic(api_key=key)
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=DRAFT_MAX_TOKENS,
            messages=[{"role": "user", "content": draft_prompt(spec)}],
        )
    except Exception as e:
        raise DraftError(f"{type(e).__name__}: {e}") from e

    if resp.stop_reason == "refusal":
        raise DraftError("the model declined to write this message")
    text = next((b.text for b in resp.content if b.type == "text"), None)
    if text is None:
        raise DraftError(f"no text block in the response (stop_reason={resp.stop_reason})")
    return _parse_draft_json(text.strip().removeprefix("```json").removesuffix("```").strip())


# --------------------------------------------------------------------------
# The draft cache. Same contract as the extraction cache, word for word:
# GENERATED OFFLINE, COMMITTED TO THE REPO, READ-ONLY AT RUNTIME.
#
#     backend/scripts/make_draft_entry.py   the only writer, run by hand
#               |  (entry committed to git)
#               v
#     backend/demo/draft_cache/*.json
#               |
#     load_draft_entry()  <-  read_draft_with_cache()
#
# Nothing in the request path writes. A write path here would be unreachable on
# a read-only serverless filesystem and would fail silently there, which is the
# defect this contract exists to prevent (docs/debt.md,
# write-path-contradicts-its-own-contract).
# --------------------------------------------------------------------------


def draft_entry_path(spec: DraftSpec, cache_dir: Path, model: str | None = None) -> Path:
    return cache_dir / f"{draft_cache_key(spec, model)}.json"


def load_draft_entry(
    spec: DraftSpec,
    cache_dir: Path | None,
    model: str | None = None,
    *,
    migrant_worker: bool = False,
) -> Draft | None:
    """Read a committed entry, or return None. Never calls a model, never writes.

    A corrupt or truncated entry is a MISS, not a draft: returning half a parsed
    file would be handing a worker a message nobody wrote."""
    if cache_dir is None:
        return None
    used = model or draft_model()
    key = draft_cache_key(spec, used)
    path = cache_dir / f"{key}.json"
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        english = payload["english"]
        translated = payload["translated"]
        if not isinstance(english, str) or not isinstance(translated, str):
            return None
    except (OSError, ValueError, KeyError, TypeError):
        return None
    # Re-checked on the way out, not trusted for having been committed.
    return _build_draft(
        spec,
        english,
        translated,
        used,
        DRAFT_CACHE_HIT,
        key,
        generated_on=str(payload.get("generated_on", "")),
        migrant_worker=migrant_worker,
    )


def read_draft_with_cache(
    spec: DraftSpec,
    cache_dir: Path | None = DEFAULT_DRAFT_CACHE_DIR,
    *,
    allow_live: bool = True,
    model: str | None = None,
    migrant_worker: bool = False,
) -> Draft:
    """Replay a committed entry if one exists; otherwise call the model.

    THIS FUNCTION NEVER WRITES. With allow_live=False a miss raises
    DraftCacheMissError rather than reaching the network - the setting the
    offline control run uses to prove the demo path is genuinely cached and not
    merely fast (docs/debt.md, fast-is-not-cached)."""
    used = model or draft_model()
    cached = load_draft_entry(spec, cache_dir, used, migrant_worker=migrant_worker)
    if cached is not None:
        return cached

    key = draft_cache_key(spec, used)
    if not allow_live:
        raise DraftCacheMissError(
            f"no committed draft entry for {used} at {key}; live calls are "
            f"disabled, so nothing was written"
        )

    english, translated = call_draft_model(spec, used)
    return _build_draft(
        spec, english, translated, used, DRAFT_CACHE_MISS, key,
        migrant_worker=migrant_worker,
    )


def write_draft_entry(
    spec: DraftSpec,
    cache_dir: Path = DEFAULT_DRAFT_CACHE_DIR,
    model: str | None = None,
) -> tuple[Path, Draft]:
    """Call the model for real and commit the answer to disk.

    The ONLY thing in the codebase that writes a draft entry, and nothing in the
    request path calls it. Invoked by hand from backend/scripts/make_draft_entry.py.

    A rejected draft is never written: committing one would ship a message that
    breaks the copy contract and make it permanent."""
    used = model or draft_model()
    english, translated = call_draft_model(spec, used)
    generated_on = datetime.now(UTC).date().isoformat()
    # Built (and therefore checked) BEFORE anything touches the disk.
    draft = _build_draft(spec, english, translated, used, DRAFT_CACHE_MISS, "", generated_on)

    key = draft_cache_key(spec, used)
    path = cache_dir / f"{key}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "template_version": DRAFT_TEMPLATE_VERSION,
                "model": used,
                "language": spec.language,
                "generated_on": generated_on,
                "spec_canonical": spec.canonical(),
                "english": draft.english,
                "translated": draft.translated,
            },
            indent=2,
            sort_keys=True,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return path, draft


# --------------------------------------------------------------------------
# prepare_escalation: the TADM half, and the CPF half that is NOT built
#
# TADM publishes the documents a worker is asked to upload, and those four
# items were read from the page on 7 Sept 2026 and are quoted verbatim below,
# each carrying the URL it came from.
#
# CPF Board's under-payment report is a different matter. Its page tells a
# member to "lodge a report" behind a link that returned HTTP 403, so the form
# has NOT been read and its fields are unknown. A pre-filled body for a form
# nobody has seen would be invented structure presented as an official one -
# docs/debt.md, contested-secondary-source, in its most consequential form,
# because a worker would carry it to a government counter. So this pack builds
# the TADM half and says plainly that the CPF half is absent and why.
#
# It ASSEMBLES. It does not file. There is no network client in this module.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class EvidenceItem:
    """One document TADM asks for, quoted from its published page.

    `quoted` is the page's own wording, unedited. `note` is FairSlip's plain
    gloss, kept separate so a reader can always see which words are TADM's."""

    quoted: str
    note: str
    source_url: str
    source_label: str


@dataclass(frozen=True)
class Deadline:
    """`source_label` names the page, because these quotes are MOM's and they sit
    under a heading about TADM. A quotation whose attribution is inherited from a
    nearby heading is attributed to the wrong body."""

    label: str
    quoted: str
    source_url: str
    source_label: str


@dataclass(frozen=True)
class QuotedSource:
    """One thing an authority actually said, and - separately - FairSlip's
    reading of it.

    Same shape as EvidenceItem, for the same reason stated there: a reader must
    be able to see which words are the authority's. This existed as a single
    string, so a gloss rendered under a heading reading "What CPF Board does
    say" inherited CPF Board's attribution. `note` is FairSlip's and is rendered
    as FairSlip's."""

    quoted: str
    note: str = ""


@dataclass(frozen=True)
class NotBuilt:
    """A half of the pack that does not exist, and the reason.

    Present in the returned object rather than omitted: a pack that silently
    contained only the TADM half would read as a complete pack.

    `source_url` / `source_label` have NO DEFAULTS, like EvidenceItem and
    Deadline: they were optional, which made a block of four quotations with no
    attribution constructible, and the panel rendered that silently. A quotation
    whose page is not named is a quotation a reader cannot check."""

    what: str
    why: str
    what_is_known: tuple[QuotedSource, ...]
    source_url: str
    source_label: str

    def __post_init__(self) -> None:
        if self.what_is_known and not (self.source_url and self.source_label):
            raise ValueError(
                "a NotBuilt that quotes an authority must name the page and its "
                "date; quotes with no source cannot be checked by a reader"
            )


@dataclass(frozen=True)
class EscalationPack:
    """Assembled, never filed. `filed` does not exist as a field, and there is
    no method that submits: the worker files, and the pack says so."""

    heading: str
    evidence: tuple[EvidenceItem, ...]
    deadlines: tuple[Deadline, ...]
    filing_steps: tuple[str, ...]
    not_built: tuple[NotBuilt, ...]
    disclaimer: str


# Read from https://www.tal.sg/tadm/eservices/employees-file-employment-claim
# on 7 Sept 2026. The page shows no "last updated" date; the deadlines below
# were cross-checked against MOM's managing-employment-disputes page, which
# does (last updated 26 March 2026).
TADM_EVIDENCE: tuple[EvidenceItem, ...] = (
    EvidenceItem(
        quoted="Employment contract or key employment terms",
        note="The terms you agreed to. A photo of a printed copy is fine.",
        source_url=REFERENCE_LINKS["tadm_file_claim"],
        source_label="TADM's published list of documents to upload",
    ),
    EvidenceItem(
        quoted="Salary payment records and CPF statements (where available).",
        note="Payslips and your bank record. Your CPF statement if you have one.",
        source_url=REFERENCE_LINKS["tadm_file_claim"],
        source_label="TADM's published list of documents to upload",
    ),
    EvidenceItem(
        quoted="Termination or resignation letter",
        note="Only if you have left the job. Not needed while you are employed.",
        source_url=REFERENCE_LINKS["tadm_file_claim"],
        source_label="TADM's published list of documents to upload",
    ),
    EvidenceItem(
        quoted=(
            "Other documents relevant to your claim, e.g. time sheet, "
            "certification of pregnancy/estimated delivery date by a Singapore "
            "medical practitioner."
        ),
        note="Your roster, timesheet, or the WhatsApp messages showing your hours.",
        source_url=REFERENCE_LINKS["tadm_file_claim"],
        source_label="TADM's published list of documents to upload",
    ),
)

# A deadline is when you may FILE. The look-back is how far back a filed claim
# may REACH. They are different questions, and a worker shown only the first has
# an incomplete picture on the screen that tells them what to do next.
TADM_DEADLINES: tuple[Deadline, ...] = (
    Deadline(
        label="While you are still employed",
        quoted="Within 1 year after the dispute arose.",
        source_url=REFERENCE_LINKS["mom_disputes"],
        source_label="MOM's managing-employment-disputes page",
    ),
    Deadline(
        label="After you have left the job",
        quoted="Within 6 months from your last day of work.",
        source_url=REFERENCE_LINKS["mom_disputes"],
        source_label="MOM's managing-employment-disputes page",
    ),
    # Scoped as TADM scopes it. This sentence is printed INSIDE the "If you have
    # left employment" bullet; the "still in employment" bullet does not repeat
    # it. TADM's worked example for the still-employed case implies a similar
    # reach, but an implication is not what the page states, so the label says
    # "after you have left" and nothing here extends it further.
    Deadline(
        label="How far back a claim can reach, if you have left",
        quoted="Your claims cannot be earlier than 1 year from the date of filing.",
        source_url=REFERENCE_LINKS["tadm_file_claim"],
        source_label="TADM's file-an-employment-claim page (no last-updated date shown)",
    ),
)

# No claim value cap appears here. MOM and TADM describe the caps differently
# ($20,000 / $30,000 union-assisted / $40,000 combined) and how they compose for
# one worker could not be established from either page. A cap shown wrongly
# either understates what a worker may claim or overstates it, and neither is
# recoverable at a mediation counter. See docs/debt.md, tadm-claim-value-caps.

CPF_REPORT_NOT_BUILT = NotBuilt(
    what="A pre-filled body for CPF Board's under-payment report",
    source_url=REFERENCE_LINKS["cpf_report_underpayment"],
    source_label=(
        "CPF Board, \u201cHow can I lodge a report for non-payment or "
        "underpayment of CPF contributions?\u201d, last updated 12 Mar 2026; "
        "read in a browser 7 Sept 2026"
    ),
    why=(
        "FairSlip has not built this because the report form could not be read. "
        "CPF Board's page links to it behind a redirect that returned an access "
        "error, so the fields it asks for are unknown. Inventing that structure "
        "and calling it CPF Board's form would be a guess carried to a "
        "government counter, so FairSlip does not offer one."
    ),
    what_is_known=(
        QuotedSource(
            quoted=(
                "The Board will compute the CPF contributions based on the amount "
                "of wages due and payable once TADM has concluded your claims."
            ),
            # A READING, not advice. The earlier version continued "which is why
            # the TADM half above is the half to take first, and why a pre-filled
            # CPF report would not be the next step" - a course of action nothing
            # established, on a page whose purpose is to tell members how to
            # lodge that very report. And it is wrong for the worker who needs it
            # most: the deadlines quoted above give 6 months after leaving to
            # file at TADM, so someone outside that window cannot go to TADM at
            # all, and the CPF report is the route they have left. Discouraging
            # a valid claim is the direction docs/debt.md records as the worst.
            note=(
                "Where a TADM claim is made, the CPF computation follows TADM's "
                "conclusion. This says WHEN the Board computes an amount. It is "
                "not advice about what to do first, and FairSlip is not telling "
                "you which to do first."
            ),
        ),
        QuotedSource(
            quoted=(
                "all available supporting documents to support your claim "
                "(e.g. pay slips and employment contract)."
            ),
            note="CPF Board asks you to enclose these with a report.",
        ),
        QuotedSource(
            quoted=(
                "Claims made without any supporting documents would require a "
                "longer time to investigate."
            ),
        ),
        QuotedSource(
            quoted=(
                "Please note the likelihood of recovery for any non/underpayment "
                "of CPF contributions beyond one year is low as the parties\u2019 "
                "recollection of the facts or availability of evidence may "
                "diminish over time."
            ),
            note=(
                "This is about evidence going stale, not a deadline. CPF Board "
                "publishes no limitation period for recovering under-paid CPF. "
                "Quoted whole because stopping at \u201cis low\u201d reads as one."
            ),
        ),
    ),
)


class EscalationCopyError(RuntimeError):
    """The escalation pack tried to render a word the UI copy contract forbids.

    Raised rather than filtered: a pack that had to be censored to be shown is
    not a pack this system should be handing a worker."""


def _fairslip_authored_strings(pack: EscalationPack) -> tuple[tuple[str, str], ...]:
    """(where, text) for every string in the pack that FAIRSLIP WROTE.

    `quoted` fields are deliberately excluded, and the exclusion is the point:
    they are the authority's own words, pinned separately to the pages they were
    read from (.claude/rules/mom-pay-rules.md, cpf-rules.md) and asserted in both
    directions by tests. Running a forbidden-word filter over a quotation would
    either censor an authority or force the quotation to be trimmed until it
    passed - and trimming a quote until it reads better is the exact defect that
    shipped "beyond one year is low." with a full stop.
    """
    out: list[tuple[str, str]] = [
        ("heading", pack.heading),
        ("disclaimer", pack.disclaimer),
    ]
    out += [(f"filing_steps[{i}]", t) for i, t in enumerate(pack.filing_steps)]
    for i, e in enumerate(pack.evidence):
        out.append((f"evidence[{i}].note", e.note))
        out.append((f"evidence[{i}].source_label", e.source_label))
    for i, d in enumerate(pack.deadlines):
        out.append((f"deadlines[{i}].label", d.label))
        out.append((f"deadlines[{i}].source_label", d.source_label))
    for i, n in enumerate(pack.not_built):
        out.append((f"not_built[{i}].what", n.what))
        out.append((f"not_built[{i}].why", n.why))
        out.append((f"not_built[{i}].source_label", n.source_label))
        for j, q in enumerate(n.what_is_known):
            out.append((f"not_built[{i}].what_is_known[{j}].note", q.note))
    return tuple(out)


def check_escalation_copy(pack: EscalationPack) -> None:
    """The UI copy contract, applied to the escalation screen.

    FORBIDDEN_WORDS ran only inside the draft guard, so every word the contract
    forbids could reach this screen unchecked - and this is the screen a worker
    reads when deciding what to do next."""
    for where, text in _fairslip_authored_strings(pack):
        lowered = text.lower()
        hits = [w for w in FORBIDDEN_WORDS if w in lowered]
        if hits:
            raise EscalationCopyError(
                f"{where}: FairSlip wrote {hits}, which the UI copy contract "
                f"forbids. Rewrite it; do not filter it out."
            )


def prepare_escalation(*, cpf_applies: bool = True) -> EscalationPack:
    """Assemble what a worker would take to TADM. Files nothing, anywhere.

    Level 4's action. The mandate is checked before this runs, at the single
    chokepoint in Mandate.act(). The copy is checked on the way out.

    `cpf_applies` decides whether the absent CPF half is mentioned at all. For a
    worker who is not a CPF member there is no CPF report to be missing, and
    saying "not built: a CPF under-payment report" to them contradicts the card
    beside it that says the whole CPF question does not apply. An unbuilt half is
    worth naming; an inapplicable one is noise that reads as an oversight."""
    pack = EscalationPack(
        heading="What to take to TADM",
        evidence=TADM_EVIDENCE,
        deadlines=TADM_DEADLINES,
        filing_steps=(
            "Gather the documents listed above.",
            "Take them to TADM and file yourself. Their page sets out how.",
            "FairSlip does not file, submit, or send anything on your behalf.",
        ),
        not_built=(CPF_REPORT_NOT_BUILT,) if cpf_applies else (),
        disclaimer=(
            "FairSlip has assembled a checklist, not a case. The figures it "
            "reconstructed are what MOM's published rules say the month should "
            "have paid; whether anything is due is for TADM to determine, not "
            "FairSlip."
        ),
    )
    # Checked on the way out, so a forbidden word cannot reach a screen even if
    # it is added to a constant far from here.
    check_escalation_copy(pack)
    return pack
