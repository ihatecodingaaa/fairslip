"""FairSlip API - transport only.

Two endpoints run the two rule packs, one serves the fictional demo fixtures.
No money is computed here: every amount returned came out of fairslip.rules or
fairslip.cpf. When an engine refuses, the refusal is the response - it is never
downgraded into a partial success.
"""

from __future__ import annotations

import os
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import demo.fixtures as fx
from app.schemas import (
    ComponentOut,
    CpfDeltaOut,
    CpfFixtureOut,
    CpfOut,
    CpfRequest,
    CpfResultOut,
    FactIn,
    FixturesOut,
    Money,
    PayBreakdownOut,
    PayInputsIn,
    PersonaOut,
    RefusalOut,
    SplitLine,
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


def _as_bool(name: str, v: object) -> bool:
    if not isinstance(v, bool):
        raise InvalidInputError(f"{name}: {v!r} is not true or false")
    return v


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
