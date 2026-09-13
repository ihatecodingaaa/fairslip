"use client";

/**
 * The same checks, run again over the corrected file.
 *
 * WHAT MAKES THIS WORTH A SCREEN is the row that got worse. Nine findings were
 * corrected; two still stand; and one employee who matched the first time does
 * not any more, because the rate change that fixed one rest-day shift reached a
 * second shift that MOM's table prices differently. Nobody would have gone
 * looking for that, and a product that only reported what it found the first
 * time would not have found it either.
 *
 * THE SEVEN UNCHECKABLE ROWS ARE STILL UNCHECKABLE, and they are drawn. Rolling
 * them into "matched" after a correction pass would be the summary quietly
 * gaining seven rows nobody ever computed.
 *
 * NOTHING HERE SAYS MONEY WAS SAVED. FairSlip did not measure that and cannot:
 * what a correction was worth depends on what would have happened otherwise,
 * which is not a fact in any of these files. The screen reports what moved.
 *
 * THE VOCABULARY IS fairslip.employer.RecheckState's, so an employer who has
 * seen the product's own recheck reads this one without being taught it twice.
 */

import { useState } from "react";
import type { ConceptEmployee, RecheckConcept as RecheckData, RecheckRow, RecheckRowState } from "@/lib/concept-preflight/types";
import {
  RECHECK_WORD,
  recheckCounts,
  recheckRowsToShow,
  statusCounts,
} from "@/lib/concept-preflight/selectors";
import { OutcomeMark } from "../../employer/outcomeMark";
import { ExceptionReview } from "./ExceptionReview";

/** What each transition looked like on each side of the correction. The shapes
 * are the product's own; this only says which one a row wore before and after. */
const TRANSITION: Record<RecheckRowState, { before: "OK" | "EXCEPTION" | "REFUSED"; after: "OK" | "EXCEPTION" | "REFUSED" }> = {
  STILL_MATCHED: { before: "OK", after: "OK" },
  RESOLVED: { before: "EXCEPTION", after: "OK" },
  STILL_EXCEPTION: { before: "EXCEPTION", after: "EXCEPTION" },
  NEW_EXCEPTION: { before: "OK", after: "EXCEPTION" },
  STILL_REFUSED: { before: "REFUSED", after: "REFUSED" },
};

export function RecheckConcept({
  recheck,
  employees,
}: {
  recheck: RecheckData;
  employees: ConceptEmployee[];
}) {
  const before = statusCounts(employees);
  const counts = recheckCounts(recheck);
  const rows = recheckRowsToShow(recheck);
  const byId = new Map(employees.map((e) => [e.employee_id, e]));

  return (
    <section aria-labelledby="concept-recheck">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">Recheck</p>
      <h2
        id="concept-recheck"
        className="mt-2 max-w-measure text-page font-semibold tracking-tight text-ink"
      >
        {recheck.headline}
      </h2>
      <p className="max-w-measure mt-3 text-lead text-ink-2">
        The same rule packs and the same exports, run a second time.
      </p>
      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
        <div className="flex flex-col">
          <dt className="text-meta text-ink-3">First run</dt>
          <dd className="text-body text-ink-2">{recheck.before_label}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-meta text-ink-3">Second run</dt>
          <dd className="text-body text-ink-2">{recheck.after_label}</dd>
        </div>
      </dl>

      {/* ------------------------------------------------- before and after */}
      <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-6 rounded-lg border border-line bg-muted px-5 py-5">
        <Side count={before.needsReview} label="needed review" />
        <span aria-hidden className="pb-2 text-page text-ink-3">
          &rarr;
        </span>
        <Side count={counts.afterNeedsReview} label="remain" strong />
        <dl className="flex flex-wrap gap-x-8 gap-y-4 border-l border-line-strong pl-8">
          <Tally value={counts.byState.RESOLVED} label={RECHECK_WORD.RESOLVED} />
          <Tally value={counts.byState.STILL_EXCEPTION} label={RECHECK_WORD.STILL_EXCEPTION} />
          <Tally value={counts.byState.NEW_EXCEPTION} label={RECHECK_WORD.NEW_EXCEPTION} strong />
          <Tally value={counts.byState.STILL_REFUSED} label={RECHECK_WORD.STILL_REFUSED} />
        </dl>
      </div>

      <p className="max-w-measure mt-4 text-meta text-ink-3">
        The other <span className="font-mono tabular-nums">{counts.byState.STILL_MATCHED}</span>{" "}
        rows matched in both runs and are counted here rather than drawn, because nothing about
        them changed. They are the only rows on any of these screens that a summary stands in
        for.
      </p>

      {/* ---------------------------------------------------------- the rows */}
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <Row key={row.employee_id} row={row} employee={byId.get(row.employee_id) ?? null} />
        ))}
      </ul>
    </section>
  );
}

function Side({ count, label, strong }: { count: number; label: string; strong?: boolean }) {
  return (
    <p className="flex flex-col">
      <span
        className={`order-1 font-mono tabular-nums ${
          strong ? "text-hero font-semibold text-ink" : "text-hero font-medium text-ink-2"
        }`}
      >
        {count}
      </span>
      <span className="order-2 text-body text-ink-2">{label}</span>
    </p>
  );
}

function Tally({ value, label, strong }: { value: number; label: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dd
        className={`order-1 font-mono tabular-nums ${
          strong ? "text-title font-semibold text-ink" : "text-title font-medium text-ink-2"
        }`}
      >
        {value}
      </dd>
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
    </div>
  );
}

function Row({ row, employee }: { row: RecheckRow; employee: ConceptEmployee | null }) {
  const [open, setOpen] = useState(row.state === "NEW_EXCEPTION");
  const transition = TRANSITION[row.state];
  const expandable = row.finding !== null && employee !== null;

  return (
    <li className={row.state === "NEW_EXCEPTION" ? "bg-attention-bg" : undefined}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-2 py-4">
        <span className="flex shrink-0 items-center gap-2 pt-1">
          <OutcomeMark outcome={transition.before} className="h-4 w-4" />
          <span aria-hidden className="text-meta text-ink-3">
            &rarr;
          </span>
          <OutcomeMark outcome={transition.after} className="h-4 w-4" />
        </span>

        <span className="flex min-w-0 flex-1 basis-64 flex-col">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-body font-semibold text-ink">
              {employee ? employee.name : row.employee_id}
            </span>
            <span className="font-mono text-meta text-ink-3">{row.employee_id}</span>
          </span>
          <span className="mt-1 max-w-measure text-meta text-ink-3">Before: {row.before}</span>
          <span className="max-w-measure text-meta text-ink-2">After: {row.after}</span>
        </span>

        <span className="flex basis-40 flex-col">
          <span
            className={`text-body font-semibold ${
              row.state === "NEW_EXCEPTION" || row.state === "STILL_EXCEPTION"
                ? "text-attention-fg"
                : row.state === "STILL_REFUSED"
                  ? "text-missing-fg"
                  : "text-ink-2"
            }`}
          >
            {RECHECK_WORD[row.state]}
          </span>
          {expandable && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="tap-sm mt-1 w-fit rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              {open ? "Hide the finding" : "Show the finding"}
            </button>
          )}
        </span>
      </div>

      {expandable && open && employee && row.finding && (
        <div className="border-t border-line bg-surface px-2 py-6">
          <ExceptionReview employee={employee} finding={row.finding} />
        </div>
      )}
    </li>
  );
}

/** Shown where a scenario has no second run. The clean month has nothing to
 * correct, so there is nothing to recheck, and saying that is better than
 * drawing an empty comparison. */
export function NoRecheck() {
  return (
    <section aria-labelledby="concept-no-recheck">
      <h2
        id="concept-no-recheck"
        className="max-w-measure text-page font-semibold tracking-tight text-ink"
      >
        Nothing to recheck
      </h2>
      <p className="max-w-measure mt-3 text-lead text-ink-2">
        Every recorded change in this month reconciled with the register, so there was no
        correction to make and there is no second run to compare against.
      </p>
      <p className="max-w-measure mt-3 text-meta text-ink-3">
        Switch the scenario in the demo panel to see the month with findings in it.
      </p>
    </section>
  );
}
