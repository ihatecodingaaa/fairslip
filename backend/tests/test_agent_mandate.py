"""The mandate is enforced in code, not in prose.

Every case here is derived from the Action enum and MANDATE_TABLE, never from a
hand-written list, so an action added to the enum without a place in the table
fails these tests rather than slipping through untested
(docs/debt.md, quantified-test-name-single-instance).
"""

from __future__ import annotations

import dataclasses
from datetime import UTC, datetime, timedelta

import pytest

from fairslip.agent import (
    MANDATE_LEVELS,
    MANDATE_TABLE,
    Action,
    ActionNotBuiltError,
    AgentState,
    Mandate,
    MandateExceededError,
    Sent,
    TapEvent,
    allowed_actions,
    reachable_states,
    required_level,
)

# --------------------------------------------------------------------------
# The action set is a pure function of the level
# --------------------------------------------------------------------------


@pytest.mark.parametrize("level", sorted(MANDATE_LEVELS))
@pytest.mark.parametrize("action", sorted(Action, key=lambda a: a.value))
def test_the_action_set_is_a_pure_function_of_the_level(level: int, action: Action) -> None:
    """Cases are the full product of levels x actions, derived from the enum and
    the table. Widening any level's set changes an expectation here."""
    permitted = Mandate(level).permits(action)
    assert permitted is (action in MANDATE_TABLE[level])
    # Pure: asking twice, and asking through either entry point, gives one answer.
    assert permitted is (action in allowed_actions(level))
    assert Mandate(level).permits(action) is permitted


@pytest.mark.parametrize("action", sorted(Action, key=lambda a: a.value))
def test_every_action_is_granted_at_exactly_the_levels_at_or_above_its_required_level(
    action: Action,
) -> None:
    """The table is cumulative: an action granted at level N is granted at every
    level above N. A table that granted an action at 2 and withdrew it at 3 would
    make required_level() a lie, so it is checked rather than assumed."""
    need = required_level(action)
    for level in sorted(MANDATE_LEVELS):
        assert Mandate(level).permits(action) is (level >= need)


def test_level_0_permits_nothing() -> None:
    """'Show me only' is the whole of level 0. Derived over the enum, so a new
    action defaulting into level 0 fails here."""
    assert allowed_actions(0) == frozenset()
    for action in Action:
        assert not Mandate(0).permits(action)


def test_every_action_in_the_table_is_a_member_of_the_action_enum() -> None:
    for level, actions in MANDATE_TABLE.items():
        assert level in MANDATE_LEVELS
        for a in actions:
            assert isinstance(a, Action)


def test_an_unknown_mandate_level_is_refused_rather_than_defaulted() -> None:
    for bad in (-1, 5, 99):
        with pytest.raises(ValueError, match="mandate level"):
            Mandate(bad)
        with pytest.raises(ValueError, match="mandate level"):
            allowed_actions(bad)


# --------------------------------------------------------------------------
# Refusal names the level that would have permitted it
# --------------------------------------------------------------------------


def test_send_at_level_1_is_refused_and_names_level_2() -> None:
    with pytest.raises(MandateExceededError) as e:
        Mandate(1).act(Action.SEND, tap=_tap())
    assert e.value.action is Action.SEND
    assert e.value.granted_level == 1
    assert e.value.required_level == 2


def test_prepare_escalation_at_level_3_is_refused_and_names_level_4() -> None:
    with pytest.raises(MandateExceededError) as e:
        Mandate(3).act(Action.PREPARE_ESCALATION)
    assert e.value.action is Action.PREPARE_ESCALATION
    assert e.value.granted_level == 3
    assert e.value.required_level == 4


@pytest.mark.parametrize("action", sorted(Action, key=lambda a: a.value))
def test_every_ungranted_action_is_refused_through_the_single_chokepoint(action: Action) -> None:
    """Derived over every action: at every level below its required level, act()
    raises before any dispatch happens. Removing the guard in Mandate.act lets
    each of these calls fall through to a dispatch instead of raising."""
    need = required_level(action)
    for level in sorted(MANDATE_LEVELS):
        if level >= need:
            continue
        with pytest.raises(MandateExceededError) as e:
            Mandate(level).act(action)
        assert e.value.required_level == need


@pytest.mark.parametrize("action", sorted(Action, key=lambda a: a.value))
def test_a_granted_action_is_never_refused_for_the_mandate(action: Action) -> None:
    """The other half of the guard: at or above the required level the mandate
    refusal must not fire. An action this build has not implemented raises
    ActionNotBuiltError, which is a different and honest refusal."""
    m = Mandate(required_level(action))
    try:
        m.act(action)
    except MandateExceededError:  # pragma: no cover - this is the failure
        pytest.fail(f"{action} was refused at its own required level")
    except (ActionNotBuiltError, TypeError, ValueError):
        pass  # missing arguments, or not built in this cut; not a mandate refusal


# --------------------------------------------------------------------------
# SENT cannot exist without a tap
# --------------------------------------------------------------------------


def _tap(at: datetime | None = None) -> TapEvent:
    return TapEvent(at=at or datetime.now(UTC), surface="test")


def test_the_sent_record_cannot_be_built_without_a_tap() -> None:
    """Structural, not behavioural: `tap` has no default, so there is no way to
    construct a Sent that lacks one. Giving it a default reddens this."""
    tap_field = {f.name: f for f in dataclasses.fields(Sent)}["tap"]
    assert tap_field.default is dataclasses.MISSING
    assert tap_field.default_factory is dataclasses.MISSING
    with pytest.raises(TypeError):
        Sent()  # type: ignore[call-arg]


def test_the_tap_timestamp_has_no_default() -> None:
    """`at` must come from the tap that happened. A default - and especially a
    default_factory of datetime.now - would mint a timestamp for a tap nobody
    made, which is a fake timestamp under .claude/rules/honesty.md."""
    at_field = {f.name: f for f in dataclasses.fields(TapEvent)}["at"]
    assert at_field.default is dataclasses.MISSING
    assert at_field.default_factory is dataclasses.MISSING
    with pytest.raises(TypeError):
        TapEvent()  # type: ignore[call-arg]


def test_a_naive_tap_timestamp_is_refused() -> None:
    """A naive datetime is not a moment, it is a moment in an unstated zone.
    docs/debt.md, equal-objects-different-canonical-forms."""
    with pytest.raises(ValueError, match="timezone"):
        TapEvent(at=datetime(2026, 9, 7, 12, 0, 0), surface="test")  # noqa: DTZ001


def test_send_at_level_2_without_a_tap_is_refused() -> None:
    with pytest.raises(ValueError, match="tap"):
        Mandate(2).act(Action.SEND, tap=None)


def test_send_at_level_2_with_a_tap_records_sent_with_that_exact_timestamp() -> None:
    at = datetime(2026, 9, 7, 14, 30, 5, tzinfo=UTC)
    sent = Mandate(2).act(Action.SEND, tap=TapEvent(at=at, surface="check-page"))
    assert isinstance(sent, Sent)
    assert sent.tap.at == at  # the recorded time IS the tap's time, not now()
    assert sent.state is AgentState.SENT


def test_the_recorded_timestamp_is_the_taps_not_the_moment_of_recording() -> None:
    """A tap from an hour ago must not be re-stamped to now."""
    at = datetime.now(UTC) - timedelta(hours=1)
    sent = Mandate(2).act(Action.SEND, tap=TapEvent(at=at, surface="check-page"))
    assert sent.tap.at == at


# --------------------------------------------------------------------------
# The state machine
# --------------------------------------------------------------------------


def test_awaiting_is_unreachable_from_the_start_without_passing_through_sent() -> None:
    """Reachability, computed over the transition graph with SENT deleted. Derived
    from TRANSITIONS, so a new edge routing around SENT fails here without anyone
    remembering to add a case."""
    without_sent = reachable_states(AgentState.DISCREPANCY_FOUND, excluding={AgentState.SENT})
    assert AgentState.AWAITING_NEXT_PAYSLIP not in without_sent
    # ... and it IS reachable when SENT is present, so the test is not vacuous.
    assert AgentState.AWAITING_NEXT_PAYSLIP in reachable_states(AgentState.DISCREPANCY_FOUND)


def test_unverifiable_is_not_terminal_and_can_be_re_attempted() -> None:
    """A worker whose month-2 payslip was unreadable has not reached the end of
    anything. UNVERIFIABLE must lead back to another attempt."""
    onward = reachable_states(AgentState.UNVERIFIABLE)
    assert AgentState.VERIFYING in onward
    assert AgentState.AWAITING_NEXT_PAYSLIP in onward
    # and a re-attempt can still reach every real verdict
    for verdict_state in (
        AgentState.CORRECTED,
        AgentState.PARTIALLY_CORRECTED,
        AgentState.NOT_CORRECTED,
    ):
        assert verdict_state in onward


def test_every_state_is_reachable_from_the_start() -> None:
    """Derived over the whole enum: a state nobody can get to is either dead code
    or a missing edge, and both are defects."""
    reachable = reachable_states(AgentState.DISCREPANCY_FOUND) | {AgentState.DISCREPANCY_FOUND}
    unreachable = set(AgentState) - reachable
    assert unreachable == set(), f"unreachable states: {sorted(s.value for s in unreachable)}"
