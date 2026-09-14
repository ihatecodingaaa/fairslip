"use client";

/**
 * The first screen, and the five seconds it has.
 *
 * WHAT IT REPLACED, AND WHY. The opening used to be an editorial headline -
 * "Before the money leaves, know what doesn't reconcile" - set at display size
 * over two lines. It is a good sentence and it cost the whole of the first
 * screen: at 1440x900 the counts sat at the fold, the money was below it, and
 * the first row anyone could act on was two scrolls down. A payroll operator
 * opening this the day before the money leaves is not there to read an argument
 * for the product. They are there to find out whether they can release.
 *
 * SO THE ORDER IS: HOW READY, THEN WHAT IT COSTS, THEN WHO TO OPEN. Three
 * blocks, no prose between them, and the third is a list of people with buttons
 * on it. Everything that used to explain the product moved either into the
 * footer, which is where a reader looks for it, or behind the disclosures on
 * the screens that need it.
 *
 * THE PERCENTAGE IS THE SHAPE AND THE COUNTS ARE THE CLAIM. 94% is what a
 * finance director reads across a room; 282 / 11 / 7 is what an operator works
 * from, and it is drawn at the same size beside it rather than under it. The
 * percentage is floored, so it never rounds up into a readiness nobody has.
 *
 * NOTHING HERE IS WRITTEN DOWN. Every figure is counted from the fixture by
 * selectors.ts or ordered by priority.ts, on every render.
 */

import { money, type Money } from "@/lib/api";
import type { Overview } from "@/lib/concept-preflight/selectors";
import { readyPercent, topOfQueue, type QueueItem } from "@/lib/concept-preflight/priority";
import { STATUS_WORD } from "@/lib/concept-preflight/selectors";
import type { Company, ConceptEmployee, PayPeriod } from "@/lib/concept-preflight/types";
import { StatusMark, statusToneClass } from "./marks";

export function CommandCentre({
  company,
  period,
  overview,
  employees,
  onOpen,
  onViewAll,
  brief,
}: {
  company: Company;
  period: PayPeriod;
  overview: Overview;
  employees: ConceptEmployee[];
  onOpen: (employeeId: string, findingId: string | null) => void;
  onViewAll: () => void;
  /** The FairSlip Brief, rendered by the page so this file calls no model. */
  brief: React.ReactNode;
}) {
  const { status, money: under } = overview;
  const percent = readyPercent(status.matched, status.total);
  const queue = topOfQueue(employees, 3);
  const attention = status.needsReview + status.notChecked;

  return (
    <section aria-labelledby="concept-hero">
      {/* ------------------------------------------------------ the month */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h1 id="concept-hero" className="text-title font-semibold tracking-tight text-ink">
          Payroll preflight
        </h1>
        <p className="text-lead font-medium text-ink">{period.label}</p>
        <p className="text-lead text-ink-2">Payroll closes tomorrow</p>
        <p className="text-meta text-ink-3">
          <span className="font-mono tabular-nums">{company.headcount}</span> employees, paying{" "}
          {period.payday}
        </p>
      </div>

      {/* --------------------------------------------------- how ready */}
      <div className="mt-6 grid items-start gap-x-10 gap-y-8 rounded-lg border border-line-strong bg-surface px-6 py-6 shadow-card lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <p className="flex flex-col">
            <span className="font-mono text-display font-semibold leading-none tabular-nums text-ink">
              {percent}%
            </span>
            <span className="mt-1 text-body font-semibold uppercase tracking-wide text-ink-2">
              Ready
            </span>
          </p>
          <dl className="flex flex-col gap-2">
            <Tally status="MATCHED" value={status.matched} label="ready" />
            <Tally status="NEEDS_REVIEW" value={status.needsReview} label="need review" strong />
            <Tally status="NOT_CHECKED" value={status.notChecked} label="not checked" />
          </dl>
        </div>

        {/* ------------------------------------------- what it comes to */}
        {/* A MONTH WITH NO FINDINGS HAS NO TOTAL, AND SAYS SO RATHER THAN
            DRAWING ZERO. The sum of an empty list is zero, and "$0.00 below the
            published rules" is a claim that FairSlip priced something and found
            nothing - which is a different statement from "there was nothing to
            price". selectors.ts warns about exactly this: the callers that would
            display an empty sum must check the list was not empty first. */}
        <div className="min-w-0 border-line-strong lg:border-l lg:pl-10">
          <h2 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            Known differences
          </h2>
          {under.belowCount + under.aboveCount + under.withoutComputedDifference === 0 ? (
            <p className="max-w-measure mt-3 text-body text-ink-2">
              No findings this month, so there is no difference to report in either direction.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
                {under.belowCount > 0 && (
                  <Direction
                    arrow="↓"
                    amount={under.below}
                    count={under.belowCount}
                    label="below the published rules"
                  />
                )}
                {under.aboveCount > 0 && (
                  <Direction
                    arrow="↑"
                    amount={under.above}
                    count={under.aboveCount}
                    label="above them"
                  />
                )}
              </div>
              <p className="max-w-measure mt-3 text-meta text-ink-2">
                {under.belowCount > 0 && under.aboveCount > 0
                  ? "Two directions, never netted against each other. "
                  : ""}
                <span className="font-mono tabular-nums">
                  {under.withoutComputedDifference}
                </span>{" "}
                findings carry no computed amount and are not counted as zero.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ the brief */}
      <div className="mt-6">{brief}</div>

      {/* -------------------------------------------------- who to open */}
      <section aria-labelledby="concept-needs-you" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line-strong pb-2">
          <h2
            id="concept-needs-you"
            className="text-meta font-semibold uppercase tracking-wide text-ink-3"
          >
            Needs you
          </h2>
          {attention > 0 && (
            <button
              type="button"
              onClick={onViewAll}
              className="tap-sm rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              View all {attention}
            </button>
          )}
        </div>
        {queue.length === 0 ? (
          <p className="max-w-measure mt-3 text-body text-ink-2">
            Nothing needs a person. Every recorded change reconciled with the register, and every
            amount a rule pack covers agrees with it.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {queue.map((item) => (
              <li key={`${item.employee.employee_id}-${item.finding?.finding_id ?? "none"}`}>
                <QueueRow item={item} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

/**
 * One row of the queue, drawn the same way wherever the queue is drawn.
 *
 * THE ORDER ACROSS THE ROW IS THE ORDER OF THE QUESTIONS. Who, what, how much,
 * where, and then the button. The amount sits in a fixed column so a reader can
 * run an eye down it, and a row with no computed amount says so in that column
 * rather than leaving it empty - an empty money column reads as zero.
 */
export function QueueRow({
  item,
  onOpen,
}: {
  item: QueueItem;
  onOpen: (employeeId: string, findingId: string | null) => void;
}) {
  const finding = item.finding;
  // A MAGNITUDE AND A WORD, NEVER A SIGNED FIGURE BESIDE THE WORD. The engine's
  // difference is signed, so drawing it next to "above rule" produced
  // "-$518.00 above rule": the direction stated twice and contradicted once.
  // priority.ts exposes the size as a field and the direction as an enum.
  const size = item.knownImpact;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.employee.employee_id, finding ? finding.finding_id : null)}
      className="tap grid w-full grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 px-2 py-3 text-left hover:bg-muted sm:grid-cols-[1.25rem_minmax(0,15.5rem)_minmax(0,8.5rem)_7rem_5rem_minmax(0,8rem)_4.5rem]"
    >
      <StatusMark status={item.status} className="mt-1 h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate text-body font-semibold text-ink">
        {item.employee.name}
      </span>
      <span className="min-w-0 text-meta text-ink-2">{item.subject}</span>
      <span className="text-right font-mono text-body tabular-nums text-ink">
        {size ? money(size) : ""}
      </span>
      <span className="text-meta text-ink-3">
        {size ? (
          item.direction === "BELOW_RULE" ? "below rule" : "above rule"
        ) : (
          <span className="text-missing-fg">
            {item.status === "NOT_CHECKED" ? "not checked" : "no amount"}
          </span>
        )}
      </span>
      <span className="min-w-0 truncate text-meta text-ink-3">{item.employee.location}</span>
      <span className={`text-meta font-semibold ${statusToneClass(item.status)}`}>
        {item.status === "NOT_CHECKED" ? "Inspect" : "Review"}
      </span>
      <span className="sr-only">
        {item.employee.employee_id}. {STATUS_WORD[item.status]}.
      </span>
    </button>
  );
}

function Tally({
  status,
  value,
  label,
  strong,
}: {
  status: "MATCHED" | "NEEDS_REVIEW" | "NOT_CHECKED";
  value: number;
  label: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dd
        className={`flex items-baseline gap-2 font-mono text-lead tabular-nums ${
          strong ? "font-semibold text-ink" : "text-ink-2"
        }`}
      >
        <StatusMark status={status} className="h-4 w-4 shrink-0 translate-y-0.5" />
        {value}
      </dd>
      <dt className="text-body text-ink-2">{label}</dt>
    </div>
  );
}

function Direction({
  arrow,
  amount,
  count,
  label,
}: {
  arrow: string;
  amount: Money;
  count: number;
  label: string;
}) {
  return (
    <p className="flex min-w-0 flex-col">
      <span className="font-mono text-title font-semibold tabular-nums text-ink">
        <span aria-hidden className="mr-1 text-ink-3">
          {arrow}
        </span>
        {money(amount)}
      </span>
      <span className="text-meta text-ink-2">
        {label}, <span className="font-mono tabular-nums">{count}</span> findings
      </span>
    </p>
  );
}
