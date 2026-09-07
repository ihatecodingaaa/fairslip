"""Does a committed draft entry actually EXIST?

Every test in test_agent_draft.py asks "would a hit work if an entry existed?".
None of them asks "does an entry exist?" - so a cache with zero committed entries
would pass a suite full of green cache tests, which is exactly the defect this
file prevents (docs/debt.md, precondition-untested-mechanism-tested).

The required set is DERIVED from demo.fixtures.draft_specs(), so a spec added to
the demo without a committed entry fails here the moment it is added. Nobody has
to remember.

It skips loudly only when no spec is declared at all; the instant one is, an
absent entry is a failure, not a skip.
"""

from __future__ import annotations

import json

import pytest

import demo.fixtures as fx
from fairslip.agent import (
    DEFAULT_DRAFT_CACHE_DIR,
    DRAFT_TEMPLATE_VERSION,
    draft_cache_key,
    draft_entry_path,
    draft_model,
    load_draft_entry,
)

SPECS = fx.draft_specs()


def test_the_demo_declares_at_least_one_draft_spec() -> None:
    """The loudness guard. If draft_specs() ever returns nothing, every
    parametrized test below silently collects zero cases and this file becomes a
    green no-op - the check-disabled-by-absent-dependency shape."""
    assert SPECS, "demo.fixtures.draft_specs() is empty; the cache tests below would be vacuous"


@pytest.mark.parametrize(("name", "spec"), SPECS, ids=[n for n, _ in SPECS])
def test_every_declared_draft_spec_has_a_committed_entry(name: str, spec) -> None:
    path = draft_entry_path(spec, DEFAULT_DRAFT_CACHE_DIR)
    assert path.is_file(), (
        f"no committed draft entry for {name} at {path.name}.\n"
        f"Generate it with:  python scripts/make_draft_entry.py {name}\n"
        f"then COMMIT the file. An entry that is not committed does not exist in "
        f"production, and the offline demo will call the model instead."
    )


@pytest.mark.parametrize(("name", "spec"), SPECS, ids=[n for n, _ in SPECS])
def test_every_committed_entry_replays_without_a_model(
    name: str, spec, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The offline control, run as a test: with no API key in the environment,
    the committed entry must still produce a full draft."""
    if not draft_entry_path(spec, DEFAULT_DRAFT_CACHE_DIR).is_file():
        pytest.fail(f"{name}: no committed entry, so the offline path cannot work")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    d = load_draft_entry(spec, DEFAULT_DRAFT_CACHE_DIR)
    assert d is not None, f"{name}: the committed entry did not load"
    assert d.from_cache
    assert d.english.strip() and d.translated.strip()
    assert d.alternative.options


@pytest.mark.parametrize(("name", "spec"), SPECS, ids=[n for n, _ in SPECS])
def test_every_committed_entry_records_the_template_and_model_it_was_made_with(
    name: str, spec
) -> None:
    """An entry that does not say what produced it cannot be audited later."""
    path = draft_entry_path(spec, DEFAULT_DRAFT_CACHE_DIR)
    if not path.is_file():
        pytest.fail(f"{name}: no committed entry")
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["template_version"] == DRAFT_TEMPLATE_VERSION
    assert payload["model"] == draft_model()
    assert payload["language"] == spec.language
    assert payload["generated_on"]
    # The spec it was generated for is recorded, so a key collision or a silent
    # spec change is visible by inspection rather than only by a missing key.
    assert payload["spec_canonical"] == spec.canonical()


def test_the_committed_entries_are_keyed_by_the_current_template_version() -> None:
    """Bumping DRAFT_TEMPLATE_VERSION invalidates every entry. That is intended -
    and it must be LOUD, not a silent fallback to live calls at demo time."""
    for name, spec in SPECS:
        expected = draft_entry_path(spec, DEFAULT_DRAFT_CACHE_DIR)
        assert expected.name == f"{draft_cache_key(spec)}.json", name


@pytest.mark.parametrize(("name", "spec"), SPECS, ids=[n for n, _ in SPECS])
def test_every_committed_entry_is_actually_TRACKED_BY_GIT(name: str, spec) -> None:
    """`is_file()` cannot see git.

    The entry for the DEFAULT persona sat untracked in the worktree while every
    test above it passed: the file existed locally, so the precondition test was
    green, and it would only have gone red after a deploy from a fresh clone -
    where the default persona's draft returns DRAFT_UNAVAILABLE. The failure text
    of the test above literally says "an entry that is not committed does not
    exist in production" and could not check it.

    Second instance of docs/debt.md, precondition-untested-mechanism-tested:
    guarding the artefact's existence is not the same as guarding the artefact
    SHIPPING. Skips loudly if git is unavailable rather than passing quietly.
    """
    import shutil
    import subprocess

    if shutil.which("git") is None:
        pytest.skip("git is not on PATH, so tracking cannot be checked here")

    path = draft_entry_path(spec, DEFAULT_DRAFT_CACHE_DIR)
    repo_root = DEFAULT_DRAFT_CACHE_DIR.parents[2]
    result = subprocess.run(
        ["git", "ls-files", "--error-unmatch", str(path)],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, (
        f"{name}: {path.name} exists on disk but git does not track it. "
        f"It will not reach production. Run:  git add {path}"
    )


def test_the_cache_directory_holds_no_entry_no_spec_claims() -> None:
    """An orphan is a draft for a spec that no longer exists - a bumped template
    version or a changed language leaves one behind. It is dead weight in the
    bundle and, worse, it is a committed message nothing can explain."""
    wanted = {draft_entry_path(spec, DEFAULT_DRAFT_CACHE_DIR).name for _, spec in SPECS}
    on_disk = {p.name for p in DEFAULT_DRAFT_CACHE_DIR.glob("*.json")}
    assert on_disk == wanted, (
        f"orphaned draft entries: {sorted(on_disk - wanted)}. "
        f"Delete them, or declare the spec that claims them."
    )
