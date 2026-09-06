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
  pay_inputs: PayInputs;
  cpf: CpfFixture;
};

export type Fixtures = { notice: string; personas: Persona[] };

/** An engine declined to compute, and said why. Not an error to be swallowed. */
export type Refusal = {
  error: "UNESTABLISHED_INPUT" | "OUT_OF_SCOPE" | "INVALID_INPUT";
  detail: string;
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
