"use client";

/**
 * The chips on the coverage screen, encoded the same three ways as StatusChip.
 *
 * Two small vocabularies live here, and they are different questions:
 *
 *   OUTCOME   what the CPF engine DID when it was asked about a residency
 *             status - computed, returned NO_CPF, or refused.
 *   KIND      how a thing FairSlip does not do is KNOWN - the engine refuses
 *             it, there is no input for it, or FairSlip says so and this page
 *             does not prove it.
 *
 * Both carry colour AND a distinct silhouette AND a word, for the reason
 * written on StatusChip: WCAG 1.4.1 is Level A, and the third kind in each set
 * is the one a reader most needs to tell apart. `STATED_NOT_CHECKED` is the
 * weakest claim on the page and it must not be able to pass for a refusal
 * because both chips happen to be grey.
 *
 * The records are keyed BY THE UNION, so a new outcome or kind does not compile
 * until it has a shape and a word - and they are exported because
 * backend/tests/test_inclusion.py derives its cases from the same unions and
 * asserts no two share either.
 */

import type { ReactNode } from "react";
import type { NotEncoded, ResidencyOutcome } from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { T } from "./Prefs";

type Outcome = ResidencyOutcome["outcome"];
type Kind = NotEncoded["kind"];

const OUTCOME_ICON: Record<Outcome, ReactNode> = {
  // A tick in a closed ring: the engine ran and returned figures.
  CONTRIBUTES: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.2 8.2l2 2 3.6-4.1" />
    </>
  ),
  // A ring with a bar through it: not a member. Not a failure - a different
  // rule - so it is the only silhouette here that crosses itself out.
  NOT_A_MEMBER: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M3.6 12.4L12.4 3.6" />
    </>
  ),
  // A warning triangle: the engine declined to compute.
  REFUSED: (
    <>
      <path d="M8 2.4l6 10.6H2z" />
      <path d="M8 6.4v3.1" />
      <path d="M8 11.3v.1" />
    </>
  ),
};

const OUTCOME_TONE: Record<Outcome, string> = {
  CONTRIBUTES: "border-agreed-line bg-agreed-bg text-agreed-fg",
  NOT_A_MEMBER: "border-brand-line bg-brand-bg text-brand-fg",
  REFUSED: "border-attention-line bg-attention-bg text-attention-fg",
};

export const OUTCOME_WORDS = {
  CONTRIBUTES: "scale.outcome.CONTRIBUTES",
  NOT_A_MEMBER: "scale.outcome.NOT_A_MEMBER",
  REFUSED: "scale.outcome.REFUSED",
} as const;

const KIND_ICON: Record<Kind, ReactNode> = {
  // The same triangle as a refused outcome, because it is the same event: the
  // engine was asked and said no.
  REFUSED_BY_ENGINE: (
    <>
      <path d="M8 2.4l6 10.6H2z" />
      <path d="M8 6.4v3.1" />
      <path d="M8 11.3v.1" />
    </>
  ),
  // A dashed, open square: there is no field here. An unbroken outline would
  // read as an empty box that exists.
  NO_INPUT_EXISTS: <rect x="2.4" y="2.4" width="11.2" height="11.2" strokeDasharray="2.4 2.2" />,
  // A speech bubble: these are words, and this page says only that they were
  // said.
  STATED_NOT_CHECKED: (
    <>
      <path d="M2.6 4.2h10.8v6.4H7.4L4.2 13.4v-2.8H2.6z" />
    </>
  ),
};

const KIND_TONE: Record<Kind, string> = {
  REFUSED_BY_ENGINE: "border-attention-line bg-attention-bg text-attention-fg",
  NO_INPUT_EXISTS: "border-missing-line bg-missing-bg text-missing-fg",
  STATED_NOT_CHECKED: "border-brand-line bg-brand-bg text-brand-fg",
};

export const KIND_WORDS = {
  REFUSED_BY_ENGINE: "scale.kind.REFUSED_BY_ENGINE",
  NO_INPUT_EXISTS: "scale.kind.NO_INPUT_EXISTS",
  STATED_NOT_CHECKED: "scale.kind.STATED_NOT_CHECKED",
} as const;

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function Chip({ tone, icon, word }: { tone: string; icon: ReactNode; word: Key }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-sm border px-2 py-1 text-meta font-semibold ${tone}`}
    >
      <Glyph>{icon}</Glyph>
      <T k={word} />
    </span>
  );
}

export function OutcomeChip({ outcome }: { outcome: Outcome }) {
  return (
    <Chip
      tone={OUTCOME_TONE[outcome]}
      icon={OUTCOME_ICON[outcome]}
      word={OUTCOME_WORDS[outcome]}
    />
  );
}

export function KindChip({ kind }: { kind: Kind }) {
  return <Chip tone={KIND_TONE[kind]} icon={KIND_ICON[kind]} word={KIND_WORDS[kind]} />;
}
