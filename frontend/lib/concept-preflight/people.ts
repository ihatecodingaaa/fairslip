/**
 * The twenty employees the concept's story actually visits, in full.
 *
 * FICTIONAL. No real employer, employee, UEN or identity number appears here.
 * The names are assembled from common Singaporean given and family names across
 * the four main language communities, the same pool
 * backend/demo/employer_roster.py draws from; any resemblance to a real person
 * is the arithmetic of a small name pool. Identifiers are EMP-0001 style and
 * nothing here is shaped like an NRIC or a FIN.
 *
 * WHY TWENTY AND NOT THREE HUNDRED. Writing three hundred months of detail
 * would mean fabricating three hundred months of detail. The eighteen employees
 * the preflight has something to say about are here, plus two whose month
 * reconciled, so that a clean case can be opened and read. The other two
 * hundred and eighty carry a status, a role and a count of recorded changes,
 * and the inspector SAYS SO when you open one of them rather than showing a
 * confident empty panel. That is this product's own rule applied to itself.
 *
 * EVERY AMOUNT IS ONE OF TWO THINGS. A rule result from ruleDerived.ts, which
 * the production engines produced and the backend suite re-checks, or a figure
 * the fictional payroll register states, which is an INPUT to a check and never
 * the output of one. There is a third possibility in the type - an illustrative
 * value belonging to no rule and no record - and nothing in this file uses it.
 *
 * THE REGISTERS ADD UP. Every register's lines sum exactly to its net, and
 * invariants.ts asserts it. A month-to-month view built over a register that
 * did not add up would be arithmetic about nothing.
 */

import type {
  ConceptAmount,
  ConceptEmployee,
  ConceptEvent,
  ConceptFinding,
  EventType,
  Register,
  RegisterLine,
  SourceRef,
} from "./types";
import { ruleAmount } from "./ruleDerived";
import {
  CPF_AGE_STEP_UP,
  CPF_OW_CEILING,
  OVERTIME_MONTHLY_CAP,
  OVERTIME_RATE,
  REST_DAY_TABLE,
} from "./ruleSources";

/* ------------------------------------------------------------- the exports */

export const FILES = {
  registerSep: "hh-payroll-register-2026-09.csv",
  registerAug: "hh-payroll-register-2026-08.csv",
  attendance: "hh-attendance-2026-09.csv",
  leave: "hh-leave-2026-09.csv",
  master: "hh-employee-master-2026-09.csv",
  submission: "hh-cpf-submission-draft-2026-09.csv",
} as const;

const regSep = (row: number): SourceRef => ({
  system: "PAYROLL_REGISTER",
  file: FILES.registerSep,
  row,
});
const regAug = (row: number): SourceRef => ({
  system: "PAYROLL_REGISTER",
  file: FILES.registerAug,
  row,
});
const att = (row: number): SourceRef => ({ system: "ATTENDANCE", file: FILES.attendance, row });
const lve = (row: number): SourceRef => ({ system: "LEAVE", file: FILES.leave, row });
const hr = (row: number): SourceRef => ({ system: "HR_MASTER", file: FILES.master, row });
const cpfFile = (row: number): SourceRef => ({
  system: "CPF_SUBMISSION",
  file: FILES.submission,
  row,
});

/* ----------------------------------------------------------- amount makers */

const CENTS = /^-?\d+\.\d{2}$/;

/**
 * A figure the fictional payroll register states.
 *
 * ONE STRING, NOT TWO. A payroll line is paid in cents, so its exact value IS
 * its display value, and accepting two strings here would let them disagree.
 * The guard is not decoration: a register line that is not a cent figure is a
 * figure this fixture invented in some other shape, and the whole point of
 * keeping origins apart is that such a thing cannot pass for a rule result.
 */
function stated(cents: string, source: SourceRef): ConceptAmount {
  if (!CENTS.test(cents)) throw new Error(`a payroll-stated figure must be cents: ${cents}`);
  return {
    money: { exact: cents, display: cents },
    origin: "PAYROLL_STATED",
    engine: null,
    source,
    illustrativeNote: null,
  };
}

/* ----------------------------------------------------------------- builders */

function line(
  key: string,
  label: string,
  amount: ConceptAmount,
  event_ids: string[] = [],
  rule?: { figure: ConceptAmount; note: string },
): RegisterLine {
  return {
    key,
    label,
    amount,
    event_ids,
    ruleFigure: rule ? rule.figure : null,
    ruleNote: rule ? rule.note : null,
  };
}

function register(
  period: string,
  source: SourceRef,
  lines: RegisterLine[],
  net: string,
): Register {
  return { period, lines, net: stated(net, source), source };
}

/** Overtime rows from an attendance export, written compactly.
 *
 * One event per SOURCE ROW, because that is what the export contains and what
 * an operator would go and look at. Where a check operates on the month rather
 * than on a single row, the finding names all of the rows and each row's note
 * says it was checked with the others. */
function overtimeRows(
  employee: string,
  rows: { id: string; day: number; hours: string; row: number }[],
  shape: {
    amount_check: ConceptEvent["amount_check"];
    check_note: string;
    finding_id: string | null;
    expectedFor?: (id: string) => ConceptAmount | null;
  },
): ConceptEvent[] {
  return rows.map((r) => ({
    event_id: r.id,
    employee_id: employee,
    event_type: "OVERTIME" as EventType,
    event_date: `2026-09-${String(r.day).padStart(2, "0")}`,
    effective_date: "2026-09-30",
    source: att(r.row),
    approval_state: "APPROVED" as const,
    description: `${r.hours} overtime hours`,
    expected: shape.expectedFor ? shape.expectedFor(r.id) : null,
    payroll: null,
    difference: null,
    reached_payroll: "PRESENT" as const,
    amount_check: shape.amount_check,
    check_note: shape.check_note,
    finding_id: shape.finding_id,
    mc_verification: null,
  }));
}

/* ========================================================================= */
/* EMP-0127  Mei Ling Tan                                                    */
/* The case the whole concept is built around: a rest-day shift that reached  */
/* payroll at the wrong rate, beside three other changes that reached it      */
/* correctly and two the rule packs do not cover.                            */
/* ========================================================================= */

const MEILING_EVENTS: ConceptEvent[] = [
  ...overtimeRows(
    "EMP-0127",
    [
      { id: "EVT-0127-01", day: 3, hours: "2.0", row: 381 },
      { id: "EVT-0127-02", day: 5, hours: "2.0", row: 396 },
      { id: "EVT-0127-03", day: 11, hours: "1.5", row: 412 },
      { id: "EVT-0127-04", day: 24, hours: "2.5", row: 455 },
    ],
    {
      amount_check: "MATCHED",
      check_note:
        "Priced with the month's other overtime records: 8.0 hours at MOM's published rate " +
        "gives $132.17, which is what the register's overtime line states.",
      finding_id: null,
      expectedFor: (id) =>
        ({
          "EVT-0127-01": ruleAmount("meiling.ot.03sep"),
          "EVT-0127-02": ruleAmount("meiling.ot.05sep"),
          "EVT-0127-03": ruleAmount("meiling.ot.11sep"),
          "EVT-0127-04": ruleAmount("meiling.ot.24sep"),
        })[id] ?? null,
    },
  ),
  {
    event_id: "EVT-0127-05",
    employee_id: "EMP-0127",
    event_type: "REST_DAY_WORK",
    event_date: "2026-09-14",
    effective_date: "2026-09-30",
    source: att(427),
    approval_state: "APPROVED",
    description: "Worked 8.0 hours on a scheduled rest day",
    expected: ruleAmount("meiling.restday.expected"),
    payroll: stated("80.77", regSep(118)),
    difference: ruleAmount("meiling.restday.difference"),
    reached_payroll: "PRESENT",
    amount_check: "DIFFERS",
    check_note:
      "The shift reached the register. MOM's rest-day table gives two days' salary for more " +
      "than half the normal daily hours at the employer's request; the register states one.",
    finding_id: "FND-01",
    mc_verification: null,
  },
  {
    event_id: "EVT-0127-06",
    employee_id: "EMP-0127",
    event_type: "PAID_SICK_LEAVE",
    event_date: "2026-09-19",
    effective_date: "2026-09-30",
    source: lve(22),
    approval_state: "APPROVED",
    description: "One day of paid sick leave, medical certificate attached",
    expected: null,
    payroll: null,
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The leave record and the register agree that the day was paid. What a day of paid " +
      "sick leave is worth is not encoded in FairSlip's rule packs, so the amount was not " +
      "checked and is not assumed to be right.",
    finding_id: null,
    mc_verification: "UNVERIFIABLE",
  },
  {
    event_id: "EVT-0127-07",
    employee_id: "EMP-0127",
    event_type: "NO_PAY_LEAVE",
    event_date: "2026-09-08",
    effective_date: "2026-09-30",
    source: lve(14),
    approval_state: "APPROVED",
    description: "Three days of no-pay leave, 8 to 10 September",
    expected: null,
    payroll: stated("-242.31", regSep(118)),
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The register carries a no-pay-leave line for these three days. How a month is " +
      "pro-rated for unpaid days is not encoded in FairSlip's rule packs, so the deduction " +
      "was not checked.",
    finding_id: null,
    mc_verification: null,
  },
  {
    event_id: "EVT-0127-08",
    employee_id: "EMP-0127",
    event_type: "ALLOWANCE_CHANGE",
    event_date: "2026-09-22",
    effective_date: "2026-09-22",
    source: hr(127),
    approval_state: "APPROVED",
    description: "Meal allowance raised from $40 to $60 a month",
    expected: null,
    payroll: stated("60.00", regSep(118)),
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The change appears on the register at the new rate. Allowance amounts are set by the " +
      "employer rather than by a published rule, so there is nothing for FairSlip to check " +
      "the figure against.",
    finding_id: null,
    mc_verification: null,
  },
];

const MEILING_SEP = register(
  "September 2026",
  regSep(118),
  [
    line("basicSalary", "Basic salary", stated("2100.00", regSep(118))),
    line(
      "overtimePay",
      "Overtime",
      stated("132.17", regSep(118)),
      ["EVT-0127-01", "EVT-0127-02", "EVT-0127-03", "EVT-0127-04"],
      {
        figure: ruleAmount("meiling.ot.sep"),
        note: "MOM's overtime rate on the 8.0 hours the attendance export records.",
      },
    ),
    line("restDayPremium", "Rest-day premium", stated("80.77", regSep(118)), ["EVT-0127-05"], {
      figure: ruleAmount("meiling.restday.expected"),
      note: "MOM's rest-day table for 8.0 hours of 8, at the employer's request, on a 6-day week.",
    }),
    line("mealAllowance", "Meal allowance", stated("60.00", regSep(118)), ["EVT-0127-08"]),
    line("noPayLeave", "No-pay leave", stated("-242.31", regSep(118)), ["EVT-0127-07"]),
    line("cpfEmployee", "CPF employee share", stated("-426.00", regSep(118)), [], {
      figure: ruleAmount("meiling.cpf.employee.sep"),
      note:
        "CPF Board's published rate gives an employee share of this much on September's " +
        "Ordinary Wages of $2,130.63. The register shows it as a deduction.",
    }),
  ],
  "1704.63",
);

const MEILING_AUG = register(
  "August 2026",
  regAug(96),
  [
    line("basicSalary", "Basic salary", stated("2100.00", regAug(96))),
    line("overtimePay", "Overtime", stated("99.13", regAug(96)), [], {
      figure: ruleAmount("meiling.ot.aug"),
      note: "MOM's overtime rate on the 6.0 hours August's attendance export records.",
    }),
    line("restDayPremium", "Rest-day premium", stated("0.00", regAug(96))),
    line("mealAllowance", "Meal allowance", stated("40.00", regAug(96))),
    line("noPayLeave", "No-pay leave", stated("0.00", regAug(96))),
    line("cpfEmployee", "CPF employee share", stated("-447.00", regAug(96)), [], {
      figure: ruleAmount("meiling.cpf.employee.aug"),
      note:
        "CPF Board's published rate gives an employee share of this much on August's " +
        "Ordinary Wages of $2,239.13. The register shows it as a deduction.",
    }),
  ],
  "1792.13",
);

const FND_01: ConceptFinding = {
  finding_id: "FND-01",
  employee_id: "EMP-0127",
  event_ids: ["EVT-0127-05"],
  source: "ATTENDANCE",
  headline: "A rest-day shift reached payroll at one day's salary, not two",
  detail:
    "The attendance export records 8.0 hours worked on a scheduled rest day, raised by the " +
    "duty manager. MOM's rest-day table gives two days' salary when more than half the " +
    "normal daily hours are worked at the employer's request. The register states one day.",
  expected: ruleAmount("meiling.restday.expected"),
  payroll: stated("80.77", regSep(118)),
  difference: ruleAmount("meiling.restday.difference"),
  no_difference_reason: null,
  rule: REST_DAY_TABLE,
  workings: [
    { label: "Hourly basic rate", amount: ruleAmount("meiling.hourly") },
    { label: "One day's salary", amount: ruleAmount("meiling.daily") },
  ],
  alternatives: [],
  split: null,
  proposed_correction: {
    line: "Rest-day premium",
    from: stated("80.77", regSep(118)),
    to: ruleAmount("meiling.restday.expected"),
    note:
      "Check who raised the shift before changing anything. The rate turns on that fact, " +
      "and the attendance export is the only record of it here.",
  },
};

/* ========================================================================= */
/* EMP-0203  Siti Rahmah binte Osman                                         */
/* Six overtime records; the register paid nine of the fourteen hours.       */
/* ========================================================================= */

const SITI_EVENTS: ConceptEvent[] = overtimeRows(
  "EMP-0203",
  [
    { id: "EVT-0203-01", day: 2, hours: "2.0", row: 512 },
    { id: "EVT-0203-02", day: 6, hours: "3.0", row: 528 },
    { id: "EVT-0203-03", day: 9, hours: "2.0", row: 541 },
    { id: "EVT-0203-04", day: 16, hours: "2.5", row: 569 },
    { id: "EVT-0203-05", day: 23, hours: "2.5", row: 594 },
    { id: "EVT-0203-06", day: 27, hours: "2.0", row: 612 },
  ],
  {
    amount_check: "DIFFERS",
    check_note:
      "Checked with the month's other overtime records: the attendance export totals 14.0 " +
      "hours and the register's overtime line is priced on 9.0.",
    finding_id: "FND-02",
  },
);

const SITI_SEP = register(
  "September 2026",
  regSep(191),
  [
    line("basicSalary", "Basic salary", stated("1900.00", regSep(191))),
    line(
      "overtimePay",
      "Overtime",
      stated("134.53", regSep(191)),
      SITI_EVENTS.map((e) => e.event_id),
      {
        figure: ruleAmount("siti.ot.expected"),
        note: "MOM's overtime rate on the 14.0 hours the attendance export records.",
      },
    ),
    line("cpfEmployee", "CPF employee share", stated("-406.00", regSep(191))),
  ],
  "1628.53",
);

const SITI_AUG = register(
  "August 2026",
  regAug(168),
  [
    line("basicSalary", "Basic salary", stated("1900.00", regAug(168))),
    line("overtimePay", "Overtime", stated("89.69", regAug(168))),
    line("cpfEmployee", "CPF employee share", stated("-397.00", regAug(168))),
  ],
  "1592.69",
);

const FND_02: ConceptFinding = {
  finding_id: "FND-02",
  employee_id: "EMP-0203",
  event_ids: SITI_EVENTS.map((e) => e.event_id),
  source: "ATTENDANCE",
  headline: "Five of the fourteen recorded overtime hours are not on the register",
  detail:
    "Six attendance records total 14.0 overtime hours for September. The register's overtime " +
    "line is what MOM's rate gives for 9.0 hours. The two exports do not reconcile.",
  expected: ruleAmount("siti.ot.expected"),
  payroll: stated("134.53", regSep(191)),
  difference: ruleAmount("siti.ot.difference"),
  no_difference_reason: null,
  rule: OVERTIME_RATE,
  workings: [
    {
      label: "What the register's line is priced on, 9.0 hours",
      amount: ruleAmount("siti.ot.paidBasis"),
    },
  ],
  alternatives: [],
  split: null,
  proposed_correction: {
    line: "Overtime",
    from: stated("134.53", regSep(191)),
    to: ruleAmount("siti.ot.expected"),
    note:
      "Confirm the five hours were worked before changing anything. Correcting the wage also " +
      "moves the Ordinary Wage that CPF is calculated on.",
  },
};

/* ========================================================================= */
/* EMP-0241  Ravi s/o Muthu                                                  */
/* The amounts agree. The hours do not.                                      */
/* ========================================================================= */

const RAVI_EVENTS: ConceptEvent[] = overtimeRows(
  "EMP-0241",
  [
    { id: "EVT-0241-01", day: 1, hours: "9.0", row: 604 },
    { id: "EVT-0241-02", day: 4, hours: "8.0", row: 618 },
    { id: "EVT-0241-03", day: 7, hours: "9.0", row: 631 },
    { id: "EVT-0241-04", day: 10, hours: "8.5", row: 645 },
    { id: "EVT-0241-05", day: 14, hours: "9.0", row: 662 },
    { id: "EVT-0241-06", day: 17, hours: "8.5", row: 679 },
    { id: "EVT-0241-07", day: 21, hours: "9.0", row: 694 },
    { id: "EVT-0241-08", day: 24, hours: "8.5", row: 711 },
    { id: "EVT-0241-09", day: 28, hours: "8.5", row: 728 },
  ],
  {
    amount_check: "MATCHED",
    check_note:
      "Priced with the month's other overtime records: 78.0 hours at MOM's published rate " +
      "gives $1,472.73, which is what the register states. The hours themselves raised a " +
      "separate finding.",
    finding_id: "FND-03",
  },
);

const RAVI_SEP = register(
  "September 2026",
  regSep(228),
  [
    line("basicSalary", "Basic salary", stated("2400.00", regSep(228))),
    line(
      "overtimePay",
      "Overtime",
      stated("1472.73", regSep(228)),
      RAVI_EVENTS.map((e) => e.event_id),
      {
        figure: ruleAmount("ravi.ot.expected"),
        note: "MOM's overtime rate on the 78.0 hours the attendance export records.",
      },
    ),
    line("cpfEmployee", "CPF employee share", stated("-774.00", regSep(228))),
  ],
  "3098.73",
);

const FND_03: ConceptFinding = {
  finding_id: "FND-03",
  employee_id: "EMP-0241",
  event_ids: RAVI_EVENTS.map((e) => e.event_id),
  source: "ATTENDANCE",
  headline: "78.0 overtime hours recorded in a month whose published cap is 72",
  detail:
    "The register and MOM's overtime rate agree to the cent on these hours, so nothing here " +
    "is a pay difference. MOM's published page states a monthly limit of 72 overtime hours. " +
    "FairSlip does not decide whether an exemption applies to this workplace.",
  expected: ruleAmount("ravi.ot.expected"),
  payroll: stated("1472.73", regSep(228)),
  difference: null,
  no_difference_reason:
    "The amounts agree to the cent. What does not reconcile here is the recorded hours " +
    "against a published limit, and that is not a sum of money.",
  rule: OVERTIME_MONTHLY_CAP,
  workings: [],
  alternatives: [],
  split: null,
  proposed_correction: null,
};

/* ========================================================================= */
/* EMP-0058  Jonathan Goh                                                    */
/* The rule gives two answers, because nobody established the fact it turns  */
/* on. This is the finding FairSlip is shaped to produce.                    */
/* ========================================================================= */

const JONATHAN_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0058-01",
    employee_id: "EMP-0058",
    event_type: "REST_DAY_WORK",
    event_date: "2026-09-07",
    effective_date: "2026-09-30",
    source: att(478),
    approval_state: "PENDING",
    description: "Worked 7.0 hours on a scheduled rest day",
    expected: null,
    payroll: stated("169.23", regSep(52)),
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "MOM's rest-day table prices this shift differently depending on who asked for it, and " +
      "the attendance export carries no approval against the row. Both answers are shown; " +
      "FairSlip does not pick one.",
    finding_id: "FND-04",
    mc_verification: null,
  },
];

const JONATHAN_SEP = register(
  "September 2026",
  regSep(52),
  [
    line("basicSalary", "Basic salary", stated("2200.00", regSep(52))),
    line("restDayPremium", "Rest-day premium", stated("169.23", regSep(52)), ["EVT-0058-01"]),
    line("cpfEmployee", "CPF employee share", stated("-473.00", regSep(52))),
  ],
  "1896.23",
);

const FND_04: ConceptFinding = {
  finding_id: "FND-04",
  employee_id: "EMP-0058",
  event_ids: ["EVT-0058-01"],
  source: "ATTENDANCE",
  headline: "The rest-day rate turns on a fact no export records",
  detail:
    "MOM's table gives two days' salary when the employer asks for the shift and one day " +
    "when the employee does. The register states the employer's-request figure. The " +
    "attendance row carries no approval and no requester, so which of the two applies has " +
    "not been established by anything FairSlip can read.",
  expected: null,
  payroll: stated("169.23", regSep(52)),
  difference: null,
  no_difference_reason:
    "There are two rule answers here, $169.23 and $84.62, and no established fact to choose " +
    "between them. A single difference would be FairSlip choosing on your behalf.",
  rule: REST_DAY_TABLE,
  workings: [],
  alternatives: [
    {
      label: "If the employer asked for the shift",
      amount: ruleAmount("jonathan.restday.employer"),
    },
    { label: "If the employee asked for it", amount: ruleAmount("jonathan.restday.employee") },
  ],
  split: null,
  proposed_correction: null,
};

/* ========================================================================= */
/* EMP-0166  Nurul Aisyah binte Yusof     leave recorded, no register line   */
/* ========================================================================= */

const NURUL_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0166-01",
    employee_id: "EMP-0166",
    event_type: "NO_PAY_LEAVE",
    event_date: "2026-09-15",
    effective_date: "2026-09-30",
    source: lve(31),
    approval_state: "APPROVED",
    description: "Three days of no-pay leave, 15 to 17 September",
    expected: null,
    payroll: null,
    difference: null,
    reached_payroll: "ABSENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The leave export records three approved unpaid days. The register's no-pay-leave line " +
      "is $0.00. The two exports do not reconcile, and the amount that line should carry is " +
      "not something FairSlip's rule packs encode.",
    finding_id: "FND-05",
    mc_verification: null,
  },
];

const NURUL_SEP = register(
  "September 2026",
  regSep(154),
  [
    line("basicSalary", "Basic salary", stated("1850.00", regSep(154))),
    line("noPayLeave", "No-pay leave", stated("0.00", regSep(154)), ["EVT-0166-01"]),
    line("cpfEmployee", "CPF employee share", stated("-370.00", regSep(154))),
  ],
  "1480.00",
);

const FND_05: ConceptFinding = {
  finding_id: "FND-05",
  employee_id: "EMP-0166",
  event_ids: ["EVT-0166-01"],
  source: "LEAVE",
  headline: "Three approved unpaid days, and no no-pay-leave line on the register",
  detail:
    "The leave export records 15 to 17 September as approved no-pay leave. The register's " +
    "no-pay-leave line for this employee is $0.00 and the basic salary is a full month.",
  expected: null,
  payroll: stated("0.00", regSep(154)),
  difference: null,
  no_difference_reason:
    "How a monthly salary is pro-rated for unpaid days is not encoded in FairSlip's rule " +
    "packs, so there is no figure to put against the $0.00.",
  rule: null,
  workings: [],
  alternatives: [],
  split: null,
  proposed_correction: null,
};

/* ========================================================================= */
/* EMP-0089  Kumar s/o Rajan     a paid day recorded as an unpaid one        */
/* ========================================================================= */

const KUMAR_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0089-01",
    employee_id: "EMP-0089",
    event_type: "PAID_SICK_LEAVE",
    event_date: "2026-09-19",
    effective_date: "2026-09-30",
    source: lve(27),
    approval_state: "APPROVED",
    description: "One day of paid sick leave, medical certificate attached",
    expected: null,
    payroll: stated("-76.92", regSep(76)),
    difference: null,
    reached_payroll: "CONTRADICTED",
    amount_check: "NOT_CHECKED",
    check_note:
      "The leave export records the day as approved paid sick leave. The register deducts a " +
      "day under 'unpaid absence'. The two exports do not reconcile. What a paid sick day is " +
      "worth is not encoded in FairSlip's rule packs.",
    finding_id: "FND-06",
    mc_verification: "VERIFIED",
  },
];

const KUMAR_SEP = register(
  "September 2026",
  regSep(76),
  [
    line("basicSalary", "Basic salary", stated("2000.00", regSep(76))),
    line("unpaidAbsence", "Unpaid absence", stated("-76.92", regSep(76)), ["EVT-0089-01"]),
    line("cpfEmployee", "CPF employee share", stated("-384.00", regSep(76))),
  ],
  "1539.08",
);

const FND_06: ConceptFinding = {
  finding_id: "FND-06",
  employee_id: "EMP-0089",
  event_ids: ["EVT-0089-01"],
  source: "LEAVE",
  headline: "A day approved as paid sick leave was deducted as unpaid absence",
  detail:
    "The leave export records 19 September as approved paid sick leave with a certificate " +
    "attached. The register deducts a day of unpaid absence on the same date.",
  expected: null,
  payroll: stated("-76.92", regSep(76)),
  difference: null,
  no_difference_reason:
    "Paid sick leave is not encoded in FairSlip's rule packs, so there is no rule figure to " +
    "put against the deduction.",
  rule: null,
  workings: [],
  alternatives: [],
  split: null,
  proposed_correction: null,
};

/* ========================================================================= */
/* EMP-0012  Cheryl Lim     two exports that contradict each other           */
/* ========================================================================= */

const CHERYL_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0012-01",
    employee_id: "EMP-0012",
    event_type: "NO_PAY_LEAVE",
    event_date: "2026-09-02",
    effective_date: "2026-09-30",
    source: lve(8),
    approval_state: "APPROVED",
    description: "Three days of no-pay leave, 2 to 4 September",
    expected: null,
    payroll: stated("-317.31", regSep(9)),
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The register deducts three unpaid days, matching the leave export. The attendance " +
      "export records a worked shift inside those three days, which is what raised the " +
      "finding. The deduction amount is not encoded in FairSlip's rule packs.",
    finding_id: "FND-07",
    mc_verification: null,
  },
];

const CHERYL_SEP = register(
  "September 2026",
  regSep(9),
  [
    line("basicSalary", "Basic salary", stated("2750.00", regSep(9))),
    line("noPayLeave", "No-pay leave", stated("-317.31", regSep(9)), ["EVT-0012-01"]),
    line("cpfEmployee", "CPF employee share", stated("-486.00", regSep(9))),
  ],
  "1946.69",
);

const FND_07: ConceptFinding = {
  finding_id: "FND-07",
  employee_id: "EMP-0012",
  event_ids: ["EVT-0012-01"],
  source: "LEAVE",
  headline: "A shift was worked inside three days recorded as no-pay leave",
  detail:
    "The leave export records 2 to 4 September as approved no-pay leave. The attendance " +
    "export records a 9.0 hour shift on 3 September, clocked in and out. One of the two " +
    "records is wrong and FairSlip cannot tell which.",
  expected: null,
  payroll: stated("-317.31", regSep(9)),
  difference: null,
  no_difference_reason:
    "Which record is correct has not been established, and no-pay-leave pro-ration is not " +
    "encoded. Putting a figure on this would mean choosing which export to believe.",
  rule: null,
  workings: [],
  alternatives: [],
  split: null,
  proposed_correction: null,
};

/* ========================================================================= */
/* EMP-0044  Muhammad Hafiz bin Ismail     the lifecycle case                */
/* ========================================================================= */

const HAFIZ_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0044-01",
    employee_id: "EMP-0044",
    event_type: "LEAVER",
    event_date: "2026-08-31",
    effective_date: "2026-08-31",
    source: hr(44),
    approval_state: "APPROVED",
    description: "Employment ended 31 August 2026",
    expected: null,
    payroll: stated("0.00", regSep(38)),
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The register pays nothing for September, which is what the employee master implies. " +
      "The CPF submission draft still carries a contribution record for the same month, and " +
      "that is what does not reconcile.",
    finding_id: "FND-08",
    mc_verification: null,
  },
];

const HAFIZ_SEP = register(
  "September 2026",
  regSep(38),
  [
    line("basicSalary", "Basic salary", stated("0.00", regSep(38)), ["EVT-0044-01"]),
    line("cpfEmployee", "CPF employee share", stated("0.00", regSep(38))),
  ],
  "0.00",
);

const FND_08: ConceptFinding = {
  finding_id: "FND-08",
  employee_id: "EMP-0044",
  event_ids: ["EVT-0044-01"],
  source: "EMPLOYMENT_STATUS",
  headline: "Employment ended in August; the September CPF submission still lists a contribution",
  detail:
    "The employee master records the last day of employment as 31 August 2026. The " +
    "September register pays nothing, which agrees with it. The September CPF submission " +
    "draft carries a row for this employee with Ordinary Wages of $2,800.00 and a total " +
    "contribution of $1,036.00. Employment status and contribution records do not reconcile.",
  expected: null,
  payroll: stated("1036.00", cpfFile(41)),
  difference: null,
  no_difference_reason:
    "Whether this row belongs in the submission is a question about the employment record, " +
    "not about a rate. FairSlip has no rule that turns 'this person left' into an amount.",
  rule: null,
  workings: [],
  alternatives: [],
  split: null,
  proposed_correction: null,
};

/* ========================================================================= */
/* EMP-0298  Priya d/o Krishnan     a joiner paid a full month               */
/* ========================================================================= */

const PRIYA_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0298-01",
    employee_id: "EMP-0298",
    event_type: "JOINER",
    event_date: "2026-09-22",
    effective_date: "2026-09-22",
    source: hr(298),
    approval_state: "APPROVED",
    description: "Started 22 September 2026",
    expected: null,
    payroll: stated("1800.00", regSep(266)),
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The employee master records a start date of 22 September. The register states a full " +
      "month of basic salary. Pro-rating a first part-month is not encoded in FairSlip's " +
      "rule packs, so the amount was not checked.",
    finding_id: "FND-09",
    mc_verification: null,
  },
];

const PRIYA_SEP = register(
  "September 2026",
  regSep(266),
  [
    line("basicSalary", "Basic salary", stated("1800.00", regSep(266)), ["EVT-0298-01"]),
    line("cpfEmployee", "CPF employee share", stated("-360.00", regSep(266))),
  ],
  "1440.00",
);

const FND_09: ConceptFinding = {
  finding_id: "FND-09",
  employee_id: "EMP-0298",
  event_ids: ["EVT-0298-01"],
  source: "EMPLOYMENT_STATUS",
  headline: "A start date of 22 September, and a full month of basic salary",
  detail:
    "The employee master gives 22 September as the first day of employment. The register " +
    "states $1,800.00 of basic salary, which is the full monthly figure in the same file.",
  expected: null,
  payroll: stated("1800.00", regSep(266)),
  difference: null,
  no_difference_reason:
    "Pro-rating an incomplete first month is not encoded in FairSlip's rule packs. A figure " +
    "here would be one this product invented.",
  rule: null,
  workings: [],
  alternatives: [],
  split: null,
  proposed_correction: null,
};

/* ========================================================================= */
/* EMP-0173  Boon Keng Teo     the age band that moved and the rate that did */
/* not. CPF Board's own list of common employer mistakes leads with this.    */
/* ========================================================================= */

const BOONKENG_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0173-01",
    employee_id: "EMP-0173",
    event_type: "CPF_STATUS",
    event_date: "2026-09-01",
    effective_date: "2026-09-01",
    source: hr(173),
    approval_state: "APPROVED",
    description: "Moved into the Above 55 to 60 contribution band",
    expected: ruleAmount("boonkeng.cpf.total"),
    payroll: stated("1554.00", cpfFile(160)),
    difference: ruleAmount("boonkeng.cpf.difference"),
    reached_payroll: "ABSENT",
    amount_check: "DIFFERS",
    check_note:
      "CPF Board's rule puts the new rates on the first day of the month after the 55th " +
      "birthday, which is 1 September here. The submission draft is still priced at the " +
      "under-55 rates.",
    finding_id: "FND-10",
    mc_verification: null,
  },
  {
    event_id: "EVT-0173-02",
    employee_id: "EMP-0173",
    event_type: "ALLOWANCE_CHANGE",
    event_date: "2026-08-31",
    effective_date: "2026-09-01",
    source: hr(173),
    approval_state: "APPROVED",
    description: "Standby allowance ended 31 August",
    expected: null,
    payroll: null,
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "NOT_CHECKED",
    check_note:
      "The August register carried a standby allowance line and the September register has " +
      "none, which is what the employee master says should happen. Allowance amounts are set " +
      "by the employer, so there is no published rule to check the figure against.",
    finding_id: null,
    mc_verification: null,
  },
];

const BOONKENG_SEP = register(
  "September 2026",
  regSep(160),
  [
    line("basicSalary", "Basic salary", stated("4200.00", regSep(160))),
    line("cpfEmployee", "CPF employee share", stated("-840.00", regSep(160)), ["EVT-0173-01"]),
  ],
  "3360.00",
);

const BOONKENG_AUG = register(
  "August 2026",
  regAug(148),
  [
    line("basicSalary", "Basic salary", stated("4200.00", regAug(148))),
    line("standbyAllowance", "Standby allowance", stated("120.00", regAug(148)), [
      "EVT-0173-02",
    ]),
    line("cpfEmployee", "CPF employee share", stated("-864.00", regAug(148))),
  ],
  "3456.00",
);

const FND_10: ConceptFinding = {
  finding_id: "FND-10",
  employee_id: "EMP-0173",
  event_ids: ["EVT-0173-01"],
  source: "PAYROLL_CONFIGURATION",
  headline: "September CPF is priced at the under-55 rates for an employee who is over 55",
  detail:
    "The date of birth in the employee master puts this employee in CPF Board's Above 55 to " +
    "60 band from 1 September. The submission draft states $1,554.00, which is what the " +
    "under-55 rates give on the same wage. The published rates for the correct band give " +
    "$1,428.00, so the submission is above the published rule rather than below it.",
  expected: ruleAmount("boonkeng.cpf.total"),
  payroll: stated("1554.00", cpfFile(160)),
  difference: ruleAmount("boonkeng.cpf.difference"),
  no_difference_reason: null,
  rule: CPF_AGE_STEP_UP,
  workings: [
    { label: "Employee share at the correct band", amount: ruleAmount("boonkeng.cpf.employee") },
    { label: "Employer share at the correct band", amount: ruleAmount("boonkeng.cpf.employer") },
  ],
  alternatives: [],
  split: null,
  proposed_correction: {
    line: "CPF total contribution",
    from: stated("1554.00", cpfFile(160)),
    to: ruleAmount("boonkeng.cpf.total"),
    note:
      "The employee share also moves, from $840.00 to $756.00. Check the date of birth in " +
      "the employee master before changing the contribution band.",
  },
};

/* ========================================================================= */
/* EMP-0231  Grace Fernandez     a pay rise that took the wage past the      */
/* Ordinary Wage ceiling, and a configuration that did not notice            */
/* ========================================================================= */

const GRACE_EVENTS: ConceptEvent[] = [
  {
    event_id: "EVT-0231-01",
    employee_id: "EMP-0231",
    event_type: "SALARY_CHANGE",
    event_date: "2026-09-01",
    effective_date: "2026-09-01",
    source: hr(231),
    approval_state: "APPROVED",
    description: "Monthly basic salary raised to $9,400.00",
    expected: ruleAmount("grace.cpf.total"),
    payroll: stated("3478.00", cpfFile(214)),
    difference: ruleAmount("grace.cpf.difference"),
    reached_payroll: "PRESENT",
    amount_check: "DIFFERS",
    check_note:
      "The new salary reached the register. The CPF submission is calculated on the whole of " +
      "it, and CPF Board's Ordinary Wage ceiling is $8,000 a month from 1 January 2026.",
    finding_id: "FND-11",
    mc_verification: null,
  },
];

const GRACE_SEP = register(
  "September 2026",
  regSep(214),
  [
    line("basicSalary", "Basic salary", stated("9400.00", regSep(214)), ["EVT-0231-01"]),
    line("cpfEmployee", "CPF employee share", stated("-1880.00", regSep(214)), ["EVT-0231-01"]),
  ],
  "7520.00",
);

const FND_11: ConceptFinding = {
  finding_id: "FND-11",
  employee_id: "EMP-0231",
  event_ids: ["EVT-0231-01"],
  source: "PAYROLL_CONFIGURATION",
  headline: "CPF is calculated on $9,400.00 of Ordinary Wages, above the published ceiling",
  detail:
    "CPF Board's Ordinary Wage ceiling is $8,000 a month from 1 January 2026. The submission " +
    "draft states a total contribution of $3,478.00, which is the full rate on the whole " +
    "wage. On the capped wage the published rates give $2,960.00.",
  expected: ruleAmount("grace.cpf.total"),
  payroll: stated("3478.00", cpfFile(214)),
  difference: ruleAmount("grace.cpf.difference"),
  no_difference_reason: null,
  rule: CPF_OW_CEILING,
  workings: [
    { label: "Employee share on the capped wage", amount: ruleAmount("grace.cpf.employee") },
    { label: "Employer share on the capped wage", amount: ruleAmount("grace.cpf.employer") },
  ],
  alternatives: [],
  split: null,
  proposed_correction: {
    line: "CPF total contribution",
    from: stated("3478.00", cpfFile(214)),
    to: ruleAmount("grace.cpf.total"),
    note:
      "The employee share also moves, from $1,880.00 to $1,600.00, which changes the net pay " +
      "on the register as well as the submission.",
  },
};

/* ========================================================================= */
/* Two months that reconciled, so a clean case can be opened and read        */
/* ========================================================================= */

const HUILING_EVENTS: ConceptEvent[] = [
  ...overtimeRows(
    "EMP-0007",
    [
      { id: "EVT-0007-01", day: 4, hours: "2.0", row: 98 },
      { id: "EVT-0007-02", day: 18, hours: "2.0", row: 131 },
    ],
    {
      amount_check: "MATCHED",
      check_note:
        "Priced with the month's other overtime record: 4.0 hours at MOM's published rate " +
        "gives $81.82, which is what the register states. The rate applies to the month, " +
        "so the figure sits on the register's overtime line rather than on this row.",
      finding_id: null,
    },
  ),
  {
    event_id: "EVT-0007-03",
    employee_id: "EMP-0007",
    event_type: "REST_DAY_WORK",
    event_date: "2026-09-06",
    effective_date: "2026-09-30",
    source: att(102),
    approval_state: "APPROVED",
    description: "Worked 5.0 hours on a scheduled rest day, swapped at her own request",
    expected: ruleAmount("huiling.restday.expected"),
    payroll: stated("120.00", regSep(6)),
    difference: null,
    reached_payroll: "PRESENT",
    amount_check: "MATCHED",
    check_note:
      "The attendance row records the swap as raised by the employee. MOM's table gives one " +
      "day's salary for that case, and the register states it.",
    finding_id: null,
    mc_verification: null,
  },
];

const HUILING_SEP = register(
  "September 2026",
  regSep(6),
  [
    line("basicSalary", "Basic salary", stated("2600.00", regSep(6))),
    line(
      "overtimePay",
      "Overtime",
      stated("81.82", regSep(6)),
      ["EVT-0007-01", "EVT-0007-02"],
      {
        figure: ruleAmount("huiling.ot.sep"),
        note: "MOM's overtime rate on the 4.0 hours the attendance export records.",
      },
    ),
    line("restDayPremium", "Rest-day premium", stated("120.00", regSep(6)), ["EVT-0007-03"], {
      figure: ruleAmount("huiling.restday.expected"),
      note:
        "MOM's rest-day table for 5.0 hours of 8, at the employee's own request, on a " +
        "5-day week.",
    }),
    line("cpfEmployee", "CPF employee share", stated("-560.00", regSep(6)), [], {
      figure: ruleAmount("huiling.cpf.employee"),
      note:
        "CPF Board's published rate gives an employee share of this much on September's " +
        "Ordinary Wages of $2,801.82. The register shows it as a deduction.",
    }),
  ],
  "2241.82",
);

const HUILING_AUG = register(
  "August 2026",
  regAug(6),
  [
    line("basicSalary", "Basic salary", stated("2600.00", regAug(6))),
    line("overtimePay", "Overtime", stated("0.00", regAug(6))),
    line("restDayPremium", "Rest-day premium", stated("0.00", regAug(6))),
    line("cpfEmployee", "CPF employee share", stated("-520.00", regAug(6))),
  ],
  "2080.00",
);

const AHMAD_EVENTS: ConceptEvent[] = overtimeRows(
  "EMP-0083",
  [
    { id: "EVT-0083-01", day: 2, hours: "2.5", row: 144 },
    { id: "EVT-0083-02", day: 8, hours: "2.5", row: 159 },
    { id: "EVT-0083-03", day: 15, hours: "2.0", row: 177 },
    { id: "EVT-0083-04", day: 22, hours: "2.5", row: 198 },
    { id: "EVT-0083-05", day: 29, hours: "2.5", row: 221 },
  ],
  {
    amount_check: "MATCHED",
    check_note:
      "Priced with the month's other overtime records: 12.0 hours at MOM's published rate " +
      "gives $264.34, which is what the register states. The rate applies to the month, so " +
      "the figure sits on the register's overtime line rather than on this row.",
    finding_id: null,
  },
);

const AHMAD_SEP = register(
  "September 2026",
  regSep(71),
  [
    line("basicSalary", "Basic salary", stated("2800.00", regSep(71))),
    line(
      "overtimePay",
      "Overtime",
      stated("264.34", regSep(71)),
      AHMAD_EVENTS.map((e) => e.event_id),
      {
        figure: ruleAmount("ahmad.ot.sep"),
        note: "MOM's overtime rate on the 12.0 hours the attendance export records.",
      },
    ),
    line("cpfEmployee", "CPF employee share", stated("-612.00", regSep(71)), [], {
      figure: ruleAmount("ahmad.cpf.employee"),
      note:
        "CPF Board's published rate gives an employee share of this much on September's " +
        "Ordinary Wages of $3,064.34. The register shows it as a deduction.",
    }),
  ],
  "2452.34",
);

/* ========================================================================= */
/* The seven rows nothing was computed for                                   */
/*                                                                           */
/* THESE ARE THE ROWS A SUMMARY USUALLY SWALLOWS. Each one carries the        */
/* engine's own reason for declining, in the engine's own words where there   */
/* is one, and the register figure that was NOT checked - because a row       */
/* quietly absent from an exceptions table reads exactly like a clean one.    */
/* ========================================================================= */

type NotCheckedSpec = {
  id: string;
  name: string;
  role: string;
  location: string;
  department: string;
  reason: string;
  next: string;
  registerRow: number;
  lines: [key: string, label: string, cents: string][];
  net: string;
};

const NOT_CHECKED_SPECS: NotCheckedSpec[] = [
  {
    id: "EMP-0061",
    name: "Wei Ming Ong",
    role: "Sous Chef",
    location: "Bayfront Kitchen",
    department: "Restaurant Operations",
    reason:
      "Additional Wages are present on this row. FairSlip's CPF pack covers Ordinary Wages " +
      "only, so the contribution on a month that mixes the two cannot be reconstructed and " +
      "is not guessed at.",
    next:
      "A payroll reviewer checks the Additional Wage ceiling for the year by hand. FairSlip " +
      "does not assume the figure is right and does not count it as matched.",
    registerRow: 55,
    lines: [
      ["basicSalary", "Basic salary", "4600.00"],
      ["bonus", "Performance bonus", "6000.00"],
      ["cpfEmployee", "CPF employee share", "-2120.00"],
    ],
    net: "8480.00",
  },
  {
    id: "EMP-0117",
    name: "Priscilla Neo",
    role: "Events Manager",
    location: "Harbour Point",
    department: "Events",
    reason:
      "Additional Wages are present on this row. FairSlip's CPF pack covers Ordinary Wages " +
      "only.",
    next:
      "A payroll reviewer checks the Additional Wage ceiling for the year by hand.",
    registerRow: 106,
    lines: [
      ["basicSalary", "Basic salary", "5200.00"],
      ["bonus", "Performance bonus", "5200.00"],
      ["cpfEmployee", "CPF employee share", "-2080.00"],
    ],
    net: "8320.00",
  },
  {
    id: "EMP-0255",
    name: "Bernard Chua",
    role: "Facilities Lead",
    location: "Westlink Depot",
    department: "Facilities",
    reason:
      "Additional Wages are present on this row. FairSlip's CPF pack covers Ordinary Wages " +
      "only.",
    next: "A payroll reviewer checks the Additional Wage ceiling for the year by hand.",
    registerRow: 236,
    lines: [
      ["basicSalary", "Basic salary", "3900.00"],
      ["bonus", "Retention bonus", "2000.00"],
      ["cpfEmployee", "CPF employee share", "-1180.00"],
    ],
    net: "4720.00",
  },
  {
    id: "EMP-0092",
    name: "Anand s/o Pillai",
    role: "Kitchen Crew",
    location: "Northgate Cafe",
    department: "Restaurant Operations",
    reason:
      "Permanent Resident in the first year. Graduated contribution rates apply and are not " +
      "encoded: the engine's own words are that secondary sources conflict on the Year-2 " +
      "employer rate and it was never verified against CPF Table 3.",
    next:
      "A payroll reviewer reads the rate from CPF Board's own table. FairSlip refuses rather " +
      "than approximating a rate it has not verified.",
    registerRow: 84,
    lines: [
      ["basicSalary", "Basic salary", "3100.00"],
      ["cpfEmployee", "CPF employee share", "-300.00"],
    ],
    net: "2800.00",
  },
  {
    id: "EMP-0209",
    name: "Kavitha d/o Selvam",
    role: "Service Crew",
    location: "Westlink Cafe",
    department: "Restaurant Operations",
    reason:
      "Permanent Resident in the second year. Graduated contribution rates apply and are not " +
      "encoded, for the same reason.",
    next: "A payroll reviewer reads the rate from CPF Board's own table.",
    registerRow: 196,
    lines: [
      ["basicSalary", "Basic salary", "2450.00"],
      ["cpfEmployee", "CPF employee share", "-368.00"],
    ],
    net: "2082.00",
  },
  {
    id: "EMP-0288",
    name: "Zhi Hao Lim",
    role: "Service Crew, part time",
    location: "Northgate Cafe",
    department: "Restaurant Operations",
    reason:
      "Monthly wages at or below $750. CPF Board applies graduated formulas in that band and " +
      "they are not encoded in FairSlip.",
    next:
      "A payroll reviewer applies the graduated formula from CPF Board's table. The row is " +
      "not reported as correct and not reported as wrong.",
    registerRow: 258,
    lines: [
      ["basicSalary", "Basic salary", "690.00"],
      ["cpfEmployee", "CPF employee share", "-35.00"],
    ],
    net: "655.00",
  },
  {
    id: "EMP-0140",
    name: "Farhan bin Hassan",
    role: "Banquet Casual",
    location: "Harbour Point",
    department: "Events",
    reason:
      "Paid by the shift rather than by the month. FairSlip's Employment Act pack covers " +
      "monthly-rated employees, and MOM's hourly and daily formulas both start from a monthly " +
      "basic rate this employee does not have.",
    next:
      "A payroll reviewer checks the shift rate against the employment terms. Nothing on this " +
      "row was computed.",
    registerRow: 128,
    lines: [
      ["shiftsPaid", "Shifts paid", "1080.00"],
      ["cpfEmployee", "CPF employee share", "-216.00"],
    ],
    net: "864.00",
  },
];

function notCheckedEmployee(spec: NotCheckedSpec): ConceptEmployee {
  const source = regSep(spec.registerRow);
  return {
    employee_id: spec.id,
    name: spec.name,
    role: spec.role,
    location: spec.location,
    department: spec.department,
    employment_status: "ACTIVE",
    start_date: "2024-04-01",
    end_date: null,
    basic_salary: null,
    preflight_status: "NOT_CHECKED",
    event_counts: {},
    not_checked_reason: spec.reason,
    detail: {
      events: [],
      findings: [],
      current: register(
        "September 2026",
        source,
        spec.lines.map(([key, label, cents]) => line(key, label, stated(cents, source))),
        spec.net,
      ),
      previous: null,
    },
  };
}

/** What a reviewer does next with a row nothing was computed for. Keyed by
 * employee, because "not checked" without a next step is a dead end on a screen
 * rather than a hand-off to a person. */
export const NOT_CHECKED_NEXT: Record<string, string> = Object.fromEntries(
  NOT_CHECKED_SPECS.map((s) => [s.id, s.next]),
);

/* ========================================================================= */
/* The cast                                                                  */
/* ========================================================================= */

export const DETAILED_EMPLOYEES: ConceptEmployee[] = [
  {
    employee_id: "EMP-0007",
    name: "Hui Ling Tan",
    role: "Shift Supervisor",
    location: "Harbour Point",
    department: "Restaurant Operations",
    employment_status: "ACTIVE",
    start_date: "2021-06-14",
    end_date: null,
    basic_salary: stated("2600.00", hr(7)),
    preflight_status: "MATCHED",
    event_counts: { OVERTIME: 2, REST_DAY_WORK: 1 },
    not_checked_reason: null,
    detail: {
      events: HUILING_EVENTS,
      findings: [],
      current: HUILING_SEP,
      previous: HUILING_AUG,
    },
  },
  {
    employee_id: "EMP-0012",
    name: "Cheryl Lim",
    role: "Shift Supervisor",
    location: "Harbour Point",
    department: "Restaurant Operations",
    employment_status: "ACTIVE",
    start_date: "2020-02-03",
    end_date: null,
    basic_salary: stated("2750.00", hr(12)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { NO_PAY_LEAVE: 1 },
    not_checked_reason: null,
    detail: { events: CHERYL_EVENTS, findings: [FND_07], current: CHERYL_SEP, previous: null },
  },
  {
    employee_id: "EMP-0044",
    name: "Muhammad Hafiz bin Ismail",
    role: "Facilities Technician",
    location: "Eastpoint Depot",
    department: "Facilities",
    employment_status: "LEFT",
    start_date: "2022-09-05",
    end_date: "2026-08-31",
    basic_salary: stated("2800.00", hr(44)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { LEAVER: 1 },
    not_checked_reason: null,
    detail: { events: HAFIZ_EVENTS, findings: [FND_08], current: HAFIZ_SEP, previous: null },
  },
  {
    employee_id: "EMP-0058",
    name: "Jonathan Goh",
    role: "Banquet Server",
    location: "Harbour Point",
    department: "Events",
    employment_status: "ACTIVE",
    start_date: "2023-11-20",
    end_date: null,
    basic_salary: stated("2200.00", hr(58)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { REST_DAY_WORK: 1 },
    not_checked_reason: null,
    detail: {
      events: JONATHAN_EVENTS,
      findings: [FND_04],
      current: JONATHAN_SEP,
      previous: null,
    },
  },
  {
    employee_id: "EMP-0083",
    name: "Ahmad bin Rahman",
    role: "Facilities Technician",
    location: "Eastpoint Depot",
    department: "Facilities",
    employment_status: "ACTIVE",
    start_date: "2019-08-12",
    end_date: null,
    basic_salary: stated("2800.00", hr(83)),
    preflight_status: "MATCHED",
    event_counts: { OVERTIME: 5 },
    not_checked_reason: null,
    detail: { events: AHMAD_EVENTS, findings: [], current: AHMAD_SEP, previous: null },
  },
  {
    employee_id: "EMP-0089",
    name: "Kumar s/o Rajan",
    role: "Kitchen Crew",
    location: "Bayfront Kitchen",
    department: "Restaurant Operations",
    employment_status: "ACTIVE",
    start_date: "2024-01-08",
    end_date: null,
    basic_salary: stated("2000.00", hr(89)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { PAID_SICK_LEAVE: 1 },
    not_checked_reason: null,
    detail: { events: KUMAR_EVENTS, findings: [FND_06], current: KUMAR_SEP, previous: null },
  },
  {
    employee_id: "EMP-0127",
    name: "Mei Ling Tan",
    role: "Service Crew",
    location: "Harbour Point",
    department: "Restaurant Operations",
    employment_status: "ACTIVE",
    start_date: "2023-03-06",
    end_date: null,
    basic_salary: stated("2100.00", hr(127)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: {
      OVERTIME: 4,
      REST_DAY_WORK: 1,
      PAID_SICK_LEAVE: 1,
      NO_PAY_LEAVE: 1,
      ALLOWANCE_CHANGE: 1,
    },
    not_checked_reason: null,
    detail: {
      events: MEILING_EVENTS,
      findings: [FND_01],
      current: MEILING_SEP,
      previous: MEILING_AUG,
    },
  },
  {
    employee_id: "EMP-0166",
    name: "Nurul Aisyah binte Yusof",
    role: "Service Crew",
    location: "Northgate Cafe",
    department: "Restaurant Operations",
    employment_status: "ACTIVE",
    start_date: "2025-05-19",
    end_date: null,
    basic_salary: stated("1850.00", hr(166)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { NO_PAY_LEAVE: 1 },
    not_checked_reason: null,
    detail: { events: NURUL_EVENTS, findings: [FND_05], current: NURUL_SEP, previous: null },
  },
  {
    employee_id: "EMP-0173",
    name: "Boon Keng Teo",
    role: "Facilities Supervisor",
    location: "Eastpoint Depot",
    department: "Facilities",
    employment_status: "ACTIVE",
    start_date: "2016-10-03",
    end_date: null,
    basic_salary: stated("4200.00", hr(173)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { CPF_STATUS: 1, ALLOWANCE_CHANGE: 1 },
    not_checked_reason: null,
    detail: {
      events: BOONKENG_EVENTS,
      findings: [FND_10],
      current: BOONKENG_SEP,
      previous: BOONKENG_AUG,
    },
  },
  {
    employee_id: "EMP-0203",
    name: "Siti Rahmah binte Osman",
    role: "Kitchen Crew",
    location: "Bayfront Kitchen",
    department: "Restaurant Operations",
    employment_status: "ACTIVE",
    start_date: "2022-07-11",
    end_date: null,
    basic_salary: stated("1900.00", hr(203)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { OVERTIME: 6 },
    not_checked_reason: null,
    detail: { events: SITI_EVENTS, findings: [FND_02], current: SITI_SEP, previous: SITI_AUG },
  },
  {
    employee_id: "EMP-0231",
    name: "Grace Fernandez",
    role: "Area Manager",
    location: "Head Office",
    department: "Operations",
    employment_status: "ACTIVE",
    start_date: "2018-01-15",
    end_date: null,
    basic_salary: stated("9400.00", hr(231)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { SALARY_CHANGE: 1 },
    not_checked_reason: null,
    detail: { events: GRACE_EVENTS, findings: [FND_11], current: GRACE_SEP, previous: null },
  },
  {
    employee_id: "EMP-0241",
    name: "Ravi s/o Muthu",
    role: "Facilities Technician",
    location: "Eastpoint Depot",
    department: "Facilities",
    employment_status: "ACTIVE",
    start_date: "2021-02-22",
    end_date: null,
    basic_salary: stated("2400.00", hr(241)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { OVERTIME: 9 },
    not_checked_reason: null,
    detail: { events: RAVI_EVENTS, findings: [FND_03], current: RAVI_SEP, previous: null },
  },
  {
    employee_id: "EMP-0298",
    name: "Priya d/o Krishnan",
    role: "Service Crew",
    location: "Northgate Cafe",
    department: "Restaurant Operations",
    employment_status: "JOINED_THIS_MONTH",
    start_date: "2026-09-22",
    end_date: null,
    basic_salary: stated("1800.00", hr(298)),
    preflight_status: "NEEDS_REVIEW",
    event_counts: { JOINER: 1 },
    not_checked_reason: null,
    detail: { events: PRIYA_EVENTS, findings: [FND_09], current: PRIYA_SEP, previous: null },
  },
  ...NOT_CHECKED_SPECS.map(notCheckedEmployee),
];

/** The employee the demo controls jump to, and the one the talk track opens. */
export const HERO_EMPLOYEE_ID = "EMP-0127";

/** The rest-day finding that the recheck resolves, kept by name because two
 * screens refer to it. */
export { FND_01 };
