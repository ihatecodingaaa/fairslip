"use client";

/**
 * Why this month's pay is not last month's, line by line.
 *
 * THE CLAIM IS NARROWER THAN IT LOOKS, AND THAT IS WHY IT HOLDS. FairSlip does
 * not know why anyone's pay moved. What it can show is that every dollar of the
 * movement is attributable to a line the register itself carries, that some of
 * those lines answer to a change recorded in another system, and that some of
 * them were checked against a published rule while others were not. Three
 * different facts, kept apart.
 *
 * THE BARS ARE GEOMETRY AND THE NUMBERS ARE NOT. A bar's length is derived here
 * from the magnitude of a delta; the figure beside it is a Money the fixture
 * states, formatted by the product's own money(). The two never swap roles -
 * the rule the worker's own money trail runs on, and the one
 * backend/tests/test_charts.py enforces across every surface in this app that
 * draws an amount.
 *
 * IT SUMS. selectors.bridgeFor() subtracts the two registers exactly, and
 * invariants.ts asserts the lines add up to the change in net pay. A bridge
 * that did not close would be a picture arguing for something it had not shown.
 *
 * ONE VIEW, TWO AUDIENCES. This is the screen a payroll operator uses to
 * explain a month, and it is the same screen an employee would be shown to
 * answer "why is my pay different". They need the same six rows. Building two
 * would be building two answers.
 */

import { money } from "@/lib/api";
import type { Bridge, BridgeLine } from "@/lib/concept-preflight/selectors";
import type { ConceptEmployee } from "@/lib/concept-preflight/types";
import type { RuleComparison } from "@/lib/concept-preflight/selectors";
import { StatusMark } from "./marks";

/** The shape and the word for each outcome of comparing a register line with a
 * published rule. One mapping, beside the other status mappings, so the shapes
 * on this screen mean what they mean everywhere else. */
const COMPARISON_MARK: Record<RuleComparison, "MATCHED" | "NEEDS_REVIEW" | "NOT_CHECKED"> = {
  AGREES: "MATCHED",
  DIFFERS: "NEEDS_REVIEW",
  NOT_CHECKED: "NOT_CHECKED",
};

const COMPARISON_WORD: Record<RuleComparison, string> = {
  AGREES: "Agrees with the published rule",
  DIFFERS: "Differs from the published rule",
  NOT_CHECKED: "No published rule for this line",
};

/** Absolute value, for the SHARED SCALE only. It decides how long a bar is and
 * never reaches a text position, which is the whole difference between geometry
 * and a figure. */
function magnitudeOf(line: BridgeLine): number {
  const n = Number(line.delta.exact);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export function WhatChanged({
  employee,
  bridge,
  onSelectEvent,
}: {
  employee: ConceptEmployee;
  bridge: Bridge;
  onSelectEvent: (id: string) => void;
}) {
  const scale = Math.max(...bridge.lines.map(magnitudeOf), 1);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-title font-semibold tracking-tight text-ink">
          What changed for {employee.name}
        </h3>
        <p className="font-mono text-meta text-ink-3">{employee.employee_id}</p>
      </div>

      {/* The two ends, and the gap between them. */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-4 rounded-lg border border-line bg-muted px-5 py-4">
        <End label={bridge.previous.period} value={money(bridge.previous.net.money)} />
        <span aria-hidden className="text-lead text-ink-3">
          &rarr;
        </span>
        <End label={bridge.current.period} value={money(bridge.current.net.money)} />
        <span aria-hidden className="text-lead text-ink-3">
          =
        </span>
        <End label="Change in net pay" value={money(bridge.difference)} strong />
        <p className="basis-full text-meta text-ink-3">
          Both figures are the register&apos;s own bottom line. The lines below are its own
          lines, and they add up to the change exactly.
        </p>
      </div>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {bridge.lines.map((line) => (
          <Row key={line.key} line={line} scale={scale} onSelectEvent={onSelectEvent} />
        ))}
      </ul>

      {/* The identity, said out loud. */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t-2 border-ink pt-3">
        <p className="text-body font-semibold text-ink">
          {bridge.lines.length} lines, totalling the change in net pay
        </p>
        <p className="font-mono text-lead font-semibold tabular-nums text-ink">
          {money(bridge.difference)}
        </p>
      </div>

      <p className="max-w-measure mt-4 text-meta text-ink-3">
        <span className="font-mono tabular-nums">{bridge.linkedToEvents}</span> of these lines
        answer to a change recorded in another system, and{" "}
        <span className="font-mono tabular-nums">{bridge.notLinkedToEvents}</span> do not, which
        is normal: a basic-salary line answers to nothing.{" "}
        <span className="font-mono tabular-nums">{bridge.checkedAgainstARule}</span> were checked
        against a published rule and{" "}
        <span className="font-mono tabular-nums">{bridge.notCheckedAgainstARule}</span> were not.
      </p>
    </div>
  );
}

function End({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span className="flex flex-col">
      <span
        className={`order-1 font-mono tabular-nums ${
          strong ? "text-lead font-semibold text-ink" : "text-lead text-ink-2"
        }`}
      >
        {value}
      </span>
      <span className="order-2 text-meta text-ink-3">{label}</span>
    </span>
  );
}

function Row({
  line,
  scale,
  onSelectEvent,
}: {
  line: BridgeLine;
  scale: number;
  onSelectEvent: (id: string) => void;
}) {
  const width = `${Math.min(100, (magnitudeOf(line) / scale) * 100)}%`;
  const negative = line.delta.display.startsWith("-");
  const zero = magnitudeOf(line) === 0;
  // Bound before use rather than asserted with `!`: money() takes a FIELD, never
  // an expression, and a non-null assertion is an expression. See
  // backend/tests/test_charts.py, which scans this file for exactly that.
  const before = line.previous;
  const after = line.current;

  return (
    <li className="grid items-center gap-x-6 gap-y-2 py-3 lg:grid-cols-[14rem_minmax(0,1fr)_9rem]">
      <div className="min-w-0">
        <p className="text-body font-medium text-ink">{line.label}</p>
        <p className="text-meta text-ink-3">
          {before && after ? (
            zero ? (
              "Unchanged"
            ) : (
              <>
                {money(before.money)} to {money(after.money)}
              </>
            )
          ) : after ? (
            "No such line in the earlier month"
          ) : (
            "No such line this month"
          )}
        </p>
      </div>

      {/* The bar. Left of the rule is a fall, right of it a rise. */}
      <div aria-hidden className="flex h-4 items-center">
        <span className="flex w-1/2 justify-end">
          {negative && <span className="block h-3 bg-ink-3" style={{ width }} />}
        </span>
        <span className="h-4 w-px shrink-0 bg-line-strong" />
        <span className="flex w-1/2">
          {!negative && !zero && <span className="block h-3 bg-ink-3" style={{ width }} />}
        </span>
      </div>

      <div className="flex flex-col lg:items-end">
        <span className="font-mono text-lead tabular-nums text-ink">{money(line.delta)}</span>
        {/* THE MARK IS THE OUTCOME OF A COMPARISON, NOT THE PRESENCE OF A RULE.
            An earlier version drew a filled disc against any line that had a
            rule figure beside it, including the rest-day line whose register
            figure is half what the rule gives - so the one row that does not
            reconcile wore the shape that means it does. selectors.bridgeFor()
            now compares the two and says which. */}
        <span className="flex items-center gap-2">
          <StatusMark status={COMPARISON_MARK[line.ruleComparison]} className="h-3 w-3 shrink-0" />
          <span
            className={`text-meta ${
              line.ruleComparison === "DIFFERS" ? "text-attention-fg" : "text-ink-2"
            }`}
          >
            {COMPARISON_WORD[line.ruleComparison]}
          </span>
        </span>
      </div>

      {/* The evidence for the row, at reading size, across the full width. */}
      <div className="lg:col-span-3">
        {line.ruleNote && line.ruleFigure && (
          <p className="max-w-measure text-meta text-ink-2">
            {line.ruleNote} It gives{" "}
            <span className="font-mono tabular-nums">{money(line.ruleFigure.money)}</span>.
          </p>
        )}
        {line.event_ids.length > 0 ? (
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-meta text-ink-3">Recorded changes behind this line:</span>
            {line.event_ids.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectEvent(id)}
                className="tap-sm rounded-sm border border-line-strong bg-surface px-2 py-1 font-mono text-meta text-ink-2 hover:border-ink hover:text-ink"
              >
                {id}
              </button>
            ))}
          </p>
        ) : (
          <p className="mt-1 text-meta text-ink-3">
            No recorded workforce change behind this line.
          </p>
        )}
      </div>
    </li>
  );
}

/** Shown where the export carries no earlier month for this person. A joiner has
 * no previous month, and that is a fact rather than a gap. */
export function NoPriorMonth({ employee }: { employee: ConceptEmployee }) {
  return (
    <div className="rounded-sm border border-missing-line bg-missing-bg p-5">
      <p className="text-meta font-semibold uppercase tracking-wide text-missing-fg">
        No earlier month
      </p>
      <p className="max-w-measure mt-2 text-meta text-ink-2">
        The prior payroll register in this concept carries no row for {employee.name}. Where an
        employee joined during the month there is nothing to compare, and where the prototype
        simply did not write an earlier month it says so rather than showing a comparison
        against zero.
      </p>
    </div>
  );
}
