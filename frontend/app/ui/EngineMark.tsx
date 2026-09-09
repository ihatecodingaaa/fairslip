"use client";

/**
 * The engine, drawn the same way wherever it appears.
 *
 * FairSlip is one verification engine used at two points in the money's life -
 * after payday by the worker, before payday by the employer - and that is the
 * whole business argument. Two surfaces that looked like unrelated microsites
 * made the claim in prose and unmade it visually.
 *
 * So the engine has ONE representation, and it is this component. It sits in the
 * middle of the landing page's two-sided diagram, it is the rules layer of the
 * worker's own money trail, and it is the mark in the employer page's header.
 * A reader who has seen it once recognises it in the other place, which is the
 * only way a shared engine can be shown rather than asserted.
 *
 * It names the two rule packs and nothing else. No version, no "powered by", no
 * badge: the packs are what the engine is, and /scale is where what they cover
 * is stated as rules.
 */

import { T } from "./Prefs";

/** The boxed form, for a diagram. Double-ruled, which nothing else on any
 * screen is - the engine is the one thing that appears on both sides. */
export function EngineBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-sm border-2 border-ink bg-surface px-5 py-4 text-center ${className}`}
    >
      <p className="text-lead font-semibold text-ink">
        <T k="home.engine" />
      </p>
      <p className="mt-1 text-meta text-ink-2">
        <T k="home.engineWhat" />
      </p>
      <p className="mt-2 font-mono text-meta text-ink-3">rules.py · cpf.py</p>
    </div>
  );
}

/** The inline form, for a page header: one line, no box. */
export function EngineMark({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${className}`}>
      <span className="inline-flex items-center gap-2 text-meta font-semibold text-ink">
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          {/* Two stacked rules converging on one output. The same silhouette in
              both places, so it is recognised rather than read. */}
          <path d="M2 4h6M2 8h6M2 12h6" />
          <path d="M8 4h2.5a2 2 0 012 2v0a2 2 0 002 2h-2" />
          <path d="M8 12h2.5a2 2 0 002-2" />
        </svg>
        <T k="home.engine" />
      </span>
      <span className="text-meta text-ink-2">
        <T k="home.engineWhat" />
      </span>
    </p>
  );
}
