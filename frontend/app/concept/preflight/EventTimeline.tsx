"use client";

/**
 * One person's month, and whether each thing in it reached payroll.
 *
 * THE WHOLE PRODUCT IDEA IS THIS PICTURE. On the left, what the company's own
 * systems recorded. On the right, what became of it. The line between them is
 * the handoff nobody owns, and the reason it is drawn as a LINE rather than as
 * two columns of a table is that the line is the thing being checked.
 *
 * NOT A GANTT CHART. A Gantt would put duration on the horizontal axis, and
 * duration is not what matters here: a two-hour overtime entry and a day of
 * unpaid leave are the same size of question. The vertical axis is the month
 * and the horizontal one is the crossing.
 *
 * THE LINE STYLE IS A SECOND CHANNEL, NEVER THE ONLY ONE. Solid to a filled
 * disc for a change that was priced and agreed, a heavier rule to a triangle for
 * one that did not reconcile, dashed to a hollow diamond for one nothing was
 * computed for. Shape and word carry it; the stroke is there so the eye can run
 * down the column without reading.
 *
 * "REFLECTED" IS NOT A WORD THIS SCREEN USES. A change can reach the register
 * and still not have been priced against any rule, and those are two different
 * facts. Each row says which of them it is, in a sentence, under the status.
 */

import { money } from "@/lib/api";
import type { ConceptEmployee, ConceptEvent } from "@/lib/concept-preflight/types";
import {
  EVENT_LABEL,
  EVENT_TAG,
  SOURCE_LABEL,
  STATUS_WORD,
  eventStatus,
} from "@/lib/concept-preflight/selectors";
import { StatusMark, statusToneClass } from "./marks";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "14 Sep" from "2026-09-14". Written out rather than taken from
 * toLocaleDateString, which resolves against the machine's locale and would
 * make a screenshot depend on whose laptop took it. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

function leaderClass(status: ReturnType<typeof eventStatus>): string {
  if (status === "NEEDS_REVIEW") return "border-t-2 border-attention-line";
  if (status === "NOT_CHECKED") return "border-t border-dashed border-missing-line";
  return "border-t border-line-strong";
}

export function EventTimeline({
  employee,
  selectedEventId,
  onSelectEvent,
  payday,
}: {
  employee: ConceptEmployee;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  payday: string;
}) {
  const events = [...(employee.detail?.events ?? [])].sort((a, b) =>
    a.event_date.localeCompare(b.event_date),
  );

  if (!employee.detail) {
    return (
      <NoDetail
        employee={employee}
        what="No month-by-month records were written for this employee in the prototype."
      />
    );
  }

  /* A RAIL WITH NO STOPS ON IT IS NOT A TIMELINE. Several of the rows nothing
     was computed for have no recorded workforce change at all: what makes them
     uncheckable is the payroll line itself. Drawing an empty month and a payday
     would be a picture of nothing. */
  if (events.length === 0) {
    return (
      <div className="rounded-sm border border-missing-line bg-missing-bg p-5">
        <p className="text-meta font-semibold uppercase tracking-wide text-missing-fg">
          No recorded changes
        </p>
        <p className="mt-2 text-body font-semibold text-ink">
          {employee.name}
          <span className="ml-3 font-mono text-meta font-normal text-ink-3">
            {employee.employee_id}
          </span>
        </p>
        <p className="max-w-measure mt-2 text-meta text-ink-2">
          The attendance, leave and employee-master exports record no change for this employee
          this month. There is nothing here to follow into the register, and whatever this row
          raises is a question about the payroll line itself. The Findings view has it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-title font-semibold tracking-tight text-ink">
          {employee.name}
          <span className="ml-3 font-mono text-meta font-normal text-ink-3">
            {employee.employee_id}
          </span>
        </h3>
        <p className="text-meta text-ink-3">
          {events.length} recorded changes, left. What payroll did with each one, right.
        </p>
      </div>

      {/* The rail. One border down the left, and the dots sit on it. It darkens
          for the last stretch, which is the only run of it with a deadline. */}
      <div className="mt-6">
        <ol className="border-l-2 border-line-strong">
          {events.map((event) => (
            <TimelineRow
              key={event.event_id}
              event={event}
              selected={selectedEventId === event.event_id}
              onSelect={() => onSelectEvent(event.event_id)}
            />
          ))}
        </ol>
        <div className="border-l-2 border-ink pl-6 pt-8">
          <p className="border-t-2 border-ink pt-3 text-body font-semibold text-ink">
            Payday <span className="font-normal text-ink-2">{payday}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  event,
  selected,
  onSelect,
}: {
  event: ConceptEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = eventStatus(event);
  return (
    <li className="relative">
      {/* The dot on the rail. Filled for a change that was priced and agreed,
          hollow otherwise, so the rail itself reads at a glance. */}
      <span
        aria-hidden
        className={`absolute left-0 top-6 block h-2 w-2 -translate-x-1/2 rounded-full border ${
          status === "MATCHED" ? "border-ink-3 bg-ink-3" : "border-ink-3 bg-surface"
        }`}
      />
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full flex-wrap items-start gap-x-6 gap-y-3 py-4 pl-6 pr-2 text-left ${
          selected ? "bg-muted" : "hover:bg-muted"
        }`}
      >
        {/* What happened */}
        <span className="flex min-w-0 flex-1 basis-64 flex-col">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-mono text-meta tabular-nums text-ink-2">
              {shortDate(event.event_date)}
            </span>
            <span className="rounded-sm border border-line-strong bg-sunken px-2 py-1 font-mono text-meta text-ink-2">
              {EVENT_TAG[event.event_type]}
            </span>
            <span className="text-meta text-ink-3">{EVENT_LABEL[event.event_type]}</span>
          </span>
          <span className="mt-1 text-body font-medium text-ink">{event.description}</span>
          <span className="mt-1 text-meta text-ink-3">
            {SOURCE_LABEL[event.source.system]}
            {event.source.row !== null ? `, row ${event.source.row}` : ""}
            {event.approval_state === "APPROVED"
              ? ". Approved."
              : event.approval_state === "PENDING"
                ? ". No approval recorded."
                : ""}
          </span>
        </span>

        {/* The crossing */}
        <span
          aria-hidden
          className={`mt-6 hidden min-w-8 flex-1 basis-8 sm:block ${leaderClass(status)}`}
        />

        {/* What payroll did */}
        <span className="flex basis-56 flex-col">
          <span className="flex items-center gap-2">
            <StatusMark status={status} className="h-4 w-4 shrink-0" />
            <span className={`text-body font-semibold ${statusToneClass(status)}`}>
              {STATUS_WORD[status]}
            </span>
          </span>
          {event.expected && (
            <span className="mt-1 font-mono text-meta tabular-nums text-ink-2">
              rule {money(event.expected.money)}
            </span>
          )}
          {event.payroll && (
            <span className="font-mono text-meta tabular-nums text-ink-2">
              register {money(event.payroll.money)}
            </span>
          )}
          {/* THE NOTE IS SHOWN WHERE IT SAYS SOMETHING NEW. Four overtime rows
              in one month share one sentence about how they were priced, and
              four copies of it is noise a reader learns to skip - which is the
              worst thing that can happen to the sentence that matters on the
              fifth row. Rows that did not simply reconcile always carry it, and
              any row carries it while it is selected; the inspector beside this
              carries all of them in full. */}
          {(status !== "MATCHED" || selected) && (
            <span className="mt-1 max-w-measure text-meta text-ink-3">{event.check_note}</span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * An employee the prototype carries no records for.
 *
 * SAID PLAINLY, AND IT IS THE SAME RULE THE PRODUCT APPLIES TO A PAYROLL FILE.
 * Two hundred and eighty of the three hundred rows in this fixture have a status
 * and a count of recorded changes and nothing behind them, because writing three
 * hundred invented months would have meant inventing three hundred months. An
 * empty panel with a confident heading would be the concept committing the exact
 * defect it exists to find.
 */
export function NoDetail({
  employee,
  what,
}: {
  employee: ConceptEmployee;
  what: string;
}) {
  const changes = Object.values(employee.event_counts).reduce((n, v) => n + (v ?? 0), 0);
  return (
    <div className="rounded-sm border border-missing-line bg-missing-bg p-5">
      <p className="text-meta font-semibold uppercase tracking-wide text-missing-fg">
        No records in this prototype
      </p>
      <p className="mt-2 text-body font-semibold text-ink">
        {employee.name}
        <span className="ml-3 font-mono text-meta font-normal text-ink-3">
          {employee.employee_id}
        </span>
      </p>
      <p className="max-w-measure mt-2 text-meta text-ink-2">
        {what} The fixture records that the preflight matched and that there{" "}
        {changes === 1 ? "was" : "were"}{" "}
        <span className="font-mono tabular-nums">{changes}</span> recorded{" "}
        {changes === 1 ? "change" : "changes"} in the month. Twenty of the three hundred
        employees carry full records: every row that needs review, every row nothing was
        computed for, and two whose month reconciled.
      </p>
    </div>
  );
}
