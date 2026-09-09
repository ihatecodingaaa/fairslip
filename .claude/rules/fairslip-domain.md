# FairSlip domain contract (v2: reconcile, then follow through)

## The pipeline, and what may cross each boundary

    photo / screenshot
          |
    [Reader A: Claude Vision]   [Reader B: second vendor's vision model, called directly]
          +-------- reconcile (pure code) --------+
                       |
        Fact(value, status, source) per field   status: AGREED | DISAGREED | MISSING
                       |
        worker confirms DISAGREED / MISSING  ->  HUMAN_CONFIRMED
                       |
        rules.compute_expected()   refuses anything not ESTABLISHED  (Employment Act pack)
        cpf.cpf_shortfall()        same inputs, second rule pack     (CPF pack)
                       |
        PayBreakdown + CpfDelta: components with formula + input sources, flags, difference
                       |
        UI: every displayed dollar links back to its component
                       |
        agent.py: mandate-bounded follow-through (draft -> approve -> track -> verify -> escalate)

## The trail: which fact produced which amount

The UI draws that pipeline with the worker's own figures in it, and every edge in the
drawing is a relation one of the engines recorded - never one a screen inferred.

`Component.inputs` is the engine's record: the provenance STRING of every fact it consumed.
`POST /compute` resolves those strings against the facts the REQUEST supplied and returns
`ComponentOut.input_fields` (the field names) alongside them. That resolution happens once,
in the API, because the request is the only place both halves are present.

Two rules follow, and both are tested (backend/tests/test_provenance.py):

- **Nothing is dropped.** `len(input_fields) + len(unresolved_inputs) == len(inputs)`.
- **Nothing is guessed.** A source string carried by more than one fact identifies neither,
  so it is reported in `unresolved_inputs` and attributed to nothing. `/impact` refuses the
  whole run in that case; `/compute` is a weaker claim and reports it instead.

THERE IS NO FIELD-TO-COMPONENT MAP, on either side of the wire, and a test scans both for
one. A screen that resolved its own edges would be a second source of truth about what
depends on what - which is the defect the impact view already has a name for.

## Extraction rules

- Both readers get the same image and the same JSON schema. Neither sees the other's output.
- A field is AGREED only if the normalised values are identical. Normalise before comparing:
  strip currency symbols, whitespace, thousands separators; parse to Decimal; compare Decimals,
  not strings.
- Never invent a confidence score. Status is the confidence. There is no 0.7.
- Cache extraction results for demo images by content hash so the live demo survives an API outage.

## Fields (v2)

Reader-eligibility rule: a field may be shown to a vision reader **only if what the
document shows IS the fact the engine needs** - not merely a number wearing the same
name. Everything else is asked of the worker and is HUMAN_CONFIRMED by construction.
The split is enforced in `fairslip/extract_schema.py` (READER_FIELDS / WORKER_ONLY_FIELDS)
and tested; this table is the specification it implements.

| field | type | required | reader? | source |
|---|---|---|---|---|
| monthly_basic | Decimal | yes | READER | payslip |
| ot_hours | Decimal | yes | READER | roster; worker confirms if readers disagree |
| normal_daily_hours | Decimal | yes | READER | KET |
| deductions_total | Decimal | yes | READER | payslip |
| rest_day_hours | Decimal | optional | READER | roster |
| cpf_employee_on_payslip | Decimal | optional | READER | payslip "CPF" line, if present |
| net_paid | Decimal | yes | WORKER | worker, from bank - see below |
| days_per_week | int 5/6 | yes | WORKER | KET or worker |
| is_workman | bool | yes | WORKER | worker |
| rest_day_requested_by | enum | optional | WORKER | worker |
| residency | enum | yes for CPF | WORKER | worker (Citizen / PR yr / Work Permit ...) |
| date_of_birth or age_band | | yes for CPF | WORKER | worker; band_for() applies the step-up rule |

`net_paid` is the case that defines the rule. A payslip prints "Net pay", and both
readers could read it and agree - but the fact the engine needs is the amount that
reached the bank. Those are two distinct facts wearing one name, and an AGREED on the
printed figure would silently endorse the very discrepancy this product exists to find.
So `net_paid` is the worker's answer from their bank, or it is nothing.

## Agent mandate levels (the worker grants; the agent cannot exceed)

| Level | Worker grants | Agent may | Agent may never |
|---|---|---|---|
| 0 | Show me only | nothing beyond the reconciliation | - |
| 1 | Draft for me | draft a factual message to the employer in English + worker's language; show the NGO / MWC alternative | send anything |
| 2 | Draft and track | record SENT on tap-approve; track the next salary period; remind | contact the employer itself |
| 3 | Verify | reconcile payslip #2 with the same readers and engines; report CORRECTED / PARTIALLY / NOT_CORRECTED with arithmetic | say "resolved" unless the numbers close |
| 4 | Prepare escalation | assemble the TADM evidence pack (contract/KETs, salary + attendance records, WhatsApp, timesheets) and a pre-filled body for CPF Board's under-payment report; show filing steps and deadlines | file, submit, pay, or assert liability |

Enforcement is in code, not prose: the set of actions available is a function of the level;
`send` requires a tap event recorded with a timestamp; `verify` is arithmetic on payslip #2.

## Agent state machine

    DISCREPANCY_FOUND -> MESSAGE_DRAFTED -> SENT (tap only) -> AWAITING_NEXT_PAYSLIP
      -> VERIFYING -> CORRECTED | PARTIALLY_CORRECTED | NOT_CORRECTED -> ESCALATION_PREPARED

There is no MOM rule that an employer must reply within N days. The tracking window is the
next salary period. The real deadlines the agent surfaces are TADM's filing limits
(1 year while employed, 6 months after leaving), verified 7 Sept 2026 on MOM's
managing-employment-disputes page (last updated 26 March 2026).

CPF HAS NO EQUIVALENT DEADLINE, and this file previously said it did. CPF Board's page says
only, verbatim: "Please note the likelihood of recovery for any non/underpayment of CPF
contributions beyond one year is low as the parties’ recollection of the facts or
availability of evidence may diminish over time." That is a statement about ODDS - and about
evidence going stale, which is what the second half says - not a limitation
period, and CPF's enforcement page states no limitation period at all. Never render it as a
deadline; if it is shown, quote it. See docs/debt.md, contested-secondary-source.

TADM claim value caps are UNESTABLISHED and must not appear on any screen - see the same
docs/debt.md entry.

## UI copy contract

Allowed: possible unreconciled difference; we read this as; our two readers disagree;
not yet confirmed; based on MOM's / CPF Board's published rule; check with MOM, TADM or CPF Board.

Forbidden: owed; underpaid; breach; illegal; entitled to; your employer must pay; resolved
(unless arithmetic closes); any number not returned by an engine; any confidence percentage;
and any sum of the gross shortfall and the CPF shortfall (they overlap - use
shortfall_split().total_withheld, see .claude/rules/cpf-rules.md).

## What v2 does not do, and says so on screen

Daily/piece-rated workers; public-holiday pay; shift-work averaging; graduated CPF (<= $750);
PR year 1/2 CPF; Additional Wages; platform workers; domestic workers; legal liability.
Out-of-scope inputs raise or flag; the UI shows "outside what FairSlip checks" with the reason.

## Demo data

`backend/demo/` is fictional only. Never a real worker's document. Say "fictional data" on the deck.

## Recurring defect classes to watch (docs/debt.md)

asserted-confidence; equal-objects-different-canonical-forms; VIOLATED-without-establishment;
quantified-test-name-single-instance; contested-secondary-source.
