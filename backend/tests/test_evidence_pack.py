"""The pack a worker carries to somebody with authority over them.

WHY THIS ONE IS DIFFERENT FROM EVERY OTHER SURFACE. The employer's review pack
is read by the organisation that produced the numbers. This one is handed by a
migrant worker to an NGO caseworker, a mediator, or an employer - people whose
decisions affect them - and it will be read without the screen, without the
product, and possibly without the page that explains what it is.

So the pack has to say what it is NOT before anyone has to ask, and it may not
acquire the vocabulary of a claim. `docs/debt.md`'s copy contract already
forbids "owed", "underpaid", "breach" and "entitled" across the product; the
sentences here are the pack's own additions to that, and they are asserted
rather than trusted because a paragraph is the easiest thing in a codebase to
soften by one word at a time.

AND IT MAY NOT BE A SECOND RENDER OF THE FIGURES. The printed pack IS the
screen's DOM narrowed by globals.css. A pack that re-stated an amount would be
a copy that can drift from the one the worker was shown - which is the failure
this product exists to find, committed on the artefact it exists to produce.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
PACK = REPO / "frontend" / "app" / "check" / "EvidencePack.tsx"
PAGE = REPO / "frontend" / "app" / "check" / "page.tsx"
I18N = REPO / "frontend" / "lib" / "i18n.ts"
GLOBALS = REPO / "frontend" / "app" / "globals.css"


def _strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", "", src)


def source(path: Path) -> str:
    assert path.is_file(), f"{path} does not exist"
    return _strip_comments(path.read_text(encoding="utf-8"))


def pack_strings() -> dict[str, str]:
    """Every `pack.*` string the English dictionary declares."""
    block = re.search(r"^const en = \{(.*?)^\} as const;", I18N.read_text(encoding="utf-8"), re.DOTALL | re.MULTILINE)
    assert block, "the English dictionary was not found"
    found = dict(re.findall(r'^  "(pack\.[^"]+)":\s*"([^"]*)"', block.group(1), re.MULTILINE))
    assert len(found) >= 10, f"only {len(found)} pack strings; the scan is not reaching them"
    return found


# ------------------------------------------------- 1. it says what it is not


@pytest.mark.parametrize("key", ["pack.notClaim", "pack.notProof", "pack.notLegal"])
def test_the_pack_states_what_it_is_not(key: str) -> None:
    strings = pack_strings()
    assert key in strings, f"{key} is missing; the pack no longer disclaims that"
    assert strings[key].strip(), f"{key} is empty"


def test_those_three_sentences_reach_the_screen() -> None:
    """A disclaimer in the dictionary that nothing renders is a disclaimer the
    worker never sees - the wired-mechanism-does-nothing class, on the one
    surface where it matters most."""
    src = source(PACK)
    for key in ("pack.notClaim", "pack.notProof", "pack.notLegal", "pack.whatItIs"):
        assert key in src, f"{key} is never rendered"


def test_the_pack_does_not_call_itself_a_claim_or_a_filing() -> None:
    """The words a worker might otherwise assume. `notClaim` says "It is not a
    claim", so the scan allows a negated use and forbids a bare one."""
    negated = re.compile(r"(?:\bnot\b|\bnever\b|\bno\b)[\s\w]{0,12}$", re.IGNORECASE)
    forbidden = ["claim", "proof", "evidence of wrongdoing", "case", "complaint", "filing"]
    for key, value in pack_strings().items():
        low = value.lower()
        for word in forbidden:
            at = low.find(word)
            if at < 0:
                continue
            assert negated.search(low[max(0, at - 24) : at]), (
                f"{key} uses {word!r} as a claim rather than a disclaimer: {value!r}"
            )


def test_the_pack_never_uses_the_forbidden_vocabulary() -> None:
    """The product-wide copy contract, applied to the artefact that leaves the
    building. Nothing about these is softenable by context."""
    forbidden = ["owed", "underpaid", "breach", "illegal", "entitled to", "must pay", "wage theft"]
    everything = " ".join(pack_strings().values()).lower() + " " + source(PACK).lower()
    for word in forbidden:
        assert word not in everything, f"the evidence pack says {word!r}"


def test_the_pack_does_not_promise_that_anyone_will_accept_it() -> None:
    """TADM, MOM and CPF Board decide what they accept. A pack that implied
    otherwise would set a worker up for a refusal at a counter."""
    everything = " ".join(pack_strings().values()).lower()
    for phrase in ("accepted by", "recognised by", "official record", "court-ready", "admissible"):
        assert phrase not in everything, f"the pack promises it is {phrase!r}"


# ---------------------------------------------- 2. it is not a second render


def test_the_pack_panel_renders_no_amount_of_its_own() -> None:
    """It is a set of CONTROLS over a sheet that already exists. The moment it
    prints a figure, there are two copies of that figure in the product."""
    src = source(PACK)
    assert "money(" not in src, (
        "the evidence pack renders an amount. The printed sheet is the screen's "
        "own DOM; a second copy of a figure can drift from the first."
    )


def test_printing_is_the_browser_printing_this_page() -> None:
    src = source(PACK)
    assert "window.print()" in src, "the pack does not print the page"
    for library in ("jspdf", "html2canvas", "pdfmake", "puppeteer"):
        assert library not in src.lower(), (
            f"{library} would re-render the figures into a second document with "
            f"its own fonts and its own layout"
        )


def test_the_downloaded_facts_are_the_response_and_not_a_verdict() -> None:
    src = source(PACK)
    assert "facts: inputs" in src, "the download does not carry the facts the engine was given"
    assert "breakdown," in src, "the download does not carry the engine's own breakdown"
    # No interpretation invented on the way out.
    for invented in ("verdict", "score", "confidence", "likelihood", "recommendation"):
        assert invented not in src.lower(), f"the download invents a {invented}"


def test_the_download_carries_the_facts_that_produced_the_figures() -> None:
    """`computedFrom`, not the live answers. An answer edited after the engine
    ran would otherwise be downloaded as the lineage of a figure it never
    touched - the same freeze the money trail already depends on."""
    page = source(PAGE)
    pack_call = re.search(r"<EvidencePack(.*?)/>", page, re.DOTALL)
    assert pack_call, "the pack is not rendered on the check page"
    assert "inputs={computedFrom}" in pack_call.group(1), (
        "the pack is handed the live answers rather than the facts that produced "
        "the breakdown"
    )


# ------------------------------------------- 3. the one-page sheet is honest


def test_the_short_sheet_is_a_print_scope_and_nothing_else() -> None:
    """A preset that hid sections from the SCREEN would make the screen and the
    sheet two accounts of one reconciliation."""
    css = GLOBALS.read_text(encoding="utf-8")
    print_block = css[css.index("@media print {") :]
    assert ".pack-simple .pack-detail" in print_block, (
        "the one-page rule is not inside @media print"
    )
    before_print = css[: css.index("@media print {")]
    assert ".pack-simple" not in before_print, (
        "`pack-simple` is used outside the print scope, so choosing the short "
        "pack changes what is on screen"
    )


def test_the_short_sheet_names_what_it_left_out() -> None:
    """An omission a reader cannot see is a decision made on their behalf - the
    same rule the ScreenOnly registry already runs on."""
    src = source(PACK)
    note = re.search(r"export function PackOmissionNote\((.*?)\n\}", src, re.DOTALL)
    assert note, "PackOmissionNote was not found"
    assert 'preset !== "simple"' in note.group(0), (
        "the omission note does not depend on the short preset, so it either "
        "always claims something was withheld or never does"
    )
    assert "print-only" in note.group(0), "the note is not on the paper"
    assert "pack.simpleOmit" in note.group(0)
    strings = pack_strings()
    for named in ("reader", "arithmetic"):
        assert named in strings["pack.simpleOmit"].lower(), (
            f"the omission note does not name the {named} sections it drops"
        )


def test_every_section_the_short_sheet_drops_is_marked() -> None:
    """The class and the sentence have to describe the same three things."""
    page = source(PAGE)
    reconcile = source(REPO / "frontend" / "app" / "check" / "ReconcileStage.tsx")
    assert "pack-detail" in reconcile, "the arithmetic is not marked as detail-only"
    assert page.count("pack-detail") >= 2, (
        "the evidence lens and the follow-through panel are not both marked"
    )


def test_the_full_pack_is_the_default() -> None:
    """The pack a worker gets without choosing is the complete one. A short
    default would silently drop the readings that make the sheet evidence."""
    page = source(PAGE)
    assert 'useState<PackPreset>("detailed")' in page, (
        "the evidence pack no longer defaults to the full sheet"
    )
