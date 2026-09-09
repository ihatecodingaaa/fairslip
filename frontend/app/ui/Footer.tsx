"use client";

/**
 * What FairSlip does not check, and what these figures are not.
 *
 * One copy, on every page that carries a figure. It was duplicated
 * character-for-character in two files, which is how a caveat comes to be
 * corrected in one place and left standing in the other.
 *
 * It is NOT print-hidden. On the take-away sheet this is the paragraph a
 * caseworker needs most: it says the figures are a reconstruction from published
 * rules and not a determination of anything.
 */

import { API_BASE } from "@/lib/api";
import { T } from "./Prefs";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line-strong pt-6 text-meta text-ink-2">
      <p className="font-semibold text-ink-2">
        <T k="footer.outside" />
      </p>
      <p className="max-w-measure mt-1">
        <T k="footer.outsideBody" />
      </p>
      <p className="max-w-measure mt-3">
        <T k="footer.notADetermination" />
      </p>
      <p className="mt-3 font-mono text-meta text-ink-3">
        <T k="footer.engines" /> {API_BASE || "same origin"}
      </p>
    </footer>
  );
}
