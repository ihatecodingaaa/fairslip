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
 *      no date of birth and does not distinguish PR years. Those are rendered
 *      in a separate group that says so. A schema that is mostly official is
 *      the easiest possible version of this product's own failure mode.
 *
 *   3. REFUSED ROWS ARE ON THE SCREEN, NOT MISSING FROM IT. "11 exceptions" is
 *      a claim about the rows that were checked. The seven that were not are
 *      counted in the same strip, with the engine's own reason - because a row
 *      quietly absent from an exceptions table reads exactly like a clean one.
 *
 * Every figure is a Money the backend built. The chart's bars are COUNTS of
 * findings, drawn to one scale; there is no percentage of anything on this
 * screen, because a percentage would be a number this page computed.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Controls } from "../ui/Controls";
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
    try {
      const r = await postEmployerCheck(file);
      if (r.ok) {
        setResult(r.value);
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

  const exceptions = (result?.findings ?? []).filter((f) => f.outcome === "EXCEPTION");
  const refused = (result?.findings ?? []).filter((f) => f.outcome === "REFUSED");
  const passed = (result?.findings ?? []).filter((f) => f.outcome === "OK");

  return (
    <div className="flex-1 bg-canvas text-ink">
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div role="status" aria-live="polite" className="sr-only">
          {announce}
        </div>
        <Controls />

        <header className="mb-8">
          <Link href="/" className="text-meta text-ink-2 underline underline-offset-2">
            &larr; FairSlip
          </Link>
          <h1 className="mt-4 text-page font-semibold tracking-tight">
            Check the payroll before payday
          </h1>
          <p className="max-w-measure mt-2 text-ink-2">
            The same engine a worker&rsquo;s payslip goes through, run over a whole payroll
            before the money moves. FairSlip flags and explains; it does not edit anything.
            The fix happens in your own payroll system, which is what keeps this checkable.
          </p>
        </header>

        {error && (
          <p className="mb-6 rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-body text-danger-fg">
            {error}
          </p>
        )}
        {refusal && (
          <div className="mb-6 rounded-sm border border-attention-line bg-attention-bg px-4 py-3">
            <p className="text-body font-semibold text-attention-fg">
              The file was not checked.
            </p>
            <p className="mt-1 font-mono text-meta text-attention-fg">{refusal.detail}</p>
          </div>
        )}

        <UploadPanel onPick={run} onDemo={runDemo} busy={busy} fileName={fileName} />

        {result && (
          <>
            <Summary result={result} headingRef={resultRef} />
            <ByReason result={result} />
            <Findings
              title={`Exceptions (${exceptions.length})`}
              blurb="The declared amount differs from what the published rates give for the wage and age in the file."
              rows={exceptions}
            />
            <Findings
              title={`Not checked (${refused.length})`}
              blurb="FairSlip did not compute these. They are listed because a row missing from an exceptions table reads exactly like a row that passed."
              rows={refused}
            />
            <section className="mb-8">
              <button
                type="button"
                onClick={() => setShowPassed((v) => !v)}
                aria-expanded={showPassed}
                className="tap rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink"
              >
                {showPassed ? "Hide" : "Show"} the {passed.length} rows that matched
              </button>
              {showPassed && (
                <Findings title="" blurb="" rows={passed.slice(0, 60)} compact />
              )}
              {showPassed && passed.length > 60 && (
                <p className="mt-2 text-meta text-ink-3">
                  Showing the first 60 of {passed.length}. All {passed.length} were checked.
                </p>
              )}
            </section>
          </>
        )}

        {schema && <SchemaPanel schema={schema} />}
        {schema && <MistakesPanel schema={schema} />}
      </main>
    </div>
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
    <section className="mb-8 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2 className="text-lead font-semibold">Your CPF file, as a CSV</h2>
      <p className="max-w-measure mt-1 text-body text-ink-2">
        Nothing is stored. The file is read, checked and dropped inside the request.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="tap inline-flex cursor-pointer items-center rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink">
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
    <section className="mb-8 rounded-lg border border-line-strong bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4">
        <p
          ref={headingRef}
          tabIndex={-1}
          className="text-meta font-semibold uppercase tracking-wide text-ink-3"
        >
          What the rules give, against what the file declares
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Stat label="Rows read" value={String(result.rows_read)} />
          <Stat label="Checked" value={String(result.checked)} />
          <Stat label="Exceptions" value={String(result.exceptions)} strong />
          <Stat label="Not checked" value={String(result.refused)} />
        </dl>
        <p className="mt-4 text-meta text-ink-3">
          Total difference across the rows that were checked
        </p>
        <p className="text-title font-semibold tabular-nums">
          {money(result.total_difference)}
        </p>
        <p className="max-w-measure mt-2 text-meta text-ink-3">
          The rows that were not checked contribute nothing to that total, because nothing was
          computed for them.
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
      <dd
        className={`order-1 tabular-nums ${strong ? "text-title font-semibold text-ink" : "text-lead font-medium text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------- exceptions by reason */

/**
 * Counts, drawn. No percentages: a share of anything would be a number this
 * page worked out, and every figure on this screen comes from the backend.
 *
 * SVG rather than a div with a background, for the reason recorded in
 * check/Waterfall.tsx: the print block sets `background-color: #ffffff` on `*`,
 * so a bar drawn as a background is invisible on paper.
 */
function ByReason({ result }: { result: EmployerCheckOut }) {
  if (result.by_reason.length === 0) return null;
  const max = Math.max(...result.by_reason.map(([, n]) => n));
  return (
    <section className="mb-8 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2 className="text-body font-semibold uppercase tracking-wide text-ink-3">
        Findings by reason
      </h2>
      <ol className="mt-3 space-y-2">
        {result.by_reason.map(([reason, n]) => (
          <li key={reason}>
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-meta text-ink-2">
                {REASON_WORDS[reason] ?? reason}{" "}
                <span className="font-mono text-ink-3">{reason}</span>
              </span>
              <span className="text-body font-semibold tabular-nums">{n}</span>
            </span>
            <svg
              viewBox="0 0 1000 10"
              preserveAspectRatio="none"
              role="presentation"
              aria-hidden
              className="mt-1 block h-3 w-full"
            >
              <rect x="0" y="0" width="1000" height="10" className="fill-sunken" />
              <rect
                x="0"
                y="0"
                width={Math.max((n / max) * 1000, 2)}
                height="10"
                className="fill-brand"
              />
            </svg>
          </li>
        ))}
      </ol>
      <p className="max-w-measure mt-3 text-meta text-ink-3">
        Counts of findings, drawn to one scale. Every bar is a number of rows.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- findings */

function Findings({
  title,
  blurb,
  rows,
  compact,
}: {
  title: string;
  blurb: string;
  rows: EmployerFinding[];
  compact?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-8">
      {title && <h2 className="text-lead font-semibold">{title}</h2>}
      {blurb && <p className="max-w-measure mt-1 text-body text-ink-2">{blurb}</p>}
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line-strong bg-surface">
        {rows.map((f) => (
          <li key={f.row_number} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-medium">
                {f.employee_name}{" "}
                <span className="font-mono text-meta text-ink-3">{f.employee_account_no}</span>
              </span>
              <span className="font-mono text-meta text-ink-3">row {f.row_number}</span>
            </div>

            {!compact && (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <Cell label="Ordinary Wages" value={f.ordinary_wages ? money(f.ordinary_wages) : "—"} />
                <Cell label="Declared" value={f.declared ? money(f.declared) : "—"} />
                <Cell
                  label="The rules give"
                  value={f.expected ? money(f.expected) : "not computed"}
                />
                <Cell
                  label="Difference"
                  value={f.difference ? money(f.difference) : "—"}
                  strong={f.outcome === "EXCEPTION"}
                />
              </dl>
            )}

            {f.reason && (
              <p className="mt-2 text-meta">
                <span className="font-mono text-ink-3">{f.reason}</span>{" "}
                <span className="text-ink-2">{REASON_WORDS[f.reason] ?? ""}</span>
              </p>
            )}
            {!compact && (
              <p className="max-w-measure mt-1 text-meta text-ink-2">{f.detail}</p>
            )}
            {!compact && f.engine_formula && (
              <p className="mt-1 font-mono text-meta text-ink-3">{f.engine_formula}</p>
            )}
            {!compact &&
              f.engine_flags.map((flag) => (
                <p key={flag} className="mt-1 font-mono text-meta text-attention-fg">
                  {flag}
                </p>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
      <dd className={`order-1 tabular-nums ${strong ? "font-semibold text-ink" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ schema */

function SchemaPanel({ schema }: { schema: EmployerSchemaOut }) {
  return (
    <section className="mb-8 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2 className="text-lead font-semibold">The columns, and whose they are</h2>
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
          The Detail Record has no date of birth, and its S and T prefixes separate citizens
          from permanent residents registered since 1 January 2000 &mdash; they do not say
          which PR year applies. The engine needs both, so FairSlip asks for them and says so
          here rather than presenting them as part of the government&rsquo;s schema.
        </p>
        <FieldTable caption="" fields={schema.extra_fields} />
      </div>

      {/* THE SCHEMA CONFIRMS THE THESIS, and it is worth being readable on
          screen rather than only sayable by a presenter. The government's own
          record has no room for a Work Permit holder, because a Work Permit
          holder is not a CPF member - which is exactly why this product ships
          two workers and not one. */}
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
        <p className="max-w-measure mt-2 text-meta text-ink-2">
          And its Notes, item 4:
        </p>
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
          <p className="max-w-measure text-body text-brand-fg">
            (a) {schema.rounding_a};
          </p>
          <p className="max-w-measure mt-1 text-body text-brand-fg">(b) {schema.rounding_b}.</p>
        </blockquote>
        <p className="max-w-measure mt-2 text-meta text-ink-2">
          FairSlip&rsquo;s CPF engine was written from CPF Board&rsquo;s contribution-rates
          page and rounds exactly that way: the total to the nearest dollar, the
          employee&rsquo;s share down, the employer&rsquo;s share as the remainder. The
          specification&rsquo;s own two worked examples are run as tests.
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
    <section className="mb-8 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2 className="text-lead font-semibold">What it looks for, and who says so</h2>
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
    </section>
  );
}
