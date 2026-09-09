"use client";

/**
 * The signed shape of the payroll: every checked row as a difference around zero.
 *
 * WHAT THIS ANSWERS THAT THE CONSTELLATION CANNOT. The grid says which rows are
 * exceptions. It cannot say that one of them is $340 and the other nine are
 * under $25 - and that is the difference between a payroll to look at on Monday
 * and a payroll to stop tonight. Here the bar's LENGTH is the money and its
 * DIRECTION is the sign, so the eleven exceptions arrive already ranked.
 *
 * THE GROUND IS NOT EMPTY. Every checked row that matched is a tick on the zero
 * line. That is 282 of the 300 on the demo file, and drawing them is what makes
 * the spikes mean anything: a chart of eleven bars alone would be a chart of
 * eleven bars, not a picture of a payroll. It is also the honest shape - "flat,
 * with these exceptions" is the finding.
 *
 * A BAR IS ALWAYS AN EXCEPTION AND A TICK IS ALWAYS A MATCH, and that is the
 * engine's doing rather than this file's: fairslip/employer.check_row() returns
 * OK exactly when the difference is zero. So the two encodings cannot disagree
 * with the outcome the grid draws for the same row.
 *
 * REFUSED ROWS HAVE THEIR OWN LANE, BELOW THE AXIS AND SEPARATED FROM IT. They
 * are not at zero. A row nobody computed sitting on the zero line would read as
 * a row that was computed and came out level - which is this product's own
 * failure mode, drawn. They keep their x position, so the file's shape carries
 * across both bands, and they are hollow diamonds exactly as they are in the
 * grid.
 *
 * SIGN IS NEVER TAKEN AWAY. `difference` is declared less expected, so up is
 * "declared more than the published rules give" and down is "declared less".
 * The ONLY absolute value in this file is the shared scale - one magnitude for
 * both directions, so a $340 over and a $340 under are the same height - and it
 * never reaches a number on the screen.
 *
 * TWO LAYERS, ON PURPOSE. The picture is one <svg>, which is what makes
 * "Download SVG" the real rendered geometry rather than a rebuild. The
 * interaction is a layer of ordinary HTML buttons on top of it, one per row,
 * each a full-height column wide - which is a 4px bar's worth of information
 * with a 40px target, and which keeps the focus ring, the roving tab stop and
 * the accessible name on elements every assistive technology already handles.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { money, type EmployerFinding } from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { T, useT } from "../ui/Prefs";

/** Row order on the x axis. Presentation only: the values never move. */
export type SkylineOrder = "file" | "largest";

/* THE TWO HALVES ARE SIZED TO THE DATA AND SHARE ONE SCALE, and those are two
   different statements that have to both be true.
   
   Fixed halves - 116px up, 116px down - wasted a third of the canvas on the demo
   file, where ten of the eleven exceptions are over-declarations: the negative
   region held one short bar and 110px of nothing, and the label naming that
   region ended up adrift beside the refused lane, reading as though it named it.
   
   So each half is allocated in proportion to the largest magnitude actually
   pointing that way. What is NOT rescaled is the pixels-per-dollar: both halves
   divide the same total by the same total magnitude, so a $340 over-declaration
   and a $340 under-declaration are still the same height. Sizing the halves
   independently - each to its own maximum - would have made the two directions
   incomparable, which is the one thing this chart exists to let a reader do.
   
   A floor keeps the smaller half visible even when nothing points that way, so
   the axis always has a side and the label always has a home. */
const PLOT = { available: 232, half: 30, gap: 16, lane: 26, pad: 14, labelBand: 4 };

/** Absolute value of a Money's `exact`, for the SHARED SCALE only.
 *
 * This is geometry, not a figure: it decides how tall a bar is and never reaches
 * a text position. The rule the whole product runs on - `money()` takes an
 * engine field, never an expression - is about what is DISPLAYED, and nothing
 * derived here is. */
function magnitude(f: EmployerFinding): number {
  const raw = f.difference?.exact;
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function signOf(f: EmployerFinding): -1 | 0 | 1 {
  const raw = f.difference?.exact;
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n > 0 ? 1 : -1;
}

export function VarianceSkyline({
  findings,
  selected,
  onSelect,
  filterReason,
  order,
  svgRef,
}: {
  findings: EmployerFinding[];
  selected: number | null;
  onSelect: (rowNumber: number) => void;
  filterReason: string | null;
  order: SkylineOrder;
  /** Handed out so the page can serialise exactly what is on screen. */
  svgRef?: React.Ref<SVGSVGElement>;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(880);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setWidth(Math.max(320, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* THE ORDERING IS A COPY, AND THE ROW NUMBER TRAVELS WITH IT. Sorting in
     place would reorder the array the summary, the grid and the inspector all
     read, and "largest difference" would silently become the file's order. */
  const rows = useMemo(() => {
    const copy = findings.map((f, i) => ({ f, fileIndex: i }));
    if (order === "largest") {
      copy.sort((a, b) => magnitude(b.f) - magnitude(a.f) || a.fileIndex - b.fileIndex);
    }
    return copy;
  }, [findings, order]);

  /** One pixels-per-dollar, and a height for each side of the axis. */
  const geo = useMemo(() => {
    let maxPos = 0;
    let maxNeg = 0;
    for (const { f } of rows) {
      const s = signOf(f);
      if (s > 0) maxPos = Math.max(maxPos, magnitude(f));
      else if (s < 0) maxNeg = Math.max(maxNeg, magnitude(f));
    }
    const span = maxPos + maxNeg;
    const perDollar = span > 0 ? PLOT.available / span : 0;
    // Rounded UP, so a half-pixel of rounding can never clip the tallest bar,
    // and so the axis and the lane divider land on whole pixels rather than
    // being antialiased into two grey lines.
    const posH = Math.ceil(Math.max(PLOT.half, maxPos * perDollar));
    const negH = Math.ceil(Math.max(PLOT.half, maxNeg * perDollar));
    const axisY = PLOT.pad + posH;
    const laneY = axisY + negH + PLOT.gap;
    return {
      perDollar,
      scale: Math.max(maxPos, maxNeg),
      axisY,
      laneY,
      height: laneY + PLOT.lane + PLOT.pad,
    };
  }, [rows]);
  const { perDollar, axisY, laneY } = geo;
  const HEIGHT = geo.height;

  const n = Math.max(1, rows.length);
  const step = width / n;
  const barW = Math.max(1.5, Math.min(14, step * 0.62));

  function x(i: number) {
    return i * step + (step - barW) / 2;
  }

  /** Bar height in px, on the ONE shared scale. A zero rate means every checked
   * row matched, and there is then nothing to be proportional to. */
  function height(f: EmployerFinding) {
    if (perDollar === 0) return 0;
    return Math.max(2, magnitude(f) * perDollar);
  }

  function move(next: number) {
    const clamped = Math.max(0, Math.min(rows.length - 1, next));
    setActive(clamped);
    box.current?.querySelector<HTMLElement>(`[data-col="${clamped}"]`)?.focus();
  }

  const scaleLabel = rows.find((r) => magnitude(r.f) === geo.scale && geo.scale > 0)?.f.difference;

  return (
    <div>
      <div ref={box} className="relative">
        <svg
          ref={svgRef}
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={t("employer.skylineAlt", {
            n: findings.filter((f) => f.outcome !== "REFUSED").length,
          })}
          className="block w-full"
        >
          {/* The two half-planes, named on the picture rather than in a caption
              under it. A reader who cannot see the axis labels has the same two
              sentences in every column's accessible name. */}
          <text x={0} y={PLOT.pad - PLOT.labelBand} className="fill-ink-3 text-meta">
            {t("employer.skylineAbove")}
          </text>
          <text x={0} y={laneY - PLOT.gap - PLOT.labelBand} className="fill-ink-3 text-meta">
            {t("employer.skylineBelow")}
          </text>

          <line
            x1={0}
            x2={width}
            y1={axisY}
            y2={axisY}
            className="stroke-line-strong"
            strokeWidth={1}
          />

          {rows.map(({ f }, i) => {
            const dim = filterReason !== null && f.reason !== filterReason;
            const isSel = selected === f.row_number;

            if (f.outcome === "REFUSED") {
              const cx = x(i) + barW / 2;
              const r = Math.max(2.5, Math.min(5, barW / 2 + 1));
              return (
                <path
                  key={f.row_number}
                  d={`M${cx} ${laneY + 5}L${cx + r} ${laneY + 5 + r}L${cx} ${
                    laneY + 5 + r * 2
                  }L${cx - r} ${laneY + 5 + r}Z`}
                  className={`fill-surface ${
                    isSel ? "stroke-ink" : dim ? "stroke-line" : "stroke-ink-2"
                  }`}
                  strokeWidth={isSel ? 2 : 1.2}
                />
              );
            }

            const s = signOf(f);
            if (s === 0) {
              // The ground: a checked row whose difference is zero.
              return (
                <rect
                  key={f.row_number}
                  x={x(i)}
                  y={axisY - 2}
                  width={barW}
                  height={4}
                  className={
                    isSel ? "fill-ink" : dim ? "fill-line" : "fill-ink-3"
                  }
                />
              );
            }

            const h = height(f);
            return (
              <rect
                key={f.row_number}
                x={x(i)}
                y={s > 0 ? axisY - h : axisY}
                width={barW}
                height={h}
                className={
                  isSel ? "fill-ink" : dim ? "fill-line" : "fill-attention-fg"
                }
              />
            );
          })}

          {/* The lane divider. Drawn as a dashed rule so it does not read as a
              second axis: nothing is measured from it. */}
          <line
            x1={0}
            x2={width}
            y1={laneY - PLOT.gap / 2}
            y2={laneY - PLOT.gap / 2}
            className="stroke-line"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <text x={0} y={HEIGHT - 1} className="fill-ink-3 text-meta">
            {t("employer.skylineLane")}
          </text>
        </svg>

        {/* THE INTERACTION LAYER. One button per row, a full column wide and the
            height of the plot, so a 2px bar is a 40px target. One tab stop for
            the whole chart; the arrow keys walk it. */}
        <div
          role="grid"
          aria-label={t("employer.skyline")}
          className="absolute inset-0"
          style={{ height: HEIGHT }}
          onKeyDown={(e) => {
            const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
            if (e.key in step) {
              e.preventDefault();
              move(active + step[e.key]);
            } else if (e.key === "Home") {
              e.preventDefault();
              move(0);
            } else if (e.key === "End") {
              e.preventDefault();
              move(rows.length - 1);
            }
          }}
        >
          {rows.map(({ f }, i) => (
            <button
              key={f.row_number}
              type="button"
              data-col={i}
              role="gridcell"
              tabIndex={i === active ? 0 : -1}
              aria-selected={selected === f.row_number}
              onFocus={() => setActive(i)}
              onClick={() => onSelect(f.row_number)}
              // Everything the bar cannot carry: whose row, which direction, and
              // how much - as the engine's own display string.
              aria-label={describe(f, t)}
              className="absolute top-0 bottom-0"
              style={{ left: `${i * step}px`, width: `${Math.max(step, 3)}px` }}
            />
          ))}
        </div>
      </div>

      {/* The scale, stated. A chart whose tallest bar is unlabelled is a chart
          of relative sizes pretending to be a chart of amounts. */}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-meta text-ink-3">
        {scaleLabel ? (
          <span>
            <T k="employer.skylineScale" />{" "}
            <span className="font-mono tabular-nums text-ink-2">{money(scaleLabel)}</span>
          </span>
        ) : (
          <span>
            <T k="employer.skylineFlat" />
          </span>
        )}
        <span>
          <T k="employer.keyboardHintRow" />
        </span>
      </p>
    </div>
  );
}

/** The accessible name for one column, assembled from fields the engine sent.
 *
 * The amount is `money()` of the row's own Money, so what a screen reader hears
 * is the string the bar stands for - not a rounding this file performed. */
function describe(
  f: EmployerFinding,
  t: (k: Key, v?: Record<string, string | number>) => string,
): string {
  const who = `${t("employer.rowSelected", { n: f.row_number })}, ${f.employee_name}`;
  if (f.outcome === "REFUSED") return `${who}, ${t("employer.notChecked")}`;
  const s = signOf(f);
  if (s === 0 || !f.difference) return `${who}, ${t("employer.matched")}`;
  const direction: Key = s > 0 ? "employer.skylineAbove" : "employer.skylineBelow";
  return `${who}, ${t(direction)}, ${money(f.difference)}`;
}
