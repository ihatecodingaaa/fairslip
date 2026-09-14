"""The concept prototype, checked from this side of the wire.

WHY A BACKEND TEST GUARDS A FRONTEND CONCEPT. Two reasons, and both are the
reason test_design_tokens.py, test_charts.py and test_provenance.py already
reach into frontend/:

  1. THE CLAIM SPANS THE REPO. Every figure in
     frontend/lib/concept-preflight/ruleDerived.ts says it came out of
     fairslip/rules.py or fairslip/cpf.py, and the only place that claim can be
     checked is here, where those engines are importable. Every entry in that
     table is recomputed below from the inputs recorded beside it, and the key
     set is asserted in BOTH directions - so a hand-edited digit fails, and a
     new rule-derived figure added without a test fails too.

     NO COUNT IS WRITTEN DOWN HERE. An earlier draft of this paragraph said
     thirty-nine and the table held forty. A number in prose beside a set the
     code already compares is a second, weaker claim about the same thing, and
     it is the one that goes stale.

  2. THIS IS THE SUITE THE GATE RUNS. The concept has a real test suite of its
     own, executed by node, and this module runs it as a subprocess so that a
     red invariant stops a turn rather than waiting for someone to remember.

WHAT IS DELIBERATELY NOT CHECKED HERE. Whether the screens look right. That is
browser work and it was done in a browser; a Python test asserting that a
paragraph exists is a test of a string, not of a page.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from datetime import date
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal
from pathlib import Path

import pytest

from fairslip.cpf import (
    AgeBand,
    Residency,
    band_for,
    cpf_contribution,
    cpf_shortfall,
    shortfall_split,
)
from fairslip.rules import (
    daily_rate,
    hourly_basic_rate,
    overtime_pay,
    rest_day_pay,
    to_cents,
)

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND = REPO / "frontend"
LIB = FRONTEND / "lib" / "concept-preflight"
APP = FRONTEND / "app" / "concept" / "preflight"
RULE_DERIVED_TS = LIB / "ruleDerived.ts"
COPILOT_ROUTE = FRONTEND / "app" / "api" / "concept" / "preflight" / "copilot"


def concept_sources() -> list[Path]:
    """Every file the concept owns. Both halves, because the copy rules and the
    network rules apply to the data as much as to the screens.

    THE ROUTE IS IN HERE TOO. The Brief's endpoint lives outside app/concept/
    because Next resolves API routes by path, and a file that reads a
    credential is the last one that should sit outside the scans."""
    files = (
        sorted(LIB.rglob("*.ts"))
        + sorted(APP.rglob("*.tsx"))
        + sorted(LIB.rglob("*.mjs"))
        + sorted(COPILOT_ROUTE.rglob("*.ts"))
    )
    assert files, "no concept sources found; every scan below would pass by examining nothing"
    return files


# The three files that are allowed to reach the network, named rather than
# pattern-matched: the point of the list is that it is short and that adding to
# it is a deliberate act somebody reviews.
BRIEF_FILES = {
    "lib/concept-preflight/copilotServer.ts",
    "app/concept/preflight/FairSlipBrief.tsx",
    "app/api/concept/preflight/copilot/route.ts",
}


def deterministic_sources() -> list[Path]:
    """The concept minus the Brief: everything that must work with no network,
    no key and no provider. It is the whole product except one button.

    TEST FILES ARE EXCLUDED HERE AND NOWHERE ELSE. They run under node, ship to
    no browser, and the Brief's own suite has to unset an environment variable
    to prove the no-key path works. That they stay OFF the network is asserted
    separately, in test_only_the_brief_reaches_the_network_and_nothing_else_does.
    """
    return [
        p
        for p in concept_sources()
        if p.relative_to(FRONTEND).as_posix() not in BRIEF_FILES
        and not p.name.endswith(".test.ts")
    ]


def _blank(match: re.Match[str]) -> str:
    """Replace a span with the same number of newlines.

    LINE NUMBERS HAVE TO SURVIVE THE STRIPPING. The first version of this module
    deleted comments outright and then reported line numbers of the remainder,
    which sent a reader to the wrong line of the right file. A test that points
    at the wrong place is worse than one that points at nothing.
    """
    return "\n" * match.group(0).count("\n")


def strip_comments(src: str) -> str:
    """Read the code, not the prose about it.

    The same reason test_design_tokens.py has one of these: several assertions
    below look for the ABSENCE of a word, and the comments in these files
    discuss the words by name. A test that fails on its own explanation teaches
    people to delete the explanation."""
    src = re.sub(r"/\*.*?\*/", _blank, src, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", "", src)


# A `quote:` field of a RuleReference, however many concatenated string literals
# it is written across.
_QUOTE_FIELD = re.compile(r'quote:\s*(?:"[^"]*"\s*\+?\s*)+,', re.DOTALL)


def strip_authority_quotes(src: str) -> str:
    """Take out what MOM and CPF Board say in their own words.

    THE PRODUCT MAY QUOTE AN AUTHORITY AND MAY NOT SPEAK LIKE ONE. MOM's page
    says "your employer must pay you at least 1.5 times the hourly basic rate of
    pay", and that sentence belongs on a screen, attributed, in quotation marks:
    it is the evidence behind every overtime figure in the concept. What
    FairSlip may not do is write those words in its own voice about one person's
    pay.

    So the forbidden-word scan skips the `quote:` field of a RuleReference and
    nothing else, and test_every_quoted_rule_is_attributed checks that each of
    those fields carries an authority, a page and a URL. The carve-out is narrow
    enough to be safe, and it is itself asserted rather than trusted.
    """
    return _QUOTE_FIELD.sub(_blank, src)


# The FORBIDDEN_WORDS table in lib/concept-preflight/copilot.ts: the list the
# Brief's own output guard checks against.
_GUARD_TABLE = re.compile(
    r"export const FORBIDDEN_WORDS = \[.*?\] as const;", re.DOTALL
)


def strip_guard_table(src: str) -> str:
    """Take out the list of words the Brief refuses to print.

    THE SAME CARVE-OUT AS THE AUTHORITY QUOTES, FOR THE SAME REASON. A guard has
    to name what it forbids. copilot.ts declares the words so that
    `findForbiddenWord` can refuse an answer containing one, and a copy scan
    that failed on the guard would be a scan that made the guard impossible to
    write. The carve-out is one array literal wide, and
    test_the_briefs_guard_still_names_the_words_it_refuses asserts the table is
    still there and still complete - so deleting the guard to pass this scan
    fails a different test.
    """
    return _GUARD_TABLE.sub(_blank, src)


def scannable(path: Path) -> str:
    """One file, with the prose about it and the authorities' own words removed."""
    return strip_guard_table(
        strip_authority_quotes(strip_comments(path.read_text(encoding="utf-8")))
    )


# ---------------------------------------------------------------------------
# 1. every rule-derived figure is what the engines actually return
# ---------------------------------------------------------------------------

MEILING_BASIC = Decimal("2100.00")
SITI_BASIC = Decimal("1900.00")
RAVI_BASIC = Decimal("2400.00")
JONATHAN_BASIC = Decimal("2200.00")
HUILING_BASIC = Decimal("2600.00")
AHMAD_BASIC = Decimal("2800.00")
EIGHT_HOURS = Decimal(8)


def _ot(basic: Decimal, hours: str) -> tuple[Decimal, str, str]:
    value = overtime_pay(basic, Decimal(hours))
    formula = f"({hourly_basic_rate(basic):.4f}/h) x 1.5 x {Decimal(hours)}h"
    return value, "fairslip/rules.py overtime_pay", formula


def _cpf(ow: str, band: AgeBand, field: str) -> tuple[Decimal, str, str]:
    result = cpf_contribution(Decimal(ow), band, Residency.CITIZEN)
    return getattr(result, field), "fairslip/cpf.py cpf_contribution", result.formula


def _recheck(field: str) -> tuple[Decimal, str, str]:
    delta = cpf_shortfall(
        Decimal("2130.63"), Decimal("2211.40"), AgeBand.UP_TO_55, Residency.CITIZEN
    )
    return (
        getattr(delta, field),
        "fairslip/cpf.py cpf_shortfall",
        "CPF on the corrected Ordinary Wage 2211.40 less CPF on the 2130.63 the register used",
    )


def _split(field: str) -> tuple[Decimal, str, str]:
    s = shortfall_split(
        Decimal("2130.63"), Decimal("2211.40"), AgeBand.UP_TO_55, Residency.CITIZEN
    )
    return (
        getattr(s, field),
        "fairslip/cpf.py shortfall_split",
        (
            "shortfall_split on Ordinary Wages 2130.63 and 2211.40, "
            "age band 55 and below, Citizen"
        ),
    )


def _rest_day(
    basic: Decimal, dpw: int, hours: str, who: str, formula: str
) -> tuple[Decimal, str, str]:
    value = rest_day_pay(basic, dpw, Decimal(hours), EIGHT_HOURS, who)  # type: ignore[arg-type]
    return value, "fairslip/rules.py rest_day_pay", formula


def expected_table() -> dict[str, tuple[Decimal, str, str]]:
    """What the engines give, keyed exactly as the concept keys them.

    Every entry runs the PRODUCTION function. Nothing here reimplements a rate,
    a ceiling or a rounding rule; the two exceptions are marked, and both of
    them are fabricating an employer's MISTAKE rather than computing a result -
    the same thing backend/demo/employer_roster.py does when it seeds one.
    """
    meiling_rest = rest_day_pay(MEILING_BASIC, 6, EIGHT_HOURS, EIGHT_HOURS, "employer")
    siti_expected = overtime_pay(SITI_BASIC, Decimal("14.0"))
    huiling_rest = rest_day_pay(HUILING_BASIC, 5, Decimal(5), EIGHT_HOURS, "employee")

    # The two figures the concept's registers state that the engine would never
    # produce: CPF at the band the employer did NOT move to, and CPF with the
    # Ordinary Wage ceiling not applied. They are inputs to a check.
    band_missed = cpf_contribution(Decimal("4200.00"), AgeBand.UP_TO_55, Residency.CITIZEN)
    uncapped_total = (Decimal("9400.00") * Decimal(37) / 100).quantize(
        Decimal(1), rounding=ROUND_HALF_UP
    )

    table: dict[str, tuple[Decimal, str, str]] = {
        "meiling.hourly": (
            hourly_basic_rate(MEILING_BASIC),
            "fairslip/rules.py hourly_basic_rate",
            "(12 x 2100.00) / (52 x 44)",
        ),
        "meiling.daily": (
            daily_rate(MEILING_BASIC, 6),
            "fairslip/rules.py daily_rate",
            "(12 x 2100.00) / (52 x 6)",
        ),
        "meiling.restday.expected": _rest_day(
            MEILING_BASIC, 6, "8", "employer", "rest-day table, employer's request, 8h of 8h, 6-day week"
        ),
        "meiling.restday.difference": (
            meiling_rest - Decimal("80.77"),
            "fairslip/rules.py rest_day_pay",
            "rest-day table less the 80.77 the register states",
        ),
        "meiling.ot.03sep": _ot(MEILING_BASIC, "2.0"),
        "meiling.ot.05sep": _ot(MEILING_BASIC, "2.0"),
        "meiling.ot.11sep": _ot(MEILING_BASIC, "1.5"),
        "meiling.ot.24sep": _ot(MEILING_BASIC, "2.5"),
        "meiling.ot.sep": _ot(MEILING_BASIC, "8.0"),
        "meiling.ot.aug": _ot(MEILING_BASIC, "6.0"),
        "meiling.cpf.employee.aug": _cpf("2239.13", AgeBand.UP_TO_55, "employee"),
        "meiling.cpf.employee.sep": _cpf("2130.63", AgeBand.UP_TO_55, "employee"),
        "meiling.cpf.recheck.total": _recheck("total"),
        "meiling.cpf.recheck.employee": _recheck("employee"),
        "meiling.cpf.recheck.employer": _recheck("employer"),
        "meiling.split.gross": _split("gross_shortfall"),
        "meiling.split.cash": _split("cash_shortfall"),
        "meiling.split.cpf": _split("cpf_shortfall"),
        "meiling.split.employerShare": _split("employer_cpf_on_shortfall"),
        "meiling.split.total": _split("total_withheld"),
        "siti.ot.expected": _ot(SITI_BASIC, "14.0"),
        "siti.ot.paidBasis": _ot(SITI_BASIC, "9.0"),
        "siti.ot.difference": (
            siti_expected - Decimal("134.53"),
            "fairslip/rules.py overtime_pay",
            "overtime on 14.0h less the 134.53 the register states",
        ),
        "ravi.ot.expected": _ot(RAVI_BASIC, "78"),
        "jonathan.restday.employer": _rest_day(
            JONATHAN_BASIC, 6, "7", "employer",
            "rest-day table, employer's request, 7h of 8h, 6-day week",
        ),
        "jonathan.restday.employee": _rest_day(
            JONATHAN_BASIC, 6, "7", "employee",
            "rest-day table, employee's request, 7h of 8h, 6-day week",
        ),
        "boonkeng.cpf.total": _cpf("4200.00", AgeBand.ABOVE_55_TO_60, "total"),
        "boonkeng.cpf.employee": _cpf("4200.00", AgeBand.ABOVE_55_TO_60, "employee"),
        "boonkeng.cpf.employer": _cpf("4200.00", AgeBand.ABOVE_55_TO_60, "employer"),
        "boonkeng.cpf.difference": (
            cpf_contribution(
                Decimal("4200.00"), AgeBand.ABOVE_55_TO_60, Residency.CITIZEN
            ).total
            - band_missed.total,
            "fairslip/cpf.py cpf_contribution",
            "CPF at the band the employee master gives, less the 1554 the submission states",
        ),
        "grace.cpf.total": _cpf("9400.00", AgeBand.UP_TO_55, "total"),
        "grace.cpf.employee": _cpf("9400.00", AgeBand.UP_TO_55, "employee"),
        "grace.cpf.employer": _cpf("9400.00", AgeBand.UP_TO_55, "employer"),
        "grace.cpf.difference": (
            cpf_contribution(Decimal("9400.00"), AgeBand.UP_TO_55, Residency.CITIZEN).total
            - uncapped_total,
            "fairslip/cpf.py cpf_contribution",
            "CPF on the capped Ordinary Wage, less the 3478 the submission states",
        ),
        "huiling.restday.expected": _rest_day(
            HUILING_BASIC, 5, "5", "employee",
            "rest-day table, employee's request, 5h of 8h, 5-day week",
        ),
        "huiling.restday.difference": (
            huiling_rest - Decimal("240.00"),
            "fairslip/rules.py rest_day_pay",
            "rest-day table less the 240.00 the corrected register states",
        ),
        "huiling.ot.sep": _ot(HUILING_BASIC, "4.0"),
        "huiling.cpf.employee": _cpf("2801.82", AgeBand.UP_TO_55, "employee"),
        "ahmad.ot.sep": _ot(AHMAD_BASIC, "12.0"),
        "ahmad.cpf.employee": _cpf("3064.34", AgeBand.UP_TO_55, "employee"),
    }
    return table


_ENTRY = re.compile(
    r'"(?P<key>[A-Za-z0-9.]+)":\s*\{\s*'
    r'money:\s*\{\s*exact:\s*"(?P<exact>[^"]+)",\s*display:\s*"(?P<display>[^"]+)"\s*\},\s*'
    r'call:\s*"(?P<call>[^"]+)",\s*'
    r"formula:(?P<formula>.*?),\s*\n\s*inputs:",
    re.DOTALL,
)


def declared_table() -> dict[str, dict[str, str]]:
    """The concept's own table, parsed out of the TypeScript.

    Textual rather than executed, for the reason test_print_sheet.py parses
    PRINT_OMITTED the same way: there is no JavaScript runtime in this suite,
    and the shape that matters is checkable without one. The parse is asserted
    non-empty and its size is asserted below, so a literal whose shape changed
    fails loudly instead of silently matching nothing.
    """
    src = RULE_DERIVED_TS.read_text(encoding="utf-8")
    out: dict[str, dict[str, str]] = {}
    for m in _ENTRY.finditer(src):
        # A formula may be written as several concatenated string literals.
        formula = "".join(re.findall(r'"([^"]*)"', m.group("formula")))
        out[m.group("key")] = {
            "exact": m.group("exact"),
            "display": m.group("display"),
            "call": m.group("call"),
            "formula": formula,
        }
    assert out, "no rule-derived entries parsed from ruleDerived.ts; the literal's shape changed"
    return out


def test_the_parse_reaches_the_whole_table() -> None:
    """Otherwise every assertion below passes by examining nothing."""
    declared = declared_table()
    expected = expected_table()
    assert len(declared) >= 35, f"only {len(declared)} entries parsed"
    assert len(expected) == len(declared), (
        f"the concept declares {len(declared)} rule-derived figures and this test "
        f"recomputes {len(expected)}"
    )


def test_the_concept_declares_exactly_the_figures_this_test_recomputes() -> None:
    """BOTH DIRECTIONS, and the second one is the one that matters.

    A figure added to the concept and not to this test would be a figure
    labelled RULE-DERIVED on a screen with nothing behind the label - which is
    the defect the label exists to prevent, committed by the mechanism built to
    prevent it.
    """
    declared = set(declared_table())
    recomputed = set(expected_table())
    assert declared - recomputed == set(), (
        f"the concept claims these are rule results and nothing here checks them: "
        f"{sorted(declared - recomputed)}"
    )
    assert recomputed - declared == set(), (
        f"this test recomputes figures the concept no longer draws: "
        f"{sorted(recomputed - declared)}"
    )


@pytest.mark.parametrize("key", sorted(expected_table()))
def test_every_rule_derived_figure_is_what_the_engine_returns(key: str) -> None:
    """The digits in the concept are the engines' digits, to the last place."""
    value, call, formula = expected_table()[key]
    declared = declared_table()[key]

    assert declared["exact"] == str(value), (
        f"{key}: the concept states {declared['exact']} and "
        f"{call} returns {value}"
    )
    assert declared["display"] == f"{to_cents(value) + Decimal(0):.2f}", (
        f"{key}: the cents on screen are not what to_cents() gives for {value}"
    )
    assert declared["call"] == call, f"{key}: attributed to {declared['call']}, produced by {call}"
    assert declared["formula"] == formula, (
        f"{key}: the formula shown is not the engine's own.\n"
        f"  shown:  {declared['formula']}\n"
        f"  engine: {formula}"
    )


def test_the_age_band_the_concept_shows_is_the_one_the_rule_gives() -> None:
    """The step-up rule, not a birthday.

    CPF Board: new rates apply from the first day of the month AFTER the 55th
    birthday. The concept's EMP-0173 was born 14 August 1971, so August is still
    the under-55 band and September is not. If band_for() ever disagreed, the
    finding would be reporting a rate change that had not happened yet.
    """
    dob = date(1971, 8, 14)
    assert band_for(dob, date(2026, 8, 1)) is AgeBand.UP_TO_55
    assert band_for(dob, date(2026, 9, 1)) is AgeBand.ABOVE_55_TO_60


def test_the_employers_mistakes_are_inputs_and_are_not_what_the_engine_gives() -> None:
    """The two figures the concept's registers state that no engine produced.

    They are fabricated on purpose - a payroll system that missed an age band
    and one that missed the Ordinary Wage ceiling - exactly as
    backend/demo/employer_roster.py fabricates the errors it seeds. This asserts
    they are NOT the engine's answer, because a seeded mistake that happened to
    equal the correct figure would make the finding vanish.
    """
    correct_band = cpf_contribution(
        Decimal("4200.00"), AgeBand.ABOVE_55_TO_60, Residency.CITIZEN
    )
    missed_band = cpf_contribution(Decimal("4200.00"), AgeBand.UP_TO_55, Residency.CITIZEN)
    assert missed_band.total == Decimal(1554), "the register states 1554.00 for EMP-0173"
    assert correct_band.total != missed_band.total

    capped = cpf_contribution(Decimal("9400.00"), AgeBand.UP_TO_55, Residency.CITIZEN)
    uncapped = (Decimal("9400.00") * Decimal(37) / 100).quantize(
        Decimal(1), rounding=ROUND_HALF_UP
    )
    uncapped_employee = (Decimal("9400.00") * Decimal(20) / 100).quantize(
        Decimal(1), rounding=ROUND_DOWN
    )
    assert uncapped == Decimal(3478), "the submission states 3478.00 for EMP-0231"
    assert uncapped_employee == Decimal(1880), "and an employee share of 1880.00"
    assert capped.total != uncapped
    assert capped.ow_used == Decimal(8000)


def test_the_concept_encodes_no_rule_the_product_does_not_already_have() -> None:
    """A product concept may not widen a statutory rule pack.

    Every engine the concept attributes a figure to has to be a function that
    already exists in the production packs. A new name here would mean someone
    had written a rule to make a screen work, which is the one thing section 36
    of this concept's brief forbids and the one that is not recoverable at a
    payroll desk.
    """
    from fairslip import cpf, rules

    for entry in declared_table().values():
        module, function = entry["call"].split(" ")
        assert module in {"fairslip/rules.py", "fairslip/cpf.py"}, entry["call"]
        owner = rules if module.endswith("rules.py") else cpf
        assert hasattr(owner, function), (
            f"the concept attributes a figure to {entry['call']}, which does not exist"
        )


# ---------------------------------------------------------------------------
# 2. the concept's own suite, run
# ---------------------------------------------------------------------------


def test_the_concept_fixture_invariants_pass() -> None:
    """The node suite, executed, so a red invariant reaches the gate.

    NOT A SKIP IF NODE IS MISSING. gate.sh's own rule is that a check which
    announces it did not run is the least a gate may do; a green line for a
    suite nobody executed is worse than no line. This repo cannot be built
    without node, so its absence is a broken environment rather than a
    configuration to tolerate.
    """
    node = shutil.which("node")
    assert node, (
        "node is not on PATH, so the concept's fixture invariants were not run. "
        "They are the checks that prove the counts on those screens are counted."
    )
    result = subprocess.run(
        [
            node,
            "--import",
            "./lib/concept-preflight/testResolver.mjs",
            "--test",
            "lib/concept-preflight/*.test.ts",
        ],
        cwd=FRONTEND,
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    assert result.returncode == 0, (
        "the concept's fixture invariants failed:\n"
        + result.stdout[-4000:]
        + "\n"
        + result.stderr[-2000:]
    )
    assert "# fail 0" in result.stdout or "fail 0" in result.stdout, (
        f"the node runner did not report a pass count:\n{result.stdout[-2000:]}"
    )


# ---------------------------------------------------------------------------
# 3. the copy rules
# ---------------------------------------------------------------------------

# Words this concept may not use about anyone's pay. The first group is the
# product's own forbidden list from .claude/rules/fairslip-domain.md; the rest
# are the ones a prototype reaches for when it wants to sound finished.
FORBIDDEN = [
    "underpaid",
    "owed",
    "breach",
    "illegal",
    "entitled to",
    "must pay",
    "fraud",
    "fake",
    "compliant",
    "certified",
    "MOM approved",
    "CPF approved",
    "guaranteed",
    "money saved",
    "saved money",
    "prevented loss",
    "autonomous",
    "agentic",
    "multi-agent",
    "orchestration",
]


@pytest.mark.parametrize("word", FORBIDDEN)
def test_the_concept_never_says(word: str) -> None:
    """Copy discipline, enforced rather than reviewed.

    Comments are stripped first: these files discuss several of these words by
    name, in capitals, explaining why they are absent. A test that failed on its
    own explanation would teach the next person to delete the explanation.
    """
    # WORD BOUNDARIES, because "allowed" contains "owed" and a substring scan
    # reported a Tailwind class as a copy violation. A test with a false
    # positive is a test people learn to route around.
    pattern = re.compile(rf"\b{re.escape(word)}\b", re.IGNORECASE)
    hits = []
    # TEST FILES ARE EXCLUDED FROM THE COPY SCAN AND FROM NOTHING ELSE IN
    # THIS MODULE. This rule is about what the concept SAYS to a reader, and
    # a suite renders nothing to anybody; the tests that prove the Brief
    # refuses "underpaid" have to write "underpaid" to do it, the same way
    # this module has to contain an em dash in order to look for one.
    scanned = [p for p in concept_sources() if not p.name.endswith(".test.ts")]
    assert len(scanned) >= 10, "the copy scan is not reaching the concept"
    for path in scanned:
        for n, text in enumerate(scannable(path).splitlines(), 1):
            if pattern.search(text):
                hits.append(f"{path.relative_to(REPO)}:{n}: {text.strip()[:90]}")
    assert not hits, f"the concept uses {word!r} at {hits}"


def test_no_em_dash_anywhere_in_the_concept() -> None:
    """One punctuation mark, banned by the brief, checked rather than promised.

    THE DOCS ARE SCANNED TOO. The talk track is read aloud off a laptop and the
    README is the first thing anyone opens; both are as much a part of this
    concept as a screen is. This module is excluded from its own scan, because
    the character has to appear here to be looked for.
    """
    docs = sorted((REPO / "docs-concept").rglob("*.md"))
    assert docs, "no concept docs found; this test would pass by examining nothing"
    hits = []
    for path in concept_sources() + docs:
        for n, text in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "—" in text:
                hits.append(f"{path.relative_to(REPO)}:{n}")
    assert not hits, f"an em dash survives at {hits}"


def test_the_concept_declares_what_it_is_in_two_claims_that_stay_on_screen() -> None:
    """Both halves of the label, and the label pinned to the viewport.

    THE STICKINESS IS PART OF THE CLAIM. A badge that scrolls away is a badge
    that is absent from every screenshot taken below the fold, which is most of
    them. The ribbon is `sticky top-0`, so it is on screen whatever anyone is
    looking at, and it costs a line of layout rather than sitting on top of the
    content - which is what the floating version it replaced did at 390px.
    """
    badge = (APP / "ConceptBadge.tsx").read_text(encoding="utf-8")
    assert 'WHAT_IT_IS = "Concept prototype"' in badge
    assert 'WHAT_THE_DATA_IS = "Fictional Singapore company data"' in badge
    ribbon = re.search(r"export function ConceptRibbon\(\)(.*?)\n}", badge, re.DOTALL)
    assert ribbon, "the persistent ribbon is gone"
    assert "sticky top-0" in ribbon.group(1), "the ribbon no longer stays on screen"
    assert "{WHAT_IT_IS}" in ribbon.group(1) and "{WHAT_THE_DATA_IS}" in ribbon.group(1), (
        "the ribbon does not render both claims"
    )

    shell = (APP / "PreflightShell.tsx").read_text(encoding="utf-8")
    assert "<ConceptRibbon />" in shell, "the shell does not render the ribbon"

    # And the longer disclosure is on the page as well, saying more rather than
    # the same thing again. Whitespace is collapsed first: JSX wraps prose at
    # the print margin, so "no employee record is real" is four lines in the
    # source and one sentence on the screen.
    flat = " ".join(shell.split())
    for phrase in (
        "not a deployed integration",
        "no model was called",
        "no employee record is real",
    ):
        assert phrase in flat, f"the footer disclosure lost {phrase!r}"


def test_the_deterministic_concept_makes_no_network_call() -> None:
    """Everything except one button works with no network and no key.

    THIS TEST USED TO COVER THE WHOLE CONCEPT AND SAID SO, and that stopped
    being true the day the FairSlip Brief was added. Weakening the assertion to
    cover the new files would have quietly retired the strongest constraint on
    this prototype; deleting it would have retired it loudly. So it is scoped
    instead: the deterministic product - every count, every rule figure, every
    screen, the whole workforce map - still reaches nothing, and the three files
    that do are named in BRIEF_FILES and held to their own test below.

    A prototype that cannot be shown on a laptop with no network is a prototype
    that cannot be shown, and that is still true of everything this covers.
    """
    banned = (
        "fetch(",
        "XMLHttpRequest",
        "axios",
        "EventSource",
        "navigator.sendBeacon",
        "API_BASE",
        "process.env",
        "localStorage",
        "sessionStorage",
    )
    scanned = deterministic_sources()
    assert len(scanned) >= 10, "the scan is not reaching the concept"
    hits = []
    for path in scanned:
        for n, text in enumerate(scannable(path).splitlines(), 1):
            for token in banned:
                if token in text:
                    hits.append(f"{path.relative_to(REPO)}:{n}: {token}")
    assert not hits, f"the concept reaches outside the page: {hits}"


def test_only_the_brief_reaches_the_network_and_nothing_else_does() -> None:
    """The three files that may call out, and the two places they may call to.

    BROWSER SIDE, one same-origin path on this app. SERVER SIDE, one provider
    endpoint. Nothing else, from anywhere - no telemetry, no third-party font,
    no analytics, and no second provider quietly added later.
    """
    for name in BRIEF_FILES:
        assert (FRONTEND / name).exists(), f"{name} is named as a Brief file and is not there"

    allowed = {
        "/api/concept/preflight/copilot",  # this app, same origin
        "https://api.anthropic.com/v1/messages",  # the provider
    }
    found = set()
    for name in BRIEF_FILES:
        src = scannable(FRONTEND / name)
        for url in re.findall(r'"(https?://[^"]+|/api/[^"]+)"', src):
            found.add(url)
    assert found <= allowed, f"the Brief reaches somewhere new: {sorted(found - allowed)}"
    assert found == allowed, f"a destination went missing: {sorted(allowed - found)}"

    # The suites stay offline. They are excluded from the deterministic scan so
    # that the Brief's own tests can set an environment variable; that exemption
    # is not a licence to call anything.
    for path in concept_sources():
        if not path.name.endswith(".test.ts"):
            continue
        src = scannable(path)
        for token in ("fetch(", "XMLHttpRequest", "axios", "navigator.sendBeacon"):
            assert token not in src, f"{path.relative_to(REPO)} calls {token} in a test"

    # And no browser storage anywhere in the concept, Brief included: nothing
    # here is allowed to remember a reader between visits.
    for path in concept_sources():
        src = scannable(path)
        for token in ("localStorage", "sessionStorage", "document.cookie"):
            assert token not in src, f"{path.relative_to(REPO)} uses {token}"


def test_no_credential_can_reach_the_browser() -> None:
    """The key is read on the server, and the browser learns one boolean.

    THREE SEPARATE WAYS THIS COULD GO WRONG, all checked. A NEXT_PUBLIC_ name
    would ship the value into the bundle. Reading process.env inside a "use
    client" file would do the same. And logging it would put it in a place
    nobody is watching.
    """
    for path in concept_sources():
        src = scannable(path)
        rel = path.relative_to(REPO)
        assert "NEXT_PUBLIC" not in src, f"{rel} declares a public environment name"

        if 'process.env' in src:
            assert '"use client"' not in src, f"{rel} reads the environment in a client component"

        # The value, never the name: `process.env.ANTHROPIC_API_KEY` beside a
        # console call is the one line that turns a secret into a log.
        for n, text in enumerate(src.splitlines(), 1):
            if "ANTHROPIC_API_KEY" in text:
                assert "console." not in text, f"{rel}:{n} logs the credential"

    # The server reads it in exactly one module, so there is one place to audit.
    readers = [
        p.relative_to(FRONTEND).as_posix()
        for p in concept_sources()
        if "ANTHROPIC_API_KEY" in scannable(p) and not p.name.endswith(".test.ts")
    ]
    assert readers == ["lib/concept-preflight/copilotServer.ts"], readers


def test_the_briefs_guard_still_names_the_words_it_refuses() -> None:
    """The carve-out in strip_guard_table() is safe only while this passes.

    The copy scan skips the FORBIDDEN_WORDS array so that the guard can name
    what it forbids. That carve-out would also hide a guard somebody had
    emptied, so the table is asserted here instead: it exists, and it still
    covers every word about pay that this product refuses to say.
    """
    src = (LIB / "copilot.ts").read_text(encoding="utf-8")
    table = re.search(r"export const FORBIDDEN_WORDS = \[(.*?)\] as const;", src, re.DOTALL)
    assert table, "the Brief's output guard has no word list"
    listed = set(re.findall(r'"([^"]+)"', table.group(1)))

    # The words about somebody's pay. The backend list also carries words about
    # the SYSTEM - "autonomous", "orchestration" - which a model answering about
    # a payroll month has no occasion to use and which the copy scan already
    # holds every file to, this one included.
    about_pay = {
        "underpaid", "owed", "breach", "illegal", "entitled to", "must pay",
        "fraud", "compliant", "certified", "guaranteed",
    }
    assert about_pay <= listed, f"the guard no longer refuses {sorted(about_pay - listed)}"

    # And it refuses the two this concept adds for itself: a claim the
    # arithmetic has not closed, and a saving nobody measured.
    assert "resolved" in listed
    assert "saved money" in listed


def test_the_concept_reads_no_clock() -> None:
    """A fixed fictional date, so "payroll closes tomorrow" stays true and a
    screenshot taken today still matches the page next year."""
    banned = ("Date.now(", "new Date(", "Math.random(")
    hits = []
    for path in concept_sources():
        for n, text in enumerate(scannable(path).splitlines(), 1):
            for token in banned:
                if token in text:
                    hits.append(f"{path.relative_to(REPO)}:{n}: {token}")
    assert not hits, f"the concept is not deterministic: {hits}"


def test_no_identifier_in_the_concept_looks_like_an_nric_or_fin() -> None:
    """Fictional identifiers have to be fictional in SHAPE as well as in value.

    EMP-0001 cannot be mistaken for anything. A seven-digit number between a
    letter and a checksum letter can.
    """
    nric = re.compile(r"\b[STFGM]\d{7}[A-Z]\b")
    hits = []
    for path in concept_sources():
        for n, text in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if nric.search(text):
                hits.append(f"{path.relative_to(REPO)}:{n}")
    assert not hits, f"an identifier is shaped like an NRIC or FIN at {hits}"


# ---------------------------------------------------------------------------
# 4. production is untouched
# ---------------------------------------------------------------------------

PRODUCTION_ROUTES = [
    FRONTEND / "app" / "page.tsx",
    FRONTEND / "app" / "ui" / "AppShell.tsx",
    FRONTEND / "app" / "ui" / "Footer.tsx",
]


def test_no_production_screen_links_to_the_concept() -> None:
    """The concept is reached because somebody sent the link, and no other way.

    A link from the live product would put a drawing of an unbuilt workflow one
    tap from a page a worker uses to check their own pay.
    """
    for path in PRODUCTION_ROUTES:
        src = path.read_text(encoding="utf-8")
        assert "/concept" not in src, f"{path.relative_to(REPO)} links to the concept route"


def test_the_concept_route_is_served_by_the_frontend() -> None:
    """vercel.json's catch-all has to reach it.

    If a rewrite ever sent /concept/* to the backend it would be a hard 404 in
    production rather than a fallthrough - the failure test_routes_match_vercel
    was written for, checked here for this route specifically.
    """
    from tests.test_routes_match_vercel import routed_to_backend

    assert not routed_to_backend("/concept/preflight")


def test_the_concept_is_not_indexed() -> None:
    """A search result would carry the headline and not the badge under it."""
    layout = (APP / "layout.tsx").read_text(encoding="utf-8")
    assert "index: false" in layout, "the concept route does not ask to stay out of search"


def test_the_concept_reuses_the_products_own_status_glyphs() -> None:
    """One outcome, one silhouette, across both halves of the product.

    A concept that drew its own circle and its own triangle would be a second
    vocabulary for the same three outcomes, and the first person to see both
    screens in one meeting would have to be told they mean the same thing.
    """
    marks = (APP / "marks.tsx").read_text(encoding="utf-8")
    assert "from \"../../employer/outcomeMark\"" in marks, (
        "the concept no longer reuses the product's shared outcome glyphs"
    )
    assert "OutcomeMark" in marks
    # And the mapping lives in exactly one place.
    others = [p for p in concept_sources() if p.name != "marks.tsx"]
    for path in others:
        assert "NEEDS_REVIEW: \"EXCEPTION\"" not in scannable(path), (
            f"{path.relative_to(REPO)} holds a second copy of the status mapping"
        )


def test_every_quoted_rule_is_attributed() -> None:
    """The carve-out above, checked.

    strip_authority_quotes() lets a forbidden phrase through when it sits in a
    `quote:` field. That is only safe if every such field is a quotation with a
    name on it, so this asserts each RuleReference carries an authority, the
    page it was read from, the date it was read, and a link - and that the
    authorities are the two this product quotes and no others.
    """
    src = (FRONTEND / "lib" / "concept-preflight" / "ruleSources.ts").read_text(
        encoding="utf-8"
    )
    blocks = re.findall(
        r"export const \w+: RuleReference = \{(.*?)\n\};", src, re.DOTALL
    )
    assert len(blocks) >= 6, f"only {len(blocks)} rule references parsed; the shape changed"
    for block in blocks:
        authority = re.search(r'authority:\s*"([^"]+)"', block)
        assert authority and authority.group(1) in {"MOM", "CPF Board"}, block[:120]
        assert re.search(r"quote:", block), block[:120]
        assert re.search(r'page:\s*\w', block), block[:120]
        assert re.search(r'verified:\s*\w', block), block[:120]
        assert re.search(r'url:\s*\w', block), block[:120]

    # And the carve-out reaches exactly the quote fields: with them removed, the
    # file no longer contains the phrase that made the carve-out necessary.
    stripped = strip_authority_quotes(src)
    assert "must pay" in src, "the MOM overtime quote is gone from the concept"
    assert "must pay" not in stripped, "the carve-out no longer removes the quote fields"
