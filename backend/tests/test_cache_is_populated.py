"""The committed cache must actually contain entries for the demo images.

This file guards the PRECONDITION, not the mechanism. The cache shipped broken
because every existing test asked "would a hit work if an entry existed?" and
none asked "does an entry exist?". Both answers were needed and only one was
being checked, so a cache with zero entries passed a suite full of cache tests.

The demo script's setup line - "cache committed to the repo, verified with
network disabled" - is what these turn from a note into a check.

Until the artwork exists these skip, naming exactly what will be required. The
moment an image lands in backend/demo/ they start failing until its entries are
generated and committed.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from fairslip.extract import (
    DEFAULT_CACHE_DIR,
    ImageInput,
    cache_entry_path,
    default_readers,
    load_cache_entry,
)

DEMO = Path(__file__).resolve().parent.parent / "demo"
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

GENERATE = "python scripts/make_cache_entry.py demo/<image>"


def demo_images() -> list[Path]:
    """Every image committed under backend/demo/, which is where the artwork
    goes. Derived from the directory rather than a hand-kept list, so a new
    demo image is covered the moment it is added."""
    if not DEMO.is_dir():
        return []
    return sorted(
        p
        for p in DEMO.rglob("*")
        if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES and "extract_cache" not in p.parts
    )


def as_image_input(path: Path, role: str = "payslip") -> ImageInput:
    return ImageInput(
        role=role,
        media_type=MEDIA_TYPES[path.suffix.lower()],
        data=path.read_bytes(),
    )


def test_the_cache_directory_exists_once_there_is_artwork_to_cache() -> None:
    images = demo_images()
    if not images:
        pytest.skip(
            "no demo artwork yet. Once an image is committed under backend/demo/, "
            f"this requires backend/demo/extract_cache/ to exist. Generate with: {GENERATE}"
        )
    assert DEFAULT_CACHE_DIR.is_dir(), (
        f"{len(images)} demo image(s) are committed but {DEFAULT_CACHE_DIR} does not exist. "
        f"Generate entries with: {GENERATE}"
    )


def test_the_cache_is_not_empty_once_there_is_artwork_to_cache() -> None:
    """The check whose absence let a cache with zero entries ship."""
    images = demo_images()
    if not images:
        pytest.skip(
            "no demo artwork yet. Once an image is committed under backend/demo/, "
            f"this requires at least one entry in {DEFAULT_CACHE_DIR.name}/. Generate: {GENERATE}"
        )
    entries = list(DEFAULT_CACHE_DIR.glob("*.json")) if DEFAULT_CACHE_DIR.is_dir() else []
    assert entries, (
        f"{len(images)} demo image(s) are committed but the cache holds no entries. "
        f"With the network down the demo has nothing to fall back on. Generate: {GENERATE}"
    )


def test_every_demo_image_has_an_entry_for_every_reader() -> None:
    """One entry is not enough: /extract calls both readers, so a set with one
    reader cached still hits the network. Cases are derived from the images on
    disk and the configured readers, so neither list can be forgotten."""
    images = demo_images()
    if not images:
        pytest.skip(
            "no demo artwork yet. Once images are committed under backend/demo/, this "
            "requires an entry per (image, reader) pair - both readers, or the offline "
            f"path still reaches the network. Generate: {GENERATE}"
        )

    readers = default_readers()
    missing: list[str] = []
    for path in images:
        single = (as_image_input(path),)
        for reader in readers:
            if load_cache_entry(reader, single, DEFAULT_CACHE_DIR) is None:
                missing.append(
                    f"{path.relative_to(DEMO)} x {reader.model} "
                    f"-> {cache_entry_path(reader, single, DEFAULT_CACHE_DIR).name}"
                )

    assert not missing, (
        "these (image, reader) pairs have no committed cache entry:\n  "
        + "\n  ".join(missing)
        + f"\n\nGenerate with: {GENERATE}"
        + "\n\nNote: an image cached alone is a DIFFERENT entry from the same image sent "
        "alongside others, because the key covers the whole image set. Cache the "
        "combination the demo actually sends."
    )


def test_every_committed_entry_was_made_by_the_current_prompt_and_a_current_reader() -> None:
    """A stale entry is worse than none: it replays an answer to a question no
    longer being asked, and does it silently. load_cache_entry() already treats
    a key mismatch as a miss - this makes the staleness visible rather than
    letting the demo quietly fall back to the network."""
    if not DEFAULT_CACHE_DIR.is_dir():
        pytest.skip("no cache directory yet")
    entries = list(DEFAULT_CACHE_DIR.glob("*.json"))
    if not entries:
        pytest.skip("no committed cache entries yet")

    import json

    from fairslip.extract import PROMPT_VERSION

    live_models = {r.model for r in default_readers()}
    stale: list[str] = []
    for entry in entries:
        payload = json.loads(entry.read_text(encoding="utf-8"))
        if payload.get("prompt_version") != PROMPT_VERSION:
            stale.append(
                f"{entry.name}: prompt_version {payload.get('prompt_version')!r} "
                f"but the code is at {PROMPT_VERSION!r}"
            )
        elif payload.get("model") not in live_models:
            stale.append(
                f"{entry.name}: model {payload.get('model')!r} is not one of the "
                f"configured readers {sorted(live_models)}"
            )

    assert not stale, (
        "these committed entries can never be read back, so the demo would silently "
        "go live:\n  " + "\n  ".join(stale) + f"\n\nRegenerate with: {GENERATE} --force"
    )
