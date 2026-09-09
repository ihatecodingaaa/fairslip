"use client";

/**
 * The reconciliation, drawn.
 *
 * THE RULE THIS FILE EXISTS UNDER: every mark comes from a value an engine
 * produced. No smoothing, no rounding into a nicer number, no placeholder bar
 * for a component that was not returned, no shape drawn to make a layout
 * balance. A chart that looks complete when the data is not is the failure this
 * product exists to find.
 *
 * TWO KINDS OF DERIVATION, and the line between them is the whole discipline:
 *
 *   GEOMETRY may be derived. A bar's length is `exact / axisMax`, computed
 *   here, because that is what drawing a bar chart IS - no bar chart can exist
 *   without dividing by a maximum.
 *
 *   NUMBERS MAY NOT. Every figure rendered as TEXT is `money()` of a Money the
 *   backend built from an engine's Decimal. Nothing here adds, subtracts,
 *   averages or percentages anything into a string a reader can see. That is
 *   CLAUDE.md's rule - "any UI number must be a Component.amount or a CpfResult
 *   field, rounded for display only" - and a chart is not an exemption from it.
 *   backend/tests/test_charts.py holds both halves.
 *
 * WHY SVG AND NOT DIVS. The print block in globals.css sets
 * `background-color: #ffffff` and `background-image: none` on `*`, so a bar
 * drawn as a div with a background - or hatched with a repeating gradient - is
 * INVISIBLE on the take-away sheet. It would look right on screen and print as
 * a page of empty labels. SVG `fill` is a different property and survives.
 * This was checked before a line was written, not after.
 *
 * WHY NO COLOUR CARRIES MEANING. In print every foreground token collapses to
 * #000000 and every fill token to #ffffff, so two bars differing only in colour
 * become one bar twice. Meaning rides on POSITION (where a bar starts on the
 * money axis), on the SIGN in its label, and - where segments genuinely need
 * telling apart - on a PATTERN. Colour is decoration over an encoding that
 * already works without it, the same rule the status chips follow.
 *
 * NO CHARTING LIBRARY. These are rectangles on a shared axis. The smallest
 * plausible dependency would add more bundle than this whole file and would
 * take the accessible names out of our hands - and the accessible names are
 * half the point, because every chart here is also its own text.
 */

import { useId, useState } from "react";
import { T } from "../ui/Prefs";
import { money, type Money, type PayBreakdown, type SplitLine } from "@/lib/api";

/** The money axis, in engine units. Geometry only - never rendered as text. */
function value(m: Money): number {
  const n = Number(m.exact);
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------ the waterfall */

/** One step of the reconstruction. `from` and `to` are positions on the money
 * axis; the bar is drawn between them. `kind` decides how it reads, never what
 * it is worth. */
type Step = {
  key: string;
  label: string;
  amount: Money;
  from: number;
  to: number;
  kind: "add" | "subtract" | "subtotal" | "gap";
  formula?: string;
  inputs?: string[];
};

/**
 * Build the steps from the breakdown, in the order the arithmetic happens.
 *
 * COMPONENTS ARE NOT LISTED HERE. They are whatever the engine returned, in the
 * order it returned them - so a month with no rest day has three bars and a
 * month with rest-day overtime has four, and neither case is written down in
 * this file. A component the engine did not produce gets no bar. Not a zero
 * bar, not a greyed bar: no row at all, because a zero-height bar is a drawing
 * of a fact and there is no fact there.
 *
 * The last two steps are worth reading twice. `net_paid` is drawn as a step
 * DOWN from expected net, so what remains on the axis is the difference - the
 * gap is not a bar someone chose to add at the end, it is what is left when the
 * money that actually arrived has been taken off.
 */
export function stepsFor(b: PayBreakdown): Step[] {
  const steps: Step[] = [];
  let running = 0;

  for (const c of b.components) {
    const v = value(c.amount);
    steps.push({
      key: `component:${c.label}`,
      label: c.label.replace(/_/g, " "),
      amount: c.amount,
      from: running,
      to: running + v,
      kind: "add",
      formula: c.formula,
      inputs: c.inputs,
    });
    running += v;
  }

  steps.push({
    key: "expected_gross",
    label: "result.expectedGross",
    amount: b.expected_gross,
    from: 0,
    to: value(b.expected_gross),
    kind: "subtotal",
  });
  steps.push({
    key: "deductions_total",
    label: "result.deductions",
    amount: b.deductions_total,
    from: value(b.expected_gross) - value(b.deductions_total),
    to: value(b.expected_gross),
    kind: "subtract",
  });
  steps.push({
    key: "expected_net",
    label: "result.expectedNet",
    amount: b.expected_net,
    from: 0,
    to: value(b.expected_net),
    kind: "subtotal",
  });
  steps.push({
    key: "net_paid",
    label: "result.reachedBank",
    amount: b.net_paid,
    from: value(b.expected_net) - value(b.net_paid),
    to: value(b.expected_net),
    kind: "subtract",
  });
  steps.push({
    key: "difference",
    label: "result.difference",
    amount: b.difference,
    from: 0,
    to: value(b.difference),
    kind: "gap",
  });

  return steps;
}

/** Translated where the label is a dictionary key; the engine's own word where
 * it is a component name. Component labels are the engine's vocabulary and are
 * not ours to translate. */
function StepLabel({ label }: { label: string }) {
  if (label.startsWith("result.")) return <T k={label as "result.expectedGross"} />;
  return <span>{label}</span>;
}

/**
 * The smallest mark a produced value gets, in axis units out of 1000.
 *
 * It is a PRESENCE mark, not a length: it says "the engine returned a value on
 * this line", and it is deliberately too small to be read as a magnitude and
 * too big to disappear. A difference of exactly zero gets this and nothing
 * more - the row reads $0.00 beside it, and no width is manufactured to stand
 * for a number that is not there.
 */
const MIN_MARK = 2;

/**
 * Whether this step's bar can be drawn as a length at all.
 *
 * A LENGTH CANNOT BE NEGATIVE, AND A MINIMUM MARK IS NOT AN HONEST SUBSTITUTE
 * FOR ONE. When more money reached the bank than the rules reconstruct, the
 * engine's difference is a negative Decimal - and `Math.max(negative, MIN_MARK)`
 * drew the presence mark, which on a signed row reads as a small positive
 * quantity. That is the one thing a bar chart must never do: say a magnitude
 * the data does not carry.
 *
 * So the gap row draws no bar in that case and says why, in words, in the
 * reader's language - the same answer the CPF chart already gives when its
 * split is incomplete. The SIGNED AMOUNT IS UNTOUCHED: it is still
 * `money(s.amount)` beside the label, exactly as the backend supplied it.
 *
 * Scoped to the gap. Every other step is drawn between two positions the
 * engine's own running total put in order, and widening this would be a change
 * to rows that have no sign to get wrong.
 */
function drawableAsLength(s: Step): boolean {
  return s.kind !== "gap" || value(s.amount) >= 0;
}

const SIGN: Record<Step["kind"], string> = {
  add: "+",
  subtract: "−",
  subtotal: "=",
  gap: "",
};

export function Waterfall({ breakdown }: { breakdown: PayBreakdown }) {
  const steps = stepsFor(breakdown);
  const [open, setOpen] = useState<string | null>(null);
  const uid = useId();

  // One axis for every bar, or the picture lies about relative size - which is
  // the one thing a bar chart is for.
  const axisMax = Math.max(...steps.map((s) => s.to), 0);
  const u = (n: number) => (axisMax > 0 ? (n / axisMax) * 1000 : 0);

  return (
    <section aria-labelledby={`${uid}-h`} className="border-b border-line px-5 py-4">
      <h3 id={`${uid}-h`} className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="chart.reconciliation" />
      </h3>

      {/*
        THE TEXT EQUIVALENT IS THE LIST ITSELF.

        The first version put a visually-hidden <table> here and marked the
        visible list aria-hidden. That was worse three ways at once: a second
        copy of every figure that could drift from the first, formula buttons
        unreachable by keyboard, and focusable elements inside an aria-hidden
        region - which is its own axe violation. The rows below already ARE
        text: a sign, a label and an amount. Only the <svg> is hidden, because a
        bar says nothing its row has not already said.
      */}
      <ol className="mt-3 space-y-1">
        {steps.map((s) => {
          const isOpen = open === s.key;
          const hero = s.kind === "gap";
          return (
            <li key={s.key} className={s.kind === "subtotal" ? "pt-2" : ""}>
              <button
                type="button"
                onClick={() => s.formula && setOpen(isOpen ? null : s.key)}
                aria-expanded={s.formula ? isOpen : undefined}
                className={`block w-full rounded-sm px-2 py-1 text-left ${
                  hero ? "bg-attention-bg" : ""
                } ${s.formula ? "" : "cursor-default"}`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={hero ? "text-body font-semibold text-ink" : "text-meta text-ink-2"}
                  >
                    <span className="font-mono">{SIGN[s.kind]}</span> <StepLabel label={s.label} />
                  </span>
                  <span
                    className={`tabular-nums ${
                      hero ? "text-title font-semibold text-ink" : "text-meta font-medium text-ink"
                    }`}
                  >
                    {money(s.amount)}
                  </span>
                </span>

                {/*
                  viewBox 0..1000 with preserveAspectRatio="none" so the bar
                  stretches to any column width without a measurement pass -
                  which is why every bar here is a plain rect. A stroke or a
                  pattern would be stretched with it; those live in the CPF
                  chart, which counters the stretch explicitly.

                  A row that cannot be drawn as a length gets no <svg> at all,
                  not an empty one: an empty track beside a signed amount is
                  still a picture, and it is a picture of zero. The sentence
                  that replaces it is real text, in the reader's language, which
                  keeps this row's contract - everything the bar said, the row
                  already says in words - true from the other direction.
                */}
                {drawableAsLength(s) ? (
                  <svg
                    viewBox="0 0 1000 10"
                    preserveAspectRatio="none"
                    role="presentation"
                    aria-hidden
                    className={`mt-1 block w-full ${hero ? "h-4" : "h-2.5"}`}
                  >
                    <rect x="0" y="0" width="1000" height="10" className="fill-sunken" />
                    <rect
                      x={u(s.from)}
                      y="0"
                      /* A value the engine produced is always at least a visible
                         mark - see MIN_MARK. The floor only ever raises a length
                         towards visibility; it is never reached from below by a
                         negative one, because a step that could be negative does
                         not get here at all. */
                      width={Math.max(u(s.to - s.from), MIN_MARK)}
                      height="10"
                      className={
                        s.kind === "subtotal"
                          ? "fill-line-strong"
                          : hero
                            ? "fill-ink"
                            : s.kind === "subtract"
                              ? "fill-ink-3"
                              : "fill-brand"
                      }
                    />
                  </svg>
                ) : (
                  <span className="max-w-measure mt-1 block text-meta font-normal text-ink-2">
                    <T k="chart.differenceNegative" />
                  </span>
                )}
              </button>

              {isOpen && s.formula && (
                <div className="mt-1 rounded-sm border border-line px-3 py-2">
                  <p className="font-mono text-meta text-ink-2">{s.formula}</p>
                  <ul className="mt-1 space-y-1 text-meta text-ink-3">
                    {(s.inputs ?? []).map((src) => (
                      <li key={src}>&larr; {src}</li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="max-w-measure mt-3 text-meta text-ink-3">
        <T k="chart.toScale" />
      </p>
    </section>
  );
}

/* ------------------------------------------------- the CPF overlap, drawn */

const CASH = "cash_shortfall";
const EMPLOYEE = "employee_cpf_on_shortfall";
const EMPLOYER = "employer_cpf_on_shortfall";
const GROSS = "gross_shortfall";
const CPF = "cpf_shortfall";
const TOTAL = "total_withheld";
const NEEDED = [CASH, EMPLOYEE, EMPLOYER, GROSS, CPF, TOTAL];

/**
 * The overlap, drawn as an overlap.
 *
 * This is the one picture the numbers cannot make on their own. $62.24 of wage
 * and $23.00 of CPF share the $12.00 of employee contribution on the missing
 * wage, so adding them gives $85.24 and counts that share twice. The honest
 * total is $73.24 and it is the only combined figure that exists.
 *
 *     |------- gross shortfall -------|
 *     [ cash ][ employee ][ employer ]
 *             |------ CPF missing ----|
 *
 * The middle segment sits under both brackets. That is the overlap: not a
 * caption about one, the thing itself.
 *
 * Every segment length is an `exact` from shortfall_split(). The identities
 * cash + employee + employer == total and cash + employee == gross are the
 * backend's and are tested there; this file lays the segments end to end and
 * they close because the engine's numbers close.
 */
export function CpfOverlapBar({ split }: { split: SplitLine[] }) {
  const uid = useId();
  const by: Record<string, SplitLine> = Object.fromEntries(split.map((l) => [l.key, l]));

  // Refuse to draw rather than draw something incomplete. A missing key means
  // this is not the split this chart knows how to show, and a bar with a
  // segment silently left out would still look like a finished bar.
  if (NEEDED.some((k) => !by[k])) {
    return (
      <p className="max-w-measure rounded-sm border border-attention-line px-3 py-2 text-meta text-attention-fg">
        <T k="chart.cpfUndrawable" />
      </p>
    );
  }

  const cash = value(by[CASH].amount);
  const employee = value(by[EMPLOYEE].amount);
  const employer = value(by[EMPLOYER].amount);
  const total = value(by[TOTAL].amount);
  if (total <= 0) return null;

  const W = 1000;
  const x = (n: number) => (n / total) * W;
  const pc = (n: number) => `${(n / total) * 100}%`;
  const BAR_H = 44;

  const seg = [
    { key: CASH, at: 0, len: cash, fill: `url(#${uid}-cash)` },
    { key: EMPLOYEE, at: cash, len: employee, fill: `url(#${uid}-emp)` },
    { key: EMPLOYER, at: cash + employee, len: employer, fill: `url(#${uid}-er)` },
  ];

  return (
    <section aria-labelledby={`${uid}-h`}>
      <h4 id={`${uid}-h`} className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="chart.cpfOverlap" />
      </h4>

      {/* THE BRACKET LABELS ARE THE AMOUNTS ONLY, and that is a width decision.
          At 390px the CPF bracket is 31% of the column - about 120px - and the
          full label wraps to four lines inside it. The words are in the list
          below, where they have the whole width; the amounts ride the brackets,
          where they are the thing you are trying to read off the picture. */}
      <div className="mt-3" style={{ width: pc(cash + employee) }}>
        <span className="block text-meta font-semibold tabular-nums text-ink">
          {money(by[GROSS].amount)}
        </span>
        <span className="block h-1.5 border-x-2 border-t-2 border-ink" aria-hidden />
      </div>

      <svg
        viewBox={`0 0 ${W} ${BAR_H}`}
        preserveAspectRatio="none"
        role="presentation"
        aria-hidden
        className="block h-11 w-full"
      >
        <defs>
          {/* Pattern, not colour. In print every fill token is black or white,
              so three segments differing only in colour print as one segment
              three times. These stay apart on a projector, in greyscale and on
              a second-generation photocopy.
              vectorEffect keeps the stroke honest under the horizontal stretch
              preserveAspectRatio="none" applies - without it the hatch flattens
              towards horizontal as the column widens. */}
          {/* THE TILE IS 22 UNITS, NOT 12, AND THAT IS A 390px DECISION.
              The pattern tile lives in the stretched user space, so its width on
              screen is (tile / 1000) x the column. At 12 units a 350px column
              gave a 4px tile: the hatch closed up into a solid block and the
              dots merged into a bar, so two of the three segments stopped being
              distinguishable at exactly the width where the legend is furthest
              from the bar. At 22 it is ~7px at 390 and ~14px at 1400 - coarse
              enough to read at the narrow end, fine enough not to look like
              wallpaper at the wide one. */}
          <pattern id={`${uid}-cash`} width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" className="fill-surface" />
            <path
              d="M-5 27 L27 -5"
              className="stroke-ink"
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
          <pattern id={`${uid}-emp`} width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" className="fill-ink" />
          </pattern>
          <pattern id={`${uid}-er`} width="22" height="22" patternUnits="userSpaceOnUse">
            <rect width="22" height="22" className="fill-surface" />
            <circle cx="11" cy="11" r="5.5" className="fill-ink" />
          </pattern>
        </defs>

        {seg.map((s) => (
          <rect
            key={s.key}
            x={x(s.at)}
            y="2"
            width={x(s.len)}
            height={BAR_H - 4}
            fill={s.fill}
            className="stroke-ink"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* The CPF bracket, under the span it covers - offset by the cash segment
          so it starts on the employee share. The segment both brackets reach is
          the overlap, and it is the $12.00 line in the list below. */}
      <div className="flex">
        <span style={{ width: pc(cash) }} aria-hidden />
        <span style={{ width: pc(employee + employer) }}>
          <span className="block h-1.5 border-x-2 border-b-2 border-ink" aria-hidden />
          <span className="block text-meta font-semibold tabular-nums text-ink">
            {money(by[CPF].amount)}
          </span>
        </span>
      </div>

      {/* The labels live in HTML, not in the SVG: they have to scale with the
          text-size control and translate with everything else, and text baked
          into a viewBox does neither. Each carries the swatch of its segment,
          so legend and bar are matched by shape rather than by the reader's
          memory of a colour. */}
      <dl className="mt-4 space-y-1">
        {([CASH, EMPLOYEE, EMPLOYER] as const).map((k) => (
          <div key={k} className="flex flex-wrap items-baseline gap-x-2">
            <Swatch kind={k} />
            <dt className="max-w-measure flex-1 text-meta text-ink-2">{by[k].label}</dt>
            <dd className="text-meta font-medium tabular-nums text-ink">{money(by[k].amount)}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-3 space-y-1 border-t border-line-strong pt-2">
        {[GROSS, CPF, TOTAL].map((k) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt className={`text-meta ${k === TOTAL ? "font-semibold text-ink" : "text-ink-2"}`}>
              {by[k].label}
            </dt>
            <dd
              className={`tabular-nums ${
                k === TOTAL ? "text-body font-semibold text-ink" : "text-meta font-medium text-ink"
              }`}
            >
              {money(by[k].amount)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A fixed-size, undistorted copy of one bar pattern. */
function Swatch({ kind }: { kind: typeof CASH | typeof EMPLOYEE | typeof EMPLOYER }) {
  const uid = useId();
  return (
    <svg viewBox="0 0 16 16" aria-hidden role="presentation" className="mt-1 h-4 w-4 shrink-0">
      <defs>
        <pattern id={uid} width="8" height="8" patternUnits="userSpaceOnUse">
          {kind === EMPLOYEE ? (
            <rect width="8" height="8" className="fill-ink" />
          ) : kind === CASH ? (
            <>
              <rect width="8" height="8" className="fill-surface" />
              <path d="M-2 10 L10 -2" className="stroke-ink" strokeWidth="2.6" />
            </>
          ) : (
            <>
              <rect width="8" height="8" className="fill-surface" />
              <circle cx="4" cy="4" r="2.2" className="fill-ink" />
            </>
          )}
        </pattern>
      </defs>
      <rect
        x="0.9"
        y="0.9"
        width="14.2"
        height="14.2"
        fill={`url(#${uid})`}
        className="stroke-ink"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export type { Step };
