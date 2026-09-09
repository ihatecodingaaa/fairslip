#!/usr/bin/env python
"""Read the printed take-away sheet back in greyscale, and refuse to be quiet.

    python scripts/check_print_sheet.py sheet-nobg.pdf sheet-bg.pdf
    python scripts/check_print_sheet.py sheet-nobg.pdf sheet-bg.pdf --save-pages out/

THE TWO PDFs ARE THE SAME PAGE PRINTED TWICE - once with Chrome's "background
graphics" box unticked, which is the default, and once with it ticked. A worker
in an NGO office will never find that box, so the sheet must not depend on it.
This asserts they are the same document: same page count, and identical rasters
rendered in GREYSCALE, which is the colour space a photocopier has.

It then looks for grey FILLS, which is a harder question than it sounds and is
the reason this file is longer than it looks like it should be. See below.

Produce the two PDFs with Page.printToPDF over CDP (printBackground false, then
true). Do not produce them by clicking the print button: window.print() opens a
modal that blocks the debugging session, and a modal is also what it would do to
a demo on a projector.

WHY THIS FILE EXISTS AT ALL, rather than living in someone's scratchpad: the
check needs pymupdf, which is a dev dependency and nothing in the request path
imports. A verification script whose only dependency is optional is a script
that, on a fresh clone, does nothing and says nothing - and a probe that
silently examined nothing is worse than no probe, because its silence reads as a
pass. So the import below is FAIL-CLOSED: no try/except, no skip, no "install
pymupdf to enable this check". It is declared in pyproject.toml under
[project.optional-dependencies] dev, and if it is absent this exits non-zero
before it can report anything.

Every run begins by proving the fill detector can still fail - see self_test().

Exit codes: 0 the two sheets are identical and carry no grey fill,
1 they differ or a fill was found, 2 bad arguments or a failed self-test.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# FAIL-CLOSED, deliberately. See the module docstring: a guarded import here
# would let this script pass by doing nothing.
# See docs/debt.md, check-disabled-by-absent-dependency.
import pymupdf

# Rendering resolution. High enough that a 1.6px icon stroke and a dashed ring
# survive to be looked at, low enough that six A4 pages fit in memory twice.
DPI = 110

# HOW A FILL IS TOLD FROM AN EDGE, and why it is not a pixel count.
#
# The first version of this check counted pixels per grey level and failed
# anything above 0.2% of a page. It reported 56 failures on a sheet that is
# provably black and white, because ANTIALIASING PUTS A GREY ON EVERY GLYPH
# EDGE: 506,829 of 7 million pixels, spread over 254 levels, none of them a
# fill. Counting cannot separate them - a page of text has more grey edge pixels
# than a small grey box has fill pixels.
#
# The difference is SHAPE, not quantity. An antialiased edge is thin in at least
# one direction. A fill is wide in both. An underline or a hairline rule is the
# case that catches naive versions of this: it can be hundreds of pixels long,
# so a run-length test fails it, but it is only two or three pixels tall.
#
# So: a fill is a SOLID SQUARE of one grey, BLOCK px on a side. Nothing that is
# merely an edge survives that, and nothing that is a fill escapes it.
BLOCK = 12  # px at 110 dpi, about 2.8mm - smaller than any card, bigger than any stroke

# HOW DIFFERENT THE TWO RENDERS MAY BE, and why it is not zero.
#
# The first version demanded byte-identical rasters and eventually failed on
# four pixels that differed by ONE LEVEL - 252 against 253 - at the page margin,
# where the renderer rounds an antialiased edge differently between two runs.
# That is not "something is painted by a fill"; it is the rasteriser, and
# reporting it as a fill would have sent someone looking for a bug that is not
# there. The check that examines the wrong thing is a defect class in this repo
# already.
#
# What the claim actually is: NOTHING VISIBLE depends on the background-graphics
# setting. A fill appearing or disappearing moves a pixel by a hundred levels or
# more - the calendar icon this check found in Phase 4 moved them by 255. A
# rounding difference moves it by one or two. Sixteen is comfortably above the
# noise and far below any real fill.
MAX_DELTA = 16


def render(path: Path, save_to: Path | None, tag: str) -> list[tuple[bytes, int, int]]:
    doc = pymupdf.open(path)
    pages = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
        pages.append((pix.samples, pix.width, pix.height))
        if save_to is not None:
            save_to.mkdir(parents=True, exist_ok=True)
            pix.save(str(save_to / f"{tag}-p{i + 1}.png"))
    doc.close()
    return pages


def _grey_runs(row: bytes) -> list[tuple[int, int, int]]:
    """(start, end_exclusive, value) for each run of one grey at least BLOCK long."""
    out = []
    start = 0
    for x in range(1, len(row) + 1):
        if x == len(row) or row[x] != row[start]:
            if x - start >= BLOCK and row[start] not in (0, 255):
                out.append((start, x, row[start]))
            start = x
    return out


def grey_fills(page: tuple[bytes, int, int]) -> list[tuple[int, int, int, int]]:
    """Solid BLOCKxBLOCK squares of a single grey: (value, x, y, height)."""
    samples, w, h = page
    found: list[tuple[int, int, int, int]] = []
    # Vertical streaks, keyed by the horizontal run they continue.
    active: dict[tuple[int, int, int], int] = {}  # (start, end, value) -> rows so far
    for y in range(h):
        row = samples[y * w : (y + 1) * w]
        runs = _grey_runs(row)
        nxt: dict[tuple[int, int, int], int] = {}
        for start, end, value in runs:
            # Continue any streak of the same value that overlaps by >= BLOCK.
            best = 0
            for (s0, e0, v0), n in active.items():
                if v0 == value and min(end, e0) - max(start, s0) >= BLOCK:
                    best = max(best, n)
            nxt[(start, end, value)] = best + 1
            if best + 1 >= BLOCK:
                found.append((value, start, y - BLOCK + 1, BLOCK))
        active = nxt
        if found:
            break
    return found


def _synthetic(w: int, h: int, draw) -> tuple[bytes, int, int]:
    buf = bytearray([255]) * (w * h)
    draw(buf, w)
    return bytes(buf), w, h


def self_test() -> None:
    """Prove the detector can FAIL before trusting it to pass.

    A check that examines nothing reports success, and this one has exactly the
    shape that goes wrong quietly: tighten BLOCK or break the overlap test and
    grey_fills() returns an empty list for every input, which is
    indistinguishable from a clean sheet. So it is handed a page with a grey box
    and a page with only grey EDGES on every run, and it has to tell them apart
    before it is allowed to look at the real one.

    The second case is the one that matters. It carries a 300px underline two
    pixels tall and a one-pixel vertical rule - the shapes a pixel-count or a
    run-length test calls a fill. See the note above BLOCK.
    """

    def box(buf, w):
        for y in range(40, 40 + BLOCK + 6):
            for x in range(60, 60 + BLOCK + 6):
                buf[y * w + x] = 128

    def edges(buf, w):
        for x in range(20, 320):  # an underline, long and thin
            for y in (100, 101):
                buf[y * w + x] = 128
        for y in range(20, 320):  # a hairline rule, tall and thin
            buf[y * w + 400] = 128

    filled = grey_fills(_synthetic(500, 400, box))
    clean = grey_fills(_synthetic(500, 400, edges))

    # And the two-render comparison: a fill must be caught, a rounding must not.
    if 255 <= MAX_DELTA:
        raise SystemExit(
            "self-test FAILED: MAX_DELTA is at or above 255, so no difference between "
            "the two renders could ever be reported."
        )
    if MAX_DELTA < 4:
        raise SystemExit(
            f"self-test FAILED: MAX_DELTA is {MAX_DELTA}, below the renderer's own "
            f"antialiasing noise - the check would fail on clean sheets."
        )
    if not filled:
        raise SystemExit(
            "self-test FAILED: grey_fills() did not find a solid grey box. The "
            "detector cannot fail, so a pass from it means nothing."
        )
    if clean:
        raise SystemExit(
            f"self-test FAILED: grey_fills() called a thin edge a fill ({clean[:2]}). "
            f"It would reject every sheet with an underline on it."
        )


def main() -> int:
    self_test()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("nobg", type=Path, help="printed with printBackground: false")
    ap.add_argument("bg", type=Path, help="printed with printBackground: true")
    ap.add_argument("--save-pages", type=Path, default=None, help="write greyscale PNGs here")
    args = ap.parse_args()

    for p in (args.nobg, args.bg):
        if not p.exists():
            print(f"no such file: {p}", file=sys.stderr)
            return 2

    a = render(args.nobg, args.save_pages, "nobg")
    b = render(args.bg, args.save_pages, "bg")
    failed = False

    if len(a) != len(b):
        print(f"FAIL page count: background off {len(a)}, background on {len(b)}")
        failed = True
    else:
        print(f"{len(a)} A4 page(s), rendered greyscale at {DPI} dpi")

    worst = 0
    for i, ((xa, _, _), (xb, _, _)) in enumerate(zip(a, b), start=1):
        deltas = [abs(p - q) for p, q in zip(xa, xb) if p != q]
        if not deltas:
            continue
        page_worst = max(deltas)
        worst = max(worst, page_worst)
        if page_worst > MAX_DELTA:
            n = sum(1 for d in deltas if d > MAX_DELTA)
            print(
                f"FAIL page {i}: {n} pixels differ by up to {page_worst} levels between "
                f"background graphics off and on. Something on this page is painted by a "
                f"fill rather than by ink, so most readers will not see it."
            )
            failed = True
    if not failed:
        print(
            f"background graphics off vs on: nothing visible depends on it "
            f"(largest difference {worst} of 255, threshold {MAX_DELTA})"
        )

    total = sum(len(s) for s, _, _ in a)
    edges = sum(1 for s, _, _ in a for v in s if v not in (0, 255))
    for i, page in enumerate(a, start=1):
        for value, x, y, _ in grey_fills(page):
            print(
                f"FAIL page {i}: a solid {BLOCK}x{BLOCK} block of grey {value} at "
                f"({x}, {y}). A photocopier loses a grey fill; ink and paper are "
                f"the only two values the sheet may use."
            )
            failed = True

    print(
        f"no grey fill: no {BLOCK}x{BLOCK} square of a single grey on any page. "
        f"{edges} of {total} pixels ({edges / total:.1%}) are intermediate greys, "
        f"and every one of them is a glyph edge."
        if not failed
        else f"intermediate-grey pixels: {edges} of {total}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
