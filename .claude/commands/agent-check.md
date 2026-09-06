---
description: Prove the follow-through agent cannot exceed its mandate, and that verify is arithmetic
---

Exercise `fairslip/agent.py` against the demo fixtures and report only what you observed:

1. At mandate level 1, attempt `send`. It must be refused with a reason. Quote the refusal.
2. At level 2, call `send` without a tap event. Refused. Then with a tap event. State becomes SENT.
   Quote the recorded timestamp.
3. At level 3, feed payslip #2 (corrected fixture). Show the arithmetic that produces CORRECTED:
   the month-1 difference, the adjustment found on payslip #2, and the closing gap.
4. Feed payslip #2 (uncorrected fixture). Show NOT_CORRECTED with the gap that remains.
5. At level 3, attempt `prepare_escalation`. Refused (needs level 4). At level 4, show the
   evidence-pack manifest and the pre-filled CPF report body. Confirm nothing was submitted anywhere.
6. Grep the codebase for the strings "resolved", "owed", "underpaid". Report every hit and whether
   it is behind an arithmetic check.

If any step cannot be run because the code does not exist yet, say so. Do not describe behaviour you did not execute.
