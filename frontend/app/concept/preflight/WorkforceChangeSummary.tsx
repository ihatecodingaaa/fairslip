"use client";

/**
 * What happened at work this month, before anything is said about pay.
 *
 * THIS IS THE HALF OF THE PRODUCT'S ARGUMENT THAT USUALLY GOES UNSAID. The
 * systems a company already runs know that someone worked a rest day, took
 * unpaid leave, joined on the 22nd or crossed a contribution band. None of that
 * is news to them. The question the next screen asks is whether each of these
 * became the right outcome inside payroll, and that question only lands if a
 * reader has first seen how many of them there are.
 *
 * GROUPED BY THE EXPORT EACH ONE CAME FROM, because that is the shape of the
 * integration a pilot would actually build, and because it makes the answer to
 * "where would this data come from" visible rather than asked.
 *
 * EVERY NUMBER IS COUNTED. selectors.workforceChanges() sums the records the
 * fixture holds; invariants.ts re-counts them a second way and fails if the two
 * disagree. None of these figures is written down anywhere.
 */

import { EVENT_LABEL, type ChangeGroup } from "@/lib/concept-preflight/selectors";

export function WorkforceChangeSummary({
  groups,
  total,
}: {
  groups: ChangeGroup[];
  total: number;
}) {
  return (
    <section aria-labelledby="concept-changes" className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line-strong pb-2">
        <h2
          id="concept-changes"
          className="text-meta font-semibold uppercase tracking-wide text-ink-3"
        >
          Workforce changes this month
        </h2>
        <p className="text-meta text-ink-3">
          <span className="font-mono tabular-nums">{total}</span> records, already in the
          company&apos;s own systems
        </p>
      </div>

      <div className="mt-5 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.system} className="min-w-0">
            <p className="flex items-baseline gap-3">
              <span className="font-mono text-title font-semibold tabular-nums text-ink">
                {group.total}
              </span>
              <span className="text-body font-semibold text-ink-2">{group.label}</span>
            </p>
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {group.kinds.map((kind) => (
                <li
                  key={kind.type}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <span className="text-meta text-ink-2">{EVENT_LABEL[kind.type]}</span>
                  <span className="font-mono text-meta tabular-nums text-ink">{kind.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
