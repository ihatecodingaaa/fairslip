import type { EmployerFinding } from "@/lib/api";
import type { Key } from "@/lib/i18n";

/**
 * One outcome, one silhouette. The single definition, for every surface.
 *
 * SHAPE CARRIES THE OUTCOME, NOT COLOUR. A circle matched, a triangle is an
 * exception, a hollow diamond was not checked. The same rule as every status
 * chip in this product, and on the payroll screens it matters twice over: they
 * are projected, greyscaled and photocopied, and three hundred marks is exactly
 * the density at which a colour difference stops being legible anyway.
 *
 * IT LIVES HERE BECAUSE FOUR SURFACES DRAW IT. The grid, the recheck's two
 * grids, the transition summary and the exported SVG must use the same glyph
 * for the same outcome - a second definition would eventually disagree, and a
 * recheck whose "after" triangle means something different from the "before"
 * one is a comparison of two vocabularies.
 *
 * Keyed by the union the API publishes, so a fourth outcome does not compile
 * until it has a shape.
 */
export const MARK: Record<
  EmployerFinding["outcome"],
  { path: React.ReactNode; word: Key }
> = {
  // A filled disc: checked, and it agreed.
  OK: { path: <circle cx="8" cy="8" r="4.4" />, word: "employer.matched" },
  // A triangle - the only angular silhouette, as everywhere else in this product.
  EXCEPTION: { path: <path d="M8 2.6l5.6 10.2H2.4z" />, word: "employer.exception" },
  // A HOLLOW diamond. Open on purpose: nothing was established about this row,
  // and a filled mark would read as a finding.
  REFUSED: { path: <path d="M8 2.4L13.6 8 8 13.6 2.4 8z" />, word: "employer.notChecked" },
};

export const FILL: Record<EmployerFinding["outcome"], string> = {
  OK: "fill-ink-3",
  EXCEPTION: "fill-attention-fg",
  REFUSED: "fill-surface stroke-ink-2",
};

/** A row that is not in this file at all.
 *
 * NOT AN OUTCOME, AND DRAWN AS ONE THING NO OUTCOME LOOKS LIKE. A short rule,
 * open and grey. An employee who has left the payroll has not been checked and
 * has not been refused - the file simply does not contain them - and reusing
 * the "not checked" diamond would make a leaver indistinguishable from a row
 * the engine declined to compute. */
export const ABSENT = {
  path: <path d="M3 8h10" />,
  word: "recheck.absentFromFile" as Key,
  fill: "stroke-missing-line",
};

/** A mark that is still present and no longer emphasised.
 *
 * A COLOUR TOKEN, NOT AN OPACITY. Opacity composites past every contrast
 * assertion in backend/tests/test_design_tokens.py - a token proved at 10.5:1
 * has reached the screen at 4.33:1 that way before - so a de-emphasised mark
 * changes token, and the token it changes to is one the suite measures. */
const DIMMED = "fill-line stroke-line";

/** One mark, at the size the caller needs. `outcome` of null is ABSENT. */
export function OutcomeMark({
  outcome,
  className = "h-4 w-4",
  dim = false,
}: {
  outcome: EmployerFinding["outcome"] | null;
  className?: string;
  /** Still drawn, no longer emphasised. Never used to remove a row. */
  dim?: boolean;
}) {
  const shape = outcome ? MARK[outcome] : ABSENT;
  const fill = dim ? DIMMED : outcome ? FILL[outcome] : ABSENT.fill;
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="none">
      <g className={fill} strokeWidth="1.6">
        {shape.path}
      </g>
    </svg>
  );
}

/** The word for an outcome, or for a row that is not in the file. */
export function outcomeWord(outcome: EmployerFinding["outcome"] | null): Key {
  return outcome ? MARK[outcome].word : ABSENT.word;
}
