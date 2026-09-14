"use client";

/**
 * One finding, and the boundary the concept will not cross.
 *
 * WHAT CHANGED, AND WHY. Everything on this page used to be open at once: the
 * three figures, the intermediate workings, the CPF decomposition, the engine's
 * formula, the facts it consumed, the authority's sentence, the source rows,
 * and a four-step diagram of who does what. All of it is worth having and none
 * of it is worth reading before the reader knows what the finding IS. So the
 * first screen is now four things - who, what happened, what payroll says, what
 * the rule gives - and the rest is behind folds that say what is inside them.
 *
 * NOTHING WAS DELETED. Not one row of evidence, not one quote, not one formula.
 * A product whose whole argument is that a figure must be checkable does not
 * get to make the checking harder to reach; it gets to stop putting it in front
 * of the answer. Disclosure.tsx carries the reasoning.
 *
 * PREPARE CORRECTION STILL CHANGES NOTHING. It opens a panel describing a
 * change, and the panel says so. The second button is inert and says why. A
 * copy that could not reach the clipboard reports that it could not, rather
 * than flashing "Copied" over a failure - the honesty defect this whole product
 * is an argument against, in miniature.
 */

import { useState } from "react";
import { money } from "@/lib/api";
import type { ConceptEmployee, ConceptFinding } from "@/lib/concept-preflight/types";
import { EVENT_LABEL, FINDING_SOURCE_LABEL, SOURCE_LABEL } from "@/lib/concept-preflight/selectors";
import { Amount, EngineDetail, NotChecked, OriginTag, RuleDetail } from "./Amount";
import { ControlBoundary } from "./ControlBoundary";
import { Disclosure } from "./Disclosure";
import { ExplainFinding } from "./FairSlipBrief";
import { StatusMark } from "./marks";
import type { ScenarioId } from "@/lib/concept-preflight/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Sep" from "2026-09-14". Written out rather than taken from
 * toLocaleDateString, which resolves against the machine's locale and would make
 * a screenshot depend on whose laptop took it. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

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
  scenario,
  showWho = true,
}: {
  employee: ConceptEmployee;
  finding: ConceptFinding;
  /** Present on the findings view, absent inside the recheck rows, where the
   * Brief has its own button at the top of the screen. */
  scenario?: ScenarioId;
  /**
   * Whether to name the person above the finding.
   *
   * FALSE INSIDE THE EMPLOYEE VIEW, which already carries their name, their id
   * and their site in its own header, three lines up. The first draft drew both
   * and the screen opened with the same name twice - a heading competing with a
   * heading, and a reader's first impression that the page had two subjects.
   * TRUE inside the recheck, where findings from different people sit in one
   * list and the name is the only thing telling them apart.
   */
  showWho?: boolean;
}) {
  const [preparing, setPreparing] = useState(false);

  const events = (finding.event_ids ?? [])
    .map((id) => employee.detail?.events.find((e) => e.event_id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const first = events[0] ?? null;

  return (
    <article className="border-t border-line-strong pt-6 first:border-t-0 first:pt-0">
      {/* ----------------------------------------------------- who and what */}
      {showWho && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-title font-semibold tracking-tight text-ink">{employee.name}</h3>
          <p className="font-mono text-meta text-ink-3">{employee.employee_id}</p>
          <p className="text-meta text-ink-3">{employee.location}</p>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-meta font-semibold uppercase tracking-wide text-ink-2">
          {first ? EVENT_LABEL[first.event_type] : FINDING_SOURCE_LABEL[finding.source]}
        </span>
        {first && <span className="text-meta text-ink-3">{shortDate(first.event_date)}</span>}
        <span className="font-mono text-meta text-ink-3">{finding.finding_id}</span>
        {showWho && (
          <span className="ml-auto flex items-center gap-2">
            <StatusMark status="NEEDS_REVIEW" className="h-4 w-4" />
            <span className="text-body font-semibold text-attention-fg">Needs review</span>
          </span>
        )}
      </p>

      <h4 className="max-w-measure mt-3 text-title font-semibold tracking-tight text-ink">
        {finding.headline}
      </h4>
      <p className="max-w-measure mt-2 text-body text-ink-2">{finding.detail}</p>

      {/* --------------------------------------------------- the comparison */}
      {/* Three columns and an arrow, because the question is always the same
          shape: this is what the register says, this is what the rule gives,
          this is the gap. A reader should not have to assemble that from prose. */}
      {/* A GRID, NOT A WRAPPING ROW. As four flex items the cells sized to
          their content, and the widest of them is the register's file name and
          row - which pushed "Difference" onto a second line, so the one figure
          the reader came for sat below the three that explain it. Four columns
          share the width and each wraps inside its own. */}
      <div className="mt-6 grid gap-x-6 gap-y-5 rounded-lg border border-line-strong bg-muted px-5 py-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.2fr_1fr_1fr]">
        {first && (
          <span className="flex min-w-0 flex-col">
            <span className="text-meta text-ink-3">What happened</span>
            <span className="max-w-measure text-body font-medium text-ink">
              {first.description}
            </span>
          </span>
        )}
        {finding.payroll && (
          <span className="flex min-w-0 flex-col">
            <span className="text-meta text-ink-3">Payroll says</span>
            <span className="font-mono text-title tabular-nums text-ink">
              {money(finding.payroll.money)}
            </span>
            <span className="break-words">
              <OriginTag amount={finding.payroll} />
            </span>
          </span>
        )}
        {finding.expected && (
          <Amount amount={finding.expected} label="Published rule gives" size="title" />
        )}
        {finding.difference && (
          <Amount amount={finding.difference} label="Difference" size="title" strong />
        )}
      </div>

      {!finding.difference && finding.no_difference_reason && (
        <NotChecked why={finding.no_difference_reason} className="mt-4 max-w-measure" />
      )}

      {/* Two rule answers and no established fact to choose between them. This
          stays open: it is the finding, not evidence for it. */}
      {finding.alternatives.length > 0 && (
        <div className="mt-5 rounded-lg border border-attention-line bg-attention-bg p-5">
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

      {/* ---------------------------------------------------- the boundary */}
      {finding.proposed_correction ? (
        <div className="mt-6">
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
        <p className="max-w-measure mt-6 rounded-sm border border-line-strong bg-muted px-4 py-3 text-meta text-ink-2">
          No correction to prepare. What does not reconcile here is a record rather than an
          amount, so the next step is a person deciding which record is right, in the system
          that owns it.
        </p>
      )}

      {scenario && (
        <ExplainFinding
          key={finding.finding_id}
          scenario={scenario}
          findingId={finding.finding_id}
        />
      )}

      {/* ------------------------------------------------- the drill-downs */}
      <div className="mt-8">
        <Disclosure label="Evidence" count={events.length || undefined} hint="The export rows this rests on">
          {events.length > 0 ? (
            <ul className="space-y-3">
              {events.map((event) => (
                <li key={event.event_id} className="border-l-2 border-line-strong pl-4">
                  <p className="text-body font-medium text-ink">{event.description}</p>
                  <p className="text-meta text-ink-2">
                    {EVENT_LABEL[event.event_type]}, recorded {event.event_date}.{" "}
                    {event.approval_state === "APPROVED"
                      ? "Approved in the source system."
                      : event.approval_state === "PENDING"
                        ? "No approval recorded against the row."
                        : "No approval field in this export."}
                  </p>
                  <p className="break-all font-mono text-meta text-ink-3">
                    {SOURCE_LABEL[event.source.system]}, {event.source.file}
                    {event.source.row !== null ? ` row ${event.source.row}` : ""}
                  </p>
                  <p className="max-w-measure mt-1 text-meta text-ink-2">{event.check_note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="max-w-measure text-meta text-ink-2">
              No workforce change sits behind this finding. What it raises is a question about
              the payroll line itself.
            </p>
          )}
        </Disclosure>

        {finding.expected && (
          <Disclosure label="Calculation" hint="The engine, its formula, and every fact it used">
            {finding.workings.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-x-10 gap-y-4">
                {finding.workings.map((w) => (
                  <Amount key={w.label} amount={w.amount} label={w.label} size="body" />
                ))}
              </div>
            )}
            <EngineDetail amount={finding.expected} />
          </Disclosure>
        )}

        {finding.rule && (
          <Disclosure
            label="Published rule"
            hint={`${finding.rule.authority}, read ${finding.rule.verified}`}
          >
            <RuleDetail rule={finding.rule} />
          </Disclosure>
        )}

        {finding.split && (
          <Disclosure
            label="What the difference is made of"
            hint="A wage and the CPF on it overlap, and are never added"
          >
            <div className="flex flex-wrap gap-x-10 gap-y-4">
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
          </Disclosure>
        )}

        <Disclosure label="How this works" hint="Who does what, and the arrow that is missing">
          <ControlBoundary />
        </Disclosure>
      </div>
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

      {/* The sentence this whole panel exists to carry. */}
      <div className="mt-5 rounded-sm border border-line-strong bg-muted px-4 py-3">
        <p className="text-body font-semibold text-ink">FairSlip will not change payroll.</p>
        <p className="max-w-measure mt-1 text-meta text-ink-2">
          Make the correction in your payroll system, then recheck it here.
        </p>
      </div>

      {/* The four steps, as one line rather than four stacked boxes. */}
      <Flow />

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
          Payroll integration not connected
        </button>
      </div>

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

      <p className="max-w-measure mt-4 text-meta text-ink-3">
        {correction.note}
      </p>
    </section>
  );
}

/**
 * Four steps, one line.
 *
 * IT REPLACED FOUR STACKED BOXES OF PROSE. The shape of the workflow is what
 * this picture is for, and the shape is legible in four words each; the
 * paragraphs that used to sit under them are in the "How this works" fold,
 * where a reader who wants them will look. What the line has to carry is that
 * the third step is somebody else's system, and it does.
 */
function Flow() {
  const steps = [
    { who: "FairSlip", does: "Finds it" },
    { who: "You", does: "Approve" },
    { who: "Payroll", does: "Changes it" },
    { who: "FairSlip", does: "Rechecks" },
  ];
  return (
    <ol className="mt-5 flex flex-wrap items-stretch gap-2">
      {steps.map((step, i) => (
        <li key={step.does} className="flex items-center gap-2">
          <span className="rounded-sm border border-line-strong bg-muted px-3 py-2">
            <span className="block text-meta font-semibold uppercase tracking-wide text-ink-3">
              {step.who}
            </span>
            <span className="block text-body font-medium text-ink">{step.does}</span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className="text-lead text-ink-3">
              &rarr;
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The source rows a finding rests on, listed. Kept for the findings view's
 * whole-employee footer, where a reviewer wants every row at once rather than
 * the rows behind one finding. */
export function SourceRows({ employee }: { employee: ConceptEmployee }) {
  const events = employee.detail?.events ?? [];
  if (events.length === 0) return null;
  return (
    <Disclosure label="Every source row for this employee" count={events.length}>
      <ul className="space-y-1">
        {events.map((event) => (
          <li key={event.event_id} className="break-all font-mono text-meta text-ink-3">
            {SOURCE_LABEL[event.source.system]}, {event.source.file}
            {event.source.row !== null ? ` row ${event.source.row}` : ""}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
