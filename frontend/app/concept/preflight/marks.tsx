"use client";

/**
 * One status, one silhouette - and it is the product's existing silhouette.
 *
 * REUSED, NOT REDRAWN. <OutcomeMark /> is the single definition of these three
 * glyphs, already shared by the payroll X-ray, both recheck grids, the
 * transition summary and the exported SVG. A concept that drew its own circle
 * and its own triangle would be a second vocabulary for the same three
 * outcomes, and the first person to see both screens in one meeting would have
 * to be told they mean the same thing.
 *
 * THE MAPPING IS HERE AND NOWHERE ELSE. The concept's words are the operator's
 * words - matched, needs review, not checked - and the production enum's are the
 * engine's - OK, EXCEPTION, REFUSED. One translation, in one file, so the grid,
 * the list, the timeline and the recheck cannot disagree about which shape a
 * status wears.
 *
 * SHAPE CARRIES THE STATUS, NOT COLOUR: a filled disc matched, a triangle needs
 * review, a hollow diamond was not checked. That rule is why these screens
 * survive a projector, a greyscale print and a reader who cannot distinguish the
 * two warm hues - and at three hundred marks it is the only encoding dense
 * enough to read at all.
 */

import type { MarkKind } from "../../employer/outcomeMark";
import { OutcomeMark } from "../../employer/outcomeMark";
import type { PreflightStatus } from "@/lib/concept-preflight/types";
import { STATUS_WORD } from "@/lib/concept-preflight/selectors";

const KIND: Record<PreflightStatus, MarkKind> = {
  MATCHED: "OK",
  NEEDS_REVIEW: "EXCEPTION",
  NOT_CHECKED: "REFUSED",
};

export function StatusMark({
  status,
  className = "h-4 w-4",
  dim = false,
}: {
  status: PreflightStatus;
  className?: string;
  dim?: boolean;
}) {
  return <OutcomeMark outcome={KIND[status]} className={className} dim={dim} />;
}

/** The three statuses, with their shapes and their words. Rendered under every
 * view that draws marks, because a legend a reader has to remember from another
 * screen is a legend they do not have. */
export function StatusLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-6 gap-y-2 ${className}`}>
      {(["MATCHED", "NEEDS_REVIEW", "NOT_CHECKED"] as PreflightStatus[]).map((status) => (
        <li key={status} className="flex items-center gap-2">
          <StatusMark status={status} />
          <span className="text-meta text-ink-2">{STATUS_WORD[status]}</span>
        </li>
      ))}
    </ul>
  );
}

/** The status word, coloured only where colour is a second channel behind the
 * shape and the word. Never the only channel. */
export function statusToneClass(status: PreflightStatus): string {
  if (status === "NEEDS_REVIEW") return "text-attention-fg";
  if (status === "NOT_CHECKED") return "text-missing-fg";
  return "text-ink-2";
}
