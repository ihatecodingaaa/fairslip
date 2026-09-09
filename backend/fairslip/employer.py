"""The pre-payday check: the same engine, run before the money moves.

A worker brings a payslip after the fact. An employer has the same arithmetic in
front of them BEFORE payday, in a file their payroll system already produces -
and at that point an error costs nothing to fix. This module reads that file and
reports what the published rules give instead.

THE SCHEMA IS NOT OURS, AND THAT IS THE POINT.

The columns below are the CPF EZPay (FTP) File Specifications' own Employer
Contribution Detail Record, effective 16 January 2025, last updated Jan 2025:
https://www.cpf.gov.sg/content/dam/web/employer/making-cpf-contributions/documents/CPFEZPayFTPSpecifications.pdf

Read from the PDF on 8 Sept 2026. The real file is FIXED-WIDTH ASCII, 150 bytes
per record; this module takes a CSV whose columns MIRROR that record, because a
CSV is what a hackathon judge can open and a fixed-width parser is not the point.
Every column keeps the spec's own field name and its column positions are
recorded beside it, so the mapping to the real file is checkable rather than
asserted. SPEC_FIELDS is that mapping.

TWO COLUMNS ARE NOT IN THE SPEC, AND THEY ARE MARKED.

`date_of_birth` and `residency` do not appear anywhere in the Employer
Contribution Detail Record. The record carries no date of birth at all, and it
distinguishes only S and T prefixes on the CPF account number - which separate
citizens and PRs registered from 1 Jan 2000, not PR year 1 from PR year 3. The
engine needs both: band_for() needs a birth date, and the rate table needs to
know whether graduated PR rates apply.

So this module ASKS FOR TWO COLUMNS CPF BOARD DOES NOT PUBLISH, and says so on
the screen. Inventing them into the spec's list would have been the easiest
possible version of the exact failure this product exists to find - a schema
that looks official because most of it is. EXTRA_FIELDS is where they live, kept
apart from SPEC_FIELDS so the difference survives a refactor.

WHAT IS CHECKED comes from CPF Board's own list of employer mistakes, not ours:
https://www.cpf.gov.sg/content/dam/web/employer/faq/employer-obligations/documents/Common%20Mistakes%20Which%20Require%20Subsequent%20Adjustments%20To%20Employers.pdf
"Information correct as at April 2024." Quoted in CPF_MISTAKES below.

WHAT IS NOT CHECKED, and is refused instead. A row this module cannot check must
be VISIBLY uncheckable. An employer reading "3 exceptions" has to be able to see
that five other rows were never examined, and why - otherwise the summary is a
claim about rows nobody looked at. Every refusal carries the engine's own
message where the engine produced one.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from enum import Enum

from fairslip.cpf import (
    BAND_ORDER,
    NO_CPF,
    OW_CEILING_2026,
    AgeBand,
    CpfResult,
    OutOfScopeError,
    Residency,
    band_for,
    cpf_contribution,
)

# --------------------------------------------------------------- the schema


@dataclass(frozen=True)
class SpecField:
    """One column of CPF Board's Employer Contribution Detail Record.

    `columns` and `data_type` are the spec's own, so the CSV this module reads
    can be checked against the fixed-width file it mirrors rather than merely
    resembling it.
    """

    csv_name: str
    spec_name: str
    columns: str
    data_type: str
    note: str = ""


# Verbatim from the spec's "Employer Contribution Detail Record" table.
SPEC_FIELDS: tuple[SpecField, ...] = (
    SpecField("uen", "UEN/NRIC/FIN", "3 - 12", "X(10)", "9 or 10 bytes UEN/NRIC/FIN"),
    SpecField("payment_type", "Payment type", "13 - 15", "X(3)", "e.g. PTE, AMS, VCT"),
    SpecField("sno", "Sno", "16 - 17", "X(2)", "Serial number e.g. 01, 02, 03"),
    SpecField("relevant_month", "Relevant month", "21 - 26", "9(6) YYYYMM", "Month the contribution is for"),
    SpecField(
        "employee_account_no",
        "Employee account no.",
        "29 - 37",
        "X(9)",
        "First byte is either S or T and last byte is the check digit",
    ),
    SpecField(
        "contribution_detail_amount",
        "Contribution detail amount",
        "38 - 49",
        "9(10)V99",
        "The respective contribution amount for CPF (up to 2 decimal places)",
    ),
    SpecField("ordinary_wages", "Ordinary wages", "50 - 59", "9(8)V99", "Ordinary wages in dollars"),
    SpecField("additional_wages", "Additional wages", "60 - 69", "9(8)V99", "Additional wages in dollars"),
    SpecField(
        "employment_status",
        "Employment status",
        "70 - 70",
        "X(1) E/L/N/O",
        "E - Existing; L - Leaver; N - New Joiner; O - joins and leaves in the same month",
    ),
    SpecField("employee_name", "Employee name", "71 - 136", "X(66)", "Name of employee as shown on identity card"),
)

# NOT in the spec. Named apart so the difference cannot be lost in a refactor,
# and rendered apart on the screen so an employer is never told CPF Board asked
# for something CPF Board did not ask for.
EXTRA_FIELDS: tuple[SpecField, ...] = (
    SpecField(
        "date_of_birth",
        "(not in the CPF file)",
        "-",
        "YYYY-MM-DD",
        "The Detail Record carries no date of birth. band_for() needs one to apply CPF's "
        "own rule that new rates start the first day of the month AFTER the birthday.",
    ),
    SpecField(
        "residency",
        "(not in the CPF file)",
        "-",
        "CITIZEN / PR_YEAR_3_PLUS / PR_YEAR_1 / PR_YEAR_2 / WORK_PERMIT / S_PASS / EMPLOYMENT_PASS",
        "The Detail Record's S and T prefixes separate citizens from PRs registered since "
        "1 Jan 2000; they do not say which PR year applies, and the rate table needs that.",
    ),
)

CSV_COLUMNS: tuple[str, ...] = tuple(f.csv_name for f in SPEC_FIELDS + EXTRA_FIELDS)

# The spec's own words, for the screen. Quoted, with what they are quoted from.
SPEC_SOURCE = {
    "title": "CPF EZPay (FTP) File Specifications",
    "effective": "effective from 16 January 2025",
    "record": "Employer Contribution Detail Record",
    "length": "Fixed, 150 bytes per record",
    "url": (
        "https://www.cpf.gov.sg/content/dam/web/employer/making-cpf-contributions/"
        "documents/CPFEZPayFTPSpecifications.pdf"
    ),
    "read_on": "read from the PDF on 8 September 2026",
}

# CPF Board's rounding rules, quoted from the spec's own note on the
# "Contribution detail amount" column. fairslip/cpf.py implements exactly this;
# tests/test_employer_spec.py asserts the two agree.
SPEC_ROUNDING_A = (
    "the total CPF contribution payable by the employer should be rounded off to the "
    "nearest dollar e.g. $1.50 should be regarded as $2.00"
)
SPEC_ROUNDING_B = (
    "the amount recoverable by the employer from the employee's wages should be rounded "
    "down to the nearest dollar e.g. $1.50 should be regarded as $1.00"
)

# THE SCHEMA CONFIRMS THE PRODUCT'S THESIS, and this is where it says so.
#
# The Employer Contribution Detail Record's employee identifier is a CPF account
# number, and the spec admits exactly two prefixes. Verbatim, from the spec's
# Notes, item 4 (page 6):
SPEC_NOTE_4 = (
    "S prefix is used for Singapore citizens, permanent residents who are issued CPF "
    "account numbers by the Board. However, the T prefix will be issued to people who "
    "become permanent residents from 1 January 2000 as well as persons born on and "
    "after 1 January 2000."
)
# And verbatim from the "Employee account no." column itself (cols 29-37):
SPEC_ACCOUNT_COLUMN = (
    "To indicate the employee's CPF Account No (e.g. NRIC No.). First byte is either S "
    "or T and last byte is the check digit."
)
# FairSlip's reading of those two, labelled as FairSlip's - the same separation
# the escalation pack makes between an authority's words and ours. See
# docs/debt.md, gloss-inherits-the-authoritys-attribution.
SPEC_NOTE_4_READING = (
    "Both prefixes are CPF account numbers. There is no F, G or M prefix in this record "
    "- those are FIN prefixes, and Work Permit, S Pass and Employment Pass holders are "
    "not CPF members, so they have no CPF account number and no row in this file. That "
    "is why FairSlip ships two workers rather than one: Rahim is a Work Permit holder, "
    "and his month is real, checkable and entirely absent from the government's own CPF "
    "schema. The same engine, a different published rule, a different answer."
)

# Verbatim from CPF Board's "Common Mistakes Which Require Subsequent Adjustments
# To Employers' CPF Payments", information correct as at April 2024.
CPF_MISTAKES = {
    "computation": ("4. Computation Error", ("Classified Ordinary or Additional Wages incorrectly",)),
    "rate": (
        "5. Incorrect Contribution Rate",
        (
            "Indicated incorrect birth year/month",
            "Overlooked the change of age group",
            "Applied full CPF contribution rates for 1st and 2nd year Singapore Permanent Residents (SPR)",
        ),
    ),
}
CPF_MISTAKES_URL = (
    "https://www.cpf.gov.sg/content/dam/web/employer/faq/employer-obligations/documents/"
    "Common%20Mistakes%20Which%20Require%20Subsequent%20Adjustments%20To%20Employers.pdf"
)


# --------------------------------------------------------------- the outcome


class Outcome(str, Enum):
    OK = "OK"
    EXCEPTION = "EXCEPTION"
    REFUSED = "REFUSED"


class Reason(str, Enum):
    """Why a row is an exception, or why it could not be checked.

    Each names the CPF Board mistake it corresponds to where one exists. These
    are categories of FINDING, not causes: the module reports that a declared
    amount differs from what the rules give, never why the employer's system
    produced it.
    """

    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    AGE_BAND_MISSED = "AGE_BAND_MISSED"
    OW_ABOVE_CEILING = "OW_ABOVE_CEILING"
    ENGINE_REFUSED = "ENGINE_REFUSED"
    NOT_A_CPF_MEMBER = "NOT_A_CPF_MEMBER"
    ADDITIONAL_WAGES_PRESENT = "ADDITIONAL_WAGES_PRESENT"
    UNREADABLE_ROW = "UNREADABLE_ROW"


@dataclass(frozen=True)
class Finding:
    row_number: int
    employee_name: str
    employee_account_no: str
    outcome: Outcome
    reason: Reason | None
    detail: str
    declared: Decimal | None = None
    expected: Decimal | None = None
    difference: Decimal | None = None
    ordinary_wages: Decimal | None = None
    band: AgeBand | None = None
    engine_formula: str = ""
    engine_flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class EmployerCheck:
    findings: tuple[Finding, ...]
    rows_read: int
    checked: int
    exceptions: int
    refused: int
    total_difference: Decimal
    by_reason: tuple[tuple[str, int], ...] = field(default=())


# ---------------------------------------------------------------- the parse


def _decimal(raw: str, what: str) -> Decimal:
    text = (raw or "").strip().replace(",", "")
    if text == "":
        raise ValueError(f"{what} is empty")
    try:
        value = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"{what} is not a number: {raw!r}") from exc
    # The spec, note 2 and the wage columns: "Negative wages are not allowed."
    if value < 0:
        raise ValueError(f"{what} is negative, which the CPF file specification does not allow")
    return value


def _month(raw: str) -> date:
    """Relevant month, 9(6) YYYYMM in the spec."""
    text = (raw or "").strip()
    if len(text) != 6 or not text.isdigit():
        raise ValueError(f"relevant_month must be YYYYMM as the spec requires, got {raw!r}")
    year, month = int(text[:4]), int(text[4:])
    if not 1 <= month <= 12:
        raise ValueError(f"relevant_month has month {month}, which is not a month")
    return date(year, month, 1)


def _dob(raw: str) -> date:
    text = (raw or "").strip()
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(f"date_of_birth must be YYYY-MM-DD, got {raw!r}") from exc


def _residency(raw: str) -> Residency:
    text = (raw or "").strip().upper()
    try:
        return Residency(text)
    except ValueError as exc:
        allowed = ", ".join(r.value for r in Residency)
        raise ValueError(f"residency {raw!r} is not one of: {allowed}") from exc


# ---------------------------------------------------------------- the checks


def _previous_band(band: AgeBand) -> AgeBand | None:
    i = BAND_ORDER.index(band)
    return BAND_ORDER[i - 1] if i > 0 else None


def check_row(row: dict[str, str], row_number: int) -> Finding:
    """One row of the file against the engine.

    The order of the gates matters and is deliberate: everything this module
    CANNOT check is refused before anything is compared, so a row is never
    reported as an exception on the strength of a computation that did not
    apply to it.
    """
    name = (row.get("employee_name") or "").strip()
    account = (row.get("employee_account_no") or "").strip()

    def refused(reason: Reason, detail: str, **kw: object) -> Finding:
        return Finding(row_number, name, account, Outcome.REFUSED, reason, detail, **kw)  # type: ignore[arg-type]

    try:
        ow = _decimal(row.get("ordinary_wages", ""), "ordinary_wages")
        aw = _decimal(row.get("additional_wages", ""), "additional_wages")
        declared = _decimal(row.get("contribution_detail_amount", ""), "contribution_detail_amount")
        month = _month(row.get("relevant_month", ""))
        dob = _dob(row.get("date_of_birth", ""))
        residency = _residency(row.get("residency", ""))
    except ValueError as exc:
        return refused(Reason.UNREADABLE_ROW, str(exc))

    # 1. Additional Wages. The engine is Ordinary Wages only - the AW ceiling
    #    ($102,000 less the year's OW) is not encoded - so a declared amount that
    #    covers OW AND AW cannot be compared against an OW-only computation. Doing
    #    it anyway would report an exception on every row with a bonus in it, and
    #    every one of those would be this module's error, not the employer's.
    #    THIS MESSAGE IS FAIRSLIP'S, NOT THE ENGINE'S: the engine never sees AW.
    if aw > 0:
        return refused(
            Reason.ADDITIONAL_WAGES_PRESENT,
            f"FairSlip's limit, not CPF Board's: this row declares ${aw} of Additional Wages, "
            f"and FairSlip's CPF engine computes Ordinary Wages only. The declared amount "
            f"covers both, so comparing it against an OW-only figure would report a "
            f"difference that is FairSlip's to explain, not the employer's.",
            declared=declared,
            ordinary_wages=ow,
        )

    band = band_for(dob, month)

    # 2. Not a CPF member. The engine returns NO_CPF rather than an error, and a
    #    declared amount against it is a finding in its own right.
    if residency in NO_CPF:
        result = cpf_contribution(ow, band, residency)
        if declared > 0:
            return Finding(
                row_number,
                name,
                account,
                Outcome.EXCEPTION,
                Reason.NOT_A_CPF_MEMBER,
                result.flags[0] if result.flags else "no CPF liability for this pass type",
                declared=declared,
                expected=result.total,
                difference=declared - result.total,
                ordinary_wages=ow,
                band=band,
                engine_formula=result.formula,
                engine_flags=result.flags,
            )
        return Finding(
            row_number,
            name,
            account,
            Outcome.OK,
            None,
            result.flags[0] if result.flags else "no CPF liability for this pass type",
            declared=declared,
            expected=result.total,
            difference=Decimal(0),
            ordinary_wages=ow,
            band=band,
            engine_formula=result.formula,
            engine_flags=result.flags,
        )

    # 3. Anything the engine refuses - graduated PR years, wages at or below
    #    $750 - carrying the engine's OWN message, never a paraphrase.
    try:
        expected: CpfResult = cpf_contribution(ow, band, residency)
    except OutOfScopeError as exc:
        return refused(
            Reason.ENGINE_REFUSED,
            str(exc),
            declared=declared,
            ordinary_wages=ow,
            band=band,
        )

    difference = declared - expected.total
    if difference == 0:
        return Finding(
            row_number,
            name,
            account,
            Outcome.OK,
            None,
            "declared amount equals what the published rates give",
            declared=declared,
            expected=expected.total,
            difference=difference,
            ordinary_wages=ow,
            band=band,
            engine_formula=expected.formula,
            engine_flags=expected.flags,
        )

    # 4. The wage crossed the ceiling. Reported as its own reason because the
    #    remedy is different: nothing is wrong with the rate, the wage was not
    #    capped. The engine's own OW_CAPPED flag is the evidence and is carried
    #    through; this module asserts no cause beyond the arithmetic.
    if expected.ow_capped:
        return Finding(
            row_number,
            name,
            account,
            Outcome.EXCEPTION,
            Reason.OW_ABOVE_CEILING,
            f"Ordinary Wages of ${ow} exceed the ${OW_CEILING_2026} monthly ceiling. "
            f"The published rates on the capped wage give ${expected.total}.",
            declared=declared,
            expected=expected.total,
            difference=difference,
            ordinary_wages=ow,
            band=band,
            engine_formula=expected.formula,
            engine_flags=expected.flags,
        )

    # 5. The age-band transition. ESTABLISHED, not guessed: the declared amount
    #    is what the PREVIOUS band's rate gives on this same wage, and the worker
    #    has moved out of that band. CPF Board's own list calls this "Overlooked
    #    the change of age group". If the declared amount matches no band, this
    #    is a plain mismatch and says so instead.
    previous = _previous_band(band)
    if previous is not None:
        at_previous = cpf_contribution(ow, previous, residency)
        if declared == at_previous.total:
            return Finding(
                row_number,
                name,
                account,
                Outcome.EXCEPTION,
                Reason.AGE_BAND_MISSED,
                f"The declared amount is what the '{previous.value}' rate gives on this wage. "
                f"CPF's rule is that new rates apply from the first day of the month after the "
                f"birthday, and for {month:%B %Y} this employee is in '{band.value}'.",
                declared=declared,
                expected=expected.total,
                difference=difference,
                ordinary_wages=ow,
                band=band,
                engine_formula=expected.formula,
                engine_flags=expected.flags,
            )

    return Finding(
        row_number,
        name,
        account,
        Outcome.EXCEPTION,
        Reason.AMOUNT_MISMATCH,
        f"The published rates give ${expected.total} on Ordinary Wages of ${ow}.",
        declared=declared,
        expected=expected.total,
        difference=difference,
        ordinary_wages=ow,
        band=band,
        engine_formula=expected.formula,
        engine_flags=expected.flags,
    )


def check_csv(text: str) -> EmployerCheck:
    """Every row of an uploaded file, checked or visibly refused."""
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in CSV_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(
            "the file is missing columns this check needs: "
            + ", ".join(missing)
            + ". The first ten mirror CPF Board's Employer Contribution Detail Record; "
            "date_of_birth and residency are FairSlip's, and are not in that record."
        )

    findings = [check_row(row, i) for i, row in enumerate(reader, start=1)]
    exceptions = [f for f in findings if f.outcome is Outcome.EXCEPTION]
    refused = [f for f in findings if f.outcome is Outcome.REFUSED]

    counts: dict[str, int] = {}
    for f in exceptions + refused:
        if f.reason is not None:
            counts[f.reason.value] = counts.get(f.reason.value, 0) + 1

    return EmployerCheck(
        findings=tuple(findings),
        rows_read=len(findings),
        checked=len(findings) - len(refused),
        exceptions=len(exceptions),
        refused=len(refused),
        # The sum of the differences on the rows that WERE checked. Refused rows
        # contribute nothing, because nothing was computed for them.
        total_difference=sum((f.difference or Decimal(0) for f in exceptions), Decimal(0)),
        by_reason=tuple(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))),
    )
