"use client";

/**
 * Two readers, side by side - the screen that proves the claim rather than
 * making it.
 *
 * "Two independent vision readers" was a sentence under a heading, and the
 * readings themselves were scattered one field at a time down the page: to see
 * that the readers disagreed anywhere you had to read six separate rows and
 * hold them in your head. Put in two columns, the comparison is the picture.
 *
 * WHAT THE COLUMNS SHOW THAT A VERDICT ALONE CANNOT. On the committed cache,
 * `monthly_basic` is "1200.00" from one reader and "1200" from the other, and
 * the verdict is AGREED - because reconciliation normalises to Decimal before
 * comparing. Two different strings, one established value, side by side. That
 * row is the reconciler's whole argument and it was previously invisible.
 *
 * THREE STATES, TOLD APART WITHOUT COLOUR:
 *
 *   agreement    both cells carry a value          + tick-in-ring chip
 *   disagreement both cells carry DIFFERENT values + warning-triangle chip
 *   silence      ONE CELL IS VISIBLY EMPTY         + dashed-ring chip
 *
 * The third is the one that matters and the one colour is worst at. Silence is
 * encoded by POSITION: an empty cell beside a full one, in a fixed grid, is a
 * gap you see before you read anything. The chips are the existing StatusChip
 * shapes, which test_inclusion.py already derives over the FactStatus union and
 * asserts no two of them share a shape or a word.
 *
 * INDEPENDENCE IS DRAWN, NOT ASSERTED. The strip carries a diagram: one source
 * splitting to two readers, the two converging on the reconciler, and NO EDGE
 * BETWEEN THE READERS. The missing edge is the claim. It was a sentence below
 * the table, and a sentence is exactly what a reader has to take on trust -
 * which is the one thing this product does not ask anyone to do.
 */

import { Fragment, useId } from "react";
import { T, useT } from "../ui/Prefs";
import { StatusChip } from "../ui/StatusChip";
import { isEstablished, type Fact, type ReadField, type ReaderInfo } from "@/lib/api";

/**
 * The status a field is IN RIGHT NOW, including an answer the worker has typed.
 *
 * Shared by the counts and by the chip on each row, so the strip cannot report
 * four agreed while the table shows three. One traversal, one definition.
 *
 * `answered` is `answer.trim().length > 0` and nothing more - the same rule
 * ReadFieldRow uses, and for the same reason: "abc" satisfies it, the engine
 * still refuses it, and the chip must not claim an establishment only the
 * engine can grant. docs/debt.md, established-status-mistaken-for-established-value.
 */
export function effectiveStatus(field: ReadField, answer: string): Fact["status"] {
  if (isEstablished(field.fact.status)) return field.fact.status;
  return answer.trim().length > 0 ? "HUMAN_CONFIRMED" : field.fact.status;
}

export type Counts = {
  total: number;
  agreed: number;
  disagreed: number;
  missing: number;
  confirmed: number;
};

/** Counted from the facts, never written down. */
export function countFields(fields: ReadField[], answers: Record<string, string>): Counts {
  const c: Counts = { total: fields.length, agreed: 0, disagreed: 0, missing: 0, confirmed: 0 };
  for (const f of fields) {
    switch (effectiveStatus(f, answers[f.name] ?? "")) {
      case "AGREED":
        c.agreed++;
        break;
      case "DISAGREED":
        c.disagreed++;
        break;
      case "MISSING":
        c.missing++;
        break;
      case "HUMAN_CONFIRMED":
        c.confirmed++;
        break;
    }
  }
  return c;
}

/* --------------------------------------------------------------- the strip */

function Tally({ counts }: { counts: Counts }) {
  const t = useT();
  // Every cell is a count of the same array the table below renders, so the
  // strip and the table cannot disagree about what happened.
  const cells: { label: string; n: number }[] = [
    { label: t("readers.fields"), n: counts.total },
    { label: t("status.AGREED"), n: counts.agreed },
    { label: t("status.DISAGREED"), n: counts.disagreed },
    { label: t("status.MISSING"), n: counts.missing },
  ];
  if (counts.confirmed > 0) cells.push({ label: t("status.HUMAN_CONFIRMED"), n: counts.confirmed });
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col">
          <dd className="order-1 text-title font-semibold tabular-nums text-ink">{c.n}</dd>
          <dt className="order-2 text-meta text-ink-2">{c.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * The independence diagram.
 *
 * Drawn with borders rather than an SVG path, so the labels are HTML: they have
 * to scale with the text-size control and translate with everything else, and
 * text baked into a viewBox does neither. The brackets are border-x/border-t on
 * empty spans - the same technique the CPF overlap bar uses, which survives the
 * print sheet because a border is not a background.
 */
function Independence({ readers }: { readers: ReaderInfo[] }) {
  const two = readers.slice(0, 2);
  if (two.length < 2) return null;
  return (
    <figure className="mt-4">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="readers.sameInput" />
      </p>

      {/* one source, splitting */}
      <div className="mt-1 flex justify-center">
        <span className="block h-3 w-2/3 border-x-2 border-b-2 border-ink-2" aria-hidden />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-x-2">
        {two.map((r, i) => (
          <div
            key={r.key}
            className={`rounded-sm border-2 border-ink-2 px-3 py-2 ${i === 1 ? "order-3" : "order-1"}`}
          >
            {/* provider and model, NOT `label` - which is already
                "Claude (claude-haiku-4-5)" and printed the model twice. */}
            <p className="text-body font-semibold text-ink">{r.provider}</p>
            <p className="font-mono text-meta text-ink-2">{r.model}</p>
          </div>
        ))}

        {/* THE GAP, and the fact that nothing crosses it. */}
        <div className="order-2 flex flex-col items-center justify-center px-1">
          <span
            className="block h-full w-0 border-l-2 border-dashed border-line-strong"
            aria-hidden
          />
          <span className="mt-1 whitespace-nowrap text-meta font-semibold text-ink-2">
            <T k="readers.noLink" />
          </span>
        </div>
      </div>

      {/* two, converging */}
      <div className="flex justify-center">
        <span className="block h-3 w-2/3 border-x-2 border-t-2 border-ink-2" aria-hidden />
      </div>
      <p className="text-center text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="readers.reconciled" />
      </p>

      <figcaption className="max-w-measure mt-2 text-meta text-ink-2">
        <T k="check.readersNote" />
      </figcaption>
    </figure>
  );
}

/* --------------------------------------------------------------- the table */

export function ReaderComparison({
  fields,
  readers,
  answers,
  children,
}: {
  fields: ReadField[];
  readers: ReaderInfo[];
  answers: Record<string, string>;
  /** The answer box for one field, rendered under its row. Passed in rather
   * than built here: this component compares readings, and what a worker is
   * asked to do about a disagreement belongs to the screen that owns the
   * answers. */
  children?: (field: ReadField) => React.ReactNode;
}) {
  const t = useT();
  const uid = useId();
  const counts = countFields(fields, answers);
  const two = readers.slice(0, 2);

  return (
    <section aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="readers.compare" />
      </h3>

      <div className="mt-3">
        <Tally counts={counts} />
      </div>
      <Independence readers={readers} />

      <div className="mt-4 overflow-x-auto" tabIndex={0} role="group" aria-label={t("readers.compare")}>
        {/* NO MIN-WIDTH. A minimum forced a horizontal scroll at 390px and put
            the VERDICT column - the one this screen exists for - off the right
            edge behind it. Without one the browser sizes the columns to the
            content: the label wraps, the two values are short, and the chip
            wraps its own words. The overflow container stays as a safety net
            for a reading longer than anything the readers have returned, so the
            PAGE can never scroll sideways even if the table does. */}
        {/* TABLE-FIXED, and this took three attempts.
            Removing the min-width did nothing and `break-words` did nothing,
            because AUTO table layout sizes columns from each cell's MIN-CONTENT
            width and overflow-wrap does not reduce it. The engine's source
            sentence carries model names - "(claude-haiku-4-5)" - that the
            browser will not break, so one cell's min-content was 415px and
            every column was stretched to match, pushing the VERDICT off a 390px
            screen behind a scrollbar. Fixed layout ignores content width and
            shares the available space, so the columns below are the widths they
            say they are and the cells wrap inside them. */}
        <table className="w-full table-fixed text-left">
          {/* THREE COLUMNS. The verdict chip's narrowest possible box is about
              95px - icon, gap, the word "readers", padding - and four columns
              needing 86 + 70 + 70 + 95 do not fit the 306px a 390px phone
              leaves. Something had to be clipped, and the candidates were a
              worker's field name, a reader's actual reading, or the verdict.
              None of those is acceptable, so the chip moved out of the columns
              and leads the full-width row beneath instead, where it sits
              directly under the two values it is the verdict on. */}
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[32%]" />
            <col className="w-[32%]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-line-strong">
              <th
                scope="col"
                className="py-2 pr-2 text-meta font-semibold uppercase tracking-wide text-ink-3"
              >
                <T k="readers.field" />
              </th>
              {two.map((r) => (
                <th
                  key={r.key}
                  scope="col"
                  className="py-2 pr-2 text-meta font-semibold text-ink-3"
                >
                  <span className="block text-ink">{r.provider}</span>
                  <span className="block font-mono font-normal">{r.model}</span>
                </th>
              ))}

            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {fields.map((f) => {
              const status = effectiveStatus(f, answers[f.name] ?? "");
              const box = children?.(f);
              return (
                // TWO ROWS PER FIELD, and that is a 390px decision.
                //
                // With the engine's source sentence and the answer box inside
                // the four columns, the table could not go below 30rem and the
                // VERDICT column - the one the whole screen exists for - sat
                // off the right edge at 390px behind a horizontal scroll. Both
                // now live in a full-width row beneath, so the four columns
                // carry only a label, two short values and a chip, and the
                // verdict is on screen at every width.
                <Fragment key={f.name}>
                <tr className="align-top">
                  <th scope="row" className="py-3 pr-2 text-body font-medium text-ink">
                    {f.label}
                  </th>
                  {two.map((r) => {
                    const raw = f.readings[r.key];
                    const unreadable = f.unreadable.includes(r.key);
                    return (
                      <td key={r.key} className="py-3 pr-2">
                        {raw === null || raw === undefined ? (
                          // SILENCE, drawn as an absence. A dashed outline
                          // around nothing, in the cell where a value would
                          // be - so the gap is visible before the words are
                          // read, and beside a full cell it is unmissable.
                          // The only boxed cell in the column, and the box is
                          // dashed and empty of a value. Beside a plain number
                          // it is a gap you see before reading anything.
                          // The only boxed cell in the column, and it holds a
                          // dash rather than the words: "answered nothing" needs
                          // 110px and this column is 98px at 390. The dash is
                          // what a sighted reader needs beside a number - the
                          // words are still here for a screen reader, and the
                          // chip below says "not established" in full.
                          <span className="inline-block min-w-[3.5rem] rounded-sm border-2 border-dashed border-missing-line px-2 py-1 text-center">
                            <span aria-hidden className="font-mono text-body text-ink-2">
                              &mdash;
                            </span>
                            <span className="sr-only">{t("field.answeredNothing")}</span>
                          </span>
                        ) : (
                          <span
                            className={`block font-mono text-body tabular-nums ${
                              unreadable ? "text-attention-fg" : "text-ink"
                            }`}
                          >
                            {raw}
                            {unreadable && (
                              <span className="block text-meta">{t("field.notANumber")}</span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td colSpan={1 + two.length} className="pb-3">
                    <div className="mb-1">
                      <StatusChip status={status} />
                    </div>
                    {/* break-words, and it is what was pushing the table off a
                        390px screen. The engine's source sentence carries model
                        names - "(claude-haiku-4-5)", "(gpt-5.6-luna)" - which
                        the browser will not break, so this cell's minimum
                        content width was 415px and every column above it was
                        being stretched to match. The verdict chip ended up off
                        the right edge behind a scrollbar, on the one screen
                        whose entire purpose is the verdict. */}
                    <p className="max-w-measure break-words text-meta text-ink-3">
                      {f.fact.source}
                    </p>
                    {box && <div className="mt-2">{box}</div>}
                  </td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
