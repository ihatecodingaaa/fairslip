"use client";

/**
 * Who read the documents, and which path the reading came down.
 *
 * TWO FACTS, ONE STRIP. They were two stacked cards - "Who read your documents"
 * and a full-width banner about the cache - and the second was often the largest
 * coloured block on the screen, above the worker's own figures, saying something
 * about demo infrastructure.
 *
 * BOTH ARE STILL SAID IN FULL, and neither is inferred:
 *
 *   The reader chips carry `source`, so a reader that could not be reached is
 *   named as one rather than being absent - and a reader outage never promotes
 *   the surviving reader's answer to a fact.
 *
 *   The aggregate is the backend's `reading_state`, decided once there so the
 *   screen cannot invent its own definition of "cached". A fast response is not
 *   evidence the cache was used: the second production call was 3.76s against
 *   9.06s and was two live calls on warm connections. See docs/debt.md,
 *   fast-is-not-cached and write-path-contradicts-its-own-contract.
 *
 * A TIME IS ONLY SHOWN FOR A CALL THAT HAPPENED, because only then does it
 * describe THIS request. The entry's own generation latency has its own name
 * (`entry_latency_ms`) and never reaches a screen: printing it beside a cache
 * chip read as "this cached reply took 3,688 ms" for a replay that took about a
 * millisecond. See docs/debt.md, cached-path-wearing-a-live-timing.
 *
 * WHICH WORDS GO WITH WHICH SOURCE IS NOT DECIDED HERE. readerSource.ts owns
 * that, and the evidence lens renders the same four states from the same map -
 * a rule with two copies is a rule with no owner. The state that matters is
 * FALLBACK_CACHE: the reading has values and is `ok`, so everything about it
 * looks like an answer, and only the label and `live_error` say that the model
 * was asked and did not give one.
 */

import type { ExtractOut } from "@/lib/api";
import { T, useT } from "../ui/Prefs";
import {
  SOURCE_LABEL_KEY,
  TONE_CLASS,
  answeredKey,
  isLive,
  requestLatencyMs,
  sourceTone,
} from "./readerSource";

/** One line per aggregate state, total over the states the backend can send.
 * The detail underneath is the backend's generated note, which names each
 * reader; this is only the headline, and it never claims a model answered on a
 * state where one did not. */
const SUMMARY: Record<ExtractOut["reading_state"], string> = {
  LIVE: "Read live just now - both models were called",
  CACHE: "Replayed from the committed cache - no model was called",
  FALLBACK_CACHE: "A model was called and failed - a stored reading was used instead",
  MIXED: "One reading came from a model just now, the other did not",
  NONE: "Nothing was read",
};

export function ReaderStrip({
  extract,
  headingRef,
}: {
  extract: ExtractOut;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const state = extract.reading_state;
  const cached = state === "CACHE";
  // The two states worth interrupting for: a reading stood in for a model that
  // was asked and failed, or the readings did not all arrive the same way. Both
  // mean at least one figure below is not this model's answer to this document.
  const replayedAfterFailure = state === "FALLBACK_CACHE" || state === "MIXED";

  return (
    <section className="rounded-lg border border-line-strong bg-surface p-5 shadow-card">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-body font-semibold uppercase tracking-wide text-ink-3"
      >
        <T k="check.readersHeading" />
      </h2>

      <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        {extract.readers.map((r) => (
          <li key={r.key} className="flex flex-col">
            <span className="text-body font-semibold text-ink">{r.provider}</span>
            <span className="font-mono text-meta text-ink-2">{r.model}</span>
            <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
              {/* Only where a model either answered or did not. On a replayed
                  reading this says nothing, because "answered" would be about
                  the model and the model did not. */}
              {answeredKey(r) && (
                <span
                  className={`text-meta font-semibold ${
                    isLive(r) ? "text-agreed-fg" : "text-danger-fg"
                  }`}
                >
                  {t(answeredKey(r)!)}
                </span>
              )}
              <span className={`text-meta ${TONE_CLASS[sourceTone(r)]}`}>
                {t(SOURCE_LABEL_KEY[r.source])}
              </span>
              {requestLatencyMs(r) !== null && (
                <span className="font-mono text-meta text-ink-3">{requestLatencyMs(r)} ms</span>
              )}
            </span>
            {/* Both are shown, because they are different facts. `error` says
                this reader produced nothing; `live_error` says a model was
                called and failed - which is true of a FALLBACK reading too,
                where there ARE values and nothing else on screen would say so. */}
            {r.error && <span className="mt-1 text-meta text-danger-fg">{r.error}</span>}
            {r.source === "FALLBACK_CACHE" && r.live_error && (
              <span className="mt-1 text-meta text-attention-fg">{r.live_error}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="max-w-measure mt-4 text-meta text-ink-2">
        <T k="check.readersNote" />
      </p>

      {/* The provenance note, as a note. It is FairSlip's account of its own
          plumbing, and it belongs at the size of a footnote rather than at the
          size of a finding - EXCEPT where a model was asked and did not answer.
          Then it is opened, and coloured, because a figure below came from a
          stored reading rather than from the model this page names. */}
      <details
        className={`mt-3 ${replayedAfterFailure ? "rounded-sm border border-attention-line bg-attention-bg px-3 py-2" : ""}`}
        open={replayedAfterFailure}
      >
        <summary
          className={`cursor-pointer text-meta font-semibold ${
            replayedAfterFailure
              ? "text-attention-fg"
              : cached
                ? "text-agreed-fg"
                : state === "NONE"
                  ? "text-danger-fg"
                  : "text-brand-fg"
          }`}
        >
          {SUMMARY[state]}
        </summary>
        <p
          className={`max-w-measure mt-2 text-meta ${
            replayedAfterFailure ? "text-attention-fg" : "text-ink-2"
          }`}
        >
          {extract.reading_note}
        </p>
      </details>
    </section>
  );
}
