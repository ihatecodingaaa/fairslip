"use client";

/**
 * "These are the authority's exact words, and FairSlip has not verified a
 * translation of them."
 *
 * THE ONE PLACE THAT SENTENCE MAY BE RENDERED, and it renders nothing in
 * English.
 *
 * WHY THIS IS A COMPONENT AND NOT AN `&&`.
 *
 * The sentence explains a BOUNDARY: MOM's, TADM's and CPF Board's quotations
 * stay in English while the interface around them changes language, and the
 * reader is told so in the language they chose. In an English interface there
 * is no boundary. Nothing was translated, nothing was left untranslated, and
 * the sentence describes a limitation the product does not have on that screen.
 *
 * That makes it the inverse of every other defect in this codebase. The rest
 * are the product claiming more than it established; this one had the product
 * claiming LESS - a caveat it had not earned, printed beside every quotation on
 * the coverage page, in English, to readers for whom no translation existed.
 * An unearned caveat is still an unestablished statement about the product, and
 * it costs the same thing: a reader cannot tell which of your warnings are real
 * if you issue them where they do not apply.
 *
 * It was written as `{lang !== "en" && (...)}` at one call site and as nothing
 * at all at the second. Two copies of a rule is one copy too many, and the
 * defect was not that someone forgot - it was that forgetting was possible. So
 * the gate is inside the only component allowed to say it, and
 * backend/tests/test_inclusion.py holds a registry: every caveat key that must
 * not render in English maps to the ONE file permitted to render it, and that
 * file must contain a language gate. A third call site cannot reintroduce this
 * without failing the build.
 */

import { T, usePrefs } from "./Prefs";

export function QuotedInEnglish({ className = "" }: { className?: string }) {
  const { lang } = usePrefs();
  // The gate, and the whole point of the component. Returning null rather than
  // an empty element so no margin, border or padding survives the absence.
  if (lang === "en") return null;
  return (
    <p className={`max-w-measure text-meta ${className}`}>
      <T k="ctl.quotedInEnglish" />
    </p>
  );
}
