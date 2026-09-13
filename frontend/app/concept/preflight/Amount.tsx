"use client";

/**
 * The one place this concept draws a dollar.
 *
 * EVERY FIGURE ARRIVES WITH WHAT IT IS. A rule result carries the engine that
 * produced it and the published rule behind that; a register figure carries the
 * file and row it was read from; an illustrative value says so in as many words.
 * The provenance line is not a tooltip and not a hover: it is a second line of
 * type under the figure, always rendered, because a screen full of amounts whose
 * origins are only available on hover is a screen that will be photographed
 * without them.
 *
 * `money()` IS THE PRODUCTION FORMATTER AND IT TAKES A FIELD. Nothing here does
 * arithmetic - backend/tests/test_charts.py scans every file in the app that
 * calls money() and fails the build if the argument is an expression rather than
 * a field of an object an engine built. That rule was written for the worker's
 * money trail and it holds here for the same reason.
 */

import { useId, useState } from "react";
import { money } from "@/lib/api";
import type { ConceptAmount } from "@/lib/concept-preflight/types";

const SIZE = {
  meta: "text-meta",
  body: "text-body",
  lead: "text-lead",
  title: "text-title",
  page: "text-page",
  hero: "text-hero sm:text-display",
} as const;

/** What to say under a figure, in four words, so a reader can tell at a glance
 * which kind of claim they are looking at. */
function originLine(amount: ConceptAmount): string {
  if (amount.origin === "RULE_DERIVED") {
    return `${amount.engine?.rule.authority ?? "Published"} rule`;
  }
  if (amount.origin === "PAYROLL_STATED") {
    const s = amount.source;
    if (!s) return "From the export";
    return s.row === null ? s.file : `${s.file} row ${s.row}`;
  }
  return "Illustrative concept value";
}

export function Amount({
  amount,
  label,
  size = "lead",
  strong = false,
}: {
  amount: ConceptAmount;
  /** What the figure is. Rendered above it, because the reader needs to know
   * what they are looking at before they read the digits. */
  label?: string;
  size?: keyof typeof SIZE;
  strong?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      {label && <span className="text-meta text-ink-3">{label}</span>}
      <span
        className={`font-mono tabular-nums ${SIZE[size]} ${
          strong ? "font-semibold text-ink" : "text-ink"
        }`}
      >
        {money(amount.money)}
      </span>
      <OriginTag amount={amount} />
    </span>
  );
}

/**
 * The provenance line, on its own.
 *
 * AN ILLUSTRATIVE FIGURE IS MARKED DIFFERENTLY FROM THE OTHER TWO, in a border
 * rather than in grey type. A rule result and a register figure are both things
 * somebody can go and check; an illustrative one is not, and the difference
 * between "you can verify this" and "you cannot" is the only difference on this
 * screen worth spending a border on. Nothing in the concept currently uses it,
 * and the concept's own suite asserts that; this branch is what keeps adding one
 * later safe.
 */
export function OriginTag({ amount }: { amount: ConceptAmount }) {
  if (amount.origin === "ILLUSTRATIVE") {
    return (
      <span className="mt-1 inline-flex w-fit rounded-sm border border-attention-line bg-attention-bg px-2 py-1 text-meta font-semibold text-attention-fg">
        Illustrative concept value, not rule-derived
      </span>
    );
  }
  return (
    <span
      className={`text-meta ${
        amount.origin === "RULE_DERIVED" ? "font-medium text-ink-2" : "text-ink-3"
      }`}
    >
      {originLine(amount)}
    </span>
  );
}

/**
 * How a rule-derived figure was arrived at, folded away.
 *
 * FOLDED, NOT OMITTED. The engine's own formula string, the provenance label of
 * every fact it consumed, and the authority's own sentence are what turn a
 * figure into something an operator can argue with. They are also four lines of
 * small type that would bury the finding if they were open by default.
 *
 * A <button> and a region rather than <details>, so the disclosure state can be
 * read by the tests and so the region is in the accessibility tree under a name.
 */
export function Workings({ amount }: { amount: ConceptAmount }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const engine = amount.engine;
  if (!engine) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={uid}
        className="tap-sm inline-flex items-center gap-2 rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
      >
        <span aria-hidden className="font-mono">
          {open ? "−" : "+"}
        </span>
        How this was worked out
      </button>
      <div id={uid} hidden={!open} className="mt-3 border-l-2 border-line-strong pl-4">
        <p className="text-meta text-ink-3">Engine</p>
        <p className="break-all font-mono text-meta text-ink-2">{engine.call}</p>

        <p className="mt-3 text-meta text-ink-3">Formula</p>
        <p className="break-words rounded-sm bg-muted px-3 py-2 font-mono text-meta text-ink-2">
          {engine.formula}
        </p>

        <p className="mt-3 text-meta text-ink-3">Facts it used</p>
        <ul className="mt-1 space-y-1">
          {engine.inputs.map((input) => (
            <li key={input} className="text-meta text-ink-2">
              {input}
            </li>
          ))}
        </ul>

        <p className="mt-3 text-meta text-ink-3">{engine.rule.authority}, in their words</p>
        <blockquote className="mt-1 border-l-2 border-brand-line pl-3 text-meta text-ink-2">
          {engine.rule.quote}
        </blockquote>
        <p className="mt-2 text-meta text-ink-3">
          {engine.rule.page}. Read for this project on {engine.rule.verified}.
        </p>
        <a
          href={engine.rule.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block break-all text-meta text-brand-fg underline underline-offset-2"
        >
          {engine.rule.url}
        </a>
      </div>
    </div>
  );
}

/**
 * A figure a reader should NOT be shown, and the reason instead.
 *
 * NOT A DASH, NOT A ZERO, NOT AN EMPTY CELL. Each of those reads as "nothing to
 * see" and two of them read as "zero dollars". The reason is the content.
 */
export function NotChecked({ why, className = "" }: { why: string; className?: string }) {
  return (
    <div
      className={`rounded-sm border border-missing-line bg-missing-bg px-3 py-2 ${className}`}
    >
      <p className="text-meta font-semibold uppercase tracking-wide text-missing-fg">
        Not checked
      </p>
      <p className="max-w-measure mt-1 text-meta text-ink-2">{why}</p>
    </div>
  );
}
