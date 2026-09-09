"use client";

/**
 * Stage 3: the answer, and the trail behind it.
 *
 * THE HIERARCHY IS THE CHANGE. The possible difference used to be a 48px figure
 * at the top of a card, followed immediately by a waterfall, a component list, a
 * flags list, a change-a-fact panel and a paragraph about CPF - six sections of
 * equal visual weight, in which the answer was the first of six. It is now the
 * only thing above the fold: the figure, what the rules gave, what reached the
 * bank, and one control that traces it.
 *
 * ONE HERO, ONE SUPPORT. The trail is the spatial explanation and the waterfall
 * is the arithmetic, and they are deliberately not peers: the trail says WHERE
 * each figure came from, the waterfall says HOW BIG each part is. Two
 * visualisations competing for the same attention would leave a reader deciding
 * which one to believe.
 *
 * THE WATERFALL IS NOT COLLAPSED, and that is a print decision rather than a
 * design one. A closed <details> prints as its summary, so folding the arithmetic
 * away would take the line-by-line breakdown off the sheet a worker carries into
 * an NGO office - which is the one artefact this product exists to produce. It is
 * demoted by position and by weight instead.
 *
 * THE TRAIL IS SCREEN-ONLY, and says so on the paper. <ScreenOnly> leaves a line
 * where it would have been, naming what was withheld and why: the hypothetical
 * re-run inside it produces figures that are true only if one fact were
 * different, and a hypothetical printed beside a real figure in the same type
 * stops being marked as one.
 */

import { useMemo, useState } from "react";
import {
  money,
  postImpact,
  type ExtractOut,
  type DocumentRole,
  type ImpactOut,
  type PayBreakdown,
  type PayInputs,
  type Refusal,
} from "@/lib/api";
import { PrintButton, ScreenOnly } from "../ui/PrintSheet";
import { ReadAloud } from "../ui/ReadAloud";
import { T, useT } from "../ui/Prefs";
import { EvidenceLens, type Hypothetical } from "./EvidenceLens";
import { ProofGraph } from "./ProofGraph";
import { Waterfall } from "./Waterfall";
import { buildProof, downstream, upstream } from "./proof";

export function ReconcileStage({
  breakdown,
  inputs,
  extract,
  documents,
  headingRef,
}: {
  breakdown: PayBreakdown;
  /** The exact facts that produced this breakdown. The trail's fact layer is
   * these, and the hypothetical re-run varies one of them. */
  inputs: PayInputs;
  extract: ExtractOut;
  documents: { role: DocumentRole; name: string }[];
  headingRef?: React.Ref<HTMLParagraphElement>;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [hypothetical, setHypothetical] = useState<Hypothetical>(null);

  const proof = useMemo(
    () => buildProof({ documents, extract, breakdown, inputs, format: money }),
    [documents, extract, breakdown, inputs],
  );

  /* The trace: everything the selection rests on, and everything that rests on
     it. Both directions come from proof.ts's own walk of `from`, so a trace can
     only contain relations the graph has. */
  const traced = useMemo(() => {
    if (!selected) return null;
    const set = upstream(proof, selected);
    for (const id of downstream(proof, selected)) set.add(id);
    return set;
  }, [proof, selected]);

  async function runImpact(field: string, value: string) {
    setHypothetical({ field, busy: true, result: null, refusal: null, error: null });
    try {
      const after: PayInputs = {
        ...inputs,
        [field]: {
          value,
          status: "HUMAN_CONFIRMED",
          source: `you changed this on screen: ${field}`,
        },
      };
      const out = await postImpact(inputs, after);
      setHypothetical({
        field,
        busy: false,
        result: out.ok ? out.value : null,
        refusal: out.ok ? null : out.refusal,
        error: null,
      });
    } catch (e) {
      setHypothetical({
        field,
        busy: false,
        result: null,
        refusal: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const standing: ImpactOut | null = hypothetical?.result ?? null;

  // The selected node's own words, for the sentence that says what is being
  // traced. A node whose name is a dictionary key carries it instead of a title,
  // so this reads whichever one it has rather than assuming a title exists.
  const chosen = selected ? proof.byId[selected] : null;
  const traceLabel = chosen ? (chosen.titleKey ? t(chosen.titleKey) : chosen.title) : "";

  return (
    <div className="grid gap-10">
      {/* ------------------------------------------------------------- the answer */}
      <section aria-labelledby="answer-heading">
        <p
          ref={headingRef}
          id="answer-heading"
          tabIndex={-1}
          className="text-meta font-semibold uppercase tracking-wide text-ink-3"
        >
          <T k="result.difference" />
        </p>
        <p className="mt-2 text-hero font-semibold tabular-nums text-ink sm:text-display">
          {money(breakdown.difference)}
        </p>

        <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
          <div className="flex flex-col">
            <dd className="order-1 text-title font-medium tabular-nums text-ink">
              {money(breakdown.expected_net)}
            </dd>
            <dt className="order-2 text-meta text-ink-3">
              <T k="reconcile.rulesGive" />
            </dt>
          </div>
          <div className="flex flex-col">
            <dd className="order-1 text-title font-medium tabular-nums text-ink">
              {money(breakdown.net_paid)}
            </dd>
            <dt className="order-2 text-meta text-ink-3">
              <T k="reconcile.reachedBank" />
            </dt>
          </div>
        </dl>

        <div className="print-hide mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSelected("money:difference")}
            className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid"
          >
            <T k="reconcile.trace" />
          </button>
          <PrintButton />
          {/* The read-aloud is handed the SAME t() labels and the SAME money()
              strings this section just rendered, assembled one line up. There is
              no second copy of the figures anywhere and no template: what it
              speaks is what is on the screen, by construction rather than by
              care. */}
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
      </section>

      {/* --------------------------------------------------------------- the trail */}
      <ScreenOnly id="money-trail">
        <section aria-labelledby="trail-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="trail-heading" className="text-title font-semibold">
              <T k="trail.heading" />
            </h2>
            {selected && (
              <span className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="text-meta font-semibold text-ink-2">
                  {t("trail.tracing", { label: traceLabel })}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="tap-sm rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink"
                >
                  <T k="trail.clearTrace" />
                </button>
              </span>
            )}
          </div>
          <p className="max-w-measure mt-2 text-body text-ink-2">
            <T k="trail.blurb" />
          </p>

          {/* The standing hypothetical, with a way out of it. It is above the
              graph because it qualifies every marked figure in it, and a caveat
              below the thing it qualifies has already been read too late. */}
          {standing && hypothetical && (
            <div className="mt-4 rounded-sm border-2 border-dashed border-attention-line bg-attention-bg px-4 py-3">
              <p className="text-body font-semibold text-attention-fg">
                <T k="lens.hypothetical" />
              </p>
              <p className="mt-1 font-mono text-meta text-attention-fg">
                {standing.changed_fields
                  .map((f) => `${f.name}: ${f.before_value} → ${f.after_value}`)
                  .join(" · ")}
              </p>
              <p className="mt-2 text-meta text-attention-fg">
                <T k="lens.movedCount" vars={{ n: standing.moved_count }} />
                {" · "}
                <T k="lens.heldCount" vars={{ n: standing.unchanged_count }} />
              </p>
              <button
                type="button"
                onClick={() => setHypothetical(null)}
                className="tap-sm mt-2 rounded-sm border border-attention-line bg-surface px-4 py-2 text-meta font-semibold text-attention-fg"
              >
                <T k="lens.clearHypothetical" />
              </button>
            </div>
          )}

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <ProofGraph
              proof={proof}
              selected={selected}
              traced={traced}
              onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
              impact={standing}
            />
            {/* STICKY ON DESKTOP, and it is not a flourish. The trail is taller
                than the viewport, so a reader who scrolls to a box near the
                bottom and selects it would otherwise have to scroll back up to
                read what they had just selected. The panel follows instead.
                Below `lg` the layout is one column and the inspector sits
                directly under the trail, where sticky would be in the way. */}
            <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <EvidenceLens
                proof={proof}
                selected={selected}
                breakdown={breakdown}
                hypothetical={hypothetical}
                onSelect={setSelected}
                onRun={runImpact}
                onEdit={() =>
                  setHypothetical((h) =>
                    h ? { ...h, result: null, refusal: null, error: null } : h,
                  )
                }
                onClear={() => setHypothetical(null)}
              />
            </div>
          </div>

          <p className="max-w-measure mt-6 text-meta text-ink-3">
            <T k="trail.edgesNote" />
          </p>
        </section>
      </ScreenOnly>

      {/* ----------------------------------------------------------- the arithmetic */}
      <section aria-labelledby="arithmetic-heading">
        <h2 id="arithmetic-heading" className="text-title font-semibold">
          <T k="reconcile.arithmetic" />
        </h2>
        <div className="mt-4 rounded-lg border border-line-strong bg-surface shadow-card">
          <Waterfall breakdown={breakdown} />

          {/* The list stays. It answers a different question from the chart: the
              chart says how big each part is, the list says where each came from.
              Both render the same Component objects; neither holds a second copy
              of a figure. */}
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
            <div className="border-b border-line px-5 py-4">
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

          <div className="px-5 py-4">
            <p className="text-body font-semibold text-ink">
              The CPF side of this month is not shown.
            </p>
            <p className="max-w-measure mt-1 text-body text-ink-2">
              Working out CPF needs the wage the employer actually computed CPF on, and no
              document you uploaded states that figure. It could be worked backwards from the CPF
              line on the payslip, but CPF rounding drops the cents, so that gives a range of
              possible wages rather than one wage. FairSlip does not show a single number where it
              only has a range, so it shows none.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export type { Refusal };
