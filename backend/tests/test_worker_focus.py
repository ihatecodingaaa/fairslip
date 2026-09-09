"""Asking one question at a time, without losing a question or a printed page.

TWO CHANGES, TWO DIFFERENT WAYS TO GO WRONG.

FOCUS MODE splits one screen into two views of the same questions. The quiet
failure is a question that exists in one view and not the other: a worker who
stays in the sequence never reaches it, the compute gate says a field is
missing, and the field is nowhere they can see. So both views are drawn from one
list - check/questions.ts - and these tests hold that.

RESULT LENSES put one panel on screen at a time. The quiet failure here is much
worse, because it is invisible in both places it could be noticed. The sheet a
worker prints IS this DOM narrowed; it is the artefact that reaches the person
who can act. A conditional render would make the printed evidence depend on
which tab happened to be open when somebody pressed print - a page missing from
a photocopy, with nothing on the screen to suggest it.

So the panels are hidden with `.screen-collapsed`, which globals.css defines
inside `@media screen` only, and these tests assert that the lenses use it and
never `hidden` or a conditional.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
CHECK = REPO / "frontend" / "app" / "check"

QUESTIONS = CHECK / "questions.ts"
FOCUS = CHECK / "FocusMode.tsx"
ESTABLISH = CHECK / "EstablishStage.tsx"
LENSES = CHECK / "ResultLenses.tsx"
PAGE = CHECK / "page.tsx"
RECONCILE = CHECK / "ReconcileStage.tsx"
GLOBALS = REPO / "frontend" / "app" / "globals.css"


def _strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", "", src)


def source(path: Path) -> str:
    assert path.is_file(), f"{path} does not exist"
    return _strip_comments(path.read_text(encoding="utf-8"))


def declaration(src: str, opening: str) -> str:
    """One top-level declaration, from its own line to the next one.

    NOT A BRACE-MATCHING REGEX. These files annotate return types across several
    lines, which puts a closing brace in column 1 inside the SIGNATURE - so a
    lazy match up to the first such brace slices off the signature alone, and
    every assertion about the body then passes by examining nothing.
    """
    start = src.find(opening)
    assert start >= 0, f"{opening!r} was not found; the file's shape changed"
    after = start + len(opening)
    ends = [
        i
        for i in (
            src.find("\nexport function ", after),
            src.find("\nfunction ", after),
            src.find("\nexport const ", after),
        )
        if i >= 0
    ]
    out = src[start:] if not ends else src[start : min(ends)]
    assert out.count("\n") > 4, f"{opening!r} sliced to almost nothing; the scan is wrong"
    return out


# --------------------------------------------- 1. one list, two views of it


def test_both_views_read_the_same_question_list() -> None:
    est = source(ESTABLISH)
    focus = source(FOCUS)
    assert "askedQuestions" in focus, "focus mode does not use the shared question list"
    assert "askedQuestions" in est, "the establish stage does not use the shared question list"
    assert "from \"./questions\"" in focus and "from \"./questions\"" in est


def test_the_sequence_never_filters_a_question_out_of_the_list() -> None:
    """A view that narrowed the list would be a view with a question the other
    one has and it does not."""
    src = source(FOCUS)
    assert not re.search(r"queue\s*\.\s*filter\(", src), (
        "focus mode filters the shared queue, so its counter and the grid can "
        "disagree about which questions exist"
    )


def test_an_answered_question_stays_in_the_list() -> None:
    """OTHERWISE THE COUNTER COUNTS DOWN INSTEAD OF ALONG. Dropping answered
    questions made the header read "Question 1 of 7", then "1 of 6", then "1 of
    5" - which says how many are left and nothing about progress, and makes Back
    unable to reach an answer in order to change it."""
    src = source(QUESTIONS)
    assert "answered: Boolean(answers[f.name]?.trim())" in src, (
        "questions.ts no longer records whether a question is answered"
    )
    assert "if (answers[f.name]?.trim()) continue;" not in src, (
        "questions.ts drops answered questions from the list again"
    )
    assert "export function unanswered(" in src, (
        "there is no way to ask which questions are still waiting"
    )


def test_a_field_the_readers_settled_was_never_a_question() -> None:
    src = source(QUESTIONS)
    assert "if (isEstablished(f.fact.status)) continue;" in src, (
        "a field both readers agreed on is being asked of the worker"
    )


def test_the_sequence_answers_nothing_by_itself() -> None:
    """Every value that reaches `onAnswer` comes from a control the worker
    operated. A default, a prefill or a "most likely" would be the product
    establishing a fact nobody established."""
    src = source(FOCUS)
    for banned in ("defaultValue", "?? \"8\"", "prefill", "autoAnswer"):
        assert banned not in src, f"focus mode contains {banned!r}"
    calls = re.findall(r"onAnswer\((.*?)\)", src)
    assert calls, "focus mode never calls onAnswer; the scan is not reaching it"
    for call in calls:
        # ONE CLAUSE, NOT TWO. This read `"question.name" in call or "name" in
        # call`, and "name" is a substring of "question.name" - so the second
        # clause subsumed the first and matched any identifier containing
        # "name". The disjunction made the assertion unfalsifiable.
        assert "question.name" in call, (
            f"onAnswer({call}) does not pass the field the worker was asked about"
        )


def test_typing_does_not_advance_and_confirming_does() -> None:
    """Every keystroke in a text field is an `onAnswer`. Advancing on the first
    character would move the question out from under the worker's finger, so the
    advance is wired to the confirm BUTTON, which carries a complete value."""
    est = source(ESTABLISH)
    assert "onConfirmed?: () => void;" in est, (
        "UnsettledField has no confirm-only callback, so a sequence can only "
        "advance on keystrokes"
    )
    confirm = re.search(r"onClick=\{\(\) => \{\s*onAnswer\(v\);\s*onConfirmed\?\.\(\);", est)
    assert confirm, "the confirm button does not fire the confirm-only callback"
    focus = source(FOCUS)
    assert "onConfirmed={() => setCursor(" in focus, (
        "focus mode does not advance when a reading is confirmed"
    )
    # And the text input must not.
    assert "onChange={(e) => onAnswer(e.target.value)}" in est
    assert "onChange={(e) => { onAnswer(e.target.value); onConfirmed" not in est


def test_going_back_is_always_possible_from_anywhere_but_the_first() -> None:
    src = source(FOCUS)
    back = re.search(r"onClick=\{\(\) => setCursor\(Math\.max\(0, at - 1\)\)\}", src)
    assert back, "there is no Back control"
    assert "disabled={at === 0}" in src, (
        "Back is disabled by something other than being at the first question"
    )


def test_the_grid_is_always_reachable_from_the_sequence() -> None:
    src = source(FOCUS)
    assert src.count("onShowAll") >= 2, (
        "there is no way out of the sequence, or only one - it must be offered "
        "both while questions remain and once they are done"
    )


def test_the_sequence_says_why_each_question_is_asked() -> None:
    """One line, from the backend, and the long argument one tap away."""
    src = source(FOCUS)
    assert "why_short" in src, "the sequence asks a question without saying why"
    assert "establish.whyAsk" in src, "the long reason is not reachable"


# ------------------------------------------ 2. the compute gate is unchanged


def test_the_gate_still_reads_the_engine_facing_list() -> None:
    """`unresolvedFields` is the authority on what BLOCKS a calculation, and it
    is a different question from what is being asked - the CPF facts are asked
    and block nothing. The gate must not start reading the wider list."""
    page = source(PAGE)
    assert "unresolvedFields(extract, answers)" in page, (
        "the compute gate no longer reads facts.ts's blocking list"
    )
    assert "askedQuestions" not in page, (
        "the page decides what blocks a calculation from the ASKED list, which "
        "includes the two CPF facts the pay engine never receives"
    )


def test_the_facts_posted_to_the_engine_are_still_payinputsfrom() -> None:
    page = source(PAGE)
    assert "payInputsFrom(extract, answers)" in page, (
        "the page no longer assembles engine inputs through payInputsFrom"
    )
    assert page.count("postCompute(") == 1, "there is more than one path to /compute"


# ------------------------------------------------- 3. the lenses and paper


def test_the_screen_only_class_is_defined_inside_a_screen_media_query() -> None:
    """The whole mechanism rests on this one rule. If `.screen-collapsed` ever
    stops being scoped to `@media screen`, every inactive lens disappears from
    the printed sheet at once, silently."""
    css = GLOBALS.read_text(encoding="utf-8")
    block = re.search(r"@media screen \{(.*?)\n\}", css, re.DOTALL)
    assert block, "there is no @media screen block in globals.css"
    assert ".screen-collapsed" in block.group(1), (
        ".screen-collapsed is not defined inside @media screen, so it hides "
        "content from paper as well as from the screen"
    )


def test_every_lens_panel_is_in_the_dom_whichever_lens_is_selected() -> None:
    """`.screen-collapsed`, never `hidden` and never a conditional render."""
    panel = declaration(source(LENSES), "export function lensPanel(")
    assert "screen-collapsed" in panel, (
        "lensPanel hides an inactive panel with something other than "
        ".screen-collapsed, which would take it off the printed sheet too"
    )
    assert "hidden" not in panel, "lensPanel uses `hidden`, which also hides from print"


@pytest.mark.parametrize("path", [PAGE, RECONCILE], ids=lambda p: p.name)
def test_no_lens_panel_is_conditionally_rendered(path: Path) -> None:
    """`{lens === "trail" && ...}` would remove the arithmetic from the DOM, and
    with it from the sheet a worker carries into an NGO office."""
    src = source(path)
    bad = re.search(r"lens\s*===\s*\"\w+\"\s*&&", src)
    assert not bad, (
        f"{path.name} renders a panel only when its lens is selected: "
        f"{bad.group(0) if bad else ''}. Every panel stays in the DOM; only its "
        f"SCREEN visibility changes."
    )


def test_all_four_panels_exist_and_every_tab_points_at_one() -> None:
    """A tab whose `aria-controls` names nothing is a control that does nothing
    for a screen-reader user and looks fine to everyone else."""
    src = source(LENSES)
    listed = re.search(r"WORKER_LENSES[^=]*=\s*\[(.*?)\n\];", src, re.DOTALL)
    assert listed, "WORKER_LENSES was not found"
    ids = re.findall(r'id:\s*"(\w+)"', listed.group(1))
    assert set(ids) == {"summary", "trail", "evidence", "next"}, ids

    rendered = source(PAGE) + source(RECONCILE)
    for lens in ids:
        assert f'lensPanel("{lens}"' in rendered, (
            f"the {lens} tab has no panel; its aria-controls points at nothing"
        )


def test_the_lens_ids_come_from_one_place() -> None:
    """The four panels are rendered by three different components. A prefix
    generated per component - or typed twice - is a tab pointing at nothing."""
    src = source(LENSES)
    assert "export const tabId" in src and "export const panelId" in src
    for path in (PAGE, RECONCILE):
        body = source(path)
        assert "worker-lens-panel-" not in body, (
            f"{path.name} writes a panel id by hand instead of using panelId()"
        )


def test_the_lens_bar_is_hidden_from_paper() -> None:
    """Tabs are a screen control. On paper every panel is printed in order, so a
    row of tabs would be a navigation for a document that has none."""
    src = source(LENSES)
    bar = re.search(r"role=\"tablist\"(.*?)>", src, re.DOTALL)
    assert bar, "the tablist was not found"
    assert "print-hide" in src[: src.index('role="tablist"') + 400], (
        "the lens bar prints"
    )


def test_the_lens_bar_is_a_real_tablist() -> None:
    src = source(LENSES)
    assert 'role="tablist"' in src
    assert 'role="tab"' in src
    assert 'role: "tabpanel"' in src
    assert "aria-selected={on}" in src
    assert "tabIndex={on ? 0 : -1}" in src, (
        "the tabs are not a roving tab stop, so a keyboard user walks through "
        "all four to leave the bar"
    )
    assert "ArrowRight" in src and "ArrowLeft" in src, "the tabs have no arrow-key navigation"


def test_a_new_calculation_returns_the_reader_to_the_answer() -> None:
    """A worker who was reading the evidence, changes a fact and recomputes
    should land on the new figure, not on the panel they happened to leave."""
    src = source(PAGE)
    assert src.count('setLens("summary")') >= 2, (
        "the lens is not reset when a new reading or a new calculation arrives"
    )
