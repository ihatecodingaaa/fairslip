"""POST /extract over the wire, with stub readers. No model is called.

The endpoint's job is to carry the reconciliation unchanged and to keep the two
groups of field apart on the way out. These tests check that it does, and that
the failure modes arrive as themselves: a bad image is a refusal, a reader
outage is a reader outage, and neither is dressed as a reading.
"""

from __future__ import annotations

import base64

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
    writes into backend/demo/extract_cache or replays a real reading."""

    def install(a_values=None, b_values=None, a_fail=None, b_fail=None):
        pair = (
            StubReader("reader_a", a_values, a_fail),
            StubReader("reader_b", b_values, b_fail),
        )
        monkeypatch.setattr(main, "default_readers", lambda: pair)
        monkeypatch.setattr(
            main,
            "read_with_cache",
            lambda r, images: extract.read_with_cache(r, images, None),
        )
        return pair

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

    m.read_with_cache = lambda r, images: extract.read_with_cache(r, images, path)


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
        assert "from_cache" in r


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
# The response says which path it came down.
#
# Before this, `from_cache` per reader was the only signal and nothing
# aggregated it, so a response that silently went live looked exactly like one
# served from the committed cache - and did, in production, for every request.
# See docs/debt.md, write-path-contradicts-its-own-contract.
# --------------------------------------------------------------------------


def test_a_live_response_says_it_was_live_and_names_the_missing_entries(readers) -> None:
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    out = post()

    assert out["cache_state"] == "MISS"
    note = out["cache_note"]
    assert "called live" in note
    assert "make_cache_entry.py" in note, "the note must say how to fix it"

    for r in out["readers"]:
        assert r["cache"] == "MISS"
        assert r["from_cache"] is False
        assert r["cache_key"], "a miss must name the entry it looked for"


def test_a_fully_cached_response_says_so(readers, tmp_path) -> None:
    """Both entries committed: no reader is called and the response says the
    network was not needed."""
    pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    for r in pair:
        extract.write_cache_entry(r, _one_image(), tmp_path)
    for r in pair:
        r.calls = 0
    _use_cache_dir(tmp_path)

    out = post()
    assert out["cache_state"] == "HIT"
    assert "network down" in out["cache_note"]
    for r in out["readers"]:
        assert r["cache"] == "HIT"
        assert r["from_cache"] is True


def test_a_half_cached_response_is_reported_as_partial(readers, tmp_path) -> None:
    """One entry is not enough - /extract calls both readers, so a partial cache
    still reaches the network. Saying HIT here would be the same class of lie."""
    pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    extract.write_cache_entry(pair[0], _one_image(), tmp_path)
    _use_cache_dir(tmp_path)

    out = post()
    assert out["cache_state"] == "PARTIAL"
    assert "will not survive" in out["cache_note"]
    states = {r["key"]: r["cache"] for r in out["readers"]}
    assert states == {"reader_a": "HIT", "reader_b": "MISS"}


def test_the_request_path_never_writes_a_cache_entry(readers, tmp_path) -> None:
    """The production bug, at the API boundary: POST /extract must leave the
    cache directory exactly as it found it."""
    readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    _use_cache_dir(tmp_path)

    post()
    post()
    assert list(tmp_path.glob("*.json")) == [], "POST /extract wrote a cache entry"


def test_cache_state_agrees_with_the_per_reader_flags(readers, tmp_path) -> None:
    """One aggregate and two per-reader flags describing the same fact must not
    be able to disagree."""
    pair = readers(a_values={"ot_hours": "18"}, b_values={"ot_hours": "18"})
    for r in pair:
        extract.write_cache_entry(r, _one_image(), tmp_path)
    _use_cache_dir(tmp_path)

    out = post()
    hits = sum(1 for r in out["readers"] if r["cache"] == "HIT")
    expected = "HIT" if hits == len(out["readers"]) else "MISS" if hits == 0 else "PARTIAL"
    assert out["cache_state"] == expected
