"use client";

/**
 * Who FairSlip is for - stated as rules, because rules are what it encodes.
 *
 * THIS PAGE COMPUTES NOTHING AND ASSERTS NOTHING OF ITS OWN. Every claim it
 * renders arrives from GET /coverage, where it was written from a quote, an
 * engine constant, or the result of running an engine - see
 * backend/fairslip/coverage.py. There is no population figure anywhere on it,
 * because FairSlip does not know one, and describing reach in RULES is both the
 * honest answer and the stronger one.
 *
 * The one thing counted in the browser is the interface's own translation
 * coverage, and it is counted HERE because the strings are here: coverage() in
 * lib/i18n.ts reads the dictionary that the page you are looking at is rendered
 * from. A count taken anywhere else would be a claim about this file made
 * somewhere that cannot see it.
 *
 * Quotations stay in English in every language, with the reason shown in the
 * reader's own language - the same boundary the escalation pack draws, for the
 * same reason.
 */

import { useEffect, useState } from "react";
import {
  API_BASE,
  getCoverage,
  type CoverageOut,
  type EncodedRule,
  type EngineValue,
  type NotEncoded,
  type Quote,
  type Refusal,
  type RulePack,
} from "@/lib/api";
import { LANGS, coverage as dictionaryCoverage } from "@/lib/i18n";
import { AppShell } from "../ui/AppShell";
import { EngineMark } from "../ui/EngineMark";
import { KindChip, OutcomeChip } from "../ui/CoverageChip";
import { T, useT } from "../ui/Prefs";
import { QuotedInEnglish } from "../ui/QuotedInEnglish";

export default function Scale() {
  const t = useT();
  const [pack, setPack] = useState<CoverageOut | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const out = await getCoverage();
        if (cancelled) return;
        if (out.ok) setPack(out.value);
        else setRefusal(out.refusal);
      } catch (e) {
        if (!cancelled) setTransportError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell width="reading">
      <>
        <header className="mb-8">
          <h1 className="text-page font-semibold tracking-tight">
            <T k="scale.title" />
          </h1>
          {pack && <p className="max-w-measure mt-3 text-lead text-ink-2">{pack.note}</p>}
          <EngineMark className="mt-4" />
        </header>

        {transportError && (
          <section className="mb-8 rounded-lg border border-danger-line bg-danger-bg p-4 text-body text-danger-fg">
            <p className="font-semibold">
              <T k="scale.unreachable" />
            </p>
            <p className="mt-1 font-mono text-meta">{transportError}</p>
            <p className="mt-2 font-mono text-meta">{API_BASE || "same origin"}</p>
          </section>
        )}

        {/* A refusal is rendered as itself, with the code the engine sent. This
            page refuses WHOLE when one of its claims can no longer be
            established - a coverage screen missing one row is one a reader
            cannot tell from a complete one. */}
        {refusal && (
          <section className="mb-8 rounded-lg border border-attention-line bg-attention-bg p-4 text-body text-attention-fg">
            <p className="font-semibold">
              <T k="scale.unreachable" />
            </p>
            <p className="mt-2 rounded-sm bg-surface px-3 py-2 font-mono text-meta">
              {refusal.error}: {refusal.detail}
            </p>
          </section>
        )}

        {!pack && !refusal && !transportError && (
          <p className="text-body text-ink-3">{t("scale.loading")}</p>
        )}

        {pack && (
          <>
            <section className="mb-8" aria-labelledby="packs-heading">
              <h2 id="packs-heading" className="mb-4 text-title font-semibold">
                <T k="scale.packs" />
              </h2>
              {pack.packs.map((p) => (
                <PackCard key={p.key} pack={p} />
              ))}
            </section>

            <section className="mb-8" aria-labelledby="cpf-heading">
              <h2 id="cpf-heading" className="mb-4 text-title font-semibold">
                <T k="scale.cpf" />
              </h2>
              <div className="rounded-lg border border-line-strong bg-surface shadow-card">
                <ul className="divide-y divide-line">
                  {pack.residency.map((r) => (
                    <li key={r.residency} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="font-mono text-body font-medium">{r.residency}</span>
                        <OutcomeChip outcome={r.outcome} />
                      </div>
                      {/* Present only where the engine said something. A row
                          that merely computed has nothing of the engine's to
                          quote, and a sentence written to fill the space would
                          be ours wearing its column. */}
                      {r.engine_said && (
                        <p className="mt-2 rounded-sm bg-muted px-3 py-2 font-mono text-meta text-ink-2">
                          {r.engine_said}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line-strong px-5 py-4">
                  <p className="max-w-measure text-meta text-ink-2">{pack.residency_note}</p>
                </div>
              </div>
            </section>

            <section className="mb-8" aria-labelledby="not-encoded-heading">
              <h2 id="not-encoded-heading" className="mb-4 text-title font-semibold">
                <T k="scale.notEncoded" />
              </h2>
              <div className="rounded-lg border border-line-strong bg-surface shadow-card">
                <ul className="divide-y divide-line">
                  {pack.not_encoded.map((n) => (
                    <NotEncodedRow key={n.what} row={n} />
                  ))}
                </ul>
              </div>
            </section>

            <InterfaceSection pack={pack} />
          </>
        )}

        <footer className="mt-10 border-t border-line-strong pt-6 text-meta text-ink-2">
          <p className="max-w-measure">
            <T k="footer.notADetermination" />
          </p>
          <p className="mt-3 font-mono text-meta text-ink-3">
            <T k="footer.engines" /> {API_BASE || "same origin"}
          </p>
        </footer>
      </>
    </AppShell>
  );
}

function PackCard({ pack }: { pack: RulePack }) {
  return (
    <section className="mb-6 rounded-lg border border-line-strong bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-lead font-semibold">{pack.name}</h3>
        <p className="mt-1 font-mono text-meta text-ink-3">{pack.engine_module}</p>
      </div>

      <div className="border-b border-line px-5 py-4">
        <h4 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          <T k="scale.covers" />
        </h4>
        <p className="max-w-measure mt-2 text-body text-ink-2">{pack.covers}</p>
        {pack.coverage_quote && <Quoted quote={pack.coverage_quote} />}
      </div>

      {pack.thresholds.length > 0 && (
        <div className="border-b border-line px-5 py-4">
          <h4 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            <T k="scale.thresholds" />
          </h4>
          <ul className="mt-2 space-y-2">
            {pack.thresholds.map((v) => (
              <Value key={v.engine_symbol + v.label} value={v} />
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 py-4">
        <h4 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
          <T k="scale.encoded" />
        </h4>
        <ul className="mt-2 divide-y divide-line">
          {pack.encoded.map((rule) => (
            <Rule key={rule.what} rule={rule} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Rule({ rule }: { rule: EncodedRule }) {
  return (
    <li className="py-3">
      <p className="max-w-measure text-body font-medium">{rule.what}</p>
      <p className="mt-1 font-mono text-meta text-ink-3">{rule.engine_symbol}</p>
      {rule.quote ? (
        <Quoted quote={rule.quote} />
      ) : (
        <p className="mt-2 text-meta text-ink-3">
          <T k="scale.readFrom" />{" "}
          <a href={rule.source_url} className="underline" target="_blank" rel="noreferrer">
            {rule.source_label}
          </a>
        </p>
      )}
      {rule.values.length > 0 && (
        <ul className="mt-2 space-y-2">
          {rule.values.map((v) => (
            <Value key={v.engine_symbol + v.label} value={v} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * A number the engine holds, beside the symbol it was read from.
 *
 * `display` arrives formatted from the API - the same formatter every other
 * dollar in the product goes through - so this component does no arithmetic and
 * no rounding. The symbol is shown, not hidden: it is what a judge can check,
 * and it is what the test resolves.
 */
function Value({ value }: { value: EngineValue }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-body text-ink-2">{value.label}</span>
      {/* The engine symbol is one unbreakable token - `rules.NON_WORKMAN_BASIC_CAP`
          is 27 characters of monospace - and beside its amount in a non-wrapping
          row it pushed this page 65px wider than a 390px phone at 125% text.
          It wraps now, and the pair wraps as a pair. */}
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
        <span className="break-all font-mono text-meta text-ink-3">{value.engine_symbol}</span>
        <span className="text-body font-semibold tabular-nums">{value.display}</span>
      </span>
    </li>
  );
}

/**
 * An authority's sentence, with the page it was read from.
 *
 * It stays in English in every language, and the line beneath says so in the
 * reader's. Machine-translating a government's exact words onto a screen a
 * worker carries to a counter would be asserting a translation nobody verified.
 */
function Quoted({ quote }: { quote: Quote }) {
  return (
    <figure className="mt-3 border-l-4 border-brand-line bg-brand-bg px-4 py-3">
      <blockquote lang="en" className="max-w-measure text-body text-brand-fg">
        “{quote.quoted}”
      </blockquote>
      <figcaption className="mt-2 text-meta text-brand-fg">
        <a href={quote.source_url} className="underline" target="_blank" rel="noreferrer">
          {quote.source_label}
        </a>
      </figcaption>
      {/* Renders NOTHING in English. It used to render unconditionally, so an
          English coverage screen carried "FairSlip has not verified a
          translation of them" beside every quotation - a caveat about a
          boundary that does not exist when nothing has been translated. See
          ui/QuotedInEnglish.tsx. */}
      <QuotedInEnglish className="mt-2 text-ink-2" />
    </figure>
  );
}

function NotEncodedRow({ row }: { row: NotEncoded }) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="max-w-measure text-body font-medium">{row.what}</span>
        <KindChip kind={row.kind} />
      </div>
      <p className="max-w-measure mt-2 text-body text-ink-2">{row.why}</p>
      <p className="max-w-measure mt-1 text-meta text-ink-3">
        <T k="scale.howKnown" />: {row.established_by}
      </p>
    </li>
  );
}

/**
 * What FairSlip's own interface covers - counted twice, in the two places the
 * strings actually live.
 *
 * The six worker questions are counted on the SERVER, because they are
 * translated on the server, beside the English, in extract_schema.py. The rest
 * of the interface is counted HERE, from the dictionary this page is rendered
 * from. Neither number is written down anywhere; both are the length of
 * something.
 */
function InterfaceSection({ pack }: { pack: CoverageOut }) {
  const t = useT();
  const questions = new Map(pack.interface.questions_translated);
  return (
    <section className="mb-8" aria-labelledby="interface-heading">
      <h2 id="interface-heading" className="mb-4 text-title font-semibold">
        <T k="scale.interface" />
      </h2>
      <div className="rounded-lg border border-line-strong bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            <T k="scale.questions" />
          </h3>
          {/* The count wraps. "6 of 6 translated" is one long Tamil word next to
              two numerals, and at 125% text on a 390px phone it was 281px inside
              a 253px row - a flex item's default min-width is its longest token,
              so the row grew rather than the word breaking, and the page scrolled
              sideways. Both coverage lists carry the same pair. */}
          <ul className="mt-2 space-y-2">
            {LANGS.map((l) => (
              <li key={l.code} className="flex items-baseline justify-between gap-4">
                <span className="text-body" lang={l.code}>
                  {l.endonym}
                </span>
                <span className="min-w-0 text-right font-mono text-meta tabular-nums text-ink-2 [overflow-wrap:anywhere]">
                  {t("scale.translatedOf", {
                    done: l.code === "en" ? pack.interface.question_count : (questions.get(l.code) ?? 0),
                    total: pack.interface.question_count,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-b border-line px-5 py-4">
          <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            <T k="scale.uiStrings" />
          </h3>
          <ul className="mt-2 space-y-2">
            {LANGS.map((l) => {
              const c = dictionaryCoverage(l.code);
              return (
                <li key={l.code} className="flex items-baseline justify-between gap-4">
                  <span className="text-body" lang={l.code}>
                    {l.endonym}
                  </span>
                  <span className="min-w-0 text-right font-mono text-meta tabular-nums text-ink-2 [overflow-wrap:anywhere]">
                    {t("scale.translatedOf", { done: c.done, total: c.total })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* What the counts above do NOT cover, said next to them.
            The dictionary is one of three kinds of text on a FairSlip screen -
            see the header of lib/i18n.ts - and a reader looking at English
            paragraphs under "112 of 115 translated" is owed the scope of that
            figure rather than left to infer it. */}
        <div className="border-t border-line px-5 py-4">
          <p className="max-w-measure text-meta text-ink-2">
            <T k="scale.serverText" />
          </p>
        </div>

        {/* The rule spans the CARD; the prose inside it stops at the measure.
            One element cannot carry both, and a hairline that ends short of the
            edge it belongs to reads as a rendering fault. */}
        <div className="border-t border-line px-5 py-4">
          <p className="max-w-measure text-meta text-ink-2">{pack.interface.note}</p>
        </div>
        <div className="border-t border-line px-5 py-4">
          <p className="max-w-measure text-meta text-ink-2">{pack.interface.quotes_note}</p>
        </div>
      </div>
    </section>
  );
}
