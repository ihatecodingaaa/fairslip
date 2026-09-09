/**
 * ONE report, five renderings.
 *
 * The preview, the print sheet, the workbook, the CSV, the JSON and the
 * Markdown are all built from the object this file produces. That is not
 * tidiness - it is the only way the workbook and the PDF cannot disagree about
 * a payroll. A second export with its own idea of which rows count would be a
 * second source of truth that nobody reads side by side and everybody trusts.
 *
 * NOTHING IS COMPUTED HERE. Every amount is a Money the backend built and every
 * count is a field of the engine's own aggregates. This module SELECTS, ORDERS
 * and MASKS. It does not add up.
 *
 * COVERAGE IS NOT A MODULE THE USER CAN TURN OFF, and that is the load-bearing
 * rule of the whole feature. A report that says anything about a payroll run has
 * to say how much of it was checked - otherwise unticking "Not checked" turns
 * "11 exceptions in 293 checked rows" into "11 exceptions", which reads as a
 * claim about 300 employees and is the exact failure this product exists to
 * find. `REQUIRED` below is enforced in `buildReport`, not in the checkbox.
 *
 * NOTHING IS CERTIFIED. There is no score, no percentage, no grade and no
 * approval anywhere in this model, and backend/tests/test_employer_report.py
 * asserts that over every renderer.
 */

import type {
  EmployerCheckOut,
  EmployerFinding,
  EmployerRecheckOut,
  EmployerSchemaOut,
  Money,
  ReasonAggregate,
  RecheckRow,
  RecheckState,
} from "@/lib/api";

/** Bumped deliberately, and only when a consumer would have to change.
 *
 * It ships in the JSON export, which is the artefact something else might read.
 * A version that moves on every edit tells a reader nothing; one that never
 * moves tells them something false. */
export const REPORT_SCHEMA_VERSION = "fairslip.employer-report/1";

export type Audience = "executive" | "payroll" | "audit" | "custom";

/** How much of a person reaches the page.
 *
 * A management report rarely needs a name, and the least identifying mode that
 * still answers the question is the right default for one. Nothing here invents
 * an identity: FULL shows what the uploaded file carried and nothing more, and
 * a row whose name column was empty stays empty. */
export type Privacy = "anonymised" | "account" | "full";

export type ModuleId =
  | "coverage"
  | "money"
  | "reasons"
  | "comparison"
  | "topExceptions"
  | "exceptions"
  | "notChecked"
  | "allRows"
  | "methodology"
  | "runMeta";

export const MODULES: { id: ModuleId; label: string; required?: boolean }[] = [
  { id: "coverage", label: "Coverage — rows read, checked, exceptions, not checked", required: true },
  { id: "money", label: "Declared against the published rules" },
  { id: "reasons", label: "Difference by reason" },
  { id: "comparison", label: "Before and after a correction" },
  { id: "topExceptions", label: "Largest differences" },
  { id: "exceptions", label: "Every exception" },
  { id: "notChecked", label: "Every row that was not checked" },
  { id: "allRows", label: "Every checked row" },
  { id: "methodology", label: "What was checked, and whose rules" },
  { id: "runMeta", label: "Run details" },
];

const REQUIRED: ModuleId[] = MODULES.filter((m) => m.required).map((m) => m.id);

/** What each audience starts with. The user may then add or remove anything
 * that is not required. */
export const PRESETS: Record<Exclude<Audience, "custom">, { modules: ModuleId[]; privacy: Privacy }> =
  {
    executive: {
      modules: ["coverage", "money", "reasons", "comparison", "topExceptions", "runMeta"],
      // The least identifying mode that still answers "how big and what kind".
      privacy: "anonymised",
    },
    payroll: {
      modules: [
        "coverage",
        "money",
        "reasons",
        "comparison",
        "exceptions",
        "notChecked",
        "runMeta",
      ],
      // A payroll team has to find the row in their own system.
      privacy: "account",
    },
    audit: {
      modules: [
        "coverage",
        "money",
        "reasons",
        "comparison",
        "exceptions",
        "notChecked",
        "allRows",
        "methodology",
        "runMeta",
      ],
      privacy: "account",
    },
  };

export type ReportRow = {
  /** The row number in the file. Always present, and the only identity in
   * ANONYMISED mode. */
  row_number: number | null;
  /** Empty unless the privacy mode allows it AND the file carried one. */
  employee_name: string;
  /** Empty, masked, or as the file carried it, per the privacy mode. */
  employee_account_no: string;
  outcome: "OK" | "EXCEPTION" | "REFUSED";
  reason_code: string;
  ordinary_wages: Money | null;
  declared: Money | null;
  expected: Money | null;
  difference: Money | null;
  detail: string;
};

export type ReportComparisonRow = {
  row_number: number | null;
  employee_name: string;
  employee_account_no: string;
  state: RecheckState;
  before_outcome: string;
  after_outcome: string;
  before_declared: Money | null;
  after_declared: Money | null;
  before_expected: Money | null;
  after_expected: Money | null;
  before_difference: Money | null;
  after_difference: Money | null;
};

export type ReportModel = {
  schema_version: string;
  generated_at: string;
  audience: Audience;
  privacy: Privacy;
  modules: ModuleId[];
  title: string;

  source: { before_filename: string | null; after_filename: string | null };

  /** ALWAYS PRESENT. See the note at the head of this file. */
  coverage: { rows_read: number; checked: number; exceptions: number; refused: number };

  headline: Money;
  totals: EmployerCheckOut["totals"];
  reasons: ReasonAggregate[];

  rows: ReportRow[];
  exceptions: ReportRow[];
  notChecked: ReportRow[];
  topExceptions: ReportRow[];

  comparison: {
    counts: Record<RecheckState, number>;
    before: { difference: Money; exceptions: number; refused: number; rows_read: number };
    after: { difference: Money; exceptions: number; refused: number; rows_read: number };
    rows_checked_in_both: number;
    both_before: Money;
    both_after: Money;
    both_change: Money;
    rows: ReportComparisonRow[];
  } | null;

  methodology: { heading: string; lines: string[] }[];
};

/** Masked, not truncated: the shape stays legible as a CPF account number so a
 * payroll team recognises what they are looking at, and the middle - the part
 * that identifies - does not travel. */
function maskAccount(account: string): string {
  const a = account.trim();
  if (a.length <= 4) return a ? "•".repeat(a.length) : "";
  return `${a[0]}${"•".repeat(a.length - 4)}${a.slice(-3)}`;
}

function identity(
  privacy: Privacy,
  name: string,
  account: string,
): { employee_name: string; employee_account_no: string } {
  if (privacy === "full") return { employee_name: name, employee_account_no: account };
  if (privacy === "account")
    return { employee_name: "", employee_account_no: maskAccount(account) };
  return { employee_name: "", employee_account_no: "" };
}

function toRow(f: EmployerFinding, privacy: Privacy): ReportRow {
  return {
    row_number: f.row_number,
    ...identity(privacy, f.employee_name, f.employee_account_no),
    outcome: f.outcome,
    reason_code: f.reason ?? "",
    ordinary_wages: f.ordinary_wages,
    declared: f.declared,
    expected: f.expected,
    difference: f.difference,
    detail: f.detail,
  };
}

function toComparisonRow(r: RecheckRow, privacy: Privacy): ReportComparisonRow {
  return {
    row_number: r.after_row_number ?? r.before_row_number,
    ...identity(privacy, r.employee_name, r.employee_account_no),
    state: r.state,
    before_outcome: r.before_outcome ?? "",
    after_outcome: r.after_outcome ?? "",
    before_declared: r.before_declared,
    after_declared: r.after_declared,
    before_expected: r.before_expected,
    after_expected: r.after_expected,
    before_difference: r.before_difference,
    after_difference: r.after_difference,
  };
}

/** Magnitude, for RANKING only. Never rendered. */
function magnitude(m: Money | null): number {
  if (!m) return 0;
  const n = Number(m.exact);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export function buildReport({
  result,
  comparison,
  schema,
  audience,
  privacy,
  modules,
  beforeFilename,
  afterFilename,
  generatedAt,
}: {
  result: EmployerCheckOut;
  comparison: EmployerRecheckOut | null;
  schema: EmployerSchemaOut | null;
  audience: Audience;
  privacy: Privacy;
  modules: ModuleId[];
  beforeFilename: string | null;
  afterFilename: string | null;
  /** Passed in, not taken here: a model rebuilt on every keystroke would
   * restamp itself, and "when this was worked out" would become "when you last
   * touched a checkbox". */
  generatedAt: string;
}): ReportModel {
  // THE COVERAGE MODULE CANNOT BE DROPPED. Unticking it in the UI is not
  // possible, and this is the second lock: a caller assembling the list by hand
  // still gets it.
  const chosen = new Set([...REQUIRED, ...modules]);
  // A MODULE WITH NOTHING BEHIND IT IS DROPPED. The presets name `comparison`
  // because most runs will have one, but a run with no second file has no
  // before-and-after - and listing the section anyway would have the pack claim
  // a part of itself that does not exist, in the JSON most likely to be read by
  // something other than a person.
  if (!comparison) chosen.delete("comparison");
  const ordered = MODULES.filter((m) => chosen.has(m.id)).map((m) => m.id);

  const rows = result.findings.map((f) => toRow(f, privacy));
  const exceptions = rows.filter((r) => r.outcome === "EXCEPTION");
  const notChecked = rows.filter((r) => r.outcome === "REFUSED");
  const topExceptions = [...exceptions]
    .sort((a, b) => magnitude(b.difference) - magnitude(a.difference))
    .slice(0, 10);

  return {
    schema_version: REPORT_SCHEMA_VERSION,
    generated_at: generatedAt,
    audience,
    privacy,
    modules: ordered,
    title: comparison ? "Payroll review — before and after" : "Payroll review",

    source: { before_filename: beforeFilename, after_filename: afterFilename },

    coverage: {
      rows_read: result.rows_read,
      checked: result.checked,
      exceptions: result.exceptions,
      refused: result.refused,
    },

    headline: result.total_difference,
    totals: result.totals,
    reasons: result.reasons,

    rows,
    exceptions,
    notChecked,
    topExceptions,

    comparison: comparison
      ? {
          counts: comparison.counts,
          before: {
            difference: comparison.before_difference,
            exceptions: comparison.before_summary.exceptions,
            refused: comparison.before_summary.refused,
            rows_read: comparison.before_summary.rows_read,
          },
          after: {
            difference: comparison.after_difference,
            exceptions: comparison.after_summary.exceptions,
            refused: comparison.after_summary.refused,
            rows_read: comparison.after_summary.rows_read,
          },
          rows_checked_in_both: comparison.rows_checked_in_both,
          both_before: comparison.both_before,
          both_after: comparison.both_after,
          both_change: comparison.both_change,
          rows: comparison.rows.map((r) => toComparisonRow(r, privacy)),
        }
      : null,

    methodology: methodologyFrom(schema),
  };
}

/**
 * What was checked and whose rules, in the sources' own words.
 *
 * EVERY LINE COMES FROM THE SCHEMA ENDPOINT. Nothing here paraphrases CPF Board,
 * and nothing is written twice: the same strings are on the screen under "the
 * columns, the rounding and the mistakes list". A methodology section that
 * restated them in its own words would be a second account of what the product
 * does, in the document most likely to be read by someone who was not there.
 */
function methodologyFrom(schema: EmployerSchemaOut | null): ReportModel["methodology"] {
  if (!schema) return [];
  return [
    {
      heading: "The file",
      lines: [
        `Ten of the twelve columns are CPF Board's own, from the ${schema.spec_record} of the ${schema.spec_title} (${schema.spec_effective}; ${schema.spec_length}; ${schema.spec_read_on}).`,
        `Two columns are FairSlip's and are not in that record: ${schema.extra_fields
          .map((f) => f.csv_name)
          .join(" and ")}. The Detail Record carries no date of birth and does not distinguish PR years; the engine needs both.`,
        schema.spec_url,
      ],
    },
    {
      heading: "The rounding, quoted",
      lines: [`(a) ${schema.rounding_a};`, `(b) ${schema.rounding_b}.`],
    },
    {
      heading: "What it looks for, and who says so",
      lines: [
        ...schema.mistakes.flatMap(([heading, bullets]) => [heading, ...bullets.map((b) => `"${b}"`)]),
        schema.mistakes_url,
      ],
    },
    {
      heading: "What it does not check",
      lines: [
        "Additional Wages. The engine computes Ordinary Wages only, so a row declaring Additional Wages is refused rather than compared — the difference would be FairSlip's to explain, not the employer's.",
        "First- and second-year Permanent Resident rates. Secondary sources conflict on the Year-2 employer rate and it was not verified against CPF Board's own table.",
        "Wages at or below $750, which use graduated formulas that are not encoded.",
        "FairSlip flags and explains. It does not edit payroll, file anything, or assert liability.",
      ],
    },
  ];
}
