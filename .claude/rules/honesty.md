# Honesty contract

The governing rule: nothing the system outputs may assert a fact the system did not establish.

## In code

- A function may only return / log / render a success state on a path where the
  success condition was actually checked.
- No placeholder values that look real (fake IDs, fake hashes, fake timestamps,
  fake confidence scores, fake percentages).
- If a value is unknown, the type must be able to express "unknown". Do not
  substitute a default that reads as a real value.
- Error paths must not be swallowed into a generic success.

## In UI copy

- Do not write "Confirmed", "Delivered", "Booked", "Verified" unless the state
  came from a check that established it.
- Prefer explicit unverified states: "Submitted - not yet confirmed", with a
  timestamp of the last check.

## In tests

- A test name that quantifies ("all", "every", "any") must derive its cases from
  the type system or a generator, not check one hand-picked instance.
- A test that asserts equality between two objects must state which canonical
  form it is comparing.

## In your own output to me

- Distinguish what you ran from what you inferred.
- If you did not run it, say so.
- If a doc or API might have changed, say "verify in docs" rather than asserting.
