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
  inputs: string[];
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
    | "DRAFT_REJECTED";
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

export type ReaderInfo = {
  key: string;
  label: string;
  model: string;
  provider: string;
  ok: boolean;
  error: string | null;
  latency_ms: number | null;
  from_cache: boolean;
  /** "HIT" - replayed from an entry committed to the repo; "MISS" - read live. */
  cache: "HIT" | "MISS";
  /** The entry that was looked for, hit or miss. A miss you can act on. */
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
  /** Why no reader was shown this field. Ships from the backend. */
  why: string;
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
  /**
   * Which path this response came down. Decided once in the backend so the
   * screen cannot invent its own definition of "cached" - and so a fast
   * response is never mistaken for a cached one.
   */
  cache_state: "HIT" | "PARTIAL" | "MISS";
  cache_note: string;
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

export type MandateTable = {
  levels: MandateLevel[];
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
export type NotBuilt = { what: string; why: string; what_is_known: string[] };

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
