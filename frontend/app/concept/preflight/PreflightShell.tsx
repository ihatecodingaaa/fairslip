"use client";

/**
 * The frame around the concept, and it is NOT the product's frame.
 *
 * WHY NOT <AppShell />. The app's shell carries the navigation between the two
 * surfaces that exist today, and putting a route in it that is neither of them
 * would either change that navigation or sit inside it unannounced. Neither is
 * something a concept branch should do to a live product. So this is a shell of
 * its own: the same tokens, the same type scale, the same focus ring, the same
 * skip link, and a masthead that says what the page is instead of pretending to
 * be part of the product's own map.
 *
 * IT IS ALSO WHY THE CONCEPT IS NOT LINKED FROM ANYWHERE. /, /check and
 * /employer are untouched, and a test asserts that none of them points here.
 * A reviewer reaches this page because somebody sent them the link.
 *
 * THE DISPLAY CONTROLS ARE THE PRODUCT'S OWN MECHANISM, reached through
 * usePrefs(): the text-size multiplier moves --ui-scale and the contrast switch
 * sets data-contrast, exactly as they do on every other page, because both are
 * one line of CSS custom property rather than a second layout. The language
 * switcher is deliberately absent: this concept is written in English only and
 * offering four languages would claim a translation that does not exist.
 */

import type { ReactNode } from "react";
import { usePrefs, type Scale } from "../../ui/Prefs";
import { ConceptRibbon } from "./ConceptBadge";

const MAIN_ID = "concept-preflight-main";

export function PreflightShell({
  children,
  controls,
}: {
  children: ReactNode;
  /** The demo controls. Rendered by the shell so they sit above everything and
   * survive a view change. */
  controls?: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-sm focus:border focus:border-control focus:bg-surface focus:px-4 focus:py-2 focus:text-body focus:font-semibold focus:text-ink"
      >
        Skip to the preflight
      </a>

      <ConceptRibbon />

      <header className="border-b border-line-strong bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <p className="text-lead font-semibold tracking-tight text-ink">
            FairSlip <span className="font-medium text-ink-3">Preflight</span>
          </p>
          <div className="ml-auto">
            <DisplayControls />
          </div>
        </div>
      </header>

      <main id={MAIN_ID} className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <p className="max-w-measure text-meta text-ink-3">
            A future product concept, not a deployed integration. Nothing on this page is
            connected to an HR or payroll system, no model was called to produce it, and no
            employee record is real. Figures marked as a published rule were produced by
            FairSlip&apos;s own engines and are re-checked by the project&apos;s test suite;
            everything else is a line from an invented export.
          </p>
        </div>
      </footer>

      {/* Bottom right, above the page, on every view. The badge is NOT here:
          it is the ribbon at the top, which stays on screen without sitting on
          top of anything. What floats is a control, and it is closed until
          somebody opens it. */}
      <div className="fixed bottom-4 right-4 z-10 print-hide">{controls}</div>
    </div>
  );
}

/**
 * Text size and contrast, and nothing else.
 *
 * Both write to the same store the rest of the product uses, so a reader who
 * set 150% on /check arrives here at 150%. That is the point of having one
 * mechanism rather than one per page.
 */
function DisplayControls() {
  const { scale, setScale, hc, setHighContrast } = usePrefs();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Text size" className="flex rounded-sm border border-control">
        {([1, 2, 3] as Scale[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScale(s)}
            aria-pressed={scale === s}
            className={`tap-sm px-3 py-2 text-meta ${
              scale === s ? "bg-muted font-semibold text-ink" : "font-medium text-ink-2"
            }`}
          >
            {s === 1 ? "A" : s === 2 ? "A+" : "A++"}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setHighContrast(!hc)}
        aria-pressed={hc}
        className={`tap-sm rounded-sm border px-3 py-2 text-meta ${
          hc ? "border-ink bg-muted font-semibold text-ink" : "border-control font-medium text-ink-2"
        }`}
      >
        High contrast
      </button>
    </div>
  );
}
