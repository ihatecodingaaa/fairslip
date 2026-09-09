"""An answer edited after the engine ran must not leave the old figures unmarked.

The evidence on /check stays live after the reconciliation is on screen - that is
deliberate, and `computedFrom` already protects the half of it that matters most:
the trail is drawn from the facts that actually produced the breakdown, so a
later edit cannot become the lineage of a figure it never touched.

That freezes the trail. It does not stop the SCREEN from contradicting itself.
Observed in the running product before this module existed: type 1120.00 into
"what actually reached your bank" after computing, and the arithmetic above still
read "Reached the bank $1,400.00" - two different months on one page, with
nothing saying which one the figures belonged to and no way to re-run the engine,
because the compute gate had been removed the moment a breakdown existed.

That is the governing rule's own failure mode: a screen asserting a month the
system did not establish. So three things are checked here, and all three are
properties of the source rather than of anyone's memory of it:

  1. THE GATE COMES BACK. Its render condition is not `!breakdown` alone.
  2. THE FLAG IS DERIVED, not set by hand: the live PayInputs are compared
     against the frozen ones, which is the only comparison that can be true for
     the right reason.
  3. THE NOTICE IS ON PAPER. It sits in the printed answer section, not in the
     screen-only trail and not behind print-hide - a sheet carried into an NGO
     office is the worst place for the caveat to be the part left behind.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
CHECK_PAGE = REPO / "frontend" / "app" / "check" / "page.tsx"
RECONCILE = REPO / "frontend" / "app" / "check" / "ReconcileStage.tsx"
I18N_TS = REPO / "frontend" / "lib" / "i18n.ts"


def page_source() -> str:
    assert CHECK_PAGE.exists(), f"{CHECK_PAGE} does not exist"
    return CHECK_PAGE.read_text(encoding="utf-8")


def reconcile_source() -> str:
    assert RECONCILE.exists(), f"{RECONCILE} does not exist"
    return RECONCILE.read_text(encoding="utf-8")


# ------------------------------------------------------------ 1. the gate returns


def _compute_gate_guard() -> str:
    """The JSX condition that decides whether <ComputeGate> is rendered."""
    src = page_source()
    m = re.search(r"\{([^\n{}]*?)&&\s*\(\s*\n\s*<div className=\"print-hide\">\s*\n\s*<ComputeGate", src)
    assert m, "the <ComputeGate> render guard was not found in app/check/page.tsx"
    return m.group(1).strip()


def test_the_compute_gate_is_reachable_again_after_an_answer_is_edited() -> None:
    guard = _compute_gate_guard()
    assert guard != "!breakdown ", guard
    assert "!breakdown" in guard, (
        f"the gate guard no longer mentions the missing breakdown at all: {guard!r}"
    )
    assert "edited" in guard, (
        "the compute gate is rendered only while no breakdown exists, so an answer "
        f"edited afterwards can never be recomputed. Guard: {guard!r}"
    )


def test_the_gate_says_the_figures_are_the_earlier_ones() -> None:
    """A gate that reappears silently is a button whose reason is invisible."""
    src = page_source()
    assert 'stale={edited}' in src, "the gate is not told that it is standing in for stale figures"
    assert '<T k="gate.stale" />' in src, "the gate reappears without saying why"


# ------------------------------------------------- 2. the flag is derived, not set


def test_the_drift_is_measured_against_the_frozen_inputs() -> None:
    """`computedFrom` is what produced the figures. Comparing against anything
    else - a counter, a dirty bit, the raw answers - can be true when nothing a
    figure depends on has moved, and false when something has."""
    src = page_source()
    m = re.search(r"const edited = useMemo\(\(\) => \{(.*?)\}, \[(.*?)\]\);", src, re.DOTALL)
    assert m, "no derived `edited` memo found in app/check/page.tsx"
    body, deps = m.group(1), m.group(2)
    assert "payInputsFrom(extract, answers)" in body, (
        "the comparison does not build the live PayInputs, so it is comparing "
        f"something other than what /compute would be sent: {body.strip()!r}"
    )
    assert "computedFrom" in body, (
        f"the comparison does not reach the frozen inputs: {body.strip()!r}"
    )
    for dep in ("extract", "answers", "computedFrom"):
        assert dep in deps, f"`edited` does not depend on {dep}; it can go stale itself"


def test_no_hand_set_dirty_flag_shadows_the_derived_one() -> None:
    """The failure this replaces: a boolean somebody remembers to set. Every
    edit path would have to set it, and the one that forgot is the bug."""
    src = page_source()
    for bad in ("setEdited", "setDirty", "setStale"):
        assert bad not in src, (
            f"{bad}() exists in app/check/page.tsx: whether the figures are stale is a "
            "comparison, not a flag anyone can forget to raise"
        )


# --------------------------------------------------- 3. the notice reaches paper


def test_the_stale_notice_is_in_the_printed_answer_and_not_in_the_screen_only_trail() -> None:
    src = reconcile_source()
    notice = src.find('<T k="result.stale" />')
    assert notice != -1, "ReconcileStage does not render the stale notice"
    screen_only = src.find('<ScreenOnly id="money-trail">')
    assert screen_only != -1, "the screen-only trail was not found; this test is not reading what it thinks"
    assert notice < screen_only, (
        "the stale notice sits inside (or after) the screen-only trail, so the "
        "printed sheet carries the figures without the sentence that qualifies them"
    )


def test_the_stale_notice_is_not_print_hidden() -> None:
    """The block that renders it must not be inside a print-hide region."""
    src = reconcile_source()
    m = re.search(r"\{stale && \(\s*\n\s*<p className=\"([^\"]+)\"", src)
    assert m, "the stale notice is not rendered by a `{stale && (` block with its own <p>"
    assert "print-hide" not in m.group(1), (
        f"the stale notice is hidden from print: {m.group(1)!r}"
    )


def test_the_notice_offers_the_way_back_to_the_answers() -> None:
    src = reconcile_source()
    assert re.search(r'href="#stage-establish"[^>]*>\s*\n?\s*<T k="result.staleAction" />', src), (
        "the stale notice names the problem without linking to where it is fixed"
    )
    assert 'id="stage-establish"' in page_source(), (
        "nothing on /check carries the id the stale notice links to"
    )


# ------------------------------------------------------------------ the words exist


def test_every_new_string_is_a_dictionary_key_in_english() -> None:
    """The interface's own words, not literals typed into a component."""
    en = I18N_TS.read_text(encoding="utf-8")
    block = re.search(r"^const en = \{(.*?)^\} as const;", en, re.DOTALL | re.MULTILINE)
    assert block, "the English dictionary was not found in lib/i18n.ts"
    declared = set(re.findall(r'^  "([^"]+)":', block.group(1), re.MULTILINE))
    for key in ("gate.stale", "result.stale", "result.staleAction"):
        assert key in declared, f"{key} is rendered but the dictionary does not declare it"
