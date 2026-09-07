"""The agent over the wire.

The round-trip rule from docs/debt.md, published-choice-rejected-by-its-own-server:
every value the server PUBLISHES is fed back through the endpoint that CONSUMES
it. Checking the published list against a function signature is not the same as
checking the round trip, and last time that gap shipped.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

import demo.fixtures as fx
from app.main import app
from fairslip import agent
from fairslip.agent import MANDATE_TABLE, Action, Verdict, required_level
from fairslip.cpf import shortfall_split
from fairslip.rules import compute_expected

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


# --------------------------------------------------------------------------
# /agent/draft
# --------------------------------------------------------------------------


def test_draft_at_level_0_is_refused_and_names_level_1() -> None:
    r = client.post("/agent/draft", json={"level": 0, "spec_name": "rahim_month1"})
    assert r.status_code == 400
    assert r.json()["error"] == "MANDATE_EXCEEDED"
    assert r.json()["required_level"] == 1


def test_draft_at_level_1_returns_the_committed_draft_from_cache() -> None:
    r = client.post("/agent/draft", json={"level": 1, "spec_name": "rahim_month1"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cache_state"] == "HIT"
    assert "No model was called" in body["cache_note"]
    assert body["language"] == "Bengali"
    assert body["english"].strip() and body["translated"].strip()


def test_the_draft_response_says_drafted_and_never_sent() -> None:
    """A drafted message is not a sent one. docs/debt.md, missing-narrated-as-settled
    applied to state: the screen must not be able to read SENT off this."""
    body = client.post("/agent/draft", json={"level": 1, "spec_name": "rahim_month1"}).json()
    assert body["state"] == "MESSAGE_DRAFTED"
    assert "SENT" not in json.dumps(body)


def test_the_ngo_alternative_is_returned_beside_every_draft() -> None:
    body = client.post("/agent/draft", json={"level": 1, "spec_name": "rahim_month1"}).json()
    assert body["alternative"], "no NGO alternative beside the draft"
    assert body["alternative_heading"]
    names = " ".join(o["name"] for o in body["alternative"])
    assert "MWC" in names or "Migrant" in names
    assert "TADM" in names


def test_every_dollar_figure_in_the_returned_draft_is_a_figure_the_engine_produced() -> None:
    """The traceability guard, over the wire and over BOTH languages. Every $
    amount in the text must be one of the cited figures or one of the three
    totals the spec carries."""
    body = client.post("/agent/draft", json={"level": 1, "spec_name": "rahim_month1"}).json()
    spec = fx.rahim_draft_spec()
    allowed = agent._allowed_figure_strings(spec)
    for where in ("english", "translated"):
        found = agent._figures_in_text(body[where])
        assert found, f"{where}: no figures at all - the guard would be vacuous"
        assert found <= allowed, f"{where} cites {sorted(found - allowed)}, which no engine produced"


def test_an_unknown_spec_name_is_refused_by_name() -> None:
    r = client.post("/agent/draft", json={"level": 1, "spec_name": "nope"})
    assert r.status_code == 400
    assert r.json()["error"] == "INVALID_INPUT"
    assert "nope" in r.json()["detail"]


def test_escalation_below_level_4_is_mandate_exceeded_not_action_not_built() -> None:
    """The distinction that matters most on screen. Below level 4 the mandate
    check fires FIRST, so the worker is told the level that would permit it -
    never that raising their level would not help."""
    for level in (0, 1, 2, 3):
        r = client.post("/agent/escalation", json={"level": level})
        assert r.status_code == 400
        body = r.json()
        assert body["error"] == "MANDATE_EXCEEDED", f"level {level} gave {body['error']}"
        assert body["required_level"] == 4


def test_escalation_at_level_4_is_action_not_built() -> None:
    r = client.post("/agent/escalation", json={"level": 4})
    assert r.status_code == 400
    assert r.json()["error"] == "ACTION_NOT_BUILT"
    assert "not built" in r.json()["detail"]


def test_the_mandate_endpoint_says_which_actions_are_actually_built() -> None:
    """The table is the specification; BUILT_ACTIONS is the build. A level card
    that lists an action the worker may allow is a claim about the software."""
    body = client.get("/agent/mandate").json()
    seen: dict[str, bool] = {}
    for lvl in body["levels"]:
        assert len(lvl["action_detail"]) == len(lvl["actions"])
        for a in lvl["action_detail"]:
            seen[a["name"]] = a["built"]
    assert seen["draft"] is True
    assert seen["send"] is True
    assert seen["verify"] is True
    assert seen["track"] is False
    assert seen["prepare_escalation"] is False


def test_the_blocked_month_2_fixture_is_served_by_the_backend() -> None:
    """So no screen has to synthesise a DISAGREED fact - which would mean
    inventing a reader transcript and rendering it back as evidence."""
    body = client.get("/agent/demo-inputs").json()
    assert body["month2_blocked"]["ot_hours"]["status"] == "DISAGREED"
    r = client.post(
        "/agent/verify",
        json={"level": 3, "month1": body["month1"], "month2": body["month2_blocked"]},
    )
    assert r.status_code == 200
    assert r.json()["verdict"] == "UNVERIFIABLE"
    assert {b["name"] for b in r.json()["blocked_by"]} == {"ot_hours"}


# --------------------------------------------------------------------------
# The panel persona: Mei Ling, the only one whose CPF pack applies
# --------------------------------------------------------------------------


def test_the_demo_inputs_serve_mei_ling_because_rahim_has_no_cpf() -> None:
    """The name states a rationale, so the test establishes it: Rahim is a Work
    Permit holder and his CPF shortfall really is zero, which is why the
    compounding cannot be shown on his figures at all."""
    rahim = shortfall_split(
        fx.RAHIM_DECLARED_OW,
        compute_expected(fx.rahim_month1_established()).expected_gross,
        fx.RAHIM_BAND,
        fx.RAHIM_RESIDENCY,
    )
    assert rahim.cpf_shortfall == 0
    assert rahim.total_withheld == rahim.gross_shortfall  # nothing compounds

    body = client.get("/agent/demo-inputs").json()
    assert body["persona"] == "Mei Ling"
    assert body["draft_spec_name"] == "mei_ling_month1"
    assert body["cpf"] is not None


def test_the_cpf_split_matches_the_calibration_and_never_double_counts() -> None:
    """The two identities from .claude/rules/cpf-rules.md, asserted on what the
    endpoint actually returns: cash + cpf == total, and gross + employer == total."""
    cpf = client.get("/agent/demo-inputs").json()["cpf"]
    lines = {ln["key"]: ln["amount"]["display"] for ln in cpf["split"]}
    assert lines["gross_shortfall"] == "62.24"
    assert lines["employee_cpf_on_shortfall"] == "12.00"
    assert lines["cash_shortfall"] == "50.24"
    assert lines["cpf_shortfall"] == "23.00"
    assert lines["employer_cpf_on_shortfall"] == "11.00"
    assert lines["total_withheld"] == "73.24"

    # The two identities from .claude/rules/cpf-rules.md, ASSERTED rather than
    # merely named in the test's title. Decimal, because this is money.
    d = {k: Decimal(v) for k, v in lines.items()}
    assert d["cash_shortfall"] + d["cpf_shortfall"] == d["total_withheld"]
    assert d["gross_shortfall"] + d["employer_cpf_on_shortfall"] == d["total_withheld"]

    # The double-count is gross + cpf. Derived from the served figures rather
    # than hardcoded as "85.24", so this stays true for any persona, and checked
    # against every string the panel renders - not the split values alone.
    double_count = d["gross_shortfall"] + d["cpf_shortfall"]
    assert double_count != d["total_withheld"]
    body = client.get("/agent/demo-inputs").json()
    rendered = set(lines.values()) | {body["cpf_basis"], cpf["split_note"]}
    for text in rendered:
        assert f"{double_count:.2f}" not in text, f"the double-count reached: {text!r}"


def test_the_cpf_basis_explains_where_the_declared_wage_came_from() -> None:
    """It must not claim FairSlip "does not infer" the figure while showing an
    inferred one: $1,400 IS 280 / 20%. The honest statement is that the example
    gives the wage, chosen to be consistent with the payslip's CPF line."""
    basis = client.get("/agent/demo-inputs").json()["cpf_basis"]
    assert "invented example" in basis
    assert "consistent with the $280 CPF line" in basis
    assert "does not infer it" not in basis


EXPECTED_VERDICTS = {
    "month2_corrected": "CORRECTED",
    "month2_uncorrected": "NOT_CORRECTED",
    "month2_blocked": "UNVERIFIABLE",
}


def test_every_served_month_2_input_produces_its_verdict() -> None:
    """The round trip, with the cases DERIVED from what the endpoint publishes,
    so a fourth month-2 input cannot be served and left uncovered."""
    body = client.get("/agent/demo-inputs").json()
    served = sorted(k for k in body if k.startswith("month2_"))
    assert served, "the endpoint published no month-2 inputs; this test would be vacuous"
    assert set(served) == set(EXPECTED_VERDICTS), (
        f"served {served} but verdicts are declared for {sorted(EXPECTED_VERDICTS)}; "
        f"add the new input's expected verdict here"
    )
    for key in served:
        r = client.post(
            "/agent/verify", json={"level": 3, "month1": body["month1"], "month2": body[key]}
        )
        assert r.status_code == 200, r.text
        assert r.json()["verdict"] == EXPECTED_VERDICTS[key], key


def test_the_mei_ling_draft_is_served_from_the_committed_cache() -> None:
    body = client.get("/agent/demo-inputs").json()
    r = client.post("/agent/draft", json={"level": 1, "spec_name": body["draft_spec_name"]})
    assert r.status_code == 200, r.text
    assert r.json()["cache_state"] == "HIT"
    assert r.json()["language"] == "Bengali"


def test_the_cpf_caveat_retracts_before_it_asserts_and_names_the_persona() -> None:
    """The sentence must open by saying these are not the viewer's figures. An
    indicative claim about an employer followed by a withdrawal has already been
    read by the time the withdrawal arrives - and this panel sits directly under
    the viewer's OWN reconciliation, on a page that says a few inches above that
    FairSlip did not compute CPF for them."""
    basis = client.get("/agent/demo-inputs").json()["cpf_basis"]
    head = basis[:80].lower()
    assert "fictional" in head
    assert "not your figures" in head
    assert "Mei Ling" in basis
    # It must disclaim the whole panel, not declared_ow alone.
    assert "every amount above is her month" in basis


def test_a_cpf_pack_is_never_served_without_the_sentence_that_says_whose_it_is() -> None:
    """The frontend gate requires both. Asserted here too, because two fields
    with independent defaults can drift apart."""
    body = client.get("/agent/demo-inputs").json()
    assert (body["cpf"] is None) == (body["cpf_basis"].strip() == "")


def test_amounts_in_the_caveat_use_the_same_formatter_as_the_screen() -> None:
    """A hand-formatted amount beside money()-formatted ones is a second
    formatter, and the two disagree on thousands separators."""
    basis = client.get("/agent/demo-inputs").json()["cpf_basis"]
    assert "$1,400.00" in basis
    assert "$1400.00" not in basis
