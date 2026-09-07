"""The deployed rewrite table and the registered FastAPI routes must cover each other.

Routing into a Vercel service is final: a path the rewrite sends to the backend
that the backend has no handler for is a hard 404, not a fallthrough to the
frontend. So an over-capture and an under-capture are both deployment bugs that
every local test would miss, because locally nothing consults vercel.json.

This is the prevention named in docs/debt.md against route-table-drift.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

pytest.importorskip("fastapi")
main = pytest.importorskip("app.main")

REPO = Path(__file__).resolve().parent.parent.parent
VERCEL = REPO / "vercel.json"

# Paths the framework registers that are not ours to route.
_FRAMEWORK_PATHS = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}


def config() -> dict:
    return json.loads(VERCEL.read_text(encoding="utf-8"))


def backend_rewrites() -> list[str]:
    return [
        r["source"]
        for r in config()["rewrites"]
        if isinstance(r.get("destination"), dict) and r["destination"].get("service") == "backend"
    ]


def app_paths() -> set[str]:
    return {
        r.path
        for r in main.app.routes
        if getattr(r, "path", "").startswith("/") and r.path not in _FRAMEWORK_PATHS
    }


def _to_regex(source: str) -> re.Pattern[str]:
    """Vercel sources are path-to-regexp-ish; the two shapes this file uses are
    an alternation group and a trailing optional segment. Anchor both ends,
    because Vercel matches the whole path."""
    return re.compile("^" + source + "$")


def routed_to_backend(path: str) -> bool:
    """First matching rewrite wins, exactly as Vercel evaluates them."""
    for r in config()["rewrites"]:
        if _to_regex(r["source"]).match(path):
            return isinstance(r.get("destination"), dict) and r["destination"].get(
                "service"
            ) == "backend"
    return False


def test_every_registered_backend_route_is_routed_to_the_backend() -> None:
    """Under-capture: a handler exists but the rewrite never sends traffic to it,
    so in production the frontend answers and the endpoint is invisible."""
    unrouted = sorted(p for p in app_paths() if not routed_to_backend(p))
    assert not unrouted, (
        f"these FastAPI routes are not routed to the backend service: {unrouted}. "
        f"Add them to a rewrite source in vercel.json."
    )


def test_extract_is_routed_and_handled() -> None:
    """The specific pairing this session added. vercel.json routed /extract
    before any handler existed, which was a hard 404 in production."""
    assert "/extract" in app_paths()
    assert routed_to_backend("/extract")


def test_no_backend_rewrite_captures_a_path_the_backend_cannot_answer() -> None:
    """Over-capture: the rewrite claims a path the backend has no handler for,
    so it is a hard 404 rather than falling through to the frontend.

    Cases are derived from the rewrite sources themselves - each alternation
    branch is probed - rather than from a hand-written list.
    """
    probes: set[str] = set()
    for source in backend_rewrites():
        group = re.search(r"\(([^()]*\|[^()]*)\)", source)
        if group:
            for branch in group.group(1).split("|"):
                probes.add("/" + branch)
        else:
            # e.g. "/demo(/.*)?" -> probe the bare prefix
            probes.add("/" + source.lstrip("/").split("(")[0].rstrip("/"))

    known = app_paths() | _FRAMEWORK_PATHS
    dead = sorted(p for p in probes if routed_to_backend(p) and p not in known)
    assert not dead, (
        f"vercel.json routes {dead} to the backend, which registers no such handler. "
        f"In production these are a hard 404, not a fallthrough. Registered: {sorted(app_paths())}"
    )


def test_the_demo_prefix_captures_exactly_what_it_serves() -> None:
    """The rewrite used to be /demo(/.*)?, which claimed the whole prefix while
    only /demo/fixtures existed - so every other /demo/* path was a hard 404 in
    production rather than a fallthrough. It now names the route that exists.

    A future /demo/<something> must be added to vercel.json as well as to the
    app; the under-capture test above is what catches forgetting to.
    """
    assert routed_to_backend("/demo/fixtures")
    for unregistered in ("/demo", "/demo/anything-at-all", "/demo/fixtures/extra"):
        assert unregistered not in app_paths()
        assert not routed_to_backend(unregistered), (
            f"{unregistered} has no handler but is routed to the backend, "
            f"which makes it a hard 404 in production"
        )


def test_the_catch_all_sends_everything_else_to_the_frontend() -> None:
    for path in ("/", "/check", "/some/deep/page"):
        assert not routed_to_backend(path), f"{path} should reach the frontend"


def test_the_backend_function_has_room_for_two_vision_calls() -> None:
    """/extract runs two vision models. Vercel's default function duration is
    well under what that needs, so the config must raise it deliberately."""
    fns = config()["services"]["backend"]["functions"]
    assert fns["app/main.py"]["maxDuration"] >= 60
