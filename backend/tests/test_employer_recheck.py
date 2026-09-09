"""Two runs of the same payroll, compared - and the identity that makes it possible.

WHY THIS IS A BACKEND CONTRACT AND NOT A DIFF IN THE BROWSER. "Nine resolved,
two still different, no new exceptions" is a claim about which EMPLOYEE a row in
the second file is. Get that wrong and the screen reports a correction that did
not happen, to a person it did not happen to. So the matching, the state of each
pair and every count are computed here, once, and the screen renders fields.

THE KEY IS THE CPF ACCOUNT NUMBER, AND IT IS NOT A CHOICE OF CONVENIENCE. It is
the Employer Contribution Detail Record's own employee identifier - cols 29-37,
"First byte is either S or T and last byte is the check digit". Row number is
not an identity: a payroll export may reorder, and the demo's own corrected file
does, deliberately, so that a comparison keyed on position would be visibly
wrong rather than invisibly wrong. Name is not an identity either, and this file
proves it: the fictional roster has 300 rows and 262 distinct names.

WHAT IS REFUSED RATHER THAN GUESSED. A file whose account numbers are blank or
repeated cannot be matched, and the comparison refuses the whole run instead of
pairing rows by position and hoping. There is no partial answer available here:
a comparison that silently fell back to row order would produce exactly the
confident, wrong output this product exists to prevent.

THE TEN STATES ARE EXHAUSTIVE AND DISJOINT, and the test that says so derives
its cases from the Outcome enum's own product rather than listing them.
"""

from __future__ import annotations

from decimal import Decimal
from itertools import product

import pytest

from demo.employer_roster import (
    CORRECTED,
    SEEDED_EXCEPTIONS,
    build_corrected_csv,
    build_csv,
)
from fairslip.employer import Outcome, RecheckState, check_csv, recheck

# --------------------------------------------------------------- the identity


def test_the_fictional_roster_gives_every_row_a_distinct_account_number() -> None:
    """The premise the whole feature rests on, checked rather than assumed."""
    before = check_csv(build_csv())
    accounts = [f.employee_account_no for f in before.findings]
    assert all(accounts), "a row has no account number"
    assert len(set(accounts)) == len(accounts), "two rows share a CPF account number"


def test_names_are_not_unique_which_is_why_they_are_not_the_key() -> None:
    """A negative result worth asserting: this is the mistake the key avoids."""
    before = check_csv(build_csv())
    names = [f.employee_name for f in before.findings]
    assert len(set(names)) < len(names), (
        "the roster now happens to have unique names. That does not make a name an "
        "identity - it makes this test stop demonstrating why it is not one."
    )


def test_a_file_with_a_repeated_account_number_is_refused_not_guessed() -> None:
    both = _csv([_row(account="S1111111A"), _row(account="S1111111A", name="Someone Else")])
    with pytest.raises(ValueError, match="account"):
        recheck(check_csv(both), check_csv(_csv([_row(account="S2222222B")])))


def test_a_file_with_a_blank_account_number_is_refused_not_guessed() -> None:
    blank = _csv([_row(account="")])
    with pytest.raises(ValueError, match="account"):
        recheck(check_csv(blank), check_csv(_csv([_row(account="S2222222B")])))


def test_the_refusal_names_the_file_it_applies_to() -> None:
    """Which of the two the employer has to fix. "One of your files" is not an
    instruction."""
    good = check_csv(_csv([_row(account="S2222222B")]))
    bad = check_csv(_csv([_row(account="S1111111A"), _row(account="S1111111A")]))
    with pytest.raises(ValueError, match="second|corrected|after"):
        recheck(good, bad)
    with pytest.raises(ValueError, match="first|original|before"):
        recheck(bad, good)


# ------------------------------------------------------------- the ten states


def test_every_pair_of_outcomes_maps_to_exactly_one_state() -> None:
    """DERIVED FROM THE ENUM'S OWN PRODUCT.

    Nine ordered pairs of outcomes, plus a row that left the file and a row that
    joined it. A pair with no state would be a comparison the code cannot
    describe; two states for one pair would be a count that can double.
    """
    from fairslip.employer import state_for

    seen = {}
    for before, after in product(Outcome, Outcome):
        state = state_for(before, after)
        assert isinstance(state, RecheckState), f"{before} -> {after} has no state"
        seen[(before, after)] = state
    assert len(seen) == 9
    assert state_for(Outcome.OK, None) is RecheckState.REMOVED
    assert state_for(None, Outcome.OK) is RecheckState.ADDED


def test_no_state_is_unreachable() -> None:
    """The other direction: a state nothing can produce is a category on a
    screen that will always read zero."""
    from fairslip.employer import state_for

    reachable = {state_for(b, a) for b, a in product(Outcome, Outcome)}
    reachable.add(RecheckState.REMOVED)
    reachable.add(RecheckState.ADDED)
    assert reachable == set(RecheckState)


@pytest.mark.parametrize(
    "before,after,expected",
    [
        (Outcome.OK, Outcome.OK, RecheckState.STILL_MATCHED),
        (Outcome.EXCEPTION, Outcome.OK, RecheckState.RESOLVED),
        (Outcome.EXCEPTION, Outcome.EXCEPTION, RecheckState.STILL_EXCEPTION),
        (Outcome.OK, Outcome.EXCEPTION, RecheckState.NEW_EXCEPTION),
        (Outcome.OK, Outcome.REFUSED, RecheckState.NEWLY_REFUSED),
        (Outcome.EXCEPTION, Outcome.REFUSED, RecheckState.NEWLY_REFUSED),
        (Outcome.REFUSED, Outcome.REFUSED, RecheckState.STILL_REFUSED),
        (Outcome.REFUSED, Outcome.OK, RecheckState.NEWLY_CHECKED_MATCHED),
        (Outcome.REFUSED, Outcome.EXCEPTION, RecheckState.NEWLY_CHECKED_EXCEPTION),
    ],
)
def test_the_state_of_each_transition_is_what_it_says(before, after, expected) -> None:
    from fairslip.employer import state_for

    assert state_for(before, after) is expected


def test_a_refused_row_never_becomes_a_match_without_being_checked() -> None:
    """THE ONE REDUCTION THAT WOULD BE A LIE. A row refused in both runs has been
    computed in neither, and reporting it as matched would report a check nobody
    performed. It has its own state, and that state is not RESOLVED."""
    from fairslip.employer import state_for

    assert state_for(Outcome.REFUSED, Outcome.REFUSED) is RecheckState.STILL_REFUSED
    assert state_for(Outcome.REFUSED, Outcome.REFUSED) is not RecheckState.RESOLVED
    assert state_for(Outcome.REFUSED, Outcome.REFUSED) is not RecheckState.STILL_MATCHED


def test_a_row_that_left_the_file_is_not_resolved() -> None:
    """An employee who is no longer in the payroll has not been corrected. They
    have left, or been dropped, and the difference that was recorded against
    them is neither fixed nor outstanding - it is unaccounted for."""
    before = check_csv(_csv([_row(account="S1111111A", declared="1.00")]))
    after = check_csv(_csv([_row(account="S9999999Z", declared="1.00")]))
    out = recheck(before, after)
    states = {r.state for r in out.rows}
    assert RecheckState.REMOVED in states
    assert RecheckState.ADDED in states
    assert RecheckState.RESOLVED not in states
    assert out.counts[RecheckState.REMOVED.value] == 1
    assert out.counts[RecheckState.ADDED.value] == 1


# ----------------------------------------------------- reorder does not matter


def test_the_same_file_shuffled_compares_as_entirely_unchanged() -> None:
    """THE TEST THAT WOULD FAIL ON A ROW-NUMBER MATCH.

    Every row is the same employee with the same figures, in a different order.
    A comparison keyed on position would report a payroll full of new exceptions
    and resolutions; keyed on the account number it reports nothing changed.
    """
    text = build_csv()
    lines = text.strip().split("\n")
    header, rows = lines[0], lines[1:]
    shuffled = header + "\n" + "\n".join(list(reversed(rows))) + "\n"

    out = recheck(check_csv(text), check_csv(shuffled))
    assert out.counts[RecheckState.RESOLVED.value] == 0
    assert out.counts[RecheckState.NEW_EXCEPTION.value] == 0
    assert out.counts[RecheckState.REMOVED.value] == 0
    assert out.counts[RecheckState.ADDED.value] == 0
    assert out.counts[RecheckState.STILL_EXCEPTION.value] == SEEDED_EXCEPTIONS
    assert out.both_change == Decimal(0)


def test_a_row_keeps_the_row_number_it_had_in_each_file() -> None:
    """Both numbers travel, because a person reading the two files needs to find
    the row in each - and after a reorder they are different numbers."""
    text = build_csv()
    lines = text.strip().split("\n")
    shuffled = lines[0] + "\n" + "\n".join(list(reversed(lines[1:]))) + "\n"
    out = recheck(check_csv(text), check_csv(shuffled))
    moved = [r for r in out.rows if r.before_row_number != r.after_row_number]
    assert moved, "a full reversal moved nothing; the fixture is wrong"
    for r in out.rows:
        assert r.before_row_number is not None
        assert r.after_row_number is not None


# -------------------------------------------------------- the corrected roster


@pytest.fixture(scope="module")
def demo():
    return recheck(check_csv(build_csv()), check_csv(build_corrected_csv()))


def test_the_corrected_roster_resolves_exactly_what_it_says_it_fixed(demo) -> None:
    """The seeded corrections and the reported resolutions are one number.

    The number said on stage is "nine of the eleven now match". It is derived
    from what the corrected file actually changed, so it cannot drift.
    """
    assert demo.counts[RecheckState.RESOLVED.value] == CORRECTED["RESOLVED"]


def test_it_reports_the_exceptions_the_correction_did_not_touch(demo) -> None:
    assert demo.counts[RecheckState.STILL_EXCEPTION.value] == CORRECTED["STILL_EXCEPTION"]


def test_it_reports_an_exception_the_correction_introduced(demo) -> None:
    """A NEW exception is not a failure of the product - it is the product
    working. The demo file seeds one on purpose, because a before/after that can
    only ever improve is a before/after nobody should trust."""
    assert demo.counts[RecheckState.NEW_EXCEPTION.value] == CORRECTED["NEW_EXCEPTION"]


def test_the_rows_it_could_not_check_are_still_the_rows_it_cannot_check(demo) -> None:
    assert demo.counts[RecheckState.STILL_REFUSED.value] == CORRECTED["STILL_REFUSED"]


def test_the_corrected_file_is_in_a_different_order(demo) -> None:
    """Otherwise the reorder-proof matching is being demonstrated on a file that
    does not exercise it."""
    moved = [r for r in demo.rows if r.before_row_number != r.after_row_number]
    assert len(moved) > 100, f"only {len(moved)} rows moved; the corrected file barely reorders"


# ------------------------------------------------------------- the money


def test_each_runs_own_total_is_that_runs_own_total(demo) -> None:
    """`before_difference` is what the FIRST X-ray showed, and `after_difference`
    is what the SECOND one shows. They are each a sum over that run's own checked
    rows, so the two headline figures on screen match the two runs behind them."""
    before = check_csv(build_csv())
    after = check_csv(build_corrected_csv())
    assert demo.before_difference == before.totals.signed_difference
    assert demo.after_difference == after.totals.signed_difference


def test_the_change_is_measured_only_over_rows_checked_in_both_runs(demo) -> None:
    """WHY THERE ARE FIVE MONEY FIELDS AND NOT THREE.

    `after_difference - before_difference` is a difference between two sums over
    two DIFFERENT sets of rows whenever a row was refused in one run and checked
    in the other. Reporting that subtraction as "the change" would attribute a
    row's whole contribution to a correction that never touched it.

    So the change is computed over the rows both runs actually checked, and it
    balances exactly on that set.
    """
    assert demo.both_change == demo.both_after - demo.both_before


def test_the_comparable_row_count_is_the_rows_checked_in_both(demo) -> None:
    checked_in_both = [
        r
        for r in demo.rows
        if r.before_outcome is not None
        and r.after_outcome is not None
        and r.before_outcome is not Outcome.REFUSED
        and r.after_outcome is not Outcome.REFUSED
    ]
    assert demo.rows_checked_in_both == len(checked_in_both)


def test_the_comparable_totals_are_sums_over_exactly_those_rows(demo) -> None:
    before_sum = sum(
        (r.before_difference or Decimal(0) for r in demo.rows if _in_both(r)), Decimal(0)
    )
    after_sum = sum(
        (r.after_difference or Decimal(0) for r in demo.rows if _in_both(r)), Decimal(0)
    )
    assert demo.both_before == before_sum
    assert demo.both_after == after_sum


def _in_both(r) -> bool:
    return (
        r.before_outcome is not None
        and r.after_outcome is not None
        and r.before_outcome is not Outcome.REFUSED
        and r.after_outcome is not Outcome.REFUSED
    )


def test_every_row_of_either_file_appears_exactly_once(demo) -> None:
    """Nothing is dropped and nothing is counted twice - which is what makes the
    counts a partition rather than a selection."""
    before = check_csv(build_csv())
    after = check_csv(build_corrected_csv())
    accounts = {f.employee_account_no for f in before.findings} | {
        f.employee_account_no for f in after.findings
    }
    assert len(demo.rows) == len(accounts)
    assert sum(demo.counts.values()) == len(demo.rows)


def test_the_counts_name_every_state_including_the_empty_ones(demo) -> None:
    """A state absent from the map is a category the screen renders as nothing
    rather than as zero, and "0 new exceptions" is a finding."""
    assert set(demo.counts) == {s.value for s in RecheckState}


# --------------------------------------------------------------- the API


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _post(client):
    return client.post(
        "/employer/recheck",
        files={
            "before": ("v1.csv", build_csv(), "text/csv"),
            "after": ("v2.csv", build_corrected_csv(), "text/csv"),
        },
    )


def test_the_endpoint_returns_the_same_comparison_the_engine_made(client, demo) -> None:
    body = _post(client).json()
    assert body["counts"] == {k: v for k, v in demo.counts.items()}
    assert Decimal(body["both_change"]["exact"]) == demo.both_change
    assert body["rows_checked_in_both"] == demo.rows_checked_in_both


def test_the_endpoint_ships_both_summaries_so_each_can_be_shown_whole(client) -> None:
    """The before/after headline is two X-rays, not two numbers. Shipping the
    full summary of each means the screen shows the same coverage strip for the
    second run that it showed for the first."""
    body = _post(client).json()
    for half in ("before_summary", "after_summary"):
        assert body[half]["rows_read"] == 300
        assert "totals" in body[half]
        assert "reasons" in body[half]


def test_the_endpoint_refuses_a_file_whose_rows_cannot_be_identified(client) -> None:
    dup = _csv([_row(account="S1111111A"), _row(account="S1111111A")])
    r = client.post(
        "/employer/recheck",
        files={"before": ("v1.csv", dup, "text/csv"), "after": ("v2.csv", dup, "text/csv")},
    )
    assert r.status_code == 400
    assert "account" in r.json()["detail"]


def test_the_corrected_demo_roster_is_downloadable(client) -> None:
    r = client.get("/employer/demo-csv-corrected")
    assert r.status_code == 200
    assert r.text == build_corrected_csv()


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
    return f"202612345K,PTE,01,202609,{account},{declared},{ow},{aw},E,{name},{dob},{residency}"


def _csv(rows: list[str]) -> str:
    return _HEADER + "\n" + "\n".join(rows) + "\n"
