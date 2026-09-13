/**
 * Everything the screens read. Nothing the screens decide.
 *
 * THE RULE THIS FILE EXISTS TO KEEP. A count on a screen is a count OF
 * something, and the only way to be sure of that is to count it here rather
 * than to write the number down somewhere and render it. So the workforce
 * strip, the preflight totals, the by-source preview and the recheck summary
 * are all derived from the fixture, and invariants.ts asserts the identities
 * that have to hold between them.
 *
 * WHAT IS ALLOWED TO BE ARITHMETIC. Adding up amounts the fixture states, and
 * subtracting one register line from another. Both are aggregation over stated
 * figures and both go through decimal.ts, which is exact. What is NOT allowed
 * anywhere on this side of the wire is producing a rule result: every figure
 * with a rule behind it came from the engines and lives in ruleDerived.ts.
 *
 * MONEY IS NEVER NETTED ACROSS DIRECTIONS. A register that is $155.50 below the
 * published rules on two rows and $644.00 above them on two others is not a
 * $488.50 problem, and a single signed total would say it was. The two
 * directions are reported separately and the count of findings carrying no
 * amount at all is reported beside them, because that number is the one a
 * summary usually loses.
 */

import type { Money } from "@/lib/api";
import { magnitude, sameToTheCent, signOf, subtract, sum, ZERO } from "./decimal";
import type {
  ConceptAmount,
  ConceptEmployee,
  ConceptEvent,
  ConceptFinding,
  ConceptScenario,
  EventType,
  FindingSource,
  PreflightStatus,
  RecheckConcept,
  RecheckRowState,
  Register,
  RegisterLine,
  SourceSystem,
} from "./types";
import { EVENT_TYPES, FINDING_SOURCES } from "./types";

/* ------------------------------------------------------------ vocabulary */

/** Which export a kind of change is recorded in. One mapping, so the strip and
 * the inputs panel cannot disagree about where something came from. */
export const EVENT_SOURCE: Record<EventType, SourceSystem> = {
  OVERTIME: "ATTENDANCE",
  REST_DAY_WORK: "ATTENDANCE",
  SHIFT_CHANGE: "ATTENDANCE",
  PAID_SICK_LEAVE: "LEAVE",
  NO_PAY_LEAVE: "LEAVE",
  JOINER: "HR_MASTER",
  LEAVER: "HR_MASTER",
  SALARY_CHANGE: "HR_MASTER",
  ALLOWANCE_CHANGE: "HR_MASTER",
  CPF_STATUS: "HR_MASTER",
};

export const EVENT_LABEL: Record<EventType, string> = {
  OVERTIME: "Overtime",
  REST_DAY_WORK: "Rest-day work",
  PAID_SICK_LEAVE: "Paid sick leave",
  NO_PAY_LEAVE: "No-pay leave",
  JOINER: "Joiner",
  LEAVER: "Leaver",
  SALARY_CHANGE: "Salary change",
  ALLOWANCE_CHANGE: "Allowance change",
  CPF_STATUS: "CPF status",
  SHIFT_CHANGE: "Shift change",
};

/** A short tag for a dense row. Four characters at most, so a list of eighteen
 * of them still reads as a column rather than as prose. */
export const EVENT_TAG: Record<EventType, string> = {
  OVERTIME: "OT",
  REST_DAY_WORK: "REST",
  PAID_SICK_LEAVE: "MC",
  NO_PAY_LEAVE: "NPL",
  JOINER: "JOIN",
  LEAVER: "LEFT",
  SALARY_CHANGE: "PAY",
  ALLOWANCE_CHANGE: "ALLW",
  CPF_STATUS: "CPF",
  SHIFT_CHANGE: "SHFT",
};

export const SOURCE_LABEL: Record<SourceSystem, string> = {
  PAYROLL_REGISTER: "Payroll system",
  ATTENDANCE: "Attendance system",
  LEAVE: "Leave system",
  HR_MASTER: "HR employee master",
  CPF_SUBMISSION: "CPF submission",
};

export const FINDING_SOURCE_LABEL: Record<FindingSource, string> = {
  ATTENDANCE: "Attendance",
  LEAVE: "Leave",
  EMPLOYMENT_STATUS: "Employment status",
  PAYROLL_CONFIGURATION: "Payroll configuration",
};

export const STATUS_WORD: Record<PreflightStatus, string> = {
  MATCHED: "Matched",
  NEEDS_REVIEW: "Needs review",
  NOT_CHECKED: "Not checked",
};

export const RECHECK_WORD: Record<RecheckRowState, string> = {
  STILL_MATCHED: "Still matched",
  RESOLVED: "Resolved",
  STILL_EXCEPTION: "Still different",
  NEW_EXCEPTION: "New finding",
  STILL_REFUSED: "Still not checked",
};

/* ---------------------------------------------------------------- status */

/**
 * One event's status.
 *
 * A FINDING IS THE DEFINITION OF NEEDS REVIEW, so it is read first. The two
 * axes below it settle the rest: an amount nobody checked is NOT CHECKED even
 * when the record reached payroll perfectly, because reaching payroll and being
 * the right figure are two claims and only one of them was made.
 *
 * invariants.ts asserts the other direction - that an event whose record is
 * absent from payroll, or whose amount differs, always carries a finding - so
 * the first line here is not hiding a case the last line would get wrong.
 */
export function eventStatus(event: ConceptEvent): PreflightStatus {
  if (event.finding_id) return "NEEDS_REVIEW";
  if (event.amount_check === "NOT_CHECKED" || event.reached_payroll === "NOT_ESTABLISHED") {
    return "NOT_CHECKED";
  }
  return "MATCHED";
}

export type StatusCounts = {
  total: number;
  matched: number;
  needsReview: number;
  notChecked: number;
  /** Rows a check was actually run on. The headline figure is a claim about
   * these and about no others. */
  checked: number;
};

export function statusCounts(employees: readonly ConceptEmployee[]): StatusCounts {
  let matched = 0;
  let needsReview = 0;
  let notChecked = 0;
  for (const e of employees) {
    if (e.preflight_status === "MATCHED") matched += 1;
    else if (e.preflight_status === "NEEDS_REVIEW") needsReview += 1;
    else notChecked += 1;
  }
  return {
    total: employees.length,
    matched,
    needsReview,
    notChecked,
    checked: matched + needsReview,
  };
}

/* ------------------------------------------------------ workforce changes */

export type ChangeCount = { type: EventType; count: number };

export type ChangeGroup = {
  system: SourceSystem;
  label: string;
  total: number;
  kinds: ChangeCount[];
};

/** Every recorded change in the month, counted, grouped by the export it came
 * from. The strip at the top of the overview draws exactly this. */
export function workforceChanges(employees: readonly ConceptEmployee[]): {
  total: number;
  byType: Record<EventType, number>;
  groups: ChangeGroup[];
} {
  const byType = {} as Record<EventType, number>;
  for (const t of EVENT_TYPES) byType[t] = 0;
  for (const e of employees) {
    for (const t of EVENT_TYPES) byType[t] += e.event_counts[t] ?? 0;
  }

  const systems: SourceSystem[] = ["ATTENDANCE", "LEAVE", "HR_MASTER"];
  const groups = systems.map((system) => {
    const kinds = EVENT_TYPES.filter((t) => EVENT_SOURCE[t] === system && byType[t] > 0).map(
      (type) => ({ type, count: byType[type] }),
    );
    return {
      system,
      label: SOURCE_LABEL[system],
      total: kinds.reduce((n, k) => n + k.count, 0),
      kinds,
    };
  });

  return {
    total: EVENT_TYPES.reduce((n, t) => n + byType[t], 0),
    byType,
    groups,
  };
}

/* -------------------------------------------------------------- findings */

export function allFindings(employees: readonly ConceptEmployee[]): ConceptFinding[] {
  return employees.flatMap((e) => e.detail?.findings ?? []);
}

export function findingsBySource(
  findings: readonly ConceptFinding[],
): { source: FindingSource; label: string; count: number }[] {
  return FINDING_SOURCES.map((source) => ({
    source,
    label: FINDING_SOURCE_LABEL[source],
    count: findings.filter((f) => f.source === source).length,
  })).filter((row) => row.count > 0);
}

export type MoneyUnderReview = {
  /** Findings where the register states less than the published rules give. */
  below: Money;
  belowCount: number;
  /** Findings where it states more. Reported as a magnitude and never
   * subtracted from the other direction. */
  above: Money;
  aboveCount: number;
  /** Findings that are real and carry no amount, because no rule pack covers
   * the figure or no fact settles which rule applies. NEVER counted as zero. */
  withoutComputedDifference: number;
};

export function moneyUnderReview(findings: readonly ConceptFinding[]): MoneyUnderReview {
  const below: Money[] = [];
  const above: Money[] = [];
  let withoutComputedDifference = 0;
  for (const f of findings) {
    if (!f.difference) {
      withoutComputedDifference += 1;
      continue;
    }
    // `difference` is the published rule less what the register states, so a
    // positive figure is a register below the rule. The sign is read from the
    // exact value, not the cents, so a sub-cent residue is not called zero.
    if (signOf(f.difference.money) >= 0) below.push(f.difference.money);
    else above.push(f.difference.money);
  }
  return {
    below: below.length ? sum(below) : ZERO,
    belowCount: below.length,
    above: above.length ? magnitude(sum(above)) : ZERO,
    aboveCount: above.length,
    withoutComputedDifference,
  };
}

/* --------------------------------------------------------------- lookups */

export function employeeById(
  employees: readonly ConceptEmployee[],
  id: string | null,
): ConceptEmployee | null {
  if (!id) return null;
  return employees.find((e) => e.employee_id === id) ?? null;
}

export function eventById(
  employee: ConceptEmployee | null,
  id: string | null,
): ConceptEvent | null {
  if (!employee || !id) return null;
  return employee.detail?.events.find((e) => e.event_id === id) ?? null;
}

/** The employees with something to review or nothing computed, in file order.
 * The strip under the grid lists exactly these. */
export function needsAttention(employees: readonly ConceptEmployee[]): ConceptEmployee[] {
  return employees.filter((e) => e.preflight_status !== "MATCHED");
}

/* ------------------------------------------------------- what changed */

export type BridgePresence = "BOTH" | "CURRENT_ONLY" | "PREVIOUS_ONLY";

/**
 * What comparing a register line with the published rule came to.
 *
 * NOT THE SAME QUESTION AS "IS THERE A RULE FOR THIS LINE". The first version of
 * the month-to-month view drew a filled disc - which means MATCHED everywhere
 * else in this product - against any line that happened to have a rule figure
 * beside it, including the rest-day line whose register figure is half what the
 * rule gives. A reader scanning that column would have read the one line that
 * does not reconcile as the one that does.
 *
 * MAGNITUDES, NOT SIGNED VALUES. A register shows a CPF contribution as a
 * deduction and CPF Board states it as a contribution, so the two differ by a
 * sign and agree about the money. `ruleNote` on the line says which is which;
 * this compares what they are both about.
 */
export type RuleComparison = "AGREES" | "DIFFERS" | "NOT_CHECKED";

export type BridgeLine = {
  key: string;
  label: string;
  previous: ConceptAmount | null;
  current: ConceptAmount | null;
  /** current less previous, exactly. Both sides are cent figures a payroll
   * system stated, so this is subtraction over a register rather than a rule. */
  delta: Money;
  presence: BridgePresence;
  event_ids: string[];
  ruleFigure: ConceptAmount | null;
  ruleNote: string | null;
  /** Derived here, never declared by the fixture. */
  ruleComparison: RuleComparison;
};

export type Bridge = {
  previous: Register;
  current: Register;
  /** The change in the register's own bottom line. */
  difference: Money;
  lines: BridgeLine[];
  /** How many lines answer to a recorded workforce change, and how many do not.
   * The second number is not a fault: a basic-salary line answers to nothing. */
  linkedToEvents: number;
  notLinkedToEvents: number;
  /** How many lines carry a published-rule figure, and how many do not. */
  checkedAgainstARule: number;
  notCheckedAgainstARule: number;
};

/**
 * One month against the one before it, line by line.
 *
 * THE LINES SUM TO THE CHANGE IN NET, EXACTLY, and invariants.ts asserts it.
 * That is the whole claim this view makes: not that FairSlip knows why the pay
 * moved, but that every dollar of the movement is attributable to a line of the
 * register, and that some of those lines have a published rule behind them and
 * some do not.
 *
 * A LINE PRESENT IN ONLY ONE MONTH IS NOT A GAP. An allowance that stopped is a
 * line August carries and September does not, and its delta is the whole of the
 * August figure with the sign turned round. `presence` says which case a row is
 * so the screen can name it rather than showing a bare zero on one side.
 */
export function bridgeFor(employee: ConceptEmployee): Bridge | null {
  const detail = employee.detail;
  if (!detail || !detail.previous) return null;
  const previous = detail.previous;
  const current = detail.current;

  const keys: string[] = [];
  for (const l of previous.lines) if (!keys.includes(l.key)) keys.push(l.key);
  for (const l of current.lines) if (!keys.includes(l.key)) keys.push(l.key);

  const lines: BridgeLine[] = keys.map((key) => {
    const p = previous.lines.find((l) => l.key === key) ?? null;
    const c = current.lines.find((l) => l.key === key) ?? null;
    const presence: BridgePresence = p && c ? "BOTH" : c ? "CURRENT_ONLY" : "PREVIOUS_ONLY";
    const delta = subtract(c ? c.amount.money : ZERO, p ? p.amount.money : ZERO);
    return {
      key,
      label: (c ?? p)?.label ?? key,
      previous: p ? p.amount : null,
      current: c ? c.amount : null,
      delta,
      presence,
      event_ids: c ? c.event_ids : (p?.event_ids ?? []),
      ruleFigure: c ? c.ruleFigure : null,
      ruleNote: c ? c.ruleNote : null,
      ruleComparison: compareWithRule(c),
    };
  });

  return {
    previous,
    current,
    difference: subtract(current.net.money, previous.net.money),
    lines,
    linkedToEvents: lines.filter((l) => l.event_ids.length > 0).length,
    notLinkedToEvents: lines.filter((l) => l.event_ids.length === 0).length,
    checkedAgainstARule: lines.filter((l) => l.ruleComparison !== "NOT_CHECKED").length,
    notCheckedAgainstARule: lines.filter((l) => l.ruleComparison === "NOT_CHECKED").length,
  };
}

function compareWithRule(line: RegisterLine | null): RuleComparison {
  if (!line || !line.ruleFigure) return "NOT_CHECKED";
  return sameToTheCent(magnitude(line.amount.money), magnitude(line.ruleFigure.money))
    ? "AGREES"
    : "DIFFERS";
}

/** The exact sum of a register's lines. Used by invariants.ts to prove the
 * register adds up before anything is built on top of it. */
export function registerLineTotal(register: Register): Money {
  return sum(register.lines.map((l) => l.amount.money));
}

/* --------------------------------------------------------------- recheck */

export type RecheckCounts = {
  byState: Record<RecheckRowState, number>;
  total: number;
  /** What the second run leaves. Derived from the rows, never written down. */
  afterMatched: number;
  afterNeedsReview: number;
  afterNotChecked: number;
};

export function recheckCounts(recheck: RecheckConcept): RecheckCounts {
  const byState = {
    STILL_MATCHED: recheck.still_matched,
    RESOLVED: 0,
    STILL_EXCEPTION: 0,
    NEW_EXCEPTION: 0,
    STILL_REFUSED: 0,
  } as Record<RecheckRowState, number>;
  for (const row of recheck.rows) byState[row.state] += 1;

  return {
    byState,
    total: Object.values(byState).reduce((n, v) => n + v, 0),
    afterMatched: byState.STILL_MATCHED + byState.RESOLVED,
    afterNeedsReview: byState.STILL_EXCEPTION + byState.NEW_EXCEPTION,
    afterNotChecked: byState.STILL_REFUSED,
  };
}

/** The rows the recheck screen leads with: everything that moved, plus
 * everything that stayed uncheckable. STILL_MATCHED rows are counted and not
 * listed, which is the only summary in this product that is allowed to stand
 * for rows it does not draw - because nothing about them changed. */
export function recheckRowsToShow(recheck: RecheckConcept) {
  const order: RecheckRowState[] = [
    "NEW_EXCEPTION",
    "STILL_EXCEPTION",
    "RESOLVED",
    "STILL_REFUSED",
  ];
  return order.flatMap((state) => recheck.rows.filter((r) => r.state === state));
}

/* --------------------------------------------------------------- scenario */

export type Overview = {
  status: StatusCounts;
  changes: ReturnType<typeof workforceChanges>;
  findings: ConceptFinding[];
  bySource: ReturnType<typeof findingsBySource>;
  money: MoneyUnderReview;
};

export function overviewOf(scenario: ConceptScenario): Overview {
  const findings = allFindings(scenario.employees);
  return {
    status: statusCounts(scenario.employees),
    changes: workforceChanges(scenario.employees),
    findings,
    bySource: findingsBySource(findings),
    money: moneyUnderReview(findings),
  };
}
