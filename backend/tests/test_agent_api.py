"""The agent over the wire.

The round-trip rule from docs/debt.md, published-choice-rejected-by-its-own-server:
every value the server PUBLISHES is fed back through the endpoint that CONSUMES
it. Checking the published list against a function signature is not the same as
checking the round trip, and last time that gap shipped.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

import demo.fixtures as fx
from app.main import app
from fairslip.agent import MANDATE_TABLE, Action, Verdict, required_level

client = TestClient(app)


def _fact(f) -> dict:
    v = f.value
    if isinstance(v, dict):
        v = {str(k): str(x) for k, x in v.items()}
    elif not isinstance(v, (bool, int, str)) and v is not None:
        v = str(v)
    return {"value": v, "status": f.status.value, "source": f.source}


def _inputs(pi) -> dict:
    out = {}
    for name in type(pi).__dataclass_fields__:
        raw = getattr(pi, name)
        if raw is not None:
            out[name] = _fact(raw)
    return out


def _tap(at: datetime | None = None) -> dict:
    return {"at": (at or datetime.now(UTC)).isoformat(), "surface": "check-page"}


# --------------------------------------------------------------------------
# /agent/mandate publishes the table
# --------------------------------------------------------------------------


def test_mandate_endpoint_publishes_every_level_the_guard_enforces() -> None:
    r = client.get("/agent/mandate")
    assert r.status_code == 200
    body = r.json()
    published = {lvl["level"]: set(lvl["actions"]) for lvl in body["levels"]}
    assert published == {
        level: {a.value for a in actions} for level, actions in MANDATE_TABLE.items()
    }


def test_mandate_endpoint_states_that_this_build_has_no_authentication() -> None:
    """A judge asking 'what stops someone else setting level 4' deserves the
    answer on screen, not in a docstring."""
    body = client.get("/agent/mandate").json()
    notice = body["no_authentication_notice"]
    assert "no authentication" in notice.lower()
    assert "caller" in notice.lower()


@pytest.mark.parametrize("action", sorted(Action, key=lambda a: a.value))
def test_every_published_action_is_accepted_at_its_published_level(action: Action) -> None:
    """The round trip. Every action the table publishes is sent back at the level
    the table says grants it, and must NOT come back MANDATE_EXCEEDED."""
    body = client.get("/agent/mandate").json()
    level = min(lvl["level"] for lvl in body["levels"] if action.value in lvl["actions"])
    assert level == required_level(action)

    if action is Action.SEND:
        r = client.post("/agent/send", json={"level": level, "tap": _tap()})
    elif action is Action.VERIFY:
        r = client.post(
            "/agent/verify",
            json={
                "level": level,
                "month1": _inputs(fx.rahim_month1_established()),
                "month2": _inputs(fx.rahim_month2_corrected()),
            },
        )
    else:
        return  # not built in this cut; the mandate half is covered by the unit tests
    assert r.status_code == 200, r.text


# --------------------------------------------------------------------------
# Refusals name the level that would have permitted them
# --------------------------------------------------------------------------


def test_send_at_level_1_is_refused_over_the_wire_and_names_level_2() -> None:
    r = client.post("/agent/send", json={"level": 1, "tap": _tap()})
    assert r.status_code == 400
    body = r.json()
    assert body["error"] == "MANDATE_EXCEEDED"
    assert body["required_level"] == 2


def test_verify_at_level_2_is_refused_over_the_wire_and_names_level_3() -> None:
    r = client.post(
        "/agent/verify",
        json={
            "level": 2,
            "month1": _inputs(fx.rahim_month1_established()),
            "month2": _inputs(fx.rahim_month2_corrected()),
        },
    )
    assert r.status_code == 400
    assert r.json()["error"] == "MANDATE_EXCEEDED"
    assert r.json()["required_level"] == 3


def test_send_without_a_tap_is_refused_over_the_wire() -> None:
    r = client.post("/agent/send", json={"level": 2})
    assert r.status_code == 400
    assert "tap" in r.json()["detail"].lower()


def test_a_naive_tap_timestamp_is_refused_over_the_wire() -> None:
    r = client.post(
        "/agent/send", json={"level": 2, "tap": {"at": "2026-09-07T12:00:00", "surface": "x"}}
    )
    assert r.status_code == 400
    assert "timezone" in r.json()["detail"].lower()


def test_an_unknown_mandate_level_is_refused_over_the_wire() -> None:
    r = client.post("/agent/send", json={"level": 9, "tap": _tap()})
    assert r.status_code == 400
    assert "mandate level" in r.json()["detail"]


# --------------------------------------------------------------------------
# SENT echoes the tap's own moment
# --------------------------------------------------------------------------


def test_send_records_the_taps_timestamp_not_the_servers() -> None:
    at = datetime(2026, 9, 7, 14, 30, 5, tzinfo=UTC)
    r = client.post("/agent/send", json={"level": 2, "tap": _tap(at)})
    assert r.status_code == 200
    body = r.json()
    assert body["state"] == "SENT"
    assert datetime.fromisoformat(body["tap_at"]) == at


def test_the_send_response_does_not_claim_anything_was_transmitted() -> None:
    r = client.post("/agent/send", json={"level": 2, "tap": _tap()})
    note = r.json()["note"].lower()
    assert "did not contact" in note
    for forbidden in ("delivered", "we sent", "notified your employer"):
        assert forbidden not in note


# --------------------------------------------------------------------------
# /agent/verify carries its arithmetic
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("fixture", "expected"),
    [
        ("rahim_month2_corrected", Verdict.CORRECTED),
        ("rahim_month2_uncorrected", Verdict.NOT_CORRECTED),
    ],
)
def test_verify_over_the_wire_returns_the_verdict_with_its_arithmetic(
    fixture: str, expected: Verdict
) -> None:
    r = client.post(
        "/agent/verify",
        json={
            "level": 3,
            "month1": _inputs(fx.rahim_month1_established()),
            "month2": _inputs(getattr(fx, fixture)()),
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["verdict"] == expected.value
    for figure in ("month1_difference", "month2_difference", "adjustment_found", "remaining_gap"):
        assert body[figure] is not None, f"{expected.value} came back without {figure}"
        assert body[figure]["display"]
    assert body["arithmetic"]


def test_unverifiable_over_the_wire_names_the_blocking_fields_and_omits_month_2_figures() -> None:
    month2 = _inputs(fx.rahim_month2_corrected())
    month2["ot_hours"] = {
        "value": {"reader_a": "18", "reader_b": "13"},
        "status": "DISAGREED",
        "source": "readers disagree: Claude 18, auditor 13",
    }
    r = client.post(
        "/agent/verify",
        json={"level": 3, "month1": _inputs(fx.rahim_month1_established()), "month2": month2},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["verdict"] == "UNVERIFIABLE"
    assert body["state"] == "UNVERIFIABLE"
    assert {b["name"] for b in body["blocked_by"]} == {"ot_hours"}
    assert body["blocked_by"][0]["status"] == "DISAGREED"
    # It computed no month-2 figures, so it reports none. A zero would read as
    # "nothing outstanding" (docs/debt.md, missing-narrated-as-settled).
    for figure in ("month2_difference", "adjustment_found", "remaining_gap"):
        assert body[figure] is None, f"UNVERIFIABLE reported a {figure} it never computed"
    assert body["month1_difference"] is not None  # month 1 WAS established


def test_the_unverifiable_arithmetic_line_makes_no_claim_about_the_employer() -> None:
    month2 = _inputs(fx.rahim_month2_corrected())
    month2["monthly_basic"] = {"value": None, "status": "MISSING", "source": "not found"}
    r = client.post(
        "/agent/verify",
        json={"level": 3, "month1": _inputs(fx.rahim_month1_established()), "month2": month2},
    )
    text = r.json()["arithmetic"].lower()
    assert "no verdict" in text
    for forbidden in ("not corrected", "did not", "failed to", "owed", "underpaid"):
        assert forbidden not in text


def test_a_sub_cent_negative_residue_displays_as_zero_not_minus_zero() -> None:
    """The CORRECTED case leaves about -0.0045 of formula residue. Rounded to
    cents that is "-0.00", which beside a CORRECTED verdict reads as a
    contradiction. `exact` keeps the signed Decimal, so nothing is hidden."""
    r = client.post(
        "/agent/verify",
        json={
            "level": 3,
            "month1": _inputs(fx.rahim_month1_established()),
            "month2": _inputs(fx.rahim_month2_corrected()),
        },
    )
    gap = r.json()["remaining_gap"]
    assert gap["display"] == "0.00"
    assert not gap["display"].startswith("-")
    assert gap["exact"].startswith("-")  # the engine's signed value survives
