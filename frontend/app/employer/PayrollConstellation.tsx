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
// ONE DEFINITION OF THE GLYPHS, shared with the recheck grids and the
// transition summary. Two copies would eventually disagree, and a recheck
// whose "after" triangle means something other than its "before" one is a
// comparison between two vocabularies.
import { FILL, MARK } from "./outcomeMark";

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
      // One mark plus its gap: a 20px mark on an 8px gap. The marks grew from
      // 16px when the grid moved into a 70%-width canvas - at the old 22px pitch
      // a 1100px row was fifty columns of pinheads, which is a texture rather
      // than a picture. 28 is 20 + gap-2, and gap-2 is what the spacing grid
      // allows: test_design_tokens.py rejected the 6px gap this first used.
      const per = 28;
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
        className="flex flex-wrap gap-2"
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
              className={`mark-in rounded-full ${
                isSelected
                  ? "outline outline-[3px] outline-offset-2 outline-ink"
                  : ""
              }`}
              /* THE STAGGER IS A READING ORDER, NOT A PROGRESS BAR. The result
                 is already in hand when the first mark is drawn - see the
                 keyframe's note in globals.css. Capped so the last mark of a
                 three-hundred-row file lands well inside half a second, and
                 collapsed entirely under prefers-reduced-motion. */
              style={{ animationDelay: `${Math.min(i * 1.6, 420)}ms` }}
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className={`h-5 w-5 ${dim ? "text-ink-3" : ""}`}
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
