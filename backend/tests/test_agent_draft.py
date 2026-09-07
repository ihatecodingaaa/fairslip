"""The draft: the one place a model speaks, and the cache that replays it.

The constraints on a draft are checked in CODE, after the model has written,
never merely requested in the prompt. A prompt is a request; a check is a
guarantee. Every test here exercises a check.

The cache contract is the extraction cache's, word for word: generated offline,
committed to the repo, read-only at runtime. tests/test_draft_cache_is_populated.py
guards the artefact's existence separately from the code that consumes it.
"""

from __future__ import annotations

import dataclasses
import json
from decimal import Decimal
from pathlib import Path

import pytest

import demo.fixtures as fx
from fairslip import agent
from fairslip.agent import (
    DRAFT_CACHE_HIT,
    DRAFT_CACHE_MISS,
    DRAFT_TEMPLATE_VERSION,
    FORBIDDEN_WORDS,
    Action,
    CitedFigure,
    Draft,
    DraftCacheMissError,
    DraftRejectedError,
    DraftSpec,
    Mandate,
    _build_draft,
    draft_cache_key,
    draft_model,
    draft_prompt,
    load_draft_entry,
    ngo_alternative,
    read_draft_with_cache,
)

D = Decimal


def _spec() -> DraftSpec:
    return fx.rahim_draft_spec()


GOOD_ENGLISH = (
    "Hello. I have a question about my pay for September 2026. "
    "I think the month should have paid $1,462.24 after deductions, but $1,400.00 "
    "reached my bank. That is a difference of $62.24. This is based on the Ministry "
    "of Manpower published rules on overtime and rest-day pay. Could you please check "
    "and explain? I may have misunderstood something, and I would be glad to be corrected."
)
GOOD_TRANSLATED = "আমার বেতন নিয়ে একটি প্রশ্ন আছে। পার্থক্য $62.24। অনুগ্রহ করে দেখুন।"


# --------------------------------------------------------------------------
# The cache key: if a value can change a word of the draft, it is in the key
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("field", "new"),
    [
        ("expected_net", D("999.99")),
        ("net_paid", D("999.99")),
        ("difference", D("999.99")),
        ("salary_period", "October 2026"),
        ("language", "Tamil"),
        ("employer_name", "Acme Pte Ltd"),
        ("flags", ("SOME_FLAG",)),
    ],
)
def test_draft_cache_key_changes_when_any_cited_value_changes(field: str, new: object) -> None:
    """Derived over every field of DraftSpec that can reach the prompt. A field
    left out of canonical() would let a cached draft be replayed for different
    facts, and this is what catches it."""
    base = _spec()
    assert draft_cache_key(base) != draft_cache_key(dataclasses.replace(base, **{field: new}))


def test_draft_cache_key_changes_when_a_cited_figure_changes() -> None:
    base = _spec()
    bumped = dataclasses.replace(
        base,
        figures=(dataclasses.replace(base.figures[0], amount=D("1.23")), *base.figures[1:]),
    )
    assert draft_cache_key(base) != draft_cache_key(bumped)


def test_every_dataclass_field_of_the_spec_reaches_the_canonical_form() -> None:
    """Structural, so a field ADDED to DraftSpec later cannot quietly sit outside
    the key. Derived from dataclasses.fields, not a hand list."""
    canonical = json.loads(_spec().canonical())
    for f in dataclasses.fields(DraftSpec):
        assert f.name in canonical, f"DraftSpec.{f.name} is absent from canonical()"


def test_draft_cache_key_changes_with_the_model() -> None:
    spec = _spec()
    assert draft_cache_key(spec, "model-a") != draft_cache_key(spec, "model-b")


def test_draft_cache_key_changes_with_the_template_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Bumping the template must orphan every committed entry, loudly. If the
    version were not in the key, a draft written under the old rules would be
    replayed as though the new ones had produced it."""
    spec = _spec()
    before = draft_cache_key(spec, "m")
    monkeypatch.setattr(agent, "DRAFT_TEMPLATE_VERSION", DRAFT_TEMPLATE_VERSION + ".bumped")
    assert draft_cache_key(spec, "m") != before


def test_the_key_is_stable_and_full_length() -> None:
    spec = _spec()
    h = draft_cache_key(spec, "model-a")
    assert len(h) == 64
    assert h == draft_cache_key(spec, "model-a")


def test_the_canonical_form_uses_one_decimal_spelling() -> None:
    """docs/debt.md, equal-objects-different-canonical-forms: "62.24" and
    Decimal("62.240") must not produce two keys for one fact by accident - the
    canonical form is str() on the engine's own Decimal, and it is stated."""
    canonical = json.loads(_spec().canonical())
    assert canonical["difference"] == str(_spec().difference)
    assert isinstance(canonical["difference"], str)


# --------------------------------------------------------------------------
# The checks that run on what the model wrote
# --------------------------------------------------------------------------


@pytest.mark.parametrize("word", FORBIDDEN_WORDS)
def test_a_draft_containing_any_forbidden_word_is_rejected(word: str) -> None:
    """Cases derived from FORBIDDEN_WORDS, so a word added to the contract is
    tested without anyone remembering to add a case."""
    spec = _spec()
    with pytest.raises(DraftRejectedError, match="forbids"):
        _build_draft(spec, f"Hello, this pay was {word} to me.", GOOD_TRANSLATED, "m", "MISS", "k")


def test_a_forbidden_word_in_the_translated_text_is_rejected_too() -> None:
    """The check runs on BOTH languages. A guard that fired on only one would be
    docs/debt.md, guard-that-only-fires-on-some-paths."""
    spec = _spec()
    with pytest.raises(DraftRejectedError, match="bengali"):
        _build_draft(spec, GOOD_ENGLISH, "Please, this was underpaid.", "m", "MISS", "k")


def test_a_draft_citing_a_figure_no_engine_produced_is_rejected() -> None:
    spec = _spec()
    with pytest.raises(DraftRejectedError, match="no engine produced"):
        _build_draft(
            spec,
            "The total shortfall is $85.24.",  # the double-counted sum, invented
            GOOD_TRANSLATED,
            "m",
            "MISS",
            "k",
        )


def test_a_draft_that_sums_two_real_figures_is_still_rejected() -> None:
    """The overlapping-figures-summed defect, caught at the draft boundary: both
    inputs are real, the sum is not a figure any engine returned."""
    spec = _spec()
    with pytest.raises(DraftRejectedError):
        _build_draft(spec, "Altogether that is $1,524.48.", GOOD_TRANSLATED, "m", "MISS", "k")


def test_a_clean_draft_is_accepted_and_carries_its_figures() -> None:
    spec = _spec()
    d = _build_draft(spec, GOOD_ENGLISH, GOOD_TRANSLATED, "m", DRAFT_CACHE_MISS, "k")
    assert d.english == GOOD_ENGLISH
    assert d.language == "Bengali"
    assert d.figures_cited == spec.figures
    assert not d.from_cache


def test_every_figure_the_engine_produced_is_allowed_in_the_text() -> None:
    """The other half: the checker must not reject a draft that quotes a real
    engine figure. Derived over every component the breakdown returned."""
    spec = _spec()
    for f in spec.figures:
        _build_draft(spec, f"One line was ${f.display}.", GOOD_TRANSLATED, "m", "MISS", "k")


# --------------------------------------------------------------------------
# The NGO alternative cannot be omitted
# --------------------------------------------------------------------------


def test_the_alternative_field_has_no_default() -> None:
    """Structural: 'shown alongside every draft, not buried' is a field with no
    default, so a Draft without one is unconstructible."""
    alt = {f.name: f for f in dataclasses.fields(Draft)}["alternative"]
    assert alt.default is dataclasses.MISSING
    assert alt.default_factory is dataclasses.MISSING


def test_every_draft_carries_a_non_empty_ngo_alternative() -> None:
    d = _build_draft(_spec(), GOOD_ENGLISH, GOOD_TRANSLATED, "m", "MISS", "k")
    assert d.alternative.options
    names = {o.name for o in d.alternative.options}
    assert any("MWC" in n or "Migrant" in n for n in names)
    assert any("TADM" in n for n in names)
    for o in d.alternative.options:
        assert o.link.startswith("https://")
        assert o.what_they_do


def test_the_alternative_does_not_pressure_the_worker_to_send() -> None:
    alt = ngo_alternative()
    assert "do not have to send" in alt.heading.lower()


# --------------------------------------------------------------------------
# The offline path. THE CONTROL RUN.
# --------------------------------------------------------------------------


def test_allow_live_false_on_an_empty_cache_dir_raises_rather_than_calling_the_model(
    tmp_path: Path,
) -> None:
    """The control. With no committed entry and live calls disabled, the only
    honest outcome is a refusal that names the key that was missing - never a
    silent live call, and never an empty draft."""
    with pytest.raises(DraftCacheMissError) as e:
        read_draft_with_cache(_spec(), cache_dir=tmp_path, allow_live=False)
    assert draft_cache_key(_spec()) in str(e.value)
    assert list(tmp_path.iterdir()) == []  # and it wrote nothing on the way out


def test_the_request_path_never_writes(tmp_path: Path) -> None:
    """The contract says one deliberate script is the only writer. Asserted, not
    described (docs/debt.md, write-path-contradicts-its-own-contract)."""
    with pytest.raises(DraftCacheMissError):
        read_draft_with_cache(_spec(), cache_dir=tmp_path, allow_live=False)
    assert list(tmp_path.iterdir()) == []
    assert load_draft_entry(_spec(), tmp_path) is None
    assert list(tmp_path.iterdir()) == []


def test_a_committed_entry_is_replayed_without_a_model_and_says_it_came_from_cache(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    spec = _spec()
    key = draft_cache_key(spec)
    (tmp_path / f"{key}.json").write_text(
        json.dumps(
            {
                "template_version": DRAFT_TEMPLATE_VERSION,
                "model": draft_model(),
                "language": spec.language,
                "generated_on": "2026-09-07",
                "english": GOOD_ENGLISH,
                "translated": GOOD_TRANSLATED,
            }
        ),
        encoding="utf-8",
    )
    d = read_draft_with_cache(spec, cache_dir=tmp_path, allow_live=False)
    assert d.from_cache
    assert d.cache == DRAFT_CACHE_HIT
    assert d.cache_key == key
    assert d.generated_on == "2026-09-07"
    assert d.english == GOOD_ENGLISH


def test_a_cached_draft_carries_a_date_and_not_a_stored_latency() -> None:
    """docs/debt.md, cached-path-wearing-a-live-timing: a stored duration shown
    beside a cache status reads as timing the request in front of the viewer.
    There is no latency field on Draft at all."""
    names = {f.name for f in dataclasses.fields(Draft)}
    assert "generated_on" in names
    assert not [n for n in names if "latency" in n or "ms" in n]


def test_a_corrupt_entry_is_a_miss_not_a_draft(tmp_path: Path) -> None:
    spec = _spec()
    (tmp_path / f"{draft_cache_key(spec)}.json").write_text("{not json", encoding="utf-8")
    assert load_draft_entry(spec, tmp_path) is None
    with pytest.raises(DraftCacheMissError):
        read_draft_with_cache(spec, cache_dir=tmp_path, allow_live=False)


def test_a_committed_entry_breaking_the_copy_contract_is_rejected_on_the_way_out(
    tmp_path: Path,
) -> None:
    """An entry generated before a rule tightened must not sail through on the
    strength of having been committed. The checks run on replay too."""
    spec = _spec()
    (tmp_path / f"{draft_cache_key(spec)}.json").write_text(
        json.dumps({"english": "You underpaid me.", "translated": GOOD_TRANSLATED}),
        encoding="utf-8",
    )
    with pytest.raises(DraftRejectedError):
        read_draft_with_cache(spec, cache_dir=tmp_path, allow_live=False)


def test_an_entry_for_a_different_model_is_not_replayed(tmp_path: Path) -> None:
    spec = _spec()
    (tmp_path / f"{draft_cache_key(spec, 'some-other-model')}.json").write_text(
        json.dumps({"english": GOOD_ENGLISH, "translated": GOOD_TRANSLATED}), encoding="utf-8"
    )
    assert load_draft_entry(spec, tmp_path, draft_model()) is None


# --------------------------------------------------------------------------
# Through the mandate
# --------------------------------------------------------------------------


def test_draft_at_level_0_is_refused_and_draft_at_level_1_reaches_the_cache(
    tmp_path: Path,
) -> None:
    from fairslip.agent import MandateExceededError

    with pytest.raises(MandateExceededError) as e:
        Mandate(0).act(Action.DRAFT, spec=_spec(), cache_dir=tmp_path, allow_live=False)
    assert e.value.required_level == 1

    # At level 1 the mandate permits it, so the refusal that follows is the
    # cache's, not the mandate's - a different and honest failure.
    with pytest.raises(DraftCacheMissError):
        Mandate(1).act(Action.DRAFT, spec=_spec(), cache_dir=tmp_path, allow_live=False)


# --------------------------------------------------------------------------
# The prompt
# --------------------------------------------------------------------------


def test_the_prompt_never_asks_the_model_to_calculate() -> None:
    p = draft_prompt(_spec()).lower()
    assert "do not calculate anything" in p
    assert "do not add them up" in p


def test_the_prompt_names_every_figure_the_draft_may_use() -> None:
    spec = _spec()
    p = draft_prompt(spec)
    for f in spec.figures:
        assert f"${f.display}" in p, f"{f.label} is not offered to the model"


def test_the_prompt_asks_for_the_workers_language_by_name() -> None:
    assert "Bengali" in draft_prompt(_spec())


def test_a_cited_figure_display_is_the_engines_amount_rounded_only_for_display() -> None:
    f = CitedFigure(label="x", amount=D("62.237762237762"), formula="f", source="s")
    assert f.display == "62.24"
    assert f.amount == D("62.237762237762")  # the exact value is untouched
