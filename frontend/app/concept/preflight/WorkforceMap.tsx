"use client";

/**
 * Three hundred people, and now the position of a mark means something.
 *
 * WHAT WAS WRONG WITH THE OLD ONE. It drew all three hundred in file order, one
 * long wrapped field, EMP-0001 top left to EMP-0300 bottom right. It was a good
 * picture of a claim - eleven triangles and seven diamonds in a field of three
 * hundred, checkable by looking - and it answered none of the questions a
 * person actually has in front of it. Where do I start reading. Who is that.
 * What does being over there mean. File order is a fact about the export, and
 * an export's row order is the one property of it nobody in the company cares
 * about.
 *
 * SO THE FIELD IS CUT INTO THE SITES THE COMPANY ACTUALLY HAS. Harbour Point
 * has three rows needing review and two nobody could check; Westlink Depot has
 * none and one. That is a sentence about the month that the old picture
 * contained and could not say, and a manager looking at it recognises their own
 * organisation rather than a row number. Every heading carries the group's own
 * counts, so the shape and the arithmetic are on the screen together.
 *
 * GROUPS ARE ORDERED BY WHERE THE WORK IS. Not alphabetically: a reader scanning
 * from the top should be scanning in the order the attention is, and priority.ts
 * decides that rather than this file.
 *
 * THE COUNTS ON A HEADING DO NOT MOVE WHEN A FILTER DOES. Filtering changes
 * which marks are drawn; it does not change what a site contains. A heading that
 * read "0 review" while a filter hid three would be this concept committing its
 * own defect on its own screen.
 *
 * ONE TAB STOP FOR THE WHOLE MAP, still. Arrow keys move within a group and
 * roll into the next one at its edges, Home and End reach the ends of the whole
 * map, and every mark keeps its full accessible name. Three hundred tab stops
 * is a keyboard trap whatever the layout.
 */

import { useId, useMemo, useRef, useState } from "react";
import {
  FILTER_LABEL,
  GROUPING_LABEL,
  SORT_LABEL,
  workforceGroups,
  type MapFilter,
  type MapGrouping,
  type MapSort,
} from "@/lib/concept-preflight/priority";
import { EVENT_TAG, STATUS_WORD } from "@/lib/concept-preflight/selectors";
import type { ConceptEmployee } from "@/lib/concept-preflight/types";
import { StatusLegend, StatusMark, statusToneClass } from "./marks";

function tagsOf(employee: ConceptEmployee): string[] {
  return Object.entries(employee.event_counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([type]) => EVENT_TAG[type as keyof typeof EVENT_TAG]);
}

export function WorkforceMap({
  employees,
  selected,
  onSelect,
}: {
  employees: ConceptEmployee[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [grouping, setGrouping] = useState<MapGrouping>("location");
  const [sort, setSort] = useState<MapSort>("attention");
  const [filter, setFilter] = useState<MapFilter>("all");
  const [search, setSearch] = useState("");
  const [peeked, setPeeked] = useState<string | null>(null);
  const uid = useId();

  const groups = useMemo(
    () => workforceGroups(employees, { grouping, sort, filter, search }),
    [employees, grouping, sort, filter, search],
  );

  /* The reading order across the whole map, flattened once. Arrow keys walk
     THIS, not the DOM, so moving off the end of one site lands at the start of
     the next rather than stopping at an edge the reader cannot see. */
  const order = useMemo(() => groups.flatMap((g) => g.employees.map((e) => e.employee_id)), [
    groups,
  ]);
  const [wanted, setActive] = useState(0);
  const field = useRef<HTMLDivElement>(null);

  // CLAMPED AT READ TIME, NOT STORED. A filter that empties the map would
  // otherwise leave the single tab stop pointing past the end of the field, and
  // the next Tab press would land on nothing. Deriving it means there is no
  // moment when the stored index and the rendered field disagree.
  const active = order.length === 0 ? 0 : Math.min(wanted, order.length - 1);

  function move(next: number) {
    if (order.length === 0) return;
    const clamped = Math.max(0, Math.min(order.length - 1, next));
    setActive(clamped);
    field.current?.querySelector<HTMLElement>(`[data-cell="${order[clamped]}"]`)?.focus();
  }

  const shown = order.length;
  const peekedEmployee = peeked ? employees.find((e) => e.employee_id === peeked) : null;

  return (
    <div>
      {/* ------------------------------------------------------- controls */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-4">
        <Choice
          label="Group by"
          value={grouping}
          options={(["location", "department"] as MapGrouping[]).map((v) => ({
            value: v,
            label: GROUPING_LABEL[v],
          }))}
          onPick={setGrouping}
        />
        <Choice
          label="Sort"
          value={sort}
          options={(["attention", "id"] as MapSort[]).map((v) => ({
            value: v,
            label: SORT_LABEL[v],
          }))}
          onPick={setSort}
        />
        <Choice
          label="Show"
          value={filter}
          options={(["all", "review", "unchecked", "matched"] as MapFilter[]).map((v) => ({
            value: v,
            label: FILTER_LABEL[v],
          }))}
          onPick={setFilter}
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${uid}-search`}
            className="text-meta font-semibold uppercase tracking-wide text-ink-3"
          >
            Find
          </label>
          <input
            id={`${uid}-search`}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or EMP-0127"
            className="w-56 rounded-sm border border-control bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-3"
          />
        </div>
        <p className="ml-auto text-meta text-ink-3">
          <span className="font-mono tabular-nums">{shown}</span> of{" "}
          <span className="font-mono tabular-nums">{employees.length}</span> shown
        </p>
      </div>

      {/* ------------------------------------------------------- the peek */}
      {/* A mark identifies itself here, above the field, on hover or focus.
          Opening the full inspector to find out who a dot is would make the map
          a thing you interrogate rather than a thing you read. */}
      <div
        aria-live="polite"
        className="mt-4 flex min-h-16 flex-wrap items-center gap-x-6 gap-y-1 rounded-sm border border-line bg-muted px-4 py-2"
      >
        {peekedEmployee ? (
          <>
            <span className="flex items-center gap-2">
              <StatusMark status={peekedEmployee.preflight_status} className="h-4 w-4" />
              <span className="text-body font-semibold text-ink">{peekedEmployee.name}</span>
            </span>
            <span className="font-mono text-meta text-ink-3">{peekedEmployee.employee_id}</span>
            <span className="text-meta text-ink-2">{peekedEmployee.location}</span>
            <span className="flex flex-wrap gap-1">
              {tagsOf(peekedEmployee).map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm border border-line-strong bg-sunken px-2 py-1 font-mono text-meta text-ink-2"
                >
                  {tag}
                </span>
              ))}
            </span>
            <span
              className={`ml-auto text-meta font-semibold ${statusToneClass(
                peekedEmployee.preflight_status,
              )}`}
            >
              {STATUS_WORD[peekedEmployee.preflight_status]}
            </span>
          </>
        ) : (
          <span className="text-meta text-ink-3">
            Point at a mark, or move through them with the arrow keys, to see who it is.
          </span>
        )}
      </div>

      {/* -------------------------------------------------------- the map */}
      <div
        ref={field}
        role="grid"
        aria-label="Every employee in the payroll, grouped"
        className="mt-6 space-y-7"
        onKeyDown={(e) => {
          const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
          if (e.key in step) {
            e.preventDefault();
            move(active + step[e.key]);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            // A row is however many marks the container fits; measured from the
            // rendered field rather than assumed, as the old grid did.
            const row = field.current
              ? Math.max(4, Math.floor(field.current.clientWidth / 28))
              : 24;
            move(active + (e.key === "ArrowDown" ? row : -row));
          } else if (e.key === "Home") {
            e.preventDefault();
            move(0);
          } else if (e.key === "End") {
            e.preventDefault();
            move(order.length - 1);
          }
        }}
      >
        {groups.map((group) => (
          <section key={group.key} role="rowgroup" aria-label={group.key}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-1">
              <h3 className="text-body font-semibold text-ink">{group.key}</h3>
              <p className="text-meta text-ink-3">
                <span className="font-mono tabular-nums">{group.total}</span> employees
                {group.needsReview > 0 && (
                  <>
                    {" · "}
                    <span className="font-mono tabular-nums text-attention-fg">
                      {group.needsReview}
                    </span>{" "}
                    <span className="text-attention-fg">review</span>
                  </>
                )}
                {group.notChecked > 0 && (
                  <>
                    {" · "}
                    <span className="font-mono tabular-nums text-missing-fg">
                      {group.notChecked}
                    </span>{" "}
                    <span className="text-missing-fg">not checked</span>
                  </>
                )}
              </p>
            </div>

            {group.employees.length === 0 ? (
              <p className="mt-2 text-meta text-ink-3">
                No one here matches what you are looking at.
              </p>
            ) : (
              <div role="row" className="mt-3 flex flex-wrap gap-2">
                {group.employees.map((employee) => {
                  const index = order.indexOf(employee.employee_id);
                  const isSelected = selected === employee.employee_id;
                  const tags = tagsOf(employee);
                  return (
                    <button
                      key={employee.employee_id}
                      type="button"
                      role="gridcell"
                      data-cell={employee.employee_id}
                      tabIndex={index === active ? 0 : -1}
                      aria-selected={isSelected}
                      onFocus={() => {
                        setActive(index);
                        setPeeked(employee.employee_id);
                      }}
                      onBlur={() => setPeeked((p) => (p === employee.employee_id ? null : p))}
                      onMouseEnter={() => setPeeked(employee.employee_id)}
                      onMouseLeave={() => setPeeked((p) => (p === employee.employee_id ? null : p))}
                      onClick={() => onSelect(employee.employee_id)}
                      aria-label={`${employee.employee_id}, ${employee.name}, ${
                        STATUS_WORD[employee.preflight_status]
                      }, ${group.key}${
                        tags.length ? `, recorded changes: ${tags.join(", ")}` : ", no recorded changes"
                      }`}
                      className={`mark-in rounded-full ${
                        isSelected ? "outline outline-[3px] outline-offset-2 outline-ink" : ""
                      }`}
                    >
                      <StatusMark status={employee.preflight_status} className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <StatusLegend className="mt-6" />
      <p className="max-w-measure mt-3 text-meta text-ink-3">
        One mark per employee. Shape carries the status, so it survives greyscale, a projector
        and a photocopy. Arrow keys move between marks; Enter opens one.
      </p>
    </div>
  );
}

/** A small set of mutually exclusive choices, as real radio buttons under a
 * group label. Restrained on purpose: this is a map with controls, not a data
 * grid with a toolbar. */
function Choice<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-meta font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap rounded-sm border border-control">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            aria-pressed={value === option.value}
            className={`tap-sm px-3 py-2 text-meta ${
              value === option.value
                ? "bg-muted font-semibold text-ink"
                : "font-medium text-ink-2 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
