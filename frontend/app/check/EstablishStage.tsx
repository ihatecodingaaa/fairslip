"use client";

/**
 * Stage 2: what two independent readers made of the documents, and what no
 * document can settle.
 *
 * THE STRUCTURE IS THE ARGUMENT, and it has not changed: six fields can be read
 * from a document and six cannot, and the six that cannot are unanswered on every
 * run - so the engine is blocked every run until the worker speaks. Reader
 * disagreement is a second beat when a document happens to be ambiguous; this one
 * does not depend on luck.
 *
 * WHAT CHANGED IS WHERE THE ARGUMENT IS MADE.
 *
 * The screen opened with two paragraphs about what agreement means, then six
 * two-row table entries naming a provider and a model twice each, and somewhere
 * inside that the two fields that actually needed a person. A worker had to read
 * the case for the method before reaching the work.
 *
 * It now opens with the MAP: how many facts, which ones are settled and what they
 * are worth, which ones are waiting for them. Four ticks and two circles, read in
 * a second. Under it, the fields that need a person, each one showing the two
 * readings that failed to settle it and offering the two ways out - confirm what a
 * reader saw, or type something else.
 *
 * NOTHING WAS DELETED. The two paragraphs are under "Why FairSlip asks this"; the
 * full side-by-side table, the independence diagram and every reader's cache and
 * latency are under "View exactly what both readers returned", collapsed on the
 * screen and OPEN ON PAPER - see `.screen-collapsed` in globals.css, which exists
 * because a closed <details> prints as its summary and the readings are half of
 * what makes the printed sheet evidence.
 *
 * ReaderComparison still owns the side-by-side reading table and the independence
 * diagram, and is unchanged: backend/tests/test_inclusion.py holds it to drawing
 * the gap between the readers rather than describing it.
 */

import { useId, useState } from "react";
import {
  isEstablished,
  type ExtractOut,
  type ReadField,
  type ReaderInfo,
  type WorkerField,
} from "@/lib/api";
import { T, usePrefs, useT } from "../ui/Prefs";
import { StatusChip, StatusIcon } from "../ui/StatusChip";
import { ReaderComparison, effectiveStatus, countFields } from "./ReaderComparison";
import { ReaderStrip } from "./ReaderStrip";
import { factValueText } from "./proof";
import type { RestDayVerdict } from "./facts";
import { FocusMode } from "./FocusMode";
import { askedQuestions, unanswered } from "./questions";

export function EstablishStage({
  extract,
  answers,
  restDay,
  onAnswer,
}: {
  extract: ExtractOut;
  answers: Record<string, string>;
  restDay: RestDayVerdict;
  onAnswer: (name: string, value: string) => void;
}) {
  /* FOCUS BY DEFAULT WHILE THERE IS MORE THAN ONE QUESTION LEFT.
     A worker with one question left does not need a sequence, and a worker with
     none needs the grid - which is also the state the printed sheet is built
     from. The mode is a preference the worker can change either way and back;
     what it CANNOT do is change which questions exist. Both views are drawn
     from questions.ts, and the compute gate reads facts.ts, so no view can hide
     a field that is still blocking the calculation. */
  const waiting = unanswered(askedQuestions(extract, answers, restDay));
  const [mode, setMode] = useState<"focus" | "all">(() =>
    waiting.length > 1 ? "focus" : "all",
  );

  return (
    <div className="grid gap-8">
      {mode === "focus" ? (
        <section aria-labelledby="focus-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 id="focus-heading" className="text-title font-semibold text-ink">
              <T k="establish.needYou" />
            </h2>
          </div>
          <div className="mt-4">
            <FocusMode
              extract={extract}
              answers={answers}
              restDay={restDay}
              onAnswer={onAnswer}
              onShowAll={() => setMode("all")}
            />
          </div>
          {/* THE FULL EVIDENCE IS STILL HERE, AND IT HAS TO BE.
              The sheet a worker prints is this DOM narrowed, so the map of what
              is settled, the two-reader table and every worker answer must stay
              in the tree whichever mode is on screen. Focus mode changes what
              leads; it does not remove the record. */}
          <div className="mt-8 border-t border-line pt-6">
            <ReadGroup extract={extract} answers={answers} onAnswer={onAnswer} settledOnly />
            <div className="mt-8">
              <WorkerGroup
                fields={extract.worker_fields}
                answers={answers}
                restDay={restDay}
                onAnswer={onAnswer}
                answeredOnly
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setMode("focus")}
              className="tap-sm rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink"
            >
              <T k="focus.oneAtATime" />
            </button>
          </div>
          <ReadGroup extract={extract} answers={answers} onAnswer={onAnswer} />
          <WorkerGroup
            fields={extract.worker_fields}
            answers={answers}
            restDay={restDay}
            onAnswer={onAnswer}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------- group 1: read from documents */

function ReadGroup({
  extract,
  answers,
  onAnswer,
  settledOnly = false,
}: {
  extract: ExtractOut;
  answers: Record<string, string>;
  onAnswer: (name: string, value: string) => void;
  /** In focus mode the unsettled fields are being asked one at a time above,
   * so this renders the RECORD - what is settled, and the full two-reader
   * table - without repeating the questions underneath the sequence. Nothing
   * is dropped: the map still names every field that is still waiting. */
  settledOnly?: boolean;
}) {
  const fields = extract.read_fields;
  const counts = countFields(fields, answers);
  const settled = fields.filter((f) => isEstablished(effectiveStatus(f, answers[f.name] ?? "")));
  const waiting = fields.filter((f) => !isEstablished(effectiveStatus(f, answers[f.name] ?? "")));

  return (
    <section aria-labelledby="read-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="read-heading" className="text-title font-semibold text-ink">
          <T k="group.readHeading" />
        </h2>
        <p className="text-body font-semibold text-ink-2">
          <T k="establish.factsFound" vars={{ n: counts.total }} />
        </p>
      </div>

      {/* THE MAP. Two columns, one line per fact, no table: what is settled and
          what it is worth on the left, what is still waiting on the right. The
          two paragraphs that used to open this section - what agreement means,
          and what happens to the rest - are under the disclosure below. */}
      <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <FactColumn titleKey="establish.established" n={settled.length}>
          {settled.map((f) => (
            <SettledRow
              key={f.name}
              field={f}
              readers={extract.readers}
              answer={answers[f.name] ?? ""}
              status={effectiveStatus(f, answers[f.name] ?? "")}
            />
          ))}
        </FactColumn>

        <FactColumn titleKey="establish.needYou" n={waiting.length}>
          {waiting.map((f) => (
            <li key={f.name}>
              <a
                href={`#field-${f.name}`}
                className="tap-sm flex w-full items-baseline gap-2 rounded-sm px-1 py-1 text-left hover:bg-muted"
              >
                <span className="text-attention-fg">
                  <StatusIcon status={f.fact.status} />
                </span>
                <span className="text-body text-ink">{f.label}</span>
              </a>
            </li>
          ))}
        </FactColumn>
      </div>

      {/* The fields the readers did NOT settle, in full, each anchored so the
          map above can point at it. */}
      {waiting.length > 0 && !settledOnly && (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {waiting.map((f) => (
            <li key={f.name} id={`field-${f.name}`} className="scroll-mt-6">
              <UnsettledField
                field={f}
                readers={extract.readers}
                cpfOnly={extract.cpf_only_fields.includes(f.name)}
                answer={answers[f.name] ?? ""}
                onAnswer={(v) => onAnswer(f.name, v)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Everything a technical reader wants and a worker does not need in order
          to answer: who was called, whether it came from the cache, what each
          reader returned for every field, and the independence diagram. */}
      <Disclosure titleKey="establish.readerDetails" className="mt-6">
        {/* How many the READERS settled between them - a different number from
            how many are established, which includes the worker's own answers.
            `agreed_count` is the backend's, not one counted here. */}
        <p
          className={`text-body font-semibold ${
            extract.agreed_count === extract.read_field_count
              ? "text-agreed-fg"
              : "text-attention-fg"
          }`}
        >
          {extract.agreed_count === extract.read_field_count ? (
            <T k="group.allAgreed" vars={{ n: extract.read_field_count }} />
          ) : (
            <T k="group.someAgreed" vars={{ a: extract.agreed_count, t: extract.read_field_count }} />
          )}
        </p>
        <p className="max-w-measure mt-2 text-body text-ink-2">
          <T k="group.readBlurb" />
        </p>
        <p className="max-w-measure mt-2 text-body text-ink-2">
          {extract.agreed_count === extract.read_field_count ? (
            <T k="group.allAgreedWhy" />
          ) : (
            <T k="group.someAgreedWhy" />
          )}
        </p>
        <div className="mt-4">
          <ReaderStrip extract={extract} />
        </div>
        <div className="mt-4 rounded-lg border border-line-strong bg-surface p-5">
          <ReaderComparison fields={fields} readers={extract.readers} answers={answers} />
        </div>
      </Disclosure>
    </section>
  );
}

function FactColumn({
  titleKey,
  n,
  children,
}: {
  titleKey: "establish.established" | "establish.needYou";
  n: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-baseline gap-2 border-b border-line-strong pb-1 text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k={titleKey} />
        <span className="tabular-nums">{n}</span>
      </p>
      <ul className="mt-2 space-y-1">{children}</ul>
    </div>
  );
}

/**
 * One settled fact: what it is, what it is worth, and - on request - the two
 * readings behind it.
 *
 * The value is `factValueText` of the Fact the backend returned, the same helper
 * the money trail uses. Nothing here formats or computes; a settled fact's worth
 * is a string an engine already produced.
 */
function SettledRow({
  field,
  readers,
  answer,
  status,
}: {
  field: ReadField;
  readers: ReaderInfo[];
  /** What the worker typed or confirmed, if anything. */
  answer: string;
  status: ReadField["fact"]["status"];
}) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  /* THE WORKER'S ANSWER WINS, and it has to: a field the readers left MISSING
     carries `value: null` on the fact for ever - settling it does not rewrite
     the extraction - so reading the fact alone printed nothing for exactly the
     rows a person had just answered. Same precedence as `payInputsFrom`, which
     is what the engine will actually be sent, so this row cannot show a
     different value from the one that gets computed. */
  const value = answer.trim() ? answer.trim() : factValueText(field.fact);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={uid}
        className="tap-sm flex w-full items-baseline gap-2 rounded-sm px-1 py-1 text-left hover:bg-muted"
      >
        <span className={status === "AGREED" ? "text-agreed-fg" : "text-confirmed-fg"}>
          <StatusIcon status={status} />
        </span>
        <span className="min-w-0 flex-1 text-body text-ink">{field.label}</span>
        <span className="font-mono text-body tabular-nums text-ink">{value}</span>
      </button>
      {open && (
        <div id={uid} className="ml-7 border-l-2 border-line pl-3 pb-2">
          <ReadingPair field={field} readers={readers} />
          <p className="mt-1">
            <StatusChip status={status} />
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * What each reader said, in the position it was said in.
 *
 * An empty cell beside a full one is the finding, before any word is read. No box
 * around each cell: the card is already a bordered surface, and a bordered filled
 * panel per reader made two transcribed numbers look like two form fields.
 */
function ReadingPair({ field, readers }: { field: ReadField; readers: ReaderInfo[] }) {
  const t = useT();
  return (
    <dl className="grid grid-cols-2 divide-x divide-line">
      {readers.slice(0, 2).map((r, i) => {
        const said = field.readings[r.key];
        const unreadable = field.unreadable.includes(r.key);
        return (
          <div key={r.key} className={i === 0 ? "pr-4" : "pl-4"}>
            <dt className="text-meta text-ink-3">{r.provider}</dt>
            <dd className="mt-1">
              {said == null ? (
                <span className="inline-block min-w-[3.5rem] rounded-sm border-2 border-dashed border-missing-line px-2 py-1 text-center">
                  <span aria-hidden className="font-mono text-body text-ink-2">
                    &mdash;
                  </span>
                  <span className="sr-only">{t("field.answeredNothing")}</span>
                </span>
              ) : (
                <span
                  className={`block font-mono text-title tabular-nums ${
                    unreadable ? "text-attention-fg" : "text-ink"
                  }`}
                >
                  {said}
                  {unreadable && <span className="block text-meta">{t("field.notANumber")}</span>}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * A field nothing has established, and the two ways out of it.
 *
 * THE READINGS COME FIRST AND THE VERDICT UNDER THEM, which is the order the
 * conclusion is actually reached in: 8 beside nothing, therefore nothing is
 * established. The sentence that used to lead - "One reader returned a value, the
 * other did not establish one" - is now the caption on that picture, which is
 * what it always was.
 *
 * IT IS BRANCHED ON THE STATUS, NOT WRITTEN ONCE. That sentence is true of
 * MISSING and false of DISAGREED, and the difference matters: one is silence and
 * the other is a conflict. Asserting either for both would be docs/debt.md,
 * ui-invents-a-cause, on the field the whole screen is about.
 *
 * IT DOES NOT SAY THE READER WAS WRONG. Nothing here establishes a fabrication -
 * only that one reader found a value on the document and the other did not - so
 * the copy says exactly that and no more.
 *
 * CONFIRMING IS STILL THE WORKER DECIDING. The buttons offer the values a reader
 * actually returned, and tapping one records the worker's own answer - the same
 * HUMAN_CONFIRMED path typing it by hand takes, and the same one the engine sees.
 * FairSlip never picks between them; it saves the worker retyping a number that
 * is already on their screen. A reading that would not parse as a number is not
 * offered, because the engine would refuse it.
 */
export function UnsettledField({
  field,
  readers,
  cpfOnly,
  answer,
  onAnswer,
  onConfirmed,
}: {
  field: ReadField;
  readers: ReaderInfo[];
  cpfOnly: boolean;
  answer: string;
  onAnswer: (v: string) => void;
  /** Fired ONLY by the confirm buttons, which carry a complete value - never by
   * the text field, where every keystroke is an `onAnswer` and advancing on the
   * first character would move the question out from under the worker. Focus
   * mode uses it to go to the next question; the grid does not pass it. */
  onConfirmed?: () => void;
}) {
  const t = useT();
  const [typing, setTyping] = useState(false);
  const status = field.fact.status;

  const offered = Array.from(
    new Set(
      readers
        .slice(0, 2)
        .filter((r) => !field.unreadable.includes(r.key))
        .map((r) => field.readings[r.key])
        .filter((v): v is string => v != null && v.trim().length > 0),
    ),
  );

  return (
    <div className="flex h-full flex-col rounded-lg border-2 border-attention-line bg-surface p-4">
      <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">{field.label}</h3>

      <div className="mt-3">
        <ReadingPair field={field} readers={readers} />
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-attention-line pt-2">
        <StatusChip status={status} />
        <span className="max-w-measure text-meta text-ink-2">
          {status === "MISSING" ? <T k="establish.oneAnswered" /> : <T k="establish.disagreed" />}
        </span>
      </p>

      <div className="mt-auto pt-4">
        {cpfOnly ? (
          <p className="max-w-measure text-meta text-ink-3">
            <T k="field.cpfOnlyNote" />
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {offered.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    onAnswer(v);
                    onConfirmed?.();
                  }}
                  className="tap-sm rounded-sm border-2 border-confirmed-line bg-confirmed-bg px-4 py-2 text-body font-semibold text-confirmed-fg"
                >
                  {t("establish.confirm", { v })}
                </button>
              ))}
              {!typing && (
                <button
                  type="button"
                  onClick={() => setTyping(true)}
                  className="tap-sm rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink"
                >
                  <T k="establish.enterAnother" />
                </button>
              )}
            </div>
            {(typing || offered.length === 0) && (
              <label className="mt-3 block text-meta font-semibold text-ink">
                <T k="field.rightFigure" />
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus={typing}
                  value={answer}
                  onChange={(e) => onAnswer(e.target.value)}
                  placeholder={t("field.typeNumber")}
                  className="mt-1 block w-full rounded-sm border-2 border-attention-line bg-surface px-3 py-2 font-mono text-body text-ink"
                />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------- group 2: only the worker can say */

function WorkerGroup({
  fields,
  answers,
  restDay,
  onAnswer,
  answeredOnly = false,
}: {
  fields: WorkerField[];
  answers: Record<string, string>;
  restDay: RestDayVerdict;
  onAnswer: (name: string, value: string) => void;
  /** In focus mode the unanswered ones are being asked above. What stays here
   * is the record of what the worker has already said - which is what the
   * printed sheet needs and what they need in order to change an answer. */
  answeredOnly?: boolean;
}) {
  const netPaid = fields.find((f) => f.name === "net_paid");
  const rest = fields
    .filter((f) => f.name !== "net_paid")
    .filter((f) => !answeredOnly || Boolean(answers[f.name]?.trim()));

  return (
    <section aria-labelledby="worker-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="worker-heading" className="text-title font-semibold text-ink">
          <T k="group.workerHeading" />
        </h2>
        <p className="text-body font-semibold text-confirmed-fg">
          <T k="group.fieldCount" vars={{ n: fields.length }} />
        </p>
      </div>

      {/* WHY THERE IS A SECOND GROUP AT ALL - the paragraph that used to open
          this section, one tap away rather than gone. It is the boundary the
          whole split rests on: no reader was shown these, and a better model
          would not change that. */}
      <Disclosure titleKey="establish.whyAsk" className="mt-2">
        <p className="max-w-measure text-body text-ink-2">
          <T k="group.workerBlurb" />
        </p>
      </Disclosure>

      {/* net_paid, at the size of the argument it carries - and the argument
          drawn rather than described. Two boxes and a "not equal" between them
          say what three sentences said: the payslip prints one fact, the bank
          holds another, and only one of them is the one the engine needs.

          THE LEFT BOX IS EMPTY ON PURPOSE AND SAYS SO. FairSlip does not read
          the payslip's printed net - that is the whole point of the split - so
          there is no figure to put there and none is invented. */}
      {netPaid && (!answeredOnly || answers.net_paid?.trim()) && (
        <div className="mt-4 overflow-hidden rounded-lg border-2 border-confirmed-line bg-surface shadow-card">
          <p className="border-b border-confirmed-line bg-confirmed-bg px-5 py-2 text-meta font-semibold uppercase tracking-wide text-confirmed-fg">
            <T k="establish.onlyYou" /> &middot; <T k="group.mostImportant" />
          </p>
          <div className="p-5">
            <h3 className="text-title font-semibold text-ink">{netPaid.label}</h3>

            <div className="mt-4 flex flex-wrap items-stretch gap-3">
              <div className="min-w-[10rem] flex-1 rounded-sm border border-dashed border-control px-4 py-3">
                <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
                  <T k="establish.payslipNet" />
                </p>
                <p className="mt-1 text-body text-ink-3">
                  <T k="establish.notRead" />
                </p>
              </div>
              <div aria-hidden className="flex items-center text-title font-semibold text-ink-2">
                &ne;
              </div>
              <div className="min-w-[10rem] flex-1 rounded-sm border-2 border-confirmed-line bg-confirmed-bg px-4 py-3">
                <p className="text-meta font-semibold uppercase tracking-wide text-confirmed-fg">
                  <T k="establish.bankNet" />
                </p>
                {/* The worker's own answer, echoed back into the box it belongs
                    in - or a question mark, which is what this side of the
                    comparison actually holds until they answer. Nothing is
                    computed and nothing is read off a document: this is the
                    string they typed. */}
                <p className="mt-1 font-mono text-lead font-semibold tabular-nums text-confirmed-fg">
                  {answers.net_paid?.trim() ? answers.net_paid : "?"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-meta font-semibold text-ink-2">
              <T k="establish.differentFacts" />
            </p>

            <label className="mt-4 block text-body font-semibold text-ink">
              <ServerPrompt field={netPaid} />
              <input
                type="text"
                inputMode="decimal"
                value={answers.net_paid ?? ""}
                onChange={(e) => onAnswer("net_paid", e.target.value)}
                placeholder="e.g. 1120.00"
                className="mt-1 block w-full max-w-sm rounded-sm border-2 border-confirmed-line bg-surface px-3 py-3 font-mono text-lead text-ink"
              />
            </label>

            <Disclosure titleKey="establish.whyAsk" className="mt-4">
              <p className="max-w-measure text-body text-ink-2">
                <T k="establish.netPaidWhy" />
              </p>
              <p className="max-w-measure mt-2 text-meta text-ink-2">{netPaid.why}</p>
            </Disclosure>
          </div>
        </div>
      )}

      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {rest.map((f) => {
          // Non-rest-day fields always render their input; only this one is conditional.
          const held: RestDayVerdict =
            f.name === "rest_day_requested_by" ? restDay : { state: "worked", settledBy: null };
          return (
            <li key={f.name} className="rounded-lg border border-line-strong bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body font-semibold text-ink">{f.label}</span>
                <div className="flex flex-wrap gap-2">
                  {f.required_for.includes("cpf") && (
                    <span className="rounded-sm bg-sunken px-2 py-1 text-meta font-semibold text-ink-2">
                      <T k="group.forCpf" />
                    </span>
                  )}
                  <StatusChip status={answers[f.name]?.trim() ? "HUMAN_CONFIRMED" : "MISSING"} />
                </div>
              </div>

              {/* ONE LINE, from the backend. `why_short` and `why` are the same
                  boundary at two lengths and both ship from extract_schema.py;
                  the long one is under the disclosure at the foot of the card. */}
              <p className="max-w-measure mt-1 text-meta text-ink-2">{f.why_short}</p>

              {held.state === "not_worked" ? (
                <p className="mt-2 text-meta text-ink-3">
                  {held.settledBy === "readers" ? (
                    <T k="establish.restNotAskedReaders" />
                  ) : (
                    <T k="establish.restNotAskedYou" />
                  )}
                </p>
              ) : held.state === "unknown" ? (
                <>
                  <p className="mt-2 rounded-sm border border-attention-line bg-attention-bg px-3 py-2 text-meta text-attention-fg">
                    <T k="establish.restUnknown" />
                  </p>
                  <Disclosure titleKey="establish.whyAsk" className="mt-2">
                    <p className="max-w-measure text-meta text-ink-2">
                      <T k="establish.restUnknownWhy" />
                    </p>
                    <p className="max-w-measure mt-2 text-meta text-ink-2">{f.why}</p>
                  </Disclosure>
                </>
              ) : (
                <>
                  <WorkerInput
                    field={f}
                    value={answers[f.name] ?? ""}
                    onChange={(v) => onAnswer(f.name, v)}
                  />
                  <Disclosure titleKey="establish.whyAsk" className="mt-2">
                    <p className="max-w-measure text-meta text-ink-2">{f.why}</p>
                  </Disclosure>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A section a worker does not need in order to act, kept one tap away.
 *
 * NOT A <details>. A closed <details> prints as its summary, and some of what
 * these hold - the two-reader table above all - is what makes the printed sheet
 * evidence rather than an assertion. `.screen-collapsed` (globals.css) hides the
 * region on the SCREEN only, so paper gets the whole thing whether or not anyone
 * opened it. `aria-expanded` and `aria-controls` carry the state, and
 * `display: none` keeps the collapsed region out of the accessibility tree
 * rather than merely out of sight.
 */
export function Disclosure({
  titleKey,
  className = "",
  children,
}: {
  titleKey: "establish.readerDetails" | "establish.whyAsk";
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={uid}
        className="tap-sm print-hide inline-flex items-center gap-2 rounded-sm text-meta font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
      >
        <span aria-hidden className="font-mono">
          {open ? "−" : "+"}
        </span>
        <T k={titleKey} />
      </button>
      <div id={uid} className={open ? "mt-3" : "screen-collapsed mt-3"}>
        {children}
      </div>
    </div>
  );
}

/**
 * A question the SERVER owns, rendered in the reader's language.
 *
 * The translations ship from backend/fairslip/extract_schema.py beside the
 * English, so there is one source of truth for what a field asks. When a language
 * has no entry the English is shown MARKED, exactly like an untranslated
 * interface string - the fallback is the same everywhere, because "we have not
 * translated this yet" is one fact however it arises.
 */
function ServerPrompt({ field }: { field: WorkerField }) {
  const { lang } = usePrefs();
  const translated = lang === "en" ? field.prompt : field.prompt_i18n[lang];
  if (translated) return <>{translated}</>;
  return (
    <span className="untranslated" lang="en">
      {field.prompt}
    </span>
  );
}

export function WorkerInput({
  field,
  value,
  onChange,
}: {
  field: WorkerField;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls =
    "mt-1 block w-full rounded-sm border border-control bg-surface px-2 py-2 text-body text-ink";
  return (
    <label className="mt-2 block text-body text-ink">
      <ServerPrompt field={field} />
      {field.answer_type === "choice" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">&mdash; not yet answered &mdash;</option>
          {field.choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.answer_type === "date" ? "date" : "text"}
          inputMode={field.answer_type === "decimal" ? "decimal" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} font-mono`}
        />
      )}
    </label>
  );
}
