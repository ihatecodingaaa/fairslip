"""Fictional demo data. No real worker's information appears here or anywhere in FairSlip.

"Rahim" is invented. Numbers match the calibration tests so the demo and the tests cannot drift.

Two personas so the demo can show both rule packs honestly:
  - Rahim: Work Permit holder, construction. Employment Act pack applies; CPF pack says NO_CPF.
  - Mei Ling: Singapore Citizen, age 40, F&B, basic $1,200. Both packs apply; the OT shortfall
    compounds into a CPF shortfall ($62.24 OT -> $23 CPF).
"""

from datetime import date
from decimal import Decimal

from fairslip.cpf import AgeBand, Residency
from fairslip.rules import Fact, PayInputs, Status

D = Decimal


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


RAHIM_RESIDENCY = Residency.WORK_PERMIT  # CPF pack returns NO_CPF for Rahim, correctly


def rahim_month2_corrected() -> PayInputs:
    """Payslip #2 after the employer responded: the $62.24 arrived as an adjustment line.
    Net paid = normal month ($1,462.24) + adjustment ($62.24) = $1,524.48."""
    return PayInputs(**_base("1524.48", "worker confirmed construction (workman)"))


def rahim_month2_uncorrected() -> PayInputs:
    """Payslip #2, nothing changed: employer again paid $1,400 on a $1,462.24 month."""
    return PayInputs(**_base("1400.00", "worker confirmed construction (workman)"))


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


MEI_LING_DECLARED_OW = D("1400.00")  # what the employer computed CPF on
MEI_LING_CPF_EMPLOYEE_ON_PAYSLIP = D("280")  # what the payslip shows
