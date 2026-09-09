"""POST /extract over the wire, with stub readers. No model is called.

The endpoint's job is to carry the reconciliation unchanged and to keep the two
groups of field apart on the way out. These tests check that it does, and that
the failure modes arrive as themselves: a bad image is a refusal, a reader
outage is a reader outage, and neither is dressed as a reading.
"""

from __future__ import annotations

import base64
from decimal import Decimal

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

extract = pytest.importorskip("fairslip.extract")
main = pytest.importorskip("app.main")

from fairslip.extract_schema import READER_FIELDS, WORKER_ONLY_FIELDS

client = TestClient(main.app)

PNG = base64.standard_b64encode(b"\x89PNG\r\n\x1a\n" + b"fictional-payslip-bytes").decode()


def body(**overrides) -> dict:
    payload = {"images": [{"role": "payslip", "media_type": "image/png", "data_b64": PNG}]}
    payload.update(overrides)
    return payload


class StubReader:
    """Answers from a dict. Never touches the network."""

    provider = "stub"

    def __init__(self, key: str, values: dict[str, str | None] | None = None, fail: str | None = None):
        self.key = key
        self.model = f"stub-{key}"
        self.label = f"Stub {key}"
        self._values = values or {}
        self._fail = fail

    def read(self, images):
        if self._fail:
            raise extract.ExtractionError(self._fail)
        return {**dict.fromkeys(extract.reader_field_order()), **self._values}


@pytest.fixture
def readers(monkeypatch):
    """Install a pair of stub readers and disable the on-disk cache, so no test
    writes into backend/demo/extract_cache or replays a real reading.

    The mode is NOT pinned here. Tests that care set it with `_use_mode`, and
    the rest run under whatever the default is - which is the point: if the
    default ever stops calling the readers, the tests about reconciliation go
    red, rather than quietly asserting things about replayed values.
    """

    def install(a_values=None, b_values=None, a_fail=None, b_fail=None):
        pair = (
            StubReader("reader_a", a_values, a_fail),
            StubReader("reader_b", b_values, b_fail),
        )
        monkeypatch.setattr(main, "default_readers", lambda: pair)
        monkeypatch.setattr(
            main,
            "read_for_request",
            lambda r, images, **kw: extract.read_for_request(r, images, None, **kw),
        )
        return pair

    return install


@pytest.fixture
def use_mode(monkeypatch):
    """Set FAIRSLIP_READER_MODE for one test. The endpoint resolves the mode per
    request, so this reaches it the same way a deployment's setting would."""

    def install(mode: str):
        monkeypatch.setenv(extract.READER_MODE_ENV, mode)

    return install


def post(**kwargs) -> dict:
    r = client.post("/extract", json=body(**kwargs))
    assert r.status_code == 200, r.text
    return r.json()


def _one_image():
    """The exact image tuple `body()` posts, so cache keys line up."""
    return (
        extract.ImageInput(
            role="payslip", media_type="image/png", data=base64.b64decode(PNG)
        ),
    )


def _use_cache_dir(path):
    """Point the endpoint's cache reads at a temp directory. The `readers`
    fixture defaults to no cache at all; this opts a test back in."""
    import app.main as m

    m.read_for_request = lambda r, images, **kw: extract.read_for_request(r, images, path, **kw)


# --------------------------------------------------------------------------
# The two groups arrive separately
# --------------------------------------------------------------------------


def test_the_response_keeps_read_fields_and_worker_fields_in_separate_lists(readers) -> None:
    """The separation is structural. A screen showing one undifferentiated list
    would have to merge these deliberately."""
    readers()
    out = post()

    assert {f["name"] for f in out["read_fields"]} == set(READER_FIELDS)
    assert {f["name"] for f in out["worker_fields"]} == set(WORKER_ONLY_FIELDS)
    assert set(out) >= {"readers", "read_fields", "worker_fields"}


def test_no_worker_field_ever_appears_among_the_read_fields(readers) -> None:
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    out = post()
    read_names = {f["name"] for f in out["read_fields"]}
    assert read_names.isdisjoint(WORKER_ONLY_FIELDS)


def test_every_worker_field_carries_its_question_and_its_reason(readers) -> None:
    """Both ship from the backend. A screen that had to write these itself could
    restate why a field is asked rather than read."""
    readers()
    for f in post()["worker_fields"]:
        assert f["label"].strip()
        assert f["prompt"].strip()
        assert f["why"].strip()
        assert f["required_for"]


def test_net_paid_is_listed_first_among_the_worker_fields(readers) -> None:
    """It is the field that shows why the split exists, so it leads."""
    readers()
    assert post()["worker_fields"][0]["name"] == "net_paid"


def test_net_paid_explains_that_it_is_not_taken_from_the_payslip(readers) -> None:
    readers()
    net = next(f for f in post()["worker_fields"] if f["name"] == "net_paid")
    assert "payslip" in net["why"].lower()
    assert "bank" in net["why"].lower()
    assert "bank" in net["label"].lower()


# --------------------------------------------------------------------------
# Statuses on the wire
# --------------------------------------------------------------------------


def test_matching_readings_arrive_as_agreed(readers) -> None:
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18.0"})
    out = post()
    ot = next(f for f in out["read_fields"] if f["name"] == "ot_hours")
    assert ot["fact"]["status"] == "AGREED"
    assert ot["fact"]["value"] == "18"
    assert ot["readings"] == {"reader_a": "18", "reader_b": "18.0"}


def test_differing_readings_arrive_as_disagreed_with_both_values(readers) -> None:
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "13"})
    ot = next(f for f in post()["read_fields"] if f["name"] == "ot_hours")
    assert ot["fact"]["status"] == "DISAGREED"
    assert ot["fact"]["value"] == {"reader_a": "18", "reader_b": "13"}


def test_the_agreed_count_matches_the_fields_actually_marked_agreed(readers) -> None:
    """Counted once in the backend so two screens cannot disagree about what
    "all agreed" means."""
    same = {name: "7" for name in extract.reader_field_order()}
    readers(a_values=same, b_values=same)
    out = post()
    assert out["read_field_count"] == len(READER_FIELDS)
    assert out["agreed_count"] == len(READER_FIELDS)
    assert out["agreed_count"] == sum(
        1 for f in out["read_fields"] if f["fact"]["status"] == "AGREED"
    )


def test_a_partial_agreement_is_counted_as_partial(readers) -> None:
    readers(a_values={"ot_hours": "18", "monthly_basic": "1200"}, b_values={"ot_hours": "18"})
    out = post()
    assert out["agreed_count"] == 1
    assert out["read_field_count"] == len(READER_FIELDS)


# --------------------------------------------------------------------------
# A reader outage is reported as one
# --------------------------------------------------------------------------


def test_a_reader_outage_establishes_nothing_and_says_which_reader_was_down(readers) -> None:
    readers(a_values={"ot_hours": "18", "monthly_basic": "1200"}, b_fail="connection refused")
    out = post()

    assert out["agreed_count"] == 0
    for f in out["read_fields"]:
        assert f["fact"]["status"] == "MISSING"
        assert "could not be reached" in f["fact"]["source"]

    down = next(r for r in out["readers"] if r["key"] == "reader_b")
    assert down["ok"] is False
    assert down["error"] is not None and "connection refused" in down["error"]

    up = next(r for r in out["readers"] if r["key"] == "reader_a")
    assert up["ok"] is True


def test_the_response_names_both_readers_and_the_model_each_one_used(readers) -> None:
    """The pick is a claim about the system; it ships with the result so it can
    be checked rather than remembered."""
    readers()
    out = post()
    assert [r["key"] for r in out["readers"]] == ["reader_a", "reader_b"]
    for r in out["readers"]:
        assert r["model"].strip()
        assert r["provider"].strip()
        assert r["source"] in extract.READER_SOURCES


# --------------------------------------------------------------------------
# Bad input is a refusal, not a reading
# --------------------------------------------------------------------------


def test_no_images_is_refused(readers) -> None:
    readers()
    r = client.post("/extract", json={"images": []})
    assert r.status_code == 400
    assert r.json()["error"] == "INVALID_INPUT"


def test_an_unknown_document_role_is_refused(readers) -> None:
    readers()
    r = client.post(
        "/extract",
        json={"images": [{"role": "bank_statement", "media_type": "image/png", "data_b64": PNG}]},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "INVALID_INPUT"
    assert "bank_statement" in r.json()["detail"]


def test_an_unsupported_media_type_is_refused(readers) -> None:
    readers()
    r = client.post(
        "/extract",
        json={"images": [{"role": "payslip", "media_type": "application/pdf", "data_b64": PNG}]},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "INVALID_INPUT"


def test_data_that_is_not_base64_is_refused(readers) -> None:
    readers()
    r = client.post(
        "/extract",
        json={"images": [{"role": "payslip", "media_type": "image/png", "data_b64": "not!base64"}]},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "INVALID_INPUT"
    assert "base64" in r.json()["detail"]


def test_an_oversized_image_is_refused(readers) -> None:
    readers()
    huge = base64.standard_b64encode(b"x" * (main.MAX_IMAGE_BYTES + 1)).decode()
    r = client.post(
        "/extract",
        json={"images": [{"role": "payslip", "media_type": "image/png", "data_b64": huge}]},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "INVALID_INPUT"


# --------------------------------------------------------------------------
# The route exists, against docs/debt.md route-table-drift
# --------------------------------------------------------------------------


def test_extract_is_a_registered_route() -> None:
    paths = {r.path for r in main.app.routes}
    assert "/extract" in paths


def test_every_choice_worker_field_ships_the_engines_own_options(readers) -> None:
    """A screen offering "PR" or "5-day" in its own words would be offering a
    value the engine rejects. The values come from the engine's enums."""
    from fairslip.cpf import Residency

    readers()
    by_name = {f["name"]: f for f in post()["worker_fields"]}

    residency = by_name["residency"]
    assert residency["answer_type"] == "choice"
    assert [c["value"] for c in residency["choices"]] == [r.value for r in Residency]

    assert {c["value"] for c in by_name["days_per_week"]["choices"]} == {"5", "6"}
    assert {c["value"] for c in by_name["is_workman"]["choices"]} == {"true", "false"}
    assert {c["value"] for c in by_name["rest_day_requested_by"]["choices"]} == {
        "employer",
        "employee",
    }


def test_non_choice_worker_fields_ship_no_options(readers) -> None:
    readers()
    by_name = {f["name"]: f for f in post()["worker_fields"]}
    assert by_name["net_paid"]["answer_type"] == "decimal"
    assert by_name["net_paid"]["choices"] == []
    assert by_name["date_of_birth"]["answer_type"] == "date"
    assert by_name["date_of_birth"]["choices"] == []


def test_every_choice_label_is_written_and_every_value_is_non_empty(readers) -> None:
    readers()
    for f in post()["worker_fields"]:
        for c in f["choices"]:
            assert c["value"].strip()
            assert c["label"].strip()


# --------------------------------------------------------------------------
# The choices this server publishes must be answers this server accepts.
#
# The first version of these tests checked the choice VALUES against the
# engines' own signatures but never sent one back through the API, so a worker
# picking "Yes, my work is manual" was refused with
# "is_workman: 'true' is not true or false" - the server rejecting a word it had
# itself offered a moment earlier. These cases are derived from the published
# choices, so any future field is covered the day it is added.
# --------------------------------------------------------------------------


def _established(value, source="worker answered on screen"):
    return {"value": value, "status": "HUMAN_CONFIRMED", "source": source}


def test_every_published_choice_is_accepted_by_the_engine_it_feeds(readers) -> None:
    """Quantified name, quantified check: every choice of every choice field."""
    readers()
    worker_fields = post()["worker_fields"]

    base = {
        "monthly_basic": _established("1200"),
        "ot_hours": _established("18"),
        "days_per_week": _established("6"),
        "normal_daily_hours": _established("8"),
        "is_workman": _established("true"),
        "deductions_total": _established("0"),
        "net_paid": _established("1400.00"),
    }

    checked = 0
    for f in worker_fields:
        if f["answer_type"] != "choice" or f["name"] not in base:
            continue
        for choice in f["choices"]:
            payload = {**base, f["name"]: _established(choice["value"])}
            r = client.post("/compute", json=payload)
            assert r.status_code == 200, (
                f"{f['name']}={choice['value']!r} was published as a choice but "
                f"refused by /compute: {r.text}"
            )
            checked += 1
    assert checked > 0, "no choice values were exercised"


def test_the_is_workman_words_this_server_publishes_round_trip(readers) -> None:
    """The specific case that was broken. Both words, both directions."""
    readers()
    is_workman = next(f for f in post()["worker_fields"] if f["name"] == "is_workman")
    published = {c["value"] for c in is_workman["choices"]}
    assert published == {"true", "false"}

    for word, expected_workman in (("true", True), ("false", False)):
        payload = {
            "monthly_basic": _established("3000"),  # above the non-workman ceiling
            "ot_hours": _established("0"),
            "days_per_week": _established("6"),
            "normal_daily_hours": _established("8"),
            "is_workman": _established(word),
            "deductions_total": _established("0"),
            "net_paid": _established("3000"),
        }
        r = client.post("/compute", json=payload)
        assert r.status_code == 200, r.text
        # $3,000 is inside the workman ceiling ($4,500) and outside the
        # non-workman one ($2,600), so the flag proves which bool was parsed.
        flagged = any(f.startswith("NOT_COVERED_BY_PART4") for f in r.json()["flags"])
        assert flagged == (not expected_workman), f"{word!r} was parsed as the wrong boolean"


def test_a_word_this_server_never_published_is_still_refused(readers) -> None:
    """Accepting the published words must not turn into accepting anything."""
    readers()
    payload = {
        "monthly_basic": _established("1200"),
        "ot_hours": _established("18"),
        "days_per_week": _established("6"),
        "normal_daily_hours": _established("8"),
        "is_workman": _established("yes"),
        "deductions_total": _established("0"),
        "net_paid": _established("1400"),
    }
    r = client.post("/compute", json=payload)
    assert r.status_code == 400
    assert r.json()["error"] == "INVALID_INPUT"


# --------------------------------------------------------------------------
# The response says which path it came down, per reader and in aggregate.
#
# Before this, `from_cache` per reader was the only signal and nothing
# aggregated it, so a response that silently went live looked exactly like one
# served from the committed cache - and did, in production, for every request.
# See docs/debt.md, write-path-contradicts-its-own-contract and fast-is-not-cached.
#
# The wire now carries `source` and nothing coarser. A boolean beside it would
# be a second way to describe one fact, and the one that cannot express a
# fallback - which is the state these tests exist to keep visible.
# --------------------------------------------------------------------------


def test_a_live_response_says_every_reading_came_from_a_model_called_just_now(
    readers, use_mode
) -> None:
    use_mode(extract.MODE_LIVE)
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    out = post()

    assert out["reader_mode"] == extract.MODE_LIVE
    assert out["reading_state"] == extract.SOURCE_LIVE
    assert "called just now" in out["reading_note"]
    for r in out["readers"]:
        assert r["source"] == extract.SOURCE_LIVE
        assert r["live_attempted"] is True
        assert r["live_error"] is None
        assert r["live_latency_ms"] is not None, "a live reading must carry its real duration"
        assert r["entry_latency_ms"] is None, "nothing was replayed, so there is no entry timing"
        assert r["cache_key"], "the corresponding entry is named even on the live path"


def test_a_fully_cached_response_says_no_model_was_called(readers, use_mode, tmp_path) -> None:
    """Both entries committed and the mode says cache: no reader is called and
    the response says the network was not needed."""
    use_mode(extract.MODE_CACHE)
    pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    for r in pair:
        extract.write_cache_entry(r, _one_image(), tmp_path)
    _use_cache_dir(tmp_path)

    out = post()
    assert out["reader_mode"] == extract.MODE_CACHE
    assert out["reading_state"] == extract.SOURCE_CACHE
    assert "network down" in out["reading_note"]
    assert "was NOT called" in out["reading_note"]
    for r in out["readers"]:
        assert r["source"] == extract.SOURCE_CACHE
        assert r["live_attempted"] is False
        assert r["live_latency_ms"] is None, "a duration for a call that never happened"


def test_a_cache_mode_response_with_no_entries_reports_the_absence(readers, use_mode, tmp_path):
    """The offline path with nothing to serve. Nothing is established, and the
    response says the readers were never called rather than that they failed."""
    use_mode(extract.MODE_CACHE)
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    _use_cache_dir(tmp_path)

    out = post()
    assert out["reading_state"] == "NONE"
    assert "was not called" in out["reading_note"]
    for r in out["readers"]:
        assert r["source"] == "NONE"
        assert r["ok"] is False
        assert r["live_attempted"] is False
        assert extract.READER_MODE_ENV in r["error"]
    assert out["agreed_count"] == 0, "an empty cache established a field"


def test_one_live_reader_and_one_fallback_are_reported_independently(
    readers, use_mode, tmp_path
) -> None:
    """THE MIXED CASE. Reader A answers; reader B fails and is replayed. The old
    aggregate had three hand-written sentences and none of them described this,
    which is why the note is now composed from the readings themselves."""
    use_mode(extract.MODE_LIVE_THEN_CACHE)
    pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})

    # Commit an entry for reader B only, then make B's live call fail. A's live
    # call still succeeds, so the two readings arrive by different routes.
    extract.write_cache_entry(pair[1], _one_image(), tmp_path)
    pair[1]._fail = "APIConnectionError: connection refused"
    _use_cache_dir(tmp_path)

    out = post()
    assert out["reading_state"] == "MIXED"

    by_key = {r["key"]: r for r in out["readers"]}
    assert by_key["reader_a"]["source"] == extract.SOURCE_LIVE
    assert by_key["reader_a"]["live_error"] is None

    b = by_key["reader_b"]
    assert b["source"] == extract.SOURCE_FALLBACK_CACHE
    assert b["ok"] is True, "a fallback reading has values"
    assert b["error"] is None, "`error` means no values; this reading has values"
    assert "connection refused" in b["live_error"], "the failed live attempt was hidden"
    assert b["live_attempted"] is True
    assert b["live_latency_ms"] is not None, "the failed attempt's real duration"


def test_the_note_names_every_reader_and_what_happened_to_each(
    readers, use_mode, tmp_path
) -> None:
    """The note is GENERATED from the readings, so the mixed case is correct by
    construction rather than by having been thought of. Checked by requiring
    every reader's label to appear in it, derived from the response itself."""
    use_mode(extract.MODE_LIVE_THEN_CACHE)
    pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    extract.write_cache_entry(pair[1], _one_image(), tmp_path)
    pair[1]._fail = "APIConnectionError: connection refused"
    _use_cache_dir(tmp_path)

    out = post()
    note = out["reading_note"]
    assert out["reader_mode"] in note, "the note does not say which policy was in force"
    for r in out["readers"]:
        assert r["label"] in note, "a reader is not accounted for in the note"
    assert "FAILED" in note, "a failed live call is not mentioned"
    assert "not this model's answer to this document" in note


def test_the_note_never_calls_a_replayed_reading_a_live_one(
    readers, use_mode, tmp_path
) -> None:
    """The one sentence that must never appear. Checked on the two paths where
    a reading is replayed, because those are the paths where it could."""
    for mode, fail in ((extract.MODE_CACHE, None), (extract.MODE_LIVE_THEN_CACHE, "boom")):
        use_mode(mode)
        pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
        for r in pair:
            extract.write_cache_entry(r, _one_image(), tmp_path)
            r._fail = fail
        _use_cache_dir(tmp_path)

        out = post()
        for r in out["readers"]:
            assert r["source"] != extract.SOURCE_LIVE, "a replay was labelled live"
        assert "was called and answered" not in out["reading_note"], mode


def test_the_request_path_never_writes_a_cache_entry(readers, use_mode, tmp_path) -> None:
    """The production bug, at the API boundary: POST /extract must leave the
    cache directory exactly as it found it, in every mode."""
    for mode in extract.READER_MODES:
        use_mode(mode)
        readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
        _use_cache_dir(tmp_path)
        post()
        post()
        assert list(tmp_path.glob("*.json")) == [], "POST /extract wrote an entry"


def test_the_aggregate_state_cannot_disagree_with_the_per_reader_sources(
    readers, use_mode, tmp_path
) -> None:
    """One aggregate and two per-reader fields describing the same thing must
    not be able to disagree. Recomputed here from the readers in the response,
    over every mode, rather than checked on one hand-picked arrangement."""
    arrangements = [
        (extract.MODE_LIVE, False, False),
        (extract.MODE_LIVE, True, True),
        (extract.MODE_CACHE, True, False),
        (extract.MODE_LIVE_THEN_CACHE, False, False),
        (extract.MODE_LIVE_THEN_CACHE, True, True),
        (extract.MODE_LIVE_THEN_CACHE, True, False),
    ]
    for mode, commit, fail in arrangements:
        run_dir = tmp_path / f"{mode}-{commit}-{fail}"
        run_dir.mkdir()
        use_mode(mode)
        pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
        if commit:
            for r in pair:
                extract.write_cache_entry(r, _one_image(), run_dir)
        if fail:
            for r in pair:
                r._fail = "APIConnectionError: connection refused"
        _use_cache_dir(run_dir)

        out = post()
        sources = {r["source"] for r in out["readers"]}
        if sources == {"NONE"}:
            expected = "NONE"
        elif len(sources) == 1:
            expected = next(iter(sources))
        else:
            expected = "MIXED"
        assert out["reading_state"] == expected, mode
        assert out["reader_mode"] == mode


def test_a_reader_mode_that_is_not_a_mode_is_refused_rather_than_defaulted(
    readers, use_mode
) -> None:
    """Nothing is wrong with the request, and the caller cannot fix it, so this
    is a 500 - and it is a refusal, not a run under a policy nobody chose."""
    use_mode("cached")
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})

    r = client.post("/extract", json=body())
    assert r.status_code == 500
    payload = r.json()
    assert payload["error"] == "INVALID_CONFIG"
    assert "cached" in payload["detail"]
    assert extract.READER_MODE_ENV in payload["detail"]


def test_an_unestablished_fact_carries_null_and_not_the_word_none() -> None:
    """`value=None` means nothing was established. Serialised with str() it
    became "None" - a five-character string a screen prints like a reading, in
    the one place the product must not put a value that looks real.

    FactValue admits null, so the type can say "unknown" without inventing a
    stand-in. .claude/rules/honesty.md, third bullet.
    """
    from app.main import _fact_value_out

    assert _fact_value_out(None) is None
    # And the values that ARE established still cross the wire unchanged.
    assert _fact_value_out("1200.00") == "1200.00"
    assert _fact_value_out(True) is True
    assert _fact_value_out(Decimal(8)) == "8"
    assert _fact_value_out({"a": Decimal(8)}) == {"a": "8"}
