"use client";

/**
 * The take-away: what a worker carries out of the building.
 *
 * A worker who finds a difference does not screenshot it. They print it, take
 * it to an NGO office, and it is photocopied there - and the copy is what
 * reaches the person who can act on it. Everything in this file and in the
 * @media print block of globals.css is aimed at that copy rather than at a
 * printer.
 *
 * THE SHEET IS THE SAME DOM, NARROWED.
 *
 * Nothing here re-states a figure. The read-aloud was built the same way and
 * for the same reason, recorded on Result in check/page.tsx: a second copy of a
 * number is a number that can drift from the one on screen, and the product is
 * an argument against exactly that. So print HIDES and RESTYLES. The only text
 * this file adds is text ABOUT the sheet - what it is, when its figures were
 * worked out, and what is deliberately not on it.
 *
 * WHAT IS NOT ON IT, AND WHY THAT IS THE INTERESTING PART.
 *
 * /check shows two different things at once, and on screen you can tell them
 * apart. Above: this worker's month, read from the documents they uploaded.
 * Below, on the agent panel: an EXAMPLE worker - Mei Ling or Rahim - with
 * fixture figures, a drafted message about their month, a CPF split for their
 * wage, and a month-2 verdict from a fixture. AgentPanel says so on screen, in
 * dashed boxes, and check/page.tsx already carries the comment explaining that
 * CPF figures without their basis sentence "read as the viewer's own month,
 * directly under their own reconciliation".
 *
 * That separation is held on screen by layout, by colour, by a caveat sentence,
 * and by the reader being able to see the whole page at once. A photocopy has
 * none of those. It has pages, and pages get separated. A sheet that carries
 * $23 of someone else's CPF onto the desk of a caseworker reading a worker's
 * evidence is the exact failure this product exists to prevent, and no label
 * survives being on the page that got detached.
 *
 * So the sheet carries two kinds of thing and nothing else:
 *
 *   1. This worker's month - the readings, who established each fact, the
 *      difference, and every component with its formula and its inputs.
 *   2. Published rules and quotations that apply to anyone - the TADM evidence
 *      list, the filing deadlines, what FairSlip does not check.
 *
 * The example worker's figures are none of those, so they stay on the screen.
 * They are not dropped silently: <ScreenOnly> leaves a line ON THE PAPER, in
 * the place the hidden block occupied, naming what was there and why it is not.
 * An omission a reader cannot see is a decision made on their behalf.
 *
 * That in-place line is also why there is no registry of "what was on screen
 * this run". The note renders where the block would have rendered, so it exists
 * exactly when the block did - a worker who never drafted a message is never
 * told a drafted message was withheld.
 */

import type { ReactNode } from "react";
import { BCP47, type Lang } from "@/lib/i18n";
import { T, usePrefs, useT } from "./Prefs";
import { printedSource } from "../check/readerSource";
import type { ReaderInfo } from "@/lib/api";

/**
 * Every region the paper drops, and the words that stand in its place.
 *
 * English literals rather than dictionary keys, matching TIMELINE in
 * AgentPanel.tsx and the escalation pack's own headings: this is explanatory
 * prose about FairSlip's behaviour in the same register as those, and it falls
 * in the same untranslated set, which lib/i18n.ts counts and the language
 * control discloses.
 *
 * backend/tests/test_print_sheet.py holds this registry from both sides. An id
 * hidden with no entry here fails; an entry naming nothing that is hidden fails
 * too, because a note claiming an omission that never happened sends a
 * caseworker looking for a section that is not missing.
 */
const PRINT_OMITTED = [
  {
    id: "cpf-example",
    label: "the CPF worked example",
    why: "It is a fictional example about an invented month, shown on screen to explain how unpaid overtime compounds into missing CPF. It is not this worker's CPF, and on paper - separated from the screen that says so - it would read as though it were. Why this month's own CPF is not shown is stated above, in the reconciliation.",
  },
  {
    id: "draft",
    label: "the drafted message and the record of sending it",
    why: "The message on screen is written about the example worker on the panel below the reconciliation, not about the month on this sheet. A message and a payslip printed on one page are read as belonging to each other.",
  },
  {
    id: "next-month",
    label: "next month's check",
    why: "It runs on fixture payslips for the example worker, so its verdict - corrected, partly corrected, not corrected - is about that fixture and not about this month. Verifying this worker's next payslip means reading it, which has not happened.",
  },
  {
    id: "agent-machine",
    label: "the diagram of what the agent may do next",
    why: "It shows which states the agent can reach at the mandate level currently set on screen, and that level is a control, not a fact about this month. On paper the control is gone and the diagram would be a picture of a setting nobody can see or change.",
  },
  {
    id: "money-trail",
    label: "the money trail and its inspector",
    why: "It is an interactive diagram of the same figures printed below: which documents were read, what each reader said, which facts each amount was built from. Every one of those is on this sheet in words already. It also holds the change-a-fact re-run, which answers what the engine would return if one fact were different - and those figures are hypothetical by construction, so a hypothetical printed beside a real one, in the same type, would stop being marked as one.",
  },
] as const;

type OmitId = (typeof PRINT_OMITTED)[number]["id"];

/**
 * A region that belongs on the screen and not on the paper.
 *
 * Two children, always: the block itself, hidden from print, and the line that
 * takes its place there. Rendering them as siblings is what makes the note
 * conditional on the block without any state - it is in the tree exactly when
 * the block is.
 */
export function ScreenOnly({
  id,
  children,
  noteClassName = "",
}: {
  id: OmitId;
  children: ReactNode;
  /** Padding for the standing note, which is a sibling of the hidden block and
   * therefore lands in whatever container that block was in. Those containers
   * do not agree: the agent panel pads itself and the result card pads each
   * child instead, so a note with one fixed inset is wrong in one of them. */
  noteClassName?: string;
}) {
  const entry = PRINT_OMITTED.find((o) => o.id === id);
  return (
    <>
      <div className="print-hide" data-print-omit={id}>
        {children}
      </div>
      {entry && (
        <p
          className={`print-only border-t border-line-strong pt-2 text-meta text-ink-2 ${noteClassName}`}
        >
          <span className="font-semibold">
            Shown on screen, not on this sheet: {entry.label}.
          </span>{" "}
          {entry.why}
        </p>
      )}
    </>
  );
}

/**
 * The first thing on page 1, and the only thing on the sheet that is about the
 * sheet.
 *
 * It carries the caveat the screen carries in its footer, at the top instead:
 * on a screen the footer is a scroll away and on paper page 3 may not arrive at
 * all. A document that states what it is not, before it states anything else,
 * is harder to misread as a demand for money.
 */
export function PrintMasthead({ computedAt }: { computedAt: string | null }) {
  const t = useT();
  const { lang } = usePrefs();
  return (
    <header className="print-only mb-4 border-b-2 border-line-strong pb-3">
      <h1 className="text-title font-semibold">FairSlip &mdash; {t("check.title")}</h1>
      <p className="mt-1 text-body">
        What MOM&rsquo;s published rules say this month should have paid, what the payslip and
        roster showed, and where every figure came from.
      </p>
      <p className="mt-2 text-meta">
        <T k="footer.notADetermination" />
      </p>
      {/* Not the moment this printed - the moment the engine ran. They differ,
          sometimes by days, and it is the second one that tells a caseworker how
          old the figures in their hand are. It is also the one FairSlip actually
          observed: the print itself happens inside a dialog this page is never
          told the outcome of, so "printed on" would be a claim about an event
          nothing here saw. */}
      {computedAt ? (
        <p className="mt-1 text-meta">
          These figures were worked out on {stamp(computedAt, lang)}.
        </p>
      ) : (
        <p className="mt-1 text-meta font-semibold">
          Nothing has been worked out yet, so this sheet carries no figures.
        </p>
      )}
    </header>
  );
}

/**
 * Page one, and the only page, when nothing has been worked out yet.
 *
 * A worker can reach the print dialog at any moment, and before the engine has
 * run the screen is a file picker, six unanswered questions and a table of
 * transcriptions. Printed, that came to five pages whose first line said
 * "Nothing has been worked out yet" - four and a half pages of empty form
 * fields and repeated provider names, carried out of the building by someone who
 * wanted the one page that says where they had got to.
 *
 * So the pre-result sheet is this instead: what was read, who read it, how much
 * of the month that settled, what is still open by name, and the sentence that
 * matters most on it. Every figure is counted from the same response the screen
 * renders; there is no second copy of anything.
 *
 * THE POST-RESULT SHEET IS UNCHANGED. Once a breakdown exists the full evidence
 * pack prints exactly as before - readings, comparison, worker answers, the
 * arithmetic and its provenance - because that sheet IS the artefact and its
 * contract is not what was wrong here.
 */
export function PrintPreResult({
  documents,
  readers,
  total,
  established,
  unresolved,
}: {
  documents: { name: string }[];
  /** The full reading, not a narrowed shape. It was {provider, model, ok},
   * and `ok` is true of a reading replayed after a failed call - so the
   * sheet could print that a model answered a document it never saw. The
   * provenance a printed record needs travels on `source` and `live_error`. */
  readers: ReaderInfo[];
  /** Read fields the response carried, and how many of them are settled. Counted
   * by the caller with the one function the screen's own tally uses. */
  total: number;
  established: number;
  /** The fields still waiting, by the label the worker sees. */
  unresolved: { label: string }[];
}) {
  return (
    <section className="print-only mb-4 border-b border-line-strong pb-3">
      <h2 className="text-body font-semibold">Where this check has got to</h2>

      <p className="mt-2 text-body font-semibold">No calculation has been performed yet.</p>
      <p className="max-w-measure mt-1 text-meta">
        This page records what was read and what is still open. It carries no figures for this
        month, because none have been worked out. The rest of the screen at this point is a set
        of questions waiting to be answered, and questions with no answers in them are not
        evidence of anything.
      </p>

      <dl className="mt-3 grid gap-2">
        <div>
          <dt className="text-meta font-semibold uppercase tracking-wide">Evidence received</dt>
          <dd className="text-meta">
            {documents.length === 0
              ? "None."
              : documents.map((d) => d.name).join(", ")}
          </dd>
        </div>
        <div>
          <dt className="text-meta font-semibold uppercase tracking-wide">Readers</dt>
          <dd className="text-meta">
            {/* THIS SHEET IS THE ONE A WORKER CARRIES TO A COUNTER, so where a
                reading came from is part of the record, not a screen detail.
                It said "answered" off `r.ok`, and a reading replayed after a
                failed call is `ok` - so a printed sheet could state that a model
                answered a document it never saw. `printedSource` names the four
                states in words that survive being read on paper, with no colour
                and no tooltip to carry the meaning. */}
            {readers.length === 0
              ? "Not called."
              : readers
                  .map((r) => `${r.provider} (${r.model}) — ${printedSource(r)}`)
                  .join("; ")}
          </dd>
        </div>
        {/* TWO DIFFERENT POPULATIONS, SAID SEPARATELY. The first pair counts the
            fields a reader was shown; the second counts everything the engine is
            still waiting on, which also includes the questions no reader is ever
            shown. Printed as one sentence they read as a contradiction - "6
            read, 4 established, 5 still open" - because they were never counting
            the same set. */}
        <div>
          <dt className="text-meta font-semibold uppercase tracking-wide">Read from the documents</dt>
          <dd className="text-meta">
            {total} fields, of which {established} are established.
          </dd>
        </div>
        <div>
          <dt className="text-meta font-semibold uppercase tracking-wide">
            Still to be answered before anything can be worked out
          </dt>
          <dd className="text-meta">
            {unresolved.length === 0
              ? "Nothing. The engine has not been asked to run."
              : `${unresolved.length}: ${unresolved.map((f) => f.label).join(", ")}.`}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * "Save or print this."
 *
 * window.print() and nothing else: no second render, no server round trip, no
 * PDF library. What is on the screen is what goes on the paper, which is the
 * whole design and also the reason this button is four lines long.
 */
/**
 * The moment, in words a person can read off paper.
 *
 * NOT toLocaleString(). Its default is the machine's locale, which on a laptop
 * bought anywhere produced "9/8/2026" - a date that is 9 August in most of the
 * world and 8 September in the one this sheet was printed in, with nothing on
 * the page to say which. A named month cannot be read two ways. The rest of the
 * format follows the language the reader chose, like every other string here.
 */
/** An ISO instant, in the reader's language.
 *
 * EXPORTED SO THE REVIEW PACK USES THIS ONE. A second formatter would be a
 * second answer to "when was this worked out" on two artefacts produced from
 * the same run - and the header of a forwarded report is exactly where that
 * would go unnoticed. The machine-readable ISO still travels, in the pack's Run
 * details and in the JSON export. */
export function stamp(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(BCP47[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="tap print-hide inline-flex items-center rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink"
    >
      Save or print this
    </button>
  );
}
