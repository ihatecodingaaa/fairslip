"""Reconciliation is pure code, so it is tested with canned reader output.

No API key, no images, no network, no cost. Every test below constructs what the
two readers "said" and checks what the reconciler concluded - which is the only
place a status is ever decided.

The three cases the domain contract names by hand ("18" vs "18.0" AGREES; "18"
vs "13" DISAGREES; a field one reader alone answered is MISSING) are here, plus
the cases that decide whether the system can lie: a reader outage, and a reader
being offered a field it must never see.
"""

from __future__ import annotations

import hashlib
import json
import re
from decimal import Decimal
from pathlib import Path

import pytest

from fairslip.extract import (
    CACHE_HIT,
    CACHE_MISS,
    DOCUMENT_ROLES,
    MODE_CACHE,
    MODE_LIVE,
    MODE_LIVE_THEN_CACHE,
    PROMPT_VERSION,
    READER_MODES,
    SOURCE_CACHE,
    SOURCE_FALLBACK_CACHE,
    SOURCE_LIVE,
    SOURCE_NONE,
    ExtractionError,
    ImageInput,
    ReaderReading,
    _parse_reader_json,
    cache_key,
    normalise,
    read_for_request,
    reader_field_order,
    reader_json_schema,
    reader_prompt,
    reconcile,
    write_cache_entry,
)
from fairslip.extract_schema import READER_FIELDS, WORKER_ONLY_FIELDS
from fairslip.rules import ESTABLISHED, Status

D = Decimal


# --------------------------------------------------------------------------
# Helpers: build a pair of readings without touching a model
# --------------------------------------------------------------------------


def reading(key: str, label: str, **values: str | None) -> ReaderReading:
    """A successful reading. Fields not named are answered null, which is what a
    reader says when the document does not show them."""
    full: dict[str, str | None] = dict.fromkeys(reader_field_order())
    for k, v in values.items():
        assert k in READER_FIELDS, f"{k} is not a reader field"
        full[k] = v
    return ReaderReading(
        key=key,
        label=label,
        model=f"model-{key}",
        provider="test",
        source=SOURCE_LIVE,
        values=full,
    )


def a(**values: str | None) -> ReaderReading:
    return reading("reader_a", "Reader A", **values)


def b(**values: str | None) -> ReaderReading:
    return reading("reader_b", "Reader B", **values)


def _down(key: str, label: str, model: str, error: str = "boom") -> ReaderReading:
    """A reader that was called and failed. `live_error` is what makes this an
    outage rather than a reader that was never asked - the two produce different
    sentences in _missing_reason, because they are different claims."""
    return ReaderReading(
        key=key,
        label=label,
        model=model,
        provider="test",
        source=SOURCE_NONE,
        values={},
        error=error,
        live_error=error,
    )


def status_of(readings: tuple[ReaderReading, ...], name: str) -> Status:
    return reconcile(readings)[name].fact.status


# --------------------------------------------------------------------------
# The three cases the domain contract names
# --------------------------------------------------------------------------


def test_18_and_18_point_0_agree_because_decimals_are_compared_not_strings() -> None:
    """The canonical form is the Decimal. "18" and "18.0" are different strings
    and the same number, and the reconciler compares the number."""
    r = reconcile((a(ot_hours="18"), b(ot_hours="18.0")))["ot_hours"]
    assert r.fact.status is Status.AGREED
    assert r.fact.value == D("18")
    # Both spellings survive on the way out; the screen shows what was said.
    assert r.readings == {"reader_a": "18", "reader_b": "18.0"}


def test_18_and_13_disagree_and_both_readings_are_carried_forward() -> None:
    """The disagreement is the output. Neither value is picked, averaged, or
    preferred by reader order."""
    r = reconcile((a(ot_hours="18"), b(ot_hours="13")))["ot_hours"]
    assert r.fact.status is Status.DISAGREED
    assert r.fact.value == {"reader_a": D("18"), "reader_b": D("13")}
    assert "18" in r.fact.source and "13" in r.fact.source


def test_a_field_only_one_reader_answered_is_missing_not_agreed() -> None:
    """One reader is not agreement. This is the case that would be easiest to
    quietly treat as good enough, and it is exactly the one that must not be."""
    r = reconcile((a(monthly_basic="1200"), b()))["monthly_basic"]
    assert r.fact.status is Status.MISSING
    assert r.fact.value is None
    assert "one reader is not agreement" in r.fact.source


# --------------------------------------------------------------------------
# Normalisation: what counts as the same value
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("left", "right"),
    [
        ("18", "18.0"),
        ("18", " 18 "),
        ("1200", "1,200"),
        ("1200.00", "$1,200.00"),
        ("280", "SGD 280"),
        ("18", "18 hrs"),
        ("8", "8 hours"),
    ],
)
def test_these_pairs_are_the_same_value_written_differently(left: str, right: str) -> None:
    assert normalise(left) == normalise(right)
    assert status_of((a(ot_hours=left), b(ot_hours=right)), "ot_hours") is Status.AGREED


@pytest.mark.parametrize("raw", ["", "   ", "abc", "not shown", "-", "$"])
def test_a_value_that_is_not_a_number_does_not_normalise(raw: str) -> None:
    assert normalise(raw) is None


def test_a_reader_answering_unreadably_is_recorded_as_such_not_as_silence() -> None:
    """"The reader answered 'illegible'" and "the reader answered null" are
    different facts about the reader. Collapsing them would misreport which."""
    r = reconcile((a(ot_hours="18"), b(ot_hours="illegible")))["ot_hours"]
    assert r.fact.status is Status.MISSING
    assert r.unreadable == ("reader_b",)
    assert "not a number" in r.fact.source


# --------------------------------------------------------------------------
# Reader outage: the case where a system would be most tempted to guess
# --------------------------------------------------------------------------


def test_when_one_reader_fails_nothing_is_established_at_all() -> None:
    """A reader outage must not promote the surviving reader to the truth. Every
    field goes to the worker, and the reason names the outage."""
    down = ReaderReading(
        key="reader_b",
        label="Reader B",
        model="model-b",
        provider="test",
        source=SOURCE_NONE,
        values={},
        error="APIConnectionError: connection refused",
        live_error="APIConnectionError: connection refused",
    )
    out = reconcile((a(monthly_basic="1200", ot_hours="18", deductions_total="0"), down))

    for name, rec in out.items():
        assert rec.fact.status is Status.MISSING, f"{name} was established with one reader down"
        assert rec.fact.status not in ESTABLISHED
        assert "could not be reached" in rec.fact.source


def test_both_readers_failing_still_produces_a_fact_per_field_saying_why() -> None:
    """Silence is not an acceptable output. Every field still comes back, MISSING,
    with the reason - so a screen has something true to render."""
    down_a = _down("reader_a", "Reader A", "m-a")
    down_b = _down("reader_b", "Reader B", "m-b")
    out = reconcile((down_a, down_b))

    assert set(out) == set(READER_FIELDS)
    for rec in out.values():
        assert rec.fact.status is Status.MISSING
        assert "could not be reached" in rec.fact.source


def test_a_field_neither_reader_found_says_neither_reader_found_it() -> None:
    """Distinct from the outage reason above: here the readers worked and the
    document simply does not show the field."""
    r = reconcile((a(), b()))["cpf_employee_on_payslip"]
    assert r.fact.status is Status.MISSING
    assert "neither reader found this" in r.fact.source


def test_reconciliation_of_a_single_reading_is_refused() -> None:
    with pytest.raises(ValueError, match="two independent readings"):
        reconcile((a(ot_hours="18"),))


# --------------------------------------------------------------------------
# Every field, every time - quantified names, quantified checks
# --------------------------------------------------------------------------


def test_every_reader_field_is_reconciled_on_every_call() -> None:
    """Derived from READER_FIELDS, so a new reader field fails here until the
    reconciler handles it."""
    out = reconcile((a(), b()))
    assert set(out) == set(READER_FIELDS)
    for name, rec in out.items():
        assert rec.name == name


def test_every_field_agrees_when_both_readers_return_identical_values() -> None:
    """The success state, checked across the whole field set rather than one
    hand-picked field."""
    same = {name: "12" for name in reader_field_order()}
    out = reconcile((a(**same), b(**same)))
    assert set(out) == set(READER_FIELDS)
    for name, rec in out.items():
        assert rec.fact.status is Status.AGREED, name
        assert rec.fact.value == D("12")
        assert rec.fact.established


def test_no_reconciled_fact_ever_carries_a_confidence_number() -> None:
    """Status is the confidence. A Fact has value, status and source, and that
    is the whole of it."""
    from dataclasses import fields as dataclass_fields

    from fairslip.rules import Fact

    assert {f.name for f in dataclass_fields(Fact)} == {"value", "status", "source"}


# --------------------------------------------------------------------------
# The boundary: what a reader is allowed to be asked
# --------------------------------------------------------------------------


def test_the_schema_shown_to_a_reader_contains_no_worker_only_field() -> None:
    schema = reader_json_schema()
    assert set(schema["properties"]) == set(READER_FIELDS)
    assert set(schema["required"]) == set(READER_FIELDS)
    assert schema["additionalProperties"] is False
    for forbidden in WORKER_ONLY_FIELDS:
        assert forbidden not in schema["properties"]


def test_the_prompt_shown_to_a_reader_never_names_a_worker_only_field() -> None:
    """Not just the schema: the prose too. A field named in the instructions is
    a field the model has been invited to think about."""
    images = tuple(
        ImageInput(role=role, media_type="image/png", data=b"x") for role in DOCUMENT_ROLES
    )
    text = reader_prompt(images).lower()
    for forbidden in WORKER_ONLY_FIELDS:
        assert forbidden.replace("_", " ") not in text
        assert forbidden not in text


def test_every_reader_field_is_nullable_so_not_shown_is_always_answerable() -> None:
    """A reader with no way to say "not shown" would have to invent something."""
    props = reader_json_schema()["properties"]
    for name in READER_FIELDS:
        assert props[name]["type"] == ["string", "null"], name


def test_reader_field_order_is_stable_so_the_cache_key_is_stable() -> None:
    assert reader_field_order() == tuple(sorted(READER_FIELDS))
    assert reader_field_order() == reader_field_order()


def test_a_reader_returning_a_field_outside_the_schema_is_an_error() -> None:
    """If a model volunteers residency, that is not a bonus - it is a guess, and
    the whole reading is rejected rather than partly kept."""
    payload = json.dumps({**dict.fromkeys(reader_field_order()), "residency": "CITIZEN"})
    with pytest.raises(ExtractionError, match="outside the schema"):
        _parse_reader_json(payload)


def test_a_reader_returning_something_that_is_not_json_is_an_error() -> None:
    with pytest.raises(ExtractionError, match="did not return JSON"):
        _parse_reader_json("I could not read this payslip, sorry.")


# --------------------------------------------------------------------------
# Cache: generated offline, committed, read-only at runtime
#
# The contract these guard (see the extract.py docstring and docs/debt.md,
# write-path-contradicts-its-own-contract): make_cache_entry.py is the only
# writer; the request path only ever reads; and nothing is silent.
#
# WHICH MODE EACH TEST RUNS UNDER MATTERS, and is always explicit below. Under
# the default (live_then_cache) the cache is not consulted unless a live call
# fails, so a test that means to exercise a committed entry - a corrupt one, a
# stale one, a key that should not match - must ask for MODE_CACHE, or it will
# pass by calling the reader and never opening the file it claims to be about.
# The policy itself is tested in tests/test_reader_mode.py.
# --------------------------------------------------------------------------


class _StubReader:
    key = "reader_a"
    label = "Stub"
    provider = "test"

    def __init__(self, model: str = "stub-1", answer: str = "18") -> None:
        self.model = model
        self.answer = answer
        self.calls = 0

    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        self.calls += 1
        return {**dict.fromkeys(reader_field_order()), "ot_hours": self.answer}


class _FailingReader(_StubReader):
    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        self.calls += 1
        raise ExtractionError("APIConnectionError: connection refused")


def _images(data: bytes = b"payslip-bytes") -> tuple[ImageInput, ...]:
    return (ImageInput(role="payslip", media_type="image/png", data=data),)


# ---- the request path never writes -------------------------------------------


@pytest.mark.parametrize("mode", READER_MODES)
def test_reading_does_not_create_a_cache_entry(tmp_path: Path, mode: str) -> None:
    """THE REGRESSION THIS BLOCK EXISTS FOR. The request path used to write, which
    on a read-only serverless filesystem raised OSError, was swallowed, and
    cached nothing while appearing to work locally. The request path must not
    write at all, so that what happens in production is what happens here.

    Derived over every mode, because the write path has to be absent from all
    three - the mode that calls the models is the one where a "helpfully cache
    what we just read" line would be most tempting to add."""
    r = _StubReader()
    read_for_request(r, _images(), tmp_path, mode=mode)
    assert list(tmp_path.glob("*.json")) == [], f"the request path wrote an entry in {mode}"


def test_two_identical_reads_both_go_live_when_no_entry_is_committed(tmp_path: Path) -> None:
    """Without a committed entry there is no cache, however many times you ask.

    The old test passed because the first call populated the cache for the
    second, which is the behaviour that could never happen in production."""
    r = _StubReader()
    first = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)
    second = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    assert r.calls == 2, "the second read replayed something that was never committed"
    assert first.source == SOURCE_LIVE and second.source == SOURCE_LIVE
    assert first.from_cache is False and second.from_cache is False


# ---- the one deliberate writer ----------------------------------------------


def test_write_cache_entry_commits_an_entry_that_a_later_read_replays(tmp_path: Path) -> None:
    """make_cache_entry.py's path: call for real, write the file, and that file
    is what MODE_CACHE serves afterwards without touching the network."""
    r = _StubReader()
    path, written = write_cache_entry(r, _images(), tmp_path)
    assert path.is_file()
    assert written.values["ot_hours"] == "18"
    assert written.source == SOURCE_LIVE, "the generating call itself was live"

    r2 = _StubReader()
    replayed = read_for_request(r2, _images(), tmp_path, mode=MODE_CACHE)
    assert r2.calls == 0, "the committed entry was not used"
    assert replayed.source == SOURCE_CACHE
    assert replayed.from_cache is True
    assert replayed.values == written.values


def test_a_committed_entry_records_what_it_was_made_from(tmp_path: Path) -> None:
    """An entry that does not say which prompt, model and bytes produced it
    cannot be audited later, and staleness becomes invisible."""
    r = _StubReader()
    path, _ = write_cache_entry(r, _images(b"specific-bytes"), tmp_path)
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload["prompt_version"] == PROMPT_VERSION
    assert payload["model"] == "stub-1"
    assert payload["reader_key"] == "reader_a"
    assert payload["images"][0]["sha256"] == hashlib.sha256(b"specific-bytes").hexdigest()
    assert payload["images"][0]["role"] == "payslip"
    assert payload["values"]["ot_hours"] == "18"


def test_a_failed_reading_is_never_committed(tmp_path: Path) -> None:
    """Committing an outage would turn a transient failure into a permanent
    "this document does not show it" that ships."""
    with pytest.raises(ExtractionError):
        write_cache_entry(_FailingReader(), _images(), tmp_path)
    assert list(tmp_path.glob("*.json")) == []


# ---- nothing is silent ------------------------------------------------------


def test_every_reading_names_the_entry_that_corresponds_to_it(tmp_path: Path) -> None:
    """`cache_key` is a pure function of the reader and the images, carried on
    every reading whatever its source. It is an identity, not a record that a
    lookup happened - what was consulted is what `source` says - and it is there
    so an absent entry can be GENERATED rather than merely noticed."""
    r = _StubReader()
    live = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE)
    assert live.source == SOURCE_LIVE
    assert live.cache_key == cache_key(r, _images())

    write_cache_entry(_StubReader(), _images(), tmp_path)
    cached = read_for_request(_StubReader(), _images(), tmp_path, mode=MODE_CACHE)
    assert cached.source == SOURCE_CACHE
    assert cached.cache_key == cache_key(r, _images())

    unread = read_for_request(_StubReader(), _images(b"other"), tmp_path, mode=MODE_CACHE)
    assert unread.source == SOURCE_NONE
    assert unread.cache_key == cache_key(_StubReader(), _images(b"other"))


def test_provenance_is_stored_once_and_every_other_answer_is_derived() -> None:
    """Two stored fields describing one fact drift apart. `source` is the fact;
    `ok`, `cache` and `from_cache` are properties over it, so there is only one
    thing to get wrong - and `source` has NO DEFAULT, so a reading cannot be
    built without saying where it came from."""
    from dataclasses import fields as dataclass_fields

    stored = {f.name for f in dataclass_fields(ReaderReading)}
    assert "source" in stored
    for derived in ("ok", "cache", "from_cache", "live_attempted"):
        assert derived not in stored, f"{derived} is stored as well as derived"

    with pytest.raises(TypeError):
        ReaderReading("k", "l", "m", "p")  # type: ignore[call-arg]

    vals = {"ot_hours": "18"}
    expected = {
        SOURCE_LIVE: (True, False, CACHE_MISS),
        SOURCE_CACHE: (True, True, CACHE_HIT),
        SOURCE_FALLBACK_CACHE: (True, True, CACHE_HIT),
    }
    for source, (ok, from_cache, cache) in expected.items():
        r = ReaderReading("k", "l", "m", "p", source, vals)
        assert (r.ok, r.from_cache, r.cache) == (ok, from_cache, cache), source

    none = ReaderReading("k", "l", "m", "p", SOURCE_NONE, {}, error="nothing was read")
    assert (none.ok, none.from_cache, none.cache) == (False, False, CACHE_MISS)


def test_a_reading_cannot_claim_values_it_does_not_have_or_hide_that_it_has_none() -> None:
    """`error` says why a reading has no values, so it is set exactly when the
    source is NONE. Either half alone would let a reading be constructed that
    reports a failure while carrying values, or values while reporting none."""
    with pytest.raises(ValueError, match="error"):
        ReaderReading("k", "l", "m", "p", SOURCE_NONE, {})  # no error given
    with pytest.raises(ValueError, match="error"):
        ReaderReading("k", "l", "m", "p", SOURCE_LIVE, {"ot_hours": "18"}, error="down")
    with pytest.raises(ValueError, match="read nothing"):
        ReaderReading("k", "l", "m", "p", SOURCE_NONE, {"ot_hours": "18"}, error="down")
    with pytest.raises(ValueError, match="read nothing"):
        ReaderReading("k", "l", "m", "p", SOURCE_LIVE, {})


def test_a_duration_must_describe_a_call_that_happened() -> None:
    """A latency on a path where no model was called is the defect in
    docs/debt.md, cached-path-wearing-a-live-timing, in its purest form."""
    with pytest.raises(ValueError, match="no live call was made"):
        ReaderReading("k", "l", "m", "p", SOURCE_CACHE, {"ot_hours": "18"}, live_latency_ms=3688)


def test_an_unknown_source_is_refused() -> None:
    with pytest.raises(ValueError, match="unknown reading source"):
        ReaderReading("k", "l", "m", "p", "PROBABLY_LIVE", {"ot_hours": "18"})


# ---- the key is specific to model, prompt and bytes -------------------------
#
# All under MODE_CACHE: the question is whether a committed entry is FOUND, and
# only a mode that reads the cache can answer it.


def test_different_image_bytes_are_a_different_cache_entry(tmp_path: Path) -> None:
    write_cache_entry(_StubReader(), _images(b"one"), tmp_path)
    one = read_for_request(_StubReader(), _images(b"one"), tmp_path, mode=MODE_CACHE)
    two = read_for_request(_StubReader(), _images(b"two"), tmp_path, mode=MODE_CACHE)
    assert one.source == SOURCE_CACHE
    assert two.source == SOURCE_NONE, "a different image replayed another image's reading"


def test_a_different_model_never_replays_another_models_answer(tmp_path: Path) -> None:
    """The cache key carries the model id, so switching readers cannot silently
    attribute one model's reading to another."""
    write_cache_entry(_StubReader(model="stub-1", answer="18"), _images(), tmp_path)
    out = read_for_request(
        _StubReader(model="stub-2", answer="13"), _images(), tmp_path, mode=MODE_CACHE
    )
    assert out.source == SOURCE_NONE
    assert out.values == {}, "stub-2 was handed stub-1's transcription"


def test_the_prompt_version_is_part_of_the_cache_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Change the prompt and every committed entry is a miss, because it was an
    answer to a different question. The key is a hash, so this is checked by
    moving the version and watching the key move, not by looking inside it."""
    r = _StubReader()
    before = cache_key(r, _images())
    monkeypatch.setattr("fairslip.extract.PROMPT_VERSION", PROMPT_VERSION + "-changed")
    assert cache_key(r, _images()) != before


def test_the_model_id_is_part_of_the_cache_key() -> None:
    r = _StubReader()
    before = cache_key(r, _images())
    r.model = "stub-changed"
    assert cache_key(r, _images()) != before


def test_a_committed_entry_is_not_replayed_after_the_prompt_changes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The end-to-end consequence of the key: a prompt edit re-reads rather than
    replaying an answer given to a different question."""
    write_cache_entry(_StubReader(), _images(), tmp_path)
    monkeypatch.setattr("fairslip.extract.PROMPT_VERSION", PROMPT_VERSION + "-changed")

    r = _StubReader()
    out = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)
    assert r.calls == 1
    assert out.source == SOURCE_LIVE

    stale = read_for_request(_StubReader(), _images(), tmp_path, mode=MODE_CACHE)
    assert stale.source == SOURCE_NONE, "an answer to the old prompt was replayed"


# ---- a bad entry is a miss, not a reading -----------------------------------


def test_a_corrupt_cache_entry_is_a_miss_not_a_reading(tmp_path: Path) -> None:
    r = _StubReader()
    (tmp_path / f"{cache_key(r, _images())}.json").write_text("{not json", encoding="utf-8")
    out = read_for_request(r, _images(), tmp_path, mode=MODE_CACHE)
    assert r.calls == 0
    assert out.source == SOURCE_NONE
    assert out.values == {}


def test_an_entry_whose_values_are_not_an_object_is_a_miss(tmp_path: Path) -> None:
    """Half a parsed file is a guess wearing a transcription's clothes."""
    r = _StubReader()
    (tmp_path / f"{cache_key(r, _images())}.json").write_text(
        json.dumps({"values": "not-an-object"}), encoding="utf-8"
    )
    assert read_for_request(r, _images(), tmp_path, mode=MODE_CACHE).source == SOURCE_NONE


def test_an_entry_with_no_values_is_a_miss(tmp_path: Path) -> None:
    """An entry holding `{}` would otherwise replay as a reading in which every
    field is absent - "the document shows none of this" - which is a claim, and
    a different one from "there is no entry"."""
    r = _StubReader()
    (tmp_path / f"{cache_key(r, _images())}.json").write_text(
        json.dumps({"values": {}}), encoding="utf-8"
    )
    assert read_for_request(r, _images(), tmp_path, mode=MODE_CACHE).source == SOURCE_NONE


def test_a_missing_cache_dir_is_a_miss_not_a_crash(tmp_path: Path) -> None:
    absent = tmp_path / "does-not-exist"
    live = read_for_request(_StubReader(), _images(), absent, mode=MODE_LIVE_THEN_CACHE)
    assert live.source == SOURCE_LIVE and live.ok is True

    offline = read_for_request(_StubReader(), _images(), absent, mode=MODE_CACHE)
    assert offline.source == SOURCE_NONE and offline.ok is False


def test_a_failed_read_reports_no_values_rather_than_empty_ones(tmp_path: Path) -> None:
    """An empty reading and a failed reading are different claims."""
    out = read_for_request(_FailingReader(), _images(), tmp_path, mode=MODE_LIVE)
    assert out.values == {}
    assert out.ok is False
    assert out.source == SOURCE_NONE
    assert out.cache_key, "even a failed reading names its corresponding entry"



def test_an_image_with_no_data_is_refused() -> None:
    with pytest.raises(ValueError, match="no image data"):
        ImageInput(role="payslip", media_type="image/png", data=b"")


def test_an_unknown_document_role_is_refused() -> None:
    with pytest.raises(ValueError, match="unknown document role"):
        ImageInput(role="bank_statement", media_type="image/png", data=b"x")


# --------------------------------------------------------------------------
# Reader independence. The second reader exists so that one model family's
# systematic misreading cannot become an AGREED - the one failure two readers
# cannot catch. That only holds if the two are actually independent, so these
# check it rather than trusting the docstring.
#
# This suite exists because extract.py was first built with BOTH readers behind
# one aggregator (OpenRouter), which would have given them one account, one
# balance and one outage. See docs/debt.md, shared-dependency-defeats-the-redundancy.
# --------------------------------------------------------------------------


def test_the_two_default_readers_are_different_vendors() -> None:
    from fairslip.extract import default_readers

    a, b = default_readers()
    assert a.provider != b.provider, "both readers are the same vendor"
    assert a.model != b.model
    assert a.key != b.key


def test_the_two_default_readers_read_different_api_keys() -> None:
    """One key is one account is one balance. If both readers authenticate with
    the same credential, an expiry or an empty balance takes out both at once."""
    import inspect

    from fairslip.extract import ClaudeReader, OpenAIReader

    keys = {}
    for cls in (ClaudeReader, OpenAIReader):
        src = inspect.getsource(cls.__init__)
        found = re.findall(r'os\.getenv\("([A-Z0-9_]*API_KEY)"\)', src)
        assert len(found) == 1, f"{cls.__name__} reads {found} API-key env vars, expected one"
        keys[cls.__name__] = found[0]

    assert len(set(keys.values())) == 2, f"both readers use the same credential: {keys}"


def test_neither_reader_is_routed_through_an_aggregator() -> None:
    """Each vendor's own API, directly. A base_url override in a reader means
    the traffic is going somewhere other than the vendor named in `provider`."""
    import inspect

    from fairslip.extract import ClaudeReader, OpenAIReader

    for cls in (ClaudeReader, OpenAIReader):
        src = inspect.getsource(cls)
        assert "base_url" not in src, (
            f"{cls.__name__} overrides base_url, so it is not calling "
            f"{cls.provider} directly"
        )
        assert "openrouter" not in src.lower()


def test_the_readers_default_to_the_models_the_bake_off_picked() -> None:
    """docs/reader-models.md is the record of the decision; these are the two it
    records. A silent default change would leave that document describing a
    system that no longer exists."""
    from fairslip.extract import ClaudeReader, OpenAIReader

    assert ClaudeReader().model == "claude-haiku-4-5"
    assert OpenAIReader().model == "gpt-5.6-luna"
