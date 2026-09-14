# FairSlip Preflight: a future product concept

**This is not FairSlip.** It is a drawing of what FairSlip could become, built so that a payroll
or HR operator can be shown a workflow and argue with it.

Route: `/concept/preflight`, on the branch `concept/payroll-preflight` only.

## What it is, in one paragraph

HR software records what happened at work: leave, overtime, rest-day shifts, joiners, leavers,
a change of contribution band. Payroll software calculates what gets paid. Nothing independent
checks that the first became the second. This concept draws that check: it reads exports from
the systems a company already runs, reconstructs what MOM's and CPF Board's published rules give
for the changes those exports record, compares that with what the payroll register states, and
hands the differences to a person. It never writes to a payroll system.

## What is true of it, stated plainly

- **It is a concept, not a product decision.** Nothing here has been validated with a customer.
  The strategic thesis behind it - that the valuable place to stand is between the systems of
  record and payroll, rather than beside either of them - is a hypothesis. These screens exist
  to get that hypothesis argued with, not to announce it.
- **The company is fictional.** Harbour and Hearth Group Pte. Ltd. does not exist. Its three
  hundred employees, their names, roles, sites, salaries, payroll registers and CPF submission
  are all invented. No identifier here is shaped like an NRIC or a FIN; employees are EMP-0001
  through EMP-0300. No real worker's document or record appears anywhere.
- **Nothing is connected.** There is no HR integration, no payroll integration, no CPF
  connection, no bank, no database, no authentication and no server-side state. The route is a
  static page with a deterministic fixture compiled into it.
- **A model is called by one button, and by nothing else.** This paragraph used to say "no
  model is called", and that stopped being true when the FairSlip Brief was added. What is true
  now is narrower and is the part that matters: every number, status, count and order on these
  screens is produced by code before any model is asked anything, and the Brief runs afterwards
  over the result. It supplies sentences and finding identifiers. It supplies no figure - the
  tools hand it directions and ranks rather than amounts, and an answer that states an amount is
  refused and never drawn. Turn it off and the product loses no claim it makes. Nothing calls a
  model on page load; a person presses "Brief me".
- **Nothing is written anywhere.** No database, no local storage, no telemetry, no state on any
  server. The concept makes exactly two network calls and only when asked: the browser to this
  app's own `/api/concept/preflight/copilot`, and that route to the provider. A test names those
  two destinations and fails on a third. The "Prepare correction" action opens a panel describing
  a change and changes nothing; the payroll-system button is disabled and says why.
- **Production is untouched.** `/`, `/check`, `/employer` and `/scale` are unchanged, and none of
  them links here. A test asserts that.
- **The model cannot decide anything.** It has seven read-only tools and no write tool of any
  kind. It cannot change a status, an amount, a count, a rule reference or the order the findings
  are worked in - that order is `lib/concept-preflight/priority.ts`, which is code and is tested.
  Every identifier it returns is checked against the fixture before a screen draws it, and an
  answer naming a finding that does not exist is refused whole rather than rendered with a gap.

## What the numbers are

Every amount on these screens is one of two things, and the type system keeps them apart:

| Origin | What it means | Where it came from |
|---|---|---|
| **Rule-derived** | FairSlip computed it from a published rule | `fairslip/rules.py` or `fairslip/cpf.py`, run offline against the inputs recorded beside it |
| **Payroll-stated** | The fictional payroll register states it | Invented, on purpose. It is an INPUT to a check, never the output of one |

There is a third possibility in the model, an **illustrative** value belonging to no rule and no
record, and the concept currently uses none. If one is ever added it is labelled as such on the
screen, and a test asserts the count so that the label cannot be forgotten.

The rule-derived figures cannot drift. `backend/tests/test_concept_preflight.py` holds the same
inputs, calls the same production engines, and asserts that every figure in
`frontend/lib/concept-preflight/ruleDerived.ts` matches - in its exact decimal, its cents, the
engine that produced it and that engine's own formula string. It also asserts the key sets match
in **both** directions, so a figure labelled rule-derived with nothing behind the label fails the
build.

## What it deliberately does NOT compute

FairSlip's rule packs encode Employment Act overtime and rest-day pay for monthly-rated
employees, and CPF contributions for Citizens and PRs from the third year on Ordinary Wages
above $750. They do not encode paid sick leave, no-pay-leave pro-ration, joiner and leaver
pro-ration, allowance rules, public holidays, Additional Wages, graduated PR rates, wages at or
below $750, or daily-rated workers.

So the concept does not compute those either. Seven of its eleven findings carry **no money
amount at all**, and seven of its three hundred rows were **not checked**. Both are drawn, both
are counted separately, and neither is ever folded into a total as zero. A concept branch that
quietly widened a statutory rule pack to make a screen look complete would be doing the exact
thing this product exists to catch.

## How to run it

```
cd frontend && npm run dev        # then open /concept/preflight
cd frontend && npm run test:concept
cd backend && .venv/Scripts/python.exe -m pytest tests/test_concept_preflight.py -q
```

The backend test runs the concept's own suite as a subprocess, so the project gate covers both.

## Where the code is

```
frontend/app/concept/preflight/      the screens
frontend/lib/concept-preflight/      the data, the selectors and the invariants
  types.ts          the model, including the three amount origins
  ruleSources.ts    the published rules quoted, with the page and the date they were read
  ruleDerived.ts    every rule-derived figure, with the engine and formula behind it
  people.ts         the twenty employees the story visits, in full
  fixtures.ts       the company, the month, and the other 280 rows
  selectors.ts      every count and total the screens draw
  invariants.ts     what has to be true of the fixture before anything draws it
  decimal.ts        exact decimal arithmetic for aggregates, and nothing else
  fixture.test.ts   the suite
backend/tests/test_concept_preflight.py   the cross-the-wire checks
docs-concept/FairSlip_Preflight_Demo.md   the talk track
```

Only twenty of the three hundred employees carry detailed records. The other two hundred and
eighty have a status and a count of recorded changes and nothing behind them, and the inspector
says so when you open one of them rather than showing a confident empty panel.

## The verification dates are inherited, not claimed

The MOM and CPF Board quotes carry the dates the **production** project last read those pages
(6 September 2026). This concept did not re-open them. Anyone pitching from these screens should
re-read both pages first, which is what the production rule files already say in capitals.

## What this is for

Showing it to someone who runs payroll, and asking them which part of it is wrong. The questions
worth asking are at the end of `FairSlip_Preflight_Demo.md`.
