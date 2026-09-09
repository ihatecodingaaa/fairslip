"use client";

/**
 * Four questions about one month, one on screen at a time.
 *
 * WHAT THIS FIXES. Once the engine had run, the worker's page was the answer,
 * then the trail, then the waterfall, then the component list, then the flags,
 * then the CPF note, then the evidence, then every question they had answered,
 * then the agent panel. All of it worth having; none of it worth scrolling past
 * to reach the next thing. The lenses name the four questions - what is the
 * answer, where did it come from, what was it built on, what happens next - and
 * put one of them in front of the reader.
 *
 * THE INACTIVE PANELS ARE HIDDEN FROM THE SCREEN AND NOT FROM THE PAPER, and
 * that is the whole reason this is not a router or a conditional render.
 *
 * The sheet a worker prints IS this DOM, narrowed. It is the artefact that
 * reaches the person who can act, and it has to carry the readings, the
 * arithmetic and the worker's own answers whether or not anyone opened those
 * tabs. A conditional render would have quietly made the printed evidence
 * depend on which tab happened to be selected at the moment somebody pressed
 * print - which is the worst kind of omission, because it is invisible on
 * screen and undetectable on paper.
 *
 * So the panels use `.screen-collapsed`, the class globals.css already defines
 * for exactly this: `display: none` inside `@media screen` only. On screen the
 * inactive panel is out of the layout AND out of the accessibility tree, which
 * is what a tabpanel should be. On paper every panel is present, in order, as
 * it always was.
 *
 * THE IDS ARE CONSTANTS, NOT A useId(). There is one worker result page, and
 * its four panels are rendered by three different components - the reconcile
 * stage owns two of them, the page owns the other two. A generated prefix would
 * have to be threaded through all three, and a tab whose `aria-controls` points
 * at nothing is a failure no screenshot shows.
 */

import type { Key } from "@/lib/i18n";
import { T, useT } from "../ui/Prefs";

export type WorkerLens = "summary" | "trail" | "evidence" | "next";

export const WORKER_LENSES: { id: WorkerLens; label: Key }[] = [
  { id: "summary", label: "lens.summary" },
  { id: "trail", label: "lens.trail" },
  { id: "evidence", label: "lens.evidence" },
  { id: "next", label: "lens.next" },
];

export const tabId = (id: WorkerLens) => `worker-lens-tab-${id}`;
export const panelId = (id: WorkerLens) => `worker-lens-panel-${id}`;

/**
 * Everything a panel needs to be one: its identity, its label, and its screen
 * visibility. Returned from here so all four panels are the same kind of thing
 * however far apart they are rendered.
 */
export function lensPanel(
  id: WorkerLens,
  active: boolean,
  className = "",
): {
  role: "tabpanel";
  id: string;
  "aria-labelledby": string;
  className: string;
} {
  return {
    role: "tabpanel",
    id: panelId(id),
    "aria-labelledby": tabId(id),
    className: `${active ? "" : "screen-collapsed"} ${className}`.trim(),
  };
}

/**
 * The bar. Real tabs: one tab stop for the set, arrow keys between them, each
 * panel labelled by its own tab.
 */
export function LensBar({
  lens,
  onPick,
}: {
  lens: WorkerLens;
  onPick: (id: WorkerLens) => void;
}) {
  const t = useT();
  return (
    <div
      role="tablist"
      aria-label={t("lens.pick")}
      className="print-hide flex flex-wrap border-b border-line-strong"
      onKeyDown={(e) => {
        const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const i = WORKER_LENSES.findIndex((l) => l.id === lens);
        const next = WORKER_LENSES[(i + delta + WORKER_LENSES.length) % WORKER_LENSES.length];
        onPick(next.id);
        document.getElementById(tabId(next.id))?.focus();
      }}
    >
      {WORKER_LENSES.map((l) => {
        const on = l.id === lens;
        return (
          <button
            key={l.id}
            type="button"
            role="tab"
            id={tabId(l.id)}
            aria-selected={on}
            aria-controls={panelId(l.id)}
            tabIndex={on ? 0 : -1}
            onClick={() => onPick(l.id)}
            className={`tap-sm -mb-px border-b-2 px-4 py-2 text-body ${
              on
                ? "border-ink font-semibold text-ink"
                : "border-transparent font-medium text-ink-3 hover:text-ink-2"
            }`}
          >
            <T k={l.label} />
          </button>
        );
      })}
    </div>
  );
}
