"""API tests. The transport must not add a number, lose a refusal, or relabel a line.

Every expected value here is one the engines already produce in the calibration suites;
the point of these tests is that the wire carries them unchanged, and that an engine's
refusal arrives as a refusal rather than a partial success.
"""

from dataclasses import fields
from decimal import Decimal

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

cpf = pytest.importorskip("fairslip.cpf")
main = pytest.importorskip("app.main")

D = Decimal
client = TestClient(main.app)


def fixtures() -> dict:
    r = client.get("/demo/fixtures")
    assert r.status_code == 200
    return r.json()


def persona(key: str) -> dict:
    for p in fixtures()["personas"]:
        if p["key"] == key:
            return p
    raise AssertionError(f"no fixture persona {key}")


def compute(key: str):
    return client.post("/compute", json=persona(key)["pay_inputs"])


def cpf_for(key: str, expected_ow: str):
    f = persona(key)["cpf"]
    return client.post(
        "/cpf",
        json={
            "declared_ow": f["declared_ow"],
            "expected_ow": expected_ow,
            "band": f["band"],
            "residency": f["residency"],
        },
    )


# --- health ---------------------------------------------------------------


def test_health_reports_only_that_the_process_answered():
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"service": "fairslip", "status": "up"}


# --- /compute -------------------------------------------------------------


def test_compute_returns_the_calibration_numbers_for_mei_ling():
    b = compute("mei_ling").json()
    assert b["expected_gross"]["display"] == "1462.24"
    assert b["deductions_total"]["display"] == "280.00"
    assert b["expected_net"]["display"] == "1182.24"
    assert b["net_paid"]["display"] == "1120.00"
    assert b["difference"]["display"] == "62.24"


def test_compute_returns_the_same_gross_for_rahim():
    b = compute("rahim").json()
    assert b["expected_gross"]["display"] == "1462.24"
    assert b["difference"]["display"] == "62.24"


def test_compute_carries_every_component_with_its_formula_and_input_sources():
    b = compute("mei_ling").json()
    labels = [c["label"] for c in b["components"]]
    assert labels == ["basic", "overtime", "rest_day"]
    for c in b["components"]:
        assert c["formula"], f"{c['label']} has no formula"
        assert c["inputs"], f"{c['label']} has no input sources"


def test_components_sum_to_the_expected_gross_the_engine_returned():
    # The screen shows the components and the gross; they must be the same arithmetic.
    b = compute("mei_ling").json()
    assert sum(D(c["amount"]["exact"]) for c in b["components"]) == D(b["expected_gross"]["exact"])


def test_every_amount_on_the_wire_carries_an_exact_value_and_a_two_decimal_display():
    # Walks the whole response rather than checking one field: a new Money-shaped field
    # cannot ship without a display the frontend can render without rounding anything.
    seen = 0

    def walk(node):
        nonlocal seen
        if isinstance(node, dict):
            if set(node) == {"exact", "display"}:
                seen += 1
                assert D(node["display"]) == D(node["exact"]).quantize(D("0.01"))
                assert (
                    node["display"].split(".")[1] != "" and len(node["display"].split(".")[1]) == 2
                )
                return
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(compute("mei_ling").json())
    walk(cpf_for("mei_ling", "1462.24").json())
    assert seen > 10


def test_the_ordinary_wage_the_api_hands_to_cpf_is_the_gross_the_engine_reconstructed():
    b = compute("mei_ling").json()
    assert b["cpf_ordinary_wage"]["exact"] == b["expected_gross"]["exact"]
    assert "overtime" in b["cpf_ordinary_wage_basis"]


def test_compute_refuses_an_unestablished_fact_and_says_which_one():
    r = compute("rahim_before_confirmation")
    assert r.status_code == 400
    body = r.json()
    assert body["error"] == "UNESTABLISHED_INPUT"
    assert "ot_hours" in body["detail"] and "DISAGREED" in body["detail"]


def test_compute_rejects_a_value_that_is_not_the_type_its_field_requires():
    payload = persona("mei_ling")["pay_inputs"]
    payload["monthly_basic"] = {"value": "not a number", "status": "AGREED", "source": "x"}
    r = client.post("/compute", json=payload)
    assert r.status_code == 400 and r.json()["error"] == "INVALID_INPUT"


def test_an_unestablished_value_is_not_coerced_on_the_way_in():
    # The DISAGREED fixture carries both readers' answers as an object. Parsing must not
    # try to make a number of it; the engine is what refuses.
    r = compute("rahim_before_confirmation")
    assert r.json()["error"] == "UNESTABLISHED_INPUT"


# --- /cpf -----------------------------------------------------------------


def test_cpf_returns_the_calibration_shortfall_for_mei_ling():
    c = cpf_for("mei_ling", "1462.24").json()
    assert c["declared"]["total"]["display"] == "518.00"
    assert c["expected"]["total"]["display"] == "541.00"
    assert (
        c["delta"]["total"]["display"],
        c["delta"]["employee"]["display"],
        c["delta"]["employer"]["display"],
    ) == ("23.00", "12.00", "11.00")


def test_cpf_split_lines_carry_the_labels_and_the_non_overlapping_amounts():
    lines = {ln["key"]: ln for ln in cpf_for("mei_ling", "1462.24").json()["split"]}
    assert lines["gross_shortfall"]["amount"]["display"] == "62.24"
    assert lines["employee_cpf_on_shortfall"]["amount"]["display"] == "12.00"
    assert lines["cash_shortfall"]["amount"]["display"] == "50.24"
    assert lines["cpf_shortfall"]["amount"]["display"] == "23.00"
    assert lines["employer_cpf_on_shortfall"]["amount"]["display"] == "11.00"
    assert lines["total_withheld"]["amount"]["display"] == "73.24"
    for ln in lines.values():
        assert ln["label"].strip()


def test_the_split_on_the_wire_is_every_field_of_the_engine_split_exactly_once():
    # Derived from the dataclass: the API cannot drop a line, and cannot invent one.
    engine_fields = {f.name for f in fields(cpf.ShortfallSplit)} - {"delta"}
    keys = [ln["key"] for ln in cpf_for("mei_ling", "1462.24").json()["split"]]
    assert sorted(keys) == sorted(engine_fields)
    assert len(keys) == len(set(keys))


def test_the_only_combined_figure_on_the_wire_is_total_withheld():
    c = cpf_for("mei_ling", "1462.24").json()
    lines = {ln["key"]: D(ln["amount"]["exact"]) for ln in c["split"]}
    naive = lines["gross_shortfall"] + lines["cpf_shortfall"]  # 85.24, double-counts the $12
    assert naive not in lines.values()
    assert lines["total_withheld"] == lines["cash_shortfall"] + lines["cpf_shortfall"]
    assert lines["total_withheld"] == lines["gross_shortfall"] + lines["employer_cpf_on_shortfall"]


def test_cpf_says_no_cpf_for_a_work_permit_holder_rather_than_erroring():
    c = cpf_for("rahim", "1462.24").json()
    assert c["expected"]["total"]["display"] == "0.00"
    assert any("NO_CPF" in f for f in c["expected"]["flags"])
    lines = {ln["key"]: ln["amount"]["display"] for ln in c["split"]}
    assert lines["cash_shortfall"] == "62.24"
    assert lines["cpf_shortfall"] == "0.00"
    assert lines["total_withheld"] == "62.24"


@pytest.mark.parametrize("residency", ["PR_YEAR_1", "PR_YEAR_2"])
def test_cpf_refuses_graduated_pr_rates_rather_than_approximating(residency):
    r = client.post(
        "/cpf",
        json={
            "declared_ow": "1400.00",
            "expected_ow": "1462.24",
            "band": "55 and below",
            "residency": residency,
        },
    )
    assert r.status_code == 400 and r.json()["error"] == "OUT_OF_SCOPE"


def test_cpf_refuses_wages_at_or_below_750():
    r = client.post(
        "/cpf",
        json={
            "declared_ow": "700",
            "expected_ow": "740",
            "band": "55 and below",
            "residency": "CITIZEN",
        },
    )
    assert r.status_code == 400 and r.json()["error"] == "OUT_OF_SCOPE"


@pytest.mark.parametrize(
    "field,value", [("band", "somewhere in his fifties"), ("residency", "MAYBE_PR")]
)
def test_cpf_refuses_an_unknown_band_or_residency(field, value):
    body = {
        "declared_ow": "1400.00",
        "expected_ow": "1462.24",
        "band": "55 and below",
        "residency": "CITIZEN",
    }
    body[field] = value
    r = client.post("/cpf", json=body)
    assert r.status_code == 400 and r.json()["error"] == "INVALID_INPUT"


# --- /demo/fixtures -------------------------------------------------------


def test_fixtures_are_labelled_fictional():
    assert "Fictional" in fixtures()["notice"]


def test_fixtures_serve_the_three_demo_personas():
    assert [p["key"] for p in fixtures()["personas"]] == [
        "mei_ling",
        "rahim",
        "rahim_before_confirmation",
    ]


def test_every_served_persona_states_the_month_and_where_its_age_band_came_from():
    for p in fixtures()["personas"]:
        assert p["cpf"]["contribution_month"] == "2026-09-01"
        assert p["cpf"]["band_source"].startswith("band_for(")


def test_every_served_fact_keeps_its_status_and_source():
    for p in fixtures()["personas"]:
        for name, fact in p["pay_inputs"].items():
            if fact is None:
                continue
            assert fact["status"] in {"AGREED", "DISAGREED", "MISSING", "HUMAN_CONFIRMED"}
            assert fact["source"], f"{p['key']}.{name} was served without a source"


def test_every_served_persona_round_trips_through_compute():
    # What the fixtures endpoint serves is exactly what /compute accepts: the frontend
    # posts back what it was given, and either gets a breakdown or the refusal the
    # fixture advertises.
    for p in fixtures()["personas"]:
        r = client.post("/compute", json=p["pay_inputs"])
        if p["expect_refusal"]:
            assert r.status_code == 400, p["key"]
            assert r.json()["error"] == "UNESTABLISHED_INPUT"
        else:
            assert r.status_code == 200, p["key"]
            assert r.json()["expected_gross"]["display"] == "1462.24"
