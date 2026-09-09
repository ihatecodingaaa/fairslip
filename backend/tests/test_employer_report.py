"""What a review pack may claim, and what it may not - held from its source.

WHY THIS FILE IS THE MOST IMPORTANT ONE IN THE FEATURE. A screen is read once,
in context, by someone who watched it load. A REPORT is forwarded. It is opened
by a director who never saw the payroll, attached to a board pack, and quoted
six months later. The prettier it gets, the easier it is to overclaim - and an
overclaim in an exported file has no context around it to correct.

So four rules, and every one of them is asserted here rather than trusted:

  1. COVERAGE CANNOT BE REMOVED. A pack that says anything about a payroll run
     must say how much of it was checked. Unticking "not checked" would turn
     "11 exceptions in 293 checked rows" into "11 exceptions", which reads as a
     claim about 300 employees. The module is marked required, the builder
     re-adds it whatever it is handed, and the preview renders it outside every
     conditional.

  2. NOTHING IS CERTIFIED. No score, no percentage, no grade, no "approved", no
     "certified", no "audit opinion", no money anyone has saved.

  3. THE SCOPE SENTENCE IS ABOUT ROWS, NOT PEOPLE. "282 checked rows matched the
     FairSlip rule engine" is establishable. "282 employees were paid correctly"
     is not, and the difference is the whole product.

  4. ONE MODEL, EVERY FORMAT. The workbook, the CSV, the JSON, the Markdown and
     the printed sheet are rendered from one object. Nobody ever reads two
     exports side by side, so a second one with its own idea of which rows count
     would never be caught by a reader.

Python reading TypeScript is the house pattern - see tests/test_inclusion.py and
tests/test_design_tokens.py. It is a text scan, and a text scan is the right
tool for a rule about what may appear in a file.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
REPORT = REPO / "frontend" / "app" / "employer" / "report"

MODEL = REPORT / "model.ts"
EXPORTS = REPORT / "exports.ts"
PREVIEW = REPORT / "Preview.tsx"
STUDIO = REPORT / "Studio.tsx"


def _strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    return re.sub(r"(?<!:)//[^\n]*", "", src)


def source(path: Path) -> str:
    assert path.is_file(), f"{path} does not exist"
    return _strip_comments(path.read_text(encoding="utf-8"))


def report_sources() -> dict[Path, str]:
    found = {p: source(p) for p in sorted(REPORT.rglob("*.ts*"))}
    assert len(found) >= 4, f"only {sorted(p.name for p in found)}; the scan is not reaching it"
    return found


def _declaration(src: str, opening: str) -> str:
    """One top-level declaration, from its own line to the next `function`."""
    start = src.find(opening)
    assert start >= 0, f"{opening!r} was not found; the file's shape changed"
    after = start + len(opening)
    # BOTH FORMS. Stopping only at "\nfunction " let `toCsv` - which is followed
    # by `export function csvRowCount` - swallow the rest of the module, and
    # every "this string is absent" assertion inside it then proved nothing.
    ends = [i for i in (src.find("\nfunction ", after), src.find("\nexport function ", after)) if i >= 0]
    out = src[start:] if not ends else src[start : min(ends)]
    assert out.count("\n") > 3, f"{opening!r} sliced to almost nothing; the scan is wrong"
    return out


# ------------------------------------------ 1. coverage cannot be turned off


def test_coverage_is_declared_required() -> None:
    modules = re.search(r"export const MODULES[^=]*=\s*\[(.*?)\n\];", source(MODEL), re.DOTALL)
    assert modules, "MODULES was not found in report/model.ts"
    coverage = re.search(r'\{\s*id:\s*"coverage".*?\}', modules.group(1), re.DOTALL)
    assert coverage, "there is no coverage module"
    assert "required: true" in coverage.group(0), (
        "the coverage module is not marked required, so a user can produce an "
        "executive summary of a payroll where seven rows were never examined"
    )


def test_the_builder_re_adds_the_required_modules_whatever_it_is_handed() -> None:
    """THE LOCK IS IN THE MODEL, NOT IN THE CHECKBOX. A disabled input is a UI
    affordance; a caller assembling the module list by hand bypasses it."""
    src = source(MODEL)
    assert re.search(r"REQUIRED[^=]*=\s*MODULES\.filter\(\(m\)\s*=>\s*m\.required\)", src), (
        "REQUIRED is not derived from the MODULES table, so the two can disagree"
    )
    build = _declaration(src, "export function buildReport(")
    assert "...REQUIRED" in build, (
        "buildReport does not merge the required modules into the chosen set"
    )


def test_every_audience_preset_includes_coverage() -> None:
    for name in ("executive", "payroll", "audit"):
        block = _preset(name)
        assert '"coverage"' in block, f"the {name} preset omits coverage"


def test_the_preview_renders_coverage_outside_every_conditional() -> None:
    """The third lock, and the one a reader actually sees. Every other section is
    behind `has(...)`; this one is not."""
    src = source(PREVIEW)
    coverage = re.search(r'<Section title="Coverage">(.*?)</Section>', src, re.DOTALL)
    assert coverage, "the preview has no Coverage section"
    assert 'has("coverage")' not in src, (
        "the preview gates its coverage block on a module being selected"
    )
    for field in ("rows_read", "checked", "exceptions", "refused"):
        assert field in coverage.group(1), f"the coverage block omits {field}"


def test_refused_rows_reach_the_pack() -> None:
    src = source(MODEL)
    assert 'r.outcome === "REFUSED"' in src, "the model never separates the refused rows"
    assert "notChecked" in src, "the model has no not-checked collection"
    assert "notChecked" in source(PREVIEW), "the preview cannot render the not-checked rows"
    assert "notChecked" in source(EXPORTS), "no export carries the not-checked rows"


def test_the_executive_preset_carries_the_summary_a_decision_needs() -> None:
    block = _preset("executive")
    for module in ("coverage", "money", "reasons"):
        assert f'"{module}"' in block, (
            f"the executive preset omits {module}; a one-page decision view without "
            f"it is a headline with nothing behind it"
        )


# ------------------------------------------------------ 2. nothing is certified


FORBIDDEN = [
    (r"\bcompliant\b", "a compliance claim"),
    (r"\bcompliance\b", "a compliance claim"),
    (r"\bcertified\b", "a certification"),
    (r"\bcertificate\b", "a certificate"),
    (r"\baudit opinion\b", "an audit opinion"),
    (r"\bpayroll health\b", "a health score"),
    (r"\brisk score\b", "a risk score"),
    (r"\bmoney saved\b", "a saving nobody has made"),
    (r"\bsavings\b", "a saving nobody has made"),
    (r"\bwage theft\b", "an accusation the engine cannot establish"),
    (r"\bapproved\b", "an approval"),
    (r"\bunderpaid\b", "a word the copy contract forbids"),
    (r"\bowed\b", "a word the copy contract forbids"),
    (r"\bin breach\b", "a word the copy contract forbids"),
]


# A DISCLAIMER IS NOT A CLAIM. "It is not an audit opinion and not a
# certification" is the pack REFUSING the word, and the footer is required to
# say exactly that by test_the_pack_says_what_it_does_not_do below. Without
# this, the two tests contradict each other and the honest sentence is the one
# that has to go.
_NEGATED = re.compile(r"(?:\bnot\b|\bnever\b|\bno\b|\bnor\b)[\s\w]{0,14}$", re.IGNORECASE)


@pytest.mark.parametrize("pattern,what", FORBIDDEN, ids=[w for _, w in FORBIDDEN])
def test_no_report_surface_makes_a_claim_the_engine_cannot_support(
    pattern: str, what: str
) -> None:
    for path, src in report_sources().items():
        for hit in re.finditer(pattern, src, re.IGNORECASE):
            preceding = src[max(0, hit.start() - 30) : hit.start()]
            if _NEGATED.search(preceding):
                continue
            line = src[: hit.start()].count("\n") + 1
            assert False, f"{path.name}:{line} contains {what}: {hit.group(0)!r}"


def test_the_word_certified_is_absent_from_the_dictionary_strings_too() -> None:
    """The renderers read the dictionary, so a claim could arrive from there."""
    i18n = (REPO / "frontend" / "lib" / "i18n.ts").read_text(encoding="utf-8")
    block = re.search(r"^const en = \{(.*?)^\} as const;", i18n, re.DOTALL | re.MULTILINE)
    assert block, "the English dictionary was not found"
    report_strings = [
        v for k, v in re.findall(r'^  "(report\.[^"]+)":\s*"([^"]*)"', block.group(1), re.MULTILINE)
    ]
    assert report_strings, "no report.* strings found; this test would prove nothing"
    for value in report_strings:
        low = value.lower()
        for word in ("certified", "certificate", "compliant", "approved", "audit opinion"):
            at = low.find(word)
            if at < 0:
                continue
            assert _NEGATED.search(low[max(0, at - 30) : at]), (
                f"a report string claims {word!r}: {value!r}"
            )


def test_the_pack_is_never_called_a_certificate() -> None:
    src = source(MODEL)
    title = re.search(r'title:\s*comparison\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"', src)
    assert title, "the report title was not found"
    for t in title.groups():
        assert "review" in t.lower(), f"the pack is titled {t!r}, which is not a review"


def test_no_percentage_is_rendered_in_the_pack() -> None:
    """A percentage in a payroll report is a compliance figure whatever it is
    labelled, and the engine computes none. Bar widths do not exist here."""
    percent_sign = re.compile(r"(?<! )%")
    for path, src in report_sources().items():
        for i, line in enumerate(src.splitlines(), start=1):
            if not percent_sign.search(line):
                continue
            # `#,##0.00` and friends are spreadsheet number formats, not text.
            assert "format" in line, (
                f"{path.name}:{i}: `{line.strip()}` puts a percentage in the pack."
            )


# ---------------------------------------------- 3. the scope sentence is exact


def test_the_strongest_sentence_is_about_rows_and_a_rule_engine() -> None:
    src = source(PREVIEW)
    assert "checked rows matched the FairSlip" in src, (
        "the preview's coverage sentence changed. It must attribute the match to "
        "the rule engine and to ROWS - 'employees were paid correctly' is a claim "
        "about people that the engine's scope does not support."
    )
    assert not re.search(r"employees? (were|was) paid correctly", src, re.IGNORECASE)
    assert not re.search(r"\bpaid correctly\b", src, re.IGNORECASE)


def test_the_pack_says_what_it_does_not_do() -> None:
    src = source(PREVIEW)
    for claim in ("does not edit payroll", "not an audit opinion", "not a certification"):
        assert claim in src, f"the pack's footer no longer says it is {claim!r}"


def test_a_refusal_reason_carries_no_amount_in_any_renderer() -> None:
    """$0.00 beside a reason that refused every row reads as rows that were
    checked and agreed. Held in all three places a reader could meet it."""
    assert "checked_rows > 0" in source(PREVIEW), "the preview prints money for a refused reason"
    exports = source(EXPORTS)
    assert exports.count("checked_rows > 0") >= 2, (
        "the Markdown and the workbook do not both guard the per-reason amount"
    )


# -------------------------------------------------- 4. one model, every format


def test_every_renderer_takes_the_model_and_nothing_else() -> None:
    """A renderer that reached for the raw API response could filter differently
    from the preview, and nobody reads two exports side by side."""
    src = source(EXPORTS)
    for fn in ("toCsv", "toJson", "toMarkdown", "toWorkbook"):
        sig = re.search(rf"function {fn}\(\s*model: ReportModel", src)
        assert sig, f"{fn} does not take a ReportModel as its first argument"
    for banned in ("EmployerCheckOut", "EmployerRecheckOut", "findings"):
        assert banned not in src, (
            f"exports.ts references {banned}; a renderer that reads the raw response "
            f"can disagree with the preview about which rows count"
        )


def test_the_workbook_writes_values_and_never_a_formula() -> None:
    src = source(EXPORTS)
    assert '"Formula"' not in src and "'Formula'" not in src, (
        "the workbook writes a formula. A cell that recomputes a FairSlip amount "
        "is a fourth engine, running in Excel, with its own rounding."
    )
    assert re.search(r"=\s*[A-Z]+\d+\s*[-+*/]", src) is None, "the workbook writes a cell formula"


def test_the_workbook_leaves_an_uncomputed_cell_empty_rather_than_zero() -> None:
    """A TAUTOLOGY REMOVED. This read `"return null" in num or "null" in num`,
    and the slice starts at `function num(m: Money | null): number | null {` -
    so the right-hand clause was true of any body at all, including one that
    returned 0. The test was named for a defect it could not detect."""
    src = source(EXPORTS)
    num = _declaration(src, "function num(")
    body = num[num.index("{") :]
    assert "return null" in body, (
        "num() does not return null for a missing amount, so a refused row's cell "
        "becomes 0 and sums, averages and charts as a row that came out level"
    )
    assert "return 0" not in body, "num() returns a zero for a missing amount"


def test_the_excel_dependency_is_imported_only_when_a_workbook_is_asked_for() -> None:
    """A worker checking one payslip must never download a spreadsheet writer."""
    src = source(EXPORTS)
    assert 'await import("write-excel-file' in src, (
        "write-excel-file is not dynamically imported"
    )
    assert not re.search(r'^import .*write-excel-file', src, re.MULTILINE), (
        "write-excel-file is imported at module scope, so it ships in the main bundle"
    )


def test_the_csv_carries_the_engines_exact_decimal_not_a_formatted_string() -> None:
    """`$1,173.00` is a string in every spreadsheet on earth, and a column of
    strings does not sum, sort or filter."""
    src = source(EXPORTS)
    csv = _declaration(src, "export function toCsv(")
    assert "money(" not in csv, "toCsv formats an amount; a CSV cell must be machine-parseable"
    assert "exact(" in csv, "toCsv does not use the exact-decimal helper"
    # Markdown is read by a person and DOES format - the rule is per renderer,
    # so this asserts the difference rather than assuming it.
    md = _declaration(src, "export function toMarkdown(")
    assert "money(" in md, "toMarkdown no longer renders the amounts a person reads"


def test_the_csv_offers_the_three_scopes_and_can_count_them() -> None:
    src = source(EXPORTS)
    assert re.search(r'CsvScope\s*=\s*"exceptions"\s*\|\s*"notChecked"\s*\|\s*"all"', src)
    assert "export function csvRowCount" in src, (
        "the control cannot say how many rows a scope will produce before writing it"
    )


def test_the_csv_carries_both_the_engine_code_and_the_human_wording() -> None:
    src = source(EXPORTS)
    columns = re.search(r"const CSV_COLUMNS = \[(.*?)\] as const;", src, re.DOTALL)
    assert columns, "CSV_COLUMNS was not found"
    assert '"reason_code"' in columns.group(1)
    assert '"reason_label"' in columns.group(1)


def test_the_json_carries_a_schema_version_that_is_maintained_deliberately() -> None:
    src = source(MODEL)
    version = re.search(r'REPORT_SCHEMA_VERSION = "([^"]+)"', src)
    assert version, "there is no report schema version"
    assert "/" in version.group(1), (
        f"the schema version {version.group(1)!r} does not name what it versions"
    )
    assert "schema_version" in source(EXPORTS) or "schema_version" in src


def test_the_generated_timestamp_is_taken_once_and_passed_in() -> None:
    """A model rebuilt on every keystroke that stamped itself would turn "when
    these figures were produced" into "when you last touched a checkbox"."""
    src = source(MODEL)
    build = _declaration(src, "export function buildReport(")
    assert "generatedAt" in build, "buildReport does not take the timestamp as an input"
    assert "new Date()" not in build, "buildReport stamps itself"
    studio = source(STUDIO)
    assert "useState(() => new Date().toISOString())" in studio, (
        "the studio does not freeze the timestamp when it opens"
    )


# ------------------------------------------------------------------ privacy


def test_the_masking_happens_in_the_model_so_no_renderer_can_forget_it() -> None:
    src = source(MODEL)
    assert "function identity(" in src, "there is no single place identity is decided"
    exports = source(EXPORTS)
    assert "maskAccount" not in exports, "a renderer masks identity for itself"


def test_anonymised_withholds_both_the_name_and_the_account() -> None:
    src = source(MODEL)
    identity = _declaration(src, "function identity(")
    assert 'return { employee_name: "", employee_account_no: "" }' in identity, (
        "the anonymised mode does not blank both fields"
    )


def test_the_executive_preset_defaults_to_the_least_identifying_mode() -> None:
    assert 'privacy: "anonymised"' in _preset("executive"), (
        "a management pack defaults to showing worker identity"
    )


def test_no_name_is_ever_invented() -> None:
    """FULL shows what the file carried. A row whose name column was empty stays
    empty rather than gaining a placeholder that reads like a person."""
    src = source(MODEL)
    identity = _declaration(src, "function identity(")
    assert "Employee " not in identity, "a placeholder name is synthesised"
    assert "Anonymous" not in identity and "Unknown" not in identity



def _preset(name: str) -> str:
    """One preset's body, sliced to the next preset or to the end of the table.

    NOT A BRACE REGEX. The last preset is closed by `},\n  };`, which a
    non-greedy `\\},\n` never reaches - so the audit preset silently "did not
    exist" and its assertion proved nothing.
    """
    src = source(MODEL)
    table = src.index("export const PRESETS")
    start = src.index(f"{name}: {{", table)
    rest = src[start + 1 :]
    ends = [
        rest.index(f"{other}: {{")
        for other in ("executive", "payroll", "audit")
        if f"{other}: {{" in rest
    ]
    body = rest if not ends else rest[: min(ends)]
    assert body.count("\n") > 2, f"the {name} preset sliced to nothing"
    return body


# ------------------------------------ the pack does not do its own arithmetic


def test_no_renderer_derives_a_coverage_figure_from_two_other_counts() -> None:
    """`checked - exceptions` reached BOTH the print sheet and the Markdown.

    It was correct for the three outcomes that exist, duplicated rather than
    shared, and sat under two module headers promising nothing is computed
    there. The engine now ships `matched`. This is the guard that was missing:
    the previous one only forbade `reduce(` over money, so a single-line
    subtraction of two counts walked straight past it.
    """
    for path, src in report_sources().items():
        for i, line in enumerate(src.splitlines(), start=1):
            # THE OPTIONAL `model.` PREFIX IS THE WHOLE POINT. Without it this
            # pattern did not match `model.coverage.checked -
            # model.coverage.exceptions`, which is the exact line the test was
            # written for - a guard that would have let its own defect through.
            for a, b in re.findall(
                r"((?:\w+\.)?(?:coverage|totals|counts)\.\w+)\s*[-+]\s*"
                r"((?:\w+\.)?(?:coverage|totals|counts)\.\w+)",
                line,
            ):
                raise AssertionError(
                    f"{path.name}:{i} derives a figure from {a} and {b}. The engine "
                    f"ships the count it needs; a renderer that computes one is a "
                    f"second source of truth inside an exported document."
                )


def test_the_matched_count_comes_from_the_engine() -> None:
    src = source(MODEL)
    assert "matched: result.matched" in src, (
        "the report model does not carry the engine's own matched count"
    )
    preview = source(PREVIEW)
    assert "model.coverage.matched" in preview, "the pack does not render the engine's count"


def test_the_pack_names_which_file_its_figures_came_from() -> None:
    """With a comparison open the pack IS the corrected run - its coverage, its
    rows, its totals - and the header used to name the first file. A reader of
    the JSON attributed those rows to a file that produced none of them."""
    src = source(MODEL)
    assert "figures_from" in src, "the model does not record which run it was built from"
    assert "figures_from: comparison ? afterFilename : beforeFilename" in src, (
        "figures_from does not follow the run the pack was actually built from"
    )
    for path in (PREVIEW, EXPORTS):
        assert "figures_from" in source(path), f"{path.name} does not say which file"
