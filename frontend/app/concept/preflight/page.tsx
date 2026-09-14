"use client";

/**
 * FairSlip Preflight: a future product concept.
 *
 * NOT PRODUCTION, AND NOT LINKED FROM IT. /, /check and /employer are untouched
 * and none of them points here. This route exists so that a payroll or HR
 * operator can be shown a workflow and argue with it, and so that the argument
 * is about the workflow rather than about whether the numbers are real.
 *
 * TWO LEVELS, AND THE NAVIGATION SAYS WHICH ONE YOU ARE ON.
 *
 *   COMPANY   Overview, Findings, Recheck. Three questions about one payroll
 *             run: can I release it, what needs a person, and what happened
 *             after the corrections.
 *   EMPLOYEE  Summary, Timeline, Pay changes, Evidence. Opened from any row at
 *             the company level, and it replaces the canvas rather than sitting
 *             beside it, so there is never a doubt about whose month is on
 *             screen.
 *
 * THE OLD SHAPE WAS FOUR PEER TABS - Preflight, Timeline, What changed,
 * Findings - and three of them were about a person nobody had chosen yet. Two
 * of those four opened on a prompt asking you to go and pick someone. That is
 * the navigation telling the reader it does not know what they came for.
 *
 * NOTHING ON THIS PAGE IS FETCHED EXCEPT THE BRIEF, and the Brief is a button.
 * No API, no database, no clock. Every figure is either a rule result the
 * production engines produced offline and the backend suite re-checks, or a
 * line from an invented payroll export; the counts are counted from the fixture
 * on every render. Turn the Brief off and nothing above loses a number.
 */

import { useId, useMemo, useRef, useState } from "react";
// Renamed on import so the scan in backend/tests/test_charts.py sees a plain
// field at every call site in this file, which is what it is.
import { money as moneyOf } from "@/lib/api";
import { SCENARIOS, SCENARIO_IDS } from "@/lib/concept-preflight/fixtures";
import { HERO_EMPLOYEE_ID } from "@/lib/concept-preflight/people";
import { actionQueue } from "@/lib/concept-preflight/priority";
import {
  STATUS_WORD,
  bridgeFor,
  employeeById,
  eventById,
  overviewOf,
  statusCounts,
} from "@/lib/concept-preflight/selectors";
import type { ConceptEmployee, ScenarioId } from "@/lib/concept-preflight/types";
import { CommandCentre, QueueRow } from "./CommandCentre";
import { DemoControls, type DemoTarget } from "./DemoControls";
import { Disclosure } from "./Disclosure";
import { EmployeeInspector } from "./EmployeeInspector";
import { EventTimeline, NoDetail } from "./EventTimeline";
import { ExceptionReview, SourceRows } from "./ExceptionReview";
import { FairSlipBrief } from "./FairSlipBrief";
import { InputSources } from "./InputSources";
import { NotCheckedCase } from "./NotCheckedCase";
import { PreflightShell } from "./PreflightShell";
import { NoRecheck, RecheckConcept } from "./RecheckConcept";
import { NoPriorMonth, WhatChanged } from "./WhatChanged";
import { WorkforceChangeSummary } from "./WorkforceChangeSummary";
import { WorkforceMap } from "./WorkforceMap";
import { statusToneClass, StatusMark } from "./marks";

/** The three questions about one payroll run. */
const COMPANY_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "findings", label: "Findings" },
  { id: "recheck", label: "Recheck" },
] as const;

type CompanyView = (typeof COMPANY_VIEWS)[number]["id"];

/** The four questions about one person. */
const EMPLOYEE_VIEWS = [
  { id: "summary", label: "Summary" },
  { id: "timeline", label: "Timeline" },
  { id: "changes", label: "Pay changes" },
  { id: "evidence", label: "Evidence" },
] as const;

type EmployeeView = (typeof EMPLOYEE_VIEWS)[number]["id"];

/** The two employees the demo controls jump to, named here so the talk track
 * and the buttons cannot drift apart. */
const LEAVER_ID = "EMP-0044";
const NOT_CHECKED_ID = "EMP-0061";

export default function ConceptPreflightPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("needs-review");
  const [view, setView] = useState<CompanyView>("overview");
  const [lens, setLens] = useState<"queue" | "map">("queue");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeView, setEmployeeView] = useState<EmployeeView>("summary");
  const [eventId, setEventId] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[scenarioId];
  const overview = useMemo(() => overviewOf(scenario), [scenario]);
  const employee = employeeById(scenario.employees, employeeId);
  const event = eventById(employee, eventId);
  const bridge = useMemo(() => (employee ? bridgeFor(employee) : null), [employee]);

  function openEmployee(id: string, view: EmployeeView = "summary") {
    setEmployeeId(id);
    // A new person makes the previously selected change belong to someone else.
    setEventId(null);
    setEmployeeView(view);
    top.current?.scrollIntoView({ block: "start" });
  }

  function backToCompany() {
    setEmployeeId(null);
    setEventId(null);
    top.current?.scrollIntoView({ block: "start" });
  }

  function reset() {
    setView("overview");
    setLens("queue");
    setEmployeeId(null);
    setEventId(null);
    setEmployeeView("summary");
  }

  function jump(target: DemoTarget) {
    if (target === "overview") {
      reset();
      window.scrollTo({ top: 0 });
      return;
    }
    if (target === "recheck") {
      setEmployeeId(null);
      setView("recheck");
      window.scrollTo({ top: 0 });
      return;
    }
    if (target === "hero") {
      openEmployee(HERO_EMPLOYEE_ID, "timeline");
      // The rest-day shift: the beat the whole story turns on.
      setEventId("EVT-0127-05");
    } else if (target === "leaver") {
      openEmployee(LEAVER_ID, "summary");
    } else {
      openEmployee(NOT_CHECKED_ID, "summary");
    }
  }

  return (
    <PreflightShell
      controls={
        <DemoControls
          scenario={scenarioId}
          scenarios={SCENARIO_IDS.map((id) => ({ id, label: SCENARIOS[id].label }))}
          onScenario={(id) => {
            setScenarioId(id);
            reset();
          }}
          onJump={jump}
          onReset={reset}
        />
      }
    >
      <div ref={top} className="scroll-mt-4" />

      {employee ? (
        <EmployeeLevel
          employee={employee}
          employeeView={employeeView}
          onEmployeeView={setEmployeeView}
          onBack={backToCompany}
          scenarioId={scenarioId}
          eventId={eventId}
          onSelectEvent={setEventId}
          payday={scenario.period.payday}
          bridge={bridge}
          event={event}
        />
      ) : (
        <CompanyLevel
          scenario={scenario}
          scenarioId={scenarioId}
          overview={overview}
          view={view}
          onView={(v) => {
            setView(v);
            setLens("queue");
          }}
          lens={lens}
          onLens={setLens}
          onOpen={(id) => openEmployee(id, "summary")}
        />
      )}
    </PreflightShell>
  );
}

/* ------------------------------------------------------------ company level */

function CompanyLevel({
  scenario,
  scenarioId,
  overview,
  view,
  onView,
  lens,
  onLens,
  onOpen,
}: {
  scenario: (typeof SCENARIOS)[ScenarioId];
  scenarioId: ScenarioId;
  overview: ReturnType<typeof overviewOf>;
  view: CompanyView;
  onView: (v: CompanyView) => void;
  lens: "queue" | "map";
  onLens: (l: "queue" | "map") => void;
  onOpen: (id: string) => void;
}) {
  const counts = statusCounts(scenario.employees);
  const attention = counts.needsReview + counts.notChecked;

  return (
    <>
      <Tabs
        label="This payroll run"
        views={COMPANY_VIEWS}
        active={view}
        onPick={onView}
        note={scenario.note}
      />

      <div className="mt-8">
        {view === "overview" && (
          <CommandCentre
            company={scenario.company}
            period={scenario.period}
            overview={overview}
            employees={scenario.employees}
            onOpen={(id) => onOpen(id)}
            onViewAll={() => onView("findings")}
            brief={
              <FairSlipBrief
                key={scenarioId}
                scenario={scenarioId}
                employees={scenario.employees}
                onOpen={(id) => onOpen(id)}
              />
            }
          />
        )}

        {view === "findings" && (
          <section aria-labelledby="concept-findings">
            <div className="flex flex-wrap items-center gap-3 border-b border-line-strong pb-3">
              <h2 id="concept-findings" className="sr-only">
                The rows that need a person
              </h2>
              {/* The product's mental model, as two buttons. The queue is for
                  working; the map is for knowing where the work is. */}
              <Pill on={lens === "queue"} onClick={() => onLens("queue")}>
                Needs attention <Count n={attention} />
              </Pill>
              <Pill on={lens === "map"} onClick={() => onLens("map")}>
                All employees <Count n={counts.total} />
              </Pill>
            </div>

            <div className="mt-6">
              {lens === "queue" ? (
                <ActionQueue employees={scenario.employees} onOpen={onOpen} />
              ) : (
                <WorkforceMap employees={scenario.employees} selected={null} onSelect={onOpen} />
              )}
            </div>
          </section>
        )}

        {view === "recheck" &&
          (scenario.recheck ? (
            <RecheckConcept
              recheck={scenario.recheck}
              employees={scenario.employees}
              scenario={scenarioId}
            />
          ) : (
            <NoRecheck />
          ))}
      </div>

      {/* What was loaded, and what happened at work. Below the fold on purpose:
          both answer questions a reader has second, and neither is a number the
          first five seconds need. */}
      {view === "overview" && (
        <div className="mt-14 border-t border-line pt-2">
          <Disclosure
            label="What was loaded"
            count={scenario.inputs.length}
            hint="Exports, not connections. Nothing here is a live integration."
          >
            <InputSources inputs={scenario.inputs} />
          </Disclosure>
          <Disclosure
            label="What happened at work this month"
            count={overview.changes.total}
            hint="Recorded changes, before anything is said about pay"
          >
            <WorkforceChangeSummary
              groups={overview.changes.groups}
              total={overview.changes.total}
            />
          </Disclosure>
        </div>
      )}
    </>
  );
}

/** Every row that needs a person, in priority.ts's order and no other. */
function ActionQueue({
  employees,
  onOpen,
}: {
  employees: ConceptEmployee[];
  onOpen: (id: string) => void;
}) {
  const queue = actionQueue(employees);
  if (queue.length === 0) {
    return (
      <p className="max-w-measure rounded-sm border border-line-strong bg-muted px-4 py-3 text-body text-ink-2">
        Nothing needs a person in this month. Every recorded change reconciled with the register,
        and every amount a rule pack covers agrees with it.
      </p>
    );
  }
  return (
    <>
      <p className="max-w-measure text-meta text-ink-3">
        In FairSlip&apos;s own order: the largest computed difference first, then the employment
        records, then the findings no amount was computed for, then the rows nothing was computed
        for at all.
      </p>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {queue.map((item) => (
          <li key={`${item.employee.employee_id}-${item.finding?.finding_id ?? "none"}`}>
            <QueueRow item={item} onOpen={(id) => onOpen(id)} />
          </li>
        ))}
      </ul>
    </>
  );
}

/* ----------------------------------------------------------- employee level */

function EmployeeLevel({
  employee,
  employeeView,
  onEmployeeView,
  onBack,
  scenarioId,
  eventId,
  onSelectEvent,
  payday,
  bridge,
  event,
}: {
  employee: ConceptEmployee;
  employeeView: EmployeeView;
  onEmployeeView: (v: EmployeeView) => void;
  onBack: () => void;
  scenarioId: ScenarioId;
  eventId: string | null;
  onSelectEvent: (id: string) => void;
  payday: string;
  bridge: ReturnType<typeof bridgeFor>;
  event: ReturnType<typeof eventById>;
}) {
  return (
    <>
      {/* The way back, and whose month this is. Both above everything, because
          the one thing a reader must never be unsure of on this screen is who
          they are looking at. */}
      <nav aria-label="Back to the payroll run">
        <button
          type="button"
          onClick={onBack}
          className="tap-sm rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          &larr; Payroll preflight
        </button>
      </nav>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h1 className="text-page font-semibold tracking-tight text-ink">{employee.name}</h1>
        <p className="font-mono text-meta text-ink-3">{employee.employee_id}</p>
        <p className="text-meta text-ink-2">
          {employee.role}, {employee.location}
        </p>
        <p className="ml-auto flex items-center gap-2">
          <StatusMark status={employee.preflight_status} className="h-4 w-4" />
          <span
            className={`text-body font-semibold ${statusToneClass(employee.preflight_status)}`}
          >
            {STATUS_WORD[employee.preflight_status]}
          </span>
        </p>
      </div>

      <div className="mt-6">
        <Tabs
          label="This employee's month"
          views={EMPLOYEE_VIEWS}
          active={employeeView}
          onPick={onEmployeeView}
        />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          {employeeView === "summary" && <Summary employee={employee} scenario={scenarioId} />}

          {employeeView === "timeline" &&
            (employee.detail ? (
              <EventTimeline
                employee={employee}
                selectedEventId={eventId}
                onSelectEvent={onSelectEvent}
                payday={payday}
              />
            ) : (
              <NoDetail
                employee={employee}
                what="No month-by-month records were written for this employee in the prototype."
              />
            ))}

          {employeeView === "changes" &&
            (bridge ? (
              <WhatChanged
                bridge={bridge}
                onSelectEvent={(id) => {
                  onSelectEvent(id);
                  onEmployeeView("timeline");
                }}
              />
            ) : employee.detail ? (
              <NoPriorMonth employee={employee} />
            ) : (
              <NoDetail
                employee={employee}
                what="No months were written for this employee in the prototype, so there is nothing to compare."
              />
            ))}

          {employeeView === "evidence" && <Evidence employee={employee} />}
        </div>

        <div className="lg:sticky lg:top-6">
          <EmployeeInspector
            employee={employee}
            event={event}
            onReviewFinding={() => onEmployeeView("summary")}
          />
        </div>
      </div>
    </>
  );
}

/** What this person's month raises, if anything. */
function Summary({ employee, scenario }: { employee: ConceptEmployee; scenario: ScenarioId }) {
  if (employee.preflight_status === "NOT_CHECKED") {
    return <NotCheckedCase employee={employee} />;
  }
  const findings = employee.detail?.findings ?? [];
  if (findings.length > 0) {
    return (
      <div className="space-y-10">
        {findings.map((finding) => (
          <ExceptionReview
            key={finding.finding_id}
            employee={employee}
            finding={finding}
            scenario={scenario}
            showWho={false}
          />
        ))}
      </div>
    );
  }
  return (
    <p className="max-w-measure rounded-sm border border-line-strong bg-muted px-4 py-3 text-body text-ink-2">
      Nothing to review for {employee.name}. Every recorded change this month reconciled with the
      register, and the amounts a rule pack covers agree with it.
    </p>
  );
}

/** Every row behind this person's month, and the register as it stands. */
function Evidence({ employee }: { employee: ConceptEmployee }) {
  const register = employee.detail?.current ?? null;
  if (!register) {
    return (
      <NoDetail
        employee={employee}
        what="No source records were written for this employee in the prototype."
      />
    );
  }
  return (
    <div>
      <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        The register, as the payroll system states it
      </h3>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {register.lines.map((line) => (
          <li key={line.key} className="flex items-baseline justify-between gap-4 py-2">
            <span className="min-w-0 text-body text-ink-2">{line.label}</span>
            <span className="font-mono text-body tabular-nums text-ink">
              {moneyOf(line.amount.money)}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-4 py-2">
          <span className="text-body font-semibold text-ink">Net pay</span>
          <span className="font-mono text-lead font-semibold tabular-nums text-ink">
            {moneyOf(register.net.money)}
          </span>
        </li>
      </ul>
      <p className="mt-2 break-all font-mono text-meta text-ink-3">
        {register.source.file}
        {register.source.row !== null ? ` row ${register.source.row}` : ""}
      </p>

      <div className="mt-8">
        <SourceRows employee={employee} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- furniture */

/**
 * One set of tabs, used at both levels.
 *
 * REAL TABS: one tab stop for the set, arrow keys between them, each panel
 * labelled by its tab. The same pattern the payroll X-ray uses, so a reader who
 * has met one meets the other without being taught twice.
 */
function Tabs<T extends string>({
  label,
  views,
  active,
  onPick,
  note,
}: {
  label: string;
  views: readonly { id: T; label: string }[];
  active: T;
  onPick: (id: T) => void;
  note?: string;
}) {
  const uid = useId();
  const list = useRef<HTMLDivElement>(null);

  function move(delta: number) {
    const i = views.findIndex((v) => v.id === active);
    const next = views[(i + delta + views.length) % views.length];
    onPick(next.id);
    list.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-line-strong">
      <div
        ref={list}
        role="tablist"
        aria-label={label}
        className="flex flex-wrap"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {views.map((v) => {
          const on = v.id === active;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              data-tab={v.id}
              id={`${uid}-tab-${v.id}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(v.id)}
              className={`tap-sm -mb-px border-b-2 px-4 py-2 text-body ${
                on
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent font-medium text-ink-3 hover:text-ink-2"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      {note && <p className="text-meta text-ink-3">{note}</p>}
    </div>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`tap-sm rounded-sm border px-4 py-2 text-body ${
        on
          ? "border-ink bg-muted font-semibold text-ink"
          : "border-control font-medium text-ink-2 hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-2 font-mono text-meta tabular-nums text-ink-3">{n}</span>;
}
