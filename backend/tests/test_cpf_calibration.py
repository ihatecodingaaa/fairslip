"""Calibration tests for fairslip.cpf, against CPF Board's 2026 table and rounding method.

Worked example verified 6 Sept 2026:
    age 40, Singapore Citizen, OW $1,462.24 -> total $541 / employee $292 / employer $249
    same person, employer used $1,400.00  -> total $518 / employee $280 / employer $238
    shortfall caused by $62.24 of missing OT: total $23 / employee $12 / employer $11
"""

from datetime import date
from decimal import Decimal

import pytest

cpf = pytest.importorskip("fairslip.cpf")

D = Decimal
SC = cpf.Residency.CITIZEN
A = cpf.AgeBand.UP_TO_55


def test_worked_example_expected_wage():
    r = cpf.cpf_contribution(D("1462.24"), A, SC)
    assert (r.total, r.employee, r.employer) == (D("541"), D("292"), D("249"))
    assert not r.ow_capped


def test_worked_example_declared_wage():
    r = cpf.cpf_contribution(D("1400.00"), A, SC)
    assert (r.total, r.employee, r.employer) == (D("518"), D("280"), D("238"))


def test_ot_shortfall_compounds_into_cpf_shortfall():
    d = cpf.cpf_shortfall(D("1400.00"), D("1462.24"), A, SC)
    assert (d.total, d.employee, d.employer) == (D("23"), D("12"), D("11"))


def test_employer_share_is_total_minus_employee_not_a_naive_percentage():
    # OW 1004.95: total 371.83 -> 372; employee 200.99 -> 200 (cents dropped); employer = 372 - 200 = 172.
    # A naive 17% x 1004.95 = 170.84 -> 171. CPF's method gives 172: the dropped employee cents
    # move to the employer side. This is the exact rule, and it is not a percentage.
    r = cpf.cpf_contribution(D("1004.95"), A, SC)
    assert (r.total, r.employee, r.employer) == (D("372"), D("200"), D("172"))
    naive = (D("1004.95") * D("0.17")).quantize(D("1"), rounding=cpf.ROUND_HALF_UP)
    assert naive == D("171") and r.employer != naive


def test_total_rounds_half_up_at_exactly_50_cents():
    # 37% x 1350 = 499.50 -> 500 ; employee 20% x 1350 = 270 ; employer 230
    r = cpf.cpf_contribution(D("1350"), A, SC)
    assert (r.total, r.employee, r.employer) == (D("500"), D("270"), D("230"))


def test_employee_share_always_drops_cents():
    # 20% x 1004.95 = 200.99 -> 200 (dropped, not rounded)
    r = cpf.cpf_contribution(D("1004.95"), A, SC)
    assert r.employee == D("200")


def test_ow_ceiling_8000_applies():
    r = cpf.cpf_contribution(D("9000"), A, SC)
    assert r.ow_capped and r.ow_used == D("8000")
    assert (r.total, r.employee, r.employer) == (D("2960"), D("1600"), D("1360"))
    assert any("OW_CAPPED" in f for f in r.flags)


@pytest.mark.parametrize(
    "band,ow,expected",
    [
        (cpf.AgeBand.ABOVE_55_TO_60, D("3000"), (D("1020"), D("540"), D("480"))),  # 34%: 16/18
        (cpf.AgeBand.ABOVE_60_TO_65, D("3000"), (D("750"), D("375"), D("375"))),  # 25%: 12.5/12.5
        (cpf.AgeBand.ABOVE_65_TO_70, D("3000"), (D("495"), D("225"), D("270"))),  # 16.5%: 9/7.5
        (cpf.AgeBand.ABOVE_70, D("3000"), (D("375"), D("150"), D("225"))),  # 12.5%: 7.5/5
    ],
)
def test_senior_bands_2026(band, ow, expected):
    r = cpf.cpf_contribution(ow, band, SC)
    assert (r.total, r.employee, r.employer) == expected


def test_pr_third_year_plus_gets_full_rates():
    r = cpf.cpf_contribution(D("1462.24"), A, cpf.Residency.PR_YEAR_3_PLUS)
    assert r.total == D("541")


@pytest.mark.parametrize(
    "res", [cpf.Residency.WORK_PERMIT, cpf.Residency.S_PASS, cpf.Residency.EMPLOYMENT_PASS]
)
def test_work_pass_holders_have_no_cpf_and_it_is_said_not_guessed(res):
    r = cpf.cpf_contribution(D("1462.24"), A, res)
    assert (r.total, r.employee, r.employer) == (D("0"), D("0"), D("0"))
    assert any("NO_CPF" in f for f in r.flags)


@pytest.mark.parametrize("res", [cpf.Residency.PR_YEAR_1, cpf.Residency.PR_YEAR_2])
def test_graduated_pr_rates_are_refused_not_approximated(res):
    with pytest.raises(cpf.OutOfScopeError):
        cpf.cpf_contribution(D("1462.24"), A, res)


def test_wages_at_or_below_750_are_refused_not_approximated():
    with pytest.raises(cpf.OutOfScopeError):
        cpf.cpf_contribution(D("750"), A, SC)


# --- age band step-up: "from the first day of the month after the birthday" ---


def test_band_steps_up_the_month_after_55th_birthday():
    dob = date(1971, 6, 10)
    assert (
        cpf.band_for(dob, date(2026, 6, 1)) == cpf.AgeBand.UP_TO_55
    )  # birthday month: still 55 and below
    assert cpf.band_for(dob, date(2026, 6, 30)) == cpf.AgeBand.UP_TO_55
    assert cpf.band_for(dob, date(2026, 7, 1)) == cpf.AgeBand.ABOVE_55_TO_60  # month after


def test_band_for_a_40_year_old():
    assert cpf.band_for(date(1986, 3, 15), date(2026, 9, 1)) == cpf.AgeBand.UP_TO_55


def test_band_december_birthday_rolls_into_january():
    dob = date(1966, 12, 20)  # turns 60 in Dec 2026
    assert cpf.band_for(dob, date(2026, 12, 1)) == cpf.AgeBand.ABOVE_55_TO_60
    assert cpf.band_for(dob, date(2027, 1, 1)) == cpf.AgeBand.ABOVE_60_TO_65
