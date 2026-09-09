"use client";

/**
 * Change one established fact and re-run. Now a move inside the trail rather
 * than a panel underneath it.
 *
 * WHAT DID NOT CHANGE, because it is the whole point of the feature:
 *
 *   - Both runs are the engine's. This file does no arithmetic: the workspace
 *     posts the before and after facts and these components render what came
 *     back. There is no subtraction here, not even for a delta.
 *   - Which lines are RELATED to the change is read off each component's own
 *     recorded inputs, in the backend. Nothing here knows that overtime depends
 *     on the overtime hours.
 *   - If the new value cannot be established, or falls outside what the engines
 *     cover, the engine refuses and that refusal is what shows. It does NOT fall
 *     back to the previous figure: a stale amount presented as a current one is
 *     the failure this product exists to avoid.
 *
 * WHAT CHANGED. It used to be a dropdown, a text field, a button and two lists,
 * folded away behind "Change one of these numbers and re-run" - a debug affordance
 * on a page that had just finished explaining itself. The question it answers is
 * the best one the product can answer, so it is now asked where it arises: you
 * select a fact in the trail, and the fact's own panel offers to vary it. The
 * counts still come from the backend, and the two lists are still here in full.
 *
 * THE HYPOTHETICAL IS LABELLED WHEREVER IT APPEARS. A figure that would be true
 * if one fact were different is not a figure about this month, and on a screen
 * full of real ones it has to say so every time. The trail marks the nodes, this
 * panel marks the lists, and the workspace carries a standing banner with a way
 * out of it.
 */

import { useState } from "react";
import { isEstablished, money, type Fact, type ImpactOut, type Refusal } from "@/lib/api";
import { T, useT } from "../ui/Prefs";

/** A fact may be varied only if the engine would accept it in the first place.
 * An unestablished one has nothing to vary FROM, and a DISAGREED fact carries a
 * reading per reader rather than a value. */
export function isVariable(fact: Fact): boolean {
  return isEstablished(fact.status) && fact.value !== null && typeof fact.value !== "object";
}

/**
 * The question, asked of one fact.
 *
 * The box is seeded with the current value, which makes "nothing changed" the
 * likeliest first submission - so that refusal gets its own sentence rather than
 * being reported as a value the engine rejected.
 *
 * THE CALLER GIVES THIS A `key` OF THE FIELD NAME, and that is what re-seeds the
 * box when a different fact is selected. The alternative - an effect that calls
 * setValue when the prop changes - is a cascading render for something React can
 * do by remounting, and the compiler's lint refuses it. Without either, the field
 * kept the previous fact's number and the first thing the reader saw was one
 * fact's value offered as another's.
 */
export function WhatIfForm({
  fact,
  busy,
  onRun,
  onEdit,
}: {
  fact: Fact;
  busy: boolean;
  onRun: (value: string) => void;
  /** Fired on every keystroke. The workspace clears any standing result here:
   * leaving one up while the box says something else invites reading it as the
   * answer to the new number. */
  onEdit: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState(String(fact.value ?? ""));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onRun(value);
      }}
      className="mt-3 rounded-sm border border-line-strong bg-muted p-3"
    >
      <p className="text-meta font-semibold text-ink">
        <T k="lens.whatIf" />
      </p>
      <label className="mt-2 block text-meta font-medium text-ink-2">
        <T k="lens.newValue" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onEdit();
          }}
          className="mt-1 block w-full rounded-sm border border-control bg-surface px-2 py-2 font-mono text-body text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="tap mt-3 w-full rounded-sm bg-brand px-4 py-3 text-body font-semibold text-on-solid disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3"
      >
        {busy ? t("lens.rerunning") : t("lens.rerun")}
      </button>
    </form>
  );
}

/**
 * A refusal, replacing the result.
 *
 * There is no path that leaves a previous impact on screen next to a refusal for
 * the run that would have superseded it.
 */
export function ImpactRefusal({ refusal }: { refusal: Refusal }) {
  // Two of these paths never reach the engine: an unreadable value is caught
  // converting the request, and "nothing changed" is not a refused value at all.
  // Asserting one cause for all three is docs/debt.md, ui-invents-a-cause.
  const title = refusal.detail.includes("nothing changed")
    ? "Nothing was changed, so there was nothing to re-run."
    : refusal.error === "INVALID_INPUT"
      ? "That value could not be read as the type its field needs, so nothing was recomputed."
      : "The engine refused that value, so nothing was recomputed.";
  return (
    <div className="mt-3 rounded-sm border border-attention-line bg-attention-bg px-3 py-2">
      <p className="text-body font-semibold text-attention-fg">{title}</p>
      <p className="mt-1 font-mono text-meta text-attention-fg">{refusal.detail}</p>
      <p className="max-w-measure mt-1 text-meta text-attention-fg">
        No figure is shown for the change. FairSlip does not keep the previous number on screen
        as though it still answered the question you just asked.
      </p>
    </div>
  );
}

/**
 * What the re-run found.
 *
 * The counts are the backend's `moved_count` and `unchanged_count`. Counting the
 * visible rows here would be a second answer to a question the response already
 * answered, and the two would eventually disagree.
 */
export function ImpactResult({ r }: { r: ImpactOut }) {
  const moved = r.components.filter((c) => c.status !== "UNCHANGED");
  const held = r.components.filter((c) => c.status === "UNCHANGED");

  return (
    <div className="mt-3">
      <ul className="text-meta">
        {r.changed_fields.map((f) => (
          <li key={f.name} className="font-mono text-ink-2">
            {f.name.replace(/_/g, " ")}: {f.before_value} &rarr; {f.after_value}
          </li>
        ))}
      </ul>

      {/* ABOVE the two lists. This is the claim they depend on: if a line moved
          without declaring what moved it, the "did not move" list is exactly
          what is in doubt, and rendering the retraction last put the confident
          panel first. Empty on every correct run. */}
      {r.unexplained_moves.length > 0 && (
        <p className="mt-3 rounded-sm border border-danger-line bg-danger-bg px-3 py-2 text-meta text-danger-fg">
          These lines moved without listing the fact you changed among their inputs:{" "}
          {r.unexplained_moves.join(", ")}. That is a contradiction between what the engine
          computed and what it recorded, so treat the two lists below with suspicion &mdash;
          FairSlip is showing it rather than hiding it.
        </p>
      )}

      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <p className="text-body font-semibold text-attention-fg">
          <T k="lens.movedCount" vars={{ n: r.moved_count }} />
        </p>
        <p className="text-body font-semibold text-ink-2">
          <T k="lens.heldCount" vars={{ n: r.unchanged_count }} />
        </p>
      </div>

      <ul className="mt-2 space-y-2">
        {moved.map((c) => (
          <li key={c.label} className="border-t border-line pt-2">
            <p className="text-body font-medium text-attention-fg">
              {c.label.replace(/_/g, " ")}
            </p>
            <p className="font-mono text-meta text-attention-fg">
              {c.before ? money(c.before) : "—"} &rarr; {c.after ? money(c.after) : "—"}
              {c.delta && ` (${money(c.delta)})`}
            </p>
            <p className="text-meta text-ink-2">{c.status.toLowerCase()}</p>
          </li>
        ))}
        {moved.length === 0 && (
          <li className="border-t border-line pt-2 text-body text-ink-2">
            {/* Branching on the engine's own figure. This used to assert the
                change "reached the comparison" on runs where the difference
                delta was $0.00, a few lines above a line saying so. */}
            {Number(r.difference_delta.exact) === 0
              ? "No line moved, and the difference is the same figure. That fact produced no different number anywhere."
              : "No line moved. The change reached the comparison, not the components."}
          </li>
        )}
      </ul>

      <ul className="mt-3 space-y-2 border-t border-line-strong pt-2">
        {held.map((c) => (
          <li key={c.label}>
            <p className="text-body font-medium text-ink-2">{c.label.replace(/_/g, " ")}</p>
            <p className="text-meta text-ink-3">
              {/* Read from what the backend computed, never asserted. A line CAN
                  list the changed fact and hold its value: the rest-day table
                  brackets on half the normal daily hours, so 8 -> 9 crosses no
                  bracket. This sentence used to say "did not list the fact you
                  changed" about every held line, which the same response
                  contradicted. */}
              {c.depends_on_changed
                ? "listed the fact you changed among its inputs, and still came out the same"
                : "did not list the fact you changed among its inputs"}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid gap-x-6 gap-y-1 border-t border-line-strong pt-2">
        <Row label="Expected net, before" value={money(r.before_expected_net)} />
        <Row label="Expected net, after" value={money(r.after_expected_net)} />
        <Row label="Difference, before" value={money(r.before_difference)} />
        <Row label="Difference, after" value={money(r.after_difference)} strong />
        <Row label="The difference moved by" value={money(r.difference_delta)} />
      </dl>

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

      <p className="max-w-measure mt-2 text-meta text-ink-3">{r.note}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-meta">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`font-mono tabular-nums ${strong ? "font-bold text-ink" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
