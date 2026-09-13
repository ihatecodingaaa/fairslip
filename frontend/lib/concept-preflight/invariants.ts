/**
 * What has to be true of the fixture before any screen may draw it.
 *
 * WHY THIS IS A FUNCTION AND NOT A TEST FILE. The identities below are
 * statements about the DATA, and the data is what a demo runs on. Keeping them
 * here means the node test can assert them, and a future screen can assert them
 * too, without either copy drifting from the other.
 *
 * EVERY CHECK RETURNS A SENTENCE, NOT A BOOLEAN. A failing invariant that says
 * "false" sends someone to read three hundred rows. The violations below name
 * the row, the figure and what was expected of it.
 *
 * THE ONE THAT MATTERS MOST is the register identity: a register whose lines do
 * not sum to its net is a register the month-to-month view would be doing
 * arithmetic over for nothing. Everything the What Changed screen claims rests
 * on it, so it is checked for every month of every employee the fixture carries
 * detail for.
 */

import { sum } from "./decimal";
import { RULE_KEYS, ruleAmount } from "./ruleDerived";
import {
  allFindings,
  bridgeFor,
  eventStatus,
  recheckCounts,
  registerLineTotal,
  statusCounts,
  workforceChanges,
} from "./selectors";
import type {
  ConceptAmount,
  ConceptEmployee,
  ConceptScenario,
  EventType,
  Register,
} from "./types";
import { EVENT_TYPES } from "./types";

function amountsOf(employee: ConceptEmployee): ConceptAmount[] {
  const out: ConceptAmount[] = [];
  if (employee.basic_salary) out.push(employee.basic_salary);
  const d = employee.detail;
  if (!d) return out;
  for (const e of d.events) {
    for (const a of [e.expected, e.payroll, e.difference]) if (a) out.push(a);
  }
  for (const f of d.findings) {
    for (const a of [f.expected, f.payroll, f.difference]) if (a) out.push(a);
    for (const w of f.workings) out.push(w.amount);
    for (const alt of f.alternatives) out.push(alt.amount);
    if (f.split) {
      out.push(f.split.gross, f.split.cash, f.split.cpf, f.split.employerShare, f.split.total);
    }
    if (f.proposed_correction) out.push(f.proposed_correction.from, f.proposed_correction.to);
  }
  for (const r of [d.current, d.previous]) {
    if (!r) continue;
    out.push(r.net);
    for (const l of r.lines) {
      out.push(l.amount);
      if (l.ruleFigure) out.push(l.ruleFigure);
    }
  }
  return out;
}

function scenarioAmounts(scenario: ConceptScenario): ConceptAmount[] {
  const out = scenario.employees.flatMap(amountsOf);
  for (const row of scenario.recheck?.rows ?? []) {
    const f = row.finding;
    if (!f) continue;
    for (const a of [f.expected, f.payroll, f.difference]) if (a) out.push(a);
    for (const w of f.workings) out.push(w.amount);
    for (const alt of f.alternatives) out.push(alt.amount);
    if (f.split) {
      out.push(f.split.gross, f.split.cash, f.split.cpf, f.split.employerShare, f.split.total);
    }
  }
  return out;
}

function checkRegister(who: string, register: Register, violations: string[]): void {
  const total = registerLineTotal(register);
  if (total.display !== register.net.money.display) {
    violations.push(
      `${who}: the ${register.period} register's lines sum to ${total.display} and its net ` +
        `states ${register.net.money.display}. A month-to-month view over that register would be ` +
        `arithmetic over a file that does not add up.`,
    );
  }
}

/**
 * Everything wrong with one scenario, as sentences. An empty list is the pass.
 */
export function violationsIn(scenario: ConceptScenario): string[] {
  const v: string[] = [];
  const employees = scenario.employees;

  /* ------------------------------------------------------------ identity */
  const ids = new Set<string>();
  for (const e of employees) {
    if (ids.has(e.employee_id)) v.push(`${e.employee_id} appears more than once`);
    ids.add(e.employee_id);
  }
  if (employees.length !== scenario.company.headcount) {
    v.push(
      `the file carries ${employees.length} rows and the company states a headcount of ` +
        `${scenario.company.headcount}`,
    );
  }

  const eventIds = new Set<string>();
  const findingIds = new Set<string>();
  for (const e of employees) {
    for (const ev of e.detail?.events ?? []) {
      if (eventIds.has(ev.event_id)) v.push(`${ev.event_id} appears more than once`);
      eventIds.add(ev.event_id);
      if (ev.employee_id !== e.employee_id) {
        v.push(`${ev.event_id} is filed under ${e.employee_id} and names ${ev.employee_id}`);
      }
    }
    for (const f of e.detail?.findings ?? []) {
      if (findingIds.has(f.finding_id)) v.push(`${f.finding_id} appears more than once`);
      findingIds.add(f.finding_id);
      if (f.employee_id !== e.employee_id) {
        v.push(`${f.finding_id} is filed under ${e.employee_id} and names ${f.employee_id}`);
      }
    }
  }

  /* ------------------------------------------------- statuses add up */
  const status = statusCounts(employees);
  if (status.matched + status.needsReview + status.notChecked !== status.total) {
    v.push(
      `the three statuses count ${status.matched + status.needsReview + status.notChecked} ` +
        `rows between them and the file has ${status.total}`,
    );
  }

  /* ---------------------------------- the strip counts what exists */
  const changes = workforceChanges(employees);
  const recount = {} as Record<EventType, number>;
  for (const t of EVENT_TYPES) recount[t] = 0;
  for (const e of employees) for (const t of EVENT_TYPES) recount[t] += e.event_counts[t] ?? 0;
  for (const t of EVENT_TYPES) {
    if (changes.byType[t] !== recount[t]) {
      v.push(`the strip counts ${changes.byType[t]} ${t} records and the file holds ${recount[t]}`);
    }
  }

  /* --------------------------------- per-employee records agree */
  for (const e of employees) {
    const d = e.detail;

    if (e.preflight_status === "NOT_CHECKED") {
      if (!e.not_checked_reason || e.not_checked_reason.length < 60) {
        v.push(
          `${e.employee_id} is NOT CHECKED and gives no reason long enough to be one. ` +
            `A row nobody computed has to say why, or it reads as a clean row.`,
        );
      }
    } else if (e.not_checked_reason) {
      v.push(`${e.employee_id} is ${e.preflight_status} and carries a not-checked reason`);
    }

    if (!d) {
      if (e.preflight_status !== "MATCHED") {
        v.push(
          `${e.employee_id} is ${e.preflight_status} with no records behind it. Only a ` +
            `matched row may be carried without detail.`,
        );
      }
      continue;
    }

    const byType = {} as Record<EventType, number>;
    for (const t of EVENT_TYPES) byType[t] = 0;
    for (const ev of d.events) byType[ev.event_type] += 1;
    for (const t of EVENT_TYPES) {
      if ((e.event_counts[t] ?? 0) !== byType[t]) {
        v.push(
          `${e.employee_id} declares ${e.event_counts[t] ?? 0} ${t} records and carries ` +
            `${byType[t]}`,
        );
      }
    }

    const hasFindings = d.findings.length > 0;
    if (hasFindings && e.preflight_status !== "NEEDS_REVIEW") {
      v.push(`${e.employee_id} carries ${d.findings.length} findings and is ${e.preflight_status}`);
    }
    if (!hasFindings && e.preflight_status === "NEEDS_REVIEW") {
      v.push(`${e.employee_id} is NEEDS REVIEW and carries no finding`);
    }

    for (const f of d.findings) {
      if ((f.difference === null) !== (f.no_difference_reason !== null)) {
        v.push(
          `${f.finding_id} must carry either a difference or a reason it has none, and ` +
            `exactly one of the two`,
        );
      }
      for (const id of f.event_ids) {
        if (!d.events.some((ev) => ev.event_id === id)) {
          v.push(`${f.finding_id} names ${id}, which is not a record of ${e.employee_id}`);
        }
      }
    }

    for (const ev of d.events) {
      if (!ev.check_note) v.push(`${ev.event_id} says nothing about what was checked`);
      if (eventStatus(ev) === "NOT_CHECKED" && ev.check_note.length < 60) {
        v.push(
          `${ev.event_id} is NOT CHECKED and its note is too short to be an explanation`,
        );
      }
      if (ev.finding_id && !d.findings.some((f) => f.finding_id === ev.finding_id)) {
        v.push(`${ev.event_id} names ${ev.finding_id}, which is not a finding of ${e.employee_id}`);
      }
      const unreconciled =
        ev.reached_payroll === "ABSENT" ||
        ev.reached_payroll === "CONTRADICTED" ||
        ev.amount_check === "DIFFERS";
      if (unreconciled && !ev.finding_id) {
        v.push(
          `${ev.event_id} does not reconcile and raises no finding. A record that does not ` +
            `reach payroll, or reaches it at a different figure, is the definition of ` +
            `something to review.`,
        );
      }
      if (ev.mc_verification && ev.event_type !== "PAID_SICK_LEAVE") {
        v.push(`${ev.event_id} carries a certificate verification state and is not sick leave`);
      }
    }

    checkRegister(e.employee_id, d.current, v);
    if (d.previous) checkRegister(e.employee_id, d.previous, v);

    for (const r of [d.current, d.previous]) {
      for (const l of r?.lines ?? []) {
        if ((l.ruleFigure === null) !== (l.ruleNote === null)) {
          v.push(
            `${e.employee_id}: the ${r?.period} line "${l.key}" must carry a rule figure and ` +
              `a note about it together, or neither`,
          );
        }
        for (const id of l.event_ids) {
          if (!d.events.some((ev) => ev.event_id === id)) {
            v.push(`${e.employee_id}: the line "${l.key}" names ${id}, which is not a record`);
          }
        }
      }
    }

    /* THE IDENTITY THE WHAT CHANGED SCREEN RESTS ON. */
    const bridge = bridgeFor(e);
    if (bridge) {
      const total = sum(bridge.lines.map((l) => l.delta));
      if (total.display !== bridge.difference.display) {
        v.push(
          `${e.employee_id}: the month-to-month lines move ${total.display} between them and ` +
            `the net moved ${bridge.difference.display}`,
        );
      }
    }
  }

  /* -------------------------------------------- amounts declare themselves */
  for (const a of scenarioAmounts(scenario)) {
    const where = `${a.origin} ${a.money.display}`;
    if (a.origin === "RULE_DERIVED" && !a.engine) {
      v.push(`${where} claims a rule behind it and names no engine`);
    }
    if (a.origin !== "RULE_DERIVED" && a.engine) {
      v.push(`${where} names an engine and does not claim to be a rule result`);
    }
    if (a.origin === "PAYROLL_STATED" && !a.source) {
      v.push(`${where} claims to be read from a file and names no row`);
    }
    if (a.origin === "ILLUSTRATIVE" && !a.illustrativeNote) {
      v.push(`${where} is illustrative and does not say why it exists`);
    }
    if (a.origin !== "ILLUSTRATIVE" && a.illustrativeNote) {
      v.push(`${where} carries an illustrative note and is not illustrative`);
    }
  }

  /* ------------------------------------------------------------- findings */
  const findings = allFindings(employees);
  if (findings.length !== status.needsReview) {
    v.push(
      `${findings.length} findings across ${status.needsReview} rows that need review. The ` +
        `by-source preview and the row count would disagree.`,
    );
  }

  /* -------------------------------------------------------------- recheck */
  const recheck = scenario.recheck;
  if (recheck) {
    const counts = recheckCounts(recheck);
    if (counts.total !== status.total) {
      v.push(`the recheck accounts for ${counts.total} rows and the file has ${status.total}`);
    }
    if (counts.afterMatched + counts.afterNeedsReview + counts.afterNotChecked !== status.total) {
      v.push(`the second run's three totals do not account for every row`);
    }
    const before = new Map(employees.map((e) => [e.employee_id, e.preflight_status]));
    for (const row of recheck.rows) {
      const was = before.get(row.employee_id);
      if (!was) {
        v.push(`the recheck names ${row.employee_id}, which is not in the file`);
        continue;
      }
      const expected: Record<string, string> = {
        RESOLVED: "NEEDS_REVIEW",
        STILL_EXCEPTION: "NEEDS_REVIEW",
        NEW_EXCEPTION: "MATCHED",
        STILL_REFUSED: "NOT_CHECKED",
        STILL_MATCHED: "MATCHED",
      };
      if (expected[row.state] !== was) {
        v.push(
          `${row.employee_id} is ${row.state} in the second run and was ${was} in the first. ` +
            `A row that was ${was} cannot reach that state.`,
        );
      }
      if (row.state === "NEW_EXCEPTION" && !row.finding) {
        v.push(`${row.employee_id} is a new finding in the second run and carries no finding`);
      }
    }
  }

  return v;
}

/**
 * Rule-derived figures nothing draws.
 *
 * A FIGURE WITH AN ENGINE BEHIND IT AND NO CALL SITE is the same defect this
 * project has a name for in the other direction: a wired mechanism that does
 * nothing. It also quietly inflates what the backend suite is checking, which
 * makes the coverage claim about this concept less true than it reads.
 */
export function unusedRuleDerived(scenarios: readonly ConceptScenario[]): string[] {
  const drawn = new Set<ConceptAmount>();
  for (const s of scenarios) for (const a of scenarioAmounts(s)) drawn.add(a);
  return RULE_KEYS.filter((key) => !drawn.has(ruleAmount(key)));
}

/** Amounts that belong to no rule and no source record. Currently none, and the
 * node test says so: if one is ever added it has to be labelled on screen. */
export function illustrativeAmounts(scenarios: readonly ConceptScenario[]): ConceptAmount[] {
  return scenarios.flatMap(scenarioAmounts).filter((a) => a.origin === "ILLUSTRATIVE");
}
