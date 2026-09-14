# FairSlip Preflight: the talk track

Three minutes. Route: `/concept/preflight`.

**Before you start.** Open the demo panel, bottom right, and check the scenario is
**Needs review**. Everything below is reachable from the **Show** buttons in that panel, so you
never have to navigate in front of anyone.

Say, once, at the top: *this is a concept and the company is invented.* The amber ribbon says so
too and stays on screen, but say it anyway. Nothing in the next three minutes is worth the
misunderstanding.

**One thing to check before the room.** Press **Brief me** on the overview. If it answers, the
provider key is configured where you are showing from and Part 4 works. If it says the Brief is
unavailable, skip Part 4 and say so in one sentence: the Copilot is not wired up in this preview.
Do not describe what it would have said. That is the whole discipline of this product applied to
the demo of it.

---

## Part 1: where this came from (20 seconds)

> "FairSlip started by helping one worker understand whether their pay added up. They photograph
> a payslip, we reconstruct what MOM's published rules give for their month, and every dollar on
> the screen says where it came from."

That is the product on `/check`, and it is the half that already exists.

## Part 2: what we are not trying to do (20 seconds)

> "But companies already have HR systems and they already have payroll systems. We are not trying
> to replace either of them, and if that is what you hear in the next two minutes, stop me."

Open with what it is not. The first thing a payroll person does with a new tool is work out which
of their existing tools it is trying to replace, and the answer here is none of them.

## Part 3: the gap (25 seconds)

> "Your HR system knows someone worked a rest day, took unpaid leave, joined on the 22nd or turned
> 55 last month. Your payroll system calculates what gets paid. The question nobody owns is the
> handoff between them."

**Show: Overview.**

> "This is the day before payroll closes. Two hundred and eighty-two of three hundred are ready.
> Eleven need a person. Seven were not checked."

Then stop on the third number, because it is the one nobody else shows:

> "Seven means seven rows FairSlip could not compute. Additional Wages, PRs in their first and
> second year, someone under $750, someone paid by the shift. They are not in the eleven and they
> are not in the two hundred and eighty-two. If we folded them into 'ready' the headline would be
> bigger and it would be a claim about rows nobody looked at."

Point at the money, which is two figures and never one:

> "A hundred and fifty-five fifty below the published rules, six hundred and forty-four above
> them. Two directions, never netted. And seven of the eleven findings carry no amount at all,
> because no rule pack covers the figure. Those are real findings and they are not worth zero."

## Part 4: the Brief (25 seconds)

Press **Brief me**.

> "FairSlip's engine has already done the checking and has already decided the order to work
> these in - that is code, and it is tested. What the Copilot does is read that result and tell a
> payroll team why the top three are the top three."

Let it answer, then point at a card:

> "The sentence came from a model. The name, the status and the figure beside it did not - those
> are drawn from the finding. The model is never given an amount, and if it writes one the answer
> is thrown away rather than shown to you."

If anyone asks whether it can change anything:

> "It has seven tools and all seven are reads. There is no write tool to disable."

## Part 5: one person (40 seconds)

**Show: Rest-day case**, or press **Review** on Mei Ling.

> "Mei Ling Tan, service crew, Harbour Point. Fourteenth of September, she worked eight hours on a
> scheduled rest day."

Run a finger across the four boxes:

> "What happened. What payroll says: eighty seventy-seven. What MOM's rest-day table gives: a
> hundred and sixty-one fifty-four. The difference."

> "MOM's table gives two days' salary when more than half the normal daily hours are worked at the
> employer's request. The register states one."

## Part 6: the evidence, briefly (20 seconds)

Open **Calculation**, then **Published rule**.

> "The engine, its formula, every fact it used, and MOM's own sentence with the date we last read
> the page. Not a confidence score. There isn't one."

Close them again.

> "That is four clicks away rather than in your face, and that is the only thing that changed
> about it. Every figure still has a source."

## Part 7: the boundary (25 seconds)

Press **Prepare correction**.

> "Eighty seventy-seven becomes a hundred and sixty-one fifty-four."

Then read the line under it, out loud, because it is the product:

> "FairSlip will not change payroll. You make the correction in your system, then you recheck it
> here."

Point at the four steps, and then at the disabled button.

> "That one does nothing. There is no integration and we are not going to draw one that does not
> exist."

## Part 8: the recheck (35 seconds)

**Show: Recheck.**

> "Eleven needed review. Three remain. They fixed nine, two still stand, seven still could not be
> checked - and one row that matched the first time does not any more."

Let that land, then explain it:

> "Correcting Mei Ling's shift meant changing a rest-day rate. That rate reached a second shift,
> which the roster records as swapped at the employee's own request, and MOM's table prices that
> one at a day, not two. Nobody would have gone looking for it."

Do not say the word "saved". We did not measure that.

## Part 9: the close (15 seconds)

> "We are not building another HR system and we are not building payroll. We are exploring
> FairSlip as the independent control between what happened at work and what got paid."

Then hand it over:

> "Which part of this does not match how companies actually work?"

---

## If they push

- **"Where does the data come from?"** Exports. Six CSVs, from systems they already have. No API
  in this concept and no API in a first pilot either.
- **"Is this AI?"** The checking is not. Code applies published rules, a person approves, the
  payroll system executes, FairSlip rechecks. The Brief is a model, it runs after all of that, it
  reads findings the engines established, and it cannot state a figure or change an order. The
  reading of messy documents is the other half of the product, on `/check`.
- **"So what happens if the model is wrong?"** You get a worse sentence. You do not get a worse
  number, because it was never given the numbers and the screen draws them itself. Turn the Brief
  off and every count on the page is unchanged.
- **"How do I know the numbers are right?"** They come from the same engines as the live product,
  and the test suite recomputes every one of them from the engines on every run. If someone
  hand-edits a digit the build goes red.
- **"Who decides what I look at first?"** A function in the code, and you can read it. Largest
  computed difference first, then the employment-record findings, then the findings no amount was
  computed for, then the rows nothing was computed for at all. Tests assert that order.
- **"What about my case?"** Almost certainly not covered. Say so. The seven not-checked rows are
  the honest answer to this question and they are already on the screen.

---

## Questions to ask Haojun after showing it

The point of the meeting is these, not the demo. Ask them in roughly this order and write down
the answers verbatim.

**About the workflow**

1. **Which part of this workflow is unrealistic?** Open-ended, first, before he has calibrated to
   what you want to hear.
2. **Where would these exports actually come from** in companies you have worked with? Which
   system, who exports them, how often, and what state are they in when they arrive.
3. **Who owns the final pre-payday check today?** A person, a team, or nobody. If nobody, is that
   because it does not hurt or because nobody has been given it.

**About the findings**

4. **Which of these findings happens often?** The rest-day rate, the missing overtime hours, the
   leaver still in the CPF file, the missed age band, the ceiling.
5. **Which almost never happens?** Equally important, and he will answer it faster.
6. **Would this feel useful, or like another annoying checker?** Push on annoying: what exactly
   would make it annoying the day before payroll closes.

**About who it is for**

7. **Who would actually use it?** Payroll officer, HR, finance, internal audit, the outsourced
   bureau.
8. **Who might pay for it, and out of whose budget?**
9. **What would you never allow this system to do automatically?** He will draw the control
   boundary himself. Compare it with the one on the screen.

**About the two new things**

10. **Does the FairSlip Brief help, or would payroll operators rather work straight from the
    findings list?** This is the one we are least sure about. A wrong answer here costs us a
    feature, not a product.
11. **Is grouping people by location useful, or do payroll teams think in department, cost centre
    or legal entity?** The map groups by site today and can group by either.
12. **Would a payroll bureau find this more useful than an employer?** A bureau runs many
    companies' payroll and carries the risk of getting it wrong for all of them.

**About trust**

13. **What would make you trust one of FairSlip's findings?**
14. **What would immediately make you distrust it?** Usually the more useful answer.
15. **If this existed, what manual task would you hope to stop doing?** If the answer is
    "nothing", the product is a vitamin.

Two more if the conversation is going well:

- **Does "not checked" help or hurt?** It is the thing we are least sure about commercially and
  most sure about ethically.
- **What would you want it to do the moment it finds something, if anything?** The agent ladder in
  the worker-facing product goes draft, send on a tap, track, verify, prepare escalation. None of
  that exists on the employer side and we have not decided that it should.
