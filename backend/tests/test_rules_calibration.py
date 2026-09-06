"""Calibration tests for fairslip.rules.

These encode the worked example verified against MOM's published formulas on
6 Sept 2026 (page last updated 24 July 2025). If the engine returns different
numbers, either the engine is wrong or MOM changed the rule. Check the page.

    Inputs:  basic $1,200 | 18 OT hours | one full rest day (8h of 8h) at
             employer's request | 6-day week
    Expect:  hourly $6.29 | OT $169.93 | rest day $92.31 | gross $1,462.24
             (5-day week variant: daily $55.38, rest day $110.77, gross $1,480.70)

Until fairslip.rules exists the module is skipped, so the Stop-hook gate does
not block planning turns.
"""

from decimal import Decimal

import pytest

rules = pytest.importorskip("fairslip.rules")

D = Decimal
CENT = D("0.01")


def cents(x) -> Decimal:
    return D(x).quantize(CENT)


def fact(v, status="AGREED", source="test"):
    return rules.Fact(v, rules.Status(status), source)


# --- rate formulas ---------------------------------------------------------


def test_hourly_basic_rate_is_12x_over_52x44():
    # 14400 / 2288 = 6.2937...
    assert cents(rules.hourly_basic_rate(D("1200"))) == D("6.29")


def test_a_7_87_hourly_rate_implies_about_1500_basic_not_1200():
    # Guards against the inconsistent example a previous advisor produced.
    implied_basic = D("7.87") * (D(52) * D(44)) / D(12)
    assert D("1495") < implied_basic < D("1505")
    assert cents(rules.hourly_basic_rate(D("1200"))) != D("7.87")


def test_overtime_18_hours():
    assert cents(rules.overtime_pay(D("1200"), D("18"))) == D("169.93")


def test_daily_rate_six_day_week():
    assert cents(rules.daily_rate(D("1200"), 6)) == D("46.15")


def test_daily_rate_five_day_week():
    assert cents(rules.daily_rate(D("1200"), 5)) == D("55.38")


def test_daily_rate_rejects_unsupported_week():
    with pytest.raises(ValueError):
        rules.daily_rate(D("1200"), 7)


# --- rest-day table ---------------------------------------------------------


@pytest.mark.parametrize(
    "hours,who,expected",
    [
        (D("4"), "employer", D("46.15")),  # up to half day, employer's request -> 1 day
        (D("8"), "employer", D("92.31")),  # more than half, employer's request -> 2 days
        (D("4"), "employee", D("23.08")),  # up to half day, employee's request -> half day
        (D("8"), "employee", D("46.15")),  # more than half, employee's request -> 1 day
    ],
)
def test_rest_day_table_six_day_week(hours, who, expected):
    got = rules.rest_day_pay(D("1200"), 6, hours, D("8"), who)
    assert cents(got) == expected


# --- full worked example ----------------------------------------------------


def worked_example(days_per_week: int, net_paid: str = "1656.20"):
    return rules.PayInputs(
        monthly_basic=fact(D("1200"), source="payslip.jpg:basic"),
        ot_hours=fact(D("18"), "HUMAN_CONFIRMED", "roster.png + worker confirmed"),
        days_per_week=fact(days_per_week, source="worker confirmed"),
        normal_daily_hours=fact(D("8"), source="KET"),
        is_workman=fact(True, source="work permit"),
        deductions_total=fact(D("0"), source="payslip.jpg:deductions"),
        net_paid=fact(D(net_paid), source="bank screenshot"),
        rest_day_hours=fact(D("8"), source="roster.png:sunday"),
        rest_day_requested_by=fact("employer", source="worker confirmed"),
    )


def test_worked_example_gross_six_day_week():
    b = rules.compute_expected(worked_example(6))
    assert cents(b.component("basic").amount) == D("1200.00")
    assert cents(b.component("overtime").amount) == D("169.93")
    assert cents(b.component("rest_day").amount) == D("92.31")
    assert cents(b.expected_gross) == D("1462.24")


def test_worked_example_gross_five_day_week():
    b = rules.compute_expected(worked_example(5))
    assert cents(b.component("rest_day").amount) == D("110.77")
    assert cents(b.expected_gross) == D("1480.70")


def test_difference_is_expected_net_minus_paid():
    b = rules.compute_expected(worked_example(6, net_paid="1400.00"))
    assert cents(b.difference) == D("62.24")


def test_every_component_carries_provenance():
    b = rules.compute_expected(worked_example(6))
    for c in b.components:
        assert c.inputs, f"{c.label} has no source labels"
        assert all(s for s in c.inputs), f"{c.label} has an empty source label"


# --- flags, never silent truncation ------------------------------------------


def test_ot_over_72_hours_is_flagged_not_truncated():
    inp = worked_example(6)
    inp = rules.PayInputs(**{**inp.__dict__, "ot_hours": fact(D("80"))})
    b = rules.compute_expected(inp)
    assert any("OT_HOURS_EXCEED_72" in f for f in b.flags)
    # the pay for 80h is still computed on 80h; the flag is the signal
    assert cents(b.component("overtime").amount) == cents(rules.overtime_pay(D("1200"), D("80")))


def test_deductions_over_half_are_flagged():
    inp = worked_example(6)
    inp = rules.PayInputs(**{**inp.__dict__, "deductions_total": fact(D("900"))})
    b = rules.compute_expected(inp)
    assert any("DEDUCTIONS_EXCEED_50PCT" in f for f in b.flags)


def test_non_workman_above_2600_is_flagged_not_covered():
    inp = worked_example(6)
    inp = rules.PayInputs(
        **{**inp.__dict__, "monthly_basic": fact(D("3000")), "is_workman": fact(False)}
    )
    b = rules.compute_expected(inp)
    assert any("NOT_COVERED_BY_PART4" in f for f in b.flags)


# --- the honesty rule in the type system ------------------------------------


@pytest.mark.parametrize("status", ["DISAGREED", "MISSING"])
def test_engine_refuses_unestablished_input(status):
    inp = worked_example(6)
    inp = rules.PayInputs(**{**inp.__dict__, "ot_hours": fact(D("18"), status)})
    with pytest.raises(rules.UnverifiedInputError):
        rules.compute_expected(inp)


def test_human_confirmed_counts_as_established():
    inp = worked_example(6)
    inp = rules.PayInputs(**{**inp.__dict__, "ot_hours": fact(D("18"), "HUMAN_CONFIRMED")})
    rules.compute_expected(inp)  # must not raise


# --- display helpers --------------------------------------------------------


def test_days_of_pay_translation():
    # $92.31 at $46.15/day is about 2 days
    assert cents(rules.days_of_pay(D("92.31"), D("1200"), 6)) == D("2.00")
