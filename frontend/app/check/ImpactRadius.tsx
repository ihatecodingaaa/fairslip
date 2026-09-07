"use client";

/**
 * Change any established fact and re-run. A Q&A affordance, not a scripted beat.
 *
 * The point of this view is the SECOND list. Anyone can show that a number
 * changed; the harder claim is that the others did not, and that it is known
 * rather than hoped. So:
 *
 *   - Both runs are the engine's. This file does no arithmetic: it posts the
 *     before and after facts and renders what came back. There is no subtraction
 *     here, not even for the delta.
 *   - Which lines are RELATED to the change is read off each component's own
 *     recorded inputs, in the backend. Nothing here knows that overtime depends
 *     on the overtime hours.
 *   - If the new value cannot be established, or falls outside what the engines
 *     cover, the engine refuses and that refusal is what shows. It does NOT fall
 *     back to the previous figure: a stale amount presented as a current one is
 *     the whole failure this product exists to avoid.
 */

import { useState } from "react";
import {
  isEstablished,
  money,
  postImpact,
  type Fact,
  type ImpactOut,
  type PayInputs,
  type Refusal,
} from "../../lib/api";

/** Only a fact the engine would accept can be varied. An unestablished one has
 * nothing to vary FROM, and the run it belongs to was refused anyway. */
function editableFields(inputs: PayInputs): { name: string; fact: Fact }[] {
  return Object.entries(inputs)
    .filter((e): e is [string, Fact] => e[1] !== null)
    .filter(([, f]) => isEstablished(f.status))
    .filter(([, f]) => f.value !== null && typeof f.value !== "object")
    .map(([name, fact]) => ({ name, fact }));
}

const STATUS_COPY: Record<ComponentStatus, { word: string; tone: string }> = {
  MOVED: { word: "moved", tone: "text-amber-900" },
  ADDED: { word: "appeared", tone: "text-amber-900" },
  REMOVED: { word: "gone", tone: "text-amber-900" },
  UNCHANGED: { word: "did not move", tone: "text-zinc-500" },
};

type ComponentStatus = ImpactOut["components"][number]["status"];

export function ImpactRadius({ inputs }: { inputs: PayInputs }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [result, setResult] = useState<ImpactOut | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fields = editableFields(inputs);
  const chosen = fields.find((f) => f.name === field);

  function pick(name: string) {
    setField(name);
    const f = fields.find((x) => x.name === name);
    setValue(f ? String(f.fact.value) : "");
    setResult(null);
    setRefusal(null);
    setError(null);
  }

  async function rerun() {
    if (!chosen) return;
    setBusy(true);
    setResult(null);
    setRefusal(null);
    setError(null);
    try {
      const after: PayInputs = {
        ...inputs,
        [chosen.name]: {
          value,
          status: "HUMAN_CONFIRMED",
          source: `you changed this on screen: ${chosen.name}`,
        },
      };
      const out = await postImpact(inputs, after);
      if (out.ok) setResult(out.value);
      else setRefusal(out.refusal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="border-t border-zinc-200 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-700"
        >
          Change one of these numbers and re-run
        </button>
        <p className="mt-1 text-xs text-zinc-500">
          Every figure above came from a fact. Change one and see which figures it reaches -
          and which it does not.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 bg-zinc-50/60 px-5 py-4">
      <h3 className="text-sm font-semibold text-zinc-900">Change one number and re-run</h3>
      <p className="mt-0.5 text-xs text-zinc-600">
        Both sets of figures are produced by the same engine, run twice on the facts you sent.
        Nothing on this screen is worked out here.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-zinc-700">
          Which fact
          <select
            value={field}
            onChange={(e) => pick(e.target.value)}
            className="mt-1 block rounded border border-zinc-400 bg-white px-2 py-1 text-sm text-zinc-900"
          >
            <option value="">&mdash; pick one &mdash;</option>
            {fields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name.replace(/_/g, " ")} ({String(f.fact.value)})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-zinc-700">
          New value
          <input
            type="text"
            value={value}
            disabled={!chosen}
            onChange={(e) => {
              setValue(e.target.value);
              // Clear the previous result: leaving it up while the box says
              // something else invites reading it as the answer to the new
              // number.
              setResult(null);
              setRefusal(null);
            }}
            className="mt-1 block w-40 rounded border border-zinc-400 bg-white px-2 py-1 font-mono text-sm text-zinc-900 disabled:bg-zinc-100"
          />
        </label>

        <button
          type="button"
          onClick={rerun}
          disabled={!chosen || busy}
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Re-running…" : "Re-run the engine"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          The re-run did not complete: {error}. No figure was produced for the change, and the
          figures above are the ones from before. FairSlip cannot tell from here whether the
          engine was reached.
        </p>
      )}

      {/* A refusal REPLACES the result. There is no path that leaves a previous
          impact on screen next to a refusal for the run that would have
          superseded it. */}
      {refusal && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2">
          {/* Two of the refusal paths never reach the engine: an unreadable
              value is caught converting the request, and "nothing changed" is
              not a refused value at all - and that one is the LIKELIEST first
              click, because the box is prefilled with the current value.
              docs/debt.md, ui-invents-a-cause. */}
          <p className="text-sm font-semibold text-amber-900">
            {refusal.detail.includes("nothing changed")
              ? "Nothing was changed, so there was nothing to re-run."
              : refusal.error === "INVALID_INPUT"
                ? "That value could not be read as the type its field needs, so nothing was recomputed."
                : "The engine refused that value, so nothing was recomputed."}
          </p>
          <p className="mt-1 font-mono text-xs text-amber-900">{refusal.detail}</p>
          <p className="mt-1 text-xs text-amber-900">
            No figure is shown for the change. FairSlip does not keep the previous number on
            screen as though it still answered the question you just asked.
          </p>
        </div>
      )}

      {result && <ImpactResult r={result} />}
    </div>
  );
}

function ImpactResult({ r }: { r: ImpactOut }) {
  const moved = r.components.filter((c) => c.status !== "UNCHANGED");
  const held = r.components.filter((c) => c.status === "UNCHANGED");

  return (
    <div className="mt-4">
      <p className="text-sm text-zinc-900">
        {r.changed_fields.map((f) => (
          <span key={f.name} className="mr-3">
            <span className="font-medium">{f.name.replace(/_/g, " ")}</span>{" "}
            <span className="font-mono">
              {f.before_value} &rarr; {f.after_value}
            </span>
          </span>
        ))}
      </p>

      {/* ABOVE the two lists. This is the claim they depend on: if a line moved
          without declaring what moved it, the "did not move" panel is exactly
          what is in doubt, and rendering the retraction last put the confident
          panel first. Empty on every correct run. */}
      {r.unexplained_moves.length > 0 && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
          These lines moved without listing the fact you changed among their inputs:{" "}
          {r.unexplained_moves.join(", ")}. That is a contradiction between what the engine
          computed and what it recorded, so treat the two lists below with suspicion - FairSlip
          is showing it rather than hiding it.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            {r.moved_count} {r.moved_count === 1 ? "line moved" : "lines moved"}
          </h4>
          <ul className="mt-1 space-y-1">
            {moved.map((c) => (
              <li key={c.label} className="text-sm text-amber-900">
                <span className="font-medium">{c.label.replace(/_/g, " ")}</span>{" "}
                <span className="font-mono text-xs">
                  {c.before ? money(c.before) : "—"} &rarr; {c.after ? money(c.after) : "—"}
                  {c.delta && ` (${money(c.delta)})`}
                </span>
                <span className="block text-[11px] opacity-80">
                  {STATUS_COPY[c.status].word} &middot; {c.formula}
                </span>
              </li>
            ))}
            {moved.length === 0 && (
              <li className="text-sm text-amber-900">
                {/* Branching on the engine's own figure. This used to assert the
                    change "reached the comparison" on runs where the difference
                    delta was $0.00, forty lines above a line saying so. */}
                {Number(r.difference_delta.exact) === 0
                  ? "No line moved, and the difference is the same figure. That fact produced no different number anywhere."
                  : "No line moved. The change reached the comparison, not the components."}
              </li>
            )}
          </ul>
        </section>

        {/* The claim this whole view exists for. Computed, never asserted. */}
        <section className="rounded border border-zinc-300 bg-white px-3 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {r.unchanged_count} did not move
          </h4>
          <ul className="mt-1 space-y-1">
            {held.map((c) => (
              <li key={c.label} className="text-sm text-zinc-600">
                <span className="font-medium">{c.label.replace(/_/g, " ")}</span>{" "}
                <span className="font-mono text-xs">{c.before ? money(c.before) : "—"}</span>
                <span className="block text-[11px] text-zinc-500">
                  {/* Read from what the backend computed, never asserted. A
                      line CAN list the changed fact and hold its value: the
                      rest-day table brackets on half the normal daily hours,
                      so 8 -> 9 crosses no bracket. This sentence used to say
                      "did not list the fact you changed" about every held
                      line, which the same response contradicted. */}
                  {c.depends_on_changed
                    ? "listed the fact you changed among its inputs, and still came out the same"
                    : "did not list the fact you changed among its inputs"}
                </span>
              </li>
            ))}
            {held.length === 0 && (
              <li className="text-sm text-zinc-600">
                {r.unexplained_moves.length === 0
                  ? "Every line moved. That fact reaches all of them."
                  : "Every line moved, but see the note below - not all of them declared a dependency on what you changed."}
              </li>
            )}
          </ul>
        </section>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 rounded border border-zinc-300 bg-white px-3 py-2 sm:grid-cols-2">
        <Row label="Expected net, before" value={money(r.before_expected_net)} />
        <Row label="Expected net, after" value={money(r.after_expected_net)} />
        <Row label="Difference, before" value={money(r.before_difference)} />
        <Row label="Difference, after" value={money(r.after_difference)} strong />
      </dl>
      <p className="mt-1 text-xs text-zinc-600">
        The difference moved by {money(r.difference_delta)}.
      </p>

      {/* Both sides. Rendering only the after-flags made a flag that the change
          CLEARED disappear without a word, and one that was already there look
          new. */}
      {(r.flags_before.length > 0 || r.flags_after.length > 0) && (
        <ul className="mt-2 space-y-1">
          {r.flags_before.map((f) => (
            <li key={`b-${f}`} className="font-mono text-[11px] text-zinc-600">
              before: {f}
              {!r.flags_after.includes(f) && " (cleared by your change)"}
            </li>
          ))}
          {r.flags_after
            .filter((f) => !r.flags_before.includes(f))
            .map((f) => (
              <li key={`a-${f}`} className="font-mono text-[11px] text-amber-900">
                after: {f} (raised by your change)
              </li>
            ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-zinc-500">{r.note}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <dt className="text-zinc-600">{label}</dt>
      <dd className={`font-mono ${strong ? "font-bold text-zinc-900" : "text-zinc-800"}`}>
        {value}
      </dd>
    </div>
  );
}
