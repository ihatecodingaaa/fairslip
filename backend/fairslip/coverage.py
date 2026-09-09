"""Who FairSlip is for - stated as RULES, because rules are what it encodes.

Nothing on the screen this module feeds says how many workers are in any group.
FairSlip does not know that number, and a population figure would be a claim it
cannot establish - the same claim it refuses to make about a payslip. What it
can state is which published rules it encoded, what each engine does when it is
asked about someone outside them, and how much of its own interface it has
translated. Scope described in rules is also the stronger claim: it says the
reach of this product is a function of the rules in it, not of a story.

EVERY FIELD BELOW COMES FROM ONE OF THREE PLACES, and never from prose:

  1. A QUOTE from MOM or CPF Board, verbatim, with the page it was read from.
     Asserted character-for-character against .claude/rules/mom-pay-rules.md and
     cpf-rules.md by tests/test_coverage.py, so the product and the project's
     quoted-rule files cannot drift apart.
  2. A CONSTANT the engines hold - $2,600, $4,500, $8,000, 72 hours, 50%. Each
     carries the symbol it was read from, and the test reads the same symbol.
  3. AN OUTCOME PRODUCED BY RUNNING AN ENGINE. The residency table is not a
     table: every row is `cpf_contribution()` called with that status, and what
     the row reports is what the call did - contributed, returned NO_CPF, or
     refused with this message. Same for the refusals in `not_encoded`: each one
     names a probe, the probe is RUN, and the reason shown is the engine's own.
     If a probe stops refusing, this module raises rather than serving a claim
     that has become false.

The split between "the engine refuses this" and "the engine cannot be told
about this" is the honest one and it is not cosmetic. A refusal is a decision
the code makes on an input it accepts; an absent input is a month that cannot be
described to FairSlip at all. Both are out of scope, and only one of them can be
demonstrated by typing something in.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from fairslip import cpf, rules
from fairslip.agent import FORBIDDEN_WORDS, REFERENCE_LINKS
from fairslip.cpf import AgeBand, OutOfScopeError, Residency
from fairslip.extract_schema import ALL_FIELDS, WORKER_PROMPTS, WORKER_PROMPTS_I18N


class CoverageError(RuntimeError):
    """Raised when this module can no longer establish something it publishes.

    A pack that quietly dropped a claim it could not prove would be indis-
    tinguishable from a pack whose claims all held. So the failure is loud: the
    endpoint returns nothing rather than a coverage page with a hole in it."""


class CoverageCopyError(ValueError):
    """A FairSlip-authored string on the coverage screen breaks the UI copy
    contract in .claude/rules/fairslip-domain.md."""


# --------------------------------------------------------------------------
# Shapes. `quoted` is always an authority's own words; every other string on
# these objects is FairSlip's and is run through the copy check.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Quote:
    """One published sentence, and the page it was read from.

    `source_label` is required and has no default, for the reason recorded on
    agent.NotBuilt: a quotation whose page is not named is a quotation a reader
    cannot check, and a quote rendered under a nearby heading inherits that
    heading's attribution."""

    quoted: str
    source_url: str
    source_label: str


# What a published value IS, relative to the symbol it names. The unit is not
# only a display hint: it is the contract tests/test_coverage.py checks against
# the engine.
#
#   money / hours / ratio / multiplier   the value IS the constant
#   count                                the value is how many entries the named
#                                        symbol has - a table's rows, a tuple's
#                                        length
#
# `ratio` is stored as the engine stores it (0.5) and rendered as 50%. The
# conversion is display, which is the only arithmetic the API layer is allowed
# to do to an engine's number.
Unit = Literal["money", "hours", "ratio", "multiplier", "count"]


@dataclass(frozen=True)
class EngineValue:
    """A number one of the engines holds, named by the symbol it was read from.

    The symbol is not decoration: tests/test_coverage.py resolves every one of
    them and compares the value, so a threshold that changes in the engine and
    not here fails rather than shipping a stale figure on the page that exists
    to describe the engine's reach."""

    label: str
    value: Decimal
    unit: Unit
    engine_symbol: str


@dataclass(frozen=True)
class EncodedRule:
    """One rule that is implemented, the sentence it implements, and where.

    `quote` is None where the published source carries the rule as a table or a
    figure rather than as a sentence. The source is named either way - a rule
    with no quotable sentence still has a page."""

    what: str
    engine_symbol: str
    source_url: str
    source_label: str
    quote: Quote | None = None
    values: tuple[EngineValue, ...] = ()


@dataclass(frozen=True)
class RulePack:
    key: str
    name: str
    engine_module: str
    covers: str
    coverage_quote: Quote | None
    thresholds: tuple[EngineValue, ...]
    encoded: tuple[EncodedRule, ...]


Outcome = Literal["CONTRIBUTES", "NOT_A_MEMBER", "REFUSED"]


@dataclass(frozen=True)
class ResidencyOutcome:
    """What the CPF pack DID when it was asked about this status.

    `engine_said` is the engine's own words - the NO_CPF flag it returned, or
    the message it refused with. Where it computed, there is nothing to quote
    and the field is empty rather than filled with a sentence about it."""

    residency: str
    outcome: Outcome
    engine_said: str


Kind = Literal["REFUSED_BY_ENGINE", "NO_INPUT_EXISTS", "STATED_NOT_CHECKED"]


@dataclass(frozen=True)
class NotEncoded:
    """One thing FairSlip does not do, and HOW THAT IS KNOWN.

    Three kinds, and the difference between them is the point:

      REFUSED_BY_ENGINE   an input the engines accept, on which they decline.
                          `why` is the engine's own refusal message, captured by
                          running the probe named in `established_by`.
      NO_INPUT_EXISTS     there is no field for it, so a month containing it
                          cannot be described to FairSlip at all. Established by
                          the absence of `would_need_field` from the input
                          schema.
      STATED_NOT_CHECKED  FairSlip says it is out of scope and this page does
                          not prove it. Said plainly rather than dressed as one
                          of the first two.

    `footer_phrase` ties the entry to the out-of-scope list the footer of every
    page already shows, so the two cannot drift: a test splits that list and
    fails if any phrase in it has no entry here."""

    what: str
    kind: Kind
    why: str
    established_by: str
    footer_phrase: str = ""
    would_need_field: str = ""


@dataclass(frozen=True)
class InterfaceCoverage:
    """How much of FairSlip's own interface is translated - counted, not claimed.

    The six worker questions are counted HERE because they are translated here,
    beside the English, in extract_schema.py. The interface dictionary is
    counted in the browser from frontend/lib/i18n.ts for the same reason: each
    count is taken where the strings are."""

    question_count: int
    languages: tuple[str, ...]
    questions_translated: tuple[tuple[str, int], ...]
    note: str
    quotes_note: str


@dataclass(frozen=True)
class CoveragePack:
    heading: str
    note: str
    packs: tuple[RulePack, ...]
    residency: tuple[ResidencyOutcome, ...]
    residency_note: str
    not_encoded: tuple[NotEncoded, ...]
    interface: InterfaceCoverage


# --------------------------------------------------------------------------
# The quotes. Verbatim; the test asserts each one against the rules file.
# --------------------------------------------------------------------------

MOM_HOURS = REFERENCE_LINKS["mom_hours"]
MOM_SALARY = REFERENCE_LINKS["mom_salary"]
CPF_RATES = (
    "https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay"
)

MOM_HOURS_LABEL = "MOM's hours-of-work, overtime and rest-days page (last updated 24 July 2025)"
MOM_SALARY_LABEL = "MOM's salary page"
CPF_RATES_LABEL = "CPF Board's how-much-to-pay page (last updated 11 Aug 2026)"

PART4 = Quote(
    quoted=(
        "You can claim overtime if you are: A non-workman earning a monthly basic salary of "
        "$2,600 or less. A workman earning a monthly basic salary of $4,500 or less."
    ),
    source_url=MOM_HOURS,
    source_label=MOM_HOURS_LABEL,
)

OT_RATE = Quote(
    quoted=(
        "For overtime work, your employer must pay you at least 1.5 times the hourly basic "
        "rate of pay."
    ),
    source_url=MOM_HOURS,
    source_label=MOM_HOURS_LABEL,
)

HOURLY_RATE = Quote(
    quoted="(12 x Monthly basic rate of pay) / (52 x 44)",
    source_url=MOM_HOURS,
    source_label=MOM_HOURS_LABEL,
)

OT_CAP = Quote(
    quoted="An employee can only work up to 72 overtime hours in a month.",
    source_url=MOM_HOURS,
    source_label=MOM_HOURS_LABEL,
)

DEDUCTION_CAP = Quote(
    quoted=(
        "The maximum amount of deduction for a salary period is limited to 50% of the total "
        "salary."
    ),
    source_url=MOM_SALARY,
    source_label=MOM_SALARY_LABEL,
)

CPF_ON_OVERTIME = Quote(
    quoted="CPF contributions are payable on overtime pay given to your employee.",
    source_url=CPF_RATES,
    source_label=CPF_RATES_LABEL,
)

CPF_AGE_STEP_UP = Quote(
    quoted=(
        "New contribution rates apply from the first day of the month after the employee's "
        "55th, 60th, 65th or 70th birthday."
    ),
    source_url=CPF_RATES,
    source_label=CPF_RATES_LABEL,
)

CPF_ROUNDING = Quote(
    quoted=(
        "Please round off the Total CPF contributions to the nearest dollar. Cents should be "
        "dropped for amounts less than 50 cents, and amounts of 50 cents and above should be "
        "treated as an additional dollar. The cents should always be dropped for the "
        "employee's share of CPF contributions."
    ),
    source_url=CPF_RATES,
    source_label=CPF_RATES_LABEL,
)

ALL_QUOTES: tuple[Quote, ...] = (
    PART4,
    OT_RATE,
    HOURLY_RATE,
    OT_CAP,
    DEDUCTION_CAP,
    CPF_ON_OVERTIME,
    CPF_AGE_STEP_UP,
    CPF_ROUNDING,
)


# --------------------------------------------------------------------------
# The two rule packs
# --------------------------------------------------------------------------


def _employment_act_pack() -> RulePack:
    return RulePack(
        key="employment_act",
        name="Employment Act, Part 4",
        engine_module="backend/fairslip/rules.py",
        covers=(
            "Monthly-rated employees, at or under the salary thresholds MOM publishes for "
            "Part 4. The engine reads those two thresholds; it does not decide them."
        ),
        coverage_quote=PART4,
        thresholds=(
            EngineValue(
                label="Non-workman, monthly basic salary at or under",
                value=rules.NON_WORKMAN_BASIC_CAP,
                unit="money",
                engine_symbol="rules.NON_WORKMAN_BASIC_CAP",
            ),
            EngineValue(
                label="Workman, monthly basic salary at or under",
                value=rules.WORKMAN_BASIC_CAP,
                unit="money",
                engine_symbol="rules.WORKMAN_BASIC_CAP",
            ),
        ),
        encoded=(
            EncodedRule(
                what="The hourly basic rate a month's overtime is priced at",
                engine_symbol="rules.hourly_basic_rate",
                source_url=MOM_HOURS,
                source_label=MOM_HOURS_LABEL,
                quote=HOURLY_RATE,
                values=(
                    EngineValue(
                        label="Hours a week the formula divides by",
                        value=rules.HOURS_PER_WEEK,
                        unit="hours",
                        engine_symbol="rules.HOURS_PER_WEEK",
                    ),
                ),
            ),
            EncodedRule(
                what="Overtime, at the published multiple of that rate",
                engine_symbol="rules.overtime_pay",
                source_url=MOM_HOURS,
                source_label=MOM_HOURS_LABEL,
                quote=OT_RATE,
                values=(
                    EngineValue(
                        label="Times the hourly basic rate",
                        value=rules.OT_MULTIPLIER,
                        unit="multiplier",
                        engine_symbol="rules.OT_MULTIPLIER",
                    ),
                ),
            ),
            EncodedRule(
                what="The monthly overtime ceiling, raised as a flag rather than silently cut",
                engine_symbol="rules.MONTHLY_OT_CAP_HOURS",
                source_url=MOM_HOURS,
                source_label=MOM_HOURS_LABEL,
                quote=OT_CAP,
                values=(
                    EngineValue(
                        label="Overtime hours in a month",
                        value=rules.MONTHLY_OT_CAP_HOURS,
                        unit="hours",
                        engine_symbol="rules.MONTHLY_OT_CAP_HOURS",
                    ),
                ),
            ),
            EncodedRule(
                what=(
                    "Rest-day work, priced from MOM's table - which half of the day it passed, "
                    "and who asked for it"
                ),
                engine_symbol="rules.rest_day_pay",
                source_url=MOM_HOURS,
                source_label=MOM_HOURS_LABEL,
                # MOM publishes this as a table with four cells, not as a sentence.
                # Quoting a table by re-typing it as prose is how a quotation stops
                # being one, so this rule names its page and quotes nothing.
                # The two working weeks it is defined for are not restated here:
                # the engine's own refusal message names them, and it is shown
                # under "not encoded" where a judge can trigger it.
                quote=None,
            ),
            EncodedRule(
                what="The ceiling on deductions in one salary period",
                engine_symbol="rules.DEDUCTION_CAP_RATIO",
                source_url=MOM_SALARY,
                source_label=MOM_SALARY_LABEL,
                quote=DEDUCTION_CAP,
                values=(
                    EngineValue(
                        label="Of the total salary, in one salary period",
                        value=rules.DEDUCTION_CAP_RATIO,
                        unit="ratio",
                        engine_symbol="rules.DEDUCTION_CAP_RATIO",
                    ),
                ),
            ),
        ),
    )


def _cpf_pack() -> RulePack:
    return RulePack(
        key="cpf",
        name="CPF contributions",
        engine_module="backend/fairslip/cpf.py",
        covers=(
            "Singapore Citizens and Permanent Residents from their third year, on monthly "
            "Ordinary Wages above the graduated band. Who is a CPF member is not FairSlip's "
            "opinion: the table below is what the engine did when it was asked about each "
            "status."
        ),
        coverage_quote=None,
        thresholds=(
            EngineValue(
                label="Monthly Ordinary Wage ceiling, from 1 Jan 2026",
                value=cpf.OW_CEILING_2026,
                unit="money",
                engine_symbol="cpf.OW_CEILING_2026",
            ),
            EngineValue(
                label="Wages at or under this use graduated formulas, which are not encoded",
                value=cpf.GRADUATED_WAGE_LIMIT,
                unit="money",
                engine_symbol="cpf.GRADUATED_WAGE_LIMIT",
            ),
        ),
        encoded=(
            EncodedRule(
                what="Contribution rates for 2026, by age band",
                engine_symbol="cpf.RATES_2026",
                source_url=CPF_RATES,
                source_label=CPF_RATES_LABEL,
                # CPF Board publishes the rates as a table. Same reason as the
                # rest-day table above: it is named, not re-typed as a quote.
                quote=None,
                values=(
                    EngineValue(
                        label="Age bands encoded",
                        value=Decimal(len(cpf.RATES_2026)),
                        unit="count",
                        engine_symbol="cpf.RATES_2026",
                    ),
                ),
            ),
            EncodedRule(
                what="Which band a worker is in, on the day the rate changes",
                engine_symbol="cpf.band_for",
                source_url=CPF_RATES,
                source_label=CPF_RATES_LABEL,
                quote=CPF_AGE_STEP_UP,
                values=(
                    EngineValue(
                        label="Birthdays that move a worker to the next band",
                        value=Decimal(len(cpf.AGE_THRESHOLDS)),
                        unit="count",
                        engine_symbol="cpf.AGE_THRESHOLDS",
                    ),
                ),
            ),
            EncodedRule(
                what="CPF Board's rounding, which is not a percentage of anything",
                engine_symbol="cpf.cpf_contribution",
                source_url=CPF_RATES,
                source_label=CPF_RATES_LABEL,
                quote=CPF_ROUNDING,
            ),
            EncodedRule(
                what=(
                    "Overtime counts as Ordinary Wage, which is why a pay difference is also "
                    "a CPF difference"
                ),
                engine_symbol="cpf.cpf_shortfall",
                source_url=CPF_RATES,
                source_label=CPF_RATES_LABEL,
                quote=CPF_ON_OVERTIME,
            ),
        ),
    )


# --------------------------------------------------------------------------
# The residency table, produced by RUNNING the CPF pack once per status
# --------------------------------------------------------------------------

# A wage above the graduated band, so that what each row reports is the effect
# of the STATUS and not of the wage. The test asserts this probe really is above
# cpf.GRADUATED_WAGE_LIMIT, because the sentence the screen shows says it is.
PROBE_OW = Decimal("1462.24")
PROBE_BAND = AgeBand.UP_TO_55


def residency_outcomes() -> tuple[ResidencyOutcome, ...]:
    """Ask the CPF engine about every residency status the enum defines.

    Derived from `Residency`, not listed: a status added to the engine appears
    here by itself, classified by what the engine actually does with it, rather
    than being silently absent from the page that describes who is covered.
    """
    out: list[ResidencyOutcome] = []
    for r in Residency:
        try:
            result = cpf.cpf_contribution(PROBE_OW, PROBE_BAND, r)
        except OutOfScopeError as exc:
            out.append(ResidencyOutcome(residency=r.value, outcome="REFUSED", engine_said=str(exc)))
            continue
        no_cpf = [f for f in result.flags if f.startswith("NO_CPF")]
        if no_cpf:
            out.append(
                ResidencyOutcome(residency=r.value, outcome="NOT_A_MEMBER", engine_said=no_cpf[0])
            )
        else:
            # It computed. There is nothing of the engine's to quote here, and a
            # sentence written to fill the gap would be FairSlip's words wearing
            # the column that holds the engine's.
            out.append(ResidencyOutcome(residency=r.value, outcome="CONTRIBUTES", engine_said=""))
    return tuple(out)


# --------------------------------------------------------------------------
# What is not encoded, and how each of those is known
# --------------------------------------------------------------------------


def _probe_graduated_band() -> None:
    cpf.cpf_contribution(Decimal(700), PROBE_BAND, Residency.CITIZEN)


def _probe_pr_first_years() -> None:
    cpf.cpf_contribution(PROBE_OW, PROBE_BAND, Residency.PR_YEAR_1)


def _probe_seven_day_week() -> None:
    rules.daily_rate(Decimal(1200), 7)


@dataclass(frozen=True)
class _Probe:
    what: str
    footer_phrase: str
    call: Callable[[], None]


REFUSAL_PROBES: tuple[_Probe, ...] = (
    _Probe(
        what="CPF on monthly wages inside the graduated band",
        footer_phrase="CPF on monthly wages of $750 or less",
        call=_probe_graduated_band,
    ),
    _Probe(
        what="CPF for a Permanent Resident in their first or second year",
        footer_phrase="PR year 1 and 2 CPF rates",
        call=_probe_pr_first_years,
    ),
    _Probe(
        what="A working week that is not five or six days",
        footer_phrase="",
        call=_probe_seven_day_week,
    ),
)

# Things there is no input for. `would_need_field` is the field FairSlip would
# have to hold to describe such a month at all, and the test asserts each one is
# absent from the input schema - so the claim "we cannot be told this" is
# checked rather than asserted, and adding the field later fails here first.
NO_INPUT: tuple[tuple[str, str, str], ...] = (
    (
        "Daily-rated and piece-rated work",
        "Daily and piece-rated workers",
        "piece_rate_units",
    ),
    ("Public-holiday pay", "public-holiday pay", "public_holiday_hours"),
    ("Shift-work averaging over a cycle", "shift-work averaging", "shift_cycle_weeks"),
    ("Additional Wages - bonuses, a 13th month", "Additional Wages", "additional_wages"),
    ("Platform work under the Platform Workers Act 2024", "platform workers", "platform_earnings"),
)

# Said plainly, and not proved on this page. Both are true and neither is
# established by anything here: the first is a fact about the Employment Act's
# own coverage that FairSlip has not quoted from a source, and the second is a
# statement about what this product is rather than about an input it declines.
STATED_ONLY: tuple[tuple[str, str, str], ...] = (
    (
        "Domestic workers",
        "domestic workers",
        (
            "FairSlip does not check this, and this page does not prove it: the Employment "
            "Act's coverage of domestic work is a published fact FairSlip has not read from "
            "MOM's page and quoted. It is listed because leaving it out would read as coverage."
        ),
    ),
    (
        "Any question of legal liability",
        "any question of legal liability",
        (
            "No engine here returns one and none is defined. This is what FairSlip is, not an "
            "input it declines: the figures are a reconstruction from published rules, and "
            "what they mean is for MOM, TADM or CPF Board."
        ),
    ),
)


def not_encoded() -> tuple[NotEncoded, ...]:
    """Run every refusal probe, and check every absent field is really absent.

    A probe that returns instead of refusing, or a field that has since been
    added, raises CoverageError. The page would otherwise state a limit that had
    stopped being true, which is the failure this module exists to avoid - and
    it would state it on the screen that describes the product's reach.
    """
    out: list[NotEncoded] = []
    for probe in REFUSAL_PROBES:
        try:
            probe.call()
        except (OutOfScopeError, ValueError) as exc:
            out.append(
                NotEncoded(
                    what=probe.what,
                    kind="REFUSED_BY_ENGINE",
                    why=str(exc),
                    established_by=(
                        "The engine was asked, on this page load, and refused. The reason "
                        "shown is the message it refused with."
                    ),
                    footer_phrase=probe.footer_phrase,
                )
            )
        else:
            raise CoverageError(
                f"{probe.what!r} is published as a refusal and the engine did not refuse it"
            )

    for what, phrase, field in NO_INPUT:
        if field in ALL_FIELDS:
            raise CoverageError(
                f"{what!r} is published as having no input, but {field!r} is now a field"
            )
        out.append(
            NotEncoded(
                what=what,
                kind="NO_INPUT_EXISTS",
                why=(
                    f"There is no {field} anywhere in what FairSlip asks for, so a month "
                    "containing it cannot be described to the engines at all."
                ),
                established_by=(
                    "Checked against the input schema on this page load, not written down."
                ),
                footer_phrase=phrase,
                would_need_field=field,
            )
        )

    for what, phrase, why in STATED_ONLY:
        out.append(
            NotEncoded(
                what=what,
                kind="STATED_NOT_CHECKED",
                why=why,
                established_by="Nothing on this page establishes it, and it says so.",
                footer_phrase=phrase,
            )
        )
    return tuple(out)


# --------------------------------------------------------------------------
# How much of the interface itself is covered
# --------------------------------------------------------------------------


def interface_coverage() -> InterfaceCoverage:
    """Counted from the dictionary that serves the questions, not estimated.

    The six worker questions are the most important sentences on the screen for
    the worker this is built for, so they are translated at their source in
    extract_schema.py and counted here. The rest of the interface is counted in
    the browser, from the dictionary that holds it.
    """
    langs = sorted({lang for per_field in WORKER_PROMPTS_I18N.values() for lang in per_field})
    counts = tuple(
        (lang, sum(1 for f in WORKER_PROMPTS if lang in WORKER_PROMPTS_I18N.get(f, {})))
        for lang in langs
    )
    return InterfaceCoverage(
        question_count=len(WORKER_PROMPTS),
        languages=("en", *langs),
        questions_translated=counts,
        note=(
            "These translations were produced by a language model and have not been checked "
            "by a native speaker. FairSlip counts what it has and shows what it does not, "
            "for its own interface as much as for a payslip."
        ),
        quotes_note=(
            "Quotations from MOM, TADM and CPF Board stay in English in every language. "
            "FairSlip has not verified a translation of them, and a worker carries these "
            "words to a counter where the exact ones matter."
        ),
    )


# --------------------------------------------------------------------------
# The pack, and the copy contract applied to it
# --------------------------------------------------------------------------

HEADING = "Who FairSlip is for, in rules"

NOTE = (
    "No figure on this page describes a population. FairSlip does not know how many people "
    "are in any of these groups, and a number like that would be a claim it cannot establish "
    "- which is the same reason it will not put a figure on a payslip it has not read twice. "
    "What it can state is which published rules it encoded, and what each engine does when it "
    "is asked about somebody outside them."
)

RESIDENCY_NOTE = (
    "Every row was produced by asking the CPF engine about that status, on a monthly Ordinary "
    "Wage above the graduated band, when this page loaded. This is why FairSlip ships two "
    "fictional workers and not one: the same code, the same published rules, and a different "
    "answer for a Work Permit holder than for a Citizen."
)


def build_pack() -> CoveragePack:
    pack = CoveragePack(
        heading=HEADING,
        note=NOTE,
        packs=(_employment_act_pack(), _cpf_pack()),
        residency=residency_outcomes(),
        residency_note=RESIDENCY_NOTE,
        not_encoded=not_encoded(),
        interface=interface_coverage(),
    )
    check_coverage_copy(pack)
    return pack


def _fairslip_authored_strings(pack: CoveragePack) -> tuple[tuple[str, str], ...]:
    """(where, text) for every string on the pack that FAIRSLIP WROTE.

    `quoted` is excluded for the reason recorded on agent._fairslip_authored_
    strings: running a word filter over an authority's sentence either censors
    the authority or invites someone to trim the quotation until it passes, and
    trimming a quote until it reads better is how "beyond one year is low."
    shipped with a full stop.

    The engines' own refusal messages ARE included. They are FairSlip's words -
    written in cpf.py and rules.py - and they are rendered to a worker like any
    other sentence here.
    """
    out: list[tuple[str, str]] = [("heading", pack.heading), ("note", pack.note)]
    out.append(("residency_note", pack.residency_note))
    for i, p in enumerate(pack.packs):
        out.append((f"packs[{i}].name", p.name))
        out.append((f"packs[{i}].covers", p.covers))
        for j, t in enumerate(p.thresholds):
            out.append((f"packs[{i}].thresholds[{j}].label", t.label))
        for j, e in enumerate(p.encoded):
            out.append((f"packs[{i}].encoded[{j}].what", e.what))
            out.append((f"packs[{i}].encoded[{j}].source_label", e.source_label))
            for k, v in enumerate(e.values):
                out.append((f"packs[{i}].encoded[{j}].values[{k}].label", v.label))
        if p.coverage_quote is not None:
            out.append((f"packs[{i}].coverage_quote.source_label", p.coverage_quote.source_label))
    for i, r in enumerate(pack.residency):
        out.append((f"residency[{i}].engine_said", r.engine_said))
    for i, n in enumerate(pack.not_encoded):
        out.append((f"not_encoded[{i}].what", n.what))
        out.append((f"not_encoded[{i}].why", n.why))
        out.append((f"not_encoded[{i}].established_by", n.established_by))
    out.append(("interface.note", pack.interface.note))
    out.append(("interface.quotes_note", pack.interface.quotes_note))
    return tuple(out)


def check_coverage_copy(pack: CoveragePack) -> None:
    """The UI copy contract, applied to the screen that describes the product.

    Same list as the escalation pack's, imported rather than copied: two lists
    of forbidden words is one list that will be updated and one that will not.
    """
    for where, text in _fairslip_authored_strings(pack):
        lowered = text.lower()
        hits = [w for w in FORBIDDEN_WORDS if w in lowered]
        if hits:
            raise CoverageCopyError(
                f"copy contract: {where} contains {hits} - see .claude/rules/fairslip-domain.md"
            )
