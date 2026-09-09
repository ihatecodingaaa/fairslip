"use client";

/**
 * One question at a time, with the way back always open.
 *
 * WHAT THIS REPLACES. Six large cards in a two-column grid, each with its own
 * readings, its own status chip and its own disclosure - roughly 1,400px of
 * questions between a worker and their answer, on a phone, in their third
 * language. Every one of them was answerable; the problem was being asked all of
 * them at once.
 *
 * WHAT IT DOES NOT DO, and each of these is a rule rather than a preference:
 *
 *   - IT ANSWERS NOTHING. Advancing requires a tap on a value the worker chose.
 *     The two buttons offer what a READER returned, and tapping one records the
 *     worker's own answer through the same HUMAN_CONFIRMED path typing it takes.
 *   - IT HIDES NO QUESTION. The counter is the length of the whole queue, "View
 *     all questions" shows the grid, and both are drawn from one list -
 *     questions.ts - so a question cannot exist in one view and not the other.
 *   - IT DOES NOT TRAP. Back always works, including back past an answered
 *     question, and skipping forward is allowed: the compute gate still names
 *     what is missing, so a skipped question cannot become a silent default.
 *   - IT SAYS WHY. One line, from the backend, beside every question. The long
 *     argument stays one tap away under "Why FairSlip asks this".
 *
 * THE QUESTION CARDS ARE THE GRID'S OWN. `UnsettledField` and the worker input
 * are imported from EstablishStage rather than reimplemented, because a second
 * way of asking "is 8 correct?" is a second thing to keep true.
 */

import { useEffect, useRef, useState } from "react";
import type { ExtractOut } from "@/lib/api";
import { T, useT } from "../ui/Prefs";
import { StatusChip } from "../ui/StatusChip";
import { Disclosure, UnsettledField, WorkerInput } from "./EstablishStage";
import type { RestDayVerdict } from "./facts";
import { askedQuestions, settledCount, unanswered } from "./questions";

export function FocusMode({
  extract,
  answers,
  restDay,
  onAnswer,
  onShowAll,
}: {
  extract: ExtractOut;
  answers: Record<string, string>;
  restDay: RestDayVerdict;
  onAnswer: (name: string, value: string) => void;
  onShowAll: () => void;
}) {
  const t = useT();
  const queue = askedQuestions(extract, answers, restDay);
  const waiting = unanswered(queue);
  const counts = settledCount(extract, answers);

  /* THE CURSOR IS A POSITION IN A LIST THAT DOES NOT SHRINK.
     Answered questions stay, so "Question 3 of 7" is a reader's progress rather
     than a countdown, and Back reaches a question already answered - which is
     how an answer gets changed. Clamped at render rather than in state, so no
     rerender can leave it past the end. */
  const [cursor, setCursor] = useState(() => {
    const first = queue.findIndex((q) => !q.answered);
    return first >= 0 ? first : 0;
  });
  const at = Math.min(cursor, Math.max(0, queue.length - 1));
  const question = queue[at];

  /** The next question still waiting, at or after `from`; the last one if there
   * is none, because there is nowhere better to be. */
  function nextWaiting(from: number) {
    for (let i = from; i < queue.length; i += 1) if (!queue[i].answered) return i;
    return Math.max(0, queue.length - 1);
  }

  // WCAG 4.1.3 and simple usability: the card is replaced in place, so a
  // sighted reader sees it change and a screen-reader user hears nothing. The
  // heading takes focus on every move, which announces the new question and
  // puts the keyboard at the top of it.
  const headingRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [at, question?.name]);

  if (queue.length === 0 || waiting.length === 0) {
    return (
      <div className="rounded-lg border-2 border-agreed-line bg-surface p-5">
        <p className="text-lead font-semibold text-agreed-fg">
          <T k="focus.allAnswered" />
        </p>
        <p className="max-w-measure mt-1 text-body text-ink-2">
          <T k="focus.allAnsweredNote" vars={{ n: counts.settled, t: counts.total }} />
        </p>
        <button
          type="button"
          onClick={onShowAll}
          className="tap-sm mt-3 rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink"
        >
          <T k="focus.viewAll" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-attention-line bg-surface shadow-card">
      {/* ------------------------------------------------------- the header */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-attention-line bg-attention-bg px-5 py-3">
        <p
          ref={headingRef}
          tabIndex={-1}
          className="text-meta font-semibold uppercase tracking-wide text-attention-fg"
        >
          <T k="focus.counter" vars={{ i: at + 1, n: queue.length }} />
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* The progress dots are decoration over a count that is already in
              words beside them, so they are hidden from assistive technology
              rather than read out as eight bullets. */}
          <span aria-hidden className="flex gap-1">
            {queue.map((q, i) => (
              <span
                key={q.name}
                className={`block h-2 w-2 rounded-full ${
                  i === at
                    ? "bg-attention-fg"
                    : q.answered
                      ? "bg-confirmed"
                      : "bg-sunken"
                }`}
              />
            ))}
          </span>
          <button
            type="button"
            onClick={onShowAll}
            className="tap-sm rounded-sm px-2 py-1 text-meta font-semibold text-attention-fg underline underline-offset-4"
          >
            <T k="focus.viewAll" />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------- the question */}
      <div className="p-5">
        <p className="text-meta text-ink-3">
          {counts.settled > 0 && (
            <T k="focus.settledSoFar" vars={{ n: counts.settled, t: counts.total }} />
          )}
        </p>

        {question.kind === "reader" ? (
          <div className="mt-3">
            {/* The grid's own card, unchanged: the readings, the verdict, and
                the two ways out. */}
            <UnsettledField
              field={question.field}
              readers={extract.readers}
              cpfOnly={extract.cpf_only_fields.includes(question.name)}
              answer={answers[question.name] ?? ""}
              onAnswer={(v) => onAnswer(question.name, v)}
              // CONFIRMING IS A COMPLETE ANSWER, so it moves on. Typing is not,
              // and does not - see the prop's own note in EstablishStage.
              onConfirmed={() => setCursor(nextWaiting(at + 1))}
            />
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lead font-semibold text-ink">{question.field.label}</h3>
              <div className="flex flex-wrap gap-2">
                {question.field.required_for.includes("cpf") && (
                  <span className="rounded-sm bg-sunken px-2 py-1 text-meta font-semibold text-ink-2">
                    <T k="group.forCpf" />
                  </span>
                )}
                <StatusChip status="MISSING" />
              </div>
            </div>

            {/* ONE LINE, FROM THE BACKEND. The long argument for why no reader
                was shown this field is under the disclosure below. */}
            <p className="max-w-measure mt-1 text-body text-ink-2">
              {question.field.why_short}
            </p>

            <div className="mt-3 max-w-md">
              <WorkerInput
                field={question.field}
                value={answers[question.name] ?? ""}
                onChange={(v) => onAnswer(question.name, v)}
              />
            </div>

            <Disclosure titleKey="establish.whyAsk" className="mt-3">
              <p className="max-w-measure text-meta text-ink-2">{question.field.why}</p>
            </Disclosure>
          </div>
        )}

        {/* ------------------------------------------------------ the moves */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setCursor(Math.max(0, at - 1))}
            disabled={at === 0}
            className="tap-sm rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink disabled:opacity-50"
          >
            <T k="focus.back" />
          </button>
          {/* SKIPPING IS ALLOWED AND IS NOT AN ANSWER. The compute gate still
              names every unresolved field, so a question passed over stays
              visibly unresolved rather than becoming a default. The label says
              which of the two this tap is: a question already answered is one
              you move on from, not one you skip. */}
          <button
            type="button"
            onClick={() => setCursor(Math.min(queue.length - 1, at + 1))}
            disabled={at >= queue.length - 1}
            className="tap-sm rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink disabled:opacity-50"
          >
            <T k={question.answered ? "focus.next" : "focus.skip"} />
          </button>
        </div>

        <p className="mt-3 text-meta text-ink-3">
          <T k="focus.remaining" vars={{ n: waiting.length }} />
        </p>
      </div>

      <span className="sr-only" aria-live="polite">
        {t("focus.counter", { i: at + 1, n: queue.length })}
      </span>
    </div>
  );
}
