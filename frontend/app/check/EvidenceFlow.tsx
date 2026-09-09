"use client";

/**
 * The pipeline this screen is actually running, drawn once and then filled in.
 *
 * The claim "two readers transcribe your documents independently, and where they
 * disagree you decide" was a paragraph above the file picker. It is a SHAPE -
 * three documents converging on two readers, the readers converging on a set of
 * facts, the facts on a figure - and a shape is what a person can check against
 * what they are looking at. The paragraph is still on the page, as this figure's
 * caption, where a caption belongs.
 *
 * THE SAME DIAGRAM BEFORE AND AFTER, which is the point of it. Before the read it
 * is the plan; during the read the readers box says the readers are reading;
 * after the read the same three boxes carry what actually happened - which
 * documents went in, which reader answered, and how much of the month the two of
 * them settled between them.
 *
 * EVERY NUMBER IS COUNTED, NEVER WRITTEN DOWN. The counts come from
 * `countFields`, the one function ReaderComparison's tally and its row chips also
 * use, over `extract.read_fields` - so this diagram cannot say four established
 * while the table below it shows three. There is no progress bar, no percentage
 * and no reasoning trace: the states drawn here are the states the response
 * carries, and nothing else is invented to fill the wait.
 *
 * BORDERS, NOT AN SVG. Same technique as the independence diagram: the labels are
 * HTML, so they scale with the text-size control, translate with the rest of the
 * interface and wrap in four scripts. Text baked into a viewBox does none of it.
 */

import type { ExtractOut } from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { T, useT } from "../ui/Prefs";
import { countFields } from "./ReaderComparison";

type Doc = { label: Key; present: boolean };

export function EvidenceFlow({
  docs,
  reading,
  extract,
  answers,
  checked,
  headingRef,
}: {
  docs: Doc[];
  /** The readers are running right now. The one state this component is told
   * rather than reading off a response, because there is no response yet. */
  reading: boolean;
  extract: ExtractOut | null;
  answers: Record<string, string>;
  /** The engine has produced a breakdown. Passed in because the stage that owns
   * it is a sibling of this one. */
  checked: boolean;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const counts = extract ? countFields(extract.read_fields, answers) : null;
  const established = counts ? counts.agreed + counts.confirmed : 0;
  const needYou = counts ? counts.disagreed + counts.missing : 0;

  return (
    <figure className="rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-meta font-semibold uppercase tracking-wide text-ink-3"
      >
        <T k="flow.heading" />
      </h2>

      {/* FOUR STAGES ON ONE LINE, and the evidence is the first of them.
          A bracket converging three chips onto a box below was the first
          drawing, and it read as a stray rule: the chips are left-aligned and
          the bracket was centred on a much wider figure, so the line pointed at
          nothing. Four cells and three arrows say the same sequence with no
          geometry to get wrong at any width, and the three documents inside the
          first cell are visibly one input to what follows. */}
      {/* ONE ROW ONLY WHERE FOUR BOXES AND THREE ARROWS ACTUALLY FIT. At `sm`
          they did not: at 768px with 125% text the seven tracks came to 807px
          and the last box hung 39px off the right of the page, because a `1fr`
          track is floored at its own min-content. Below `lg` the sequence runs
          down the page instead, which is the same sequence and reads the same
          way. `min-w-0` on each box is the other half - it lets a long label
          wrap rather than widen its track. */}
      <ol className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
        <Stage titleKey="evidence.heading" done={docs.some((d) => d.present)} active={false}>
          <ul className="flex flex-wrap gap-1">
            {docs.map((d) => (
              <li
                key={d.label}
                className={`rounded-sm border px-2 py-1 text-meta font-medium ${
                  d.present
                    ? "border-line-strong bg-muted text-ink"
                    : "border-dashed border-control text-ink-3"
                }`}
              >
                <T k={d.label} />
              </li>
            ))}
          </ul>
        </Stage>

        <Arrow />

        <Stage titleKey="flow.readers" done={extract !== null} active={reading}>
          {extract ? (
            <ul className="space-y-1">
              {extract.readers.slice(0, 2).map((r) => (
                <li key={r.key} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-meta font-semibold text-ink">{r.provider}</span>
                  <span
                    className={`text-meta font-semibold ${
                      r.ok ? "text-agreed-fg" : "text-danger-fg"
                    }`}
                  >
                    {r.ok ? `✓ ${t("check.answered")}` : `✕ ${t("check.didNotAnswer")}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : reading ? (
            <p className="text-meta font-semibold text-brand-fg">
              <T k="evidence.readingNow" />
            </p>
          ) : (
            <NotStarted />
          )}
        </Stage>

        <Arrow />

        <Stage titleKey="flow.establish" done={counts !== null} active={false}>
          {counts ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1">
              <Count n={counts.total} labelKey="readers.fields" />
              <Count n={established} labelKey="establish.established" />
              <Count n={needYou} labelKey="establish.needYou" />
            </dl>
          ) : (
            <NotStarted />
          )}
        </Stage>

        <Arrow />

        <Stage titleKey="flow.check" done={checked} active={false}>
          {checked ? (
            <p className="text-meta font-semibold text-agreed-fg">
              ✓ <T k="stage.reached" />
            </p>
          ) : (
            <NotStarted />
          )}
        </Stage>
      </ol>

      {/* The paragraph this figure replaced, kept as its caption - which is what
          a sentence under a diagram of the thing it describes actually is. */}
      <figcaption className="max-w-measure mt-4 text-meta text-ink-2">
        <T k="check.intro" />
      </figcaption>
    </figure>
  );
}

function Stage({
  titleKey,
  done,
  active,
  className = "",
  children,
}: {
  titleKey: Key;
  done: boolean;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`min-w-0 rounded-sm border-2 px-3 py-2 ${className} ${
        active
          ? "border-brand-line bg-brand-bg"
          : done
            ? "border-ink-2 bg-surface"
            : "border-dashed border-control bg-canvas"
      }`}
    >
      <p className={`text-body font-semibold ${done || active ? "text-ink" : "text-ink-3"}`}>
        <T k={titleKey} />
      </p>
      <div className="mt-1">{children}</div>
    </li>
  );
}

/** The arrow between two stages: down until the row fits, along after. It is
 * decorative - the list order carries the sequence for a screen reader. */
function Arrow() {
  return (
    <li aria-hidden className="flex items-center justify-center text-lead text-ink-3">
      <span className="lg:hidden">&darr;</span>
      <span className="hidden lg:inline">&rarr;</span>
    </li>
  );
}

function NotStarted() {
  return (
    <p className="text-meta text-ink-3">
      <T k="flow.notStarted" />
    </p>
  );
}

function Count({ n, labelKey }: { n: number; labelKey: Key }) {
  return (
    /* dt before dd in the source, number first on the screen. A definition
       list whose dd precedes its dt is not one, and `order` costs nothing. */
    <div className="flex items-baseline gap-1">
      <dt className="order-2 text-meta text-ink-2">
        <T k={labelKey} />
      </dt>
      <dd className="order-1 text-body font-semibold tabular-nums text-ink">{n}</dd>
    </div>
  );
}
