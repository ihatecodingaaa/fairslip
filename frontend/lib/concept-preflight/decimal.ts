/**
 * Exact decimal arithmetic for the concept's AGGREGATES, and for nothing else.
 *
 * WHAT THIS IS ALLOWED TO DO, AND WHAT IT IS NOT.
 *
 * It may ADD UP figures the fixture already states, and round the sum once for
 * display. That is aggregation: "these four findings carry $155.50 between
 * them" is a fact about a list, not a fact about MOM's or CPF Board's rules.
 *
 * It may NOT produce a rule result. Every rule-derived figure in this concept
 * was produced by fairslip/rules.py or fairslip/cpf.py, offline, and is checked
 * against those engines in backend/tests/test_concept_preflight.py. Nothing here
 * multiplies a wage by a rate, applies a ceiling, or prices a rest day. The
 * governing rule of this project is that code calculates and there is one place
 * it does so; a second implementation in TypeScript would be a second answer.
 *
 * WHY NOT JUST USE NUMBERS. Because 0.1 + 0.2 is not 0.3, and because the
 * engines hand over decimals like "161.5384615384615384615384615" - twenty-five
 * significant digits, well past what a double holds. Parsing those to float and
 * adding them would silently lose the tail, and the identities this concept
 * asserts (the bridge lines sum to the change in net; the findings sum to the
 * money under review) would hold only approximately. An identity that holds
 * approximately is not an identity.
 *
 * So: parse to a scaled BigInt, align scales, add exactly, round once.
 *
 * ROUNDING IS ROUND_HALF_UP ON THE MAGNITUDE, which is what
 * fairslip.rules.to_cents does - Python's Decimal ROUND_HALF_UP rounds half
 * AWAY FROM ZERO, so -0.005 goes to -0.01 and not to -0.00. JavaScript's
 * Math.round does the opposite on negatives, which is exactly the kind of
 * difference that shows up as one cent, once, in a figure nobody re-checks.
 *
 * BIGINT WITHOUT BIGINT LITERALS. This package targets ES2017, where `0n` does
 * not compile; the constructor is what is available and the constants below are
 * built once rather than at every call site. Changing the target to reach
 * nicer syntax would change what the production bundle emits, which a concept
 * branch has no business doing.
 */

import type { Money } from "@/lib/api";

const ZERO_UNITS = BigInt(0);
const ONE_UNIT = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);

/** A decimal held exactly: value = units / 10^scale. */
type Exact = { units: bigint; scale: number };

const DECIMAL = /^[+-]?\d+(?:\.\d+)?$/;

function parse(text: string): Exact {
  const s = text.trim();
  if (!DECIMAL.test(s)) {
    // A value that is not a number has not been established as one. Refusing is
    // the same choice fairslip.rules._require_decimal makes, for the same
    // reason: a figure the code cannot read is not a figure it may approximate.
    throw new Error(`not a decimal: ${text}`);
  }
  const negative = s.startsWith("-");
  const body = s.replace(/^[+-]/, "");
  const [whole, fraction = ""] = body.split(".");
  const units = BigInt(whole + fraction);
  return { units: negative ? -units : units, scale: fraction.length };
}

function align(a: Exact, b: Exact): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  const lift = (x: Exact) => x.units * TEN ** BigInt(scale - x.scale);
  return [lift(a), lift(b), scale];
}

function render(x: Exact): string {
  const negative = x.units < ZERO_UNITS;
  const digits = (negative ? -x.units : x.units).toString().padStart(x.scale + 1, "0");
  const whole = digits.slice(0, digits.length - x.scale);
  const fraction = x.scale > 0 ? `.${digits.slice(digits.length - x.scale)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/**
 * Cents, rounded half away from zero. The twin of fairslip.rules.to_cents.
 *
 * `+ 0` on the Python side collapses a negative zero, because a residue of
 * -0.004 renders as "-0.00" and reads as a real negative amount beside a
 * verdict that says nothing is owed. The same collapse happens here, in the
 * `=== ZERO_UNITS` branch.
 */
function toCents(x: Exact): string {
  const negative = x.units < ZERO_UNITS;
  const magnitude = negative ? -x.units : x.units;
  let cents: bigint;
  if (x.scale <= 2) {
    cents = magnitude * TEN ** BigInt(2 - x.scale);
  } else {
    const divisor = TEN ** BigInt(x.scale - 2);
    const whole = magnitude / divisor;
    const remainder = magnitude % divisor;
    cents = remainder * TWO >= divisor ? whole + ONE_UNIT : whole;
  }
  if (cents === ZERO_UNITS) return "0.00";
  const digits = cents.toString().padStart(3, "0");
  const body = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
  return negative ? `-${body}` : body;
}

/** A Money built from an exact decimal, rounded once for the screen. */
function moneyOf(x: Exact): Money {
  return { exact: render(x), display: toCents(x) };
}

/** Zero, as a Money. The only literal amount this module produces. */
export const ZERO: Money = { exact: "0", display: "0.00" };

/**
 * The exact sum of a list of amounts, rounded once at the end.
 *
 * An empty list sums to zero, and that is a statement about the list rather
 * than about anyone's pay: callers that would otherwise display it must check
 * the list was not empty for a reason - see selectors.ts, which reports the
 * COUNT of findings carrying no amount separately rather than adding them in.
 */
export function sum(amounts: readonly Money[]): Money {
  let total: Exact = { units: ZERO_UNITS, scale: 0 };
  for (const m of amounts) {
    const [a, b, scale] = align(total, parse(m.exact));
    total = { units: a + b, scale };
  }
  return moneyOf(total);
}

/** `a - b`, exactly. Used on register lines, which are cent figures a payroll
 * system stated - never on two rule results. */
export function subtract(a: Money, b: Money): Money {
  const [x, y, scale] = align(parse(a.exact), parse(b.exact));
  return moneyOf({ units: x - y, scale });
}

/** The magnitude of an amount, for a total that must not net two directions
 * against each other. See selectors.ts: money below the rule and money above it
 * are reported separately and never added. */
export function magnitude(m: Money): Money {
  const x = parse(m.exact);
  return moneyOf({ units: x.units < ZERO_UNITS ? -x.units : x.units, scale: x.scale });
}

/** -1, 0 or 1. Reads the exact value, so a sub-cent residue is not called zero. */
export function signOf(m: Money): -1 | 0 | 1 {
  const x = parse(m.exact);
  return x.units < ZERO_UNITS ? -1 : x.units > ZERO_UNITS ? 1 : 0;
}

/** True when two amounts are the same to the cent. Cent-level on purpose: it is
 * asked of a payroll line, and a payroll line is paid in cents. */
export function sameToTheCent(a: Money, b: Money): boolean {
  return toCents(parse(a.exact)) === toCents(parse(b.exact));
}

/**
 * Which of two amounts is larger, exactly. -1, 0 or 1, in Array.sort's own
 * vocabulary.
 *
 * ORDERING IS NOT A FIGURE. This decides which row of a list comes first; it
 * never reaches a text position, and nothing it returns is rendered. That is
 * the same line decimal.ts already draws for aggregation, and the same one
 * WhatChanged.tsx draws when it turns a delta into a bar length.
 *
 * IT IS EXACT, AND THAT MATTERS HERE. The two rest-day differences in this
 * fixture agree to seven decimal places before they part. Comparing them as
 * doubles would order them on a tail a double does not hold, which is a
 * different list on a different machine.
 */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  const [x, y] = align(parse(a.exact), parse(b.exact));
  return x < y ? -1 : x > y ? 1 : 0;
}
