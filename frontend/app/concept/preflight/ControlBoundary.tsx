"use client";

/**
 * Who is allowed to do what, drawn once.
 *
 * THIS IS THE PRODUCT, MORE THAN ANY SCREEN IN FRONT OF IT. FairSlip reads,
 * calculates, explains and prepares. A person approves. The system of record
 * executes. FairSlip then checks the result independently. Every arrow points
 * one way and the interesting one is the one that is missing: there is no arrow
 * from FairSlip into payroll.
 *
 * DRAWN WITH BORDERS, NOT AN SVG. The labels are HTML, so they scale with the
 * text-size control and stay selectable; text baked into a viewBox does
 * neither. It is the same idiom the landing page's two-surfaces diagram uses,
 * for the same reason.
 *
 * THE WORD "AUTONOMOUS" DOES NOT APPEAR, and nor does any of its family. Not
 * because it is a bad word but because it would be a false one: nothing here
 * acts without a person, and a diagram is the wrong place to leave that
 * ambiguous.
 */

const STEPS: { who: string; does: string; note: string }[] = [
  {
    who: "FairSlip",
    does: "Detect, calculate, explain, prepare",
    note: "Reads the exports, applies the published rules, shows the working, drafts a change.",
  },
  {
    who: "A person",
    does: "Approve",
    note: "Decides whether the change is right. Nothing moves without this.",
  },
  {
    who: "The payroll system",
    does: "Execute",
    note: "Makes the change, in the system that owns the money.",
  },
  {
    who: "FairSlip",
    does: "Recheck",
    note: "Runs the same checks over the corrected file and reports what moved.",
  },
];

export function ControlBoundary({ className = "" }: { className?: string }) {
  return (
    <figure className={className}>
      <figcaption className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        Who does what
      </figcaption>
      <ol className="mt-4">
        {STEPS.map((step, i) => (
          <li key={step.does}>
            <div className="rounded-sm border border-line-strong bg-surface px-4 py-3">
              <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
                {step.who}
              </p>
              <p className="text-body font-semibold text-ink">{step.does}</p>
              <p className="max-w-measure mt-1 text-meta text-ink-2">{step.note}</p>
            </div>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="ml-6 block h-5 w-0 border-l-2 border-ink-2" />
            )}
          </li>
        ))}
      </ol>
      <p className="max-w-measure mt-4 text-meta text-ink-3">
        There is no arrow from FairSlip into payroll, and that is the design rather than a
        limitation of the prototype. FairSlip never writes to a payroll system, never files
        anything with an authority, and never rules on what a difference means in law.
      </p>
    </figure>
  );
}
