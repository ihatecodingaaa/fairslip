"use client";

/**
 * A row nobody computed, given as much room as a finding.
 *
 * THIS IS THE STRONGEST THING IN THE CONCEPT AND IT IS THE EASIEST TO SKIP.
 * Every payroll tool in the world can produce a list of exceptions. What almost
 * none of them will tell you is which rows they did not look at, because saying
 * so makes the headline smaller. Seven of these three hundred were never
 * computed, and if they were quietly folded into "ready" the summary would be
 * making a claim about rows nobody examined.
 *
 * THREE THINGS, IN THIS ORDER. Why not, what happens next, and the figures that
 * were NOT checked - shown, because withholding them would be a second way of
 * deciding for the reader what they may know. The register is on the screen with
 * every line marked as unchecked rather than absent.
 *
 * THE REASONS ARE THE ENGINES' OWN. "Secondary sources conflict on the Year-2
 * employer rate and it was never verified against CPF Table 3" is what
 * fairslip/cpf.py says when it refuses, not a paraphrase written for a slide.
 */

import { money } from "@/lib/api";
import type { ConceptEmployee } from "@/lib/concept-preflight/types";
import { NOT_CHECKED_NEXT } from "@/lib/concept-preflight/people";
import { StatusMark } from "./marks";

export function NotCheckedCase({ employee }: { employee: ConceptEmployee }) {
  const next = NOT_CHECKED_NEXT[employee.employee_id];
  const register = employee.detail?.current ?? null;

  return (
    <article>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="flex items-center gap-2">
          <StatusMark status="NOT_CHECKED" className="h-4 w-4" />
          <span className="text-meta font-semibold uppercase tracking-wide text-missing-fg">
            Not checked
          </span>
        </span>
        <p className="text-meta text-ink-3">
          {employee.name}, {employee.employee_id}
        </p>
      </div>

      <h3 className="mt-2 max-w-measure text-title font-semibold tracking-tight text-ink">
        Nothing on this row was computed, and it is not reported as correct
      </h3>

      <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">Why not</p>
          <p className="max-w-measure mt-2 text-body text-ink-2">
            {employee.not_checked_reason}
          </p>

          <p className="mt-6 text-meta font-semibold uppercase tracking-wide text-ink-3">
            What happens next
          </p>
          <p className="max-w-measure mt-2 text-body text-ink-2">{next}</p>

          <p className="max-w-measure mt-6 rounded-sm border border-line-strong bg-muted px-4 py-3 text-meta text-ink-2">
            Unknown is not zero, and not checked is not matched. This row is in the count of
            three hundred, in its own total on the overview, in the grid as a hollow diamond,
            and in the recheck as a row that was uncheckable both times. It is nowhere in the
            money.
          </p>
        </div>

        {register && (
          <div className="min-w-0">
            <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
              What the register states, unchecked
            </p>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {register.lines.map((l) => (
                <li key={l.key} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="min-w-0 text-body text-ink-2">{l.label}</span>
                  <span className="font-mono text-body tabular-nums text-ink">
                    {money(l.amount.money)}
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-body font-semibold text-ink">Net pay</span>
                <span className="font-mono text-lead font-semibold tabular-nums text-ink">
                  {money(register.net.money)}
                </span>
              </li>
            </ul>
            <p className="mt-2 break-all font-mono text-meta text-ink-3">
              {register.source.file}
              {register.source.row !== null ? ` row ${register.source.row}` : ""}
            </p>
            <p className="max-w-measure mt-2 text-meta text-ink-3">
              These figures are on the screen because they are what a reviewer has to look at.
              None of them was compared with anything.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
