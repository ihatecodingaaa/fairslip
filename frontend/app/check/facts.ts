/**
 * Turning what is on screen into the facts the engine takes.
 *
 * Extracted from check/page.tsx unchanged in behaviour, because two components
 * now need it: the stage that asks the questions, and the page that posts the
 * answers. Every comment below records a defect this code exists to prevent, so
 * it travels with the code rather than staying behind in a file that no longer
 * has it.
 */

import { isEstablished, type ExtractOut, type Fact, type PayInputs } from "@/lib/api";

/**
 * Was a rest day worked? THREE answers, not two.
 *
 * "unknown" is the one that matters. A field the readers could not establish is
 * not a field the documents settled: on the committed artwork reader A read 8
 * hours off a roster that says "Sun 14: full day (rest day)" and reader B read
 * nothing, which makes the fact MISSING - not absent. Collapsing MISSING into
 * "no rest day was worked" made the screen state something the documents
 * contradict, on the part of the month that is most of the discrepancy this demo
 * exists to show. See docs/debt.md, missing-narrated-as-settled.
 */
export type RestDayState = "worked" | "not_worked" | "unknown";

/** Who settled it. A screen that cannot say this cannot honestly narrate it. */
export type RestDaySettledBy = "readers" | "you" | null;

export type RestDayVerdict = { state: RestDayState; settledBy: RestDaySettledBy };

export function restDayVerdict(
  extract: ExtractOut,
  answers: Record<string, string>,
): RestDayVerdict {
  const unknown: RestDayVerdict = { state: "unknown", settledBy: null };
  const f = extract.read_fields.find((x) => x.name === "rest_day_hours");
  if (!f) return unknown;

  const typed = answers.rest_day_hours?.trim();
  const fromReaders = isEstablished(f.fact.status) ? f.fact.value : null;
  // A worker's answer wins, and knowing WHICH source won is the whole point:
  // the input box only appears when the readers did NOT settle the field, so a
  // typed value proves there was no reader agreement to cite.
  const raw = typed || fromReaders;
  const settledBy: RestDaySettledBy = typed ? "you" : fromReaders !== null ? "readers" : null;

  if (raw === null || raw === undefined || raw === "" || typeof raw === "object") return unknown;

  const n = Number(raw);
  if (!Number.isFinite(n)) return unknown;
  if (n > 0) return { state: "worked", settledBy };
  if (n === 0) return { state: "not_worked", settledBy };

  // Negative. NOT "no rest day was worked" - that would launder a reading
  // nobody established into a settled zero and drop the component. It is a
  // value the engine must see and refuse.
  return unknown;
}

/**
 * Which fields still stand between here and a calculation, in the order the
 * screen shows them. Named, never counted only - a button that says "3 fields
 * remaining" has told the worker nothing about which three.
 */
export function unresolvedFields(
  extract: ExtractOut | null,
  answers: Record<string, string>,
): { name: string; label: string; group: "read" | "worker" }[] {
  if (!extract) return [];
  const out: { name: string; label: string; group: "read" | "worker" }[] = [];
  // Fields the pay engine never receives cannot block a pay calculation.
  // `cpf_employee_on_payslip` is read from the payslip but deleted by
  // payInputsFrom, so a payslip with no CPF line - every Work Permit holder's -
  // left the button disabled saying "the readers did not settle it" and "nothing
  // has been calculated", both false as to that field. Worse, the worker could
  // then answer it, get a green chip, and have the answer thrown away. Both
  // places now read the server's one list.
  const cpfOnly = new Set(extract.cpf_only_fields);
  for (const f of extract.read_fields) {
    if (cpfOnly.has(f.name)) continue;
    if (!isEstablished(f.fact.status) && !answers[f.name]?.trim()) {
      out.push({ name: f.name, label: f.label, group: "read" });
    }
  }
  for (const f of extract.worker_fields) {
    // The engines' pay pack does not take residency or date of birth; those two
    // are held for the CPF pack and do not block this calculation.
    if (f.required_for.includes("cpf") || cpfOnly.has(f.name)) continue;
    // Only a rest day established as worked makes "who asked?" a question.
    // While it is unknown, `rest_day_hours` is itself unresolved and already on
    // this list, so the worker is pointed at the thing that settles it.
    if (
      f.name === "rest_day_requested_by" &&
      restDayVerdict(extract, answers).state !== "worked"
    ) {
      continue;
    }
    if (!answers[f.name]?.trim()) {
      out.push({ name: f.name, label: f.label, group: "worker" });
    }
  }
  return out;
}

/**
 * Assemble the PayInputs the engine takes.
 *
 * A worker's answer always becomes HUMAN_CONFIRMED; a reader agreement is
 * carried through as it arrived, source and all. Nothing here is defaulted: a
 * field with no agreement and no answer is passed on with the status it has, so
 * the engine is the thing that refuses it, not this file.
 */
export function payInputsFrom(
  extract: ExtractOut,
  answers: Record<string, string>,
): PayInputs {
  const out: Record<string, Fact | null> = {};

  for (const f of extract.read_fields) {
    const typed = answers[f.name]?.trim();
    out[f.name] = typed
      ? {
          value: typed,
          status: "HUMAN_CONFIRMED",
          source: `you answered on screen: ${f.label}`,
        }
      : f.fact;
  }

  for (const f of extract.worker_fields) {
    if (f.required_for.includes("cpf")) continue; // held for the CPF pack
    const typed = answers[f.name]?.trim();
    out[f.name] = typed
      ? {
          // Naming the field does two things: the provenance list under the
          // headline figure says WHICH answer a dollar came from, and the
          // strings stop colliding - three worker answers all reading "worker
          // answered on screen" collide, which React then rendered with
          // duplicate keys and which /impact refuses outright.
          value: typed,
          status: "HUMAN_CONFIRMED",
          source: `you answered on screen: ${f.label}`,
        }
      : { value: null, status: "MISSING", source: `you have not answered: ${f.label}` };
  }

  // The rest-day pair travels together or not at all: rules.py drops BOTH when
  // only one is supplied, with no flag (docs/debt.md, half-input-silently-dropped).
  //
  // Which way it travels depends on all three states, not two. Nulling the pair
  // whenever it is not established would tell the engine "no rest day was
  // worked" on a month where the readers simply had not settled it - the same
  // false claim the screen used to make in words.
  switch (restDayVerdict(extract, answers).state) {
    case "worked":
      break; // both facts are established or confirmed; send them as they are
    case "not_worked":
      // Established as zero: there is no rest-day component to compute.
      out.rest_day_hours = null;
      out.rest_day_requested_by = null;
      break;
    case "unknown":
      // Send both unestablished so the ENGINE refuses. The gate should have
      // blocked this already; if it ever does not, a refusal is the right
      // outcome and silently dropping a rest day is not.
      out.rest_day_requested_by = {
        value: null,
        status: "MISSING",
        source: "not established: whether a rest day was worked is unresolved",
      };
      break;
  }

  // Not PayInputs fields - they belong to the CPF pack. Derived from the same
  // server list the compute gate reads, so the two cannot drift: the gate used
  // to block on a field this function then deleted.
  for (const name of extract.cpf_only_fields) delete out[name];

  return out;
}
