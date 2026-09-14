/**
 * The order of the work, checked by running it.
 *
 * HOW TO RUN IT:  cd frontend && npm run test:concept
 * The gate runs it too, through backend/tests/test_concept_preflight.py.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM fixture.test.ts. That suite asserts that
 * the numbers on the screens are counted rather than written down. This one
 * asserts the thing the Payroll Brief is not allowed to do: decide which of
 * three hundred people gets looked at before payroll closes. Every assertion
 * below is a property of `actionQueue`, so if a model ever started influencing
 * that order these would be the tests that went red.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { compare, magnitude } from "./decimal";
import { SCENARIOS } from "./fixtures";
import {
  actionQueue,
  matchesSearch,
  readyPercent,
  topOfQueue,
  workforceGroups,
} from "./priority";
import { allFindings, moneyUnderReview, statusCounts } from "./selectors";
import type { ConceptEmployee } from "./types";

const september = SCENARIOS["needs-review"];
const october = SCENARIOS["all-matched"];
const PEOPLE = september.employees;

const DEFAULTS = { grouping: "location" as const, sort: "attention" as const, filter: "all" as const, search: "" };

/* ------------------------------------------------------------- the queue */

test("the queue holds every row that is not matched, and only those", () => {
  const queue = actionQueue(PEOPLE);
  const counts = statusCounts(PEOPLE);

  // One row per finding, plus one per uncheckable employee. Derived from the
  // data on both sides rather than compared with a number written here.
  const findings = PEOPLE.flatMap((e) => e.detail?.findings ?? []).length;
  const unchecked = PEOPLE.filter((e) => e.preflight_status === "NOT_CHECKED").length;
  assert.equal(queue.length, findings + unchecked);
  assert.equal(unchecked, counts.notChecked);

  for (const item of queue) {
    assert.notEqual(
      item.employee.preflight_status,
      "MATCHED",
      `${item.employee.employee_id} matched and is in the queue anyway`,
    );
  }
});

test("a matched employee never reaches the queue, however many changes they hold", () => {
  const matched = PEOPLE.filter((e) => e.preflight_status === "MATCHED");
  assert.ok(matched.length > 250, "the fixture should be mostly matched, or this proves nothing");
  const ids = new Set(actionQueue(PEOPLE).map((i) => i.employee.employee_id));
  for (const e of matched) assert.ok(!ids.has(e.employee_id));
});

test("the four tiers come out in order, and every row carries one", () => {
  const tiers = actionQueue(PEOPLE).map((i) => i.tier);
  assert.deepEqual([...tiers].sort((a, b) => a - b), tiers, "the tiers are not monotonic");
  for (const tier of tiers) assert.ok([1, 2, 3, 4].includes(tier));
});

test("tier one is ordered by the size of the difference, largest first", () => {
  const tier1 = actionQueue(PEOPLE).filter((i) => i.tier === 1);
  assert.ok(tier1.length >= 2, "fewer than two computed differences; the ordering is untested");

  for (let i = 1; i < tier1.length; i += 1) {
    const previous = tier1[i - 1].finding?.difference;
    const current = tier1[i].finding?.difference;
    assert.ok(previous && current, "a tier-one row with no difference");
    // Compared EXACTLY, on magnitudes: the two rest-day differences in this
    // fixture agree to seven decimal places before they part.
    assert.ok(
      compare(magnitude(previous.money), magnitude(current.money)) >= 0,
      `${tier1[i - 1].finding?.finding_id} should not come before ${tier1[i].finding?.finding_id}`,
    );
  }
});

test("a row about who was employed outranks a finding with no amount", () => {
  const queue = actionQueue(PEOPLE);
  const lifecycle = queue.filter((i) => i.finding?.source === "EMPLOYMENT_STATUS");
  assert.ok(lifecycle.length > 0, "no employment-record findings; this rule is untested");

  for (const row of lifecycle) {
    // Only the ones with no computed amount: a lifecycle finding that DID carry
    // one belongs in tier 1, and the tier function says so.
    if (row.finding?.difference) continue;
    assert.equal(row.tier, 2, `${row.finding?.finding_id} is not in the employment-record tier`);
  }

  const firstUnpriced = queue.findIndex((i) => i.tier === 3);
  const lastLifecycle = queue.map((i) => i.tier).lastIndexOf(2);
  assert.ok(lastLifecycle < firstUnpriced, "an unpriced finding comes before an employment record");
});

test("a row nothing was computed for is last, and is still in the queue", () => {
  const queue = actionQueue(PEOPLE);
  const unchecked = queue.filter((i) => i.status === "NOT_CHECKED");
  assert.ok(unchecked.length > 0, "no uncheckable rows; the whole point of tier four is untested");
  for (const row of unchecked) assert.equal(row.tier, 4);

  const lastOther = queue.map((i) => i.tier).findIndex((t) => t === 4);
  assert.equal(
    lastOther + unchecked.length,
    queue.length,
    "the uncheckable rows are not the tail of the queue",
  );
});

test("ties break on employee id, so the queue is the same list twice", () => {
  const once = actionQueue(PEOPLE).map((i) => i.employee.employee_id);
  // Sorting a shuffled copy must reach the same answer: a comparator that fell
  // back to engine sort stability would not.
  const shuffled = [...PEOPLE].reverse();
  const twice = actionQueue(shuffled).map((i) => i.employee.employee_id);
  assert.deepEqual(twice, once);

  for (const tier of [2, 3, 4]) {
    const ids = actionQueue(PEOPLE)
      .filter((i) => i.tier === tier)
      .map((i) => i.employee.employee_id);
    assert.deepEqual([...ids].sort(), ids, `tier ${tier} is not in employee-id order`);
  }
});

test("the top of the queue is a prefix of the queue, not a different list", () => {
  const queue = actionQueue(PEOPLE);
  for (const n of [1, 3, 5]) {
    const top = topOfQueue(PEOPLE, n);
    assert.equal(top.length, Math.min(n, queue.length));
    top.forEach((item, i) => {
      assert.equal(item.employee.employee_id, queue[i].employee.employee_id);
      assert.equal(item.finding?.finding_id, queue[i].finding?.finding_id);
    });
  }
});

test("every queue row says what it is about, and never leaves it blank", () => {
  for (const item of actionQueue(PEOPLE)) {
    assert.ok(item.subject.trim().length > 0, `${item.employee.employee_id} has no subject`);
  }
});

test("a row with no computed difference is never given one", () => {
  for (const item of actionQueue(PEOPLE)) {
    if (item.tier === 1) assert.ok(item.finding?.difference, "tier one without a difference");
    else assert.ok(!item.finding?.difference, `${item.subject} is priced and not in tier one`);
  }
});

/* ------------------------------------------------------------ the map */

test("grouping by location accounts for every employee exactly once", () => {
  const groups = workforceGroups(PEOPLE, DEFAULTS);
  const total = groups.reduce((n, g) => n + g.total, 0);
  assert.equal(total, PEOPLE.length);

  const seen = new Set<string>();
  for (const group of groups) {
    for (const e of group.employees) {
      assert.ok(!seen.has(e.employee_id), `${e.employee_id} is in two groups`);
      seen.add(e.employee_id);
    }
  }
  assert.equal(seen.size, PEOPLE.length);
});

test("grouping by department accounts for every employee exactly once", () => {
  const groups = workforceGroups(PEOPLE, { ...DEFAULTS, grouping: "department" });
  assert.equal(groups.reduce((n, g) => n + g.total, 0), PEOPLE.length);
  assert.ok(groups.length >= 2, "one department is not a grouping");
});

test("a group's counts are of the group, and a filter does not move them", () => {
  const all = workforceGroups(PEOPLE, DEFAULTS);
  const filtered = workforceGroups(PEOPLE, { ...DEFAULTS, filter: "review" });
  const byKey = new Map(filtered.map((g) => [g.key, g]));

  for (const group of all) {
    const same = byKey.get(group.key);
    assert.ok(same, `${group.key} disappeared under a filter`);
    // THE HEADING DESCRIBES THE SITE, NOT THE FILTER. This is the assertion
    // that stops a heading reading "0 review" while three are hidden.
    assert.equal(same.total, group.total, `${group.key}'s headcount moved`);
    assert.equal(same.needsReview, group.needsReview, `${group.key}'s review count moved`);
    assert.equal(same.notChecked, group.notChecked, `${group.key}'s unchecked count moved`);
    // What DID change is how many marks are drawn.
    assert.equal(same.employees.length, group.needsReview);
  }
});

test("the group counts add up to the workforce totals", () => {
  const groups = workforceGroups(PEOPLE, DEFAULTS);
  const counts = statusCounts(PEOPLE);
  assert.equal(groups.reduce((n, g) => n + g.needsReview, 0), counts.needsReview);
  assert.equal(groups.reduce((n, g) => n + g.notChecked, 0), counts.notChecked);
});

test("groups are ordered by where the attention is", () => {
  const groups = workforceGroups(PEOPLE, DEFAULTS);
  const weight = groups.map((g) => g.needsReview + g.notChecked);
  assert.deepEqual([...weight].sort((a, b) => b - a), weight, "a quieter site is drawn first");
});

test("every filter returns exactly the rows it names", () => {
  const cases = [
    ["review", "NEEDS_REVIEW"],
    ["unchecked", "NOT_CHECKED"],
    ["matched", "MATCHED"],
  ] as const;
  for (const [filter, status] of cases) {
    const groups = workforceGroups(PEOPLE, { ...DEFAULTS, filter });
    const shown = groups.flatMap((g) => g.employees);
    assert.equal(shown.length, statusCounts(PEOPLE)[
      status === "NEEDS_REVIEW" ? "needsReview" : status === "NOT_CHECKED" ? "notChecked" : "matched"
    ]);
    for (const e of shown) assert.equal(e.preflight_status, status);
  }
});

test("sorting by attention puts the rows needing a person first inside each group", () => {
  const groups = workforceGroups(PEOPLE, { ...DEFAULTS, sort: "attention" });
  const rank = { NEEDS_REVIEW: 0, NOT_CHECKED: 1, MATCHED: 2 };
  for (const group of groups) {
    const order = group.employees.map((e) => rank[e.preflight_status]);
    assert.deepEqual([...order].sort((a, b) => a - b), order, `${group.key} is out of order`);
  }
});

test("sorting by id is file order, inside each group", () => {
  for (const group of workforceGroups(PEOPLE, { ...DEFAULTS, sort: "id" })) {
    const ids = group.employees.map((e) => e.employee_id);
    assert.deepEqual([...ids].sort(), ids);
  }
});

test("search finds a person by name and by identifier, and is not case-sensitive", () => {
  const hero = PEOPLE.find((e) => e.employee_id === "EMP-0127") as ConceptEmployee;
  assert.ok(hero);
  assert.ok(matchesSearch(hero, hero.name));
  assert.ok(matchesSearch(hero, hero.name.toUpperCase()));
  assert.ok(matchesSearch(hero, "emp-0127"));
  assert.ok(matchesSearch(hero, "0127"));
  assert.ok(!matchesSearch(hero, "EMP-0128"));
  // An empty query hides nobody.
  assert.ok(matchesSearch(hero, "   "));
});

test("a search that matches nobody empties the map without losing the headings", () => {
  const groups = workforceGroups(PEOPLE, { ...DEFAULTS, search: "zzzzzz" });
  assert.equal(groups.reduce((n, g) => n + g.employees.length, 0), 0);
  assert.equal(groups.reduce((n, g) => n + g.total, 0), PEOPLE.length);
});

/* ------------------------------------------------------- the readiness */

test("readiness is floored, so it never rounds up into readiness nobody has", () => {
  assert.equal(readyPercent(282, 300), 94);
  // 299/300 is 99.67%, and reporting it as 100% would be the one rounding that
  // says a payroll with an open finding is clear.
  assert.equal(readyPercent(299, 300), 99);
  assert.equal(readyPercent(300, 300), 100);
  assert.equal(readyPercent(0, 300), 0);
  assert.equal(readyPercent(1, 0), 0, "an empty workforce is not 100% ready");
});

test("readiness is a proportion of everyone, not of the rows that were checked", () => {
  const counts = statusCounts(PEOPLE);
  const percent = readyPercent(counts.matched, counts.total);
  const ofChecked = readyPercent(counts.matched, counts.checked);
  assert.ok(
    percent < ofChecked,
    "dividing by the rows that were checked would hide the ones that were not",
  );
});

/* ---------------------------------------------------------- clean month */

test("a month with no findings has no money total, in either direction", () => {
  // THE EMPTY SUM IS ZERO AND THE SCREEN MAY NOT DRAW IT. "$0.00 below the
  // published rules" says FairSlip priced something and found nothing; the
  // truth is that there was nothing to price. The overview checks the COUNTS
  // before it draws either figure, and this is the assertion that keeps the
  // counts able to carry that decision.
  const under = moneyUnderReview(allFindings(october.employees));
  assert.equal(under.belowCount, 0);
  assert.equal(under.aboveCount, 0);
  assert.equal(under.withoutComputedDifference, 0);
  // The sums themselves ARE zero, which is why the counts and not the sums are
  // what the screen branches on.
  assert.equal(under.below.display, "0.00");
  assert.equal(under.above.display, "0.00");

  // And the month with findings has counts that let it draw them.
  const september_ = moneyUnderReview(allFindings(PEOPLE));
  assert.ok(september_.belowCount > 0 && september_.aboveCount > 0);
});

test("the clean month has nothing to work, and is still three hundred people", () => {
  assert.equal(actionQueue(october.employees).length, 0);
  assert.equal(topOfQueue(october.employees, 3).length, 0);
  const groups = workforceGroups(october.employees, DEFAULTS);
  assert.equal(groups.reduce((n, g) => n + g.total, 0), october.employees.length);
  assert.equal(groups.reduce((n, g) => n + g.needsReview + g.notChecked, 0), 0);
  assert.equal(readyPercent(statusCounts(october.employees).matched, october.employees.length), 100);
});
