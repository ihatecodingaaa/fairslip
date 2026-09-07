"""The impact radius: change one established fact, and see what it reached.

The claim this view exists to make is the SECOND one - the lines that did NOT
move. It is only worth anything if it is computed. So every test here derives
its cases from the engine's own output rather than from a list of what depends
on what, and the central invariant is asserted over every field:

    a component that MOVED must carry the source string of a fact that changed.

And the converse, which the screen actually asserts: a component that HELD is
classified by whether it carried that source, never by assumption.

If that ever fails, either Component.inputs is wrong or the engine is, and the
API surfaces it as `unexplained_moves` rather than smoothing it over.
"""

from __future__ import annotations

import dataclasses
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

import demo.fixtures as fx
from app.main import app
from fairslip.rules import Fact, PayInputs, Status, compute_expected

client = TestClient(app)


def _facts(pi: PayInputs) -> dict:
    out: dict = {}
    for name in PayInputs.__dataclass_fields__:
        f = getattr(pi, name)
        if f is None:
            continue
        v = f.value
        if isinstance(v, dict):
            v = {str(k): str(x) for k, x in v.items()}
        elif not isinstance(v, (bool, int, str)) and v is not None:
            v = str(v)
        out[name] = {"value": v, "status": f.status.value, "source": f.source}
    return out


BEFORE = _facts(fx.mei_ling_month1_established())


def _after(**changes: object) -> dict:
    after = {k: dict(v) for k, v in BEFORE.items()}
    for k, v in changes.items():
        after[k] = {
            "value": v,
            "status": "HUMAN_CONFIRMED",
            "source": f"you changed this on screen: {k}",
        }
    return after


def _impact(**changes: object) -> dict:
    r = client.post("/impact", json={"before": BEFORE, "after": _after(**changes)})
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------
# The invariant: nothing moves that is not connected to the change
# --------------------------------------------------------------------------

# Every field the worker can change on screen, and a value that differs from the
# fixture. Hand-written - so the test below asserts it covers PayInputs EXACTLY.
# It used to assert a subset, and the comment claimed a derivation it did not
# do: a tenth field would have left both invariant tests green and untested.
CHANGEABLE: dict[str, object] = {
    "monthly_basic": "1500",
    "ot_hours": "20",
    "days_per_week": 5,
    "normal_daily_hours": "7",
    "deductions_total": "300",
    "net_paid": "1000.00",
    "rest_day_hours": "4",
    "rest_day_requested_by": "employee",
    "is_workman": True,
}


def test_every_changeable_field_is_a_real_field_on_pay_inputs() -> None:
    """Equality, not subset. A field ADDED to PayInputs must fail here rather
    than be silently absent from every parametrised test below."""
    assert set(CHANGEABLE) == set(PayInputs.__dataclass_fields__)


@pytest.mark.parametrize("field", sorted(CHANGEABLE))
def test_nothing_moves_that_does_not_carry_a_changed_facts_source(field: str) -> None:
    """THE central claim, over every field.

    A line that moved must list, among its own inputs, the provenance string of
    a fact that changed. This is what makes "these eleven did not move" a
    computed statement instead of a sentence someone typed."""
    body = _impact(**{field: CHANGEABLE[field]})
    assert body["unexplained_moves"] == [], (
        f"changing {field} moved {body['unexplained_moves']} with no dependency on it; "
        f"Component.inputs and the engine disagree"
    )
    for c in body["components"]:
        if c["status"] != "UNCHANGED":
            assert c["depends_on_changed"], f"{c['label']} moved without depending on {field}"


@pytest.mark.parametrize("field", sorted(CHANGEABLE))
def test_the_two_counts_account_for_every_component(field: str) -> None:
    """moved + unchanged is the whole breakdown - no line is left out of both,
    which is how "these did not move" could otherwise be quietly incomplete."""
    body = _impact(**{field: CHANGEABLE[field]})
    assert body["moved_count"] + body["unchanged_count"] == len(body["components"])
    assert body["components"], "no components at all; this test would be vacuous"


# --------------------------------------------------------------------------
# The specific radii, checked against the engine rather than asserted
# --------------------------------------------------------------------------


def test_changing_overtime_hours_moves_overtime_and_leaves_the_others_alone() -> None:
    body = _impact(ot_hours="20")
    status = {c["label"]: c["status"] for c in body["components"]}
    assert status["overtime"] == "MOVED"
    assert status["basic"] == "UNCHANGED"
    assert status["rest_day"] == "UNCHANGED"
    assert body["unchanged_count"] == 2


def test_changing_the_rest_day_hours_moves_only_the_rest_day_line() -> None:
    body = _impact(rest_day_hours="4")
    status = {c["label"]: c["status"] for c in body["components"]}
    assert status["rest_day"] == "MOVED"
    assert status["overtime"] == "UNCHANGED"
    assert status["basic"] == "UNCHANGED"
    # "only" is a count, so pin it: a fourth line appearing would not falsify
    # the three assertions above.
    assert body["moved_count"] == 1


def test_changing_the_basic_moves_every_line_that_is_derived_from_it() -> None:
    """The basic reaches all three: the hourly rate and the daily rate are both
    built from it. Asserted against the engine's own inputs, not from memory."""
    body = _impact(monthly_basic="1500")
    moved = {c["label"] for c in body["components"] if c["status"] == "MOVED"}
    assert moved == {"basic", "overtime", "rest_day"}
    assert body["unchanged_count"] == 0


def test_a_line_that_disappears_is_removed_not_unchanged() -> None:
    """Take the rest-day hours to zero and the rest-day line is not a smaller
    number, it is absent. Calling that "unchanged" would be false."""
    body = _impact(rest_day_hours="0")
    rest = next(c for c in body["components"] if c["label"] == "rest_day")
    assert rest["status"] == "REMOVED"
    assert rest["before"] is not None
    assert rest["after"] is None
    assert rest["depends_on_changed"] is True


def test_changing_net_paid_moves_no_component_but_moves_the_difference() -> None:
    """What reached the bank is not an input to any component - it is the other
    side of the comparison. Every line should hold still and the difference
    should move, which is a good demonstration of the view's point."""
    body = _impact(net_paid="1000.00")
    assert body["moved_count"] == 0
    assert body["unchanged_count"] == len(body["components"])
    assert body["before_difference"]["display"] != body["after_difference"]["display"]


# --------------------------------------------------------------------------
# The arithmetic is the engine's
# --------------------------------------------------------------------------


def test_every_figure_matches_a_second_run_of_the_engine_itself() -> None:
    """No frontend arithmetic, and no backend shortcut either: the numbers the
    endpoint returns are compared against compute_expected() run directly."""
    body = _impact(ot_hours="20")
    before_bd = compute_expected(fx.mei_ling_month1_established())
    assert body["before_difference"]["exact"] == str(before_bd.difference)
    assert body["before_expected_net"]["exact"] == str(before_bd.expected_net)
    for c in body["components"]:
        if c["before"] is not None:
            engine = before_bd.component(c["label"])
            assert c["before"]["exact"] == str(engine.amount)


def test_the_after_side_figures_match_the_engine_too() -> None:
    """The before-side was checked and the after-side was not - and the after
    side is the half this endpoint newly computes, so "every figure" was about
    half the figures."""
    body = _impact(ot_hours="20")
    before_bd = compute_expected(fx.mei_ling_month1_established())
    after_bd = compute_expected(
        dataclasses.replace(
            fx.mei_ling_month1_established(),
            ot_hours=Fact(
                Decimal(20), Status.HUMAN_CONFIRMED, "you changed this on screen: ot_hours"
            ),
        )
    )
    assert body["after_difference"]["exact"] == str(after_bd.difference)
    assert body["after_expected_net"]["exact"] == str(after_bd.expected_net)
    assert body["difference_delta"]["exact"] == str(
        after_bd.difference - before_bd.difference
    )
    for c in body["components"]:
        if c["after"] is not None:
            assert c["after"]["exact"] == str(after_bd.component(c["label"]).amount)


def test_the_delta_is_after_minus_before_for_every_moved_line() -> None:
    body = _impact(monthly_basic="1500")
    for c in body["components"]:
        if c["status"] == "MOVED":
            assert Decimal(c["delta"]["exact"]) == Decimal(c["after"]["exact"]) - Decimal(
                c["before"]["exact"]
            )


# --------------------------------------------------------------------------
# A refusal is the answer, not a fallback
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("days_per_week", 7, "UNESTABLISHED_INPUT"),
        ("monthly_basic", "abc", "INVALID_INPUT"),
        ("ot_hours", "NaN", "UNESTABLISHED_INPUT"),
        ("ot_hours", "-5", "UNESTABLISHED_INPUT"),
    ],
)
def test_a_value_the_engine_cannot_use_is_refused_and_no_figure_comes_back(
    field: str, value: object, code: str
) -> None:
    """The screen must not fall back to the old number. A previous figure shown
    after a refused re-run is a stale amount presented as a current one."""
    r = client.post("/impact", json={"before": BEFORE, "after": _after(**{field: value})})
    assert r.status_code == 400
    body = r.json()
    assert body["error"] == code
    assert "components" not in body
    assert "after_difference" not in body


def test_an_unestablished_new_value_is_refused_rather_than_computed() -> None:
    after = {k: dict(v) for k, v in BEFORE.items()}
    after["ot_hours"] = {"value": None, "status": "MISSING", "source": "not established"}
    r = client.post("/impact", json={"before": BEFORE, "after": after})
    assert r.status_code == 400
    assert r.json()["error"] == "UNESTABLISHED_INPUT"


def test_comparing_a_month_with_itself_is_refused_rather_than_shown_as_no_impact() -> None:
    """"Nothing moved" for a change nobody made would be a true sentence about a
    question nobody asked, and it reads as a result."""
    r = client.post("/impact", json={"before": BEFORE, "after": BEFORE})
    assert r.status_code == 400
    assert "nothing changed" in r.json()["detail"]


def test_a_fact_present_on_one_side_only_is_refused() -> None:
    after = {k: dict(v) for k, v in BEFORE.items()}
    del after["rest_day_hours"]
    r = client.post("/impact", json={"before": BEFORE, "after": after})
    assert r.status_code == 400
    assert "rest_day_hours" in r.json()["detail"]


# --------------------------------------------------------------------------
# There is no field-to-component map
# --------------------------------------------------------------------------


def test_the_codebase_holds_no_hardcoded_field_to_component_map() -> None:
    """The dependency edges must come from Component.inputs. A lookup table
    would be a second source of truth that drifts from the engine silently.

    Rewritten after review found four holes: it scanned one file, checked one of
    the two shapes such a map can take, hardcoded the component labels, and had
    no non-vacuity guard - so moving one dict out of main.py would have left the
    loop body never entered and the test green having asserted nothing."""
    import ast
    import pathlib

    backend = pathlib.Path(__file__).resolve().parent.parent
    files = [
        backend / "app" / "main.py",
        backend / "app" / "schemas.py",
        backend / "fairslip" / "rules.py",
        backend / "fairslip" / "agent.py",
    ]
    # Derived from the engine, so a fifth component is covered automatically.
    labels = {c.label for c in compute_expected(fx.mei_ling_month1_established()).components}
    labels |= {"rest_day_overtime"}  # only present on some months
    fields = set(PayInputs.__dataclass_fields__)

    examined = 0
    for path in files:
        assert path.is_file(), f"{path} is missing; this test would scan less than it claims"
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if not isinstance(node, ast.Dict):
                continue
            examined += 1
            keys = {k.value for k in node.keys if isinstance(k, ast.Constant)}
            strings = {
                c.value
                for c in ast.walk(node)
                if isinstance(c, ast.Constant) and isinstance(c.value, str)
            }
            # field -> component, and the inverse, which is the more natural way
            # to write one and was invisible before.
            assert not (keys & fields and labels & strings), (
                f"a field-to-component map appears in {path.name}: {ast.dump(node)[:200]}"
            )
            assert not (keys & labels and fields & strings), (
                f"a component-to-field map appears in {path.name}: {ast.dump(node)[:200]}"
            )

    assert examined >= 5, (
        f"only {examined} dict literals examined; the scan is not reaching the code "
        f"it claims to check"
    )


# --------------------------------------------------------------------------
# The OTHER direction, which is what let a false sentence onto the screen
# --------------------------------------------------------------------------


@pytest.mark.parametrize("field", sorted(CHANGEABLE))
def test_every_held_line_is_classified_by_whether_it_listed_the_changed_fact(
    field: str,
) -> None:
    """`held_but_dependent` is exactly the UNCHANGED lines that DID list it.

    Only the MOVED direction was asserted, so nothing caught the screen printing
    "did not list the fact you changed among its inputs" under every held line -
    false for any line that lists the fact and holds its value anyway."""
    body = _impact(**{field: CHANGEABLE[field]})
    expected = {
        c["label"]
        for c in body["components"]
        if c["status"] == "UNCHANGED" and c["depends_on_changed"]
    }
    assert set(body["held_but_dependent"]) == expected


def test_a_line_can_list_the_changed_fact_and_still_hold_its_value() -> None:
    """The concrete case, so the classification is not vacuous on this fixture.

    The rest-day table brackets on HALF the normal daily hours, so moving 8 to 9
    crosses no bracket: rest_day lists normal_daily_hours among its inputs and
    comes out at the same amount."""
    body = _impact(normal_daily_hours="9")
    rest = next(c for c in body["components"] if c["label"] == "rest_day")
    assert rest["status"] == "UNCHANGED"
    assert rest["depends_on_changed"] is True
    assert body["held_but_dependent"] == ["rest_day"]


def test_a_boolean_that_was_not_touched_is_not_reported_as_a_change() -> None:
    """The input box is seeded with String(fact.value), so a boolean field sends
    the string "false" against the boolean False. Comparing the wire values
    called that a change and the screen reported "is workman False -> false" for
    a fact nobody touched. The comparison is on the CONVERTED values now."""
    after = {k: dict(v) for k, v in BEFORE.items()}
    after["is_workman"] = {
        "value": "false",
        "status": "HUMAN_CONFIRMED",
        "source": "you changed this on screen: is_workman",
    }
    r = client.post("/impact", json={"before": BEFORE, "after": after})
    assert r.status_code == 400
    assert "nothing changed" in r.json()["detail"]


def test_a_decimal_written_differently_is_not_reported_as_a_change() -> None:
    after = {k: dict(v) for k, v in BEFORE.items()}
    after["ot_hours"] = {
        "value": "18.0",
        "status": "HUMAN_CONFIRMED",
        "source": "you changed this on screen: ot_hours",
    }
    r = client.post("/impact", json={"before": BEFORE, "after": after})
    assert r.status_code == 400
    assert "nothing changed" in r.json()["detail"]


@pytest.mark.parametrize("field", sorted(CHANGEABLE))
def test_the_two_contradiction_lists_are_disjoint_and_bounded(field: str) -> None:
    """One names moved-without-dependency (a real contradiction). The other names
    held-with-dependency (not an error at all). A label cannot be in both."""
    body = _impact(**{field: CHANGEABLE[field]})
    assert not set(body["unexplained_moves"]) & set(body["held_but_dependent"])
    labels = {c["label"] for c in body["components"]}
    assert set(body["unexplained_moves"]) <= labels
    assert set(body["held_but_dependent"]) <= labels


def test_a_shared_provenance_string_is_refused_rather_than_reported() -> None:
    """The edges are matched on the identity of a source string, and nothing
    requires those strings to be distinct - Fact.source even defaults to "".
    Give every fact one source and `depends_on_changed` becomes constant True:
    every line claims to depend on the change and `unexplained_moves` can never
    fire. The detector would report green because it had been BLINDED.

    So the run is refused. A view whose whole claim is "these lines did not move,
    and here is why" must not answer when it cannot tell which line is which."""
    for shared in ("payslip.jpg", ""):
        before = {k: {**v, "source": shared} for k, v in BEFORE.items()}
        after = {k: dict(v) for k, v in before.items()}
        after["ot_hours"] = {"value": "20", "status": "HUMAN_CONFIRMED", "source": shared}
        r = client.post("/impact", json={"before": before, "after": after})
        assert r.status_code == 400, f"shared source {shared!r} was not refused"
        assert "shared with another fact" in r.json()["detail"]


def test_the_collision_guard_does_not_refuse_a_legitimate_run() -> None:
    """The fixture's nine facts carry nine distinct sources, so the guard must
    be invisible on every real path."""
    assert _impact(ot_hours="20")["components"]
