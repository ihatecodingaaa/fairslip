"use client";

/**
 * The pre-payday check: the same engine, run before the money moves.
 *
 * A worker brings a payslip after the fact and the money is already gone. An
 * employer has the same arithmetic in front of them the day before payday, in a
 * file their payroll system already generates - and at that point the error is
 * still free to fix. Same two rule packs, same refusals, second market.
 *
 * THREE THINGS THIS SCREEN HAS TO SAY, and they are load-bearing:
 *
 *   1. THE SCHEMA IS CPF BOARD'S. Ten of the twelve columns are the CPF EZPay
 *      (FTP) File Specifications' Employer Contribution Detail Record, and the
 *      screen shows the spec's own field name and column positions beside each
 *      one. An employer recognises the file because it IS their file.
 *
 *   2. TWO COLUMNS ARE OURS, AND THEY ARE LABELLED. The Detail Record carries
 *      no date of birth and does not distinguish PR years. A schema that is
 *      mostly official is the easiest possible version of this product's own
 *      failure mode.
 *
 *   3. REFUSED ROWS ARE ON THE SCREEN, NOT MISSING FROM IT. "11 exceptions" is a
 *      claim about the rows that were checked. The seven that were not are in
 *      the coverage strip, in the grid, in their own lane on the skyline and in
 *      their own list - because a row quietly absent from an exceptions table
 *      reads exactly like a clean one.
 *
 * WHAT THE X-RAY PASS CHANGED. The page was a summary, then a row of filter
 * controls, then a grid, then three lists, then two long reference panels - five
 * hundred vertical pixels of prose before the picture and every view stacked
 * below every other. Reading it meant scrolling past four answers to reach the
 * one you wanted.
 *
 * It is now ONE DOMINANT VIEW AT A TIME beside a permanent inspector. Four
 * lenses answer four different questions about the same run - which rows
 * (Status), how much and which way (Difference), what kind (Reasons), and the
 * rows themselves (Rows) - and selecting a row in any of them fills the same
 * inspector. The reference panels are one disclosure at the foot, because scope
 * belongs in one place rather than restated on every screen.
 *
 * NOT ONE FIGURE ON THIS PAGE IS COMPUTED HERE. Every amount is a Money the
 * backend built, and every count and every per-reason total is a field of the
 * engine's own aggregates - see fairslip/employer.py's ReasonAggregate and
 * CheckedTotals, and the identities held in backend/tests/test_employer_xray.py.
 * A bar's LENGTH is derived here. The number beside it never is.
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  EMPLOYER_DEMO_CSV,
  EMPLOYER_DEMO_CSV_CORRECTED,
  getEmployerSchema,
  money,
  postEmployerCheck,
  postEmployerRecheck,
  type EmployerCheckOut,
  type EmployerFinding,
  type EmployerRecheckOut,
  type EmployerSchemaOut,
  type Refusal,
  type SpecField,
} from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { AppShell } from "../ui/AppShell";
import { EngineMark } from "../ui/EngineMark";
import { T, useT } from "../ui/Prefs";
import { PayrollConstellation } from "./PayrollConstellation";
import { ReasonBars } from "./ReasonBars";
import { RecheckView } from "./RecheckView";
import { ReportStudio } from "./report/Studio";
import { REASON_WORDS } from "./reasons";
import { svgToText } from "./svgExport";
import { downloadText } from "../ui/download";
import { VarianceSkyline, type SkylineOrder } from "./VarianceSkyline";

/** The four questions this run can be asked. One is on screen at a time. */
const LENSES = [
  { id: "status", label: "employer.lensStatus" },
  { id: "difference", label: "employer.lensDifference" },
  { id: "reasons", label: "employer.lensReasons" },
  { id: "rows", label: "employer.lensRows" },
] as const;

type LensId = (typeof LENSES)[number]["id"];

export default function EmployerPage() {
  const t = useT();
  const [schema, setSchema] = useState<EmployerSchemaOut | null>(null);
  const [result, setResult] = useState<EmployerCheckOut | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  /* WHICH REQUEST THE REFUSAL CAME FROM. Recorded when it arrives rather
     than inferred from other state afterwards: the first version read it off
     `afterName`, which the refusal path itself clears, so the recheck wording
     could never appear. */
  const [refusalOf, setRefusalOf] = useState<"check" | "recheck" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  /* THE FIRST FILE IS KEPT, AND IT IS KEPT IN THE BROWSER.
     Recheck posts BOTH files, because the comparison is one engine call over
     two runs rather than a diff of two responses - so the original has to still
     be here when the corrected one arrives. It is a File the user already
     chose; nothing is uploaded anywhere until they ask for the comparison, and
     nothing is stored server-side after it. */
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [recheckResult, setRecheckResult] = useState<EmployerRecheckOut | null>(null);
  const [afterName, setAfterName] = useState<string | null>(null);
  const [studio, setStudio] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  // Identity of the current run. It keys the grid, so a new file remounts it and
  // the roving tab stop starts again on that file's first exception.
  const [runId, setRunId] = useState(0);
  const [filterReason, setFilterReason] = useState<string | null>(null);
  const [lens, setLens] = useState<LensId>("status");
  const [order, setOrder] = useState<SkylineOrder>("file");
  const skylineSvg = useRef<SVGSVGElement | null>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    getEmployerSchema()
      .then((r) => (r.ok ? setSchema(r.value) : setError(r.refusal.detail)))
      .catch((e) => setError(String(e)));
  }, []);

  // WCAG 4.1.3, same as /check: the answer lands somewhere other than where the
  // reader is looking, and the page visibly grows.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  async function run(file: File) {
    setBusy(true);
    setRefusal(null);
    setRefusalOf(null);
    setError(null);
    setFileName(file.name);
    setBeforeFile(file);
    // A new first file makes any existing comparison a comparison of something
    // else. It goes, rather than sitting under a run it does not describe.
    setRecheckResult(null);
    setAfterName(null);
    setStudio(false);
    setSelectedRow(null);
    setFilterReason(null);
    setLens("status");
    try {
      const r = await postEmployerCheck(file);
      if (r.ok) {
        setResult(r.value);
        setRunId((n) => n + 1);
        setAnnounce(
          `${t("employer.rowsRead")} ${r.value.rows_read}. ${t("employer.exceptionRows")} ${
            r.value.exceptions
          }. ${t("employer.rowsNotChecked")} ${r.value.refused}.`,
        );
      } else {
        setResult(null);
        setRefusal(r.refusal);
        setRefusalOf("check");
        // SAID, NOT ONLY SHOWN. The success path announces; without this the
        // banner is silent to a screen reader while a sighted reader sees it.
        setAnnounce(r.refusal.detail);
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /* THE RESPONSE HAS TO BE CHECKED BEFORE IT IS TREATED AS A FILE.
     Without `res.ok`, a 500 or an HTML error page was handed to /employer/check
     as a CSV, which then refused it with "the file is missing columns this check
     needs: uen, payment_type, ..." - and the screen blamed the user's file for a
     server failure. An error path swallowed into a wrong attribution is worse
     than an error path that says nothing. */
  async function fetchDemoCsv(url: string, filename: string): Promise<File | null> {
    const res = await fetch(url);
    if (!res.ok) {
      setError(
        `The demo file could not be fetched: HTTP ${res.status} from ${url}. ` +
          `Nothing was checked, and this is not a problem with any payroll file.`,
      );
      return null;
    }
    return new File([await res.text()], filename, { type: "text/csv" });
  }

  async function runDemo() {
    setBusy(true);
    setError(null);
    try {
      const file = await fetchDemoCsv(EMPLOYER_DEMO_CSV, "fairslip-demo-roster.csv");
      if (!file) return;
      await run(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runRecheck(after: File) {
    if (!beforeFile) {
      // Unreachable while the invite only renders under a result - but a bare
      // `return` here left the caller's `busy` true and the button reading
      // "Checking..." for ever, which is the one behaviour a dead branch must
      // not have.
      setError("The first file is no longer in this browser. Check it again before comparing.");
      setBusy(false);
      return;
    }
    setBusy(true);
    setRefusal(null);
    setRefusalOf(null);
    setError(null);
    setAfterName(after.name);
    try {
      const r = await postEmployerRecheck(beforeFile, after);
      if (r.ok) {
        setRecheckResult(r.value);
        setAnnounce(
          `${t("recheck.heading")}. ${t("recheck.RESOLVED")}: ${r.value.counts.RESOLVED}. ` +
            `${t("recheck.STILL_EXCEPTION")}: ${r.value.counts.STILL_EXCEPTION}. ` +
            `${t("recheck.NEW_EXCEPTION")}: ${r.value.counts.NEW_EXCEPTION}.`,
        );
      } else {
        setRecheckResult(null);
        // THE NAME GOES WITH THE COMPARISON. It was set before the request and
        // left behind on refusal, so opening the review pack afterwards printed
        // "roster.csv -> corrected.csv" in the header of a pack that contains no
        // before/after section and whose every figure comes from the first run.
        // The JSON export carried that as its machine-readable `source`.
        setAfterName(null);
        setRefusal(r.refusal);
        setRefusalOf("recheck");
        setAnnounce(r.refusal.detail);
      }
    } catch (e) {
      setRecheckResult(null);
      setAfterName(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runRecheckDemo() {
    setBusy(true);
    setError(null);
    try {
      const file = await fetchDemoCsv(
        EMPLOYER_DEMO_CSV_CORRECTED,
        "fairslip-demo-roster-corrected.csv",
      );
      if (!file) return;
      await runRecheck(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const findings = result?.findings ?? [];
  const selected = findings.find((f) => f.row_number === selectedRow) ?? null;

  return (
    <AppShell>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* THE PAGE'S OWN MASTHEAD IS SCREEN FURNITURE ONCE THE PACK IS OPEN.
          The review pack is its own document with its own title, generated
          stamp and source files; printing "Check the payroll before payday" and
          the product's one-line pitch above it would make the PDF read as a
          screenshot of a website rather than as the report it is. The app's
          navigation is already print-hidden in AppShell for the same reason. */}
      <header className={studio ? "print-hide" : undefined}>
        <h1 className="text-page font-semibold tracking-tight">
          Check the payroll before payday
        </h1>
        {/* ONE LINE. The three-sentence version said what the product does, what
            it does not edit, and why that matters - which is the coverage strip,
            the row inspector and the sources panel saying it again in advance. */}
        <p className="max-w-measure mt-2 text-lead text-ink-2">
          Your payroll system produced these numbers. FairSlip checks them
          independently, and never edits them.
        </p>
        <EngineMark className="mt-4" />
      </header>

      {error && (
        <p className="mt-6 rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-body text-danger-fg">
          {error}
        </p>
      )}
      {refusal && (
        <div
          role="alert"
          className="mt-6 rounded-sm border border-attention-line bg-attention-bg px-4 py-3"
        >
          {/* WHICH THING WAS REFUSED. On a recheck both files WERE checked - it
              is the comparison between them that was refused, because the rows
              could not be told apart. The old heading said "The file was not
              checked" either way, which is false of that case and sends an
              employer looking at the wrong thing. */}
          <p className="text-body font-semibold text-attention-fg">
            {refusalOf === "recheck"
              ? "The two files were not compared."
              : "The file was not checked."}
          </p>
          <p className="mt-1 font-mono text-meta text-attention-fg">{refusal.detail}</p>
        </div>
      )}

      {!result && <UploadPanel onPick={run} onDemo={runDemo} busy={busy} />}

      {result && studio && (
        /* THE FILENAMES HAVE TO NAME THE RUN THE ROWS CAME FROM.
           `result` here is the AFTER run whenever a comparison exists - its
           coverage, its rows, its totals - so labelling it with the FIRST file's
           name attributed every row to a file that produced none of them, in the
           pack and in its JSON. The model now records `figures_from` - the file
           the rows in this pack actually came from - and `afterFilename` is null
           when there is no comparison, so a pack with no before/after section
           cannot name a corrected file at all. */
        <ReportStudio
          result={recheckResult ? recheckResult.after_summary : result}
          comparison={recheckResult}
          schema={schema}
          beforeFilename={fileName}
          afterFilename={recheckResult ? afterName : null}
          onLeave={() => setStudio(false)}
        />
      )}

      {result && !studio && recheckResult && (
        <RecheckView
          result={recheckResult}
          beforeName={fileName}
          afterName={afterName}
          onLeave={() => {
            setRecheckResult(null);
            setAfterName(null);
          }}
          onBuildPack={() => setStudio(true)}
        />
      )}

      {result && !studio && !recheckResult && (
        <>
          <XRayHero result={result} fileName={fileName} headingRef={resultRef} />

          <section aria-labelledby="xray-heading" className="mt-10">
            <h2 id="xray-heading" className="sr-only">
              {t("employer.xray")}
            </h2>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-w-0">
                <LensTabs
                  lens={lens}
                  onPick={(id) => setLens(id)}
                  toolbar={
                    <>
                      {lens === "difference" && (
                        <>
                          <OrderToggle order={order} onPick={setOrder} />
                          <button
                            type="button"
                            onClick={() => {
                              const text = svgToText(skylineSvg.current);
                              if (text)
                                downloadText(
                                  text,
                                  "fairslip-variance-skyline.svg",
                                  "image/svg+xml",
                                );
                            }}
                            className="tap-sm rounded-sm border border-control bg-surface px-3 py-2 text-meta font-medium text-ink hover:border-ink"
                          >
                            <T k="employer.downloadSvg" />
                          </button>
                        </>
                      )}
                      {filterReason && (
                        <button
                          type="button"
                          onClick={() => setFilterReason(null)}
                          className="tap-sm rounded-sm border border-ink bg-muted px-3 py-2 text-meta font-semibold text-ink"
                        >
                          <T k="employer.filterAll" />
                        </button>
                      )}
                    </>
                  }
                >
                  {lens === "status" && (
                    <PayrollConstellation
                      key={runId}
                      findings={findings}
                      selected={selectedRow}
                      onSelect={setSelectedRow}
                      filterReason={filterReason}
                    />
                  )}
                  {lens === "difference" && (
                    <VarianceSkyline
                      key={`${runId}-skyline`}
                      findings={findings}
                      selected={selectedRow}
                      onSelect={setSelectedRow}
                      filterReason={filterReason}
                      order={order}
                      svgRef={skylineSvg}
                    />
                  )}
                  {lens === "reasons" && (
                    <ReasonBars
                      reasons={result.reasons}
                      active={filterReason}
                      onPick={setFilterReason}
                    />
                  )}
                  {lens === "rows" && (
                    <RowsLens
                      findings={findings}
                      selected={selectedRow}
                      onSelect={setSelectedRow}
                      filterReason={filterReason}
                    />
                  )}
                </LensTabs>
              </div>

              <div className="lg:sticky lg:top-6">
                <RowInspector finding={selected} />
              </div>
            </div>
          </section>

          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStudio(true)}
              className="tap rounded-sm border-2 border-ink bg-surface px-5 py-3 text-body font-semibold text-ink"
            >
              <T k="report.open" />
            </button>
          </div>

          <RecheckInvite onPick={runRecheck} onDemo={runRecheckDemo} busy={busy} />

          <section className="mt-10 border-t border-line pt-6">
            <UploadPanel onPick={run} onDemo={runDemo} busy={busy} compact />
          </section>
        </>
      )}

      {schema && <SourcesPanel schema={schema} />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ upload */

function UploadPanel({
  onPick,
  onDemo,
  busy,
  compact,
}: {
  onPick: (f: File) => void;
  onDemo: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "" : "mt-8 rounded-lg border border-line-strong bg-surface p-6 shadow-card"}>
      <h2 className={compact ? "text-body font-semibold text-ink-2" : "text-title font-semibold"}>
        {compact ? "Check another file" : "Your CPF file, as a CSV"}
      </h2>
      {!compact && (
        <p className="max-w-measure mt-1 text-body text-ink-2">
          Nothing is stored. The file is read, checked and dropped inside the request.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDemo}
          disabled={busy}
          className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid disabled:opacity-50"
        >
          {busy ? "Checking…" : "Run the fictional 300-employee roster"}
        </button>
        <label className="tap inline-flex cursor-pointer items-center rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
          Choose a CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
            }}
          />
        </label>
        <a href={EMPLOYER_DEMO_CSV} className="text-meta text-ink-2 underline underline-offset-2">
          download that roster
        </a>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- recheck */

/**
 * The way into the second run.
 *
 * IT SITS UNDER THE FINDINGS, NOT BESIDE THE UPLOAD. The sequence is the
 * product: read the X-ray, fix the payroll in your own system, come back with
 * the export. Offering it before there is anything to fix would be offering a
 * comparison with nothing on one side of it.
 */
function RecheckInvite({
  onPick,
  onDemo,
  busy,
}: {
  onPick: (f: File) => void;
  onDemo: () => void;
  busy: boolean;
}) {
  return (
    <section className="mt-10 rounded-lg border border-line-strong bg-surface p-6 shadow-card">
      <h2 className="text-title font-semibold">
        <T k="recheck.heading" />
      </h2>
      <p className="max-w-measure mt-1 text-body text-ink-2">
        <T k="recheck.explain" />
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDemo}
          disabled={busy}
          className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid disabled:opacity-50"
        >
          {busy ? "Checking…" : <T k="recheck.startDemo" />}
        </button>
        <label className="tap inline-flex cursor-pointer items-center rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
          <T k="recheck.start" />
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
            }}
          />
        </label>
        <a
          href={EMPLOYER_DEMO_CSV_CORRECTED}
          className="text-meta text-ink-2 underline underline-offset-2"
        >
          download that corrected roster
        </a>
      </div>
      <p className="max-w-measure mt-3 text-meta text-ink-3">
        <T k="recheck.matchedOn" />
      </p>
    </section>
  );
}

/* -------------------------------------------------------------- the hero */

/**
 * What the run found, in the order an employer needs it.
 *
 * THE COVERAGE STRIP IS NOT OPTIONAL AND NOT BELOW THE FOLD. The headline figure
 * is a claim about the rows that were checked, and the only thing that makes it
 * a true claim rather than a claim about a payroll is the four counts beside it.
 *
 * THE BRIDGE IS DRAWN BECAUSE THE IDENTITY HOLDS. `declared_total -
 * expected_total == signed_difference` exactly, over checked rows, asserted in
 * backend/tests/test_employer_xray.py. Refused rows are in neither end, and the
 * line under it says how many that is - a bridge between two totals that quietly
 * omitted seven rows would be the product's own failure mode in a diagram.
 */
function XRayHero({
  result,
  fileName,
  headingRef,
}: {
  result: EmployerCheckOut;
  fileName: string | null;
  headingRef?: React.Ref<HTMLParagraphElement>;
}) {
  return (
    <section aria-labelledby="xray-hero" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p
          ref={headingRef}
          id="xray-hero"
          tabIndex={-1}
          className="text-meta font-semibold uppercase tracking-wide text-ink-3"
        >
          <T k="employer.xray" />
        </p>
        {fileName && <p className="font-mono text-meta text-ink-3">{fileName}</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-12 gap-y-6">
        <div>
          <p className="text-hero font-semibold tabular-nums text-ink sm:text-display">
            {money(result.total_difference)}
          </p>
          <p className="mt-1 max-w-measure text-body text-ink-2">
            <T k="employer.headline" />
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-10 gap-y-4 border-l border-line-strong pl-8">
          <Stat labelKey="employer.rowsRead" value={result.rows_read} />
          <Stat labelKey="employer.checkedRows" value={result.checked} />
          <Stat labelKey="employer.exceptionRows" value={result.exceptions} strong />
          <Stat labelKey="employer.rowsNotChecked" value={result.refused} />
        </dl>
      </div>

      {/* The two ends of the payroll, and the gap between them. */}
      {/* ITEMS-BASELINE, NOT ITEMS-CENTER. Each end of the bridge is a
          two-line block - the amount over its label - so centring the operators
          against the whole block dropped them into the gap between the two
          lines, where a minus sign reads as an underscore. Baseline alignment
          puts them on the line of the amounts they operate on, which is where
          the arithmetic is. */}
      <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-3 rounded-lg border border-line bg-muted px-5 py-4">
        <BridgeEnd labelKey="employer.declaredTotal" value={result.totals.declared_total} />
        <span aria-hidden className="text-lead text-ink-3">
          &minus;
        </span>
        <BridgeEnd labelKey="employer.expectedTotal" value={result.totals.expected_total} />
        <span aria-hidden className="text-lead text-ink-3">
          =
        </span>
        <BridgeEnd
          labelKey="employer.inspectorDifference"
          value={result.totals.signed_difference}
          strong
        />
        <p className="basis-full text-meta text-ink-3">
          <T k="employer.bridgeRows" vars={{ n: result.totals.rows }} />
          {result.refused > 0 && (
            <>
              {" · "}
              <T k="employer.bridgeRefused" vars={{ n: result.refused }} />
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function BridgeEnd({
  labelKey,
  value,
  strong,
}: {
  labelKey: Key;
  value: { exact: string; display: string };
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span
        className={`order-1 font-mono tabular-nums ${
          strong ? "text-lead font-semibold text-ink" : "text-lead text-ink-2"
        }`}
      >
        {money(value)}
      </span>
      <span className="order-2 text-meta text-ink-3">
        <T k={labelKey} />
      </span>
    </div>
  );
}

function Stat({
  labelKey,
  value,
  strong,
}: {
  labelKey: Key;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-meta text-ink-3">
        <T k={labelKey} />
      </dt>
      <dd
        className={`order-1 tabular-nums ${
          strong ? "text-title font-semibold text-ink" : "text-title font-medium text-ink-2"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------- the lenses */

/**
 * Four views of one run, one at a time.
 *
 * REAL TABS, not four buttons that swap a div. `role="tablist"`, one tab stop
 * for the set, arrow keys between them, and each panel labelled by its tab - so
 * a screen reader announces "Difference, tab 2 of 4" and a keyboard user is not
 * walked through four stops to reach the picture.
 */
function LensTabs({
  lens,
  onPick,
  toolbar,
  children,
}: {
  lens: LensId;
  onPick: (id: LensId) => void;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();
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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line-strong">
        <div
          ref={list}
          role="tablist"
          aria-label={t("employer.lensLabel")}
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
                <T k={l.label} />
              </button>
            );
          })}
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2 pb-2">{toolbar}</div>}
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

function OrderToggle({
  order,
  onPick,
}: {
  order: SkylineOrder;
  onPick: (o: SkylineOrder) => void;
}) {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t("employer.order")}
      className="flex rounded-sm border border-control"
    >
      {(
        [
          ["file", "employer.orderFile"],
          ["largest", "employer.orderLargest"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          aria-pressed={order === id}
          className={`tap-sm px-3 py-2 text-meta ${
            order === id ? "bg-muted font-semibold text-ink" : "font-medium text-ink-2"
          }`}
        >
          <T k={label} />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ the inspector */

/**
 * One row, from the first glance to the engine's own words.
 *
 * THE ORDER IS THE READING ORDER. Who, then the two amounts and the gap between
 * them, then what the engine made of it, then why - and only then the wage, the
 * formula and the flags, which are the evidence for the sentence above rather
 * than the way into it. The previous version opened with a definition list of
 * four amounts and closed with the sentence that explained them.
 *
 * THE REASON CODE IS PRESENT AND IT IS SMALL. It is what an employer quotes back
 * to us; it is not what they read first.
 */
function RowInspector({ finding }: { finding: EmployerFinding | null }) {
  const t = useT();
  const [technical, setTechnical] = useState(false);
  const uid = useId();

  return (
    <section
      aria-labelledby="row-inspector-heading"
      aria-live="polite"
      className="rounded-lg border border-line-strong bg-surface p-5 shadow-card"
    >
      <h3
        id="row-inspector-heading"
        className="text-meta font-semibold uppercase tracking-wide text-ink-3"
      >
        <T k="lens.heading" />
      </h3>

      {!finding ? (
        <p className="max-w-measure mt-3 text-body text-ink-2">
          <T k="employer.pickRow" />
        </p>
      ) : (
        <>
          <p className="mt-3 font-mono text-meta text-ink-3">
            <T k="employer.rowSelected" vars={{ n: finding.row_number }} />
          </p>
          <h4 className="mt-1 text-lead font-semibold text-ink">{finding.employee_name}</h4>
          <p className="break-all font-mono text-meta text-ink-3">
            {finding.employee_account_no}
          </p>

          {/* The subtraction, laid out as one. */}
          <div className="mt-4 flex items-baseline gap-3">
            <Amount labelKey="employer.inspectorDeclared" value={finding.declared} />
            <span aria-hidden className="text-body text-ink-3">
              &rarr;
            </span>
            <Amount labelKey="employer.inspectorExpected" value={finding.expected} />
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <p className="text-meta text-ink-3">
              <T k="employer.inspectorDifference" />
            </p>
            <p className="font-mono text-title font-semibold tabular-nums text-ink">
              {finding.difference ? money(finding.difference) : t("employer.inspectorNotComputed")}
            </p>
          </div>

          <p className="mt-4 text-meta text-ink-3">
            <T k="employer.inspectorOutcome" />
          </p>
          <p
            className={`text-body font-semibold ${
              finding.outcome === "EXCEPTION" ? "text-attention-fg" : "text-ink"
            }`}
          >
            <T
              k={
                finding.outcome === "OK"
                  ? "employer.matched"
                  : finding.outcome === "EXCEPTION"
                    ? "employer.exception"
                    : "employer.notChecked"
              }
            />
          </p>

          {finding.reason && (
            <>
              <p className="mt-4 text-meta text-ink-3">
                <T k="employer.inspectorWhy" />
              </p>
              <p className="text-body text-ink">
                <T k={REASON_WORDS[finding.reason] ?? "employer.reasonUnknown"} />
              </p>
              <p className="break-all font-mono text-meta text-ink-3">{finding.reason}</p>
            </>
          )}

          <p className="max-w-measure mt-3 text-meta text-ink-2">{finding.detail}</p>

          <button
            type="button"
            onClick={() => setTechnical((v) => !v)}
            aria-expanded={technical}
            aria-controls={uid}
            className="tap-sm mt-4 inline-flex items-center gap-2 rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            <span aria-hidden className="font-mono">
              {technical ? "−" : "+"}
            </span>
            <T k="employer.inspectorTechnical" />
          </button>
          <div id={uid} hidden={!technical} className="mt-3">
            <dl className="space-y-2">
              <DlRow labelKey="employer.inspectorWage">
                {finding.ordinary_wages ? money(finding.ordinary_wages) : "—"}
              </DlRow>
              {finding.band && (
                <DlRow labelKey="employer.inspectorBand">{finding.band}</DlRow>
              )}
            </dl>
            {finding.engine_formula && (
              <p className="mt-3 break-words rounded-sm bg-muted px-3 py-2 font-mono text-meta text-ink-2">
                {finding.engine_formula}
              </p>
            )}
            {finding.engine_flags.map((flag) => (
              <p key={flag} className="mt-2 font-mono text-meta text-attention-fg">
                {flag}
              </p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Amount({
  labelKey,
  value,
}: {
  labelKey: Key;
  value: { exact: string; display: string } | null;
}) {
  const t = useT();
  return (
    <span className="flex min-w-0 flex-col">
      <span className="order-1 truncate font-mono text-body tabular-nums text-ink">
        {value ? money(value) : t("employer.inspectorNotComputed")}
      </span>
      <span className="order-2 text-meta text-ink-3">
        <T k={labelKey} />
      </span>
    </span>
  );
}

function DlRow({ labelKey, children }: { labelKey: Key; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <dt className="text-meta text-ink-3">
        <T k={labelKey} />
      </dt>
      <dd className="font-mono text-meta tabular-nums text-ink">{children}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- the rows */

/**
 * The rows themselves, grouped by what the engine did with them.
 *
 * NOT CHECKED IS A GROUP OF ITS OWN AND IT IS NOT LAST BY ACCIDENT - it sits
 * directly under the exceptions, before the 282 that matched, because that is
 * the order of what an employer has to act on.
 */
function RowsLens({
  findings,
  selected,
  onSelect,
  filterReason,
}: {
  findings: EmployerFinding[];
  selected: number | null;
  onSelect: (row: number) => void;
  filterReason: string | null;
}) {
  const shown = filterReason ? findings.filter((f) => f.reason === filterReason) : findings;
  const groups: { titleKey: Key; rows: EmployerFinding[] }[] = [
    { titleKey: "employer.rowsExceptions", rows: shown.filter((f) => f.outcome === "EXCEPTION") },
    { titleKey: "employer.rowsNotChecked", rows: shown.filter((f) => f.outcome === "REFUSED") },
    { titleKey: "employer.rowsMatched", rows: shown.filter((f) => f.outcome === "OK") },
  ];

  return (
    <div className="grid gap-8">
      {groups.map((g) => (
        <RowGroup
          key={g.titleKey}
          titleKey={g.titleKey}
          rows={g.rows}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function RowGroup({
  titleKey,
  rows,
  selected,
  onSelect,
}: {
  titleKey: Key;
  rows: EmployerFinding[];
  selected: number | null;
  onSelect: (row: number) => void;
}) {
  const [limit, setLimit] = useState(40);
  if (rows.length === 0) return null;
  const visible = rows.slice(0, limit);
  return (
    <section>
      <h3 className="flex items-baseline gap-2 border-b border-line-strong pb-1 text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k={titleKey} />
        <span className="tabular-nums">{rows.length}</span>
      </h3>
      <ul className="divide-y divide-line">
        {visible.map((f) => (
          <li key={f.row_number}>
            <button
              type="button"
              onClick={() => onSelect(f.row_number)}
              aria-pressed={selected === f.row_number}
              className={`tap-sm block w-full px-2 py-2 text-left ${
                selected === f.row_number ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 text-body text-ink">
                  {f.employee_name}{" "}
                  <span className="font-mono text-meta text-ink-3">
                    {f.employee_account_no}
                  </span>
                </span>
                <span className="flex items-baseline gap-4">
                  {f.difference && (
                    <span className="font-mono text-body font-semibold tabular-nums text-ink">
                      {money(f.difference)}
                    </span>
                  )}
                  <span className="font-mono text-meta tabular-nums text-ink-3">
                    <T k="employer.rowSelected" vars={{ n: f.row_number }} />
                  </span>
                </span>
              </span>
              {f.reason && (
                <span className="mt-1 block text-meta text-ink-2">
                  <T k={REASON_WORDS[f.reason] ?? "employer.reasonUnknown"} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 100)}
          className="tap-sm mt-2 rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink"
        >
          <T k="employer.showMore" vars={{ n: rows.length - limit }} />
        </button>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- the sources */

/**
 * Where every rule on this page comes from, in ONE place.
 *
 * It was two full-width panels, always open, under every result - the schema
 * table and CPF Board's mistakes list, roughly nine hundred pixels of reference
 * material below the findings. It is the same content, behind one disclosure,
 * because scope belongs somewhere a reader can go rather than somewhere they
 * have to scroll through.
 */
function SourcesPanel({ schema }: { schema: EmployerSchemaOut }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  return (
    <section className="mt-10 border-t border-line pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={uid}
        className="tap-sm inline-flex items-center gap-2 rounded-sm text-body font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
      >
        <span aria-hidden className="font-mono">
          {open ? "−" : "+"}
        </span>
        The columns, the rounding and the mistakes list &mdash; and whose they are
      </button>

      <div id={uid} hidden={!open} className="mt-6 grid gap-10">
        <div>
          <h2 className="text-title font-semibold">The columns, and whose they are</h2>
          <p className="max-w-measure mt-1 text-body text-ink-2">
            Ten of these are CPF Board&rsquo;s own, from the {schema.spec_record} of the{" "}
            <a
              href={schema.spec_url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {schema.spec_title}
            </a>{" "}
            ({schema.spec_effective}; {schema.spec_length}; {schema.spec_read_on}).
          </p>

          <FieldTable
            caption="CPF Board's columns, with the column positions of the fixed-width record"
            fields={schema.spec_fields}
          />

          <div className="mt-6 rounded-sm border-2 border-dashed border-control p-4">
            <h3 className="text-body font-semibold">
              Two columns FairSlip asks for that CPF Board does not
            </h3>
            <p className="max-w-measure mt-1 text-meta text-ink-2">
              The Detail Record has no date of birth, and its S and T prefixes separate citizens
              from permanent residents registered since 1 January 2000 &mdash; they do not say
              which PR year applies. The engine needs both.
            </p>
            <FieldTable caption="" fields={schema.extra_fields} />
          </div>

          {/* THE SCHEMA CONFIRMS THE THESIS. The government's own record has no
              room for a Work Permit holder, because a Work Permit holder is not
              a CPF member - which is exactly why this product ships two workers. */}
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-body font-semibold">
              Who is even in this file: the record admits two prefixes
            </h3>
            <p className="max-w-measure mt-1 text-meta text-ink-2">
              On the <span className="font-mono">employee_account_no</span> column (cols
              29&ndash;37), the specification says:
            </p>
            <blockquote lang="en" className="mt-2 border-l-4 border-brand-line px-4 py-2">
              <p className="max-w-measure text-body text-brand-fg">
                &ldquo;{schema.account_column}&rdquo;
              </p>
            </blockquote>
            <p className="max-w-measure mt-2 text-meta text-ink-2">And its Notes, item 4:</p>
            <blockquote lang="en" className="mt-2 border-l-4 border-brand-line px-4 py-2">
              <p className="max-w-measure text-body text-brand-fg">&ldquo;{schema.note_4}&rdquo;</p>
              <figcaption className="mt-2 text-meta text-brand-fg">
                <a
                  href={schema.spec_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {schema.spec_title}, Notes item 4 ({schema.spec_effective})
                </a>
              </figcaption>
            </blockquote>
            <p className="max-w-measure mt-3 text-body text-ink-2">
              <span className="font-semibold text-ink">
                FairSlip&rsquo;s reading, not CPF Board&rsquo;s:{" "}
              </span>
              {schema.note_4_reading}
            </p>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-body font-semibold">
              The specification states CPF&rsquo;s rounding, and our engine already did it
            </h3>
            <blockquote lang="en" className="mt-2 border-l-4 border-brand-line px-4 py-2">
              <p className="max-w-measure text-body text-brand-fg">(a) {schema.rounding_a};</p>
              <p className="max-w-measure mt-1 text-body text-brand-fg">(b) {schema.rounding_b}.</p>
            </blockquote>
            <p className="max-w-measure mt-2 text-meta text-ink-2">
              FairSlip&rsquo;s CPF engine was written from CPF Board&rsquo;s contribution-rates
              page and rounds exactly that way: the total to the nearest dollar, the
              employee&rsquo;s share down, the employer&rsquo;s share as the remainder. The
              specification&rsquo;s own two worked examples are run as tests.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-title font-semibold">What it looks for, and who says so</h2>
          <p className="max-w-measure mt-1 text-body text-ink-2">
            CPF Board&rsquo;s own words, from{" "}
            <a
              href={schema.mistakes_url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Common Mistakes Which Require Subsequent Adjustments To Employers&rsquo; CPF Payments
            </a>{" "}
            (information correct as at April 2024). FairSlip did not decide what an employer
            commonly gets wrong.
          </p>
          {schema.mistakes.map(([heading, bullets]) => (
            <div key={heading} className="mt-4">
              <h3 className="text-body font-semibold">{heading}</h3>
              <ul className="mt-2 space-y-1">
                {bullets.map((b) => (
                  <li key={b} lang="en" className="max-w-measure text-body text-ink-2">
                    &ldquo;{b}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="max-w-measure mt-4 text-meta text-ink-3">
            FairSlip checks the ones its engines can establish from the file. It does not check
            wage classification itself &mdash; a row carrying Additional Wages is refused rather
            than compared, because the engine computes Ordinary Wages only.
          </p>
        </div>
      </div>
    </section>
  );
}

function FieldTable({ caption, fields }: { caption: string; fields: SpecField[] }) {
  return (
    // FOCUSABLE, because it scrolls. At 390px this table is wider than the
    // column and scrolls inside its own box - and a scrollable box that cannot
    // take focus is a region a keyboard user cannot reach the right-hand side
    // of. axe flagged it at 390 and not at 1400, which is exactly the kind of
    // thing a desktop-only harness never sees. WCAG 2.1.1.
    <div
      className="mt-3 overflow-x-auto"
      tabIndex={0}
      role="group"
      aria-label={caption || "The columns FairSlip asks for that CPF Board does not"}
    >
      <table className="w-full min-w-[36rem] text-left">
        {caption && <caption className="pb-2 text-left text-meta text-ink-3">{caption}</caption>}
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="py-2 pr-4 text-meta font-semibold uppercase tracking-wide text-ink-3">
              CSV column
            </th>
            <th scope="col" className="py-2 pr-4 text-meta font-semibold uppercase tracking-wide text-ink-3">
              Field in the CPF record
            </th>
            <th scope="col" className="py-2 pr-4 text-meta font-semibold uppercase tracking-wide text-ink-3">
              Cols
            </th>
            <th scope="col" className="py-2 text-meta font-semibold uppercase tracking-wide text-ink-3">
              Type
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {fields.map((f) => (
            <tr key={f.csv_name}>
              <td className="py-2 pr-4 align-top font-mono text-meta text-ink">{f.csv_name}</td>
              <td className="py-2 pr-4 align-top text-meta text-ink-2">
                {f.spec_name}
                {f.note && <span className="block text-ink-3">{f.note}</span>}
              </td>
              <td className="py-2 pr-4 align-top font-mono text-meta text-ink-3">{f.columns}</td>
              <td className="py-2 align-top font-mono text-meta text-ink-3">{f.data_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
