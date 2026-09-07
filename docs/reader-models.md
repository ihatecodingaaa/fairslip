# The two vision readers: which models, and why

FairSlip's governing rule needs two *independent* readers, because a field is
ESTABLISHED only when both agree. That makes the model pick a design decision
with a stated reason, not a preference. This file is the reason, so it can be
cited on the deck rather than remembered.

## The pick

| Role | Model | Vendor | API | Key | Model env var |
|---|---|---|---|---|---|
| Reader A (primary) | `claude-haiku-4-5` | Anthropic | Anthropic API, direct | `ANTHROPIC_API_KEY` | `FAIRSLIP_READER_A_MODEL` |
| Reader B (auditor) | `gpt-5.6-luna` | OpenAI | OpenAI API, direct | `OPENAI_API_KEY` | `FAIRSLIP_READER_B_MODEL` |

Both models are configurable by environment variable, so the pick is visible in
the deployment rather than compiled into a constant.

**Both APIs are called directly. Neither goes through an aggregator.** This is
load-bearing, not incidental. Reader B exists so that a systematic misreading by
one model family does not become an AGREED — the one failure two readers cannot
catch. Putting both readers behind one third party would hand them back a shared
dependency: one account, one balance, one outage. The independence has to go all
the way down or it is decorative.

Two vendors on purpose, for the same reason: two models from one family share
training and tend to share their mistakes.

## Why these two, stated honestly

**Accuracy did not discriminate.** Every candidate read every field correctly, on
clean and degraded images alike — 15 out of 15. So accuracy could not be the
reason for the pick, and claiming it was would invent a difference the
measurement did not find.

The pick was made on **cost and latency**, which did differ, and which matter
here for two concrete reasons: every extraction runs *two* models rather than
one, and the live demo waits on the slower of the two.

Do not say on stage that one model reads payslips better than another. Say that
they agreed, that agreement is the product, and that the pick was made on cost
and latency because accuracy gave no reason to prefer either.

## The measurement

Three draws per model, on a degraded phone-photo version of a generated payslip:
**3.2° skew, lighting gradient, sensor noise, blur, 52% downscale, JPEG q38.**

| Model | Latency | Output tokens | Clean | Photo (3 draws) |
|---|---|---|---|---|
| `claude-sonnet-5` | 2.0–2.4 s | 103 | 6/6 | 6/6, 6/6, 6/6 |
| `claude-haiku-4-5` | 1.6–2.1 s | 92 | 6/6 | 6/6, 6/6, 6/6 |
| `gpt-5.6-terra` | 1.4–4.2 s | 50–98 | 6/6 | 6/6, 6/6, 6/6 |
| `gpt-5.6-luna` | 2.0–3.5 s | 113–117 | 6/6 | 6/6, 6/6, 6/6 |

**15/15 perfect.** Four sequential calls totalled about 10 s.

### The caveat, which matters more than the numbers

**The document was a clean generated font, not handwriting.** Every image in this
bake-off — degraded or not — carried machine-set type underneath the degradation.
Skew, noise and JPEG artefacts test the *imaging* path; they do not test
character formation.

So this measurement says nothing about how the readers behave on the handwritten
case, and MOM explicitly permits handwritten payslips ("Soft or hard copy,
including handwritten"). The handwritten payslip is the case FairSlip exists for
and the case this table has not measured. **Do not cite 15/15 as evidence about
handwriting.** Step 8 — the two readers against the handwritten artwork — is the
measurement that would speak to it, and it has not been run.

### What 15/15 does support

It is evidence about *false positives*: a two-reader design is only useful if it
stays quiet when the document is legible. A system that flagged a disagreement on
every other field would train a worker to tap through the warnings, and the one
real disagreement would be tapped through with the rest. On clean and
imaging-degraded machine type, it does not cry wolf.

### Live plumbing check, 7 Sept

After switching reader B from OpenRouter to the OpenAI API directly, one live
call per reader against a generated payslip (fictional data):

| Reader | Result | Latency |
|---|---|---|
| `claude-haiku-4-5` (Anthropic) | all 6 fields read | 12.4 s |
| `gpt-5.6-luna` (OpenAI) | all 6 fields read | 8.6 s |

Reconciliation: 5 AGREED, 1 MISSING (`rest_day_hours` — neither reader found a
rest day on a payslip, which is correct).

This proves auth, model id, image envelope, JSON-schema response and parsing. It
is **not** an accuracy measurement — one draw, one image.

⚠️ **Those latencies are 4–6× the bake-off's.** The bake-off recorded 1.6–2.1 s
and 2.0–3.5 s; this run took 12.4 s and 8.6 s on a larger image with a
JSON-schema response format. `/extract` runs the two readers concurrently, so
wall-clock is the slower one, but ~12 s is a long pause on stage. Worth timing
against the real artwork before the pitch and considering a spinner that says
what is happening.

## What the system does when a reader is wrong, or absent

Worth saying out loud, because it is the part a demo cannot show:

- **Readers disagree** → the field is DISAGREED, both values are shown, and the
  worker decides. No averaging, no preferring reader A.
- **One reader answers, the other does not** → MISSING, not AGREED. One reader is
  not agreement.
- **One reader is unreachable** → every field it was asked becomes MISSING and
  the response names the outage. A reader outage never promotes the surviving
  reader's answer to a fact. Tested
  (`test_when_one_reader_fails_nothing_is_established_at_all`).
- **A reader returns a field outside the schema** → the whole reading is
  rejected rather than partly kept. A model volunteering a residency it cannot
  see is guessing, and a guess dressed as an extraction is the failure the
  governing rule exists to prevent.
- **Both readers make the same mistake** → the system reports AGREED and is
  wrong. This is the architecture's real limit and it should be stated plainly
  if asked. Two vendors reduce it; nothing here eliminates it.

## Caching

Reader answers are replayed from entries **generated offline, committed to the
repo, and read-only at runtime**. This is the contract, not a workaround:

```
backend/scripts/make_cache_entry.py     the only writer, run by hand
          |   (entry committed to git)
          v
backend/demo/extract_cache/*.json       ships in the deployment bundle
          |
    load_cache_entry()  <-  read_with_cache()  <-  POST /extract
```

Generate entries for the demo images before the pitch, and commit them:

```
cd backend
python scripts/make_cache_entry.py demo/payslip.jpg          # one image
python scripts/make_cache_entry.py demo/payslip.jpg demo/roster.png   # sent together
python scripts/make_cache_entry.py --check demo/payslip.jpg  # writes nothing
```

Images passed in ONE invocation are cached as one request: the key covers the
whole image set, so two images sent together are a different entry from either
sent alone. **Match the invocation to what the demo actually posts.**

The key is `sha256(prompt version + model id + each image's role, media type and
bytes)`. Change the prompt or a model and every entry misses, because it is an
answer to a different question. Bump `PROMPT_VERSION` in `fairslip/extract.py`
whenever the prompt or schema changes, and regenerate with `--force`.

**Nothing in the request path writes.** An earlier version wrote at runtime; on
Vercel's read-only filesystem every write raised `OSError` into a `pass`, so the
cache was permanently empty and never said so, while the docs described it as
working. Writing to `/tmp` instead would not help — `/tmp` does not survive
between invocations, so the cache would still be empty when the network is down,
having looked correct in testing. See `docs/debt.md`,
`write-path-contradicts-its-own-contract`.

**A miss is never silent.** Every reading carries `cache` (`HIT`/`MISS`) and the
`cache_key` it looked for; `POST /extract` aggregates these into `cache_state`
(`HIT`/`PARTIAL`/`MISS`) and a `cache_note`, and `/check` shows a banner saying
which path the readings came down. A fast response is not evidence of a cache
hit — the second production call was 3.76 s against 9.06 s and was two live
calls on warm connections.

`PARTIAL` matters: `/extract` calls both readers, so one cached entry still
reaches the network. Both readers need an entry or the offline path is fiction.

### Verified offline, 7 Sept

Outbound networking was removed from the interpreter at startup (`socket`
`getaddrinfo`/`connect` raise), so the SDKs faced a genuinely dead network.
Nothing in `fairslip` or either SDK was patched.

| Phase | Setup | Result |
|---|---|---|
| Control | no entry, network blocked | both readers failed — `APIConnectionError: Connection error.` |
| Offline | entries present, network blocked | both `cache=HIT`, all six fields returned |

The control is the part that makes the second row mean anything: it proves the
block was real rather than assumed.

`tests/test_cache_is_populated.py` guards the precondition — once any image is
committed under `backend/demo/`, it fails until every (image, reader) pair has a
committed entry, naming each missing filename. It skips while there is no
artwork.

## What the readers are and are not asked

Six fields are read; six are asked of the worker. The split is enforced in
`fairslip/extract_schema.py` and tested — the worker-only fields are absent from
the schema *and* from the prompt text, so there is no path by which a model's
guess about residency, a date of birth, or a bank balance can enter as a
reading. See `.claude/rules/fairslip-domain.md` for the table and the
`net_paid` reasoning.
