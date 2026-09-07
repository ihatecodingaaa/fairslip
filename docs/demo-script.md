# FairSlip v2 - 90-second live demo

Rehearse until both of you can run it half asleep. Time every run. Five clean runs before Wednesday.

**THIS SCRIPT IS A BUILD ARTIFACT.** It has contradicted the screen twice: it narrated a reader
disagreement the committed cache does not produce, and it named a language the panel does not
serve. Both were lines Lucas would have said out loud, in a pitch about not asserting what the
system has not established. Check every beat against the actual surface after any change that
touches a surface - the check is `/demo-check`, and it takes two minutes.

TIMED AGAINST PRODUCTION, three runs, 7 Sept 2026. The SYSTEM contributes 3.1-3.8 seconds to
the whole scripted run and nothing it does takes longer than 1.3s, so there is no dead air to
cut - every remaining second is a person typing or talking. The one measurable wait is the
extraction, 1.0-1.3s on the committed cache against 9.06s live, so run it cached.

EVERY CLICK IS WRITTEN DOWN. Four used to be missing - the script said a thing appeared and in
fact a person had to click. A beat that says "the difference lands" and does not say who
clicked what is a beat you will fumble when the room is watching.

The scripted run is 24 presenter actions, and they are: 2 file picks, 1 "Read my documents",
6 answers, 1 compute, 3 scrolls, 2 mandate levels, 1 "Draft a message", 1 approve tap,
1 payslip-2 button, and 6 focus changes between fields. If you change a beat, recount here -
a number with no derivation goes stale silently, which is the defect this file already
records about itself. The Q&A moves are NOT in that 24 and are not in the 90 seconds.

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
      >>> CLICK "Read my documents". <<<  Nothing happens until you do. 1.0-1.3s on the
      committed cache, so keep talking through it; it is 9s if it ever goes live.

      Fields light up. HOURS WORKED ON A REST DAY shows a grey "not established" chip and an
      amber answer box.

      "Two readers, two vendors, same images. For the Sunday, one returned 8 hours. The other
      returned nothing at all. And the roster does not print an hour count anywhere - it says
      'full day'. One model produced a number the other could not find. One reader is not
      agreement, so FairSlip will not use it."

      Tap the roster row. "She worked the full Sunday." Confirm. Chip turns green: you answered this.

      THE COUNT DOES NOT GO DOWN WHEN YOU ANSWER THE REST DAY. The gate opens listing five
      fields. Answering the rest-day hours removes one AND adds one - "Who asked you to work
      the rest day" does not exist until FairSlip knows a rest day was worked - so the list
      sits at five again. That is the moment that will throw you. It reaches zero only after
      all six. Six answers in total, in the order the screen shows them:

        1. Normal hours in a working day               -> 8
        2. Hours worked on a rest day                  -> 8   (the beat you just narrated)
        3. What actually reached your bank             -> 1120.00
        4. Days a week you are contracted to work      -> 6 days a week
        5. Whether your job counts as a workman's job  -> No - my work is not manual
        6. Who asked you to work the rest day          -> My employer asked me to
                                                          (appears only after 2)

      Read fields sort above worker fields, so 1 and 2 are at the top together.

      SKIP RESIDENCY AND DATE OF BIRTH. They are on the same screen, badged "for the CPF
      check", and they DO NOT gate the button - measured: the button enables with date of
      birth still blank. Filling them costs two actions and buys nothing on this path,
      because /check runs the Employment Act pack only. If a judge asks why they are there,
      that is the answer.

      Narrate the reason once while Jaydon types: "None of these is on any document. A model
      asked anyway would return a guess that looks exactly like a reading."

      WHY THIS BEAT AND NOT OT HOURS: on the committed cache both readers AGREE on 18 OT hours.
      The genuinely unestablished fields are `rest_day_hours` and `normal_daily_hours`, both
      because only reader A returned a value. Do not say "one says 13, one says 18" - that
      disagreement exists in a fixture, not on this path, and the screen will show
      "both readers agree: 18" while you say it. The rest-day version is also the stronger
      story: a model produced a number the other model could not find anywhere, which is
      precisely what judges fear about AI reading documents. And it is most of the discrepancy.

0:35  >>> CLICK "Work out what the rules say this month should have paid". <<<  It is disabled
      until all six are answered, and the figure does not appear on its own. 0.3-0.4s.

      POSSIBLE UNRECONCILED DIFFERENCE  $62.24
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
      "verify is level 3. It will not let me, and it tells me which level would."
      >>> CLICK "Level 3 - Verify". <<<
      (The scripted run stops at 3. Level 4 is only needed for the escalation pack, which is
      a Q&A move now - do not raise to 4 here.)

      >>> SCROLL DOWN to "Next month". <<<  It is below the timeline and off screen after the
      draft renders.

      "Next month." Payslip #2. Same engines, same rules - these buttons use fictional
      month-2 fixtures, so no reader runs here, and the screen says so.

      THE SCRIPTED RUN IS PATH A. >>> CLICK "Payslip 2 with an extra payment". <<<  0.4-0.8s.
      "CORRECTED - an adjustment of $62.24 appears; the month-1 gap closes to $0.00."

      THE TWO PATHS ARE MUTUALLY EXCLUSIVE. There is one verdict card and the second click
      REPLACES its contents - no side-by-side, and it does not blank in between, it swaps.
      Do not run both in the 90 seconds. Path B is a Q&A move, below.

      ONE HAZARD WORTH KNOWING: if a verify click is REFUSED (wrong mandate level), the old
      verdict card stays on screen behind the refusal banner. Nothing clears it. So a refused
      click can leave a CORRECTED card sitting above a refusal - read the banner, not the
      card, and raise the level before you click again.

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

**"What if the employer does nothing?"** - Path B. >>> CLICK "Payslip 2 with the same
shortfall". <<<  The CORRECTED card is replaced in place. "NOT CORRECTED - the gap stands, and
it has doubled to $124.48, because month 2 repeated the same shortfall."

  Then the pack. >>> SCROLL UP to the mandate row. <<<  Both controls are at the TOP of the
  panel, and you are at the bottom after clicking the payslip-2 button.
  >>> CLICK "Level 4 - Prepare escalation" <<< (verify was level 3; escalation needs 4, and it
  will tell you so if you forget) >>> then CLICK "Prepare escalation". <<<
  The pack does not appear on its own. 0.3-0.4s. It renders ABOVE the CPF example and above
  "Next month" - so it appears behind you, not where you just clicked. Scroll to it.

  "TADM's published evidence list, four items, quoted from their page with the link. The
  filing deadlines, quoted from MOM's page. She files. We don't - the module that would
  do it imports no network client and calls nothing that files, and a test parses it and
  asserts that."

  If they ask why the CPF report is not pre-filled: "two reasons, and the second is the better
  one. We could not read the form - CPF Board's link returned an access error, and we were not
  going to invent the structure of a government form. But CPF Board also says the Board
  computes the CPF once TADM has concluded the claim. So TADM is not half the answer, it is
  the first step. That sentence is on the screen, quoted, with the page date."

**"Want to change any number on that roster?"** - THE IMPACT RADIUS. This is the strongest
Q&A move you have; do not spend it in the 90 seconds.

  >>> On the results card, CLICK "Change one of these numbers and re-run". <<<  One click from
  the figures, and it is not on the scripted path.

  Hand it to the judge: "pick any number on that roster and change it." They pick the field
  from the list and type a value. >>> CLICK "Re-run the engine". <<<

  What comes back is two lists, and the SECOND one is the point:

    - the lines that moved, with the before, the after and the change
    - THE LINES THAT DID NOT MOVE, counted

  Say it out loud: "Change the overtime hours and overtime moves. Basic did not move.
  Rest-day pay did not move. That is not us being careful in the copy - a line is shown as not
  having moved when its AMOUNT is the same, and under each one we say whether it even listed
  the fact you changed. Nowhere in this codebase is there a table saying which field affects
  which line."

  DO NOT SAY "the ones that did not list the fact you changed are shown as not having moved" -
  that is backwards, and the counterexample is one field away. Change the normal daily hours
  from 8 to 9: rest-day pay DOES list that fact and still does not move, because the rest-day
  table brackets on half the normal day and 9 crosses no bracket. The screen says so in as
  many words - "listed the fact you changed among its inputs, and still came out the same" -
  which is the stronger claim anyway. If a judge picks that field, read it off the screen.

  Two things to have ready:

  - "What if I change the basic?" All three move - the hourly rate and the daily rate are both
    built from it. Good: the radius is not always small, and it is not decided by us.
  - "What if I put in something silly?" Try it. Set days a week to 7, or the basic to "abc".
    The engine refuses and the screen shows the refusal, naming which kind it was - and it
    does NOT fall back to the previous number. "A stale figure shown as a current one is the exact failure this whole
    product is against."

  BE HONEST ABOUT WHERE THIS CAME FROM: building this view found a bug in our own engine. The
  rest-day components used the normal daily hours and did not record it as an input, so a line
  could move without declaring what moved it. The view caught it because it checks that
  invariant on every run, and the fix was to record the input the engine was already using.

**"What stops someone else setting mandate level 4?"** - "Nothing, in this build. It says so
on the screen where the level is set: there is no authentication here, and the mandate level is
whatever the caller sends. The guard stops the software exceeding a level. It does not stop a
person claiming one, and we did not want to imply it did."

If it breaks: "let me show you the recorded run", play the video. Do not debug on stage.
