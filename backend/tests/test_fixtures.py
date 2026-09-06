"""The demo fixtures must agree with the engines, or the demo and the tests can drift.

Every assertion here is either an engine output or a rule-derived value. The band
constants in demo/fixtures.py are checked against band_for() rather than trusted.
"""

from dataclasses import fields
from decimal import Decimal

import pytest

cpf = pytest.importorskip("fairslip.cpf")
rules = pytest.importorskip("fairslip.rules")
fx = pytest.importorskip("demo.fixtures")

D = Decimal

# (label, date of birth, the band the fixture module declares)
DECLARED_BANDS = [
    ("rahim", fx.RAHIM_DOB, fx.RAHIM_BAND),
    ("mei_ling", fx.MEI_LING_DOB, fx.MEI_LING_BAND),
]


@pytest.mark.parametrize("label,dob,declared", DECLARED_BANDS, ids=[b[0] for b in DECLARED_BANDS])
def test_declared_age_band_matches_the_rule(label, dob, declared):
    # The fixture may not assert an age band the step-up rule would not produce.
    assert cpf.band_for(dob, fx.DEMO_MONTH) == declared


ESTABLISHED_MONTH1 = [
    ("rahim", fx.rahim_month1_established),
    ("mei_ling", fx.mei_ling_month1_established),
]


@pytest.mark.parametrize(
    "label,factory", ESTABLISHED_MONTH1, ids=[f[0] for f in ESTABLISHED_MONTH1]
)
def test_month1_fixtures_reconstruct_the_calibration_gross(label, factory):
    # Both personas work the same month: $1,200 basic, 18 OT hours, one employer-requested
    # rest day of 8 of 8 hours, 6-day week -> $1,462.24. See test_rules_calibration.py.
    bd = rules.compute_expected(factory())
    assert rules.to_cents(bd.expected_gross) == D("1462.24")


@pytest.mark.parametrize(
    "label,factory", ESTABLISHED_MONTH1, ids=[f[0] for f in ESTABLISHED_MONTH1]
)
def test_every_fact_in_an_established_fixture_is_established(label, factory):
    # Derived from the dataclass, not a hand-picked field: a new PayInputs field cannot
    # slip into a fixture unestablished without failing here.
    inputs = factory()
    for f in fields(inputs):
        fact = getattr(inputs, f.name)
        if fact is None:
            continue
        assert fact.established, f"{label}.{f.name} is {fact.status.value}"
        assert fact.source, f"{label}.{f.name} has no source"


def test_the_pre_confirmation_fixture_is_refused_not_computed():
    with pytest.raises(rules.UnverifiedInputError) as e:
        rules.compute_expected(fx.rahim_month1_before_confirmation())
    assert "ot_hours" in str(e.value)


def test_mei_ling_declared_ow_is_what_the_payslip_cpf_line_implies():
    # The payslip shows $280 of employee CPF. Under the 2026 table that is CPF computed on
    # $1,400, which is exactly the wage the fixture says the employer used.
    on_declared = cpf.cpf_contribution(
        fx.MEI_LING_DECLARED_OW, fx.MEI_LING_BAND, fx.MEI_LING_RESIDENCY
    )
    assert on_declared.employee == fx.MEI_LING_CPF_EMPLOYEE_ON_PAYSLIP


def test_mei_ling_net_paid_is_the_declared_gross_less_the_declared_employee_cpf():
    # $1,400.00 - $280 = $1,120.00, the amount the fixture says reached the bank.
    inputs = fx.mei_ling_month1_established()
    assert inputs.net_paid.value == fx.MEI_LING_DECLARED_OW - fx.MEI_LING_CPF_EMPLOYEE_ON_PAYSLIP


def test_rahim_declared_ow_is_what_reached_his_bank():
    # No CPF for a Work Permit holder, so the wage the employer paid on is the net amount.
    inputs = fx.rahim_month1_established()
    assert inputs.net_paid.value == fx.RAHIM_DECLARED_OW
