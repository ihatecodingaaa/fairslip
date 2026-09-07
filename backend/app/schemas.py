"""Wire shapes. Every dollar on the wire is a Money, and a Money is only ever built
from a Decimal an engine returned."""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from fairslip.rules import to_cents

# JSON cannot carry a Decimal. Amounts travel as strings so nothing becomes a float on
# the way in or out; ints (days_per_week) and bools (is_workman) travel as themselves.
FactValue = bool | int | str | dict[str, str] | None

StatusName = Literal["AGREED", "DISAGREED", "MISSING", "HUMAN_CONFIRMED"]


class Money(BaseModel):
    """`exact` is the engine's own Decimal, unrounded. `display` is the same number
    rounded to cents for the screen, by the backend. The client renders `display`
    and never does arithmetic of its own."""

    exact: str
    display: str

    @classmethod
    def of(cls, amount: Decimal) -> Money:
        # `+ 0` collapses a negative zero. A residue of -0.004 rounds to cents as
        # "-0.00", which reads as a real negative amount and, beside a CORRECTED
        # verdict, reads as a contradiction. It is a display artefact only:
        # `exact` still carries the engine's signed Decimal, so nothing is hidden.
        return cls(exact=str(amount), display=f"{to_cents(amount) + Decimal(0):.2f}")


class FactIn(BaseModel):
    """A single input with its provenance, exactly as fairslip.rules.Fact stores it.
    There is no confidence field: the status is the confidence."""

    value: FactValue
    status: StatusName
    source: str = ""


class PayInputsIn(BaseModel):
    monthly_basic: FactIn
    ot_hours: FactIn
    days_per_week: FactIn
    normal_daily_hours: FactIn
    is_workman: FactIn
    deductions_total: FactIn
    net_paid: FactIn
    rest_day_hours: FactIn | None = None
    rest_day_requested_by: FactIn | None = None


class ComponentOut(BaseModel):
    label: str
    amount: Money
    formula: str
    inputs: list[str]


class PayBreakdownOut(BaseModel):
    components: list[ComponentOut]
    expected_gross: Money
    deductions_total: Money
    expected_net: Money
    net_paid: Money
    difference: Money
    flags: list[str]
    # Identity, not a new calculation: CPF's Ordinary Wage for the month is the gross the
    # engine reconstructed. CPF Board: contributions are payable on overtime pay.
    cpf_ordinary_wage: Money
    cpf_ordinary_wage_basis: str


class CpfRequest(BaseModel):
    declared_ow: str  # the wage the employer computed CPF on
    expected_ow: str  # the wage the Employment Act engine reconstructed
    band: str  # AgeBand value, e.g. "55 and below"
    residency: str  # Residency name, e.g. "CITIZEN"


class CpfResultOut(BaseModel):
    ow_used: Money
    ow_capped: bool
    band: str
    residency: str
    total: Money
    employee: Money
    employer: Money
    formula: str
    flags: list[str]


class CpfDeltaOut(BaseModel):
    total: Money
    employee: Money
    employer: Money


class SplitLine(BaseModel):
    """One line of shortfall_split(). The label ships with the number so no client can
    relabel it, and so no client can invent a line that is not in the split."""

    key: str
    label: str
    amount: Money
    sub: bool = False


class CpfOut(BaseModel):
    declared: CpfResultOut
    expected: CpfResultOut
    delta: CpfDeltaOut
    split: list[SplitLine]
    split_note: str


class RefusalOut(BaseModel):
    error: Literal[
        "UNESTABLISHED_INPUT",
        "OUT_OF_SCOPE",
        "INVALID_INPUT",
        # The agent was asked for an action the granted mandate level does not
        # cover. `required_level` says which level would have permitted it, so a
        # screen can offer the worker the choice instead of a dead end.
        "MANDATE_EXCEEDED",
        # Within the mandate, but not built in this cut. Deliberately distinct:
        # raising the mandate level would NOT enable it.
        "ACTION_NOT_BUILT",
    ]
    detail: str
    required_level: int | None = None


class CpfFixtureOut(BaseModel):
    declared_ow: str
    residency: str
    band: str
    band_source: str
    contribution_month: str
    cpf_employee_on_payslip: str | None = None


class PersonaOut(BaseModel):
    key: str
    name: str
    summary: str
    expect_refusal: bool
    pay_inputs: PayInputsIn
    cpf: CpfFixtureOut


class FixturesOut(BaseModel):
    notice: str
    personas: list[PersonaOut]


# --------------------------------------------------------------------------
# Extraction (Stage 2). The response separates the two groups of field
# structurally, not by convention: `read_fields` are what two independent
# readers were shown, `worker_fields` are what only the worker can establish.
# A client cannot merge them into one list without deliberately doing so.
# --------------------------------------------------------------------------


class ImageIn(BaseModel):
    role: str  # "payslip" | "roster" | "ket" - validated against extract.DOCUMENT_ROLES
    media_type: str
    data_b64: str


class ExtractRequest(BaseModel):
    images: list[ImageIn]


class ReaderInfoOut(BaseModel):
    """One reader, and whether it actually answered. `ok=False` with an `error`
    is a first-class outcome: it means nothing this reader was asked is
    established, and the screen must be able to say which reader was down."""

    key: str
    label: str
    model: str
    provider: str
    ok: bool
    error: str | None = None
    latency_ms: int | None = None
    from_cache: bool
    # "HIT" - replayed from an entry committed to the repo; "MISS" - no entry
    # existed and this reading was made live. `cache_key` names the entry that
    # was looked for either way, so a miss can be acted on, not merely noticed.
    cache: str
    cache_key: str


class ReadFieldOut(BaseModel):
    """A field two readers were shown. `readings` is what each one actually said,
    kept alongside the verdict so a screen can show the disagreement itself."""

    name: str
    label: str
    fact: FactIn
    readings: dict[str, str | None]
    unreadable: list[str]


class ChoiceOut(BaseModel):
    """One option a worker may pick. `value` is what the engine accepts, verbatim -
    it comes from the engine's own enum, so a screen cannot offer a value the
    engine will reject."""

    value: str
    label: str


class WorkerFieldOut(BaseModel):
    """A field no reader was ever shown. `why` is not an apology for a gap - it
    is the boundary, stated. It ships from the backend so a screen cannot
    restate the reason a field is asked rather than read."""

    name: str
    label: str
    prompt: str
    why: str
    required_for: list[str]  # "pay" and/or "cpf"
    answer_type: str  # "decimal" | "choice" | "date"
    choices: list[ChoiceOut]


class ExtractOut(BaseModel):
    readers: list[ReaderInfoOut]
    read_fields: list[ReadFieldOut]
    worker_fields: list[WorkerFieldOut]
    # Counts of the reader group, computed once here so two screens cannot
    # disagree about what "all agreed" means.
    agreed_count: int
    read_field_count: int
    # Which path this response came down. Aggregated once in the backend so the
    # screen cannot decide for itself what "cached" means. A miss is reported,
    # never inferred from a timing.
    cache_state: str  # "HIT" | "PARTIAL" | "MISS"
    cache_note: str


# --------------------------------------------------------------------------
# Stage 3: the follow-through agent
#
# Every money field here is a Money built from a Decimal the engines produced.
# Nothing in this file computes, rounds for meaning, or combines two figures.
# --------------------------------------------------------------------------


class MandateLevelOut(BaseModel):
    level: int
    label: str
    actions: list[str]  # Action values granted at this level


class MandateOut(BaseModel):
    """The whole table, so a screen renders the worker's choice from the server's
    own answer rather than from a copy of the table it keeps itself."""

    levels: list[MandateLevelOut]
    # Stated on screen, not buried in a comment: nothing here establishes that
    # the worker granted the level the caller claims.
    no_authentication_notice: str
    reference_links: dict[str, str]


class TapIn(BaseModel):
    at: str  # ISO 8601 WITH an offset; a naive timestamp is refused
    surface: str


class SendIn(BaseModel):
    level: int
    tap: TapIn | None = None
    message_id: str = ""


class SentOut(BaseModel):
    state: str  # always "SENT"; a drafted message is not a sent one
    tap_at: str  # the moment of the TAP, echoed back, never the moment of recording
    tap_surface: str
    message_id: str
    note: str


class BlockedFieldOut(BaseModel):
    name: str  # "" when the engine's refusal did not name a known field
    status: str  # a Status value, or "UNUSABLE_VALUE"
    detail: str


class VerifyIn(BaseModel):
    level: int
    month1: PayInputsIn
    month2: PayInputsIn


class VerifyOut(BaseModel):
    """CORRECTED / PARTIALLY_CORRECTED / NOT_CORRECTED carry their arithmetic.
    UNVERIFIABLE carries the fields that blocked it and NO month-2 figures - it
    computed none, and a zero would read as 'nothing outstanding'."""

    verdict: str
    state: str
    month1_difference: Money
    month2_difference: Money | None = None
    adjustment_found: Money | None = None
    remaining_gap: Money | None = None
    month1_expected_net: Money | None = None
    month2_expected_net: Money | None = None
    month2_net_paid: Money | None = None
    blocked_by: list[BlockedFieldOut] = []
    arithmetic: str  # the sum, in words, so the screen quotes rather than composes
