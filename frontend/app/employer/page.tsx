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
 *      no date of birth and does not distinguish PR years. Those are rendered in
 *      a separate group that says so. A schema that is mostly official is the
 *      easiest possible version of this product's own failure mode.
 *
 *   3. REFUSED ROWS ARE ON THE SCREEN, NOT MISSING FROM IT. "11 exceptions" is a
 *      claim about the rows that were checked. The seven that were not are
 *      counted in the same strip AND drawn in the same grid, because a row
 *      quietly absent from an exceptions table reads exactly like a clean one.
 *
 * WHAT THE DESIGN PASS CHANGED. The result was a stat row, a bar chart of
 * counts, and three lists - which meant the 300-row demo's whole argument, that
 * this scales past what a person can read, arrived as the number "300" in a
 * table. It is now a grid with one mark per row: the exceptions are visible as
 * exceptions, the refusals are visible as holes, and the lists are underneath as
 * the evidence for what the picture says. Selecting a mark opens the row.
 *
 * Every figure is a Money the backend built. The grid's marks are OUTCOMES, not
 * amounts; there is no percentage of anything on this screen, because a
 * percentage would be a number this page computed.
 */

import { useEffect, useRef, useState } from "react";
import {
  EMPLOYER_DEMO_CSV,
  getEmployerSchema,
  money,
  postEmployerCheck,
  type EmployerCheckOut,
  type EmployerFinding,
  type EmployerSchemaOut,
  type Refusal,
  type SpecField,
} from "@/lib/api";
import { AppShell } from "../ui/AppShell";
import { EngineMark } from "../ui/EngineMark";
import { T } from "../ui/Prefs";
import { PayrollConstellation } from "./PayrollConstellation";

/** Plain words for the screen. The KEYS are the engine's own reason codes, and
 * the code itself is shown beside the sentence - so nothing here replaces what
 * the engine said, it only reads it aloud. */
const REASON_WORDS: Record<string, string> = {
  AMOUNT_MISMATCH: "Declared amount differs from the published rates",
  AGE_BAND_MISSED: "Age group changed and the old rate was used",
  OW_ABOVE_CEILING: "Ordinary Wages above the ceiling",
  NOT_A_CPF_MEMBER: "CPF declared for someone who is not a CPF member",
  ENGINE_REFUSED: "FairSlip will not compute this case",
  ADDITIONAL_WAGES_PRESENT: "Additional Wages present - outside what FairSlip checks",
  UNREADABLE_ROW: "The row could not be read",
};

export default function EmployerPage() {
  const [schema, setSchema] = useState<EmployerSchemaOut | null>(null);
  const [result, setResult] = useState<EmployerCheckOut | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassed, setShowPassed] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  // Identity of the current run. It keys the grid, so a new file remounts it and
  // the roving tab stop starts again on that file's first exception.
  const [runId, setRunId] = useState(0);
  const [filterReason, setFilterReason] = useState<string | null>(null);
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
    setError(null);
    setFileName(file.name);
    setSelectedRow(null);
    setFilterReason(null);
    try {
      const r = await postEmployerCheck(file);
      if (r.ok) {
        setResult(r.value);
        setRunId((n) => n + 1);
        setAnnounce(`Checked ${r.value.rows_read} rows. ${r.value.exceptions} exceptions.`);
      } else {
        setResult(null);
        setRefusal(r.refusal);
      }
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(EMPLOYER_DEMO_CSV);
      const text = await res.text();
      await run(new File([text], "fairslip-demo-roster.csv", { type: "text/csv" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const findings = result?.findings ?? [];
  const exceptions = findings.filter((f) => f.outcome === "EXCEPTION");
  const refused = findings.filter((f) => f.outcome === "REFUSED");
  const passed = findings.filter((f) => f.outcome === "OK");
  const selected = findings.find((f) => f.row_number === selectedRow) ?? null;

  return (
    <AppShell>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>

      <header>
        <h1 className="text-page font-semibold tracking-tight">Check the payroll before payday</h1>
        <p className="max-w-measure mt-2 text-lead text-ink-2">
          The same engine a worker&rsquo;s payslip goes through, run over a whole payroll before
          the money moves. FairSlip flags and explains; it does not edit anything. The fix
          happens in your own payroll system, which is what keeps this checkable.
        </p>
        <EngineMark className="mt-4" />
      </header>

      {error && (
        <p className="mt-6 rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-body text-danger-fg">
          {error}
        </p>
      )}
      {refusal && (
        <div className="mt-6 rounded-sm border border-attention-line bg-attention-bg px-4 py-3">
          <p className="text-body font-semibold text-attention-fg">The file was not checked.</p>
          <p className="mt-1 font-mono text-meta text-attention-fg">{refusal.detail}</p>
        </div>
      )}

      <UploadPanel onPick={run} onDemo={runDemo} busy={busy} fileName={fileName} />

      {result && (
        <>
          <Summary result={result} headingRef={resultRef} />

          <section aria-labelledby="constellation-heading" className="mt-10">
            <h2 id="constellation-heading" className="text-title font-semibold">
              <T k="employer.constellation" />
            </h2>

            <ReasonFilter
              result={result}
              active={filterReason}
              onPick={(r) => setFilterReason((prev) => (prev === r ? null : r))}
            />

            <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <PayrollConstellation
                key={runId}
                findings={findings}
                selected={selectedRow}
                onSelect={setSelectedRow}
                filterReason={filterReason}
              />
              <div className="lg:sticky lg:top-6">
                <RowInspector finding={selected} />
              </div>
            </div>
          </section>

          <Findings
            title={`Exceptions (${exceptions.length})`}
            blurb="The declared amount differs from what the published rates give for the wage and age in the file."
            rows={exceptions}
            onSelect={setSelectedRow}
            selected={selectedRow}
          />
          <Findings
            title={`Not checked (${refused.length})`}
            blurb="FairSlip did not compute these. They are listed because a row missing from an exceptions table reads exactly like a row that passed."
            rows={refused}
            onSelect={setSelectedRow}
            selected={selectedRow}
          />
          <section className="mt-10">
            <button
              type="button"
              onClick={() => setShowPassed((v) => !v)}
              aria-expanded={showPassed}
              className="tap rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink"
            >
              {showPassed ? "Hide" : "Show"} the {passed.length} rows that matched
            </button>
            {showPassed && (
              <Findings
                title=""
                blurb=""
                rows={passed.slice(0, 60)}
                compact
                onSelect={setSelectedRow}
                selected={selectedRow}
              />
            )}
            {showPassed && passed.length > 60 && (
              <p className="mt-2 text-meta text-ink-3">
                Showing the first 60 of {passed.length}. All {passed.length} were checked, and
                every one of them is a mark in the grid above.
              </p>
            )}
          </section>
        </>
      )}

      {schema && <SchemaPanel schema={schema} />}
      {schema && <MistakesPanel schema={schema} />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ upload */

function UploadPanel({
  onPick,
  onDemo,
  busy,
  fileName,
}: {
  onPick: (f: File) => void;
  onDemo: () => void;
  busy: boolean;
  fileName: string | null;
}) {
  return (
    <section className="mt-8 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2 className="text-lead font-semibold">Your CPF file, as a CSV</h2>
      <p className="max-w-measure mt-1 text-body text-ink-2">
        Nothing is stored. The file is read, checked and dropped inside the request.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
        <button
          type="button"
          onClick={onDemo}
          disabled={busy}
          className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid disabled:opacity-50"
        >
          {busy ? "Checking…" : "Run the fictional 300-employee roster"}
        </button>
        <a href={EMPLOYER_DEMO_CSV} className="text-meta text-ink-2 underline underline-offset-2">
          download that roster
        </a>
      </div>
      {fileName && <p className="mt-3 font-mono text-meta text-ink-3">{fileName}</p>}
    </section>
  );
}

/* ----------------------------------------------------------------- summary */

function Summary({
  result,
  headingRef,
}: {
  result: EmployerCheckOut;
  headingRef?: React.Ref<HTMLParagraphElement>;
}) {
  return (
    <section className="mt-10">
      <p
        ref={headingRef}
        tabIndex={-1}
        className="text-meta font-semibold uppercase tracking-wide text-ink-3"
      >
        What the rules give, against what the file declares
      </p>
      <p className="mt-2 text-hero font-semibold tabular-nums text-ink sm:text-display">
        {money(result.total_difference)}
      </p>
      <p className="max-w-measure mt-1 text-body text-ink-2">
        Total difference across the rows that were checked. The rows that were not checked
        contribute nothing to it, because nothing was computed for them.
      </p>

      <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
        <Stat label="Rows read" value={String(result.rows_read)} />
        <Stat label="Checked" value={String(result.checked)} />
        <Stat label="Exceptions" value={String(result.exceptions)} strong />
        <Stat label="Not checked" value={String(result.refused)} />
      </dl>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
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

/* --------------------------------------------------------- the reason filter */

/**
 * The engine's own reason codes, with the backend's own counts.
 *
 * Choosing one de-emphasises every mark that does not carry it. It does not
 * REMOVE them: the grid is a picture of the file, and a filter that deleted rows
 * from it would be answering a different question from the one the summary above
 * answers.
 */
function ReasonFilter({
  result,
  active,
  onPick,
}: {
  result: EmployerCheckOut;
  active: string | null;
  onPick: (reason: string | null) => void;
}) {
  if (result.by_reason.length === 0) return null;
  /* THE COUNT LEADS. These were seven full-width cards carrying a sentence, a
     trailing number and an engine enum in monospace - 250px of controls above
     the 300 marks they filter, each one bigger than the finding it stands for.
     The count is what an employer is scanning; the sentence says which kind; the
     engine's own code is the smallest thing on the chip, because it is there for
     the person who wants to look it up and for nobody else. */
  const chip = (on: boolean) =>
    `tap-sm flex w-full items-baseline gap-3 rounded-sm border px-3 py-2 text-left ${
      on
        ? "border-ink bg-muted text-ink"
        : "border-line bg-surface text-ink-2 hover:border-control"
    }`;
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      <li className="min-w-[10rem] flex-1">
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-pressed={active === null}
          className={chip(active === null)}
        >
          <span className="text-lead font-semibold tabular-nums text-ink">
            {result.rows_read}
          </span>
          <span className="text-meta font-medium">
            <T k="employer.filterAll" />
          </span>
        </button>
      </li>
      {result.by_reason.map(([reason, n]) => (
        <li key={reason} className="min-w-[14rem] flex-1">
          <button
            type="button"
            onClick={() => onPick(reason)}
            aria-pressed={active === reason}
            className={chip(active === reason)}
          >
            <span className="text-lead font-semibold tabular-nums text-ink">{n}</span>
            <span className="min-w-0">
              <span className="block text-meta font-medium">
                {REASON_WORDS[reason] ?? reason}
              </span>
              <span className="block break-all font-mono text-meta text-ink-3">{reason}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ the inspector */

/**
 * One row, in full.
 *
 * The same shape as the worker's Evidence Lens, and for the same reason: what
 * the engine did to this row is a set of fields it already returned - the wage it
 * used, the band it resolved, the formula it ran, the flags it raised - and
 * showing them is a better explanation than any sentence about them.
 */
function RowInspector({ finding }: { finding: EmployerFinding | null }) {
  return (
    <section
      aria-labelledby="row-inspector-heading"
      className="rounded-lg border border-line-strong bg-surface p-5 shadow-card"
    >
      <h3
        id="row-inspector-heading"
        className="text-body font-semibold uppercase tracking-wide text-ink-3"
      >
        <T k="lens.heading" />
      </h3>

      {!finding ? (
        <p className="max-w-measure mt-3 text-body text-ink-2">
          <T k="employer.pickRow" />
        </p>
      ) : (
        <>
          <p className="mt-3 text-meta font-semibold uppercase tracking-wide text-ink-3">
            <T k="employer.rowSelected" vars={{ n: finding.row_number }} />
          </p>
          <h4 className="mt-1 text-lead font-semibold text-ink">{finding.employee_name}</h4>
          <p className="font-mono text-meta text-ink-3">{finding.employee_account_no}</p>

          <dl className="mt-4 space-y-2">
            <Row label="Ordinary Wages">
              {finding.ordinary_wages ? money(finding.ordinary_wages) : "—"}
            </Row>
            <Row label="Declared in the file">
              {finding.declared ? money(finding.declared) : "—"}
            </Row>
            <Row label="The published rates give">
              {finding.expected ? money(finding.expected) : "not computed"}
            </Row>
            <Row label="Difference">
              {finding.difference ? money(finding.difference) : "—"}
            </Row>
            {finding.band && <Row label="CPF age band">{finding.band}</Row>}
          </dl>

          {finding.reason && (
            <p className="mt-4 text-meta">
              <span className="font-mono text-ink-3">{finding.reason}</span>{" "}
              <span className="text-ink-2">{REASON_WORDS[finding.reason] ?? ""}</span>
            </p>
          )}
          <p className="max-w-measure mt-2 text-body text-ink">{finding.detail}</p>
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
        </>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <dt className="text-meta text-ink-3">{label}</dt>
      <dd className="font-mono tabular-nums text-ink">{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- findings */

function Findings({
  title,
  blurb,
  rows,
  compact,
  onSelect,
  selected,
}: {
  title: string;
  blurb: string;
  rows: EmployerFinding[];
  compact?: boolean;
  onSelect: (row: number) => void;
  selected: number | null;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-10">
      {title && <h2 className="text-title font-semibold">{title}</h2>}
      {blurb && <p className="max-w-measure mt-1 text-body text-ink-2">{blurb}</p>}
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line-strong bg-surface">
        {rows.map((f) => (
          <li key={f.row_number}>
            {/* A button, so the list and the grid are two ways into one row
                rather than two representations that cannot reach each other. */}
            <button
              type="button"
              onClick={() => onSelect(f.row_number)}
              aria-pressed={selected === f.row_number}
              className={`block w-full px-4 py-3 text-left ${
                selected === f.row_number ? "bg-muted" : ""
              }`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-medium">
                  {f.employee_name}{" "}
                  <span className="font-mono text-meta text-ink-3">{f.employee_account_no}</span>
                </span>
                <span className="font-mono text-meta text-ink-3">row {f.row_number}</span>
              </span>

              {!compact && (
                <span className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                  <Cell label="Ordinary Wages" value={f.ordinary_wages ? money(f.ordinary_wages) : "—"} />
                  <Cell label="Declared" value={f.declared ? money(f.declared) : "—"} />
                  <Cell label="The rules give" value={f.expected ? money(f.expected) : "not computed"} />
                  <Cell
                    label="Difference"
                    value={f.difference ? money(f.difference) : "—"}
                    strong={f.outcome === "EXCEPTION"}
                  />
                </span>
              )}

              {f.reason && (
                <span className="mt-2 block text-meta">
                  <span className="font-mono text-ink-3">{f.reason}</span>{" "}
                  <span className="text-ink-2">{REASON_WORDS[f.reason] ?? ""}</span>
                </span>
              )}
              {!compact && (
                <span className="max-w-measure mt-1 block text-meta text-ink-2">{f.detail}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex flex-col">
      <span className="order-2 text-meta text-ink-3">{label}</span>
      <span className={`order-1 tabular-nums ${strong ? "font-semibold text-ink" : "text-ink"}`}>
        {value}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ schema */

function SchemaPanel({ schema }: { schema: EmployerSchemaOut }) {
  return (
    <section className="mt-10 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
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
        ({schema.spec_effective}; {schema.spec_length}; {schema.spec_read_on}). Your payroll
        system already generates that file.
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
          The Detail Record has no date of birth, and its S and T prefixes separate citizens from
          permanent residents registered since 1 January 2000 &mdash; they do not say which PR
          year applies. The engine needs both, so FairSlip asks for them and says so here rather
          than presenting them as part of the government&rsquo;s schema.
        </p>
        <FieldTable caption="" fields={schema.extra_fields} />
      </div>

      {/* THE SCHEMA CONFIRMS THE THESIS, and it is worth being readable on screen
          rather than only sayable by a presenter. The government's own record has
          no room for a Work Permit holder, because a Work Permit holder is not a
          CPF member - which is exactly why this product ships two workers. */}
      <div className="mt-6 border-t border-line pt-4">
        <h3 className="text-body font-semibold">
          Who is even in this file: the record admits two prefixes
        </h3>
        <p className="max-w-measure mt-1 text-meta text-ink-2">
          On the <span className="font-mono">employee_account_no</span> column (cols 29&ndash;37),
          the specification says:
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
        <p className="max-w-measure mt-1 text-meta text-ink-2">
          Quoted from the specification&rsquo;s note on the Contribution detail amount column:
        </p>
        <blockquote lang="en" className="mt-2 border-l-4 border-brand-line px-4 py-2">
          <p className="max-w-measure text-body text-brand-fg">(a) {schema.rounding_a};</p>
          <p className="max-w-measure mt-1 text-body text-brand-fg">(b) {schema.rounding_b}.</p>
        </blockquote>
        <p className="max-w-measure mt-2 text-meta text-ink-2">
          FairSlip&rsquo;s CPF engine was written from CPF Board&rsquo;s contribution-rates page
          and rounds exactly that way: the total to the nearest dollar, the employee&rsquo;s share
          down, the employer&rsquo;s share as the remainder. The specification&rsquo;s own two
          worked examples are run as tests.
        </p>
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

/* ---------------------------------------------------------------- mistakes */

function MistakesPanel({ schema }: { schema: EmployerSchemaOut }) {
  return (
    <section className="mt-10 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2 className="text-title font-semibold">What it looks for, and who says so</h2>
      <p className="max-w-measure mt-1 text-body text-ink-2">
        These are CPF Board&rsquo;s own words, from{" "}
        <a
          href={schema.mistakes_url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Common Mistakes Which Require Subsequent Adjustments To Employers&rsquo; CPF Payments
        </a>{" "}
        (information correct as at April 2024). FairSlip did not decide what an employer commonly
        gets wrong.
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
        FairSlip checks the ones its engines can establish from the file. It does not check wage
        classification itself &mdash; a row carrying Additional Wages is refused rather than
        compared, because the engine computes Ordinary Wages only.
      </p>
    </section>
  );
}
