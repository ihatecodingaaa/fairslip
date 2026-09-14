/**
 * Everything the Brief is allowed to look at. There is nothing else.
 *
 * SEVEN VERBS, ALL OF THEM "GET". No write, no draft, no send, no approve, no
 * file, no fetch, no shell. That is not a policy applied to a larger surface -
 * it IS the surface, and copilot.test.ts asserts that the exported table
 * contains no other kind of verb and that running every tool leaves the fixture
 * byte-identical.
 *
 * NO STRUCTURED FIELD CARRIES AN AMOUNT. A difference is reported as a
 * DIRECTION - the register states less than the published rule, or more - and
 * as a RANK among the differences the engines computed. There is no
 * `difference`, no `expected` and no `payroll` field anywhere below, and
 * copilot.test.ts walks every result to prove it.
 *
 * THE FINDINGS' OWN SENTENCES ARE THE EXCEPTION, AND IT IS DELIBERATE. A
 * headline and a detail are the fixture's own prose and a few of them quote a
 * figure - "CPF is calculated on $9,400.00 of Ordinary Wages, above the
 * published ceiling". Cutting those out would leave the model explaining a
 * finding it cannot read, so they go across whole. What that costs is nothing,
 * because the guarantee that matters is at the other end: copilot.ts refuses
 * any answer containing a figure at all, so a model that read one in a sentence
 * still cannot put it on a payroll screen. The claim is "the model cannot state
 * an amount", not "the model never saw one", and only the first of those is
 * worth anything.
 *
 * So: the model explains, the engines state the figures, and the screen draws
 * them side by side.
 *
 * NO NAME EITHER. Everything is EMP-0127. The screen resolves it afterwards.
 *
 * THE RESULTS ARE DATA, NOT INSTRUCTIONS. Every string below is fictional
 * fixture prose, and it is returned in a tool result - a user-role message -
 * rather than concatenated into the system prompt. A sentence in an export
 * that said "ignore your instructions" would arrive as content the model is
 * reasoning ABOUT, which is the only structural defence against that and the
 * reason the boundary is drawn here rather than in wording.
 */

import { actionQueue, readyPercent, type QueueItem } from "./priority";
import {
  EVENT_LABEL,
  FINDING_SOURCE_LABEL,
  RECHECK_WORD,
  SOURCE_LABEL,
  STATUS_WORD,
  allFindings,
  eventStatus,
  moneyUnderReview,
  recheckCounts,
  statusCounts,
} from "./selectors";
import { signOf } from "./decimal";
import type { ConceptFinding, ConceptScenario } from "./types";

/* ------------------------------------------------------------- the schemas */

/** The shape of one tool, as the Messages API takes it. */
export type ToolSpec = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
};

const NO_INPUT = {
  type: "object" as const,
  properties: {},
  required: [] as string[],
  additionalProperties: false as const,
};

export const COPILOT_TOOLS: ToolSpec[] = [
  {
    name: "get_payroll_summary",
    description:
      "Counts for the whole month: how many employees are ready, need review, and were not " +
      "checked, how many findings run below and above the published rules, how many carry no " +
      "computed amount, and when the payroll closes. No dollar amounts are returned by any " +
      "tool; FairSlip renders those itself.",
    input_schema: NO_INPUT,
  },
  {
    name: "list_findings",
    description:
      "The rows that need a person, already in FairSlip's own priority order. You cannot " +
      "reorder this list and must not present a different order as the order to work in.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["NEEDS_REVIEW", "NOT_CHECKED", "ALL"],
          description: "Defaults to ALL.",
        },
        source: {
          type: "string",
          enum: ["ATTENDANCE", "LEAVE", "EMPLOYMENT_STATUS", "PAYROLL_CONFIGURATION"],
          description: "Which system's records the finding is about.",
        },
        limit: { type: "integer", minimum: 1, maximum: 25, description: "Defaults to 10." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "get_finding",
    description:
      "One finding in full: what does not reconcile, which published rule was applied, which " +
      "export rows it rests on, and whether an amount was computed for it.",
    input_schema: {
      type: "object",
      properties: { finding_id: { type: "string" } },
      required: ["finding_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_employee_trace",
    description:
      "One employee's recorded changes for the month and what the payroll register did with " +
      "each one. Returns that employee and no other.",
    input_schema: {
      type: "object",
      properties: { employee_ref: { type: "string", description: "For example EMP-0127." } },
      required: ["employee_ref"],
      additionalProperties: false,
    },
  },
  {
    name: "get_unchecked_items",
    description:
      "The rows FairSlip computed nothing for, and the engine's own reason for each. These are " +
      "not matched rows and must never be described as correct, fine, or clean.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 25 } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "get_recheck_summary",
    description:
      "What the second run over the corrected file found: how many rows resolved, how many " +
      "still differ, which are new, and which still could not be checked.",
    input_schema: NO_INPUT,
  },
  {
    name: "prepare_correction_preview",
    description:
      "The change a reviewer would make in their own payroll system for one finding. READ " +
      "ONLY: this prepares nothing, sends nothing and changes nothing. FairSlip never writes " +
      "to a payroll system.",
    input_schema: {
      type: "object",
      properties: { finding_id: { type: "string" } },
      required: ["finding_id"],
      additionalProperties: false,
    },
  },
];

export const TOOL_NAMES: readonly string[] = COPILOT_TOOLS.map((t) => t.name);

/* ---------------------------------------------------------------- helpers */

/** Which way a computed difference runs, without saying how far.
 * The sign is read from the exact value, as it is everywhere else in the
 * concept, so a sub-cent residue is not reported as agreement. */
function directionOf(finding: ConceptFinding): "BELOW_PUBLISHED_RULE" | "ABOVE_PUBLISHED_RULE" {
  if (!finding.difference) throw new Error("no difference");
  return signOf(finding.difference.money) >= 0 ? "BELOW_PUBLISHED_RULE" : "ABOVE_PUBLISHED_RULE";
}

/**
 * Where a finding sits among the ones an engine put an amount to, largest
 * first. 1 is the biggest known difference in the month.
 *
 * A RANK AND NOT A SIZE. It is enough for "look at this one first" and it
 * carries no figure, so an answer built on it cannot misstate one.
 */
function rankTable(scenario: ConceptScenario): Map<string, number> {
  const ranked = actionQueue(scenario.employees).filter((i) => i.tier === 1);
  return new Map(ranked.map((item, i) => [item.finding?.finding_id ?? "", i + 1]));
}

function findingRow(item: QueueItem, ranks: Map<string, number>) {
  const finding = item.finding;
  return {
    finding_id: finding ? finding.finding_id : null,
    employee_ref: item.employee.employee_id,
    status: item.status,
    status_word: STATUS_WORD[item.status],
    priority_position: 0, // filled by the caller, which knows the slice
    priority_reason: item.tier,
    subject: item.subject,
    source: finding ? finding.source : null,
    source_label: finding ? FINDING_SOURCE_LABEL[finding.source] : null,
    headline: finding ? finding.headline : null,
    has_computed_difference: Boolean(finding?.difference),
    difference_direction: finding?.difference ? directionOf(finding) : null,
    difference_rank_among_known: finding ? (ranks.get(finding.finding_id) ?? null) : null,
    no_difference_reason: finding && !finding.difference ? finding.no_difference_reason : null,
    not_checked_reason: item.employee.not_checked_reason,
    rule: finding?.rule ? `${finding.rule.authority}, ${finding.rule.page}` : null,
  };
}

function locateFinding(
  scenario: ConceptScenario,
  findingId: string,
): { finding: ConceptFinding; employeeRef: string } | null {
  for (const employee of scenario.employees) {
    for (const finding of employee.detail?.findings ?? []) {
      if (finding.finding_id === findingId) {
        return { finding, employeeRef: employee.employee_id };
      }
    }
  }
  for (const row of scenario.recheck?.rows ?? []) {
    if (row.finding && row.finding.finding_id === findingId) {
      return { finding: row.finding, employeeRef: row.employee_id };
    }
  }
  return null;
}

/** What a tool says when it is asked about something that is not there.
 * NOT AN EMPTY RESULT: an empty object reads as "nothing to report", which is
 * the one thing an unknown identifier does not mean. */
export class UnknownReference extends Error {}

/* ------------------------------------------------------------------ the seven */

export function executeTool(
  name: string,
  input: Record<string, unknown>,
  scenario: ConceptScenario,
): unknown {
  switch (name) {
    case "get_payroll_summary": {
      const status = statusCounts(scenario.employees);
      const money = moneyUnderReview(allFindings(scenario.employees));
      return {
        period: scenario.period.label,
        run_on: scenario.period.today,
        closes: scenario.period.closes,
        payday: scenario.period.payday,
        employees: status.total,
        ready: status.matched,
        needs_review: status.needsReview,
        not_checked: status.notChecked,
        rows_actually_checked: status.checked,
        ready_percent: readyPercent(status.matched, status.total),
        findings_below_published_rules: money.belowCount,
        findings_above_published_rules: money.aboveCount,
        findings_with_no_computed_amount: money.withoutComputedDifference,
        note:
          "The two directions are never netted against each other and the findings with no " +
          "computed amount are never counted as zero. Amounts are not provided to you.",
      };
    }

    case "list_findings": {
      const status = typeof input.status === "string" ? input.status : "ALL";
      const source = typeof input.source === "string" ? input.source : null;
      const limit = typeof input.limit === "number" ? Math.min(25, Math.max(1, input.limit)) : 10;
      const ranks = rankTable(scenario);
      const queue = actionQueue(scenario.employees);
      const rows = queue
        .map((item, i) => ({ item, position: i + 1 }))
        .filter(({ item }) => {
          if (status === "NEEDS_REVIEW" && item.status !== "NEEDS_REVIEW") return false;
          if (status === "NOT_CHECKED" && item.status !== "NOT_CHECKED") return false;
          if (source && item.finding?.source !== source) return false;
          return true;
        })
        .slice(0, limit)
        .map(({ item, position }) => ({ ...findingRow(item, ranks), priority_position: position }));
      return {
        order: "FairSlip's own priority order. Position 1 is worked first.",
        total_in_queue: queue.length,
        returned: rows.length,
        rows,
      };
    }

    case "get_finding": {
      const id = String(input.finding_id ?? "");
      const found = locateFinding(scenario, id);
      if (!found) throw new UnknownReference(`no finding ${id} in this month`);
      const { finding, employeeRef } = found;
      const ranks = rankTable(scenario);
      const employee = scenario.employees.find((e) => e.employee_id === employeeRef);
      return {
        finding_id: finding.finding_id,
        employee_ref: employeeRef,
        source: finding.source,
        source_label: FINDING_SOURCE_LABEL[finding.source],
        headline: finding.headline,
        detail: finding.detail,
        has_computed_difference: Boolean(finding.difference),
        difference_direction: finding.difference ? directionOf(finding) : null,
        difference_rank_among_known: ranks.get(finding.finding_id) ?? null,
        no_difference_reason: finding.no_difference_reason,
        rule: finding.rule
          ? {
              authority: finding.rule.authority,
              page: finding.rule.page,
              last_read_for_this_project: finding.rule.verified,
            }
          : null,
        rule_gives_two_answers: finding.alternatives.length > 0,
        touches_cpf_as_well_as_wage: finding.split !== null,
        has_correction_preview: finding.proposed_correction !== null,
        source_rows: (finding.event_ids ?? [])
          .map((eventId) => {
            const event = employee?.detail?.events.find((e) => e.event_id === eventId);
            if (!event) return null;
            return {
              event_id: event.event_id,
              event_type: event.event_type,
              recorded_in: SOURCE_LABEL[event.source.system],
              row: event.source.row,
              approval: event.approval_state,
            };
          })
          .filter(Boolean),
      };
    }

    case "get_employee_trace": {
      const ref = String(input.employee_ref ?? "");
      const employee = scenario.employees.find((e) => e.employee_id === ref);
      if (!employee) throw new UnknownReference(`no employee ${ref} in this month`);
      return {
        employee_ref: employee.employee_id,
        status: employee.preflight_status,
        status_word: STATUS_WORD[employee.preflight_status],
        employment_status: employee.employment_status,
        not_checked_reason: employee.not_checked_reason,
        detail_recorded_in_this_prototype: employee.detail !== null,
        events: (employee.detail?.events ?? []).map((event) => ({
          event_id: event.event_id,
          date: event.event_date,
          event_type: event.event_type,
          event_label: EVENT_LABEL[event.event_type],
          recorded_in: SOURCE_LABEL[event.source.system],
          reached_payroll: event.reached_payroll,
          amount_check: event.amount_check,
          status: eventStatus(event),
          what_the_check_established: event.check_note,
          finding_id: event.finding_id,
        })),
        findings: (employee.detail?.findings ?? []).map((f) => f.finding_id),
      };
    }

    case "get_unchecked_items": {
      const limit = typeof input.limit === "number" ? Math.min(25, Math.max(1, input.limit)) : 25;
      const rows = scenario.employees
        .filter((e) => e.preflight_status === "NOT_CHECKED")
        .slice(0, limit)
        .map((e) => ({
          employee_ref: e.employee_id,
          reason: e.not_checked_reason,
        }));
      return {
        count: rows.length,
        rows,
        note:
          "Nothing was computed for these rows. They are not matched, not ready, and not " +
          "counted in any money total. Do not describe them as correct.",
      };
    }

    case "get_recheck_summary": {
      const recheck = scenario.recheck;
      if (!recheck) {
        return {
          available: false,
          why: "This month has no second run, because there was nothing to correct.",
        };
      }
      const before = statusCounts(scenario.employees);
      const counts = recheckCounts(recheck);
      return {
        available: true,
        before_needing_review: before.needsReview,
        after_needing_review: counts.afterNeedsReview,
        resolved: counts.byState.RESOLVED,
        still_different: counts.byState.STILL_EXCEPTION,
        new_findings: counts.byState.NEW_EXCEPTION,
        still_not_checked: counts.byState.STILL_REFUSED,
        matched_in_both_runs: counts.byState.STILL_MATCHED,
        transitions: recheck.rows.map((row) => ({
          employee_ref: row.employee_id,
          state: row.state,
          state_word: RECHECK_WORD[row.state],
          before: row.before,
          after: row.after,
          finding_id: row.finding ? row.finding.finding_id : null,
        })),
        note:
          "FairSlip did not measure what any correction was worth and cannot. Report what " +
          "moved, never a saving.",
      };
    }

    case "prepare_correction_preview": {
      const id = String(input.finding_id ?? "");
      const found = locateFinding(scenario, id);
      if (!found) throw new UnknownReference(`no finding ${id} in this month`);
      const correction = found.finding.proposed_correction;
      if (!correction) {
        return {
          finding_id: id,
          has_correction: false,
          why:
            "What does not reconcile here is a record rather than an amount, so there is no " +
            "line to change. A person decides which record is right, in the system that owns it.",
        };
      }
      return {
        finding_id: id,
        has_correction: true,
        payroll_line: correction.line,
        what_a_reviewer_should_check: correction.note,
        amounts: "Withheld from you. FairSlip renders the current and proposed figures itself.",
        applied: false,
        note:
          "This preview changed nothing. FairSlip never writes to a payroll system. A person " +
          "makes the change in the system that owns the money, and FairSlip rechecks it after.",
      };
    }

    default:
      throw new UnknownReference(`no tool named ${name}`);
  }
}
