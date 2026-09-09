"use client";

/**
 * Stage 2 screen: photograph the documents, see what two independent readers
 * made of them, answer what no reader could, then run the engine.
 *
 * The screen is built around one structural fact, not around a hoped-for one.
 * Six fields can be read from a document and six cannot, and the six that
 * cannot are unanswered on every single run - so the engine is blocked every
 * single run until the worker speaks. Reader disagreement is a second beat when
 * a document happens to be ambiguous; this one does not depend on luck.
 *
 * This file computes no money. It assembles Facts, posts them, and renders what
 * the engine sent back.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AgentPanel } from "./AgentPanel";
import { Controls } from "../ui/Controls";
import { T, usePrefs, useT } from "../ui/Prefs";
import { PrintButton, PrintMasthead, ScreenOnly } from "../ui/PrintSheet";
import { ReaderComparison } from "./ReaderComparison";
import { Waterfall } from "./Waterfall";
import { ReadAloud } from "../ui/ReadAloud";
import { StatusChip } from "../ui/StatusChip";
import { ImpactRadius } from "./ImpactRadius";
import {
  API_BASE,
  fileToImageIn,
  isEstablished,
  money,
  postCompute,
  postExtract,
  type DocumentRole,
  type ExtractOut,
  type Fact,
  type ImageIn,
  type PayBreakdown,
  type PayInputs,
  type ReadField,
  type ReaderInfo,
  type Refusal,
  type WorkerField,
} from "@/lib/api";

/** The documents a reader may be given, and what each is for. */
const DOCUMENTS: {
  role: DocumentRole;
  /** Dictionary keys, not literals: these three labels are the first words a
   * worker reads on this screen, so they translate with everything else. */
  label: "doc.payslip" | "doc.roster" | "doc.ket";
  hint: "doc.payslip.hint" | "doc.roster.hint" | "doc.ket.hint";
  required: boolean;
}[] = [
  { role: "payslip", label: "doc.payslip", hint: "doc.payslip.hint", required: true },
  { role: "roster", label: "doc.roster", hint: "doc.roster.hint", required: false },
  { role: "ket", label: "doc.ket", hint: "doc.ket.hint", required: false },
];

type Phase = "collect" | "reading" | "reconciled";

export default function CheckPage() {
  const t = useT();
  const [files, setFiles] = useState<Partial<Record<DocumentRole, File>>>({});
  const [phase, setPhase] = useState<Phase>("collect");
  const [extract, setExtract] = useState<ExtractOut | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [breakdown, setBreakdown] = useState<PayBreakdown | null>(null);
  // The exact facts that produced `breakdown`. Recomputing them from live state
  // let an answer edited AFTER computing become the impact view's "before" -
  // a different month from the one rendered above it, labelled "before".
  const [computedFrom, setComputedFrom] = useState<PayInputs | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // WHEN the engine ran, for the sheet a worker prints and carries somewhere.
  // Recorded on the response, not on the click: a click that was refused
  // produced no figures, and a timestamp above no figures dates nothing.
  // A caseworker holding the paper cannot ask the screen how old it is.
  const [computedAt, setComputedAt] = useState<string | null>(null);
  // Two failures, two states. They were one, so a /compute failure rendered
  // "The readers could not be reached" - while the readings it was contradicting
  // sat on screen directly above. See docs/debt.md, ui-invents-a-cause.
  const [readError, setReadError] = useState<string | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  // WCAG 4.1.3. Both of the long operations on this screen finish somewhere
  // other than where the reader is looking, and a sighted reader gets a page
  // that visibly grew. `announce` is what a screen reader gets instead.
  const [announce, setAnnounce] = useState("");
  const readersRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  const chosen = DOCUMENTS.filter((d) => files[d.role]);

  async function read() {
    setPhase("reading");
    setReadError(null);
    setComputeError(null);
    setRefusal(null);
    try {
      const images: ImageIn[] = await Promise.all(
        chosen.map((d) => fileToImageIn(files[d.role]!, d.role)),
      );
      const out = await postExtract(images);
      if (!out.ok) {
        setRefusal(out.refusal);
        setPhase("collect");
        return;
      }
      setExtract(out.value);
      setAnswers({});
      setBreakdown(null);
      setPhase("reconciled");
      setAnnounce(t("a11y.readersLanded"));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e));
      setPhase("collect");
    }
  }

  /**
   * Which fields still stand between here and a calculation, in the order the
   * screen shows them. Named, never counted only - a button that says "3 fields
   * remaining" has told the worker nothing about which three.
   */
  const unresolved = useMemo(() => {
    if (!extract) return [];
    const out: { name: string; label: string; group: "read" | "worker" }[] = [];
    // Fields the pay engine never receives cannot block a pay calculation.
    // `cpf_employee_on_payslip` is read from the payslip but deleted by
    // payInputsFrom, so a payslip with no CPF line - every Work Permit
    // holder's - left the button disabled saying "the readers did not settle
    // it" and "nothing has been calculated", both false as to that field. Worse,
    // the worker could then answer it, get a green chip, and have the answer
    // thrown away. Both places now read the server's one list.
    const cpfOnly = new Set(extract.cpf_only_fields);
    for (const f of extract.read_fields) {
      if (cpfOnly.has(f.name)) continue;
      if (!isEstablished(f.fact.status) && !answers[f.name]?.trim()) {
        out.push({ name: f.name, label: f.label, group: "read" });
      }
    }
    for (const f of extract.worker_fields) {
      // The engines' pay pack does not take residency or date of birth; those
      // two are held for the CPF pack and do not block this calculation.
      if (f.required_for.includes("cpf") || cpfOnly.has(f.name)) continue;
      // Only a rest day established as worked makes "who asked?" a question.
      // While it is unknown, `rest_day_hours` is itself unresolved and already
      // on this list, so the worker is pointed at the thing that settles it.
      if (f.name === "rest_day_requested_by" && restDayVerdict(extract, answers).state !== "worked") {
        continue;
      }
      if (!answers[f.name]?.trim()) {
        out.push({ name: f.name, label: f.label, group: "worker" });
      }
    }
    return out;
  }, [extract, answers]);

  async function compute() {
    if (!extract) return;
    setComputeError(null);
    setRefusal(null);
    try {
      const sent = payInputsFrom(extract, answers);
      const out = await postCompute(sent);
      if (!out.ok) {
        setRefusal(out.refusal);
        setBreakdown(null);
        setComputedFrom(null);
        setComputedAt(null);
        return;
      }
      setBreakdown(out.value);
      setComputedFrom(sent);
      // Taken here, where the engine's answer arrived - not in the render, which
      // would restamp the sheet every time React re-ran it and quietly turn "when
      // these figures were worked out" into "when you last touched the page".
      setComputedAt(new Date().toISOString());
      setAnnounce(t("a11y.resultReady"));
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (phase === "reconciled" && !breakdown) readersRef.current?.focus();
  }, [phase, breakdown]);

  useEffect(() => {
    if (breakdown) resultRef.current?.focus();
  }, [breakdown]);

  return (
    <div className="flex-1 bg-canvas text-ink">
      <main className="mx-auto max-w-3xl px-5 py-10">
        {/* Present in the DOM BEFORE anything is injected into it. A live
            region created at the same moment as its content is not announced -
            the assistive technology has nothing to observe changing. */}
        <div role="status" aria-live="polite" className="sr-only">
          {announce}
        </div>
        <PrintMasthead computedAt={computedAt} />
        <Controls />
        {/* print-hide: the masthead above IS this heading on paper - same
            dictionary key, one line up - and a document that opens with its
            title twice reads as two documents stapled together. */}
        <header className="print-hide mb-8">
          <h1 className="text-page font-semibold tracking-tight">
            <T k="check.title" />
          </h1>
          <p className="max-w-measure mt-2 text-ink-2">
            <T k="check.intro" />
          </p>
        </header>

        {readError && (
          <Banner tone="red" title="The readers could not be reached.">
            <p>{readError}</p>
            <p className="max-w-measure mt-2">
              Nothing is shown below, because nothing was read. Backend expected at{" "}
              <code className="font-mono">{API_BASE || "the same origin as this page"}</code>.
            </p>
          </Banner>
        )}

        {computeError && (
          <Banner tone="red" title="The calculation did not complete.">
            <p>{computeError}</p>
            <p className="max-w-measure mt-2">
              The readers were reached and what they read is shown below. It is the calculation
              that did not return a result, so no figure is shown for this month.
            </p>
          </Banner>
        )}

        {refusal && <RefusalBanner refusal={refusal} />}

        {/* Hidden from print without an omission note: a file picker is a
            control, not a figure, and its result - which documents were read,
            and what each reader made of them - is on the sheet directly below. */}
        <div className="print-hide">
          <Upload
            files={files}
            onPick={(role, file) => setFiles((f) => ({ ...f, [role]: file }))}
            onRead={read}
            phase={phase}
            canRead={chosen.some((d) => d.required)}
          />
        </div>

        {extract && phase === "reconciled" && (
          <>
            <CachePath state={extract.cache_state} note={extract.cache_note} />
            <Readers readers={extract.readers} headingRef={readersRef} />
            <ReadGroup
              fields={extract.read_fields}
              readers={extract.readers}
              cpfOnly={extract.cpf_only_fields}
              agreed={extract.agreed_count}
              total={extract.read_field_count}
              answers={answers}
              onAnswer={(name, value) => setAnswers((a) => ({ ...a, [name]: value }))}
            />
            <WorkerGroup
              fields={extract.worker_fields}
              answers={answers}
              restDay={restDayVerdict(extract, answers)}
              onAnswer={(name, value) => setAnswers((a) => ({ ...a, [name]: value }))}
            />
            <div className="print-hide">
              <ComputeGate unresolved={unresolved} onCompute={compute} />
            </div>
            {breakdown && computedFrom && (
              <Result breakdown={breakdown} inputs={computedFrom} headingRef={resultRef} />
            )}
            {breakdown && <AgentPanel />}
          </>
        )}

        <Footer />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ upload */

function Upload({
  files,
  onPick,
  onRead,
  phase,
  canRead,
}: {
  files: Partial<Record<DocumentRole, File>>;
  onPick: (role: DocumentRole, file: File) => void;
  onRead: () => void;
  phase: Phase;
  canRead: boolean;
}) {
  const t = useT();
  return (
    <section className="mb-8 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2 className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="check.docsHeading" />
      </h2>
      <ul className="mt-3 space-y-3">
        {DOCUMENTS.map((d) => (
          <li key={d.role} className="rounded-sm border border-line p-3">
            <label className="block cursor-pointer">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  <T k={d.label} />
                  {d.required && <span className="ml-1 text-danger-fg">*</span>}
                </span>
                <span className="text-meta text-ink-3">
                  {files[d.role] ? files[d.role]!.name : t("check.noFile")}
                </span>
              </div>
              <p className="mt-1 text-meta text-ink-2">
                <T k={d.hint} />
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-2 block w-full text-meta file:mr-3 file:rounded-sm file:border-0 file:bg-brand file:px-3 file:py-2 file:text-on-solid"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(d.role, f);
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onRead}
        disabled={!canRead || phase === "reading"}
        className="tap mt-4 rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
      >
        {phase === "reading" ? t("check.reading") : t("check.read")}
      </button>
      {!canRead && (
        <p className="mt-2 text-meta text-ink-2">
          <T k="check.needPayslip" />
        </p>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- readers */

function Readers({
  readers,
  headingRef,
}: {
  readers: ReaderInfo[];
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  return (
    <section className="mb-6 rounded-lg border border-line-strong bg-surface p-4 shadow-card">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-body font-semibold uppercase tracking-wide text-ink-3"
      >
        <T k="check.readersHeading" />
      </h2>
      <ul className="mt-2 space-y-2 text-body">
        {readers.map((r) => (
          <li key={r.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={`rounded-sm px-2 py-1 text-meta font-semibold ${
                r.ok ? "bg-agreed-bg text-agreed-fg" : "bg-danger-bg text-danger-fg"
              }`}
            >
              {r.ok ? t("check.answered") : t("check.didNotAnswer")}
            </span>
            <span className="font-medium">{r.provider}</span>
            <span className="font-mono text-meta text-ink-2">{r.model}</span>
            <span
              className={`rounded-sm px-2 py-1 text-meta font-semibold ${
                r.cache === "HIT"
                  ? "bg-agreed-bg text-agreed-fg"
                  : "bg-brand-bg text-brand-fg"
              }`}
            >
              {r.cache === "HIT" ? t("check.fromCache") : t("check.calledLive")}
            </span>
            {/*
              A time is only shown for a live call, because only then does it
              describe THIS request. `latency_ms` on a hit is the latency
              recorded when the entry was generated, so printing it beside a
              cache chip read as "this cached reply took 3,688 ms" when the
              replay was about a millisecond. A number next to a chip is read as
              describing the request in front of you.
              See docs/debt.md, cached-path-wearing-a-live-timing.
            */}
            {r.cache !== "HIT" && r.latency_ms !== null && (
              <span className="text-meta text-ink-3">{r.latency_ms} ms</span>
            )}
            {r.error && <span className="w-full text-meta text-danger-fg">{r.error}</span>}
          </li>
        ))}
      </ul>
      <p className="max-w-measure mt-2 text-meta text-ink-2">
        <T k="check.readersNote" />
      </p>
    </section>
  );
}

/**
 * Which path the readings came down. This is shown, not inferred: a fast
 * response is not evidence the cache was used, and the cache is the fallback
 * for a room with bad wifi. See docs/debt.md,
 * write-path-contradicts-its-own-contract.
 */
function CachePath({ state, note }: { state: ExtractOut["cache_state"]; note: string }) {
  const tone =
    state === "HIT"
      ? "border-agreed-line bg-agreed-bg text-agreed-fg"
      : state === "PARTIAL"
        ? "border-attention-line bg-attention-bg text-attention-fg"
        : "border-brand-line bg-brand-bg text-brand-fg";
  const heading =
    state === "HIT"
      ? "Replayed from the committed cache - no model was called"
      : state === "PARTIAL"
        ? "Partly cached, partly live"
        : "Read live just now - not from the cache";
  return (
    <section className={`mb-6 rounded-sm border px-4 py-3 text-body ${tone}`}>
      <p className="font-semibold">{heading}</p>
      <p className="mt-1">{note}</p>
    </section>
  );
}

/* ------------------------------------------------- group 1: read from documents */

function ReadGroup({
  fields,
  readers,
  cpfOnly,
  agreed,
  total,
  answers,
  onAnswer,
}: {
  fields: ReadField[];
  /** Who read them. The comparison needs the two reader identities for its
   * column headings and for the independence diagram. */
  readers: ReaderInfo[];
  /** Fields the pay engine never receives. Labelled, not silently unanswerable:
   * one of these used to offer "What is the right figure?", record a green
   * chip, and then have the answer deleted before /compute. */
  cpfOnly: string[];
  agreed: number;
  total: number;
  answers: Record<string, string>;
  onAnswer: (name: string, value: string) => void;
}) {
  const allAgreed = agreed === total;
  return (
    <section className="mb-6 overflow-hidden rounded-lg border-2 border-brand-line bg-surface shadow-card">
      <div className="border-b border-brand-line bg-brand-bg px-5 py-3">
        <h2 className="text-lead font-semibold text-brand-fg">
          <T k="group.readHeading" />
          <span className="ml-2 rounded-full border border-brand-line bg-surface px-2 py-1 text-meta font-semibold text-brand-fg">
            <T k="group.fieldCount" vars={{ n: total }} />
          </span>
        </h2>
        <p className="max-w-measure mt-1 text-body text-brand-fg">
          <T k="group.readBlurb" />
        </p>
      </div>

      {allAgreed ? (
        <div className="border-b border-agreed-line bg-agreed-bg px-5 py-3">
          <p className="font-semibold text-agreed-fg">
            <T k="group.allAgreed" vars={{ n: total }} />
          </p>
          <p className="max-w-measure mt-1 text-body text-agreed-fg">
            <T k="group.allAgreedWhy" />
          </p>
        </div>
      ) : (
        <div className="border-b border-attention-line bg-attention-bg px-5 py-3">
          <p className="font-semibold text-attention-fg">
            <T k="group.someAgreed" vars={{ a: agreed, t: total }} />
          </p>
          <p className="max-w-measure mt-1 text-body text-attention-fg">
            <T k="group.someAgreedWhy" />
          </p>
        </div>
      )}

      {/* ONE COMPARISON, NOT SIX ROWS. The readings used to be scattered a
          field at a time down the page, so seeing whether the readers ever
          disagreed meant reading six separate rows and holding them in your
          head. Side by side it is the picture, and the answer boxes stay with
          their fields - the 0:10 beat still taps the rest-day row and confirms
          it in place. */}
      <div className="px-5 py-4">
        <ReaderComparison fields={fields} readers={readers} answers={answers}>
          {(f) => (
            <ReadFieldAnswer
              field={f}
              cpfOnly={cpfOnly.includes(f.name)}
              answer={answers[f.name] ?? ""}
              onAnswer={(v) => onAnswer(f.name, v)}
            />
          )}
        </ReaderComparison>
      </div>
    </section>
  );
}

/**
 * What a worker is asked to do about a field the readers did not settle.
 *
 * This used to be a whole row: the label, the status chip, both readings and
 * then the answer box. The first three moved into ReaderComparison, which shows
 * them for every field at once; what is left here is the affordance, rendered
 * under its own row in that table.
 *
 * The three branches are unchanged, and the middle one is the one worth
 * keeping: a `cpfOnly` field never reaches the pay engine, so offering to
 * answer it would earn a green chip and then have the answer deleted before
 * /compute - a confirmation recorded and thrown away.
 */
function ReadFieldAnswer({
  field,
  cpfOnly,
  answer,
  onAnswer,
}: {
  field: ReadField;
  cpfOnly: boolean;
  answer: string;
  onAnswer: (v: string) => void;
}) {
  const t = useT();
  if (isEstablished(field.fact.status)) return null;
  if (cpfOnly) {
    return (
      <p className="max-w-measure text-meta text-ink-3">
        This one is for the CPF check, which FairSlip does not run on this screen, so it does
        not hold up your figures.
      </p>
    );
  }
  return (
    <div className="rounded-sm border border-attention-line bg-attention-bg px-3 py-2">
      <label className="block text-meta font-medium text-attention-fg">
        <T k="field.rightFigure" />
        <input
          type="text"
          inputMode="decimal"
          value={answer}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder={t("field.typeNumber")}
          className="mt-1 block w-full rounded-sm border border-attention-line bg-surface px-2 py-1 font-mono text-body text-ink"
        />
      </label>
    </div>
  );
}

/* ------------------------------------------- group 2: only the worker can say */

function WorkerGroup({
  fields,
  answers,
  restDay,
  onAnswer,
}: {
  fields: WorkerField[];
  answers: Record<string, string>;
  restDay: RestDayVerdict;
  onAnswer: (name: string, value: string) => void;
}) {
  const netPaid = fields.find((f) => f.name === "net_paid");
  const rest = fields.filter((f) => f.name !== "net_paid");

  return (
    <section className="mb-6 overflow-hidden rounded-lg border-2 border-confirmed-line bg-surface shadow-card">
      <div className="border-b border-confirmed-line bg-confirmed-bg px-5 py-3">
        <h2 className="text-lead font-semibold text-confirmed-fg">
          <T k="group.workerHeading" />
          <span className="ml-2 rounded-full border border-confirmed-line bg-surface px-2 py-1 text-meta font-semibold text-confirmed-fg">
            <T k="group.fieldCount" vars={{ n: fields.length }} />
          </span>
        </h2>
        <p className="max-w-measure mt-1 text-body text-confirmed-fg">
          <T k="group.workerBlurb" />
        </p>
      </div>

      {netPaid && (
        <div className="border-b-4 border-confirmed-line bg-confirmed-bg/40 px-5 py-4">
          <p className="text-meta font-semibold uppercase tracking-wide text-confirmed-fg">
            <T k="group.mostImportant" />
          </p>
          <h3 className="mt-1 text-lead font-semibold text-confirmed-fg">{netPaid.label}</h3>
          <p className="mt-2 rounded-sm border border-confirmed-line bg-surface px-3 py-2 text-body text-ink">
            {netPaid.why}
          </p>
          <label className="mt-3 block text-body font-medium text-confirmed-fg">
            <ServerPrompt field={netPaid} />
            <input
              type="text"
              inputMode="decimal"
              value={answers.net_paid ?? ""}
              onChange={(e) => onAnswer("net_paid", e.target.value)}
              placeholder="e.g. 1120.00"
              className="mt-1 block w-full rounded-sm border-2 border-confirmed-line bg-surface px-3 py-2 font-mono text-body text-ink"
            />
          </label>
        </div>
      )}

      <ul className="divide-y divide-line">
        {rest.map((f) => {
          // Non-rest-day fields always render their input; only this one is conditional.
          const held: RestDayVerdict =
            f.name === "rest_day_requested_by" ? restDay : { state: "worked", settledBy: null };
          return (
            <li key={f.name} className="px-5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{f.label}</span>
                <div className="flex gap-2">
                  {f.required_for.includes("cpf") && (
                    <span className="rounded-sm bg-sunken px-2 py-1 text-meta font-semibold text-ink-2">
                      <T k="group.forCpf" />
                    </span>
                  )}
                  <StatusChip
                    status={answers[f.name]?.trim() ? "HUMAN_CONFIRMED" : "MISSING"}
                  />
                </div>
              </div>
              <p className="mt-1 text-meta text-ink-2">{f.why}</p>
              {held.state === "not_worked" ? (
                <p className="mt-2 text-meta text-ink-3">
                  Not asked:{" "}
                  {held.settledBy === "readers"
                    ? "both readers agree no hours were worked on a rest day"
                    : "you told us no hours were worked on a rest day"}
                  , so MOM&rsquo;s rest-day table does not apply.
                </p>
              ) : held.state === "unknown" ? (
                <p className="mt-2 rounded-sm border border-attention-line bg-attention-bg px-3 py-2 text-meta text-attention-fg">
                  Not asked yet. Whether a rest day was worked is not established &mdash; see
                  &ldquo;Hours worked on a rest day&rdquo; above. That is not the same as the
                  documents showing no rest day, and FairSlip will not treat it as though it were.
                  Answer that field and this question appears if it applies.
                </p>
              ) : (
                <WorkerInput
                  field={f}
                  value={answers[f.name] ?? ""}
                  onChange={(v) => onAnswer(f.name, v)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A question the SERVER owns, rendered in the reader's language.
 *
 * The translations ship from backend/fairslip/extract_schema.py beside the
 * English, so there is one source of truth for what a field asks. When a
 * language has no entry the English is shown MARKED, exactly like an
 * untranslated interface string - the fallback is the same everywhere, because
 * "we have not translated this yet" is one fact however it arises.
 */
function ServerPrompt({ field }: { field: WorkerField }) {
  const { lang } = usePrefs();
  const translated = lang === "en" ? field.prompt : field.prompt_i18n[lang];
  if (translated) return <>{translated}</>;
  return (
    <span className="untranslated" lang="en">
      {field.prompt}
    </span>
  );
}

function WorkerInput({
  field,
  value,
  onChange,
}: {
  field: WorkerField;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls =
    "mt-1 block w-full rounded-sm border border-control bg-surface px-2 py-2 text-body text-ink";
  return (
    <label className="mt-2 block text-body text-ink">
      <ServerPrompt field={field} />
      {field.answer_type === "choice" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">&mdash; not yet answered &mdash;</option>
          {field.choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.answer_type === "date" ? "date" : "text"}
          inputMode={field.answer_type === "decimal" ? "decimal" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} font-mono`}
        />
      )}
    </label>
  );
}

/* ------------------------------------------------------------ compute gate */

function ComputeGate({
  unresolved,
  onCompute,
}: {
  unresolved: { name: string; label: string; group: "read" | "worker" }[];
  onCompute: () => void;
}) {
  const t = useT();
  const blocked = unresolved.length > 0;
  return (
    <section className="mb-6 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <button
        type="button"
        onClick={onCompute}
        disabled={blocked}
        className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
      >
        <T k="gate.compute" />
      </button>

      {blocked ? (
        <div className="mt-3">
          <p className="text-body font-semibold text-ink">
            {unresolved.length === 1
              ? t("gate.blockedOne")
              : t("gate.blockedMany", { n: unresolved.length })}
          </p>
          <ul className="mt-2 space-y-1 text-body">
            {unresolved.map((f) => (
              <li key={f.name} className="flex items-baseline gap-2">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    f.group === "read" ? "bg-brand" : "bg-confirmed"
                  }`}
                />
                <span className="text-ink">{f.label}</span>
                <span className="text-meta text-ink-3">
                  {f.group === "read" ? t("gate.reasonRead") : t("gate.reasonWorker")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="max-w-measure mt-3 text-body text-ink-2">
          <T k="gate.ready" />
        </p>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- result */

function Result({
  breakdown,
  inputs,
  headingRef,
}: {
  headingRef?: React.Ref<HTMLParagraphElement>;
  breakdown: PayBreakdown;
  /** The exact facts that produced this breakdown. The impact view varies one
   * of them and sends both sets to the engine. */
  inputs: PayInputs;
}) {
  const t = useT();
  return (
    <section className="mb-8 rounded-lg border border-line-strong bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4">
        <p
          ref={headingRef}
          tabIndex={-1}
          className="text-meta font-semibold uppercase tracking-wide text-ink-3"
        >
          <T k="result.difference" />
        </p>
        <p className="mt-1 text-hero font-semibold tabular-nums">{money(breakdown.difference)}</p>
        {/* The four figures that used to sit here as a row of numbers are now
            four rows of the waterfall below, each drawn against the same axis
            as the components that produced them. Nothing was dropped: the
            read-aloud below still speaks all four, from the same Money objects. */}
        {/* The read-aloud is handed the SAME t() labels and the SAME money()
            strings this card just rendered, assembled one line up. There is no
            second copy of the figures anywhere and no template: what it speaks
            is what is on the screen, by construction rather than by care. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <PrintButton />
          <ReadAloud
            lines={[
              `${t("result.difference")}: ${money(breakdown.difference)}`,
              `${t("result.expectedGross")}: ${money(breakdown.expected_gross)}`,
              `${t("result.deductions")}: ${money(breakdown.deductions_total)}`,
              `${t("result.expectedNet")}: ${money(breakdown.expected_net)}`,
              `${t("result.reachedBank")}: ${money(breakdown.net_paid)}`,
              ...breakdown.components.map(
                (c) => `${c.label.replace(/_/g, " ")}: ${money(c.amount)}`,
              ),
            ]}
          />
        </div>
      </div>

      <Waterfall breakdown={breakdown} />

      {/* The list stays. It answers a different question from the chart: the
          chart says how big each part is, the list says where each came from,
          and the 0:35 beat of docs/demo-script.md points at this one with the
          formulas already open - "no tap needed, point, do not click". Both
          render the same Component objects; neither holds a second copy of a
          figure. */}
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-body font-semibold uppercase tracking-wide text-ink-3">
          <T k="result.whereFrom" />
        </h3>
        <ul className="mt-2 divide-y divide-line">
          {breakdown.components.map((c) => (
            <li key={c.label} className="py-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{c.label.replace(/_/g, " ")}</span>
                <span className="font-medium tabular-nums">{money(c.amount)}</span>
              </div>
              <p className="mt-1 font-mono text-meta text-ink-2">{c.formula}</p>
              <ul className="mt-1 space-y-1 text-meta text-ink-3">
                {c.inputs.map((src) => (
                  <li key={src}>&larr; {src}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {breakdown.flags.length > 0 && (
        <div className="px-5 py-4">
          <h3 className="text-body font-semibold uppercase tracking-wide text-ink-3">
            <T k="result.flags" />
          </h3>
          <ul className="mt-2 space-y-1">
            {breakdown.flags.map((f) => (
              <li
                key={f}
                className="rounded-sm border border-attention-line bg-attention-bg px-3 py-1 font-mono text-meta text-attention-fg"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ScreenOnly id="impact" noteClassName="px-5">
        <ImpactRadius inputs={inputs} />
      </ScreenOnly>

      <div className="border-t border-line px-5 py-4">
        <p className="text-body font-semibold text-ink">
          The CPF side of this month is not shown.
        </p>
        <p className="max-w-measure mt-1 text-body text-ink-2">
          Working out CPF needs the wage the employer actually computed CPF on, and no document
          you uploaded states that figure. It could be worked backwards from the CPF line on the
          payslip, but CPF rounding drops the cents, so that gives a range of possible wages
          rather than one wage. FairSlip does not show a single number where it only has a range,
          so it shows none.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- fragments */


function Banner({
  tone,
  title,
  children,
}: {
  tone: "red" | "amber";
  title: string;
  children: ReactNode;
}) {
  const cls =
    tone === "red"
      ? "border-danger-line bg-danger-bg text-danger-fg"
      : "border-attention-line bg-attention-bg text-attention-fg";
  return (
    <section className={`mb-6 rounded-sm border p-4 text-body ${cls}`}>
      <p className="font-semibold">{title}</p>
      {children}
    </section>
  );
}

/**
 * Branch on the discriminant the response actually carried. Writing one cause
 * for every refusal is how a screen ends up telling a worker the readers
 * disagreed when in fact the wage was out of scope.
 * See docs/debt.md, ui-invents-a-cause.
 */
/** Every refusal code gets its own sentence. The fallback deliberately does NOT
 * name a cause: asserting one for a code this function does not know is
 * docs/debt.md, ui-invents-a-cause. The server's own detail is always shown. */
const REFUSAL_TITLES: Record<Refusal["error"], string> = {
  UNESTABLISHED_INPUT: "Nothing was calculated: a field it needs is not yet established.",
  OUT_OF_SCOPE: "Outside what FairSlip checks.",
  INVALID_INPUT: "That input could not be read as the type its field needs.",
  MANDATE_EXCEEDED: "That is outside the mandate you granted.",
  ACTION_NOT_BUILT: "FairSlip has not built that yet.",
  DRAFT_UNAVAILABLE: "No drafted message is available for this month.",
  DRAFT_REJECTED: "A message was written and then refused, because it broke FairSlip’s own copy rules.",
  COVERAGE_UNESTABLISHED: "Something the coverage page states could no longer be established.",
  COVERAGE_COPY: "The coverage page was refused by FairSlip’s own copy rules.",
};

function RefusalBanner({ refusal }: { refusal: Refusal }) {
  const title = REFUSAL_TITLES[refusal.error] ?? "FairSlip declined, and said why below.";
  return (
    <Banner tone="amber" title={title}>
      <p className="mt-1 rounded-sm bg-surface/60 px-3 py-2 font-mono text-meta">{refusal.detail}</p>
      {refusal.error === "MANDATE_EXCEEDED" && refusal.required_level != null && (
        <p className="max-w-measure mt-2 text-meta">
          Mandate level {refusal.required_level} would permit it. Raising the level is your
          choice, and nothing changes until you make it.
        </p>
      )}
      {refusal.error === "ACTION_NOT_BUILT" && (
        <p className="max-w-measure mt-2 text-meta">
          This is not disabled by your mandate. Raising your mandate level will not enable it.
        </p>
      )}
    </Banner>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-line-strong pt-6 text-meta text-ink-2">
      <p className="font-semibold text-ink-2">
        <T k="footer.outside" />
      </p>
      <p className="max-w-measure mt-1">
        <T k="footer.outsideBody" />
      </p>
      <p className="max-w-measure mt-3">
        <T k="footer.notADetermination" />
      </p>
      <p className="mt-3 font-mono text-meta text-ink-3">
        <T k="footer.engines" /> {API_BASE || "same origin"}
      </p>
    </footer>
  );
}

/* ------------------------------------------------------------ fact assembly */

/**
 * Was a rest day worked? THREE answers, not two.
 *
 * "unknown" is the one that matters. A field the readers could not establish is
 * not a field the documents settled: here reader A read 8 hours off a roster
 * that says "Sun 14: full day (rest day)" and reader B read nothing, which
 * makes the fact MISSING - not absent. Collapsing MISSING into "no rest day was
 * worked" made the screen state something the documents contradict, on the part
 * of the month that is most of the discrepancy this demo exists to show.
 * See docs/debt.md, missing-narrated-as-settled.
 */
type RestDayState = "worked" | "not_worked" | "unknown";

/** Who settled it. A screen that cannot say this cannot honestly narrate it. */
type RestDaySettledBy = "readers" | "you" | null;

type RestDayVerdict = { state: RestDayState; settledBy: RestDaySettledBy };

function restDayVerdict(
  extract: ExtractOut,
  answers: Record<string, string>,
): RestDayVerdict {
  const unknown: RestDayVerdict = { state: "unknown", settledBy: null };
  const f = extract.read_fields.find((x) => x.name === "rest_day_hours");
  if (!f) return unknown;

  const typed = answers.rest_day_hours?.trim();
  const fromReaders = isEstablished(f.fact.status) ? f.fact.value : null;
  // A worker's answer wins, and knowing WHICH source won is the whole point:
  // the input box only appears when the readers did NOT settle the field, so a
  // typed value proves there was no reader agreement to cite.
  const raw = typed || fromReaders;
  const settledBy: RestDaySettledBy = typed ? "you" : fromReaders !== null ? "readers" : null;

  if (raw === null || raw === undefined || raw === "" || typeof raw === "object") return unknown;

  const n = Number(raw);
  if (!Number.isFinite(n)) return unknown;
  if (n > 0) return { state: "worked", settledBy };
  if (n === 0) return { state: "not_worked", settledBy };

  // Negative. NOT "no rest day was worked" - that would launder a reading
  // nobody established into a settled zero and drop the component. It is a
  // value the engine must see and refuse.
  return unknown;
}

/**
 * Assemble the PayInputs the engine takes.
 *
 * A worker's answer always becomes HUMAN_CONFIRMED; a reader agreement is
 * carried through as it arrived, source and all. Nothing here is defaulted: a
 * field with no agreement and no answer is passed on with the status it has, so
 * the engine is the thing that refuses it, not this file.
 */
function payInputsFrom(
  extract: ExtractOut,
  answers: Record<string, string>,
): Record<string, Fact | null> {
  const out: Record<string, Fact | null> = {};

  for (const f of extract.read_fields) {
    const typed = answers[f.name]?.trim();
    out[f.name] = typed
      ? {
          value: typed,
          status: "HUMAN_CONFIRMED",
          source: `you answered on screen: ${f.label}`,
        }
      : f.fact;
  }

  for (const f of extract.worker_fields) {
    if (f.required_for.includes("cpf")) continue; // held for the CPF pack
    const typed = answers[f.name]?.trim();
    out[f.name] = typed
      ? {
          // Naming the field does two things: the provenance list under the
          // headline figure says WHICH answer a dollar came from, and the
          // strings stop colliding - three worker answers all read "worker
          // answered on screen", which React then rendered with duplicate keys.
          value: typed,
          status: "HUMAN_CONFIRMED",
          source: `you answered on screen: ${f.label}`,
        }
      : { value: null, status: "MISSING", source: `you have not answered: ${f.label}` };
  }

  // The rest-day pair travels together or not at all: rules.py drops BOTH when
  // only one is supplied, with no flag (docs/debt.md, half-input-silently-dropped).
  //
  // Which way it travels depends on all three states, not two. Nulling the pair
  // whenever it is not established would tell the engine "no rest day was
  // worked" on a month where the readers simply had not settled it - the same
  // false claim the screen used to make in words.
  switch (restDayVerdict(extract, answers).state) {
    case "worked":
      break; // both facts are established or confirmed; send them as they are
    case "not_worked":
      // Established as zero: there is no rest-day component to compute.
      out.rest_day_hours = null;
      out.rest_day_requested_by = null;
      break;
    case "unknown":
      // Send both unestablished so the ENGINE refuses. The gate should have
      // blocked this already; if it ever does not, a refusal is the right
      // outcome and silently dropping a rest day is not.
      out.rest_day_requested_by = {
        value: null,
        status: "MISSING",
        source: "not established: whether a rest day was worked is unresolved",
      };
      break;
  }

  // Not PayInputs fields - they belong to the CPF pack. Derived from the same
  // server list the compute gate reads, so the two cannot drift: the gate used
  // to block on a field this function then deleted.
  for (const name of extract.cpf_only_fields) delete out[name];

  return out;
}
