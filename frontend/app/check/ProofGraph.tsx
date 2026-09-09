"use client";

/**
 * The money trail: a document on one side, a possible difference on the other,
 * and every step between them on screen at once.
 *
 * WHAT THIS REPLACES. The provenance was all present before and none of it was
 * visible: a component's inputs were three grey lines of text under its formula,
 * a reader's readings were two columns in a table nine hundred pixels further up,
 * and the relationship between them was something a reader had to assemble in
 * their head from two places. "Every dollar has a trail" was a sentence.
 *
 * IT IS A RENDERING, NOT AN EDITOR. Nodes are not draggable, edges cannot be
 * created, and there is no graph the reader can build. Selection and inspection
 * are the whole interaction, because the graph is a report.
 *
 * NO GRAPH LIBRARY, AND THE REASON IS THE SAME ONE Waterfall.tsx GIVES FOR
 * HAVING NO CHART LIBRARY. Every label here has to translate into four scripts
 * and scale with the text-size control, which means it has to be HTML - and a
 * layout engine that positions its own text would take that out of our hands
 * along with the accessible names. So the boxes are HTML in a normal flow, and
 * the edges are ONE SVG measured off them: getBoundingClientRect per node,
 * recomputed on resize. That is what lets the same component be six rows on a
 * phone and six rows with wrapped columns on a laptop, with the lines following,
 * and it is why there is no viewBox full of hardcoded coordinates.
 *
 * THE EDGES ARE THE CLAIM, so where each one comes from is written out in
 * proof.ts, next to the code that makes it. Nothing in this file decides what
 * depends on what.
 *
 * TRACING DE-EMPHASISES WITH TOKENS, NOT OPACITY. `opacity` composites at render
 * time, so a pair proved at 10.5:1 in the token suite can reach the screen at
 * 4.33:1 and no assertion about the stylesheet can see it - which is exactly what
 * happened to the mandate selector. Untraced nodes change BORDER and TEXT TOKEN;
 * both are values test_design_tokens.py holds to a ratio. See docs/debt.md,
 * opacity-composites-past-the-contrast-suite.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { money, type ImpactOut } from "@/lib/api";
import { T, useT } from "../ui/Prefs";
import { StatusChipCompact, StatusIcon } from "../ui/StatusChip";
import { LAYERS, type Proof, type ProofNode } from "./proof";

type Box = { left: number; top: number; width: number; height: number };
type Geometry = { width: number; height: number; boxes: Record<string, Box> };
type Edge = { key: string; d: string; traced: boolean };

export function ProofGraph({
  proof,
  selected,
  traced,
  onSelect,
  impact,
  className = "",
}: {
  className?: string;
  proof: Proof;
  selected: string | null;
  /** The ids in the current trace, or null for "show everything". Computed by the
   * workspace from proof.ts's own walk, so a trace can only contain relations the
   * graph has. */
  traced: Set<string> | null;
  onSelect: (id: string) => void;
  /** A hypothetical re-run, if one is standing. Every figure in it is the
   * backend's; this file marks the nodes it names and invents no amount for the
   * ones it does not. */
  impact: ImpactOut | null;
}) {
  const t = useT();
  const container = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [geom, setGeom] = useState<Geometry | null>(null);

  const measure = useCallback(() => {
    const el = container.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const boxes: Record<string, Box> = {};
    for (const [id, node] of nodes.current) {
      const r = node.getBoundingClientRect();
      boxes[id] = {
        left: r.left - box.left,
        top: r.top - box.top,
        width: r.width,
        height: r.height,
      };
    }
    setGeom({ width: box.width, height: box.height, boxes });
  }, []);

  useEffect(() => {
    measure();
    const el = container.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // The container's own box changes when the viewport does, when the reader
    // moves the text-size control, and when a web font finally arrives. All three
    // move the boxes, so all three have to move the lines.
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, proof]);

  const edges: Edge[] = [];
  if (geom) {
    for (const node of proof.nodes) {
      for (const parent of node.from) {
        const a = geom.boxes[parent];
        const b = geom.boxes[node.id];
        if (!a || !b) continue;
        edges.push({
          key: `${parent}->${node.id}`,
          d: path(a, b),
          traced: traced === null || (traced.has(parent) && traced.has(node.id)),
        });
      }
    }
  }

  const byLayer = LAYERS.map((_, i) => proof.nodes.filter((n) => n.layer === i));
  const impactByLabel = new Map(impact?.components.map((c) => [c.label, c]) ?? []);

  return (
    <div ref={container} className={`relative ${className}`}>
      {/* Decorative by construction: every relationship an edge draws is stated
          in words in the inspector, under "Built from" and "Used by". A screen
          reader is given the graph as structure, not as thirty-five arrows. */}
      <svg
        aria-hidden
        role="presentation"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={geom ? `0 0 ${geom.width} ${geom.height}` : undefined}
        preserveAspectRatio="none"
      >
        {edges.map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            className={e.traced ? "stroke-ink-3" : "stroke-line"}
            strokeWidth={e.traced ? 1.6 : 1}
          />
        ))}
      </svg>

      <div className="relative grid gap-y-6">
        {LAYERS.map((layer, i) => (
          <section key={layer.label} aria-labelledby={`trail-layer-${i}`}>
            {/* bg-canvas, and it is not decoration: the edges are drawn in an
                SVG BEHIND this content, so a transparent heading has curves
                running through its letters. An opaque band across the row is
                what separates one layer from the next. It is the page's own
                background colour, so it is invisible except where a line would
                otherwise be. */}
            <h3
              id={`trail-layer-${i}`}
              className="relative bg-canvas py-1 text-meta font-semibold uppercase tracking-wide text-ink-3"
            >
              <T k={layer.label} />
            </h3>
            <ul className="mt-2 flex flex-wrap items-stretch gap-3">
              {byLayer[i].map((n) => (
                <li key={n.id} className="flex">
                  <NodeBox
                    node={n}
                    layerLabel={t(layer.label)}
                    selected={selected === n.id}
                    dim={traced !== null && !traced.has(n.id)}
                    impact={impactByLabel.get(n.component?.label ?? "") ?? null}
                    hypotheticalMoney={hypotheticalFor(n, impact)}
                    onSelect={onSelect}
                    register={(el) => {
                      if (el) nodes.current.set(n.id, el);
                      else nodes.current.delete(n.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The after-figure for a money node, when the backend returned one.
 *
 * `ImpactOut` carries an after value for the expected net and the difference and
 * NOT for the gross, so the gross node gets nothing rather than a number this
 * file worked out. That asymmetry is visible on screen and it is correct.
 */
function hypotheticalFor(node: ProofNode, impact: ImpactOut | null): string | null {
  if (!impact || !node.money) return null;
  // A FIGURE THAT DID NOT MOVE GETS NO BADGE. The endpoint returns an after
  // value for these two whether or not the change reached them, and rendering it
  // regardless put "if changed -> $1,182.24" under "$1,182.24" - which reads as a
  // line that changed into itself, on the surface whose whole claim is that it
  // can tell what moved from what did not. Both sides are the engine's own
  // Decimals, compared as the engine wrote them.
  if (node.money.field === "expected_net") {
    return impact.before_expected_net.exact === impact.after_expected_net.exact
      ? null
      : money(impact.after_expected_net);
  }
  if (node.money.field === "difference") {
    return impact.before_difference.exact === impact.after_difference.exact
      ? null
      : money(impact.after_difference);
  }
  return null;
}

/**
 * One box.
 *
 * A button, because it does something. Its accessible name is its visible text
 * plus the name of the layer it sits in - a screen-reader user hearing
 * "overtime, $169.93" needs to know that came from the rules row and not from a
 * document.
 */
function NodeBox({
  node,
  layerLabel,
  selected,
  dim,
  impact,
  hypotheticalMoney,
  onSelect,
  register,
}: {
  node: ProofNode;
  layerLabel: string;
  selected: boolean;
  dim: boolean;
  impact: ImpactOut["components"][number] | null;
  hypotheticalMoney: string | null;
  onSelect: (id: string) => void;
  register: (el: HTMLElement | null) => void;
}) {
  const hero = node.kind === "difference";
  const moved = impact !== null && impact.status !== "UNCHANGED";
  // ONLY A MOVED LINE. `impact.after` is present on UNCHANGED rows as well, so
  // reading the badge off its existence marked every component in the breakdown
  // - "if changed -> $1,200.00" under "$1,200.00" on a line that did not move,
  // which says the opposite of what the view exists to say.
  const after = impact ? (moved && impact.after ? money(impact.after) : null) : hypotheticalMoney;

  // DE-EMPHASIS IS A SURFACE, NOT A SHADE. An untraced node keeps its border
  // width and loses its EDGE and its FILL: it stops being a card on the page and
  // becomes text on it. A merely lighter border was not enough - with 22 boxes
  // on screen, "grey border" and "grey-er border" read as the same box, and a
  // trace that nobody can see at a glance is a trace that has to be read.
  //
  // BORDER WIDTH NEVER CHANGES, only its colour, so nothing reflows on a click
  // and the measured edges do not move under the reader.
  const edge = selected
    ? "border-ink bg-muted"
    : dim
      ? "border-transparent bg-canvas"
      : node.kind === "difference"
        ? "border-ink-2 bg-attention-bg"
        : node.kind === "source"
          ? "border-brand-line bg-surface"
          : "border-line-strong bg-surface";

  return (
    <button
      ref={register}
      type="button"
      onClick={() => onSelect(node.id)}
      aria-pressed={selected}
      /* 10rem, and it is a phone decision as much as a desktop one: at 390px the
         column is 335px, so two of these fit where one 13rem box did, and four
         fit the workspace column where three did. Measured, not guessed - at
         10.5rem the pair came to 348px and wrapped, which is the difference
         between a trail two screens long and one four screens long. */
      className={`tap-sm flex w-full min-w-[7rem] flex-col items-start rounded-sm border-2 px-3 py-2 text-left transition-colors ${edge} ${
        hero ? "min-w-[11rem] max-w-[14rem]" : "max-w-[10rem]"
      }`}
    >
      <span className="sr-only">{layerLabel}: </span>
      <span
        className={`block ${hero ? "text-body font-semibold" : "text-meta font-semibold"} ${
          dim ? "text-ink-3" : "text-ink"
        }`}
      >
        {node.titleKey ? <T k={node.titleKey} /> : node.title}
      </span>

      {/* The value and its status on ONE line. They were two, which cost a line
          per node across twenty-two of them - and they belong together anyway:
          the status is a claim about that value. */}
      {(node.value || node.valueKey || node.status) && (
        <span className="mt-1 flex w-full flex-wrap items-center gap-x-2 gap-y-1">
          {node.valueKey ? (
            <span className={`text-meta ${dim ? "text-ink-3" : "text-ink-2"}`}>
              <T k={node.valueKey} />
            </span>
          ) : (
            node.value && (
              <span
                className={`font-mono tabular-nums ${
                  hero ? "text-title font-semibold" : "text-body"
                } ${dim ? "text-ink-3" : "text-ink"}`}
              >
                {node.value}
              </span>
            )
          )}
          {node.status &&
            (dim ? (
              // The chip's own colours would fight the de-emphasis, so a dimmed
              // node keeps the SHAPE - the encoding that survives greyscale
              // anyway - and drops the tint and the word.
              <span className="inline-flex items-center text-ink-3">
                <StatusIcon status={node.status} />
                <span className="sr-only">{node.status}</span>
              </span>
            ) : (
              <StatusChipCompact status={node.status} />
            ))}
        </span>
      )}

      {/* A hypothetical, marked as one, on ONE line directly under the figure it
          would replace - so the two numbers can be compared without reading a
          label between them. It was three lines carrying the same eleven-word
          sentence on every affected node, plus the engine's own status enum. */}
      {(moved || after) && (
        <span className="mt-2 block w-full border-t border-dashed border-attention-line pt-1">
          <span className="flex flex-wrap items-baseline gap-x-2 text-attention-fg">
            <span className="text-meta font-semibold">
              <T k="trail.ifChanged" />
            </span>
            <span className="font-mono text-body tabular-nums">
              {after ? (
                <>&rarr; {after}</>
              ) : (
                <>
                  &rarr; <T k="trail.lineGone" />
                </>
              )}
            </span>
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * One edge, as a cubic.
 *
 * The anchor pair is chosen from the dominant axis of the gap between the two
 * boxes, so the same function draws a downward line between two rows on a phone
 * and a sideways one between two wrapped columns on a laptop. Nothing here knows
 * which layout it is in, which is the only way one component can be both.
 */
function path(a: Box, b: Box): string {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  const dx = bx - ax;
  const dy = by - ay;

  if (Math.abs(dy) >= Math.abs(dx)) {
    const y1 = dy >= 0 ? a.top + a.height : a.top;
    const y2 = dy >= 0 ? b.top : b.top + b.height;
    const bend = Math.max(Math.abs(y2 - y1) / 2, 8);
    return `M ${ax} ${y1} C ${ax} ${y1 + (dy >= 0 ? bend : -bend)}, ${bx} ${
      y2 - (dy >= 0 ? bend : -bend)
    }, ${bx} ${y2}`;
  }
  const x1 = dx >= 0 ? a.left + a.width : a.left;
  const x2 = dx >= 0 ? b.left : b.left + b.width;
  const bend = Math.max(Math.abs(x2 - x1) / 2, 8);
  return `M ${x1} ${ay} C ${x1 + (dx >= 0 ? bend : -bend)} ${ay}, ${
    x2 - (dx >= 0 ? bend : -bend)
  } ${by}, ${x2} ${by}`;
}
