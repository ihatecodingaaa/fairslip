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

import { useMemo, useState, type ReactNode } from "react";
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
  type ReadField,
  type ReaderInfo,
  type Refusal,
  type WorkerField,
} from "@/lib/api";

/** The documents a reader may be given, and what each is for. */
const DOCUMENTS: { role: DocumentRole; label: string; hint: string; required: boolean }[] = [
  {
    role: "payslip",
    label: "Payslip",
    hint: "The itemised pay record from your employer. A photo or a screenshot.",
    required: true,
  },
  {
    role: "roster",
    label: "Roster or timesheet",
    hint: "Your hours - a schedule, a timesheet, or a WhatsApp screenshot.",
    required: false,
  },
  {
    role: "ket",
    label: "Key employment terms",
    hint: "The terms you agreed to, if you have them.",
    required: false,
  },
];

type Phase = "collect" | "reading" | "reconciled";

export default function CheckPage() {
  const [files, setFiles] = useState<Partial<Record<DocumentRole, File>>>({});
  const [phase, setPhase] = useState<Phase>("collect");
  const [extract, setExtract] = useState<ExtractOut | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [breakdown, setBreakdown] = useState<PayBreakdown | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // Two failures, two states. They were one, so a /compute failure rendered
  // "The readers could not be reached" - while the readings it was contradicting
  // sat on screen directly above. See docs/debt.md, ui-invents-a-cause.
  const [readError, setReadError] = useState<string | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);

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
    for (const f of extract.read_fields) {
      if (!isEstablished(f.fact.status) && !answers[f.name]?.trim()) {
        out.push({ name: f.name, label: f.label, group: "read" });
      }
    }
    for (const f of extract.worker_fields) {
      // The engines' pay pack does not take residency or date of birth; those
      // two are held for the CPF pack and do not block this calculation.
      if (f.required_for.includes("cpf")) continue;
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
      const out = await postCompute(payInputsFrom(extract, answers));
      if (!out.ok) {
        setRefusal(out.refusal);
        setBreakdown(null);
        return;
      }
      setBreakdown(out.value);
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex-1 bg-zinc-100 text-zinc-900">
      <main className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Does your pay add up?</h1>
          <p className="mt-2 text-zinc-600">
            Two readers transcribe your documents independently. Where they agree, we say so.
            Where they do not, you decide. And some things no document can tell us &mdash; those
            we ask you.
          </p>
        </header>

        {readError && (
          <Banner tone="red" title="The readers could not be reached.">
            <p>{readError}</p>
            <p className="mt-2">
              Nothing is shown below, because nothing was read. Backend expected at{" "}
              <code className="font-mono">{API_BASE || "the same origin as this page"}</code>.
            </p>
          </Banner>
        )}

        {computeError && (
          <Banner tone="red" title="The calculation did not complete.">
            <p>{computeError}</p>
            <p className="mt-2">
              The readers were reached and what they read is shown below. It is the calculation
              that did not return a result, so no figure is shown for this month.
            </p>
          </Banner>
        )}

        {refusal && <RefusalBanner refusal={refusal} />}

        <Upload
          files={files}
          onPick={(role, file) => setFiles((f) => ({ ...f, [role]: file }))}
          onRead={read}
          phase={phase}
          canRead={chosen.some((d) => d.required)}
        />

        {extract && phase === "reconciled" && (
          <>
            <CachePath state={extract.cache_state} note={extract.cache_note} />
            <Readers readers={extract.readers} />
            <ReadGroup
              fields={extract.read_fields}
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
            <ComputeGate unresolved={unresolved} onCompute={compute} />
            {breakdown && <Result breakdown={breakdown} />}
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
  return (
    <section className="mb-8 rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Your documents
      </h2>
      <ul className="mt-3 space-y-3">
        {DOCUMENTS.map((d) => (
          <li key={d.role} className="rounded border border-zinc-200 p-3">
            <label className="block cursor-pointer">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {d.label}
                  {d.required && <span className="ml-1 text-red-700">*</span>}
                </span>
                <span className="text-xs text-zinc-500">
                  {files[d.role] ? files[d.role]!.name : "no file chosen"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-600">{d.hint}</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-2 block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-white"
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
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
      >
        {phase === "reading" ? "Both readers are reading…" : "Read my documents"}
      </button>
      {!canRead && (
        <p className="mt-2 text-xs text-zinc-600">A payslip is needed before we can read.</p>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- readers */

function Readers({ readers }: { readers: ReaderInfo[] }) {
  return (
    <section className="mb-6 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Who read your documents
      </h2>
      <ul className="mt-2 space-y-2 text-sm">
        {readers.map((r) => (
          <li key={r.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                r.ok ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"
              }`}
            >
              {r.ok ? "answered" : "did not answer"}
            </span>
            <span className="font-medium">{r.provider}</span>
            <span className="font-mono text-xs text-zinc-600">{r.model}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                r.cache === "HIT"
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-sky-100 text-sky-900"
              }`}
            >
              {r.cache === "HIT" ? "from cache" : "called live"}
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
              <span className="text-xs text-zinc-500">{r.latency_ms} ms</span>
            )}
            {r.error && <span className="w-full text-xs text-red-800">{r.error}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-600">
        Neither reader saw the other&rsquo;s answer. They were given the same images and the same
        list of fields.
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
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : state === "PARTIAL"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-sky-300 bg-sky-50 text-sky-900";
  const heading =
    state === "HIT"
      ? "Replayed from the committed cache - no model was called"
      : state === "PARTIAL"
        ? "Partly cached, partly live"
        : "Read live just now - not from the cache";
  return (
    <section className={`mb-6 rounded-md border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">{heading}</p>
      <p className="mt-1">{note}</p>
    </section>
  );
}

/* ------------------------------------------------- group 1: read from documents */

function ReadGroup({
  fields,
  agreed,
  total,
  answers,
  onAnswer,
}: {
  fields: ReadField[];
  agreed: number;
  total: number;
  answers: Record<string, string>;
  onAnswer: (name: string, value: string) => void;
}) {
  const allAgreed = agreed === total;
  return (
    <section className="mb-6 overflow-hidden rounded-lg border-2 border-sky-300 bg-white shadow-sm">
      <div className="border-b border-sky-200 bg-sky-50 px-5 py-3">
        <h2 className="text-base font-semibold text-sky-950">
          Read from your documents
          <span className="ml-2 rounded-full bg-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-900">
            {total} fields
          </span>
        </h2>
        <p className="mt-1 text-sm text-sky-900">
          These are figures a payslip or a roster actually shows, so two readers were each asked
          to transcribe them.
        </p>
      </div>

      {allAgreed ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3">
          <p className="font-semibold text-emerald-900">
            Both readers agreed on all {total}.
          </p>
          <p className="mt-1 text-sm text-emerald-900">
            Two models, given the same images separately, transcribed every one of these the same
            way. That is what agreement means here, and it is the only thing that makes a read
            field usable without asking you.
          </p>
        </div>
      ) : (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3">
          <p className="font-semibold text-amber-900">
            The readers agreed on {agreed} of {total}.
          </p>
          <p className="mt-1 text-sm text-amber-900">
            The rest are below, with what each reader said. FairSlip does not pick between them.
          </p>
        </div>
      )}

      <ul className="divide-y divide-zinc-200">
        {fields.map((f) => (
          <ReadFieldRow
            key={f.name}
            field={f}
            answer={answers[f.name] ?? ""}
            onAnswer={(v) => onAnswer(f.name, v)}
          />
        ))}
      </ul>
    </section>
  );
}

function ReadFieldRow({
  field,
  answer,
  onAnswer,
}: {
  field: ReadField;
  answer: string;
  onAnswer: (v: string) => void;
}) {
  const settled = isEstablished(field.fact.status);
  const confirmed = !settled && answer.trim().length > 0;

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{field.label}</span>
        <StatusChip status={confirmed ? "HUMAN_CONFIRMED" : field.fact.status} />
      </div>

      <ul className="mt-1.5 space-y-0.5 text-xs">
        {Object.entries(field.readings).map(([reader, value]) => (
          <li key={reader} className="font-mono text-zinc-700">
            <span className="text-zinc-500">{reader}</span>{" "}
            {value === null ? (
              <span className="italic text-zinc-500">answered nothing</span>
            ) : (
              <span
                className={
                  field.unreadable.includes(reader) ? "text-amber-800" : "text-zinc-900"
                }
              >
                {value}
                {field.unreadable.includes(reader) && " (not a number)"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {settled ? (
        <p className="mt-1 text-xs text-zinc-500">{field.fact.source}</p>
      ) : (
        <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-900">{field.fact.source}</p>
          <label className="mt-2 block text-xs font-medium text-amber-950">
            What is the right figure?
            <input
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder="type the number you know to be right"
              className="mt-1 block w-full rounded border border-amber-400 bg-white px-2 py-1 font-mono text-sm text-zinc-900"
            />
          </label>
        </div>
      )}
    </li>
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
    <section className="mb-6 overflow-hidden rounded-lg border-2 border-violet-300 bg-white shadow-sm">
      <div className="border-b border-violet-200 bg-violet-50 px-5 py-3">
        <h2 className="text-base font-semibold text-violet-950">
          Only you can answer these
          <span className="ml-2 rounded-full bg-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-900">
            {fields.length} fields
          </span>
        </h2>
        <p className="mt-1 text-sm text-violet-900">
          No reader was shown these. A better photograph would not help, and a better model would
          not either &mdash; the documents do not contain them. A model asked anyway would return
          a guess that looks exactly like a reading.
        </p>
      </div>

      {netPaid && (
        <div className="border-b-4 border-violet-200 bg-violet-50/40 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            The one that matters most
          </p>
          <h3 className="mt-1 text-lg font-semibold text-violet-950">{netPaid.label}</h3>
          <p className="mt-2 rounded border border-violet-300 bg-white px-3 py-2 text-sm text-zinc-800">
            {netPaid.why}
          </p>
          <label className="mt-3 block text-sm font-medium text-violet-950">
            {netPaid.prompt}
            <input
              type="text"
              inputMode="decimal"
              value={answers.net_paid ?? ""}
              onChange={(e) => onAnswer("net_paid", e.target.value)}
              placeholder="e.g. 1120.00"
              className="mt-1 block w-full rounded border-2 border-violet-400 bg-white px-3 py-2 font-mono text-base text-zinc-900"
            />
          </label>
        </div>
      )}

      <ul className="divide-y divide-zinc-200">
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
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-600">
                      for the CPF check
                    </span>
                  )}
                  <StatusChip
                    status={answers[f.name]?.trim() ? "HUMAN_CONFIRMED" : "MISSING"}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-zinc-600">{f.why}</p>
              {held.state === "not_worked" ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Not asked:{" "}
                  {held.settledBy === "readers"
                    ? "both readers agree no hours were worked on a rest day"
                    : "you told us no hours were worked on a rest day"}
                  , so MOM&rsquo;s rest-day table does not apply.
                </p>
              ) : held.state === "unknown" ? (
                <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
    "mt-1 block w-full rounded border border-zinc-400 bg-white px-2 py-1.5 text-sm text-zinc-900";
  return (
    <label className="mt-2 block text-sm text-zinc-800">
      {field.prompt}
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
  const blocked = unresolved.length > 0;
  return (
    <section className="mb-6 rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={onCompute}
        disabled={blocked}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
      >
        Work out what the rules say this month should have paid
      </button>

      {blocked ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-zinc-800">
            {unresolved.length === 1
              ? "One field is still unanswered, so nothing has been calculated:"
              : `${unresolved.length} fields are still unanswered, so nothing has been calculated:`}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {unresolved.map((f) => (
              <li key={f.name} className="flex items-baseline gap-2">
                <span
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    f.group === "read" ? "bg-sky-500" : "bg-violet-500"
                  }`}
                />
                <span className="text-zinc-800">{f.label}</span>
                <span className="text-xs text-zinc-500">
                  {f.group === "read"
                    ? "the readers did not settle it"
                    : "no document can show it"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-700">
          Every field the engine needs is either agreed by both readers or confirmed by you.
        </p>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- result */

function Result({ breakdown }: { breakdown: PayBreakdown }) {
  return (
    <section className="mb-8 rounded-lg border border-zinc-300 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Possible unreconciled difference
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{money(breakdown.difference)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <Stat label="Expected gross" value={money(breakdown.expected_gross)} />
          <Stat label="Deductions on the payslip" value={money(breakdown.deductions_total)} />
          <Stat label="Expected net" value={money(breakdown.expected_net)} />
          <Stat label="Reached the bank" value={money(breakdown.net_paid)} />
        </dl>
      </div>

      <div className="border-b border-zinc-200 px-5 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Where each dollar comes from
        </h3>
        <ul className="mt-2 divide-y divide-zinc-200">
          {breakdown.components.map((c) => (
            <li key={c.label} className="py-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{c.label.replace(/_/g, " ")}</span>
                <span className="font-medium tabular-nums">{money(c.amount)}</span>
              </div>
              <p className="mt-0.5 font-mono text-xs text-zinc-600">{c.formula}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Flags</h3>
          <ul className="mt-2 space-y-1">
            {breakdown.flags.map((f) => (
              <li
                key={f}
                className="rounded border border-amber-300 bg-amber-50 px-3 py-1 font-mono text-xs text-amber-900"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-zinc-200 px-5 py-4">
        <p className="text-sm font-semibold text-zinc-800">
          The CPF side of this month is not shown.
        </p>
        <p className="mt-1 text-sm text-zinc-700">
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

function StatusChip({ status }: { status: Fact["status"] }) {
  const tone = isEstablished(status)
    ? "bg-emerald-100 text-emerald-900"
    : status === "DISAGREED"
      ? "bg-amber-200 text-amber-900"
      : "bg-zinc-200 text-zinc-700";
  const words: Record<Fact["status"], string> = {
    AGREED: "both readers agree",
    DISAGREED: "readers disagree",
    MISSING: "not established",
    HUMAN_CONFIRMED: "you confirmed this",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{words[status]}</span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

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
      ? "border-red-300 bg-red-50 text-red-900"
      : "border-amber-300 bg-amber-50 text-amber-900";
  return (
    <section className={`mb-6 rounded-md border p-4 text-sm ${cls}`}>
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
function RefusalBanner({ refusal }: { refusal: Refusal }) {
  const title =
    refusal.error === "UNESTABLISHED_INPUT"
      ? "Nothing was calculated: a field it needs is not yet established."
      : refusal.error === "OUT_OF_SCOPE"
        ? "Outside what FairSlip checks."
        : "That input could not be read as the type its field needs.";
  return (
    <Banner tone="amber" title={title}>
      <p className="mt-1 rounded bg-white/60 px-3 py-2 font-mono text-xs">{refusal.detail}</p>
    </Banner>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-zinc-300 pt-6 text-xs text-zinc-600">
      <p className="font-semibold text-zinc-700">Outside what FairSlip checks</p>
      <p className="mt-1">
        Daily and piece-rated workers; public-holiday pay; shift-work averaging; CPF on monthly
        wages of $750 or less; PR year 1 and 2 CPF rates; Additional Wages; platform workers;
        domestic workers; and any question of legal liability. Where an input falls outside these
        rules the engines refuse rather than approximate.
      </p>
      <p className="mt-3">
        Figures are reconstructed from MOM&rsquo;s and CPF Board&rsquo;s published rules and are
        not a determination of any kind. Check with MOM, TADM or CPF Board.
      </p>
      <p className="mt-3 font-mono text-[11px] text-zinc-400">
        Engines at {API_BASE || "same origin"}
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
      ? { value: typed, status: "HUMAN_CONFIRMED", source: "worker confirmed on screen" }
      : f.fact;
  }

  for (const f of extract.worker_fields) {
    if (f.required_for.includes("cpf")) continue; // held for the CPF pack
    const typed = answers[f.name]?.trim();
    out[f.name] = typed
      ? { value: typed, status: "HUMAN_CONFIRMED", source: "worker answered on screen" }
      : { value: null, status: "MISSING", source: "the worker has not answered this" };
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

  // Not a PayInputs field - it belongs to the CPF pack.
  delete out.cpf_employee_on_payslip;

  return out;
}
