"""An established STATUS is not an established VALUE.

HUMAN_CONFIRMED says a person answered. It does not say the answer is a number,
or a number this engine can compute with. Only the first claim was being
checked, so:

  - a worker typing "NaN" produced HTTP 500 from an unhandled InvalidOperation,
    and on the one path that survived it, a screen printing "$NaN.undefined"
    under "Possible unreconciled difference";
  - "-5" hours produced overtime of -$47.20 - a figure the engine invented from
    an input nobody established;
  - days_per_week=7 was accepted in silence whenever no rest day was worked,
    because the only guard lived inside daily_rate(), which was not called.

The frontend has no test runner, so the guard belongs here, where the suite is.
These tests are the reason it cannot quietly come back.

See docs/debt.md, established-status-mistaken-for-established-value.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from fairslip.rules import (
    ALLOWED_DAYS_PER_WEEK,
    REST_DAY_REQUESTERS,
    Fact,
    PayInputs,
    Status,
    UnverifiedInputError,
    compute_expected,
)

D = Decimal

# Every numeric field the engine requires, so the cases below are derived rather
# than hand-picked. `quantified test name, quantified check`.
AMOUNT_FIELDS = (
    "monthly_basic",
    "ot_hours",
    "normal_daily_hours",
    "deductions_total",
    "net_paid",
)

# Values that are Decimals, and are not amounts.
NOT_FINITE = ("NaN", "Infinity", "-Infinity", "sNaN")
UNDISPLAYABLE = ("1e400", "-1e400", "1E1000")


def confirmed(value: object) -> Fact:
    return Fact(value, Status.HUMAN_CONFIRMED, "worker answered on screen")


def agreed(value: object) -> Fact:
    return Fact(value, Status.AGREED, "both readers agree")


def inputs(**overrides: Fact | None) -> PayInputs:
    base: dict[str, Fact | None] = {
        "monthly_basic": confirmed(D("1200")),
        "ot_hours": confirmed(D("18")),
        "days_per_week": confirmed(6),
        "normal_daily_hours": confirmed(D("8")),
        "is_workman": confirmed(True),
        "deductions_total": confirmed(D("0")),
        "net_paid": confirmed(D("1400")),
        "rest_day_hours": None,
        "rest_day_requested_by": None,
    }
    base.update(overrides)
    return PayInputs(**base)  # type: ignore[arg-type]


def test_the_baseline_inputs_compute() -> None:
    """If this fails the guards are rejecting a good month and every test below
    is meaningless."""
    bd = compute_expected(inputs())
    assert bd.expected_gross > 0


# --------------------------------------------------------------------------
# NaN and Infinity
# --------------------------------------------------------------------------


@pytest.mark.parametrize("field", AMOUNT_FIELDS)
@pytest.mark.parametrize("bad", NOT_FINITE)
def test_no_amount_field_accepts_a_non_finite_number(field: str, bad: str) -> None:
    """Derived over every amount field x every non-finite spelling. A NaN that
    reaches the arithmetic propagates silently to the screen; one that reaches
    a comparison raises. Neither is an answer."""
    with pytest.raises(UnverifiedInputError, match="not a finite number"):
        compute_expected(inputs(**{field: confirmed(D(bad))}))


@pytest.mark.parametrize("field", AMOUNT_FIELDS)
@pytest.mark.parametrize("bad", UNDISPLAYABLE)
def test_no_amount_field_accepts_a_number_too_large_to_show_in_cents(
    field: str, bad: str
) -> None:
    """Finite, and still not a value: it raises the moment it is rounded for
    display. A number the engine cannot express in cents it has not established."""
    with pytest.raises(UnverifiedInputError, match="cannot be expressed in cents"):
        compute_expected(inputs(**{field: confirmed(D(bad))}))


def test_a_nan_difference_can_no_longer_reach_a_breakdown() -> None:
    """The specific screen defect: net_paid = NaN returned HTTP 200 with
    difference "NaN", which the client rendered as "$NaN.undefined"."""
    with pytest.raises(UnverifiedInputError):
        compute_expected(inputs(net_paid=confirmed(D("NaN"))))


# --------------------------------------------------------------------------
# Negatives
# --------------------------------------------------------------------------


@pytest.mark.parametrize("field", AMOUNT_FIELDS)
def test_no_amount_field_accepts_a_negative(field: str) -> None:
    with pytest.raises(UnverifiedInputError, match="is negative"):
        compute_expected(inputs(**{field: confirmed(D("-5"))}))


def test_negative_overtime_hours_do_not_produce_negative_overtime_pay() -> None:
    """-5 hours used to yield overtime of -47.20. A wage this engine reports must
    be one MOM's formula can produce, and that one cannot."""
    with pytest.raises(UnverifiedInputError, match="ot_hours.*is negative"):
        compute_expected(inputs(ot_hours=confirmed(D("-5"))))


def test_a_negative_rest_day_reading_is_refused_not_treated_as_no_rest_day() -> None:
    """A negative is not "no rest day was worked". It is a reading nobody
    established, and the engine says so rather than dropping the component."""
    with pytest.raises(UnverifiedInputError, match="rest_day_hours.*is negative"):
        compute_expected(
            inputs(
                rest_day_hours=confirmed(D("-8")),
                rest_day_requested_by=confirmed("employer"),
            )
        )


def test_zero_is_not_negative_and_is_still_accepted() -> None:
    """The boundary. A month with no overtime and no deductions is ordinary."""
    bd = compute_expected(inputs(ot_hours=confirmed(D("0")), deductions_total=confirmed(D("0"))))
    assert bd.component("overtime").amount == 0


# --------------------------------------------------------------------------
# days_per_week, guarded at the boundary
# --------------------------------------------------------------------------


@pytest.mark.parametrize("bad", [0, 1, 4, 7, 8, 365, -6])
def test_days_per_week_outside_the_encoded_weeks_is_refused_even_with_no_rest_day(
    bad: int,
) -> None:
    """The exact hole: daily_rate() guards itself but is only called when a rest
    day was worked, so a month without one accepted 7 and computed a gross."""
    with pytest.raises(UnverifiedInputError, match="days_per_week"):
        compute_expected(inputs(days_per_week=confirmed(bad), rest_day_hours=None))


@pytest.mark.parametrize("good", sorted(ALLOWED_DAYS_PER_WEEK))
def test_every_encoded_week_is_accepted(good: int) -> None:
    assert compute_expected(inputs(days_per_week=confirmed(good))).expected_gross > 0


def test_days_per_week_as_a_digit_string_is_accepted() -> None:
    """The API publishes "5"/"6" as choice values, so the engine must take the
    strings it is handed. See test_extract_api round-trip tests."""
    assert compute_expected(inputs(days_per_week=confirmed("6"))).expected_gross > 0


def test_days_per_week_that_is_not_a_number_is_refused() -> None:
    with pytest.raises(UnverifiedInputError, match="whole number of days"):
        compute_expected(inputs(days_per_week=confirmed("six")))


def test_a_bool_is_not_a_day_count() -> None:
    """`int(True)` is 1, which would silently become a one-day week."""
    with pytest.raises(UnverifiedInputError, match="whole number of days"):
        compute_expected(inputs(days_per_week=confirmed(True)))


# --------------------------------------------------------------------------
# Booleans and choices
# --------------------------------------------------------------------------


@pytest.mark.parametrize("bad", ["false", "true", "no", 0, 1, "", None])
def test_is_workman_must_be_an_actual_boolean(bad: object) -> None:
    """`bool("false")` is True, so a string that looks like an answer would have
    flipped a worker into the wrong Employment Act ceiling."""
    with pytest.raises(UnverifiedInputError, match="is not true or false"):
        compute_expected(inputs(is_workman=confirmed(bad)))


@pytest.mark.parametrize("good", [True, False])
def test_is_workman_accepts_both_booleans(good: bool) -> None:
    assert compute_expected(inputs(is_workman=confirmed(good))).expected_gross > 0


@pytest.mark.parametrize("bad", ["boss", "", "EMPLOYER", None, 1])
def test_rest_day_requested_by_must_be_one_of_the_two_the_table_prices(bad: object) -> None:
    """MOM's rest-day table has exactly two columns. Anything else has no row."""
    with pytest.raises(UnverifiedInputError, match="rest_day_requested_by"):
        compute_expected(
            inputs(rest_day_hours=confirmed(D("8")), rest_day_requested_by=confirmed(bad))
        )


@pytest.mark.parametrize("good", sorted(REST_DAY_REQUESTERS))
def test_both_rest_day_requesters_are_accepted(good: str) -> None:
    bd = compute_expected(
        inputs(rest_day_hours=confirmed(D("8")), rest_day_requested_by=confirmed(good))
    )
    assert bd.component("rest_day").amount > 0


# --------------------------------------------------------------------------
# The gate applies however the fact was established
# --------------------------------------------------------------------------


@pytest.mark.parametrize("field", AMOUNT_FIELDS)
def test_a_reader_agreement_on_a_bad_value_is_refused_too(field: str) -> None:
    """Two readers agreeing on nonsense is still nonsense. The value gate is not
    a check on the worker; it is a check on the value."""
    with pytest.raises(UnverifiedInputError, match="is negative"):
        compute_expected(inputs(**{field: agreed(D("-1"))}))


def test_an_unestablished_status_is_still_refused_first() -> None:
    """The status gate did not move."""
    with pytest.raises(UnverifiedInputError, match="is DISAGREED"):
        compute_expected(
            inputs(ot_hours=Fact({"a": D("18"), "b": D("13")}, Status.DISAGREED, "readers differ"))
        )


def test_a_refusal_always_names_the_field_it_refused() -> None:
    """A refusal the worker cannot act on is barely a refusal."""
    for field in AMOUNT_FIELDS:
        with pytest.raises(UnverifiedInputError) as e:
            compute_expected(inputs(**{field: confirmed(D("-1"))}))
        assert field in str(e.value)
