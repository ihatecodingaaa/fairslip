"""What Phase 2 claims about accessibility and language, checked rather than asserted.

Three separate claims live here:

  1. The four fact statuses are encoded REDUNDANTLY - colour and icon and words -
     so the interface still communicates with every colour removed. WCAG 1.4.1
     Use of Color is Level A, and "we added an icon" is not the same fact as
     "no two states look alike in greyscale".

  2. The high-contrast token set is a real token set, held to the same contrast
     floors as the default one. A contrast MODE that fails contrast is worse
     than no mode, because it is chosen by exactly the readers who need it.

  3. The draft request carries no language. Interface language and draft
     language are two different facts, and only one of them keys a cache.

The status list is derived from the TypeScript union in lib/api.ts, not typed
out here: .claude/rules/honesty.md forbids a test that quantifies over "every"
while checking a hand-picked set.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from test_design_tokens import NON_TEXT_MIN, SURFACES, TEXT_MIN, contrast, tokens

REPO = Path(__file__).resolve().parent.parent.parent
API_TS = REPO / "frontend" / "lib" / "api.ts"
CHIP_TSX = REPO / "frontend" / "app" / "ui" / "StatusChip.tsx"
I18N_TS = REPO / "frontend" / "lib" / "i18n.ts"
CSS = REPO / "frontend" / "app" / "globals.css"
SCHEMAS = REPO / "backend" / "app" / "schemas.py"


def fact_statuses() -> list[str]:
    """The FactStatus union, read off the type that defines it."""
    m = re.search(r"export type FactStatus\s*=\s*([^;]+);", API_TS.read_text(encoding="utf-8"))
    assert m, "FactStatus union not found in lib/api.ts"
    out = re.findall(r'"([A-Z_]+)"', m.group(1))
    assert len(out) >= 4, f"expected at least four statuses, parsed {out}"
    return out


# ------------------------------------------------- 1. redundant encoding


def chip_source() -> str:
    return CHIP_TSX.read_text(encoding="utf-8")


def icon_shapes() -> dict[str, str]:
    """status -> the SVG geometry drawn for it, whitespace-normalised."""
    block = re.search(
        r"const ICON: Record<Status, ReactNode> = \{(.*?)\n\};", chip_source(), re.DOTALL
    )
    assert block, "ICON map not found"
    out: dict[str, str] = {}
    for m in re.finditer(r"(\w+):\s*\(\s*<>(.*?)</>\s*\),", block.group(1), re.DOTALL):
        out[m.group(1)] = re.sub(r"\s+", " ", m.group(2)).strip()
    return out


def word_keys() -> dict[str, str]:
    block = re.search(r"const WORDS = \{(.*?)\n\} as const;", chip_source(), re.DOTALL)
    assert block, "WORDS map not found"
    return dict(re.findall(r'(\w+):\s*"([^"]+)"', block.group(1)))


@pytest.mark.parametrize("status", fact_statuses())
def test_every_fact_status_has_an_icon_and_a_word(status: str) -> None:
    assert status in icon_shapes(), f"{status} has no icon; colour would be its only encoding"
    assert status in word_keys(), f"{status} has no text label"


def test_no_two_statuses_share_an_icon_shape() -> None:
    """The greyscale test, mechanised.

    Strip every colour and a chip is an outline plus a word. If two statuses
    drew the same outline, colour would still be doing the work - which is what
    1.4.1 forbids, and what "we added icons" can quietly still be.
    """
    seen: dict[str, str] = {}
    for status, shape in icon_shapes().items():
        assert shape not in seen, (
            f"{status} draws the same shape as {seen[shape]}; in greyscale they are one state"
        )
        seen[shape] = status


def test_no_two_statuses_share_a_word() -> None:
    keys = word_keys()
    assert len(set(keys.values())) == len(keys), f"duplicate label keys: {keys}"
    # Distinct keys pointing at one string is the same failure one level down.
    i18n = I18N_TS.read_text(encoding="utf-8")
    english: dict[str, str] = {}
    for status, key in keys.items():
        m = re.search(rf'"{re.escape(key)}":\s*"([^"]+)"', i18n)
        assert m, f"{key} has no English entry"
        english[status] = m.group(1)
    assert len(set(english.values())) == len(english), f"duplicate English labels: {english}"


def test_the_chip_renders_the_icon_and_the_word_together() -> None:
    """Both encodings must reach the same element. A file that DEFINES an icon
    map and renders only the word passes every check above."""
    body = re.search(r"export function StatusChip\(.*?\n\}", chip_source(), re.DOTALL)
    assert body, "StatusChip not found"
    assert "<StatusIcon" in body.group(0), "the chip does not render its icon"
    assert "<T k=" in body.group(0), "the chip does not render its word"


# --------------------------------------- 2. the high-contrast token set


def high_contrast_tokens() -> dict[str, str]:
    block = re.search(
        r'\[data-contrast="high"\]\s*\{(.*?)\n\}', CSS.read_text(encoding="utf-8"), re.DOTALL
    )
    assert block, "no [data-contrast=high] block found"
    return dict(re.findall(r"--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", block.group(1)))


def test_the_high_contrast_set_overrides_every_family_the_default_set_defines() -> None:
    """A partial override is the dangerous shape: one family left at its default
    tint on a white high-contrast card is invisible, and only in that mode."""
    default_families = {n.rsplit("-", 1)[0] for n in tokens() if n.endswith(("-fg", "-bg", "-line"))}
    hc_families = {
        n.rsplit("-", 1)[0] for n in high_contrast_tokens() if n.endswith(("-fg", "-bg", "-line"))
    }
    missing = default_families - hc_families
    assert not missing, f"families with no high-contrast override: {sorted(missing)}"


def _hc_cases() -> list[tuple[str, str, str, str, float]]:
    """The same generated rules as the default set, over the overridden values."""
    hc = high_contrast_tokens()
    cases: list[tuple[str, str, str, str, float]] = []
    for name, value in sorted(hc.items()):
        if name.endswith("-fg"):
            family = name[: -len("fg")]
            backdrops = [(s, hc[s]) for s in SURFACES if s in hc]
            if f"{family}bg" in hc:
                backdrops.append((f"{family}bg", hc[f"{family}bg"]))
            cases += [(name, label, value, bg, TEXT_MIN) for label, bg in backdrops]
        elif name.endswith("-line"):
            cases += [
                (name, s, value, hc[s], NON_TEXT_MIN) for s in ("surface", "canvas") if s in hc
            ]
    for ink in ("ink", "ink-2", "ink-3"):
        if ink in hc:
            cases += [(ink, s, hc[ink], hc[s], TEXT_MIN) for s in (*SURFACES, "sunken") if s in hc]
    return cases


@pytest.mark.parametrize("name,backdrop,fg,bg,minimum", _hc_cases())
def test_high_contrast_mode_meets_the_same_floors_as_the_default(
    name: str, backdrop: str, fg: str, bg: str, minimum: float
) -> None:
    ratio = contrast(fg, bg)
    assert ratio >= minimum, (
        f'[data-contrast="high"] --color-{name} on {backdrop}: {ratio:.2f}:1 < {minimum}'
    )


def test_high_contrast_is_actually_higher() -> None:
    """The name is a claim. Body text on a card has to GAIN, not merely change."""
    d, hc = tokens(), high_contrast_tokens()
    before = contrast(d["ink"], d["surface"])
    after = contrast(hc["ink"], hc["surface"])
    assert after > before, f"high contrast is {after:.2f}:1 against a default of {before:.2f}:1"


# ------------------------------- 3. language never reaches the draft cache


def test_the_draft_request_carries_no_language() -> None:
    """Interface language and draft language are DIFFERENT FACTS.

    The draft's language belongs to the person the draft is about: it is fixture
    data on the persona, hashed into draft_cache_key() through
    DraftSpec.canonical(). The interface language belongs to whoever is holding
    the phone. Wiring the second into the first would change the cache key on
    every request, orphan both committed entries, and put a live model call on
    the 0:55 beat of a 90-second pitch.

    The request schema is the chokepoint, because it is the only place a browser
    could introduce one.
    """
    src = SCHEMAS.read_text(encoding="utf-8")
    m = re.search(r"class DraftIn\(BaseModel\):\s*\n((?:[ ]{4}.*\n|\s*\n)+)", src)
    assert m, "DraftIn not found in app/schemas.py"
    fields = dict(re.findall(r"^[ ]{4}(\w+):\s*([\w\[\], |]+)", m.group(1), re.MULTILINE))
    assert set(fields) == {"level", "spec_name"}, (
        f"DraftIn now carries {sorted(fields)}. If a language field was added, the draft "
        "cache key changes per interface language and both committed entries are orphaned."
    )
    for banned in ("lang", "language", "locale"):
        assert banned not in fields, f"DraftIn.{banned} would couple UI language to the draft cache"


# ------------------------- 4. the six questions, in every offered language


def offered_languages() -> list[str]:
    """The languages the SWITCHER offers, read off the switcher's own list.

    Derived rather than typed out, so adding a language to the interface makes
    this fail loudly here instead of quietly serving English for the six
    sentences that matter most on the screen.
    """
    src = I18N_TS.read_text(encoding="utf-8")
    block = re.search(r"export const LANGS[^=]*=\s*\[(.*?)\];", src, re.DOTALL)
    assert block, "LANGS not found in lib/i18n.ts"
    codes = re.findall(r'code:\s*"(\w+)"', block.group(1))
    assert len(codes) >= 2, f"parsed only {codes}"
    return [c for c in codes if c != "en"]  # `en` is the prompt itself


def _prompt_cases() -> list[tuple[str, str]]:
    from fairslip.extract_schema import WORKER_ONLY_FIELDS

    return [(f, lang) for f in sorted(WORKER_ONLY_FIELDS) for lang in offered_languages()]


@pytest.mark.parametrize("field,lang", _prompt_cases())
def test_every_worker_question_exists_in_every_offered_language(field: str, lang: str) -> None:
    """Derived over WORKER_ONLY_FIELDS x LANGS, both read from their sources.

    These six are the only sentences on the screen that ASK the worker for
    something. A missing one does not break the page - it falls back to marked
    English - but it is the fallback least worth relying on, so it is the one
    held to a full matrix.
    """
    from fairslip.extract_schema import WORKER_PROMPTS_I18N

    got = WORKER_PROMPTS_I18N.get(field, {}).get(lang, "")
    assert got.strip(), f"no {lang} for the {field} question"


def test_the_translated_questions_are_not_copies_of_the_english() -> None:
    """A dict full of English passes every presence check above while
    translating nothing."""
    from fairslip.extract_schema import WORKER_ONLY_FIELDS, WORKER_PROMPTS, WORKER_PROMPTS_I18N

    for field in sorted(WORKER_ONLY_FIELDS):
        english = WORKER_PROMPTS[field]
        for lang, text in WORKER_PROMPTS_I18N.get(field, {}).items():
            assert text != english, f"{field} in {lang} is the English string"


def test_the_api_ships_the_translations_with_the_question() -> None:
    """The screen must be able to reach them. A translation table nobody
    serializes is the wired-mechanism-does-nothing class again."""
    schemas = SCHEMAS.read_text(encoding="utf-8")
    block = re.search(r"class WorkerFieldOut\(BaseModel\):(.*?)\n\n\n", schemas, re.DOTALL)
    assert block, "WorkerFieldOut not found"
    assert "prompt_i18n" in block.group(1), "WorkerFieldOut does not carry prompt_i18n"
    main = (REPO / "backend" / "app" / "main.py").read_text(encoding="utf-8")
    assert "prompt_i18n=WORKER_PROMPTS_I18N" in main, "the endpoint never fills prompt_i18n"


# ------------------------------ 5. the coverage chips, encoded redundantly

CHIP_COVERAGE_TSX = REPO / "frontend" / "app" / "ui" / "CoverageChip.tsx"


def _union(field: str, type_name: str) -> list[str]:
    """The members of a union declared inside a type in lib/api.ts.

    Read off the type rather than typed here, for the reason in
    .claude/rules/honesty.md: these tests say "every outcome" and "every kind",
    so their cases have to come from the thing that defines them."""
    src = API_TS.read_text(encoding="utf-8")
    block = re.search(rf"export type {type_name} = \{{(.*?)\n\}};", src, re.DOTALL)
    assert block, f"{type_name} not found in lib/api.ts"
    line = re.search(rf"{field}:([^;]+);", block.group(1))
    assert line, f"{type_name}.{field} not found"
    members = re.findall(r'"([A-Z_]+)"', line.group(1))
    assert len(members) >= 2, f"{type_name}.{field} has {members}"
    return members


def _record(name: str, keys: list[str]) -> dict[str, str]:
    """One TSX record, sliced by its own keys.

    The keys are known - they are the union - so each value is the text between
    one key and the next. Enough to compare shapes for distinctness, which is
    the only question here."""
    src = CHIP_COVERAGE_TSX.read_text(encoding="utf-8")
    start = src.index(f"const {name}")
    open_i = src.index("{", src.index("=", start))
    depth, j = 0, open_i
    while j < len(src):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    body = src[open_i + 1 : j]
    positions = sorted((body.index(f"{k}:"), k) for k in keys)
    out: dict[str, str] = {}
    for n, (pos, key) in enumerate(positions):
        end = positions[n + 1][0] if n + 1 < len(positions) else len(body)
        out[key] = re.sub(r"\s+", " ", body[pos + len(key) + 1 : end]).strip().rstrip(",")
    return out


@pytest.mark.parametrize(
    "type_name,field,prefix",
    [("ResidencyOutcome", "outcome", "OUTCOME"), ("NotEncoded", "kind", "KIND")],
)
def test_every_coverage_chip_state_has_a_shape_a_tone_and_a_word(
    type_name: str, field: str, prefix: str
) -> None:
    """WCAG 1.4.1 again, on the screen that describes the product's reach.

    The state that matters most here is STATED_NOT_CHECKED - the weakest claim
    on the page - and it must not be able to pass for a refusal because two grey
    chips look alike from five metres."""
    members = _union(field, type_name)
    for record in (f"{prefix}_ICON", f"{prefix}_TONE", f"{prefix}_WORDS"):
        assert set(_record(record, members)) == set(members), f"{record} does not cover {members}"


@pytest.mark.parametrize(
    "type_name,field,prefix",
    [("ResidencyOutcome", "outcome", "OUTCOME"), ("NotEncoded", "kind", "KIND")],
)
def test_no_two_coverage_chips_in_one_set_share_a_shape_a_tone_or_a_word(
    type_name: str, field: str, prefix: str
) -> None:
    members = _union(field, type_name)
    for record in (f"{prefix}_ICON", f"{prefix}_TONE", f"{prefix}_WORDS"):
        values = list(_record(record, members).values())
        assert len(set(values)) == len(values), f"{record} repeats a value: {values}"


def test_every_coverage_chip_word_is_a_key_the_dictionary_defines() -> None:
    """A chip whose label key does not exist would render the key itself - the
    one thing the translation rule in lib/i18n.ts says never to show."""
    dictionary = I18N_TS.read_text(encoding="utf-8")
    for type_name, field, prefix in (
        ("ResidencyOutcome", "outcome", "OUTCOME"),
        ("NotEncoded", "kind", "KIND"),
    ):
        for key in _record(f"{prefix}_WORDS", _union(field, type_name)).values():
            # `key` arrives with its quotes, so this is the dictionary's own
            # two-space-indented `"scale.x.Y":` line and nothing looser.
            assert f"  {key}:" in dictionary, f"{key} is not a key the dictionary defines"


# --------------------------------------------------- caveats that must not
# ------------------------------------------------------ render in English
#
# THE INVERSE DEFECT, and its registry.
#
# Every other class in docs/debt.md is the product claiming more than it
# established. This one is the product claiming LESS: `ctl.quotedInEnglish`
# says "these are the authority's exact words, and FairSlip has not verified a
# translation of them", and on an English screen there is no translation and
# no boundary to explain. It rendered unconditionally beside every quotation on
# the coverage page, in English, for readers for whom nothing had been
# translated - a caveat the product had not earned.
#
# An unearned caveat is an unestablished statement about the product. It costs
# the same thing as an overclaim: a reader who meets a warning where it does not
# apply cannot tell which of the others are real.
#
# The defect was not that someone forgot the condition at the second call site.
# It was that forgetting was possible - the rule lived as an inline `&&` at one
# site and as nothing at the other, so there were two copies of it and no owner.
# This registry names the ONE file allowed to render each such key, and requires
# that file to gate on language. A third call site fails the build.
CAVEAT_OWNERS: dict[str, str] = {
    "ctl.quotedInEnglish": "QuotedInEnglish.tsx",
    "ctl.disclosure": "Controls.tsx",
    "ctl.untranslatedLegend": "Controls.tsx",
}

# The dictionary and the preference layer NAME these keys without rendering
# them - a type, a lookup table, a test fixture. Only the render sites matter.
_NOT_A_RENDER_SITE = {"i18n.ts", "Prefs.tsx"}


def _tsx_sources() -> dict[str, str]:
    root = REPO / "frontend"
    out: dict[str, str] = {}
    for path in list((root / "app").rglob("*.tsx")) + list((root / "lib").rglob("*.ts")):
        out[path.name] = out.get(path.name, "") + path.read_text(encoding="utf-8")
    return out


@pytest.mark.parametrize("key", sorted(CAVEAT_OWNERS))
def test_each_translation_caveat_is_rendered_in_exactly_one_file(key: str) -> None:
    """A rule with two copies is a rule with no owner."""
    owner = CAVEAT_OWNERS[key]
    renderers = sorted(
        name
        for name, src in _tsx_sources().items()
        if name not in _NOT_A_RENDER_SITE and f'k="{key}"' in src
    )
    assert renderers == [owner], (
        f"{key} is rendered in {renderers}, expected only {owner}. A caveat about "
        f"translation may be written in one place, and that place must own the "
        f"language check - two copies is how the coverage page came to print it "
        f"in English."
    )


@pytest.mark.parametrize("owner", sorted(set(CAVEAT_OWNERS.values())))
def test_every_caveat_owner_gates_on_language(owner: str) -> None:
    """The owner must actually check. Owning the sentence and printing it
    unconditionally is the same defect with a tidier import graph."""
    src = _tsx_sources()[owner]
    gated = 'lang === "en"' in src or 'lang !== "en"' in src
    assert gated, (
        f"{owner} renders a translation caveat and contains no language check. "
        f"In English there is nothing to disclose, and saying so anyway is a "
        f"claim about the product that is not true on that screen."
    )


def test_the_gate_component_returns_nothing_at_all_in_english() -> None:
    """`return null`, not an empty <p>.

    An element that renders no text still renders its margin, its border and its
    padding. On the coverage page that would leave a gap under every quotation
    where a sentence used to be, which is a different way of showing the reader
    that something was withheld from them.
    """
    src = _tsx_sources()["QuotedInEnglish.tsx"]
    assert re.search(r'if \(lang === "en"\) return null;', src), (
        "QuotedInEnglish does not return null for English; it must render "
        "nothing, not an empty element"
    )


# ------------------------------------------- the two-reader comparison (2a)

COMPARISON = REPO / "frontend" / "app" / "check" / "ReaderComparison.tsx"


def comparison_source() -> str:
    assert COMPARISON.exists(), f"{COMPARISON} does not exist"
    return COMPARISON.read_text(encoding="utf-8")


def test_the_tally_and_the_row_chips_share_one_definition_of_status() -> None:
    """The strip says "4 both readers agree" and the rows carry the chips. If
    those came from two different rules they could disagree on screen, and the
    strip is the number a judge reads first.

    One exported function, used by both. Asserted rather than trusted, because
    the drift would be invisible until a field was in the state the two rules
    disagree about.
    """
    src = comparison_source()
    assert "export function effectiveStatus(" in src
    assert "effectiveStatus(f, answers[f.name]" in src, "countFields does not use it"
    assert "const status = effectiveStatus(" in src, "the row chip does not use it"


def test_the_counts_are_counted_and_not_written_down() -> None:
    """Derived by walking the facts. A literal here would be a number about the
    extraction that the extraction did not produce."""
    src = comparison_source()
    body = re.search(r"export function countFields\(.*?\n\}", src, re.DOTALL)
    assert body, "countFields not found"
    assert "c.agreed++" in body.group(0) and "c.missing++" in body.group(0)
    assert not re.search(r"agreed:\s*[1-9]", body.group(0)), "a count is hardcoded"


def test_silence_is_encoded_by_shape_and_position_not_only_colour() -> None:
    """A reader that returned nothing must be visible before anything is read.

    The cell carries a DASHED box where a value would be - a shape, in the
    position the missing value would occupy, beside a full cell. The words stay
    for a screen reader, and the chip beside it says "not established".
    """
    src = comparison_source()
    assert "border-dashed border-missing-line" in src
    assert 'className="sr-only">{t("field.answeredNothing")}' in src
    assert "raw === null || raw === undefined" in src


def test_the_independence_of_the_readers_is_drawn_not_only_stated() -> None:
    """The claim the whole screen rests on.

    Two boxes, a gap between them with nothing crossing it, and both converging
    on the reconciler. The sentence stays as the caption; the diagram is what
    makes it checkable at a glance.
    """
    src = comparison_source()
    fig = re.search(r"function Independence\(.*?\n\}", src, re.DOTALL)
    assert fig, "Independence not found"
    body = fig.group(0)
    assert 'k="readers.noLink"' in body, "the gap is not labelled"
    assert 'k="readers.sameInput"' in body, "the shared source is not shown"
    assert 'k="readers.reconciled"' in body, "the reconciler is not shown"
    assert 'k="check.readersNote"' in body, "the caption was dropped"

