---
description: Trigger the failure path and confirm the system reports truthfully
---

Trigger the failure-injection switch, then verify the system's response:

1. Confirm the failure was actually injected (do not assume the switch worked).
2. Observe what the UI reports. Quote the exact strings shown.
3. Run the verifier subagent against each state the UI claims.
4. Report any state that is asserted but not established.

The pass condition is not that recovery worked. The pass condition is that every
state shown to the user matches what actually happened.
