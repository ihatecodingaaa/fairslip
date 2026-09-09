"""The reader/worker split is a safety boundary, not a convenience.

A field in READER_FIELDS may be shown to a vision model. A field in
WORKER_ONLY_FIELDS may not: a payslip cannot show residency, date of birth,
contracted days per week, workman status, or who asked for the rest day, so a
reader answering one of those would be guessing, and a guess dressed as an
extraction is exactly what the governing rule forbids.

These tests derive their cases from the engine's own dataclass, so adding a
field to PayInputs fails here until it is deliberately assigned to one side.
"""

from __future__ import annotations

from decimal import Decimal

from fairslip.extract_schema import (
    ALL_FIELDS,
    ANSWER_TYPES,
    CPF_ONLY_FIELDS,
    FIELD_LABELS,
    READER_FIELDS,
    READER_HINTS,
    WORKER_ONLY_FIELDS,
    WORKER_PROMPTS,
    WORKER_WHY,
    WORKER_WHY_SHORT,
    choices_for,
)
from fairslip.rules import PayInputs


def test_all_fields_is_pay_inputs_plus_the_cpf_only_fields() -> None:
    """Derived from the frozen dataclass, not a literal list."""
    assert ALL_FIELDS == frozenset(PayInputs.__dataclass_fields__) | CPF_ONLY_FIELDS


def test_every_field_is_assigned_to_exactly_one_side() -> None:
    """Quantified name, quantified check: iterates every field in ALL_FIELDS."""
    for field in ALL_FIELDS:
        in_reader = field in READER_FIELDS
        in_worker = field in WORKER_ONLY_FIELDS
        assert in_reader != in_worker, f"{field} is in both sides or neither"


def test_the_two_sides_are_disjoint_and_cover_all_fields() -> None:
    assert READER_FIELDS.isdisjoint(WORKER_ONLY_FIELDS)
    assert READER_FIELDS | WORKER_ONLY_FIELDS == ALL_FIELDS


def test_no_field_a_payslip_cannot_show_is_offered_to_a_reader() -> None:
    """The five the brief names explicitly. If one of these ever reaches a
    reader, the reader is guessing."""
    cannot_be_read = {
        "residency",
        "date_of_birth",
        "days_per_week",
        "is_workman",
        "rest_day_requested_by",
        # Not "cannot be seen" but "the visible number is a different fact":
        # the payslip's printed Net pay is not the amount that reached the bank.
        "net_paid",
    }
    assert cannot_be_read <= WORKER_ONLY_FIELDS
    assert cannot_be_read.isdisjoint(READER_FIELDS)


def test_the_schema_offers_readers_no_confidence_field() -> None:
    """Status is the confidence. There is no numeric confidence anywhere."""
    for field in ALL_FIELDS:
        assert "confid" not in field.lower()
        assert "probab" not in field.lower()
        assert "score" not in field.lower()


# --------------------------------------------------------------------------
# Field copy. Every string a screen shows about a field comes from the backend,
# so these tests iterate the field sets rather than naming fields by hand: a
# field added to the engine has no copy until someone writes it, and these fail
# until they do.
# --------------------------------------------------------------------------


def test_every_reader_field_has_a_hint_and_no_worker_field_does() -> None:
    """The hint is the only description of a field the model ever sees. A
    worker-only field must not have one, because having one would mean it had
    been written up for a reader."""
    assert set(READER_HINTS) == set(READER_FIELDS)


def test_every_field_on_either_side_has_a_label() -> None:
    assert set(FIELD_LABELS) == set(ALL_FIELDS)


def test_every_worker_field_has_a_question_and_a_reason_it_is_asked() -> None:
    """`why` is not decoration. It is the boundary itself, stated to the worker."""
    assert set(WORKER_PROMPTS) == set(WORKER_ONLY_FIELDS)
    assert set(WORKER_WHY) == set(WORKER_ONLY_FIELDS)
    # The short form is not optional decoration either: it is what the default
    # view shows, so a field without one would be asked with no reason at all.
    assert set(WORKER_WHY_SHORT) == set(WORKER_ONLY_FIELDS)


def test_no_copy_string_is_empty() -> None:
    for name, table in (
        ("READER_HINTS", READER_HINTS),
        ("FIELD_LABELS", FIELD_LABELS),
        ("WORKER_PROMPTS", WORKER_PROMPTS),
        ("WORKER_WHY", WORKER_WHY),
        ("WORKER_WHY_SHORT", WORKER_WHY_SHORT),
    ):
        for field, text in table.items():
            assert text.strip(), f"{name}[{field}] is empty"


def test_no_copy_string_uses_a_forbidden_word() -> None:
    """The UI copy contract, enforced where the copy actually lives. These words
    assert a conclusion FairSlip has not established. See CLAUDE.md."""
    forbidden = ("owed", "underpaid", "breach", "illegal", "entitled", "resolved")
    for table in (READER_HINTS, FIELD_LABELS, WORKER_PROMPTS, WORKER_WHY, WORKER_WHY_SHORT):
        for field, text in table.items():
            lowered = text.lower()
            for word in forbidden:
                assert word not in lowered, f"{field} copy uses {word!r}"


def test_net_paid_says_why_it_is_not_read_from_the_payslip() -> None:
    """The distinction net_paid draws is the product. If the reason stops
    mentioning the payslip, the screen has stopped explaining it."""
    why = WORKER_WHY["net_paid"].lower()
    assert "payslip" in why
    assert "bank" in why
    # And in the line that is actually on screen by default, which is the one a
    # worker reads at the moment they are asked for the figure.
    short = WORKER_WHY_SHORT["net_paid"].lower()
    assert "payslip" in short
    assert "bank" in short


# --------------------------------------------------------------------------
# How the worker answers. The options are the engines' own accepted values, so
# a screen cannot offer one the engine will reject.
# --------------------------------------------------------------------------


def test_every_worker_field_has_an_answer_type() -> None:
    assert set(ANSWER_TYPES) == set(WORKER_ONLY_FIELDS)


def test_every_choice_field_offers_choices_and_no_other_field_does() -> None:
    import pytest

    choice_fields = {f for f, t in ANSWER_TYPES.items() if t == "choice"}
    for field in choice_fields:
        pairs = choices_for(field)
        assert pairs, field
        values = [v for v, _ in pairs]
        assert len(values) == len(set(values)), f"{field} offers a duplicate value"
        for value, label in pairs:
            assert value.strip() and label.strip()

    for field in set(WORKER_ONLY_FIELDS) - choice_fields:
        with pytest.raises(KeyError):
            choices_for(field)


def test_the_residency_options_are_the_engines_own_enum() -> None:
    """Not a retyped list. If Residency gains a member, this fails until the
    wording is written."""
    from fairslip.cpf import Residency

    assert [v for v, _ in choices_for("residency")] == [r.value for r in Residency]


def test_the_days_per_week_options_are_the_only_ones_the_engine_accepts() -> None:
    """rules.daily_rate() refuses anything but 5 or 6, so the screen offers
    exactly those two."""
    import pytest

    from fairslip.rules import daily_rate

    offered = {int(v) for v, _ in choices_for("days_per_week")}
    assert offered == {5, 6}
    for d in offered:
        daily_rate(Decimal(1200), d)  # accepted
    for d in (0, 4, 7):
        with pytest.raises(ValueError):
            daily_rate(Decimal(1200), d)


def test_the_rest_day_options_are_the_only_ones_the_engine_accepts() -> None:
    import pytest

    from fairslip.rules import rest_day_pay

    offered = {v for v, _ in choices_for("rest_day_requested_by")}
    assert offered == {"employer", "employee"}
    for who in offered:
        rest_day_pay(Decimal(1200), 6, Decimal(8), Decimal(8), who)
    with pytest.raises(ValueError):
        rest_day_pay(Decimal(1200), 6, Decimal(8), Decimal(8), "somebody_else")


def test_out_of_scope_residencies_are_still_offered() -> None:
    """Hiding PR year 1 and 2 would push a worker to pick a neighbouring status
    that is wrong. The engine refusing them with a reason is the honest path."""
    offered = {v for v, _ in choices_for("residency")}
    assert {"PR_YEAR_1", "PR_YEAR_2"} <= offered
