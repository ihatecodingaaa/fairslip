"""Which facts produced each line, and the rule that it is never guessed.

/compute now returns `input_fields` per component: the PayInputs field names
behind each amount. It exists so a screen can DRAW the trail from a document to
a dollar instead of describing it. That makes it a dependency graph on a screen,
and this repo has already learned what goes wrong with those:

  * detector-blinded-by-a-shared-key - a provenance string carried by two facts
    made every line claim to depend on the change, so the contradiction detector
    could never fire. It reported green because it had been blinded.
  * input-consumed-but-not-recorded - both rest-day components consumed
    `normal_daily_hours` and neither listed it, and nothing noticed because
    nothing read `inputs` AS A GRAPH.

So the claims here are:

  1. NOTHING IS DROPPED. One output entry per entry in `Component.inputs`, so a
     source the server could not attribute is visible rather than absent.
  2. NOTHING IS INVENTED. `input_fields` equals the set of field names whose
     Fact.source the request actually sent - computed here from the request,
     over every field of PayInputs.
  3. A SHARED SOURCE IS ATTRIBUTED TO NEITHER FACT. The positive control: give
     two facts one source string and the line names neither of them.
  4. THERE IS STILL NO MAP - on either side of the wire. test_impact.py holds
     the backend half; the frontend half is here, because that is the half this
     response makes tempting.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import demo.fixtures as fx
from app.main import app
from fairslip.rules import Fact, PayInputs, compute_expected

client = TestClient(app)

REPO = Path(__file__).resolve().parent.parent.parent


def _fact_out(f: Fact) -> dict:
    return {"value": str(f.value), "status": f.status.value, "source": f.source}


def _body(inputs: PayInputs) -> dict:
    return {
        name: (None if f is None else _fact_out(f))
        for name in PayInputs.__dataclass_fields__
        if (f := getattr(inputs, name)) is not None or True
    }


BODY = _body(fx.mei_ling_month1_established())


def _compute(body: dict) -> dict:
    r = client.post("/compute", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------- 1. nothing is dropped


def test_the_endpoint_returns_components_at_all() -> None:
    """Otherwise every assertion below passes by examining nothing."""
    out = _compute(BODY)
    assert out["components"], "no components came back"
    assert any(c["inputs"] for c in out["components"]), "no component recorded any input"


@pytest.mark.parametrize("label", [c.label for c in compute_expected(fx.mei_ling_month1_established()).components])
def test_every_recorded_input_comes_back_either_resolved_or_named_as_unresolved(
    label: str,
) -> None:
    """The count is the guard. A resolution that quietly discards what it could
    not match looks identical to one that matched everything."""
    out = _compute(BODY)
    c = next(x for x in out["components"] if x["label"] == label)
    assert len(c["input_fields"]) + len(c["unresolved_inputs"]) == len(c["inputs"]), (
        f"{label}: {len(c['inputs'])} inputs in, "
        f"{len(c['input_fields'])} resolved + {len(c['unresolved_inputs'])} unresolved out"
    )


def test_the_fixture_resolves_completely() -> None:
    """Every fact in the shipped fixture carries its own source string, so a
    healthy month must resolve with nothing left over. If this ever fails, the
    fixture has gained a collision and the tests below are testing the wrong
    thing."""
    out = _compute(BODY)
    leftover = {c["label"]: c["unresolved_inputs"] for c in out["components"] if c["unresolved_inputs"]}
    assert not leftover, f"unresolved provenance on a healthy month: {leftover}"


# --------------------------------------------------- 2. nothing is invented


def _expected_fields(body: dict, component_inputs: list[str]) -> list[str]:
    """What the resolution MUST produce, computed here from the request.

    Derived over every field of PayInputs rather than from a list, so a field
    added to the engine is covered without an edit.
    """
    carriers: dict[str, list[str]] = {}
    for name in PayInputs.__dataclass_fields__:
        f = body.get(name)
        if f is not None:
            carriers.setdefault(f["source"], []).append(name)
    unique = {src: names[0] for src, names in carriers.items() if len(names) == 1}
    return [unique[src] for src in component_inputs if src in unique]


def test_every_resolved_field_is_one_the_request_supplied_under_that_source() -> None:
    """The API may only report what the request already established.

    This is the assertion that separates a resolution from a lookup table: the
    expected answer is recomputed from the facts that were sent, so a hardcoded
    dependency would disagree the moment a source string changed.
    """
    out = _compute(BODY)
    for c in out["components"]:
        assert c["input_fields"] == _expected_fields(BODY, c["inputs"]), (
            f"{c['label']}: input_fields {c['input_fields']} is not what the request's own "
            f"provenance strings resolve to"
        )


@pytest.mark.parametrize("field", sorted(PayInputs.__dataclass_fields__))
def test_a_field_the_engine_consumed_is_named_by_the_line_that_consumed_it(field: str) -> None:
    """The graph must be at least as large as the arithmetic.

    /impact holds the same invariant from the other side - a MOVED line must
    carry the source of a fact that changed - and it failed on
    `normal_daily_hours` the first time it ran, because both rest-day components
    consumed it and neither recorded it. Here the question is asked of the
    resolved NAMES: change one fact, and every line that moved must name it.
    """
    before = {k: dict(v) for k, v in BODY.items() if v is not None}
    if field not in before:
        pytest.skip(f"{field} is not supplied by this fixture")
    original = before[field]["value"]
    alternatives = {
        "days_per_week": ["5" if original == "6" else "6"],
        "is_workman": ["false" if original == "true" else "true"],
        "rest_day_requested_by": ["employee" if original == "employer" else "employer"],
    }.get(field)
    if alternatives is None:
        # BOTH DIRECTIONS, and the second is not decoration: raising
        # normal_daily_hours from 8 to 11 crosses no bracket and produces no
        # rest-day overtime, so a +3-only bump skipped the one field
        # docs/debt.md records as having been consumed without being recorded.
        alternatives = [str(float(original) + 3), str(max(float(original) - 3, 0))]

    # ADDED and REMOVED count. A rest-day overtime line that APPEARS when the
    # hours cross the normal day is as much a consequence of the change as one
    # that moves.
    affected: dict[str, str] = {}
    after: dict = {}
    for candidate in alternatives:
        after = {k: dict(v) for k, v in before.items()}
        after[field] = {
            **before[field],
            "value": candidate,
            "source": f"changed for this test: {field}",
        }
        impact = client.post("/impact", json={"before": before, "after": after})
        assert impact.status_code == 200, impact.text
        affected = {
            c["label"]: c["status"]
            for c in impact.json()["components"]
            if c["status"] != "UNCHANGED"
        }
        if affected:
            break
    if not affected:
        pytest.skip(f"changing {field} affected no component in either direction")

    # A REMOVED line is absent from the after-run, so its record is in the before.
    after_run = _compute(after)["components"]
    before_run = _compute(before)["components"]
    for label, status in affected.items():
        side = before_run if status == "REMOVED" else after_run
        c = next(x for x in side if x["label"] == label)
        assert field in c["input_fields"], (
            f"{label} was {status} when {field} changed and does not name it among its "
            f"inputs. A trail drawn from input_fields would be missing that edge."
        )


# ------------------------------------ 3. a shared source is attributed to nothing


def test_a_provenance_string_carried_by_two_facts_is_attributed_to_neither() -> None:
    """The positive control for the whole design.

    Fact.source has no uniqueness requirement and defaults to "". Give two facts
    one string and the honest answer is "this line depends on something I cannot
    name" - not the first of the two, which is how a dependency view comes to be
    confidently wrong. /impact refuses outright; this response reports it.
    """
    collided = {k: dict(v) for k, v in BODY.items() if v is not None}
    shared = "one source string for two facts"
    collided["monthly_basic"] = {**collided["monthly_basic"], "source": shared}
    collided["ot_hours"] = {**collided["ot_hours"], "source": shared}

    out = _compute(collided)
    overtime = next(c for c in out["components"] if c["label"] == "overtime")
    assert shared in overtime["unresolved_inputs"], (
        "the shared string is not reported as unresolved"
    )
    assert "monthly_basic" not in overtime["input_fields"], "a collided fact was attributed anyway"
    assert "ot_hours" not in overtime["input_fields"], "a collided fact was attributed anyway"
    # And still nothing dropped.
    assert len(overtime["input_fields"]) + len(overtime["unresolved_inputs"]) == len(
        overtime["inputs"]
    )


def test_the_collision_does_not_silently_shrink_the_rest_of_the_response() -> None:
    """A collision on two facts must not cost the lines that did not touch them."""
    collided = {k: dict(v) for k, v in BODY.items() if v is not None}
    shared = "one source string for two facts"
    collided["deductions_total"] = {**collided["deductions_total"], "source": shared}
    collided["net_paid"] = {**collided["net_paid"], "source": shared}
    out = _compute(collided)
    overtime = next(c for c in out["components"] if c["label"] == "overtime")
    assert set(overtime["input_fields"]) == {"monthly_basic", "ot_hours"}
    assert overtime["unresolved_inputs"] == []


def test_the_response_says_how_the_resolution_was_done() -> None:
    """A trail is worth what its account of its own edges is worth."""
    note = _compute(BODY)["provenance_note"]
    assert "recorded inputs" in note
    assert "more than one fact" in note


# --------------------------------- 4. no field-to-component map, either side


def _field_names() -> set[str]:
    return set(PayInputs.__dataclass_fields__)


def _component_labels() -> set[str]:
    labels = {c.label for c in compute_expected(fx.mei_ling_month1_established()).components}
    return labels | {"rest_day_overtime"}


def test_the_frontend_holds_no_field_to_component_map_either() -> None:
    """The half test_impact.py cannot see.

    `input_fields` makes a frontend map tempting for the first time: the graph
    needs edges, and typing `{overtime: ["ot_hours", "monthly_basic"]}` into a
    TSX file would draw them without asking the engine. It would also be a second
    source of truth that drifts in silence, which is the defect the backend half
    of this test exists to prevent - so it is checked on both sides of the wire.

    Object literals are found textually rather than parsed: there is no Python
    JS parser here, and a literal that pairs a field name with a component label
    inside one brace block is the shape that matters however it is written.
    """
    fields, labels = _field_names(), _component_labels()
    roots = [REPO / "frontend" / "app", REPO / "frontend" / "lib"]
    files = [p for root in roots for p in sorted(root.rglob("*.ts*"))]
    assert files, "no frontend sources found; this test would pass by examining nothing"

    examined = 0
    offenders: list[str] = []
    for path in files:
        src = re.sub(r"/\*.*?\*/", "", path.read_text(encoding="utf-8"), flags=re.DOTALL)
        src = re.sub(r"(?<!:)//[^\n]*", "", src)
        # Every brace-delimited block, shallowly: enough to catch a literal that
        # pairs the two vocabularies without needing to understand the syntax.
        for block in re.findall(r"\{[^{}]*\}", src):
            quoted = set(re.findall(r"[\"'`]([a-z_]+)[\"'`]", block))
            bare_keys = set(re.findall(r"(?:^|[{,])\s*([a-z_]+)\s*:", block))
            names = quoted | bare_keys
            if not names:
                continue
            examined += 1
            if names & fields and names & labels:
                offenders.append(f"{path.relative_to(REPO)}: {block[:160]}")
    assert examined >= 10, (
        f"only {examined} object literals examined; the scan is not reaching the code it claims"
    )
    assert not offenders, (
        "a literal pairing a PayInputs field with a component label appears in the frontend:\n"
        + "\n".join(offenders)
        + "\nEdges must come from ComponentOut.input_fields, which the engine recorded."
    )


def test_the_scan_would_catch_a_map_if_one_were_written() -> None:
    """The non-vacuity guard for the test above, which is the one that matters:
    a textual scan that matches nothing passes on any codebase at all."""
    fields, labels = _field_names(), _component_labels()
    planted = '{ overtime: ["ot_hours", "monthly_basic"] }'
    quoted = set(re.findall(r"[\"'`]([a-z_]+)[\"'`]", planted))
    bare_keys = set(re.findall(r"(?:^|[{,])\s*([a-z_]+)\s*:", planted))
    names = quoted | bare_keys
    assert names & fields and names & labels, (
        "the scan's own matcher does not recognise a hand-written map, so the scan "
        "above cannot be relied on"
    )


def test_the_backend_resolution_is_not_a_literal_map_either() -> None:
    """The resolver added for this contract, held to the rule test_impact.py
    already applies to the rest of the module."""
    src = (REPO / "backend" / "app" / "main.py").read_text(encoding="utf-8")
    fields, labels = _field_names(), _component_labels()
    for node in ast.walk(ast.parse(src)):
        if not isinstance(node, ast.Dict):
            continue
        keys = {k.value for k in node.keys if isinstance(k, ast.Constant)}
        strings = {
            c.value for c in ast.walk(node) if isinstance(c, ast.Constant) and isinstance(c.value, str)
        }
        assert not (keys & fields and labels & strings), f"map in main.py: {ast.dump(node)[:200]}"
        assert not (keys & labels and fields & strings), f"map in main.py: {ast.dump(node)[:200]}"
