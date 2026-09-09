"use client";

/**
 * Stage 1 screen: load the fictional fixtures from the backend, run both rule packs,
 * and show what they returned.
 *
 * This file computes nothing. Every dollar rendered is a Money the API sent, already
 * rounded to cents by the backend, and every label on the CPF split arrives with its
 * number so the screen cannot relabel it.
 */

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
import { Controls } from "./ui/Controls";
import { T, useT } from "./ui/Prefs";
import { StatusChip } from "./ui/StatusChip";

type PersonaResult = {
  breakdown: Outcome<PayBreakdown>;
  cpf: Outcome<CpfOut> | null;
};

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
    <div className="flex-1 bg-canvas text-ink">
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Controls />
        <header className="mb-8">
          <h1 className="text-page font-semibold tracking-tight">FairSlip</h1>
          <p className="mt-2 text-ink-2">
            <T k="home.tagline" />
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/check"
              className="tap inline-flex items-center rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid"
            >
              <T k="home.cta" />
            </a>
            {/* Secondary by weight, deliberately: the worker's route is the
                first button, and this one answers a judge's question - who else
                is this for - without competing with it. */}
            <a
              href="/scale"
              className="tap inline-flex items-center rounded-sm border border-control bg-surface px-5 py-3 text-body font-semibold text-ink"
            >
              <T k="home.scaleLink" />
            </a>
            {/* The employer side. Third by weight: the worker's route is the
                product, and this is the answer to who pays for it. */}
            <a
              href="/employer"
              className="tap inline-flex items-center rounded-sm border border-control bg-surface px-5 py-3 text-body font-semibold text-ink"
            >
              <T k="home.employerLink" />
            </a>
          </div>
          <p className="mt-4 rounded-sm border border-attention-line bg-attention-bg px-3 py-2 text-body text-attention-fg">
            {fixtures?.notice ??
              "Fictional data. No real worker's document or information appears in FairSlip."}
          </p>
        </header>

        {transportError && (
          <section className="mb-8 rounded-sm border border-danger-line bg-danger-bg p-4 text-body text-danger-fg">
            <p className="font-semibold">
              <T k="home.unreachable" />
            </p>
            <p className="mt-1">{transportError}</p>
            <p className="max-w-measure mt-2 text-danger-fg">
              <T k="home.nothingShown" />{" "}
              <code className="font-mono">{API_BASE}</code>.
            </p>
          </section>
        )}

        {!fixtures && !transportError && <p className="text-ink-3">{t("home.loading")}</p>}

        {fixtures?.personas.map((p) => (
          <PersonaCard key={p.key} persona={p} result={results[p.key]} />
        ))}

        <Footer />
      </main>
    </div>
  );
}

function PersonaCard({ persona, result }: { persona: Persona; result?: PersonaResult }) {
  const t = useT();
  const cpfApplies = persona.cpf_applies;
  return (
    <section className="mb-8 rounded-lg border border-line-strong bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title font-semibold">{persona.name}</h2>
        <p className="mt-1 text-body text-ink-2">{persona.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-meta">
          <Chip>{persona.cpf.residency}</Chip>
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
      </div>

      {!result && <p className="px-5 py-4 text-body text-ink-3">{t("home.running")}</p>}

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
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-sunken px-3 py-1 font-medium text-ink-2">
      {children}
    </span>
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
    <div className="px-5 py-4">
      <p className="text-lead font-semibold text-attention-fg">
        <T k="home.nothingCalculated" />
      </p>
      <p className="mt-1 text-body text-ink-2">{because}</p>
      <p className="mt-3 rounded-sm bg-muted px-3 py-2 font-mono text-meta text-ink-2">
        {refusal.detail}
      </p>
      <ul className="mt-3 space-y-2 text-body">
        {(refusal.error === "UNESTABLISHED_INPUT" ? unsettled : []).map(([name, f]) => (
          <li key={name} className="rounded-sm border border-attention-line bg-attention-bg px-3 py-2">
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
    <div className="border-b border-line px-5 py-4">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
        <T k="result.difference" />
      </p>
      <p className="mt-1 text-hero font-semibold tabular-nums">
        {money(breakdown.difference)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-body sm:grid-cols-4">
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
  // <dt>-before-<dd> a definition list requires is preserved.
  //
  // Four labels of different lengths wrap to different heights. With the label
  // on top, "Deductions on the payslip" taking two lines pushed its figure a
  // line below the other three - four amounts that no longer read as one row.
  // Anchoring the figures to the top of each cell makes the row hold at any
  // width, and puts the number where a room five metres away looks first.
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-meta text-ink-3">{label}</dt>
      <dd className="order-1 font-medium tabular-nums">{value}</dd>
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
      <div className="border-b border-line px-5 py-4">
        <p className="text-body font-semibold text-ink">{heading}</p>
        <p className="mt-1 text-body text-ink-2">{outcome.refusal.detail}</p>
      </div>
    );
  }
  const cpf = outcome.value;
  const noCpf = cpf.expected.flags.some((f) => f.startsWith("NO_CPF"));

  return (
    <div className="border-b border-line px-5 py-4">
      <h3 className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="home.cpf.heading" />
      </h3>

      {noCpf ? (
        <p className="mt-2 rounded-sm border border-brand-line bg-brand-bg px-3 py-2 text-body text-brand-fg">
          No CPF: {persona.cpf.residency.replace(/_/g, " ").toLowerCase()} holders are not CPF
          members. The CPF pack returns zero here rather than an error.
        </p>
      ) : (
        <table className="mt-2 w-full text-body">
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
              } ${line.key === "total_withheld" ? "border-t border-line-strong pt-2 font-semibold" : ""}`}
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
    <div className="border-b border-line px-5 py-4">
      <h3 className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="result.whereFrom" />
      </h3>
      <ul className="mt-2 divide-y divide-line">
        {components.map((c) => (
          <li key={c.label} className="py-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{c.label.replace(/_/g, " ")}</span>
              <span className="tabular-nums font-medium">{money(c.amount)}</span>
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
    <div className="border-b border-line px-5 py-4">
      <h3 className="text-body font-semibold uppercase tracking-wide text-ink-3">{t("result.flags")}</h3>
      <ul className="mt-2 space-y-1 text-body text-attention-fg">
        {flags.map((f) => (
          <li key={f} className="rounded-sm border border-attention-line bg-attention-bg px-3 py-1 font-mono text-meta">
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
    <details className="px-5 py-4">
      <summary className="cursor-pointer text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="home.factsSummary" />
      </summary>
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
    </details>
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

function Footer() {
  return (
    <footer className="mt-10 border-t border-line-strong pt-6 text-meta text-ink-2">
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
