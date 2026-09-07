#!/usr/bin/env python
"""Generate committed draft-cache entries for the demo. THE ONLY WRITER.

Nothing in the request path writes a draft entry. This script does, deliberately,
on a machine with a writable checkout and a working ANTHROPIC_API_KEY. The
entries it produces are committed to git and shipped in the deployment bundle,
where they are read-only.

    python scripts/make_draft_entry.py                  # every declared spec
    python scripts/make_draft_entry.py rahim_month1     # one of them
    python scripts/make_draft_entry.py --check          # report, write nothing
    python scripts/make_draft_entry.py --force          # regenerate existing

The specs come from demo.fixtures.draft_specs(). This script keeps no list of
its own, and neither does the precondition test - both derive from that one
tuple, so a spec cannot be added to the demo and forgotten here.

After running, COMMIT the files it reports. An entry that is not committed does
not exist in production, and the demo will call the model live instead - which
is the failure the cache exists to prevent.

A draft that breaks the copy contract is NEVER written: write_draft_entry builds
and checks it before anything touches the disk, so a rejected draft leaves no
file behind.

Exit codes: 0 all entries present, 1 the model failed or a draft was rejected,
2 bad arguments, 3 --check found a missing entry.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import demo.fixtures as fx
from fairslip.agent import (
    DEFAULT_DRAFT_CACHE_DIR,
    DRAFT_TEMPLATE_VERSION,
    DraftError,
    DraftRejectedError,
    draft_entry_path,
    draft_model,
    write_draft_entry,
)

# The demo language is Bengali, and a Windows console defaults to cp1252, which
# cannot encode it. Without this the script writes the entry successfully and
# THEN dies printing it - reporting failure for work that succeeded.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")


def load_env(path: Path) -> None:
    """Read backend/.env into the environment if present. Values are never
    printed by this script."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("names", nargs="*", help="spec names; default is all declared specs")
    ap.add_argument("--check", action="store_true", help="report only; write nothing")
    ap.add_argument("--force", action="store_true", help="regenerate an entry that exists")
    args = ap.parse_args()

    load_env(BACKEND / ".env")

    declared = dict(fx.draft_specs())
    if not declared:
        print("demo.fixtures.draft_specs() is empty; nothing to generate.")
        return 2

    names = args.names or list(declared)
    unknown = [n for n in names if n not in declared]
    if unknown:
        print(f"unknown spec(s): {unknown}. Declared: {sorted(declared)}")
        return 2

    model = draft_model()
    print(f"template {DRAFT_TEMPLATE_VERSION}  model {model}")
    print(f"cache dir {DEFAULT_DRAFT_CACHE_DIR}")

    missing = 0
    failed = 0
    for name in names:
        spec = declared[name]
        path = draft_entry_path(spec, DEFAULT_DRAFT_CACHE_DIR)
        exists = path.is_file()

        if args.check:
            print(f"  {'present' if exists else 'MISSING'}  {name}  {path.name}")
            missing += 0 if exists else 1
            continue

        if exists and not args.force:
            print(f"  present   {name}  {path.name}  (use --force to regenerate)")
            continue

        print(f"  calling {model} for {name} ({spec.language}) ...")
        try:
            written, draft = write_draft_entry(spec, DEFAULT_DRAFT_CACHE_DIR, model)
        except DraftRejectedError as e:
            print(f"  REJECTED  {name}: {e}")
            print("            Nothing was written. Re-run to try again.")
            failed += 1
            continue
        except DraftError as e:
            print(f"  FAILED    {name}: {e}")
            failed += 1
            continue

        print(f"  wrote     {written}")
        print(f"            English  : {draft.english[:88]}...")
        print(f"            {draft.language:<9}: {draft.translated[:60]}...")

    if args.check:
        if missing:
            print(f"\n{missing} entry/entries missing. Run without --check to generate.")
            return 3
        print("\nall declared specs have a committed entry.")
        return 0

    if failed:
        print(f"\n{failed} spec(s) failed. Nothing was written for those.")
        return 1

    print("\nDone. COMMIT the files above - an uncommitted entry does not exist in production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
