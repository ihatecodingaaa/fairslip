"use client";

/**
 * One finding, in full, and the boundary the concept will not cross.
 *
 * PREPARE CORRECTION CHANGES NOTHING. It opens a panel describing a change, and
 * the panel says so in as many words. There is no payroll system here to write
 * to, and there would not be one in a first pilot either: the product that
 * earns a place in a payroll team's week is the one that finds things, not the
 * one that edits the file behind them.
 *
 * THE SECOND ACTION IS DISABLED AND SAYS WHY. A button labelled "Open payroll
 * system" that opened nothing, or opened a fake, would be the one piece of
 * theatre on these screens. It sits there inert with a sentence under it,
 * because the shape of the workflow is worth showing and the connection is not
 * worth pretending.
 *
 * COPYING IS A REAL ACTION AND IT REPORTS TRUTHFULLY. The clipboard can be
 * blocked by the browser, and when it is, this says the copy did not happen and
 * puts the text on the screen to select instead. A "Copied" that appears
 * whether or not anything was copied is the honesty defect this whole product
 * is an argument against, in miniature.
 */

import { useState } from "react";
import { money } from "@/lib/api";
import type { ConceptEmployee, ConceptFinding } from "@/lib/concept-preflight/types";
import { FINDING_SOURCE_LABEL, SOURCE_LABEL } from "@/lib/concept-preflight/selectors";
import { Amount, NotChecked, OriginTag, Workings } from "./Amount";
import { ControlBoundary } from "./ControlBoundary";

/** The finding as text, for a reviewer to paste into wherever they work. Built
 * from the fixture's own strings and figures; it states nothing the screen does
 * not. */
function asText(employee: ConceptEmployee, finding: ConceptFinding): string {
  const lines = [
    `FairSlip Preflight finding ${finding.finding_id}`,
    `${employee.name} (${employee.employee_id}), ${employee.role}, ${employee.location}`,
    "",
    finding.headline,
    finding.detail,
    "",
  ];
  if (finding.expected) {
    lines.push(`Published rule gives: ${money(finding.expected.money)}`);
  }
  if (finding.payroll) lines.push(`Payroll states: ${money(finding.payroll.money)}`);
  if (finding.difference) {
    lines.push(`Difference: ${money(finding.difference.money)}`);
  } else if (finding.no_difference_reason) {
    lines.push(`No computed difference: ${finding.no_difference_reason}`);
  }
  if (finding.rule) {
    lines.push("", `${finding.rule.authority}: "${finding.rule.quote}"`, finding.rule.url);
  }
  lines.push(
    "",
    "From a FairSlip Preflight concept prototype. Fictional data. Not a deployed check.",
  );
  return lines.join("\n");
}

export function ExceptionReview({
  employee,
  finding,
}: {
  employee: ConceptEmployee;
  finding: ConceptFinding;
}) {
  const [preparing, setPreparing] = useState(false);

  return (
    <article className="border-t border-line-strong pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-mono text-meta text-ink-3">{finding.finding_id}</p>
        <p className="rounded-sm border border-line-strong bg-sunken px-2 py-1 text-meta font-medium text-ink-2">
          {FINDING_SOURCE_LABEL[finding.source]}
        </p>
        <p className="text-meta text-ink-3">
          {employee.name}, {employee.employee_id}
        </p>
      </div>

      <h3 className="mt-2 max-w-measure text-title font-semibold tracking-tight text-ink">
        {finding.headline}
      </h3>
      <p className="max-w-measure mt-2 text-body text-ink-2">{finding.detail}</p>

      {/* ------------------------------------------------------ the figures */}
      <div className="mt-6 flex flex-wrap items-start gap-x-12 gap-y-6">
        {finding.expected && (
          <Amount amount={finding.expected} label="What the published rule gives" size="title" />
        )}
        {finding.payroll && (
          <span className="flex min-w-0 flex-col">
            <span className="text-meta text-ink-3">What payroll says</span>
            <span className="font-mono text-title tabular-nums text-ink">
              {money(finding.payroll.money)}
            </span>
            <OriginTag amount={finding.payroll} />
          </span>
        )}
        {finding.difference && (
          <Amount amount={finding.difference} label="Difference" size="title" strong />
        )}
      </div>

      {!finding.difference && finding.no_difference_reason && (
        <NotChecked why={finding.no_difference_reason} className="mt-5 max-w-measure" />
      )}

      {/* Two rule answers and no established fact to choose between them. */}
      {finding.alternatives.length > 0 && (
        <div className="mt-6 rounded-lg border border-attention-line bg-attention-bg p-5">
          <p className="text-meta font-semibold uppercase tracking-wide text-attention-fg">
            The rule gives two answers here
          </p>
          <div className="mt-3 flex flex-wrap gap-x-12 gap-y-5">
            {finding.alternatives.map((alt) => (
              <Amount key={alt.label} amount={alt.amount} label={alt.label} size="lead" />
            ))}
          </div>
          <p className="max-w-measure mt-3 text-meta text-attention-fg">
            Showing one of them would be FairSlip deciding, on your behalf, a fact none of your
            exports record. Both are shown and neither is a difference.
          </p>
        </div>
      )}

      {finding.workings.length > 0 && (
        <div className="mt-6">
          <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            What it was built from
          </p>
          <div className="mt-2 flex flex-wrap gap-x-10 gap-y-4">
            {finding.workings.map((w) => (
              <Amount key={w.label} amount={w.amount} label={w.label} size="body" />
            ))}
          </div>
        </div>
      )}

      {/* The decomposition that keeps a wage and the CPF on it from being
          added together. Every label here is a field of shortfall_split(). */}
      {finding.split && (
        <div className="mt-6 rounded-lg border border-line-strong bg-muted p-5">
          <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            What the difference is made of
          </p>
          <div className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
            <Amount amount={finding.split.gross} label="The wage that was not paid" size="body" />
            <Amount amount={finding.split.cash} label="Cash missing from the bank" size="body" />
            <Amount amount={finding.split.cpf} label="CPF missing from the account" size="body" />
            <Amount
              amount={finding.split.employerShare}
              label="Of which the employer's share"
              size="body"
            />
            <Amount amount={finding.split.total} label="Total withheld" size="body" strong />
          </div>
          <p className="max-w-measure mt-3 text-meta text-ink-2">{finding.split.note}</p>
        </div>
      )}

      {finding.expected && <Workings amount={finding.expected} />}

      {/* ---------------------------------------------------- the boundary */}
      {finding.proposed_correction ? (
        <div className="mt-8">
          {!preparing ? (
            <button
              type="button"
              onClick={() => setPreparing(true)}
              className="tap rounded-sm border-2 border-ink bg-surface px-5 py-3 text-body font-semibold text-ink"
            >
              Prepare correction
            </button>
          ) : (
            <ProposedCorrection
              employee={employee}
              finding={finding}
              onClose={() => setPreparing(false)}
            />
          )}
        </div>
      ) : (
        <p className="max-w-measure mt-8 rounded-sm border border-line-strong bg-muted px-4 py-3 text-meta text-ink-2">
          There is no correction to prepare for this finding. What does not reconcile here is a
          record rather than an amount, so the next step is a person deciding which record is
          right, in the system that owns it.
        </p>
      )}
    </article>
  );
}

function ProposedCorrection({
  employee,
  finding,
  onClose,
}: {
  employee: ConceptEmployee;
  finding: ConceptFinding;
  onClose: () => void;
}) {
  const [copy, setCopy] = useState<"idle" | "done" | "blocked">("idle");
  const correction = finding.proposed_correction;
  if (!correction) return null;
  const text = asText(employee, finding);

  return (
    <section
      aria-label="Proposed change"
      className="rounded-lg border-2 border-ink bg-surface p-5 shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h4 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          Proposed change
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="tap-sm rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          Close
        </button>
      </div>

      <p className="mt-3 text-body font-semibold text-ink">{correction.line}</p>
      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-4">
        <Amount amount={correction.from} label="Now" size="title" />
        <span aria-hidden className="mt-6 text-title text-ink-3">
          &rarr;
        </span>
        <Amount amount={correction.to} label="Would become" size="title" strong />
      </div>
      <p className="max-w-measure mt-4 text-meta text-ink-2">{correction.note}</p>

      {/* The sentence this whole panel exists to carry. */}
      <div className="mt-6 rounded-sm border border-line-strong bg-muted px-4 py-3">
        <p className="text-body font-semibold text-ink">FairSlip will not change payroll.</p>
        <p className="max-w-measure mt-1 text-meta text-ink-2">
          Review this finding in your payroll system, make the correction there, then recheck it
          in FairSlip.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopy("done");
            } catch {
              // The browser refused, or there is no clipboard permission. Say so.
              setCopy("blocked");
            }
          }}
          className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid"
        >
          Copy finding
        </button>
        <button
          type="button"
          disabled
          className="tap cursor-not-allowed rounded-sm border border-control bg-sunken px-5 py-3 text-body font-semibold text-ink-3"
        >
          Open payroll system
        </button>
      </div>
      <p className="max-w-measure mt-2 text-meta text-ink-3">
        Payroll system integration is not connected in this concept, so that second button does
        nothing and is disabled rather than made to look live.
      </p>

      <p role="status" aria-live="polite" className="mt-3 text-meta text-ink-2">
        {copy === "done"
          ? "Copied to the clipboard."
          : copy === "blocked"
            ? "The browser did not allow copying. The text is below to select instead."
            : ""}
      </p>
      {copy === "blocked" && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-muted p-3 font-mono text-meta text-ink-2">
          {text}
        </pre>
      )}

      <ControlBoundary className="mt-8 border-t border-line pt-6" />
    </section>
  );
}

/** The source rows a finding rests on, listed. Used by the findings lens so a
 * reviewer can go and look at the same rows in their own files. */
export function SourceRows({ employee }: { employee: ConceptEmployee }) {
  const events = employee.detail?.events ?? [];
  if (events.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">Source records</p>
      <ul className="mt-2 space-y-1">
        {events.map((event) => (
          <li key={event.event_id} className="break-all font-mono text-meta text-ink-3">
            {SOURCE_LABEL[event.source.system]}, {event.source.file}
            {event.source.row !== null ? ` row ${event.source.row}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
