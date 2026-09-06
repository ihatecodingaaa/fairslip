# Testing rules

- Write the test before the implementation for any logic with a branch.
- Every stage ends green: typecheck, lint, and tests all pass. `.claude/hooks/gate.sh` enforces this.
- Demo data lives in a single seeded fixture module. No inline literals scattered
  through the app that only exist to make a screen look full.
- Any state the demo depends on must be reproducible from a single command.
