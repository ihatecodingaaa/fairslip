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
    BlockedFieldOut,
    ChoiceOut,
    CitedFigureOut,
    ComponentOut,
    CpfDeltaOut,
    CpfFixtureOut,
    CpfOut,
    CpfRequest,
    CpfResultOut,
    DraftIn,
    DraftOut,
    ExtractOut,
    ExtractRequest,
    FactIn,
    FixturesOut,
    MandateLevelOut,
    MandateOut,
    Money,
    NgoOptionOut,
    PayBreakdownOut,
    PayInputsIn,
    PersonaOut,
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
)
from fairslip.cpf import (
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

SPLIT_NOTE = (
    "The gross shortfall and the CPF shortfall overlap by the employee's CPF share on the "
    "missing wage. Adding them would count that share twice; the total below is cash plus CPF."
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
                "Rahim - before he confirms the hours",
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
            "Recorded from your tap. FairSlip did not contact your employer: you "
            "send the message yourself, and this is the record that you did."
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

    draft = Mandate(body.level).act(
        Action.DRAFT,
        spec=spec,
        cache_dir=DEFAULT_DRAFT_CACHE_DIR,
        allow_live=DRAFT_ALLOW_LIVE,
    )

    hit = draft.cache == DRAFT_CACHE_HIT
    return DraftOut(
        state=AgentState.MESSAGE_DRAFTED.value,
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
