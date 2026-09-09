/**
 * The money trail, as data. No React, no arithmetic, no rule.
 *
 * This module turns what the API already said into nodes and edges. It is the
 * one place the trail's shape is decided, so the drawing, the inspector and the
 * text equivalent are three renderings of one model rather than three
 * descriptions of one idea.
 *
 * WHERE EVERY EDGE COMES FROM. This is the whole discipline of the file, so it
 * is written out rather than left to be inferred:
 *
 *   document -> reader     THE REQUEST. /extract sends every image to every
 *                          reader, and app/main.py runs them concurrently on the
 *                          same tuple. So each reader was given each document,
 *                          by construction - including a reader that then failed.
 *
 *   reader -> fact         `ReadField.readings[reader]`, and ONLY where the fact
 *                          is AGREED. A field the worker settled rests on the
 *                          worker's answer, not on what a reader happened to say
 *                          about it - so a confirmed field gets no reader edge,
 *                          and what the readers said is still shown in the
 *                          inspector. Drawing one would credit a reader with a
 *                          value it did not establish.
 *
 *   you -> fact            Status HUMAN_CONFIRMED. The worker is a source in the
 *                          same layer as the two readers, because that is what
 *                          they are.
 *
 *   fact -> component      `ComponentOut.input_fields`, which the BACKEND
 *                          resolved from the component's own recorded `inputs` -
 *                          the provenance string of every fact the engine
 *                          consumed - against the facts this request supplied.
 *                          Nothing here knows that overtime depends on the
 *                          overtime hours. `unresolved_inputs` is carried
 *                          through and shown rather than dropped: a source
 *                          string shared by two facts identifies neither, and
 *                          the honest edge is no edge plus a note.
 *
 *   component -> gross     THE THREE IDENTITIES rules.py computes and
 *   gross, deductions      PayBreakdownOut carries: gross is the sum of the
 *     -> net               components, net is gross minus the deductions on the
 *   net, net_paid          payslip, and the difference is net minus what reached
 *     -> difference        the bank. These are the same three steps the
 *                          waterfall in Waterfall.tsx draws, and
 *                          backend/tests/test_charts.py holds both files to
 *                          naming only Money fields the schema actually carries.
 *
 * WHAT IS DELIBERATELY NOT DRAWN. `deductions_total` and `net_paid` are Money
 * fields on the breakdown AND facts on the way in. They appear ONCE, as facts,
 * because that is what they are: figures somebody established, not amounts the
 * engine derived. Two nodes for one number is the defect this product exists to
 * find, committed by the picture of it.
 */

import type {
  DocumentRole,
  ExtractOut,
  Fact,
  FactStatus,
  Money,
  PayBreakdown,
  PayInputs,
  ReaderInfo,
} from "@/lib/api";
import type { Key } from "@/lib/i18n";

export type NodeKind = "document" | "source" | "fact" | "component" | "money" | "difference";

/** The layers, in the order a figure passes through them. The keys are the same
 * six the landing page names, from the same dictionary. */
export const LAYERS: { kind: NodeKind | "sources"; label: Key }[] = [
  { kind: "document", label: "trail.layer.documents" },
  { kind: "sources", label: "trail.layer.readers" },
  { kind: "fact", label: "trail.layer.facts" },
  { kind: "component", label: "trail.layer.rules" },
  { kind: "money", label: "trail.layer.money" },
  { kind: "difference", label: "trail.layer.difference" },
];

export type ProofNode = {
  id: string;
  kind: NodeKind;
  /** The layer index this node is drawn in. */
  layer: number;
  /** The node's own heading. A server string, a filename or a field label - never
   * a dictionary key, because none of these are interface words. */
  title: string;
  /** A dictionary key rendered instead of `title`, for the two nodes whose names
   * ARE interface words: the worker themselves, and the layer totals. */
  titleKey?: Key;
  /** What the node is worth, as text. Already a string the backend produced. */
  value?: string;
  status?: FactStatus;
  /** Ids this node rests on. The edge set, per node. */
  from: string[];
  /* -------- per-kind payload, for the inspector. Never re-derived there. */
  document?: { role: DocumentRole; name: string };
  reader?: ReaderInfo;
  fact?: { name: string; label: string; fact: Fact; readings?: Record<string, string | null> };
  component?: { label: string; amount: Money; formula: string; inputs: string[]; unresolved: string[] };
  money?: { field: MoneyField; amount: Money };
};

/** The Money fields of PayBreakdownOut this file names. Held to the schema by
 * backend/tests/test_charts.py, exactly as the waterfall's step keys are: a
 * renamed field must break a test rather than quietly draw one box fewer. */
export type MoneyField = "expected_gross" | "expected_net" | "difference";

export const YOU_ID = "source:you";

export type Proof = {
  nodes: ProofNode[];
  byId: Record<string, ProofNode>;
  /** Reverse edges, so the inspector can answer "used by" without a scan. */
  usedBy: Record<string, string[]>;
};

function push(nodes: ProofNode[], node: ProofNode): ProofNode {
  nodes.push(node);
  return node;
}

export function buildProof(args: {
  documents: { role: DocumentRole; name: string }[];
  extract: ExtractOut;
  breakdown: PayBreakdown;
  /** The exact facts that produced this breakdown, as they were sent. */
  inputs: PayInputs;
  /** money() from lib/api, injected so this module renders no figure itself and
   * cannot grow a second formatter. */
  format: (m: Money) => string;
}): Proof {
  const { documents, extract, breakdown, inputs, format } = args;
  const nodes: ProofNode[] = [];

  /* ---------------------------------------------------------- 0. documents */
  const documentIds: string[] = [];
  for (const d of documents) {
    const id = `document:${d.role}`;
    documentIds.push(id);
    push(nodes, {
      id,
      kind: "document",
      layer: 0,
      title: d.name,
      from: [],
      document: d,
    });
  }

  /* ------------------------------------------------- 1. the readers, and you */
  const readerIds: Record<string, string> = {};
  for (const r of extract.readers) {
    const id = `source:${r.key}`;
    readerIds[r.key] = id;
    push(nodes, {
      id,
      kind: "source",
      layer: 1,
      title: r.provider,
      value: r.model,
      // Every reader was handed every document. That is the request, not a guess.
      from: [...documentIds],
      reader: r,
    });
  }

  const confirmed = Object.entries(inputs).filter(
    ([, f]) => f !== null && f.status === "HUMAN_CONFIRMED",
  );
  if (confirmed.length > 0) {
    push(nodes, {
      id: YOU_ID,
      kind: "source",
      layer: 1,
      title: "",
      titleKey: "trail.you",
      value: undefined,
      // No upstream, and that is the point: this is the one input with no
      // document behind it.
      from: [],
    });
  }

  /* ------------------------------------------------------------- 2. the facts */
  const readByName = new Map(extract.read_fields.map((f) => [f.name, f]));
  const labelFor = new Map<string, string>([
    ...extract.read_fields.map((f) => [f.name, f.label] as const),
    ...extract.worker_fields.map((f) => [f.name, f.label] as const),
  ]);

  const factIds: Record<string, string> = {};
  for (const [name, fact] of Object.entries(inputs)) {
    if (fact === null) continue;
    const id = `fact:${name}`;
    factIds[name] = id;
    const read = readByName.get(name);
    const from: string[] = [];
    if (fact.status === "AGREED") {
      // Both readers produced this value. A reader that returned nothing for it
      // could not have, so it gets no edge.
      for (const r of extract.readers) {
        if (read && read.readings[r.key] != null) from.push(readerIds[r.key]);
      }
    } else if (fact.status === "HUMAN_CONFIRMED") {
      from.push(YOU_ID);
    }
    push(nodes, {
      id,
      kind: "fact",
      layer: 2,
      title: labelFor.get(name) ?? name.replace(/_/g, " "),
      value: factValueText(fact),
      status: fact.status,
      from,
      fact: { name, label: labelFor.get(name) ?? name, fact, readings: read?.readings },
    });
  }

  /* -------------------------------------------------------- 3. the components */
  const componentIds: string[] = [];
  for (const c of breakdown.components) {
    const id = `component:${c.label}`;
    componentIds.push(id);
    push(nodes, {
      id,
      kind: "component",
      layer: 3,
      title: c.label.replace(/_/g, " "),
      value: format(c.amount),
      // Resolved by the backend from this component's own recorded inputs.
      from: c.input_fields.map((f) => factIds[f]).filter((x): x is string => Boolean(x)),
      component: {
        label: c.label,
        amount: c.amount,
        formula: c.formula,
        inputs: c.inputs,
        unresolved: c.unresolved_inputs,
      },
    });
  }

  /* ------------------------------------------------------------- 4. the money */
  const gross = push(nodes, {
    id: "money:expected_gross",
    kind: "money",
    layer: 4,
    title: "",
    titleKey: "result.expectedGross",
    value: format(breakdown.expected_gross),
    from: [...componentIds],
    money: { field: "expected_gross", amount: breakdown.expected_gross },
  });

  const net = push(nodes, {
    id: "money:expected_net",
    kind: "money",
    layer: 4,
    title: "",
    titleKey: "result.expectedNet",
    value: format(breakdown.expected_net),
    from: [gross.id, factIds.deductions_total].filter(Boolean) as string[],
    money: { field: "expected_net", amount: breakdown.expected_net },
  });

  /* -------------------------------------------------------- 5. the difference */
  push(nodes, {
    id: "money:difference",
    kind: "difference",
    layer: 5,
    title: "",
    titleKey: "result.difference",
    value: format(breakdown.difference),
    from: [net.id, factIds.net_paid].filter(Boolean) as string[],
    money: { field: "difference", amount: breakdown.difference },
  });

  const byId: Record<string, ProofNode> = {};
  for (const n of nodes) byId[n.id] = n;
  const usedBy: Record<string, string[]> = {};
  for (const n of nodes) {
    for (const src of n.from) (usedBy[src] ??= []).push(n.id);
  }
  return { nodes, byId, usedBy };
}

/** A fact's value as text. A DISAGREED fact carries a reading per reader, and
 * both are shown rather than one being chosen. */
export function factValueText(f: Fact): string {
  const v = f.value;
  if (v === null) return "";
  if (typeof v === "object") {
    return Object.entries(v)
      .map(([reader, value]) => `${reader}: ${value}`)
      .join("  |  ");
  }
  return String(v);
}

/** Everything the selected node rests on, transitively. Walks `from`, which is
 * the only edge record in this module - so a trace cannot include a relation the
 * graph does not have. */
export function upstream(proof: Proof, id: string): Set<string> {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const parent of proof.byId[current]?.from ?? []) queue.push(parent);
  }
  return seen;
}

/** Everything that rests on the selected node, transitively. The other
 * direction, for a fact: change this and these are the lines that could move. */
export function downstream(proof: Proof, id: string): Set<string> {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const child of proof.usedBy[current] ?? []) queue.push(child);
  }
  return seen;
}
