"use client";

/**
 * The label that never comes off.
 *
 * THIS IS THE MOST IMPORTANT COMPONENT IN THE CONCEPT. Everything else on these
 * screens is a drawing of a workflow that does not exist yet, with figures from
 * a company that does not exist at all, and the whole thing is good enough to
 * be mistaken for a running product by someone who sees it for ninety seconds
 * in a meeting. So it says what it is, at the top of the page and in a ribbon
 * that stays on screen however far down you scroll, and no view can turn it off.
 *
 * TWO CLAIMS, BOTH LOAD-BEARING, WRITTEN ONCE. That this is a prototype, and
 * that the data is invented. Either alone reads worse than both: "concept"
 * without "fictional" invites someone to ask whose payroll that was, and
 * "fictional data" without "concept" suggests the software is real and only the
 * numbers are made up. They live in the constants below so the two places that
 * draw them cannot drift into saying different things.
 *
 * A STICKY RIBBON, NOT A FLOATING CHIP, and that was decided by looking at it.
 * The first version pinned a small badge to the bottom-right corner, where at
 * 390px it sat on top of the sentence about when payroll closes. A label whose
 * price is covering the content is a label someone will eventually want
 * removed. The ribbon costs a line of layout and covers nothing.
 */

const WHAT_IT_IS = "Concept prototype";
const WHAT_THE_DATA_IS = "Fictional Singapore company data";

/**
 * The two claims, as a strip that stays at the top of the viewport.
 *
 * ONE RENDERING, NOT TWO. An earlier version put the same two sentences in the
 * masthead as well, sixty pixels above this, which is how a product ends up
 * with two accounts of what it is - and eventually with the weaker one being
 * the one that stays on screen. The longer disclosure in the footer says more
 * rather than the same thing again.
 */
export function ConceptRibbon() {
  return (
    <div className="sticky top-0 z-10 border-b border-attention-line bg-attention-bg">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-meta text-attention-fg">
        <span className="font-semibold uppercase tracking-wide">{WHAT_IT_IS}</span>
        <span>{WHAT_THE_DATA_IS}</span>
      </p>
    </div>
  );
}
