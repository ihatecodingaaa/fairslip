"""The demo reset is one action, and the script and the code agree what it is.

Setup step 2 exists because the language, text size and contrast controls
persist per browser profile, and a rehearsal that ended in Tamil leaves the
scripted run looking for English that is no longer on the screen. The remedy has
to survive being performed by a tired person at 09:55 in a room full of people,
so it is a URL rather than a procedure.

Two things can go wrong with that, and neither is visible from inside one file:

  1. The script names a URL the code does not implement - a renamed parameter,
     a different value - and the step silently does nothing. The presenter's
     confirmation is that the interface looks English, which it will not be.
  2. The reset stops clearing everything. A reset written as "set language to
     English" resets one of three preferences and goes on looking correct until
     someone rehearses at 150% text.

Both sides are read here.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
PREFS = REPO / "frontend" / "app" / "ui" / "Prefs.tsx"
SCRIPT = REPO / "docs" / "demo-script.md"


def _const(name: str, source: str) -> str:
    m = re.search(rf'const {name} = "([^"]+)";', source)
    assert m, f"{name} not found in {PREFS.name}"
    return m.group(1)


def test_the_reset_url_in_the_demo_script_is_the_one_the_code_implements() -> None:
    prefs = PREFS.read_text(encoding="utf-8")
    fragment = f"?{_const('RESET_PARAM', prefs)}={_const('RESET_VALUE', prefs)}"
    script = SCRIPT.read_text(encoding="utf-8")
    assert fragment in script, (
        f"the code implements {fragment} and docs/demo-script.md does not name it; "
        f"the setup step would look performed and do nothing"
    )
    assert f"/check{fragment}" in script, "the setup step should open /check, where the run starts"


def test_the_reset_reads_that_parameter_from_the_address_bar() -> None:
    """Loudness guard: the two constants above could exist and be unused."""
    prefs = PREFS.read_text(encoding="utf-8")
    assert "URLSearchParams(window.location.search)" in prefs
    assert "resetRequested()" in prefs, "nothing calls the check"


def test_the_reset_clears_every_stored_preference_rather_than_naming_one() -> None:
    """Derived from the stored type, so a fourth preference is covered by
    construction - or this fails.

    Clearing the KEY is what makes that true. A reset that wrote defaults field
    by field would reset the fields it knew about on the day it was written."""
    prefs = PREFS.read_text(encoding="utf-8")
    stored = re.search(r"type Stored = \{([^}]*)\}", prefs)
    assert stored, "the Stored type was not found"
    fields = re.findall(r"(\w+):", stored.group(1))
    assert len(fields) >= 3, f"expected the three controls, found {fields}"

    clear = re.search(r"function clearStorage\(\) \{(.*?)\n\}", prefs, re.DOTALL)
    assert clear, "clearStorage() was not found"
    body = clear.group(1)
    assert "localStorage.removeItem(STORE)" in body, "the reset must remove the key itself"
    named = [f for f in fields if re.search(rf"\b{f}\b", body)]
    assert not named, f"the reset names individual preferences ({named}) instead of clearing all"


def test_the_script_does_not_send_the_presenter_to_a_console() -> None:
    """The step it replaced was: read three controls, click the wrong ones, or
    open DevTools and remove a storage key. Warming the deployment is already a
    twenty-second procedure at 09:55; the second procedure is the one that gets
    skipped. If this ever needs to come back, it should come back deliberately.
    """
    script = SCRIPT.read_text(encoding="utf-8")
    assert "localStorage.removeItem" not in script, (
        "docs/demo-script.md tells the presenter to run a storage command; the reset "
        "is meant to be one action"
    )
