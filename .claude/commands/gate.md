---
description: Close out a stage - review, verify, and check the gate
---

Close out this stage:

1. Run `git diff` and pass it to the code-reviewer subagent.
2. For every user-facing success, confirmation, or completion state added in this
   diff, run the verifier subagent. Report each verdict.
3. Run `.claude/hooks/gate.sh` manually and report the result.
4. List anything left undone.

Do not commit. Report and stop.
