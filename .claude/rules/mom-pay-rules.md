# MOM pay rules encoded in fairslip/rules.py

Source page: https://www.mom.gov.sg/employment-practices/hours-of-work-overtime-and-rest-days
Page "Last Updated 24 July 2025". Verified against the page on 6 Sept 2026.
RE-VERIFY BEFORE THE PITCH by opening the page and checking each quoted line below.

Salary timing: https://www.mom.gov.sg/employment-practices/salary/paying-salary
Payslips: https://www.mom.gov.sg/employment-practices/salary/itemised-payslips

## Quoted rules (verbatim from MOM)

Coverage (Part 4, Employment Act):
> "You can claim overtime if you are: A non-workman earning a monthly basic salary of
> $2,600 or less. A workman earning a monthly basic salary of $4,500 or less."

Overtime rate:
> "For overtime work, your employer must pay you at least 1.5 times the hourly basic
> rate of pay. Payment must be made within 14 days after the last day of the salary period."

Hourly basic rate, monthly-rated:
> "(12 x Monthly basic rate of pay) / (52 x 44)"

Monthly cap:
> "An employee can only work up to 72 overtime hours in a month."

Rest-day work (table, at the employer's request / at the employee's request):
> up to half normal daily hours:   1 day's salary   /  half day's salary
> more than half normal hours:     2 days' salary   /  1 day's salary
> beyond normal daily hours:       2 days' salary + overtime  /  1 day's salary + overtime

Daily rate basis: (12 x monthly basic) / (52 x days worked per week). Not single-valued;
the engine requires days_per_week as an established fact.

Salary payment:
> "Salary must be paid: Within 7 days after the end of the salary period."

Deductions:
> "The maximum amount of deduction for a salary period is limited to 50% of the total salary."

Payslips:
> format "Soft or hard copy, including handwritten."
> s.96(4): an employer "is taken to have failed to comply ... if the pay slip ... is
> incomplete or inaccurate, whether or not the employer knew."

## Calibration example (backend/tests/test_rules_calibration.py)

    basic $1,200 | 18 OT hours | one full rest day (8 of 8h) at employer's request | 6-day week

    hourly   = 14,400 / 2,288        = $6.29
    OT       = 6.2937 x 1.5 x 18     = $169.93
    daily    = 14,400 / 312          = $46.15   (5-day week: 14,400 / 260 = $55.38)
    rest day = 2 x 46.15             = $92.31   (5-day week: $110.77)
    gross    = 1,200 + 169.93 + 92.31 = $1,462.24   (5-day week: $1,480.70)

A $7.87/hour rate implies a basic of about $1,500 under this formula, not $1,200.
The suite guards against that inconsistency.

## TADM and MOM: filing an employment claim (encoded in fairslip/agent.py)

These are the quotes the ESCALATION PACK renders. They lived only in
`fairslip/agent.py` behind a code comment, so a RE-VERIFY pass reached them by
luck. They are here so it reaches them by design.

Evidence list source: https://www.tal.sg/tadm/eservices/employees-file-employment-claim
THE TADM PAGE SHOWS NO "last updated" DATE. Do not invent one. Read in a browser
7 Sept 2026 and re-read 8 Sept 2026; the page is client-rendered and returns
nothing useful to curl.

Deadlines source: https://www.mom.gov.sg/employment-practices/managing-employment-disputes
Page "Last Updated: 26 March 2026". Verified 8 Sept 2026.

RE-VERIFY BEFORE THE PITCH by opening both pages and checking each quoted line.

### What TADM asks you to upload (verbatim, under "Essential supporting documents to upload:")

> "Employment contract or key employment terms"
> "Salary payment records and CPF statements (where available)."
> "Termination or resignation letter"
> "Other documents relevant to your claim, e.g. time sheet, certification of
> pregnancy/estimated delivery date by a Singapore medical practitioner."

The same page also says, and the pack does not currently render it:
> "You are required to substantiate your claims with written documents."

### When to file (verbatim)

MOM's page, as two rows of a table:
> Still employed by the company:      "Within 1 year after the dispute arose."
> No longer employed by the company:  "Within 6 months from your last day of work."

TADM's page states the same two limits in prose AND adds a third sentence that
MOM's page does not carry:
> "If you have left employment, within 6 months from your last date of employment.
> Your claims cannot be earlier than 1 year from the date of filing."

SCOPE THAT THIRD SENTENCE CAREFULLY. It is printed inside the "If you have left
employment" bullet, not as a general rule, and the "still in employment" bullet
does not repeat it. TADM's own worked example for the still-employed case implies
a similar reach, but implication is not what the page states - so the pack
attaches the look-back to the after-leaving case only, which is where it appears.

A deadline is when you may FILE. The look-back is how far back a filed claim may
REACH. They are different questions and a worker shown only the first has an
incomplete picture on the screen that tells them what to do next.

### Not encoded, deliberately

TADM claim value caps. MOM says "Up to $20,000" and "$30,000" for union-assisted
claims; TADM's page describes $20,000 per claim with $40,000 combined across
claim types for non-union members. How those compose for one worker could not be
established from either page, and a cap shown wrongly is not recoverable at a
mediation counter. No amount appears on any screen; a test asserts it.
See docs/debt.md, tadm-claim-value-caps.

TADM's filing fees, its Singpass/UEN/payment requirements, and its wrongful
dismissal limits are on the page and are not rendered: v2 checks salary
arithmetic, and the pack is a checklist of what to bring, not a filing guide.

## Not encoded (out of scope for v1, engine flags or refuses)

- The $13.60/hour cap for workmen earning between $2,600 and $4,500: MOM's page states the
  cap for non-workmen; its application to higher-paid workmen was NOT verified. Do not
  encode until confirmed on the MOM page.
- Public-holiday pay, shift-work 3-week averaging, daily/piece-rated workers, CPF, domestic workers.
