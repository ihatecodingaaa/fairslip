"use client";

/**
 * The worker's screen, as a progression rather than a document.
 *
 * FOUR STATES, AND THEY ARE THE STATE THE PAGE IS ACTUALLY IN. `collect`,
 * `reading`, `reconciled` and a computed breakdown are values this component
 * already held; the stage indicator reads them rather than inventing a workflow
 * on top of them. Nothing here can say a stage is reached that is not.
 *
 * WHAT PROGRESSING DOES NOT DO. It does not hide what came before. Once the
 * engine has run, the answer and its trail move to the top and the evidence
 * moves BELOW them, in full - the readings, the reader comparison, every worker
 * answer. Three reasons, and the first is the important one:
 *
 *   1. The sheet a worker prints is this DOM, narrowed. A collapsed <details>
 *      prints as its summary, so folding the readings away would take them off
 *      the paper - and the paper is the artefact that reaches the person who can
 *      act. Every claim about the print sheet in ui/PrintSheet.tsx depends on the
 *      evidence still being here.
 *   2. The reconciliation is only worth anything beside what it was built from.
 *   3. A worker who wants to change an answer has to be able to find it.
 *
 * This file computes no money. It assembles Facts, posts them, and renders what
 * the engines sent back.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE,
  fileToImageIn,
  postCompute,
  postExtract,
  type DocumentRole,
  type ExtractOut,
  type ImageIn,
  type PayBreakdown,
  type PayInputs,
  type Refusal,
} from "@/lib/api";
import { AppShell } from "../ui/AppShell";
import { EngineMark } from "../ui/EngineMark";
import { Footer } from "../ui/Footer";
import { T, useT } from "../ui/Prefs";
import { PrintMasthead } from "../ui/PrintSheet";
import { AgentPanel } from "./AgentPanel";
import { DOCUMENTS, EvidenceStage, EvidenceStrip } from "./EvidenceStage";
import { EstablishStage } from "./EstablishStage";
import { ReconcileStage } from "./ReconcileStage";
import { ReaderStrip } from "./ReaderStrip";
import { payInputsFrom, restDayVerdict, unresolvedFields } from "./facts";
import type { Key } from "@/lib/i18n";

type Phase = "collect" | "reading" | "reconciled";

/** The four stages, and the state each is entered by. `reached` is derived from
 * what actually happened - never assumed from the stage before it. */
const STAGES: { key: Key; id: string }[] = [
  { key: "stage.evidence", id: "stage-evidence" },
  { key: "stage.establish", id: "stage-establish" },
  { key: "stage.reconcile", id: "stage-reconcile" },
  { key: "stage.act", id: "stage-act" },
];

export default function CheckPage() {
  const t = useT();
  const [files, setFiles] = useState<Partial<Record<DocumentRole, File>>>({});
  const [phase, setPhase] = useState<Phase>("collect");
  const [extract, setExtract] = useState<ExtractOut | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [breakdown, setBreakdown] = useState<PayBreakdown | null>(null);
  // The exact facts that produced `breakdown`. Recomputing them from live state
  // let an answer edited AFTER computing become the trail's fact layer - a
  // different month from the one rendered above it.
  const [computedFrom, setComputedFrom] = useState<PayInputs | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // WHEN the engine ran, for the sheet a worker prints and carries somewhere.
  // Recorded on the response, not on the click: a click that was refused
  // produced no figures, and a timestamp above no figures dates nothing.
  const [computedAt, setComputedAt] = useState<string | null>(null);
  // Two failures, two states. They were one, so a /compute failure rendered
  // "The readers could not be reached" - while the readings it was contradicting
  // sat on screen directly above. See docs/debt.md, ui-invents-a-cause.
  const [readError, setReadError] = useState<string | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  // Whether the picker is open again after a reading. The evidence STAGE is
  // replaced by a strip once the readers have answered; this is how a worker
  // gets back to it.
  const [reopened, setReopened] = useState(false);
  // WCAG 4.1.3. Both of the long operations on this screen finish somewhere
  // other than where the reader is looking, and a sighted reader gets a page
  // that visibly grew. `announce` is what a screen reader gets instead.
  const [announce, setAnnounce] = useState("");
  const establishRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  const chosen = DOCUMENTS.filter((d) => files[d.role]);
  const documents = chosen.map((d) => ({ role: d.role, name: files[d.role]!.name }));

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
      setComputedFrom(null);
      setComputedAt(null);
      setReopened(false);
      setPhase("reconciled");
      setAnnounce(t("a11y.readersLanded"));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e));
      setPhase("collect");
    }
  }

  const unresolved = useMemo(() => unresolvedFields(extract, answers), [extract, answers]);

  /* AN ANSWER EDITED AFTER THE ENGINE RAN.
   *
   * The answers stay live once the figures are on screen - that is deliberate,
   * and it is why `computedFrom` exists: the trail is drawn from the facts that
   * actually produced the breakdown, so an edit cannot silently become the
   * lineage of a figure it never touched.
   *
   * That freezes the trail. It does not stop the SCREEN from contradicting
   * itself. Type 1120.00 into "what actually reached your bank" after computing
   * and the arithmetic above still reads "reached the bank $1,400.00", with
   * nothing on the page saying which of the two the reader is looking at. That
   * is a month the system did not establish, presented as one it did.
   *
   * So the drift is detected against the frozen inputs, said where the figures
   * are, and given the way back: the compute gate returns.
   *
   * It compares PayInputs, not `answers`, and that is the correct boundary. The
   * CPF-only answers - date of birth, residency - are collected on this screen
   * but are not part of what /compute was sent, so editing one changes no figure
   * on the page and must not raise a warning about figures that did not move. */
  const edited = useMemo(() => {
    if (!extract || !computedFrom) return false;
    return JSON.stringify(payInputsFrom(extract, answers)) !== JSON.stringify(computedFrom);
  }, [extract, answers, computedFrom]);

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
    if (phase === "reconciled" && !breakdown) establishRef.current?.focus();
  }, [phase, breakdown]);

  useEffect(() => {
    if (breakdown) resultRef.current?.focus();
  }, [breakdown]);

  // Evidence is reached by being on this screen: it is where the worker already
  // is, and marking it "not yet" while they stand in it would be the indicator
  // describing something other than the page.
  const stageReached = [true, extract !== null, breakdown !== null, breakdown !== null];
  const collecting = phase !== "reconciled" || reopened;

  return (
    <AppShell>
      {/* Present in the DOM BEFORE anything is injected into it. A live region
          created at the same moment as its content is not announced - the
          assistive technology has nothing to observe changing. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>

      <PrintMasthead computedAt={computedAt} />

      {/* print-hide: the masthead above IS this heading on paper - same
          dictionary key, one line up - and a document that opens with its title
          twice reads as two documents stapled together. */}
      {/* THE PREAMBLE IS FOR THE STAGE THAT NEEDS IT.
          "Two readers transcribe your documents independently..." tells a worker
          what is about to happen; once it HAS happened, it is a paragraph
          between them and their answer. With the engine mark, the title and the
          stage bar it put 430px above the figure this page exists to show - so
          the two lines that describe the process retire when the process is
          done, and the stage bar carries the navigation on alone. */}
      <header className="print-hide">
        <h1 className="text-page font-semibold tracking-tight">
          <T k="check.title" />
        </h1>
        {!breakdown && (
          <>
            <p className="max-w-measure mt-2 text-lead text-ink-2">
              <T k="check.intro" />
            </p>
            <EngineMark className="mt-4" />
          </>
        )}
        <StageBar reached={stageReached} current={breakdown ? 2 : extract ? 1 : 0} />
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

      {/* ---------------------------------------------------------- the answer */}
      {breakdown && computedFrom && extract && (
        <section id="stage-reconcile" className="mt-10">
          <ReconcileStage
            breakdown={breakdown}
            inputs={computedFrom}
            extract={extract}
            documents={documents}
            headingRef={resultRef}
            stale={edited}
          />
        </section>
      )}

      {/* ------------------------------------------------------- the evidence */}
      <section id="stage-evidence" className="mt-12">
        {breakdown && (
          <h2 className="text-title font-semibold">
            <T k="establish.heading" />
          </h2>
        )}
        <div className={breakdown ? "mt-6" : ""}>
          {/* Hidden from print without a standing note: a file picker is a
              control, not a figure, and its result - which documents were read,
              and what each reader made of them - is on the sheet directly below. */}
          {collecting ? (
            <div className="print-hide">
              <EvidenceStage
                files={files}
                onPick={(role, file) => {
                  setFiles((f) => ({ ...f, [role]: file }));
                  setReopened(true);
                }}
                onRead={read}
                reading={phase === "reading"}
                canRead={chosen.some((d) => d.required)}
              />
            </div>
          ) : (
            <EvidenceStrip files={files} onReopen={() => setReopened(true)} />
          )}
        </div>

        {extract && phase === "reconciled" && (
          <div id="stage-establish" className="mt-8 grid gap-8">
            <ReaderStrip extract={extract} headingRef={establishRef} />
            <EstablishStage
              fields={extract.read_fields}
              readers={extract.readers}
              workerFields={extract.worker_fields}
              cpfOnly={extract.cpf_only_fields}
              agreed={extract.agreed_count}
              total={extract.read_field_count}
              answers={answers}
              restDay={restDayVerdict(extract, answers)}
              onAnswer={(name, value) => setAnswers((a) => ({ ...a, [name]: value }))}
            />
            {(!breakdown || edited) && (
              <div className="print-hide">
                <ComputeGate unresolved={unresolved} onCompute={compute} stale={edited} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------- what next */}
      {breakdown && (
        <section id="stage-act" className="mt-12">
          <AgentPanel />
        </section>
      )}

      <Footer />
    </AppShell>
  );
}

/* ------------------------------------------------------------- the stage bar */

/**
 * Where the worker is, derived and subtle.
 *
 * NOT A WIZARD. Four equal boxes with ticks would promise a linear flow the
 * product does not have - the evidence stays live and editable after the engine
 * has run, and the fourth stage is a choice the worker may decline entirely. So
 * this is a line of anchors: it says where you are, it lets you get back to
 * anything already reached, and it says of the rest only that they are not yet.
 *
 * The links are in-page anchors, so they work with the keyboard, with a screen
 * reader, and before hydration.
 */
function StageBar({ reached, current }: { reached: boolean[]; current: number }) {
  const t = useT();
  return (
    <nav aria-label={t("stage.progress")} className="print-hide mt-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {STAGES.map((s, i) => {
          const done = reached[i];
          const here = i === current;
          return (
            <li key={s.id} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-ink-3">
                  &rarr;
                </span>
              )}
              {done ? (
                <a
                  href={`#${s.id}`}
                  aria-current={here ? "step" : undefined}
                  className={`tap-sm inline-flex items-center rounded-sm border px-3 py-2 text-meta font-semibold ${
                    here
                      ? "border-ink bg-muted text-ink"
                      : "border-line-strong bg-surface text-ink-2 hover:border-ink"
                  }`}
                >
                  <T k={s.key} />
                  <span className="sr-only">, {t("stage.reached")}</span>
                </a>
              ) : (
                <span className="inline-flex items-center rounded-sm border border-dashed border-line-strong px-3 py-2 text-meta text-ink-3">
                  <T k={s.key} />
                  <span className="sr-only">, {t("stage.notReached")}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------ compute gate */

function ComputeGate({
  unresolved,
  onCompute,
  stale = false,
}: {
  unresolved: { name: string; label: string; group: "read" | "worker" }[];
  onCompute: () => void;
  /** The figures on screen were worked out from an answer that has since been
   * edited. The gate is here a second time because of it, so it says so. */
  stale?: boolean;
}) {
  const t = useT();
  const blocked = unresolved.length > 0;
  return (
    <section
      className={`rounded-lg border bg-surface p-5 shadow-card ${
        stale ? "border-attention-line" : "border-line-strong"
      }`}
    >
      {stale && (
        <p className="max-w-measure mb-3 text-body font-semibold text-attention-fg">
          <T k="gate.stale" />
        </p>
      )}
      <button
        type="button"
        onClick={onCompute}
        disabled={blocked}
        className="tap rounded-sm bg-brand px-5 py-3 text-lead font-semibold text-on-solid disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
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

/* --------------------------------------------------------------- fragments */

function Banner({
  tone,
  title,
  children,
}: {
  tone: "red" | "amber";
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "red"
      ? "border-danger-line bg-danger-bg text-danger-fg"
      : "border-attention-line bg-attention-bg text-attention-fg";
  return (
    <section className={`mt-6 rounded-sm border p-4 text-body ${cls}`}>
      <p className="font-semibold">{title}</p>
      {children}
    </section>
  );
}

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
  DRAFT_REJECTED:
    "A message was written and then refused, because it broke FairSlip’s own copy rules.",
  COVERAGE_UNESTABLISHED: "Something the coverage page states could no longer be established.",
  COVERAGE_COPY: "The coverage page was refused by FairSlip’s own copy rules.",
};

function RefusalBanner({ refusal }: { refusal: Refusal }) {
  const title = REFUSAL_TITLES[refusal.error] ?? "FairSlip declined, and said why below.";
  return (
    <Banner tone="amber" title={title}>
      <p className="mt-1 rounded-sm bg-surface px-3 py-2 font-mono text-meta">{refusal.detail}</p>
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
