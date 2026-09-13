/**
 * FairSlip Preflight: the type model for a FUTURE PRODUCT CONCEPT.
 *
 * NOT PRODUCTION. Nothing in this folder is wired to /check or /employer, to any
 * API, or to any real company. It exists so that a payroll or HR operator can be
 * shown a workflow and argue with it. See docs-concept/README.md.
 *
 * THE ONE IDEA: HR software records what happened. Payroll software calculates
 * what gets paid. This concept checks that what happened became the right
 * payroll outcome - and says clearly where it cannot check.
 *
 * WHY THE TYPES ARE SHAPED LIKE THIS.
 *
 * A prototype is the easiest place in the world to put a number on a screen that
 * nothing produced. So every amount in this model carries an ORIGIN, and the
 * three origins are kept apart in the type system rather than in a convention:
 *
 *   RULE_DERIVED    a figure fairslip/rules.py or fairslip/cpf.py produced, from
 *                   the inputs recorded beside it. Generated OFFLINE by running
 *                   the production engines, never recomputed in a browser, and
 *                   asserted against those engines in
 *                   backend/tests/test_concept_preflight.py. If someone edits
 *                   one of these digits by hand, the suite goes red.
 *   PAYROLL_STATED  a figure the fictional payroll register states. It is an
 *                   INPUT to a check, never the output of one. Fabricated on
 *                   purpose, exactly as backend/demo/employer_roster.py
 *                   fabricates the wrong amounts it seeds.
 *   ILLUSTRATIVE    a figure invented to make a screen legible, belonging to no
 *                   rule and no source record. It is labelled as such wherever
 *                   it is drawn.
 *
 * AND THE ABSENCE OF AN AMOUNT IS ITSELF A STATE. `AmountCheck` has a
 * NOT_CHECKED member and every NOT_CHECKED carries its reason, because the
 * defect this whole product exists to find is a screen that reports silence as
 * agreement. Unknown is not zero. Not checked is not matched.
 */

// The SHAPE of an amount is the production shape, imported rather than copied:
// `exact` is a full-precision decimal string, `display` is the same number
// already rounded to cents. lib/api.ts's money() formats it for the screen.
// A second definition of Money would be a second answer to "how many cents is
// this", which is the one question this product may not have two answers to.
import type { Money } from "@/lib/api";

export type { Money };

/* -------------------------------------------------------------- provenance */

/** What kind of claim the screen is making by showing a figure. */
export type AmountOrigin = "RULE_DERIVED" | "PAYROLL_STATED" | "ILLUSTRATIVE";

/** A published rule, and where it was read. */
export type RuleReference = {
  authority: "MOM" | "CPF Board";
  /** The rule in the authority's own words, short enough to sit on a screen. */
  quote: string;
  page: string;
  url: string;
  /** When this project last read that page. Kept because a rule page moves. */
  verified: string;
};

/**
 * The engine behind a RULE_DERIVED figure.
 *
 * `inputs` is the provenance STRING of every fact the figure consumed - the same
 * idea as fairslip.rules.Component.inputs, which records source labels rather
 * than field names. It is what lets the inspector draw an edge from a source row
 * to an amount without anything on this side of the wire deciding what depends
 * on what.
 */
export type EngineNote = {
  /** Module and function in the production backend, e.g. "fairslip/rules.py rest_day_pay". */
  call: string;
  /** The engine's own formula string. */
  formula: string;
  /** Provenance labels of the facts consumed, in the order the engine took them. */
  inputs: string[];
  rule: RuleReference;
};

/** An amount, and what kind of claim showing it makes. */
export type ConceptAmount = {
  money: Money;
  origin: AmountOrigin;
  /** Present exactly when origin is RULE_DERIVED. Enforced by invariants.ts. */
  engine: EngineNote | null;
  /** Where a PAYROLL_STATED figure was read. Present exactly when it is one. */
  source: SourceRef | null;
  /** Why an ILLUSTRATIVE figure exists. Present exactly when it is one. */
  illustrativeNote: string | null;
};

/* ------------------------------------------------------------------ sources */

/**
 * The systems this concept reads FROM.
 *
 * EXPORTS, NOT APIs. Every one of these is a file somebody exported, because
 * that is the only integration a pilot can start with and the only one this
 * prototype could honestly draw. Nothing here is connected to anything.
 */
export type SourceSystem =
  | "PAYROLL_REGISTER"
  | "ATTENDANCE"
  | "LEAVE"
  | "HR_MASTER"
  | "CPF_SUBMISSION";

/** One row of one export. The unit of provenance on every screen. */
export type SourceRef = {
  system: SourceSystem;
  /** The export's filename, as it would arrive. */
  file: string;
  /** 1-indexed row within that file, or null where the fact is the file's absence. */
  row: number | null;
};

/** An export the concept was given, and what it contains. */
export type InputFile = {
  system: SourceSystem;
  label: string;
  file: string;
  rows: number;
  /** What this file is here to answer. */
  provides: string;
};

/* ------------------------------------------------------------------- events */

/** A workforce change that payroll is supposed to reflect. */
export type EventType =
  | "OVERTIME"
  | "REST_DAY_WORK"
  | "PAID_SICK_LEAVE"
  | "NO_PAY_LEAVE"
  | "JOINER"
  | "LEAVER"
  | "SALARY_CHANGE"
  | "ALLOWANCE_CHANGE"
  | "CPF_STATUS"
  | "SHIFT_CHANGE";

export const EVENT_TYPES: readonly EventType[] = [
  "OVERTIME",
  "REST_DAY_WORK",
  "PAID_SICK_LEAVE",
  "NO_PAY_LEAVE",
  "JOINER",
  "LEAVER",
  "SALARY_CHANGE",
  "ALLOWANCE_CHANGE",
  "CPF_STATUS",
  "SHIFT_CHANGE",
] as const;

/**
 * Whether the recorded change reached the payroll register at all.
 *
 * CONTRADICTED IS NOT ABSENT. A day approved as paid sick leave that the
 * register deducts as unpaid absence DID reach payroll; it reached it as
 * something else. Folding that into "absent" would lose the only fact that
 * makes it worth a person's time.
 */
export type ReachedPayroll = "PRESENT" | "CONTRADICTED" | "ABSENT" | "NOT_ESTABLISHED";

/** Whether the amount was checked against a published rule, and what came of it. */
export type AmountCheck = "MATCHED" | "DIFFERS" | "NOT_CHECKED";

export type ApprovalState = "APPROVED" | "PENDING" | "NOT_RECORDED";

/**
 * A possible future verification state for a medical certificate.
 *
 * FUTURE CONCEPT, AND NOTHING BEHIND IT. There is no verification service here,
 * no issuer registry, no image analysis and no score. The only thing this field
 * models is that a verification result WOULD have three outcomes, one of which
 * is "cannot be verified" - and that none of them is an accusation. FairSlip
 * does not decide whether a certificate is genuine and does not reject leave.
 */
export type McVerification = "VERIFIED" | "NEEDS_REVIEW" | "UNVERIFIABLE";

export type ConceptEvent = {
  event_id: string;
  employee_id: string;
  event_type: EventType;
  /** When it happened. */
  event_date: string;
  /** When it should affect pay. The two differ for a mid-month change. */
  effective_date: string;
  source: SourceRef;
  approval_state: ApprovalState;
  description: string;
  /** What the published rule gives for this event, where a rule pack covers it. */
  expected: ConceptAmount | null;
  /** What the payroll register states for it. */
  payroll: ConceptAmount | null;
  /** Engine-computed, never subtracted on this side of the wire. */
  difference: ConceptAmount | null;
  reached_payroll: ReachedPayroll;
  amount_check: AmountCheck;
  /**
   * What the check established, in one sentence, on every event without
   * exception.
   *
   * REQUIRED EVEN WHEN EVERYTHING MATCHED, because the interesting sentences
   * are the ones nobody would think to write: "the month's overtime line
   * matched the rule total; the individual entries were not priced separately",
   * or "the change appears on the register and the amount was not checked".
   * A status word alone cannot carry either of those, and a reader who is only
   * shown the word will read the second as the first.
   */
  check_note: string;
  /** The finding this event raised, if it raised one. */
  finding_id: string | null;
  /** Present on PAID_SICK_LEAVE events only, and marked "future concept" on screen. */
  mc_verification: McVerification | null;
};

/* ----------------------------------------------------------------- findings */

/** Which system's records the finding is about. The preview groups by this. */
export type FindingSource =
  | "ATTENDANCE"
  | "LEAVE"
  | "EMPLOYMENT_STATUS"
  | "PAYROLL_CONFIGURATION";

export const FINDING_SOURCES: readonly FindingSource[] = [
  "ATTENDANCE",
  "LEAVE",
  "EMPLOYMENT_STATUS",
  "PAYROLL_CONFIGURATION",
] as const;

/**
 * A change the concept would hand to a human, never act on.
 *
 * `difference` is nullable and its absence is load-bearing: seven of the eleven
 * findings in the fictional month have no computed difference, because no rule
 * pack covers the amount. Those findings are still findings - two records
 * disagree - and the screens must never roll them into a money total as zero.
 */
export type ConceptFinding = {
  finding_id: string;
  employee_id: string;
  event_ids: string[];
  source: FindingSource;
  /** One line. What does not reconcile. */
  headline: string;
  /** The paragraph under it. Never asserts a breach or a liability. */
  detail: string;
  expected: ConceptAmount | null;
  payroll: ConceptAmount | null;
  difference: ConceptAmount | null;
  /** Required whenever difference is null. Enforced by invariants.ts. */
  no_difference_reason: string | null;
  rule: RuleReference | null;
  /**
   * The intermediate figures the rule result was built from, in the order they
   * were built. An hourly rate before the overtime it prices; a daily rate
   * before the rest day.
   *
   * They are here because an operator's first question about a figure they did
   * not expect is "where does that come from", and the answer is usually one
   * step up rather than the formula string.
   */
  workings: { label: string; amount: ConceptAmount }[];
  /**
   * TWO RULE ANSWERS AND NO ESTABLISHED FACT TO CHOOSE BETWEEN THEM.
   *
   * MOM's rest-day table branches on who asked for the shift. Where no export
   * records that, the rule does not give one answer, it gives two, and a
   * product that showed one of them would be choosing on the employer's behalf
   * and calling it a rule. Both are shown; `difference` stays null.
   */
  alternatives: { label: string; amount: ConceptAmount }[];
  /** Where correcting a wage also moves the CPF on it, the decomposition that
   * keeps the two from being added together. */
  split: ShortfallSplit | null;
  /** A change to REVIEW in the payroll system. FairSlip never applies it. */
  proposed_correction: ProposedCorrection | null;
};

/**
 * A wage shortfall split into the two things it actually costs, without
 * counting either twice.
 *
 * THE RULE THIS EXISTS TO KEEP is .claude/rules/cpf-rules.md's: the gross
 * shortfall and the CPF shortfall OVERLAP by the employee's own CPF share, so
 * adding them double-counts it. Every field here is a field of
 * fairslip.cpf.ShortfallSplit, and the two identities that hold over them -
 * cash plus CPF is the total, and gross plus the employer's share is the same
 * total - are asserted in the concept's own suite as well as in the backend's.
 *
 * A screen may show these five figures and may not show any other combination
 * of them.
 */
export type ShortfallSplit = {
  gross: ConceptAmount;
  cash: ConceptAmount;
  cpf: ConceptAmount;
  employerShare: ConceptAmount;
  total: ConceptAmount;
  note: string;
};

export type ProposedCorrection = {
  /** The payroll line the change would land on. */
  line: string;
  from: ConceptAmount;
  to: ConceptAmount;
  /** What a reviewer should check before making it. */
  note: string;
};

/* ---------------------------------------------------------------- registers */

/** One line of a payroll register. Signed: a deduction is negative. */
export type RegisterLine = {
  key: string;
  label: string;
  amount: ConceptAmount;
  /**
   * The recorded changes this line answers to. Plural, and often empty: a
   * register carries one overtime line for a month that holds four separate
   * entries, and it carries a basic-salary line that answers to no workforce
   * change at all. A line with no event behind it is a normal thing and the
   * month-to-month view says so rather than hiding it.
   */
  event_ids: string[];
  /**
   * What a published rule gives for this line, where a rule pack covers it.
   *
   * IT SITS ON THE LINE AND NOT ON THE EVENT, because that is the level the
   * check actually runs at: a register carries one overtime line for a month
   * that holds four attendance rows, and MOM's rate applied to the month is
   * what can be compared with it. Hanging the month's figure on one of the four
   * rows would price that row at four rows' worth.
   *
   * STATED AS THE RULE STATES IT. A CPF contribution is a positive amount even
   * where the register shows it as a deduction, so `ruleNote` says which is
   * which rather than leaving a reader to reconcile two signs.
   */
  ruleFigure: ConceptAmount | null;
  /** Required whenever ruleFigure is present. Enforced by invariants.ts. */
  ruleNote: string | null;
};

/**
 * One month as the payroll system states it.
 *
 * EVERY FIGURE HERE IS PAYROLL_STATED. This is the file being checked, not the
 * answer. `net` is the register's own bottom line, and invariants.ts asserts the
 * lines sum to it - so the month-to-month bridge is arithmetic over a register
 * that adds up, rather than over a set of numbers that happen to be nearby.
 */
export type Register = {
  period: string;
  lines: RegisterLine[];
  net: ConceptAmount;
  source: SourceRef;
};

/* ---------------------------------------------------------------- employees */

export type PreflightStatus = "MATCHED" | "NEEDS_REVIEW" | "NOT_CHECKED";

export type EmploymentStatus = "ACTIVE" | "JOINED_THIS_MONTH" | "LEFT";

/**
 * The records behind one employee.
 *
 * ONLY SOME EMPLOYEES HAVE ONE, AND THE SCREEN SAYS SO. Writing three hundred
 * months of detail would mean fabricating three hundred months of detail; the
 * prototype carries it for the twenty employees the story visits and records
 * nothing behind the rest. The inspector states that plainly when you open one
 * of them, rather than showing a confident empty panel - which is the same rule
 * the product applies to a payroll file, applied to itself.
 */
export type EmployeeDetail = {
  events: ConceptEvent[];
  findings: ConceptFinding[];
  /** The month being checked. */
  current: Register;
  /** The month before it, where the export carries one. */
  previous: Register | null;
};

export type ConceptEmployee = {
  employee_id: string;
  name: string;
  role: string;
  location: string;
  department: string;
  employment_status: EmploymentStatus;
  start_date: string;
  end_date: string | null;
  basic_salary: ConceptAmount | null;
  preflight_status: PreflightStatus;
  /** Every employee has these. They are what the workforce-change strip counts. */
  event_counts: Partial<Record<EventType, number>>;
  /** Required whenever preflight_status is NOT_CHECKED. Enforced by invariants.ts. */
  not_checked_reason: string | null;
  detail: EmployeeDetail | null;
};

/* ------------------------------------------------------------------ recheck */

/**
 * What happened to one employee between the two runs.
 *
 * THE VOCABULARY IS THE PRODUCT'S OWN. These are members of
 * fairslip.employer.RecheckState, which already draws the distinctions that
 * matter: STILL_REFUSED is not STILL_MATCHED, because nothing was computed
 * either time; RESOLVED means the arithmetic closed and nothing else.
 */
export type RecheckRowState =
  | "STILL_MATCHED"
  | "RESOLVED"
  | "STILL_EXCEPTION"
  | "NEW_EXCEPTION"
  | "STILL_REFUSED";

export const RECHECK_ROW_STATES: readonly RecheckRowState[] = [
  "RESOLVED",
  "STILL_EXCEPTION",
  "NEW_EXCEPTION",
  "STILL_REFUSED",
  "STILL_MATCHED",
] as const;

export type RecheckRow = {
  employee_id: string;
  state: RecheckRowState;
  /** What the row was before the correction, in one line. */
  before: string;
  /** What it is after it. */
  after: string;
  /** The finding that stands after the correction, where one does. */
  finding: ConceptFinding | null;
};

export type RecheckConcept = {
  before_label: string;
  after_label: string;
  /** Every row whose state is not STILL_MATCHED. */
  rows: RecheckRow[];
  /** The rows not listed, all of them STILL_MATCHED. */
  still_matched: number;
  /** The sentence the screen leads with. Never a claim about money saved. */
  headline: string;
};

/* ---------------------------------------------------------------- scenarios */

export type Company = {
  name: string;
  what: string;
  headcount: number;
  locations: string[];
};

export type PayPeriod = {
  label: string;
  /** The fictional date the concept is being run on. Fixed, never Date.now(). */
  today: string;
  closes: string;
  payday: string;
};

export type ScenarioId = "needs-review" | "all-matched";

export type ConceptScenario = {
  id: ScenarioId;
  label: string;
  /** What this scenario is for, in one line, on screen. */
  note: string;
  company: Company;
  period: PayPeriod;
  inputs: InputFile[];
  employees: ConceptEmployee[];
  recheck: RecheckConcept | null;
};
