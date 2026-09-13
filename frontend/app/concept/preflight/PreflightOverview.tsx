"use client";

/**
 * The opening screen, and the three sentences it has to land.
 *
 *   1. There is a deadline. The money leaves tomorrow.
 *   2. Most of it reconciles. Some of it does not.
 *   3. Some of it was NOT LOOKED AT, and that is a third thing rather than a
 *      shade of the second.
 *
 * THE HEADLINE FIGURE IS A COUNT, NOT AN AMOUNT. A dollar total at the top of a
 * preflight would be the wrong promise: what an operator can act on the day
 * before payroll closes is a list of rows to look at, and the money is a
 * property of some of those rows rather than the answer. Two of the eleven
 * findings here carry no amount at all and are no less real for it.
 *
 * MONEY IS REPORTED IN TWO DIRECTIONS AND NEVER NETTED. $155.50 below the
 * published rules and $644.00 above them is not a $488.50 problem; those are two
 * different conversations with two different people. The third figure beside
 * them is the count of findings that carry no amount, which is the number a
 * summary usually loses.
 */

import type { Overview } from "@/lib/concept-preflight/selectors";
import type { Company, PayPeriod } from "@/lib/concept-preflight/types";
import { money } from "@/lib/api";
import { StatusMark } from "./marks";

export function PreflightOverview({
  company,
  period,
  overview,
}: {
  company: Company;
  period: PayPeriod;
  overview: Overview;
}) {
  const { status, money: under } = overview;

  return (
    <section aria-labelledby="concept-hero">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        FairSlip Preflight
      </p>
      <h1
        id="concept-hero"
        className="mt-2 max-w-measure text-hero font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-display"
      >
        Before the money leaves, know what doesn&apos;t reconcile.
      </h1>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="text-lead font-medium text-ink">{period.label}</p>
        <p className="text-lead text-ink-2">Payroll closes tomorrow</p>
        <p className="text-lead text-ink-2">
          <span className="font-mono tabular-nums">{company.headcount}</span> employees
        </p>
      </div>
      <p className="max-w-measure mt-2 text-meta text-ink-3">
        {/* The name already ends in a full stop. Joining it to the next sentence
            with one of this file's own produced "Pte. Ltd..", which is the kind
            of thing nobody sees until it is on a projector. */}
        {company.name} {company.what} Run on {period.today}, closing {period.closes}, paying{" "}
        {period.payday}.
      </p>

      {/* ------------------------------------------------------- the counts */}
      <div className="mt-10 border-t border-line-strong pt-6">
        <h2 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          Payroll preflight
        </h2>
        <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-6">
          <Count
            status="MATCHED"
            value={status.matched}
            label="Ready"
            note="The recorded changes and the register agree."
          />
          <Count
            status="NEEDS_REVIEW"
            value={status.needsReview}
            label="Need review"
            note="Something does not reconcile."
            strong
          />
          <Count
            status="NOT_CHECKED"
            value={status.notChecked}
            label="Not checked"
            note="Outside what FairSlip's rule packs cover. Not assumed to be right."
          />
        </dl>
        <p className="max-w-measure mt-5 text-meta text-ink-3">
          The headline is a claim about the{" "}
          <span className="font-mono tabular-nums">{status.checked}</span> rows that were
          checked. The other <span className="font-mono tabular-nums">{status.notChecked}</span>{" "}
          are on this screen rather than missing from it, because a row quietly absent from a
          findings list reads exactly like a clean one.
        </p>
      </div>

      {/* ------------------------------------------------- money under review */}
      <div className="mt-10 grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <h2 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            Money under review
          </h2>
          <div className="mt-4 flex flex-wrap gap-x-12 gap-y-6">
            <Direction
              amount={money(under.below)}
              count={under.belowCount}
              label="Below the published rules"
              note="The register states less than MOM's or CPF Board's rates give."
            />
            <Direction
              amount={money(under.above)}
              count={under.aboveCount}
              label="Above them"
              note="The register states more. Reported separately, never subtracted."
            />
          </div>
          <p className="max-w-measure mt-5 rounded-sm border border-missing-line bg-missing-bg px-3 py-2 text-meta text-ink-2">
            <span className="font-mono tabular-nums">{under.withoutComputedDifference}</span> of
            the findings carry no computed amount, because no rule pack covers the figure or no
            established fact settles which rule applies. They are not counted as zero and they
            are not counted here.
          </p>
        </div>

        <div className="min-w-0">
          <h2 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            Needs review by source
          </h2>
          {overview.bySource.length > 0 ? (
            <>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {overview.bySource.map((row) => (
                  <li key={row.source} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="text-body text-ink-2">{row.label}</span>
                    <span className="font-mono text-lead font-semibold tabular-nums text-ink">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-meta text-ink-3">
                Which system&apos;s records the finding is about, not who is at fault.
              </p>
            </>
          ) : (
            <p className="max-w-measure mt-4 text-body text-ink-2">
              Nothing to break down. Every recorded change in this month reconciled with the
              register.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Count({
  status,
  value,
  label,
  note,
  strong,
}: {
  status: "MATCHED" | "NEEDS_REVIEW" | "NOT_CHECKED";
  value: number;
  label: string;
  note: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      {/* A description list may hold dt and dd and nothing else, so the note is
          a second dd rather than a paragraph, and the reading order is set with
          `order` so the figure still comes first on the screen. */}
      <dd
        className={`order-1 flex items-center gap-3 font-mono tabular-nums ${
          strong ? "text-page font-semibold text-ink" : "text-page font-medium text-ink-2"
        }`}
      >
        <StatusMark status={status} className="h-5 w-5 shrink-0" />
        {value}
      </dd>
      <dt className="order-2 text-body font-semibold text-ink">{label}</dt>
      <dd className="order-3 max-w-measure text-meta text-ink-3">{note}</dd>
    </div>
  );
}

function Direction({
  amount,
  count,
  label,
  note,
}: {
  amount: string;
  count: number;
  label: string;
  note: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="order-1 font-mono text-title font-semibold tabular-nums text-ink">
        {amount}
      </span>
      <span className="order-2 text-body font-semibold text-ink">{label}</span>
      <span className="order-3 text-meta text-ink-3">
        across <span className="font-mono tabular-nums">{count}</span> findings. {note}
      </span>
    </div>
  );
}
