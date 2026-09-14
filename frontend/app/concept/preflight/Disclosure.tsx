"use client";

/**
 * Folded away, not taken away.
 *
 * THE DISTINCTION THIS COMPONENT EXISTS TO HOLD. The evidence under a finding -
 * the export rows, the engine's formula, the authority's own sentence - is what
 * makes the finding something an operator can argue with, and it is also four
 * screens of small type that buried the finding when it was all open at once.
 * Folding it is a claim about READING ORDER. Removing it would be a claim about
 * what a reader is allowed to check, and this product does not get to make
 * that one.
 *
 * SO EVERY FOLD SAYS WHAT IS INSIDE IT AND HOW MUCH. "Evidence (3)" rather than
 * "Details": a reader deciding whether to open something needs to know what
 * they are not looking at. A count is the cheapest honest way to say it.
 *
 * A BUTTON AND A REGION, NOT <details>. The state is readable by the tests, the
 * region is in the accessibility tree under a name, and the summary line cannot
 * be styled into something that looks like a heading and behaves like a
 * toggle. Same pattern as Amount.tsx's workings, for the same reasons.
 */

import { useId, useState } from "react";

export function Disclosure({
  label,
  count,
  hint,
  children,
  defaultOpen = false,
}: {
  label: string;
  /** How many things are inside. Omitted where the fold holds one thing. */
  count?: number;
  /** One short line, shown beside the label whether or not it is open, where
   * the reader needs to know something before deciding to open it. */
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const uid = useId();

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={uid}
        className="tap flex w-full items-baseline gap-3 py-3 text-left hover:bg-muted"
      >
        <span aria-hidden className="font-mono text-meta text-ink-3">
          {open ? "−" : "+"}
        </span>
        <span className="text-body font-semibold text-ink">
          {label}
          {count !== undefined && (
            <span className="ml-2 font-mono text-meta font-normal tabular-nums text-ink-3">
              {count}
            </span>
          )}
        </span>
        {hint && <span className="min-w-0 text-meta text-ink-3">{hint}</span>}
      </button>
      <div id={uid} hidden={!open} className="pb-5">
        {children}
      </div>
    </div>
  );
}
