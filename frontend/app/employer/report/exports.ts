/**
 * Every downloadable form of the report, from the one model.
 *
 * NO RENDERER HAS ITS OWN IDEA OF THE PAYROLL. Each takes a ReportModel and
 * writes it out. A CSV that filtered differently from the PDF, or a workbook
 * that summed a column the JSON did not, would be two accounts of one run - and
 * unlike two screens, nobody ever reads two exports side by side.
 *
 * MACHINE FORMS CARRY `exact`, HUMAN FORMS CARRY `display`. The CSV, the JSON
 * and the workbook are read by software and by spreadsheets, so they get the
 * engine's own unrounded Decimal as a number; the Markdown and the printed sheet
 * are read by people, so they get the string the backend already rounded. Both
 * come from the same Money. Neither is computed here.
 *
 * NO SPREADSHEET FORMULA RECOMPUTES ANYTHING. Cells receive values. A workbook
 * that re-derived a difference with `=B2-C2` would be a fourth engine, running
 * in Excel, with its own rounding.
 */

import { money, type Money } from "@/lib/api";
import { REASON_WORDS } from "../reasons";
import type { ReportModel, ReportRow } from "./model";

/* -------------------------------------------------------------------- CSV */

/** Which rows a CSV covers. Stated, because "the export" of a 300-row payroll
 * is three different files depending on what you are doing with it. */
export type CsvScope = "exceptions" | "notChecked" | "all";

const CSV_COLUMNS = [
  "row_number",
  "employee_name",
  "employee_account_no",
  "outcome",
  "reason_code",
  "reason_label",
  "ordinary_wages",
  "declared",
  "expected",
  "difference",
  "detail",
] as const;

function csvCell(v: string): string {
  // RFC 4180. A payroll row's detail contains commas and quotation marks - the
  // engine quotes CPF Board inside it - so this is not optional.
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The machine-readable amount: the engine's own Decimal, unrounded, unformatted.
 *
 * NOT `money()`. A cell reading "$1,173.00" is a string in every spreadsheet on
 * earth, and a column of strings does not sum, sort or filter. */
function exact(m: Money | null): string {
  return m ? m.exact : "";
}

export function toCsv(model: ReportModel, scope: CsvScope, labelFor: (code: string) => string) {
  const rows =
    scope === "exceptions" ? model.exceptions : scope === "notChecked" ? model.notChecked : model.rows;

  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.row_number ?? "",
        r.employee_name,
        r.employee_account_no,
        r.outcome,
        r.reason_code,
        r.reason_code ? labelFor(r.reason_code) : "",
        exact(r.ordinary_wages),
        exact(r.declared),
        exact(r.expected),
        exact(r.difference),
        r.detail,
      ]
        .map((v) => csvCell(String(v)))
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/** How many data rows a CSV of this scope will contain. Exported so the control
 * can say so before the file is written, rather than after. */
export function csvRowCount(model: ReportModel, scope: CsvScope): number {
  return scope === "exceptions"
    ? model.exceptions.length
    : scope === "notChecked"
      ? model.notChecked.length
      : model.rows.length;
}

/* ------------------------------------------------------------------- JSON */

/**
 * The canonical machine-readable artefact.
 *
 * It carries the model as it stands, plus the coverage that makes every other
 * figure in it meaningful. What it does NOT carry: anything the source file did
 * not contain, and any identity the chosen privacy mode withheld - the masking
 * is applied in the model, so it cannot be forgotten here.
 */
export function toJson(model: ReportModel): string {
  return JSON.stringify(model, null, 2) + "\n";
}

/* --------------------------------------------------------------- Markdown */

/**
 * ADVANCED, and deliberately not offered beside the PDF as though a payroll team
 * routinely reads Markdown. It is here for an audit note, a ticket, a handoff.
 */
export function toMarkdown(model: ReportModel, labelFor: (code: string) => string): string {
  const out: string[] = [];
  const h = (level: number, text: string) => out.push(`${"#".repeat(level)} ${text}`, "");
  const p = (text: string) => out.push(text, "");

  h(1, model.title);
  p(`Generated ${model.generated_at}.`);
  if (model.source.before_filename) p(`Source file: \`${model.source.before_filename}\``);
  if (model.source.after_filename) p(`Corrected file: \`${model.source.after_filename}\``);

  // COVERAGE FIRST AND ALWAYS. Every figure below is a claim about the checked
  // rows, and this is the sentence that says which ones those are.
  h(2, "Coverage");
  p(
    `${model.coverage.rows_read} rows read · ${model.coverage.checked} checked · ` +
      `${model.coverage.exceptions} exceptions · ${model.coverage.refused} not checked.`,
  );
  p(
    `${model.coverage.checked - model.coverage.exceptions} checked rows matched the FairSlip rule engine. ` +
      `The ${model.coverage.refused} rows that were not checked were not computed at all, and are in no total below.`,
  );

  if (model.modules.includes("money")) {
    h(2, "Declared against the published rules");
    p(
      `Declared across checked rows: ${money(model.totals.declared_total)}\n` +
        `The published rules give: ${money(model.totals.expected_total)}\n` +
        `Difference: ${money(model.totals.signed_difference)} across ${model.totals.rows} checked rows.`,
    );
  }

  if (model.modules.includes("reasons") && model.reasons.length) {
    h(2, "Difference by reason");
    out.push("| Reason | Code | Rows | Checked | Difference |", "|---|---|---|---|---|");
    for (const r of model.reasons) {
      out.push(
        `| ${labelFor(r.reason_code)} | \`${r.reason_code}\` | ${r.count} | ${r.checked_rows} | ` +
          `${r.checked_rows > 0 ? money(r.signed_difference_total) : "not checked, no amount"} |`,
      );
    }
    out.push("");
  }

  if (model.modules.includes("comparison") && model.comparison) {
    const c = model.comparison;
    h(2, "Before and after");
    p(
      `First file: ${money(c.before.difference)} across ${c.before.rows_read} rows ` +
        `(${c.before.exceptions} exceptions, ${c.before.refused} not checked).\n` +
        `Corrected file: ${money(c.after.difference)} across ${c.after.rows_read} rows ` +
        `(${c.after.exceptions} exceptions, ${c.after.refused} not checked).`,
    );
    p(
      `Across the ${c.rows_checked_in_both} rows checked in both runs, the total difference ` +
        `moved from ${money(c.both_before)} to ${money(c.both_after)}.`,
    );
    out.push("| State | Rows |", "|---|---|");
    for (const [state, n] of Object.entries(c.counts)) out.push(`| ${state} | ${n} |`);
    out.push("");
  }

  const table = (title: string, rows: ReportRow[]) => {
    if (!rows.length) return;
    h(2, title);
    out.push(
      "| Row | Employee | Account | Declared | Rules give | Difference | Reason |",
      "|---|---|---|---|---|---|---|",
    );
    for (const r of rows) {
      out.push(
        `| ${r.row_number ?? ""} | ${r.employee_name} | ${r.employee_account_no} | ` +
          `${r.declared ? money(r.declared) : "—"} | ${r.expected ? money(r.expected) : "not computed"} | ` +
          `${r.difference ? money(r.difference) : "—"} | ${r.reason_code ? labelFor(r.reason_code) : ""} |`,
      );
    }
    out.push("");
  };

  if (model.modules.includes("topExceptions")) table("Largest differences", model.topExceptions);
  if (model.modules.includes("exceptions")) table("Every exception", model.exceptions);
  if (model.modules.includes("notChecked")) table("Not checked", model.notChecked);
  if (model.modules.includes("allRows")) table("Every checked row", model.rows.filter((r) => r.outcome !== "REFUSED"));

  if (model.modules.includes("methodology")) {
    h(2, "What was checked, and whose rules");
    for (const section of model.methodology) {
      h(3, section.heading);
      for (const line of section.lines) p(line);
    }
  }

  if (model.modules.includes("runMeta")) {
    h(2, "Run details");
    p(
      `Schema version: \`${model.schema_version}\`\n` +
        `Audience preset: ${model.audience}\n` +
        `Identity shown: ${model.privacy}`,
    );
  }

  return out.join("\n");
}

/* ------------------------------------------------------------------ Excel */

/** A number for a spreadsheet cell, or null where the engine computed nothing.
 *
 * `null` RATHER THAN ZERO. A refused row has no expected amount; writing 0 would
 * make it sum, average and chart as a row that was checked and came out level. */
function num(m: Money | null): number | null {
  if (!m) return null;
  const n = Number(m.exact);
  return Number.isFinite(n) ? n : null;
}

/**
 * A real workbook, written in the browser, on demand.
 *
 * DYNAMICALLY IMPORTED. `write-excel-file` is MIT, browser-first and has one
 * dependency; it is still ~150 KB of JavaScript that a worker checking a single
 * payslip must never download. The import happens inside this function, so it is
 * fetched by the click that asks for a workbook and by nothing else.
 *
 * NO FORMULA RECOMPUTES A FAIRSLIP AMOUNT. Every money cell receives the
 * engine's own number. The Executive sheet is laid out deliberately - column
 * widths, a heading scale, and the coverage block before anything else - so it
 * does not read as a CSV in an XLSX wrapper.
 */
export async function toWorkbook(
  model: ReportModel,
  labelFor: (code: string) => string,
): Promise<Blob> {
  // `write-excel-file/browser`, not the package root: the package publishes no
  // root export, and naming the browser build is also what keeps the Node-only
  // path out of the bundle.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  type Cell = import("write-excel-file/browser").Cell;
  // The library's own Sheet type is parameterised by the shape an EMBEDDED
  // IMAGE would take, and this workbook embeds none - so the sheets are
  // described by exactly the three fields they use and checked structurally.
  // Every other field of SheetOptions is optional, which is what makes that
  // safe rather than a cast.
  type Sheet = { data: Cell[][]; sheet: string; columns: { width: number }[] };

  const H = { fontWeight: "bold" as const, fontSize: 13 };
  const LABEL = { color: "#56565F" };
  const MONEY = { format: "#,##0.00" };
  const TH = {
    fontWeight: "bold" as const,
    backgroundColor: "#EAE6DF",
    borderColor: "#868992",
    bottomBorderStyle: "thin" as const,
  };

  const text = (value: string, extra: object = {}): Cell =>
    ({ value, type: String, ...extra }) as Cell;
  const number = (value: number | null, extra: object = {}): Cell =>
    ({ value: value ?? undefined, type: Number, ...extra }) as Cell;
  const note = (value: string): Cell => ({ value, type: String, wrap: true, color: "#56565F" }) as Cell;

  const sheets: Sheet[] = [];

  /* ------------------------------------------------- 1. Executive Summary */
  const exec: Cell[][] = [
    [text(model.title, H)],
    [text(`Generated ${model.generated_at}`, LABEL)],
    [],
    // COVERAGE BEFORE ANY AMOUNT. The headline underneath is a claim about the
    // checked rows, and this is the block that says which those are.
    [text("Coverage", { fontWeight: "bold" })],
    [text("Rows read", LABEL), number(model.coverage.rows_read)],
    [text("Checked", LABEL), number(model.coverage.checked)],
    [text("Exceptions", LABEL), number(model.coverage.exceptions)],
    [text("Not checked", LABEL), number(model.coverage.refused)],
    [
      note(
        `The ${model.coverage.refused} rows that were not checked were not computed at all, and are in no total below.`,
      ),
    ],
    [],
    [text("Declared against the published rules", { fontWeight: "bold" })],
    [text("Declared in the file", LABEL), number(num(model.totals.declared_total), MONEY)],
    [text("The published rules give", LABEL), number(num(model.totals.expected_total), MONEY)],
    [
      text("Difference", { fontWeight: "bold" }),
      number(num(model.totals.signed_difference), { ...MONEY, fontWeight: "bold" }),
    ],
    [note(`across ${model.totals.rows} checked rows`)],
  ];

  if (model.comparison) {
    const c = model.comparison;
    exec.push(
      [],
      [text("Before and after", { fontWeight: "bold" })],
      [text("", LABEL), text("First file", TH), text("Corrected file", TH)],
      [
        text("Difference", LABEL),
        number(num(c.before.difference), MONEY),
        number(num(c.after.difference), MONEY),
      ],
      [text("Exceptions", LABEL), number(c.before.exceptions), number(c.after.exceptions)],
      [text("Not checked", LABEL), number(c.before.refused), number(c.after.refused)],
      [],
      [
        note(
          `Across the ${c.rows_checked_in_both} rows checked in both runs, the total difference moved from ${money(c.both_before)} to ${money(c.both_after)}.`,
        ),
      ],
    );
  }

  sheets.push({
    data: exec,
    sheet: "Executive Summary",
    columns: [{ width: 44 }, { width: 20 }, { width: 20 }, { width: 20 }],
  });

  /* ---------------------------------------------------------- row sheets */
  const rowHeader: Cell[] = [
    text("Row", TH),
    text("Employee", TH),
    text("Account", TH),
    text("Outcome", TH),
    text("Reason", TH),
    text("Reason code", TH),
    text("Ordinary Wages", TH),
    text("Declared", TH),
    text("Rules give", TH),
    text("Difference", TH),
    text("Detail", TH),
  ];
  const rowWidths = [
    { width: 7 },
    { width: 24 },
    { width: 14 },
    { width: 12 },
    { width: 38 },
    { width: 24 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 70 },
  ];
  const rowCells = (r: ReportRow): Cell[] => [
    number(r.row_number),
    text(r.employee_name),
    text(r.employee_account_no),
    text(r.outcome),
    text(r.reason_code ? labelFor(r.reason_code) : ""),
    text(r.reason_code),
    number(num(r.ordinary_wages), MONEY),
    number(num(r.declared), MONEY),
    number(num(r.expected), MONEY),
    number(num(r.difference), MONEY),
    text(r.detail, { wrap: true }),
  ];

  const addRowSheet = (name: string, rows: ReportRow[]) =>
    sheets.push({
      data: [rowHeader, ...rows.map(rowCells)],
      sheet: name,
      columns: rowWidths,
    });

  if (model.modules.includes("topExceptions"))
    addRowSheet("Largest differences", model.topExceptions);
  if (model.modules.includes("exceptions")) addRowSheet("Exceptions", model.exceptions);
  if (model.modules.includes("notChecked")) addRowSheet("Not checked", model.notChecked);
  if (model.modules.includes("allRows"))
    addRowSheet(
      "All checked rows",
      model.rows.filter((r) => r.outcome !== "REFUSED"),
    );

  /* ------------------------------------------------------- reasons sheet */
  if (model.modules.includes("reasons") && model.reasons.length) {
    sheets.push({
      data: [
        [
          text("Reason", TH),
          text("Code", TH),
          text("Rows", TH),
          text("Checked rows", TH),
          text("Difference", TH),
        ],
        ...model.reasons.map((r) => [
          text(labelFor(r.reason_code)),
          text(r.reason_code),
          number(r.count),
          number(r.checked_rows),
          // A reason that refused every row has no amount, and an EMPTY cell
          // says so where a 0 would claim a computation nobody performed - and
          // would sum, average and chart as one.
          r.checked_rows > 0 ? number(num(r.signed_difference_total), MONEY) : null,
        ]),
      ],
      sheet: "Reason breakdown",
      columns: [{ width: 44 }, { width: 26 }, { width: 10 }, { width: 14 }, { width: 16 }],
    });
  }

  /* ---------------------------------------------------- comparison sheet */
  if (model.modules.includes("comparison") && model.comparison) {
    sheets.push({
      data: [
        [
          text("Row", TH),
          text("Employee", TH),
          text("Account", TH),
          text("State", TH),
          text("Before outcome", TH),
          text("After outcome", TH),
          text("Before declared", TH),
          text("After declared", TH),
          text("Before difference", TH),
          text("After difference", TH),
        ],
        ...model.comparison.rows.map((r) => [
          number(r.row_number),
          text(r.employee_name),
          text(r.employee_account_no),
          text(r.state),
          text(r.before_outcome),
          text(r.after_outcome),
          number(num(r.before_declared), MONEY),
          number(num(r.after_declared), MONEY),
          number(num(r.before_difference), MONEY),
          number(num(r.after_difference), MONEY),
        ]),
      ],
      sheet: "Before vs after",
      columns: [
        { width: 7 },
        { width: 24 },
        { width: 14 },
        { width: 26 },
        { width: 15 },
        { width: 15 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
      ],
    });
  }

  /* --------------------------------------------------- methodology sheet */
  if (model.modules.includes("methodology") && model.methodology.length) {
    const meth: Cell[][] = [];
    for (const section of model.methodology) {
      meth.push([text(section.heading, { fontWeight: "bold" })]);
      for (const line of section.lines) meth.push([text(line, { wrap: true })]);
      meth.push([]);
    }
    sheets.push({ data: meth, sheet: "Methodology", columns: [{ width: 110 }] });
  }

  /* --------------------------------------------------------- run details */
  if (model.modules.includes("runMeta")) {
    sheets.push({
      data: [
        [text("Schema version", LABEL), text(model.schema_version)],
        [text("Generated", LABEL), text(model.generated_at)],
        [text("Source file", LABEL), text(model.source.before_filename ?? "")],
        [text("Corrected file", LABEL), text(model.source.after_filename ?? "")],
        [text("Audience preset", LABEL), text(model.audience)],
        [text("Identity shown", LABEL), text(model.privacy)],
      ],
      sheet: "Run details",
      columns: [{ width: 24 }, { width: 62 }],
    });
  }

  return writeXlsxFile(sheets).toBlob();
}

/** The plain-words label for an engine reason code, given a translator.
 *
 * Passed in rather than imported so the renderers stay pure and a test can hand
 * them a known map. REASON_WORDS is re-exported here so the caller does not have
 * to reach past this module for it. */
export { REASON_WORDS };
