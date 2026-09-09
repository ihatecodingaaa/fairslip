"""The screen's account of where a reading came from must match the backend's.

THE FAILURE THIS PREVENTS. `FALLBACK_CACHE` is a reading that HAS values and is
`ok`: everything about it looks like an answer, and only its label says that a
model was asked and did not give one. A component that renders provenance with
its own ternary - `source === "LIVE" ? ... : ...` - collapses the four states
into two and labels a fallback as a live reading, which is the one sentence this
change exists to make impossible.

So the mapping has ONE owner, frontend/app/check/readerSource.ts, and these
tests hold it to three things:

  1. it covers exactly the sources the backend can send - derived from
     fairslip.extract, not from a list retyped here;
  2. the four states keep four distinct wordings, and the fallback's names both
     halves of what happened;
  3. no component decides for itself - not which words go with which source,
     and not which of the two latencies may be shown.

Python testing TypeScript by reading it is the house pattern (see
tests/test_inclusion.py and tests/test_design_tokens.py). It is a text scan, and
a text scan is worth having here because the rule it guards is a rule about what
appears in a file.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from fairslip.extract import READER_SOURCES, SOURCE_FALLBACK_CACHE, SOURCE_LIVE

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND = REPO / "frontend"
OWNER = FRONTEND / "app" / "check" / "readerSource.ts"
I18N = FRONTEND / "lib" / "i18n.ts"
API_TS = FRONTEND / "lib" / "api.ts"

# The screens that render a reader's provenance. Named rather than globbed: the
# point is that these two agree with each other and with the owner, and a glob
# would silently stop covering one if it were renamed.
RENDERERS = ("ReaderStrip.tsx", "EvidenceLens.tsx")


def _owner_source() -> str:
    assert OWNER.is_file(), f"{OWNER} is missing; the provenance mapping has no owner"
    return OWNER.read_text(encoding="utf-8")


def _label_map() -> dict[str, str]:
    """SOURCE_LABEL_KEY, parsed out of the owner module."""
    block = re.search(
        r"export const SOURCE_LABEL_KEY[^{]*\{(.*?)\};", _owner_source(), re.DOTALL
    )
    assert block, "SOURCE_LABEL_KEY was not found in readerSource.ts"
    pairs = re.findall(r"(\w+):\s*\"([^\"]+)\"", block.group(1))
    assert pairs, "SOURCE_LABEL_KEY parsed to nothing; its shape changed"
    return dict(pairs)


def _en_dictionary() -> dict[str, str]:
    src = I18N.read_text(encoding="utf-8")
    block = re.search(r"^const en = \{(.*?)^\} as const;", src, re.DOTALL | re.MULTILINE)
    assert block, "the English dictionary was not found in lib/i18n.ts"
    return dict(re.findall(r'^  "([^"]+)":\s*\n?\s*"([^"]*)"', block.group(1), re.MULTILINE))


def _tsx_sources() -> dict[str, str]:
    out: dict[str, str] = {}
    for path in (FRONTEND / "app").rglob("*.tsx"):
        out[str(path.relative_to(FRONTEND))] = path.read_text(encoding="utf-8")
    assert out, "no components found; these tests would pass by examining nothing"
    return out


# --------------------------------------------------------------------------
# 1. The two ends agree on what the states ARE
# --------------------------------------------------------------------------


def test_the_screen_knows_exactly_the_sources_the_backend_can_send() -> None:
    """Derived from the engine's own constants. A source added in Python with no
    words on the screen would otherwise reach a viewer as a blank label, and one
    removed would leave a dead branch that reads as still supported."""
    declared = re.search(
        r"export const READER_SOURCES[^=]*=\s*\[(.*?)\]", _owner_source(), re.DOTALL
    )
    assert declared, "READER_SOURCES was not found in readerSource.ts"
    on_screen = set(re.findall(r'"([A-Z_]+)"', declared.group(1)))

    assert on_screen == set(READER_SOURCES), (
        f"only in the backend: {set(READER_SOURCES) - on_screen}; "
        f"only on the screen: {on_screen - set(READER_SOURCES)}"
    )


def test_the_api_type_lists_exactly_those_sources_too() -> None:
    """`ReaderSource` in api.ts is what typechecks every component. If it drifts
    from the engine, TypeScript enforces the wrong set with total confidence."""
    src = API_TS.read_text(encoding="utf-8")
    block = re.search(r"export type ReaderSource =(.*?);", src, re.DOTALL)
    assert block, "ReaderSource was not found in lib/api.ts"
    assert set(re.findall(r'"([A-Z_]+)"', block.group(1))) == set(READER_SOURCES)


@pytest.mark.parametrize("source", sorted(READER_SOURCES))
def test_every_source_has_words_and_the_dictionary_defines_them(source: str) -> None:
    """Cases derived from the engine's constants, so a new source cannot be
    added without this failing until it has been given something to say."""
    labels = _label_map()
    assert source in labels, f"{source} has no label key"
    key = labels[source]
    assert key in _en_dictionary(), f"{key} is not defined in the English dictionary"


# --------------------------------------------------------------------------
# 2. The four states stay four states
# --------------------------------------------------------------------------


def test_no_two_sources_share_a_label() -> None:
    """Sharing one would merge two claims. The pair that matters is LIVE and
    FALLBACK_CACHE - "a model answered this" and "a model was asked and did
    not" - but any collapse loses a distinction the backend went to trouble to
    keep, so this is checked over the whole map."""
    labels = _label_map()
    assert len(set(labels.values())) == len(labels), f"two sources share a label: {labels}"


def test_the_fallback_label_says_both_that_it_failed_and_that_it_was_replayed() -> None:
    """A fallback is two facts - a call that failed, and a stored reading used
    in its place - and a label carrying only one of them is a half-truth in
    the direction that flatters the system."""
    english = _en_dictionary()
    fallback = english[_label_map()[SOURCE_FALLBACK_CACHE]].lower()

    assert "fail" in fallback, f"the fallback label does not say a call failed: {fallback!r}"
    assert "cache" in fallback or "replay" in fallback, (
        f"the fallback label does not say a stored reading was used: {fallback!r}"
    )
    assert fallback != english[_label_map()[SOURCE_LIVE]].lower()


def test_the_live_label_is_not_used_for_any_other_source() -> None:
    """The single sentence the whole change exists to prevent."""
    labels = _label_map()
    live_key = labels[SOURCE_LIVE]
    for source, key in labels.items():
        if source != SOURCE_LIVE:
            assert key != live_key, f"{source} is labelled with the live wording"


# --------------------------------------------------------------------------
# 3. No component decides any of this for itself
# --------------------------------------------------------------------------


def test_no_component_maps_a_source_to_words_on_its_own() -> None:
    """A rule with two copies is a rule with no owner - the defect behind
    tests/test_inclusion.py's CAVEAT_OWNERS registry. The label keys may appear
    in readerSource.ts and in the dictionary, and nowhere else."""
    keys = set(_label_map().values()) | {"check.answered", "check.didNotAnswer"}
    for name, src in _tsx_sources().items():
        for key in keys:
            assert f'"{key}"' not in src, (
                f"{name} names the label key {key} itself. Render it through "
                f"readerSource.ts instead, so there is one mapping."
            )


def test_answered_is_said_only_where_a_model_answered_or_did_not() -> None:
    """FOUND ON THE SCREEN, NOT IN A TEST.

    The reader strip drove its first chip off `ok`, and `ok` means "this reading
    has values" - which a FALLBACK_CACHE reading does. So production rendered,
    in one row, for one reader:

        Anthropic  claude-haiku-4-5  answered  live call failed - replayed from cache

    "Answered" is a claim about the MODEL; `ok` is a claim about the READING.
    They were the same thing until a fallback existed and are not any more, and
    the two halves of that row contradict each other.

    answeredKey() therefore names only the two states where the question has an
    answer - LIVE and NONE - and returns null on the replayed ones, where the
    source label is the whole account.
    """
    body = re.search(
        r"export function answeredKey\([^)]*\)[^{]*\{(.*?)\n\}", _owner_source(), re.DOTALL
    )
    assert body, "answeredKey was not found in readerSource.ts"
    named = set(re.findall(r'"([A-Z_]+)"', body.group(1)))

    assert named == {"LIVE", "NONE"}, (
        f"answeredKey decides on {sorted(named)}. It may only speak for LIVE and "
        f"NONE; on a replayed reading no model answered, so there is nothing to say."
    )
    assert "null" in body.group(1), "answeredKey must return null where the question does not apply"


def test_the_renderers_gate_the_answered_wording_on_that_helper() -> None:
    """The other half: having given the rule an owner, require the screens to
    ask it rather than testing `ok` for themselves."""
    sources = _tsx_sources()
    for name in RENDERERS:
        src = next(s for path, s in sources.items() if path.endswith(name))
        assert "answeredKey(r)" in src, f"{name} does not ask answeredKey"


def test_no_component_anywhere_words_a_readers_status_off_ok() -> None:
    """SCANNED OVER EVERY COMPONENT, not the two that were being looked at.

    The contradiction was found on the reader strip and turned out to be in FOUR
    places: the strip, the evidence lens, the compact flow tile, and - worst -
    the printed sheet, which is the artefact a worker carries to a counter and
    which had it as a literal, `r.ok ? "answered" : "did not answer"`. Each was
    written separately, at a different time, from the same reasonable-looking
    premise that `ok` means the model answered.

    Two of the four would have survived a test that only checked the two files
    the defect was noticed in, so this checks all of them.
    """
    # `Outcome.ok` is a DIFFERENT `ok` - the discriminated union every API call
    # returns - and `r.ok ? ... r.value : ... r.refusal` is the correct way to
    # narrow it. Those are excluded by what their branches touch, rather than by
    # naming the files that currently do it, so a new API call site is not a
    # failure and a new reader chip still is.
    offenders = []
    for name, src in _tsx_sources().items():
        for m in re.finditer(r"\br\.ok\s*\?", src):
            branches = src[m.end() : m.end() + 160]
            if ".value" in branches or ".refusal" in branches:
                continue
            offenders.append(f"{name}: {branches.strip()[:60]}")

    assert not offenders, (
        "these word a reader's status off `ok`, which means the reading has values - "
        "true of one replayed after a failed call. Ask answeredKey(r) or "
        "printedSource(r):\n  " + "\n  ".join(offenders)
    )


def test_the_printed_sheet_names_the_source_and_not_only_whether_there_are_values() -> None:
    """The printed sheet has no colour, no tooltip and no second line, and it is
    the copy that reaches the person who can act on it. It gets the full phrase
    for all four states, and the fallback's phrase carries the reason."""
    sheet = next(
        src for path, src in _tsx_sources().items() if path.endswith("PrintSheet.tsx")
    )
    assert "printedSource(r)" in sheet, "the printed sheet does not name each reading's source"

    body = re.search(
        r"export function printedSource\([^)]*\)[^{]*\{(.*?)\n\}", _owner_source(), re.DOTALL
    )
    assert body, "printedSource was not found in readerSource.ts"
    named = set(re.findall(r'case "([A-Z_]+)"', body.group(1)))
    assert named == set(READER_SOURCES), (
        f"printedSource covers {sorted(named)}; on paper an unnamed state prints as "
        f"nothing at all, so every source needs its own words"
    )
    assert "live_error" in body.group(1), (
        "the printed fallback phrase does not carry why the live call failed"
    )


@pytest.mark.parametrize("field", ["entry_latency_ms", "live_latency_ms"])
def test_no_component_reaches_for_a_latency_field_directly(field: str) -> None:
    """THE TIMING RULE HAS ONE OWNER TOO, requestLatencyMs().

    `entry_latency_ms` was recorded on the day the entry was generated, against
    another network, and the screen printed it beside a cache chip once already:
    "from cache 3688 ms" for a replay that took about a millisecond
    (docs/debt.md, cached-path-wearing-a-live-timing). `live_latency_ms` is the
    right number but only on a path where a call was actually made, which is a
    condition a component can forget.

    So neither is read in a component. Both are read in readerSource.ts, which
    is where the condition lives.
    """
    for name, src in _tsx_sources().items():
        assert f".{field}" not in src, (
            f"{name} reads {field} directly. Use requestLatencyMs(r), which returns "
            f"a duration only for a call that actually happened."
        )


def test_the_renderers_go_through_the_owner() -> None:
    """The other half of the rule above: having forbidden the direct route, this
    requires the components that show provenance to take the indirect one -
    otherwise they could satisfy every test here by showing nothing at all."""
    sources = _tsx_sources()
    for name in RENDERERS:
        matches = [src for path, src in sources.items() if path.endswith(name)]
        assert matches, f"{name} was not found; RENDERERS is out of date"
        src = matches[0]
        assert "SOURCE_LABEL_KEY[r.source]" in src, f"{name} does not render the source label"
        assert "requestLatencyMs(r)" in src, f"{name} does not render a request latency"


def test_the_fallbacks_failed_call_is_shown_and_not_only_stored() -> None:
    """`live_error` reaching the wire is worth nothing if no screen prints it.
    A fallback reading is `ok` and has values, so without this the viewer is
    shown numbers with no indication a model failed to produce them."""
    sources = _tsx_sources()
    for name in RENDERERS:
        src = next(s for path, s in sources.items() if path.endswith(name))
        assert "live_error" in src, (
            f"{name} never renders live_error, so a fallback reading appears on "
            f"screen with no sign that the model was asked and did not answer"
        )
        assert "FALLBACK_CACHE" in src
