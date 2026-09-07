# FairSlip v2 - 90-second live demo

Rehearse until both of you can run it half asleep. Time every run. Five clean runs before Wednesday.

**THIS SCRIPT IS A BUILD ARTIFACT.** It has contradicted the screen twice: it narrated a reader
disagreement the committed cache does not produce, and it named a language the panel does not
serve. Both were lines Lucas would have said out loud, in a pitch about not asserting what the
system has not established. Check every beat against the actual surface after any change that
touches a surface - the check is `/demo-check`, and it takes two minutes.

Setup: laptop on hotspot; backend and frontend up; cache committed to the repo, verified with
network disabled; printed handwritten payslip in Jaydon's hand; phone camera tested under the
room's lighting; audio cached; fallback video on a hidden slide and on your phone.

0:00  Jaydon holds up the slip. Lucas: "This is Mei Ling's payslip. She works F&B on $1,200
      basic. Her hours are in WhatsApp. One question: does it add up?"

      SAY THIS, IT IS THE PRODUCT: "the slip prints a net pay of $1,089.93. We are not going to
      use that number. What the engine needs is what actually reached her bank, and she says
      $1,120. Those are two different facts wearing one name, and if we let two readers agree
      on the printed one we would be endorsing the very gap we are looking for."
      That is the `net_paid` rule in .claude/rules/fairslip-domain.md, live, in ten seconds.
      DO NOT say "$1,120 reached her bank after CPF" as though the slip showed it - it does not.

0:10  Photograph the slip live, THEN attach the roster - the rest-day beat needs both, and
      with the payslip alone the screen says "neither reader found this" instead.
      Fields light up. HOURS WORKED ON A REST DAY shows a grey "not established" chip and an
      amber answer box.

      "Two readers, two vendors, same images. For the Sunday, one returned 8 hours. The other
      returned nothing at all. And the roster does not print an hour count anywhere - it says
      'full day'. One model produced a number the other could not find. One reader is not
      agreement, so FairSlip will not use it."

      Tap the roster row. "She worked the full Sunday." Confirm. Chip turns green: you answered this.

      THEN FIVE MORE ANSWERS BEFORE THE BUTTON ENABLES, so keep moving and narrate the reason
      once: normal hours in a working day, what actually reached the bank, days a week
      contracted, whether the job is a workman's job, and - once the rest day is answered - who
      asked her to work it. "None of these is on any document. A model asked anyway would
      return a guess that looks exactly like a reading." Jaydon types; Lucas talks over it.

      WHY THIS BEAT AND NOT OT HOURS: on the committed cache both readers AGREE on 18 OT hours.
      The genuinely unestablished fields are `rest_day_hours` and `normal_daily_hours`, both
      because only reader A returned a value. Do not say "one says 13, one says 18" - that
      disagreement exists in a fixture, not on this path, and the screen will show
      "both readers agree: 18" while you say it. The rest-day version is also the stronger
      story: a model produced a number the other model could not find anywhere, which is
      precisely what judges fear about AI reading documents. And it is most of the discrepancy.

0:35  POSSIBLE UNRECONCILED DIFFERENCE  $62.24
      (Do not say "about 1.35 days of her basic pay" - days_of_pay() exists in rules.py but no
      endpoint calls it and nothing renders it. Every figure you say out loud must be one the
      screen shows.)

      "Overtime is CPF-liable wage. So a pay difference is usually also a CPF difference."

      DO NOT narrate the CPF split as her month here. The screen says, in bold, that the CPF
      side of this month is NOT shown: working out CPF needs the wage the employer actually
      contributed on, and no uploaded document states it. The split appears further down, in a
      dashed box labelled "Fictional worked example - not your figures". Point at that box and
      say so: "we can show you what the compounding looks like, on invented numbers, because
      the real ones would need a figure no payslip prints."

      In the example: $50.24 never reached her bank, $23 never reached her CPF ($12 hers,
      $11 the employer's), $73.24 withheld in total. "We don't add $62.24 and $23 - they
      overlap by the $12 of CPF she'd have paid on that overtime. The honest total is $73.24."
      The line under the list shows the other half of it: $62.24 minus $12.00 = $50.24, the
      cash that did not arrive. Read it off the screen, not from here.

      The component tree is already open below the figure - basic, overtime, rest day - each
      with the formula that produced it and, under it, where each input came from: "both
      readers agree: Claude 1200.00, OpenAI 1200" or "you answered on screen: Hours worked on
      a rest day". No tap needed, and they are text, not links. Point, do not click.

0:55  "Now what?" Scroll to "What happens next". Pick mandate level 2, draft and track.
      Tap "Draft a message". Mandarin Chinese left, English right.
      Mei Ling taps approve. Status: SENT, with the time of the tap. "It could not send
      without that tap."

      The draft is in a dashed box too, labelled "not your message". Say it: "this is her
      message, not yours - we are not drafting about your payslip."

1:10  RAISE THE LEVEL FIRST - and say why, because the refusal is the feature:
      "verify is level 3. It will not let me, and it tells me which level would." Tap level 3.
      (Path B needs level 4 for the escalation pack; raise again when you get there.)

      "Next month." Payslip #2. Same engines, same rules - these buttons use fictional
      month-2 fixtures, so no reader runs here, and the screen says so.
      Path A: "CORRECTED - an adjustment of $62.24 appears; the month-1 gap closes to $0.00."
      Path B: "NOT CORRECTED - the gap stands, and it has doubled to $124.48. Escalation pack
              ready: TADM's published evidence list. She files. We don't."
      Run whichever the room needs. Both fixtures exist.

1:25  "AI reads. Code calculates. The worker decides. The agent follows through -
      within limits the worker set."

## Q&A moves, not in the 90 seconds

**"Does this only work for that one worker?"** - Switch the persona on the agent panel to
Rahim. One click, no re-upload, no re-extraction; both drafts are committed so both are cache
hits. Same engines, same published rules, visibly different outcome:

  - His draft is in **Bengali**, not Mandarin. Language is a property of the person.
  - Where Mei Ling shows the CPF split, Rahim's card reads **"No CPF for Rahim"** and explains
    that Work Permit holders are not CPF members - and shows no split at all, because a split
    of zeros with an overlap note explaining a $0 overlap would be a card contradicting itself.
  - His escalation pack drops the CPF half entirely: there is no CPF report to be missing for
    a worker who is not a CPF member.
  - The NGO route changes too: Rahim is offered the Migrant Workers' Centre, Mei Ling is not.
    MWC exists for migrant workers, and offering it to a Citizen would be asserting something
    about the reader.

  Say: "same rules engine, same code. What changed is who the worker is - and which published
  rules apply to them. That is the product: a set of rules, not one hardcoded story." Judges
  will notice you knew that a Work Permit holder is not a CPF member.
  (No reader runs when you switch - the panel is fixture data and says so. Do not say
  "same readers" here.)

**"Want to change any number on that roster?"** - the judge picks, one component turns orange
and recomputes, the rest stay untouched.

**"What stops someone else setting mandate level 4?"** - "Nothing, in this build. It says so
on the screen where the level is set: there is no authentication here, and the mandate level is
whatever the caller sends. The guard stops the software exceeding a level. It does not stop a
person claiming one, and we did not want to imply it did."

**"Why isn't the CPF report pre-filled?"** - "Because we could not read the form. CPF Board's
page links to it behind a redirect that returned an access error. We built the TADM half, where
the evidence list is published, and the screen says the CPF half is not built and why. We were
not going to invent the structure of a government form and hand it to a worker."

If it breaks: "let me show you the recorded run", play the video. Do not debug on stage.
