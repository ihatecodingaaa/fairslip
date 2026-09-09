"use client";

/**
 * The second run, against the first.
 *
 * WHAT THIS SCREEN IS FOR. An employer read the X-ray, fixed what it found in
 * their own payroll system, and exported the file again. The question is no
 * longer "what is wrong" - it is "what moved". Two summaries side by side would
 * make a reader do the subtraction; this does it once, in the engine, and draws
 * the answer.
 *
 * NOTHING HERE IS DIFFED IN THE BROWSER. Every state, every count and every
 * amount is a field of EmployerRecheckOut. That is not fastidiousness: deciding
 * which row of the second file is which employee is the load-bearing judgement
 * in the whole feature, and it is made once, on the CPF account number, in
 * fairslip/employer.recheck().
 *
 * THE TRANSITION SUMMARY IS THE HERO, and it is drawn with the same glyphs the
 * grids use. "▲ → ● 9" is the finding; the two grids under it are the evidence
 * that the nine are nine particular rows and not a number in a box.
 *
 * FOUR STATES ARE NOT IMPROVEMENTS AND ARE NOT HIDDEN. A row that still cannot
 * be checked, a row that stopped being checkable, a row that left the file and
 * a row that joined it each have their own line. A before/after that can only
 * ever look better is a before/after nobody should trust - and the fictional
 * corrected roster seeds one new exception, one leaver and one joiner precisely
 * so this screen has to show them.
 *
 * WHAT IT NEVER SAYS. Not "FairSlip saved $2,159" - nobody has paid anything,
 * and the money moving on this screen is a difference between what two files
 * declared and what the published rules give for them. Not "resolved" as a
 * verdict on a person. The copy is about rows and rules: "this row now matches
 * the checked rule".
 */

import { useEffect, useRef, useState } from "react";
import {
  money,
  type EmployerRecheckOut,
  type RecheckRow,
  type RecheckState,
} from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { T, useT } from "../ui/Prefs";
import { OutcomeMark, outcomeWord } from "./outcomeMark";
import { REASON_WORDS } from "./reasons";

/**
 * The order the states are read in, and the only place that order is decided.
 *
 * WHAT CHANGED FIRST, WHAT DID NOT MOVE LAST. An employer opens this to find out
 * whether the fix worked, so the three states the fix produced lead. STILL_
 * MATCHED is last because 280 rows that were fine and stayed fine is the
 * context, not the news - and it is still on the screen, because leaving it off
 * would make the other numbers look like the whole payroll.
 */
const ORDER: RecheckState[] = [
  "RESOLVED",
  "STILL_EXCEPTION",
  "NEW_EXCEPTION",
  "NEWLY_CHECKED_MATCHED",
  "NEWLY_CHECKED_EXCEPTION",
  "NEWLY_REFUSED",
  "STILL_REFUSED",
  "REMOVED",
  "ADDED",
  "STILL_MATCHED",
];

/**
 * The words for each state, as STATIC keys.
 *
 * `recheck.${state}` would have been shorter and would have been wrong twice:
 * it is not type-checked against the dictionary, and the orphan scan in
 * test_inclusion.py - which counts how translated the interface actually is -
 * cannot see a key that is assembled at runtime. Seven of these were reported
 * as unrendered strings the first time, which is exactly what that scan is for.
 */
const STATE_WORDS: Record<RecheckState, Key> = {
  STILL_MATCHED: "recheck.STILL_MATCHED",
  RESOLVED: "recheck.RESOLVED",
  STILL_EXCEPTION: "recheck.STILL_EXCEPTION",
  NEW_EXCEPTION: "recheck.NEW_EXCEPTION",
  NEWLY_REFUSED: "recheck.NEWLY_REFUSED",
  STILL_REFUSED: "recheck.STILL_REFUSED",
  NEWLY_CHECKED_MATCHED: "recheck.NEWLY_CHECKED_MATCHED",
  NEWLY_CHECKED_EXCEPTION: "recheck.NEWLY_CHECKED_EXCEPTION",
  REMOVED: "recheck.REMOVED",
  ADDED: "recheck.ADDED",
};

/** Which states are worth drawing attention to. Emphasis only - every state is
 * rendered, and a state with no rows still shows its zero. */
const NOTABLE = new Set<RecheckState>([
  "RESOLVED",
  "STILL_EXCEPTION",
  "NEW_EXCEPTION",
  "NEWLY_REFUSED",
  "REMOVED",
  "ADDED",
]);

export function RecheckView({
  result,
  beforeName,
  afterName,
  onLeave,
  onBuildPack,
}: {
  result: EmployerRecheckOut;
  beforeName: string | null;
  afterName: string | null;
  onLeave: () => void;
  onBuildPack: () => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<RecheckState | null>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [result]);

  const row = result.rows.find((r) => r.employee_account_no === selected) ?? null;

  return (
    <>
      <section aria-labelledby="recheck-hero" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p
            ref={headingRef}
            id="recheck-hero"
            tabIndex={-1}
            className="text-meta font-semibold uppercase tracking-wide text-ink-3"
          >
            <T k="recheck.heading" />
          </p>
          <span className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBuildPack}
              className="tap-sm rounded-sm border-2 border-ink bg-surface px-4 py-2 text-meta font-semibold text-ink"
            >
              <T k="report.open" />
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="tap-sm rounded-sm border border-control bg-surface px-4 py-2 text-meta font-medium text-ink hover:border-ink"
            >
              <T k="recheck.leave" />
            </button>
          </span>
        </div>

        {/* The two runs, whole. Each half carries its own coverage, so "3
            exceptions" stays a claim about that run's 293 checked rows. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <RunSide
            labelKey="recheck.before"
            fileName={beforeName}
            difference={result.before_difference}
            exceptions={result.before_summary.exceptions}
            refused={result.before_summary.refused}
            rowsRead={result.before_summary.rows_read}
          />
          <p aria-hidden className="hidden text-title text-ink-3 sm:block">
            &rarr;
          </p>
          <RunSide
            labelKey="recheck.after"
            fileName={afterName}
            difference={result.after_difference}
            exceptions={result.after_summary.exceptions}
            refused={result.after_summary.refused}
            rowsRead={result.after_summary.rows_read}
            strong
          />
        </div>

        {/* THE ONE SENTENCE THAT MAY COMPARE THE TWO AMOUNTS, and it names the
            set it is comparing over. The two figures above are each run's own
            total across its own checked rows; subtracting them would span two
            different sets of rows whenever one was refused in only one run. */}
        <p className="max-w-measure mt-4 text-body text-ink-2">
          <T
            k="recheck.comparableRows"
            vars={{
              n: result.rows_checked_in_both,
              a: money(result.both_before),
              b: money(result.both_after),
            }}
          />
        </p>
      </section>

      <section aria-labelledby="transitions-heading" className="mt-8">
        <h2 id="transitions-heading" className="sr-only">
          {t("recheck.heading")}
        </h2>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0">
            <TransitionList
              result={result}
              active={filterState}
              onPick={(s) => setFilterState((prev) => (prev === s ? null : s))}
            />
            <RowGrids
              rows={result.rows}
              selected={selected}
              onSelect={setSelected}
              filterState={filterState}
            />
            <StateRows
              rows={result.rows}
              filterState={filterState}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="lg:sticky lg:top-6">
            <RecheckInspector row={row} />
          </div>
        </div>
      </section>
    </>
  );
}

function RunSide({
  labelKey,
  fileName,
  difference,
  exceptions,
  refused,
  rowsRead,
  strong,
}: {
  labelKey: Key;
  fileName: string | null;
  difference: { exact: string; display: string };
  exceptions: number;
  refused: number;
  rowsRead: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-5 py-4 ${
        strong ? "border-line-strong bg-surface shadow-card" : "border-line bg-muted"
      }`}
    >
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k={labelKey} />
      </p>
      {fileName && <p className="mt-1 break-all font-mono text-meta text-ink-3">{fileName}</p>}
      <p className="mt-2 text-page font-semibold tabular-nums text-ink">{money(difference)}</p>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-meta">
        <Pair labelKey="employer.rowsRead" value={rowsRead} />
        <Pair labelKey="employer.exceptionRows" value={exceptions} />
        <Pair labelKey="employer.rowsNotChecked" value={refused} />
      </dl>
    </div>
  );
}

function Pair({ labelKey, value }: { labelKey: Key; value: number }) {
  return (
    <span className="flex items-baseline gap-2">
      <dt className="text-ink-3">
        <T k={labelKey} />
      </dt>
      <dd className="font-semibold tabular-nums text-ink-2">{value}</dd>
    </span>
  );
}

/**
 * Every state, with the transition drawn.
 *
 * `▲ → ●` is the whole finding in two glyphs, and the pair is built from the
 * outcomes the state IMPLIES rather than from a lookup written twice - so a
 * state and its picture cannot drift apart.
 */
const TRANSITION: Record<
  RecheckState,
  [("OK" | "EXCEPTION" | "REFUSED") | null, ("OK" | "EXCEPTION" | "REFUSED") | null]
> = {
  STILL_MATCHED: ["OK", "OK"],
  RESOLVED: ["EXCEPTION", "OK"],
  STILL_EXCEPTION: ["EXCEPTION", "EXCEPTION"],
  NEW_EXCEPTION: ["OK", "EXCEPTION"],
  NEWLY_REFUSED: ["OK", "REFUSED"],
  STILL_REFUSED: ["REFUSED", "REFUSED"],
  NEWLY_CHECKED_MATCHED: ["REFUSED", "OK"],
  NEWLY_CHECKED_EXCEPTION: ["REFUSED", "EXCEPTION"],
  REMOVED: ["OK", null],
  ADDED: [null, "OK"],
};

function TransitionList({
  result,
  active,
  onPick,
}: {
  result: EmployerRecheckOut;
  active: RecheckState | null;
  onPick: (s: RecheckState) => void;
}) {
  const t = useT();
  return (
    <ul aria-label={t("recheck.heading")} className="grid gap-1 sm:grid-cols-2">
      {ORDER.map((state) => {
        const n = result.counts[state] ?? 0;
        const [before, after] = TRANSITION[state];
        const on = active === state;
        return (
          <li key={state}>
            <button
              type="button"
              onClick={() => onPick(state)}
              aria-pressed={on}
              disabled={n === 0}
              className={`tap-sm flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left ${
                on ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              <span className="flex shrink-0 items-center gap-1">
                <OutcomeMark outcome={before} />
                <span aria-hidden className="text-meta text-ink-3">
                  &rarr;
                </span>
                <OutcomeMark outcome={after} />
              </span>
              <span
                className={`w-8 shrink-0 text-right text-lead tabular-nums ${
                  n > 0 && NOTABLE.has(state) ? "font-semibold text-ink" : "text-ink-2"
                }`}
              >
                {n}
              </span>
              <span className="min-w-0 text-body text-ink-2">
                <T k={STATE_WORDS[state]} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Both files, one mark per row, the same employee in the same position.
 *
 * THE POSITION IS THE COMPARISON. The two grids are drawn from the SAME array -
 * the engine's row list, one entry per employee across both files - so a mark in
 * the left grid and the mark at the same index on the right are the same person,
 * whatever order either file happened to be exported in. That is the thing a
 * pair of screenshots cannot do and the reason this is worth drawing at all.
 *
 * A row missing from one file gets the ABSENT rule in that grid, not a diamond:
 * an employee who has left the payroll was not "not checked", they were not
 * there.
 */
function RowGrids({
  rows,
  selected,
  onSelect,
  filterState,
}: {
  rows: RecheckRow[];
  selected: string | null;
  onSelect: (account: string) => void;
  filterState: RecheckState | null;
}) {
  const t = useT();
  return (
    <section aria-labelledby="grids-heading" className="mt-8">
      <h3 id="grids-heading" className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="recheck.grids" />
      </h3>
      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        {(["before", "after"] as const).map((side) => (
          <div key={side}>
            <p className="text-meta font-medium text-ink-2">
              <T k={side === "before" ? "recheck.before" : "recheck.after"} />
            </p>
            <div
              role="grid"
              aria-label={`${t(side === "before" ? "recheck.before" : "recheck.after")}, ${t(
                "recheck.grids",
              )}`}
              className="mt-2 flex flex-wrap gap-1"
            >
              {rows.map((r, i) => {
                const outcome = side === "before" ? r.before_outcome : r.after_outcome;
                const dim = filterState !== null && r.state !== filterState;
                const isSel = selected === r.employee_account_no;
                return (
                  <button
                    key={r.employee_account_no}
                    type="button"
                    role="gridcell"
                    // ONE TAB STOP FOR THE PAIR, and it is on the AFTER grid -
                    // see the note on `tabIndex` below. Here the before grid is
                    // reachable by pointer and by the row list, and every row's
                    // full before-and-after is in the list underneath, so
                    // nothing is keyboard-unreachable.
                    tabIndex={side === "after" && i === 0 ? 0 : -1}
                    aria-selected={isSel}
                    onClick={() => onSelect(r.employee_account_no)}
                    aria-label={`${r.employee_name}, ${t(outcomeWord(outcome))}, ${t(STATE_WORDS[r.state])}`}
                    className={`mark-in rounded-full ${
                      isSel ? "outline outline-2 outline-offset-2 outline-ink" : ""
                    }`}
                    style={{ animationDelay: `${Math.min(i * 1.2, 360)}ms` }}
                  >
                    <OutcomeMark outcome={outcome} dim={dim} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="max-w-measure mt-3 text-meta text-ink-3">
        <T k="recheck.gridNote" /> <T k="recheck.matchedOn" />
      </p>
    </section>
  );
}

/** The rows behind whichever state is selected, or the notable ones by default. */
function StateRows({
  rows,
  filterState,
  selected,
  onSelect,
}: {
  rows: RecheckRow[];
  filterState: RecheckState | null;
  selected: string | null;
  onSelect: (account: string) => void;
}) {
  const shown = rows.filter((r) =>
    filterState !== null ? r.state === filterState : NOTABLE.has(r.state),
  );
  if (shown.length === 0) return null;
  return (
    <ul className="mt-8 divide-y divide-line border-t border-line-strong">
      {shown.slice(0, 60).map((r) => (
        <li key={r.employee_account_no}>
          <button
            type="button"
            onClick={() => onSelect(r.employee_account_no)}
            aria-pressed={selected === r.employee_account_no}
            className={`tap-sm block w-full px-2 py-2 text-left ${
              selected === r.employee_account_no ? "bg-muted" : "hover:bg-muted"
            }`}
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="flex items-center gap-2">
                <OutcomeMark outcome={r.before_outcome} />
                <span aria-hidden className="text-meta text-ink-3">
                  &rarr;
                </span>
                <OutcomeMark outcome={r.after_outcome} />
                <span className="text-body text-ink">{r.employee_name}</span>
              </span>
              <span className="flex items-baseline gap-4 font-mono text-meta tabular-nums">
                {r.before_difference && (
                  <span className="text-ink-3">{money(r.before_difference)}</span>
                )}
                <span aria-hidden className="text-ink-3">
                  &rarr;
                </span>
                {r.after_difference ? (
                  <span className="font-semibold text-ink">{money(r.after_difference)}</span>
                ) : (
                  <span className="text-ink-3">&mdash;</span>
                )}
              </span>
            </span>
            <span className="mt-1 block text-meta text-ink-2">
              <T k={STATE_WORDS[r.state]} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One employee, both runs.
 *
 * THE VERDICT LINE IS ABOUT THE ROW AND THE RULE. "This row now matches the
 * checked rule" - not "FairSlip saved $43", which would claim a payment nobody
 * has made, and not "resolved", which is a word this product reserves for
 * arithmetic that closes.
 */
function RecheckInspector({ row }: { row: RecheckRow | null }) {
  return (
    <section
      aria-labelledby="recheck-inspector-heading"
      aria-live="polite"
      className="rounded-lg border border-line-strong bg-surface p-5 shadow-card"
    >
      <h3
        id="recheck-inspector-heading"
        className="text-meta font-semibold uppercase tracking-wide text-ink-3"
      >
        <T k="lens.heading" />
      </h3>

      {!row ? (
        <p className="max-w-measure mt-3 text-body text-ink-2">
          <T k="employer.pickRow" />
        </p>
      ) : (
        <>
          <h4 className="mt-3 text-lead font-semibold text-ink">{row.employee_name}</h4>
          <p className="break-all font-mono text-meta text-ink-3">{row.employee_account_no}</p>

          <table className="mt-4 w-full text-left">
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  &nbsp;
                </th>
                <th scope="col" className="pb-1 text-meta font-medium text-ink-3">
                  <T k="recheck.before" />
                </th>
                <th scope="col" className="pb-1 text-meta font-medium text-ink-3">
                  <T k="recheck.after" />
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-meta tabular-nums">
              <TwoCol
                labelKey="employer.inspectorDeclared"
                before={row.before_declared}
                after={row.after_declared}
              />
              <TwoCol
                labelKey="employer.inspectorExpected"
                before={row.before_expected}
                after={row.after_expected}
              />
              <TwoCol
                labelKey="employer.inspectorDifference"
                before={row.before_difference}
                after={row.after_difference}
                strong
              />
            </tbody>
          </table>

          <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
            <OutcomeMark outcome={row.before_outcome} />
            <span aria-hidden className="text-ink-3">
              &rarr;
            </span>
            <OutcomeMark outcome={row.after_outcome} />
            <span className="text-body font-semibold text-ink">
              <T k={STATE_WORDS[row.state]} />
            </span>
          </div>

          {row.before_reason && (
            <p className="mt-3 text-meta text-ink-2">
              <T k="recheck.before" />:{" "}
              <T k={REASON_WORDS[row.before_reason] ?? "employer.reasonUnknown"} />
            </p>
          )}
          {row.after_reason && (
            <p className="mt-1 text-meta text-ink-2">
              <T k="recheck.after" />:{" "}
              <T k={REASON_WORDS[row.after_reason] ?? "employer.reasonUnknown"} />
            </p>
          )}

          {(row.state === "RESOLVED" || row.state === "STILL_EXCEPTION") && (
            <p className="max-w-measure mt-3 text-body text-ink">
              <T
                k={row.state === "RESOLVED" ? "recheck.rowNowMatches" : "recheck.stillDiffers"}
              />
            </p>
          )}
          {row.after_detail && (
            <p className="max-w-measure mt-2 text-meta text-ink-2">{row.after_detail}</p>
          )}
        </>
      )}
    </section>
  );
}

function TwoCol({
  labelKey,
  before,
  after,
  strong,
}: {
  labelKey: Key;
  before: { exact: string; display: string } | null;
  after: { exact: string; display: string } | null;
  strong?: boolean;
}) {
  const t = useT();
  return (
    <tr className={strong ? "border-t border-line" : ""}>
      <th scope="row" className="py-1 pr-3 font-sans text-meta font-normal text-ink-3">
        <T k={labelKey} />
      </th>
      <td className={`py-1 pr-3 ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>
        {before ? money(before) : t("employer.inspectorNotComputed")}
      </td>
      <td className={`py-1 ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>
        {after ? money(after) : t("employer.inspectorNotComputed")}
      </td>
    </tr>
  );
}
