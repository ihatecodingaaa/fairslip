"use client";

/**
 * The report itself: what the reader sees, and what the printer prints.
 *
 * ONE DOM, TWO MEDIA. There is no second render for paper. The print rules in
 * globals.css narrow this same markup - black on white, A4 margins, no
 * background fills - which is the same decision the worker's take-away sheet
 * already runs on, and for the same reason: a second copy of a figure is a
 * figure that can drift from the first.
 *
 * SO "SAVE AS PDF" IS THE PDF EXPORT. A client-side PDF renderer would mean
 * embedding four scripts' worth of fonts, duplicating the money layout, and
 * maintaining a second set of print tests to catch it drifting - for a file the
 * browser already produces from this DOM, with selectable text and working
 * links. The complexity buys nothing the reader can see.
 *
 * COVERAGE IS THE FIRST BLOCK AND CANNOT BE TURNED OFF. Everything below it is
 * a claim about the rows that were checked; without it, "11 exceptions" reads as
 * a claim about 300 employees. `buildReport` enforces that the module is
 * present - this component renders it unconditionally, which is the second lock.
 *
 * WHAT IT NEVER SAYS. No score, no percentage, no grade, no "approved", no
 * "certified", and no claim that anyone has been paid anything. The strongest
 * sentence available is the one under Coverage, and it is deliberately about
 * ROWS AND A RULE ENGINE rather than about people being paid correctly.
 */

import { money, type Money } from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { usePrefs, useT } from "../../ui/Prefs";
import { stamp } from "../../ui/PrintSheet";
import { REASON_WORDS } from "../reasons";
import type { ReportModel, ReportRow } from "./model";

export function ReportPreview({ model }: { model: ReportModel }) {
  const t = useT();
  const { lang } = usePrefs();
  const label = (code: string) => t(REASON_WORDS[code] ?? ("employer.reasonUnknown" as Key));
  const has = (id: string) => model.modules.includes(id as never);

  return (
    <article className="min-w-0 bg-surface px-5 py-6 text-ink sm:px-8 sm:py-8 print:px-0 print:py-0">
      <header className="border-b-2 border-line-strong pb-4">
        <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">FairSlip</p>
        <h1 className="mt-1 text-page font-semibold tracking-tight">{model.title}</h1>
        <p className="mt-1 text-meta text-ink-3">
          Generated {stamp(model.generated_at, lang)}
          {model.source.before_filename && (
            <>
              {" · "}
              <span className="font-mono">{model.source.before_filename}</span>
            </>
          )}
          {model.source.after_filename && (
            <>
              {" → "}
              <span className="font-mono">{model.source.after_filename}</span>
            </>
          )}
        </p>
      </header>

      {/* --------------------------------------------------------- coverage */}
      <Section title="Coverage">
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <Figure label="Rows read" value={model.coverage.rows_read} />
          <Figure label="Checked" value={model.coverage.checked} />
          <Figure label="Exceptions" value={model.coverage.exceptions} strong />
          <Figure label="Not checked" value={model.coverage.refused} />
        </dl>
        {/* THE CAREFUL SENTENCE. "matched the FairSlip rule engine" is what was
            established; "were paid correctly" is not, and would be a claim about
            employees rather than about rows against a scope. */}
        <p className="max-w-measure mt-3 text-body text-ink-2">
          {model.coverage.checked - model.coverage.exceptions} checked rows matched the FairSlip
          rule engine. The {model.coverage.refused} rows that were not checked were not computed
          at all, and are in no total below.
        </p>
      </Section>

      {/* ------------------------------------------------------------ money */}
      {has("money") && (
        <Section title="Declared against the published rules">
          <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
            <Amount label="Declared in the file" value={model.totals.declared_total} />
            <Amount label="The published rules give" value={model.totals.expected_total} />
            <Amount label="Difference" value={model.totals.signed_difference} strong />
          </dl>
          <p className="mt-2 text-meta text-ink-3">
            Across {model.totals.rows} checked rows. The {model.coverage.refused} rows that were
            not checked are in neither total.
          </p>
        </Section>
      )}

      {/* ---------------------------------------------------------- reasons */}
      {has("reasons") && model.reasons.length > 0 && (
        <Section title="Difference by reason">
          <TableBox label="Difference by reason">
          <table className="w-full min-w-[26rem] text-left">
            <thead>
              <tr className="border-b border-line-strong">
                <Th>Reason</Th>
                <Th>Rows</Th>
                <Th>Checked</Th>
                <Th align="right">Difference</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {model.reasons.map((r) => (
                <tr key={r.reason_code}>
                  <td className="py-2 pr-4 align-top text-body">
                    {label(r.reason_code)}
                    <span className="block font-mono text-meta text-ink-3">{r.reason_code}</span>
                  </td>
                  <td className="py-2 pr-4 align-top tabular-nums">{r.count}</td>
                  <td className="py-2 pr-4 align-top tabular-nums">{r.checked_rows}</td>
                  <td className="py-2 text-right align-top font-mono tabular-nums">
                    {/* A reason that refused every row has no amount. $0.00
                        would read as rows that were checked and agreed. */}
                    {r.checked_rows > 0 ? (
                      money(r.signed_difference_total)
                    ) : (
                      <span className="text-meta text-ink-3">not checked, no amount</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableBox>
        </Section>
      )}

      {/* ------------------------------------------------------- comparison */}
      {has("comparison") && model.comparison && (
        <Section title="Before and after">
          <TableBox label="Before and after">
          <table className="w-full min-w-[22rem] max-w-lg text-left">
            <thead>
              <tr className="border-b border-line-strong">
                <Th>&nbsp;</Th>
                <Th align="right">First file</Th>
                <Th align="right">Corrected file</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono tabular-nums">
              <tr>
                <Td>Difference</Td>
                <Td align="right">{money(model.comparison.before.difference)}</Td>
                <Td align="right" strong>
                  {money(model.comparison.after.difference)}
                </Td>
              </tr>
              <tr>
                <Td>Exceptions</Td>
                <Td align="right">{model.comparison.before.exceptions}</Td>
                <Td align="right">{model.comparison.after.exceptions}</Td>
              </tr>
              <tr>
                <Td>Not checked</Td>
                <Td align="right">{model.comparison.before.refused}</Td>
                <Td align="right">{model.comparison.after.refused}</Td>
              </tr>
              <tr>
                <Td>Rows read</Td>
                <Td align="right">{model.comparison.before.rows_read}</Td>
                <Td align="right">{model.comparison.after.rows_read}</Td>
              </tr>
            </tbody>
          </table>
          </TableBox>

          <p className="max-w-measure mt-3 text-body text-ink-2">
            Across the {model.comparison.rows_checked_in_both} rows checked in both runs, the
            total difference moved from {money(model.comparison.both_before)} to{" "}
            {money(model.comparison.both_after)}.
          </p>

          <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {Object.entries(model.comparison.counts).map(([state, n]) => (
              <li key={state} className="flex items-baseline gap-3 text-body">
                <span className="w-8 text-right font-semibold tabular-nums">{n}</span>
                <span className="text-ink-2">{STATE_SENTENCE[state] ?? state}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ------------------------------------------------------------- rows */}
      {has("topExceptions") && model.topExceptions.length > 0 && (
        <RowTable title="Largest differences" rows={model.topExceptions} label={label} model={model} />
      )}
      {has("exceptions") && model.exceptions.length > 0 && (
        <RowTable
          title={`Every exception (${model.exceptions.length})`}
          rows={model.exceptions}
          label={label}
          model={model}
        />
      )}
      {has("notChecked") && model.notChecked.length > 0 && (
        <RowTable
          title={`Not checked (${model.notChecked.length})`}
          rows={model.notChecked}
          label={label}
          model={model}
          note="FairSlip computed nothing for these rows. They are listed because a row missing from an exceptions table reads exactly like a row that passed."
        />
      )}
      {has("allRows") && (
        <RowTable
          title={`Every checked row (${model.rows.filter((r) => r.outcome !== "REFUSED").length})`}
          rows={model.rows.filter((r) => r.outcome !== "REFUSED")}
          label={label}
          model={model}
        />
      )}

      {/* ------------------------------------------------------ methodology */}
      {has("methodology") && model.methodology.length > 0 && (
        <Section title="What was checked, and whose rules">
          {model.methodology.map((s) => (
            <div key={s.heading} className="mt-3 first:mt-0">
              <h3 className="text-body font-semibold">{s.heading}</h3>
              {s.lines.map((line) => (
                <p key={line} className="max-w-measure mt-1 break-words text-meta text-ink-2">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* --------------------------------------------------------- run meta */}
      {has("runMeta") && (
        <Section title="Run details">
          <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <Meta label="Schema version" value={model.schema_version} />
            <Meta label="Generated" value={model.generated_at} />
            <Meta label="Source file" value={model.source.before_filename ?? "—"} />
            {model.source.after_filename && (
              <Meta label="Corrected file" value={model.source.after_filename} />
            )}
            <Meta label="Audience preset" value={model.audience} />
            <Meta label="Identity shown" value={PRIVACY_SENTENCE[model.privacy]} />
          </dl>
        </Section>
      )}

      <footer className="mt-8 border-t border-line-strong pt-4">
        <p className="max-w-measure text-meta text-ink-2">
          FairSlip reconstructs what CPF Board&rsquo;s published rates give for the wages and ages
          in this file, and reports where the declared amount differs. It does not edit payroll,
          file anything, or assert liability. It is not an audit opinion and not a certification.
        </p>
      </footer>
    </article>
  );
}

/** The recheck states, as sentences a reader outside the product can follow. */
const STATE_SENTENCE: Record<string, string> = {
  STILL_MATCHED: "matched the rule engine in both runs",
  RESOLVED: "differed in the first file and match now",
  STILL_EXCEPTION: "still differ from the rule engine",
  NEW_EXCEPTION: "match in the first file and differ now",
  NEWLY_REFUSED: "could be checked before and cannot now",
  STILL_REFUSED: "were not checked in either run",
  NEWLY_CHECKED_MATCHED: "were checked this time, and match",
  NEWLY_CHECKED_EXCEPTION: "were checked this time, and differ",
  REMOVED: "are in the first file only",
  ADDED: "are in the corrected file only",
};

const PRIVACY_SENTENCE: Record<string, string> = {
  anonymised: "row numbers only — no name, no account number",
  account: "row number and a masked CPF account number",
  full: "name and CPF account number, as the uploaded file carried them",
};

/**
 * A table that scrolls inside its own box rather than widening the page.
 *
 * FOCUSABLE, BECAUSE IT SCROLLS. A scroll container that cannot take focus is a
 * region a keyboard user cannot reach the right-hand side of - WCAG 2.1.1, and
 * the same reason the schema table on the employer page is focusable. axe flags
 * it at 390px and not at 1400, which is exactly the kind of thing a
 * desktop-only pass never sees.
 *
 * EVERY TABLE IN THE PACK USES IT. Two of the three did not, and at 390px in
 * Tamil at the largest text size they pushed the whole page 378px sideways -
 * a table cannot shrink below its content, so the only thing that saves the
 * layout is a box around it that can.
 */
function TableBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="group" aria-label={label}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-title font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Figure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dd
        className={`order-1 tabular-nums ${
          strong ? "text-title font-semibold" : "text-title font-medium text-ink-2"
        }`}
      >
        {value}
      </dd>
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
    </div>
  );
}

function Amount({ label, value, strong }: { label: string; value: Money; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dd
        className={`order-1 font-mono tabular-nums ${
          strong ? "text-title font-semibold" : "text-lead text-ink-2"
        }`}
      >
        {money(value)}
      </dd>
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <dt className="text-meta text-ink-3">{label}</dt>
      <dd className="break-all font-mono text-meta text-ink-2">{value}</dd>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={`py-2 pr-4 text-meta font-semibold uppercase tracking-wide text-ink-3 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  strong,
}: {
  children: React.ReactNode;
  align?: "right";
  strong?: boolean;
}) {
  return (
    <td
      className={`py-2 pr-4 ${align === "right" ? "text-right" : ""} ${
        strong ? "font-semibold" : ""
      }`}
    >
      {children}
    </td>
  );
}

function RowTable({
  title,
  rows,
  label,
  model,
  note,
}: {
  title: string;
  rows: ReportRow[];
  label: (code: string) => string;
  model: ReportModel;
  note?: string;
}) {
  const showsIdentity = model.privacy !== "anonymised";
  return (
    <Section title={title}>
      {note && <p className="max-w-measure mb-3 text-meta text-ink-2">{note}</p>}
      <TableBox label={title}>
        <table className="w-full min-w-[40rem] text-left">
          <thead>
            <tr className="border-b border-line-strong">
              <Th>Row</Th>
              {showsIdentity && <Th>Employee</Th>}
              <Th align="right">Declared</Th>
              <Th align="right">Rules give</Th>
              <Th align="right">Difference</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={`${r.row_number}-${r.employee_account_no}`}>
                <td className="py-2 pr-4 align-top font-mono text-meta tabular-nums text-ink-3">
                  {r.row_number}
                </td>
                {showsIdentity && (
                  <td className="py-2 pr-4 align-top text-body">
                    {r.employee_name}
                    {r.employee_account_no && (
                      <span className="block font-mono text-meta text-ink-3">
                        {r.employee_account_no}
                      </span>
                    )}
                  </td>
                )}
                <td className="py-2 pr-4 text-right align-top font-mono tabular-nums">
                  {r.declared ? money(r.declared) : "—"}
                </td>
                <td className="py-2 pr-4 text-right align-top font-mono tabular-nums">
                  {r.expected ? money(r.expected) : <span className="text-meta">not computed</span>}
                </td>
                <td className="py-2 pr-4 text-right align-top font-mono font-semibold tabular-nums">
                  {r.difference ? money(r.difference) : "—"}
                </td>
                <td className="py-2 align-top text-meta text-ink-2">
                  {r.reason_code ? label(r.reason_code) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableBox>
    </Section>
  );
}
