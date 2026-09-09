"""The coverage screen states the product's reach. Every claim on it is checked here.

This is the screen a judge reads to find out who FairSlip is for, which makes it
the screen most able to overstate. So each kind of claim it makes has a test of
the matching kind:

  a QUOTE        must appear character-for-character in the project's own
                 quoted-rule file (.claude/rules/*.md), so the product and the
                 file the rules were read into cannot drift apart.
  a CONSTANT     must equal the engine symbol it names - or, for a count, the
                 number of entries that symbol has. The unit declares which.
  an OUTCOME     must have been produced by running an engine, and the cases are
                 derived from the enums rather than listed, so a status the
                 engine gains appears on the page instead of being missing.
  a REFUSAL      must actually refuse. Positive controls plant a probe that
                 stops refusing and a field that has appeared, and both must be
                 caught: a suite that only checks the true cases would pass just
                 as happily if the checking had been removed.

The footer of every page already lists what FairSlip does not check. The last
test in this file splits that list and requires each phrase to be classified
here, so the two accounts of scope cannot say different things.
"""

from __future__ import annotations

import dataclasses
import re
from decimal import Decimal
from pathlib import Path
from typing import get_args

import pytest

from fairslip import coverage as cov
from fairslip import cpf, rules
from fairslip.agent import FORBIDDEN_WORDS
from fairslip.cpf import Residency
from fairslip.extract_schema import ALL_FIELDS

REPO = Path(__file__).resolve().parent.parent.parent
MOM_RULES = REPO / ".claude" / "rules" / "mom-pay-rules.md"
CPF_RULES = REPO / ".claude" / "rules" / "cpf-rules.md"
I18N_TS = REPO / "frontend" / "lib" / "i18n.ts"

MODULES = {"rules": rules, "cpf": cpf}


@pytest.fixture(scope="module")
def pack() -> cov.CoveragePack:
    return cov.build_pack()


def _collapse(text: str) -> str:
    """Markdown blockquote to one line: drop the "> " markers and the wrapping,
    so a quote that is wrapped in the rules file still matches the same quote
    stored as one string."""
    no_markers = re.sub(r"^\s*>\s?", "", text, flags=re.MULTILINE)
    return re.sub(r"\s+", " ", no_markers)


# ------------------------------------------------------------------ quotes


@pytest.mark.parametrize("quote", cov.ALL_QUOTES, ids=lambda q: q.quoted[:40])
def test_every_quote_is_verbatim_in_the_projects_quoted_rule_file(quote: cov.Quote) -> None:
    """The file is chosen by the quote's OWN source_url, not passed in.

    A quote pointing at mom.gov.sg that only appears in the CPF rules file is a
    quote attributed to the wrong authority, and this fails on it."""
    if "mom.gov.sg" in quote.source_url:
        source = MOM_RULES
    elif "cpf.gov.sg" in quote.source_url:
        source = CPF_RULES
    else:  # pragma: no cover - a new authority needs its own rules file first
        pytest.fail(f"no quoted-rule file for {quote.source_url}")
    assert _collapse(re.sub(r"\s+", " ", quote.quoted)) in _collapse(
        source.read_text(encoding="utf-8")
    ), f"not verbatim in {source.name}: {quote.quoted[:60]}..."


def test_the_quotes_are_not_empty_and_name_their_page() -> None:
    """Loudness guard. Every assertion above would pass on a quote of "" that
    pointed nowhere."""
    assert cov.ALL_QUOTES
    for q in cov.ALL_QUOTES:
        assert q.quoted.strip()
        assert q.source_url.startswith("https://")
        assert q.source_label.strip()


# --------------------------------------------------------------- constants


def _engine_values(pack: cov.CoveragePack) -> list[tuple[str, cov.EngineValue]]:
    out: list[tuple[str, cov.EngineValue]] = []
    for p in pack.packs:
        out += [(f"{p.key}.thresholds", v) for v in p.thresholds]
        for e in p.encoded:
            out += [(f"{p.key}.{e.engine_symbol}", v) for v in e.values]
    return out


def test_there_are_engine_values_to_check() -> None:
    assert _engine_values(cov.build_pack()), "no EngineValue anywhere; the checks below are vacuous"


@pytest.mark.parametrize(
    "where,value",
    _engine_values(cov.build_pack()),
    ids=lambda x: x.engine_symbol if isinstance(x, cov.EngineValue) else str(x),
)
def test_every_published_value_matches_the_engine_symbol_it_names(
    where: str, value: cov.EngineValue
) -> None:
    """The unit is the contract: `count` means "how many entries that symbol
    has", everything else means "that symbol's value". A threshold that moves in
    the engine and not here fails, rather than shipping a stale figure on the
    page whose whole job is to describe the engine."""
    module_name, _, attr = value.engine_symbol.partition(".")
    assert module_name in MODULES, f"{where}: unknown module {module_name}"
    resolved = getattr(MODULES[module_name], attr)
    if value.unit == "count":
        assert value.value == Decimal(len(resolved)), f"{value.engine_symbol} has {len(resolved)}"
    else:
        assert value.value == Decimal(resolved), f"{value.engine_symbol} is {resolved}"


def test_every_encoded_rule_names_a_symbol_that_exists() -> None:
    """`engine_symbol` is the claim "this rule is implemented, there". A name
    that resolves to nothing is a rule listed as encoded and not encoded."""
    for p in cov.build_pack().packs:
        for e in p.encoded:
            module_name, _, attr = e.engine_symbol.partition(".")
            assert module_name in MODULES, e.engine_symbol
            assert hasattr(MODULES[module_name], attr), f"{e.engine_symbol} does not exist"


# ------------------------------------------------------- residency outcomes


def test_every_residency_the_engine_defines_appears_exactly_once(pack: cov.CoveragePack) -> None:
    """Derived from the enum. A status added to cpf.py appears on the page by
    itself, classified by what the engine does with it - rather than being
    quietly absent from the screen that says who is covered."""
    listed = [r.residency for r in pack.residency]
    assert sorted(listed) == sorted(r.value for r in Residency)
    assert len(listed) == len(set(listed))


def test_each_outcome_the_type_allows_actually_occurs(pack: cov.CoveragePack) -> None:
    """The residency table carries the "two personas, not one" argument. If every
    status produced the same outcome the table would still render, and the
    argument would be empty."""
    seen = {r.outcome for r in pack.residency}
    assert seen == set(get_args(cov.Outcome)), f"outcomes present: {sorted(seen)}"


def test_a_computed_row_quotes_nothing_and_the_others_quote_the_engine(
    pack: cov.CoveragePack,
) -> None:
    for r in pack.residency:
        if r.outcome == "CONTRIBUTES":
            assert r.engine_said == "", "a computed row has nothing of the engine's to quote"
        else:
            assert r.engine_said.strip(), f"{r.residency} reports {r.outcome} with no reason"


def test_the_probe_wage_is_above_the_band_the_screen_says_it_is_above() -> None:
    """The note under the table says the rows were produced on a wage above the
    graduated band. That sentence is only true of the probe actually used."""
    assert cov.PROBE_OW > cpf.GRADUATED_WAGE_LIMIT
    assert "graduated band" in cov.RESIDENCY_NOTE


# ------------------------------------------------------------ the refusals


def test_every_refusal_probe_refuses_and_reports_the_engines_own_words(
    pack: cov.CoveragePack,
) -> None:
    refused = [n for n in pack.not_encoded if n.kind == "REFUSED_BY_ENGINE"]
    assert len(refused) == len(cov.REFUSAL_PROBES)
    for n in refused:
        assert n.why.strip(), f"{n.what} refuses with no message"


def test_a_probe_that_stops_refusing_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    """POSITIVE CONTROL. Without it, every assertion above would pass just as
    well if the probes had quietly stopped being run - the defect class
    check-disabled-by-absent-dependency, applied to a claim about scope."""
    monkeypatch.setattr(
        cov,
        "REFUSAL_PROBES",
        (cov._Probe(what="a limit that has gone", footer_phrase="", call=lambda: None),),
    )
    with pytest.raises(cov.CoverageError, match="did not refuse"):
        cov.not_encoded()


def test_a_field_that_has_since_appeared_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    """POSITIVE CONTROL for the other half: "there is no input for this" is only
    true while there is no input for it."""
    existing = min(ALL_FIELDS)
    monkeypatch.setattr(cov, "NO_INPUT", (("something", "something", existing),))
    with pytest.raises(cov.CoverageError, match="is now a field"):
        cov.not_encoded()


def test_no_input_fields_really_are_absent(pack: cov.CoveragePack) -> None:
    absent = [n for n in pack.not_encoded if n.kind == "NO_INPUT_EXISTS"]
    assert absent, "no NO_INPUT_EXISTS entries; the check above would be vacuous"
    for n in absent:
        assert n.would_need_field
        assert n.would_need_field not in ALL_FIELDS


def test_each_kind_the_type_allows_actually_occurs(pack: cov.CoveragePack) -> None:
    seen = {n.kind for n in pack.not_encoded}
    assert seen == set(get_args(cov.Kind))


def test_what_is_stated_but_not_checked_says_so(pack: cov.CoveragePack) -> None:
    """The weakest entries are the ones that must not read like the others. A
    STATED_NOT_CHECKED entry that borrowed a refusal's confident wording would be
    the exact failure this file exists to prevent."""
    for n in pack.not_encoded:
        if n.kind == "STATED_NOT_CHECKED":
            assert "not prove" in n.why or "not an input" in n.why or "what FairSlip is" in n.why
            assert "Nothing on this page establishes it" in n.established_by


# ------------------------------------------------- the interface's own count


def test_the_question_count_is_counted_from_the_questions(pack: cov.CoveragePack) -> None:
    from fairslip.extract_schema import WORKER_PROMPTS, WORKER_PROMPTS_I18N

    assert pack.interface.question_count == len(WORKER_PROMPTS)
    for lang, count in pack.interface.questions_translated:
        expected = sum(1 for f in WORKER_PROMPTS if lang in WORKER_PROMPTS_I18N.get(f, {}))
        assert count == expected, f"{lang}: published {count}, dictionary holds {expected}"


def test_a_missing_translation_lowers_the_published_count(monkeypatch: pytest.MonkeyPatch) -> None:
    """POSITIVE CONTROL: the count must be COUNTED. A hardcoded 6 would pass
    every assertion above."""
    from fairslip import extract_schema

    thinned = {f: {k: v for k, v in per.items() if k != "ta"} for f, per in
               extract_schema.WORKER_PROMPTS_I18N.items()}
    monkeypatch.setattr(cov, "WORKER_PROMPTS_I18N", thinned)
    counts = dict(cov.interface_coverage().questions_translated)
    assert counts.get("ta", 0) == 0


# ----------------------------------------------------------- the copy gate


@pytest.mark.parametrize("word", FORBIDDEN_WORDS)
def test_the_copy_check_catches_every_forbidden_word(word: str) -> None:
    poisoned = dataclasses.replace(cov.build_pack(), note=f"This month is {word}.")
    with pytest.raises(cov.CoverageCopyError, match="copy contract"):
        cov.check_coverage_copy(poisoned)


@pytest.mark.parametrize("word", FORBIDDEN_WORDS)
def test_the_copy_check_reaches_a_reason_deep_in_the_pack(word: str) -> None:
    """A forbidden word in a nested `why` must be caught too: the check must not
    pass by looking only at the strings that are easy to reach."""
    p = cov.build_pack()
    first, *rest = p.not_encoded
    poisoned = dataclasses.replace(
        p, not_encoded=(dataclasses.replace(first, why=f"It is {word}."), *rest)
    )
    with pytest.raises(cov.CoverageCopyError):
        cov.check_coverage_copy(poisoned)


def test_the_copy_check_does_not_censor_a_quotation(pack: cov.CoveragePack) -> None:
    """MOM's overtime sentence contains "must pay", which FairSlip may not write
    and MOM did. Quoting an authority is not FairSlip saying it, and a quote must
    never be trimmed to satisfy a filter."""
    checked = {t for _, t in cov._fairslip_authored_strings(pack)}
    quoted = {q.quoted for q in cov.ALL_QUOTES}
    assert quoted.isdisjoint(checked)
    assert any(
        w in q.lower() for q in quoted for w in FORBIDDEN_WORDS
    ), "no quote contains a forbidden word, so this test proves nothing"


def test_the_copy_check_examines_every_fairslip_authored_field(pack: cov.CoveragePack) -> None:
    """Loudness guard, derived from the pack's own shape: a field added later is
    covered by the check or this fails."""
    where = {w for w, _ in cov._fairslip_authored_strings(pack)}
    assert {"heading", "note", "residency_note", "interface.note"} <= where
    assert len([w for w in where if w.startswith("not_encoded")]) == 3 * len(pack.not_encoded)
    assert len([w for w in where if ".encoded[" in w and w.endswith(".what")]) == sum(
        len(p.encoded) for p in pack.packs
    )


# ------------------------------------ the footer's list and this page's list


def footer_out_of_scope_phrases() -> list[str]:
    """The out-of-scope list the footer of every page already shows, split.

    Read from the interface dictionary rather than typed here, so this test
    fails when THAT list grows - which is the point: two accounts of what a
    product does not do will disagree eventually unless one is derived."""
    m = re.search(
        r'"footer\.outsideBody":\s*"((?:[^"\\]|\\.)*)"', I18N_TS.read_text(encoding="utf-8")
    )
    assert m, "footer.outsideBody not found in the interface dictionary"
    listed, _, _ = m.group(1).partition(". ")
    phrases = []
    for chunk in listed.split(";"):
        c = chunk.strip()
        if c.lower().startswith("and "):
            c = c[4:]
        phrases.append(c)
    return phrases


def test_the_footer_list_is_long_enough_to_be_worth_checking() -> None:
    assert len(footer_out_of_scope_phrases()) >= 5


def test_every_thing_the_footer_says_is_out_of_scope_is_classified_here(
    pack: cov.CoveragePack,
) -> None:
    """Adding a line to the footer without saying HOW it is known fails here.

    The reverse is allowed: this page may classify more than the footer lists -
    the seven-day week is refused by the engine and named nowhere in that
    sentence."""
    classified = {n.footer_phrase for n in pack.not_encoded if n.footer_phrase}
    missing = [p for p in footer_out_of_scope_phrases() if p not in classified]
    assert not missing, f"in the footer, unclassified on the coverage page: {missing}"


# ------------------------------------------------------------- the endpoint

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_the_endpoint_serves_what_the_module_built(pack: cov.CoveragePack) -> None:
    body = client.get("/coverage").json()
    assert body["heading"] == pack.heading
    assert len(body["packs"]) == len(pack.packs)
    assert len(body["residency"]) == len(pack.residency)
    assert len(body["not_encoded"]) == len(pack.not_encoded)
    assert body["interface"]["question_count"] == pack.interface.question_count


def test_every_money_on_the_page_is_formatted_by_the_one_formatter() -> None:
    """Grouped, two decimal places, from money_display - the same function every
    other dollar in the product goes through. A page that formatted its own
    would show $2600.00 beside $1,462.24."""
    body = client.get("/coverage").json()
    monies = [
        v
        for p in body["packs"]
        for v in [*p["thresholds"], *[x for e in p["encoded"] for x in e["values"]]]
        if v["unit"] == "money"
    ]
    assert monies, "no money values on the page; this test would prove nothing"
    for v in monies:
        assert re.fullmatch(r"\$\d{1,3}(,\d{3})*\.\d{2}", v["display"]), v


def test_the_endpoint_refuses_rather_than_serving_an_unestablished_page(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A claim that stopped being true takes the page down, in words. The
    alternative - a 500, or a page missing one row - is a coverage screen a
    reader cannot tell from a correct one."""
    from app import main

    def boom() -> cov.CoveragePack:
        raise cov.CoverageError("a limit that has gone")

    monkeypatch.setattr(main, "build_pack", boom)
    r = client.get("/coverage")
    assert r.status_code == 400
    assert r.json()["error"] == "COVERAGE_UNESTABLISHED"
