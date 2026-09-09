"""The take-away sheet: what a worker carries out of the building.

A worker who finds a difference does not screenshot it. They print it and take
it to an NGO office, where it is photocopied, and the copy is what reaches the
person who can act. So the thing under test here is not a stylesheet. It is
whether a second-generation black-and-white photocopy still says what the screen
said.

FOUR CLAIMS, and none of them may be made by looking at the CSS and agreeing
with it:

  1. Every colour the print scope declares is black or white. Not "dark enough";
     #000000 or #ffffff, derived over the whole token set rather than spot-checked,
     because a token added later is exactly the one nobody would spot-check.

  2. Nothing on paper depends on a background fill. Chrome does not print
     background graphics unless the reader ticks a box in the print dialog, so a
     status carried by a tint is a status that usually does not print. Every
     foreground is black and every fill is white, which makes the two settings
     produce the same sheet.

  3. The print scope covers the high-contrast scope. A reader who printed while
     in high-contrast mode was otherwise handed near-black-on-white, which is
     nearly right and therefore the worst kind of wrong to leave to chance.

  4. print-only and print-hide are a matched pair, and every region hidden from
     the paper is NAMED on the paper. That last one is the honesty contract
     applied to an omission: a sheet that silently drops a section is a sheet
     that has quietly decided what the reader may know.

Claim 4 is the one with teeth, and it is a registry test in the same shape as
COLOR_SCOPES in test_design_tokens.py: the code cannot hide a block from print
without declaring it, and cannot declare one it does not hide.

Status encoding in greyscale is NOT re-asserted here. test_inclusion.py already
derives it over the FactStatus union - no two statuses share an icon shape or a
word - and repeating it would be a second copy of an assertion, which is the
same defect as a second copy of a figure.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
CSS = REPO / "frontend" / "app" / "globals.css"
APP = REPO / "frontend" / "app"
SHEET = APP / "ui" / "PrintSheet.tsx"

BLACK = "#000000"
WHITE = "#ffffff"

# Names that are FILLS: a surface, a tint behind text, or the page itself.
# Everything else in the set is a foreground or a boundary and must be black.
#
# Derived from the naming convention, not listed by hand, wherever the name
# carries it: anything ending -bg is a tint. The four that do not follow the
# convention are named, because they predate it and renaming them would touch
# every file in the app.
STRUCTURAL_FILLS = {"canvas", "surface", "muted", "sunken"}


def _strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)


def print_tokens() -> dict[str, str]:
    """The token set that applies on paper.

    Scoped to the block inside `@media print`, for the reason recorded in
    docs/debt.md as unscoped-reader-of-a-scoped-source: this file now holds the
    THIRD colour scope in globals.css, and a reader that took the last match in
    the file would return a mixture of all three.
    """
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    block = re.search(
        r'@media print\s*\{.*?:root,\s*:root\[data-contrast="high"\]\s*\{(.*?)\n  \}',
        css,
        re.DOTALL,
    )
    assert block, f"no print token block found in {CSS}"
    found = dict(re.findall(r"--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", block.group(1)))
    assert found, f"no --color-* tokens parsed from the print block of {CSS}"
    return found


def _is_fill(name: str) -> bool:
    return name.endswith("-bg") or name in STRUCTURAL_FILLS


# ------------------------------------------------- claim 1: two inks, no grey


def _token_cases() -> list[tuple[str, str]]:
    return sorted(print_tokens().items())


@pytest.mark.parametrize(("name", "value"), _token_cases())
def test_every_print_token_is_black_or_white(name: str, value: str) -> None:
    """A photocopier has two inks and one of them is the paper.

    Mid-grey text survives one copy and dies on the second; the screen's
    hairline (#dcdee2) is invisible on the first. There is no third value that
    is safe, so there is no third value.
    """
    assert value.lower() in (BLACK, WHITE), (
        f"--color-{name} prints as {value}. Every print token must be {BLACK} or "
        f"{WHITE}: anything between them is a grey, and a grey is what a "
        f"photocopier loses."
    )


@pytest.mark.parametrize(("name", "value"), _token_cases())
def test_fills_are_white_and_everything_else_is_black(name: str, value: str) -> None:
    """Which of the two inks each token gets, decided by what the token is FOR."""
    expected = WHITE if _is_fill(name) else BLACK
    assert value.lower() == expected, (
        f"--color-{name} prints as {value}, expected {expected}. "
        f"{'A fill must be the paper' if _is_fill(name) else 'A foreground or a boundary must be the ink'}."
    )


def test_the_print_set_covers_every_colour_token_the_screen_defines() -> None:
    """A token the print scope forgets keeps its screen value on paper.

    This is the failure that does not announce itself: the sheet prints, it
    looks nearly right, and one family of chips is a pale tint nobody can see on
    the copy. Derived from the default set, so a token added to @theme without a
    print value fails here rather than on a photocopier in an NGO office.
    """
    from test_design_tokens import tokens

    missing = set(tokens()) - set(print_tokens())
    assert not missing, (
        f"tokens with no print value: {sorted(missing)}. Add each to the "
        f"@media print block in {CSS}."
    )


# ------------------------ claim 2: nothing depends on a background being printed


def test_text_on_a_solid_fill_is_black_because_the_fill_will_not_print() -> None:
    """`on-solid` is the token this rule explains worst, so it gets its own test.

    It names the text drawn on a solid button. On screen the button is blue and
    the text is white. In print the fill is white - so white text would be white
    on white paper, and it would be white on white ONLY for the readers who did
    not tick "background graphics", which is most of them and is the default.

    Every element using it is hidden from print today. That is exactly why this
    is asserted: the next one added will not be.
    """
    assert print_tokens()["on-solid"] == BLACK, (
        "--color-on-solid must be black in print. Chrome does not print "
        "background fills by default, so text coloured for a fill that is not "
        "there prints as white on white."
    )


def test_the_print_scope_overrides_high_contrast_as_well_as_the_default() -> None:
    """Two scopes reach the paper, and the sheet must not depend on which.

    A reader in high-contrast mode who prints gets #0a4a30 rather than #000000
    unless the print scope names that case too. Both halves of the selector are
    asserted, because a selector list that lost one half would still parse, still
    apply to most readers, and still look correct in review.
    """
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    block = re.search(r"@media print\s*\{(.*)", css, re.DOTALL)
    assert block, "no @media print block"
    head = block.group(1)[:400]
    assert ":root," in head, "the print scope does not name :root"
    assert ':root[data-contrast="high"]' in head, (
        "the print scope does not name the high-contrast root, so a reader who "
        "prints while in high-contrast mode gets that set's near-black instead"
    )


def test_no_print_rule_forces_background_graphics_on() -> None:
    """`print-color-adjust: exact` would make the sheet depend on a fill again.

    It is the obvious way to make tints survive printing, and it is the wrong
    one here: it costs toner, it darkens on every photocopy generation, and it
    still does nothing for a reader whose printer is out of colour. The sheet is
    built so the setting does not matter; this keeps it that way.
    """
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    media = re.search(r"@media print\s*\{(.*)", css, re.DOTALL)
    assert media, "no @media print block"
    for prop in ("print-color-adjust", "-webkit-print-color-adjust", "color-adjust"):
        assert prop not in media.group(1), (
            f"{prop} appears in the print block. The sheet must read the same "
            f"with background graphics on and off; forcing them on makes the "
            f"output depend on a print-dialog checkbox."
        )


# ---------------------------------- claim 4: what is hidden from paper is named


def _sheet_source() -> str:
    assert SHEET.exists(), f"{SHEET} does not exist"
    return SHEET.read_text(encoding="utf-8")


def omissions() -> dict[str, str]:
    """The registry: every region the sheet drops, and the id it is dropped under.

    Parsed from the PRINT_OMITTED literal rather than imported, for the reason
    test_design_tokens.py reaches into frontend/ at all - the fact spans the
    repo, and a check confined to one half of it would check nothing.
    """
    src = _sheet_source()
    block = re.search(r"const PRINT_OMITTED[^=]*=\s*\[(.*?)\n\]", src, re.DOTALL)
    assert block, "no PRINT_OMITTED array in PrintSheet.tsx"
    found = dict(re.findall(r'\{\s*id:\s*"([a-z-]+)",\s*label:\s*"([^"]+)"', block.group(1)))
    assert found, "PRINT_OMITTED parsed empty; the literal's shape changed"
    return found


def _screen_only_ids() -> list[str]:
    """Every id actually passed to <ScreenOnly> anywhere in the app."""
    ids: list[str] = []
    for path in APP.rglob("*.tsx"):
        ids += re.findall(r'<ScreenOnly\s+id="([a-z-]+)"', path.read_text(encoding="utf-8"))
    return ids


def test_every_hidden_region_is_declared_in_the_registry() -> None:
    """A section cannot be dropped from the paper without being named on it."""
    used, declared = set(_screen_only_ids()), set(omissions())
    assert used, "no <ScreenOnly> in the app; this test would pass by examining nothing"
    undeclared = used - declared
    assert not undeclared, (
        f"regions hidden from print with no entry in PRINT_OMITTED: "
        f"{sorted(undeclared)}. A sheet that silently drops a section has "
        f"decided for the reader what they may know."
    )


def test_every_registry_entry_hides_something() -> None:
    """The other direction: the note may not claim an omission that never happens.

    A stale entry is worse than a missing one. It tells the reader a section was
    withheld when in fact it is on the sheet somewhere, and sends them looking.
    """
    used, declared = set(_screen_only_ids()), set(omissions())
    unused = declared - used
    assert not unused, (
        f"PRINT_OMITTED names regions nothing hides: {sorted(unused)}. Remove "
        f"them, or the sheet claims to have withheld something it printed."
    )


@pytest.mark.parametrize("entry_id", sorted(omissions()))
def test_every_omission_says_why(entry_id: str) -> None:
    """A reason, not just a label. "The CPF example is not shown" tells a
    caseworker nothing; "it is a worked example about an invented month, not
    this worker's" tells them whether to go looking for it."""
    src = _sheet_source()
    entry = re.search(
        rf'\{{\s*id:\s*"{entry_id}",\s*label:\s*"[^"]+",\s*why:\s*"([^"]+)"', src
    )
    assert entry, f"{entry_id} has no `why` in PRINT_OMITTED"
    assert len(entry.group(1)) >= 40, (
        f"{entry_id}: the reason is {len(entry.group(1))} characters. That is a "
        f"label with a full stop, not an explanation."
    )


def _component(name: str) -> str:
    """The source of one exported component, by splitting on the export
    boundary rather than by matching braces.

    A regex from `export function X` to the next `\\n}` worked until ScreenOnly
    took a destructured props object with a type annotation - at which point the
    first `\\n}` in the file is the end of that TYPE, and the match returned a
    signature with no body in it. The test then failed for the shape of the
    parameter list. Splitting on the next top-level export cannot make that
    mistake, and needs no update when the signature changes again.
    """
    src = _sheet_source()
    parts = src.split("\nexport ")
    for part in parts:
        if part.startswith(f"function {name}"):
            return part
    raise AssertionError(f"no exported {name} in {SHEET}")


def test_the_hidden_block_and_its_standing_note_are_not_swapped() -> None:
    """ScreenOnly carries BOTH classes, and which one goes where is the whole
    component.

    print-hide belongs on the block. print-only belongs on the line that stands
    in its place on the paper. Swapping them inverts the sheet - the fictional
    worked example prints and the note explaining its absence does not - and
    both halves of that read as plausible in a diff, because both classes are
    still present and still spelled correctly.

    So this asserts the RELATIONSHIP rather than the presence. An earlier
    version of this test asserted that print-only did not appear in this
    component at all, which was true of a design that put the omissions in one
    list at the end of the sheet and false of the one that was built - where the
    note stands exactly where the block would have been, and therefore exists
    only when the block did.
    """
    body = _component("ScreenOnly")

    assert re.search(r'className="print-hide"[^>]*>\s*\{children\}', body), (
        "the children are not inside the print-hide element - the block this "
        "component exists to keep off the paper is reaching it"
    )
    # Matched on the ELEMENT, not on a literal class string: the note's class
    # list became a template literal when it gained a padding prop, and a regex
    # anchored to `className="print-only` went red for a change that altered
    # nothing it was checking. Anchor to what the assertion is about.
    note = re.search(r"<p\s[^>]*print-only[^>]*>(.*?)</p>", body, re.DOTALL)
    assert note, "no print-only element stands in for the hidden block"
    assert "{children}" not in note.group(1), (
        "the children are inside the print-only element, so the hidden block "
        "prints and the screen loses it - the two classes are swapped"
    )
    assert "entry.why" in note.group(1), (
        "the standing note does not render the reason from the registry, so the "
        "paper says something is missing without saying why"
    )


def test_the_two_print_classes_are_defined_and_are_opposites() -> None:
    """`print-only` must be hidden on screen by a rule OUTSIDE the media query.

    Defining it only inside @media print would leave it visible on screen -
    which is how a sheet's own masthead ends up on the page a judge is looking
    at, saying "printed on" above a screen nobody printed.
    """
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    outside = css.split("@media print")[0]
    assert re.search(r"\.print-only\s*\{[^}]*display:\s*none", outside), (
        ".print-only is not hidden outside @media print, so print-only content "
        "renders on screen"
    )
    inside = css.split("@media print", 1)[1]
    assert re.search(r"\.print-only\s*\{[^}]*display:\s*block", inside), (
        ".print-only is never revealed inside @media print"
    )
    assert re.search(r"\.print-hide\s*\{[^}]*display:\s*none", inside), (
        ".print-hide is not hidden inside @media print"
    )


# ------------------------------------------------------ the page is a page


def test_the_sheet_is_sized_for_a4() -> None:
    """A4, because the NGO office it is carried into is in Singapore and the
    photocopier there does not take Letter. Named explicitly rather than left to
    the printer's default, which is the reader's locale and not the worker's."""
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    page = re.search(r"@page\s*\{([^}]*)\}", css)
    assert page, "no @page rule; the sheet takes whatever the printer defaults to"
    assert "A4" in page.group(1), f"@page does not specify A4: {page.group(1).strip()}"
    assert "margin" in page.group(1), "@page sets no margin"


def test_the_text_size_control_still_applies_on_paper() -> None:
    """A reader who chose "Large" because they cannot read 10pt did not stop
    being that reader at the print dialog.

    The print base is a paper unit rather than a screen one, but --ui-scale
    stays in the multiplication. Dropping it would be the accessibility feature
    quietly switching itself off at the one moment the output cannot be zoomed.
    """
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    inside = css.split("@media print", 1)[1]
    rule = re.search(r"html\s*\{([^}]*font-size[^}]*)\}", inside)
    assert rule, "the print block sets no base font-size"
    assert "var(--ui-scale)" in rule.group(1), (
        f"the print base font-size drops --ui-scale: {rule.group(1).strip()}. "
        f"A reader at 150% prints at 100%."
    )
    assert "pt" in rule.group(1), (
        "the print base is not in a paper unit; px on paper is the printer's "
        "guess at a screen"
    )
