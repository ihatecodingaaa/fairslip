"use client";

/**
 * Stage 3 screen: what happens after the number.
 *
 * The copy contract applies hardest here, because every state on this panel is
 * one a worker could mistake for a stronger one:
 *
 *   - A drafted message is NOT a sent one. The draft carries state
 *     MESSAGE_DRAFTED and the timeline shows SENT as not yet reached.
 *   - AWAITING is NOT SENT. It is a separate step, reached only after a tap.
 *   - PARTIALLY_CORRECTED is NOT CORRECTED. They get different words, different
 *     colours, and the partial one says in a sentence what still stands.
 *   - UNVERIFIABLE is not a verdict about the employer at all, and says so.
 *
 * This file computes nothing. Every dollar is a Money the backend built from an
 * engine's Decimal, rendered through money(). Every verdict, every state name
 * and every refusal reason arrives from the API.
 */

import { useEffect, useState } from "react";
import {
  getAgentDemoInputs,
  getMandate,
  money,
  postDraft,
  postEscalation,
  postSend,
  postVerify,
  type AgentPersona,
  type CpfPack,
  type DemoInputs,
  type EscalationOut,
  type DraftOut,
  type MandateTable,
  type Refusal,
  type SentOut,
  type VerifyOut,
} from "../../lib/api";

/* The steps in the order the domain contract lists them. `reached` is derived
 * from what actually happened, never assumed from the step before it. */
const TIMELINE = [
  { key: "MESSAGE_DRAFTED", label: "Drafted", hint: "A message was written. Drafting is not sending." },
  { key: "SENT", label: "Sent", hint: "Recorded from your tap." },
  {
    key: "AWAITING_NEXT_PAYSLIP",
    label: "Awaiting next payslip",
    hint: "Tracking the next salary period is not built in this cut. FairSlip will not remind you.",
  },
] as const;

export function AgentPanel() {
  const [mandate, setMandate] = useState<MandateTable | null>(null);
  const [level, setLevel] = useState(0);
  const [draft, setDraft] = useState<DraftOut | null>(null);
  const [sent, setSent] = useState<SentOut | null>(null);
  const [verdict, setVerdict] = useState<VerifyOut | null>(null);
  const [pack, setPack] = useState<EscalationOut | null>(null);
  const [demo, setDemo] = useState<DemoInputs | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mei Ling by default. The scripted run never touches the switch; it is a
  // Q&A move, so the default must be the persona the script narrates.
  const [personaKey, setPersonaKey] = useState<string | null>(null);

  useEffect(() => {
    // A refusal is not a pending request. Swallowing `r.ok === false` left the
    // screen saying "Loading..." forever for something that had already been
    // refused - an error path narrated as a success in progress.
    getMandate()
      .then((r) => (r.ok ? setMandate(r.value) : setError(r.refusal.detail)))
      .catch((e) => setError(String(e)));
  }, []);

  // Switching refetches only the persona-dependent payload. It does not touch
  // the upload or the extraction above: both personas' draft entries are
  // committed, so a switch is one request and never a model call.
  useEffect(() => {
    getAgentDemoInputs(personaKey ?? undefined)
      .then((r) => {
        if (!r.ok) return setError(r.refusal.detail);
        setDemo(r.value);
        setDraft(null);
        setSent(null);
        setVerdict(null);
        setPack(null);
        return undefined;
      })
      .catch((e) => setError(String(e)));
  }, [personaKey]);

  async function run<T>(
    what: string,
    call: () => Promise<{ ok: true; value: T } | { ok: false; refusal: Refusal }>,
    onOk: (v: T) => void,
  ) {
    setBusy(what);
    setRefusal(null);
    setError(null);
    try {
      const r = await call();
      if (r.ok) onOk(r.value);
      else setRefusal(r.refusal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const doDraft = () => {
    if (!demo) return;
    return run("draft", () => postDraft(level, demo.draft_spec_name), (v) => {
      setDraft(v);
      setSent(null);
      setVerdict(null);
    });
  };

  /* The tap. The moment is taken HERE, when the worker taps, and sent as-is.
   * The backend records that moment - it never stamps its own. */
  const doSend = () => {
    const tappedAt = new Date().toISOString();
    return run("send", () => postSend(level, tappedAt, "check-page"), setSent);
  };

  const doVerify = (which: "month2_corrected" | "month2_uncorrected" | "month2_blocked") => {
    if (!demo) return;
    // Every month-2 input comes from the backend, including the blocked one.
    // Synthesising a DISAGREED fact here would mean inventing a reader
    // transcript - naming vendors and quoting readings nobody made - and then
    // rendering it back under "what was not established" as if it were evidence.
    return run("verify", () => postVerify(level, demo.month1, demo[which]), setVerdict);
  };

  // AWAITING is a SEPARATE state from SENT in the backend's state machine, and
  // the event that enters it is `track` - which this cut does not build. So
  // nothing establishes that it has been entered, and marking it reached from
  // `sent` would be assuming it from the step before, which is exactly what the
  // comment on TIMELINE forbids.
  const reached: Record<string, boolean> = {
    MESSAGE_DRAFTED: draft !== null,
    SENT: sent !== null,
    AWAITING_NEXT_PAYSLIP: false,
  };

  return (
    <section className="mt-8 rounded-lg border border-zinc-300 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-900">What happens next</h2>
      <p className="mt-1 text-sm text-zinc-600">
        FairSlip can help you raise this. What it may do is limited to what you allow, and it
        never contacts your employer itself.
      </p>

      {error && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          FairSlip could not complete that request: {error}. If that was the send tap, FairSlip
          cannot tell whether the record was made - check before tapping again.
        </p>
      )}

      {refusal && <AgentRefusal refusal={refusal} onRaise={(l) => setLevel(l)} />}

      {demo && (
        <PersonaSwitch
          personas={demo.personas}
          selected={demo.selected}
          onPick={setPersonaKey}
          busy={busy !== null}
        />
      )}

      <MandateSelector mandate={mandate} level={level} onPick={setLevel} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Action
          label="Draft a message"
          onClick={doDraft}
          busy={busy === "draft"}
          disabled={!demo}
        />
        {/* Calls the real endpoint, because WHICH refusal comes back is the
            point and only the backend can say: below level 4 the mandate check
            fires first and names level 4. Fabricating a refusal here once told
            a worker at level 0 that raising their level would not help, which
            was false at four of the five levels. */}
        <Action
          label="Prepare escalation"
          onClick={() =>
            run("escalate", () => postEscalation(level, demo?.selected.key), setPack)
          }
          busy={busy === "escalate"}
        />
      </div>

      {draft && draft.basis.trim() !== "" && (
        <>
          <DraftView draft={draft} />
          <TapToSend
            sent={sent}
            onSend={doSend}
            busy={busy === "send"}
            level={level}
            mandate={mandate}
          />
          <Timeline reached={reached} sent={sent} />
        </>
      )}

      {pack && <EscalationPack pack={pack} />}

      {/* One branch or the other, never both. A split of zeros under a NO_CPF
          banner is a card contradicting itself, and the overlap note would be
          describing an overlap of $0.

          The CPF card renders only when the server sent BOTH the pack and the
          sentence saying whose month it is: two fields with independent defaults
          can drift, and CPF figures without that caveat read as the viewer's own
          month, directly under their own reconciliation. */}
      {demo?.cpf && demo.cpf_basis.trim() !== "" && (
        <CpfShortfall cpf={demo.cpf} basis={demo.cpf_basis} persona={demo.selected} />
      )}
      {demo && !demo.cpf && demo.no_cpf_note.trim() !== "" && (
        <NoCpfCard persona={demo.selected} note={demo.no_cpf_note} />
      )}

      <VerifySection
        demo={demo}
        verdict={verdict}
        onVerify={doVerify}
        busy={busy === "verify"}
      />
    </section>
  );
}

/* Plain words for a worker. The raw values are the backend's action names, and
 * a snake_case identifier is not something to put in front of someone reading at
 * primary-school level. */
const ACTION_WORDS: Record<string, string> = {
  draft: "write a message for you",
  send: "record that you sent it",
  track: "watch for the next payslip",
  verify: "check next month's payslip",
  prepare_escalation: "gather an evidence pack",
};

/* ------------------------------------------------------------ the persona */

/**
 * Which invented worker the panel is showing.
 *
 * Every fact on a card is a field the server sent - pass type, occupation,
 * language, and whether CPF applies at all - so nothing here is inferred from a
 * name. The switch exists because the two personas produce visibly different
 * outcomes from the same engines and the same readers, which is the point: the
 * scope is a set of rules, not one hardcoded story.
 */
function PersonaSwitch({
  personas,
  selected,
  onPick,
  busy,
}: {
  personas: AgentPersona[];
  selected: AgentPersona;
  onPick: (key: string) => void;
  busy: boolean;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-zinc-900">
        Whose month this example shows
      </h3>
      <p className="mt-0.5 text-xs text-zinc-600">
        Both are invented. Same engines, same published rules - and different rules apply to
        each of them.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {personas.map((p) => {
          const picked = p.key === selected.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPick(p.key)}
              disabled={busy}
              aria-pressed={picked}
              className={`rounded border px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
                picked
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
              }`}
            >
              <span className="block font-medium">{p.name}</span>
              <span
                className={`mt-0.5 block text-xs ${picked ? "text-zinc-300" : "text-zinc-600"}`}
              >
                {p.residency_label} &middot; {p.occupation}
              </span>
              <span
                className={`mt-0.5 block text-xs ${picked ? "text-zinc-300" : "text-zinc-600"}`}
              >
                Writes in {p.language} &middot;{" "}
                {p.cpf_applies ? "CPF applies" : "not a CPF member"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The honest screen for a worker who is not a CPF member: a statement, not a
 * split of zeros. */
function NoCpfCard({ persona, note }: { persona: AgentPersona; note: string }) {
  return (
    <div className="mt-6 rounded border-2 border-dashed border-zinc-400 bg-zinc-50/60">
      <div className="border-b border-zinc-300 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Fictional worked example - not your figures
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-zinc-900">
          No CPF for {persona.name}
        </h3>
      </div>
      <p className="px-4 py-3 text-sm text-zinc-800">{note}</p>
    </div>
  );
}

/* ------------------------------------------------------------ the mandate */

function MandateSelector({
  mandate,
  level,
  onPick,
}: {
  mandate: MandateTable | null;
  level: number;
  onPick: (l: number) => void;
}) {
  if (!mandate) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        Loading the mandate levels from the server that enforces them...
      </p>
    );
  }
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-zinc-900">What you are allowing</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {mandate.levels.map((l) => {
          const picked = l.level === level;
          return (
            <button
              key={l.level}
              type="button"
              onClick={() => onPick(l.level)}
              aria-pressed={picked}
              className={`rounded border px-3 py-2 text-left text-sm transition ${
                picked
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
              }`}
            >
              <span className="block font-medium">
                Level {l.level} - {l.label}
              </span>
              <span
                className={`mt-1 block text-xs ${picked ? "text-zinc-300" : "text-zinc-600"}`}
              >
                {l.action_detail.length === 0 ? (
                  "FairSlip may do nothing beyond showing you the figures."
                ) : (
                  <>
                    May:{" "}
                    {l.action_detail.map((a, i) => (
                      <span key={a.name}>
                        {i > 0 && ", "}
                        <span className={a.built ? "" : "line-through opacity-70"}>
                          {ACTION_WORDS[a.name] ?? a.name}
                        </span>
                        {!a.built && " (not built yet)"}
                      </span>
                    ))}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* The honest answer to "what stops someone else setting level 4", where
          the level is set - not in a tooltip, not in a footnote. */}
      <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <span className="font-semibold">About this build: </span>
        {mandate.no_authentication_notice}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- the draft */

/**
 * The drafted message.
 *
 * It is written in the FIRST PERSON and offered as something to send, sitting
 * directly under the viewer's own reconciliation - so without an attribution it
 * reads as the viewer's own message about their own month. It is not: it is a
 * committed fixture for an invented worker. The CPF card was given the dashed
 * border, the "not your figures" line and a render gate for exactly this
 * reason, and this component - its twin - was left without them.
 * docs/debt.md, fix-applied-to-one-of-two-twins.
 */
function DraftView({ draft }: { draft: DraftOut }) {
  return (
    <div className="mt-6 rounded border-2 border-dashed border-zinc-400 bg-zinc-50/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-300 px-4 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Fictional worked example - not your message
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-zinc-900">
            A message they could send - not sent
          </h3>
        </div>
        <span className="rounded bg-zinc-200 px-2 py-0.5 font-mono text-[11px] text-zinc-700">
          {draft.state}
        </span>
      </div>
      <p className="border-b border-zinc-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        {draft.basis}
      </p>

      <div className="grid gap-0 md:grid-cols-2">
        <article className="border-b border-zinc-200 p-4 md:border-b-0 md:border-r">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {draft.language}
          </h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">
            {draft.translated}
          </p>
        </article>
        <article className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">English</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">
            {draft.english}
          </p>
        </article>
      </div>

      <div className="border-t border-zinc-200 px-4 py-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Every figure in this message came from an engine
        </h4>
        <ul className="mt-2 space-y-1">
          {draft.figures_cited.map((f) => (
            <li key={f.label} className="font-mono text-xs text-zinc-700">
              {money(f.amount)} - {f.label.replace(/_/g, " ")} - {f.formula}
            </li>
          ))}
        </ul>
      </div>

      {/* Beside the draft, never behind a disclosure. */}
      <div className="border-t border-zinc-200 bg-sky-50 px-4 py-3">
        <p className="text-sm font-medium text-sky-900">{draft.alternative_heading}</p>
        <ul className="mt-2 space-y-2">
          {draft.alternative.map((o) => (
            <li key={o.name} className="text-sm text-sky-900">
              <a
                href={o.link}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                {o.name}
              </a>
              <span className="block text-xs text-sky-800">{o.what_they_do}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-500">
        {draft.cache_note}
      </p>
    </div>
  );
}

/** The tap's own moment, in the reader's timezone. The backend records the
 * instant the worker tapped and never re-stamps it; this only renders it. A raw
 * UTC string made a 14:32 tap in Singapore read as 06:32Z, which is true and
 * looks wrong. The ISO string stays in `dateTime`/`title`. */
function localTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/* ----------------------------------------------------------------- the tap */

function TapToSend({
  sent,
  onSend,
  busy,
  level,
  mandate,
}: {
  sent: SentOut | null;
  onSend: () => void;
  busy: boolean;
  level: number;
  mandate: MandateTable | null;
}) {
  // Derived from the table the server enforces, not a second copy of it here.
  const sendLevel = mandate?.levels.find((l) => l.actions.includes("send"))?.level ?? null;
  const permitted = sendLevel !== null && level >= sendLevel;
  if (sent) {
    return (
      <div className="mt-4 rounded border border-emerald-300 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">
          Recorded: you approved sending this. FairSlip did not contact your employer.
        </p>
        <p className="mt-1 text-xs text-emerald-900">{sent.note}</p>
        <p className="mt-1 font-mono text-[11px] text-emerald-800">
          {sent.state} at <time dateTime={sent.tap_at}>{localTime(sent.tap_at)}</time> -
          tapped on {sent.tap_surface}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded border border-zinc-300 bg-zinc-50 px-4 py-3">
      <p className="text-sm text-zinc-800">
        Nothing has been sent. FairSlip cannot record this as sent without your tap.
      </p>
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        className="mt-2 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy
          ? "Recording..."
          : permitted
            ? "I approve - I will send this myself"
            : `I approve - I will send this myself${
                sendLevel !== null ? ` (needs level ${sendLevel}; you are at ${level})` : ""
              }`}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ the timeline */

function Timeline({ reached, sent }: { reached: Record<string, boolean>; sent: SentOut | null }) {
  return (
    <ol className="mt-4 space-y-2">
      {TIMELINE.map((step) => {
        const done = reached[step.key];
        return (
          <li key={step.key} className="flex gap-3">
            <span
              aria-hidden
              className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                done ? "border-emerald-600 bg-emerald-600" : "border-zinc-300 bg-white"
              }`}
            />
            <div>
              <p
                className={`text-sm font-medium ${done ? "text-zinc-900" : "text-zinc-400"}`}
              >
                {step.label}
                {!done && <span className="ml-2 text-xs font-normal">not yet reached</span>}
                {done && step.key === "SENT" && sent && (
                  <span className="ml-2 font-mono text-xs font-normal">
                    <time dateTime={sent.tap_at} title={sent.tap_at}>
                      {localTime(sent.tap_at)}
                    </time>
                  </span>
                )}
              </p>
              <p className={`text-xs ${done ? "text-zinc-600" : "text-zinc-400"}`}>
                {step.key === "MESSAGE_DRAFTED" && reached.SENT
                  ? "A message was written, and you approved it below."
                  : step.hint}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------- the escalation */

/**
 * Assembled, never filed. The pack's own `filing_steps` say FairSlip does not
 * file; this component adds no claim of its own.
 *
 * `not_built` is rendered as prominently as the built half. A pack that showed
 * only what exists would read as complete, and the missing half here is CPF
 * Board's report form - which could not be read, so its fields are unknown.
 */
function EscalationPack({ pack }: { pack: EscalationOut }) {
  return (
    <div className="mt-6 rounded border border-zinc-300">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2">
        <h3 className="text-sm font-semibold text-zinc-900">{pack.heading}</h3>
        <p className="mt-0.5 text-xs text-zinc-600">
          FairSlip has assembled a checklist. You file; FairSlip does not.
        </p>
      </div>

      <div className="px-4 py-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          What TADM asks you to bring
        </h4>
        <ul className="mt-2 space-y-2">
          {pack.evidence.map((e) => (
            <li key={e.quoted} className="text-sm text-zinc-900">
              <span className="block">&ldquo;{e.quoted}&rdquo;</span>
              <span className="block text-xs text-zinc-600">{e.note}</span>
              <a
                href={e.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-zinc-500 underline underline-offset-2"
              >
                {e.source_label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-zinc-200 px-4 py-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Time limits for filing
        </h4>
        <ul className="mt-2 space-y-1">
          {pack.deadlines.map((d) => (
            <li key={d.label} className="text-sm text-zinc-900">
              <span className="font-medium">{d.label}: </span>
              <span>&ldquo;{d.quoted}&rdquo;</span>
              {/* These are MOM's words under a heading about TADM. A quote
                  attributed by the nearest heading is attributed to the wrong
                  body, so each names its own page. */}
              <a
                href={d.source_url}
                target="_blank"
                rel="noreferrer"
                className="ml-1 text-[11px] text-zinc-500 underline underline-offset-2"
              >
                {d.source_label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-zinc-200 px-4 py-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          How filing works
        </h4>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
            {pack.filing_steps.map((s) => (
              <li key={s} className="text-sm text-zinc-800">
                {s}
              </li>
            ))}
        </ol>
      </div>

      {pack.not_built.map((n) => (
        <div key={n.what} className="border-t border-zinc-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Not built: {n.what}</p>
          <p className="mt-1 text-xs text-amber-900">{n.why}</p>
          {n.what_is_known.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-amber-900">
                What CPF Board does say:
              </p>
              {/* The quote and FairSlip's reading are rendered apart, and the
                  reading is labelled. They were one string under this heading,
                  so FairSlip's inference inherited CPF Board's attribution -
                  the mirror of the defect Deadline's docstring names. */}
              <ul className="mt-1 space-y-2">
                {n.what_is_known.map((k) => (
                  <li key={k.quoted} className="text-xs text-amber-900">
                    <span className="block">&ldquo;{k.quoted}&rdquo;</span>
                    {k.note && (
                      <span className="mt-0.5 block text-amber-800">
                        <span className="font-semibold">FairSlip&rsquo;s words, not CPF Board&rsquo;s: </span>
                        {k.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {n.source_url && (
                <a
                  href={n.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[11px] text-amber-900 underline underline-offset-2"
                >
                  {n.source_label}
                </a>
              )}
            </>
          )}
        </div>
      ))}

      <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-600">
        {pack.disclaimer}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- the CPF */

/**
 * The compounding: unpaid overtime is CPF-liable wage, so a pay shortfall is
 * also a CPF shortfall.
 *
 * Every line is a SplitLine the backend computed with shortfall_split(). The
 * two figures must NEVER be added on screen - $62.24 and $23.00 overlap by the
 * $12.00 of CPF she would have paid on the missing overtime, so their sum
 * double-counts it. The only combined figure that exists is total_withheld,
 * and the backend is the thing that produced it.
 */
function CpfShortfall({
  cpf,
  basis,
  persona,
}: {
  cpf: CpfPack;
  basis: string;
  persona: AgentPersona;
}) {
  return (
    <div className="mt-6 rounded border-2 border-dashed border-zinc-400 bg-zinc-50/60">
      <div className="border-b border-zinc-300 px-4 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Fictional worked example - not your figures
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-zinc-900">
          When a pay difference also reaches CPF
        </h3>
        <p className="mt-0.5 text-xs text-zinc-600">
          Based on CPF Board&rsquo;s published rule that CPF contributions are payable on
          overtime pay. A difference in wage can therefore be a difference in CPF as well. Below
          is one month for {persona.name}, an invented {persona.residency_label.toLowerCase()}.
        </p>
      </div>
      {/* The note explains the total, so it is placed BEFORE the lines it
          explains: it says "the total below", and rendering it underneath left
          that pointing at the caveat instead. */}
      <p className="border-b border-zinc-300 px-4 py-2 text-xs text-zinc-600">{cpf.split_note}</p>
      <dl className="px-4 py-3">
        {cpf.split.map((line) => (
          <div
            key={line.key}
            className={`flex justify-between gap-4 py-0.5 ${
              line.sub ? "pl-4 text-xs text-zinc-600" : "text-sm text-zinc-900"
            } ${line.key === "total_withheld" ? "mt-1 border-t border-zinc-300 pt-2 font-semibold" : ""}`}
          >
            <dt>{line.label}</dt>
            <dd className="font-mono">{money(line.amount)}</dd>
          </div>
        ))}
      </dl>
      {/* Two figures on this card describe money she did not receive. Both are
          true and they differ by the employee CPF; the derivation is shown
          rather than left for a reader to reconstruct. */}
      <p className="border-t border-zinc-300 bg-white/70 px-4 py-2 text-xs text-zinc-700">
        {cpf.split_bridge}
      </p>
      <p className="border-t border-zinc-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        {basis}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- the verdict */

const VERDICT_COPY: Record<
  VerifyOut["verdict"],
  { title: string; body: string; tone: string }
> = {
  CORRECTED: {
    title: "The month-1 difference closes.",
    body: "The arithmetic below closes to within one cent. That is the month-1 pay difference only - FairSlip did not check CPF in this comparison.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  PARTIALLY_CORRECTED: {
    title: "The difference narrowed. It did not close.",
    body: "Payslip 2 paid more than payslip 2 alone required. FairSlip cannot say the extra was for month 1. A gap still stands, and it is shown below.",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
  },
  NOT_CORRECTED: {
    title: "The difference did not narrow.",
    body: "Payslip 2 does not reduce the month-1 difference. FairSlip is not saying why, and not saying anyone did anything wrong.",
    tone: "border-orange-300 bg-orange-50 text-orange-900",
  },
  UNVERIFIABLE: {
    title: "FairSlip cannot say.",
    body: "FairSlip did not get a usable payslip 2, so it made no comparison. This is not a finding about your employer - it is a statement about what FairSlip could establish. What blocked it is below.",
    tone: "border-zinc-300 bg-zinc-100 text-zinc-800",
  },
};

function VerifySection({
  demo,
  verdict,
  onVerify,
  busy,
}: {
  demo: DemoInputs | null;
  verdict: VerifyOut | null;
  onVerify: (w: "month2_corrected" | "month2_uncorrected" | "month2_blocked") => void;
  busy: boolean;
}) {
  const personaName = demo?.selected.name ?? "the invented worker";
  return (
    <div className="mt-6 border-t border-zinc-200 pt-5">
      <h3 className="text-sm font-semibold text-zinc-900">Next month</h3>
      <p className="mt-1 text-sm text-zinc-600">
        A real payslip 2 would go through the same two readers and the same engines. Both
        months here are {personaName}&rsquo;s invented figures - not yours - so no reader
        ran. The verdict is arithmetic; no model takes part in it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Action label="Payslip 2 with an extra payment" onClick={() => onVerify("month2_corrected")} busy={busy} disabled={!demo} />
        <Action label="Payslip 2 with the same shortfall" onClick={() => onVerify("month2_uncorrected")} busy={busy} disabled={!demo} />
        <Action label="Payslip 2 the readers could not agree on" onClick={() => onVerify("month2_blocked")} busy={busy} disabled={!demo} />
      </div>

      {verdict && <VerdictCard v={verdict} personaName={personaName} />}
    </div>
  );
}

function VerdictCard({ v, personaName }: { v: VerifyOut; personaName: string }) {
  const copy = VERDICT_COPY[v.verdict];
  return (
    // Dashed, like every other fixture card. "Month 2 reached the bank" sits
    // inches below the viewer's own "Reached the bank" on the same page: same
    // words, two different people's money. The draft and the CPF cards got this
    // treatment and this one, their sibling, did not.
    <div className={`mt-4 rounded border-2 border-dashed px-4 py-3 ${copy.tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
        Fictional worked example - {personaName}&rsquo;s months, not yours
      </p>
      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{copy.title}</p>
        <span className="rounded bg-white/70 px-2 py-0.5 font-mono text-[11px]">{v.verdict}</span>
      </div>
      <p className="mt-1 text-xs">{copy.body}</p>

      {v.verdict === "UNVERIFIABLE" ? (
        <div className="mt-3 rounded bg-white/70 px-3 py-2">
          <p className="text-xs font-semibold">What was not established:</p>
          <ul className="mt-1 space-y-1">
            {v.blocked_by.map((b) => (
              <li key={b.name} className="font-mono text-[11px]">
                {b.name || "(unnamed field)"} - {b.status} - {b.detail}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            {personaName}&rsquo;s month-1 difference of {money(v.month1_difference)} is
            unchanged by this: it was established for that invented month, and nothing here
            revises it.
          </p>
        </div>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-1 rounded bg-white/70 px-3 py-2 sm:grid-cols-2">
          <Row label="Month-1 difference" value={money(v.month1_difference)} />
          {v.month2_expected_net && (
            <Row label="Month 2 should have paid" value={money(v.month2_expected_net)} />
          )}
          {v.month2_net_paid && (
            <Row label="Month 2 reached their bank" value={money(v.month2_net_paid)} />
          )}
          {v.adjustment_found && (
            <Row label="Adjustment found on payslip 2" value={money(v.adjustment_found)} />
          )}
          {v.remaining_gap && <Row label="Remaining gap" value={money(v.remaining_gap)} strong />}
        </dl>
      )}

      <p className="mt-2 font-mono text-[11px] opacity-80">{v.arithmetic}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <dt>{label}</dt>
      <dd className={`font-mono ${strong ? "font-bold" : ""}`}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------- refusal, UI */

function AgentRefusal({
  refusal,
  onRaise,
}: {
  refusal: Refusal;
  onRaise: (l: number) => void;
}) {
  const mandateRefusal = refusal.error === "MANDATE_EXCEEDED";
  return (
    <div className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900">
        {mandateRefusal
          ? "That is outside the mandate you granted."
          : refusal.error === "ACTION_NOT_BUILT"
            ? "FairSlip has not built that yet."
            : "FairSlip declined, and said why."}
      </p>
      <p className="mt-1 rounded bg-white/60 px-3 py-2 font-mono text-xs text-amber-900">
        {refusal.detail}
      </p>
      {mandateRefusal && refusal.required_level != null && (
        <button
          type="button"
          onClick={() => onRaise(refusal.required_level as number)}
          className="mt-2 rounded border border-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-900"
        >
          Raise to level {refusal.required_level} - your choice, nothing changes until you do
        </button>
      )}
      {refusal.error === "ACTION_NOT_BUILT" && (
        <p className="mt-2 text-xs text-amber-900">
          This is not disabled by your mandate. Raising your mandate level will not enable it.
        </p>
      )}
    </div>
  );
}

function Action({
  label,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="rounded border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-700 disabled:opacity-50"
    >
      {busy ? "Working..." : label}
    </button>
  );
}
