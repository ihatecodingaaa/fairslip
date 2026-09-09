/**
 * Transport to the FairSlip API. This file contains no arithmetic and no rule.
 *
 * Every dollar the UI shows arrives here as a Money from an engine: `exact` is the
 * engine's own Decimal, `display` is the same number already rounded to cents by the
 * backend. The frontend formats strings; it never computes money.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_FAIRSLIP_API ?? "http://127.0.0.1:8000";

export type Money = { exact: string; display: string };

export type FactStatus = "AGREED" | "DISAGREED" | "MISSING" | "HUMAN_CONFIRMED";

export type Fact = {
  value: string | number | boolean | Record<string, string> | null;
  status: FactStatus;
  source: string;
};

export type PayInputs = Record<string, Fact | null>;

export type Component = {
  label: string;
  amount: Money;
  formula: string;
  /** The provenance STRING of every fact the engine consumed for this amount. */
  inputs: string[];
  /** The same thing as field NAMES, resolved by the backend against the facts the
   * request supplied. This is the edge record the money trail draws from - see
   * app/check/proof.ts. It is not a list of what depends on what: it is what
   * each amount recorded about itself, matched to the request that produced it.
   * backend/tests/test_provenance.py holds it, on both sides of the wire. */
  input_fields: string[];
  /** A provenance string that identified no single supplied fact - which happens
   * when two facts share a source string, and means the edge cannot be
   * attributed. Rendered, never dropped: the alternative is a trail that looks
   * complete with an edge silently missing. */
  unresolved_inputs: string[];
};

export type PayBreakdown = {
  components: Component[];
  expected_gross: Money;
  deductions_total: Money;
  expected_net: Money;
  net_paid: Money;
  difference: Money;
  flags: string[];
  cpf_ordinary_wage: Money;
  cpf_ordinary_wage_basis: string;
  /** How the backend arrived at `input_fields`, in words a screen can show. */
  provenance_note: string;
};

export type CpfResult = {
  ow_used: Money;
  ow_capped: boolean;
  band: string;
  residency: string;
  total: Money;
  employee: Money;
  employer: Money;
  formula: string;
  flags: string[];
};

export type SplitLine = {
  key: string;
  label: string;
  amount: Money;
  sub: boolean;
};

export type CpfOut = {
  declared: CpfResult;
  expected: CpfResult;
  delta: { total: Money; employee: Money; employer: Money };
  split: SplitLine[];
  split_note: string;
};

export type CpfFixture = {
  declared_ow: string;
  residency: string;
  band: string;
  band_source: string;
  contribution_month: string;
  cpf_employee_on_payslip: string | null;
};

export type Persona = {
  key: string;
  name: string;
  summary: string;
  expect_refusal: boolean;
  /** Stated by the server, not inferred from a residency string on screen. */
  cpf_applies: boolean;
  pay_inputs: PayInputs;
  cpf: CpfFixture;
};

export type Fixtures = { notice: string; personas: Persona[] };

/** An engine declined to compute, and said why. Not an error to be swallowed.
 *
 * Kept in step with RefusalOut in backend/app/schemas.py. The two agent codes
 * are deliberately separate: MANDATE_EXCEEDED means the worker did not grant
 * this, and `required_level` names the level that would - so the screen can
 * offer the choice. ACTION_NOT_BUILT means FairSlip did not build it, and
 * raising the mandate level would NOT enable it. Collapsing them would send a
 * worker to a setting that cannot help. */
export type Refusal = {
  error:
    | "UNESTABLISHED_INPUT"
    | "OUT_OF_SCOPE"
    | "INVALID_INPUT"
    | "MANDATE_EXCEEDED"
    | "ACTION_NOT_BUILT"
    | "DRAFT_UNAVAILABLE"
    | "DRAFT_REJECTED"
    | "COVERAGE_UNESTABLISHED"
    | "COVERAGE_COPY"
    /** The deployment is misconfigured: FAIRSLIP_READER_MODE is not a mode.
     * Served as a 500 - the request is fine and the caller cannot fix it. */
    | "INVALID_CONFIG";
  detail: string;
  /** Present only on MANDATE_EXCEEDED. */
  required_level?: number | null;
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

async function call<T>(path: string, init?: RequestInit): Promise<Outcome<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json();
  if (res.ok) return { ok: true, value: body as T };
  if (body && typeof body.error === "string")
    return { ok: false, refusal: body as Refusal };
  // Not a refusal an engine issued: a transport failure. Say that, do not dress it up.
  throw new Error(`${path} returned HTTP ${res.status}`);
}

export function getFixtures(): Promise<Outcome<Fixtures>> {
  return call<Fixtures>("/demo/fixtures");
}

export function postCompute(inputs: PayInputs): Promise<Outcome<PayBreakdown>> {
  return call<PayBreakdown>("/compute", {
    method: "POST",
    body: JSON.stringify(inputs),
  });
}

export function postCpf(args: {
  declared_ow: string;
  expected_ow: string;
  band: string;
  residency: string;
}): Promise<Outcome<CpfOut>> {
  return call<CpfOut>("/cpf", { method: "POST", body: JSON.stringify(args) });
}

/**
 * Display only: groups the integer part of an amount the backend already rounded.
 * No rounding, no arithmetic - it reads the string the API sent and inserts commas.
 */
export function money(m: Money): string {
  const negative = m.display.startsWith("-");
  const [whole, cents] = m.display.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${cents}`;
}

/* ------------------------------------------------------------------------
 * Extraction (Stage 2).
 *
 * The response separates the two groups of field structurally. `readFields`
 * were shown to two independent readers; `workerFields` were shown to neither,
 * and no amount of reading can establish them. The UI keeps them apart because
 * the API does.
 * ---------------------------------------------------------------------- */

export type DocumentRole = "payslip" | "roster" | "ket";

export type ImageIn = {
  role: DocumentRole;
  media_type: string;
  data_b64: string;
};

/**
 * Where one reading came from. THE ONLY provenance field on this wire.
 *
 * The previous pair - `cache: "HIT"|"MISS"` plus `from_cache` - could not tell
 * a deliberate replay from a fallback after a failed call, and "MISS" covered a
 * live success and a live failure alike. Both are gone rather than kept beside
 * this one: a coarser second description is what a screen reaches for when it
 * wants a boolean, and it is the one that can hide a failed live attempt.
 *
 * Do not map these to words here. `app/check/readerSource.ts` owns that, once.
 */
export type ReaderSource =
  /** This model was called for this request and answered. */
  | "LIVE"
  /** No model call produced this reading for this request. */
  | "CACHE"
  /** A live call was ATTEMPTED, FAILED, and a committed entry was replayed. */
  | "FALLBACK_CACHE"
  /** Nothing was read. */
  | "NONE";

export type ReaderInfo = {
  key: string;
  label: string;
  model: string;
  provider: string;
  ok: boolean;
  source: ReaderSource;
  /** Why this reading has no values. Null whenever it has some - including on a
   * fallback, whose failure is in `live_error`. */
  error: string | null;
  /** Whether a model was called for this request - true even when it failed. */
  live_attempted: boolean;
  /** What the live call raised. Present on FALLBACK_CACHE too, where the
   * reading HAS values: a fallback never hides the attempt that failed. */
  live_error: string | null;
  /** The call made for THIS request, successful or failed. The only duration
   * that describes what the viewer just waited for. */
  live_latency_ms: number | null;
  /** Recorded when the committed entry was generated, on another day against
   * another network. NEVER rendered - a test asserts it appears in no
   * component. See docs/debt.md, cached-path-wearing-a-live-timing. */
  entry_latency_ms: number | null;
  /** The entry corresponding to this reader and these images. An absent one can
   * be generated rather than merely noticed. */
  cache_key: string;
};

export type ReadField = {
  name: string;
  label: string;
  fact: Fact;
  /** What each reader actually said, kept beside the verdict. */
  readings: Record<string, string | null>;
  /** Reader keys that answered something that would not parse as a number. */
  unreadable: string[];
};

export type Choice = { value: string; label: string };

export type WorkerField = {
  name: string;
  label: string;
  prompt: string;
  /** The same question per interface language, from extract_schema.py. English
   * is absent by design - `prompt` is the English, and a second copy of it here
   * would be a second place for it to drift. */
  prompt_i18n: Record<string, string>;
  /** Why no reader was shown this field. Ships from the backend. */
  why: string;
  /** The same boundary in one line, for the default view. `why` is the argument
   * and stays one tap away; this is what the question carries beside it. Also
   * from the backend, for the same reason `why` is. */
  why_short: string;
  required_for: string[];
  answer_type: "decimal" | "choice" | "date";
  choices: Choice[];
};

export type ExtractOut = {
  readers: ReaderInfo[];
  read_fields: ReadField[];
  worker_fields: WorkerField[];
  agreed_count: number;
  read_field_count: number;
  /** The policy this request ran under. Echoed so the screen shows which one
   * was in force rather than inferring it from what came back. */
  reader_mode: "live" | "live_then_cache" | "cache";
  /**
   * Which path this response came down. Decided once in the backend so the
   * screen cannot invent its own definition of "cached" - and so a fast
   * response is never mistaken for a cached one.
   *
   * MIXED is the case worth naming: one reader answered and the other was
   * replayed after failing. It is why this is not a boolean.
   */
  reading_state: ReaderSource | "MIXED";
  /** One clause per reader, generated in the backend from the readings. */
  reading_note: string;
  /** Fields the Employment Act engine never receives. The compute gate and the
   * input assembler both read this, so they cannot drift apart. */
  cpf_only_fields: string[];
};

export function postExtract(images: ImageIn[]): Promise<Outcome<ExtractOut>> {
  return call<ExtractOut>("/extract", {
    method: "POST",
    body: JSON.stringify({ images }),
  });
}

/** Read a File into the base64 payload /extract expects. Browser-only. */
export async function fileToImageIn(
  file: File,
  role: DocumentRole,
): Promise<ImageIn> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000; // btoa on a very large spread would blow the call stack
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { role, media_type: file.type, data_b64: btoa(binary) };
}

/**
 * A field is established when two independent readers agreed, or when the
 * worker said so. This mirrors fairslip.rules.ESTABLISHED; it decides only what
 * the screen enables, never what an engine computes.
 */
export function isEstablished(status: FactStatus): boolean {
  return status === "AGREED" || status === "HUMAN_CONFIRMED";
}

/* ------------------------------------------------------- the agent (stage 3)
 *
 * Transport only, exactly like the rest of this file. Every figure below is a
 * Money the backend built from an engine's Decimal; nothing here computes, and
 * nothing here decides a verdict or a mandate.
 */

/** `built` is a claim about the software; membership in a level is a claim about
 * the mandate. They are separate, and the screen must not merge them. */
export type ActionDetail = { name: string; built: boolean };

/** A fictional worker. Every fact the switch shows is a field here, so nothing
 * on the card is something a viewer has to assume. */
export type AgentPersona = {
  key: string;
  name: string;
  residency_label: string;
  occupation: string;
  language: string;
  cpf_applies: boolean;
};

export type CpfPack = {
  split: SplitLine[];
  split_note: string;
  /** Reconciles the two "missing from her bank" figures a reader sees on one
   * page: the wage not paid, and the cash that did not arrive. */
  split_bridge: string;
};

export type MandateLevel = {
  level: number;
  label: string;
  actions: string[];
  action_detail: ActionDetail[];
};

/** One node of the agent's state machine, as agent.py defines it.
 *
 * Served rather than described: `to` is the state's outgoing edges from
 * TRANSITIONS and `required_level` is derived from ENTERED_BY and the mandate
 * table, so a diagram drawn from this cannot drift from the machine.
 * `built` and `required_level` answer different questions - "we did not build
 * this" and "you did not allow this" send a worker to different places. */
export type MachineState = {
  name: string;
  entered_by: string | null;
  required_level: number | null;
  built: boolean;
  terminal: boolean;
  /** Reachable from itself. NOT the same as "not terminal":
   * PARTIALLY_CORRECTED goes on to the escalation pack and never comes back,
   * so it is neither terminal nor re-attemptable. */
  re_attemptable: boolean;
  to: string[];
};

export type MachineOut = {
  states: MachineState[];
  start: string;
  verdicts: string[];
};

export type MandateTable = {
  levels: MandateLevel[];
  /** The state machine itself, so the diagram is the machine rather than a
   * picture of it. See backend/tests/test_agent_machine.py. */
  machine: MachineOut;
  /** Shown where the level is set, never in a tooltip. */
  no_authentication_notice: string;
  reference_links: Record<string, string>;
};

export type CitedFigure = {
  label: string;
  amount: Money;
  formula: string;
  source: string;
};

export type NgoOption = { name: string; what_they_do: string; link: string };

export type DraftOut = {
  /** Always MESSAGE_DRAFTED. A drafted message is not a sent one. */
  state: string;
  /** Whose message this is, and that it is not the viewer's. The server writes
   * it: a caveat the screen assembles is a caveat the screen can drop. */
  basis: string;
  english: string;
  translated: string;
  language: string;
  figures_cited: CitedFigure[];
  alternative_heading: string;
  alternative: NgoOption[];
  model: string;
  cache_state: string;
  cache_note: string;
  generated_on: string;
};

export type SentOut = {
  state: string;
  /** The moment of the TAP, from the backend. Never re-stamped here. */
  tap_at: string;
  tap_surface: string;
  message_id: string;
  note: string;
};

export type BlockedField = { name: string; status: string; detail: string };

export type VerifyOut = {
  verdict: "CORRECTED" | "PARTIALLY_CORRECTED" | "NOT_CORRECTED" | "UNVERIFIABLE";
  state: string;
  month1_difference: Money;
  month2_difference: Money | null;
  adjustment_found: Money | null;
  remaining_gap: Money | null;
  month1_expected_net: Money | null;
  month2_expected_net: Money | null;
  month2_net_paid: Money | null;
  blocked_by: BlockedField[];
  arithmetic: string;
};

export function getMandate(): Promise<Outcome<MandateTable>> {
  return call<MandateTable>("/agent/mandate");
}

export function postDraft(level: number, specName: string): Promise<Outcome<DraftOut>> {
  return call<DraftOut>("/agent/draft", {
    method: "POST",
    body: JSON.stringify({ level, spec_name: specName }),
  });
}

/** `tapAt` is produced at the moment the worker taps, and sent as-is. */
export function postSend(level: number, tapAt: string, surface: string): Promise<Outcome<SentOut>> {
  return call<SentOut>("/agent/send", {
    method: "POST",
    body: JSON.stringify({ level, tap: { at: tapAt, surface } }),
  });
}

export function postVerify(
  level: number,
  month1: PayInputs,
  month2: PayInputs,
): Promise<Outcome<VerifyOut>> {
  return call<VerifyOut>("/agent/verify", {
    method: "POST",
    body: JSON.stringify({ level, month1, month2 }),
  });
}

export type DemoInputs = {
  month1: PayInputs;
  month2_corrected: PayInputs;
  month2_uncorrected: PayInputs;
  /** Served by the backend so no screen synthesises a reader disagreement. */
  month2_blocked: PayInputs;
  /** Every persona the switch offers, and which one this response is for.
   * Served so the switch is rendered from the same record that decides what the
   * response contains - a switch bolted onto one field is how a NO_CPF worker
   * ends up under a CPF split. */
  personas: AgentPersona[];
  selected: AgentPersona;
  /** Which committed draft entry belongs to this persona. Never hardcoded. */
  draft_spec_name: string;
  /** The CPF pack, trimmed to what the panel renders. Not CpfOut: `declared`,
   * `expected` and `delta` are not shown, and serialising unrendered figures
   * invites a later screen to display one without the caveats these carry. */
  /** Null for a persona who is not a CPF member. Reachable, and it must be:
   * a split of zeros under a NO_CPF banner is a card contradicting itself. */
  cpf: CpfPack | null;
  /** Whose month the CPF pack is, and why it is fixture data rather than
   * anything read from an uploaded document. The panel refuses to render CPF
   * figures without it. */
  cpf_basis: string;
  /** Why there is no CPF pack. Present exactly when `cpf` is null. */
  no_cpf_note: string;
};

export function getAgentDemoInputs(persona?: string): Promise<Outcome<DemoInputs>> {
  const q = persona ? `?persona=${encodeURIComponent(persona)}` : "";
  return call<DemoInputs>(`/agent/demo-inputs${q}`);
}

export type EvidenceItem = {
  /** TADM's own wording, unedited. */
  quoted: string;
  /** FairSlip's plain gloss. Kept apart so a reader sees whose words are whose. */
  note: string;
  source_url: string;
  /** The page this quote came from, named. A quotation attributed by the
   * nearest heading is attributed to the wrong body. */
  source_label: string;
};

export type Deadline = {
  label: string;
  quoted: string;
  source_url: string;
  source_label: string;
};

/** A half of the pack that does not exist, and why. Rendered, never hidden. */
/** An authority's own words, and - separately - FairSlip's reading of them.
 * Same shape as EvidenceItem, for the same reason: a gloss rendered under a
 * heading that names an authority is attributed to that authority. */
export type QuotedSource = { quoted: string; note: string };

export type NotBuilt = {
  what: string;
  why: string;
  what_is_known: QuotedSource[];
  /** The page these quotes came from, named and dated. Every other quoted block
   * on this screen carries its source; these did not. */
  source_url: string;
  source_label: string;
};

export type EscalationOut = {
  heading: string;
  evidence: EvidenceItem[];
  deadlines: Deadline[];
  filing_steps: string[];
  not_built: NotBuilt[];
  disclaimer: string;
};

/** Below level 4 this refuses, and WHICH refusal is the point - only the backend
 * can say, because the mandate check fires before any dispatch. */
export function postEscalation(
  level: number,
  persona?: string,
): Promise<Outcome<EscalationOut>> {
  return call<EscalationOut>("/agent/escalation", {
    method: "POST",
    body: JSON.stringify({ level, persona: persona ?? null }),
  });
}


/* --------------------------------------------------------------- impact radius
 *
 * Change one established fact and see how far the change reaches. Both runs are
 * the engine's - the endpoint calls compute_expected twice and does the
 * comparison there - so nothing here subtracts anything.
 *
 * The claim worth making is the second list: the lines that did NOT move. It is
 * computed by comparing two engine runs, and which lines are RELATED to the
 * change is read off each component's own recorded inputs. There is no
 * field-to-component map in this codebase and a test asserts there is not.
 */

export type ChangedField = {
  name: string;
  before_value: string;
  after_value: string;
  before_source: string;
  after_source: string;
};

export type ComponentImpact = {
  label: string;
  /** MOVED | UNCHANGED | ADDED | REMOVED. A line can disappear - that is not
   * "unchanged", and saying so would be false. */
  status: "MOVED" | "UNCHANGED" | "ADDED" | "REMOVED";
  before: Money | null;
  after: Money | null;
  delta: Money | null;
  /** Derived: this line listed the provenance of a fact that changed. */
  depends_on_changed: boolean;
  formula: string;
};

export type ImpactOut = {
  changed_fields: ChangedField[];
  components: ComponentImpact[];
  moved_count: number;
  unchanged_count: number;
  /** Non-empty means a line moved without declaring a dependency on anything
   * that changed - the graph and the arithmetic disagreeing. Rendered loudly. */
  unexplained_moves: string[];
  /** The other direction, and NOT an error: lines that listed the changed fact
   * and held their value anyway. Saying "did not list the fact you changed"
   * about these would be false. */
  held_but_dependent: string[];
  before_expected_net: Money;
  after_expected_net: Money;
  before_difference: Money;
  after_difference: Money;
  difference_delta: Money;
  flags_before: string[];
  flags_after: string[];
  note: string;
};

export function postImpact(
  before: PayInputs,
  after: PayInputs,
): Promise<Outcome<ImpactOut>> {
  return call<ImpactOut>("/impact", {
    method: "POST",
    body: JSON.stringify({ before, after }),
  });
}

/* ------------------------------------------------------------------------
 * Coverage: who FairSlip is for, stated as rules.
 *
 * Every string below was written by the backend from a quote, an engine
 * constant, or the result of running an engine - see backend/fairslip/
 * coverage.py. The page renders them and computes nothing, which is why there
 * is no number type here except the counts: `display` arrives formatted, by the
 * same formatter every other dollar in the product goes through.
 * ---------------------------------------------------------------------- */

export type Quote = {
  /** The authority's own words. Never edited, never translated. */
  quoted: string;
  source_url: string;
  source_label: string;
};

export type EngineValue = {
  label: string;
  display: string;
  unit: "money" | "hours" | "ratio" | "multiplier" | "count";
  /** Where the value was read from, e.g. "rules.WORKMAN_BASIC_CAP". */
  engine_symbol: string;
};

export type EncodedRule = {
  what: string;
  engine_symbol: string;
  source_url: string;
  source_label: string;
  /** null where the published source carries the rule as a table, not a sentence. */
  quote: Quote | null;
  values: EngineValue[];
};

export type RulePack = {
  key: string;
  name: string;
  engine_module: string;
  covers: string;
  coverage_quote: Quote | null;
  thresholds: EngineValue[];
  encoded: EncodedRule[];
};

export type ResidencyOutcome = {
  residency: string;
  outcome: "CONTRIBUTES" | "NOT_A_MEMBER" | "REFUSED";
  /** The engine's own flag or refusal message. Empty where it simply computed. */
  engine_said: string;
};

export type NotEncoded = {
  what: string;
  kind: "REFUSED_BY_ENGINE" | "NO_INPUT_EXISTS" | "STATED_NOT_CHECKED";
  why: string;
  established_by: string;
  footer_phrase: string;
  would_need_field: string;
};

export type InterfaceCoverage = {
  question_count: number;
  languages: string[];
  questions_translated: [string, number][];
  note: string;
  quotes_note: string;
};

export type CoverageOut = {
  heading: string;
  note: string;
  packs: RulePack[];
  residency: ResidencyOutcome[];
  residency_note: string;
  not_encoded: NotEncoded[];
  interface: InterfaceCoverage;
};

export function getCoverage(): Promise<Outcome<CoverageOut>> {
  return call<CoverageOut>("/coverage");
}

/* ------------------------------------------- the employer pre-payday check */

/** One column of the upload, and whose schema it belongs to.
 *
 * `spec_name` is CPF Board's own field name from the Employer Contribution
 * Detail Record; the two columns FairSlip adds carry "(not in the CPF file)".
 * The screen renders the two groups apart, because telling an employer that CPF
 * Board asked for something it did not ask for is the same class of error as
 * showing a figure no engine produced. */
export type SpecField = {
  csv_name: string;
  spec_name: string;
  columns: string;
  data_type: string;
  note: string;
};

export type EmployerFinding = {
  row_number: number;
  employee_name: string;
  employee_account_no: string;
  outcome: "OK" | "EXCEPTION" | "REFUSED";
  reason: string | null;
  detail: string;
  declared: Money | null;
  expected: Money | null;
  difference: Money | null;
  ordinary_wages: Money | null;
  band: string | null;
  engine_formula: string;
  engine_flags: string[];
};

/** One reason code, with the rows and the signed money behind it.
 *
 * `checked_rows` is load-bearing. A reason that only ever REFUSES carries
 * `checked_rows: 0`, and the screen must then print the row count with no money
 * figure beside it: nothing was computed for those rows, and $0.00 next to them
 * reads as rows that were checked and agreed. */
export type ReasonAggregate = {
  reason_code: string;
  count: number;
  checked_rows: number;
  signed_difference_total: Money;
};

/** The two ends of the payroll and the gap, over CHECKED rows only.
 *
 * `declared_total - expected_total === signed_difference` exactly, which is the
 * only reason a screen may draw a bridge from one end to the other. The engine
 * asserts it (backend/tests/test_employer_xray.py); nothing here re-derives it. */
export type CheckedTotals = {
  rows: number;
  declared_total: Money;
  expected_total: Money;
  signed_difference: Money;
};

export type EmployerCheckOut = {
  rows_read: number;
  checked: number;
  exceptions: number;
  refused: number;
  total_difference: Money;
  reasons: ReasonAggregate[];
  totals: CheckedTotals;
  findings: EmployerFinding[];
};

export type EmployerSchemaOut = {
  spec_fields: SpecField[];
  extra_fields: SpecField[];
  spec_title: string;
  spec_effective: string;
  spec_record: string;
  spec_length: string;
  spec_url: string;
  spec_read_on: string;
  rounding_a: string;
  rounding_b: string;
  note_4: string;
  account_column: string;
  note_4_reading: string;
  mistakes_url: string;
  mistakes: [string, string[]][];
};

/** What happened to one employee between two runs of the same payroll.
 *
 * TEN STATES, EXHAUSTIVE AND DISJOINT, and the backend decides which. The
 * distinctions that matter are the ones a browser would be tempted to collapse:
 * STILL_REFUSED is not STILL_MATCHED (nothing was computed in either run), and
 * REMOVED is not RESOLVED (an employee who left the payroll was not corrected).
 * See fairslip/employer.RecheckState. */
export type RecheckState =
  | "STILL_MATCHED"
  | "RESOLVED"
  | "STILL_EXCEPTION"
  | "NEW_EXCEPTION"
  | "NEWLY_REFUSED"
  | "STILL_REFUSED"
  | "NEWLY_CHECKED_MATCHED"
  | "NEWLY_CHECKED_EXCEPTION"
  | "REMOVED"
  | "ADDED";

export type RecheckRow = {
  employee_account_no: string;
  employee_name: string;
  state: RecheckState;
  /** null on either side means the row is in only one of the two files. */
  before_row_number: number | null;
  after_row_number: number | null;
  before_outcome: EmployerFinding["outcome"] | null;
  after_outcome: EmployerFinding["outcome"] | null;
  before_declared: Money | null;
  after_declared: Money | null;
  before_expected: Money | null;
  after_expected: Money | null;
  before_difference: Money | null;
  after_difference: Money | null;
  before_reason: string | null;
  after_reason: string | null;
  after_detail: string;
};

/** Two runs, and what moved between them.
 *
 * FIVE MONEY FIELDS, NOT THREE. `before_difference` and `after_difference` are
 * each run's own total over its own checked rows - the two figures the two
 * X-rays show. Subtracting them is NOT the change: whenever a row was refused
 * in one run and checked in the other, that subtraction spans two different
 * sets of rows. The change is `both_change`, over `rows_checked_in_both`, and
 * `both_change === both_after - both_before` exactly. */
export type EmployerRecheckOut = {
  before_summary: EmployerCheckOut;
  after_summary: EmployerCheckOut;
  rows: RecheckRow[];
  counts: Record<RecheckState, number>;
  before_difference: Money;
  after_difference: Money;
  rows_checked_in_both: number;
  both_before: Money;
  both_after: Money;
  both_change: Money;
};

export function getEmployerSchema(): Promise<Outcome<EmployerSchemaOut>> {
  return call<EmployerSchemaOut>("/employer/schema");
}

/** Upload the file. NOT through call(): that sets a JSON content type, and a
 * multipart body needs the browser to set its own boundary. */
export async function postEmployerCheck(file: File): Promise<Outcome<EmployerCheckOut>> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_BASE}/employer/check`, { method: "POST", body });
  const payload = await res.json();
  if (res.ok) return { ok: true, value: payload as EmployerCheckOut };
  if (payload && typeof payload.error === "string")
    return { ok: false, refusal: payload as Refusal };
  throw new Error(`/employer/check returned HTTP ${res.status}`);
}

/** Both files, checked and compared in one request.
 *
 * The comparison is the backend's: nothing here diffs two responses. A browser
 * that decided for itself which rows "resolved" would be a second source of
 * truth about which employee a row in the second file is. */
export async function postEmployerRecheck(
  before: File,
  after: File,
): Promise<Outcome<EmployerRecheckOut>> {
  const body = new FormData();
  body.append("before", before);
  body.append("after", after);
  const res = await fetch(`${API_BASE}/employer/recheck`, { method: "POST", body });
  const payload = await res.json();
  if (res.ok) return { ok: true, value: payload as EmployerRecheckOut };
  if (payload && typeof payload.error === "string")
    return { ok: false, refusal: payload as Refusal };
  throw new Error(`/employer/recheck returned HTTP ${res.status}`);
}

export const EMPLOYER_DEMO_CSV = `${API_BASE}/employer/demo-csv`;
export const EMPLOYER_DEMO_CSV_CORRECTED = `${API_BASE}/employer/demo-csv-corrected`;

