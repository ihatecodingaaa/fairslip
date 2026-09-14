/**
 * The one endpoint the concept has, and the line the browser is not allowed
 * across.
 *
 * THE CLIENT SENDS IDENTIFIERS. THE SERVER RESOLVES THEM. A request says
 * `{ intent: "explain_finding", scenario: "needs-review", findingId: "FND-01" }`
 * and nothing else. It cannot say what the published rule gives, what the
 * register states, or what the difference is, because the moment a browser can
 * assert a payroll fact to the thing that explains payroll facts, the
 * explanation is downstream of the browser. Every figure comes out of
 * SCENARIOS, on this side.
 *
 * NOTHING HERE RUNS ON PAGE LOAD. There is no GET that calls a model. A person
 * presses a button, and that press is the whole of the request path.
 *
 * THE KEY IS READ HERE AND STAYS HERE. `providerConfigured()` reports a boolean
 * and the handler returns a boolean; no value is logged, returned, or included
 * in an error. When there is no key the endpoint says so plainly and the
 * dashboard behind it is unaffected, because none of it was ever waiting on
 * this.
 */

import { NextResponse } from "next/server";
import { SCENARIOS } from "@/lib/concept-preflight/fixtures";
import {
  COPILOT_INTENTS,
  MAX_QUESTION_LENGTH,
  type CopilotIntent,
  type CopilotResult,
} from "@/lib/concept-preflight/copilot";
import { providerConfigured, runCopilot } from "@/lib/concept-preflight/copilotServer";
import type { ScenarioId } from "@/lib/concept-preflight/types";

function isIntent(value: unknown): value is CopilotIntent {
  return typeof value === "string" && (COPILOT_INTENTS as readonly string[]).includes(value);
}

function isScenario(value: unknown): value is ScenarioId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SCENARIOS, value);
}

/** Whether a model could be called at all. The screen asks before it offers a
 * button, so nobody presses one that was never going to work. */
export async function GET() {
  return NextResponse.json({ available: providerConfigured() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, unsupported: false, message: "That request was not readable." },
      { status: 400 },
    );
  }

  const input = (body ?? {}) as Record<string, unknown>;
  if (!isIntent(input.intent) || !isScenario(input.scenario)) {
    return NextResponse.json(
      { ok: false, unsupported: false, message: "That request named no month or no intent." },
      { status: 400 },
    );
  }

  const scenario = SCENARIOS[input.scenario];
  const findingId = typeof input.findingId === "string" ? input.findingId : undefined;
  const question =
    typeof input.question === "string" ? input.question.slice(0, MAX_QUESTION_LENGTH) : undefined;

  if (input.intent === "explain_finding" && !findingId) {
    return NextResponse.json(
      { ok: false, unsupported: false, message: "No finding was named." },
      { status: 400 },
    );
  }
  if (input.intent === "ask" && !question?.trim()) {
    return NextResponse.json(
      { ok: false, unsupported: false, message: "No question was asked." },
      { status: 400 },
    );
  }

  const result: CopilotResult = await runCopilot(input.intent, scenario, {
    findingId,
    question,
  });

  // 200 for every outcome the screen is meant to draw, including a refusal: an
  // answer FairSlip cannot give is a result, not a transport failure.
  return NextResponse.json(result);
}
