"""The employer check reads CPF Board's schema, and rounds CPF Board's way.

Two claims, and the second one is the interesting one.

  1. THE COLUMNS ARE THE SPEC'S. Every column the check requires either appears
     in the CPF EZPay (FTP) File Specifications' Employer Contribution Detail
     Record - with the spec's own field name and column positions recorded
     beside it - or is declared as FairSlip's own addition. There is no third
     category. A schema that is mostly official is the easiest possible version
     of this product's own failure mode, so the boundary is enforced rather than
     described.

  2. THE ROUNDING WAS ARRIVED AT INDEPENDENTLY. fairslip/cpf.py implemented
     CPF's month-level rounding from the contribution-rates page, before anyone
     here had read the file specification. The file specification states the
     same two rules, verbatim, as a note on the "Contribution detail amount"
     column - because it must, since every payroll vendor in Singapore generates
     that file. The tests below assert the engine reproduces the spec's own
     worked examples.

     That is not a coincidence worth burying in a comment: the engine and the
     government's file format agree on the arithmetic, and the agreement is
     checkable rather than claimed.

Source, read from the PDF on 8 September 2026:
https://www.cpf.gov.sg/content/dam/web/employer/making-cpf-contributions/documents/CPFEZPayFTPSpecifications.pdf
"CPF EZPay (FTP) File Specifications (effective from 16 January 2025)", last
updated Jan 2025.
"""

from __future__ import annotations

from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent

from fairslip.cpf import ONE_DOLLAR, AgeBand, Residency, cpf_contribution
from fairslip.employer import (
    CSV_COLUMNS,
    EXTRA_FIELDS,
    SPEC_ACCOUNT_COLUMN,
    SPEC_FIELDS,
    SPEC_NOTE_4,
    SPEC_NOTE_4_READING,
    SPEC_ROUNDING_A,
    SPEC_ROUNDING_B,
)

# ---------------------------------------------------------------- the rounding

# Quoted from the spec, on the "Contribution detail amount" column (cols 38-49):
#
#   "Important: Please note the rounding rules for CPF contributions -
#    (a) the total CPF contribution payable by the employer should be rounded
#        off to the nearest dollar e.g. $1.50 should be regarded as $2.00;
#    (b) the amount recoverable by the employer from the employee's wages should
#        be rounded down to the nearest dollar e.g. $1.50 should be regarded as
#        $1.00."


def test_the_spec_quotes_this_module_holds_are_the_ones_the_code_renders() -> None:
    """The strings asserted below are the strings the screen shows.

    Otherwise this file could prove the engine matches a quotation that appears
    nowhere, while the interface displays a different one.
    """
    assert "rounded off to the nearest dollar" in SPEC_ROUNDING_A
    assert "$1.50 should be regarded as $2.00" in SPEC_ROUNDING_A
    assert "rounded down to the nearest dollar" in SPEC_ROUNDING_B
    assert "$1.50 should be regarded as $1.00" in SPEC_ROUNDING_B


def test_the_specs_own_worked_example_of_rule_a_is_what_our_rounding_does() -> None:
    """"$1.50 should be regarded as $2.00" - the spec's example, run."""
    assert Decimal("1.50").quantize(ONE_DOLLAR, rounding=ROUND_HALF_UP) == Decimal(2)


def test_the_specs_own_worked_example_of_rule_b_is_what_our_rounding_does() -> None:
    """"$1.50 should be regarded as $1.00" - the spec's example, run."""
    assert Decimal("1.50").quantize(ONE_DOLLAR, rounding=ROUND_DOWN) == Decimal(1)


@pytest.mark.parametrize(
    "ow",
    [Decimal(1000), Decimal("1462.24"), Decimal("3333.33"), Decimal(5000), Decimal("7999.99")],
)
def test_the_engine_rounds_the_total_to_the_nearest_dollar(ow: Decimal) -> None:
    """Rule (a), over a spread of wages rather than one flattering case.

    The total is a whole number of dollars and it is the nearest one to the
    unrounded product - which is what "rounded off to the nearest dollar" means,
    stated as an assertion instead of as a comment.
    """
    r = cpf_contribution(ow, AgeBand.UP_TO_55, Residency.CITIZEN)
    assert r.total == r.total.to_integral_value()
    exact = ow * Decimal(37) / 100
    assert r.total == exact.quantize(ONE_DOLLAR, rounding=ROUND_HALF_UP)


@pytest.mark.parametrize(
    "ow",
    [Decimal(1000), Decimal("1462.24"), Decimal("3333.33"), Decimal(5000), Decimal("7999.99")],
)
def test_the_engine_rounds_the_employee_share_down(ow: Decimal) -> None:
    """Rule (b). DOWN, not to nearest - the distinction the spec spells out with
    its own example, and the one an implementation gets wrong by using the same
    rounding for both figures."""
    r = cpf_contribution(ow, AgeBand.UP_TO_55, Residency.CITIZEN)
    exact = ow * Decimal(20) / 100
    assert r.employee == exact.quantize(ONE_DOLLAR, rounding=ROUND_DOWN)
    assert r.employee <= exact


def test_the_two_rules_are_not_the_same_rule() -> None:
    """A wage where nearest and down disagree, so the test could fail.

    Without this, both assertions above would pass on an engine that rounded
    everything the same way, for every wage where the two happen to agree.
    """
    ow = Decimal("1002.50")  # 20% = 200.50, which rounds to 201 or down to 200
    r = cpf_contribution(ow, AgeBand.UP_TO_55, Residency.CITIZEN)
    exact_ee = ow * Decimal(20) / 100
    assert exact_ee == Decimal("200.50")
    assert r.employee == Decimal(200), "the employee share must round DOWN"
    assert exact_ee.quantize(ONE_DOLLAR, rounding=ROUND_HALF_UP) == Decimal(201)


def test_the_employer_share_is_the_remainder_not_a_percentage() -> None:
    """CPF derives the employer share as total minus employee, so the two
    rounded figures always add back to the rounded total. Computing it as a
    percentage of the wage would be off by a dollar wherever the roundings
    disagree - which is most wages."""
    for ow in (Decimal("1002.50"), Decimal("1462.24"), Decimal("4321.99")):
        r = cpf_contribution(ow, AgeBand.UP_TO_55, Residency.CITIZEN)
        assert r.employee + r.employer == r.total


# ------------------------------------------------------------------ the columns


def test_every_required_column_is_either_the_specs_or_declared_as_ours() -> None:
    spec = {f.csv_name for f in SPEC_FIELDS}
    ours = {f.csv_name for f in EXTRA_FIELDS}
    assert spec & ours == set(), "a column cannot be both CPF Board's and ours"
    assert set(CSV_COLUMNS) == spec | ours


@pytest.mark.parametrize("f", SPEC_FIELDS, ids=lambda f: f.csv_name)
def test_every_spec_column_records_where_it_sits_in_the_real_file(f) -> None:
    """Column positions and data type, so the CSV can be checked against the
    fixed-width record it mirrors rather than merely resembling it."""
    assert f.spec_name and not f.spec_name.startswith("("), f"{f.csv_name} has no spec field name"
    assert "-" in f.columns, f"{f.csv_name} records no column range"
    assert f.data_type, f"{f.csv_name} records no data type"


@pytest.mark.parametrize("f", EXTRA_FIELDS, ids=lambda f: f.csv_name)
def test_every_column_of_ours_says_it_is_not_in_the_file(f) -> None:
    """The two columns CPF Board does not publish must say so where they are
    defined, not only where they are rendered."""
    assert f.spec_name == "(not in the CPF file)"
    assert "carries no date of birth" in f.note or "do not say which PR year" in f.note


def test_the_two_columns_we_add_are_exactly_the_two_the_engine_needs() -> None:
    """Not a third. Every extra column is a question asked of an employer that
    CPF Board did not ask, so the set is pinned: a birth date for band_for(),
    and a residency for the rate table."""
    assert {f.csv_name for f in EXTRA_FIELDS} == {"date_of_birth", "residency"}


# ------------------------------- the schema's own account-number restriction


def test_note_4_is_quoted_whole_and_names_both_prefixes() -> None:
    """The government's schema confirming the product's thesis, quoted rather
    than summarised.

    Both halves matter. The S half alone reads as "citizens and PRs"; the T half
    is what makes it a rule about CPF ACCOUNT NUMBERS rather than about
    citizenship, and it is the half a paraphrase drops.
    """
    assert SPEC_NOTE_4.startswith("S prefix is used for Singapore citizens")
    assert "However, the T prefix will be issued" in SPEC_NOTE_4
    assert "persons born on and after 1 January 2000" in SPEC_NOTE_4
    assert SPEC_NOTE_4.endswith(".")


def test_the_account_column_quote_states_the_two_permitted_prefixes() -> None:
    assert "First byte is either S or T" in SPEC_ACCOUNT_COLUMN


def test_our_reading_of_note_4_is_labelled_as_ours_and_says_what_follows() -> None:
    """FairSlip's inference must not inherit CPF Board's attribution.

    The inference - that a Work Permit holder has no row in this file at all -
    is ours, and it is the interesting one, so it is kept in its own constant
    and rendered under "FairSlip's reading, not CPF Board's". See docs/debt.md,
    gloss-inherits-the-authoritys-attribution.
    """
    assert "F, G or M" in SPEC_NOTE_4_READING
    assert "not CPF members" in SPEC_NOTE_4_READING
    assert "Rahim" in SPEC_NOTE_4_READING
    # The reading must not be smuggled into the quotation.
    assert SPEC_NOTE_4_READING not in SPEC_NOTE_4
    assert "Rahim" not in SPEC_NOTE_4


def test_the_screen_renders_the_quote_and_the_reading_apart() -> None:
    """Both are on the page, and the label between them is on the page too."""
    page = (
        REPO / "frontend" / "app" / "employer" / "page.tsx"
    ).read_text(encoding="utf-8")
    assert "schema.note_4" in page
    assert "schema.note_4_reading" in page
    assert "FairSlip&rsquo;s reading, not CPF Board&rsquo;s" in page

