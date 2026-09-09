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


class CpfPackOut(BaseModel):
    """The CPF pack as the agent panel needs it: the non-overlapping split, the
    note that forbids adding two of its lines, and the sentence that reconciles
    the two "missing from her bank" figures a reader sees on one page.

    Deliberately NOT CpfOut. That model also carries `declared`, `expected` and
    `delta`, none of which this panel renders - serialising unrendered fields
    invites a later screen to display one without the caveats these lines carry."""

    split: list[SplitLine]
    split_note: str
    split_bridge: str


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
        # No committed draft entry for this spec, and live calls are off.
        "DRAFT_UNAVAILABLE",
        # A draft was produced and then refused for breaking the copy contract.
        "DRAFT_REJECTED",
        # A claim on the coverage screen stopped being establishable - a refusal
        # probe that no longer refuses, an input that has since appeared. The
        # page is refused whole rather than served with a hole in it.
        "COVERAGE_UNESTABLISHED",
        # Coverage copy broke the UI copy contract. Distinct from the above: the
        # claims still hold, the words describing them do not.
        "COVERAGE_COPY",
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
    # Stated by the server, not inferred from a residency string on screen. The
    # age-band chip is a CPF rate-table row: showing it for a worker who is not
    # a CPF member reads as a contribution rate that applies to them.
    cpf_applies: bool
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
    # The same question in each interface language. English is not a key here:
    # `prompt` above IS the English, and duplicating it would give the screen
    # two places to read the same sentence from.
    prompt_i18n: dict[str, str]
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
    # Fields the Employment Act engine never receives. Served so the screen's
    # compute gate and its input assembler derive from ONE constant: they
    # drifted, and the gate blocked on a field the assembler then deleted.
    cpf_only_fields: list[str]


# --------------------------------------------------------------------------
# Stage 3: the follow-through agent
#
# Every money field here is a Money built from a Decimal the engines produced.
# Nothing in this file computes, rounds for meaning, or combines two figures.
# --------------------------------------------------------------------------


class ActionOut(BaseModel):
    """An action, and whether this cut implements it. `built` is a claim about
    the software; `granted` is a claim about the mandate. They are separate."""

    name: str
    built: bool


class MandateLevelOut(BaseModel):
    level: int
    label: str
    actions: list[str]  # Action values granted at this level
    action_detail: list[ActionOut]


class MachineStateOut(BaseModel):
    """One node of the agent's state machine, with everything a diagram needs.

    Served rather than described, so a drawing cannot drift from the machine it
    draws. `to` is the state's outgoing edges from TRANSITIONS; `required_level`
    is derived from ENTERED_BY and the mandate table, so a level that moves in
    one place moves on the diagram too.
    """

    name: str
    entered_by: str | None
    required_level: int | None
    built: bool
    terminal: bool
    # TRUE ONLY IF THE STATE IS REACHABLE FROM ITSELF.
    #
    # "not terminal" is not the same as "can be attempted again", and the
    # difference is the whole point of drawing UNVERIFIABLE. PARTIALLY_CORRECTED
    # is not terminal either - it goes on to the escalation pack - but it does
    # not come back, and labelling it re-attemptable told a worker their
    # part-corrected month could be re-checked, which it cannot.
    re_attemptable: bool
    to: list[str]


class MachineOut(BaseModel):
    states: list[MachineStateOut]
    start: str
    verdicts: list[str]


class MandateOut(BaseModel):
    """The whole table, so a screen renders the worker's choice from the server's
    own answer rather than from a copy of the table it keeps itself."""

    levels: list[MandateLevelOut]
    machine: MachineOut
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


class DraftIn(BaseModel):
    level: int
    spec_name: str  # a spec declared in demo.fixtures.draft_specs()


class CitedFigureOut(BaseModel):
    label: str
    amount: Money
    formula: str
    source: str


class NgoOptionOut(BaseModel):
    name: str
    what_they_do: str
    link: str


class DraftOut(BaseModel):
    """A drafted message is NOT a sent one. `state` says MESSAGE_DRAFTED and the
    response carries no send of any kind: sending needs level 2 and a tap."""

    state: str
    # Whose message this is, and that it is not the viewer's. Written by the
    # server rather than composed by the screen, for the same reason cpf_basis
    # is: a caveat the frontend assembles is a caveat the frontend can drop.
    basis: str = ""
    english: str
    translated: str
    language: str
    figures_cited: list[CitedFigureOut]
    alternative_heading: str
    alternative: list[NgoOptionOut]
    model: str
    # Provenance, at the top level, in words a screen can show. Never a timing:
    # a stored duration beside a cache status reads as timing this request.
    cache_state: str  # "HIT" | "MISS"
    cache_note: str
    generated_on: str


class AgentPersonaOut(BaseModel):
    """A fictional worker, stated rather than inferred. Every fact the switch
    shows is a field here, so nothing on screen is something a viewer has to
    assume - including whether CPF applies to them at all."""

    key: str
    name: str
    residency_label: str
    occupation: str
    language: str
    cpf_applies: bool


class EscalationIn(BaseModel):
    level: int
    # Which persona the pack is for. Decides whether the absent CPF half is
    # mentioned: a worker who is not a CPF member has no CPF report to be
    # missing, and naming one contradicts the card that says CPF does not apply.
    persona: str | None = None


class EvidenceItemOut(BaseModel):
    """`quoted` is TADM's own wording; `note` is FairSlip's gloss. Kept apart so
    a reader can always see which words are the authority's."""

    quoted: str
    note: str
    source_url: str
    source_label: str = ""


class DeadlineOut(BaseModel):
    """`source_label` names the page. These quotes are MOM's and they sit under a
    heading about TADM; a quotation attributed by the nearest heading is
    attributed to the wrong body."""

    label: str
    quoted: str
    source_url: str
    source_label: str = ""


class QuotedSourceOut(BaseModel):
    """`quoted` is the authority's own wording. `note` is FairSlip's reading of
    it, and the screen must render it as FairSlip's."""

    quoted: str
    note: str = ""


class NotBuiltOut(BaseModel):
    """A half of the pack that does not exist, and why. Returned rather than
    omitted: a pack containing only its built half would read as complete."""

    what: str
    why: str
    # Quote and reading kept apart, like EvidenceItem: a gloss rendered under a
    # heading that names an authority is attributed to that authority.
    what_is_known: list[QuotedSourceOut]
    # Required, not optional. Its siblings are required, and a block of quotes
    # with no attribution used to be constructible.
    source_url: str
    source_label: str


class EscalationOut(BaseModel):
    heading: str
    evidence: list[EvidenceItemOut]
    deadlines: list[DeadlineOut]
    filing_steps: list[str]
    not_built: list[NotBuiltOut]
    disclaimer: str


class AgentDemoInputsOut(BaseModel):
    """The three fictional months the agent demo verifies against.

    Served from demo/fixtures.py so the frontend holds no fixture data of its
    own: the screen must not be able to drift from the fixtures the tests use."""

    month1: dict
    month2_corrected: dict
    month2_uncorrected: dict
    month2_blocked: dict
    # Every persona the switch offers, and which one this response is for.
    # Served so the screen renders the switch from the same record that decides
    # what the response contains.
    personas: list[AgentPersonaOut]
    selected: AgentPersonaOut
    draft_spec_name: str
    # The CPF pack for this persona. Computed by the backend from the fixture's
    # declared_ow - the wage the employer actually contributed on - which NO
    # uploaded document states. It is fixture data, and `cpf_basis` says so on
    # screen. The frontend must never derive it (docs/debt.md, the declared_ow
    # open design question).
    # Null for a persona who is not a CPF member. This branch is REACHABLE now
    # that the panel can switch to a Work Permit holder, and it must be: a split
    # of zeros carrying an overlap note that describes an overlap of $0 is a
    # card contradicting itself. When cpf is null, `no_cpf_note` says why.
    cpf: CpfPackOut | None = None
    cpf_basis: str = ""
    no_cpf_note: str = ""


# --------------------------------------------------------------------------
# Impact radius: change one established fact, and see what it did and did not
# reach.
#
# The claim that matters is the SECOND list - the components that did NOT move.
# It is computed by comparing two engine runs, never asserted in copy, and the
# dependency edges come from Component.inputs, which is the engine's own record
# of which source facts produced each amount. There is no field-to-component map
# anywhere in this codebase, and adding one would be the defect.
# --------------------------------------------------------------------------


class ChangedFieldOut(BaseModel):
    name: str
    before_value: str
    after_value: str
    # The provenance strings for this fact. These are the keys the dependency
    # edges are matched on - Component.inputs holds exactly these - and BOTH are
    # used, because a line that only exists after the change carries the after
    # one. They must be unique among the facts supplied, or the edges cannot be
    # attributed and the run is refused.
    before_source: str
    after_source: str = ""


class ComponentImpactOut(BaseModel):
    """One line of the breakdown, before and after.

    `status` is MOVED / UNCHANGED / ADDED / REMOVED. A component can disappear:
    change the rest-day hours to nothing and the rest-day line is not a smaller
    number, it is absent, and saying "unchanged" would be false.

    `depends_on_changed` is derived - the component's own `inputs` contains the
    source string of a fact that changed. `MOVED` with `depends_on_changed`
    false would mean the graph and the arithmetic disagree, so it is surfaced
    rather than smoothed over."""

    label: str
    status: str
    before: Money | None = None
    after: Money | None = None
    delta: Money | None = None
    depends_on_changed: bool
    formula: str


class ImpactIn(BaseModel):
    before: PayInputsIn
    after: PayInputsIn


class ImpactOut(BaseModel):
    changed_fields: list[ChangedFieldOut]
    components: list[ComponentImpactOut]
    moved_count: int
    unchanged_count: int
    # Present only when a component moved without depending on anything that
    # changed. Empty on every correct run; rendered loudly if it ever is not.
    unexplained_moves: list[str]
    # The other direction, and it is NOT an error: a line that listed the changed
    # fact and held its value anyway. The screen must say so about these rather
    # than "did not list the fact you changed", which is false of them.
    held_but_dependent: list[str]

    before_expected_net: Money
    after_expected_net: Money
    before_difference: Money
    after_difference: Money
    difference_delta: Money

    flags_before: list[str]
    flags_after: list[str]
    note: str


# --------------------------------------------------------------------------
# Coverage: who FairSlip is for, stated as rules
# --------------------------------------------------------------------------


class QuoteOut(BaseModel):
    """An authority's own sentence and the page it was read from. Kept apart
    from every FairSlip-authored string beside it, like EvidenceItemOut: a
    reader must always be able to see which words are the authority's."""

    quoted: str
    source_url: str
    source_label: str


class EngineValueOut(BaseModel):
    """A number an engine holds. `display` is rendered by the API from that
    Decimal, so the page cannot format money a second way, and `engine_symbol`
    names where the value was read from - it is what the test resolves."""

    label: str
    display: str
    unit: str
    engine_symbol: str


class EncodedRuleOut(BaseModel):
    what: str
    engine_symbol: str
    source_url: str
    source_label: str
    quote: QuoteOut | None = None
    values: list[EngineValueOut] = []


class RulePackOut(BaseModel):
    key: str
    name: str
    engine_module: str
    covers: str
    coverage_quote: QuoteOut | None = None
    thresholds: list[EngineValueOut] = []
    encoded: list[EncodedRuleOut] = []


class ResidencyOutcomeOut(BaseModel):
    """`engine_said` is what the engine returned or refused with, and it is
    empty where the engine simply computed - a sentence written to fill that
    column would be FairSlip's words wearing the engine's."""

    residency: str
    outcome: Literal["CONTRIBUTES", "NOT_A_MEMBER", "REFUSED"]
    engine_said: str


class NotEncodedOut(BaseModel):
    what: str
    kind: Literal["REFUSED_BY_ENGINE", "NO_INPUT_EXISTS", "STATED_NOT_CHECKED"]
    why: str
    established_by: str
    footer_phrase: str = ""
    would_need_field: str = ""


class InterfaceCoverageOut(BaseModel):
    question_count: int
    languages: list[str]
    questions_translated: list[tuple[str, int]]
    note: str
    quotes_note: str


class CoverageOut(BaseModel):
    heading: str
    note: str
    packs: list[RulePackOut]
    residency: list[ResidencyOutcomeOut]
    residency_note: str
    not_encoded: list[NotEncodedOut]
    interface: InterfaceCoverageOut


# ------------------------------------------------- the employer pre-payday check


class SpecFieldOut(BaseModel):
    """One column, and where it comes from.

    `spec_name` and `columns` are CPF Board's own, from the Employer Contribution
    Detail Record. The two columns FairSlip adds carry "(not in the CPF file)"
    here, so the screen can show the boundary rather than describe it.
    """

    csv_name: str
    spec_name: str
    columns: str
    data_type: str
    note: str


class EmployerFindingOut(BaseModel):
    row_number: int
    employee_name: str
    employee_account_no: str
    outcome: Literal["OK", "EXCEPTION", "REFUSED"]
    reason: str | None
    detail: str
    declared: Money | None
    expected: Money | None
    difference: Money | None
    ordinary_wages: Money | None
    band: str | None
    engine_formula: str
    engine_flags: list[str]


class EmployerCheckOut(BaseModel):
    rows_read: int
    checked: int
    exceptions: int
    refused: int
    total_difference: Money
    by_reason: list[tuple[str, int]]
    findings: list[EmployerFindingOut]


class EmployerSchemaOut(BaseModel):
    """What the upload expects, and whose schema each column is."""

    spec_fields: list[SpecFieldOut]
    extra_fields: list[SpecFieldOut]
    spec_title: str
    spec_effective: str
    spec_record: str
    spec_length: str
    spec_url: str
    spec_read_on: str
    rounding_a: str
    rounding_b: str
    note_4: str
    account_column: str
    note_4_reading: str
    mistakes_url: str
    mistakes: list[tuple[str, list[str]]]

