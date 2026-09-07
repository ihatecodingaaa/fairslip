# FairSlip

Does your pay add up - and if not, what happens next? A worker photographs a payslip and a work
roster; FairSlip reconstructs what MOM's and CPF Board's published rules say the month should
have paid, shows every dollar's source, then follows through within a mandate the worker sets.
Vibe For Good 2026, Challenge #1 (ACCA).

## Governing rule (NON-NEGOTIABLE)

IMPORTANT: Nothing the system outputs may assert a fact the system did not establish.

- **AI reads.** Two independent vision readers. A field is ESTABLISHED only if both agree or the worker confirms.
- **Code calculates.** `fairslip/rules.py` (Employment Act) and `fairslip/cpf.py` (CPF) are the only
  places money is computed. Both refuse unestablished or out-of-scope inputs rather than approximate.
- **The worker decides.** Disagreements and missing fields go to the worker, never guessed.
- **The agent follows through - within limits the worker set.** `fairslip/agent.py` may only take
  the actions its mandate level allows. Send requires a tap. Verify is arithmetic on the next payslip.
  It never files, submits, pays, or asserts liability.

Never write "owed", "underpaid", "breach", "entitled", or "resolved" (unless arithmetic closes).

## Stack

- `frontend/` Next.js + TypeScript + Tailwind, Vercel
- `backend/` FastAPI, Python 3.11+, Railway
  - `fairslip/rules.py` Employment Act engine - tested, 21 tests. Do not change formulas without
    updating `.claude/rules/mom-pay-rules.md` and the calibration tests.
  - `fairslip/cpf.py` CPF engine - tested, 21 tests. Same rule; see `.claude/rules/cpf-rules.md`.
  - `fairslip/extract.py` two-reader extraction + reconciliation (Stage 2)
  - `fairslip/agent.py` mandate-bounded follow-through (Stage 3)
  - `demo/` fictional Rahim fixtures, months 1 and 2
- Vision: two vendors, each called DIRECTLY - Claude via the Anthropic API (primary), GPT via
  OpenAI's API (auditor). Not through an aggregator: the second reader exists to avoid a shared
  failure, and routing both through one third party reintroduces one. Cache by image hash.
- Work Permit holders have no CPF. The CPF pack returns NO_CPF for them, not an error.

## Commands

- Backend: `cd backend && python -m pytest -q` / `ruff check --no-cache .` / `uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm run dev` / `npm run build` / `npm run typecheck`
- Gate runs backend tests + frontend typecheck on Stop.

## Workflow rules

- Plan first. Do not edit files until I approve the plan.
- One stage per session. I commit manually - do not run `git commit` unless I ask.
- Any UI number must be a `Component.amount` or a `CpfResult` field, rounded for display only.
- Verify UI with a screenshot before claiming it renders.
- Reply "OK" for routine confirmations.

## Imports

@.claude/rules/honesty.md
@.claude/rules/fairslip-domain.md
@.claude/rules/mom-pay-rules.md
@.claude/rules/cpf-rules.md
@.claude/rules/testing.md
@.claude/rules/git-workflow.md
