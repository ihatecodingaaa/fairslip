/**
 * The published rules this concept quotes, and where each one was read.
 *
 * NOTHING NEW IS ENCODED HERE. Every quote below is already carried by this
 * project's own rule files - .claude/rules/mom-pay-rules.md and
 * .claude/rules/cpf-rules.md - and every figure the concept calls rule-derived
 * comes from fairslip/rules.py or fairslip/cpf.py, which implement exactly
 * these. A product concept is the wrong place to widen a statutory rule pack:
 * the concept is about a WORKFLOW, and a rule shown wrongly at a payroll desk
 * is not recoverable by saying it was a prototype.
 *
 * THE VERIFICATION DATES ARE INHERITED, NOT CLAIMED. `verified` is the date the
 * production project last opened that page, as recorded in its rule files. This
 * concept did not re-open them. Anyone pitching from these screens should
 * re-read both pages first, which is what the production rule files already say
 * in capitals.
 */

import type { RuleReference } from "./types";

const MOM_HOURS =
  "https://www.mom.gov.sg/employment-practices/hours-of-work-overtime-and-rest-days";
const MOM_HOURS_PAGE = "Hours of work, overtime and rest day (Last Updated 24 July 2025)";
const MOM_VERIFIED = "6 September 2026";

const CPF_RATES =
  "https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay";
const CPF_RATES_PAGE = "How much CPF contributions to pay (Last updated 11 Aug 2026)";
const CPF_VERIFIED = "6 September 2026";

export const OVERTIME_RATE: RuleReference = {
  authority: "MOM",
  quote:
    "For overtime work, your employer must pay you at least 1.5 times the hourly " +
    "basic rate of pay. Payment must be made within 14 days after the last day of " +
    "the salary period.",
  page: MOM_HOURS_PAGE,
  url: MOM_HOURS,
  verified: MOM_VERIFIED,
};

export const HOURLY_BASIC_RATE: RuleReference = {
  authority: "MOM",
  quote: "(12 x Monthly basic rate of pay) / (52 x 44)",
  page: MOM_HOURS_PAGE,
  url: MOM_HOURS,
  verified: MOM_VERIFIED,
};

export const REST_DAY_TABLE: RuleReference = {
  authority: "MOM",
  quote:
    "Work done on a rest day, more than half your normal daily working hours: " +
    "2 days' salary at the employer's request, 1 day's salary at the employee's request.",
  page: MOM_HOURS_PAGE,
  url: MOM_HOURS,
  verified: MOM_VERIFIED,
};

export const OVERTIME_MONTHLY_CAP: RuleReference = {
  authority: "MOM",
  quote: "An employee can only work up to 72 overtime hours in a month.",
  page: MOM_HOURS_PAGE,
  url: MOM_HOURS,
  verified: MOM_VERIFIED,
};

export const CPF_RATE_TABLE: RuleReference = {
  authority: "CPF Board",
  quote:
    "From 1 January 2026, monthly wages above $750, Singapore Citizens and PRs " +
    "from the 3rd year: 55 and below, 17% employer and 20% employee. " +
    "Above 55 to 60, 16% and 18%.",
  page: CPF_RATES_PAGE,
  url: CPF_RATES,
  verified: CPF_VERIFIED,
};

export const CPF_AGE_STEP_UP: RuleReference = {
  authority: "CPF Board",
  quote:
    "New contribution rates apply from the first day of the month after the " +
    "employee's 55th, 60th, 65th or 70th birthday.",
  page: CPF_RATES_PAGE,
  url: CPF_RATES,
  verified: CPF_VERIFIED,
};

export const CPF_OW_CEILING: RuleReference = {
  authority: "CPF Board",
  quote: "The Ordinary Wage ceiling is $8,000 per month from 1 January 2026.",
  page: CPF_RATES_PAGE,
  url: CPF_RATES,
  verified: CPF_VERIFIED,
};

/** Why an overtime shortfall is also a CPF shortfall. The concept's recheck
 * turns on this one: correcting a wage moves the Ordinary Wage, and the CPF on
 * it has to move with it. */
export const CPF_OVERTIME_IS_ORDINARY_WAGE: RuleReference = {
  authority: "CPF Board",
  quote: "CPF contributions are payable on overtime pay given to your employee.",
  page: CPF_RATES_PAGE,
  url: CPF_RATES,
  verified: CPF_VERIFIED,
};
