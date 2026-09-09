"""The charts may not invent a number, and may not invent a field either.

Everything drawn in frontend/app/check/Waterfall.tsx is a rectangle whose length
comes from an engine value. Two things can go wrong with that, and neither is
visible in a screenshot:

  1. A FIGURE THAT WAS COMPUTED IN THE BROWSER. `money(a.amount)` is a figure the
     engine produced. `money(a - b)` is a figure this codebase's governing rule
     forbids - "any UI number must be a Component.amount or a CpfResult field,
     rounded for display only" - and it would look identical on screen. A chart
     is not an exemption from that rule; it is the easiest place to break it,
     because charts are full of arithmetic and most of that arithmetic is
     legitimate. The distinction this module holds is:

         GEOMETRY may be derived   - a bar's length is value / axisMax
         TEXT may not              - every rendered figure is money(<field>)

  2. A FIELD NAME THAT NO LONGER EXISTS. The waterfall names breakdown fields
     and the CPF bar names split keys, as strings, in a TypeScript file the
     Python suite never type-checks. Rename `net_paid` in the schema and the
     chart silently draws a bar of zero - or, worse, drops the row entirely and
     looks finished. So the names are checked against the schema and against the
     backend's own split-line table, not against a list retyped here.

Reaching out of backend/ into frontend/ follows test_design_tokens.py and
test_routes_match_vercel.py: the fact spans the repo, so a test confined to one
half of it would check nothing.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
CHART = REPO / "frontend" / "app" / "check" / "Waterfall.tsx"

# WHERE MONEY IS DRAWN: derived, not listed.
#
# This module used to name one file, because there was one chart. The design pass
# added four more surfaces that render amounts - the money trail, its inspector,
# the change-a-fact panel, the reconciliation and the employer summary - and a
# rule enforced on one of six drawing surfaces is a rule the next one is written
# without.
#
# So the set is COMPUTED from the frontend: every file that calls money() is held
# to claim 1. A new screen is covered the moment it renders its first amount,
# which is the only way this stays true of a codebase that is still growing.
#
# lib/api.ts is excluded because it DEFINES money(); its "call" is the signature.
MONEY_DEFINITION = REPO / "frontend" / "lib" / "api.ts"


def money_drawing_files() -> list[Path]:
    roots = [REPO / "frontend" / "app", REPO / "frontend" / "lib"]
    out = []
    for root in roots:
        for path in sorted(root.rglob("*.ts*")):
            if path == MONEY_DEFINITION:
                continue
            if "money(" in _strip_comments(path.read_text(encoding="utf-8")):
                out.append(path)
    return out


def _strip_comments(src: str) -> str:
    """Read the code, not the prose about it.

    Same reason as test_design_tokens.py's version: several assertions below
    look for the absence of a string, and the comments in Waterfall.tsx discuss
    every one of them by name. A test that fails on its own explanation teaches
    people to delete the explanation.
    """
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", "", src)


def chart_source() -> str:
    assert CHART.exists(), f"{CHART} does not exist"
    return _strip_comments(CHART.read_text(encoding="utf-8"))


# ------------------------------------------- claim 1: no figure was computed here

# What may be handed to money(). Every one of these is a field on an object the
# backend built: a Money out of an engine Decimal. Anything else - a sum, a
# difference, a literal, a ternary picking between two numbers - is a figure
# invented in the browser.
_MONEY_ARG = re.compile(r"money\(\s*([^)]*?)\s*\)")
_FIELD = re.compile(r"^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[A-Za-z_$][\w$]*\])*$")


def money_arguments() -> list[str]:
    return [m.group(1) for m in _MONEY_ARG.finditer(chart_source())]


def _drawing_money_arguments() -> list[tuple[str, str]]:
    """(file, argument) for every money() call on every surface that draws one."""
    out: list[tuple[str, str]] = []
    for path in money_drawing_files():
        src = _strip_comments(path.read_text(encoding="utf-8"))
        for m in _MONEY_ARG.finditer(src):
            out.append((path.relative_to(REPO / "frontend").as_posix(), m.group(1)))
    return out


def test_the_scan_finds_the_surfaces_that_draw_money() -> None:
    """Otherwise the assertions below pass by examining nothing.

    The floor is deliberately low and the NAMES are what is asserted: the two
    that must always be here are the arithmetic view and the trail, because they
    are the two pictures of the same reconciliation.
    """
    found = {p.name for p in money_drawing_files()}
    assert money_arguments(), f"no money() calls found in {CHART}; this suite proves nothing"
    for required in ("Waterfall.tsx", "ProofGraph.tsx"):
        assert required in found, f"{required} renders no amount; the scan is not reaching it"
    assert len(found) >= 4, f"only {sorted(found)} draw money; the scan is not reaching the app"


@pytest.mark.parametrize(
    "where,arg", sorted(set(_drawing_money_arguments())), ids=lambda v: str(v)
)
def test_every_displayed_figure_is_an_engine_field_not_an_expression(
    where: str, arg: str
) -> None:
    """money() takes a field. It never takes arithmetic.

    This is the whole difference between a surface that reports what an engine
    said and one that does sums of its own and presents them in the same
    typeface.
    """
    assert _FIELD.match(arg), (
        f"{where}: money({arg}) renders a figure that file computed. Only a Money "
        f"the backend built may be displayed - a bar's LENGTH may be derived, a "
        f"node's POSITION may be derived, the number beside it may not."
    )


def test_no_arithmetic_reaches_a_text_position() -> None:
    """The other half of the same rule, from the other side.

    A figure could also be assembled into a template literal or a bare JSX
    expression without going through money(). Both would render a number, and
    neither is allowed to be one this file worked out.
    """
    src = chart_source()
    for m in re.finditer(r">\s*\{([^{}]*)\}\s*<", src):
        expr = m.group(1)
        # Nested markup is not a text position - it is more elements, and their
        # attributes are full of things that look like arithmetic. The first
        # version of this flagged an SVG path ("M-2 10 L10 -2") as a subtraction.
        if "<" in expr:
            continue
        # String literals are not arithmetic either, for the same reason.
        bare = re.sub(r"\"[^\"]*\"|'[^']*'|`[^`]*`", "", expr)
        if re.search(r"[-+*/]\s*\w", bare) and "money(" not in bare:
            raise AssertionError(
                f"a JSX text position contains arithmetic: {{{expr}}}. If that "
                f"renders a number, it is a number the browser invented."
            )


# ------------------------------------- claim 2: every named field really exists


def breakdown_fields() -> set[str]:
    """The Money fields of PayBreakdownOut, read from the schema."""
    src = (REPO / "backend" / "app" / "schemas.py").read_text(encoding="utf-8")
    body = re.search(r"class PayBreakdownOut\(BaseModel\):(.*?)\n\n", src, re.DOTALL)
    assert body, "PayBreakdownOut not found in schemas.py"
    return set(re.findall(r"^\s{4}(\w+):\s*Money\s*$", body.group(1), re.MULTILINE))


def waterfall_step_keys() -> set[str]:
    """The `key:` of every non-component step the waterfall builds."""
    src = chart_source()
    body = re.search(r"export function stepsFor\(.*?\n\}", src, re.DOTALL)
    assert body, "stepsFor not found"
    keys = set(re.findall(r'key:\s*"([a-z_]+)"', body.group(0)))
    assert keys, "no literal step keys parsed from stepsFor"
    return keys


def test_every_waterfall_step_names_a_money_field_on_the_breakdown() -> None:
    """A renamed schema field must break the build, not the picture.

    Without this, renaming `net_paid` leaves a chart that draws one fewer row
    and still looks like a finished chart - which is the exact failure mode this
    product exists to prevent, committed by the thing meant to reveal it.
    """
    missing = waterfall_step_keys() - breakdown_fields()
    assert not missing, (
        f"the waterfall draws steps named {sorted(missing)}, which are not Money "
        f"fields on PayBreakdownOut. Either the schema was renamed and the chart "
        f"was not, or the chart is naming something that does not exist."
    )


def test_the_waterfall_draws_every_money_field_the_breakdown_carries() -> None:
    """The other direction: a figure the engine returns and the chart ignores.

    `cpf_ordinary_wage` is deliberately not in the waterfall - it is an identity
    restating the gross, not a step of this arithmetic - so it is named here as
    an exception rather than passed over in silence.
    """
    not_a_step = {"cpf_ordinary_wage"}
    undrawn = breakdown_fields() - waterfall_step_keys() - not_a_step
    assert not undrawn, (
        f"PayBreakdownOut carries {sorted(undrawn)} and the waterfall draws no "
        f"row for it. Add the step, or name it in `not_a_step` with a reason."
    )


def split_keys_from_backend() -> set[str]:
    """The split-line keys the API actually emits, from _SPLIT_LINES."""
    src = (REPO / "backend" / "app" / "main.py").read_text(encoding="utf-8")
    block = re.search(r"_SPLIT_LINES\s*(?::[^=]*)?=\s*\((.*?)\n\)", src, re.DOTALL)
    assert block, "_SPLIT_LINES not found in main.py"
    keys = set(re.findall(r'"([a-z_]+)"\s*,', block.group(1)))
    assert keys, "no keys parsed from _SPLIT_LINES"
    return keys


def test_the_cpf_bar_names_exactly_the_split_lines_the_engine_emits() -> None:
    """The overlap bar lays six segments end to end and refuses to draw if any
    is missing. Those six names must be the backend's six, or the refusal fires
    on a healthy response - or, far worse, does not fire on a broken one."""
    src = chart_source()
    named = set(re.findall(r'^const [A-Z]+ = "([a-z_]+)";$', src, re.MULTILINE))
    assert named, "no split-line constants found in the chart"
    backend = split_keys_from_backend()
    assert named == backend, (
        f"the CPF chart names {sorted(named)}; the API emits {sorted(backend)}. "
        f"A key the chart does not know about is a segment silently left out of "
        f"a bar that still looks complete."
    )


# ------------------------------- claim 3: the components are not written down


@pytest.mark.parametrize("label", ["basic", "overtime", "rest_day", "rest_day_overtime"])
def test_no_component_label_is_hardcoded_in_the_chart(label: str) -> None:
    """The bars are whatever the engine returned.

    A month with no rest day has three bars; a month with rest-day overtime has
    four. Neither case is written down in the chart, so a component the engine
    stops producing stops being drawn - rather than being drawn at zero, which
    would be a picture of a fact that is not there.
    """
    src = chart_source()
    assert f'"{label}"' not in src, (
        f'the chart contains the literal "{label}". Components must come from '
        f"breakdown.components, in the order the engine returned them."
    )


def test_the_money_trail_names_only_money_fields_the_breakdown_carries() -> None:
    """The trail's money layer, held to the schema exactly as the waterfall is.

    proof.ts names three derived amounts - the gross, the net and the difference -
    and draws a box for each. Rename one in the schema and, without this, the
    trail draws one box fewer and still looks like a finished trail: the same
    failure the waterfall's own version of this test exists to prevent, on the
    picture that replaced it as the hero.

    `deductions_total` and `net_paid` are Money fields the trail deliberately
    does NOT give a money box, because they are FACTS on the way in rather than
    amounts the engine derived - and they appear once, in the facts layer. That
    exclusion is named here rather than left as a silence.
    """
    proof = _strip_comments(
        (REPO / "frontend" / "app" / "check" / "proof.ts").read_text(encoding="utf-8")
    )
    declared = re.search(r"export type MoneyField =([^;]+);", proof)
    assert declared, "MoneyField not found in proof.ts"
    named = set(re.findall(r'"(\w+)"', declared.group(1)))
    assert named, "MoneyField declares no fields"

    fields = breakdown_fields()
    missing = named - fields
    assert not missing, (
        f"the money trail names {sorted(missing)}, which are not Money fields on "
        f"PayBreakdownOut. Either the schema was renamed and the trail was not, or "
        f"the trail is naming something that does not exist."
    )

    a_fact_not_an_amount = {"deductions_total", "net_paid", "cpf_ordinary_wage"}
    undrawn = fields - named - a_fact_not_an_amount
    assert not undrawn, (
        f"PayBreakdownOut carries {sorted(undrawn)} and the trail gives it no box. "
        f"Add it, or name it in `a_fact_not_an_amount` with a reason."
    )

    # And each one is actually built into a node, not merely declared in a type.
    for name in sorted(named):
        assert f'field: "{name}"' in proof, f"MoneyField {name} is declared and never drawn"


def test_the_chart_refuses_rather_than_drawing_a_partial_bar() -> None:
    """The CPF bar's guard, asserted rather than assumed.

    A stacked bar with one segment missing is still a bar: it fills the width,
    it has a total, and nothing about it looks wrong. The only safe response to
    an incomplete split is to draw nothing and say so.
    """
    src = chart_source()
    assert re.search(r"NEEDED\.some\(\(k\) => !by\[k\]\)", src), (
        "the CPF chart no longer checks that every split line it needs is "
        "present before drawing"
    )
    assert "chart.cpfUndrawable" in src, "the refusal renders no explanation"
