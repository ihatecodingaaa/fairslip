"use client";

/**
 * The inspector: what the selected thing is, and what it rests on.
 *
 * IT IS STRUCTURED PROVENANCE, NOT AN EXPLANATION. Nothing in this panel is
 * generated, summarised or phrased by a model. A component shows the formula the
 * engine recorded and the facts the engine recorded consuming; a fact shows its
 * status, its source string and what each reader actually said; a reader shows
 * which model answered and whether the reading was replayed from the committed
 * cache. That is the argument for FairSlip not needing a chatbot to explain its
 * own numbers, and it only holds while every line here is a field.
 *
 * RELATIONSHIPS ARE CONTROLS, NOT PROSE. "Built from" and "Used by" are buttons
 * that move the selection, so the graph is traversable by keyboard without the
 * edges ever having to be spoken. They are also the text equivalent the SVG does
 * not provide: every edge on screen is reachable in words from one end or the
 * other.
 *
 * PROGRESSIVE DISCLOSURE MEANS PER KIND, NOT PER FIELD. Each kind of node shows
 * the whole of what it is - six fields, not thirty - because a panel that hides
 * half of a fact behind a second tap is a panel that has decided which half
 * matters.
 */

import { money, type PayBreakdown, type Refusal, type ImpactOut } from "@/lib/api";
import { T, useT } from "../ui/Prefs";
import { StatusChip } from "../ui/StatusChip";
import { ImpactRefusal, ImpactResult, WhatIfForm, isVariable } from "./ImpactRadius";
import { LAYERS, factValueText, type Proof, type ProofNode } from "./proof";
import { SOURCE_LABEL_KEY, answeredKey, requestLatencyMs } from "./readerSource";
import type { Key } from "@/lib/i18n";

export type Hypothetical = {
  /** The PayInputs field being varied. One at a time: the endpoint compares one
   * before/after pair, and this form changes exactly one fact. */
  field: string;
  busy: boolean;
  result: ImpactOut | null;
  refusal: Refusal | null;
  /** A transport failure, which is neither a result nor a refusal. */
  error: string | null;
} | null;

export function EvidenceLens({
  proof,
  selected,
  breakdown,
  hypothetical,
  onSelect,
  onRun,
  onEdit,
  onClear,
}: {
  proof: Proof;
  selected: string | null;
  breakdown: PayBreakdown;
  hypothetical: Hypothetical;
  onSelect: (id: string) => void;
  onRun: (field: string, value: string) => void;
  onEdit: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const node = selected ? proof.byId[selected] : null;

  /* The changed-field record for THIS node, when a hypothetical is standing on
   * it. Read off the backend's own `changed_fields`, so the before and after
   * shown here are the two values the engine actually compared. */
  const varied =
    node?.fact && hypothetical?.result
      ? (hypothetical.result.changed_fields.find((c) => c.name === node.fact!.name) ?? null)
      : null;

  return (
    <section
      aria-labelledby="lens-heading"
      className="rounded-lg border border-line-strong bg-surface p-5 shadow-card"
    >
      <h2 id="lens-heading" className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="lens.heading" />
      </h2>

      {!node && <TrailSummary proof={proof} />}

      {node && (
        <>
          <p className="mt-3 text-meta font-semibold uppercase tracking-wide text-ink-3">
            {t(LAYERS[node.layer].label)}
          </p>
          <h3 className="mt-1 text-lead font-semibold text-ink">
            {node.titleKey ? <T k={node.titleKey} /> : node.title}
          </h3>
          {node.value && (
            <p
              className={`mt-1 font-mono tabular-nums text-ink ${
                node.kind === "difference" ? "text-title font-semibold" : "text-lead"
              }`}
            >
              {node.value}
            </p>
          )}
          {/* THE FACT BEING VARIED SHOWS ITS OWN BEFORE AND AFTER, HERE.
              It did not, and that was the worst gap in the interaction: the
              reader typed 13, the trail below marked three amounts as
              hypothetical, and the one panel they were looking at went on
              displaying 18 as though nothing had been asked. */}
          {varied && (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-attention-fg">
              <span className="text-meta font-semibold">
                <T k="trail.ifChanged" />
              </span>
              <span className="font-mono text-lead tabular-nums">
                &rarr; {varied.after_value}
              </span>
            </p>
          )}
          {node.status && (
            <p className="mt-2">
              <StatusChip status={node.status} />
            </p>
          )}

          {/* THE ACTION COMES BEFORE THE PROVENANCE, for a fact.
              "What is this, what is it worth, what could it be" is the order a
              person asks in; the reader transcripts and the engine's own source
              sentence answer "how do you know", which is the next question and
              not the first. It was below both, which put the product's signature
              interaction under a scroll. */}
          {node.fact && isVariable(node.fact.fact) && (
            <>
              <WhatIfForm
                key={node.fact.name}
                fact={node.fact.fact}
                busy={hypothetical?.busy ?? false}
                onRun={(value) => onRun(node.fact!.name, value)}
                onEdit={onEdit}
              />
              {hypothetical?.field === node.fact.name && (
                <>
                  {hypothetical.error && (
                    <p className="mt-3 rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-body text-danger-fg">
                      The re-run did not complete: {hypothetical.error}. No figure was produced
                      for the change, and the figures on this page are the ones from before.
                      FairSlip cannot tell from here whether the engine was reached.
                    </p>
                  )}
                  {hypothetical.refusal && <ImpactRefusal refusal={hypothetical.refusal} />}
                  {hypothetical.result && (
                    <>
                      <ImpactResult r={hypothetical.result} />
                      <button
                        type="button"
                        onClick={onClear}
                        className="tap-sm mt-3 w-full rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink"
                      >
                        <T k="lens.clearHypothetical" />
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {node.document && <DocumentBody node={node} />}
          {node.reader && <ReaderBody node={node} />}
          {node.id === "source:you" && <YouBody />}
          {node.fact && <FactBody node={node} proof={proof} />}
          {node.component && <ComponentBody node={node} />}
          {node.kind === "difference" && <DifferenceBody breakdown={breakdown} />}

          <Related
            titleKey="lens.builtFrom"
            ids={node.from}
            proof={proof}
            onSelect={onSelect}
          />
          <Related
            titleKey="lens.usedBy"
            ids={proof.usedBy[node.id] ?? []}
            proof={proof}
            onSelect={onSelect}
          />

          {node.fact && <FactSource source={node.fact.fact.source} />}
        </>
      )}
    </section>
  );
}

/**
 * What the panel says before anything is chosen.
 *
 * NOT AN EMPTY STATE. "Nothing chosen yet" occupied the most valuable column on
 * the screen and told the reader nothing they could not see. What a reader
 * actually needs first is what the trail beside them IS: how many documents went
 * in, how much of the month the two readers settled between them, and how much
 * the worker settled - which is the product's whole argument, in four numbers.
 *
 * Every figure here is a COUNT OF NODES, walked from the same model the graph
 * draws. Nothing is money and nothing is asserted; if the trail changes shape,
 * these change with it.
 */
function TrailSummary({ proof }: { proof: Proof }) {
  const facts = proof.nodes.filter((n) => n.kind === "fact");
  const rows: { key: Key; n: number }[] = [
    { key: "trail.layer.documents", n: proof.nodes.filter((n) => n.kind === "document").length },
    { key: "status.AGREED", n: facts.filter((n) => n.status === "AGREED").length },
    { key: "status.HUMAN_CONFIRMED", n: facts.filter((n) => n.status === "HUMAN_CONFIRMED").length },
    { key: "trail.layer.rules", n: proof.nodes.filter((n) => n.kind === "component").length },
  ];
  return (
    <div className="mt-3">
      <dl className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-body text-ink-2">
              <T k={r.key} />
            </dt>
            <dd className="text-title font-semibold tabular-nums text-ink">{r.n}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-measure mt-3 text-meta text-ink-3">
        <T k="trail.selectPrompt" />
      </p>
    </div>
  );
}

function DocumentBody({ node }: { node: ProofNode }) {
  return (
    <dl className="mt-4 space-y-2">
      <Field label={<T k="lens.source" />}>
        <span className="font-mono">{node.document!.role}</span>
      </Field>
      <Field label={<T k="lens.role.payslip" />}>
        <span>
          {/* Both readers were given every image in the request, concurrently, so
              neither could see the other's answer even by accident of ordering. */}
          <T k="check.readersNote" />
        </span>
      </Field>
    </dl>
  );
}

function ReaderBody({ node }: { node: ProofNode }) {
  const t = useT();
  const r = node.reader!;
  return (
    <dl className="mt-4 space-y-2">
      <Field label="Model">
        <span className="font-mono">{r.model}</span>
      </Field>
      {/* Said only where a MODEL either answered or did not. A replayed reading
          is `ok` and has values, so an `ok`-driven chip printed "answered" for a
          reading the model never gave - see readerSource.ts, answeredKey. */}
      {answeredKey(r) && (
        <Field label={<T k="lens.status" />}>
          <span>{t(answeredKey(r)!)}</span>
        </Field>
      )}
      {/* The wording comes from readerSource.ts, which the reader strip also
          uses. Two components deciding separately what "live" means is how one
          of them comes to say it about a replay. */}
      <Field label="Path">
        <span>{t(SOURCE_LABEL_KEY[r.source])}</span>
      </Field>
      {/* A time is only shown for a call that happened, because only then does
          it describe THIS request. The entry's own generation latency has its
          own name and never reaches a screen. See docs/debt.md,
          cached-path-wearing-a-live-timing. */}
      {requestLatencyMs(r) !== null && (
        <Field label="Took">
          <span className="font-mono">{requestLatencyMs(r)} ms</span>
        </Field>
      )}
      {r.error && (
        <Field label="Error">
          <span className="text-danger-fg">{r.error}</span>
        </Field>
      )}
      {/* A fallback reading HAS values and is `ok`. Without this line nothing on
          this panel would say the model was asked and did not answer. */}
      {r.source === "FALLBACK_CACHE" && r.live_error && (
        <Field label="Live call">
          <span className="text-attention-fg">{r.live_error}</span>
        </Field>
      )}
    </dl>
  );
}

function YouBody() {
  return (
    <p className="max-w-measure mt-4 text-body text-ink-2">
      <T k="group.workerBlurb" />
    </p>
  );
}

/**
 * What each reader said, and what that made the field.
 *
 * THE RAW PROVENANCE STRING IS NOT HERE. It used to be the FIRST thing under the
 * value - "both readers agree: Claude (claude-haiku-4-5) 18, OpenAI
 * (gpt-5.6-luna) 18" - immediately above a table that says the same thing in
 * columns. One of the two was the machine's phrasing of the other, and it was
 * winning the position. It now renders last, in <FactSource />, where a reader
 * who wants the engine's own words can find them.
 */
function FactBody({ node, proof }: { node: ProofNode; proof: Proof }) {
  const t = useT();
  const f = node.fact!;
  const readings = f.readings;
  return (
    <>
      {readings && (
        <div className="mt-4">
          <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            <T k="lens.readerSaid" />
          </p>
          <ul className="mt-2 space-y-1">
            {Object.entries(readings).map(([key, said]) => {
              const reader = proof.byId[`source:${key}`]?.reader;
              return (
                <li key={key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-meta text-ink-2">{reader?.provider ?? key}</span>
                  <span className="font-mono text-body tabular-nums text-ink">
                    {said ?? <span className="text-meta text-ink-3">{t("lens.notRead")}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {/* The value the engine used, and where it came from, are two facts. A
              field the worker settled rests on their answer even where a reader
              said something about it - which is why the trail draws no reader
              edge into it, and why both readings are still shown here. */}
          {f.fact.status === "HUMAN_CONFIRMED" && (
            <p className="max-w-measure mt-2 text-meta text-ink-2">
              <T k="establish.youAnswered" />
            </p>
          )}
          {f.fact.status === "AGREED" && (
            <p className="max-w-measure mt-2 text-meta text-ink-2">
              <T k="establish.bothAnswered" />
            </p>
          )}
        </div>
      )}

      {f.fact.status === "DISAGREED" && (
        <p className="max-w-measure mt-3 rounded-sm border border-attention-line bg-attention-bg px-3 py-2 text-meta text-attention-fg">
          <T k="establish.disagreed" />
        </p>
      )}
    </>
  );
}

/**
 * The engine's own sentence about where this value came from.
 *
 * Kept, because it is the record and a reader chasing a figure to its origin
 * should be able to see exactly what the reconciler wrote. Demoted, because it
 * is written for the log and not for a person: it names model identifiers and
 * repeats in prose what the panel above lays out in structure.
 */
function FactSource({ source }: { source: string }) {
  if (!source.trim()) return null;
  return (
    <p className="mt-4 break-words border-t border-line pt-3 font-mono text-meta text-ink-3">
      {source}
    </p>
  );
}

function ComponentBody({ node }: { node: ProofNode }) {
  const c = node.component!;
  return (
    <>
      <div className="mt-4">
        <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          <T k="lens.formula" />
        </p>
        <p className="mt-1 break-words rounded-sm bg-muted px-3 py-2 font-mono text-meta text-ink-2">
          {c.formula}
        </p>
      </div>
      <div className="mt-3">
        <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          <T k="lens.source" />
        </p>
        <ul className="mt-1 space-y-1">
          {c.inputs.map((src) => (
            <li key={src} className="break-words text-meta text-ink-3">
              &larr; {src}
            </li>
          ))}
        </ul>
      </div>
      {/* A provenance string that named no single fact. Shown loudly, because the
          edge it would have drawn is missing from the picture above and a trail
          with a silent gap in it looks complete. */}
      {c.unresolved.length > 0 && (
        <div className="mt-3 rounded-sm border border-danger-line bg-danger-bg px-3 py-2">
          <p className="text-meta font-semibold text-danger-fg">
            One of this line&rsquo;s inputs could not be matched to a single fact, so the trail
            above is missing that link:
          </p>
          <ul className="mt-1 space-y-1">
            {c.unresolved.map((src) => (
              <li key={src} className="break-words font-mono text-meta text-danger-fg">
                {src}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * The three figures the difference is made of, in the order the engine makes it.
 * Each is a Money the backend built; nothing here subtracts anything.
 */
function DifferenceBody({ breakdown }: { breakdown: PayBreakdown }) {
  const t = useT();
  return (
    <>
      <dl className="mt-4 space-y-2">
        <Field label={t("reconcile.rulesGive")}>
          <span className="font-mono tabular-nums">{money(breakdown.expected_net)}</span>
        </Field>
        <Field label={t("reconcile.reachedBank")}>
          <span className="font-mono tabular-nums">{money(breakdown.net_paid)}</span>
        </Field>
      </dl>
      {/* THE ENGINE'S ACCOUNT OF ITS OWN EDGES, FOLDED AWAY.
          Five lines of the backend's English about provenance strings, matched
          facts and unresolved inputs, and they sat directly under the two
          amounts - the first thing a worker read after tapping the difference,
          which is the most-tapped box on the screen. It is engineering
          narration in the one panel that is supposed to answer what this is,
          what it says and where it came from.

          NOT DELETED. A trail is worth what its account of its own edges is
          worth, and this is that account, in the engine's words rather than a
          paraphrase of them. It is disclosed instead - under a summary the
          dictionary translates - and marked lang="en", because the string comes
          from the API in English and a Bengali screen should not be read aloud
          with Bengali phonemes. The worker-language version of the same fact is
          already on the page: `trail.edgesNote`, under the graph, in all four
          languages. */}
      <details className="mt-4 border-t border-line pt-3">
        <summary className="tap-sm cursor-pointer text-meta font-semibold uppercase tracking-wide text-ink-3">
          <T k="lens.howLines" />
        </summary>
        <p lang="en" className="max-w-measure mt-2 text-meta text-ink-3">
          {breakdown.provenance_note}
        </p>
      </details>
    </>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-meta text-ink-3">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}

/**
 * One direction of the edge set, as controls.
 *
 * Selecting one moves the selection, so a keyboard user walks the graph through
 * this panel rather than by hunting for a box.
 */
function Related({
  titleKey,
  ids,
  proof,
  onSelect,
}: {
  titleKey: "lens.builtFrom" | "lens.usedBy";
  ids: string[];
  proof: Proof;
  onSelect: (id: string) => void;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k={titleKey} />
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {ids.map((id) => {
          const n = proof.byId[id];
          if (!n) return null;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className="tap-sm rounded-sm border border-line-strong bg-surface px-3 py-2 text-left hover:border-ink"
              >
                <span className="block text-meta font-medium text-ink">
                  {n.titleKey ? <T k={n.titleKey} /> : n.title}
                </span>
                {n.value && (
                  <span className="block font-mono text-meta tabular-nums text-ink-2">
                    {n.value}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A fact's value as text, re-exported so one definition serves the graph, the
 * inspector and the text equivalent. */
export { factValueText };
