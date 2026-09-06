# CPF rules encoded in fairslip/cpf.py

Source: https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay
Page "Last updated 11 Aug 2026". Rates effective 1 Jan 2026. Verified 6 Sept 2026.
Rate table PDF: https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf
RE-VERIFY BEFORE THE PITCH by opening the page and checking each quoted line.

## Quoted rules (verbatim from CPF Board)

Rates from 1 January 2026, monthly wages above $750, Singapore Citizens / SPR 3rd year onwards:

| Employee's age | By employer | By employee | Total |
|---|---|---|---|
| 55 and below | 17% | 20% | 37% |
| Above 55 to 60 | 16% | 18% | 34% |
| Above 60 to 65 | 12.5% | 12.5% | 25% |
| Above 65 to 70 | 9% | 7.5% | 16.5% |
| Above 70 | 7.5% | 5% | 12.5% |

Ordinary Wage ceiling: $8,000 per month from 1 Jan 2026 (was $7,400 in 2025).

Rounding:
> "Please round off the Total CPF contributions to the nearest dollar. Cents should be dropped
> for amounts less than 50 cents, and amounts of 50 cents and above should be treated as an
> additional dollar. The cents should always be dropped for the employee's share of CPF
> contributions."
Employer's share = Total (rounded) - Employee's share (cents dropped). Not a percentage.

Age-band step-up:
> "New contribution rates apply from the first day of the month after the employee's 55th,
> 60th, 65th or 70th birthday."

Overtime is CPF-liable Ordinary Wage:
> "CPF contributions are payable on overtime pay given to your employee."
> OW "includes allowances (e.g. food allowance and overtime payments)".
So an OT shortfall compounds into a CPF shortfall. cpf_shortfall() computes exactly that.

Late payment interest: 1.5% per month from the first day after the due date, minimum $5,
rounded down (CPF worked example: $3,000 paid 19 days late -> $28). Roadmap, not v1.

## Calibration example (backend/tests/test_cpf_calibration.py)

    age 40, Citizen, OW $1,462.24 -> total $541 / employee $292 / employer $249
    employer used $1,400.00        -> total $518 / employee $280 / employer $238
    shortfall from $62.24 of missing OT: total $23 / employee $12 / employer $11

Headline: "$62.24 of unpaid OT is not a $62.24 problem. It is also $23 of missing CPF."

## Not encoded in v1 - the engine refuses rather than approximates

- Wages at or below $750: graduated formulas (e.g. 17%(TW) + 0.6 x (TW - 500) for the
  >$500-$750 band). OutOfScopeError.
- 1st/2nd-year PR rates: secondary sources conflict on the Year-2 employer rate (8% vs 9%);
  not verified against CPF Table 3. OutOfScopeError.
- Additional Wages and the AW ceiling ($102,000 - total OW for the year). v1 is OW only.
- Platform workers (separate regime under the Platform Workers Act 2024).
- Work Permit / S Pass / EP holders: correctly NO CPF (returned as zero with a NO_CPF flag,
  not an error). This matters: the migrant-worker persona is not a CPF member.

## Why CPF errors are common (for the pitch, all verified)

- MOM parliamentary reply, 3 July 2023: an average of about 2,800 employers per month
  (1.75% of active employers) failed to make correct or prompt CPF contributions.
- CPF Board's own "common mistakes" list leads with OW-vs-AW misclassification, wrong
  rate after an age-band change, and wrong 1st/2nd-year PR rates. These map one-to-one
  onto the checks in cpf.py.
