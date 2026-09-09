"""The interpreter running these tests must be able to run the server.

WHY THIS FILE EXISTS. `python-multipart` is an OPTIONAL FastAPI dependency:
without it, an app with an UploadFile endpoint imports fine, starts fine, and
raises on the first upload. It was installed in the system interpreter and not
in the project venv, so:

    python -m pytest              -> 963 passed   (system interpreter)
    .venv/.../uvicorn app.main    -> RuntimeError on the first upload

Both statements were true at the same time. The suite was green about a program
that could not serve a request, and the only reason anyone found out was that
the local server happened to be started by hand.

THE GATE WAS NOT THE PROBLEM. .claude/hooks/gate.sh and gate.ps1 both already
prefer the project's own venv, and had the gate run it would have gone red -
correctly. The problem was a HUMAN invoking `python -m pytest` directly, which
resolves to whatever is on PATH. A fix that only hardened the gate would leave
every manual run free to produce the same false green.

So the check lives HERE, where it cannot be bypassed by how the suite is
started: whichever interpreter runs these tests must have every dependency the
deployed application declares. If it does not, this goes red and names the
interpreter, instead of some other test passing on a machine the server cannot
run on.

See docs/debt.md, green-under-an-interpreter-that-cannot-serve.
"""

from __future__ import annotations

import re
import sys
import tomllib
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import pytest

PYPROJECT = Path(__file__).resolve().parent.parent / "pyproject.toml"


def _distribution_names(entries: list[str]) -> list[str]:
    """"uvicorn[standard]>=0.30" -> "uvicorn". Extras and version pins stripped;
    the question is whether the distribution is installed, not which version."""
    out = []
    for raw in entries:
        name = re.split(r"[\[<>=!;~ ]", raw.strip(), maxsplit=1)[0]
        if name:
            out.append(name)
    return out


def declared_runtime_dependencies() -> list[str]:
    data = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    deps = data["project"]["dependencies"]
    assert deps, "pyproject declares no runtime dependencies; this would prove nothing"
    return _distribution_names(deps)


@pytest.mark.parametrize("dist", declared_runtime_dependencies())
def test_every_declared_runtime_dependency_is_installed_here(dist: str) -> None:
    """Derived from pyproject, so a dependency added without being installed
    fails on the machine that added it rather than in production.

    `importlib.metadata` asks whether the DISTRIBUTION is installed, which
    sidesteps the import-name problem entirely - `python-multipart` imports as
    `multipart`, and a hand-written mapping of those is one more thing to get
    wrong.
    """
    try:
        version(dist)
    except PackageNotFoundError:
        pytest.fail(
            f"{dist} is declared in pyproject.toml but is not installed in the "
            f"interpreter running this suite:\n    {sys.executable}\n"
            f"This suite is therefore green about a program this interpreter "
            f"cannot serve. Install it here, or run the tests with the "
            f"interpreter that runs uvicorn."
        )


def test_the_optional_dependency_that_only_fails_at_request_time_is_declared() -> None:
    """python-multipart, named rather than derived, because it is the one whose
    absence is invisible until a request arrives.

    FastAPI raises for it inside the request handler, not at import - so every
    other check in this repo, including a successful `uvicorn` start and a
    passing /health, is compatible with it being missing.
    """
    assert "python-multipart" in declared_runtime_dependencies(), (
        "python-multipart is not declared. /employer/check takes an UploadFile, "
        "which needs it to parse multipart/form-data - and without it the app "
        "still imports, still starts, and still answers /health."
    )


def test_the_suite_reports_which_interpreter_ran_it(record_property) -> None:
    """Not an assertion about the environment - a record of it.

    When this file does fail, the first question is "which python?", and the
    answer should already be in the run rather than reconstructed afterwards.
    """
    record_property("interpreter", sys.executable)
    assert sys.executable, "no interpreter path available"
