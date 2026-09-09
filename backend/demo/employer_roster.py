"""A fictional employer's CPF file, with a recorded number of deliberate errors.

FICTIONAL DATA. No real employer, employee, UEN or CPF account number appears
here. The names are assembled from common Singaporean given and family names
across the four main language communities; any resemblance to a real person is
the arithmetic of a small name pool, not a record of anyone.

THE NUMBER SAID ON STAGE IS DERIVED, NOT CLAIMED.

Every correct row's declared contribution is produced BY THE ENGINE - this
module calls cpf_contribution() and writes down what it returns. So a "correct"
row is correct by construction and cannot drift: if the engine changes, the file
changes with it and the exceptions stay at the seeded count.

Every wrong row is wrong DELIBERATELY, one seeded mistake at a time, and the
count of each is a constant below. tests/test_employer_check.py asserts that the
check finds exactly SEEDED_EXCEPTIONS exceptions and SEEDED_REFUSALS refusals,
so "we seeded 14 and it caught 14" is a statement the build enforces rather than
a sentence in a script. If the engine stops catching one, the suite goes red
before the demo quietly under-reports.

The wrong amounts here are INPUTS - they stand in for what a payroll system got
wrong - so they are fabricated on purpose. Nothing in this module is displayed
as an engine output.
"""

from __future__ import annotations

import csv
import io
import random
from datetime import date
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal

from fairslip.cpf import (
    BAND_ORDER,
    ONE_DOLLAR,
    RATES_2026,
    Residency,
    band_for,
    cpf_contribution,
)
from fairslip.employer import CSV_COLUMNS

# The month the file is for. Fixed, so the roster is byte-identical on every run
# and the age-band seeds land where they are meant to.
RELEVANT_MONTH = date(2026, 9, 1)
UEN = "202612345K"
PAYMENT_TYPE = "PTE"
SNO = "01"

TOTAL_ROWS = 300
SEED = 20260911  # the pitch date, so the file is the same one every time

# ---- what is deliberately wrong, and how many of each ----------------------
SEEDED = {
    "AMOUNT_MISMATCH": 4,
    "AGE_BAND_MISSED": 3,
    "OW_ABOVE_CEILING": 2,
    "NOT_A_CPF_MEMBER": 2,
}
SEEDED_EXCEPTIONS = sum(SEEDED.values())  # 11

SEEDED_REFUSAL = {
    "ENGINE_REFUSED_PR_GRADUATED": 2,
    "ENGINE_REFUSED_LOW_WAGE": 2,
    "ADDITIONAL_WAGES_PRESENT": 3,
}
SEEDED_REFUSALS = sum(SEEDED_REFUSAL.values())  # 7

FAMILY = [
    "Tan", "Lim", "Lee", "Ng", "Ong", "Wong", "Goh", "Chua", "Chan", "Koh",
    "Teo", "Ang", "Yeo", "Low", "Toh", "Sim", "Chong", "Foo", "Heng", "Neo",
    "bin Ismail", "bin Rahman", "binte Osman", "binte Yusof", "bin Hassan",
    "s/o Muthu", "d/o Krishnan", "s/o Rajan", "d/o Selvam", "s/o Pillai",
    "Fernandez", "Pereira", "de Souza", "Rozario",
]
GIVEN = [
    "Wei Ming", "Hui Ling", "Jia Hui", "Zhi Hao", "Mei Ling", "Kai Xin",
    "Yi Ting", "Jun Jie", "Xin Yi", "Wen Xuan", "Siew Kim", "Boon Keng",
    "Nurul", "Siti", "Muhammad", "Ahmad", "Farhan", "Aisyah", "Hafiz", "Nadia",
    "Kumar", "Priya", "Ravi", "Devi", "Anand", "Lakshmi", "Suresh", "Kavitha",
    "Marcus", "Priscilla", "Bernard", "Cheryl", "Jonathan", "Grace",
]


def _account_no(rng: random.Random, dob: date) -> str:
    """S or T prefix, per the spec's note 4: T is issued to PRs from 1 Jan 2000
    and to persons born on and after 1 Jan 2000. Fictional digits."""
    prefix = "T" if dob.year >= 2000 else "S"
    return f"{prefix}{rng.randrange(10**7):07d}{rng.choice('ABCDEFGHJZ')}"


def _uncapped_total(ow: Decimal, band) -> Decimal:
    """What the total would be if the OW ceiling were NOT applied.

    This exists to FABRICATE a mistake, not to compute a contribution. It is the
    error an employer makes when their system misses the ceiling, and it is an
    input to the check - never an output of it. The engine has no such function
    and must not: it always caps.
    """
    _er, _ee, total_pct = RATES_2026[band]
    return (ow * total_pct / 100).quantize(ONE_DOLLAR, rounding=ROUND_HALF_UP)


def _employee_share(ow: Decimal, band) -> Decimal:
    _er, ee_pct, _total = RATES_2026[band]
    return (ow * ee_pct / 100).quantize(ONE_DOLLAR, rounding=ROUND_DOWN)


def _row(
    name: str,
    account: str,
    dob: date,
    residency: Residency,
    ow: Decimal,
    declared: Decimal,
    aw: Decimal = Decimal(0),
    status: str = "E",
) -> dict[str, str]:
    return {
        "uen": UEN,
        "payment_type": PAYMENT_TYPE,
        "sno": SNO,
        "relevant_month": RELEVANT_MONTH.strftime("%Y%m"),
        "employee_account_no": account,
        "contribution_detail_amount": f"{declared:.2f}",
        "ordinary_wages": f"{ow:.2f}",
        "additional_wages": f"{aw:.2f}",
        "employment_status": status,
        "employee_name": name,
        "date_of_birth": dob.isoformat(),
        "residency": residency.value,
    }


def build_rows() -> list[dict[str, str]]:
    """The roster. Deterministic: same seed, same file, every time."""
    rng = random.Random(SEED)
    rows: list[dict[str, str]] = []

    def person(min_age: int = 21, max_age: int = 68) -> tuple[str, date, str]:
        name = f"{rng.choice(GIVEN)} {rng.choice(FAMILY)}"
        age = rng.randint(min_age, max_age)
        dob = date(RELEVANT_MONTH.year - age, rng.randint(1, 12), rng.randint(1, 28))
        return name, dob, _account_no(rng, dob)

    def under_ceiling() -> Decimal:
        """A wage comfortably below the $8,000 ceiling.

        The seeded errors that are NOT about the ceiling have to use this. The
        first version drew from wage(), whose top 3% reaches $9,500 - so one
        seeded AMOUNT_MISMATCH row happened to land above the ceiling and was
        reported, correctly, as OW_ABOVE_CEILING instead. The totals still
        matched; the per-category counts did not, and it is the per-category
        claim that is worth making on stage.
        """
        return Decimal(f"{rng.uniform(1400, 6400):.2f}")

    def wage() -> Decimal:
        """A plausible spread: most of the roster between $1,200 and $6,500,
        a thin tail above. Kept above $750 so a correct row is computable -
        wages at or below that are a SEEDED refusal, not an accident."""
        band = rng.random()
        if band < 0.55:
            base = rng.uniform(1200, 3200)
        elif band < 0.85:
            base = rng.uniform(3200, 5200)
        elif band < 0.97:
            base = rng.uniform(5200, 7800)
        else:
            base = rng.uniform(7800, 9500)
        return Decimal(f"{base:.2f}")

    # ---------------------------------------------------------- correct rows
    correct = TOTAL_ROWS - SEEDED_EXCEPTIONS - SEEDED_REFUSALS
    for _ in range(correct):
        name, dob, account = person()
        residency = Residency.CITIZEN if rng.random() < 0.8 else Residency.PR_YEAR_3_PLUS
        ow = wage()
        band = band_for(dob, RELEVANT_MONTH)
        expected = cpf_contribution(ow, band, residency)
        rows.append(_row(name, account, dob, residency, ow, expected.total))

    # ------------------------------------------- 1. plain computation errors
    # Off by an amount that is not any other band's answer, so the check has to
    # report it as a mismatch and cannot mistake it for a missed age band.
    for i in range(SEEDED["AMOUNT_MISMATCH"]):
        name, dob, account = person(30, 50)
        ow = under_ceiling()
        band = band_for(dob, RELEVANT_MONTH)
        expected = cpf_contribution(ow, band, Residency.CITIZEN)
        wrong = expected.total - Decimal(37 + i * 13)
        rows.append(_row(name, account, dob, Residency.CITIZEN, ow, wrong))

    # --------------------------------- 2. "Overlooked the change of age group"
    # CPF Board's own words. Each of these crossed a threshold last month, so
    # the new rate applies this month - and the declared amount is exactly what
    # the OLD band gives, which is what the check establishes.
    for threshold in (55, 60, 65)[: SEEDED["AGE_BAND_MISSED"]]:
        name, _dob, account = person()
        # Birthday last month: the step-up is the first of THIS month.
        birth_month = RELEVANT_MONTH.month - 1 or 12
        birth_year = RELEVANT_MONTH.year - threshold - (1 if birth_month == 12 else 0)
        dob = date(birth_year, birth_month, 14)
        band = band_for(dob, RELEVANT_MONTH)
        previous = BAND_ORDER[BAND_ORDER.index(band) - 1]
        ow = under_ceiling()
        at_previous = cpf_contribution(ow, previous, Residency.CITIZEN)
        rows.append(_row(name, account, dob, Residency.CITIZEN, ow, at_previous.total))

    # ------------------------------------- 3. OW ceiling not applied
    for _ in range(SEEDED["OW_ABOVE_CEILING"]):
        name, dob, account = person(30, 52)
        ow = Decimal(f"{rng.uniform(8600, 11500):.2f}")
        band = band_for(dob, RELEVANT_MONTH)
        rows.append(_row(name, account, dob, Residency.CITIZEN, ow, _uncapped_total(ow, band)))

    # ------------------- 4. a CPF amount declared for someone who is not a member
    for _ in range(SEEDED["NOT_A_CPF_MEMBER"]):
        name, dob, account = person(24, 45)
        ow = Decimal(f"{rng.uniform(1100, 2400):.2f}")
        band = band_for(dob, RELEVANT_MONTH)
        rows.append(
            _row(name, account, dob, Residency.WORK_PERMIT, ow, _employee_share(ow, band))
        )

    # ------------------------------------------------- REFUSED, not exceptions
    # 5. Graduated PR years. The engine refuses these; secondary sources conflict
    #    on the Year-2 employer rate and it was never verified against CPF Table 3.
    for residency in (Residency.PR_YEAR_1, Residency.PR_YEAR_2):
        name, dob, account = person(25, 45)
        ow = wage()
        rows.append(_row(name, account, dob, residency, ow, Decimal("0.00")))

    # 6. Wages at or below $750: graduated formulas, not encoded.
    for _ in range(SEEDED_REFUSAL["ENGINE_REFUSED_LOW_WAGE"]):
        name, dob, account = person(19, 24)
        ow = Decimal(f"{rng.uniform(380, 720):.2f}")
        rows.append(_row(name, account, dob, Residency.CITIZEN, ow, Decimal("0.00")))

    # 7. Additional Wages present. The engine is OW-only, so these cannot be
    #    compared - and are refused rather than reported as an employer error.
    for _ in range(SEEDED_REFUSAL["ADDITIONAL_WAGES_PRESENT"]):
        name, dob, account = person(28, 55)
        ow = wage()
        aw = Decimal(f"{rng.uniform(1500, 9000):.2f}")
        band = band_for(dob, RELEVANT_MONTH)
        expected = cpf_contribution(ow, band, Residency.CITIZEN)
        rows.append(
            _row(name, account, dob, Residency.CITIZEN, ow, expected.total, aw=aw, status="E")
        )

    # Shuffle so the seeded errors are not the last rows on the screen - an
    # exceptions table that only ever flags the bottom of the file proves less
    # than one that finds them scattered through it.
    rng.shuffle(rows)
    return rows


def build_csv() -> str:
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(CSV_COLUMNS), lineterminator="\n")
    writer.writeheader()
    writer.writerows(build_rows())
    return out.getvalue()
