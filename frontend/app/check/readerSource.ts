/**
 * How a reading's provenance is worded, and which duration may be shown beside
 * it. THE ONLY PLACE EITHER DECISION IS MADE.
 *
 * WHY ONE OWNER. The rule "never label a fallback as live" is not enforceable
 * if two components each write their own ternary - that is a rule with two
 * copies and no owner, which is how the translation caveat came to be printed
 * where it had not been earned (tests/test_inclusion.py, CAVEAT_OWNERS). The
 * reader strip and the evidence lens both render this; both call in here.
 *
 * FOUR STATES, FOUR WORDINGS. They are not a spectrum and must not collapse:
 *
 *   LIVE            this model was called for this request and answered
 *   CACHE           no model call produced this reading for this request
 *   FALLBACK_CACHE  a live call was ATTEMPTED, FAILED, and an entry was replayed
 *   NONE            nothing was read
 *
 * A fallback is the state a screen is most likely to get wrong, because the
 * reading HAS values and is `ok` - everything about it looks like an answer.
 * It is given its own words, and `live_error` is rendered alongside, so the
 * failed attempt reaches the viewer rather than being absorbed into a chip.
 *
 * THE TIMING RULE. Only a duration that describes THIS request may be shown.
 * `entry_latency_ms` is the latency recorded when the committed entry was
 * generated, on another day against another network, and the screen printed it
 * beside a cache chip once already - "from cache 3688 ms" for a replay that
 * took about a millisecond (docs/debt.md, cached-path-wearing-a-live-timing).
 * requestLatencyMs() is the only way a component gets a number, and it can only
 * ever return the live one.
 */

import type { Key } from "@/lib/i18n";
import type { ReaderInfo, ReaderSource } from "@/lib/api";

/** Every source the backend can send. Kept in step with fairslip/extract.py's
 * READER_SOURCES by tests/test_reader_source_ui.py, which compares the two
 * lists rather than trusting them to be edited together. */
export const READER_SOURCES: readonly ReaderSource[] = [
  "LIVE",
  "CACHE",
  "FALLBACK_CACHE",
  "NONE",
] as const;

/** One phrase per source. Total over ReaderSource, so a new source added to the
 * backend cannot reach a screen with no words for it. */
export const SOURCE_LABEL_KEY: Record<ReaderSource, Key> = {
  LIVE: "check.calledLive",
  CACHE: "check.fromCache",
  FALLBACK_CACHE: "check.fellBackToCache",
  NONE: "check.nothingRead",
};

/** Whether this reading is a model's answer to THIS request. The only place the
 * word "live" is decided; nothing else may test the source for itself. */
export function isLive(r: ReaderInfo): boolean {
  return r.source === "LIVE";
}

/**
 * Whether a MODEL answered, in words - and NULL where the question does not
 * apply.
 *
 * "Answered" is a claim about the model, and `ok` is a claim about the reading:
 * they came apart the moment a fallback existed. A FALLBACK_CACHE reading is
 * `ok` and has values, so a chip driven by `ok` printed "answered" directly
 * beside "live call failed - replayed from cache" - two statements about the
 * same reader, in the same row, contradicting each other. The model had not
 * answered; a file had.
 *
 * So this is only ever said where it is true either way: LIVE, where a model
 * answered, and NONE, where none did. On the two replayed states the source
 * label is the whole and accurate account, and nothing is added beside it.
 */
export function answeredKey(r: ReaderInfo): Key | null {
  if (r.source === "LIVE") return "check.answered";
  if (r.source === "NONE") return "check.didNotAnswer";
  return null;
}

/** True where the values on screen came out of a committed entry rather than a
 * model called just now - the deliberate replay and the fallback alike. */
export function isReplayed(r: ReaderInfo): boolean {
  return r.source === "CACHE" || r.source === "FALLBACK_CACHE";
}

/**
 * Milliseconds that describe THIS request, or null.
 *
 * Returns the live call's duration - on a success and on a failure, since both
 * are time the viewer waited. Never `entry_latency_ms`, which describes the day
 * the entry was made and belongs to no request in front of anyone.
 */
export function requestLatencyMs(r: ReaderInfo): number | null {
  return r.live_attempted ? r.live_latency_ms : null;
}

/** The tone a source should carry. Kept here with the words, so a component
 * cannot colour a fallback like an answer while labelling it like a failure. */
export function sourceTone(r: ReaderInfo): "ok" | "attention" | "danger" {
  if (r.source === "LIVE") return "ok";
  if (r.source === "NONE") return "danger";
  return "attention";
}

/** The class per tone, here rather than in each component - three screens now
 * render a reader's provenance, and a fallback shown in the green of an answer
 * on one of them would undo the label on all of them. */
export const TONE_CLASS: Record<ReturnType<typeof sourceTone>, string> = {
  ok: "text-agreed-fg",
  attention: "text-attention-fg",
  danger: "text-danger-fg",
};

/**
 * The same four states in words for the PRINTED sheet, which is the artefact a
 * worker carries to a counter.
 *
 * Not translated, because the rest of that sheet is not: it is deliberately one
 * English document to hand across a desk, and half a translated page would be
 * worse than a whole English one. Not shortened either - on paper there is no
 * colour, no tooltip and no second line to carry what a chip leaves out, so
 * each phrase has to be complete on its own.
 */
export function printedSource(r: ReaderInfo): string {
  switch (r.source) {
    case "LIVE":
      return "called and answered";
    case "CACHE":
      return "not called; a stored reading was used";
    case "FALLBACK_CACHE":
      return `called and failed (${r.live_error ?? "no reason recorded"}); a stored reading was used instead`;
    case "NONE":
      return `did not answer (${r.error ?? "no reason recorded"})`;
  }
}
