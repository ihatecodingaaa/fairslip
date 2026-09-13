"use client";

/**
 * One recorded change, followed all the way to the money.
 *
 * THE ORDER IS THE READING ORDER, and it is the order a payroll officer already
 * thinks in: what happened, where it is written down, what the published rule
 * gives for it, what the register states, the gap between those two, and only
 * then the status word. A panel that opened with the status would be asking the
 * reader to trust a verdict before showing them anything.
 *
 * EVERY FIGURE CARRIES ITS PROVENANCE. Not on hover: under the number, in type,
 * always. A rule result says which authority's rule, and opens onto the
 * engine's own formula and the label of every fact it consumed. A register
 * figure names the file and the row. That is the difference between a screen
 * that reports and a screen that asserts.
 *
 * WHERE THERE IS NOTHING TO SAY IT SAYS SO. An employee the prototype carries
 * no records for gets a panel about that, not an empty one. A change no rule
 * pack covers gets its reason, not a dash.
 */

import { money } from "@/lib/api";
import type { ConceptEmployee, ConceptEvent } from "@/lib/concept-preflight/types";
import {
  EVENT_LABEL,
  SOURCE_LABEL,
  STATUS_WORD,
  eventStatus,
} from "@/lib/concept-preflight/selectors";
import { Amount, NotChecked, OriginTag, Workings } from "./Amount";
import { StatusMark, statusToneClass } from "./marks";

export function EmployeeInspector({
  employee,
  event,
  onReviewFinding,
}: {
  employee: ConceptEmployee | null;
  event: ConceptEvent | null;
  onReviewFinding: (findingId: string) => void;
}) {
  return (
    <section
      aria-labelledby="concept-inspector"
      aria-live="polite"
      className="rounded-lg border border-line-strong bg-surface p-5 shadow-card"
    >
      <h2
        id="concept-inspector"
        className="text-meta font-semibold uppercase tracking-wide text-ink-3"
      >
        Event to pay
      </h2>

      {!employee ? (
        <p className="max-w-measure mt-3 text-body text-ink-2">
          Choose a mark, or a row from the list, to follow one person&apos;s month into the
          payroll register.
        </p>
      ) : (
        <>
          <h3 className="mt-3 text-lead font-semibold text-ink">{employee.name}</h3>
          <p className="text-meta text-ink-2">
            {employee.role}. {employee.location}.
          </p>
          <p className="font-mono text-meta text-ink-3">{employee.employee_id}</p>
          <p className="mt-2 flex items-center gap-2">
            <StatusMark status={employee.preflight_status} className="h-4 w-4 shrink-0" />
            <span
              className={`text-body font-semibold ${statusToneClass(employee.preflight_status)}`}
            >
              {STATUS_WORD[employee.preflight_status]}
            </span>
          </p>

          {employee.not_checked_reason && (
            <div className="mt-4">
              <NotChecked why={employee.not_checked_reason} />
            </div>
          )}

          {!employee.detail && (
            <p className="max-w-measure mt-4 rounded-sm border border-missing-line bg-missing-bg px-3 py-2 text-meta text-ink-2">
              The prototype carries no month-by-month records for this employee. Twenty of the
              three hundred have them: every row that needs review, every row nothing was
              computed for, and two whose month reconciled.
            </p>
          )}

          {employee.detail && !event && employee.detail.events.length > 0 && (
            <p className="max-w-measure mt-4 text-body text-ink-2">
              <span className="font-mono tabular-nums">{employee.detail.events.length}</span>{" "}
              recorded changes this month. Choose one from the timeline to follow it into the
              register.
            </p>
          )}

          {employee.detail && !event && employee.detail.events.length === 0 && (
            <p className="max-w-measure mt-4 text-body text-ink-2">
              No workforce changes were recorded for this employee in September. What this row
              raises is a question about the payroll line itself, not about a change that did or
              did not reach it.
            </p>
          )}

          {event && <EventDetail event={event} />}

          {employee.detail?.findings.map((finding) => (
            <button
              key={finding.finding_id}
              type="button"
              onClick={() => onReviewFinding(finding.finding_id)}
              className="tap mt-5 flex w-full items-center justify-between gap-3 rounded-sm border-2 border-ink bg-surface px-4 py-3 text-left text-body font-semibold text-ink"
            >
              <span className="min-w-0">Review this finding</span>
              <span aria-hidden className="text-lead">
                &rarr;
              </span>
            </button>
          ))}
        </>
      )}
    </section>
  );
}

function EventDetail({ event }: { event: ConceptEvent }) {
  const status = eventStatus(event);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <Block label="What happened">
        <p className="text-body font-medium text-ink">{event.description}</p>
        <p className="mt-1 text-meta text-ink-2">
          {EVENT_LABEL[event.event_type]}. Recorded {event.event_date}
          {event.effective_date !== event.event_date
            ? `, effective ${event.effective_date}`
            : ""}
          .
        </p>
      </Block>

      <Block label="Source">
        <p className="text-meta text-ink-2">{SOURCE_LABEL[event.source.system]}</p>
        <p className="break-all font-mono text-meta text-ink-3">
          {event.source.file}
          {event.source.row !== null ? ` row ${event.source.row}` : ""}
        </p>
        <p className="mt-1 text-meta text-ink-3">
          {event.approval_state === "APPROVED"
            ? "Approved in the source system."
            : event.approval_state === "PENDING"
              ? "No approval recorded against the row."
              : "No approval field in this export."}
        </p>
      </Block>

      {event.mc_verification && (
        <Block label="Certificate">
          <p className="text-body font-medium text-ink">
            {event.mc_verification === "VERIFIED"
              ? "Would verify against the issuer"
              : event.mc_verification === "NEEDS_REVIEW"
                ? "Would need a person to look"
                : "Could not be verified"}
          </p>
          <p className="max-w-measure mt-1 rounded-sm border border-attention-line bg-attention-bg px-3 py-2 text-meta text-attention-fg">
            Future concept. FairSlip has no certificate verification today, and this is a
            drawing of what a result would look like rather than a result. There is no score
            here, no probability, and no judgement about whether a certificate is genuine.
            FairSlip would never reject leave.
          </p>
        </Block>
      )}

      {event.expected ? (
        <Block label="What the published rule gives">
          <Amount amount={event.expected} size="title" strong />
          <Workings amount={event.expected} />
        </Block>
      ) : (
        <Block label="What the published rule gives">
          <NotChecked why={event.check_note} />
        </Block>
      )}

      {event.payroll && (
        <Block label="What payroll says">
          <span className="flex flex-col">
            <span className="font-mono text-title tabular-nums text-ink">
              {money(event.payroll.money)}
            </span>
            <OriginTag amount={event.payroll} />
          </span>
        </Block>
      )}

      {event.difference && (
        <Block label="Difference">
          <Amount amount={event.difference} size="title" strong />
        </Block>
      )}

      <Block label="Status">
        <p className="flex items-center gap-2">
          <StatusMark status={status} className="h-4 w-4 shrink-0" />
          <span className={`text-body font-semibold ${statusToneClass(status)}`}>
            {STATUS_WORD[status]}
          </span>
        </p>
        <p className="max-w-measure mt-1 text-meta text-ink-2">{event.check_note}</p>
      </Block>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
