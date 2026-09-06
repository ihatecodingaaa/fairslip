---
description: Run the two-reader extraction on the demo images and prove disagreement is surfaced, not hidden
---

Run extraction on every image in `backend/demo/`:

1. For each image, show both readers' raw output side by side for each field.
2. Show the reconciled `Fact` per field with its status.
3. Confirm at least one field on the handwritten payslip lands as DISAGREED or MISSING.
   If every field is AGREED on the handwritten slip, say so - that is suspicious, not good.
4. Attempt `rules.compute_expected()` on the unconfirmed facts and confirm it raises
   `UnverifiedInputError`. Quote the exception message.
5. Simulate the worker confirming the disputed field, re-run, and show the PayBreakdown
   with every Component's formula and input sources.

Report only what you observed. Do not describe a screen or output you did not produce.
