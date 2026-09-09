# FairSlip v2 - 90-second live demo

Rehearse until both of you can run it half asleep. Time every run. Five clean runs before Wednesday.

**THIS SCRIPT IS A BUILD ARTIFACT.** It has contradicted the screen twice: it narrated a reader
disagreement the committed cache does not produce, and it named a language the panel does not
serve. Both were lines Lucas would have said out loud, in a pitch about not asserting what the
system has not established. Check every beat against the actual surface after any change that
touches a surface - the check is `/demo-check`, and it takes two minutes.

> ## ⚠ 9 SEPTEMBER 2026: THE SURFACES BELOW WERE REDESIGNED. RE-RUN `/demo-check` BEFORE
> REHEARSING FROM THIS FILE.
>
> Every ENGINE, every endpoint, every figure and every refusal is unchanged - $62.24, $23,
> 11 exceptions, 7 refused rows, the mandate ladder and all four verdicts still come from the
> same code and still say the same things. What moved is where a presenter POINTS. This file
> has not been re-timed or re-walked against the new screens, so treat each beat's TARGET as
> unverified until it has been:
>
> - **The control row is gone from the top of every page.** Language, text size and contrast
>   now live behind a **Display** button in the header. The setup step "the control row at the
>   top of /check reads English / Normal / Normal" is corrected in place below; `?reset=1`
>   itself is unchanged and still the whole procedure.
> - **/check is staged.** After the engine runs, the difference and its trail move to the TOP
>   of the page and the evidence moves below them. Beats that scroll down to the result now
>   scroll UP to it, and the reader comparison is further down than it was.
> - **The money trail is new** and is the hero of the reconciliation: documents, readers,
>   established facts, rules, money, difference, with the lines between them. The 0:35 beat
>   that points at the component list has a stronger target now.
> - **Change-a-fact moved into the trail.** It is no longer a panel at the bottom: select a
>   fact, and its own panel offers to vary it. The Q&A move at "Want to change any number on
>   that roster?" needs its clicks re-walked.
> - **The agent's state machine is behind a disclosure** ("See what FairSlip is allowed to
>   do"), so the Q&A move that shows it needs one extra click.
> - **/employer leads with a grid of 300 marks**, one per row, before the lists.
>
> Nothing here is a reason to change what is SAID. It is a list of what to re-point at.

TIMED AGAINST PRODUCTION, three runs, 7 Sept 2026. The SYSTEM contributes 3.1-3.8 seconds to
the whole scripted run and, apart from the extraction, nothing it does takes longer than 1.3s -
every remaining second is a person typing or talking.

THE EXTRACTION IS NOW THE ONE REAL WAIT, AND IT IS DELIBERATE. Those runs were timed at
1.0-1.3s on the committed cache, which is what a replay costs; the demo no longer runs that
way. `FAIRSLIP_READER_MODE=live` calls both models for real, so budget ROUGHLY 8-15 SECONDS
and plan to talk through it. That range is read off measurements already on record, not from a
rehearsal of this configuration: production /extract took 9.06s and 3.76s live
(docs/debt.md, fast-is-not-cached), and single live calls on 7 Sept were 12.4s for
`claude-haiku-4-5` and 8.6s for `gpt-5.6-luna` (docs/reader-models.md). /extract runs the two
concurrently, so the wall time is the slower of the two, not their sum. RE-TIME IT IN
REHEARSAL and correct this line with what you actually see.

RE-MEASURED AGAINST PRODUCTION 8 Sept 2026, three runs, same harness. Warm: 3.8s and 4.3s of
system time, extraction 1.24s and 1.30s - the 7 Sept figures hold. The FIRST run of the day
was 10.6s, of which 2.45s was loading /check and 2.94s was the extraction: that is a cold
serverless start, and it is the only number here that would hurt on stage. WARM THE
DEPLOYMENT BEFORE YOU PRESENT - load /check and run one extraction, then leave the tab open.

THE DESIGN PASS COSTS NOTHING MEASURABLE. Deployed to a Vercel PREVIEW on the same
infrastructure and driven three times by the same harness, 8 Sept: 3.9s and 4.4s of system
time warm, against production's 3.8s and 4.3s on the same afternoon. THE HONEST STATEMENT IS
THAT THE TWO ARE NOT DISTINGUISHABLE AT THIS SAMPLE SIZE - three runs each - which is not the
same claim as "no slower", and the difference between those two sentences is the argument this
whole product makes. Do not upgrade it to "no slower" without more runs.
Extraction 1.22-1.55s (production
1.24-1.30s), compute 0.39-0.64s (production 0.28-0.53s). The preview's first run of the day
was 9.2s, production's 10.6s: the same cold start, not a regression.

Preview deployments sit behind Vercel SSO, so the harness needs a protection-bypass token in
VERCEL_BYPASS. `vercel curl -v <preview-url>` prints the header the CLI mints. Do not commit
one.

EVERY CLICK IS WRITTEN DOWN. Four used to be missing - the script said a thing appeared and in
fact a person had to click. A beat that says "the difference lands" and does not say who
clicked what is a beat you will fumble when the room is watching.

The scripted run is 24 presenter actions, and they are: 2 file picks, 1 "Read my documents",
6 answers, 1 compute, 3 scrolls, 2 mandate levels, 1 "Draft a message", 1 approve tap,
1 payslip-2 button, and 6 focus changes between fields. If you change a beat, recount here -
a number with no derivation goes stale silently, which is the defect this file already
records about itself. The Q&A moves are NOT in that 24 and are not in the 90 seconds.

STILL 24 AFTER THE 8 SEPT DESIGN PASS. Re-driven, not re-counted by eye: the harness fires
the same beats against the same predicates, and no click was added or removed. What DID
change is how far you scroll between them, because the type scale raised the body text from
12-14px to 14-16px and the pages grew with it. At a 1400x900 window:

  after the compute click, the page is        4,653px -> 6,791px
  after the approve tap                       6,620px -> 8,052px
  after the escalation pack renders           7,942px -> 9,732px
  the 1:10 scroll to "Next month" travels     1,723px -> 2,349px  (1.9 -> 2.6 screens)
  total scroll travel across the run          ~6,800px -> ~9,300px (7.6 -> 10.4 screens)

THOSE FIVE FIGURES WERE MEASURED AT THE END OF PHASE 1 AND THE FIRST THREE ARE NOW STALE.
Phase 2 put the language / text size / contrast row above everything (187px) and a read-aloud
button on the result (44px), and the table was never re-driven. Re-measured 8 Sept at
1400x900 on the committed cache, after Phases 2 and 3:

  after the compute click                     6,791px -> 7,256px
  after the approve tap                       8,052px -> 8,517px
  after the escalation pack renders           9,732px -> 9,995px

THE LAST TWO ROWS ARE NO LONGER STALE. Re-driven 8 Sept at 1400x900 on the committed cache,
after Phase 4, with the six answers entered THROUGH THE FIELDS - focused, one at a time, the
way the script counts them - because a field that is off screen scrolls itself into view when
it takes focus, and a run that sets the values blind never makes those moves:

  the 1:10 scroll to "Next month" travels     2,349px -> 2,448px  (2.6 -> 2.7 screens)
  total scroll travel across the run          ~9,300px -> 9,301px (10.3 screens)

RE-DRIVEN AGAINST PRODUCTION after the Phase 5 deploy, same harness, same window: the 1:10
scroll was 2,448px to the pixel and the total 9,419px - 118px more than localhost, in two
small reflows after the payslip-2 click.

THEN THE WATERFALL WENT IN AND BOTH GREW AGAIN. Those two figures were measured BEFORE it,
and carried into this section as though they were after - which is this file's own recurring
defect, committed while correcting it. Re-driven against production with the waterfall
deployed:

  the 1:10 scroll to "Next month"             2,448px -> 2,575px  (2.7 -> 2.9 screens)
  total scroll travel across the run          9,419px -> 9,992px  (11.1 screens)

AND AGAIN AFTER THE READER COMPARISON, re-driven against production:

  the 1:10 scroll to "Next month"             2,575px -> 2,574px  (unchanged)
  total scroll travel across the run          9,992px -> 10,413px (11.6 screens)

AND AGAIN AFTER THE STATE MACHINE. This one is the largest single cost of
any visual so far, and it is worth knowing before you stand up:

  the 1:10 scroll to "Next month"             2,574px -> 3,260px  (2.9 -> 3.6 screens)
  total scroll travel across the run          10,413px -> 12,611px (14.0 screens)
  after the compute click, the page is        7,831px -> 9,022px
  after the approve tap                       9,092px -> 10,239px
  after the escalation pack renders           10,570px -> 11,680px

The diagram is ~1,200px and it sits between the mandate control and
everything below it, so both of the long scrolls got longer: the one to the
CPF example is 2,779px -> 3,546px and the one to "What happens next" is
841px -> 1,607px. PRACTISE THE THREE SCROLLS AGAIN. They are each about a
third longer than they were on Tuesday, and a scroll that overshoots on a
projector is the same fumble as a missing click.

The placement was deliberate and is worth defending if asked: the argument
about what the agent may not do belongs beside the control that decides it.
Putting it lower would have bought back the scroll and separated the
picture from the thing it is about.

All of the growth is in one leg: moving through the six questions is 964px ->
1,383px, because the six readings are now one table instead of six stacked rows
and the fields sit further apart. The three scrolls you actually make are
unchanged.

The growth is where you would expect it: the scroll to the CPF example is 2,334px -> 2,779px,
because the waterfall now sits between the figure and that card. Page heights are unchanged
from the waterfall measurement - 7,831 after the compute click, 9,092 after the approve tap,
10,570 with the escalation pack - so nothing since has touched /check.

BOTH LAND WITHIN A FEW PER CENT OF WHAT WAS ALREADY WRITTEN DOWN, and the pages under them
are 469px taller than when those distances were taken. Nothing about the scroll rehearsal
needs to change. Why the growth did not show up in the distances was NOT established - the
figures are reported, not explained.

MEASURED, at a 900px viewport, in the order they happen:

  0:10  "Read my documents"        the page moves itself         663px
  0:10  the six answers            the page follows your focus   964 + 857 + 570px
  0:35  the compute click          the page moves itself         625px
  0:45  scroll 1 of 3, to the CPF example                      2,334px  (2.6 screens)
  0:55  scroll 2 of 3, UP to "What happens next"                 840px  (0.9 screens)
  1:10  scroll 3 of 3, to "Next month"                         2,448px  (2.7 screens)
                                                               -------
                                                               9,301px

THE 0:35 BEAT BELOW SAYS THE COMPUTE CLICK "TRAVELS ABOUT 3,000px ON ITS OWN". That came from
a run that set the six answers without focusing anything, so the page was still at the top
when the click fired and made the journey in one go. Both runs were DRIVEN to settle it:

  answers entered through the fields  the page has travelled 3,054px already; the click adds   625px
  answers set blind, nothing focused  the page has travelled     0px;         the click adds 3,016px
                                                                             total 9,301px either way

The total is the same to the pixel. It is the same distance whichever way it is split, so the
table is not sensitive to how the answers are entered - only the beat you FEEL it on is. On
stage you will feel it as the first one: by the time you click compute you have been typing
into fields three-quarters of the way down the page, and the click is a short hop.

THE CPF SCROLL IS 2,334px, NOT THE "about 1,900px" THE 0:35 BEAT CLAIMED. Corrected there.

PHASE 3 ADDS NOTHING TO THIS PAGE. The coverage page is a new route; /check imports none of
it. Checked rather than assumed: the rendered text of /check after the full scripted run is
byte-identical to the Phase 2 capture apart from one field's status chip, which differs
because that run had answered the date of birth and the scripted one skips it.

PHASE 4 ADDS FOUR PIXELS. "Save or print this" sits beside "Read this aloud" under the four
figures, and a 48px primary tap target in a row that was 44px is the whole of it. Re-driven,
all three heights moved by exactly that and nothing else did:

  after the compute click                     7,256px -> 7,260px
  after the approve tap                       8,517px -> 8,521px
  after the escalation pack renders           9,995px -> 9,999px

THE WATERFALL ADDS ~570px, and it goes in ABOVE the component tree. Re-driven
against production, 1400x900:

  after the compute click                     7,260px -> 7,831px
  after the approve tap                       8,521px -> 9,092px
  after the escalation pack renders           9,999px -> 10,570px

STILL 24 PRESENTER ACTIONS. Phase 4 adds a control and no beat presses it - printing is a Q&A
move, not one of the 90 seconds. Not counted by eye: the harness drove the whole scripted path
again, found every beat by the same predicate, and needed no new one.

So the three scrolls are still three scrolls. Practise them: a scroll that overshoots on a
projector is the same fumble as a missing click.

WHAT MOVED: the component tree is NO LONGER visible below the $62.24 without scrolling.
The waterfall took that space, and it is the thing to point at now - same three components,
on one axis, with the gap at the end of it. Measured on production at 900px after the compute
click: the waterfall heading is 609px down the viewport and its last row is at 742px, both in
view; "WHERE EACH DOLLAR COMES FROM" is at 1,131px and is not. The 0:35 beat has been
rewritten to match, and it still says "point, do not click" - about the chart.

## Setup

WARM THE DEPLOYMENT. THIS IS THE FIRST SETUP STEP, NOT A TIP.

  09:55-10:00  before the 10:30 semi-final
  13:25-13:30  before the final

Open the deployed /check, attach the payslip and the roster, click "Read my documents", and
let it land. Then LEAVE THE TAB OPEN. That is the whole procedure and it takes twenty seconds.

Why it is first: the functions are serverless and they go cold. RE-MEASURED AGAINST THE
DEPLOYMENT THAT WILL BE PRESENTED, 8 Sept, immediately after it went live - so this is a true
first-of-the-day, not a warm run wearing the label:

  COLD, first of the day     /check 4.59s   extraction 1.68s   TOTAL 6.27s
  warm, three runs           /check 0.18-0.23s  extraction 1.02-1.03s  total 1.21-1.25s

5.05 SECONDS OF DEAD AIR, on the 0:10 beat, in a 90-second pitch - while the room watches a
spinner and Lucas has already finished the sentence that was meant to cover it. It is the
single largest demo risk in the product and it costs nothing to remove.

Warming once is not permanent - the platform will let the functions go cold again if they sit
idle. Warm at the times above, not the night before.

RESET THE INTERFACE. Second setup step, same reason as the first: it is avoidable and it
lands on the opening beat. IT IS ONE ACTION - open this URL instead of the plain /check:

  https://fairslip.vercel.app/check?reset=1

That is the whole step. The page clears the stored language, text size and contrast and comes
up in English; there is nothing to look at and nothing to click. It also resets any other tab
of the same browser profile that is still open, so a rehearsal tab left in Tamil goes back to
English with it. The parameter takes itself out of the address bar afterwards, so if you
change the language during the Q&A a later reload keeps YOUR choice rather than reverting it.

Why it is a step at all: the three controls PERSIST - they are stored per browser profile, so
a language picked while rehearsing the Q&A is still selected the next time the tab opens. It
bit this build during verification: a screenshot pass left the interface in Tamil and the next
run of the scripted path failed on its first beat, looking for English text that was no longer
on the screen. On stage that is the whole demo in a language you cannot read.

This used to be a procedure - read three controls, click the wrong ones, or open DevTools and
remove a storage key. Warming the deployment is already a twenty-second procedure at 09:55; a
second one is the one that gets skipped. If you want to confirm it worked, the page is in
English - the nav reads Worker / Employer - and opening **Display** in the header shows
English / Normal / Normal selected. (Corrected 9 Sept 2026: those three controls were a row
across the top of every page and are now inside that button. `?reset=1` is unchanged.)

Then: laptop on hotspot; backend and frontend up; **`FAIRSLIP_READER_MODE=live` set on the
backend and confirmed** (see below); `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` present and each
proven by one live extraction; cache committed to the repo and verified with network disabled,
as the EMERGENCY path only; printed handwritten payslip in Jaydon's hand; phone camera tested
under the room's lighting; audio cached; fallback video on a hidden slide and on your phone.

### The reader mode, and why the demo runs `live`

The claim being made on stage is that TWO INDEPENDENT MODELS read the worker's document. A
replayed answer cannot support it, so the demo runs the mode that cannot replay:

| Mode | What happens | Use it for |
|---|---|---|
| `live` | both models called; a failure is shown as the failure it was | **THE DEMO.** Nothing else. |
| `live_then_cache` | both called; an entry stands in only for a call that FAILED | production default |
| `cache` | no model called at all | **EMERGENCY ONLY** - see below |

CONFIRM IT ON THE SCREEN, NOT FROM MEMORY. After the extraction the reader strip says, per
reader, "called live" with that reader's real latency in milliseconds. If either reader says
"from cache" or "live call failed - replayed from cache", YOU ARE NOT IN THE MODE YOU THINK
YOU ARE IN, and the sentence about two models reading the document is not available to you.

### EMERGENCY ONLY: the room has no network

Set `FAIRSLIP_READER_MODE=cache` and reload. Both readings are then replayed from entries
committed to the repo and NO MODEL IS CALLED. The screen says so - "replayed from the
committed cache - no model was called" - and so must you.

SAY, IF YOU HAVE TO USE IT: "the network is down, so this is replaying readings we recorded
earlier - the models are not being called right now." That sentence costs you the live-reading
claim and keeps every other beat. NEVER present a cached run as a live reading; the product's
whole argument is that it does not assert what it has not established, and doing it on stage
would refute the thesis more effectively than any judge could.

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
      >>> CLICK "Read my documents". <<<  Nothing happens until you do. IN `live` THIS IS THE
      LONG BEAT - budget roughly 8-15s for the two models, and keep talking through it. Fill
      it with the sentence that explains what is happening: "two different companies' models
      are reading the same photograph right now, separately, and neither can see the other's
      answer."

      THEN POINT AT THE READER STRIP AND READ THE LATENCIES OFF IT. Each reader says "called
      live" and the milliseconds it actually took, for this request. That is the proof the
      wait was real work rather than a spinner, and it is worth the five seconds it costs.

      WHAT APPEARS IS NOW A COMPARISON, NOT A LIST. Read the strip off the screen:

        6 fields read | 4 both readers agree | 0 readers disagree | 2 not established

      Those four numbers are counted from the facts as the page renders them - answer a
      field and they move. Under them is the diagram, and it is worth one sentence: two
      boxes, Anthropic and OpenAI, fed from the same two images, converging on "reconciled
      by code, not by a model" - AND NOTHING BETWEEN THE TWO BOXES. Point at the gap.
      "There is no line between them because neither reader saw the other's answer. That
      absence is the only reason the agreement below means anything."

      THEN POINT AT THE MONTHLY BASIC ROW, which is the reconciler's whole argument sitting
      in two columns: one reader read "1200.00", the other read "1200", and the verdict is
      BOTH READERS AGREE. "Different strings, same number. The comparison is on Decimals,
      not on text - which is why a formatting difference is not a disagreement, and why a
      real disagreement cannot hide behind one."

      NOW THE REST DAY. Its row has an 8 in one column and a DASHED EMPTY BOX in the other,
      beside a "not established" chip. "Two readers, two vendors, same images. For the
      Sunday, one returned 8 hours. The other returned nothing at all - that is the empty
      box. And the roster does not print an hour count anywhere; it says 'full day'. One
      model produced a number the other could not find. One reader is not agreement, so
      FairSlip will not use it."

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

      WARNING, AND IT IS NEW: EVERYTHING IN THIS BEAT DESCRIBES WHAT THE COMMITTED CACHE
      PRODUCES. Running `live`, the readings are whatever the two models say TODAY, and no
      rehearsal can guarantee they will land the same way. DO NOT NAME AN OUTCOME BEFORE THE
      SCREEN SHOWS IT - say "let's see where they disagree", read what is actually there, and
      pick your example from that. If the live run reproduces the cached one, the narration
      below is correct as written; if it does not, the fields have moved and the reasoning
      still holds. Re-run this beat in rehearsal, `live`, at least twice, and note what varies.

      WHY THIS BEAT AND NOT OT HOURS: on the committed cache both readers AGREE on 18 OT hours.
      The genuinely unestablished fields are `rest_day_hours` and `normal_daily_hours`, both
      because only reader A returned a value. Do not say "one says 13, one says 18" - that
      disagreement exists in a fixture, not on this path, and the screen will show
      "both readers agree: 18" while you say it. The rest-day version is also the stronger
      story: a model produced a number the other model could not find anywhere, which is
      precisely what judges fear about AI reading documents. And it is most of the discrepancy.

0:35  >>> CLICK "Work out what the rules say this month should have paid". <<<  It is disabled
      until all six are answered, and the figure does not appear on its own. 0.3-0.4s.

      THE PAGE IS NOT FINISHED WHEN THE FIGURE IS. The panel below fetches its fixture data
      when it mounts, and on PRODUCTION that lands after the number does: measured 8 Sept
      against the deployment, the figure is on screen at 0.39s and the page grows a further
      1,308px at 0.64s. A quarter of a second after the room reads $62.24, everything below it
      moves. On localhost this does not happen at all - the fetch resolves first - so it will
      not show up in rehearsal against a dev server. DO NOT START SCROLLING INTO IT. Land the
      sentence, let it settle, then move.

      THE PAGE NOW MOVES ITSELF TO THE FIGURE. Phase 2 sends keyboard focus to the result
      heading when the reconciliation lands - WCAG 4.1.3, so a screen reader is taken to the
      answer rather than left at the button - and moving focus scrolls it into view. Do not
      fight it. The same thing happens after "Read my documents", which moves to "Who read
      your documents", and every time you tab into one of the six questions.

      HOW FAR IT ACTUALLY MOVES, re-driven 8 Sept after Phase 4: this click travels 625px,
      because the page has already come 3,054px following your focus through the questions.
      An earlier note here said 3,000px, which is what the click does only if nobody focused
      a field - see the table at the top. The scroll from here to the CPF worked example is
      2,334px.

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

      WHAT IS UNDER THE FIGURE IS NOW THE WATERFALL, not the component tree. Point at it:
      basic, overtime and rest day as bars on one money axis, then expected gross, then
      deductions coming off, then what reached the bank - and the gap is what is left of the
      axis after it. Say that: "the last bar is not a number we added at the end, it is what
      is left when the money that arrived is taken off what the rules say was earned."

      THE GAP BAR IS SMALL, AND THAT IS THE POINT. $62.24 against $1,462.24 is 4% of the
      axis, and every bar is drawn to one scale, so it is drawn at 4%. If a judge asks why
      the hero is the smallest bar: "because it is the smallest number. We are not going to
      draw it bigger than it is on the one screen whose whole argument is that we do not."

      THE COMPONENT TREE IS NOW BELOW THE FOLD. Measured on production at 900px: "WHERE EACH
      DOLLAR COMES FROM" sits at 1,131px, so it is one short scroll down, not on screen. It
      still carries every formula and every source with no tap needed. DO NOT scroll to it in
      the 90 seconds - the waterfall says the same three components, and each bar opens its
      own formula on tap if a judge asks. Keep it as a Q&A move and the run stays at three
      scrolls.

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

**"Is this only for the one worker you showed us?"** - THE COVERAGE PAGE. From the landing
page, the second button: "Who FairSlip is for, in rules". Not on the 90-second path.

  It answers the scale question in RULES, and the first line says why: no figure on the page
  describes a population, because FairSlip does not know one and a number like that would be a
  claim it cannot establish. Say that out loud - it is the same rule as the payslip, applied to
  our own pitch.

  Three things to point at, in this order:

  - THE TWO RULE PACKS, each with the MOM or CPF Board sentence it implements, quoted, with the
    page and its last-updated date - and beside each rule the symbol in our code that implements
    it. The thresholds are the engine's own constants: $2,600 and $4,500 are read from
    rules.py, not typed onto a slide. A test resolves every one of those symbols and compares
    the value, so a threshold that moved in the engine and not on the page fails the build.

  - WHO IS A CPF MEMBER. Seven rows, one per residency status, and every one of them was
    produced by RUNNING the CPF engine when the page loaded - Citizen and PR-from-year-3
    compute, Work Permit / S Pass / EP come back with the engine's own NO_CPF flag, and PR year
    1 and 2 come back refused, with the engine's own reason. "That is why we ship two workers
    and not one: same code, different published rules, different answer."

  - WHAT WE DO NOT DO, in three kinds, and the difference between them is the point. The engine
    REFUSES it (asked on this page load; the message shown is the one it refused with). There
    is NO INPUT for it (checked against the input schema on this page load). Or we SAY it and
    this page does not prove it - domestic workers and legal liability are labelled exactly
    that way. If a judge wants to see one of the refusals happen, the impact-radius move does
    it live: set days a week to 7.

  Then the last section, if there is time: what OUR OWN interface covers. The six worker
  questions are translated into all four languages; the rest of the interface is counted from
  the dictionary and Tamil is visibly short. READ THE NUMBERS OFF THE SCREEN. They are computed
  from the dictionary at render time and they will change the next time anyone adds a string -
  which is the point, and is why they are not written down here.

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

**"What does she actually walk out with?"** - THE TAKE-AWAY SHEET. Not on the 90-second path.

  >>> On the results card, beside "Read this aloud", CLICK "Save or print this". <<<

  BRING A PRINTED COPY AND PREFER IT. The button opens the browser's print dialog, which is a
  modal over the whole demo - on a projector that is a grey box where your product was, and
  you have to find Cancel in front of the room. Hold up the paper instead, and only press the
  button if a judge asks to see it happen.

  Six A4 pages, black on white, no colour anywhere. What is on it:

  - who read the documents, and what each reader said, field by field
  - every field's status, as an ICON AND A WORD - "both readers agree", "not established",
    "you answered this" - because the colour is gone and something has to carry it
  - the difference, the four figures under it, and every component with its formula and the
    source of each input
  - the sentence saying the CPF side of this month is not shown, and why
  - TADM's evidence list and MOM's filing deadlines, quoted, each with its own page - and on
    paper the URL is printed after the link text, because a link is a dead end otherwise

  WHAT IS DELIBERATELY NOT ON IT, and this is the part to point at. The agent panel's figures
  belong to Mei Ling, an invented worker - her CPF split, her drafted message, her month-2
  verdict. On screen you can see they are hers: they are in dashed boxes that say so, on a
  page you can take in at once. Paper has none of that. Paper has pages, and pages come apart
  in a photocopier and on a desk. So the sheet leaves them off - and says so, in the place
  each one would have been, naming what was there and why it is not:

      "Shown on screen, not on this sheet: the CPF worked example. It is a fictional example
      about an invented month... It is not this worker's CPF, and on paper - separated from
      the screen that says so - it would read as though it were."

  Say it out loud: "the product's rule is that it does not state what it did not establish.
  The sheet applies that to its own omissions. It never quietly drops a section."

  IT IS THE SAME PAGE, NARROWED - not a second render. Nothing on the sheet is re-typed from
  the screen, so there is no second copy of a figure that could drift from the first. Print
  hides and restyles; it never re-states a number. Same argument as the read-aloud.

  IF THEY ASK HOW YOU KNOW IT SURVIVES A PHOTOCOPIER: it was printed to PDF and read back in
  greyscale, not eyeballed in a browser. Every colour that paints anything in print media is
  pure black or pure white - sampled off the live computed styles, 8 distinct pairs, zero
  greys. And it was rendered TWICE, with background graphics off and on, because Chrome does
  not print backgrounds unless you tick a box: the two rasters are pixel-identical, so the
  sheet does not depend on a setting the worker will never find. The first run of that check
  found the one thing that did - a calendar icon on the date field, 112 pixels, which is now
  gone.

**"Is it accessible?"** - AUDITED 8 SEPT, AGAINST THE DEPLOYMENT, and the interesting part is
that the three tools disagreed about whether anything was wrong.

  - axe-core 4.13, run over SEVEN states - both other routes, /check at each of its four
    stages, and /scale in Bengali at largest text in high contrast: **0 violations, 0 items
    needing review**. It found two serious contrast failures the first time and they are
    fixed; see below.
  - Lighthouse: **accessibility 100** on all three routes. Say this one carefully if a judge
    presses - Lighthouse audits the page AS LOADED, and /check as loaded is an upload form.
    Every finding axe made was in a state Lighthouse never reached.
  - KEYBOARD ONLY, real key events, the whole scripted run: all six answers typed, all three
    selects chosen, the compute button pressed with Enter. **Every tab stop draws a focus
    ring.** The Radix mandate group is one tab stop with arrow keys inside it, as it should be.
  - The ACCESSIBILITY TREE on the core path: no heading level skipped, **0 of 37 controls
    unnamed**, landmarks present, the live region carrying the right sentence at both moments
    the page changes, and focus moving to the result heading when the figure lands.

WHAT WAS FOUND AND FIXED, because "we audited it" is worth less than "here is what it caught":

  - Two contrast failures at 4.33:1 and 4.1:1, from `opacity` at 70% over tokens that are
    themselves fine. The tokens were never wrong - opacity composites at render time, so the
    contrast suite that has been green for four phases could not see it. One of the two was
    dimming the label that says "not your figures".
  - A tab stop with no focus ring: `<input type="date">` is FOUR stops in Chrome and the
    fourth is a button inside its shadow root. Neither scanner evaluates focus indicators.
  - An UNEARNED CAVEAT: the coverage page told English readers "FairSlip has not verified a
    translation of them" beside every quotation, in English, where nothing had been
    translated. That is this product's own rule pointed the other way - a warning it had not
    earned - and it is worth saying out loud if the honesty thesis comes up.

NOT A SCREEN-READER PASS. No screen reader ran; NVDA cannot be driven from the harness. What
was established is the tree a screen reader is GIVEN. If a judge asks, say exactly that.

**"Who pays for this?"** - THE EMPLOYER CHECK. Not on the 90-second path. From the landing
page, the third button: "Check a payroll before payday".

  >>> CLICK "Run the fictional 300-employee roster". <<<  ~1s.

  THE NUMBERS ARE DERIVED, NOT MEMORISED. Read them off the strip:

      300 rows read, 293 checked, 11 exceptions, 7 not checked, $2,599.00 total difference

  Say: "we seeded eleven errors into three hundred rows and it found eleven - and a test
  asserts that, per category, so if the engine stops catching the age-band transition the
  build goes red before the demo quietly reports ten."

  THE THREE THINGS TO POINT AT, in this order:

  - THE SCHEMA IS CPF BOARD'S. Ten of the twelve columns are the Employer Contribution Detail
    Record from the CPF EZPay (FTP) File Specifications, effective 16 January 2025 - fixed
    width, 150 bytes a record. The screen shows CPF Board's own field names and column
    positions beside each one. "This is not a format we invented. Every payroll vendor in
    Singapore already generates this file."

  - TWO COLUMNS ARE OURS AND THEY SAY SO. Scroll to the dashed box. The Detail Record carries
    no date of birth, and its S and T prefixes separate citizens from PRs registered since
    1 January 2000 - they do not say which PR year applies. The engine needs both, so we ask
    for both, in a box that says CPF Board did not. "A schema that is mostly official is the
    easiest possible version of the failure this product exists to find."

  - SEVEN ROWS WERE NOT CHECKED, AND THEY ARE ON THE SCREEN. Scroll to "Not checked". Two are
    PR graduated years and two are wages at or below $750 - the engine refuses both, in its
    own words. Three carry Additional Wages, and the refusal there says whose limit it is:
    "FairSlip's limit, not CPF Board's - our CPF engine computes Ordinary Wages only." Say:
    "an exceptions table that silently drops what it could not check is a payroll signed off
    on rows nobody looked at."

  THE ROUNDING, IF AN ACCOUNTANT IS IN THE ROOM. The specification states CPF's rounding
  rules verbatim on the Contribution detail amount column: the total to the nearest dollar,
  the employee's share DOWN. fairslip/cpf.py was written from CPF Board's contribution-rates
  page months earlier and does exactly that, and the spec's own two worked examples -
  "$1.50 should be regarded as $2.00" and "$1.50 should be regarded as $1.00" - are run as
  tests. "Our engine and the government's file format agree on the arithmetic, and we can
  show you the test."

  WHAT IT DOES NOT DO: it does not edit anything. It flags and explains; the fix happens in
  the employer's own payroll system. Staying out of their system is what makes it checkable.

**"How do you know the agent can't exceed the mandate?"** - THE STATE MACHINE. It is on
screen the whole time, under "What you are allowing". Not a scripted beat; a 20-second answer.

  >>> Look at the diagram at whatever level is currently set. <<<

  At level 2 - where the scripted run leaves it - SIX of the ten states are STRUCK THROUGH,
  and each one says the level that would permit it. Say: "that is not a disabled button. The
  states the agent cannot reach are drawn as unreachable, and the diagram is generated from
  the same enum and the same transition table the guard enforces. A test asserts the drawn
  nodes equal the enum members and the drawn edges equal the transitions - a state diagram
  that drifts from its own machine is worse than no diagram."

  THREE THINGS TO POINT AT, in this order:

  - RAISE THE LEVEL AND WATCH THE STRIKE-THROUGHS GO. Level 3 clears VERIFYING and the four
    verdicts; level 4 clears the escalation pack and the summary line reads "0 of these
    states are out of reach". That is the mandate argument as a picture: one permission, one
    whole region of the machine.

  - AWAITING_NEXT_PAYSLIP IS DASHED, NOT STRUCK THROUGH, and it says "inside the mandate,
    and not built in this cut". Two different sentences. "You did not allow this" and "we did
    not build this" send a worker to different places, and raising the mandate would not make
    that one work at any level.

  - UNVERIFIABLE SAYS "CAN BE ATTEMPTED AGAIN - NOT AN ENDING", and the other three verdicts
    do not. A worker whose month-2 payslip photographed badly has not reached the end of
    anything; that state returns to AWAITING_NEXT_PAYSLIP and VERIFYING, and the return edge
    is in the machine rather than in the drawing. The server computes it as "reachable from
    itself", which is why PARTIALLY_CORRECTED - which is also not terminal, but goes on to
    the escalation pack and never comes back - is correctly NOT labelled re-attemptable.

  IF A JUDGE ASKS WHETHER THE DIAGRAM IS REAL: it is served by /agent/mandate, which builds
  it from agent.py's AgentState, TRANSITIONS, ENTERED_BY and MANDATE_TABLE. The component
  contains no node list, no edge list and no mandate level - only which column to draw a node
  in - and a test asserts exactly that.

**"What stops someone else setting mandate level 4?"** - "Nothing, in this build. It says so
on the screen where the level is set: there is no authentication here, and the mandate level is
whatever the caller sends. The guard stops the software exceeding a level. It does not stop a
person claiming one, and we did not want to imply it did."

If it breaks: "let me show you the recorded run", play the video. Do not debug on stage.
