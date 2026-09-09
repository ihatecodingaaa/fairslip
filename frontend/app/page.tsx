"use client";

/**
 * The landing page: what FairSlip is, in the time it takes to read one line.
 *
 * IT WAS A FIXTURE DASHBOARD. Three invented workers, each with a difference, a
 * CPF table, a component list and a fact list, stacked - about 1,200px of
 * someone else's payslip before any sentence said what the product does. Every
 * one of those figures is real and worth showing; none of them is what a reader
 * needs first.
 *
 * SO THE PAGE MAKES THREE CLAIMS, IN THIS ORDER, AND EACH ONE IS DRAWN RATHER
 * THAN ASSERTED.
 *
 *   1. FairSlip is TWO SURFACES SHARING ONE ENGINE. Drawn as two boxes
 *      converging on <EngineBlock />, which is the same block the worker's own
 *      money trail uses for its rules layer. The convergence is the claim.
 *   2. A FIGURE ARRIVES BY A KNOWN PATH. The six layers are the six layers of
 *      the trail on /check, under the same six names from the same dictionary
 *      keys - so a reader meets the vocabulary here and recognises their own
 *      screen later. Two names for one thing would be two things.
 *   3. THE ENGINES RUN. The worked examples are below, and they are computed on
 *      load by the real endpoints - including one that is REFUSED, which is the
 *      only claim on this page that cannot be faked by writing copy.
 *
 * NO STATISTIC APPEARS ANYWHERE ON IT. Not a recovery figure, not a percentage
 * of underpaid workers, not a market size. FairSlip knows none of those, and
 * /scale answers "who is this for" in rules, which is both the honest answer and
 * the stronger one.
 *
 * This file computes nothing. Every dollar rendered is a Money the API sent,
 * already rounded to cents by the backend, and every label on the CPF split
 * arrives with its number so the screen cannot relabel it.
 */

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  API_BASE,
  getFixtures,
  money,
  postCompute,
  postCpf,
  type Component,
  type CpfOut,
  type Fact,
  type Fixtures,
  type Outcome,
  type PayBreakdown,
  type Persona,
  type Refusal,
} from "@/lib/api";
import { AppShell } from "./ui/AppShell";
import { EngineBlock } from "./ui/EngineMark";
import { Footer } from "./ui/Footer";
import { T, useT } from "./ui/Prefs";
import { StatusChip } from "./ui/StatusChip";
import type { Key } from "@/lib/i18n";

type PersonaResult = {
  breakdown: Outcome<PayBreakdown>;
  cpf: Outcome<CpfOut> | null;
};

/** The six layers, in the order a figure passes through them. Label and blurb
 * are dictionary keys shared with the worker's trail; nothing here is a fact
 * about anyone's month. */
const PIPELINE: { label: Key; what: Key }[] = [
  { label: "trail.layer.documents", what: "home.step.documents" },
  { label: "trail.layer.readers", what: "home.step.readers" },
  { label: "trail.layer.facts", what: "home.step.facts" },
  { label: "trail.layer.rules", what: "home.step.rules" },
  { label: "trail.layer.money", what: "home.step.money" },
  { label: "trail.layer.difference", what: "home.step.difference" },
];

export default function Home() {
  const t = useT();
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [results, setResults] = useState<Record<string, PersonaResult>>({});
  const [transportError, setTransportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const f = await getFixtures();
        if (!f.ok) {
          setTransportError(f.refusal.detail);
          return;
        }
        if (cancelled) return;
        setFixtures(f.value);

        const out: Record<string, PersonaResult> = {};
        for (const p of f.value.personas) {
          const breakdown = await postCompute(p.pay_inputs);
          let cpf: Outcome<CpfOut> | null = null;
          if (breakdown.ok) {
            cpf = await postCpf({
              declared_ow: p.cpf.declared_ow,
              expected_ow: breakdown.value.cpf_ordinary_wage.exact,
              band: p.cpf.band,
              residency: p.cpf.residency,
            });
          }
          out[p.key] = { breakdown, cpf };
        }
        if (!cancelled) setResults(out);
      } catch (e) {
        if (!cancelled) setTransportError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      {/* ---------------------------------------------------------- the claim */}
      <section className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div>
          <h1 className="text-hero font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-display">
            <T k="home.promise" />
          </h1>
          <p className="max-w-measure mt-6 text-lead text-ink-2 [overflow-wrap:anywhere]">
            <T k="home.lede" />
          </p>
          {/* The secondary line, at reading size. It was a 14px uppercase
              micro-label under the buttons, which is the typography of a legal
              footnote - and this is the sentence that says what the architecture
              is. */}
          <p className="mt-4 text-lead font-medium text-ink [overflow-wrap:anywhere]">
            <T k="home.secondary" />
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/check"
              className="tap inline-flex items-center rounded-sm bg-brand px-5 py-3 text-lead font-semibold text-on-solid [overflow-wrap:anywhere]"
            >
              <T k="home.ctaWorker" />
            </Link>
            <Link
              href="/employer"
              className="tap inline-flex items-center rounded-sm border border-control bg-surface px-5 py-3 text-body font-semibold text-ink hover:border-ink [overflow-wrap:anywhere]"
            >
              <T k="home.ctaEmployer" />
            </Link>
          </div>
        </div>

        <TwoSides />
      </section>

      {/* ------------------------------------------------------- the pipeline */}
      <section aria-labelledby="pipeline-heading" className="mt-16">
        <h2 id="pipeline-heading" className="text-title font-semibold">
          <T k="home.pipeline" />
        </h2>
        {/* A PATH, NOT SIX CARDS.
            Six columns, each with its own rule, its own number and its own
            paragraph, is a feature grid - and a feature grid was the one thing
            this section could not afford to be, because what it is describing is
            a SEQUENCE. Dropping the horizontal gap joins the six rules into one
            continuous rail; a dot marks each stop on it; the last dot is filled
            dark, because the difference is where the path ends. Same six names,
            same six sentences, read as a line. */}
        <ol className="mt-8 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
          {PIPELINE.map((step, i) => {
            const last = i === PIPELINE.length - 1;
            return (
              <li key={step.label} className="relative border-t border-line-strong pr-6 pt-5">
                <span
                  aria-hidden
                  className={`absolute left-0 top-0 block h-2 w-2 -translate-y-1/2 rounded-full ${
                    last ? "bg-ink" : "bg-ink-3"
                  }`}
                />
                <p className="text-body font-semibold text-ink">
                  <T k={step.label} />
                </p>
                <p className="mt-1 text-meta text-ink-2">
                  <T k={step.what} />
                </p>
              </li>
            );
          })}
        </ol>
        <p className="max-w-measure mt-8 text-meta text-ink-3">
          <T k="home.pipelineNote" />
        </p>
      </section>

      {/* ------------------------------------------------- the engines running */}
      <section aria-labelledby="examples-heading" className="mt-16">
        <h2 id="examples-heading" className="text-title font-semibold">
          <T k="home.examples" />
        </h2>
        <p className="max-w-measure mt-2 text-body text-ink-2">
          <T k="home.examplesWhy" />
        </p>
        <p className="mt-3 inline-block rounded-sm border border-attention-line bg-attention-bg px-3 py-2 text-meta font-semibold text-attention-fg">
          {fixtures?.notice ??
            "Fictional data. No real worker's document or information appears in FairSlip."}
        </p>

        {transportError && (
          <div className="mt-4 rounded-sm border border-danger-line bg-danger-bg p-4 text-body text-danger-fg">
            <p className="font-semibold">
              <T k="home.unreachable" />
            </p>
            <p className="mt-1 font-mono text-meta">{transportError}</p>
            <p className="max-w-measure mt-2">
              <T k="home.nothingShown" /> <code className="font-mono">{API_BASE}</code>.
            </p>
          </div>
        )}

        {!fixtures && !transportError && (
          <p className="mt-4 text-body text-ink-3">{t("home.loading")}</p>
        )}

        <div className="mt-4 divide-y divide-line rounded-lg border border-line-strong bg-surface">
          {fixtures?.personas.map((p) => (
            <PersonaRow key={p.key} persona={p} result={results[p.key]} />
          ))}
        </div>
      </section>

      <Footer />
    </AppShell>
  );
}

/**
 * Two surfaces, one engine.
 *
 * Drawn with BORDERS rather than an SVG path, for the reason recorded in
 * check/ReaderComparison.tsx: the labels are HTML, so they scale with the
 * text-size control and translate with everything else, and text baked into a
 * viewBox does neither. A border is also not a background, so it survives the
 * print sheet.
 *
 * The convergence is the whole diagram. The two boxes never touch each other;
 * both touch the engine.
 */
function TwoSides() {
  return (
    // NO CARD AROUND IT. The diagram was a bordered, shadowed panel containing
    // two bordered boxes containing a double-bordered block: three nested
    // surfaces, and the outermost one carried no meaning at all. A diagram is an
    // object on the page, not a widget in a frame.
    <figure>
      <div className="grid grid-cols-2 gap-x-4">
        <Side href="/check" label="nav.worker" when="nav.workerHint" what="home.sideWorkerWhat" />
        <Side
          href="/employer"
          label="nav.employer"
          when="nav.employerHint"
          what="home.sideEmployerWhat"
        />
      </div>

      {/* Two lines down, joined, then one line into the engine. The bracket is
          the same border-x/border-b span the reader-independence diagram uses -
          one idiom for "these converge", so a reader who has met it once reads
          it the second time without being told. */}
      <div className="flex justify-center" aria-hidden>
        <span className="block h-5 w-1/2 border-x-2 border-b-2 border-ink-2" />
      </div>
      <span aria-hidden className="mx-auto block h-4 w-0 border-l-2 border-ink-2" />

      <EngineBlock />
    </figure>
  );
}

function Side({
  href,
  label,
  when,
  what,
}: {
  href: string;
  label: Key;
  when: Key;
  what: Key;
}) {
  return (
    <Link
      href={href}
      className="block rounded-sm border border-line-strong bg-muted px-4 py-3 [overflow-wrap:anywhere] hover:border-ink"
    >
      <p className="text-body font-semibold text-ink">
        <T k={label} />
      </p>
      <p className="text-meta font-semibold text-ink-3">
        <T k={when} />
      </p>
      <p className="mt-2 text-meta text-ink-2">
        <T k={what} />
      </p>
    </Link>
  );
}

/* ----------------------------------------------------------- worked examples */

/**
 * One invented month, folded away.
 *
 * The summary carries the persona and the headline outcome; the figures are
 * behind a disclosure. Nothing was dropped in the fold - the components, their
 * formulas, the CPF split, the flags and the fact list are all still here, and
 * the refused persona still refuses with the engine's own message.
 */
function PersonaRow({ persona, result }: { persona: Persona; result?: PersonaResult }) {
  const t = useT();
  const cpfApplies = persona.cpf_applies;
  const headline = !result ? null : result.breakdown.ok ? result.breakdown.value : null;

  return (
    // The native marker is hidden: it rendered as a bare black triangle above
    // the name, disconnected from everything, while the "Show the figures" line
    // below already said what it did. Two affordances for one action, and the
    // one the browser drew was the one nobody could read.
    <details className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none">
        <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span>
            <span className="block text-lead font-semibold text-ink">{persona.name}</span>
            <span className="block max-w-measure text-meta text-ink-2">{persona.summary}</span>
          </span>
          <span className="text-right">
            {headline ? (
              <>
                <span className="block text-title font-semibold tabular-nums text-ink">
                  {money(headline.difference)}
                </span>
                <span className="block text-meta text-ink-3">
                  <T k="result.difference" />
                </span>
              </>
            ) : result && !result.breakdown.ok ? (
              <span className="block text-body font-semibold text-attention-fg">
                <T k="home.nothingCalculated" />
              </span>
            ) : (
              <span className="block text-meta text-ink-3">{t("home.running")}</span>
            )}
          </span>
        </span>
        <span className="mt-2 block text-meta font-semibold text-brand-fg underline underline-offset-4">
          <span className="group-open:hidden">
            <T k="home.exampleShow" />
          </span>
          <span className="hidden group-open:inline">
            <T k="home.exampleHide" />
          </span>
        </span>
      </summary>

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex flex-wrap gap-2 text-meta">
          <Chip>{persona.cpf.residency.replace(/_/g, " ").toLowerCase()}</Chip>
          {/* The age band selects a row in the CPF rate table. For a worker who
              is not a CPF member it is supplied but never used, and showing it
              above a panel that says they are not a CPF member reads as a
              contribution rate that applies to them. */}
          {cpfApplies && (
            <Chip>
              <T k="home.cpf.ageBand" /> {persona.cpf.band}
            </Chip>
          )}
          <Chip>
            <T k="home.cpf.salaryPeriod" /> {persona.cpf.contribution_month}
          </Chip>
        </div>
        {cpfApplies && (
          <p className="mt-2 font-mono text-meta text-ink-3">
            <T k="home.cpf.ageBandFrom" /> {persona.cpf.band_source}
          </p>
        )}

        {!result && <p className="mt-3 text-body text-ink-3">{t("home.running")}</p>}
        {result && !result.breakdown.ok && (
          <Refused refusal={result.breakdown.refusal} persona={persona} />
        )}
        {result?.breakdown.ok && (
          <>
            <Difference breakdown={result.breakdown.value} />
            {result.cpf && <CpfPanel outcome={result.cpf} persona={persona} />}
            <Components components={result.breakdown.value.components} />
            <Flags flags={result.breakdown.value.flags} />
            <FactList persona={persona} />
          </>
        )}
      </div>
    </details>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-sunken px-3 py-1 font-medium text-ink-2">{children}</span>
  );
}

/**
 * Branch on the discriminant the response actually carried. One hardcoded cause
 * for every refusal is how a screen ends up telling a worker the readers
 * disagreed when in fact the input was out of scope.
 * See docs/debt.md, ui-invents-a-cause.
 */
function Refused({ refusal, persona }: { refusal: Refusal; persona: Persona }) {
  const unsettled = Object.entries(persona.pay_inputs).filter(
    ([, f]) => f && f.status !== "AGREED" && f.status !== "HUMAN_CONFIRMED",
  );
  const because =
    refusal.error === "UNESTABLISHED_INPUT"
      ? "A field this month depends on was not agreed by both readers and has not been confirmed by the worker. FairSlip does not guess such a value, so no figure is shown."
      : refusal.error === "OUT_OF_SCOPE"
        ? "This month falls outside the rules FairSlip encodes, so the engine refused rather than approximate."
        : "A value could not be read as the type its field requires, so the engine was not run.";
  return (
    <div className="mt-3">
      <p className="text-lead font-semibold text-attention-fg">
        <T k="home.nothingCalculated" />
      </p>
      <p className="max-w-measure mt-1 text-body text-ink-2">{because}</p>
      <p className="mt-3 rounded-sm bg-muted px-3 py-2 font-mono text-meta text-ink-2">
        {refusal.detail}
      </p>
      <ul className="mt-3 space-y-2 text-body">
        {(refusal.error === "UNESTABLISHED_INPUT" ? unsettled : []).map(([name, f]) => (
          <li
            key={name}
            className="rounded-sm border border-attention-line bg-attention-bg px-3 py-2"
          >
            <span className="font-medium">{name}</span>{" "}
            <span className="rounded-sm border border-attention-line bg-surface px-2 py-1 text-meta font-semibold text-attention-fg">
              {f!.status}
            </span>
            <div className="mt-1 font-mono text-meta text-ink-2">{factValue(f!)}</div>
            <div className="text-meta text-ink-3">{f!.source}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Difference({ breakdown }: { breakdown: PayBreakdown }) {
  const t = useT();
  return (
    <div className="mt-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Stat label={t("result.expectedGross")} value={money(breakdown.expected_gross)} />
        <Stat label={t("result.deductions")} value={money(breakdown.deductions_total)} />
        <Stat label={t("result.expectedNet")} value={money(breakdown.expected_net)} />
        <Stat label={t("result.reachedBank")} value={money(breakdown.net_paid)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  // The figure sits above its label, via `order` rather than DOM order so the
  // <dt>-before-<dd> a definition list requires is preserved. Four labels of
  // different lengths wrap to different heights; with the label on top, one
  // figure drops a line below the other three and the row stops reading as a row.
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
      <dd className="order-1 text-lead font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function CpfPanel({ outcome, persona }: { outcome: Outcome<CpfOut>; persona: Persona }) {
  const t = useT();
  if (!outcome.ok) {
    const heading =
      outcome.refusal.error === "OUT_OF_SCOPE"
        ? "Outside what FairSlip checks: no CPF figure is shown."
        : outcome.refusal.error === "UNESTABLISHED_INPUT"
          ? "No CPF figure is shown: an input it needs is not established."
          : "No CPF figure is shown: an input could not be read as its field requires.";
    return (
      <div className="mt-4 border-t border-line pt-4">
        <p className="text-body font-semibold text-ink">{heading}</p>
        <p className="mt-1 text-body text-ink-2">{outcome.refusal.detail}</p>
      </div>
    );
  }
  const cpf = outcome.value;
  const noCpf = cpf.expected.flags.some((f) => f.startsWith("NO_CPF"));

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="home.cpf.heading" />
      </h3>

      {noCpf ? (
        <p className="mt-2 rounded-sm border border-brand-line bg-brand-bg px-3 py-2 text-body text-brand-fg">
          No CPF: {persona.cpf.residency.replace(/_/g, " ").toLowerCase()} holders are not CPF
          members. The CPF pack returns zero here rather than an error.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto" tabIndex={0} role="group" aria-label={t("home.cpf.heading")}>
          <table className="w-full text-body">
            <thead>
              <tr className="text-left text-meta text-ink-3">
                <th className="py-1 font-medium">{t("home.cpf.owUsed")}</th>
                <th className="py-1 text-right font-medium">{t("home.cpf.total")}</th>
                <th className="py-1 text-right font-medium">{t("home.cpf.employee")}</th>
                <th className="py-1 text-right font-medium">{t("home.cpf.employer")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-t border-line">
                <td className="py-1">
                  <T k="home.cpf.employerComputed" /> {money(cpf.declared.ow_used)}
                </td>
                <td className="py-1 text-right">{money(cpf.declared.total)}</td>
                <td className="py-1 text-right">{money(cpf.declared.employee)}</td>
                <td className="py-1 text-right">{money(cpf.declared.employer)}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-1">
                  <T k="home.cpf.rulesGive" /> {money(cpf.expected.ow_used)}
                </td>
                <td className="py-1 text-right">{money(cpf.expected.total)}</td>
                <td className="py-1 text-right">{money(cpf.expected.employee)}</td>
                <td className="py-1 text-right">{money(cpf.expected.employer)}</td>
              </tr>
              <tr className="border-t border-line-strong font-semibold">
                <td className="py-1">{t("home.cpf.difference")}</td>
                <td className="py-1 text-right">{money(cpf.delta.total)}</td>
                <td className="py-1 text-right">{money(cpf.delta.employee)}</td>
                <td className="py-1 text-right">{money(cpf.delta.employer)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Both the rate formula and the shortfall split belong to a CPF member.
          They sat outside this branch, so a Work Permit holder's card rendered
          "No CPF: work permit holders are not CPF members" and then, below it,
          a split of zeros ending in "Total withheld - cash plus CPF $62.24",
          under a note explaining an overlap that is $0 for them. A card
          contradicting itself. */}
      {!noCpf && (
        <>
          <p className="mt-3 font-mono text-meta text-ink-3">{cpf.expected.formula}</p>
          <div className="mt-4 rounded-sm border border-line bg-muted p-3">
            <p className="text-meta text-ink-2">{cpf.split_note}</p>
            <ul className="mt-2 space-y-1 text-body">
              {cpf.split.map((line) => (
                <li
                  key={line.key}
                  className={`flex items-baseline justify-between gap-4 ${
                    line.sub ? "pl-4 text-ink-3" : ""
                  } ${
                    line.key === "total_withheld"
                      ? "border-t border-line-strong pt-2 font-semibold"
                      : ""
                  }`}
                >
                  <span>{line.label}</span>
                  <span className="tabular-nums">{money(line.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Flags stay outside: for a Work Permit holder the NO_CPF flag is the
          engine's own statement about them, and it belongs on their card. */}
      {cpf.expected.flags.length > 0 && (
        <ul className="mt-3 space-y-1 text-meta text-ink-2">
          {cpf.expected.flags.map((f) => (
            <li key={f} className="font-mono">
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Components({ components }: { components: Component[] }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="result.whereFrom" />
      </h3>
      <ul className="mt-2 divide-y divide-line">
        {components.map((c) => (
          <li key={c.label} className="py-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{c.label.replace(/_/g, " ")}</span>
              <span className="font-medium tabular-nums">{money(c.amount)}</span>
            </div>
            <p className="mt-1 font-mono text-meta text-ink-2">{c.formula}</p>
            <ul className="mt-1 space-y-1 text-meta text-ink-3">
              {c.inputs.map((src) => (
                <li key={src}>&larr; {src}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Flags({ flags }: { flags: string[] }) {
  const t = useT();
  if (flags.length === 0) return null;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        {t("result.flags")}
      </h3>
      <ul className="mt-2 space-y-1 text-body text-attention-fg">
        {flags.map((f) => (
          <li
            key={f}
            className="rounded-sm border border-attention-line bg-attention-bg px-3 py-1 font-mono text-meta"
          >
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FactList({ persona }: { persona: Persona }) {
  const entries = Object.entries(persona.pay_inputs).filter(([, f]) => f !== null);
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="home.factsSummary" />
      </h3>
      <ul className="mt-3 space-y-1 text-meta">
        {entries.map(([name, f]) => (
          <li key={name} className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-ink">{name}</span>
            <span className="font-mono text-ink-2">{factValue(f!)}</span>
            <StatusChip status={f!.status} />
            <span className="text-ink-3">{f!.source}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function factValue(f: Fact): string {
  const v = f.value;
  if (v === null) return "not read";
  if (typeof v === "object") {
    return Object.entries(v)
      .map(([reader, value]) => `${reader}: ${value}`)
      .join("  |  ");
  }
  return String(v);
}
