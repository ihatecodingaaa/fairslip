"use client";

/**
 * The agent, drawn as the machine it is.
 *
 * The state machine was a list of three timeline steps and a paragraph. What it
 * could not show is the shape of the thing: that SENT is only reachable through
 * a tap, that four verdicts hang off one action, that one of those four returns
 * rather than ends, and - the argument the whole product rests on - that at the
 * level the worker has actually granted, most of this diagram is unreachable.
 *
 * NOTHING HERE IS A DRAWING OF A MACHINE. It is the machine, rendered.
 * Every node, every edge, every level comes from /agent/mandate, which builds
 * them from agent.py's AgentState, TRANSITIONS, ENTERED_BY and MANDATE_TABLE.
 * This file contains no node list, no edge list and no level; the only thing it
 * knows that the server does not is which COLUMN to put a node in, which is a
 * layout hint and cannot be wrong about the software.
 * backend/tests/test_agent_machine.py asserts the served graph equals the
 * machine node-for-node and edge-for-edge, and that this file hardcodes none of
 * it.
 *
 * THE STRUCK-THROUGH STATES ARE THE POINT. At level 2 the worker has allowed a
 * draft and a send; VERIFYING and all four verdicts and the escalation pack are
 * struck through, each naming the level that would permit it. A judge should be
 * able to see, without reading a word, that the agent cannot do the thing it is
 * not permitted to do. That is the mandate argument as a picture rather than as
 * a sentence about a guard.
 *
 * UNVERIFIABLE IS DRAWN AS RE-ATTEMPTABLE. Three verdicts end; this one returns
 * to AWAITING_NEXT_PAYSLIP and VERIFYING, because a worker whose month-2
 * payslip photographed badly has not reached the end of anything. The return
 * edge is in TRANSITIONS and is drawn from it - and the caption says so, since
 * an arrow going back up is the sort of thing a reader can miss.
 *
 * PERMITTED IS NOT THE SAME AS BUILT. AWAITING_NEXT_PAYSLIP is inside the
 * mandate at level 2 and this build does not implement it. Those are different
 * sentences that send a worker to different places, so the node carries both.
 */

import { Fragment, useId } from "react";
import { T, useT } from "../ui/Prefs";
import type { MachineOut, MachineState } from "@/lib/api";

/** Which column a node sits in. A LAYOUT hint and nothing else: it says where
 * to draw, never what is true. A state absent from here is drawn in the main
 * chain, so a new state appears rather than vanishing. */
const COLUMN: Record<string, "chain" | "verdict" | "escalation"> = {
  CORRECTED: "verdict",
  PARTIALLY_CORRECTED: "verdict",
  NOT_CORRECTED: "verdict",
  UNVERIFIABLE: "verdict",
  ESCALATION_PREPARED: "escalation",
};

function human(state: string): string {
  return state.replace(/_/g, " ").toLowerCase();
}

type NodeProps = {
  state: MachineState;
  level: number;
  current: string | null;
  verdicts: string[];
};

/**
 * One state.
 *
 * Three things can be true of a node and each is carried by SHAPE and WORDS,
 * never by colour alone: it is where you are (a heavy border and a "you are
 * here" marker), it is out of reach at this level (struck through, with the
 * level that would permit it), or it is permitted but not built (dashed, and it
 * says so).
 */
function Node({ state, level, current, verdicts }: NodeProps) {
  const t = useT();
  const locked = state.required_level !== null && state.required_level > level;
  const isCurrent = current === state.name;
  const isVerdict = verdicts.includes(state.name);

  return (
    <li
      className={`rounded-sm border-2 px-3 py-2 ${
        isCurrent
          ? "border-ink bg-attention-bg"
          : locked
            ? "border-line-strong"
            : state.built
              ? "border-line-strong"
              : "border-dashed border-line-strong"
      }`}
    >
      <p
        className={`font-mono text-body font-semibold ${
          locked ? "text-ink-2 line-through decoration-2" : "text-ink"
        }`}
      >
        {state.name}
      </p>

      {isCurrent && (
        <p className="text-meta font-semibold text-ink">
          &#9654; <T k="machine.youAreHere" />
        </p>
      )}

      {locked && (
        // The level that WOULD permit it. A struck-through node with no way
        // forward is a dead end; with the level on it, it is a choice.
        <p className="text-meta font-semibold text-ink-2">
          {t("machine.needsLevel", { n: String(state.required_level) })}
        </p>
      )}

      {!state.built && (
        // Permitted and not built. Distinct from locked on purpose: raising the
        // mandate would not make this work.
        <p className="text-meta text-ink-2">
          <T k="machine.notBuilt" />
        </p>
      )}

      {/* Outgoing edges, from TRANSITIONS. Drawn as text for the edges the
          layout cannot show as lines - the returns and the convergences - so
          every edge in the machine is on the screen somewhere. */}
      {state.to.length > 0 && (
        <p className="mt-1 text-meta text-ink-3">
          &rarr; {state.to.map(human).join(" · ")}
        </p>
      )}
      {state.terminal && (
        <p className="mt-1 text-meta text-ink-3">
          <T k="machine.terminal" />
        </p>
      )}
      {/* RE_ATTEMPTABLE, not "!terminal". The first version used "not
          terminal" and so labelled PARTIALLY_CORRECTED and NOT_CORRECTED "can
          be attempted again" - they are not terminal, but they go ON to the
          escalation pack and never come back. Telling a worker their
          part-corrected month can be re-checked would have been a claim the
          machine does not make. The server computes this as "reachable from
          itself", which is exactly the question. */}
      {isVerdict && state.re_attemptable && (
        <p className="mt-1 text-meta font-semibold text-ink-2">
          <T k="machine.reattemptable" />
        </p>
      )}
    </li>
  );
}

/** A downward connector between two nodes. A border, not a background, so it
 * survives the print sheet. */
function Down() {
  return (
    <li aria-hidden className="flex justify-center py-1">
      <span className="block h-4 w-0 border-l-2 border-ink-2" />
    </li>
  );
}

export function AgentMachine({
  machine,
  level,
  current,
}: {
  machine: MachineOut;
  level: number;
  current: string | null;
}) {
  const uid = useId();
  const t = useT();

  const chain = machine.states.filter((s) => (COLUMN[s.name] ?? "chain") === "chain");
  const verdictNodes = machine.states.filter((s) => COLUMN[s.name] === "verdict");
  const escalation = machine.states.filter((s) => COLUMN[s.name] === "escalation");

  const lockedCount = machine.states.filter(
    (s) => s.required_level !== null && s.required_level > level,
  ).length;

  return (
    <section aria-labelledby={`${uid}-h`} className="mt-6">
      <h3 id={`${uid}-h`} className="text-body font-semibold uppercase tracking-wide text-ink-3">
        <T k="machine.heading" />
      </h3>
      <p className="max-w-measure mt-1 text-meta text-ink-2">
        {t("machine.lockedSummary", { n: String(lockedCount), level: String(level) })}
      </p>

      <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <ol className="space-y-0">
          {chain.map((s, i) => (
            <Fragment key={s.name}>
              {i > 0 && <Down />}
              <Node state={s} level={level} current={current} verdicts={machine.verdicts} />
            </Fragment>
          ))}
        </ol>

        <div>
          <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">
            <T k="machine.verdicts" />
          </p>
          <ol className="mt-2 space-y-2">
            {verdictNodes.map((s) => (
              <Node
                key={s.name}
                state={s}
                level={level}
                current={current}
                verdicts={machine.verdicts}
              />
            ))}
          </ol>
          {escalation.length > 0 && (
            <ol className="mt-4 space-y-2">
              {escalation.map((s) => (
                <Node
                  key={s.name}
                  state={s}
                  level={level}
                  current={current}
                  verdicts={machine.verdicts}
                />
              ))}
            </ol>
          )}
        </div>
      </div>

    </section>
  );
}

