"""The agent over the wire.

The round-trip rule from docs/debt.md, published-choice-rejected-by-its-own-server:
every value the server PUBLISHES is fed back through the endpoint that CONSUMES
it. Checking the published list against a function signature is not the same as
checking the round trip, and last time that gap shipped.
"""

from __future__ import annotations

import dataclasses
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


def test_escalation_at_level_4_assembles_the_tadm_half() -> None:
    r = client.post("/agent/escalation", json={"level": 4})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["evidence"]) == 4
    assert body["deadlines"] and body["filing_steps"]


def test_every_evidence_item_quotes_its_published_source() -> None:
    """Derived over the pack rather than checking one item. Each quote must
    carry the URL it came from, and the URL must be a declared REFERENCE_LINK -
    the set the module marks as shown to the worker and never fetched."""
    from fairslip.agent import REFERENCE_LINKS

    declared = set(REFERENCE_LINKS.values())
    body = client.post("/agent/escalation", json={"level": 4}).json()
    assert body["evidence"], "no evidence items; this test would be vacuous"
    for item in body["evidence"] + body["deadlines"]:
        assert item["quoted"].strip()
        assert item["source_url"] in declared, item["source_url"]


def test_the_cpf_report_half_is_declared_not_built_with_its_reason() -> None:
    """The form behind CPF Board's link returned 403 and has not been read.
    Inventing its fields would be a guess carried to a government counter."""
    body = client.post("/agent/escalation", json={"level": 4}).json()
    assert body["not_built"], "the absent CPF half is not declared at all"
    cpf_half = body["not_built"][0]
    assert "CPF Board" in cpf_half["what"]
    assert "could not be read" in cpf_half["why"]
    assert cpf_half["what_is_known"], "it says nothing about what IS known"


def test_the_pack_states_no_claim_value_cap_anywhere() -> None:
    """MOM and TADM describe the caps differently and how they compose for one
    worker could not be established. A cap shown wrongly is not recoverable at a
    mediation counter, so no amount appears (docs/debt.md, tadm-claim-value-caps)."""
    blob = json.dumps(client.post("/agent/escalation", json={"level": 4}).json())
    for cap in ("20,000", "30,000", "40,000", "$20000", "$30000", "$40000"):
        assert cap not in blob, f"a claim cap reached the pack: {cap}"


def test_the_pack_never_says_it_filed_anything() -> None:
    body = client.post("/agent/escalation", json={"level": 4}).json()
    blob = json.dumps(body).lower()
    for claim in ("we filed", "we submitted", "your claim has been", "we have sent"):
        assert claim not in blob
    assert any("does not file" in s.lower() for s in body["filing_steps"])


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
    assert seen["prepare_escalation"] is True  # the TADM half is built
    assert seen["track"] is False  # tracking the next salary period is not


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


def test_each_persona_declares_its_own_language() -> None:
    """A language belongs to a PERSON. It was one global, so switching the panel
    persona silently put Mei Ling's message in Rahim's Bengali - a fabricated
    fact about a person. Derived over the declared specs, so a third persona
    cannot inherit a language by accident."""
    langs = {name: spec.language for name, spec in fx.draft_specs()}
    assert langs["rahim_month1"] == fx.RAHIM_LANGUAGE == "Bengali"
    assert langs["mei_ling_month1"] == fx.MEI_LING_LANGUAGE
    assert fx.MEI_LING_LANGUAGE != fx.RAHIM_LANGUAGE
    # No two personas may share a spec: the language is in the cache key, so a
    # shared language with identical figures would share an entry.
    assert len(set(langs.values())) == len(langs)


def test_the_language_is_part_of_the_draft_cache_key() -> None:
    """Otherwise a persona could be served another persona's message."""

    from fairslip.agent import draft_cache_key

    spec = fx.mei_ling_draft_spec()
    other = dataclasses.replace(spec, language=fx.RAHIM_LANGUAGE)
    assert draft_cache_key(spec) != draft_cache_key(other)


def test_the_served_persona_language_matches_the_draft_it_serves() -> None:
    body = client.get("/agent/demo-inputs").json()
    assert body["selected"]["language"] == fx.MEI_LING_LANGUAGE
    r = client.post("/agent/draft", json={"level": 1, "spec_name": body["draft_spec_name"]})
    assert r.status_code == 200, r.text
    assert r.json()["language"] == body["selected"]["language"]


def test_the_split_bridge_derives_cash_from_gross_and_shows_the_subtraction() -> None:
    """$62.24 and $50.24 both describe money she did not receive. The screen must
    show the derivation rather than leave two same-sounding labels unexplained."""
    cpf = client.get("/agent/demo-inputs").json()["cpf"]
    bridge = cpf["split_bridge"]
    assert "$62.24 minus $12.00 = $50.24" in bridge
    assert "WAGE" in bridge and "CASH" in bridge
    assert "Neither figure is wrong" in bridge


def test_the_cpf_pack_serves_only_what_the_panel_renders() -> None:
    """declared/expected/delta were serialised and never shown. A serialised
    figure nothing renders is where the next unqualified claim gets displayed."""
    cpf = client.get("/agent/demo-inputs").json()["cpf"]
    assert set(cpf) == {"split", "split_note", "split_bridge"}


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
    assert body["selected"]["key"] == "mei_ling"  # the default, unswitched
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
    rendered = set(lines.values()) | {
        body["cpf_basis"],
        cpf["split_note"],
        cpf["split_bridge"],
    }
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
    assert r.json()["language"] == fx.MEI_LING_LANGUAGE  # hers, not the demo's


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
    assert "every amount above is their month" in basis


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



# --------------------------------------------------------------------------
# The persona switch
# --------------------------------------------------------------------------


def test_mei_ling_is_the_default_and_the_scripted_run_never_switches() -> None:
    assert fx.DEFAULT_PERSONA_KEY == "mei_ling"
    assert client.get("/agent/demo-inputs").json()["selected"]["key"] == "mei_ling"


def test_the_switch_is_rendered_from_the_same_record_that_decides_the_response() -> None:
    """The personas the screen offers and the personas the endpoint can serve are
    one list, so a switch cannot offer something the server will refuse."""
    body = client.get("/agent/demo-inputs").json()
    offered = [p["key"] for p in body["personas"]]
    assert offered == [p.key for p in fx.DEMO_PERSONAS]
    for key in offered:
        assert client.get(f"/agent/demo-inputs?persona={key}").status_code == 200


@pytest.mark.parametrize("key", [p.key for p in fx.DEMO_PERSONAS])
def test_every_persona_states_its_facts_rather_than_leaving_them_inferred(key: str) -> None:
    """Residency, occupation, language and whether CPF applies are all fields, so
    nothing on the card is something a viewer has to assume."""
    sel = client.get(f"/agent/demo-inputs?persona={key}").json()["selected"]
    for field in ("name", "residency_label", "occupation", "language"):
        assert sel[field].strip(), f"{key}.{field} is blank"
    assert isinstance(sel["cpf_applies"], bool)


@pytest.mark.parametrize("key", [p.key for p in fx.DEMO_PERSONAS])
def test_switching_changes_everything_that_depends_on_the_persona(key: str) -> None:
    """Not just the draft. The months, the language and the CPF pack all move
    together - a switch threaded through one field is how a NO_CPF worker ends up
    under a CPF split."""
    who = fx.persona_by_key(key)
    body = client.get(f"/agent/demo-inputs?persona={key}").json()

    assert body["draft_spec_name"] == who.draft_spec_name
    assert body["selected"]["language"] == who.language
    assert (body["cpf"] is not None) == who.cpf_applies

    # the months really are this persona's
    expected_net_paid = str(who.month1().net_paid.value)
    assert body["month1"]["net_paid"]["value"] == expected_net_paid


@pytest.mark.parametrize("key", [p.key for p in fx.DEMO_PERSONAS])
def test_both_personas_draft_from_a_committed_entry_with_no_live_call(key: str) -> None:
    """The switch must be one click with no re-extraction and no model call."""
    body = client.get(f"/agent/demo-inputs?persona={key}").json()
    r = client.post("/agent/draft", json={"level": 1, "spec_name": body["draft_spec_name"]})
    assert r.status_code == 200, r.text
    assert r.json()["cache_state"] == "HIT"
    assert r.json()["language"] == body["selected"]["language"]


def test_a_persona_without_cpf_gets_no_split_and_a_reason_instead() -> None:
    """A split of zeros under a NO_CPF banner, carrying a note about an overlap
    of $0, is a card contradicting itself."""
    body = client.get("/agent/demo-inputs?persona=rahim").json()
    assert body["cpf"] is None
    assert body["cpf_basis"] == ""
    assert "not CPF members" in body["no_cpf_note"]
    assert body["selected"]["cpf_applies"] is False


def test_a_persona_with_cpf_gets_no_no_cpf_note() -> None:
    body = client.get("/agent/demo-inputs?persona=mei_ling").json()
    assert body["no_cpf_note"] == ""
    assert body["cpf"] is not None


def test_an_unknown_persona_is_refused_by_name() -> None:
    r = client.get("/agent/demo-inputs?persona=nope")
    assert r.status_code == 400
    assert "nope" in r.json()["detail"]


@pytest.mark.parametrize("key", [p.key for p in fx.DEMO_PERSONAS])
def test_every_draft_says_whose_message_it_is(key: str) -> None:
    """The draft is written in the first person and offered as something to send.
    Without this it reads as the viewer's own message about their own month."""
    body = client.get(f"/agent/demo-inputs?persona={key}").json()
    basis = client.post(
        "/agent/draft", json={"level": 1, "spec_name": body["draft_spec_name"]}
    ).json()["basis"]
    assert "not your message" in basis
    assert body["selected"]["name"] in basis


def test_mwc_is_offered_only_to_the_workers_it_exists_for() -> None:
    """Offering "free help for migrant workers" to a Singapore Citizen asserts
    something about the reader that nothing established."""
    def names(key: str) -> set[str]:
        body = client.get(f"/agent/demo-inputs?persona={key}").json()
        d = client.post(
            "/agent/draft", json={"level": 1, "spec_name": body["draft_spec_name"]}
        ).json()
        return {o["name"] for o in d["alternative"]}

    assert any("MWC" in n for n in names("rahim"))
    assert not any("MWC" in n for n in names("mei_ling"))
    # TADM is for everyone, so it must never drop out.
    for key in ("rahim", "mei_ling"):
        assert any("TADM" in n for n in names(key))


def test_every_quoted_authority_names_the_page_it_came_from() -> None:
    """A quotation attributed by the nearest heading is attributed to the wrong
    body. Two authorities are quoted under one TADM heading - MOM's page carries
    the two filing deadlines, TADM's carries the evidence list and the look-back
    sentence MOM does not print - so each item is checked against the page it
    actually came from, not against a single expected authority."""
    body = client.post("/agent/escalation", json={"level": 4}).json()
    declared = set(agent.REFERENCE_LINKS.values())
    for item in body["evidence"]:
        assert "TADM" in item["source_label"], item
        assert item["source_url"] in declared, item
    for d in body["deadlines"]:
        assert d["source_label"].strip(), d
        assert d["source_url"] in declared, d
        # the label must name the body whose page it is
        expected = "TADM" if d["source_url"] == agent.REFERENCE_LINKS["tadm_file_claim"] else "MOM"
        assert expected in d["source_label"], d


def test_the_filing_steps_make_no_claim_about_how_tadm_works() -> None:
    """"A mediator checks the figures with both sides" and "mediation is free"
    are claims about a third party's process that nothing here establishes."""
    steps = " ".join(client.post("/agent/escalation", json={"level": 4}).json()["filing_steps"])
    for claim in ("mediates", "mediator", "free", "Singpass"):
        assert claim.lower() not in steps.lower(), claim


def test_the_escalation_pack_omits_the_cpf_half_for_a_worker_with_no_cpf() -> None:
    """Naming an absent CPF report to a Work Permit holder contradicts the card
    beside it saying the whole CPF question does not apply to them. An unbuilt
    half is worth naming; an inapplicable one reads as an oversight."""
    for key in ("mei_ling", "rahim"):
        who = fx.persona_by_key(key)
        body = client.post("/agent/escalation", json={"level": 4, "persona": key}).json()
        assert bool(body["not_built"]) is who.cpf_applies, key
        # The TADM half is for everyone either way.
        assert len(body["evidence"]) == 4, key


def test_the_landing_personas_state_whether_cpf_applies() -> None:
    """So the age-band chip - a CPF rate-table row - is not shown above a panel
    saying the worker is not a CPF member."""
    personas = client.get("/demo/fixtures").json()["personas"]
    by_name = {p["name"]: p["cpf_applies"] for p in personas}
    assert by_name["Mei Ling"] is True
    assert all(v is False for k, v in by_name.items() if k.startswith("Rahim"))


def test_no_user_visible_backend_string_assumes_a_pronoun() -> None:
    """Fictional personas have no stated pronouns, and a name does not supply
    one. Derived over the strings the agent surfaces actually send."""
    import re

    body = client.get("/agent/demo-inputs").json()
    strings = [
        body["cpf_basis"],
        body["cpf"]["split_bridge"],
        body["cpf"]["split_note"],
        client.post("/agent/draft", json={"level": 1, "spec_name": "mei_ling_month1"}).json()[
            "basis"
        ],
        client.get("/agent/demo-inputs?persona=rahim").json()["no_cpf_note"],
        client.post("/agent/send", json={"level": 2, "tap": _tap()}).json()["note"],
    ]
    gendered = re.compile(r"\b(she|her|hers|he|him|his)\b", re.IGNORECASE)
    for s in strings:
        assert not gendered.search(s), f"gendered pronoun in: {s!r}"


# Verified in a browser on 7 Sept 2026 against
# https://www.cpf.gov.sg/service/article/how-can-i-lodge-a-report-for-non-payment-or-underpayment-of-cpf-contributions
# (page "Last updated 12 Mar 2026"). The page is client-rendered and returns
# nothing to curl, which is why these were the last unverified quotes in the
# product. Substrings copied from the rendered text, character for character.
# Four sentences: three read 7 Sept 2026, plus the sequence sentence from the
# same page and the same reading.
CPF_PAGE_SENTENCES = (
    (
        "all available supporting documents to support your claim "
        "(e.g. pay slips and employment contract)."
    ),
    "Claims made without any supporting documents would require a longer time to investigate.",
    (
        "The Board will compute the CPF contributions based on the amount of wages due and "
        "payable once TADM has concluded your claims."
    ),
    (
        "Please note the likelihood of recovery for any non/underpayment of CPF contributions "
        "beyond one year is low as the parties’ recollection of the facts or availability of "
        "evidence may diminish over time."
    ),
)


def _all_quoted() -> list[str]:
    """Every `quoted` string the escalation screen shows, over every not_built
    entry - not just the first."""
    body = client.post("/agent/escalation", json={"level": 4}).json()
    return [q["quoted"] for n in body["not_built"] for q in n["what_is_known"]]


@pytest.mark.parametrize("sentence", CPF_PAGE_SENTENCES)
def test_every_sentence_read_from_the_page_reaches_the_screen(sentence: str) -> None:
    """Direction 1: what was read from the page is what ships.

    One of these shipped TRUNCATED - it stopped at "beyond one year is low." with
    a full stop, which reads as a bare limitation period. The clause that follows
    names the reason, evidence going stale, and is the half that shows it is not
    a deadline. A quotation cut where the cut changes its meaning is not a
    quotation."""
    assert any(sentence in q for q in _all_quoted())


def test_every_quotation_on_the_screen_was_read_from_the_page() -> None:
    """Direction 2, which the pair above could not check.

    Checking only that the recorded sentences reach the screen passes by
    construction whenever a quote is added to both sides at once. This asserts
    the converse: nothing is presented as CPF Board's words unless it is in the
    set read from the page. That is the direction a fabricated quote fails."""
    for quoted in _all_quoted():
        assert any(quoted in known for known in CPF_PAGE_SENTENCES), (
            f"this is rendered in quotation marks but was not read from the page: {quoted!r}"
        )


def test_the_truncated_form_of_the_cpf_timing_quote_never_ships() -> None:
    """The specific regression: a full stop after "is low"."""
    joined = " ".join(_all_quoted())
    assert "beyond one year is low." not in joined
    assert "beyond one year is low as the parties" in joined


def test_every_not_built_block_names_the_exact_page_its_quotes_came_from() -> None:
    """Every other quoted block on the escalation screen carries its source.
    These did not, and a quotation whose page is not named cannot be checked.

    Asserts the EXACT url, not a cpf.gov.sg prefix: two other CPF pages are in
    REFERENCE_LINKS and either would have satisfied a prefix check while naming
    the wrong page. Derived over every entry, not just the first."""
    body = client.post("/agent/escalation", json={"level": 4}).json()
    quoting = [n for n in body["not_built"] if n["what_is_known"]]
    assert quoting, "no not_built entry quotes anything; this test would be vacuous"
    for n in quoting:
        assert n["source_url"] == agent.REFERENCE_LINKS["cpf_report_underpayment"]
        assert "CPF Board" in n["source_label"]
        assert "12 Mar 2026" in n["source_label"]  # the page's own last-updated date
        assert "read in a browser" in n["source_label"]  # and when WE read it


def test_a_block_that_quotes_an_authority_cannot_be_built_without_its_source() -> None:
    """Structural. Both fields used to default to "", so four quotations with no
    attribution were constructible and the panel rendered them silently."""
    with pytest.raises(ValueError, match="name the page"):
        agent.NotBuilt(
            what="x",
            why="y",
            what_is_known=(agent.QuotedSource(quoted="something an authority said"),),
            source_url="",
            source_label="",
        )


def test_the_sequence_quote_comes_first_because_it_reframes_the_rest() -> None:
    """An ordering claim, asserted on the ORDER.

    It previously asserted `"FOLLOWS TADM" in known[0]` - FairSlip's own gloss
    wording - so editing the gloss would have failed a test named for ordering,
    and the suite would have made an unestablished inference look verified."""
    known = client.post("/agent/escalation", json={"level": 4}).json()["not_built"][0][
        "what_is_known"
    ]
    assert "once TADM has concluded your claims" in known[0]["quoted"]


def test_no_reading_of_a_quote_is_presented_as_the_authoritys_words() -> None:
    """`quoted` and `note` are separate fields so the screen can render them
    apart. The gloss once said the TADM half was "the half to take first" and
    that a CPF report "would not be the next step" - advice nothing established,
    under a heading reading "What CPF Board does say", on a page whose purpose is
    to tell members how to lodge that report. It is also wrong for anyone outside
    TADM's filing window, for whom the CPF report is the route that remains."""
    body = client.post("/agent/escalation", json={"level": 4}).json()
    for n in body["not_built"]:
        for q in n["what_is_known"]:
            # A reading must be marked as one, and must not tell the worker what
            # to do first.
            # The label on screen says whose words these are; the note itself
            # must not repeat it ("FairSlip's words: FairSlip reads that as...")
            # and must not be advice.
            assert "FairSlip reads that as" not in q["note"], q["note"]
            for advice in ("half to take first", "next step", "you should", "do not lodge"):
                assert advice not in q["note"].lower(), f"advice in a note: {q['note']!r}"
                assert advice not in q["quoted"].lower(), f"advice inside a quote: {q['quoted']!r}"


def test_the_pack_shows_how_far_back_a_claim_reaches_not_only_when_to_file() -> None:
    """A deadline is when you may FILE. The look-back is how far back a filed
    claim may REACH. A worker shown only the first has an incomplete picture on
    the screen that tells them what to do next."""
    body = client.post("/agent/escalation", json={"level": 4}).json()
    quoted = [d["quoted"] for d in body["deadlines"]]
    assert "Your claims cannot be earlier than 1 year from the date of filing." in quoted
    assert len(body["deadlines"]) == 3


def test_the_look_back_is_scoped_to_the_case_the_page_prints_it_in() -> None:
    """TADM prints it inside the "If you have left employment" bullet, and the
    still-in-employment bullet does not repeat it. The label must not extend it,
    and it must be sourced to TADM - MOM's page does not carry the sentence."""
    body = client.post("/agent/escalation", json={"level": 4}).json()
    look_back = next(d for d in body["deadlines"] if "cannot be earlier" in d["quoted"])
    assert "if you have left" in look_back["label"].lower()
    assert look_back["source_url"] == agent.REFERENCE_LINKS["tadm_file_claim"]
    assert "no last-updated date shown" in look_back["source_label"]
