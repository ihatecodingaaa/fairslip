/**
 * What to look at first, decided by code and by nothing else.
 *
 * THE RULE THIS FILE EXISTS TO KEEP. A payroll operator opening this screen the
 * day before the money leaves has one question - which of these do I do first -
 * and the product answers it in a function rather than in a model. The order
 * below is total, deterministic and asserted by priority.test.ts; the Payroll
 * Copilot may read this list, quote from it and explain it, and it cannot
 * reorder it, add to it or leave anything out of it.
 *
 * That boundary is the whole reason the ranking lives here and not in a prompt.
 * A model that decided the order would be deciding which of three hundred
 * people gets looked at before payroll closes, on grounds nobody could inspect
 * afterwards. This can be read, argued with and changed in one place.
 *
 * THE ORDER, AND WHY EACH TIER SITS WHERE IT DOES:
 *
 *   1  A finding whose difference the engines COMPUTED, largest first.
 *      A figure two published rules disagree about by $518 is a bigger
 *      question than one they disagree about by $74, and the size is a fact
 *      rather than a judgement.
 *
 *   2  A finding about who was employed and when - a leaver still in the
 *      contribution file, a joiner paid a full month. No amount was computed
 *      for these and they still outrank tier 3, because the record itself is
 *      wrong rather than the arithmetic on it, and a wrong record keeps
 *      producing wrong months until somebody fixes it.
 *
 *   3  A finding with no computed difference. Real, unpriced, and the seven of
 *      them are the reason this product never reports a money total as the
 *      count of its problems.
 *
 *   4  A row nothing was computed for at all. Last, because there is no
 *      arithmetic to check - and present, because a queue that dropped them
 *      would be teaching the reader that absence means agreement.
 *
 *   MATCHED never appears. There is nothing to do.
 *
 * TIES BREAK ON EMPLOYEE ID, ASCENDING, in every tier. Sort stability differs
 * between engines for equal keys, and a queue that came out in a different
 * order on a different laptop would be a queue nobody could screenshot.
 */

import type { Money } from "@/lib/api";
import { compare, magnitude, signOf } from "./decimal";
import { EVENT_LABEL, EVENT_TAG } from "./selectors";
import type {
  ConceptEmployee,
  ConceptFinding,
  EventType,
  PreflightStatus,
} from "./types";

/* ------------------------------------------------------------------- tiers */

/** The four reasons a row is in the queue, in the order they are worked. */
export type PriorityTier = 1 | 2 | 3 | 4;

export const TIER_LABEL: Record<PriorityTier, string> = {
  1: "Known difference",
  2: "Employment record",
  3: "No amount computed",
  4: "Not checked",
};

/**
 * Which finding sources are about WHO WAS EMPLOYED rather than about a figure.
 *
 * Derived from the finding's own `source`, which the fixture sets from the
 * system the finding is about. Nothing here inspects a headline for words.
 */
const LIFECYCLE_SOURCES = new Set(["EMPLOYMENT_STATUS"]);

/* ------------------------------------------------------------------- items */

/**
 * One row of the queue.
 *
 * IT CARRIES THE FINDING AND THE EMPLOYEE, NOT COPIES OF THEIR FIGURES. A
 * screen that wanted the signed difference reads `finding.difference`, which is
 * the amount an engine produced; a screen that wanted the name reads
 * `employee.name`. Restating either here would be a second place they could be
 * wrong.
 *
 * `knownImpact` IS THE ONE EXCEPTION AND IT IS THE ESTABLISHED PATTERN. A queue
 * row shows a SIZE beside the words "below rule" or "above rule", and the
 * engine's figure is signed - so the row would otherwise read "-$518.00 above
 * rule", which states the direction twice and contradicts itself once. The
 * magnitude is an aggregate over a stated figure, which decimal.ts is allowed
 * to take, and it is exposed as a FIELD here for the same reason
 * selectors.moneyUnderReview exposes `above`: money() takes a field, never a
 * call, and backend/tests/test_charts.py scans every drawing surface for that.
 */
export type QueueItem = {
  /** Present on a finding row. Null on a NOT_CHECKED row, which has none. */
  finding: ConceptFinding | null;
  employee: ConceptEmployee;
  tier: PriorityTier;
  /** The employee's status, so a row can be drawn without re-deriving it. */
  status: PreflightStatus;
  /**
   * What this row is about, in two or three words, from the finding's own
   * event types. Not a sentence: the sentence is the finding's headline.
   */
  subject: string;
  /** The short tags of the recorded changes behind it. */
  tags: string[];
  /** The SIZE of the computed difference, where one was computed. Null
   * otherwise, and never zero: a finding no rule pack priced is not a finding
   * worth nothing. `direction` says which way it runs. */
  knownImpact: Money | null;
  /** Which way the difference runs, read from the exact value. Null where no
   * difference was computed. */
  direction: "BELOW_RULE" | "ABOVE_RULE" | null;
};

/** The size of a computed difference, or null where none was computed. */
function knownImpact(finding: ConceptFinding | null): Money | null {
  if (!finding || !finding.difference) return null;
  return magnitude(finding.difference.money);
}

/** Which way it runs. `difference` is the published rule less what the register
 * states, so a positive figure is a register BELOW the rule. The sign is read
 * from the exact value, so a sub-cent residue is not called agreement. */
function directionOf(finding: ConceptFinding | null): "BELOW_RULE" | "ABOVE_RULE" | null {
  if (!finding || !finding.difference) return null;
  return signOf(finding.difference.money) >= 0 ? "BELOW_RULE" : "ABOVE_RULE";
}

function tierOf(finding: ConceptFinding | null, status: PreflightStatus): PriorityTier {
  if (status === "NOT_CHECKED") return 4;
  if (!finding) return 3;
  if (finding.difference) return 1;
  if (LIFECYCLE_SOURCES.has(finding.source)) return 2;
  return 3;
}

/** The kinds of recorded change a finding rests on, as short tags. */
function tagsFor(employee: ConceptEmployee, finding: ConceptFinding | null): string[] {
  const types: EventType[] = [];
  if (finding) {
    for (const id of finding.event_ids) {
      const event = employee.detail?.events.find((e) => e.event_id === id);
      if (event && !types.includes(event.event_type)) types.push(event.event_type);
    }
  }
  if (types.length === 0) {
    for (const [type, n] of Object.entries(employee.event_counts)) {
      if ((n ?? 0) > 0) types.push(type as EventType);
    }
  }
  return types.map((t) => EVENT_TAG[t]);
}

/**
 * What the row is about, named from the records rather than from the prose.
 *
 * A finding built on one kind of change is named after it. One built on several
 * says how many. One built on none - which is every NOT_CHECKED row, and a
 * couple of the findings - falls back to the part of the payroll file the
 * finding is about, which is what its `source` already records.
 */
const SOURCE_SUBJECT: Record<string, string> = {
  ATTENDANCE: "Attendance",
  LEAVE: "Leave",
  EMPLOYMENT_STATUS: "Employment record",
  PAYROLL_CONFIGURATION: "Payroll setup",
};

/**
 * A finding about the payroll file ITSELF is not named after the record behind
 * it.
 *
 * This was drawn and then fixed. The CPF-ceiling finding hangs off a
 * salary-change row, so naming it from the event produced a queue whose top
 * line read "Salary change" against a headline about a contribution ceiling.
 * What the finding is ABOUT is the payroll setup; the salary change is only
 * where the trail starts. Attendance and leave findings are the other way round
 * - those really are about the recorded change - so the split follows the
 * finding's own `source` rather than a list of headlines.
 */
const NAMED_BY_SOURCE = new Set(["PAYROLL_CONFIGURATION", "EMPLOYMENT_STATUS"]);

function subjectFor(employee: ConceptEmployee, finding: ConceptFinding | null): string {
  if (finding) {
    if (NAMED_BY_SOURCE.has(finding.source)) return SOURCE_SUBJECT[finding.source];
    const types: EventType[] = [];
    for (const id of finding.event_ids) {
      const event = employee.detail?.events.find((e) => e.event_id === id);
      if (event && !types.includes(event.event_type)) types.push(event.event_type);
    }
    if (types.length === 1) return EVENT_LABEL[types[0]];
    if (types.length > 1) return `${types.length} recorded changes`;
    return SOURCE_SUBJECT[finding.source] ?? "Payroll setup";
  }
  return "Nothing computed";
}

/**
 * Every row that needs a person, in the order a person should work them.
 *
 * ONE ROW PER FINDING, plus one per uncheckable employee. An employee with two
 * findings would appear twice, which is right: they are two questions, and one
 * of them may be a different tier from the other.
 */
export function actionQueue(employees: readonly ConceptEmployee[]): QueueItem[] {
  const items: QueueItem[] = [];

  for (const employee of employees) {
    if (employee.preflight_status === "MATCHED") continue;

    const findings = employee.detail?.findings ?? [];
    if (findings.length === 0) {
      items.push({
        finding: null,
        employee,
        tier: tierOf(null, employee.preflight_status),
        status: employee.preflight_status,
        subject: subjectFor(employee, null),
        tags: tagsFor(employee, null),
        knownImpact: null,
        direction: null,
      });
      continue;
    }
    for (const finding of findings) {
      items.push({
        finding,
        employee,
        tier: tierOf(finding, employee.preflight_status),
        status: employee.preflight_status,
        subject: subjectFor(employee, finding),
        tags: tagsFor(employee, finding),
        knownImpact: knownImpact(finding),
        direction: directionOf(finding),
      });
    }
  }

  return items.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier === 1) {
      const x = a.knownImpact;
      const y = b.knownImpact;
      // Both are tier 1, so both carry a difference; the guard is for the type.
      if (x && y) {
        const size = compare(y, x);
        if (size !== 0) return size;
      }
    }
    return a.employee.employee_id.localeCompare(b.employee.employee_id);
  });
}

/** The rows the opening screen leads with. A slice of the queue and never a
 * different list, so "view all" opens the same order the first three came from. */
export function topOfQueue(employees: readonly ConceptEmployee[], howMany = 3): QueueItem[] {
  return actionQueue(employees).slice(0, howMany);
}

/* ------------------------------------------------------------- the workforce */

export type MapGrouping = "location" | "department";

export type MapSort = "attention" | "id";

export type MapFilter = "all" | "review" | "unchecked" | "matched";

export const GROUPING_LABEL: Record<MapGrouping, string> = {
  location: "Location",
  department: "Department",
};

export const SORT_LABEL: Record<MapSort, string> = {
  attention: "Needs review first",
  id: "Employee ID",
};

export const FILTER_LABEL: Record<MapFilter, string> = {
  all: "All",
  review: "Needs review",
  unchecked: "Not checked",
  matched: "Matched",
};

export type MapGroup = {
  key: string;
  /** Everyone in the group, after the filter and in the chosen order. */
  employees: ConceptEmployee[];
  /** Counted over the WHOLE group, before any filter. A heading that moved when
   * a filter was applied would be describing the filter, not the site. */
  total: number;
  needsReview: number;
  notChecked: number;
};

function keyOf(employee: ConceptEmployee, grouping: MapGrouping): string {
  return grouping === "location" ? employee.location : employee.department;
}

/** The order a status puts a mark in when the map is sorted by attention.
 * Needs review first, then the rows nothing was computed for, then the rest. */
const ATTENTION_ORDER: Record<PreflightStatus, number> = {
  NEEDS_REVIEW: 0,
  NOT_CHECKED: 1,
  MATCHED: 2,
};

function matchesFilter(employee: ConceptEmployee, filter: MapFilter): boolean {
  if (filter === "all") return true;
  if (filter === "review") return employee.preflight_status === "NEEDS_REVIEW";
  if (filter === "unchecked") return employee.preflight_status === "NOT_CHECKED";
  return employee.preflight_status === "MATCHED";
}

/** Name or identifier, case-insensitively. The only text search in the concept,
 * and it looks at two fields rather than at everything. */
export function matchesSearch(employee: ConceptEmployee, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    employee.name.toLowerCase().includes(q) ||
    employee.employee_id.toLowerCase().includes(q)
  );
}

/**
 * The workforce, grouped so that position on the screen means something.
 *
 * GROUPS ARE ORDERED BY WHERE THE ATTENTION IS, largest first, then by name.
 * The alternative was alphabetical, and alphabetical puts Bayfront Kitchen
 * above Harbour Point for a reason that has nothing to do with the month. A
 * reader scanning top to bottom should be scanning in the order the work is.
 *
 * THE COUNTS ON A HEADING ARE OF THE WHOLE GROUP. Filtering changes which marks
 * are drawn and not what the site contains, and a heading that said "0 review"
 * while a filter was hiding three would be the concept's own defect.
 */
export function workforceGroups(
  employees: readonly ConceptEmployee[],
  options: { grouping: MapGrouping; sort: MapSort; filter: MapFilter; search: string },
): MapGroup[] {
  const buckets = new Map<string, ConceptEmployee[]>();
  for (const employee of employees) {
    const key = keyOf(employee, options.grouping);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(employee);
    else buckets.set(key, [employee]);
  }

  const groups: MapGroup[] = [];
  for (const [key, all] of buckets) {
    const shown = all
      .filter((e) => matchesFilter(e, options.filter) && matchesSearch(e, options.search))
      .sort((a, b) => {
        if (options.sort === "attention") {
          const order = ATTENTION_ORDER[a.preflight_status] - ATTENTION_ORDER[b.preflight_status];
          if (order !== 0) return order;
        }
        return a.employee_id.localeCompare(b.employee_id);
      });
    groups.push({
      key,
      employees: shown,
      total: all.length,
      needsReview: all.filter((e) => e.preflight_status === "NEEDS_REVIEW").length,
      notChecked: all.filter((e) => e.preflight_status === "NOT_CHECKED").length,
    });
  }

  return groups.sort((a, b) => {
    const attention = b.needsReview + b.notChecked - (a.needsReview + a.notChecked);
    if (attention !== 0) return attention;
    return a.key.localeCompare(b.key);
  });
}

/* --------------------------------------------------------------- readiness */

/**
 * How much of the month is ready, as a whole number of percent.
 *
 * ROUNDED DOWN, DELIBERATELY. 281.9 rows out of 300 is not 94% ready in any
 * sense a payroll operator should act on, and a figure that rounds up is a
 * figure that overstates by up to half a point in the only direction that
 * matters. The counts under it are the exact claim; this is the shape of it.
 *
 * IT IS A PROPORTION OF THE WHOLE WORKFORCE, not of the rows that were checked.
 * Dividing by the 293 that were checked would produce a larger number by
 * excluding the seven this product exists to keep on the screen.
 */
export function readyPercent(matched: number, total: number): number {
  if (total <= 0) return 0;
  return Math.floor((matched / total) * 100);
}
