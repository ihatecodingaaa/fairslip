# FairSlip v2 - stage plan (Sun 6 -> Wed 9 Sept)

Deck due Thu 10 Sept 10:00. Pitch Fri 11 Sept. One Claude Code session per stage, opened with
/plan-stage and closed with /gate. Commit after every stage. The gate is red until it is green.

What ships pre-built and tested (do not rewrite): rules.py (21 tests), cpf.py (21 tests),
demo/fixtures.py (both personas, months 1 and 2). Stages wire around them.

## Stage 1 - Sunday: review both engines, skeleton, one flow end to end

    /plan-stage Stage 1. Two deterministic engines already exist and pass 42 tests:
    backend/fairslip/rules.py (Employment Act) and backend/fairslip/cpf.py (CPF). First, read each
    against its quoted-rule file (.claude/rules/mom-pay-rules.md, .claude/rules/cpf-rules.md) and
    REPORT any formula, threshold, or rounding you believe diverges from the quoted text - do not
    change formulas, report them. Then scaffold: FastAPI app in backend/app with POST /compute
    (PayInputs-shaped JSON of Facts -> PayBreakdown) and POST /cpf (declared_ow, expected_ow, band,
    residency -> CpfDelta). The Next.js app in frontend already exists: add one page that loads
    the Mei Ling fixture from backend/demo/fixtures.py, calls /compute then /cpf, and renders the
    difference, the component list with formulas and input sources, the CPF shortfall (total /
    employee / employer), and the flags. Also render the Rahim fixture and show the NO_CPF flag
    for a Work Permit holder. No OCR yet. No auth. No settings page. Deployment is a separate step.

Done when: /compute and /cpf return the calibration numbers; the page shows $62.24 and $23 for
Mei Ling and $62.24 + NO_CPF for Rahim; gate green; both apps deployed and reachable from a phone.

## Stage 2 - Monday: two readers, reconciliation, confirmation

    /plan-stage Stage 2. Implement backend/fairslip/extract.py: two independent vision readers
    (Claude via the Anthropic API as primary; a second vision model via the OpenAI API as auditor) that
    each return the field schema in .claude/rules/fairslip-domain.md from an image, plus a pure-code
    reconciler that normalises values to Decimal and produces a Fact per field with status AGREED /
    DISAGREED / MISSING. Add POST /extract taking two images. Cache results by image content hash.
    Frontend: upload two images, show per-field status, a confirmation UI for DISAGREED/MISSING
    fields that produces HUMAN_CONFIRMED facts, then call /compute and /cpf. Tests for the reconciler
    use canned reader outputs, no API calls: "18" vs "18.0" must AGREE; "18" vs "13" must DISAGREE;
    a field present in one reader only must be MISSING.

Before the session (20 min): make the fictional handwritten payslip by hand from MOM's blank
template with the OT hours written so 18 could read as 13; photograph it; make a WhatsApp-style
roster screenshot; make a payslip #2 in two versions (with and without an "OT adjustment 62.24"
line). Save under backend/demo/. Test two OpenAI vision models on the handwriting and pick one.

Done when: /extract-check shows the OT field DISAGREED on the handwritten slip; confirming it lets
/compute run; gate green.

## Stage 3 - Tuesday: the follow-through agent, provenance, compounding display

    /plan-stage Stage 3. Implement backend/fairslip/agent.py per the mandate table and state
    machine in .claude/rules/fairslip-domain.md. Mandate level is an established fact the worker
    sets. Actions available are a pure function of level; send() requires a tap event with a
    timestamp; verify() reconciles payslip #2 through the same /extract + /compute path and decides
    CORRECTED (month-2 difference closes the month-1 difference within $0.01, or an explicit
    adjustment line matches it), PARTIALLY_CORRECTED, or NOT_CORRECTED - arithmetic, not opinion.
    prepare_escalation() at level 4 assembles a manifest of the TADM evidence list and a pre-filled
    body for CPF Board's under-payment report; it never submits. draft() calls the LLM once to write
    a factual, non-accusatory employer message in English and the worker's language, and always
    shows the NGO / MWC alternative. Frontend: mandate selector; agent timeline; tap any dollar to
    open its Component; "change a fact" recompute that highlights only components whose inputs
    include that fact (derived from Component.inputs, not hardcoded); difference also shown as days
    of basic pay; the drafted message read aloud in Bengali (pre-generated, cached). Tests for the
    state machine and for verify() using the month-2 fixtures, no API calls.

Priority inside the day: agent.py + verify > provenance tap > days-of-pay > voice > change-a-fact.
Then: security-reviewer pass; rehearse docs/demo-script.md five times with a timer; fallback video.

Done when: /agent-check passes; /demo-check runs the script end to end; gate green; /pitch-sync.

## Stage 4 - Wednesday: employer batch (stretch), design pass, freeze, deck

Morning, only if Stage 3 closed green: a minimal employer surface - upload a CSV of ~300 fictional
employees, run both engines per row, return an exceptions table (age-band mismatch, sub-PWM basic,
CPF short on OT, wages >$8,000 ceiling). Seed 14 known errors; the number to say on stage is how
many it caught. If this slips, it is one hero slide, not a half-built feature.
Then the frontend-design skill pass with the screenshot loop. Freeze at 12:00 (git tag demo-freeze).
Deck from docs/pitch-state.md; every number on it produced by an engine. Share link tested in
incognito. Submit Thursday by 09:00.
