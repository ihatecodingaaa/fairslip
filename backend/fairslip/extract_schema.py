"""Which fields a vision reader may be asked for, and which it may not.

This module holds no logic and computes nothing. It exists to make one boundary
explicit and testable: a payslip or a roster can show a wage, an hour count or a
deduction, but it cannot show whether the worker is a citizen, when they were
born, how many days a week they contracted to work, whether they count as a
workman, or who asked them to work the rest day. Those five come from the worker
and are HUMAN_CONFIRMED by construction.

A reader asked for a field it cannot see would return its best guess, and a
guess carried forward as an extraction is the failure the governing rule exists
to prevent. So the reader never sees those field names at all.

ALL_FIELDS is derived from PayInputs rather than retyped, so a field added to
the engine fails the schema tests until it is deliberately placed on one side.
"""

from __future__ import annotations

from fairslip.rules import PayInputs

# Needed by the CPF pack, not carried on PayInputs. `cpf_employee_on_payslip`
# is a line a payslip may print; the other two only the worker can answer.
CPF_ONLY_FIELDS: frozenset[str] = frozenset(
    {"cpf_employee_on_payslip", "residency", "date_of_birth"}
)

ALL_FIELDS: frozenset[str] = frozenset(PayInputs.__dataclass_fields__) | CPF_ONLY_FIELDS

# Asked of the worker directly. Never sent to a reader, never guessed.
#
# A field is reader-eligible only if what the document shows IS the fact we
# need - not merely a number wearing the same name. `net_paid` is the case that
# makes the distinction matter: a payslip prints "Net pay", and both readers
# could read it and agree, but the fact the engine needs is the amount that
# reached the bank. Those are two facts with one name, and AGREED on the
# printed figure would endorse the very discrepancy this product exists to
# find. So it is the worker's answer, from their bank, or it is nothing.
WORKER_ONLY_FIELDS: frozenset[str] = frozenset(
    {
        "residency",
        "date_of_birth",
        "days_per_week",
        "is_workman",
        "rest_day_requested_by",
        "net_paid",
    }
)

# What the two readers are shown. Every remaining field is here by subtraction,
# so a new engine field is a reader field only after it survives the tests.
READER_FIELDS: frozenset[str] = ALL_FIELDS - WORKER_ONLY_FIELDS


# --------------------------------------------------------------------------
# Field copy. It lives here, next to the split it describes, for the same
# reason the CPF split labels ship with their numbers: a client that writes its
# own wording for a field can quietly restate what the field means. Every
# string a screen shows about a field comes from this module.
#
# The dicts are checked against READER_FIELDS / WORKER_ONLY_FIELDS by the
# tests, so a field added to the engine has no copy until someone writes it.
# --------------------------------------------------------------------------

# What the reader is told a field means. This is the only description of the
# field the model ever sees, so it has to be the document's language, not the
# engine's.
READER_HINTS: dict[str, str] = {
    "monthly_basic": (
        "The monthly basic salary, before overtime, allowances and deductions. "
        "On a payslip this is usually the row labelled 'Basic', 'Basic pay' or "
        "'Basic salary'. Digits only, e.g. 1200.00"
    ),
    "ot_hours": (
        "Total overtime HOURS worked in this salary period - a count of hours, not "
        "an amount of money. On a roster or timesheet this may be a column of daily "
        "overtime hours to be added up, or a single total. Digits only, e.g. 18"
    ),
    "normal_daily_hours": (
        "The normal contracted hours in one working day, before overtime starts. "
        "Often stated in a key employment terms document or a roster header. "
        "Digits only, e.g. 8"
    ),
    "deductions_total": (
        "The total of all deductions shown on the payslip, as printed. If the "
        "payslip shows a single 'Total deductions' row, use that. Digits only, "
        "e.g. 280.00. If there are no deductions shown, answer 0"
    ),
    "rest_day_hours": (
        "Hours worked on a REST DAY (a day the worker was scheduled not to work - "
        "on a roster often a Sunday, or a row marked 'REST' or 'OFF' that "
        "nevertheless has hours against it). Digits only, e.g. 8. If no rest day "
        "was worked, answer null"
    ),
    "cpf_employee_on_payslip": (
        "The employee's own CPF contribution as printed on the payslip - the CPF "
        "amount deducted from the worker's pay, not the employer's share. Digits "
        "only, e.g. 280. If the payslip shows no CPF line, answer null"
    ),
}

# The short name a screen uses for a field.
FIELD_LABELS: dict[str, str] = {
    "monthly_basic": "Monthly basic salary",
    "ot_hours": "Overtime hours",
    "normal_daily_hours": "Normal hours in a working day",
    "deductions_total": "Deductions shown on the payslip",
    "rest_day_hours": "Hours worked on a rest day",
    "cpf_employee_on_payslip": "Employee CPF shown on the payslip",
    "net_paid": "What actually reached your bank",
    "days_per_week": "Days a week you are contracted to work",
    "is_workman": "Whether your job counts as a workman's job",
    "rest_day_requested_by": "Who asked you to work the rest day",
    "residency": "Your residency status",
    "date_of_birth": "Your date of birth",
}

# The question put to the worker, and the reason a reader was never asked it.
# `why` is not an apology for a gap; it is the substance of the boundary, and
# the screen shows it.
WORKER_PROMPTS: dict[str, str] = {
    "net_paid": "How much money actually arrived in your bank account for this month?",
    "days_per_week": "How many days a week are you contracted to work?",
    "is_workman": "Does your work involve manual labour - construction, cleaning, machine operation, driving?",
    "rest_day_requested_by": "Who asked you to work on your rest day?",
    "residency": "What is your residency status in Singapore?",
    "date_of_birth": "What is your date of birth?",
}

WORKER_WHY: dict[str, str] = {
    "net_paid": (
        "This is the one figure we will not read off the payslip. The payslip prints a "
        "'Net pay' figure, and both readers could read it and agree - but that is what "
        "the payslip SAYS was paid, not what arrived. If those two differ, that gap is "
        "exactly what FairSlip exists to find, and reading the printed number would hide "
        "it. So this one comes from your bank, or it does not come at all."
    ),
    "days_per_week": (
        "A payslip shows a month of pay, not the working week you agreed to. The daily "
        "rate depends on it - a 5-day and a 6-day week give different answers from the "
        "same salary - so it is asked, never inferred."
    ),
    "is_workman": (
        "Whether the Employment Act treats your job as a workman's changes the salary "
        "ceiling for overtime. No payslip states it."
    ),
    "rest_day_requested_by": (
        "MOM's rest-day table pays a different amount depending on whether the employer "
        "asked or the worker offered. A roster records the hours, never who asked."
    ),
    "residency": (
        "CPF rates depend on it, and Work Permit holders have no CPF at all. A payslip "
        "does not state residency."
    ),
    "date_of_birth": (
        "CPF rates step up from the month after a 55th, 60th, 65th or 70th birthday. "
        "A payslip does not carry a date of birth."
    ),
}


# --------------------------------------------------------------------------
# How a worker answers each worker-only field.
#
# The options ship from here for the same reason the labels do: a screen that
# retyped the residency list would be writing its own enum, and the day
# fairslip.cpf.Residency changed the two would part company silently. CHOICES
# is built from the engines' own enums below, never from a literal list.
# --------------------------------------------------------------------------

# "decimal" - a number the worker types; "choice" - one of CHOICES[field];
# "date" - an ISO date. The engines' converters in app/main.py accept these.
ANSWER_TYPES: dict[str, str] = {
    "net_paid": "decimal",
    "days_per_week": "choice",
    "is_workman": "choice",
    "rest_day_requested_by": "choice",
    "residency": "choice",
    "date_of_birth": "date",
}


def _residency_choices() -> list[tuple[str, str]]:
    """Built from the enum, with the plain-language wording a worker would
    recognise. Out-of-scope options are still offered: the engine refusing a
    PR-year-1 wage with a reason is the honest outcome, and hiding the option
    would instead invite the worker to pick a neighbouring status that is wrong."""
    from fairslip.cpf import Residency

    wording = {
        Residency.CITIZEN: "Singapore Citizen",
        Residency.PR_YEAR_3_PLUS: "Permanent Resident, 3rd year onwards",
        Residency.PR_YEAR_1: "Permanent Resident, 1st year",
        Residency.PR_YEAR_2: "Permanent Resident, 2nd year",
        Residency.WORK_PERMIT: "Work Permit holder",
        Residency.S_PASS: "S Pass holder",
        Residency.EMPLOYMENT_PASS: "Employment Pass holder",
    }
    assert set(wording) == set(Residency), "a residency has no wording"
    return [(r.value, wording[r]) for r in Residency]


def choices_for(field: str) -> list[tuple[str, str]]:
    """(value, label) pairs. `value` is what the engine accepts, verbatim."""
    if field == "residency":
        return _residency_choices()
    if field == "days_per_week":
        # rules.daily_rate() accepts 5 or 6 and refuses anything else.
        return [("5", "5 days a week"), ("6", "6 days a week")]
    if field == "is_workman":
        return [
            ("true", "Yes - my work is manual (construction, cleaning, machines, driving)"),
            ("false", "No - my work is not manual"),
        ]
    if field == "rest_day_requested_by":
        # rules.rest_day_pay() accepts exactly these two.
        return [("employer", "My employer asked me to"), ("employee", "I asked to work it")]
    raise KeyError(f"{field} is not a choice field")
