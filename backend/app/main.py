"""FairSlip API - transport only.

Two endpoints run the two rule packs, one serves the fictional demo fixtures.
No money is computed here: every amount returned came out of fairslip.rules or
fairslip.cpf. When an engine refuses, the refusal is the response - it is never
downgraded into a partial success.
"""

from __future__ import annotations

import base64
import binascii
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import demo.fixtures as fx
from app.schemas import (
    ActionOut,
    AgentDemoInputsOut,
    AgentPersonaOut,
    BlockedFieldOut,
    ChangedFieldOut,
    ChoiceOut,
    CitedFigureOut,
    ComponentImpactOut,
    ComponentOut,
    CpfDeltaOut,
    CpfFixtureOut,
    CpfOut,
    CpfPackOut,
    CpfRequest,
    CpfResultOut,
    DeadlineOut,
    DraftIn,
    DraftOut,
    EscalationIn,
    EscalationOut,
    EvidenceItemOut,
    ExtractOut,
    ExtractRequest,
    FactIn,
    FixturesOut,
    ImpactIn,
    ImpactOut,
    MandateLevelOut,
    MandateOut,
    Money,
    NgoOptionOut,
    NotBuiltOut,
    PayBreakdownOut,
    PayInputsIn,
    PersonaOut,
    QuotedSourceOut,
    ReaderInfoOut,
    ReadFieldOut,
    RefusalOut,
    SendIn,
    SentOut,
    SplitLine,
    VerifyIn,
    VerifyOut,
    WorkerFieldOut,
)
from fairslip.agent import (
    DEFAULT_DRAFT_CACHE_DIR,
    DRAFT_CACHE_HIT,
    MANDATE_LABELS,
    MANDATE_TABLE,
    NO_AUTHENTICATION_NOTICE,
    REFERENCE_LINKS,
    Action,
    ActionNotBuiltError,
    AgentState,
    DraftCacheMissError,
    DraftError,
    Mandate,
    MandateError,
    MandateExceededError,
    TapEvent,
    Unverifiable,
    is_built,
)
from fairslip.cpf import (
    NO_CPF,
    AgeBand,
    CpfResult,
    OutOfScopeError,
    Residency,
    ShortfallSplit,
    band_for,
    shortfall_split,
)
from fairslip.extract import (
    CACHE_HIT,
    DOCUMENT_ROLES,
    ImageInput,
    default_readers,
    read_with_cache,
    reconcile,
)
from fairslip.extract_schema import (
    ANSWER_TYPES,
    CPF_ONLY_FIELDS,
    FIELD_LABELS,
    WORKER_ONLY_FIELDS,
    WORKER_PROMPTS,
    WORKER_WHY,
    choices_for,
)
from fairslip.rules import (
    ESTABLISHED,
    Fact,
    PayBreakdown,
    PayInputs,
    Status,
    UnverifiedInputError,
    compute_expected,
)


class InvalidInputError(ValueError):
    """The JSON was well-formed but a value could not be read as the type its field
    requires. Reported as itself, never coerced into a default."""


app = FastAPI(
    title="FairSlip API",
    version="0.1.0",
    description=(
        "Reconstructs what MOM's and CPF Board's published rules say a month should have "
        "paid. Computation lives in fairslip.rules and fairslip.cpf; this layer only "
        "carries established facts in and engine output back."
    ),
)

_DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
_ORIGINS = [
    o.strip() for o in os.getenv("FAIRSLIP_CORS_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _refusal(code: str, detail: str) -> JSONResponse:
    return JSONResponse(status_code=400, content=RefusalOut(error=code, detail=detail).model_dump())


@app.exception_handler(UnverifiedInputError)
async def _unverified(_: Request, exc: UnverifiedInputError) -> JSONResponse:
    return _refusal("UNESTABLISHED_INPUT", str(exc))


@app.exception_handler(OutOfScopeError)
async def _out_of_scope(_: Request, exc: OutOfScopeError) -> JSONResponse:
    return _refusal("OUT_OF_SCOPE", str(exc))


@app.exception_handler(MandateExceededError)
async def _mandate_exceeded(_: Request, exc: MandateExceededError) -> JSONResponse:
    """Refused because of the level the caller granted. `required_level` names the
    level that WOULD have permitted it, so the screen offers a choice."""
    return JSONResponse(
        status_code=400,
        content=RefusalOut(
            error="MANDATE_EXCEEDED", detail=str(exc), required_level=exc.required_level
        ).model_dump(),
    )


@app.exception_handler(ActionNotBuiltError)
async def _not_built(_: Request, exc: ActionNotBuiltError) -> JSONResponse:
    """Within the mandate, absent from this build. Never merged into
    MANDATE_EXCEEDED: raising the level would not enable it."""
    return _refusal("ACTION_NOT_BUILT", str(exc))


@app.exception_handler(MandateError)
async def _mandate(_: Request, exc: MandateError) -> JSONResponse:
    return _refusal("INVALID_INPUT", str(exc))


@app.exception_handler(DraftError)
async def _draft_error(_: Request, exc: DraftError) -> JSONResponse:
    """A cache miss, a model failure, or a draft rejected for breaking the copy
    contract. All three are refusals: none of them produces a partial draft."""
    code = "DRAFT_UNAVAILABLE" if isinstance(exc, DraftCacheMissError) else "DRAFT_REJECTED"
    return _refusal(code, str(exc))


@app.exception_handler(InvalidInputError)
async def _invalid(_: Request, exc: InvalidInputError) -> JSONResponse:
    return _refusal("INVALID_INPUT", str(exc))


# --------------------------------------------------------------------------
# JSON <-> Fact. Values are converted only on established facts: an unestablished
# value may be anything at all (the DISAGREED case carries both readers' answers),
# and the engine must be the thing that refuses it, not the parser.
# --------------------------------------------------------------------------


def _as_decimal(name: str, v: object) -> Decimal:
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError) as e:
        raise InvalidInputError(f"{name}: {v!r} is not a decimal amount") from e


def _as_int(name: str, v: object) -> int:
    if isinstance(v, bool) or not isinstance(v, (int, str)):
        raise InvalidInputError(f"{name}: {v!r} is not a whole number")
    try:
        return int(v)
    except ValueError as e:
        raise InvalidInputError(f"{name}: {v!r} is not a whole number") from e


# The exact strings the API offers as choices for a boolean field. A worker's
# answer arrives as the `value` this server published in choices_for(), so this
# server has to accept it back. Anything else is still refused.
_BOOL_WORDS = {"true": True, "false": False}


def _as_bool(name: str, v: object) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str) and v.strip().lower() in _BOOL_WORDS:
        return _BOOL_WORDS[v.strip().lower()]
    raise InvalidInputError(f"{name}: {v!r} is not true or false")


def _as_str(name: str, v: object) -> str:
    if not isinstance(v, str):
        raise InvalidInputError(f"{name}: {v!r} is not a string")
    return v


_CONVERTERS = {
    "monthly_basic": _as_decimal,
    "ot_hours": _as_decimal,
    "days_per_week": _as_int,
    "normal_daily_hours": _as_decimal,
    "is_workman": _as_bool,
    "deductions_total": _as_decimal,
    "net_paid": _as_decimal,
    "rest_day_hours": _as_decimal,
    "rest_day_requested_by": _as_str,
}


def _to_fact(name: str, f: FactIn) -> Fact:
    status = Status(f.status)
    value: object = f.value
    if status in ESTABLISHED:
        value = _CONVERTERS[name](name, value)
    return Fact(value, status, f.source)


def _to_pay_inputs(body: PayInputsIn) -> PayInputs:
    kwargs: dict[str, Fact | None] = {}
    for name in PayInputs.__dataclass_fields__:
        raw = getattr(body, name)
        kwargs[name] = None if raw is None else _to_fact(name, raw)
    return PayInputs(**kwargs)  # type: ignore[arg-type]


def _fact_value_out(v: object) -> object:
    if isinstance(v, (bool, int, str)):
        return v
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, dict):
        return {str(k): str(val) for k, val in v.items()}
    return str(v)


def _fact_out(f: Fact) -> FactIn:
    return FactIn(value=_fact_value_out(f.value), status=f.status.value, source=f.source)


# --------------------------------------------------------------------------
# Engine output -> wire
# --------------------------------------------------------------------------

OW_BASIS = (
    "CPF Ordinary Wage for the month = the gross this engine reconstructed. CPF Board: "
    "contributions are payable on overtime pay, and OW includes overtime payments."
)

# Labels ship with the numbers so a client cannot relabel them, and cannot show a
# combined figure that is not total_withheld. See .claude/rules/cpf-rules.md.
_SPLIT_LINES: tuple[tuple[str, str, bool], ...] = (
    ("gross_shortfall", "Gross shortfall - the wage that was not paid", False),
    (
        "employee_cpf_on_shortfall",
        "of which employee CPF - would have gone to CPF, not to cash",
        True,
    ),
    ("cash_shortfall", "Cash missing from the bank account", False),
    ("cpf_shortfall", "CPF missing from the CPF account", False),
    ("employer_cpf_on_shortfall", "of which the employer's share", True),
    ("total_withheld", "Total withheld - cash plus CPF", False),
)

def money_display(amount: Decimal) -> str:
    """The grouped display string, from the same Money the screen renders. A
    hand-formatted amount beside money()-formatted ones is a second formatter."""
    m = _money(amount)
    whole, cents = m.display.replace("-", "").split(".")
    grouped = f"{int(whole):,}"
    return f"{'-' if m.display.startswith('-') else ''}{grouped}.{cents}"


SPLIT_NOTE = (
    "The gross shortfall and the CPF shortfall overlap by the employee's CPF share on the "
    "missing wage. Adding them would count that share twice; the total below is cash plus CPF."
)


def split_bridge(s: ShortfallSplit) -> str:
    """Why two figures on this page both describe money missing from their bank.

    The reconciliation reports the WAGE that was not paid; the split reports the
    CASH that did not arrive. They differ by exactly the employee CPF that would
    have been deducted from that wage, and both are true. Leaving a reader to
    work that out from two same-sounding labels is how a correct pair of numbers
    reads as a contradiction.
    """
    return (
        f"Two figures on this page describe money they did not receive, and they are "
        f"different questions. ${money_display(s.gross_shortfall)} is the WAGE that was not "
        f"paid. Of that, ${money_display(s.employee_cpf_on_shortfall)} would never have "
        f"reached their hand anyway - it would have been deducted as their CPF - so the "
        f"CASH "
        f"missing from their bank is ${money_display(s.gross_shortfall)} minus "
        f"${money_display(s.employee_cpf_on_shortfall)} = "
        f"${money_display(s.cash_shortfall)}. Neither figure is wrong; they answer "
        f"\"what were they not paid\" and \"what did not arrive in the bank\"."
    )


def _money(x: Decimal) -> Money:
    return Money.of(x)


def _breakdown_out(bd: PayBreakdown) -> PayBreakdownOut:
    return PayBreakdownOut(
        components=[
            ComponentOut(
                label=c.label, amount=_money(c.amount), formula=c.formula, inputs=list(c.inputs)
            )
            for c in bd.components
        ],
        expected_gross=_money(bd.expected_gross),
        deductions_total=_money(bd.deductions_total),
        expected_net=_money(bd.expected_net),
        net_paid=_money(bd.net_paid),
        difference=_money(bd.difference),
        flags=list(bd.flags),
        cpf_ordinary_wage=_money(bd.expected_gross),
        cpf_ordinary_wage_basis=OW_BASIS,
    )


def _cpf_result_out(r: CpfResult) -> CpfResultOut:
    return CpfResultOut(
        ow_used=_money(r.ow_used),
        ow_capped=r.ow_capped,
        band=r.band.value,
        residency=r.residency.value,
        total=_money(r.total),
        employee=_money(r.employee),
        employer=_money(r.employer),
        formula=r.formula,
        flags=list(r.flags),
    )


def _split_out(s: ShortfallSplit) -> list[SplitLine]:
    return [
        SplitLine(key=key, label=label, amount=_money(getattr(s, key)), sub=sub)
        for key, label, sub in _SPLIT_LINES
    ]


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "fairslip", "status": "up"}


@app.post("/compute", response_model=PayBreakdownOut)
def compute(body: PayInputsIn) -> PayBreakdownOut:
    """Employment Act pack. Refuses (400 UNESTABLISHED_INPUT) if any fact it touches
    was not agreed by both readers or confirmed by the worker."""
    return _breakdown_out(compute_expected(_to_pay_inputs(body)))


@app.post("/cpf", response_model=CpfOut)
def cpf(body: CpfRequest) -> CpfOut:
    """CPF pack. Both wages go through CPF Board's month-level rounding, so the delta is
    what CPF Board would compute rather than a percentage of the difference."""
    try:
        band = AgeBand(body.band)
    except ValueError as e:
        raise InvalidInputError(f"unknown age band {body.band!r}") from e
    try:
        residency = Residency(body.residency)
    except ValueError as e:
        raise InvalidInputError(f"unknown residency {body.residency!r}") from e

    declared = _as_decimal("declared_ow", body.declared_ow)
    expected = _as_decimal("expected_ow", body.expected_ow)
    s = shortfall_split(declared, expected, band, residency)
    return CpfOut(
        declared=_cpf_result_out(s.delta.declared),
        expected=_cpf_result_out(s.delta.expected),
        delta=CpfDeltaOut(
            total=_money(s.delta.total),
            employee=_money(s.delta.employee),
            employer=_money(s.delta.employer),
        ),
        split=_split_out(s),
        split_note=SPLIT_NOTE,
    )


# --------------------------------------------------------------------------
# Fixtures. Served rather than duplicated in the frontend, so the screen and the
# tests read the same fictional data from one module.
# --------------------------------------------------------------------------

FIXTURES_NOTICE = "Fictional data. No real worker's document or information appears in FairSlip."


def _persona(
    key: str,
    name: str,
    summary: str,
    inputs: PayInputs,
    *,
    dob: date,
    residency: Residency,
    declared_ow: Decimal,
    cpf_employee_on_payslip: Decimal | None = None,
    expect_refusal: bool = False,
) -> PersonaOut:
    band = band_for(dob, fx.DEMO_MONTH)
    return PersonaOut(
        key=key,
        name=name,
        summary=summary,
        expect_refusal=expect_refusal,
        cpf_applies=residency not in NO_CPF,
        pay_inputs=PayInputsIn(
            **{
                f: (None if getattr(inputs, f) is None else _fact_out(getattr(inputs, f)))
                for f in PayInputs.__dataclass_fields__
            }
        ),
        cpf=CpfFixtureOut(
            declared_ow=str(declared_ow),
            residency=residency.value,
            band=band.value,
            band_source=f"band_for(date of birth {dob.isoformat()}, {fx.DEMO_MONTH.isoformat()})",
            contribution_month=fx.DEMO_MONTH.isoformat(),
            cpf_employee_on_payslip=(
                None if cpf_employee_on_payslip is None else str(cpf_employee_on_payslip)
            ),
        ),
    )


@app.get("/demo/fixtures", response_model=FixturesOut)
def demo_fixtures() -> FixturesOut:
    return FixturesOut(
        notice=FIXTURES_NOTICE,
        personas=[
            _persona(
                "mei_ling",
                "Mei Ling",
                "Singapore Citizen, 40, F&B, $1,200 basic, 6-day week. Both rule packs apply.",
                fx.mei_ling_month1_established(),
                dob=fx.MEI_LING_DOB,
                residency=fx.MEI_LING_RESIDENCY,
                declared_ow=fx.MEI_LING_DECLARED_OW,
                cpf_employee_on_payslip=fx.MEI_LING_CPF_EMPLOYEE_ON_PAYSLIP,
            ),
            _persona(
                "rahim",
                "Rahim",
                "Work Permit holder, construction, $1,200 basic, 6-day week. No CPF liability.",
                fx.rahim_month1_established(),
                dob=fx.RAHIM_DOB,
                residency=fx.RAHIM_RESIDENCY,
                declared_ow=fx.RAHIM_DECLARED_OW,
            ),
            _persona(
                "rahim_before_confirmation",
                "Rahim - before the hours are confirmed",
                "Straight after extraction: the two readers returned different overtime hours.",
                fx.rahim_month1_before_confirmation(),
                dob=fx.RAHIM_DOB,
                residency=fx.RAHIM_RESIDENCY,
                declared_ow=fx.RAHIM_DECLARED_OW,
                expect_refusal=True,
            ),
        ],
    )


# --------------------------------------------------------------------------
# Extraction. Transport only: the two readers run in fairslip.extract and the
# reconciler is pure code there. This layer decodes images, runs the readers
# concurrently (concurrently, so that neither can see the other's answer even
# by accident of ordering), and carries the reconciliation back.
# --------------------------------------------------------------------------

MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_MEDIA_TYPES = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif"})


def _to_images(body: ExtractRequest) -> tuple[ImageInput, ...]:
    if not body.images:
        raise InvalidInputError("no images supplied; extraction needs at least one document")
    out: list[ImageInput] = []
    for i, img in enumerate(body.images):
        where = f"images[{i}]"
        if img.role not in DOCUMENT_ROLES:
            raise InvalidInputError(
                f"{where}: unknown document role {img.role!r}; "
                f"expected one of {sorted(DOCUMENT_ROLES)}"
            )
        if img.media_type not in ALLOWED_MEDIA_TYPES:
            raise InvalidInputError(
                f"{where}: unsupported media type {img.media_type!r}; "
                f"expected one of {sorted(ALLOWED_MEDIA_TYPES)}"
            )
        try:
            data = base64.b64decode(img.data_b64, validate=True)
        except (binascii.Error, ValueError) as e:
            raise InvalidInputError(f"{where}: data_b64 is not valid base64") from e
        if not data:
            raise InvalidInputError(f"{where}: no image data")
        if len(data) > MAX_IMAGE_BYTES:
            raise InvalidInputError(
                f"{where}: {len(data)} bytes exceeds the {MAX_IMAGE_BYTES}-byte limit"
            )
        out.append(ImageInput(role=img.role, media_type=img.media_type, data=data))
    return tuple(out)


def _worker_fields_out() -> list[WorkerFieldOut]:
    """Derived from WORKER_ONLY_FIELDS, so this list cannot drift from the split
    the tests enforce. Ordered with net_paid first: it is the field that shows
    why the split exists at all."""
    order = sorted(WORKER_ONLY_FIELDS, key=lambda n: (n != "net_paid", n))
    return [
        WorkerFieldOut(
            name=name,
            label=FIELD_LABELS[name],
            prompt=WORKER_PROMPTS[name],
            why=WORKER_WHY[name],
            required_for=(["cpf"] if name in CPF_ONLY_FIELDS else ["pay"]),
            answer_type=ANSWER_TYPES[name],
            choices=(
                [ChoiceOut(value=v, label=lbl) for v, lbl in choices_for(name)]
                if ANSWER_TYPES[name] == "choice"
                else []
            ),
        )
        for name in order
    ]


def _cache_state(readings: tuple) -> tuple[str, str]:
    """Say which path this response came down, in words the screen can show.

    A miss is stated, not left to be inferred from a response time. The cache
    is demo infrastructure for a room with bad wifi, and "it felt fast" is not
    evidence that it was used. See docs/debt.md,
    write-path-contradicts-its-own-contract.
    """
    hits = [r for r in readings if r.cache == CACHE_HIT]
    misses = [r for r in readings if r.cache != CACHE_HIT]

    if not misses:
        return "HIT", (
            "Both readings were replayed from entries committed to the repo. "
            "No model was called, so this works with the network down."
        )
    if not hits:
        keys = ", ".join(sorted({r.cache_key for r in misses if r.cache_key}))
        return "MISS", (
            "No committed cache entry matched these images, so both readers were "
            f"called live just now. Expected entries: {keys}. Generate them with "
            "backend/scripts/make_cache_entry.py and commit them before relying on "
            "this offline."
        )
    return "PARTIAL", (
        f"{len(hits)} of {len(readings)} readings were replayed from the committed "
        f"cache; {len(misses)} had no entry and were called live. A partial cache "
        "will not survive the network going down."
    )


@app.post("/extract", response_model=ExtractOut)
def extract(body: ExtractRequest) -> ExtractOut:
    """Run both readers on the same images and reconcile in pure code.

    This endpoint establishes nothing on its own. It returns a status per field,
    and the six fields no reader was shown, which the worker must answer before
    /compute will run. A reader outage is reported as a reader outage; it never
    promotes the surviving reader's answer to an agreement.
    """
    images = _to_images(body)
    readers = default_readers()

    with ThreadPoolExecutor(max_workers=len(readers)) as pool:
        readings = tuple(pool.map(lambda r: read_with_cache(r, images), readers))

    cache_state, cache_note = _cache_state(readings)
    reconciled = reconcile(readings)
    read_fields = [
        ReadFieldOut(
            name=name,
            label=FIELD_LABELS[name],
            fact=_fact_out(rec.fact),
            readings=rec.readings,
            unreadable=list(rec.unreadable),
        )
        for name, rec in sorted(reconciled.items())
    ]

    return ExtractOut(
        readers=[
            ReaderInfoOut(
                key=r.key,
                label=r.label,
                model=r.model,
                provider=r.provider,
                ok=r.ok,
                error=r.error,
                latency_ms=r.latency_ms,
                from_cache=r.from_cache,
                cache=r.cache,
                cache_key=r.cache_key,
            )
            for r in readings
        ],
        read_fields=read_fields,
        worker_fields=_worker_fields_out(),
        agreed_count=sum(1 for f in read_fields if f.fact.status == "AGREED"),
        read_field_count=len(read_fields),
        cpf_only_fields=sorted(CPF_ONLY_FIELDS),
        cache_state=cache_state,
        cache_note=cache_note,
    )


# --------------------------------------------------------------------------
# Stage 3: the follow-through agent
#
# These endpoints are transport. The mandate guard lives in fairslip.agent, at
# one chokepoint; nothing here re-implements it, and nothing here decides a
# verdict. A refusal from the agent becomes a refusal in the response - it is
# never downgraded into a partial success.
# --------------------------------------------------------------------------


@app.get("/agent/mandate", response_model=MandateOut)
def agent_mandate() -> MandateOut:
    """The mandate table, served from the code that enforces it.

    The screen renders the worker's choice from this rather than from its own
    copy, so the levels a worker is offered and the levels the guard enforces
    cannot drift apart."""
    return MandateOut(
        levels=[
            MandateLevelOut(
                level=level,
                label=MANDATE_LABELS[level],
                actions=sorted(a.value for a in MANDATE_TABLE[level]),
                action_detail=[
                    ActionOut(name=a.value, built=is_built(a))
                    for a in sorted(MANDATE_TABLE[level], key=lambda x: x.value)
                ],
            )
            for level in sorted(MANDATE_TABLE)
        ],
        no_authentication_notice=NO_AUTHENTICATION_NOTICE,
        reference_links=dict(REFERENCE_LINKS),
    )


@app.post("/agent/send", response_model=SentOut)
def agent_send(body: SendIn) -> SentOut:
    """Record that the worker sent the message. Sends nothing.

    There is no client in fairslip.agent and none here: the worker sends from
    their own phone, and this records the tap that says they did. A request
    without a tap is refused - there is no path that records SENT without one."""
    tap = None
    if body.tap is not None:
        try:
            at = datetime.fromisoformat(body.tap.at)
        except ValueError as e:
            raise InvalidInputError(f"tap.at: {body.tap.at!r} is not an ISO 8601 datetime") from e
        try:
            tap = TapEvent(at=at, surface=body.tap.surface)
        except ValueError as e:
            # A naive timestamp or an empty surface. Refused at the edge rather
            # than escaping as a 500: the caller sent something the record cannot
            # be built from, and that is an input refusal, not a crash.
            raise InvalidInputError(str(e)) from e

    sent = Mandate(body.level).act(Action.SEND, tap=tap, message_id=body.message_id)
    return SentOut(
        state=sent.state.value,
        tap_at=sent.tap.at.isoformat(),
        tap_surface=sent.tap.surface,
        message_id=sent.message_id,
        note=(
            "Recorded from your tap. FairSlip did not contact your employer, and "
            "cannot tell whether you sent anything: what this records is that you "
            "approved it, at the moment above."
        ),
    )


@app.post("/agent/verify", response_model=VerifyOut)
def agent_verify(body: VerifyIn) -> VerifyOut:
    """Reconcile month 2 against month 1, with arithmetic and nothing else.

    Both months go through compute_expected(). No model is called on this path -
    not here, and not in fairslip.agent, which imports no network client at all."""
    month1 = compute_expected(_to_pay_inputs(body.month1))
    result = Mandate(body.level).act(
        Action.VERIFY, month1=month1, month2=_to_pay_inputs(body.month2)
    )

    if isinstance(result, Unverifiable):
        return VerifyOut(
            verdict=result.verdict.value,
            state=result.state.value,
            month1_difference=_money(result.month1_difference),
            blocked_by=[
                BlockedFieldOut(name=b.name, status=b.status, detail=b.detail)
                for b in result.blocked_by
            ],
            arithmetic=(
                "No verdict. Month 2 was not established, so FairSlip has not "
                "checked whether the month-1 difference closed."
            ),
        )

    # verify() returns one of exactly two types; Unverifiable was handled above.
    return VerifyOut(
        verdict=result.verdict.value,
        state=result.state.value,
        month1_difference=_money(result.month1_difference),
        month2_difference=_money(result.month2_difference),
        adjustment_found=_money(result.adjustment_found),
        remaining_gap=_money(result.remaining_gap),
        month1_expected_net=_money(result.month1_expected_net),
        month2_expected_net=_money(result.month2_expected_net),
        month2_net_paid=_money(result.month2_net_paid),
        arithmetic=(
            f"month-1 difference {_money(result.month1_difference).display} "
            f"minus adjustment found on payslip 2 "
            f"{_money(result.adjustment_found).display} "
            f"= {_money(result.remaining_gap).display} remaining"
        ),
    )


# Live drafting is OFF by default, including in production. The demo path is the
# committed cache, and a spec with no entry is refused by name rather than
# quietly costing a model call at demo time. Set FAIRSLIP_DRAFT_ALLOW_LIVE=1 on a
# machine with a key to draft something new.
DRAFT_ALLOW_LIVE = os.getenv("FAIRSLIP_DRAFT_ALLOW_LIVE", "").strip() in {"1", "true", "TRUE"}


@app.post("/agent/draft", response_model=DraftOut)
def agent_draft(body: DraftIn) -> DraftOut:
    """Draft a message to the employer. Sends nothing, and says so.

    The one endpoint on which a model speaks. Every figure in the returned text
    was checked against the engines' own output before this function saw it: a
    draft citing a number no engine produced is rejected in fairslip.agent, not
    filtered here."""
    declared = dict(fx.draft_specs())
    if body.spec_name not in declared:
        raise InvalidInputError(
            f"unknown draft spec {body.spec_name!r}; declared: {sorted(declared)}"
        )
    spec = declared[body.spec_name]
    who = fx.persona_for_spec(body.spec_name)
    # MWC exists for migrant workers. Offering it to a Citizen states something
    # about the reader that nothing established.
    migrant = who is not None and who.residency in fx.MIGRANT_PASS_TYPES

    draft = Mandate(body.level).act(
        Action.DRAFT,
        spec=spec,
        cache_dir=DEFAULT_DRAFT_CACHE_DIR,
        allow_live=DRAFT_ALLOW_LIVE,
        migrant_worker=migrant,
    )

    hit = draft.cache == DRAFT_CACHE_HIT
    return DraftOut(
        state=AgentState.MESSAGE_DRAFTED.value,
        basis=draft_basis(body.spec_name),
        english=draft.english,
        translated=draft.translated,
        language=draft.language,
        figures_cited=[
            CitedFigureOut(
                label=f.label, amount=_money(f.amount), formula=f.formula, source=f.source
            )
            for f in draft.figures_cited
        ],
        alternative_heading=draft.alternative.heading,
        alternative=[
            NgoOptionOut(name=o.name, what_they_do=o.what_they_do, link=o.link)
            for o in draft.alternative.options
        ],
        model=draft.model,
        cache_state=draft.cache,
        cache_note=(
            f"Replayed from a draft committed to this build on {draft.generated_on}. "
            f"No model was called for this request."
            if hit
            else f"Written just now by {draft.model}."
        ),
        generated_on=draft.generated_on,
    )


def _persona_out(p: fx.DemoPersona) -> AgentPersonaOut:
    return AgentPersonaOut(
        key=p.key,
        name=p.name,
        residency_label=p.residency_label,
        occupation=p.occupation,
        language=p.language,
        cpf_applies=p.cpf_applies,
    )


def draft_basis(spec_name: str) -> str:
    """Whose message a draft is. Composed here, not on the screen: a caveat the
    frontend assembles is a caveat the frontend can quietly stop assembling,
    which is how the CPF card's twin shipped without one."""
    p = fx.persona_for_spec(spec_name)
    if p is None:
        return "Fictional worked example - this is not your message."
    return (
        f"Fictional worked example - this is not your message. It is written in "
        f"the first person for {p.name}, an invented {p.residency_label} "
        f"working in {p.occupation}, about their invented month. FairSlip "
        f"has not drafted anything about the documents you uploaded."
    )


@app.get("/agent/demo-inputs", response_model=AgentDemoInputsOut)
def agent_demo_inputs(persona: str = fx.DEFAULT_PERSONA_KEY) -> AgentDemoInputsOut:
    """Fictional. The month-2 fixtures the /check agent panel verifies against.

    Which persona is served is a query parameter; Mei Ling is the default.
    Nothing is computed on this path - these are the same established facts the
    backend tests use, serialised."""

    def out(pi) -> dict:
        return {
            name: _fact_out(f).model_dump()
            for name in type(pi).__dataclass_fields__
            if (f := getattr(pi, name)) is not None
        }

    try:
        who = fx.persona_by_key(persona)
    except KeyError as e:
        raise InvalidInputError(str(e)) from e

    m1 = who.month1()
    common = {
        "month1": out(m1),
        "month2_corrected": out(who.month2_corrected()),
        "month2_uncorrected": out(who.month2_uncorrected()),
        "month2_blocked": out(who.month2_blocked()),
        "personas": [_persona_out(p) for p in fx.DEMO_PERSONAS],
        "selected": _persona_out(who),
        "draft_spec_name": who.draft_spec_name,
    }

    # Not a CPF member: no pack is computed at all. A split of zeros under a
    # NO_CPF banner, carrying a note about an overlap of $0, is a card
    # contradicting itself - and it is the defect this branch exists to prevent.
    if not who.cpf_applies:
        return AgentDemoInputsOut(**common, cpf=None, no_cpf_note=who.cpf_note)

    breakdown = compute_expected(m1)
    split = shortfall_split(
        who.declared_ow, breakdown.expected_gross, who.band, who.residency
    )
    return AgentDemoInputsOut(
        **common,
        cpf=CpfPackOut(
            split=_split_out(split),
            split_note=SPLIT_NOTE,
            split_bridge=split_bridge(split),
        ),
        cpf_basis=(
            f"Fictional worked example - these are not your figures. {who.name} is "
            f"invented, and every amount above is their month, not the month you "
            f"uploaded. FairSlip did "
            f"not compute CPF for your month, for the reason given further up this page: "
            f"working it out needs the wage the employer contributed on, and reading that "
            f"backwards off a payslip gives a range rather than one figure. In this invented "
            f"example that wage is simply given as ${money_display(who.declared_ow)}, "
            f"chosen so it is consistent with the $280 CPF line on their payslip."
        ),
    )


@app.post("/agent/escalation", response_model=EscalationOut)
def agent_escalation(body: EscalationIn) -> EscalationOut:
    """Level 4's action, called for real so the mandate check runs first.

    Called for real so the mandate check runs FIRST, and so the refusal below
    level 4 is the right one: MANDATE_EXCEEDED naming level 4, not
    ACTION_NOT_BUILT. The screen must never guess which - telling a worker at
    level 0 that raising their level would not help is false, and it suppresses
    the one real choice the mandate exists to offer.

    At level 4 it assembles the TADM half. It files nothing: there is no network
    client in fairslip.agent and none here."""
    who = fx.persona_by_key(body.persona) if body.persona else None
    pack = Mandate(body.level).act(
        Action.PREPARE_ESCALATION,
        cpf_applies=who.cpf_applies if who else True,
    )
    return EscalationOut(
        heading=pack.heading,
        evidence=[
            EvidenceItemOut(
                quoted=e.quoted,
                note=e.note,
                source_url=e.source_url,
                source_label=e.source_label,
            )
            for e in pack.evidence
        ],
        deadlines=[
            DeadlineOut(
                label=d.label,
                quoted=d.quoted,
                source_url=d.source_url,
                source_label=d.source_label,
            )
            for d in pack.deadlines
        ],
        filing_steps=list(pack.filing_steps),
        not_built=[
            NotBuiltOut(
                what=n.what,
                why=n.why,
                what_is_known=[
                    QuotedSourceOut(quoted=q.quoted, note=q.note)
                    for q in n.what_is_known
                ],
                source_url=n.source_url,
                source_label=n.source_label,
            )
            for n in pack.not_built
        ],
        disclaimer=pack.disclaimer,
    )


# --------------------------------------------------------------------------
# Impact radius
# --------------------------------------------------------------------------


def _engine_value_changed(before: object, after: object) -> bool:
    """Did the worker actually change this fact, as the ENGINE sees it?

    Compares the CONVERTED values - what _to_pay_inputs produced - not the JSON
    the wire carried. A boolean field whose input box is seeded with
    String(false) sends the string "false" against the boolean False, and a raw
    comparison calls that a change: the screen then reported "is workman
    False -> false" for a fact nobody touched. Decimals normalise the same way
    the reconciler does, so "18" and "18.0" remain one value."""
    if isinstance(before, Decimal) or isinstance(after, Decimal):
        try:
            return Decimal(str(before)) != Decimal(str(after))
        except (InvalidOperation, TypeError, ValueError):
            return before != after
    return before != after


@app.post("/impact", response_model=ImpactOut)
def impact(body: ImpactIn) -> ImpactOut:
    """Change one established fact and see how far the change reaches.

    BOTH SIDES COME FROM THE ENGINE. This calls compute_expected() twice - the
    same function /compute calls, with the same refusals - and does the
    comparison here, so no screen has to subtract anything.

    The dependency edges are read off Component.inputs, which records the
    provenance string of every fact that produced an amount. A component is
    related to a changed fact when it carries that fact's source string on
    EITHER side - a line that only exists after the change carries the after
    one.
    Nothing in this function knows that overtime depends on ot_hours; it knows
    that the overtime component listed a source that a changed fact also had.

    If the new value is not established, or is out of scope, compute_expected
    refuses and that refusal is the response. There is no fall back to the old
    number: a screen showing the previous figure after a refused re-run would be
    presenting a stale amount as a current one.
    """
    before_inputs = _to_pay_inputs(body.before)
    after_inputs = _to_pay_inputs(body.after)

    # Which facts differ, and what the BEFORE run called their source.
    changed: list[ChangedFieldOut] = []
    changed_sources: set[str] = set()
    for name in PayInputs.__dataclass_fields__:
        b = getattr(body.before, name)
        a = getattr(body.after, name)
        if b is None or a is None:
            if b is not a:
                raise InvalidInputError(
                    f"{name}: present on one side of the comparison and absent on the "
                    f"other; impact needs the same set of facts on both sides"
                )
            continue
        bf = getattr(before_inputs, name)
        af = getattr(after_inputs, name)
        if _engine_value_changed(bf.value, af.value):
            changed.append(
                ChangedFieldOut(
                    name=name,
                    before_value=str(bf.value),
                    after_value=str(af.value),
                    before_source=b.source,
                    after_source=a.source,
                )
            )
            # BOTH sides' provenance strings. A component that only exists in
            # the after-run (a rest-day overtime line that appears once the
            # hours exceed the normal day) carries the AFTER source, so matching
            # on the before source alone would call it unexplained.
            changed_sources.add(b.source)
            changed_sources.add(a.source)

    if not changed:
        raise InvalidInputError(
            "nothing changed between the two sets of facts; there is no impact to show"
        )

    # The edges are matched on the identity of a provenance string, and nothing
    # requires those strings to be distinct - Fact.source even defaults to "".
    # Give every fact the same source and `depends_on_changed` becomes constant
    # True: every line then claims to depend on the change, and the contradiction
    # detector can never fire. It reports green because it has been blinded.
    #
    # So refuse rather than report a graph that cannot be computed. A view whose
    # whole claim is "these lines did not move, and here is why" must not answer
    # when it cannot tell which line is which.
    all_sources: list[str] = []
    for name in PayInputs.__dataclass_fields__:
        for side in (body.before, body.after):
            f = getattr(side, name)
            if f is not None:
                all_sources.append(f.source)
    for cf in changed:
        for src, where in ((cf.before_source, "before"), (cf.after_source, "after")):
            if all_sources.count(src) > 1:
                raise InvalidInputError(
                    f"{cf.name}: its {where} provenance ({src!r}) is shared with another "
                    f"fact, so which lines depend on it cannot be established. Impact "
                    f"needs each fact to carry its own source."
                )

    # Both runs through the engine. A refusal on either is the response.
    before_bd = compute_expected(before_inputs)
    after_bd = compute_expected(after_inputs)

    by_label_before = {c.label: c for c in before_bd.components}
    by_label_after = {c.label: c for c in after_bd.components}

    rows: list[ComponentImpactOut] = []
    unexplained: list[str] = []
    held_but_dependent: list[str] = []
    moved = 0
    unchanged = 0

    for label in sorted(set(by_label_before) | set(by_label_after)):
        b = by_label_before.get(label)
        a = by_label_after.get(label)
        # Derived: does this line carry the source string of a fact that changed?
        # BOTH sides' inputs. `b or a` yielded the before-run whenever both
        # existed, so the after-run's provenance was only ever consulted for an
        # ADDED row - which contradicted the reason given above for collecting
        # the after sources at all.
        line_sources = set(b.inputs if b else ()) | set(a.inputs if a else ())
        touches = bool(line_sources & changed_sources)

        if b is not None and a is not None:
            if b.amount == a.amount:
                status, delta = "UNCHANGED", None
                unchanged += 1
                # A line CAN list the changed fact and still hold: the rest-day
                # table brackets on half the normal daily hours, so 8 -> 9
                # crosses no bracket. Saying "did not list the fact you changed"
                # about that line would be false, and the screen used to.
                if touches:
                    held_but_dependent.append(label)
            else:
                status, delta = "MOVED", _money(a.amount - b.amount)
                moved += 1
                if not touches:
                    unexplained.append(label)
            rows.append(
                ComponentImpactOut(
                    label=label,
                    status=status,
                    before=_money(b.amount),
                    after=_money(a.amount),
                    delta=delta,
                    depends_on_changed=touches,
                    formula=a.formula,
                )
            )
        elif a is not None:
            moved += 1
            if not touches:
                unexplained.append(label)
            rows.append(
                ComponentImpactOut(
                    label=label,
                    status="ADDED",
                    after=_money(a.amount),
                    depends_on_changed=touches,
                    formula=a.formula,
                )
            )
        else:
            moved += 1
            if not touches:
                unexplained.append(label)
            rows.append(
                ComponentImpactOut(
                    label=label,
                    status="REMOVED",
                    before=_money(b.amount),
                    depends_on_changed=touches,
                    formula=b.formula,
                )
            )

    return ImpactOut(
        changed_fields=changed,
        components=rows,
        moved_count=moved,
        unchanged_count=unchanged,
        unexplained_moves=unexplained,
        held_but_dependent=held_but_dependent,
        before_expected_net=_money(before_bd.expected_net),
        after_expected_net=_money(after_bd.expected_net),
        before_difference=_money(before_bd.difference),
        after_difference=_money(after_bd.difference),
        difference_delta=_money(after_bd.difference - before_bd.difference),
        flags_before=list(before_bd.flags),
        flags_after=list(after_bd.flags),
        note=(
            "Both figures came from the same engine, run twice on the facts you "
            "sent. Which lines are related to your change is read from what each "
            "line recorded as its own inputs, not from a list of what depends on "
            "what."
        ),
    )
