"""The design tokens must meet their own contrast contract, and be the only ones used.

Two claims live here, and neither may be made by inspection:

  1. Every colour token meets the WCAG 2.x ratio its NAME commits it to. The
     pairs are generated from the naming convention in frontend/app/globals.css,
     not listed by hand, so adding a family adds its assertions automatically
     and a token cannot be introduced without one. That is the rule in
     .claude/rules/honesty.md about quantified test names: this file says
     "every", so it must derive its cases rather than pick them.

  2. The tokens are what the app actually uses. A token layer that sits beside
     50 raw palette utilities has changed nothing, so the second half of this
     module reads the TSX and fails on any raw palette class, arbitrary size or
     off-grid spacing step that survived.

Reaching out of backend/ into frontend/ follows test_routes_match_vercel.py,
which reads vercel.json for the same reason: the fact being checked spans the
repo, so a test confined to one half of it would check nothing.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
CSS = REPO / "frontend" / "app" / "globals.css"
APP = REPO / "frontend" / "app"

# WCAG 2.x thresholds. https://www.w3.org/TR/WCAG22/#contrast-minimum (1.4.3)
# and #non-text-contrast (1.4.11). The spec does not permit rounding: 4.499
# fails, so these are compared without tolerance.
TEXT_MIN = 4.5
NON_TEXT_MIN = 3.0

# Surfaces a foreground token is allowed to sit on. Any -fg token must clear
# TEXT_MIN against all of them, because the components move between cards, the
# page behind them, and the muted panels inside them.
SURFACES = ("surface", "canvas", "muted")

# Tokens deliberately NOT held to 1.4.11's 3:1.
#
# `line` is a hairline between rows inside a group that is already bounded by a
# 3:1 edge and named by a heading. It is not "visual information required to
# identify a user interface component", so 3:1 does not apply - but the
# exemption is written down here, with the measured ratio reported by
# test_decorative_tokens_are_named_and_measured, rather than left implicit.
DECORATIVE = {"line"}

# Tokens that are surfaces or plain values rather than foregrounds/borders.
STRUCTURAL = {"canvas", "surface", "muted", "sunken", "on-solid"}

# Boundaries that belong to no family: the card edge, the input border and the
# focus ring. They are held to 1.4.11's 3:1 like any `-line`, but they are never
# filled, so the "white must be legible on this" rule does not apply to them.
BOUNDARY = {"line-strong", "control", "focus"}


def _strip_comments(css: str) -> str:
    """Textual assertions must read the RULES, not the prose around them.

    Two of the checks below look for the absence of a string - `Arial`,
    `prefers-color-scheme` - and both of those words appear in globals.css's
    comments explaining why they are gone. A test that fails on its own
    explanation is a test that teaches people to delete the explanation.
    """
    return re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)


# --------------------------------------------------------------- the maths


def _luminance(hex_colour: str) -> float:
    """WCAG relative luminance. https://www.w3.org/TR/WCAG22/#dfn-relative-luminance"""
    h = hex_colour.lstrip("#")
    channels = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(a: str, b: str) -> float:
    la, lb = _luminance(a), _luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def test_the_contrast_maths_matches_two_published_reference_pairs() -> None:
    """The checker itself must be right before anything it says is worth having.

    Both pairs are stated in WCAG 2.2's own examples: black on white is 21:1,
    and a colour against itself is 1:1.
    """
    assert round(contrast("#000000", "#ffffff"), 2) == 21.0
    assert round(contrast("#777777", "#777777"), 2) == 1.0
    # #767676 on white is the canonical "just passes 4.5:1" value used across
    # WCAG's own understanding documents.
    assert 4.5 <= contrast("#767676", "#ffffff") < 4.6


# ------------------------------------------------------------- the parsing

_TOKEN = re.compile(r"^\s*--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;", re.MULTILINE)


def tokens() -> dict[str, str]:
    """The DEFAULT token set: the @theme block only.

    Scanning the whole file was wrong the moment a second set existed. Phase 2
    added a [data-contrast="high"] block that redefines most of these names, and
    a file-wide regex returned the LAST match for each - so this function
    silently began handing back a mixture of the two, and the contrast suite
    began checking pairs that never appear together on a screen. The
    high-contrast set has its own reader and its own assertions in
    test_inclusion.py.
    """
    css = CSS.read_text(encoding="utf-8")
    theme = re.search(r"@theme\s*\{(.*?)\n\}", css, re.DOTALL)
    assert theme, f"no @theme block found in {CSS}"
    found = dict(_TOKEN.findall(theme.group(1)))
    assert found, f"no --color-* tokens parsed from the @theme block of {CSS}"
    return found


# Every selector in globals.css that defines --color-* tokens, and the reader
# that is responsible for it.
#
# THIS REGISTRY IS THE PREVENTION for docs/debt.md, unscoped-reader-of-a-scoped-
# source. tokens() scanned the whole file until a second set of colours existed;
# from that commit until the next one it returned a MIXTURE of the two, and the
# contrast suite went on passing while checking pairs that never appear together
# on a screen. The test below fails the moment a third scope appears without a
# reader of its own, which is the general rule: when a stylesheet gains a scope,
# every test that reads it must gain the same scope or fail.
COLOR_SCOPES: dict[str, str] = {
    "@theme": "tokens(), in this module",
    '[data-contrast="high"]': "high_contrast_tokens(), in test_inclusion.py",
    # Phase 4's print scope, and the registry did its job: this test failed the
    # moment the block was appended, before anything had been printed. Two
    # entries for one set of values because the parser reports a nested block
    # twice - once under its own selector and once inside its @media parent -
    # which is deliberate there, so that a colour set hidden inside a media
    # query cannot be missed by being nested.
    "@media print": "print_tokens(), in test_print_sheet.py",
    ':root, :root[data-contrast="high"]': "print_tokens(), in test_print_sheet.py",
}


_DECLARES = re.compile(r"^\s*--color-[a-z0-9-]+\s*:", re.MULTILINE)


def _blocks(css: str) -> list[tuple[str, str]]:
    """(selector, body) for every brace block, at any nesting depth.

    Nested blocks appear inside their parent's body as well as on their own, so
    a colour set hidden inside an @media is reported twice rather than missed.
    """
    out: list[tuple[str, str]] = []
    i = 0
    while (open_i := css.find("{", i)) != -1:
        start = max(css.rfind(c, 0, open_i) for c in ";{}")
        header = re.sub(r"\s+", " ", css[start + 1 : open_i]).strip()
        depth, j = 0, open_i
        while j < len(css):
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append((header, css[open_i + 1 : j]))
        i = open_i + 1
    return out


def test_every_selector_that_defines_colour_tokens_has_a_reader() -> None:
    """A scope with no reader is a scope no assertion in this suite can see."""
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    # DECLARES, not uses. `body { color: var(--color-ink) }` consumes a token and
    # defines none, and a check that could not tell those apart would demand a
    # reader for every rule that paints anything.
    defining = {sel for sel, body in _blocks(css) if _DECLARES.search(body)}
    assert defining, "no block defines --color-*; this test would pass by examining nothing"
    unread = defining - set(COLOR_SCOPES)
    assert not unread, (
        f"colour scopes with no reader: {sorted(unread)}. Add one, with its own "
        f"assertions, and register it in COLOR_SCOPES."
    )


def test_each_registered_reader_returns_the_values_of_its_own_scope() -> None:
    """The registry must not be a claim of its own.

    An entry naming a reader that in fact reads somewhere else would restore the
    original defect while looking like the fix for it, so each reader's output is
    checked against the text of the block it claims."""
    from test_inclusion import high_contrast_tokens
    from test_print_sheet import print_tokens

    readers = {
        "@theme": tokens,
        '[data-contrast="high"]': high_contrast_tokens,
        "@media print": print_tokens,
        ':root, :root[data-contrast="high"]': print_tokens,
    }
    assert set(readers) == set(COLOR_SCOPES), "a registered scope has no reader here"
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    bodies = {sel: body for sel, body in _blocks(css)}
    for selector, read in readers.items():
        found = read()
        assert found, f"{selector}: reader returned nothing"
        for name, value in found.items():
            assert f"--color-{name}: {value}" in bodies[selector], (
                f"{selector}: --color-{name} came back as {value}, which is not what that "
                f"block declares - the reader is reading outside its scope"
            )


def _last_declared() -> dict[str, str]:
    """What a file-wide read returns: the LAST declaration of each name.

    Derived from block order, not from knowing which scope happens to be last.
    The previous version of this test named the high-contrast set as the tail of
    the file and compared against it directly, which was true for exactly as
    long as that set WAS the tail: Phase 4 appended a print scope below it and
    the assertion failed - not because the regression had returned, but because
    the test had hardcoded the shape of the file it was reading. That is the
    same defect it exists to lock, one level up, so it is now derived too.
    """
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    last: dict[str, str] = {}
    for _, body in _blocks(css):
        # Nested blocks are reported inside their parent's body as well as on
        # their own, so a name is seen more than once; file order still puts the
        # final declaration last either way.
        for name, value in _TOKEN.findall(body):
            last[name] = value
    return last


def test_a_file_wide_read_would_still_be_wrong() -> None:
    """The regression itself, locked in.

    The old reader took the LAST match for each name in the file, so every name
    a later scope redefines came back with THAT scope's value while the suite
    believed it was checking the default set. This asserts both halves: that the
    naive read is still wrong, and that tokens() is not it."""
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    naive = dict(_TOKEN.findall(css))
    theme, last = tokens(), _last_declared()
    overridden = {n for n in theme if theme[n] != last.get(n, theme[n])}
    assert overridden, (
        "no name is redefined by a later scope, so a file-wide read and a scoped "
        "one agree; this test would pass by proving nothing"
    )
    for name in sorted(overridden):
        assert naive[name] == last[name], (
            f"--color-{name}: a file-wide read does not end where block order says "
            f"it does ({naive[name]} vs {last[name]}) - the parser and the regex "
            f"disagree about this file"
        )
        assert theme[name] != naive[name], f"--color-{name}: tokens() is reading the whole file"


def families() -> dict[str, dict[str, str]]:
    """Group tokens by family from their names alone.

    `--color-agreed`, `--color-agreed-fg`, `--color-agreed-bg` and
    `--color-agreed-line` become {"agreed": {"solid":…, "fg":…, "bg":…, "line":…}}.
    Nothing in this function knows what families exist.
    """
    out: dict[str, dict[str, str]] = {}
    for name, value in tokens().items():
        if name in STRUCTURAL:
            continue
        for role in ("fg", "bg", "line"):
            if name.endswith(f"-{role}"):
                out.setdefault(name[: -len(role) - 1], {})[role] = value
                break
        else:
            out.setdefault(name, {})["solid"] = value
    return out


def test_every_token_is_either_asserted_or_named_decorative() -> None:
    """No token may be silently unchecked.

    This is the guard that keeps claim 1 honest as the palette grows: a new
    token either falls into a role this file asserts, or it has to be added to
    DECORATIVE by hand, which is a decision someone has to write down.
    """
    checked = set(STRUCTURAL) | DECORATIVE
    for family, roles in families().items():
        for role in roles:
            checked.add(family if role == "solid" else f"{family}-{role}")
    unchecked = set(tokens()) - checked
    assert not unchecked, f"tokens with no contrast rule and not named decorative: {sorted(unchecked)}"


# ---------------------------------------------------- the generated cases


def _fg_cases() -> list[tuple[str, str, str, str, float]]:
    """(family, role, fg_hex, bg_hex, minimum) for every foreground token."""
    tok, fams = tokens(), families()
    cases = []
    for family, roles in sorted(fams.items()):
        if family in DECORATIVE or "fg" not in roles:
            continue
        backdrops = [(s, tok[s]) for s in SURFACES]
        if "bg" in roles:
            backdrops.append((f"{family}-bg", roles["bg"]))
        for label, bg in backdrops:
            cases.append((family, label, roles["fg"], bg, TEXT_MIN))
    return cases


@pytest.mark.parametrize("family,backdrop,fg,bg,minimum", _fg_cases())
def test_every_foreground_token_reaches_4_5_on_every_surface_it_may_sit_on(
    family: str, backdrop: str, fg: str, bg: str, minimum: float
) -> None:
    ratio = contrast(fg, bg)
    assert ratio >= minimum, f"--color-{family}-fg on {backdrop}: {ratio:.2f}:1 < {minimum}"


def _neutral_text_cases() -> list[tuple[str, str, str, str]]:
    tok = tokens()
    # `sunken` is included for the neutrals only: it is a chip fill and a
    # disabled control, and only neutral text ever lands on it.
    return [
        (ink, surf, tok[ink], tok[surf])
        for ink in ("ink", "ink-2", "ink-3")
        for surf in (*SURFACES, "sunken")
    ]


@pytest.mark.parametrize("ink,backdrop,fg,bg", _neutral_text_cases())
def test_every_neutral_text_token_reaches_4_5_on_every_neutral_surface(
    ink: str, backdrop: str, fg: str, bg: str
) -> None:
    ratio = contrast(fg, bg)
    assert ratio >= TEXT_MIN, f"--color-{ink} on {backdrop}: {ratio:.2f}:1 < {TEXT_MIN}"


def _solid_cases() -> list[tuple[str, str, str]]:
    tok, fams = tokens(), families()
    return [
        (family, roles["solid"], tok["on-solid"])
        for family, roles in sorted(fams.items())
        if "solid" in roles and family not in DECORATIVE and family not in BOUNDARY
    ]


@pytest.mark.parametrize("family,solid,on_solid", _solid_cases())
def test_every_solid_fill_carries_its_own_label_at_4_5(
    family: str, solid: str, on_solid: str
) -> None:
    """A solid token exists to be filled and written on. If white does not
    reach 4.5:1 on it, the fill cannot carry a label and the token is a trap."""
    ratio = contrast(on_solid, solid)
    assert ratio >= TEXT_MIN, f"--color-on-solid on --color-{family}: {ratio:.2f}:1 < {TEXT_MIN}"


def _border_cases() -> list[tuple[str, str, str, str]]:
    tok, fams = tokens(), families()
    named = [(f"{f}-line", r["line"]) for f, r in sorted(fams.items()) if "line" in r]
    # These three are not part of a family but are component boundaries:
    # the card edge, the input border, and the focus ring.
    named += [(n, tok[n]) for n in ("line-strong", "control", "focus")]
    return [
        (name, surf, value, tok[surf])
        for name, value in named
        if name.rsplit("-line", 1)[0] not in DECORATIVE and name not in DECORATIVE
        for surf in ("surface", "canvas")
    ]


@pytest.mark.parametrize("name,backdrop,fg,bg", _border_cases())
def test_every_component_boundary_reaches_3_to_1(
    name: str, backdrop: str, fg: str, bg: str
) -> None:
    """WCAG 1.4.11. Includes the focus ring: its 2px offset renders the page
    behind the control, so surface and canvas are the colours it is measured
    against, not the button it surrounds."""
    ratio = contrast(fg, bg)
    assert ratio >= NON_TEXT_MIN, f"--color-{name} on {backdrop}: {ratio:.2f}:1 < {NON_TEXT_MIN}"


def test_decorative_tokens_are_named_and_measured() -> None:
    """The exemption is recorded with its number, not left as a silence.

    A decorative hairline still has to be VISIBLE, or it is not a divider at
    all - so it is held to a floor of its own rather than to nothing.
    """
    tok = tokens()
    for name in sorted(DECORATIVE):
        ratio = contrast(tok[name], tok["surface"])
        assert 1.2 <= ratio < NON_TEXT_MIN, (
            f"--color-{name} measures {ratio:.2f}:1 on surface. Below 1.2 it is "
            f"invisible; at or above {NON_TEXT_MIN} it is no longer decorative "
            f"and should be asserted rather than exempted."
        )


# ------------------------------------------------- claim 2: actually used

TSX = sorted(APP.rglob("*.tsx"))

# The families Tailwind ships. After `--color-*: initial` in globals.css these
# no longer compile, so any survivor is an element that lost its styling.
_RAW_PALETTE = re.compile(
    r"\b(?:text|bg|border|divide|ring|from|to|via|fill|stroke|placeholder|outline|accent|shadow)"
    r"-(?:zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|"
    r"sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b"
)
_RAW_WHITE_BLACK = re.compile(r"\b(?:text|bg|border|divide|file:bg)-(?:white|black)\b")
_ARBITRARY_SIZE = re.compile(r"\btext-\[[^\]]+\]")
_DEFAULT_SIZES = re.compile(r"\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b")
# 8pt grid with 4pt half-steps: Tailwind's 0.5/1.5/2.5 steps are 2px/6px/10px.
_OFF_GRID = re.compile(
    r"\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-y|space-x)-\d*\.5\b"
)


def _hits(pattern: re.Pattern[str]) -> list[str]:
    out = []
    for path in TSX:
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for m in pattern.findall(line):
                out.append(f"{path.relative_to(REPO)}:{n}: {m}")
    return out


def test_no_raw_tailwind_palette_class_survives_in_any_app_file() -> None:
    assert TSX, "no .tsx files found - this test would pass by examining nothing"
    hits = _hits(_RAW_PALETTE) + _hits(_RAW_WHITE_BLACK)
    assert not hits, "raw palette classes no longer compile after --color-*: initial:\n" + "\n".join(hits)


def test_no_arbitrary_or_default_font_size_survives_in_any_app_file() -> None:
    assert TSX, "no .tsx files found - this test would pass by examining nothing"
    hits = _hits(_ARBITRARY_SIZE) + _hits(_DEFAULT_SIZES)
    assert not hits, "font sizes outside the six-step scale:\n" + "\n".join(hits)


def test_no_spacing_step_falls_off_the_grid_in_any_app_file() -> None:
    assert TSX, "no .tsx files found - this test would pass by examining nothing"
    hits = _hits(_OFF_GRID)
    assert not hits, "spacing off the 8pt grid (4pt half-steps allowed):\n" + "\n".join(hits)


# ------------------------------------------------------- the scale itself


# The type scale, by name, smallest first. NAMED rather than counted: the
# previous version of this test asserted `len(steps) == 6`, which is a fact about
# how many steps happened to exist rather than about which ones the design has -
# so it went red when the display step was added and would have stayed green if
# `hero` had been silently renamed. Adding a step is a decision, and it is made
# here.
TYPE_SCALE: tuple[str, ...] = ("meta", "body", "lead", "title", "page", "hero", "display")


def test_the_type_scale_is_the_named_set_and_nothing_else() -> None:
    """A closed scale, in order, with a 14px floor.

    The floor is the evidence it is a scale for people rather than for a
    designer's eye: this screen is read by people with low vision and by a room
    five to fifteen metres from a projector.
    """
    css = CSS.read_text(encoding="utf-8")
    steps = re.findall(r"^\s*--text-([a-z0-9]+):\s*([0-9.]+)rem;", css, re.MULTILINE)
    assert [name for name, _ in steps] == list(TYPE_SCALE), (
        f"the type scale is {[n for n, _ in steps]}, expected {list(TYPE_SCALE)}. A step "
        f"added, removed or renamed is a design decision; make it here as well."
    )
    sizes = [float(v) for _, v in steps]
    assert sizes[0] >= 0.875, f"smallest step is {sizes[0]}rem; the floor is 0.875rem (14px)"
    assert sizes == sorted(sizes), f"the steps are not in ascending order: {steps}"


def test_there_is_one_shadow_and_two_radii() -> None:
    css = CSS.read_text(encoding="utf-8")
    assert len(re.findall(r"^\s*--shadow-[a-z]+:", css, re.MULTILINE)) == 1
    assert len(re.findall(r"^\s*--radius-[a-z]+:", css, re.MULTILINE)) == 2


def test_the_theme_clears_tailwinds_default_namespaces() -> None:
    """Without these four lines the raw palette still compiles and the three
    'no raw class survives' tests above are style rules rather than facts about
    what the browser can render."""
    css = CSS.read_text(encoding="utf-8")
    for namespace in ("--color-*", "--text-*", "--radius-*", "--shadow-*"):
        assert f"{namespace}: initial;" in css, f"{namespace} namespace is not cleared"


def test_no_dark_theme_and_colour_scheme_is_declared_light() -> None:
    """The demo is projected in a lit room, and six scripted answers go through
    native <select> and date controls that follow color-scheme."""
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    assert "color-scheme: light" in css
    assert "prefers-color-scheme" not in css


def test_the_body_font_is_the_token_and_not_a_hardcoded_family() -> None:
    """docs/debt.md, wired-mechanism-does-nothing: `font-family: Arial` here
    overrode the font next/font loads in layout.tsx, so two fonts were
    downloaded and neither was ever shown. Phase 2's multilingual fonts would
    have been inert in exactly the same way."""
    css = _strip_comments(CSS.read_text(encoding="utf-8"))
    body = re.search(r"^body\s*\{(.*?)^\}", css, re.MULTILINE | re.DOTALL)
    assert body, "no body rule found in globals.css"
    assert "font-family: var(--font-sans)" in body.group(1)
    assert "Arial" not in body.group(1)


# --------------------------------------- claim 3: no token is merely declared


_UTILITIES = (
    "text|bg|border|divide|ring|fill|stroke|outline|accent|from|to|via|shadow|placeholder"
)


def test_every_colour_token_is_actually_used_somewhere() -> None:
    """A token that exists and is never applied is a decision nobody can see.

    This is the guard against the class logged on 2026-09-08 as
    wired-mechanism-does-nothing - the `font-family: Arial` line that overrode
    two fonts next/font was loading, so the loader worked perfectly and its
    output reached no pixel. The same shape is available to a palette: declare a
    handsome table of six families, apply four of them, and the contrast tests
    above still pass on colours nobody will ever see.

    A token counts as used when it appears as a Tailwind utility in the app, or
    as a var() in the stylesheet itself (the focus ring and the body background
    are only ever referenced that way).
    """
    css = CSS.read_text(encoding="utf-8")
    tsx = "\n".join(p.read_text(encoding="utf-8") for p in TSX)
    assert TSX, "no .tsx files found - this test would pass by examining nothing"

    unused = []
    for name in sorted(tokens()):
        # (?![-\w]) not \b: `border-ink` must not be satisfied by `border-ink-2`.
        as_utility = re.compile(rf"(?:{_UTILITIES})-{re.escape(name)}(?![-\w])")
        as_var = f"var(--color-{name})"
        if not as_utility.search(tsx) and as_var not in css:
            unused.append(name)
    assert not unused, (
        "colour tokens declared but never applied: "
        + ", ".join(unused)
        + ". Apply them or delete them; a palette entry nothing renders is a "
        "claim about the design that the design does not make."
    )


# --------------------------------------------------- opacity, and the hole it
# ------------------------------------------------------ makes in this module
#
# EVERYTHING ABOVE ASSERTS TOKENS. `opacity` is not a token: it composites at
# render time, so a pair this module has proved at 10.5:1 can reach the screen
# at 4.33:1 and every assertion here still passes.
#
# That is not hypothetical. `line-through opacity-70` on the mandate selector
# put --color-ink-2 (#3f3f46, 10.5:1 on white and asserted as such above) onto
# the screen as #79797e, which is 4.33:1 - under 1.4.3's 4.5 - and the same
# class over the selected blue button reached 4.1:1. axe found both in the
# browser; nothing in this file could have, because the stylesheet was right and
# the rendered colour was not.
#
# So the rule is: DO NOT DIM TEXT WITH OPACITY. If something should be quieter,
# it gets a token, which this module can then hold to a ratio.
#
# Two exceptions, and both are named rather than pattern-matched:
#
#   disabled:opacity-*   1.4.3 exempts inactive controls, and axe agrees - it
#                        passed all three of ours in seven states.
#   MEASURED_OPACITY     survivors that were measured in the browser and pass.
#                        The entry records the RATIO AND WHERE IT WAS TAKEN, so
#                        it is evidence rather than an opinion. A new one may
#                        not be added without one.
# EMPTY, AND THAT IS THE END STATE THE RULE ABOVE WAS AIMING AT.
#
# Both entries were removed rather than re-measured. The design pass rewrote the
# two panels that carried them - the before/after detail under a moved component,
# and the arithmetic line inside a verdict card - and in both the dimming was
# doing work a colour token does better and this module can hold to a ratio.
#
# The registry stays, because the exemption has to remain expressible: a future
# opacity on text is allowed only with a measurement, and an empty dict is what
# "no exemptions currently claimed" looks like. The non-vacuity guard is
# test_no_opacity_dims_text_outside_the_disabled_state, which still finds the
# `disabled:` uses and would fail if the scan stopped seeing anything at all.
MEASURED_OPACITY: dict[str, str] = {}

_OPACITY = re.compile(r"(?<![\w:-])(?:(\w+):)?opacity-(\d+)")


def _strip_tsx_comments(src: str) -> str:
    """Read the CODE, not the prose about it.

    _strip_comments at the top of this module exists for the same reason and
    says it best: a test that fails on its own explanation teaches people to
    delete the explanation. This one proved it immediately - the comment written
    beside the removed `opacity-70` to record why it went contains the string
    `opacity-70`, and the scan reported the fix as the defect.

    `//` is only treated as a comment when it does not follow a colon, so the
    `https://` in a source URL survives.
    """
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)  # /* */ and JSX {/* */}
    return re.sub(r"(?<!:)//[^\n]*", "", src)


def _opacity_uses() -> list[tuple[str, str, str]]:
    """(file, variant, class) for every opacity utility in the app."""
    out = []
    for path in sorted((REPO / "frontend" / "app").rglob("*.tsx")):
        rel = path.relative_to(REPO / "frontend").as_posix()
        src = _strip_tsx_comments(path.read_text(encoding="utf-8"))
        for variant, value in _OPACITY.findall(src):
            out.append((rel, variant, f"opacity-{value}"))
    return out


def test_no_opacity_dims_text_outside_the_disabled_state() -> None:
    """The check this module cannot make about itself, made here instead."""
    uses = _opacity_uses()
    assert uses, "no opacity utilities found at all; this test would pass by examining nothing"
    unexplained = []
    for rel, variant, cls in uses:
        if variant == "disabled":
            continue
        if f"{rel}:{cls}" in MEASURED_OPACITY:
            continue
        unexplained.append(f"{rel} {cls}")
    assert not unexplained, (
        f"opacity on text with no measurement behind it: {sorted(set(unexplained))}. "
        f"Opacity composites past every assertion in this module - a token proved at "
        f"10.5:1 reached the screen at 4.33:1 the last time this happened. Use a "
        f"colour token, or measure it in a browser and record the ratio in "
        f"MEASURED_OPACITY."
    )


def test_every_measured_opacity_entry_still_describes_a_real_use() -> None:
    """A stale exception is an assertion nobody is making any more."""
    present = {f"{rel}:{cls}" for rel, variant, cls in _opacity_uses() if variant != "disabled"}
    stale = set(MEASURED_OPACITY) - present
    assert not stale, (
        f"MEASURED_OPACITY names uses that no longer exist: {sorted(stale)}. Remove "
        f"them, or the registry is carrying evidence for code that is gone."
    )


def test_every_measured_opacity_entry_says_where_it_was_measured() -> None:
    """"It looks fine" is what the removed ones looked like too.

    A loop rather than a parametrize, because the registry is currently empty and
    an empty parametrize is a SKIP - a yellow line in the gate for a rule that is
    being followed perfectly. The vacuity this would otherwise hide is covered by
    the test above, which fails if the scan stops seeing any opacity at all.
    """
    for entry, note in sorted(MEASURED_OPACITY.items()):
        assert "axe" in note.lower(), f"{entry}: the note does not name the tool that measured it"
        assert len(note) >= 60, f"{entry}: the note is too short to be a measurement"


# ------------------------------------- a layout may not push the page sideways


def test_an_implicit_grid_column_is_allowed_to_shrink() -> None:
    """THE HEADING RULE, IN A LAYOUT.

    `overflow-wrap: anywhere` on headings exists because one long Tamil token is
    wider than a 390px phone and a column is at least as wide as its min-content.
    A `display: grid` with NO `grid-template-columns` has the same problem one
    level up: every child lands in an IMPLICIT column, an implicit column is
    sized `auto`, and `auto` will not shrink below its content's min-content
    width. A card holding a long field label resolved its column to 485px inside
    a 312px page, and the page scrolled by the difference.

    It was three separate places when it was found - the establish stage, the
    report studio's preview column, and the studio's controls - which is what
    makes it a class rather than three bugs, and why the fix is one rule rather
    than three `min-w-0`s that the fourth one will be written without.

    `grid-auto-columns` governs IMPLICIT tracks only, so every grid that
    declares its own template - the X-ray's canvas-and-inspector split, the
    studio's controls-and-preview split, every `sm:grid-cols-2` - keeps exactly
    what it set. Verified by measuring the rendered page at 390px in all four
    languages at the largest text size.
    """
    css = CSS.read_text(encoding="utf-8")
    rule = re.search(
        r':where\(\[class~="grid"\]\)\s*\{([^}]*)\}', css, re.DOTALL
    )
    assert rule, (
        "the implicit-grid-column rule is gone. Without it a one-column grid "
        "takes the width of its widest child and the page scrolls sideways in "
        "any language whose words are long."
    )
    assert "grid-auto-columns" in rule.group(1)
    assert "minmax(0, 1fr)" in rule.group(1), (
        f"the rule no longer gives implicit columns a zero minimum: {rule.group(1)!r}"
    )


def test_the_implicit_grid_rule_does_not_touch_explicit_templates() -> None:
    """It must be `grid-auto-columns` and never `grid-template-columns`.

    The second would overwrite every deliberate layout in the app - the payroll
    X-ray's 70/30 split among them - and the damage would be invisible in a
    test that only checked that the rule exists.
    """
    css = CSS.read_text(encoding="utf-8")
    rule = re.search(r':where\(\[class~="grid"\]\)\s*\{([^}]*)\}', css, re.DOTALL)
    assert rule, "the implicit-grid-column rule was not found"
    assert "grid-template-columns" not in rule.group(1), (
        "the rule sets grid-template-columns, which overrides every explicit "
        "layout in the app rather than only the implicit one-column case"
    )


# ------------------------------------------------------------------- motion


def _motion_block(name: str) -> str:
    """The default reset, or the `no-preference` revert."""
    css = CSS.read_text(encoding="utf-8")
    if name == "reset":
        m = re.search(r"\n\* \{\n(.*?)\n\}", css, re.DOTALL)
    else:
        m = re.search(
            r"@media \(prefers-reduced-motion: no-preference\) \{\s*\*\s*\{(.*?)\}",
            css,
            re.DOTALL,
        )
    assert m, f"the {name} motion block was not found in globals.css"
    return m.group(1)


def test_motion_is_off_by_default_and_only_reverted_by_a_stated_preference() -> None:
    """The safe direction, and the reason it is the safe one.

    `prefers-reduced-motion: no-preference` is ABSENT on a machine that has
    never been asked, so a rule written the other way round - animate by
    default, disable under `reduce` - animates for everyone the question was
    never put to. The failure mode of guessing wrong here is vestibular.
    """
    reset = _motion_block("reset")
    assert "animation-duration: 0.01ms" in reset
    revert = _motion_block("revert")
    assert "animation-duration: revert" in revert


@pytest.mark.parametrize(
    "prop", ["animation-duration", "animation-delay", "transition-duration", "transition-delay"]
)
def test_every_timing_property_is_in_both_motion_blocks(prop: str) -> None:
    """THE DELAY HAS TO GO WITH THE DURATION, and once it did not.

    The payroll reveal staggers three hundred marks with a per-mark
    `animation-delay`. Collapsing only the DURATION leaves the delay intact, and
    with `fill-mode: both` each mark then holds its `from` state - opacity zero -
    for up to 600ms before appearing. That is the same staggered reveal,
    performed on exactly the machine that asked not to see one, and no
    screenshot of a still page would ever show it.
    """
    reset = _motion_block("reset")
    revert = _motion_block("revert")
    assert prop in reset, (
        f"{prop} is not reset by default, so a component setting it animates on a "
        f"machine that asked for reduced motion"
    )
    assert prop in revert, (
        f"{prop} is reset by default and never reverted, so it stays disabled even "
        f"where motion is welcome"
    )


def test_the_payroll_reveal_holds_its_end_state() -> None:
    """`fill-mode: both`, so a collapsed duration lands the mark at `to` - which
    is what makes "renders instantly" true rather than "renders invisible"."""
    css = CSS.read_text(encoding="utf-8")
    utility = re.search(r"@utility mark-in \{(.*?)\}", css, re.DOTALL)
    assert utility, "the mark-in utility was not found"
    assert "fairslip-mark-in" in utility.group(1)
    assert "both" in utility.group(1), (
        "the reveal does not use fill-mode: both, so a mark is unstyled before "
        "its delay and after its duration"
    )
    frames = re.search(r"@keyframes fairslip-mark-in \{(.*?)\n\}", css, re.DOTALL)
    assert frames, "the reveal keyframes were not found"
    assert "opacity: 1" in frames.group(1), "the reveal does not end fully visible"
