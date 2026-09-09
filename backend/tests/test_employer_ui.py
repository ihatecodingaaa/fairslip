"""What the payroll X-ray may draw, and what it may not claim.

THE RISK THIS PASS INTRODUCED. The employer screen used to be a summary and
three lists: a list can misrank a payroll but it cannot misstate one. It is now
four visualisations, and a chart is a claim made in a form that is hard to
check - a bar can be the wrong length, a row can be silently missing from a
picture, and a filter can quietly turn "300 rows" into "the eleven I am showing
you". None of those is visible in a screenshot.

So the rules the pictures run on are asserted from their source, in the same
house pattern as tests/test_inclusion.py and tests/test_design_tokens.py:

  1. EVERY ROW IS DRAWN. Both the grid and the skyline map over the whole
     findings array, and the reason filter changes emphasis rather than
     membership. A row that leaves a picture when a filter is applied is a row
     an employer stops being able to see.

  2. REFUSED ROWS ARE DRAWN, AND NOT AT ZERO. The skyline gives them their own
     lane. Putting them on the zero line would draw a row nobody computed as a
     row that came out level, which is this product's own failure mode.

  3. THE SIGN SURVIVES. Magnitude is taken for bar LENGTH and for nothing else.

  4. THE MONEY IS THE BACKEND'S. Per-reason totals are ReasonAggregate fields;
     nothing sums findings in the browser.

  5. NOTHING IS CERTIFIED. No compliance percentage, no health score, no
     "approved", no "money saved" - on any employer surface.

Python reading TypeScript is a text scan, and a text scan is the right tool for
a rule about what may appear in a file.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from fairslip.employer import Reason, RecheckState

REPO = Path(__file__).resolve().parent.parent.parent
EMPLOYER = REPO / "frontend" / "app" / "employer"

CONSTELLATION = EMPLOYER / "PayrollConstellation.tsx"
SKYLINE = EMPLOYER / "VarianceSkyline.tsx"
REASON_BARS = EMPLOYER / "ReasonBars.tsx"
REASONS_MAP = EMPLOYER / "reasons.ts"
PAGE = EMPLOYER / "page.tsx"


def _strip_comments(src: str) -> str:
    """Read the code, not the prose about it.

    Same reason as test_charts.py's version: several assertions below look for
    the ABSENCE of a string, and the header comments in these files discuss most
    of them by name. A test that fails on its own explanation teaches people to
    delete the explanation.
    """
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", "", src)


def source(path: Path) -> str:
    assert path.is_file(), f"{path} does not exist"
    return _strip_comments(path.read_text(encoding="utf-8"))


def employer_sources() -> dict[Path, str]:
    """Every file that draws part of the X-ray. Globbed, so a new lens is
    covered the day it is added rather than the day someone remembers."""
    found = {p: source(p) for p in sorted(EMPLOYER.rglob("*.ts*"))}
    assert len(found) >= 5, f"only {sorted(p.name for p in found)}; the scan is not reaching the app"
    return found


# ------------------------------------------ 1. every row reaches every picture


@pytest.mark.parametrize("path", [CONSTELLATION, SKYLINE], ids=lambda p: p.name)
def test_the_picture_is_drawn_from_every_finding_it_was_given(path: Path) -> None:
    """`findings.map` - not `findings.filter(...).map`.

    The summary above these says 300 rows. A picture that drew a subset would be
    a different claim in the same viewport, and the two are read together.
    """
    src = source(path)
    assert re.search(r"findings\s*\.\s*map\(", src) or re.search(
        r"rows\s*=\s*useMemo\(\s*\(\)\s*=>\s*\{\s*const copy = findings\.map", src
    ), f"{path.name} does not map over the whole findings array"
    assert not re.search(r"findings\s*\.\s*filter\([^)]*\)\s*\.\s*map\(", src), (
        f"{path.name} draws a filtered array. Every row in the file is a mark; a "
        f"filter changes emphasis, never membership."
    )


@pytest.mark.parametrize("path", [CONSTELLATION, SKYLINE], ids=lambda p: p.name)
def test_the_reason_filter_only_dims(path: Path) -> None:
    """`filterReason` may decide how a mark LOOKS and never whether it exists."""
    src = source(path)
    assert "filterReason" in src, f"{path.name} does not consult the reason filter at all"
    for line in src.splitlines():
        if "filterReason" not in line:
            continue
        assert not re.search(r"\.filter\(|return null|continue;", line), (
            f"{path.name}: `{line.strip()}` uses the reason filter to remove a row "
            f"rather than to de-emphasise it."
        )


def test_the_skyline_draws_refused_rows_in_their_own_lane() -> None:
    """A refused row is present, and it is NOT on the zero line.

    The lane's own label is a dictionary key, so what it says is translated and
    is asserted for orphans by test_inclusion.py alongside every other string.
    """
    src = source(SKYLINE)
    assert 'f.outcome === "REFUSED"' in src, "the skyline has no branch for a refused row"
    assert "laneY" in src, "the skyline has no separate lane for refused rows"
    assert "employer.skylineLane" in src, "the refused lane is unlabelled"
    # The lane starts BELOW the negative half, and the gap between them is not
    # zero. Both halves of that are asserted: an offset of `axisY + negH + 0`
    # would satisfy the first and put the diamonds against the lowest bar.
    assert re.search(r"laneY\s*=\s*axisY\s*\+\s*negH\s*\+\s*PLOT\.gap", src), (
        "the refused lane is not offset from the zero axis by the full negative "
        "half plus a gap; a refused row drawn at or near zero reads as a row that "
        "was checked and came out level"
    )
    assert re.search(r"gap:\s*([1-9]\d*)", src), "PLOT.gap is zero, so the lane touches the plot"


# --------------------------------------------------- 2. the sign is not thrown


def test_magnitude_is_taken_for_geometry_and_nowhere_else() -> None:
    """Math.abs may only appear inside the helper that names what it is for.

    Everywhere else it would be a signed finding rendered as an unsigned one -
    "$340" where the truth is "$340 less than the rules give".
    """
    for path, src in employer_sources().items():
        for i, line in enumerate(src.splitlines(), start=1):
            if "Math.abs" not in line:
                continue
            assert "magnitude" in _enclosing_function(src, i), (
                f"{path.name}:{i} takes an absolute value outside magnitude(). A "
                f"sign dropped here is a direction the employer is not told."
            )


def _enclosing_function(src: str, line_no: int) -> str:
    """The nearest `function NAME` at or above a line. Crude and sufficient: the
    only question is which helper an absolute value sits in."""
    names = [
        m.group(1)
        for m in re.finditer(r"function\s+(\w+)", src)
        if src[: m.start()].count("\n") + 1 <= line_no
    ]
    return names[-1] if names else ""


# ------------------------------------------- 3. the reason words are complete


def _reason_word_keys() -> dict[str, str]:
    block = re.search(
        r"export const REASON_WORDS[^{]*\{(.*?)\};", source(REASONS_MAP), re.DOTALL
    )
    assert block, "REASON_WORDS was not found in app/employer/reasons.ts"
    pairs = re.findall(r"(\w+):\s*\"([^\"]+)\"", block.group(1))
    assert pairs, "REASON_WORDS parsed to nothing; its shape changed"
    return dict(pairs)


@pytest.mark.parametrize("reason", [r.value for r in Reason])
def test_every_reason_the_engine_can_produce_has_words(reason: str) -> None:
    """DERIVED FROM THE ENUM, not from a list retyped here.

    A reason code that reaches a screen with no sentence for it renders as the
    raw enum, which is the product telling an employer to go and look it up.
    """
    assert reason in _reason_word_keys(), (
        f"{reason} is a Reason the engine can return and app/employer/reasons.ts "
        f"has no words for it."
    )


def test_no_words_exist_for_a_reason_the_engine_cannot_produce() -> None:
    """The other direction: a translated sentence nothing can ever render."""
    allowed = {r.value for r in Reason}
    stray = sorted(set(_reason_word_keys()) - allowed)
    assert not stray, f"app/employer/reasons.ts has words for non-reasons: {stray}"


def test_the_reason_words_live_in_one_place() -> None:
    """Four surfaces read this map. Two copies of it would eventually disagree,
    and a payroll report whose sentence for a code differs from the screen's is
    two accounts of one finding."""
    for path, src in employer_sources().items():
        if path == REASONS_MAP:
            continue
        assert "AMOUNT_MISMATCH:" not in src, (
            f"{path.name} declares its own reason wording. There is one map, in "
            f"app/employer/reasons.ts."
        )


# --------------------------------------- 4. the per-reason money is the engine's


def test_the_reason_bars_render_the_engines_own_total() -> None:
    src = source(REASON_BARS)
    assert "signed_difference_total" in src
    assert "checked_rows" in src, (
        "ReasonBars does not consult checked_rows, so it cannot tell a reason "
        "that refused every row from one whose rows summed to zero"
    )


def test_nothing_sums_money_across_reasons_or_rows() -> None:
    """The headline, the bridge and the per-reason totals are all engine fields.

    A `reduce` that accumulated `difference` would be a second source of truth
    about the same payroll, agreeing with the backend right up until a filter or
    a sort differed.
    """
    for path, src in employer_sources().items():
        for i, line in enumerate(src.splitlines(), start=1):
            if not re.search(r"\breduce\(", line):
                continue
            # Bar SCALE may be reduced over - it is geometry. A money field may not.
            assert "Math.max" in line, (
                f"{path.name}:{i}: `{line.strip()}` accumulates across rows. Only a "
                f"maximum, for a bar's scale, may be derived here - a sum of money "
                f"is the engine's."
            )


# -------------------------------------------------- 5. nothing is certified


FORBIDDEN = [
    (r"\bcompliant\b", "a compliance claim"),
    (r"\bcompliance\s+(score|rate|percentage)\b", "a compliance score"),
    (r"\bcertified\b", "a certification"),
    (r"\bcertificate\b", "a certificate"),
    (r"\bpayroll\s+health\b", "a health score"),
    (r"\brisk\s+score\b", "a risk score"),
    (r"\bmoney\s+saved\b", "a saving nobody has made"),
    (r"\bwage\s+theft\b", "an accusation the engine cannot establish"),
    (r"\bapproved\s+payroll\b", "an approval"),
    (r"\bunderpaid\b", "a word the copy contract forbids"),
    (r"\bowed\b", "a word the copy contract forbids"),
]


@pytest.mark.parametrize("pattern,what", FORBIDDEN, ids=[w for _, w in FORBIDDEN])
def test_no_employer_surface_makes_a_claim_the_engine_cannot_support(
    pattern: str, what: str
) -> None:
    for path, src in employer_sources().items():
        hit = re.search(pattern, src, re.IGNORECASE)
        assert not hit, f"{path.name} contains {what}: {hit.group(0)!r}"


def test_no_percentage_is_rendered_beside_a_payroll_outcome() -> None:
    """A percent SIGN in a template literal that reaches the screen.

    Bar widths are percentages of a container and are style values; a percentage
    in text would be a coverage or compliance figure, and the engine computes
    neither.
    """
    # ` % ` is the modulo operator, which the lens tabs use to wrap around. A
    # percentage the reader SEES is a percent sign hard against what precedes it.
    percent_sign = re.compile(r"(?<! )%")
    for path, src in employer_sources().items():
        for i, line in enumerate(src.splitlines(), start=1):
            if not percent_sign.search(line):
                continue
            assert "width" in line or "style" in line or "moneyWidth" in line, (
                f"{path.name}:{i}: `{line.strip()}` puts a percentage somewhere other "
                f"than a bar's width."
            )


def test_the_coverage_counts_are_on_the_screen_with_the_headline() -> None:
    """The headline figure is a claim about the CHECKED rows. What makes it a
    true claim rather than a claim about the payroll is the four counts beside
    it, and they are in the same block."""
    src = source(PAGE)
    # NOT a brace match. This file destructures its props across lines, so the
    # parameter list's own `}` sits in column 1 and every brace-counting regex
    # stops there - which is how the first version of this test passed a
    # five-line slice and proved nothing. From the declaration to the next
    # top-level declaration is unambiguous.
    hero = _declaration(src, "function XRayHero(")
    for field in ("rows_read", "checked", "exceptions", "refused"):
        assert f"result.{field}" in hero, (
            f"the hero shows the headline difference without {field}. Coverage is "
            f"not a detail below it - it is what the headline means."
        )


def _declaration(src: str, opening: str) -> str:
    """One top-level declaration, from its own line to the next one.

    Used instead of a brace-matching regex because this codebase destructures
    props across lines, which puts a `}` in column 1 inside the parameter list.
    """
    start = src.find(opening)
    assert start >= 0, f"{opening!r} was not found; the file's shape changed"
    rest = src.find("\nfunction ", start + len(opening))
    slice_ = src[start:] if rest < 0 else src[start:rest]
    assert slice_.count("\n") > 5, f"{opening!r} sliced to {slice_.count('n')} lines; the scan is wrong"
    return slice_


# ==================================================== 6. the second run's screen
#
# The comparison is the load-bearing judgement in the whole feature: deciding
# which row of the second file is which employee. It is made once, in
# fairslip/employer.recheck(), on the CPF account number. These hold the screen
# to reading that answer rather than reaching its own.

RECHECK = EMPLOYER / "RecheckView.tsx"
OUTCOME_MARK = EMPLOYER / "outcomeMark.tsx"


def _state_word_keys() -> dict[str, str]:
    block = re.search(
        r"const STATE_WORDS: Record<RecheckState, Key> = \{(.*?)\};",
        source(RECHECK),
        re.DOTALL,
    )
    assert block, "STATE_WORDS was not found in RecheckView.tsx"
    pairs = re.findall(r"(\w+):\s*\"([^\"]+)\"", block.group(1))
    assert pairs, "STATE_WORDS parsed to nothing; its shape changed"
    return dict(pairs)


@pytest.mark.parametrize("state", [s.value for s in RecheckState])
def test_every_recheck_state_has_words(state: str) -> None:
    """DERIVED FROM THE ENUM. A state with no sentence renders as a raw code on
    the one screen an employer reads to find out whether their fix worked."""
    assert state in _state_word_keys(), (
        f"{state} is a RecheckState the engine can return and RecheckView.tsx has "
        f"no words for it."
    )


def test_no_words_exist_for_a_state_the_engine_cannot_produce() -> None:
    allowed = {s.value for s in RecheckState}
    stray = sorted(set(_state_word_keys()) - allowed)
    assert not stray, f"RecheckView.tsx has words for non-states: {stray}"


def test_every_state_reaches_the_screen() -> None:
    """ORDER is what the screen iterates. A state missing from it is a category
    that renders as nothing rather than as zero - and "0 new exceptions" is a
    finding an employer wants to read."""
    block = re.search(r"const ORDER: RecheckState\[\] = \[(.*?)\];", source(RECHECK), re.DOTALL)
    assert block, "ORDER was not found in RecheckView.tsx"
    listed = set(re.findall(r"\"(\w+)\"", block.group(1)))
    assert listed == {s.value for s in RecheckState}, (
        f"ORDER does not cover every state: missing "
        f"{sorted({s.value for s in RecheckState} - listed)}"
    )


def test_the_screen_does_not_decide_what_resolved_means() -> None:
    """NO STATE IS DERIVED IN THE BROWSER.

    Comparing `before_outcome` with `after_outcome` to work out what happened
    would be a second source of truth about the comparison - and the browser has
    no way to know which employee a row is, which is the part that matters.
    """
    src = source(RECHECK)
    forbidden = re.compile(
        r"before_outcome\s*(?:===|!==|==|!=)\s*.*after_outcome"
        r"|after_outcome\s*(?:===|!==|==|!=)\s*.*before_outcome"
    )
    assert not forbidden.search(src), (
        "RecheckView compares the two outcomes to derive a state. The state is "
        "fairslip/employer.state_for()'s, and it ships on every row."
    )
    assert "r.state" in src or "row.state" in src, (
        "RecheckView never reads the state the backend sent, so it is deciding "
        "something for itself"
    )


def test_the_screen_does_not_subtract_the_two_headline_totals() -> None:
    """`after_difference - before_difference` spans two DIFFERENT sets of rows
    whenever a row was refused in one run and checked in the other. The engine
    ships `both_change` over the rows checked in both, and that is the only
    subtraction anyone may show."""
    src = source(RECHECK)
    assert not re.search(r"after_difference\s*-\s*", src)
    assert not re.search(r"before_difference\s*-\s*", src)


def test_the_comparison_sentence_names_the_rows_it_compares_over() -> None:
    """A before/after figure with no row count beside it is a claim about a
    payroll rather than about a set of rows."""
    src = source(RECHECK)
    assert "rows_checked_in_both" in src, (
        "the screen shows a before/after amount without saying how many rows it "
        "is measured over"
    )
    assert "both_before" in src and "both_after" in src


def test_both_grids_are_drawn_from_the_one_row_list() -> None:
    """THE POSITION IS THE COMPARISON. The two grids are the same array rendered
    twice, so the mark at index i on the left and the mark at index i on the
    right are the same employee - which is the thing two screenshots cannot do.
    Two separate arrays would break that silently and look identical."""
    src = source(RECHECK)
    grids = _declaration(src, "function RowGrids(")
    assert "rows.map(" in grids, "the grids do not map over the shared row list"
    assert grids.count("rows.map(") == 1, (
        "the grids map over more than one array; the same employee is then not "
        "guaranteed to be at the same index in both"
    )


def test_a_row_missing_from_a_file_is_not_drawn_as_not_checked() -> None:
    """An employee who has left the payroll was not refused - they were not
    there. Reusing the "not checked" diamond would make a leaver and a row the
    engine declined to compute the same picture."""
    src = source(OUTCOME_MARK)
    assert "ABSENT" in src, "there is no mark for a row that is not in the file"
    assert "recheck.absentFromFile" in src, "the absent mark is unlabelled"
    absent = re.search(r"export const ABSENT = \{(.*?)\};", src, re.DOTALL)
    assert absent, "ABSENT was not found"
    assert "M8 2.4L13.6 8" not in absent.group(1), (
        "the absent mark reuses the REFUSED diamond's path"
    )


def test_the_glyphs_have_one_owner() -> None:
    """Four surfaces draw them. A recheck whose "after" triangle means something
    other than its "before" one is a comparison between two vocabularies."""
    for path, src in employer_sources().items():
        if path == OUTCOME_MARK:
            continue
        assert not re.search(r"^const MARK\b", src, re.MULTILINE), (
            f"{path.name} declares its own glyph table. There is one, in outcomeMark.tsx."
        )


RECHECK_FORBIDDEN = [
    (r"\bsaved\b", "a saving nobody has made"),
    (r"\brecovered\b", "a recovery nobody has made"),
    (r"\bfixed by fairslip\b", "a repair FairSlip did not perform"),
]


@pytest.mark.parametrize("pattern,what", RECHECK_FORBIDDEN, ids=[w for _, w in RECHECK_FORBIDDEN])
def test_the_comparison_claims_no_money_changed_hands(pattern: str, what: str) -> None:
    """The employer may not have paid anything. What moved is a difference
    between what two files declared and what the published rules give."""
    for path, src in employer_sources().items():
        hit = re.search(pattern, src, re.IGNORECASE)
        assert not hit, f"{path.name} contains {what}: {hit.group(0)!r}"


def test_the_word_resolved_is_a_state_name_and_never_the_copy() -> None:
    """The dictionary decides what a state is CALLED, and `recheck.RESOLVED`
    reads "now matches". The enum name may appear as an identifier; the sentence
    an employer reads may not claim a resolution."""
    i18n = (REPO / "frontend" / "lib" / "i18n.ts").read_text(encoding="utf-8")
    line = re.search(r'"recheck\.RESOLVED":\s*"([^"]*)"', i18n)
    assert line, "recheck.RESOLVED has no English string"
    assert "resolv" not in line.group(1).lower(), (
        f"recheck.RESOLVED reads {line.group(1)!r}. The copy contract reserves "
        f"'resolved' for arithmetic that closes."
    )
