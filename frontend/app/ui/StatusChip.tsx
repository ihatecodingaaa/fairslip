"use client";

/**
 * The four states a fact can be in, encoded three ways at once.
 *
 * WCAG 1.4.1 Use of Color is Level A - the floor, not an aspiration - and it
 * says colour may not be the only visual means of conveying information. These
 * chips carry:
 *
 *   COLOUR   a semantic token family
 *   SHAPE    a distinct icon outline, not four tints of one glyph
 *   TEXT     the sentence a worker reads
 *
 * Any two of the three can be removed and the fourth state is still tellable
 * from the other three - which is what "redundant" means here. The grayscale
 * test is not a metaphor: backend/tests/test_design_tokens.py derives its cases
 * over the FactStatus union and asserts that no two statuses share an icon or a
 * label, so the chips still disambiguate with every colour stripped out.
 *
 * The icons are outlines with distinct silhouettes on purpose. Four variations
 * of a circle would pass a naive "has an icon" review and fail the actual test,
 * which is whether a person five metres from a projector can tell them apart.
 */

import type { ReactNode } from "react";
import type { Fact } from "@/lib/api";
import { T } from "./Prefs";

type Status = Fact["status"];

/** One entry per status. The keys ARE the union, so a new status will not
 * compile until it has been given a shape and a word of its own. */
const ICON: Record<Status, ReactNode> = {
  // A tick inside a closed ring: two independent readers arrived at one value.
  AGREED: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.2 8.2l2 2 3.6-4.1" />
    </>
  ),
  // A warning triangle. The only angular silhouette in the set.
  DISAGREED: (
    <>
      <path d="M8 2.4l6 10.6H2z" />
      <path d="M8 6.4v3.1" />
      <path d="M8 11.3v.1" />
    </>
  ),
  // A DASHED ring, deliberately open: nothing was established, and an unbroken
  // outline would read as a settled empty value rather than as an absence.
  MISSING: (
    <>
      <circle cx="8" cy="8" r="6.25" strokeDasharray="2.4 2.2" />
    </>
  ),
  // A person. The worker settled this one, and the shape says who.
  HUMAN_CONFIRMED: (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M2.9 13.4c0-2.8 2.3-4.4 5.1-4.4s5.1 1.6 5.1 4.4" />
    </>
  ),
};

const TONE: Record<Status, string> = {
  AGREED: "border-agreed-line bg-agreed-bg text-agreed-fg",
  DISAGREED: "border-attention-line bg-attention-bg text-attention-fg",
  MISSING: "border-missing-line bg-missing-bg text-missing-fg",
  HUMAN_CONFIRMED: "border-agreed-line bg-agreed-bg text-agreed-fg",
};

/* The words. Kept as i18n keys rather than literals so the chip translates with
 * the rest of the interface - the status of a worker's own payslip field is not
 * a place to leave English on a Bengali screen. */
const WORDS = {
  AGREED: "status.AGREED",
  DISAGREED: "status.DISAGREED",
  MISSING: "status.MISSING",
  HUMAN_CONFIRMED: "status.HUMAN_CONFIRMED",
} as const;

export function StatusIcon({ status }: { status: Status }) {
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
      {ICON[status]}
    </svg>
  );
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-sm border px-2 py-1 text-meta font-semibold ${TONE[status]}`}
    >
      <StatusIcon status={status} />
      <T k={WORDS[status]} />
    </span>
  );
}

/* Exported for the test that proves the encoding is redundant. Keeping the
 * shapes and the words reachable from outside is what lets a check assert they
 * are all distinct, rather than a human believing they are. */
export const STATUS_WORD_KEYS = WORDS;
