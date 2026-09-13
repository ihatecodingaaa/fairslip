"use client";

/**
 * FairSlip Preflight: a future product concept.
 *
 * NOT PRODUCTION, AND NOT LINKED FROM IT. /, /check and /employer are untouched
 * and none of them points here. This route exists so that a payroll or HR
 * operator can be shown a workflow and argue with it, and so that the argument
 * is about the workflow rather than about whether the numbers are real.
 *
 * THE IDEA, IN THREE LINES. HR software records what happened. Payroll software
 * calculates what gets paid. Nobody checks that the first became the second.
 * That gap is what this draws.
 *
 * ONE DOMINANT VIEW AT A TIME, BESIDE A PERMANENT INSPECTOR - the same shape as
 * the payroll X-ray, for the same reason. Four lenses ask four questions about
 * one month: which rows (Preflight), what happened to one person (Timeline),
 * why this month differs from the last (What changed), and what to do about it
 * (Findings). Choosing a row in any of them fills the same inspector.
 *
 * NOTHING ON THIS PAGE IS FETCHED. No API, no model, no database, no clock.
 * Every figure is either a rule result the production engines produced offline
 * and the backend suite re-checks, or a line from an invented payroll export.
 * The counts are counted from the fixture on every render.
 */

import { useId, useMemo, useRef, useState } from "react";
import { SCENARIOS, SCENARIO_IDS } from "@/lib/concept-preflight/fixtures";
import { HERO_EMPLOYEE_ID } from "@/lib/concept-preflight/people";
import {
  allFindings,
  bridgeFor,
  employeeById,
  eventById,
  overviewOf,
} from "@/lib/concept-preflight/selectors";
import type { ConceptEmployee, ConceptFinding, ScenarioId } from "@/lib/concept-preflight/types";
import { DemoControls, type DemoTarget } from "./DemoControls";
import { EmployeeInspector } from "./EmployeeInspector";
import { EventTimeline, NoDetail } from "./EventTimeline";
import { ExceptionReview, SourceRows } from "./ExceptionReview";
import { InputSources } from "./InputSources";
import { NotCheckedCase } from "./NotCheckedCase";
import { PreflightConstellation } from "./PreflightConstellation";
import { PreflightOverview } from "./PreflightOverview";
import { PreflightShell } from "./PreflightShell";
import { NoRecheck, RecheckConcept } from "./RecheckConcept";
import { NoPriorMonth, WhatChanged } from "./WhatChanged";
import { WorkforceChangeSummary } from "./WorkforceChangeSummary";

/** The four questions one month can be asked. One is on screen at a time. */
const LENSES = [
  { id: "preflight", label: "Preflight" },
  { id: "timeline", label: "Timeline" },
  { id: "changed", label: "What changed" },
  { id: "findings", label: "Findings" },
] as const;

type LensId = (typeof LENSES)[number]["id"];

/** The two employees the demo controls jump to, named here so the talk track
 * and the buttons cannot drift apart. */
const LEAVER_ID = "EMP-0044";
const NOT_CHECKED_ID = "EMP-0061";

export default function ConceptPreflightPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("needs-review");
  const [view, setView] = useState<"preflight" | "recheck">("preflight");
  const [lens, setLens] = useState<LensId>("preflight");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[scenarioId];
  const overview = useMemo(() => overviewOf(scenario), [scenario]);
  const employee = employeeById(scenario.employees, employeeId);
  const event = eventById(employee, eventId);
  const bridge = useMemo(() => (employee ? bridgeFor(employee) : null), [employee]);

  function selectEmployee(id: string) {
    setEmployeeId(id);
    // A new person makes the previously selected change belong to someone else.
    setEventId(null);
  }

  function reset() {
    setView("preflight");
    setLens("preflight");
    setEmployeeId(null);
    setEventId(null);
  }

  function jump(target: DemoTarget) {
    if (target === "overview") {
      reset();
      window.scrollTo({ top: 0 });
      return;
    }
    if (target === "recheck") {
      setView("recheck");
      window.scrollTo({ top: 0 });
      return;
    }
    setView("preflight");
    if (target === "hero") {
      setEmployeeId(HERO_EMPLOYEE_ID);
      // The rest-day shift: the beat the whole story turns on.
      setEventId("EVT-0127-05");
      setLens("timeline");
    } else if (target === "leaver") {
      setEmployeeId(LEAVER_ID);
      setEventId(null);
      setLens("findings");
    } else {
      setEmployeeId(NOT_CHECKED_ID);
      setEventId(null);
      setLens("findings");
    }
    canvas.current?.scrollIntoView({ block: "start" });
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
      {/* The two top-level states. The recheck is a second run over a corrected
          file, not a panel inside the first one. */}
      <div className="flex flex-wrap items-center gap-3">
        <ViewTab active={view === "preflight"} onClick={() => setView("preflight")}>
          Preflight
        </ViewTab>
        <ViewTab active={view === "recheck"} onClick={() => setView("recheck")}>
          Recheck
        </ViewTab>
        <p className="text-meta text-ink-3">{scenario.note}</p>
      </div>

      {view === "recheck" ? (
        <div className="mt-10">
          {scenario.recheck ? (
            <RecheckConcept recheck={scenario.recheck} employees={scenario.employees} />
          ) : (
            <NoRecheck />
          )}
        </div>
      ) : (
        <>
          <div className="mt-10">
            <PreflightOverview
              company={scenario.company}
              period={scenario.period}
              overview={overview}
            />
          </div>

          <InputSources inputs={scenario.inputs} />

          <WorkforceChangeSummary
            groups={overview.changes.groups}
            total={overview.changes.total}
          />

          <section ref={canvas} aria-label="The month, four ways" className="mt-12 scroll-mt-6">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0">
                <LensTabs lens={lens} onPick={setLens}>
                  {lens === "preflight" && (
                    <PreflightConstellation
                      key={scenarioId}
                      employees={scenario.employees}
                      selected={employeeId}
                      onSelect={selectEmployee}
                    />
                  )}

                  {lens === "timeline" &&
                    (employee ? (
                      <EventTimeline
                        employee={employee}
                        selectedEventId={eventId}
                        onSelectEvent={setEventId}
                        payday={scenario.period.payday}
                      />
                    ) : (
                      <Prompt what="a person" why="to follow their month into the register" />
                    ))}

                  {lens === "changed" &&
                    (!employee ? (
                      <Prompt what="a person" why="to compare this month with the last one" />
                    ) : bridge ? (
                      <WhatChanged
                        employee={employee}
                        bridge={bridge}
                        onSelectEvent={(id) => {
                          setEventId(id);
                          setLens("timeline");
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

                  {lens === "findings" && (
                    <Findings
                      employee={employee}
                      onSelect={selectEmployee}
                      findings={allFindings(scenario.employees)}
                      employees={scenario.employees}
                    />
                  )}
                </LensTabs>
              </div>

              <div className="lg:sticky lg:top-6">
                <EmployeeInspector
                  employee={employee}
                  event={event}
                  onReviewFinding={() => setLens("findings")}
                />
              </div>
            </div>
          </section>
        </>
      )}
    </PreflightShell>
  );
}

/* ---------------------------------------------------------------- furniture */

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap-sm rounded-sm border px-4 py-2 text-body ${
        active
          ? "border-ink bg-muted font-semibold text-ink"
          : "border-control font-medium text-ink-2 hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Four views of one month, one at a time.
 *
 * REAL TABS: one tab stop for the set, arrow keys between them, each panel
 * labelled by its tab. The same pattern the payroll X-ray uses, so a reader who
 * has met one meets the other without being taught twice.
 */
function LensTabs({
  lens,
  onPick,
  children,
}: {
  lens: LensId;
  onPick: (id: LensId) => void;
  children: React.ReactNode;
}) {
  const uid = useId();
  const list = useRef<HTMLDivElement>(null);

  function move(delta: number) {
    const i = LENSES.findIndex((l) => l.id === lens);
    const next = LENSES[(i + delta + LENSES.length) % LENSES.length];
    onPick(next.id);
    list.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div>
      <div
        ref={list}
        role="tablist"
        aria-label="How to look at this month"
        className="flex flex-wrap border-b border-line-strong"
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
        {LENSES.map((l) => {
          const on = l.id === lens;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              data-tab={l.id}
              id={`${uid}-tab-${l.id}`}
              aria-selected={on}
              aria-controls={`${uid}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(l.id)}
              className={`tap-sm -mb-px border-b-2 px-4 py-2 text-body ${
                on
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent font-medium text-ink-3 hover:text-ink-2"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${lens}`}
        tabIndex={0}
        className="mt-6"
      >
        {children}
      </div>
    </div>
  );
}

function Prompt({ what, why }: { what: string; why: string }) {
  return (
    <p className="max-w-measure rounded-sm border border-line-strong bg-muted px-4 py-3 text-body text-ink-2">
      Choose {what} from the Preflight grid {why}.
    </p>
  );
}

/**
 * What to do about it.
 *
 * A ROW THAT WAS NEVER COMPUTED GETS THIS PANEL TOO, and it gets the same
 * amount of room as a finding. Seven of these three hundred are in that state,
 * and a findings view that had nothing to say about them would be teaching the
 * reader that "no finding" means "fine".
 */
function Findings({
  employee,
  employees,
  findings,
  onSelect,
}: {
  employee: ConceptEmployee | null;
  employees: ConceptEmployee[];
  findings: ConceptFinding[];
  onSelect: (id: string) => void;
}) {
  const named = new Map(employees.map((e) => [e.employee_id, e]));

  if (employee && employee.preflight_status === "NOT_CHECKED") {
    return <NotCheckedCase employee={employee} />;
  }

  if (employee && employee.detail && employee.detail.findings.length > 0) {
    return (
      <div className="space-y-10">
        {employee.detail.findings.map((finding) => (
          <ExceptionReview key={finding.finding_id} employee={employee} finding={finding} />
        ))}
        <SourceRows employee={employee} />
      </div>
    );
  }

  if (employee) {
    return (
      <p className="max-w-measure rounded-sm border border-line-strong bg-muted px-4 py-3 text-body text-ink-2">
        Nothing to review for {employee.name}. Every recorded change for this month reconciled
        with the register, and the amounts that a rule pack covers agree with it.
      </p>
    );
  }

  if (findings.length === 0) {
    return (
      <p className="max-w-measure rounded-sm border border-line-strong bg-muted px-4 py-3 text-body text-ink-2">
        No findings in this month.
      </p>
    );
  }

  return (
    <div>
      <p className="max-w-measure text-body text-ink-2">
        {findings.length} findings. Choose one to see the records behind it, what the published
        rule gives, and the change a reviewer would make in their own payroll system.
      </p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {findings.map((finding) => {
          const who = named.get(finding.employee_id);
          return (
            <li key={finding.finding_id}>
              <button
                type="button"
                onClick={() => onSelect(finding.employee_id)}
                className="tap flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-2 py-3 text-left hover:bg-muted"
              >
                <span className="font-mono text-meta text-ink-3">{finding.finding_id}</span>
                <span className="min-w-0 flex-1 text-body font-semibold text-ink">
                  {finding.headline}
                </span>
                <span className="text-meta text-ink-3">{who ? who.name : finding.employee_id}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
