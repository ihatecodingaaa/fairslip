/**
 * The concept's fixture, checked by running it.
 *
 * HOW TO RUN IT:  cd frontend && npm run test:concept
 * The gate runs it too, through backend/tests/test_concept_preflight.py, which
 * shells out to this runner so that a red invariant stops a turn rather than
 * waiting for someone to remember.
 *
 * NO TEST RUNNER WAS INSTALLED FOR THIS. Node's own `node --test` executes
 * TypeScript directly on this version, so the concept adds a test suite and
 * zero dependencies. The repo's existing convention - cross-the-wire checks in
 * the Python suite, because "the frontend has no test runner" - still holds for
 * everything that needs the engines; what is here is the half that needs to
 * EXECUTE the selectors rather than read them.
 *
 * WHAT THESE ASSERT, in one line: that every number the screens show is a
 * number counted from the data, and that the two directions of money are never
 * netted against each other or quietly topped up with rows nobody checked.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { sum, subtract, magnitude, signOf, ZERO } from "./decimal";
import { SCENARIOS, SCENARIO_IDS } from "./fixtures";
import { illustrativeAmounts, unusedRuleDerived, violationsIn } from "./invariants";
import { RULE_KEYS, ruleAmount } from "./ruleDerived";
import {
  allFindings,
  bridgeFor,
  eventStatus,
  employeeById,
  moneyUnderReview,
  needsAttention,
  overviewOf,
  recheckCounts,
  recheckRowsToShow,
  statusCounts,
  workforceChanges,
} from "./selectors";

const september = SCENARIOS["needs-review"];
const october = SCENARIOS["all-matched"];

/* ------------------------------------------------------------- arithmetic */

test("decimal addition is exact past what a double holds", () => {
  // The two engine tails below differ in the 25th significant digit. A float
  // sum loses both and reports a round number, which is the failure this
  // module exists to prevent.
  const a = { exact: "80.7684615384615384615384615", display: "80.77" };
  const b = { exact: "74.7357342657342657342657343", display: "74.74" };
  const total = sum([a, b]);
  assert.equal(total.exact, "155.5041958041958041958041958");
  assert.equal(total.display, "155.50");
});

test("cents round half away from zero, in both directions", () => {
  // fairslip.rules.to_cents uses Decimal ROUND_HALF_UP, which rounds half away
  // from zero. Math.round would send -0.005 to -0.00 and disagree by a cent.
  assert.equal(sum([{ exact: "0.005", display: "0.01" }]).display, "0.01");
  assert.equal(sum([{ exact: "-0.005", display: "-0.01" }]).display, "-0.01");
  assert.equal(sum([{ exact: "2.675", display: "2.68" }]).display, "2.68");
});

test("a sub-cent residue is not reported as zero", () => {
  const residue = { exact: "0.004", display: "0.00" };
  assert.equal(residue.display, "0.00");
  assert.equal(signOf(residue), 1, "the sign must be read from the exact value");
});

test("a negative zero is collapsed for display and kept in the exact value", () => {
  const m = subtract({ exact: "1.000", display: "1.00" }, { exact: "1.004", display: "1.00" });
  assert.equal(m.display, "0.00", "-0.004 must not render as -0.00");
  assert.equal(m.exact, "-0.004");
});

test("an empty sum is zero, and the callers that would show it check first", () => {
  assert.equal(sum([]).display, "0.00");
  assert.equal(ZERO.display, "0.00");
  assert.equal(magnitude({ exact: "-644", display: "-644.00" }).display, "644.00");
});

/* ------------------------------------------------------------- invariants */

for (const id of SCENARIO_IDS) {
  test(`the ${id} fixture holds every invariant`, () => {
    const problems = violationsIn(SCENARIOS[id]);
    assert.deepEqual(problems, [], problems.join("\n"));
  });
}

test("no rule-derived figure sits in the table with nothing drawing it", () => {
  const unused = unusedRuleDerived(SCENARIO_IDS.map((id) => SCENARIOS[id]));
  assert.deepEqual(
    unused,
    [],
    `these carry an engine behind them and reach no screen: ${unused.join(", ")}`,
  );
});

test("every rule-derived amount names an engine and a published rule", () => {
  assert.ok(RULE_KEYS.length >= 30, `only ${RULE_KEYS.length} keys; the table shrank`);
  for (const key of RULE_KEYS) {
    const a = ruleAmount(key);
    assert.equal(a.origin, "RULE_DERIVED", key);
    assert.ok(a.engine, key);
    assert.match(a.engine.call, /^fairslip\/(rules|cpf)\.py \w+$/, `${key}: ${a.engine.call}`);
    assert.ok(a.engine.formula.length > 8, `${key} has no formula`);
    assert.ok(a.engine.inputs.length > 0, `${key} records no inputs`);
    assert.ok(a.engine.rule.url.startsWith("https://"), `${key} has no rule page`);
    assert.equal(a.source, null, `${key} is a rule result and must not claim a file row`);
  }
});

test("nothing in the concept is an illustrative value, and the type can still express one", () => {
  // If this ever fails, the figure it names has to be LABELLED on screen as an
  // illustrative concept value. It must never be shown as rule-derived.
  const illustrative = illustrativeAmounts(SCENARIO_IDS.map((id) => SCENARIOS[id]));
  assert.deepEqual(
    illustrative.map((a) => a.money.display),
    [],
  );
});

/* --------------------------------------------------------------- overview */

test("the three statuses account for every row, and for exactly the headcount", () => {
  const s = statusCounts(september.employees);
  assert.equal(s.total, 300);
  assert.equal(s.matched, 282);
  assert.equal(s.needsReview, 11);
  assert.equal(s.notChecked, 7);
  assert.equal(s.matched + s.needsReview + s.notChecked, s.total);
  assert.equal(s.checked, 293, "the headline is a claim about the rows that were checked");
});

test("the workforce strip counts records the file actually holds", () => {
  const c = workforceChanges(september.employees);
  assert.equal(c.byType.OVERTIME, 76);
  assert.equal(c.byType.REST_DAY_WORK, 11);
  assert.equal(c.byType.PAID_SICK_LEAVE, 18);
  assert.equal(c.byType.NO_PAY_LEAVE, 25);
  assert.equal(c.byType.JOINER, 8);
  assert.equal(c.byType.LEAVER, 4);
  assert.equal(c.total, 165);
  // Grouped by the export each kind is recorded in, and the groups partition
  // the whole rather than sampling it.
  assert.equal(
    c.groups.reduce((n, g) => n + g.total, 0),
    c.total,
  );
});

test("a joiner in the strip is an employee whose record says they joined", () => {
  const joiners = september.employees.filter((e) => (e.event_counts.JOINER ?? 0) > 0);
  assert.equal(joiners.length, 8);
  for (const e of joiners) {
    assert.equal(e.employment_status, "JOINED_THIS_MONTH", e.employee_id);
  }
  const leavers = september.employees.filter((e) => (e.event_counts.LEAVER ?? 0) > 0);
  assert.equal(leavers.length, 4);
  for (const e of leavers) assert.equal(e.employment_status, "LEFT", e.employee_id);
});

test("the by-source preview adds up to the findings, and to nothing else", () => {
  const findings = allFindings(september.employees);
  assert.equal(findings.length, 11);
  const { bySource } = overviewOf(september);
  assert.deepEqual(
    bySource.map((r) => [r.source, r.count]),
    [
      ["ATTENDANCE", 4],
      ["LEAVE", 3],
      ["EMPLOYMENT_STATUS", 2],
      ["PAYROLL_CONFIGURATION", 2],
    ],
  );
  assert.equal(
    bySource.reduce((n, r) => n + r.count, 0),
    findings.length,
  );
});

/* ------------------------------------------------------------------ money */

test("money under review sums only findings that carry an amount", () => {
  const findings = allFindings(september.employees);
  const m = moneyUnderReview(findings);

  assert.equal(m.belowCount, 2);
  assert.equal(m.aboveCount, 2);
  assert.equal(m.withoutComputedDifference, 7);
  assert.equal(
    m.belowCount + m.aboveCount + m.withoutComputedDifference,
    findings.length,
    "every finding is in exactly one of the three buckets",
  );

  // Recomputed here from the findings themselves rather than read back from the
  // same selector: the point is that the figure is a sum of these two and of
  // nothing else.
  const below = findings
    .filter((f) => f.difference && signOf(f.difference.money) >= 0)
    .map((f) => f.difference!.money);
  assert.equal(m.below.display, sum(below).display);
  assert.equal(m.below.display, "155.50");
  assert.equal(m.above.display, "644.00");
});

test("a finding with no computed difference contributes nothing, not zero", () => {
  const findings = allFindings(september.employees);
  const withAmount = findings.filter((f) => f.difference);
  const without = findings.filter((f) => !f.difference);
  assert.equal(without.length, 7);
  // Dropping the seven changes neither total. If they were being counted as
  // zero the counts would move and the totals would not, which is the tell.
  const all = moneyUnderReview(findings);
  const only = moneyUnderReview(withAmount);
  assert.equal(all.below.display, only.below.display);
  assert.equal(all.above.display, only.above.display);
  assert.equal(only.withoutComputedDifference, 0);
  assert.equal(all.withoutComputedDifference, 7);
});

test("the two directions are never netted against each other", () => {
  const m = moneyUnderReview(allFindings(september.employees));
  // 644.00 - 155.50 is 488.50 and means nothing. Neither figure may be it.
  assert.notEqual(m.below.display, "488.50");
  assert.notEqual(m.above.display, "488.50");
  assert.ok(signOf(m.above) >= 0, "the above-the-rule figure is reported as a magnitude");
});

test("every finding with no difference says why it has none", () => {
  for (const f of allFindings(september.employees)) {
    if (f.difference) continue;
    assert.ok(
      f.no_difference_reason && f.no_difference_reason.length > 40,
      `${f.finding_id} carries no amount and no explanation of that`,
    );
  }
});

/* ------------------------------------------------------------ event status */

test("an event needing review is one that raised a finding", () => {
  const meiling = employeeById(september.employees, "EMP-0127");
  assert.ok(meiling?.detail);
  const byId = Object.fromEntries(meiling.detail.events.map((e) => [e.event_id, eventStatus(e)]));
  assert.equal(byId["EVT-0127-01"], "MATCHED");
  assert.equal(byId["EVT-0127-05"], "NEEDS_REVIEW", "the rest-day shift");
  assert.equal(byId["EVT-0127-06"], "NOT_CHECKED", "the medical certificate");
  assert.equal(byId["EVT-0127-08"], "NOT_CHECKED", "the allowance change");
});

test("a change that reached payroll and was not priced is not reported as matched", () => {
  // The distinction the whole concept turns on: present is not checked.
  for (const e of september.employees) {
    for (const ev of e.detail?.events ?? []) {
      if (ev.amount_check === "NOT_CHECKED") {
        assert.notEqual(
          eventStatus(ev),
          "MATCHED",
          `${ev.event_id} was never priced and is reported as matched`,
        );
      }
    }
  }
});

test("the medical certificate state is a future concept and only appears on sick leave", () => {
  const withMc = september.employees
    .flatMap((e) => e.detail?.events ?? [])
    .filter((e) => e.mc_verification !== null);
  assert.equal(withMc.length, 2);
  for (const e of withMc) assert.equal(e.event_type, "PAID_SICK_LEAVE");
  // No probability, no score, no accusation: three states and nothing else.
  for (const e of withMc) {
    assert.ok(["VERIFIED", "NEEDS_REVIEW", "UNVERIFIABLE"].includes(e.mc_verification!));
  }
});

/* ----------------------------------------------------------- what changed */

test("the month-to-month lines sum exactly to the change in net pay", () => {
  const meiling = employeeById(september.employees, "EMP-0127");
  const bridge = bridgeFor(meiling!);
  assert.ok(bridge);
  assert.equal(bridge.difference.display, "-87.50");
  assert.equal(sum(bridge.lines.map((l) => l.delta)).display, bridge.difference.display);
  assert.equal(
    sum(bridge.lines.map((l) => l.delta)).exact,
    subtract(bridge.current.net.money, bridge.previous.net.money).exact,
    "exactly, not to the cent",
  );
});

test("a line present in only one month is named, not silently zeroed", () => {
  const boonkeng = employeeById(september.employees, "EMP-0173");
  const bridge = bridgeFor(boonkeng!);
  assert.ok(bridge);
  const standby = bridge.lines.find((l) => l.key === "standbyAllowance");
  assert.ok(standby, "the allowance that stopped is still a line of the comparison");
  assert.equal(standby.presence, "PREVIOUS_ONLY");
  assert.equal(standby.delta.display, "-120.00");
  assert.equal(sum(bridge.lines.map((l) => l.delta)).display, bridge.difference.display);
});

test("every employee carrying a prior month balances, and the rest say they have none", () => {
  let compared = 0;
  for (const e of september.employees) {
    const bridge = bridgeFor(e);
    if (!bridge) {
      assert.equal(e.detail?.previous ?? null, null, `${e.employee_id}`);
      continue;
    }
    compared += 1;
    assert.equal(
      sum(bridge.lines.map((l) => l.delta)).display,
      bridge.difference.display,
      e.employee_id,
    );
  }
  assert.equal(compared, 4, "the prototype carries a prior month for four employees");
});

test("a bridge line's mark is the outcome of a comparison, not the presence of a rule", () => {
  // The rest-day line has a rule figure AND does not agree with it. Drawing the
  // matched shape against it - which an earlier version did for any line that
  // had a rule beside it - would put the "this reconciles" glyph on the one row
  // in the month that does not.
  const meiling = employeeById(september.employees, "EMP-0127");
  const bridge = bridgeFor(meiling!)!;
  const byKey = Object.fromEntries(bridge.lines.map((l) => [l.key, l.ruleComparison]));
  assert.equal(byKey.restDayPremium, "DIFFERS", "the register states 80.77, the rule gives 161.54");
  assert.equal(byKey.overtimePay, "AGREES");
  assert.equal(byKey.basicSalary, "NOT_CHECKED");
  // Magnitudes, so a contribution the register shows as a deduction still
  // agrees with the rate CPF Board publishes.
  assert.equal(byKey.cpfEmployee, "AGREES");
});

test("every bridge line that differs from its rule belongs to an employee with a finding", () => {
  for (const e of september.employees) {
    const bridge = bridgeFor(e);
    if (!bridge) continue;
    const differs = bridge.lines.filter((l) => l.ruleComparison === "DIFFERS");
    if (differs.length === 0) continue;
    assert.ok(
      (e.detail?.findings.length ?? 0) > 0,
      `${e.employee_id} has a line that differs from a published rule and no finding`,
    );
  }
});

test("a line the rule packs do not cover is reported as unchecked, not as agreeing", () => {
  const meiling = employeeById(september.employees, "EMP-0127");
  const bridge = bridgeFor(meiling!)!;
  const npl = bridge.lines.find((l) => l.key === "noPayLeave")!;
  assert.equal(npl.ruleFigure, null);
  assert.equal(npl.ruleNote, null);
  assert.equal(npl.ruleComparison, "NOT_CHECKED");
  assert.equal(bridge.checkedAgainstARule, 3, "overtime, the rest day and the CPF share");
  assert.equal(bridge.checkedAgainstARule + bridge.notCheckedAgainstARule, bridge.lines.length);
});

/* ---------------------------------------------------------------- recheck */

test("the second run accounts for every row of the first", () => {
  const recheck = september.recheck!;
  const c = recheckCounts(recheck);
  assert.equal(c.total, 300);
  assert.equal(c.byState.RESOLVED, 9);
  assert.equal(c.byState.STILL_EXCEPTION, 2);
  assert.equal(c.byState.NEW_EXCEPTION, 1);
  assert.equal(c.byState.STILL_REFUSED, 7);
  assert.equal(c.byState.STILL_MATCHED, 281);
});

test("eleven findings before, three after, and the arithmetic joins the two", () => {
  const before = statusCounts(september.employees);
  const c = recheckCounts(september.recheck!);
  assert.equal(before.needsReview, 11);
  assert.equal(c.byState.RESOLVED + c.byState.STILL_EXCEPTION, before.needsReview);
  assert.equal(c.afterNeedsReview, 3);
  assert.equal(c.afterMatched, 290);
  assert.equal(c.afterNotChecked, 7);
  assert.equal(c.afterMatched + c.afterNeedsReview + c.afterNotChecked, 300);
  // The one that matters: a row that matched before and does not now.
  assert.equal(before.matched - c.byState.NEW_EXCEPTION + c.byState.RESOLVED, c.afterMatched);
});

test("a row nobody could check is still not checked, and is not called matched", () => {
  const rows = september.recheck!.rows.filter((r) => r.state === "STILL_REFUSED");
  assert.equal(rows.length, 7);
  for (const r of rows) {
    const e = employeeById(september.employees, r.employee_id);
    assert.equal(e?.preflight_status, "NOT_CHECKED", r.employee_id);
    assert.match(r.after, /not checked/i);
  }
});

test("the new finding is drawn first and carries its own rule result", () => {
  const shown = recheckRowsToShow(september.recheck!);
  assert.equal(shown[0].state, "NEW_EXCEPTION");
  assert.equal(shown[0].employee_id, "EMP-0007");
  const finding = shown[0].finding!;
  assert.equal(finding.difference!.origin, "RULE_DERIVED");
  assert.equal(finding.difference!.money.display, "-120.00");
});

test("the correction that moved a wage also moved the CPF on it", () => {
  const row = september.recheck!.rows.find((r) => r.employee_id === "EMP-0127")!;
  assert.equal(row.state, "STILL_EXCEPTION", "corrected, and different for a second reason");
  assert.equal(row.finding!.difference!.money.display, "30.00");
  // The decomposition that stops the wage and the CPF being added together.
  const gross = ruleAmount("meiling.split.gross").money;
  const cash = ruleAmount("meiling.split.cash").money;
  const cpf = ruleAmount("meiling.split.cpf").money;
  const employer = ruleAmount("meiling.split.employerShare").money;
  const total = ruleAmount("meiling.split.total").money;
  assert.equal(sum([cash, cpf]).display, total.display, "cash + cpf == total");
  assert.equal(sum([gross, employer]).display, total.display, "gross + employer share == total");
  assert.notEqual(total.display, sum([gross, cpf]).display, "and never gross + cpf");
});

/* ------------------------------------------------------- the clean scenario */

test("the clean scenario is clean, and still a scenario of three hundred", () => {
  const s = statusCounts(october.employees);
  assert.equal(s.total, 300);
  assert.equal(s.matched, 300);
  assert.equal(s.needsReview, 0);
  assert.equal(s.notChecked, 0);
  assert.equal(s.checked, 300);
  assert.equal(allFindings(october.employees).length, 0);
  const m = moneyUnderReview(allFindings(october.employees));
  assert.equal(m.below.display, "0.00");
  assert.equal(m.above.display, "0.00");
  assert.equal(m.withoutComputedDifference, 0);
  assert.equal(needsAttention(october.employees).length, 0);
  assert.equal(october.recheck, null, "there is nothing to correct, so there is no second run");
});

test("switching scenarios changes the data and nothing about the other one", () => {
  const a = statusCounts(SCENARIOS["needs-review"].employees);
  const b = statusCounts(SCENARIOS["all-matched"].employees);
  assert.notEqual(a.needsReview, b.needsReview);
  // Read again: a selector must not have mutated the fixture on the way past.
  assert.deepEqual(statusCounts(SCENARIOS["needs-review"].employees), a);
});

/* ---------------------------------------------------------- determinism */

test("the generated workforce is the same file every time", () => {
  const ids = september.employees.map((e) => e.employee_id);
  assert.equal(new Set(ids).size, 300, "every identifier is unique");
  assert.equal(ids[0], "EMP-0001");
  assert.equal(ids[299], "EMP-0300");
  // File order is identifier order, so a mark's position in the grid is a fact
  // about the file rather than about the order the fixture was written in.
  assert.deepEqual(ids, [...ids].sort((x, y) => x.localeCompare(y)));
});

test("no identifier in the fixture is shaped like a Singapore NRIC or FIN", () => {
  const nric = /\b[STFGM]\d{7}[A-Z]\b/;
  const text = JSON.stringify(SCENARIO_IDS.map((id) => SCENARIOS[id]));
  const found = text.match(nric);
  assert.equal(found, null, `an identifier looks like an NRIC or FIN: ${found?.[0]}`);
});
