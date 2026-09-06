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


# --- the shortfall split: no double-counting the employee CPF share ---------


def test_shortfall_split_for_mei_ling():
    s = cpf.shortfall_split(D("1400.00"), D("1462.24"), A, SC)
    assert s.gross_shortfall == D("62.24")
    assert s.employee_cpf_on_shortfall == D("12")
    assert s.cash_shortfall == D("50.24")
    assert s.cpf_shortfall == D("23")
    assert s.employer_cpf_on_shortfall == D("11")
    assert s.total_withheld == D("73.24")


def test_naive_addition_would_double_count_by_the_employee_share():
    s = cpf.shortfall_split(D("1400.00"), D("1462.24"), A, SC)
    naive = s.gross_shortfall + s.cpf_shortfall  # 62.24 + 23 = 85.24
    assert naive == D("85.24")
    assert naive - s.total_withheld == s.employee_cpf_on_shortfall  # the $12 counted twice


def test_split_is_internally_consistent_two_ways():
    s = cpf.shortfall_split(D("1400.00"), D("1462.24"), A, SC)
    assert s.cash_shortfall + s.cpf_shortfall == s.total_withheld
    assert s.gross_shortfall + s.employer_cpf_on_shortfall == s.total_withheld


def test_split_matches_the_fixture_net_paid():
    # Mei Ling's payslip shows $1,120.00 reaching the bank. Expected cash is
    # 1462.24 - 292 = 1170.24. The difference must equal cash_shortfall.
    expected_cash = D("1462.24") - cpf.cpf_contribution(D("1462.24"), A, SC).employee
    s = cpf.shortfall_split(D("1400.00"), D("1462.24"), A, SC)
    assert expected_cash - D("1120.00") == s.cash_shortfall


def test_split_is_zero_when_nothing_is_short():
    s = cpf.shortfall_split(D("1462.24"), D("1462.24"), A, SC)
    assert (s.gross_shortfall, s.cash_shortfall, s.cpf_shortfall, s.total_withheld) == (
        D("0"),
        D("0"),
        D("0"),
        D("0"),
    )


def test_split_for_a_work_permit_holder_is_all_cash():
    # No CPF liability, so the entire gross shortfall is cash and none of it is CPF.
    s = cpf.shortfall_split(D("1400.00"), D("1462.24"), A, cpf.Residency.WORK_PERMIT)
    assert s.cash_shortfall == D("62.24")
    assert s.cpf_shortfall == D("0")
    assert s.total_withheld == D("62.24")


# --- band ordering must not depend on enum declaration order ----------------


def test_band_order_matches_the_age_thresholds():
    # BAND_ORDER[i] is the band you are in after passing i thresholds.
    assert len(cpf.BAND_ORDER) == len(cpf.AGE_THRESHOLDS) + 1
    assert cpf.AGE_THRESHOLDS == (55, 60, 65, 70)
    assert cpf.BAND_ORDER == (
        cpf.AgeBand.UP_TO_55,
        cpf.AgeBand.ABOVE_55_TO_60,
        cpf.AgeBand.ABOVE_60_TO_65,
        cpf.AgeBand.ABOVE_65_TO_70,
        cpf.AgeBand.ABOVE_70,
    )


def test_every_band_in_the_order_has_a_rate_row():
    for b in cpf.BAND_ORDER:
        assert b in cpf.RATES_2026


@pytest.mark.parametrize(
    "dob,expected",
    [
        (date(1990, 1, 1), cpf.AgeBand.UP_TO_55),
        (date(1969, 1, 1), cpf.AgeBand.ABOVE_55_TO_60),
        (date(1964, 1, 1), cpf.AgeBand.ABOVE_60_TO_65),
        (date(1959, 1, 1), cpf.AgeBand.ABOVE_65_TO_70),
        (date(1950, 1, 1), cpf.AgeBand.ABOVE_70),
    ],
)
def test_band_for_covers_every_band(dob, expected):
    assert cpf.band_for(dob, date(2026, 9, 1)) == expected
