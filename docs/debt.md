# Defect classes

One line per recurring defect class. Not a bug list - a list of *kinds* of bug
that recur, so they can be prevented structurally rather than fixed repeatedly.

Format: `YYYY-MM-DD | class | where it appeared | structural prevention`

## Open

2026-09-06 | asserted-confidence | any LLM "confidence: 0.7" on an extracted field | status is derived from two-reader agreement or human confirmation; no numeric confidence exists in the schema
2026-09-06 | sanitiser-opens-bypass | block-destructive.ps1 stripped all single-quoted text, so sh -c 'rm -rf x' passed | any input-stripping step in a guard needs an evasion test alongside its false-positive test
2026-09-06 | fix-verified-by-inspection-only | the strip was reviewed as correct and shipped without an evasion probe | guard changes require an adversarial test case, not just the motivating case
2026-09-06 | check-disabled-by-absent-dependency | hooks silently no-op'd when jq was missing | a disabled check must announce itself (systemMessage) or fail closed; never pass quietly
2026-09-06 | inconsistent-worked-example | advisor's $7.87/h alongside $1,200 basic | every number on a slide must be produced by the engine; test_a_7_87_hourly_rate_implies_about_1500_basic guards the specific case

2026-09-06 | contested-secondary-source | PR Year-2 employer CPF rate: 9% in two sources, 8% in a third | a rate enters an engine only from the primary table; contested rates are OutOfScopeError until verified

## Carried from Keepsake / Orkestr

| equal-objects-different-canonical-forms | float vs Decimal, "18" vs "18.0", naive vs aware datetimes | compare Decimals after normalisation; never compare strings for numeric fields
| VIOLATED-without-establishment | a flag raised on a value that was never checked | flags are only raised inside compute_expected on established inputs
| quantified-test-name-single-instance | "test_all_fields_have_source" checking one field | derive cases from the dataclass fields or parametrize

## Resolved
