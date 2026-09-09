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
 *   The reader chips carry `ok`, so a reader that could not be reached is named
 *   as one rather than being absent - and a reader outage never promotes the
 *   surviving reader's answer to a fact.
 *
 *   The cache state is the backend's `cache_state`, aggregated once there so the
 *   screen cannot decide for itself what "cached" means. A fast response is not
 *   evidence the cache was used: the second production call was 3.76s against
 *   9.06s and was two live calls on warm connections. See docs/debt.md,
 *   fast-is-not-cached and write-path-contradicts-its-own-contract.
 *
 * A TIME IS ONLY SHOWN FOR A LIVE CALL, because only then does it describe THIS
 * request. `latency_ms` on a hit is the latency recorded when the entry was
 * generated, and printing it beside a cache chip read as "this cached reply took
 * 3,688 ms" for a replay that took about a millisecond. See docs/debt.md,
 * cached-path-wearing-a-live-timing.
 */

import type { ExtractOut } from "@/lib/api";
import { T, useT } from "../ui/Prefs";

export function ReaderStrip({
  extract,
  headingRef,
}: {
  extract: ExtractOut;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useT();
  const cached = extract.cache_state === "HIT";
  const partial = extract.cache_state === "PARTIAL";

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
              <span
                className={`text-meta font-semibold ${
                  r.ok ? "text-agreed-fg" : "text-danger-fg"
                }`}
              >
                {r.ok ? t("check.answered") : t("check.didNotAnswer")}
              </span>
              <span className="text-meta text-ink-3">
                {r.cache === "HIT" ? t("check.fromCache") : t("check.calledLive")}
              </span>
              {r.cache !== "HIT" && r.latency_ms !== null && (
                <span className="font-mono text-meta text-ink-3">{r.latency_ms} ms</span>
              )}
            </span>
            {r.error && <span className="mt-1 text-meta text-danger-fg">{r.error}</span>}
          </li>
        ))}
      </ul>

      <p className="max-w-measure mt-4 text-meta text-ink-2">
        <T k="check.readersNote" />
      </p>

      {/* The cache note, as a note. It is FairSlip's account of its own
          plumbing, and it belongs at the size of a footnote rather than at the
          size of a finding - except when it is PARTIAL, which is the state that
          means the offline path is fiction and is the one worth interrupting for. */}
      <details className={`mt-3 ${partial ? "rounded-sm border border-attention-line bg-attention-bg px-3 py-2" : ""}`}>
        <summary
          className={`cursor-pointer text-meta font-semibold ${
            partial ? "text-attention-fg" : cached ? "text-agreed-fg" : "text-brand-fg"
          }`}
        >
          {cached
            ? "Replayed from the committed cache - no model was called"
            : partial
              ? "Partly cached, partly live"
              : "Read live just now - not from the cache"}
        </summary>
        <p
          className={`max-w-measure mt-2 text-meta ${
            partial ? "text-attention-fg" : "text-ink-2"
          }`}
        >
          {extract.cache_note}
        </p>
      </details>
    </section>
  );
}
