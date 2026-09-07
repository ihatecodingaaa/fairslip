"""Fictional demo data. No real worker's information appears here or anywhere in FairSlip.

"Rahim" is invented. Numbers match the calibration tests so the demo and the tests cannot drift.

Two personas so the demo can show both rule packs honestly:
  - Rahim: Work Permit holder, construction. Employment Act pack applies; CPF pack says NO_CPF.
  - Mei Ling: Singapore Citizen, age 40, F&B, basic $1,200. Both packs apply; the OT shortfall
    compounds into a CPF shortfall ($62.24 OT -> $23 CPF).
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fairslip.agent import DraftSpec

from fairslip.cpf import AgeBand, Residency
from fairslip.rules import Fact, PayInputs, Status, compute_expected

D = Decimal

# The salary period the demo computes. CPF age bands are month-sensitive, so the month
# is demo data like everything else here, not a call to date.today().
DEMO_MONTH = date(2026, 9, 1)


def _base(net_paid: str, residency_note: str) -> dict:
    return {
        "monthly_basic": Fact(D("1200"), Status.AGREED, "payslip.jpg: 'Basic' row"),
        "ot_hours": Fact(D("18"), Status.HUMAN_CONFIRMED, "roster.png + worker confirmed 18h"),
        "days_per_week": Fact(6, Status.HUMAN_CONFIRMED, "worker confirmed 6-day week"),
        "normal_daily_hours": Fact(D("8"), Status.HUMAN_CONFIRMED, "worker confirmed 8h/day"),
        "is_workman": Fact(True, Status.HUMAN_CONFIRMED, residency_note),
        "deductions_total": Fact(D("0"), Status.AGREED, "payslip.jpg: 'Deductions' row"),
        "net_paid": Fact(D(net_paid), Status.HUMAN_CONFIRMED, "worker entered bank amount"),
        "rest_day_hours": Fact(D("8"), Status.AGREED, "roster.png: Sunday row"),
        "rest_day_requested_by": Fact("employer", Status.HUMAN_CONFIRMED, "worker confirmed"),
    }


# ---------------------------------------------------------------- Rahim (Work Permit)


def rahim_month1_established() -> PayInputs:
    """Month 1, every fact established. Expected gross $1,462.24; $1,400 reached the bank."""
    return PayInputs(**_base("1400.00", "worker confirmed construction (workman)"))


def rahim_month1_before_confirmation() -> PayInputs:
    """Straight after extraction: readers disagreed on OT hours (18 vs 13).
    compute_expected() must refuse this. That refusal is the honesty beat."""
    base = _base("1400.00", "worker confirmed construction (workman)")
    base["ot_hours"] = Fact(
        {"reader_a": D("18"), "reader_b": D("13")},
        Status.DISAGREED,
        "readers disagree: Claude 18, auditor 13",
    )
    return PayInputs(**base)


RAHIM_DOB = date(1990, 4, 12)
RAHIM_RESIDENCY = Residency.WORK_PERMIT  # CPF pack returns NO_CPF for Rahim, correctly
# The CPF pack needs a band even on the NO_CPF path: the band selects a row in the rate
# table before residency is checked. It is never used for Rahim, but it must be supplied.
RAHIM_BAND = AgeBand.UP_TO_55
RAHIM_DECLARED_OW = D("1400.00")  # what the employer paid on


def rahim_month2_corrected() -> PayInputs:
    """Payslip #2 after the employer responded: the $62.24 arrived as an adjustment line.
    Net paid = normal month ($1,462.24) + adjustment ($62.24) = $1,524.48."""
    return PayInputs(**_base("1524.48", "worker confirmed construction (workman)"))


def rahim_month2_uncorrected() -> PayInputs:
    """Payslip #2, nothing changed: employer again paid $1,400 on a $1,462.24 month."""
    return PayInputs(**_base("1400.00", "worker confirmed construction (workman)"))


def rahim_month2_unestablished() -> PayInputs:
    """Payslip #2 that could not be established: the readers disagreed on OT hours.

    This lives HERE and not in the frontend. A screen that synthesised a
    DISAGREED fact would be inventing a reader transcript - naming two vendors
    and quoting readings nobody made - and then rendering it back as evidence.
    Demo data is fictional, and it is fictional in one place.
    """
    base = _base("1524.48", "worker confirmed construction (workman)")
    base["ot_hours"] = Fact(
        {"reader_a": D("18"), "reader_b": D("13")},
        Status.DISAGREED,
        "fictional demo input: the two readers did not agree on this figure",
    )
    return PayInputs(**base)


# ---------------------------------------------------------------- Mei Ling (Citizen, 40)


MEI_LING_DOB = date(1986, 3, 15)
MEI_LING_RESIDENCY = Residency.CITIZEN
MEI_LING_BAND = AgeBand.UP_TO_55  # band_for(MEI_LING_DOB, date(2026, 9, 1)) == UP_TO_55


def mei_ling_month1_established() -> PayInputs:
    """Same wage shape as Rahim, but a Citizen: the CPF pack applies.
    Employer computed CPF on $1,400 instead of $1,462.24 -> $23 total CPF short ($12 employee, $11 employer).
    Payslip shows employee CPF deduction $280 (20% of 1,400, cents dropped); expected $292."""
    base = _base("1120.00", "worker confirmed F&B (non-workman)")
    base["is_workman"] = Fact(False, Status.HUMAN_CONFIRMED, "worker confirmed F&B (non-workman)")
    base["deductions_total"] = Fact(D("280"), Status.AGREED, "payslip.jpg: 'CPF (employee)' row")
    return PayInputs(**base)


def mei_ling_month2_corrected() -> PayInputs:
    """Payslip #2 on which the PAY difference closes - and the CPF line does not.

    Net paid = $1,182.24 (the month's expected net) + $62.24 = $1,244.48.

    Read the deductions line before calling this "the employer fixed it". It is
    still $280, which is 20% of $1,400 with cents dropped - so this payslip
    depicts an employer who paid the arrears as cash and left the CPF error in
    place. The $62.24 is itself CPF-liable Ordinary Wage (.claude/rules/cpf-rules.md),
    so a fully corrected month would carry a larger employee CPF line and a
    different net.

    That fuller correction is NOT modelled, because arrears paid in a later month
    raise the Additional Wage question and v1 is Ordinary Wage only - the CPF
    engine refuses AW rather than approximating it. So this fixture is honest
    about one pack and silent about the other, and the verdict says exactly that:
    CORRECTED is the Employment Act pack closing, and the screen states that
    FairSlip did not check CPF in that comparison.
    """
    base = _base("1244.48", "worker confirmed F&B (non-workman)")
    base["is_workman"] = Fact(False, Status.HUMAN_CONFIRMED, "worker confirmed F&B (non-workman)")
    base["deductions_total"] = Fact(D("280"), Status.AGREED, "payslip.jpg: 'CPF (employee)' row")
    return PayInputs(**base)


def mei_ling_month2_uncorrected() -> PayInputs:
    """Payslip #2, nothing changed: $1,120 again on a month that should have paid
    $1,182.24. Identical to month 1 by construction - same wage, same shortfall."""
    base = _base("1120.00", "worker confirmed F&B (non-workman)")
    base["is_workman"] = Fact(False, Status.HUMAN_CONFIRMED, "worker confirmed F&B (non-workman)")
    base["deductions_total"] = Fact(D("280"), Status.AGREED, "payslip.jpg: 'CPF (employee)' row")
    return PayInputs(**base)


def mei_ling_month2_unestablished() -> PayInputs:
    """Payslip #2 that could not be established: the readers disagreed on OT hours.

    Lives here, not in the frontend. A screen that synthesised a DISAGREED fact
    would be inventing a reader transcript and rendering it back as evidence.
    """
    base = _base("1244.48", "worker confirmed F&B (non-workman)")
    base["is_workman"] = Fact(False, Status.HUMAN_CONFIRMED, "worker confirmed F&B (non-workman)")
    base["deductions_total"] = Fact(D("280"), Status.AGREED, "payslip.jpg: 'CPF (employee)' row")
    base["ot_hours"] = Fact(
        {"reader_a": D("18"), "reader_b": D("13")},
        Status.DISAGREED,
        "fictional demo input: the two readers did not agree on this figure",
    )
    return PayInputs(**base)


MEI_LING_DECLARED_OW = D("1400.00")  # what the employer computed CPF on
MEI_LING_CPF_EMPLOYEE_ON_PAYSLIP = D("280")  # what the payslip shows


# ---------------------------------------------------------------- draft specs

# The draft cache is keyed by everything a draft may cite, so the specs the demo
# needs are declared HERE, in one place, and the generator script and the
# populated-precondition test both derive from this tuple. A spec added without
# a committed entry fails the test the moment it is added
# (docs/debt.md, precondition-untested-mechanism-tested).

DEMO_SALARY_PERIOD = "September 2026"

# A language belongs to a PERSON, not to the demo. It was one global, so when the
# agent panel switched personas Mei Ling silently inherited Rahim's Bengali - a
# fabricated fact about a person, in a product whose whole thesis is that it does
# not assert what it did not establish. These are fictional attributes of
# fictional people, declared next to them, and the draft cache is keyed by
# language so a persona cannot quietly borrow another's entry.
RAHIM_LANGUAGE = "Bengali"
MEI_LING_LANGUAGE = "Mandarin Chinese"


def rahim_draft_spec() -> "DraftSpec":
    """Rahim month 1: the $62.24 difference, in English and Bengali.

    Every figure comes from compute_expected() - this function selects which
    engine outputs the draft may mention, and computes none of them."""
    from fairslip.agent import CitedFigure, DraftSpec

    bd = compute_expected(rahim_month1_established())
    return DraftSpec(
        figures=tuple(
            CitedFigure(
                label=c.label,
                amount=c.amount,
                formula=c.formula,
                source="; ".join(c.inputs),
            )
            for c in bd.components
        ),
        expected_net=bd.expected_net,
        net_paid=bd.net_paid,
        difference=bd.difference,
        flags=bd.flags,
        salary_period=DEMO_SALARY_PERIOD,
        language=RAHIM_LANGUAGE,
    )


def mei_ling_draft_spec() -> "DraftSpec":
    """Mei Ling month 1 - the persona the 90-second script runs at 0:55."""
    from fairslip.agent import CitedFigure, DraftSpec

    bd = compute_expected(mei_ling_month1_established())
    return DraftSpec(
        figures=tuple(
            CitedFigure(
                label=c.label,
                amount=c.amount,
                formula=c.formula,
                source="; ".join(c.inputs),
            )
            for c in bd.components
        ),
        expected_net=bd.expected_net,
        net_paid=bd.net_paid,
        difference=bd.difference,
        flags=bd.flags,
        salary_period=DEMO_SALARY_PERIOD,
        language=MEI_LING_LANGUAGE,
    )


def draft_specs() -> tuple[tuple[str, "DraftSpec"], ...]:
    """(name, spec) for every draft the demo needs cached. The generator script
    and the precondition test both read this - neither keeps its own list."""
    return (
        ("mei_ling_month1", mei_ling_draft_spec()),
        ("rahim_month1", rahim_draft_spec()),
    )


# ---------------------------------------------------------------- the two demo personas
#
# ONE declaration per persona, carrying everything that depends on who they are:
# their months, their language, their draft entry, and whether the CPF pack
# applies to them at all. The agent panel switches between these.
#
# It is a single record rather than parallel lookups because every time this
# repo has kept two persona-shaped things side by side, one of them got updated
# and the other did not - a global DEMO_LANGUAGE put Mei Ling's message in
# Rahim's Bengali, and a CPF split rendered under a NO_CPF banner. A switch
# bolted onto one field would reintroduce both.


@dataclass(frozen=True)
class DemoPersona:
    """A fictional worker, and every fact the screens need about them.

    `cpf_applies` is not a display flag - it decides whether a CPF pack is
    computed at all. A Work Permit holder is correctly NOT a CPF member, and the
    honest screen for them is a NO_CPF statement, not a split of zeros with an
    overlap note describing an overlap that does not exist.
    """

    key: str
    name: str
    residency: Residency
    residency_label: str
    occupation: str
    language: str
    band: AgeBand
    dob: date
    declared_ow: Decimal
    draft_spec_name: str
    cpf_applies: bool
    cpf_note: str

    def month1(self) -> PayInputs:
        return _PERSONA_MONTHS[self.key]["month1"]()

    def month2_corrected(self) -> PayInputs:
        return _PERSONA_MONTHS[self.key]["corrected"]()

    def month2_uncorrected(self) -> PayInputs:
        return _PERSONA_MONTHS[self.key]["uncorrected"]()

    def month2_blocked(self) -> PayInputs:
        return _PERSONA_MONTHS[self.key]["blocked"]()


_PERSONA_MONTHS: dict[str, dict] = {
    "mei_ling": {
        "month1": lambda: mei_ling_month1_established(),
        "corrected": lambda: mei_ling_month2_corrected(),
        "uncorrected": lambda: mei_ling_month2_uncorrected(),
        "blocked": lambda: mei_ling_month2_unestablished(),
    },
    "rahim": {
        "month1": lambda: rahim_month1_established(),
        "corrected": lambda: rahim_month2_corrected(),
        "uncorrected": lambda: rahim_month2_uncorrected(),
        "blocked": lambda: rahim_month2_unestablished(),
    },
}


MEI_LING = DemoPersona(
    key="mei_ling",
    name="Mei Ling",
    residency=MEI_LING_RESIDENCY,
    residency_label="Singapore Citizen",
    occupation="F&B, non-workman",
    language=MEI_LING_LANGUAGE,
    band=MEI_LING_BAND,
    dob=MEI_LING_DOB,
    declared_ow=MEI_LING_DECLARED_OW,
    draft_spec_name="mei_ling_month1",
    cpf_applies=True,
    cpf_note="",
)

RAHIM = DemoPersona(
    key="rahim",
    name="Rahim",
    residency=RAHIM_RESIDENCY,
    residency_label="Work Permit holder",
    occupation="Construction, workman",
    language=RAHIM_LANGUAGE,
    band=RAHIM_BAND,
    dob=RAHIM_DOB,
    declared_ow=RAHIM_DECLARED_OW,
    draft_spec_name="rahim_month1",
    cpf_applies=False,
    cpf_note=(
        "No CPF. Work Permit holders are not CPF members, so there is no CPF "
        "shortfall to show and no overlap to explain - the whole compounding "
        "beat does not apply. That is the correct answer for this pass type, "
        "not a gap in what FairSlip checked."
    ),
)

# Pass types held by migrant workers. Decides whether MWC is offered - not a
# judgement about a person, a fact about which organisation exists for whom.
MIGRANT_PASS_TYPES: frozenset = frozenset(
    {Residency.WORK_PERMIT, Residency.S_PASS}
)

# Mei Ling first: she is the default, and the scripted run never touches the switch.
DEMO_PERSONAS: tuple[DemoPersona, ...] = (MEI_LING, RAHIM)
DEFAULT_PERSONA_KEY = MEI_LING.key


def persona_by_key(key: str) -> DemoPersona:
    for p in DEMO_PERSONAS:
        if p.key == key:
            return p
    raise KeyError(
        f"unknown demo persona {key!r}; declared: {[p.key for p in DEMO_PERSONAS]}"
    )


def persona_for_spec(spec_name: str) -> DemoPersona | None:
    """Which persona a draft entry belongs to. Returns None rather than guessing
    for a spec no persona declares."""
    for p in DEMO_PERSONAS:
        if p.draft_spec_name == spec_name:
            return p
    return None
