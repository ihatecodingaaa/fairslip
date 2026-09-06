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
        return cls(exact=str(amount), display=f"{to_cents(amount):.2f}")


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
    error: Literal["UNESTABLISHED_INPUT", "OUT_OF_SCOPE", "INVALID_INPUT"]
    detail: str


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
