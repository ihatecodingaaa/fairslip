"""The UI copy contract, applied to the escalation screen.

FORBIDDEN_WORDS ran only inside the draft guard, so every word the contract
forbids could reach this screen unchecked - and this is the screen a worker
reads when deciding what to do next.

The check is deliberately NOT applied to `quoted` fields. Those are an
authority's own words, pinned to the pages they were read from in
.claude/rules/mom-pay-rules.md and cpf-rules.md and asserted in both directions
by tests/test_agent_api.py. Running a word filter over a quotation would either
censor an authority or push someone to trim a quote until it passed - which is
exactly how "beyond one year is low." shipped with a full stop.
"""

from __future__ import annotations

import dataclasses

import pytest

from fairslip import agent


@pytest.mark.parametrize("word", agent.FORBIDDEN_WORDS)
def test_the_copy_check_catches_every_forbidden_word_planted_in_the_pack(word: str) -> None:
    """A POSITIVE CONTROL, derived over the contract's own list.

    Without one, a checker that quietly examined nothing would make every
    assertion below vacuously true (docs/debt.md,
    check-disabled-by-absent-dependency). Each word is planted in a
    FairSlip-authored field and must be caught."""
    planted = dataclasses.replace(
        agent.prepare_escalation(), disclaimer=f"This matter is {word} now."
    )
    with pytest.raises(agent.EscalationCopyError, match="copy contract"):
        agent.check_escalation_copy(planted)


@pytest.mark.parametrize("word", agent.FORBIDDEN_WORDS)
def test_the_check_reaches_a_note_as_well_as_the_headline_copy(word: str) -> None:
    """A forbidden word in a gloss deep inside not_built must be caught too -
    the check must not stop at the strings that are easy to reach."""
    pack = agent.prepare_escalation()
    assert pack.not_built, "no not_built entry; this test would be vacuous"
    nb = pack.not_built[0]
    poisoned = dataclasses.replace(
        nb,
        what_is_known=(
            dataclasses.replace(nb.what_is_known[0], note=f"FairSlip thinks this is {word}."),
            *nb.what_is_known[1:],
        ),
    )
    with pytest.raises(agent.EscalationCopyError):
        agent.check_escalation_copy(dataclasses.replace(pack, not_built=(poisoned,)))


def test_the_check_examines_every_fairslip_authored_field() -> None:
    """Loudness guard: it must not pass by looking at three strings. Derived from
    the pack's own shape, so a field added later is covered or this fails."""
    pack = agent.prepare_escalation()
    where = {w for w, _ in agent._fairslip_authored_strings(pack)}
    assert "heading" in where
    assert "disclaimer" in where
    assert len([w for w in where if w.startswith("filing_steps")]) == len(pack.filing_steps)
    assert len([w for w in where if w.startswith("evidence")]) == 2 * len(pack.evidence)
    assert len([w for w in where if w.startswith("deadlines")]) == 2 * len(pack.deadlines)
    assert any(w.endswith(".note") and "what_is_known" in w for w in where)
    assert len(where) >= 20


def test_the_check_does_not_censor_a_quotation() -> None:
    """An authority may use a word FairSlip may not. Quoting them is not FairSlip
    saying it, and a quote must never be trimmed to satisfy a filter."""
    pack = agent.prepare_escalation()
    checked = {t for _, t in agent._fairslip_authored_strings(pack)}
    for e in pack.evidence:
        assert e.quoted not in checked
    for d in pack.deadlines:
        assert d.quoted not in checked
    for n in pack.not_built:
        for q in n.what_is_known:
            assert q.quoted not in checked

    loud = dataclasses.replace(
        pack,
        deadlines=(
            *pack.deadlines,
            agent.Deadline(
                label="A quotation that contains a forbidden word",
                quoted="you should file for the salary owed to you",
                source_url=agent.REFERENCE_LINKS["tadm_file_claim"],
                source_label="TADM's file-an-employment-claim page",
            ),
        ),
    )
    agent.check_escalation_copy(loud)  # must not raise


@pytest.mark.parametrize("cpf_applies", [True, False])
def test_the_shipped_pack_passes_its_own_copy_contract(cpf_applies: bool) -> None:
    agent.check_escalation_copy(agent.prepare_escalation(cpf_applies=cpf_applies))


def test_prepare_escalation_checks_its_copy_before_returning() -> None:
    """The check runs on the way out, so a forbidden word cannot reach a screen
    even when it is added to a constant far from this function."""
    original = agent.EscalationPack
    seen: list[bool] = []

    real_check = agent.check_escalation_copy

    def spy(pack: original) -> None:  # type: ignore[valid-type]
        seen.append(True)
        real_check(pack)

    agent.check_escalation_copy = spy  # type: ignore[assignment]
    try:
        agent.prepare_escalation()
    finally:
        agent.check_escalation_copy = real_check  # type: ignore[assignment]
    assert seen == [True], "prepare_escalation returned without checking its copy"
