"use client";

/**
 * Three hundred rows, on one screen, one mark each.
 *
 * WHAT THIS ANSWERS THAT A TABLE CANNOT. "11 exceptions and 7 not checked, out of
 * 300" is a sentence a reader has to take on trust; a grid of 300 marks with 11
 * triangles and 7 diamonds in it is the same claim, checkable by looking. It also
 * makes the shape of the file visible - whether the exceptions cluster, whether
 * the refusals are all at the end - which no summary line can carry.
 *
 * ORDER IS THE FILE'S OWN. Row 1 is top-left and row N is bottom-right, reading
 * order, always. Nothing is sorted, grouped or scattered: a mark's POSITION is a
 * fact about the file, so a reader who finds row 214 in the list can find it in
 * the grid and vice versa. Random placement would have looked more like a
 * constellation and would have meant nothing.
 *
 * SHAPE CARRIES THE OUTCOME, NOT COLOUR. A circle matched, a triangle is an
 * exception, a hollow diamond was not checked. The same rule as every status chip
 * in this product, and here it matters twice over: this screen will be projected,
 * greyscaled and photocopied, and 300 marks is exactly the density at which a
 * colour difference stops being legible anyway.
 *
 * ONE TAB STOP, NOT THREE HUNDRED. The grid is a single composite widget with a
 * roving tabindex: Tab enters it once, the arrow keys move between marks, Home
 * and End jump to the ends, and Enter or Space selects. Making every mark a tab
 * stop would put 300 stops between the summary and the exception list, which is
 * a keyboard trap in everything but name. Every row is still individually
 * reachable, which is the requirement - a refused row that cannot be inspected is
 * a refused row that has been hidden.
 */

import { useEffect, useRef, useState } from "react";
import type { EmployerFinding } from "@/lib/api";
import { T, useT } from "../ui/Prefs";

/** The three outcomes, and the mark each gets. Keyed by the union the API
 * publishes, so a fourth outcome does not compile until it has a shape. */
const MARK: Record<EmployerFinding["outcome"], { path: React.ReactNode; word: "employer.matched" | "employer.exception" | "employer.notChecked" }> = {
  // A filled disc: checked, and it agreed.
  OK: { path: <circle cx="8" cy="8" r="4.4" />, word: "employer.matched" },
  // A triangle - the only angular silhouette, as everywhere else in this product.
  EXCEPTION: { path: <path d="M8 2.6l5.6 10.2H2.4z" />, word: "employer.exception" },
  // A HOLLOW diamond. Open on purpose: nothing was established about this row,
  // and a filled mark would read as a finding.
  REFUSED: { path: <path d="M8 2.4L13.6 8 8 13.6 2.4 8z" />, word: "employer.notChecked" },
};

const FILL: Record<EmployerFinding["outcome"], string> = {
  OK: "fill-ink-3",
  EXCEPTION: "fill-attention-fg",
  REFUSED: "fill-surface stroke-ink-2",
};

export function PayrollConstellation({
  findings,
  selected,
  onSelect,
  filterReason,
}: {
  findings: EmployerFinding[];
  selected: number | null;
  onSelect: (rowNumber: number) => void;
  /** A reason picked from the summary. Rows that do not match are still drawn -
   * they are still in the file - but they lose their emphasis. Nothing is
   * removed from the grid by a filter. */
  filterReason: string | null;
}) {
  const t = useT();
  const grid = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(24);
  // Which mark the single tab stop currently lands on. Starts on the first
  // exception if there is one: it is the reason an employer opened this screen.
  //
  // A LAZY INITIALISER, NOT AN EFFECT. The caller gives this component a `key`
  // per run, so a new file remounts it and this runs again - which is React's
  // own answer to "reset state when the input changes", and avoids the cascading
  // render an effect calling setState would cause.
  const [active, setActive] = useState(() => {
    const first = findings.findIndex((f) => f.outcome === "EXCEPTION");
    return first >= 0 ? first : 0;
  });

  useEffect(() => {
    const el = grid.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // The column count is measured rather than assumed, because the arrow keys
    // need it: "down" is "forward by one row", and a row is however many marks
    // the container actually fits at this width and text size.
    const measure = () => {
      const width = el.clientWidth;
      const per = 22; // one mark plus its gap, in px
      setColumns(Math.max(4, Math.floor(width / per)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function move(next: number) {
    const clamped = Math.max(0, Math.min(findings.length - 1, next));
    setActive(clamped);
    const el = grid.current?.querySelector<HTMLElement>(`[data-cell="${clamped}"]`);
    el?.focus();
  }

  return (
    <div>
      <div
        ref={grid}
        role="grid"
        aria-label={t("employer.constellation")}
        aria-rowcount={Math.ceil(findings.length / columns)}
        aria-colcount={columns}
        className="flex flex-wrap gap-1"
        onKeyDown={(e) => {
          const step: Record<string, number> = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: columns,
            ArrowUp: -columns,
          };
          if (e.key in step) {
            e.preventDefault();
            move(active + step[e.key]);
          } else if (e.key === "Home") {
            e.preventDefault();
            move(0);
          } else if (e.key === "End") {
            e.preventDefault();
            move(findings.length - 1);
          }
        }}
      >
        {findings.map((f, i) => {
          const dim = filterReason !== null && f.reason !== filterReason;
          const isSelected = selected === f.row_number;
          return (
            <button
              key={f.row_number}
              type="button"
              data-cell={i}
              role="gridcell"
              tabIndex={i === active ? 0 : -1}
              aria-selected={isSelected}
              onFocus={() => setActive(i)}
              onClick={() => onSelect(f.row_number)}
              // The name carries everything the mark cannot: which row, whose,
              // and what the engine made of it.
              aria-label={`${t("employer.rowSelected", { n: f.row_number })}, ${
                f.employee_name
              }, ${t(MARK[f.outcome].word)}${f.reason ? `, ${f.reason}` : ""}`}
              /* THE SELECTED MARK HAS TO BE FINDABLE AMONG THREE HUNDRED. A
                 `bg-sunken` fill behind a 16px glyph was invisible at this
                 density - a reader who clicked a triangle and read the row in the
                 inspector could not then point at which triangle it was. A ring
                 in the ink colour, drawn OUTSIDE the mark so it does not touch
                 the shape, is legible at a glance and costs no layout: the
                 element keeps its size and only its outline changes. */
              className={`rounded-full ${
                isSelected ? "outline outline-2 outline-offset-1 outline-ink" : ""
              }`}
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className={`h-4 w-4 ${dim ? "text-ink-3" : ""}`}
                fill="none"
                stroke="none"
              >
                <g
                  className={`${FILL[f.outcome]} ${dim ? "fill-line" : ""}`}
                  strokeWidth="1.6"
                >
                  {MARK[f.outcome].path}
                </g>
              </svg>
            </button>
          );
        })}
      </div>

      <p className="max-w-measure mt-3 text-meta text-ink-3">
        <T k="employer.constellationNote" /> <T k="employer.keyboardHint" />
      </p>

      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {(["OK", "EXCEPTION", "REFUSED"] as const).map((outcome) => (
          <li key={outcome} className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="none">
              <g className={FILL[outcome]} strokeWidth="1.6">
                {MARK[outcome].path}
              </g>
            </svg>
            <span className="text-meta text-ink-2">
              <T k={MARK[outcome].word} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
