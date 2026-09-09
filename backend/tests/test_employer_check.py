"""We seeded N errors and it caught N - asserted, so the demo cannot under-report.

THE POINT OF THIS FILE. The sentence said on stage is "we seeded eleven errors
in three hundred rows and it found eleven". That sentence is worth nothing if it
is maintained by hand. Here it is derived: the roster records what it broke and
how many of each, the check runs, and the counts must agree per category. If the
engine stops catching the age-band transition, this goes red - rather than the
demo quietly reporting ten and nobody noticing.

AND THE ROWS IT COULD NOT CHECK ARE COUNTED TOO. An employer reading "11
exceptions" has to be able to see that seven other rows were never examined and
why. A refusal that is merely absent from the exceptions list is a row silently
passed as clean, which is this product's own failure mode committed against the
paying customer.
"""

from __future__ import annotations

from collections import Counter
from decimal import Decimal

import pytest

from demo.employer_roster import (
    RELEVANT_MONTH,
    SEEDED,
    SEEDED_EXCEPTIONS,
    SEEDED_REFUSALS,
    TOTAL_ROWS,
    build_csv,
)
from fairslip.cpf import OW_CEILING_2026
from fairslip.employer import Outcome, Reason, check_csv


@pytest.fixture(scope="module")
def result():
    return check_csv(build_csv())


def test_the_roster_is_the_size_it_says_it_is(result) -> None:
    assert result.rows_read == TOTAL_ROWS


def test_it_caught_exactly_the_number_of_errors_that_were_seeded(result) -> None:
    """The headline, and the only form of it worth saying."""
    assert result.exceptions == SEEDED_EXCEPTIONS


def test_it_refused_exactly_the_number_of_rows_that_were_seeded_unrefusable(result) -> None:
    assert result.refused == SEEDED_REFUSALS


def test_every_row_is_either_checked_or_visibly_refused(result) -> None:
    """No third state, and nothing unaccounted for. `checked` plus `refused` is
    every row read, so a row cannot fall out of the summary."""
    assert result.checked + result.refused == result.rows_read
    outcomes = Counter(f.outcome for f in result.findings)
    assert sum(outcomes.values()) == TOTAL_ROWS
    assert outcomes[Outcome.EXCEPTION] == SEEDED_EXCEPTIONS
    assert outcomes[Outcome.REFUSED] == SEEDED_REFUSALS


@pytest.mark.parametrize(("reason", "count"), sorted(SEEDED.items()))
def test_each_seeded_kind_of_error_was_caught_as_that_kind(result, reason: str, count: int) -> None:
    """Per CATEGORY, not just in total.

    An earlier version of the roster drew one seeded AMOUNT_MISMATCH row at a
    wage above the $8,000 ceiling. The check reported it - correctly - as
    OW_ABOVE_CEILING, so the totals still matched while the categories did not.
    The totals agreeing is the weaker claim; this is the one that would have
    caught it.
    """
    found = Counter(f.reason for f in result.findings if f.outcome is Outcome.EXCEPTION)
    assert found[Reason(reason)] == count


def test_the_reason_breakdown_covers_every_exception_and_refusal(result) -> None:
    """The chart on the screen is drawn from by_reason. If it did not sum to the
    findings, the bars would be a picture of a subset."""
    assert sum(n for _, n in result.by_reason) == result.exceptions + result.refused


def test_no_correct_row_was_reported_as_an_exception(result) -> None:
    """The other direction, and the one that matters to an employer.

    A check that flags correct rows costs its user more than it saves, and
    every correct row here has a declared amount the engine itself produced -
    so any exception among them would be the check disagreeing with the engine
    it is built on.
    """
    assert result.checked - result.exceptions == TOTAL_ROWS - SEEDED_EXCEPTIONS - SEEDED_REFUSALS


def test_the_age_band_rows_were_caught_by_the_rule_not_by_the_amount(result) -> None:
    """CPF Board's "Overlooked the change of age group", established.

    Each of these declares exactly what the PREVIOUS band's rate gives, so the
    finding is not "this number is wrong" but "this number is last month's rate"
    - and the detail has to say which band it came from, or the employer cannot
    act on it.
    """
    rows = [f for f in result.findings if f.reason is Reason.AGE_BAND_MISSED]
    assert rows, "no age-band rows found"
    for f in rows:
        assert "rate gives on this wage" in f.detail
        assert f.band is not None
        assert f.band.value in f.detail
        assert f"{RELEVANT_MONTH:%B %Y}" in f.detail


def test_the_ceiling_rows_carry_the_engines_own_capping_flag(result) -> None:
    """The evidence is the engine's, not a sentence this module wrote."""
    rows = [f for f in result.findings if f.reason is Reason.OW_ABOVE_CEILING]
    assert rows, "no ceiling rows found"
    for f in rows:
        assert f.ordinary_wages is not None and f.ordinary_wages > OW_CEILING_2026
        assert any(flag.startswith("OW_CAPPED") for flag in f.engine_flags)


def test_refused_rows_carry_a_reason_and_never_a_difference(result) -> None:
    """A refused row has no computed figure, so it must not contribute one.

    This is the quiet way a summary lies: a row nothing was computed for still
    adding zero to a total that is presented as "the money at stake".
    """
    for f in result.findings:
        if f.outcome is Outcome.REFUSED:
            assert f.reason is not None
            assert f.detail.strip()
            assert f.expected is None


def test_the_total_difference_counts_only_rows_that_were_checked(result) -> None:
    exceptions = [f for f in result.findings if f.outcome is Outcome.EXCEPTION]
    assert result.total_difference == sum((f.difference or Decimal(0)) for f in exceptions)
    assert result.total_difference != 0, "a total of zero would prove nothing"


def test_additional_wages_are_refused_rather_than_reported_as_an_error(result) -> None:
    """The engine is Ordinary Wages only.

    A row with a bonus in it declares CPF on OW AND AW. Comparing that against
    an OW-only figure would report a difference on every such row, and every one
    of those would be FairSlip's error dressed as the employer's. The refusal
    says whose limit it is.
    """
    rows = [f for f in result.findings if f.reason is Reason.ADDITIONAL_WAGES_PRESENT]
    assert rows, "no additional-wages rows found"
    for f in rows:
        assert f.outcome is Outcome.REFUSED
        assert "FairSlip's limit, not CPF Board's" in f.detail


def test_the_engine_refusals_carry_the_engines_own_words(result) -> None:
    """PR graduated years and sub-$750 wages are refused by cpf.py itself, and
    the message an employer reads is the one the engine raised - not a
    paraphrase written here."""
    rows = [f for f in result.findings if f.reason is Reason.ENGINE_REFUSED]
    assert rows, "no engine refusals found"
    joined = " ".join(f.detail for f in rows)
    assert "not encoded in v1" in joined
    assert "at or below $750" in joined


def test_a_missing_column_is_refused_before_any_row_is_checked() -> None:
    """A file that is not this file must fail loudly.

    Checking whatever columns happen to be present would report zero exceptions
    on a file it never understood, which reads exactly like a clean payroll.
    """
    text = build_csv().replace("ordinary_wages", "ow", 1)
    with pytest.raises(ValueError, match="missing columns"):
        check_csv(text)


def test_the_roster_is_deterministic() -> None:
    """Same seed, same file. The demo cannot depend on a roster that differs
    between the rehearsal and the room."""
    assert build_csv() == build_csv()


# ------------------------------------------------------------------ the API


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def test_the_endpoint_returns_the_same_counts_as_the_engine(client, result) -> None:
    """The API must not develop an opinion of its own on the way out."""
    r = client.post("/employer/check", files={"file": ("roster.csv", build_csv(), "text/csv")})
    assert r.status_code == 200
    body = r.json()
    assert body["rows_read"] == result.rows_read
    assert body["exceptions"] == result.exceptions == SEEDED_EXCEPTIONS
    assert body["refused"] == result.refused == SEEDED_REFUSALS
    assert len(body["findings"]) == result.rows_read


def test_the_endpoint_refuses_a_file_that_is_not_this_file(client) -> None:
    bad = build_csv().replace("ordinary_wages", "ow", 1)
    r = client.post("/employer/check", files={"file": ("x.csv", bad, "text/csv")})
    assert r.status_code == 400
    assert "missing columns" in r.json()["detail"]


def test_the_endpoint_refuses_bytes_that_are_not_text(client) -> None:
    r = client.post("/employer/check", files={"file": ("x.csv", bytes([255, 254, 0, 1]), "text/csv")})
    assert r.status_code == 400


def test_the_schema_endpoint_separates_cpf_boards_columns_from_ours(client) -> None:
    """The screen renders these two lists apart. If the endpoint merged them,
    an employer would be told CPF Board asks for a date of birth."""
    s = client.get("/employer/schema").json()
    assert len(s["spec_fields"]) == 10
    assert len(s["extra_fields"]) == 2
    assert {f["csv_name"] for f in s["extra_fields"]} == {"date_of_birth", "residency"}
    for f in s["extra_fields"]:
        assert f["spec_name"] == "(not in the CPF file)"
    for f in s["spec_fields"]:
        assert f["spec_name"] != "(not in the CPF file)"
    assert "16 January 2025" in s["spec_effective"]
    assert "rounded off to the nearest dollar" in s["rounding_a"]
    assert "rounded down to the nearest dollar" in s["rounding_b"]


def test_the_demo_roster_is_downloadable(client) -> None:
    r = client.get("/employer/demo-csv")
    assert r.status_code == 200
    assert r.text.splitlines()[0].startswith("uen,")
    assert len(r.text.splitlines()) == TOTAL_ROWS + 1

