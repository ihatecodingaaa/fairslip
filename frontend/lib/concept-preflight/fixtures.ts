/**
 * The fictional company, its month, and the three hundred people in it.
 *
 * DETERMINISTIC. Same seed, same three hundred rows, every render, on the
 * server and in the browser. Nothing here reads the clock, calls Math.random,
 * or fetches anything, which is what makes the counts on the overview a fact
 * about this file rather than a number that happened to come up. It is also
 * what stops the server and the client disagreeing about what to draw.
 *
 * THE COUNTS ON THE SCREEN ARE COUNTED, NOT WRITTEN DOWN. The workforce-change
 * strip, the preflight totals and the by-source preview are all computed from
 * this data by selectors.ts. The targets below are how many of each the
 * generator DEALS OUT; invariants.ts then re-counts what actually exists and
 * asserts the two agree, so a strip that says 76 overtime records is a strip
 * standing over 76 overtime records.
 *
 * FICTIONAL, AND SAID SO ON EVERY SCREEN. No real company, employee or
 * identifier appears. Harbour and Hearth Group does not exist.
 */

import type {
  ConceptEmployee,
  ConceptScenario,
  Company,
  EventType,
  InputFile,
  PayPeriod,
  RecheckConcept,
  ScenarioId,
} from "./types";
import { ruleAmount } from "./ruleDerived";
import { DETAILED_EMPLOYEES, FILES, FND_01 } from "./people";
import { REST_DAY_TABLE } from "./ruleSources";

export const COMPANY: Company = {
  name: "Harbour and Hearth Group Pte. Ltd.",
  what:
    "A fictional Singapore operator of seven restaurant, cafe and facilities sites, with a " +
    "shift workforce of 300 paid monthly.",
  headcount: 300,
  locations: [
    "Harbour Point",
    "Bayfront Kitchen",
    "Northgate Cafe",
    "Westlink Cafe",
    "Eastpoint Depot",
    "Westlink Depot",
    "Head Office",
  ],
};

/**
 * The month, and the day the concept is being run on.
 *
 * A FIXED DATE, NOT TODAY'S. "Payroll closes tomorrow" has to be true of the
 * screen a year from now, and a prototype that quietly re-dates itself against
 * the machine's clock is a prototype whose screenshots stop matching it.
 */
export const SEPTEMBER: PayPeriod = {
  label: "September 2026",
  today: "24 September 2026",
  closes: "25 September 2026",
  payday: "30 September 2026",
};

const OCTOBER: PayPeriod = {
  label: "October 2026",
  today: "26 October 2026",
  closes: "27 October 2026",
  payday: "31 October 2026",
};

/**
 * What was loaded, and how.
 *
 * EXPORTS, NOT CONNECTIONS. Every row below is a file somebody exported and
 * dropped in. There is no integration here, no credential, no webhook and no
 * vendor named, and the screen says "demo export" rather than "connected" for
 * exactly that reason. A pilot would start this way too: exports are what a
 * payroll team can produce on the first call, and an API is a thing to earn
 * later if the workflow turns out to be worth anything.
 */
const SEPTEMBER_INPUTS: InputFile[] = [
  {
    system: "PAYROLL_REGISTER",
    label: "Payroll register",
    file: FILES.registerSep,
    rows: 300,
    provides: "What the payroll system calculated for September, line by line.",
  },
  {
    system: "PAYROLL_REGISTER",
    label: "Prior payroll register",
    file: FILES.registerAug,
    rows: 292,
    provides: "August, for the month-to-month comparison. Optional.",
  },
  {
    system: "ATTENDANCE",
    label: "Attendance and roster",
    file: FILES.attendance,
    rows: 6918,
    provides: "Shifts, overtime hours and rest-day work, one row per record.",
  },
  {
    system: "LEAVE",
    label: "Leave records",
    file: FILES.leave,
    rows: 43,
    provides: "Approved leave for the month, including medical certificates.",
  },
  {
    system: "HR_MASTER",
    label: "Employee master",
    file: FILES.master,
    rows: 300,
    provides: "Salary, working week, start and end dates, contribution status.",
  },
  {
    system: "CPF_SUBMISSION",
    label: "CPF submission draft",
    file: FILES.submission,
    rows: 271,
    provides:
      "The contribution file prepared for this month. 29 of the workforce are not CPF " +
      "members and correctly have no row in it.",
  },
];

const OCTOBER_INPUTS: InputFile[] = SEPTEMBER_INPUTS.map((f) => ({
  ...f,
  file: f.file.replace("2026-09", "2026-10").replace("2026-08", "2026-09"),
}));

/* ------------------------------------------------------- the rest of the 300 */

/** How many of each recorded change exist across the whole workforce. The
 * generator deals out whatever the twenty detailed employees do not already
 * hold, so these are the numbers the strip ends up counting. */
const SEPTEMBER_EVENT_TARGET: Record<EventType, number> = {
  OVERTIME: 76,
  REST_DAY_WORK: 11,
  PAID_SICK_LEAVE: 18,
  NO_PAY_LEAVE: 25,
  JOINER: 8,
  LEAVER: 4,
  SALARY_CHANGE: 3,
  ALLOWANCE_CHANGE: 6,
  CPF_STATUS: 5,
  SHIFT_CHANGE: 9,
};

const OCTOBER_EVENT_TARGET: Record<EventType, number> = {
  OVERTIME: 81,
  REST_DAY_WORK: 9,
  PAID_SICK_LEAVE: 14,
  NO_PAY_LEAVE: 19,
  JOINER: 5,
  LEAVER: 6,
  SALARY_CHANGE: 2,
  ALLOWANCE_CHANGE: 3,
  CPF_STATUS: 4,
  SHIFT_CHANGE: 12,
};

/* Name pools. The same shape as backend/demo/employer_roster.py's, and
   duplicated rather than shared because they are on opposite sides of a wire.
   Any resemblance to a real person is the arithmetic of a small pool. */
const FAMILY = [
  "Tan", "Lim", "Lee", "Ng", "Ong", "Wong", "Goh", "Chua", "Chan", "Koh",
  "Teo", "Ang", "Yeo", "Low", "Toh", "Sim", "Chong", "Foo", "Heng", "Neo",
  "bin Ismail", "bin Rahman", "binte Osman", "binte Yusof", "bin Hassan",
  "s/o Muthu", "d/o Krishnan", "s/o Rajan", "d/o Selvam", "s/o Pillai",
  "Fernandez", "Pereira", "de Souza", "Rozario",
];
const GIVEN = [
  "Wei Ming", "Hui Ling", "Jia Hui", "Zhi Hao", "Mei Ling", "Kai Xin",
  "Yi Ting", "Jun Jie", "Xin Yi", "Wen Xuan", "Siew Kim", "Boon Keng",
  "Nurul", "Siti", "Muhammad", "Ahmad", "Farhan", "Aisyah", "Hafiz", "Nadia",
  "Kumar", "Priya", "Ravi", "Devi", "Anand", "Lakshmi", "Suresh", "Kavitha",
  "Marcus", "Priscilla", "Bernard", "Cheryl", "Jonathan", "Grace",
];

const SITES: { location: string; department: string; roles: string[] }[] = [
  {
    location: "Harbour Point",
    department: "Restaurant Operations",
    roles: ["Service Crew", "Shift Supervisor", "Bartender", "Host"],
  },
  {
    location: "Bayfront Kitchen",
    department: "Restaurant Operations",
    roles: ["Kitchen Crew", "Commis Chef", "Sous Chef", "Steward"],
  },
  {
    location: "Northgate Cafe",
    department: "Restaurant Operations",
    roles: ["Service Crew", "Barista", "Shift Supervisor"],
  },
  {
    location: "Westlink Cafe",
    department: "Restaurant Operations",
    roles: ["Service Crew", "Barista", "Kitchen Crew"],
  },
  {
    location: "Eastpoint Depot",
    department: "Facilities",
    roles: ["Facilities Technician", "Facilities Supervisor", "Driver"],
  },
  {
    location: "Westlink Depot",
    department: "Facilities",
    roles: ["Facilities Technician", "Cleaner", "Driver"],
  },
  {
    location: "Head Office",
    department: "Operations",
    roles: ["Area Manager", "Payroll Officer", "Rostering Officer"],
  },
];

/**
 * A small deterministic generator, so the file is the same one every time.
 *
 * mulberry32: thirty-two bits of state, no dependency, and the same sequence in
 * every JavaScript engine. It decides names and sites and who holds which
 * recorded change. It decides nothing about money: no amount anywhere in this
 * concept comes out of a random number.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260924;

function pad(n: number): string {
  return `EMP-${String(n).padStart(4, "0")}`;
}

/**
 * The employees the prototype records no detail for.
 *
 * They are REAL ROWS OF THE FILE with a status and a count of recorded changes,
 * and they are not pretending to be more than that. The inspector says what is
 * and is not here when one of them is opened.
 */
function generateRemainder(
  taken: Set<string>,
  target: Record<EventType, number>,
  detailedCounts: Record<EventType, number>,
  seed: number,
): ConceptEmployee[] {
  const rng = mulberry32(seed);
  const ids: string[] = [];
  for (let n = 1; n <= COMPANY.headcount; n += 1) {
    const id = pad(n);
    if (!taken.has(id)) ids.push(id);
  }

  const people: ConceptEmployee[] = ids.map((id) => {
    const site = SITES[Math.floor(rng() * SITES.length)];
    const name = `${GIVEN[Math.floor(rng() * GIVEN.length)]} ${
      FAMILY[Math.floor(rng() * FAMILY.length)]
    }`;
    const year = 2015 + Math.floor(rng() * 11);
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);
    return {
      employee_id: id,
      name,
      role: site.roles[Math.floor(rng() * site.roles.length)],
      location: site.location,
      department: site.department,
      employment_status: "ACTIVE",
      start_date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      end_date: null,
      basic_salary: null,
      preflight_status: "MATCHED",
      event_counts: {},
      not_checked_reason: null,
      detail: null,
    };
  });

  /* A joiner is an employee whose start date is inside the month, and a leaver
     one whose last day is. The EVENT and the EMPLOYMENT STATUS have to be the
     same fact or the timeline and the header contradict each other, so both are
     set here together rather than dealt out separately. */
  let cursor = 0;
  const joiners = Math.max(0, target.JOINER - detailedCounts.JOINER);
  for (let i = 0; i < joiners; i += 1, cursor += 1) {
    const p = people[cursor];
    p.employment_status = "JOINED_THIS_MONTH";
    p.start_date = "2026-09-08";
    p.event_counts.JOINER = 1;
  }
  const leavers = Math.max(0, target.LEAVER - detailedCounts.LEAVER);
  for (let i = 0; i < leavers; i += 1, cursor += 1) {
    const p = people[cursor];
    p.employment_status = "LEFT";
    p.end_date = "2026-09-30";
    p.event_counts.LEAVER = 1;
  }

  /* Everything else is dealt out one record at a time, so the totals are exact
     by construction rather than by a rounding that happens to work. */
  for (const type of Object.keys(target) as EventType[]) {
    if (type === "JOINER" || type === "LEAVER") continue;
    const remaining = Math.max(0, target[type] - detailedCounts[type]);
    for (let i = 0; i < remaining; i += 1) {
      const p = people[Math.floor(rng() * people.length)];
      p.event_counts[type] = (p.event_counts[type] ?? 0) + 1;
    }
  }

  return people;
}

function countByType(employees: ConceptEmployee[]): Record<EventType, number> {
  const out = {} as Record<EventType, number>;
  for (const key of Object.keys(SEPTEMBER_EVENT_TARGET) as EventType[]) out[key] = 0;
  for (const e of employees) {
    for (const [type, n] of Object.entries(e.event_counts)) {
      out[type as EventType] += n ?? 0;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- scenarios */

const SEPTEMBER_EMPLOYEES: ConceptEmployee[] = (() => {
  const taken = new Set(DETAILED_EMPLOYEES.map((e) => e.employee_id));
  const remainder = generateRemainder(
    taken,
    SEPTEMBER_EVENT_TARGET,
    countByType(DETAILED_EMPLOYEES),
    SEED,
  );
  // File order, which is employee-id order. A mark's POSITION in the grid is a
  // fact about the file, so the two lists are merged and sorted rather than
  // concatenated with the interesting people at one end.
  return [...DETAILED_EMPLOYEES, ...remainder].sort((a, b) =>
    a.employee_id.localeCompare(b.employee_id),
  );
})();

const OCTOBER_EMPLOYEES: ConceptEmployee[] = (() => {
  const empty = {} as Record<EventType, number>;
  for (const key of Object.keys(OCTOBER_EVENT_TARGET) as EventType[]) empty[key] = 0;
  return generateRemainder(new Set<string>(), OCTOBER_EVENT_TARGET, empty, SEED + 1).sort((a, b) =>
    a.employee_id.localeCompare(b.employee_id),
  );
})();

/**
 * The second run, after the payroll team works through the findings.
 *
 * THE VOCABULARY IS fairslip.employer.RecheckState's, and the two distinctions
 * it draws are the ones that carry this screen: a row that could not be checked
 * before and cannot be checked now is STILL_REFUSED and not STILL_MATCHED, and
 * a row whose finding was replaced by a different finding is STILL_EXCEPTION
 * rather than resolved.
 *
 * THE NEW FINDING IS THE POINT OF THE WHOLE SCREEN. Correcting one rest-day
 * shift meant changing a rate, and the rate reached a second shift that MOM's
 * table prices differently. Nobody would have gone looking for that.
 */
const SEPTEMBER_RECHECK: RecheckConcept = {
  before_label: "September register, as first prepared",
  after_label: "September register, after the payroll team's corrections",
  headline: "A correction created a new difference. The second run found that too.",
  still_matched: 281,
  rows: [
    {
      employee_id: "EMP-0127",
      state: "STILL_EXCEPTION",
      before: "Rest-day premium stated one day's salary where the rule gives two.",
      after:
        "The rest-day premium is corrected. The Ordinary Wage it sits in moved with it, and " +
        "the CPF submission is still priced on the old wage.",
      finding: {
        finding_id: "FND-R1",
        employee_id: "EMP-0127",
        event_ids: ["EVT-0127-05"],
        source: "PAYROLL_CONFIGURATION",
        headline: "The wage was corrected. The CPF on it was not.",
        detail:
          "CPF Board's page states that contributions are payable on overtime pay, and the " +
          "rest-day premium sits in the same Ordinary Wage. The corrected register gives " +
          "September Ordinary Wages of $2,211.40; the submission draft is still calculated " +
          "on $2,130.63.",
        expected: ruleAmount("meiling.cpf.recheck.total"),
        payroll: null,
        difference: ruleAmount("meiling.cpf.recheck.total"),
        no_difference_reason: null,
        rule: REST_DAY_TABLE,
        workings: [
          {
            label: "Employee share of the change",
            amount: ruleAmount("meiling.cpf.recheck.employee"),
          },
          {
            label: "Employer share of the change",
            amount: ruleAmount("meiling.cpf.recheck.employer"),
          },
        ],
        alternatives: [],
        split: {
          gross: ruleAmount("meiling.split.gross"),
          cash: ruleAmount("meiling.split.cash"),
          cpf: ruleAmount("meiling.split.cpf"),
          employerShare: ruleAmount("meiling.split.employerShare"),
          total: ruleAmount("meiling.split.total"),
          note:
            "The wage and the CPF overlap by the employee's own share, so they are never " +
            "added together. These five figures are what fairslip/cpf.py's shortfall_split " +
            "returns, and the only combination of them a screen may show.",
        },
        proposed_correction: null,
      },
    },
    {
      employee_id: "EMP-0058",
      state: "STILL_EXCEPTION",
      before: "The rest-day rate turns on who asked for the shift, and no export records it.",
      after: "Still unrecorded. The same two rule answers stand.",
      finding: null,
    },
    {
      employee_id: "EMP-0007",
      state: "NEW_EXCEPTION",
      before: "Matched. The rest-day premium was one day's salary, at the employee's request.",
      after:
        "The rate change that corrected EMP-0127 reached this shift as well, and MOM's table " +
        "prices a shift the employee asked for at one day, not two.",
      finding: {
        finding_id: "FND-R2",
        employee_id: "EMP-0007",
        event_ids: ["EVT-0007-03"],
        source: "ATTENDANCE",
        headline: "A corrected rate reached a shift the rule prices differently",
        detail:
          "The attendance row records this rest day as swapped at the employee's own request. " +
          "MOM's table gives one day's salary for that case. The corrected register states " +
          "two.",
        expected: ruleAmount("huiling.restday.expected"),
        payroll: null,
        difference: ruleAmount("huiling.restday.difference"),
        no_difference_reason: null,
        rule: REST_DAY_TABLE,
        workings: [],
        alternatives: [],
        split: null,
        proposed_correction: null,
      },
    },
    ...[
      ["EMP-0203", "Five recorded overtime hours were not on the register.", "The register now prices all 14.0 hours, and the rule total agrees."],
      ["EMP-0241", "78.0 overtime hours recorded against a published cap of 72.", "The attendance export was corrected: six hours were booked to the wrong employee. September records 72.0."],
      ["EMP-0166", "Three approved unpaid days, and no no-pay-leave line.", "The register now carries a no-pay-leave line. The amount on it is still outside what FairSlip checks."],
      ["EMP-0089", "A day approved as paid sick leave was deducted as unpaid absence.", "The register now pays the day. The amount is still outside what FairSlip checks."],
      ["EMP-0012", "A shift was worked inside three days recorded as no-pay leave.", "The leave record was withdrawn. The two exports now agree."],
      ["EMP-0044", "Employment ended in August; the CPF submission still listed a contribution.", "The row is no longer in the submission draft."],
      ["EMP-0298", "A start date of 22 September, and a full month of basic salary.", "The register now states nine days. The pro-rated amount is still outside what FairSlip checks."],
      ["EMP-0173", "September CPF priced at the under-55 rates.", "The submission uses the Above 55 to 60 band. The rule total and the submission agree at $1,428.00."],
      ["EMP-0231", "CPF calculated above the published Ordinary Wage ceiling.", "The ceiling is applied. The rule total and the submission agree at $2,960.00."],
    ].map(([employee_id, before, after]) => ({
      employee_id,
      state: "RESOLVED" as const,
      before,
      after,
      finding: null,
    })),
    ...[
      ["EMP-0061", "Additional Wages present."],
      ["EMP-0117", "Additional Wages present."],
      ["EMP-0255", "Additional Wages present."],
      ["EMP-0092", "Permanent Resident in the first year."],
      ["EMP-0209", "Permanent Resident in the second year."],
      ["EMP-0288", "Monthly wages at or below $750."],
      ["EMP-0140", "Paid by the shift rather than by the month."],
    ].map(([employee_id, why]) => ({
      employee_id,
      state: "STILL_REFUSED" as const,
      before: `Not checked. ${why}`,
      after: `Still not checked. ${why} Nothing was computed either time.`,
      finding: null,
    })),
  ],
};

export const SCENARIOS: Record<ScenarioId, ConceptScenario> = {
  "needs-review": {
    id: "needs-review",
    label: "Needs review",
    note: "A fictional September with eleven findings and seven rows nothing was computed for.",
    company: COMPANY,
    period: SEPTEMBER,
    inputs: SEPTEMBER_INPUTS,
    employees: SEPTEMBER_EMPLOYEES,
    recheck: SEPTEMBER_RECHECK,
  },
  "all-matched": {
    id: "all-matched",
    label: "All matched",
    note:
      "A second fictional month in which every recorded change reconciled. The prototype " +
      "records no per-employee detail behind it.",
    company: COMPANY,
    period: OCTOBER,
    inputs: OCTOBER_INPUTS,
    employees: OCTOBER_EMPLOYEES,
    recheck: null,
  },
};

export const SCENARIO_IDS: ScenarioId[] = ["needs-review", "all-matched"];

export { FND_01 };
