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

type PersonaResult = {
  breakdown: Outcome<PayBreakdown>;
  cpf: Outcome<CpfOut> | null;
};

export default function Home() {
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
    <div className="flex-1 bg-zinc-100 text-zinc-900">
      <main className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">FairSlip</h1>
          <p className="mt-2 text-zinc-600">
            Does your pay add up &mdash; and if not, what happens next?
          </p>
          <a
            href="/check"
            className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Check a payslip of your own &rarr;
          </a>
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {fixtures?.notice ??
              "Fictional data. No real worker's document or information appears in FairSlip."}
          </p>
        </header>

        {transportError && (
          <section className="mb-8 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">The engines could not be reached.</p>
            <p className="mt-1">{transportError}</p>
            <p className="mt-2 text-red-800">
              Nothing is shown below, because nothing was calculated. Backend expected at{" "}
              <code className="font-mono">{API_BASE}</code>.
            </p>
          </section>
        )}

        {!fixtures && !transportError && <p className="text-zinc-500">Loading fixtures&hellip;</p>}

        {fixtures?.personas.map((p) => (
          <PersonaCard key={p.key} persona={p} result={results[p.key]} />
        ))}

        <Footer />
      </main>
    </div>
  );
}

function PersonaCard({ persona, result }: { persona: Persona; result?: PersonaResult }) {
  return (
    <section className="mb-8 rounded-lg border border-zinc-300 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-xl font-semibold">{persona.name}</h2>
        <p className="mt-1 text-sm text-zinc-600">{persona.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Chip>{persona.cpf.residency}</Chip>
          <Chip>CPF age band: {persona.cpf.band}</Chip>
          <Chip>Salary period {persona.cpf.contribution_month}</Chip>
        </div>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          age band from {persona.cpf.band_source}
        </p>
      </div>

      {!result && <p className="px-5 py-4 text-sm text-zinc-500">Running the engines&hellip;</p>}

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
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
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
      <p className="text-lg font-semibold text-amber-800">Nothing was calculated for this month.</p>
      <p className="mt-1 text-sm text-zinc-700">{because}</p>
      <p className="mt-3 rounded bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700">
        {refusal.detail}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {(refusal.error === "UNESTABLISHED_INPUT" ? unsettled : []).map(([name, f]) => (
          <li key={name} className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
            <span className="font-medium">{name}</span>{" "}
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
              {f!.status}
            </span>
            <div className="mt-1 font-mono text-xs text-zinc-700">{factValue(f!)}</div>
            <div className="text-xs text-zinc-500">{f!.source}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Difference({ breakdown }: { breakdown: PayBreakdown }) {
  return (
    <div className="border-b border-zinc-200 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Possible unreconciled difference
      </p>
      <p className="mt-1 text-4xl font-semibold tabular-nums">
        {money(breakdown.difference)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <Stat label="Expected gross" value={money(breakdown.expected_gross)} />
        <Stat label="Deductions on the payslip" value={money(breakdown.deductions_total)} />
        <Stat label="Expected net" value={money(breakdown.expected_net)} />
        <Stat label="Reached the bank" value={money(breakdown.net_paid)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}

function CpfPanel({ outcome, persona }: { outcome: Outcome<CpfOut>; persona: Persona }) {
  if (!outcome.ok) {
    const heading =
      outcome.refusal.error === "OUT_OF_SCOPE"
        ? "Outside what FairSlip checks: no CPF figure is shown."
        : outcome.refusal.error === "UNESTABLISHED_INPUT"
          ? "No CPF figure is shown: an input it needs is not established."
          : "No CPF figure is shown: an input could not be read as its field requires.";
    return (
      <div className="border-b border-zinc-200 px-5 py-4">
        <p className="text-sm font-semibold text-zinc-800">{heading}</p>
        <p className="mt-1 text-sm text-zinc-600">{outcome.refusal.detail}</p>
      </div>
    );
  }
  const cpf = outcome.value;
  const noCpf = cpf.expected.flags.some((f) => f.startsWith("NO_CPF"));

  return (
    <div className="border-b border-zinc-200 px-5 py-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        CPF, based on CPF Board&rsquo;s published rates
      </h3>

      {noCpf ? (
        <p className="mt-2 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          No CPF: {persona.cpf.residency.replace(/_/g, " ").toLowerCase()} holders are not CPF
          members. The CPF pack returns zero here rather than an error.
        </p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="py-1 font-medium">Ordinary Wage used</th>
              <th className="py-1 text-right font-medium">Total</th>
              <th className="py-1 text-right font-medium">Employee</th>
              <th className="py-1 text-right font-medium">Employer</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-t border-zinc-200">
              <td className="py-1">
                Employer computed on {money(cpf.declared.ow_used)}
              </td>
              <td className="py-1 text-right">{money(cpf.declared.total)}</td>
              <td className="py-1 text-right">{money(cpf.declared.employee)}</td>
              <td className="py-1 text-right">{money(cpf.declared.employer)}</td>
            </tr>
            <tr className="border-t border-zinc-200">
              <td className="py-1">
                Published rules give {money(cpf.expected.ow_used)}
              </td>
              <td className="py-1 text-right">{money(cpf.expected.total)}</td>
              <td className="py-1 text-right">{money(cpf.expected.employee)}</td>
              <td className="py-1 text-right">{money(cpf.expected.employer)}</td>
            </tr>
            <tr className="border-t border-zinc-300 font-semibold">
              <td className="py-1">Difference</td>
              <td className="py-1 text-right">{money(cpf.delta.total)}</td>
              <td className="py-1 text-right">{money(cpf.delta.employee)}</td>
              <td className="py-1 text-right">{money(cpf.delta.employer)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <p className="mt-3 font-mono text-[11px] text-zinc-500">{cpf.expected.formula}</p>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs text-zinc-600">{cpf.split_note}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {cpf.split.map((line) => (
            <li
              key={line.key}
              className={`flex items-baseline justify-between gap-4 ${
                line.sub ? "pl-4 text-zinc-500" : ""
              } ${line.key === "total_withheld" ? "border-t border-zinc-300 pt-2 font-semibold" : ""}`}
            >
              <span>{line.label}</span>
              <span className="tabular-nums">{money(line.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      {cpf.expected.flags.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-zinc-600">
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
    <div className="border-b border-zinc-200 px-5 py-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Where each dollar comes from
      </h3>
      <ul className="mt-2 divide-y divide-zinc-200">
        {components.map((c) => (
          <li key={c.label} className="py-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{c.label.replace(/_/g, " ")}</span>
              <span className="tabular-nums font-medium">{money(c.amount)}</span>
            </div>
            <p className="mt-0.5 font-mono text-xs text-zinc-600">{c.formula}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
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
  if (flags.length === 0) return null;
  return (
    <div className="border-b border-zinc-200 px-5 py-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Flags</h3>
      <ul className="mt-2 space-y-1 text-sm text-amber-900">
        {flags.map((f) => (
          <li key={f} className="rounded border border-amber-300 bg-amber-50 px-3 py-1 font-mono text-xs">
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
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-500">
        The facts this used, and where each came from
      </summary>
      <ul className="mt-3 space-y-1 text-xs">
        {entries.map(([name, f]) => (
          <li key={name} className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-zinc-800">{name}</span>
            <span className="font-mono text-zinc-700">{factValue(f!)}</span>
            <span
              className={`rounded px-1.5 py-0.5 font-semibold ${
                f!.status === "AGREED" || f!.status === "HUMAN_CONFIRMED"
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-200 text-amber-900"
              }`}
            >
              {f!.status}
            </span>
            <span className="text-zinc-500">{f!.source}</span>
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
    <footer className="mt-10 border-t border-zinc-300 pt-6 text-xs text-zinc-600">
      <p className="font-semibold text-zinc-700">Outside what FairSlip checks</p>
      <p className="mt-1">
        Daily and piece-rated workers; public-holiday pay; shift-work averaging; CPF on monthly
        wages of $750 or less; PR year 1 and 2 CPF rates; Additional Wages; platform workers;
        domestic workers; and any question of legal liability. Where an input falls outside these
        rules the engines refuse rather than approximate.
      </p>
      <p className="mt-3">
        Figures are reconstructed from MOM&rsquo;s and CPF Board&rsquo;s published rules and are
        not a determination of any kind. Check with MOM, TADM or CPF Board.
      </p>
      <p className="mt-3 font-mono text-[11px] text-zinc-400">Engines at {API_BASE}</p>
    </footer>
  );
}
