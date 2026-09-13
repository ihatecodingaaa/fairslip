# FairSlip Preflight: the talk track

Two to three minutes. Route: `/concept/preflight`.

**Before you start.** Open the demo panel, bottom right, and check the scenario is
**Needs review**. Everything below is reachable from the **Show** buttons in that panel, so you
never have to navigate in front of anyone.

Say, once, at the top: *this is a concept and the company is invented.* The amber ribbon says so
too and stays on screen, but say it anyway. Nothing in the next three minutes is worth the
misunderstanding.

---

## 1. What it is not (15 seconds)

> "This is not another HR system, and it is not a payroll system. It does not record anything and
> it does not pay anyone."

Do not open with the product. Open with what it is not, because the first thing a payroll person
does with a new tool is work out which of their existing tools it is trying to replace, and the
answer here is none of them.

## 2. The gap (20 seconds)

> "Your HR system already knows that someone took leave, worked a rest day, joined on the 22nd or
> turned 55 last month. Your payroll system already calculates what gets paid. The question nobody
> owns is whether each of those events became the right outcome in payroll."

**Show: Overview.** Point at the workforce-changes strip.

> "One hundred and sixty-five recorded changes in September, in three systems the company already
> runs. That is not news to anyone here. What happens to them is."

## 3. The preflight (30 seconds)

Still on the overview.

> "Two hundred and eighty-two ready. Eleven need review. Seven were not checked."

Then stop on the third number, because it is the one nobody else shows:

> "Seven means seven rows FairSlip could not compute. Additional Wages, PRs in their first and
> second year, someone under $750, someone paid by the shift. They are not in the eleven and they
> are not in the two hundred and eighty-two. If we folded them into 'ready' the headline would be
> bigger and it would be a claim about rows nobody looked at."

And the money, if they ask:

> "A hundred and fifty-five dollars fifty below the published rules, six hundred and forty-four
> above them. Two directions, never netted. And seven of the eleven findings carry no amount at
> all, because no rule pack covers the figure. Those are real findings and they are not worth zero
> dollars."

## 4. One person (45 seconds)

**Show: Rest-day case.**

> "Mei Ling Tan, service crew. Eight recorded changes in September. On the left, what the company's
> systems recorded. On the right, what payroll did with each one."

Run your finger down the right-hand column: matched, matched, not checked, matched, **needs
review**.

> "Fourteenth of September, she worked eight hours on a scheduled rest day. It reached the
> register. MOM's rest-day table gives two days' salary when more than half the normal daily hours
> are worked at the employer's request. The register states one."

Open **How this was worked out** in the inspector.

> "That is the engine, its formula, every fact it used and where each one was read, and MOM's own
> sentence with the date we last read the page. Not a confidence score. There isn't one."

If you have a moment, point at the medical certificate row:

> "This one we did not check, and it says so. Sick-leave pay is not in our rule packs. We do not
> assume it is right."

## 5. Why the pay moved (30 seconds)

**Lens: What changed.**

> "August, seventeen ninety-two. September, seventeen oh four. Down eighty-seven fifty."

> "Six lines, and they add up to that exactly. Overtime agrees with MOM's rate. The rest-day
> premium differs from it. The no-pay-leave line and the allowance have no published rule behind
> them, so we do not tell you they are right."

This is the screen that works for both audiences. Say so:

> "That is the screen a payroll officer uses to explain a month, and it is the screen you would
> show the employee who asks why their pay is different. Same six rows."

## 6. The boundary (20 seconds)

**Lens: Findings.** Press **Prepare correction**.

> "Eighty seventy-seven becomes a hundred and sixty-one fifty-four."

Then read the line under it, out loud, because it is the product:

> "FairSlip will not change payroll. You review it in your system, you make the change there, then
> you recheck it here."

Point at the disabled button.

> "That one does nothing. There is no integration and we are not going to draw one that does not
> exist."

## 7. The recheck (30 seconds)

**Show: Recheck.**

> "They fixed nine. Two still stand. Seven still could not be checked. And one row that matched the
> first time does not any more."

Let that land, then explain it:

> "Correcting Mei Ling's shift meant changing a rest-day rate. That rate reached a second shift,
> which the roster records as swapped at the employee's own request, and MOM's table prices that
> one at a day, not two. Nobody would have gone looking for it."

Do not say the word "saved". We did not measure that.

## 8. The close (10 seconds)

> "FairSlip does not run payroll. It independently checks the handoff into payroll."

---

## What to have ready if they push

- **"Where does the data come from?"** Exports. Six CSVs, from systems they already have. No API
  in this concept and no API in a first pilot either.
- **"Is this AI?"** No. Not in this concept. Code applies published rules, a person approves, the
  payroll system executes, FairSlip rechecks. The reading of messy documents is the other half of
  the product, on `/check`, and it is not what this screen is about.
- **"How do I know the numbers are right?"** They come from the same engines as the live product,
  and the test suite recomputes every one of them from the engines on every run. If someone
  hand-edits a digit the build goes red.
- **"What about my case?"** Almost certainly not covered. Say so. The seven not-checked rows are
  the honest answer to this question and they are already on the screen.

---

## Questions to ask Haojun after showing it

The point of the meeting is these, not the demo. Ask them in roughly this order and write down the
answers verbatim.

1. **Which part of this is unrealistic?** Open-ended, first, before he has calibrated to what you
   want to hear.
2. **Where would the data actually come from, in a company this size?** Which system, who exports
   it, how often, and what state is it in when it arrives.
3. **Who owns this problem today?** A person, a team, or nobody. If nobody, is that because it
   does not hurt or because nobody has been given it.
4. **Which of these findings happens most in a real month?** The rest-day rate, the missing
   overtime hours, the leaver still in the CPF file, the missed age band, the ceiling.
5. **Which of them almost never happens?** Equally important, and he will answer it faster.
6. **What does a payroll team do today when they find one of these?** Before payday and after.
7. **Would a report like this be useful or annoying the day before payroll closes?** Push on
   annoying: what would make it annoying.
8. **Who would care enough to pay for it, and out of whose budget?** Payroll, HR, finance,
   internal audit, or the outsourced payroll provider.
9. **What would you never let a tool like this do automatically?** He will draw the control
   boundary himself. Compare it with the one on the screen.
10. **What would make you trust a number on this screen?** Then ask what would make him distrust
    one, which is usually the more useful answer.

Two more if the conversation is going well:

- **Does "not checked" help or hurt?** It is the thing we are least sure about commercially and
  most sure about ethically.
- **If this existed and worked, what would you stop doing?** If the answer is "nothing", the
  product is a vitamin.
