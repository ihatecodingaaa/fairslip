"use client";

/**
 * The controls a person needs while they are talking, not while they are
 * debugging.
 *
 * IT IS FOR A CONVERSATION. Somebody is showing this to a payroll or HR
 * operator and needs to get to the rest-day case, or to the leaver, or to the
 * clean month, without navigating in front of them. So the two things that
 * matter are here and nothing else is: which month, and which beat of the
 * story.
 *
 * IT DOES NOT LOOK LIKE A DEVELOPER PANEL. No JSON, no seed, no feature flags,
 * no state dump. A panel like that on a screen being shown to a customer says
 * "this is a toy" louder than the badge says "this is a concept".
 *
 * IT FOLDS AWAY AND THE BADGE DOES NOT. The concept label beside it is always
 * on screen; this is the part that is allowed to get out of the way.
 *
 * CLOSED BY DEFAULT, and that was decided by looking at it. Open, the panel
 * covered the right-hand third of the preflight totals on a 1440 x 900 screen -
 * which is the screen this will be shown on, covering the sentence about the
 * rows nobody checked. A control that hides the thing it is there to talk about
 * is worse than one extra tap.
 */

import type { ScenarioId } from "@/lib/concept-preflight/types";

export type DemoTarget = "overview" | "hero" | "leaver" | "notChecked" | "recheck";

const TARGETS: { id: DemoTarget; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "hero", label: "Rest-day case" },
  { id: "leaver", label: "Leaver case" },
  { id: "notChecked", label: "Not checked" },
  { id: "recheck", label: "Recheck" },
];

export function DemoControls({
  scenario,
  scenarios,
  onScenario,
  onJump,
  onReset,
}: {
  scenario: ScenarioId;
  scenarios: { id: ScenarioId; label: string }[];
  onScenario: (id: ScenarioId) => void;
  onJump: (target: DemoTarget) => void;
  onReset: () => void;
}) {
  return (
    <details className="w-fit rounded-lg border border-line-strong bg-surface shadow-card open:w-[min(92vw,22rem)]">
      <summary className="tap-sm flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-meta font-semibold uppercase tracking-wide text-ink-3 [&::-webkit-details-marker]:hidden">
        Demo
        <span aria-hidden className="font-mono text-ink-3">
          ±
        </span>
      </summary>

      <div className="border-t border-line px-4 py-4">
        <p className="text-meta text-ink-3">Scenario</p>
        <div role="group" aria-label="Scenario" className="mt-2 flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onScenario(s.id)}
              aria-pressed={scenario === s.id}
              className={`tap-sm rounded-sm border px-3 py-2 text-meta ${
                scenario === s.id
                  ? "border-ink bg-muted font-semibold text-ink"
                  : "border-control font-medium text-ink-2 hover:border-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-meta text-ink-3">Show</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onJump(t.id)}
              className="tap-sm rounded-sm border border-control px-3 py-2 text-meta font-medium text-ink-2 hover:border-ink hover:text-ink"
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onReset}
          className="tap-sm mt-4 rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          Reset to the opening screen
        </button>
      </div>
    </details>
  );
}
