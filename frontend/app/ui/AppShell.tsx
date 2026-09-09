"use client";

/**
 * One frame around the whole product.
 *
 * FairSlip is two surfaces sharing one engine, and until now nothing on screen
 * said so: /check, /employer and /scale each opened with their own heading and a
 * four-metre-wide card of language, text-size and contrast radios. A reader
 * landing on the employer page had no way to know the worker page existed, and
 * the first thing anyone met on any page was a settings panel.
 *
 * THE UTILITY CONTROLS ARE THE SAME CONTROLS. Nothing was removed and nothing
 * was reimplemented: <Controls /> is rendered verbatim inside a disclosure, so
 * the language switcher, the disclosure about who wrote the translations, the
 * text-size multiplier and the contrast mode all behave exactly as they did.
 * What changed is that they no longer occupy the top of the task.
 *
 * WHY <details> AND NOT A HAND-ROLLED POPOVER. The browser gives a summary
 * element a button role, keyboard activation, and an expanded state that
 * assistive technology reports - all of which a div with an onClick has to be
 * given by hand and is routinely given wrongly. It also works before hydration,
 * which matters on the hardware this product is for.
 *
 * THE SKIP LINK IS NOT DECORATION. With a nav ahead of every page's content, a
 * keyboard or switch user otherwise traverses six controls to reach the thing
 * they came for, on every page, every time. WCAG 2.4.1.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Controls, TranslationDisclosure } from "./Controls";
import { T, useT } from "./Prefs";
import type { Key } from "@/lib/i18n";

const MAIN_ID = "fairslip-main";

/** The two surfaces, and the one secondary route. `hint` says WHEN each side of
 * the product is used, because that is the difference between them - the engine
 * is the same. */
const ROUTES: { href: string; label: Key; hint: Key }[] = [
  { href: "/check", label: "nav.worker", hint: "nav.workerHint" },
  { href: "/employer", label: "nav.employer", hint: "nav.employerHint" },
];

export function AppShell({
  children,
  width = "wide",
}: {
  children: ReactNode;
  /** `reading` is prose measure for the coverage page; `wide` is the workspace
   * width the trail and the payroll grid need. Two values, not a free number:
   * a layout knob with a range is a layout that drifts page to page. */
  width?: "wide" | "reading";
}) {
  const t = useT();
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink">
      {/* Off-screen until focused, then the first thing in the tab order. */}
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-sm focus:border focus:border-control focus:bg-surface focus:px-4 focus:py-2 focus:text-body focus:font-semibold focus:text-ink"
      >
        <T k="nav.skip" />
      </a>

      {/* print-hide: navigation and display settings are choices about a screen.
          What they CHANGED is on the paper - the words are in the chosen
          language, at the chosen size - so they have done their work by the time
          anything is printed. The sheet's own masthead opens the paper. */}
      <header className="print-hide border-b border-line-strong bg-surface">
        <div
          className={`mx-auto flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3 ${
            width === "reading" ? "max-w-3xl" : "max-w-6xl"
          }`}
        >
          <Link
            href="/"
            aria-label={t("nav.home")}
            className="tap-sm inline-flex items-center text-lead font-semibold tracking-tight text-ink"
          >
            FairSlip
          </Link>

          <nav aria-label="FairSlip" className="flex flex-wrap items-center gap-2">
            {ROUTES.map((r) => {
              const here = pathname === r.href;
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  aria-current={here ? "page" : undefined}
                  className={`tap-sm inline-flex flex-col justify-center rounded-sm border px-4 py-2 ${
                    here
                      ? "border-ink bg-muted text-ink"
                      : "border-line bg-surface text-ink-2 hover:border-control hover:text-ink"
                  }`}
                >
                  <span className="text-body font-semibold">
                    <T k={r.label} />
                  </span>
                  <span className="text-meta text-ink-3">
                    <T k={r.hint} />
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <Link
              href="/scale"
              aria-current={pathname === "/scale" ? "page" : undefined}
              className={`tap-sm inline-flex items-center text-meta underline underline-offset-4 ${
                pathname === "/scale" ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              <T k="nav.coverage" />
            </Link>
            <UtilityMenu />
          </div>
        </div>
      </header>

      {/* Persistent, and rendered by the file that owns the sentence. A reader
          who chose Bengali and closed the panel is still reading model-produced
          translations. */}
      <TranslationDisclosure />

      <main
        id={MAIN_ID}
        className={`mx-auto w-full flex-1 px-5 py-10 ${
          width === "reading" ? "max-w-3xl" : "max-w-6xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Language, text size and contrast, folded into one control.
 *
 * The panel is the existing <Controls /> and the disclosure is the only new
 * thing. On a phone it is full width beneath the header, because a right-anchored
 * dropdown of four language buttons at 150% text size does not fit inside 390px
 * and would either clip or push the page sideways.
 */
function UtilityMenu() {
  const t = useT();
  return (
    <details className="group relative">
      <summary
        aria-label={t("nav.displayOpen")}
        className="tap-sm inline-flex cursor-pointer list-none items-center gap-2 rounded-sm border border-control bg-surface px-4 py-2 text-meta font-semibold text-ink hover:border-ink [&::-webkit-details-marker]:hidden"
      >
        {/* Two sliders. Not a cog: a cog says "settings for the software", and
            these are settings for the reader's own eyes and language. */}
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M2.5 5h11M2.5 11h11" />
          <circle cx="6" cy="5" r="1.8" />
          <circle cx="10.5" cy="11" r="1.8" />
        </svg>
        <T k="nav.display" />
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-[min(92vw,32rem)] rounded-lg border border-line-strong bg-surface p-4 shadow-card">
        <Controls />
      </div>
    </details>
  );
}
