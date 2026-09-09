"""The reader execution policy: which of three things happened, and to whom.

FairSlip was cache-first. A document whose bytes matched a committed entry was
answered without either model being called - correct by the old contract, and
the wrong default for a system whose claim is that two models independently read
the worker's document. FAIRSLIP_READER_MODE now states the policy:

    live              always call; never read an entry; a failure is the answer
    live_then_cache   the default. Call; ONLY on failure may an entry stand in
    cache             entries only; never touch the network

WHAT THESE TESTS ARE FOR. The policy is worth nothing if the response cannot say
which path it took, so every case below asserts the SOURCE as well as the
values. Three claims must stay distinguishable, because collapsing any two of
them is how a product comes to describe a replay as a reading:

    LIVE            this model was called for this request and answered
    CACHE           no model call produced this reading for this request
    FALLBACK_CACHE  a live call was ATTEMPTED, FAILED, and an entry was replayed

No network, no keys, no cost: the readers here are stubs that count their calls,
and "zero network calls" is asserted as zero calls to a reader that raises if it
is called at all.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from fairslip.extract import (
    DEFAULT_READER_MODE,
    MODE_CACHE,
    MODE_LIVE,
    MODE_LIVE_THEN_CACHE,
    READER_MODE_ENV,
    READER_MODES,
    SOURCE_CACHE,
    SOURCE_FALLBACK_CACHE,
    SOURCE_LIVE,
    SOURCE_NONE,
    SOURCES_BY_MODE,
    ExtractionError,
    ImageInput,
    ReaderModeError,
    read_for_request,
    reader_field_order,
    resolve_reader_mode,
    write_cache_entry,
)

LIVE_ANSWER = "18"
CACHED_ANSWER = "13"  # deliberately different, so a replay is visible in the values
FAILURE = "APIConnectionError: connection refused"


class _Stub:
    """A reader that answers, and counts how many times it was asked."""

    key = "reader_a"
    label = "Stub A"
    provider = "test"

    def __init__(self, model: str = "stub-1", answer: str = LIVE_ANSWER) -> None:
        self.model = model
        self.answer = answer
        self.calls = 0

    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        self.calls += 1
        return {**dict.fromkeys(reader_field_order()), "ot_hours": self.answer}


class _Failing(_Stub):
    """A reader whose live call fails. Still counts the attempt: a mode that
    falls back must be shown to have TRIED first."""

    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        self.calls += 1
        raise ExtractionError(FAILURE)


class _NeverCall(_Stub):
    """Calling this is the failure. `cache` mode must not reach the network, and
    a call counter proves that only if something also proves the counter is
    consulted - this raises, so an unexpected call cannot pass quietly."""

    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        raise AssertionError("cache mode called the network")


def _images(data: bytes = b"payslip-bytes") -> tuple[ImageInput, ...]:
    return (ImageInput(role="payslip", media_type="image/png", data=data),)


def _commit_entry(tmp_path: Path, model: str = "stub-1") -> None:
    """Put a committed entry on disk for `model`, holding CACHED_ANSWER. Uses the
    one deliberate writer, so the entry is byte-identical to a real one."""
    write_cache_entry(_Stub(model=model, answer=CACHED_ANSWER), _images(), tmp_path)


# --------------------------------------------------------------------------
# live: always call, never read an entry, never fall back
# --------------------------------------------------------------------------


def test_live_ignores_a_committed_entry_and_calls_the_reader(tmp_path: Path) -> None:
    """The entry exists and matches. `live` must not look at it."""
    _commit_entry(tmp_path)
    r = _Stub()

    out = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE)

    assert r.calls == 1, "live did not call the reader"
    assert out.source == SOURCE_LIVE
    assert out.values["ot_hours"] == LIVE_ANSWER, "a committed entry displaced the live answer"
    assert out.from_cache is False


def test_live_reader_failure_does_not_fall_back_even_with_an_entry_present(
    tmp_path: Path,
) -> None:
    """The case the mode exists for. A usable entry is sitting on disk; `live`
    reports the failure anyway, because the point of the mode is to prove
    whether the model answered, and a fallback would destroy that proof."""
    _commit_entry(tmp_path)
    r = _Failing()

    out = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE)

    assert r.calls == 1
    assert out.source == SOURCE_NONE
    assert out.ok is False
    assert out.values == {}, "live fell back to a committed entry"
    assert FAILURE in (out.error or ""), "the real reader failure was not reported"
    assert FAILURE in (out.live_error or "")
    assert out.live_attempted is True


def test_live_failure_reports_the_readers_own_words(tmp_path: Path) -> None:
    """Not a generic 'extraction unavailable'. An operator reading this must be
    able to tell a missing key from a refusal from a network fault."""
    out = read_for_request(_Failing(), _images(), tmp_path, mode=MODE_LIVE)
    assert out.error == FAILURE
    assert out.error == out.live_error, "two descriptions of one failure"


# --------------------------------------------------------------------------
# live_then_cache: call first; an entry may stand in ONLY for a failed call
# --------------------------------------------------------------------------


def test_live_then_cache_prefers_the_live_answer_even_when_an_entry_exists(
    tmp_path: Path,
) -> None:
    """A successful live reading is NEVER replaced by a cached one. The entry
    holds a different value, so a replay would be visible in the output."""
    _commit_entry(tmp_path)
    r = _Stub()

    out = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    assert r.calls == 1
    assert out.source == SOURCE_LIVE
    assert out.values["ot_hours"] == LIVE_ANSWER
    assert out.from_cache is False
    assert out.live_error is None


def test_live_then_cache_falls_back_only_after_the_live_call_failed(tmp_path: Path) -> None:
    """The fallback path, and the two things it must not lose: that a call was
    made, and that it failed."""
    _commit_entry(tmp_path)
    r = _Failing()

    out = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    assert r.calls == 1, "it fell back without trying"
    assert out.source == SOURCE_FALLBACK_CACHE
    assert out.values["ot_hours"] == CACHED_ANSWER, "the committed entry was not used"
    assert out.ok is True, "a fallback reading has values and is reconcilable"
    assert out.from_cache is True


def test_a_fallback_never_hides_the_live_attempt_that_failed(tmp_path: Path) -> None:
    """THE CENTRAL HONESTY CLAIM OF THE FALLBACK. The reading has values and is
    `ok`, so nothing else on it says a model failed. `live_error` does, and it
    survives all the way onto the wire."""
    _commit_entry(tmp_path)

    out = read_for_request(_Failing(), _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    assert out.live_attempted is True
    assert out.live_error == FAILURE
    assert out.source != SOURCE_LIVE, "a fallback was labelled as a live reading"
    assert out.error is None, "`error` means the reading has no values; this one has values"


def test_a_fallback_carries_the_duration_of_the_call_that_failed(tmp_path: Path) -> None:
    """Real latency, for the attempt that actually happened. The entry's own
    stored latency is kept apart under its own name and describes another day.
    See docs/debt.md, cached-path-wearing-a-live-timing."""
    _commit_entry(tmp_path)

    out = read_for_request(_Failing(), _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    assert out.live_latency_ms is not None and out.live_latency_ms >= 0
    assert out.entry_latency_ms is not None, "the entry's own timing is still carried"


def test_live_then_cache_with_a_failed_call_and_no_entry_reports_the_failure(
    tmp_path: Path,
) -> None:
    """Nothing to fall back on. This is a reader outage, reported as one - never
    an empty reading, which would read as 'the document does not show this'."""
    r = _Failing()

    out = read_for_request(r, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    assert r.calls == 1
    assert out.source == SOURCE_NONE
    assert out.ok is False
    assert out.values == {}
    assert out.error == FAILURE
    assert out.cache_key, "the absent entry is named, so it can be generated"


def test_live_then_cache_is_the_default(tmp_path: Path) -> None:
    """The mode a deployment gets by forgetting to set one calls both models."""
    assert DEFAULT_READER_MODE == MODE_LIVE_THEN_CACHE
    _commit_entry(tmp_path)
    r = _Stub()
    out = read_for_request(r, _images(), tmp_path)  # no mode argument
    assert r.calls == 1
    assert out.source == SOURCE_LIVE


# --------------------------------------------------------------------------
# cache: entries only, and the network is never touched
# --------------------------------------------------------------------------


def test_cache_mode_hit_makes_zero_network_calls(tmp_path: Path) -> None:
    _commit_entry(tmp_path)
    r = _NeverCall()

    out = read_for_request(r, _images(), tmp_path, mode=MODE_CACHE)

    assert out.source == SOURCE_CACHE
    assert out.values["ot_hours"] == CACHED_ANSWER
    assert out.live_attempted is False
    assert out.live_error is None
    assert out.live_latency_ms is None, "a duration for a call that never happened"


def test_cache_mode_miss_makes_zero_network_calls_and_reports_the_absence(
    tmp_path: Path,
) -> None:
    """The offline path with nothing to serve. It must not quietly reach for the
    network, and it must not return an empty reading that reads as 'the document
    does not show this'."""
    r = _NeverCall()

    out = read_for_request(r, _images(), tmp_path, mode=MODE_CACHE)

    assert out.source == SOURCE_NONE
    assert out.ok is False
    assert out.values == {}
    assert out.live_attempted is False, "nothing was called, so nothing failed"
    assert out.live_error is None
    assert "no committed cache entry" in (out.error or "")
    assert READER_MODE_ENV in (out.error or ""), "the error must name the policy in force"
    assert out.cache_key in (out.error or ""), "the error must name the entry to generate"


def test_cache_mode_never_says_a_reader_could_not_be_reached(tmp_path: Path) -> None:
    """"Could not be reached" is a claim about a call that was made. In cache
    mode none is, and describing an untried reader as unreachable reports a
    network problem that did not happen."""
    from fairslip.extract import reconcile

    unread = read_for_request(_NeverCall(), _images(), tmp_path, mode=MODE_CACHE)
    other = read_for_request(_NeverCall(), _images(b"other"), tmp_path, mode=MODE_CACHE)
    reasons = {rec.fact.source for rec in reconcile((unread, other)).values()}

    assert reasons, "reconciliation produced no facts to check"
    for reason in reasons:
        assert "could not be reached" not in reason
        assert "was not called" in reason


# --------------------------------------------------------------------------
# One reader live, the other not. The mixed case is the one hand-written
# summaries get wrong, so it is asserted per reader rather than in aggregate.
# --------------------------------------------------------------------------


def test_one_reader_live_and_one_fallback_are_represented_independently(
    tmp_path: Path,
) -> None:
    """Anthropic answers, OpenAI fails and is replayed. Neither reading may be
    described by the other's provenance."""
    _commit_entry(tmp_path, model="stub-b")
    live_reader = _Stub(model="stub-a")
    failing_reader = _Failing(model="stub-b")
    failing_reader.key, failing_reader.label = "reader_b", "Stub B"

    a = read_for_request(live_reader, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)
    b = read_for_request(failing_reader, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    assert a.source == SOURCE_LIVE
    assert a.live_error is None
    assert a.values["ot_hours"] == LIVE_ANSWER

    assert b.source == SOURCE_FALLBACK_CACHE
    assert b.live_error == FAILURE
    assert b.values["ot_hours"] == CACHED_ANSWER

    assert a.source != b.source, "two different provenances collapsed into one"


def test_a_mixed_run_still_reconciles_on_the_values_alone(tmp_path: Path) -> None:
    """RECONCILIATION SEMANTICS ARE UNCHANGED. AGREED requires two values that
    normalise equally, and it does not care where either one came from - a live
    reading and a replayed one that say 18 still agree. Provenance is reported
    beside the verdict, never folded into it."""
    from fairslip.extract import reconcile

    _commit_entry(tmp_path, model="stub-b")  # the entry holds CACHED_ANSWER

    # Reader A answers live with the same value the entry holds, so the two
    # readings agree while coming from different places.
    live = read_for_request(_Stub(model="stub-a", answer=CACHED_ANSWER), _images(), tmp_path)
    failing = _Failing(model="stub-b")
    failing.key, failing.label = "reader_b", "Stub B"
    fallback = read_for_request(failing, _images(), tmp_path, mode=MODE_LIVE_THEN_CACHE)

    rec = reconcile((live, fallback))["ot_hours"]
    assert rec.fact.status.name == "AGREED"
    assert live.source != fallback.source


# --------------------------------------------------------------------------
# The policy table itself
# --------------------------------------------------------------------------

# Every combination the policy can meet: does a committed entry exist, and does
# the live call succeed. Four scenarios, run against every mode.
_SCENARIOS = [
    ("entry, reader answers", True, False),
    ("no entry, reader answers", False, False),
    ("entry, reader fails", True, True),
    ("no entry, reader fails", False, True),
]


@pytest.mark.parametrize("mode", READER_MODES)
def test_every_mode_produces_exactly_the_sources_it_declares(tmp_path: Path, mode: str) -> None:
    """SOURCES_BY_MODE is the declaration; this drives the real function through
    every scenario and requires the observed set to EQUAL it.

    Equality both ways on purpose. A subset check would let a mode declare
    sources it cannot produce - so the table could promise a fallback that the
    branches never take - and no case-by-case test would notice, because each
    one only ever looks at the branch it exercises.
    """
    observed: set[str] = set()
    for label, has_entry, fails in _SCENARIOS:
        run_dir = tmp_path / label.replace(", ", "_").replace(" ", "-")
        run_dir.mkdir()
        if has_entry:
            _commit_entry(run_dir)
        reader = _Failing() if fails else _Stub()
        out = read_for_request(reader, _images(), run_dir, mode=mode)

        assert out.source in SOURCES_BY_MODE[mode], f"{mode}/{label} produced {out.source}"
        if mode == MODE_CACHE:
            assert reader.calls == 0, f"{mode}/{label} called the network"
        else:
            assert reader.calls == 1, f"{mode}/{label} did not call the reader"
        observed.add(out.source)

    assert observed == SOURCES_BY_MODE[mode], (
        f"{mode} declares {sorted(SOURCES_BY_MODE[mode])} but produced {sorted(observed)}"
    )


def test_no_mode_can_return_a_live_label_for_a_reading_a_model_did_not_produce(
    tmp_path: Path,
) -> None:
    """The one-line summary of every rule above, checked over the whole matrix:
    SOURCE_LIVE appears only where the reader was called AND answered."""
    for mode in READER_MODES:
        for label, has_entry, fails in _SCENARIOS:
            run_dir = tmp_path / f"{mode}-{label}".replace(", ", "_").replace(" ", "-")
            run_dir.mkdir()
            if has_entry:
                _commit_entry(run_dir)
            reader = _Failing() if fails else _Stub()
            out = read_for_request(reader, _images(), run_dir, mode=mode)
            if out.source == SOURCE_LIVE:
                assert reader.calls == 1 and not fails, f"{mode}/{label} called a replay live"
                assert out.values["ot_hours"] == LIVE_ANSWER


# --------------------------------------------------------------------------
# Resolving the mode from the environment
# --------------------------------------------------------------------------


def test_an_unset_mode_is_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(READER_MODE_ENV, raising=False)
    assert resolve_reader_mode() == DEFAULT_READER_MODE


def test_an_empty_mode_is_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """An unset variable and one set to "" are the same intent, and a hosting
    dashboard produces the second more often than anyone expects."""
    monkeypatch.setenv(READER_MODE_ENV, "   ")
    assert resolve_reader_mode() == DEFAULT_READER_MODE


@pytest.mark.parametrize("mode", READER_MODES)
def test_every_declared_mode_is_accepted_from_the_environment(
    monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    monkeypatch.setenv(READER_MODE_ENV, mode)
    assert resolve_reader_mode() == mode


@pytest.mark.parametrize("mode", READER_MODES)
def test_case_and_whitespace_are_typing_not_intent(
    monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    monkeypatch.setenv(READER_MODE_ENV, f"  {mode.upper()} ")
    assert resolve_reader_mode() == mode


@pytest.mark.parametrize("bad", ["cached", "offline", "live-then-cache", "true", "1", "none"])
def test_a_value_that_is_not_a_mode_is_refused_by_name(
    monkeypatch: pytest.MonkeyPatch, bad: str
) -> None:
    """NOT defaulted. Every value here is one an operator might type believing
    they had pinned the behaviour, and silently running live_then_cache instead
    would be a policy nobody chose, applied without a word."""
    monkeypatch.setenv(READER_MODE_ENV, bad)
    with pytest.raises(ReaderModeError) as e:
        resolve_reader_mode()
    assert bad in str(e.value), "the refusal does not say what was set"
    for mode in READER_MODES:
        assert mode in str(e.value), "the refusal does not say what is accepted"


def test_read_for_request_refuses_a_mode_it_does_not_implement(tmp_path: Path) -> None:
    """The guard at the other end: a caller passing a mode directly cannot get a
    silent default either."""
    with pytest.raises(ReaderModeError, match="unknown reader mode"):
        read_for_request(_NeverCall(), _images(), tmp_path, mode="probably_live")
