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
  MOVED: { word: "moved", tone: "text-attention-fg" },
  ADDED: { word: "appeared", tone: "text-attention-fg" },
  REMOVED: { word: "gone", tone: "text-attention-fg" },
  UNCHANGED: { word: "did not move", tone: "text-ink-3" },
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
      <div className="border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-sm rounded-sm border border-control bg-surface px-4 py-3 text-body font-medium text-ink hover:border-ink"
        >
          Change one of these numbers and re-run
        </button>
        <p className="max-w-measure mt-1 text-meta text-ink-3">
          Every figure above came from a fact. Change one and see which figures it reaches -
          and which it does not.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-muted/60 px-5 py-4">
      <h3 className="text-body font-semibold text-ink">Change one number and re-run</h3>
      <p className="max-w-measure mt-1 text-meta text-ink-2">
        Both sets of figures are produced by the same engine, run twice on the facts you sent.
        Nothing on this screen is worked out here.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-meta font-medium text-ink-2">
          Which fact
          <select
            value={field}
            onChange={(e) => pick(e.target.value)}
            className="mt-1 block rounded-sm border border-control bg-surface px-2 py-1 text-body text-ink"
          >
            <option value="">&mdash; pick one &mdash;</option>
            {fields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name.replace(/_/g, " ")} ({String(f.fact.value)})
              </option>
            ))}
          </select>
        </label>

        <label className="text-meta font-medium text-ink-2">
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
            className="mt-1 block w-40 rounded-sm border border-control bg-surface px-2 py-1 font-mono text-body text-ink disabled:bg-muted"
          />
        </label>

        <button
          type="button"
          onClick={rerun}
          disabled={!chosen || busy}
          className="tap rounded-sm bg-brand px-5 py-3 text-body font-semibold text-on-solid disabled:opacity-50"
        >
          {busy ? "Re-running…" : "Re-run the engine"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-body text-danger-fg">
          The re-run did not complete: {error}. No figure was produced for the change, and the
          figures above are the ones from before. FairSlip cannot tell from here whether the
          engine was reached.
        </p>
      )}

      {/* A refusal REPLACES the result. There is no path that leaves a previous
          impact on screen next to a refusal for the run that would have
          superseded it. */}
      {refusal && (
        <div className="mt-3 rounded-sm border border-attention-line bg-attention-bg px-3 py-2">
          {/* Two of the refusal paths never reach the engine: an unreadable
              value is caught converting the request, and "nothing changed" is
              not a refused value at all - and that one is the LIKELIEST first
              click, because the box is prefilled with the current value.
              docs/debt.md, ui-invents-a-cause. */}
          <p className="text-body font-semibold text-attention-fg">
            {refusal.detail.includes("nothing changed")
              ? "Nothing was changed, so there was nothing to re-run."
              : refusal.error === "INVALID_INPUT"
                ? "That value could not be read as the type its field needs, so nothing was recomputed."
                : "The engine refused that value, so nothing was recomputed."}
          </p>
          <p className="mt-1 font-mono text-meta text-attention-fg">{refusal.detail}</p>
          <p className="max-w-measure mt-1 text-meta text-attention-fg">
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
      <p className="max-w-measure text-body text-ink">
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
        <p className="mt-3 rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-meta text-danger-fg">
          These lines moved without listing the fact you changed among their inputs:{" "}
          {r.unexplained_moves.join(", ")}. That is a contradiction between what the engine
          computed and what it recorded, so treat the two lists below with suspicion - FairSlip
          is showing it rather than hiding it.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section className="rounded-sm border border-attention-line bg-attention-bg px-3 py-2">
          <h4 className="text-meta font-semibold uppercase tracking-wide text-attention-fg">
            {r.moved_count} {r.moved_count === 1 ? "line moved" : "lines moved"}
          </h4>
          <ul className="mt-1 space-y-1">
            {moved.map((c) => (
              <li key={c.label} className="text-body text-attention-fg">
                <span className="font-medium">{c.label.replace(/_/g, " ")}</span>{" "}
                <span className="font-mono text-meta">
                  {c.before ? money(c.before) : "—"} &rarr; {c.after ? money(c.after) : "—"}
                  {c.delta && ` (${money(c.delta)})`}
                </span>
                <span className="block text-meta opacity-80">
                  {STATUS_COPY[c.status].word} &middot; {c.formula}
                </span>
              </li>
            ))}
            {moved.length === 0 && (
              <li className="text-body text-attention-fg">
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
        <section className="rounded-sm border border-line-strong bg-surface px-3 py-2">
          <h4 className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            {r.unchanged_count} did not move
          </h4>
          <ul className="mt-1 space-y-1">
            {held.map((c) => (
              <li key={c.label} className="text-body text-ink-2">
                <span className="font-medium">{c.label.replace(/_/g, " ")}</span>{" "}
                <span className="font-mono text-meta">{c.before ? money(c.before) : "—"}</span>
                <span className="block text-meta text-ink-3">
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
              <li className="text-body text-ink-2">
                {r.unexplained_moves.length === 0
                  ? "Every line moved. That fact reaches all of them."
                  : "Every line moved, but see the note below - not all of them declared a dependency on what you changed."}
              </li>
            )}
          </ul>
        </section>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-sm border border-line-strong bg-surface px-3 py-2 sm:grid-cols-2">
        <Row label="Expected net, before" value={money(r.before_expected_net)} />
        <Row label="Expected net, after" value={money(r.after_expected_net)} />
        <Row label="Difference, before" value={money(r.before_difference)} />
        <Row label="Difference, after" value={money(r.after_difference)} strong />
      </dl>
      <p className="mt-1 text-meta text-ink-2">
        The difference moved by {money(r.difference_delta)}.
      </p>

      {/* Both sides. Rendering only the after-flags made a flag that the change
          CLEARED disappear without a word, and one that was already there look
          new. */}
      {(r.flags_before.length > 0 || r.flags_after.length > 0) && (
        <ul className="mt-2 space-y-1">
          {r.flags_before.map((f) => (
            <li key={`b-${f}`} className="font-mono text-meta text-ink-2">
              before: {f}
              {!r.flags_after.includes(f) && " (cleared by your change)"}
            </li>
          ))}
          {r.flags_after
            .filter((f) => !r.flags_before.includes(f))
            .map((f) => (
              <li key={`a-${f}`} className="font-mono text-meta text-attention-fg">
                after: {f} (raised by your change)
              </li>
            ))}
        </ul>
      )}

      <p className="mt-2 text-meta text-ink-3">{r.note}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-meta">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`font-mono ${strong ? "font-bold text-ink" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
