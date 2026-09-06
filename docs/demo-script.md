# FairSlip v2 - 90-second live demo

Rehearse until both of you can run it half asleep. Time every run. Five clean runs before Wednesday.

Setup: laptop on hotspot; backend and frontend up; cache committed to the repo, verified with network disabled; printed handwritten
payslip in Jaydon's hand; phone camera tested under the room's lighting; Bengali audio cached;
fallback video on a hidden slide and on your phone.

0:00  Jaydon holds up the slip. Lucas: "This is Mei Ling's payslip. She works F&B on $1,200 basic.
      Her hours are in WhatsApp. $1,120 reached her bank after CPF. One question: does it add up?"

0:10  Photograph the slip live. Fields light up. OT hours turns yellow.
      "Our two readers disagree - one says 13, one says 18. FairSlip won't guess."
      Tap the handwriting. "It's 18." Confirm. Field turns green: HUMAN CONFIRMED.

0:35  POSSIBLE UNRECONCILED DIFFERENCE  $62.24  - about 1.35 days of her basic pay.
      Then the split, three lines, all from shortfall_split():
        $50.24 never reached her bank
        $23 never reached her CPF   ($12 hers, $11 the employer's)
        $73.24 withheld in total
      "Overtime is CPF-liable wage. Her employer computed CPF on $1,400; the rules say
      $1,462.24. And note we don't add $62.24 and $23 - they overlap by the $12 of CPF
      she'd have paid on that overtime. The honest total is $73.24."
      Tap the $62.24: the component tree opens - hourly rate, 1.5x, 18 hours, rest-day table -
      every line linking to a photo region, a roster row, a confirmation, or the MOM rule.

0:55  "Now what?" Tap "help me raise this". Mandate: level 2, draft and track.
      The agent drafts the message - Bengali left, English right - and reads it aloud.
      Mei Ling taps approve. Status: SENT, 14:32. "It could not send without that tap."

1:10  "Next month." Upload payslip #2. Same readers. Same engines.
      Path A: "CORRECTED - an OT adjustment of $62.24 appears; the month-1 gap closes to $0.00."
      Path B: "NOT CORRECTED - the gap stands at $62.24. Escalation pack ready: TADM's evidence
              list and a pre-filled CPF Board under-payment report. She files. We don't."
      Run whichever the room needs. Both fixtures exist.

1:25  "AI reads. Code calculates. The worker decides. The agent follows through -
      within limits the worker set."

Q&A offer, not in the 90 seconds: "Want to change any number on that roster?" - the judge picks,
one component turns orange and recomputes, the rest stay untouched.

If Rahim is the better persona for the room (migrant worker, Challenge #1's sharpest case), run the
same script with his fixture: identical OT beat; the CPF line reads "No CPF: Work Permit holder"
- and say that out loud. Judges will notice you knew.

If it breaks: "let me show you the recorded run", play the video. Do not debug on stage.
