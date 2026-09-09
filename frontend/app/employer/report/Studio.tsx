"use client";

/**
 * Build a review pack: choose who it is for, watch it change, take it away.
 *
 * NOT FIVE DOWNLOAD BUTTONS. The question an employer actually has is "who is
 * reading this" - a board paper, a worklist for the payroll team, and a file for
 * a reviewer are three different documents from one run. So the control that
 * leads is the AUDIENCE, the modules follow from it, and everything is visible
 * in the preview before anything is downloaded.
 *
 * THE PREVIEW IS THE ARTEFACT. It is the same DOM the printer prints, so "Save
 * as PDF" needs no second renderer and cannot drift from what is on screen. The
 * controls column is print-hidden; nothing else about the page changes.
 *
 * COVERAGE CANNOT BE UNTICKED, and its checkbox says so rather than being
 * mysteriously absent. A user who could remove it could produce a clean-looking
 * executive summary of a payroll where seven rows were never examined, which is
 * this product's own failure mode with a download button on it. `buildReport`
 * re-adds it regardless, so the lock is in the model rather than in the widget.
 *
 * NOTHING IS UPLOADED. Every export is assembled in the browser from a response
 * the browser already has. No report state and no worker identity is stored
 * server-side to make this work.
 */

import { useMemo, useState } from "react";
import type {
  EmployerCheckOut,
  EmployerRecheckOut,
  EmployerSchemaOut,
} from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { T, useT } from "../../ui/Prefs";
import { REASON_WORDS } from "../reasons";
import { downloadBlob, downloadText } from "../../ui/download";
import {
  csvRowCount,
  toCsv,
  toJson,
  toMarkdown,
  toWorkbook,
  type CsvScope,
} from "./exports";
import {
  buildReport,
  MODULES,
  PRESETS,
  type Audience,
  type ModuleId,
  type Privacy,
} from "./model";
import { ReportPreview } from "./Preview";

const AUDIENCES: { id: Audience; label: Key; hint: Key }[] = [
  { id: "executive", label: "report.execName", hint: "report.execHint" },
  { id: "payroll", label: "report.opsName", hint: "report.opsHint" },
  { id: "audit", label: "report.auditName", hint: "report.auditHint" },
  { id: "custom", label: "report.customName", hint: "report.customHint" },
];

const PRIVACIES: { id: Privacy; label: Key; hint: Key }[] = [
  { id: "anonymised", label: "report.privAnon", hint: "report.privAnonHint" },
  { id: "account", label: "report.privAccount", hint: "report.privAccountHint" },
  { id: "full", label: "report.privFull", hint: "report.privFullHint" },
];

export function ReportStudio({
  result,
  comparison,
  schema,
  beforeFilename,
  afterFilename,
  onLeave,
}: {
  result: EmployerCheckOut;
  comparison: EmployerRecheckOut | null;
  schema: EmployerSchemaOut | null;
  beforeFilename: string | null;
  afterFilename: string | null;
  onLeave: () => void;
}) {
  const t = useT();
  const [audience, setAudience] = useState<Audience>("executive");
  const [privacy, setPrivacy] = useState<Privacy>(PRESETS.executive.privacy);
  const [modules, setModules] = useState<ModuleId[]>(PRESETS.executive.modules);
  const [csvScope, setCsvScope] = useState<CsvScope>("exceptions");
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /* WHEN THIS WAS WORKED OUT, TAKEN ONCE.
     Stamped when the studio opens rather than inside the model, which is
     rebuilt on every keystroke - a timestamp taken there would turn "when these
     figures were produced" into "when you last touched a checkbox". */
  const [generatedAt] = useState(() => new Date().toISOString());

  function pickAudience(id: Audience) {
    setAudience(id);
    if (id !== "custom") {
      setModules(PRESETS[id].modules);
      setPrivacy(PRESETS[id].privacy);
    }
  }

  function toggleModule(id: ModuleId) {
    // Choosing modules by hand is a custom pack, and the control says so rather
    // than leaving a preset name above a set of modules it does not describe.
    setAudience("custom");
    setModules((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  const model = useMemo(
    () =>
      buildReport({
        result,
        comparison,
        schema,
        audience,
        privacy,
        modules,
        beforeFilename,
        afterFilename,
        generatedAt,
      }),
    [result, comparison, schema, audience, privacy, modules, beforeFilename, afterFilename, generatedAt],
  );

  const label = (code: string) => t(REASON_WORDS[code] ?? ("employer.reasonUnknown" as Key));
  const stem = `fairslip-payroll-review-${generatedAt.slice(0, 10)}`;

  async function exportWorkbook() {
    setBusy("xlsx");
    setFailed(null);
    try {
      const blob = await toWorkbook(model, label);
      downloadBlob(blob, `${stem}.xlsx`);
    } catch (e) {
      // SAID, NOT SWALLOWED. A download that silently does nothing is
      // indistinguishable from a download the browser blocked.
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="studio-heading" className="mt-8">
      <div className="print-hide flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="studio-heading" className="text-title font-semibold">
          <T k="report.heading" />
        </h2>
        <button
          type="button"
          onClick={onLeave}
          className="tap-sm rounded-sm border border-control bg-surface px-4 py-2 text-meta font-medium text-ink hover:border-ink"
        >
          <T k="report.leave" />
        </button>
      </div>

      {/* `min-w-0` ON BOTH COLUMNS, AND THE SECOND ONE IS NOT OPTIONAL.
          A grid item's `min-width` is `auto`, which means it will not shrink
          below its content's min-content width - and the preview holds tables
          with a `min-w-[40rem]` inside their own scroll boxes. At the desktop
          breakpoint `minmax(0,1fr)` says this for the second column; at 390px
          there is no explicit template at all, so the implicit column took the
          widest child and pushed the whole page 715px sideways in Tamil at the
          largest text size. Found by measuring, not by reading. */}
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* ------------------------------------------------------ controls */}
        <div className="print-hide grid min-w-0 gap-6 lg:sticky lg:top-6">
          <Fieldset legendKey="report.audience">
            {AUDIENCES.map((a) => (
              <Radio
                key={a.id}
                name="audience"
                checked={audience === a.id}
                onChange={() => pickAudience(a.id)}
                label={t(a.label)}
                hint={t(a.hint)}
              />
            ))}
          </Fieldset>

          <Fieldset legendKey="report.modules">
            {MODULES.map((m) => {
              const on = model.modules.includes(m.id);
              const unavailable = m.id === "comparison" && !comparison;
              return (
                <label
                  key={m.id}
                  className={`tap-sm flex items-start gap-3 rounded-sm px-1 py-1 ${
                    m.required || unavailable ? "" : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on && !unavailable}
                    disabled={m.required || unavailable}
                    onChange={() => toggleModule(m.id)}
                    className="mt-1 size-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-meta text-ink">{m.label}</span>
                    {m.required && (
                      <span className="block text-meta text-ink-3">
                        <T k="report.alwaysIncluded" />
                      </span>
                    )}
                    {unavailable && (
                      <span className="block text-meta text-ink-3">
                        <T k="report.needsRecheck" />
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </Fieldset>

          <Fieldset legendKey="report.privacy">
            {PRIVACIES.map((p) => (
              <Radio
                key={p.id}
                name="privacy"
                checked={privacy === p.id}
                onChange={() => {
                  setPrivacy(p.id);
                  setAudience("custom");
                }}
                label={t(p.label)}
                hint={t(p.hint)}
              />
            ))}
          </Fieldset>

          <div>
            <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
              <T k="report.take" />
            </h3>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="tap rounded-sm bg-brand px-4 py-3 text-body font-semibold text-on-solid"
              >
                <T k="report.print" />
              </button>
              <button
                type="button"
                onClick={exportWorkbook}
                disabled={busy !== null}
                className="tap rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink disabled:opacity-50"
              >
                {busy === "xlsx" ? <T k="report.preparing" /> : <T k="report.excel" />}
              </button>
              <button
                type="button"
                onClick={() => downloadText(toJson(model), `${stem}.json`, "application/json")}
                className="tap rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink"
              >
                <T k="report.json" />
              </button>

              <div className="rounded-sm border border-line p-3">
                <p className="text-meta font-semibold text-ink">
                  <T k="report.csv" />
                </p>
                <div className="mt-2 grid gap-1">
                  {(
                    [
                      ["exceptions", "report.csvExceptions"],
                      ["notChecked", "report.csvNotChecked"],
                      ["all", "report.csvAll"],
                    ] as const
                  ).map(([scope, key]) => (
                    <Radio
                      key={scope}
                      name="csvScope"
                      checked={csvScope === scope}
                      onChange={() => setCsvScope(scope)}
                      label={t(key)}
                      hint={t("report.csvRows", { n: csvRowCount(model, scope) })}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    downloadText(toCsv(model, csvScope, label), `${stem}-${csvScope}.csv`, "text/csv")
                  }
                  className="tap-sm mt-2 w-full rounded-sm border border-control bg-surface px-4 py-2 text-meta font-medium text-ink hover:border-ink"
                >
                  <T k="report.csvDownload" />
                </button>
              </div>

              {/* ADVANCED, and under a disclosure for that reason. Markdown is
                  for an audit note or a ticket; putting it beside "Save as PDF"
                  would suggest payroll teams routinely read it. */}
              <details className="rounded-sm border border-line px-3 py-2">
                <summary className="tap-sm cursor-pointer list-none text-meta font-semibold text-ink-2">
                  <T k="report.advanced" />
                </summary>
                <button
                  type="button"
                  onClick={() =>
                    downloadText(toMarkdown(model, label), `${stem}.md`, "text/markdown")
                  }
                  className="tap-sm mt-2 w-full rounded-sm border border-control bg-surface px-4 py-2 text-meta font-medium text-ink hover:border-ink"
                >
                  <T k="report.markdown" />
                </button>
              </details>

              {failed && (
                <p className="rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-meta text-danger-fg">
                  <T k="report.exportFailed" /> {failed}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- preview */}
        <div className="min-w-0 rounded-lg border border-line-strong shadow-card print:border-0 print:shadow-none">
          <ReportPreview model={model} />
        </div>
      </div>
    </section>
  );
}

function Fieldset({ legendKey, children }: { legendKey: Key; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k={legendKey} />
      </legend>
      <div className="mt-2 grid gap-1">{children}</div>
    </fieldset>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="tap-sm flex items-start gap-3 rounded-sm px-1 py-1 hover:bg-muted">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 shrink-0"
      />
      <span className="min-w-0">
        <span className={`block text-meta ${checked ? "font-semibold text-ink" : "text-ink"}`}>
          {label}
        </span>
        {hint && <span className="block text-meta text-ink-3">{hint}</span>}
      </span>
    </label>
  );
}
