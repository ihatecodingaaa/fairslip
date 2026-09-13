"use client";

/**
 * Three hundred people, on one screen, one mark each.
 *
 * WHAT THIS ANSWERS THAT A SENTENCE CANNOT. "11 need review and 7 were not
 * checked, out of 300" is a claim a reader has to take on trust; a field of 300
 * marks with 11 triangles and 7 hollow diamonds in it is the same claim,
 * checkable by looking. It also shows the SHAPE of the month - whether the
 * exceptions cluster in one site, whether the uncheckable rows are all at one
 * end - which no summary line carries.
 *
 * ORDER IS THE FILE'S OWN. EMP-0001 is top left and EMP-0300 is bottom right,
 * always. A mark's position is a fact about the file, so a reader who finds
 * EMP-0127 in the list below can find it in the grid. Scattering them would have
 * looked more like a constellation and meant nothing.
 *
 * ONE TAB STOP, NOT THREE HUNDRED. The grid is a single composite widget with a
 * roving tabindex: Tab enters it once, arrow keys move between marks, Home and
 * End jump to the ends, Enter and Space select. Three hundred tab stops between
 * the summary and the findings list is a keyboard trap in everything but name.
 * Every row is still individually reachable, which is the requirement.
 *
 * THE TAGS ARE NOT ON THE MARKS. A four-character label under each of three
 * hundred glyphs is a texture, not a picture, and it would triple the height of
 * the field for information that matters on eighteen of them. They are in the
 * list underneath, where the eighteen rows that need a person are, and in the
 * accessible name of every mark, where a screen reader user needs them most.
 */

import { useEffect, useRef, useState } from "react";
import type { ConceptEmployee } from "@/lib/concept-preflight/types";
import { EVENT_TAG, STATUS_WORD } from "@/lib/concept-preflight/selectors";
import { StatusLegend, StatusMark, statusToneClass } from "./marks";

/** The kinds of change recorded against one employee, as short tags. */
function tagsOf(employee: ConceptEmployee): string[] {
  return Object.entries(employee.event_counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([type]) => EVENT_TAG[type as keyof typeof EVENT_TAG]);
}

export function PreflightConstellation({
  employees,
  selected,
  onSelect,
}: {
  employees: ConceptEmployee[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const grid = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(24);
  // The single tab stop starts on the first row that needs a person, because
  // that is why anyone opened this screen.
  const [active, setActive] = useState(() => {
    const first = employees.findIndex((e) => e.preflight_status === "NEEDS_REVIEW");
    return first >= 0 ? first : 0;
  });

  useEffect(() => {
    const el = grid.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Measured rather than assumed: "down" is "forward by one row", and a row is
    // however many marks the container fits at this width and text size.
    const measure = () => setColumns(Math.max(4, Math.floor(el.clientWidth / 28)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function move(next: number) {
    const clamped = Math.max(0, Math.min(employees.length - 1, next));
    setActive(clamped);
    grid.current?.querySelector<HTMLElement>(`[data-cell="${clamped}"]`)?.focus();
  }

  const attention = employees.filter((e) => e.preflight_status !== "MATCHED");

  return (
    <div>
      <div
        ref={grid}
        role="grid"
        aria-label="Every employee in the September payroll, one mark each"
        aria-rowcount={Math.ceil(employees.length / columns)}
        aria-colcount={columns}
        className="flex flex-wrap gap-2"
        onKeyDown={(e) => {
          const step: Record<string, number> = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: columns,
            ArrowUp: -columns,
          };
          if (e.key in step) {
            e.preventDefault();
            move(active + step[e.key]);
          } else if (e.key === "Home") {
            e.preventDefault();
            move(0);
          } else if (e.key === "End") {
            e.preventDefault();
            move(employees.length - 1);
          }
        }}
      >
        {employees.map((employee, i) => {
          const isSelected = selected === employee.employee_id;
          const tags = tagsOf(employee);
          return (
            <button
              key={employee.employee_id}
              type="button"
              data-cell={i}
              role="gridcell"
              tabIndex={i === active ? 0 : -1}
              aria-selected={isSelected}
              onFocus={() => setActive(i)}
              onClick={() => onSelect(employee.employee_id)}
              aria-label={`${employee.employee_id}, ${employee.name}, ${
                STATUS_WORD[employee.preflight_status]
              }${tags.length ? `, recorded changes: ${tags.join(", ")}` : ", no recorded changes"}`}
              /* A RING OUTSIDE THE GLYPH, not a fill behind it. At this density a
                 tinted background under a 20px mark is invisible, and a reader
                 who clicked a triangle then read the inspector could not point
                 at which triangle it was. The outline costs no layout. */
              className={`mark-in rounded-full ${
                isSelected ? "outline outline-[3px] outline-offset-2 outline-ink" : ""
              }`}
              /* A reading order across the field, not a progress bar: the data is
                 already in hand when the first mark is drawn. Capped so the last
                 of three hundred lands inside half a second, and collapsed
                 entirely under prefers-reduced-motion by globals.css. */
              style={
                { ["--mark-delay" as string]: `${Math.min(i * 1.6, 420)}ms` } as React.CSSProperties
              }
            >
              <StatusMark status={employee.preflight_status} className="h-5 w-5" />
            </button>
          );
        })}
      </div>

      <p className="max-w-measure mt-4 text-meta text-ink-3">
        One mark per employee, in the order the file lists them. Shape carries the status, so it
        survives greyscale, a projector and a photocopy. Use the arrow keys to move between
        marks.
      </p>

      <StatusLegend className="mt-3" />

      {attention.length > 0 && (
        <section aria-labelledby="concept-attention" className="mt-8">
          <h3
            id="concept-attention"
            className="text-meta font-semibold uppercase tracking-wide text-ink-3"
          >
            The {attention.length} rows that need a person
          </h3>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {attention.map((employee) => {
              const isSelected = selected === employee.employee_id;
              return (
                <li key={employee.employee_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(employee.employee_id)}
                    aria-pressed={isSelected}
                    className={`tap flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-2 py-3 text-left ${
                      isSelected ? "bg-muted" : "hover:bg-muted"
                    }`}
                  >
                    <StatusMark
                      status={employee.preflight_status}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="font-mono text-meta tabular-nums text-ink-3">
                      {employee.employee_id}
                    </span>
                    <span className="min-w-0 flex-1 text-body font-semibold text-ink">
                      {employee.name}
                    </span>
                    <span className="text-meta text-ink-3">{employee.location}</span>
                    <span className="flex flex-wrap gap-1">
                      {tagsOf(employee).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-sm border border-line-strong bg-sunken px-2 py-1 font-mono text-meta text-ink-2"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                    <span
                      className={`text-meta font-semibold ${statusToneClass(
                        employee.preflight_status,
                      )}`}
                    >
                      {STATUS_WORD[employee.preflight_status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
