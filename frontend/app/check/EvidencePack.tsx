"use client";

/**
 * The thing a worker carries out of the building.
 *
 * IT IS NOT A NEW DOCUMENT. FairSlip already prints an evidence sheet, and that
 * sheet is this DOM narrowed by the rules in globals.css - the readings, the
 * worker's own answers, the arithmetic and every formula, in black on white,
 * built for a second-generation photocopy. Writing a second renderer for it
 * would put a second copy of every figure in the codebase, which is the one
 * thing this product is an argument against.
 *
 * SO THIS PANEL DOES THREE THINGS THE SHEET COULD NOT DO FOR ITSELF:
 *
 *   1. IT NAMES THE ARTEFACT, and says what it is not. "Evidence pack" is what
 *      a worker is looking for; "this is not a claim, and not proof" is what
 *      nobody should have to infer from a document they are about to hand to
 *      somebody with authority.
 *
 *   2. IT OFFERS A ONE-PAGE VERSION. The full pack runs to several pages, which
 *      is right for an NGO caseworker and wrong for a worker who wants the
 *      figure and the caveat in their hand. SIMPLE prints the answer, what could
 *      not be established, and the scope - and says on the paper what it left
 *      out, because an omission a reader cannot see is a decision made for them.
 *
 *   3. IT OFFERS THE FACTS AS DATA. A caseworker with the JSON can check every
 *      figure against the engine without retyping anything. It carries what the
 *      response carried and nothing else.
 *
 * THE PRESET CHANGES THE PAPER, NOT THE SCREEN. Everything stays on screen in
 * both modes; `pack-simple` is only consulted inside `@media print`. A preset
 * that hid things from the screen would make the screen and the sheet two
 * different accounts of one month.
 */

import type { ExtractOut, PayBreakdown, PayInputs } from "@/lib/api";
import { T, useT } from "../ui/Prefs";
import { downloadText } from "../employer/svgExport";

export type PackPreset = "simple" | "detailed";

export function EvidencePack({
  preset,
  onPreset,
  breakdown,
  inputs,
  extract,
  documents,
  computedAt,
}: {
  preset: PackPreset;
  onPreset: (p: PackPreset) => void;
  breakdown: PayBreakdown;
  /** The exact facts that produced the breakdown - not what is on screen now.
   * The same object the trail is drawn from, so the download cannot describe a
   * month the figures above it did not come from. */
  inputs: PayInputs;
  extract: ExtractOut;
  documents: { role: string; name: string }[];
  computedAt: string | null;
}) {
  const t = useT();

  function downloadFacts() {
    /* WHAT THE RESPONSE CARRIED, AND NOTHING ELSE.
       No score, no verdict, no interpretation. Each fact keeps the status and
       the provenance string the backend gave it, so a reader can see which were
       agreed by two readers and which the worker answered - which is the whole
       distinction the product is built on. */
    const pack = {
      what_this_is:
        "Figures reconstructed by FairSlip from MOM's and CPF Board's published rules, " +
        "with the source of every input. It is not a claim, not a determination, and not proof of anything.",
      computed_at: computedAt,
      documents_read: documents.map((d) => ({ role: d.role, filename: d.name })),
      readers: extract.readers.map((r) => ({
        provider: r.provider,
        model: r.model,
        source: r.source,
      })),
      facts: inputs,
      reader_fields: extract.read_fields.map((f) => ({
        name: f.name,
        label: f.label,
        status: f.fact.status,
        value: f.fact.value,
        source: f.fact.source,
        readings: f.readings,
      })),
      breakdown,
      not_checked:
        "Daily and piece-rated workers; public-holiday pay; shift-work averaging; CPF on " +
        "monthly wages of $750 or less; PR year 1 and 2 CPF rates; Additional Wages; platform " +
        "workers; domestic workers; and any question of legal liability.",
    };
    downloadText(
      JSON.stringify(pack, null, 2) + "\n",
      `fairslip-evidence-${(computedAt ?? "").slice(0, 10) || "pack"}.json`,
      "application/json",
    );
  }

  return (
    <section
      aria-labelledby="pack-heading"
      className="print-hide rounded-lg border border-line-strong bg-surface p-5 shadow-card"
    >
      <h3 id="pack-heading" className="text-title font-semibold">
        <T k="pack.heading" />
      </h3>
      <p className="max-w-measure mt-1 text-body text-ink-2">
        <T k="pack.lede" />
      </p>

      <fieldset className="mt-4">
        <legend className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          <T k="pack.howMuch" />
        </legend>
        <div className="mt-2 grid gap-1">
          {(
            [
              ["simple", "pack.simple", "pack.simpleWhat"],
              ["detailed", "pack.detailed", "pack.detailedWhat"],
            ] as const
          ).map(([id, label, what]) => (
            <label
              key={id}
              className="tap-sm flex items-start gap-3 rounded-sm px-1 py-1 hover:bg-muted"
            >
              <input
                type="radio"
                name="packPreset"
                checked={preset === id}
                onChange={() => onPreset(id)}
                className="mt-1 size-4 shrink-0"
              />
              <span className="min-w-0">
                <span
                  className={`block text-body ${
                    preset === id ? "font-semibold text-ink" : "text-ink"
                  }`}
                >
                  <T k={label} />
                </span>
                <span className="max-w-measure block text-meta text-ink-3">
                  <T k={what} />
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid"
        >
          <T k="pack.print" />
        </button>
        <button
          type="button"
          onClick={downloadFacts}
          className="tap rounded-sm border border-control bg-surface px-4 py-2 text-body font-medium text-ink hover:border-ink"
        >
          <T k="pack.json" />
        </button>
      </div>

      {/* WHAT IT IS NOT, ON THE SCREEN AND ON THE PAPER. A worker is about to
          hand this to somebody with authority over them, and every sentence it
          does not say is one they might otherwise assume. */}
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          <T k="pack.notTitle" />
        </p>
        <ul className="max-w-measure mt-2 space-y-1 text-body text-ink-2">
          <li>
            <T k="pack.notClaim" />
          </li>
          <li>
            <T k="pack.notProof" />
          </li>
          <li>
            <T k="pack.notLegal" />
          </li>
        </ul>
        <p className="max-w-measure mt-2 text-meta text-ink-3">
          <T k="pack.whatItIs" />
        </p>
      </div>

      <span className="sr-only">{t("pack.heading")}</span>
    </section>
  );
}

/**
 * The line the SIMPLE sheet carries in place of what it left out.
 *
 * `print-only`, and rendered only in simple mode - so a worker who chose the
 * full pack is never told something was withheld from it, and a worker who
 * chose the short one is never left to discover it.
 */
export function PackOmissionNote({ preset }: { preset: PackPreset }) {
  if (preset !== "simple") return null;
  return (
    <p className="print-only mt-4 border-t border-line-strong pt-2 text-meta">
      <span className="font-semibold">
        <T k="pack.simpleOmitTitle" />
      </span>{" "}
      <T k="pack.simpleOmit" />
    </p>
  );
}
