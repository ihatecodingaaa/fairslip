/**
 * Every figure in this concept that a screen is allowed to call RULE-DERIVED.
 *
 * WHERE THESE DIGITS CAME FROM. Each one was produced by running the production
 * engines - fairslip/rules.py and fairslip/cpf.py - against the inputs recorded
 * beside it, and pasting the result here. `exact` is the engine's own Decimal
 * and `formula` is the engine's own formula string, not a restatement of it.
 *
 * WHY THEY CANNOT DRIFT. backend/tests/test_concept_preflight.py holds the same
 * inputs, calls the same engines, and asserts that every entry below matches -
 * AND that the set of keys in this file is exactly the set the test covers. So
 * a hand-edited digit fails the suite, and a new rule-derived figure added here
 * without a test fails it too. That is the difference between a prototype whose
 * numbers are checkable and one whose numbers are typed.
 *
 * WHAT IS DELIBERATELY NOT HERE. Sick-leave pay, no-pay-leave pro-ration,
 * joiner and leaver pro-ration, allowance rules, public holidays, daily-rated
 * workers. FairSlip's rule packs do not encode those, so this concept has no
 * figure for them and says NOT CHECKED where one would sit. Adding them here
 * would be a product concept quietly widening a statutory rule pack, which is
 * the one thing a concept branch must not do.
 *
 * A NOTE ON THE LONG TAILS. MOM's hourly rate is (12 x basic) / (52 x 44), which
 * is a repeating decimal for almost every wage. The engines keep full precision
 * internally and round once for display, so `exact` runs to twenty-five
 * significant digits and `display` is the cents. Both travel, because the
 * rounding is a display decision and the reader is entitled to see what was
 * rounded.
 */

import type { ConceptAmount, Money, RuleReference } from "./types";
import {
  CPF_AGE_STEP_UP,
  CPF_OVERTIME_IS_ORDINARY_WAGE,
  CPF_OW_CEILING,
  CPF_RATE_TABLE,
  HOURLY_BASIC_RATE,
  OVERTIME_MONTHLY_CAP,
  OVERTIME_RATE,
  REST_DAY_TABLE,
} from "./ruleSources";

type RuleDerivedEntry = {
  money: Money;
  /** Module and function in the production backend that produced it. */
  call: string;
  /** The engine's own formula string. */
  formula: string;
  /** Provenance labels of the facts consumed. Source strings, never field names:
   * a map from field names to amounts would be a second answer to what depends
   * on what. See backend/tests/test_provenance.py. */
  inputs: string[];
  rule: RuleReference;
};

/* Provenance labels, written once. A label is a SENTENCE about where a fact was
   read, which is what an operator needs to go and look at it. */
const MASTER = (who: string, what: string) => `Employee master, ${who}: ${what}`;
const ATTENDANCE = (row: number, what: string) => `Attendance export row ${row}: ${what}`;
const REGISTER = (row: number, what: string) => `Payroll register row ${row}: ${what}`;
const SUBMISSION = (row: number, what: string) => `CPF submission draft row ${row}: ${what}`;

const TABLE = {
  /* ------------------------------------------------ EMP-0127 Mei Ling Tan */
  "meiling.hourly": {
    money: { exact: "11.01398601398601398601398601", display: "11.01" },
    call: "fairslip/rules.py hourly_basic_rate",
    formula: "(12 x 2100.00) / (52 x 44)",
    inputs: [MASTER("EMP-0127", "monthly basic salary 2,100.00")],
    rule: HOURLY_BASIC_RATE,
  },
  "meiling.daily": {
    money: { exact: "80.76923076923076923076923077", display: "80.77" },
    call: "fairslip/rules.py daily_rate",
    formula: "(12 x 2100.00) / (52 x 6)",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      MASTER("EMP-0127", "6-day working week"),
    ],
    rule: REST_DAY_TABLE,
  },
  "meiling.restday.expected": {
    money: { exact: "161.5384615384615384615384615", display: "161.54" },
    call: "fairslip/rules.py rest_day_pay",
    formula: "rest-day table, employer's request, 8h of 8h, 6-day week",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      MASTER("EMP-0127", "6-day working week"),
      ATTENDANCE(427, "8.0 hours on a scheduled rest day, 14 September"),
      ATTENDANCE(427, "shift raised by the duty manager"),
      MASTER("EMP-0127", "normal daily hours 8"),
    ],
    rule: REST_DAY_TABLE,
  },
  "meiling.restday.difference": {
    money: { exact: "80.7684615384615384615384615", display: "80.77" },
    call: "fairslip/rules.py rest_day_pay",
    formula: "rest-day table less the 80.77 the register states",
    inputs: [
      ATTENDANCE(427, "8.0 hours on a scheduled rest day, 14 September"),
      REGISTER(118, "rest-day premium 80.77"),
    ],
    rule: REST_DAY_TABLE,
  },
  "meiling.ot.03sep": {
    money: { exact: "33.04195804195804195804195804", display: "33.04" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(11.0140/h) x 1.5 x 2.0h",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      ATTENDANCE(381, "2.0 overtime hours, 3 September"),
    ],
    rule: OVERTIME_RATE,
  },
  "meiling.ot.05sep": {
    money: { exact: "33.04195804195804195804195804", display: "33.04" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(11.0140/h) x 1.5 x 2.0h",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      ATTENDANCE(396, "2.0 overtime hours, 5 September"),
    ],
    rule: OVERTIME_RATE,
  },
  "meiling.ot.11sep": {
    money: { exact: "24.78146853146853146853146853", display: "24.78" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(11.0140/h) x 1.5 x 1.5h",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      ATTENDANCE(412, "1.5 overtime hours, 11 September"),
    ],
    rule: OVERTIME_RATE,
  },
  "meiling.ot.24sep": {
    money: { exact: "41.30244755244755244755244755", display: "41.30" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(11.0140/h) x 1.5 x 2.5h",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      ATTENDANCE(455, "2.5 overtime hours, 24 September"),
    ],
    rule: OVERTIME_RATE,
  },
  "meiling.ot.sep": {
    money: { exact: "132.1678321678321678321678322", display: "132.17" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(11.0140/h) x 1.5 x 8.0h",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      ATTENDANCE(381, "8.0 overtime hours across four September entries"),
    ],
    rule: OVERTIME_RATE,
  },
  "meiling.ot.aug": {
    money: { exact: "99.12587412587412587412587412", display: "99.13" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(11.0140/h) x 1.5 x 6.0h",
    inputs: [
      MASTER("EMP-0127", "monthly basic salary 2,100.00"),
      ATTENDANCE(203, "6.0 overtime hours across three August entries"),
    ],
    rule: OVERTIME_RATE,
  },
  "meiling.cpf.employee.aug": {
    money: { exact: "447", display: "447.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 37% x 2239.13 -> nearest $; employee = 20% x 2239.13 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      REGISTER(96, "August Ordinary Wages 2,239.13"),
      MASTER("EMP-0127", "age band 55 and below"),
      MASTER("EMP-0127", "Singapore Citizen"),
    ],
    rule: CPF_RATE_TABLE,
  },
  "meiling.cpf.employee.sep": {
    money: { exact: "426", display: "426.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 37% x 2130.63 -> nearest $; employee = 20% x 2130.63 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      REGISTER(118, "September Ordinary Wages 2,130.63"),
      MASTER("EMP-0127", "age band 55 and below"),
      MASTER("EMP-0127", "Singapore Citizen"),
    ],
    rule: CPF_RATE_TABLE,
  },
  "meiling.cpf.recheck.total": {
    money: { exact: "30", display: "30.00" },
    call: "fairslip/cpf.py cpf_shortfall",
    formula: "CPF on the corrected Ordinary Wage 2211.40 less CPF on the 2130.63 the register used",
    inputs: [
      REGISTER(118, "corrected September Ordinary Wages 2,211.40"),
      SUBMISSION(118, "September Ordinary Wages 2,130.63"),
      MASTER("EMP-0127", "age band 55 and below"),
    ],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },
  "meiling.cpf.recheck.employee": {
    money: { exact: "16", display: "16.00" },
    call: "fairslip/cpf.py cpf_shortfall",
    formula: "CPF on the corrected Ordinary Wage 2211.40 less CPF on the 2130.63 the register used",
    inputs: [
      REGISTER(118, "corrected September Ordinary Wages 2,211.40"),
      SUBMISSION(118, "September Ordinary Wages 2,130.63"),
    ],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },
  "meiling.cpf.recheck.employer": {
    money: { exact: "14", display: "14.00" },
    call: "fairslip/cpf.py cpf_shortfall",
    formula: "CPF on the corrected Ordinary Wage 2211.40 less CPF on the 2130.63 the register used",
    inputs: [
      REGISTER(118, "corrected September Ordinary Wages 2,211.40"),
      SUBMISSION(118, "September Ordinary Wages 2,130.63"),
    ],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },
  /* The decomposition that stops two figures being added together. See
     .claude/rules/cpf-rules.md: the wage shortfall and the CPF shortfall
     OVERLAP by the employee's own share, and adding them double-counts it. */
  "meiling.split.gross": {
    money: { exact: "80.77", display: "80.77" },
    call: "fairslip/cpf.py shortfall_split",
    formula: "shortfall_split on Ordinary Wages 2130.63 and 2211.40, age band 55 and below, Citizen",
    inputs: [REGISTER(118, "rest-day premium short by 80.77")],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },
  "meiling.split.cash": {
    money: { exact: "64.77", display: "64.77" },
    call: "fairslip/cpf.py shortfall_split",
    formula: "shortfall_split on Ordinary Wages 2130.63 and 2211.40, age band 55 and below, Citizen",
    inputs: [REGISTER(118, "rest-day premium short by 80.77")],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },
  "meiling.split.cpf": {
    money: { exact: "30", display: "30.00" },
    call: "fairslip/cpf.py shortfall_split",
    formula: "shortfall_split on Ordinary Wages 2130.63 and 2211.40, age band 55 and below, Citizen",
    inputs: [REGISTER(118, "rest-day premium short by 80.77")],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },
  "meiling.split.employerShare": {
    money: { exact: "14", display: "14.00" },
    call: "fairslip/cpf.py shortfall_split",
    formula: "shortfall_split on Ordinary Wages 2130.63 and 2211.40, age band 55 and below, Citizen",
    inputs: [REGISTER(118, "rest-day premium short by 80.77")],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },
  "meiling.split.total": {
    money: { exact: "94.77", display: "94.77" },
    call: "fairslip/cpf.py shortfall_split",
    formula: "shortfall_split on Ordinary Wages 2130.63 and 2211.40, age band 55 and below, Citizen",
    inputs: [REGISTER(118, "rest-day premium short by 80.77")],
    rule: CPF_OVERTIME_IS_ORDINARY_WAGE,
  },

  /* --------------------------------------- EMP-0203 Siti Rahmah binte Osman */
  "siti.ot.expected": {
    money: { exact: "209.2657342657342657342657343", display: "209.27" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(9.9650/h) x 1.5 x 14.0h",
    inputs: [
      MASTER("EMP-0203", "monthly basic salary 1,900.00"),
      ATTENDANCE(512, "14.0 overtime hours across six September entries"),
    ],
    rule: OVERTIME_RATE,
  },
  "siti.ot.paidBasis": {
    money: { exact: "134.5279720279720279720279720", display: "134.53" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(9.9650/h) x 1.5 x 9.0h",
    inputs: [
      MASTER("EMP-0203", "monthly basic salary 1,900.00"),
      REGISTER(191, "overtime paid on 9.0 hours"),
    ],
    rule: OVERTIME_RATE,
  },
  "siti.ot.difference": {
    money: { exact: "74.7357342657342657342657343", display: "74.74" },
    call: "fairslip/rules.py overtime_pay",
    formula: "overtime on 14.0h less the 134.53 the register states",
    inputs: [
      ATTENDANCE(512, "14.0 overtime hours across six September entries"),
      REGISTER(191, "overtime 134.53"),
    ],
    rule: OVERTIME_RATE,
  },

  /* ---------------------------------------------- EMP-0241 Ravi s/o Muthu */
  "ravi.ot.expected": {
    money: { exact: "1472.727272727272727272727273", display: "1472.73" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(12.5874/h) x 1.5 x 78h",
    inputs: [
      MASTER("EMP-0241", "monthly basic salary 2,400.00"),
      ATTENDANCE(604, "78.0 overtime hours across the month"),
    ],
    rule: OVERTIME_MONTHLY_CAP,
  },

  /* ----------------------------------------------- EMP-0058 Jonathan Goh */
  "jonathan.restday.employer": {
    money: { exact: "169.2307692307692307692307692", display: "169.23" },
    call: "fairslip/rules.py rest_day_pay",
    formula: "rest-day table, employer's request, 7h of 8h, 6-day week",
    inputs: [
      MASTER("EMP-0058", "monthly basic salary 2,200.00"),
      MASTER("EMP-0058", "6-day working week"),
      ATTENDANCE(478, "7.0 hours on a scheduled rest day, 7 September"),
    ],
    rule: REST_DAY_TABLE,
  },
  "jonathan.restday.employee": {
    money: { exact: "84.61538461538461538461538462", display: "84.62" },
    call: "fairslip/rules.py rest_day_pay",
    formula: "rest-day table, employee's request, 7h of 8h, 6-day week",
    inputs: [
      MASTER("EMP-0058", "monthly basic salary 2,200.00"),
      MASTER("EMP-0058", "6-day working week"),
      ATTENDANCE(478, "7.0 hours on a scheduled rest day, 7 September"),
    ],
    rule: REST_DAY_TABLE,
  },

  /* ----------------------------------------------- EMP-0173 Boon Keng Teo */
  "boonkeng.cpf.total": {
    money: { exact: "1428", display: "1428.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 34% x 4200.00 -> nearest $; employee = 18% x 4200.00 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      SUBMISSION(160, "Ordinary Wages 4,200.00"),
      MASTER("EMP-0173", "date of birth gives the band Above 55 to 60 for September"),
      MASTER("EMP-0173", "Singapore Citizen"),
    ],
    rule: CPF_AGE_STEP_UP,
  },
  "boonkeng.cpf.employee": {
    money: { exact: "756", display: "756.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 34% x 4200.00 -> nearest $; employee = 18% x 4200.00 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      SUBMISSION(160, "Ordinary Wages 4,200.00"),
      MASTER("EMP-0173", "date of birth gives the band Above 55 to 60 for September"),
    ],
    rule: CPF_AGE_STEP_UP,
  },
  "boonkeng.cpf.employer": {
    money: { exact: "672", display: "672.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 34% x 4200.00 -> nearest $; employee = 18% x 4200.00 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      SUBMISSION(160, "Ordinary Wages 4,200.00"),
      MASTER("EMP-0173", "date of birth gives the band Above 55 to 60 for September"),
    ],
    rule: CPF_AGE_STEP_UP,
  },
  "boonkeng.cpf.difference": {
    money: { exact: "-126", display: "-126.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula: "CPF at the band the employee master gives, less the 1554 the submission states",
    inputs: [
      SUBMISSION(160, "total contribution 1,554.00"),
      MASTER("EMP-0173", "date of birth gives the band Above 55 to 60 for September"),
    ],
    rule: CPF_AGE_STEP_UP,
  },

  /* --------------------------------------------- EMP-0231 Grace Fernandez */
  "grace.cpf.total": {
    money: { exact: "2960", display: "2960.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 37% x 8000 -> nearest $; employee = 20% x 8000 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      SUBMISSION(214, "Ordinary Wages 9,400.00"),
      MASTER("EMP-0231", "age band 55 and below"),
    ],
    rule: CPF_OW_CEILING,
  },
  "grace.cpf.employee": {
    money: { exact: "1600", display: "1600.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 37% x 8000 -> nearest $; employee = 20% x 8000 -> cents dropped; " +
      "employer = total - employee",
    inputs: [SUBMISSION(214, "Ordinary Wages 9,400.00")],
    rule: CPF_OW_CEILING,
  },
  "grace.cpf.employer": {
    money: { exact: "1360", display: "1360.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 37% x 8000 -> nearest $; employee = 20% x 8000 -> cents dropped; " +
      "employer = total - employee",
    inputs: [SUBMISSION(214, "Ordinary Wages 9,400.00")],
    rule: CPF_OW_CEILING,
  },
  "grace.cpf.difference": {
    money: { exact: "-518", display: "-518.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula: "CPF on the capped Ordinary Wage, less the 3478 the submission states",
    inputs: [
      SUBMISSION(214, "total contribution 3,478.00"),
      SUBMISSION(214, "Ordinary Wages 9,400.00"),
    ],
    rule: CPF_OW_CEILING,
  },

  /* --------------------------------------------- EMP-0007 Hui Ling Tan */
  "huiling.restday.expected": {
    money: { exact: "120.00", display: "120.00" },
    call: "fairslip/rules.py rest_day_pay",
    formula: "rest-day table, employee's request, 5h of 8h, 5-day week",
    inputs: [
      MASTER("EMP-0007", "monthly basic salary 2,600.00"),
      MASTER("EMP-0007", "5-day working week"),
      ATTENDANCE(102, "5.0 hours on a scheduled rest day, 6 September, swapped at the employee's request"),
    ],
    rule: REST_DAY_TABLE,
  },
  "huiling.restday.difference": {
    money: { exact: "-120.00", display: "-120.00" },
    call: "fairslip/rules.py rest_day_pay",
    formula: "rest-day table less the 240.00 the corrected register states",
    inputs: [
      ATTENDANCE(102, "5.0 hours on a scheduled rest day, 6 September, swapped at the employee's request"),
      REGISTER(6, "rest-day premium 240.00 in the corrected file"),
    ],
    rule: REST_DAY_TABLE,
  },
  "huiling.ot.sep": {
    money: { exact: "81.81818181818181818181818184", display: "81.82" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(13.6364/h) x 1.5 x 4.0h",
    inputs: [
      MASTER("EMP-0007", "monthly basic salary 2,600.00"),
      ATTENDANCE(98, "4.0 overtime hours across two September entries"),
    ],
    rule: OVERTIME_RATE,
  },
  "huiling.cpf.employee": {
    money: { exact: "560", display: "560.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 37% x 2801.82 -> nearest $; employee = 20% x 2801.82 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      REGISTER(6, "September Ordinary Wages 2,801.82"),
      MASTER("EMP-0007", "age band 55 and below"),
    ],
    rule: CPF_RATE_TABLE,
  },

  /* ------------------------------------------ EMP-0083 Ahmad bin Rahman */
  "ahmad.ot.sep": {
    money: { exact: "264.3356643356643356643356645", display: "264.34" },
    call: "fairslip/rules.py overtime_pay",
    formula: "(14.6853/h) x 1.5 x 12.0h",
    inputs: [
      MASTER("EMP-0083", "monthly basic salary 2,800.00"),
      ATTENDANCE(144, "12.0 overtime hours across five September entries"),
    ],
    rule: OVERTIME_RATE,
  },
  "ahmad.cpf.employee": {
    money: { exact: "612", display: "612.00" },
    call: "fairslip/cpf.py cpf_contribution",
    formula:
      "total = 37% x 3064.34 -> nearest $; employee = 20% x 3064.34 -> cents dropped; " +
      "employer = total - employee",
    inputs: [
      REGISTER(71, "September Ordinary Wages 3,064.34"),
      MASTER("EMP-0083", "age band 55 and below"),
    ],
    rule: CPF_RATE_TABLE,
  },
} satisfies Record<string, RuleDerivedEntry>;

/** The handle a screen uses to reach one of these. Literal-typed, so a mistyped
 * key does not compile rather than rendering nothing. */
export type RuleKey = keyof typeof TABLE;

export const RULE_DERIVED: Record<RuleKey, RuleDerivedEntry> = TABLE;

/** Every key, for the checks that have to reason over the whole table: the one
 * that finds a rule-derived figure nothing draws, and the backend test that
 * asserts this file and the engines still agree. */
export const RULE_KEYS: RuleKey[] = Object.keys(TABLE) as RuleKey[];

/* Built once at module load, not per render: a ConceptAmount is a value, and a
   fresh object on every render would defeat every memo downstream of it. */
const AMOUNTS = new Map<RuleKey, ConceptAmount>(
  (Object.keys(TABLE) as RuleKey[]).map((key) => {
    const entry = TABLE[key];
    return [
      key,
      {
        money: entry.money,
        origin: "RULE_DERIVED",
        engine: {
          call: entry.call,
          formula: entry.formula,
          inputs: entry.inputs,
          rule: entry.rule,
        },
        source: null,
        illustrativeNote: null,
      },
    ];
  }),
);

/** One rule-derived amount, as a ConceptAmount the screens can draw. */
export function ruleAmount(key: RuleKey): ConceptAmount {
  const found = AMOUNTS.get(key);
  if (!found) throw new Error(`no rule-derived amount for ${key}`);
  return found;
}
