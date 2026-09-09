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

  return (
    <section
      aria-labelledby="lens-heading"
      className="rounded-lg border border-line-strong bg-surface p-5 shadow-card"
    >
      <h2 id="lens-heading" className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="lens.heading" />
      </h2>

      {!node && (
        <p className="max-w-measure mt-3 text-body text-ink-2">
          <T k="lens.nothing" /> <T k="trail.selectPrompt" />
        </p>
      )}

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
          {node.status && (
            <p className="mt-2">
              <StatusChip status={node.status} />
            </p>
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

          {/* The change-a-fact question, asked where it arises. */}
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
        </>
      )}
    </section>
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
      <Field label={<T k="lens.status" />}>
        <span>{r.ok ? t("check.answered") : t("check.didNotAnswer")}</span>
      </Field>
      <Field label="Path">
        <span>{r.cache === "HIT" ? t("check.fromCache") : t("check.calledLive")}</span>
      </Field>
      {/* A time is only shown for a live call, because only then does it describe
          THIS request. `latency_ms` on a hit is the latency recorded when the
          entry was generated. See docs/debt.md, cached-path-wearing-a-live-timing. */}
      {r.cache !== "HIT" && r.latency_ms !== null && (
        <Field label="Took">
          <span className="font-mono">{r.latency_ms} ms</span>
        </Field>
      )}
      {r.error && (
        <Field label="Error">
          <span className="text-danger-fg">{r.error}</span>
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

function FactBody({ node, proof }: { node: ProofNode; proof: Proof }) {
  const t = useT();
  const f = node.fact!;
  const readings = f.readings;
  return (
    <>
      <dl className="mt-4 space-y-2">
        <Field label={<T k="lens.source" />}>
          <span className="break-words">{f.fact.source}</span>
        </Field>
      </dl>

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
      <p className="max-w-measure mt-3 text-meta text-ink-3">{breakdown.provenance_note}</p>
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
