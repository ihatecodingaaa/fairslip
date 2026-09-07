"""The agent prepares. It never files, submits, or pays.

This is asserted structurally, by parsing fairslip/agent.py, rather than by
reading it: a reviewer's eye is not a guard, and the module will grow.

Two failure modes are designed against:

  1. The obvious one - somebody adds `requests.post(...)` to the escalation path.
  2. The quiet one - the AST walk stops matching (a renamed file, a parse that
     silently yields nothing) and the test passes having examined zero nodes.
     That is docs/debt.md, check-disabled-by-absent-dependency: a disabled check
     must announce itself, never pass quietly. So every collector here asserts it
     found something, and each detector is run against a synthetic BAD module as
     a positive control. If the detector cannot catch a planted violation, the
     test fails - regardless of what agent.py contains.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

import fairslip.agent as agent_module

AGENT_PATH = Path(agent_module.__file__).resolve()

# Anything that can open a socket. `fastapi` is here because the agent must not
# be able to register a route either: routing is the app's job, not the agent's.
NETWORK_MODULES = frozenset(
    {
        "http",
        "http.client",
        "httpx",
        "requests",
        "urllib",
        "urllib.request",
        "socket",
        "aiohttp",
        "ftplib",
        "smtplib",
        "telnetlib",
        "asyncio.streams",
        "fastapi",
        "starlette",
        "webbrowser",
        "subprocess",
        "os.system",
    }
)

# Verbs that would mean the agent acted on the world rather than prepared for it.
FILING_CALL_NAMES = frozenset({"post", "put", "patch", "delete", "urlopen", "request", "send_"})


# --------------------------------------------------------------------------
# Collectors. Each returns what it found; the caller asserts it found anything.
# --------------------------------------------------------------------------


def _tree(source: str) -> ast.Module:
    return ast.parse(source)


def _imported_modules(tree: ast.Module) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.add(alias.name)
                found.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
            found.add(node.module.split(".")[0])
    return found


def _url_literals(tree: ast.Module) -> set[str]:
    return {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and ("http://" in node.value or "https://" in node.value)
    }


def _called_attribute_names(tree: ast.Module) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            fn = node.func
            if isinstance(fn, ast.Attribute):
                found.add(fn.attr)
            elif isinstance(fn, ast.Name):
                found.add(fn.id)
    return found


# --------------------------------------------------------------------------
# Positive controls: prove each detector catches a planted violation.
#
# Without these, a collector that quietly returns an empty set would make every
# assertion below vacuously true and the suite would go green on a broken guard.
# --------------------------------------------------------------------------

BAD_SOURCE = '''
"""A module that does everything the agent must not."""
import requests
from urllib.request import urlopen

TADM = "https://www.tadm.sg/not-in-reference-links"

def file_it(body):
    requests.post(TADM, json=body)
    urlopen(TADM)
'''


def test_the_import_detector_catches_a_planted_network_import() -> None:
    found = _imported_modules(_tree(BAD_SOURCE))
    assert found, "the import collector examined nothing"
    assert found & NETWORK_MODULES, "the import detector missed a planted `import requests`"


def test_the_url_detector_catches_a_planted_url() -> None:
    found = _url_literals(_tree(BAD_SOURCE))
    assert found, "the URL collector examined nothing"
    assert any("tadm.sg" in u for u in found)


def test_the_call_detector_catches_a_planted_post() -> None:
    found = _called_attribute_names(_tree(BAD_SOURCE))
    assert found, "the call collector examined nothing"
    assert found & FILING_CALL_NAMES, "the call detector missed a planted requests.post"


# --------------------------------------------------------------------------
# The real assertions about fairslip/agent.py
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def agent_tree() -> ast.Module:
    assert AGENT_PATH.is_file(), f"agent.py not found at {AGENT_PATH}"
    source = AGENT_PATH.read_text(encoding="utf-8")
    assert source.strip(), "agent.py is empty; there is nothing to check"
    return _tree(source)


def test_the_walk_actually_examined_the_module(agent_tree: ast.Module) -> None:
    """Loudness guard. If agent.py stopped parsing into functions, every check
    below would pass on an empty set and say nothing."""
    functions = [n for n in ast.walk(agent_tree) if isinstance(n, ast.FunctionDef)]
    classes = [n for n in ast.walk(agent_tree) if isinstance(n, ast.ClassDef)]
    assert len(functions) >= 5, f"only {len(functions)} functions parsed out of agent.py"
    assert len(classes) >= 5, f"only {len(classes)} classes parsed out of agent.py"
    assert _imported_modules(agent_tree), "agent.py appears to import nothing at all"


def test_agent_module_imports_no_network_client(agent_tree: ast.Module) -> None:
    offending = sorted(_imported_modules(agent_tree) & NETWORK_MODULES)
    assert offending == [], f"fairslip/agent.py imports {offending}; it must not reach the network"


def test_agent_module_makes_no_filing_call(agent_tree: ast.Module) -> None:
    offending = sorted(_called_attribute_names(agent_tree) & FILING_CALL_NAMES)
    assert offending == [], f"fairslip/agent.py calls {offending}; it prepares, it does not file"


def test_every_url_literal_in_the_module_is_declared_display_only(agent_tree: ast.Module) -> None:
    """A URL in this module is something shown to the worker so they can go to
    the authority themselves. Every one must be a declared REFERENCE_LINK, which
    is the set the module marks as never fetched."""
    declared = set(agent_module.REFERENCE_LINKS.values())
    assert declared, "REFERENCE_LINKS is empty; the check would be vacuous"
    undeclared = sorted(_url_literals(agent_tree) - declared)
    assert undeclared == [], f"undeclared URLs in agent.py: {undeclared}"


def test_reference_links_are_reachable_only_as_text() -> None:
    """Every declared link is a plain string constant. Nothing in the module
    holds a client, a session, or anything that could dereference one."""
    for name, url in agent_module.REFERENCE_LINKS.items():
        assert isinstance(url, str), f"{name} is not a string"
        assert url.startswith("https://"), f"{name} is not an https URL"


def test_the_module_declares_no_authentication_and_says_so() -> None:
    """The mandate level is whatever the caller sends. That is a real limitation
    of this build and it must be stated where a reader will find it, not only in
    a comment. See NO_AUTHENTICATION_NOTICE, which the API surfaces on screen."""
    notice = agent_module.NO_AUTHENTICATION_NOTICE
    assert "no authentication" in notice.lower()
    assert "caller" in notice.lower()
