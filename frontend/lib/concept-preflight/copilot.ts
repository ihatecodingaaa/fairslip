/**
 * The FairSlip Brief: what a model is allowed to say about a payroll month, and
 * what it is not.
 *
 * WHERE THIS SITS. FairSlip's engines have already decided what every row of
 * this month is: matched, needs review, or not checked. priority.ts has already
 * decided which of them a person should work first. Both of those are code, both
 * are deterministic, and both are asserted by tests. The Brief runs AFTER all of
 * it, over the result, and its job is the one code is bad at: saying in two
 * sentences why the first three rows are the first three.
 *
 *   exports -> engines -> statuses and rule figures -> priority.ts -> THE BRIEF
 *
 * There is no arrow back. Nothing the model returns can change a status, a
 * figure, an order or a count, and the three guards below are what make that a
 * property of the code rather than a promise in a prompt:
 *
 *   1. THE TOOLS ARE READ-ONLY AND THERE IS NO WRITE TOOL. Not a disabled one,
 *      not a guarded one - the surface does not contain the verb. See
 *      copilotTools.ts.
 *
 *   2. NO ANSWER CONTAINING A FIGURE IS EVER DRAWN. `refuseMoneyTokens` below
 *      refuses the whole answer, and the tools hand over no amount in any
 *      structured field - a difference crosses as a DIRECTION and a RANK, never
 *      as dollars. Amounts do appear inside the findings' own sentences, which
 *      go across whole so the model can read what it is explaining; that is why
 *      the guard is at the OUTPUT and not only at the input. Every figure on
 *      the screen is drawn from the engines beside whatever the model said.
 *
 *   3. EVERY IDENTIFIER IS CHECKED AGAINST THE FIXTURE BEFORE IT IS DRAWN. A
 *      finding id the model invented resolves to nothing, so the whole answer
 *      is refused rather than rendered with a gap in it.
 *
 * AND NO NAME GOES OUT EITHER. The tools speak in EMP-0127, never in Mei Ling
 * Tan; the screen resolves the two after the answer comes back. Every person in
 * this fixture is invented, so this protects nobody today - it is here because
 * the shape of the thing is what would be wrong later, and a boundary that is
 * only added once it matters is a boundary that was never tested.
 */

import type { ConceptScenario, ScenarioId } from "./types";

/* ------------------------------------------------------------------ request */

/**
 * What the screen may ask for. Four intents, and the client sends IDENTIFIERS
 * rather than facts: the server looks up FND-01 in its own copy of the fixture,
 * because a request that carried `expected: 161.54` would be letting the browser
 * tell the server what a published rule gives.
 */
export type CopilotIntent = "brief" | "explain_finding" | "explain_recheck" | "ask";

export const COPILOT_INTENTS: readonly CopilotIntent[] = [
  "brief",
  "explain_finding",
  "explain_recheck",
  "ask",
] as const;

export type CopilotRequest = {
  intent: CopilotIntent;
  scenario: ScenarioId;
  /** Required for explain_finding. Ignored otherwise. */
  findingId?: string;
  /** Required for ask. At most 300 characters. */
  question?: string;
};

export const MAX_QUESTION_LENGTH = 300;

/* ----------------------------------------------------------------- response */

/**
 * One row of a brief: an id and the reason it is in the list.
 *
 * NO NAME, NO STATUS WORD, NO AMOUNT. The screen already knows all three from
 * the fixture and draws them itself; what the model adds is the sentence.
 */
export type BriefItem = { findingId: string; reason: string };

export type CopilotAnswer =
  | {
      kind: "brief";
      summary: string;
      items: BriefItem[];
      nextStep: string;
    }
  | {
      kind: "explain_finding";
      findingId: string;
      explanation: string[];
      verifyNext: string;
    }
  | {
      kind: "explain_recheck";
      summary: string;
      highlightFindingIds: string[];
      nextStep: string;
    }
  | {
      kind: "ask";
      answer: string;
      findingIds: string[];
    };

/**
 * What the route returns, and the three things that can happen.
 *
 * `unsupported` IS NOT AN ERROR. It is the model saying the tools do not carry
 * an answer to what was asked, which is the correct outcome for "what should I
 * pay her" and for "is this legal". It is reported as its own state so the
 * screen can draw it as an answer rather than as a failure.
 */
export type CopilotResult =
  | { ok: true; answer: CopilotAnswer; toolCalls: string[] }
  | { ok: false; unsupported: true; message: string }
  | { ok: false; unsupported: false; message: string };

/* ---------------------------------------------------------------- the guard */

/**
 * Every word this product may not say about anyone's pay.
 *
 * THE SAME LIST THE REST OF THE CONCEPT IS HELD TO, in
 * backend/tests/test_concept_preflight.py. The model is told not to use them and
 * is then checked, because a system prompt is a request and this is a
 * condition. An answer carrying one of them is refused whole: there is no
 * redaction pass, because an answer that needed one was reasoning in a
 * vocabulary this product does not have.
 */
export const FORBIDDEN_WORDS = [
  "underpaid",
  "owed",
  "breach",
  "illegal",
  "entitled to",
  "must pay",
  "fraud",
  "compliant",
  "certified",
  "guaranteed",
  "resolved",
  "money saved",
  "saved money",
  "prevented loss",
] as const;

export function findForbiddenWord(text: string): string | null {
  for (const word of FORBIDDEN_WORDS) {
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(text)) return word;
  }
  return null;
}

/**
 * Anything shaped like an amount of money.
 *
 * THE MODEL WAS NEVER GIVEN ONE, so a figure in its answer did not come from
 * this payroll - it came from the model. Refusing the answer is the only
 * response to that which does not put an invented number on a payroll screen.
 *
 * Matches a currency mark, and a bare number written to two decimal places.
 * "3 findings" and "14 September" pass; "80.77" and "S$518" do not.
 */
/*
 * NO WORD BOUNDARY BEFORE THE CURRENCY MARK, and that was a real defect rather
 * than a style note. The first version read `\bS?\$`, and `\b` requires a
 * word-character transition: a dollar sign is not a word character, so "$518"
 * at the start of a sentence matched nothing and walked straight through the
 * guard. It was caught by the test that tries all four shapes rather than one,
 * which is the reason that test tries all four.
 */
const MONEY_SHAPED = /(?:S?\$|\bSGD\b)|(?:\d+\.\d{2}\b)/i;

export function refuseMoneyTokens(text: string): string | null {
  const hit = MONEY_SHAPED.exec(text);
  return hit ? hit[0] : null;
}

/* ------------------------------------------------------------- validation */

export type ValidationFailure = { field: string; why: string };

const MAX_SENTENCE = 400;

function checkProse(field: string, text: unknown, out: ValidationFailure[]): string {
  if (typeof text !== "string" || text.trim().length === 0) {
    out.push({ field, why: "not a non-empty string" });
    return "";
  }
  if (text.length > MAX_SENTENCE) {
    out.push({ field, why: `longer than ${MAX_SENTENCE} characters` });
    return text;
  }
  const forbidden = findForbiddenWord(text);
  if (forbidden) out.push({ field, why: `uses the word "${forbidden}"` });
  const money = refuseMoneyTokens(text);
  if (money) out.push({ field, why: `states an amount ("${money}"), which it was never given` });
  return text;
}

/**
 * Every identifier the scenario actually contains.
 *
 * BUILT FROM THE FIXTURE ON EVERY CALL, not written down. A finding added to the
 * data is a finding the model may name, with nothing else to update; a finding
 * id the model invents is one that is not in here.
 */
export function knownIds(scenario: ConceptScenario): {
  findings: Set<string>;
  employees: Set<string>;
} {
  const findings = new Set<string>();
  const employees = new Set<string>();
  for (const employee of scenario.employees) {
    employees.add(employee.employee_id);
    for (const finding of employee.detail?.findings ?? []) findings.add(finding.finding_id);
  }
  for (const row of scenario.recheck?.rows ?? []) {
    if (row.finding) findings.add(row.finding.finding_id);
  }
  return { findings, employees };
}

function checkFindingId(
  field: string,
  id: unknown,
  known: Set<string>,
  out: ValidationFailure[],
): string {
  if (typeof id !== "string" || !known.has(id)) {
    out.push({ field, why: `${JSON.stringify(id)} is not a finding in this month` });
    return "";
  }
  return id;
}

/**
 * The model's answer, checked against the month it claims to be about.
 *
 * WHOLE OR NOTHING. A partially valid answer is refused, because the part that
 * validated would be rendered beside a gap the reader cannot see, and a payroll
 * screen with a silent gap in it is the defect this product is an argument
 * against.
 */
export function validateAnswer(
  intent: CopilotIntent,
  raw: unknown,
  scenario: ConceptScenario,
): { ok: true; answer: CopilotAnswer } | { ok: false; failures: ValidationFailure[] } {
  const failures: ValidationFailure[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, failures: [{ field: "(root)", why: "not an object" }] };
  }
  const body = raw as Record<string, unknown>;
  const { findings } = knownIds(scenario);

  if (intent === "brief") {
    const summary = checkProse("summary", body.summary, failures);
    const nextStep = checkProse("nextStep", body.nextStep, failures);
    const items: BriefItem[] = [];
    if (!Array.isArray(body.items) || body.items.length === 0) {
      failures.push({ field: "items", why: "not a non-empty array" });
    } else if (body.items.length > 5) {
      failures.push({ field: "items", why: "more than five rows" });
    } else {
      body.items.forEach((entry, i) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        const findingId = checkFindingId(`items[${i}].findingId`, row.findingId, findings, failures);
        const reason = checkProse(`items[${i}].reason`, row.reason, failures);
        items.push({ findingId, reason });
      });
    }
    if (failures.length) return { ok: false, failures };
    return { ok: true, answer: { kind: "brief", summary, items, nextStep } };
  }

  if (intent === "explain_finding") {
    const findingId = checkFindingId("findingId", body.findingId, findings, failures);
    const verifyNext = checkProse("verifyNext", body.verifyNext, failures);
    const explanation: string[] = [];
    if (!Array.isArray(body.explanation) || body.explanation.length === 0) {
      failures.push({ field: "explanation", why: "not a non-empty array" });
    } else if (body.explanation.length > 3) {
      failures.push({ field: "explanation", why: "more than three points" });
    } else {
      body.explanation.forEach((line, i) => {
        explanation.push(checkProse(`explanation[${i}]`, line, failures));
      });
    }
    if (failures.length) return { ok: false, failures };
    return { ok: true, answer: { kind: "explain_finding", findingId, explanation, verifyNext } };
  }

  if (intent === "explain_recheck") {
    const summary = checkProse("summary", body.summary, failures);
    const nextStep = checkProse("nextStep", body.nextStep, failures);
    const highlightFindingIds: string[] = [];
    if (!Array.isArray(body.highlightFindingIds)) {
      failures.push({ field: "highlightFindingIds", why: "not an array" });
    } else if (body.highlightFindingIds.length > 4) {
      failures.push({ field: "highlightFindingIds", why: "more than four rows" });
    } else {
      body.highlightFindingIds.forEach((id, i) => {
        highlightFindingIds.push(
          checkFindingId(`highlightFindingIds[${i}]`, id, findings, failures),
        );
      });
    }
    if (failures.length) return { ok: false, failures };
    return { ok: true, answer: { kind: "explain_recheck", summary, highlightFindingIds, nextStep } };
  }

  const answer = checkProse("answer", body.answer, failures);
  const findingIds: string[] = [];
  if (body.findingIds !== undefined) {
    if (!Array.isArray(body.findingIds)) {
      failures.push({ field: "findingIds", why: "not an array" });
    } else if (body.findingIds.length > 5) {
      failures.push({ field: "findingIds", why: "more than five rows" });
    } else {
      body.findingIds.forEach((id, i) => {
        findingIds.push(checkFindingId(`findingIds[${i}]`, id, findings, failures));
      });
    }
  }
  if (failures.length) return { ok: false, failures };
  return { ok: true, answer: { kind: "ask", answer, findingIds } };
}
