"use client";

/**
 * What kind of difference this payroll has, and how much money sits behind each.
 *
 * THE COUNT AND THE MONEY ARE DIFFERENT FINDINGS, and a screen that showed only
 * the first would rank a payroll wrongly: four rows of a rounding error and two
 * rows above the wage ceiling are two counts of the same order and two amounts
 * that are not. Both bars are drawn - rows on one scale, money on another - and
 * both are labelled, because a proportional bar with no number beside it is a
 * shape asking to be believed.
 *
 * NEITHER NUMBER IS COMPUTED HERE. `count`, `checked_rows` and
 * `signed_difference_total` are fields of the engine's own ReasonAggregate. The
 * only thing this file derives is the LENGTH of a bar, which is geometry.
 *
 * A REASON THAT ONLY EVER REFUSED SHOWS NO MONEY AT ALL. `checked_rows === 0`
 * means nothing was computed for any of those rows, and $0.00 beside them would
 * read as rows that were checked and came out level. They get the row count and
 * the words "not checked, no amount" instead - which is the same distinction the
 * skyline draws by putting them in their own lane.
 *
 * SELECTING ONE FILTERS THE OTHER TWO LENSES AND REMOVES NOTHING. The grid and
 * the skyline keep every mark; the ones that do not carry the reason lose their
 * emphasis. A filter that deleted rows would answer a different question from
 * the one the coverage strip above it answers.
 */

import { money, type ReasonAggregate } from "@/lib/api";
import { T, useT } from "../ui/Prefs";
import { REASON_WORDS } from "./reasons";

/** Magnitude of a Money, for BAR LENGTH only. Never reaches a text position. */
function magnitude(m: { exact: string }): number {
  const n = Number(m.exact);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export function ReasonBars({
  reasons,
  active,
  onPick,
}: {
  reasons: ReasonAggregate[];
  active: string | null;
  onPick: (reason: string | null) => void;
}) {
  const t = useT();
  if (reasons.length === 0) return null;

  const maxRows = reasons.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const maxMoney = reasons.reduce((m, r) => Math.max(m, magnitude(r.signed_difference_total)), 0);

  return (
    <div>
      <ul aria-label={t("employer.reasonsHeading")} className="divide-y divide-line">
        {reasons.map((r) => {
          const on = active === r.reason_code;
          const computed = r.checked_rows > 0;
          const moneyWidth =
            computed && maxMoney > 0
              ? Math.max(2, (magnitude(r.signed_difference_total) / maxMoney) * 100)
              : 0;
          return (
            <li key={r.reason_code}>
              <button
                type="button"
                onClick={() => onPick(on ? null : r.reason_code)}
                aria-pressed={on}
                className={`tap block w-full px-3 py-3 text-left ${
                  on ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span
                    className={`text-body ${on ? "font-semibold text-ink" : "text-ink"}`}
                  >
                    {t(REASON_WORDS[r.reason_code] ?? "employer.reasonUnknown")}
                  </span>
                  <span className="font-mono text-meta tabular-nums text-ink-3">
                    <T k="employer.reasonRows" vars={{ n: r.count }} />
                  </span>
                </span>

                {/* Rows. The lighter of the two bars, because the money is what
                    ranks the payroll and the count is the context for it. */}
                <span
                  aria-hidden
                  className="mt-2 block h-1.5 rounded-sm bg-sunken"
                >
                  <span
                    className="block h-full rounded-sm bg-ink-3"
                    style={{ width: `${(r.count / maxRows) * 100}%` }}
                  />
                </span>

                <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4">
                  {computed ? (
                    <>
                      <span
                        aria-hidden
                        className="block h-2.5 min-w-[2px] flex-1 rounded-sm bg-sunken"
                      >
                        <span
                          className="block h-full rounded-sm bg-attention-fg"
                          style={{ width: `${moneyWidth}%` }}
                        />
                      </span>
                      <span className="font-mono text-body font-semibold tabular-nums text-ink">
                        {money(r.signed_difference_total)}
                      </span>
                    </>
                  ) : (
                    <span className="text-meta text-ink-3">
                      <T k="employer.reasonNotChecked" />
                    </span>
                  )}
                </span>

                {/* The engine's own code, smallest thing on the row. It is here
                    for the person who wants to look it up and for nobody else. */}
                <span className="mt-1 block break-all font-mono text-meta text-ink-3">
                  {r.reason_code}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {active && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="tap-sm mt-3 rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink"
        >
          <T k="employer.filterAll" />
        </button>
      )}
    </div>
  );
}
