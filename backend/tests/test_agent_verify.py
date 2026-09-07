"""verify() is arithmetic, not opinion.

No model participates in a verdict. Every test here asserts on numbers the
engines produced, and the CORRECTED case is checked structurally as well as
behaviourally: the verdict is a derived property of three Decimals, so there is
no field anyone could set to CORRECTED without the arithmetic closing.
"""

from __future__ import annotations

import dataclasses
from decimal import Decimal

import pytest

from demo.fixtures import (
    rahim_month1_established,
    rahim_month2_corrected,
    rahim_month2_uncorrected,
)
from fairslip.agent import (
    CLOSING_TOLERANCE,
    Unverifiable,
    Verdict,
    VerifyResult,
    verify,
)
from fairslip.rules import Fact, PayInputs, Status, compute_expected, to_cents

D = Decimal

# The engine keeps full precision and rounds only for display (rules.to_cents).
# verify() follows that convention, so the figures below are compared at cents -
# which is also the only scale at which "did this money arrive" is a real
# question. The one-cent closing tolerance absorbs exactly the residue that
# (12 x basic) / (52 x 44) leaves behind, and nothing larger.
MONTH1_DIFFERENCE = D("62.24")


def _month1():
    return compute_expected(rahim_month1_established())


def _month2_partial() -> PayInputs:
    """Half the difference arrived: $1,462.24 + $30.00 = $1,492.24."""
    inp = rahim_month2_corrected()
    return dataclasses.replace(
        inp, net_paid=Fact(D("1492.24"), Status.HUMAN_CONFIRMED, "worker entered bank amount")
    )


# --------------------------------------------------------------------------
# The three named verdicts
# --------------------------------------------------------------------------


def test_the_corrected_fixture_closes_within_one_cent() -> None:
    r = verify(_month1(), rahim_month2_corrected())
    assert isinstance(r, VerifyResult)
    assert to_cents(r.month1_difference) == MONTH1_DIFFERENCE
    assert to_cents(r.month2_difference) == D("-62.24")
    assert to_cents(r.adjustment_found) == D("62.24")
    assert abs(r.remaining_gap) <= CLOSING_TOLERANCE
    assert r.verdict is Verdict.CORRECTED


def test_the_uncorrected_fixture_does_not_narrow() -> None:
    r = verify(_month1(), rahim_month2_uncorrected())
    assert isinstance(r, VerifyResult)
    assert to_cents(r.month1_difference) == MONTH1_DIFFERENCE
    # month 2 repeated the same shortfall, so the cumulative gap doubled
    assert to_cents(r.month2_difference) == D("62.24")
    assert to_cents(r.adjustment_found) == D("-62.24")
    assert to_cents(r.remaining_gap) == D("124.48")
    assert abs(r.remaining_gap) >= abs(r.month1_difference)  # it did not narrow
    assert r.verdict is Verdict.NOT_CORRECTED


def test_a_narrowing_that_does_not_close_is_partially_corrected() -> None:
    r = verify(_month1(), _month2_partial())
    assert isinstance(r, VerifyResult)
    assert to_cents(r.adjustment_found) == D("30.00")
    assert to_cents(r.remaining_gap) == D("32.24")
    assert abs(r.remaining_gap) < abs(r.month1_difference)  # it narrowed
    assert abs(r.remaining_gap) > CLOSING_TOLERANCE  # but it did not close
    assert r.verdict is Verdict.PARTIALLY_CORRECTED


# --------------------------------------------------------------------------
# CORRECTED is unreachable without the numbers closing
# --------------------------------------------------------------------------


def test_verdict_is_derived_and_not_a_settable_field() -> None:
    """Structural. There is no `verdict` field on VerifyResult, so no caller can
    construct one that claims CORRECTED. Turning the property into a field
    reddens this immediately."""
    names = {f.name for f in dataclasses.fields(VerifyResult)}
    assert "verdict" not in names
    assert {"month1_difference", "month2_difference"} <= names


def _result_with_gap(remaining: Decimal) -> VerifyResult:
    """remaining_gap == month1_difference + month2_difference, so a target gap is
    produced by choosing month 2's difference. Built through the real constructor:
    there is no verdict parameter to pass, which is the point of the test."""
    return VerifyResult(
        month1_difference=MONTH1_DIFFERENCE,
        month2_difference=remaining - MONTH1_DIFFERENCE,
        month1_expected_net=D("1462.24"),
        month2_expected_net=D("1462.24"),
        month2_net_paid=D("1400.00"),
    )


@pytest.mark.parametrize(
    "remaining",
    [D("0.02"), D("-0.02"), D("1.00"), D("62.24"), D("124.48"), D("-5.00")],
)
def test_corrected_is_unreachable_for_any_gap_outside_one_cent(remaining: Decimal) -> None:
    """Derived over gaps on both sides of the tolerance: whatever the month-1 and
    month-2 figures were, a non-closing gap cannot read CORRECTED."""
    r = _result_with_gap(remaining)
    assert r.remaining_gap == remaining
    assert r.verdict is not Verdict.CORRECTED


@pytest.mark.parametrize("remaining", [D("0.00"), D("0.01"), D("-0.01")])
def test_corrected_is_reached_exactly_at_and_inside_one_cent(remaining: Decimal) -> None:
    r = _result_with_gap(remaining)
    assert r.remaining_gap == remaining
    assert r.verdict is Verdict.CORRECTED


def test_no_verdict_exists_without_its_arithmetic() -> None:
    """Every arithmetic verdict carries the three figures that produced it.
    Derived over the fixtures rather than asserted about one."""
    for month2 in (rahim_month2_corrected(), rahim_month2_uncorrected(), _month2_partial()):
        r = verify(_month1(), month2)
        assert isinstance(r, VerifyResult)
        assert r.verdict in {
            Verdict.CORRECTED,
            Verdict.PARTIALLY_CORRECTED,
            Verdict.NOT_CORRECTED,
        }
        for figure in (
            r.month1_difference,
            r.month2_difference,
            r.adjustment_found,
            r.remaining_gap,
        ):
            assert isinstance(figure, Decimal)
            assert figure.is_finite(), f"{figure!r} is not a finite amount"


def test_every_verdict_in_the_enum_is_produced_by_some_input() -> None:
    """Derived over the Verdict enum: a verdict nothing can produce is either
    dead or unreachable, and both are defects."""
    produced = {
        verify(_month1(), rahim_month2_corrected()).verdict,
        verify(_month1(), rahim_month2_uncorrected()).verdict,
        verify(_month1(), _month2_partial()).verdict,
        verify(_month1(), _month2_unestablished()).verdict,
    }
    assert produced == set(Verdict)


# --------------------------------------------------------------------------
# No model participates
# --------------------------------------------------------------------------


def test_verify_runs_with_every_api_key_removed(monkeypatch: pytest.MonkeyPatch) -> None:
    """If a model were consulted, this would fail. It is the behavioural half of
    test_agent_never_files.py's structural check."""
    for key in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    r = verify(_month1(), rahim_month2_corrected())
    assert r.verdict is Verdict.CORRECTED


# --------------------------------------------------------------------------
# UNVERIFIABLE: month 2 could not be established at all
# --------------------------------------------------------------------------


def _month2_unestablished() -> PayInputs:
    """Readers disagreed on OT hours and never agreed on the basic."""
    inp = rahim_month2_corrected()
    return dataclasses.replace(
        inp,
        ot_hours=Fact(
            {"reader_a": D("18"), "reader_b": D("13")},
            Status.DISAGREED,
            "readers disagree: Claude 18, auditor 13",
        ),
        monthly_basic=Fact(None, Status.MISSING, "neither reader found this on the documents"),
    )


def test_month_2_that_is_not_established_is_unverifiable_not_not_corrected() -> None:
    """The accusatory default is the one that must not happen: NOT_CORRECTED
    asserts the employer did not fix it, on input the system never established."""
    r = verify(_month1(), _month2_unestablished())
    assert isinstance(r, Unverifiable)
    assert r.verdict is Verdict.UNVERIFIABLE
    assert r.verdict is not Verdict.NOT_CORRECTED


def test_unverifiable_names_the_blocking_fields_and_their_statuses() -> None:
    """The screen must be able to say WHICH fact is missing, not that something
    is (docs/debt.md, missing-narrated-as-settled)."""
    r = verify(_month1(), _month2_unestablished())
    assert isinstance(r, Unverifiable)
    blocked = {b.name: b.status for b in r.blocked_by}
    assert blocked["ot_hours"] == Status.DISAGREED.value
    assert blocked["monthly_basic"] == Status.MISSING.value
    for b in r.blocked_by:
        assert b.detail, f"{b.name} carries no reason"


def test_unverifiable_carries_no_arithmetic_it_could_not_compute() -> None:
    """It must not report a remaining gap it had no month-2 figures for. Absent
    is a state; a zero would read as 'nothing outstanding'."""
    r = verify(_month1(), _month2_unestablished())
    assert isinstance(r, Unverifiable)
    assert not hasattr(r, "remaining_gap")
    # The month-1 side WAS established, so it is still reportable.
    assert to_cents(r.month1_difference) == MONTH1_DIFFERENCE


@pytest.mark.parametrize(
    "field_name",
    ["monthly_basic", "ot_hours", "days_per_week", "normal_daily_hours", "net_paid"],
)
def test_any_single_unestablished_required_field_blocks_the_verdict(field_name: str) -> None:
    """Derived over the required fields rather than checking one: a guard that
    fires on only some fields is docs/debt.md, guard-that-only-fires-on-some-paths."""
    inp = dataclasses.replace(
        rahim_month2_corrected(),
        **{field_name: Fact(None, Status.MISSING, "not established")},
    )
    r = verify(_month1(), inp)
    assert isinstance(r, Unverifiable)
    assert field_name in {b.name for b in r.blocked_by}


def test_a_value_the_engine_cannot_use_is_unverifiable_not_a_crash() -> None:
    """HUMAN_CONFIRMED says a person answered, not that the answer is a number
    (docs/debt.md, established-status-mistaken-for-established-value)."""
    inp = dataclasses.replace(
        rahim_month2_corrected(),
        net_paid=Fact(D("NaN"), Status.HUMAN_CONFIRMED, "worker typed NaN"),
    )
    r = verify(_month1(), inp)
    assert isinstance(r, Unverifiable)
    assert r.blocked_by
    assert any("net_paid" == b.name for b in r.blocked_by)
