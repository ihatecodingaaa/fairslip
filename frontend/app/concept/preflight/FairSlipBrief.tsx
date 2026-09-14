"use client";

/**
 * The one part of this concept that calls a model, and the only part that can
 * be switched off without the product losing anything it claims.
 *
 * WHAT IT IS. FairSlip's engines have already decided what every row of this
 * month is, and priority.ts has already decided the order to work them in. The
 * Brief reads that result and says, in two sentences, why the first three are
 * the first three. It is a reading assistant over a settled answer.
 *
 * WHAT IT IS NOT, AND THE SCREEN SHOWS THIS RATHER THAN SAYING IT. Every name,
 * every status and every amount on these cards is drawn from the fixture by the
 * same selectors that drew them on the dashboard. The model supplies the
 * SENTENCE and the finding id; the numbers beside it were never in its context
 * and could not have been. So a row here cannot disagree with the same row on
 * the overview, whatever the model said.
 *
 * IT LOOKS LIKE THE REST OF FAIRSLIP. No robot, no sparkle, no gradient, no
 * chat bubble, no avatar. It is a panel with a button, in the same border and
 * the same type as the panel above it, because a payroll control surface that
 * suddenly turns purple where the model starts is a surface telling you which
 * half to trust.
 *
 * A NEW QUESTION IS A NEW PANEL. Each of these is keyed by its subject - the
 * month, or the finding - so moving to another one remounts it rather than
 * clearing it. An answer about September sitting above October's counts, or a
 * sentence about Mei Ling above somebody else's finding, is the one failure
 * this component could have that a reader would not notice.
 *
 * IT NEVER RUNS ON LOAD. The only request this file makes before somebody
 * presses something is a GET asking whether a provider is configured at all,
 * which calls no model and costs nothing. Without that the screen would offer a
 * button that was never going to work.
 */

import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/api";
import type { CopilotAnswer, CopilotIntent } from "@/lib/concept-preflight/copilot";
import { actionQueue, type QueueItem } from "@/lib/concept-preflight/priority";
import type { ConceptEmployee, ScenarioId } from "@/lib/concept-preflight/types";
import { StatusMark } from "./marks";

const ENDPOINT = "/api/concept/preflight/copilot";

type State =
  | { phase: "idle" }
  | { phase: "working" }
  | { phase: "answered"; answer: CopilotAnswer }
  | { phase: "unavailable"; message: string };

/**
 * One request, and every way it can fail folded into one state the screen can
 * draw.
 *
 * NOTHING THROWS OUT OF HERE. A provider that is down, a key that is absent, an
 * answer that did not pass the server's checks - all of them arrive as
 * `unavailable` with a sentence, because the dashboard behind this panel is
 * complete without it and a stack trace on a payroll screen helps nobody.
 */
function useCopilot(scenario: ScenarioId) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    // Calls no model. Asks the server whether one could be called.
    fetch(ENDPOINT)
      .then((r) => r.json())
      .then((body) => {
        if (live) setConfigured(Boolean(body?.available));
      })
      .catch(() => {
        if (live) setConfigured(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const ask = useCallback(
    async (intent: CopilotIntent, extra: { findingId?: string; question?: string } = {}) => {
      setState({ phase: "working" });
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intent, scenario, ...extra }),
        });
        const body = await response.json();
        if (body?.ok) setState({ phase: "answered", answer: body.answer });
        else setState({ phase: "unavailable", message: String(body?.message ?? "") });
      } catch {
        setState({ phase: "unavailable", message: "The Brief could not be reached." });
      }
    },
    [scenario],
  );

  return { state, ask, configured };
}

/* -------------------------------------------------------------- the panel */

export function FairSlipBrief({
  scenario,
  employees,
  onOpen,
}: {
  scenario: ScenarioId;
  employees: ConceptEmployee[];
  onOpen: (employeeId: string, findingId: string | null) => void;
}) {
  const { state, ask, configured } = useCopilot(scenario);
  const queue = actionQueue(employees);

  // ONE LINE WHEN THERE IS NOTHING TO OFFER. An unavailable Brief drawn as a
  // full panel spends eighty pixels of the first screen saying that a button is
  // missing, directly above the rows somebody came here to work.
  if (configured === false) {
    return (
      <p className="rounded-sm border border-line bg-muted px-4 py-2 text-meta text-ink-3">
        <span className="font-semibold uppercase tracking-wide">FairSlip Brief</span> unavailable
        in this preview: no model provider is configured. Your findings are unaffected.
      </p>
    );
  }

  return (
    <section
      aria-labelledby="concept-brief"
      className="rounded-lg border border-line-strong bg-muted px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2
            id="concept-brief"
            className="text-meta font-semibold uppercase tracking-wide text-ink-3"
          >
            FairSlip Brief
          </h2>
          <p className="max-w-measure mt-1 text-body text-ink-2">
            {state.phase === "answered"
              ? state.answer.kind === "brief"
                ? state.answer.summary
                : ""
              : "Reads the findings FairSlip has already established and says which to work first."}
          </p>
        </div>
        {(
          <button
            type="button"
            onClick={() => ask("brief")}
            disabled={state.phase === "working" || configured === null}
            className="tap shrink-0 rounded-sm border-2 border-ink bg-surface px-5 py-2 text-body font-semibold text-ink disabled:cursor-not-allowed disabled:border-control disabled:text-ink-3"
          >
            {state.phase === "working" ? "Checking findings" : "Brief me"}
          </button>
        )}
      </div>

      <Status state={state} onRetry={() => ask("brief")} />

      {state.phase === "answered" && state.answer.kind === "brief" && (
        <>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {state.answer.items.map((item, i) => {
              const row = queue.find((q) => q.finding?.finding_id === item.findingId);
              if (!row) return null;
              return (
                <li key={item.findingId}>
                  <BriefRow rank={i + 1} item={row} reason={item.reason} onOpen={onOpen} />
                </li>
              );
            })}
          </ol>
          <p className="max-w-measure mt-3 text-meta text-ink-2">{state.answer.nextStep}</p>
          <Provenance />
        </>
      )}
    </section>
  );
}

/**
 * One brief row: the model's sentence, everything else from the engines.
 *
 * THE NAME, THE STATUS AND THE FIGURE ARE LOOKED UP HERE from the same queue
 * the overview draws. The model returned an id and a reason and was never given
 * any of the rest.
 */
function BriefRow({
  rank,
  item,
  reason,
  onOpen,
}: {
  rank: number;
  item: QueueItem;
  reason: string;
  onOpen: (employeeId: string, findingId: string | null) => void;
}) {
  const finding = item.finding;
  const difference = finding ? finding.difference : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.employee.employee_id, finding ? finding.finding_id : null)}
      className="tap flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-2 py-3 text-left hover:bg-surface"
    >
      <span className="font-mono text-meta tabular-nums text-ink-3">{rank}</span>
      <StatusMark status={item.status} className="h-4 w-4 shrink-0 translate-y-0.5" />
      <span className="text-body font-semibold text-ink">{item.employee.name}</span>
      <span className="text-meta text-ink-2">{item.subject}</span>
      <span className="ml-auto font-mono text-body tabular-nums text-ink">
        {difference ? (
          money(difference.money)
        ) : (
          <span className="font-sans text-meta text-missing-fg">No amount computed</span>
        )}
      </span>
      <span className="max-w-measure basis-full text-meta text-ink-2">{reason}</span>
    </button>
  );
}

/* ----------------------------------------------------- explain one finding */

export function ExplainFinding({
  scenario,
  findingId,
}: {
  scenario: ScenarioId;
  findingId: string;
}) {
  const { state, ask, configured } = useCopilot(scenario);
  if (configured === false) return null;

  return (
    <div className="mt-6 rounded-sm border border-line bg-muted px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">FairSlip Brief</p>
        <button
          type="button"
          onClick={() => ask("explain_finding", { findingId })}
          disabled={state.phase === "working" || configured === null}
          className="tap-sm rounded-sm border border-control bg-surface px-3 py-2 text-meta font-semibold text-ink-2 hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:text-ink-3"
        >
          {state.phase === "working" ? "Reading the finding" : "Explain this"}
        </button>
      </div>

      <Status state={state} onRetry={() => ask("explain_finding", { findingId })} />

      {state.phase === "answered" && state.answer.kind === "explain_finding" && (
        <>
          <ul className="mt-3 space-y-2">
            {state.answer.explanation.map((line) => (
              <li key={line} className="max-w-measure flex gap-2 text-body text-ink-2">
                <span aria-hidden className="text-ink-3">
                  ·
                </span>
                {line}
              </li>
            ))}
          </ul>
          <p className="max-w-measure mt-3 border-t border-line pt-2 text-body text-ink">
            <span className="font-semibold">Verify next.</span> {state.answer.verifyNext}
          </p>
          <Provenance />
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------- explain recheck */

export function ExplainRecheck({ scenario }: { scenario: ScenarioId }) {
  const { state, ask, configured } = useCopilot(scenario);
  if (configured === false) return null;

  return (
    <div className="mt-6 rounded-sm border border-line bg-muted px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">FairSlip Brief</p>
        <button
          type="button"
          onClick={() => ask("explain_recheck")}
          disabled={state.phase === "working" || configured === null}
          className="tap-sm rounded-sm border border-control bg-surface px-3 py-2 text-meta font-semibold text-ink-2 hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:text-ink-3"
        >
          {state.phase === "working" ? "Comparing the runs" : "Explain the recheck"}
        </button>
      </div>

      <Status state={state} onRetry={() => ask("explain_recheck")} />

      {state.phase === "answered" && state.answer.kind === "explain_recheck" && (
        <>
          <p className="max-w-measure mt-3 text-body text-ink-2">{state.answer.summary}</p>
          <p className="max-w-measure mt-2 text-body text-ink">{state.answer.nextStep}</p>
          <Provenance />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- furniture */

/**
 * Working, or not working, and never a fake.
 *
 * NO "AI IS THINKING", no pulsing dot, no animated ellipsis. The button says
 * what it is doing and a polite live region repeats it for a reader who cannot
 * see the button change. When it fails it says the dashboard is unaffected,
 * because that is the true and useful half of the message.
 */
function Status({ state, onRetry }: { state: State; onRetry: () => void }) {
  if (state.phase === "working") {
    return (
      <p role="status" aria-live="polite" className="mt-3 text-meta text-ink-3">
        Checking FairSlip findings.
      </p>
    );
  }
  if (state.phase === "unavailable") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-3 rounded-sm border border-missing-line bg-missing-bg px-3 py-2"
      >
        <p className="text-body font-semibold text-ink">FairSlip Brief unavailable.</p>
        <p className="max-w-measure mt-1 text-meta text-ink-2">
          Your findings are unaffected. {state.message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="tap-sm mt-2 rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          Try again
        </button>
      </div>
    );
  }
  return null;
}

/** Shown under every answer. The claim it makes is narrow and it is the one
 * that matters: the sentences came from a model, the figures did not. */
function Provenance() {
  return (
    <p className="max-w-measure mt-3 text-meta text-ink-3">
      Written by a model reading findings FairSlip had already established. Every name, status
      and amount on this panel is drawn from those findings, not from the model. Fictional
      concept data.
    </p>
  );
}
