/**
 * Everything still being asked of the worker, in one order, once.
 *
 * WHY THIS EXISTS. The establish stage now has two ways to show the same
 * questions - one at a time, or all at once - and a worker switches between
 * them mid-answer. If each view worked out its own list, the two would
 * eventually differ about which questions there are, and the honest failure
 * would be the quiet one: a question that appears in the grid, is not in the
 * sequence, and so is never reached by anyone who stays in focus mode. The
 * compute gate would then say a field is missing that the worker cannot find.
 *
 * So both views render THIS list, and the counter in focus mode - "2 of 6" - is
 * its length. `unresolvedFields` in facts.ts stays the authority on what BLOCKS
 * a calculation; this is the wider set of what is still being ASKED, which
 * includes the two facts the CPF pack needs and the pay engine never sees.
 *
 * AN ANSWERED QUESTION STAYS IN THE LIST, MARKED. The first version dropped
 * it, and the counter then read "Question 1 of 7", then "Question 1 of 6", then
 * "Question 1 of 5" - a list shrinking under the reader rather than a reader
 * moving through one. It said how many were left and nothing about how far they
 * had come. Keeping them makes "Question 3 of 7" true, lets Back reach a
 * question already answered so it can be changed, and costs nothing: the ones
 * the READERS settled were never questions and are still absent.
 *
 * THE TOTAL CAN GROW, AND THAT IS HONEST. Confirming that a rest day was worked
 * makes "who asked for it?" a real question for the first time, so a run can go
 * from seven to eight. The alternative is holding a question back from the
 * count while asking it, which is worse.
 */

import {
  isEstablished,
  type ExtractOut,
  type ReadField,
  type WorkerField,
} from "@/lib/api";
import type { RestDayVerdict } from "./facts";

export type Question =
  | {
      kind: "reader";
      name: string;
      label: string;
      field: ReadField;
      /** True when this field must be settled before /compute will run. */
      blocking: boolean;
      answered: boolean;
    }
  | {
      kind: "worker";
      name: string;
      label: string;
      field: WorkerField;
      blocking: boolean;
      answered: boolean;
    };

/**
 * The questions, in the order they are asked.
 *
 * THE ORDER IS THE ARGUMENT. What blocks the calculation comes first, because
 * that is what stands between the worker and an answer; the two facts only the
 * CPF pack needs come last, because a Work Permit holder will never be asked
 * them at all and nobody should meet them before the question that matters.
 * Within each half, the readers' unsettled fields lead - they are the ones with
 * evidence already on screen, so they are the cheapest to answer.
 */
export function askedQuestions(
  extract: ExtractOut | null,
  answers: Record<string, string>,
  restDay: RestDayVerdict,
): Question[] {
  if (!extract) return [];
  const cpfOnly = new Set(extract.cpf_only_fields);
  const out: Question[] = [];

  for (const f of extract.read_fields) {
    // A field the READERS settled was never a question. One the worker has
    // answered is a question they have ANSWERED - it stays, so the counter
    // measures progress and Back can reach it.
    if (isEstablished(f.fact.status)) continue;
    out.push({
      kind: "reader",
      name: f.name,
      label: f.label,
      field: f,
      // `cpf_employee_on_payslip` is read from the payslip and then dropped by
      // payInputsFrom, so it cannot block a pay calculation - and telling a Work
      // Permit holder that their missing CPF line is holding up the arithmetic
      // was exactly the defect facts.ts records.
      blocking: !cpfOnly.has(f.name),
      answered: Boolean(answers[f.name]?.trim()),
    });
  }

  for (const f of extract.worker_fields) {
    // "Who asked for the rest day?" is only a question once a rest day is
    // established as worked. While that is unknown, the field it depends on is
    // itself still in this list, and asking both would ask the worker to answer
    // a question about a fact nobody has established.
    if (f.name === "rest_day_requested_by" && restDay.state !== "worked") continue;
    out.push({
      kind: "worker",
      name: f.name,
      label: f.label,
      field: f,
      blocking: !f.required_for.includes("cpf") && !cpfOnly.has(f.name),
      answered: Boolean(answers[f.name]?.trim()),
    });
  }

  // Blocking first, and STABLE within each half: a list that reordered itself
  // as answers arrived would move the question under the worker's finger.
  return [...out.filter((q) => q.blocking), ...out.filter((q) => !q.blocking)];
}

/**
 * How much of the month is settled, and how much is still being asked.
 *
 * Both halves are counted from the same pass over the same fields, so the pair
 * always adds up to the number of facts there are. A screen that counted them
 * separately could show "5 established" beside "2 need you" out of six.
 */
export function settledCount(
  extract: ExtractOut | null,
  answers: Record<string, string>,
): { settled: number; total: number } {
  if (!extract) return { settled: 0, total: 0 };
  const fields = extract.read_fields;
  const settled = fields.filter(
    (f) => isEstablished(f.fact.status) || Boolean(answers[f.name]?.trim()),
  ).length;
  return { settled, total: fields.length };
}

/** The questions still waiting for an answer. */
export function unanswered(queue: Question[]): Question[] {
  return queue.filter((q) => !q.answered);
}
