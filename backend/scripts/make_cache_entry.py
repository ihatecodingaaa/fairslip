#!/usr/bin/env python
"""Generate committed cache entries for the demo images. THE ONLY WRITER.

Nothing in the request path writes a cache entry. This script does, deliberately,
on a machine with a writable checkout and working API keys. The entries it
produces are committed to git and shipped in the deployment bundle, where they
are read-only.

    python scripts/make_cache_entry.py demo/payslip.jpg
    python scripts/make_cache_entry.py demo/payslip.jpg demo/roster.png
    python scripts/make_cache_entry.py --check demo/payslip.jpg

Images passed together in ONE invocation are cached as one request, because the
cache key covers the whole image set: two images sent together are a different
request from either sent alone, and get a different entry. Match the invocation
to how the demo will actually call /extract.

After running, COMMIT the files it reports. An entry that is not committed does
not exist in production.

Exit codes: 0 all entries present, 1 a reader failed, 2 bad arguments,
3 --check found a missing entry.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fairslip.extract import (
    DEFAULT_CACHE_DIR,
    DOCUMENT_ROLES,
    PROMPT_VERSION,
    ExtractionError,
    ImageInput,
    UnknownDocumentError,
    cache_entry_path,
    default_readers,
    image_from_path,
    load_cache_entry,
    write_cache_entry,
)


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


def to_image(spec: str) -> ImageInput:
    """Accept `path` or `role=path`. Role inference and the media-type map live
    in fairslip.extract, so this script and tests/test_cache_is_populated.py
    cannot disagree about a file's role - which is part of the cache key."""
    role: str | None = None
    if "=" in spec and spec.split("=", 1)[0] in DOCUMENT_ROLES:
        head, raw = spec.split("=", 1)
        role, path = head, Path(raw)
    else:
        path = Path(spec)

    if not path.is_file():
        raise SystemExit(f"no such file: {path}")
    try:
        return image_from_path(path, role)
    except UnknownDocumentError as e:
        raise SystemExit(str(e)) from e


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Generate committed cache entries for the demo images.",
        epilog="Commit the files this reports. An uncommitted entry does not exist in production.",
    )
    ap.add_argument("images", nargs="+", metavar="[role=]PATH")
    ap.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_CACHE_DIR,
        help="where entries are written (default: backend/demo/extract_cache)",
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="report whether entries exist; call no reader and write nothing",
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="regenerate even if an entry already exists",
    )
    args = ap.parse_args(argv)

    load_env(BACKEND / ".env")

    try:
        images = tuple(to_image(spec) for spec in args.images)
    except SystemExit as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    readers = default_readers()

    print(f"prompt version : {PROMPT_VERSION}")
    print(f"cache directory: {args.cache_dir}")
    print("images         :")
    for img in images:
        print(f"  {img.role:<8} {len(img.data):>9,} bytes  {img.media_type}")
    print()

    missing = 0
    failed = 0

    for reader in readers:
        path = cache_entry_path(reader, images, args.cache_dir)
        existing = load_cache_entry(reader, images, args.cache_dir)
        label = f"{reader.provider} / {reader.model}"

        if existing is not None and not args.force:
            print(f"  [have] {label}\n         {path.name}")
            continue

        if args.check:
            print(f"  [MISSING] {label}\n            expected {path.name}")
            missing += 1
            continue

        print(f"  [call] {label} ...", end=" ", flush=True)
        try:
            written, reading = write_cache_entry(reader, images, args.cache_dir)
        except ExtractionError as e:
            print("FAILED")
            print(f"         {e}", file=sys.stderr)
            failed += 1
            continue

        print(f"{reading.latency_ms} ms")
        print(f"         wrote {written.name}")
        for name in sorted(reading.values):
            print(f"           {name:<26} {reading.values[name]!r}")

    print()
    if args.check:
        if missing:
            print(f"{missing} entry/entries missing. Generate them before relying on the cache.")
            return 3
        print("all entries present.")
        return 0

    if failed:
        print(f"{failed} reader(s) failed. Nothing was written for those - fix and re-run.")
        return 1

    print("Done. COMMIT the files above; an uncommitted entry does not exist in production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
