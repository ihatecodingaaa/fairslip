# FairSlip domain contract (v2: reconcile, then follow through)

## The pipeline, and what may cross each boundary

    photo / screenshot
          |
    [Reader A: Claude Vision]   [Reader B: second vision model via OpenRouter]
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

## Extraction rules

- Both readers get the same image and the same JSON schema. Neither sees the other's output.
- A field is AGREED only if the normalised values are identical. Normalise before comparing:
  strip currency symbols, whitespace, thousands separators; parse to Decimal; compare Decimals,
  not strings.
- Never invent a confidence score. Status is the confidence. There is no 0.7.
- Cache extraction results for demo images by content hash so the live demo survives an API outage.

## Fields (v2)

| field | type | required | source |
|---|---|---|---|
| monthly_basic | Decimal | yes | payslip |
| ot_hours | Decimal | yes | roster; worker confirms if readers disagree |
| days_per_week | int 5/6 | yes | KET or worker |
| normal_daily_hours | Decimal | yes | KET or worker |
| is_workman | bool | yes | worker |
| deductions_total | Decimal | yes | payslip |
| net_paid | Decimal | yes | worker, from bank |
| rest_day_hours / rest_day_requested_by | optional | | roster / worker |
| cpf_employee_on_payslip | Decimal | optional | payslip "CPF" line, if present |
| residency | enum | yes for CPF | worker (Citizen / PR yr / Work Permit ...) |
| date_of_birth or age_band | | yes for CPF | worker; band_for() applies the step-up rule |

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
(1 year while employed, 6 months after leaving) and CPF's 1-year refund/adjustment limit.

## UI copy contract

Allowed: possible unreconciled difference; we read this as; our two readers disagree;
not yet confirmed; based on MOM's / CPF Board's published rule; check with MOM, TADM or CPF Board.

Forbidden: owed; underpaid; breach; illegal; entitled to; your employer must pay; resolved
(unless arithmetic closes); any number not returned by an engine; any confidence percentage.

## What v2 does not do, and says so on screen

Daily/piece-rated workers; public-holiday pay; shift-work averaging; graduated CPF (<= $750);
PR year 1/2 CPF; Additional Wages; platform workers; domestic workers; legal liability.
Out-of-scope inputs raise or flag; the UI shows "outside what FairSlip checks" with the reason.

## Demo data

`backend/demo/` is fictional only. Never a real worker's document. Say "fictional data" on the deck.

## Recurring defect classes to watch (docs/debt.md)

asserted-confidence; equal-objects-different-canonical-forms; VIOLATED-without-establishment;
quantified-test-name-single-instance; contested-secondary-source.
