"""The aggregates the X-Ray draws, and the identities that make them safe to draw.

WHY THESE LIVE IN THE ENGINE AND NOT IN THE CHART. The payroll X-Ray shows three
things a grid of outcomes cannot: how much signed money sits behind each reason,
what the checked rows declare against what the rules give, and the gap between
those two. Every one of them is a SUM OVER ROWS - which is arithmetic on money,
and arithmetic on money is the backend's or it is a second source of truth.

A chart that summed `findings` in the browser would agree with this file on the
demo roster and diverge the first time a row carried a difference the chart's
filter happened to exclude. So the sums are computed once, here, and the screen
renders fields.

THE TWO IDENTITIES. Both are asserted below over the whole roster and over
generated edge cases, because they are what let the screen draw a bridge from
declared to expected at all:

    declared_total - expected_total == signed_difference        (checked rows)
    sum(signed_difference_total over reasons) == signed_difference

REFUSED ROWS CONTRIBUTE NOTHING AND ARE COUNTED ANYWAY. A refused row has no
expected amount - nothing was computed for it - so it enters no monetary total.
It still has a reason, and that reason still appears in the aggregates with
`checked_rows == 0`, so the screen can show "3 rows, not checked" rather than
"3 rows, $0.00" - which reads as three rows that were checked and agreed.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from demo.employer_roster import build_csv
from fairslip.employer import Outcome, Reason, check_csv


@pytest.fixture(scope="module")
def result():
    return check_csv(build_csv())


# ------------------------------------------------------------ reason aggregates


def test_every_reason_carried_by_a_row_has_an_aggregate(result) -> None:
    """Derived from the findings, not from a list written here.

    A reason present on a row and absent from the aggregates is a category the
    screen cannot draw and cannot filter by - the row is in the grid and
    unreachable from the summary above it.
    """
    on_rows = {f.reason.value for f in result.findings if f.reason is not None}
    aggregated = {a.reason_code for a in result.reasons}
    assert on_rows == aggregated


def test_no_aggregate_names_a_reason_the_engine_cannot_produce() -> None:
    """The other direction, over the enum that defines the vocabulary."""
    result = check_csv(build_csv())
    allowed = {r.value for r in Reason}
    assert {a.reason_code for a in result.reasons} <= allowed


def test_each_aggregates_count_is_the_number_of_rows_carrying_that_reason(result) -> None:
    for agg in result.reasons:
        rows = [f for f in result.findings if f.reason is not None and f.reason.value == agg.reason_code]
        assert agg.count == len(rows), agg.reason_code


def test_checked_rows_excludes_every_refused_row(result) -> None:
    for agg in result.reasons:
        rows = [
            f
            for f in result.findings
            if f.reason is not None
            and f.reason.value == agg.reason_code
            and f.outcome is not Outcome.REFUSED
        ]
        assert agg.checked_rows == len(rows), agg.reason_code


def test_a_reason_that_only_ever_refuses_reports_no_money(result) -> None:
    """`checked_rows == 0` is what the screen needs in order NOT to print $0.00.

    The distinction is the whole honesty contract in one field: nothing was
    computed for these rows, and a zero is a computed result.
    """
    refusal_only = [a for a in result.reasons if a.checked_rows == 0]
    assert refusal_only, "the roster seeds refusals; none reached the aggregates"
    for agg in refusal_only:
        assert agg.signed_difference_total == Decimal(0)


def test_each_aggregates_money_is_the_sum_over_its_own_checked_rows(result) -> None:
    for agg in result.reasons:
        rows = [
            f
            for f in result.findings
            if f.reason is not None
            and f.reason.value == agg.reason_code
            and f.outcome is not Outcome.REFUSED
        ]
        assert agg.signed_difference_total == sum(
            (f.difference or Decimal(0) for f in rows), Decimal(0)
        ), agg.reason_code


def test_the_reason_money_adds_up_to_the_run_total(result) -> None:
    """IDENTITY 2. A reason breakdown that does not sum to the headline is two
    claims about one payroll, and the screen shows them side by side."""
    assert sum((a.signed_difference_total for a in result.reasons), Decimal(0)) == (
        result.totals.signed_difference
    )


def test_the_reason_counts_still_cover_every_exception_and_refusal(result) -> None:
    assert sum(a.count for a in result.reasons) == result.exceptions + result.refused


# ---------------------------------------------------------------- the totals


def test_the_checked_row_count_is_the_runs_own_checked_count(result) -> None:
    assert result.totals.rows == result.checked


def test_the_declared_total_is_the_sum_over_checked_rows_only(result) -> None:
    checked = [f for f in result.findings if f.outcome is not Outcome.REFUSED]
    assert result.totals.declared_total == sum(
        (f.declared or Decimal(0) for f in checked), Decimal(0)
    )


def test_the_expected_total_is_the_sum_over_checked_rows_only(result) -> None:
    checked = [f for f in result.findings if f.outcome is not Outcome.REFUSED]
    assert result.totals.expected_total == sum(
        (f.expected or Decimal(0) for f in checked), Decimal(0)
    )


def test_a_refused_rows_declared_amount_reaches_no_total(result) -> None:
    """Refused rows DO carry a declared amount - the Additional Wages refusal
    records one - so excluding them is an act, not an accident of None."""
    refused_with_declared = [
        f
        for f in result.findings
        if f.outcome is Outcome.REFUSED and f.declared is not None and f.declared > 0
    ]
    assert refused_with_declared, "the roster seeds a refusal that carries a declared amount"
    checked = [f for f in result.findings if f.outcome is not Outcome.REFUSED]
    assert result.totals.declared_total == sum(
        (f.declared or Decimal(0) for f in checked), Decimal(0)
    )


def test_declared_minus_expected_is_the_signed_difference(result) -> None:
    """IDENTITY 1, and the only reason a declared-to-expected bridge may be drawn."""
    assert (
        result.totals.declared_total - result.totals.expected_total
        == result.totals.signed_difference
    )


def test_the_signed_difference_is_the_headline_the_run_already_reported(result) -> None:
    """The pre-existing `total_difference` summed exceptions only. Checked rows
    that matched contribute zero, so the two must be the same number - and if
    they ever are not, one of the two screens is lying."""
    assert result.totals.signed_difference == result.total_difference


def test_the_sign_survives_the_sum() -> None:
    """A total that is the sum of a positive and a negative row must not be the
    sum of their magnitudes. Built from rows whose differences cancel: a run
    that absolute-valued anything would report $80 where the truth is $0."""
    over, under = _two_rows_that_cancel()
    result = check_csv(_csv([over, under]))
    assert result.checked == 2
    diffs = sorted((f.difference for f in result.findings), key=lambda d: d or Decimal(0))
    assert diffs[0] < 0 < diffs[1], "the fixture no longer produces one row of each sign"
    assert result.totals.signed_difference == Decimal(0)
    assert result.totals.declared_total - result.totals.expected_total == Decimal(0)


def test_a_run_with_nothing_checked_reports_zero_and_says_nothing_was_checked() -> None:
    """Every row refused. The totals are zero because there is nothing in them,
    and `rows` is what distinguishes that from a payroll that balanced."""
    result = check_csv(_csv([_row(residency="PR_YEAR_1", ow="3000.00", declared="0.00")]))
    assert result.checked == 0
    assert result.totals.rows == 0
    assert result.totals.declared_total == Decimal(0)
    assert result.totals.expected_total == Decimal(0)
    assert result.totals.signed_difference == Decimal(0)


# ------------------------------------------------------------------ the API


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _posted(client):
    return client.post(
        "/employer/check",
        files={"file": ("roster.csv", build_csv(), "text/csv")},
    ).json()


def test_the_endpoint_ships_the_same_aggregates_the_engine_computed(client, result) -> None:
    body = _posted(client)
    assert len(body["reasons"]) == len(result.reasons)
    by_code = {a["reason_code"]: a for a in body["reasons"]}
    for agg in result.reasons:
        sent = by_code[agg.reason_code]
        assert sent["count"] == agg.count
        assert sent["checked_rows"] == agg.checked_rows
        assert Decimal(sent["signed_difference_total"]["exact"]) == agg.signed_difference_total


def test_the_endpoint_ships_the_totals_and_they_still_balance(client, result) -> None:
    totals = _posted(client)["totals"]
    declared = Decimal(totals["declared_total"]["exact"])
    expected = Decimal(totals["expected_total"]["exact"])
    signed = Decimal(totals["signed_difference"]["exact"])
    assert declared - expected == signed
    assert signed == result.totals.signed_difference
    assert totals["rows"] == result.checked


def test_the_wire_reason_money_still_adds_up_to_the_wire_total(client) -> None:
    """The identity is asserted again ACROSS THE WIRE, because the screen reads
    the wire and not the dataclass. A serializer that dropped a reason would
    leave both halves individually correct and the sum wrong."""
    body = _posted(client)
    per_reason = sum(
        (Decimal(a["signed_difference_total"]["exact"]) for a in body["reasons"]), Decimal(0)
    )
    assert per_reason == Decimal(body["totals"]["signed_difference"]["exact"])


# ---------------------------------------------------------------- fixtures

_HEADER = (
    "uen,payment_type,sno,relevant_month,employee_account_no,contribution_detail_amount,"
    "ordinary_wages,additional_wages,employment_status,employee_name,date_of_birth,residency"
)


def _row(
    *,
    account: str = "S1234567A",
    declared: str = "0.00",
    ow: str = "3000.00",
    aw: str = "0.00",
    name: str = "Fictional Person",
    dob: str = "1990-04-04",
    residency: str = "CITIZEN",
) -> str:
    return (
        f"202612345K,PTE,01,202609,{account},{declared},{ow},{aw},E,{name},{dob},{residency}"
    )


def _csv(rows: list[str]) -> str:
    return _HEADER + "\n" + "\n".join(rows) + "\n"


def _two_rows_that_cancel() -> tuple[str, str]:
    """One row declaring $40 too much, one declaring $40 too little.

    The correct amount comes from the engine, so the fixture cannot drift out of
    step with the rates the way a hardcoded pair would.
    """
    from datetime import date

    from fairslip.cpf import Residency, band_for, cpf_contribution

    ow = Decimal("3000.00")
    band = band_for(date(1990, 4, 4), date(2026, 9, 1))
    correct = cpf_contribution(ow, band, Residency.CITIZEN).total
    return (
        _row(account="S1111111A", declared=f"{correct + Decimal(40):.2f}", ow=f"{ow:.2f}"),
        _row(account="S2222222B", declared=f"{correct - Decimal(40):.2f}", ow=f"{ow:.2f}"),
    )
