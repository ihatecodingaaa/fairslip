"""A state diagram that drifts from its own machine is worse than no diagram.

The picture on /check is drawn entirely from what /agent/mandate serves, and
what it serves is built from agent.py's own AgentState, TRANSITIONS, ENTERED_BY
and MANDATE_TABLE. Nothing about the graph is written down a second time.

This module holds that. It asserts the SERVED graph equals the machine - node
for node and edge for edge - and that the frontend contains no node list, no
edge list and no level of its own to fall back on. A diagram is a claim about
what the software does; if it can be right on the day it is drawn and wrong a
week later, it is a decoration that looks like evidence.

Two facts get their own tests because they are design decisions somebody could
quietly undo:

  UNVERIFIABLE IS NOT TERMINAL. A worker whose month-2 payslip could not be read
  has not reached the end of anything - they can supply it again or wait for the
  next salary period. If that edge is ever deleted the diagram would start
  telling them their case is over.

  AWAITING_NEXT_PAYSLIP IS NOT BUILT. It is inside the mandate at level 2 and
  the software does not implement it, and those are different sentences. The
  diagram has to be able to say the second one.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from fairslip.agent import (
    ENTERED_BY,
    MANDATE_TABLE,
    TRANSITIONS,
    Action,
    AgentState,
    Verdict,
    is_built,
    required_level,
    state_requires_level,
)

REPO = Path(__file__).resolve().parent.parent.parent
DIAGRAM = REPO / "frontend" / "app" / "check" / "AgentMachine.tsx"
PANEL = REPO / "frontend" / "app" / "check" / "AgentPanel.tsx"


@pytest.fixture(scope="module")
def served():
    return TestClient(app).get("/agent/mandate").json()["machine"]


# ------------------------------------------------- the map is total and honest


def test_every_state_says_which_action_enters_it() -> None:
    """A state missing from ENTERED_BY has no level, so a diagram could not
    decide whether to strike it through - and would draw it as permitted."""
    assert set(ENTERED_BY) == set(AgentState)


def test_the_start_state_needs_no_permission() -> None:
    """Being told a number does not add up is not something a worker has to
    allow. Only DISCREPANCY_FOUND is like that."""
    unpermissioned = {s for s in AgentState if ENTERED_BY[s] is None}
    assert unpermissioned == {AgentState.DISCREPANCY_FOUND}
    assert state_requires_level(AgentState.DISCREPANCY_FOUND) is None


@pytest.mark.parametrize("state", [s for s in AgentState if ENTERED_BY[s] is not None])
def test_each_states_level_is_the_level_of_the_action_that_enters_it(state: AgentState) -> None:
    """Derived, so a level that moves in MANDATE_TABLE moves on the diagram."""
    action = ENTERED_BY[state]
    assert action is not None
    assert state_requires_level(state) == required_level(action)


def test_every_verdict_is_entered_by_verify() -> None:
    """The four verdicts are outcomes of one action, not four things a worker
    allows separately - which is why one missing permission strikes through the
    whole right-hand side of the diagram at once."""
    for v in Verdict:
        assert ENTERED_BY[AgentState(v.value)] is Action.VERIFY


# ------------------------------------------ the served graph IS the machine


def test_the_served_nodes_are_exactly_the_enum_members(served) -> None:
    assert {s["name"] for s in served["states"]} == {s.value for s in AgentState}
    assert len(served["states"]) == len(AgentState), "a node was served twice"


def test_the_served_edges_are_exactly_the_transitions(served) -> None:
    """Edge for edge, in both directions: nothing drawn that the machine does
    not allow, and nothing allowed that the drawing omits."""
    drawn = {s["name"]: set(s["to"]) for s in served["states"]}
    actual = {st.value: {x.value for x in TRANSITIONS[st]} for st in AgentState}
    assert drawn == actual


def test_the_served_levels_are_the_mandate_tables(served) -> None:
    for s in served["states"]:
        assert s["required_level"] == state_requires_level(AgentState(s["name"]))


def test_the_served_verdicts_are_the_verdict_enum(served) -> None:
    assert served["verdicts"] == [v.value for v in Verdict]


def test_the_served_start_is_the_start(served) -> None:
    assert served["start"] == AgentState.DISCREPANCY_FOUND.value


def test_terminal_is_derived_from_having_no_outgoing_edges(served) -> None:
    for s in served["states"]:
        assert s["terminal"] == (not TRANSITIONS[AgentState(s["name"])])


def test_the_served_built_flag_is_the_engines(served) -> None:
    for s in served["states"]:
        action = ENTERED_BY[AgentState(s["name"])]
        assert s["built"] == (is_built(action) if action else True)


# ----------------------------------------------- the two design decisions


def test_unverifiable_is_re_attemptable_and_not_an_end_state(served) -> None:
    """The one a diagram would get wrong by drawing the obvious shape.

    Four verdicts hanging off VERIFYING look like four endings. Three of them
    are; this one returns, and a worker whose payslip photograph came out
    unreadable needs to be able to see that.
    """
    node = next(s for s in served["states"] if s["name"] == "UNVERIFIABLE")
    assert node["terminal"] is False
    assert node["re_attemptable"] is True
    assert set(node["to"]) == {"AWAITING_NEXT_PAYSLIP", "VERIFYING"}


def test_not_terminal_is_not_the_same_as_re_attemptable(served) -> None:
    """The distinction the diagram got wrong on its first run.

    PARTIALLY_CORRECTED and NOT_CORRECTED are not terminal - they go on to the
    escalation pack - and they never come back. Drawing "not terminal" as "can
    be attempted again" told a worker their part-corrected month could be
    re-checked, which the machine does not offer.
    """
    by = {s["name"]: s for s in served["states"]}
    for name in ("PARTIALLY_CORRECTED", "NOT_CORRECTED"):
        assert by[name]["terminal"] is False
        assert by[name]["re_attemptable"] is False, f"{name} does not return to itself"
    cyclic = {s["name"] for s in served["states"] if s["re_attemptable"]}
    assert cyclic == {"AWAITING_NEXT_PAYSLIP", "VERIFYING", "UNVERIFIABLE"}


def test_the_diagram_labels_re_attemptable_from_the_served_flag(served) -> None:
    """Not from `!terminal`, which is the mistake this file exists to prevent."""
    src = DIAGRAM.read_text(encoding="utf-8")
    assert "state.re_attemptable" in src
    assert "!state.terminal &&" not in src, "the diagram is inferring it again"


def test_awaiting_next_payslip_is_permitted_and_not_built(served) -> None:
    """Two different sentences, and the diagram must be able to say the second.

    "You did not allow this" and "we did not build this" send a worker to
    different places, and collapsing them would tell someone to raise a mandate
    level to reach something that works at no level.
    """
    node = next(s for s in served["states"] if s["name"] == "AWAITING_NEXT_PAYSLIP")
    assert node["required_level"] == 2
    assert node["built"] is False


def test_no_state_is_reachable_below_the_level_of_the_state_before_it() -> None:
    """The chain's levels never go backwards, so "raise to N and this unlocks"
    is a true statement about everything downstream rather than about one node."""
    chain = [
        AgentState.MESSAGE_DRAFTED,
        AgentState.SENT,
        AgentState.AWAITING_NEXT_PAYSLIP,
        AgentState.VERIFYING,
        AgentState.ESCALATION_PREPARED,
    ]
    levels = [state_requires_level(s) for s in chain]
    assert levels == sorted(levels), f"the chain's levels are not monotonic: {levels}"


# --------------------------------------- the drawing keeps no copy of the graph


def test_the_diagram_hardcodes_no_node_edge_or_level() -> None:
    """The whole point of the exercise.

    The component may name states in a LAYOUT hint - which column a node sits
    in - but it may not carry the node list, the edges, or a mandate level,
    because any of those could be right today and wrong after a change to
    agent.py that nothing here would catch.
    """
    assert DIAGRAM.exists(), f"{DIAGRAM} does not exist"
    src = re.sub(r"/\*.*?\*/", "", DIAGRAM.read_text(encoding="utf-8"), flags=re.DOTALL)
    src = re.sub(r"(?<!:)//[^\n]*", "", src)

    # No edge list: a state name must never be written as the target of another.
    for st in AgentState:
        for target in TRANSITIONS[st]:
            pair = f'"{st.value}"'
            assert not (pair in src and f'"{target.value}"' in src and "to:" in src), (
                f"the diagram appears to carry its own edge {st.value} -> {target.value}"
            )

    # No mandate level as a literal beside an action name.
    for action in Action:
        lvl = required_level(action)
        assert f'"{action.value}": {lvl}' not in src, f"{action.value}'s level is hardcoded"
    assert not re.search(r"requiredLevel\s*[:=]\s*[0-9]", src), "a required level is hardcoded"

    # And it must actually read the served machine.
    assert "machine.states" in src, "the diagram does not read the served machine"


def test_the_ladder_reads_the_served_table_and_says_where_the_worker_is() -> None:
    """The ladder lives in the SELECTOR, not the diagram, and deliberately.

    It has to remain the control the worker actually operates - a Radix radio
    group, entered once by Tab and traversed by arrow key - so it was made to
    read as a ladder rather than replaced by one. A second ladder beside it
    would have been two controls claiming the same state.

    What it must carry beyond the levels: where the worker sits and what a rung
    would buy, IN WORDS. The selected level was a blue fill and nothing else,
    which is the one encoding this codebase does not allow to stand alone.
    """
    src = PANEL.read_text(encoding="utf-8")
    assert "mandate.levels.map" in src, "the ladder does not read the served table"
    assert "no_authentication_notice" in src, "the notice is not where the level is set"
    assert len(MANDATE_TABLE) == 5

    # THROUGH THE DICTIONARY, NOT AS LITERALS. Both sentences were English
    # strings hardcoded in the panel while the same words sat unused in
    # lib/i18n.ts under keys with Mandarin, Bengali and Tamil beside them - so a
    # worker reading the interface in Bengali was told the level they were on in
    # English. The assertion is the same one it always was, asked one layer down:
    # the panel renders the key, and the key still says it in words.
    i18n = (
        Path(__file__).resolve().parent.parent.parent / "frontend" / "lib" / "i18n.ts"
    ).read_text(encoding="utf-8")
    for key, must_say in (
        ("machine.youAreHere", "you are here"),
        ("machine.wouldUnlock", "raising to here would unlock"),
    ):
        assert f'k="{key}"' in src, f"the ladder does not render {key}"
        assert f'"{key}": "{must_say}"' in i18n, (
            f"{key} no longer says {must_say!r} in English, so the ladder no longer "
            f"says where the worker is or what a rung buys"
        )


def test_the_diagram_and_the_ladder_are_not_two_controls() -> None:
    """Only one thing on the screen may set the level."""
    src = DIAGRAM.read_text(encoding="utf-8")
    assert "RadioGroup" not in src, "the diagram contains a second control"
    assert "onPick" not in src and "onValueChange" not in src
