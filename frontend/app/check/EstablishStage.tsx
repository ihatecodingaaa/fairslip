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
 * WHAT CHANGED IS THE WEIGHT. The strongest case in the whole product - one
 * reader returned a value, the other did not establish one, therefore nothing is
 * established - used to be a chip in a table cell. It is now a sentence at the
 * top of the field's own row, in the same type size as the values it is about,
 * with the answer box beneath it. A verdict that has to be inferred from a
 * coloured pill is a verdict that reads as a warning to be tapped through.
 *
 * ReaderComparison still owns the side-by-side reading table and the
 * independence diagram, and is unchanged: backend/tests/test_inclusion.py holds
 * it to drawing the gap between the readers rather than describing it.
 */

import { isEstablished, type ReadField, type ReaderInfo, type WorkerField } from "@/lib/api";
import { T, usePrefs, useT } from "../ui/Prefs";
import { StatusChip } from "../ui/StatusChip";
import { ReaderComparison, effectiveStatus } from "./ReaderComparison";
import type { RestDayVerdict } from "./facts";

export function EstablishStage({
  fields,
  readers,
  workerFields,
  cpfOnly,
  agreed,
  total,
  answers,
  restDay,
  onAnswer,
}: {
  fields: ReadField[];
  readers: ReaderInfo[];
  workerFields: WorkerField[];
  cpfOnly: string[];
  agreed: number;
  total: number;
  answers: Record<string, string>;
  restDay: RestDayVerdict;
  onAnswer: (name: string, value: string) => void;
}) {
  return (
    <div className="grid gap-8">
      <ReadGroup
        fields={fields}
        readers={readers}
        cpfOnly={cpfOnly}
        agreed={agreed}
        total={total}
        answers={answers}
        onAnswer={onAnswer}
      />
      <WorkerGroup
        fields={workerFields}
        answers={answers}
        restDay={restDay}
        onAnswer={onAnswer}
      />
    </div>
  );
}

/* ------------------------------------------------- group 1: read from documents */

function ReadGroup({
  fields,
  readers,
  cpfOnly,
  agreed,
  total,
  answers,
  onAnswer,
}: {
  fields: ReadField[];
  /** Who read them. The comparison needs the two reader identities for its
   * column headings and for the independence diagram. */
  readers: ReaderInfo[];
  /** Fields the pay engine never receives. Labelled, not silently unanswerable:
   * one of these used to offer "What is the right figure?", record a green chip,
   * and then have the answer deleted before /compute. */
  cpfOnly: string[];
  agreed: number;
  total: number;
  answers: Record<string, string>;
  onAnswer: (name: string, value: string) => void;
}) {
  const allAgreed = agreed === total;
  return (
    <section aria-labelledby="read-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="read-heading" className="text-title font-semibold text-ink">
          <T k="group.readHeading" />
        </h2>
        <p
          className={`text-body font-semibold ${
            allAgreed ? "text-agreed-fg" : "text-attention-fg"
          }`}
        >
          {allAgreed ? (
            <T k="group.allAgreed" vars={{ n: total }} />
          ) : (
            <T k="group.someAgreed" vars={{ a: agreed, t: total }} />
          )}
        </p>
      </div>
      <p className="max-w-measure mt-2 text-body text-ink-2">
        <T k="group.readBlurb" />
      </p>
      <p className="max-w-measure mt-2 text-body text-ink-2">
        {allAgreed ? <T k="group.allAgreedWhy" /> : <T k="group.someAgreedWhy" />}
      </p>

      {/* The fields the readers did NOT settle, first and in full. They are the
          reason this screen exists, and they used to be rows 3 and 5 of a table
          the eye reads as uniform. */}
      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        {fields
          .filter((f) => !isEstablished(effectiveStatus(f, answers[f.name] ?? "")))
          .map((f) => (
            <li key={f.name}>
              <UnsettledField
                field={f}
                readers={readers}
                cpfOnly={cpfOnly.includes(f.name)}
                answer={answers[f.name] ?? ""}
                onAnswer={(v) => onAnswer(f.name, v)}
              />
            </li>
          ))}
      </ul>

      {/* ONE COMPARISON, NOT SIX ROWS. Seeing whether the readers ever disagreed
          used to mean reading six separate rows and holding them in your head.
          Side by side it is the picture. */}
      <div className="mt-8 rounded-lg border border-line-strong bg-surface p-5 shadow-card">
        <ReaderComparison fields={fields} readers={readers} answers={answers} />
      </div>
    </section>
  );
}

/**
 * A field nothing has established, and what to do about it.
 *
 * THE SENTENCE IS BRANCHED ON THE STATUS, NOT WRITTEN ONCE. "One reader returned
 * a value, the other did not establish one" is true of MISSING and false of
 * DISAGREED, and the difference matters: one is silence and the other is a
 * conflict. Asserting either for both would be docs/debt.md, ui-invents-a-cause,
 * on the field the whole screen is about.
 *
 * IT DOES NOT SAY THE READER WAS WRONG. Nothing here establishes a fabrication -
 * only that one reader found a value on the document and the other did not - so
 * the copy says exactly that and no more.
 */
function UnsettledField({
  field,
  readers,
  cpfOnly,
  answer,
  onAnswer,
}: {
  field: ReadField;
  readers: ReaderInfo[];
  cpfOnly: boolean;
  answer: string;
  onAnswer: (v: string) => void;
}) {
  const t = useT();
  const status = field.fact.status;

  return (
    <div className="flex h-full flex-col rounded-lg border-2 border-attention-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lead font-semibold text-ink">{field.label}</h3>
        <StatusChip status={status} />
      </div>

      <p className="max-w-measure mt-2 text-body text-attention-fg">
        {status === "MISSING" ? (
          <T k="establish.oneAnswered" />
        ) : (
          <T k="establish.disagreed" />
        )}
      </p>

      {/* What each reader said, in the position it was said in. An empty cell
          beside a full one is the finding, before any word is read.
          NO BOX AROUND EACH CELL. This card is already a bordered surface; a
          bordered, filled panel inside it for each reader was a third nesting
          level, and it made two transcribed numbers look like two form fields.
          A hairline between them separates them; the READING is what should
          carry the weight, so it is the largest thing in the cell. */}
      <dl className="mt-4 grid grid-cols-2 divide-x divide-line">
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
                    {unreadable && (
                      <span className="block text-meta">{t("field.notANumber")}</span>
                    )}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-auto pt-4">
        {cpfOnly ? (
          <p className="max-w-measure text-meta text-ink-3">
            <T k="field.cpfOnlyNote" />
          </p>
        ) : (
          <label className="block text-meta font-semibold text-ink">
            {/* The one reader's value was stated THREE TIMES on this card: in the
                cell above, inside the engine's source sentence, and in brackets
                here. The cell is where a reader looks for it. */}
            <T k="field.rightFigure" />
            <input
              type="text"
              inputMode="decimal"
              value={answer}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder={t("field.typeNumber")}
              className="mt-1 block w-full rounded-sm border-2 border-attention-line bg-surface px-3 py-2 font-mono text-body text-ink"
            />
          </label>
        )}
      </div>

      {/* The engine's own sentence about why nothing was established, last and
          quiet. It names model identifiers and repeats in prose what the two
          cells above show in position - useful to anyone chasing it, and not the
          thing to read first. */}
      <p className="mt-4 max-w-measure break-words border-t border-line pt-3 font-mono text-meta text-ink-3">
        {field.fact.source}
      </p>
    </div>
  );
}

/* ------------------------------------------- group 2: only the worker can say */

function WorkerGroup({
  fields,
  answers,
  restDay,
  onAnswer,
}: {
  fields: WorkerField[];
  answers: Record<string, string>;
  restDay: RestDayVerdict;
  onAnswer: (name: string, value: string) => void;
}) {
  const netPaid = fields.find((f) => f.name === "net_paid");
  const rest = fields.filter((f) => f.name !== "net_paid");

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
      <p className="max-w-measure mt-2 text-body text-ink-2">
        <T k="group.workerBlurb" />
      </p>

      {/* net_paid, at the size of the argument it carries. */}
      {netPaid && (
        <div className="mt-6 overflow-hidden rounded-lg border-2 border-confirmed-line bg-surface shadow-card">
          <p className="border-b border-confirmed-line bg-confirmed-bg px-5 py-2 text-meta font-semibold uppercase tracking-wide text-confirmed-fg">
            <T k="establish.onlyYou" /> &middot; <T k="group.mostImportant" />
          </p>
          <div className="p-5">
          <h3 className="text-title font-semibold text-ink">{netPaid.label}</h3>
          <p className="max-w-measure mt-2 text-body text-ink-2">
            <T k="establish.netPaidWhy" />
          </p>
          <p className="max-w-measure mt-2 rounded-sm bg-muted px-3 py-2 text-meta text-ink-2">
            {netPaid.why}
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
          </div>
        </div>
      )}

      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {rest.map((f) => {
          // Non-rest-day fields always render their input; only this one is conditional.
          const held: RestDayVerdict =
            f.name === "rest_day_requested_by" ? restDay : { state: "worked", settledBy: null };
          return (
            <li
              key={f.name}
              className="rounded-lg border border-line-strong bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body font-semibold text-ink">{f.label}</span>
                <div className="flex flex-wrap gap-2">
                  {f.required_for.includes("cpf") && (
                    <span className="rounded-sm bg-sunken px-2 py-1 text-meta font-semibold text-ink-2">
                      <T k="group.forCpf" />
                    </span>
                  )}
                  <StatusChip
                    status={answers[f.name]?.trim() ? "HUMAN_CONFIRMED" : "MISSING"}
                  />
                </div>
              </div>
              <p className="max-w-measure mt-1 text-meta text-ink-2">{f.why}</p>
              {held.state === "not_worked" ? (
                <p className="mt-2 text-meta text-ink-3">
                  Not asked:{" "}
                  {held.settledBy === "readers"
                    ? "both readers agree no hours were worked on a rest day"
                    : "you told us no hours were worked on a rest day"}
                  , so MOM&rsquo;s rest-day table does not apply.
                </p>
              ) : held.state === "unknown" ? (
                <p className="mt-2 rounded-sm border border-attention-line bg-attention-bg px-3 py-2 text-meta text-attention-fg">
                  Not asked yet. Whether a rest day was worked is not established &mdash; see
                  &ldquo;Hours worked on a rest day&rdquo; above. That is not the same as the
                  documents showing no rest day, and FairSlip will not treat it as though it
                  were. Answer that field and this question appears if it applies.
                </p>
              ) : (
                <WorkerInput
                  field={f}
                  value={answers[f.name] ?? ""}
                  onChange={(v) => onAnswer(f.name, v)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
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

function WorkerInput({
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
