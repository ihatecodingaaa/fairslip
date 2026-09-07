"""Two independent vision readers, and pure-code reconciliation of what they said.

The pipeline this implements, from .claude/rules/fairslip-domain.md:

    image(s) -> [Reader A]  [Reader B]        (neither sees the other's answer)
                     +-- reconcile (here) --+
                              |
                     Fact(value, status, source) per field

Three rules hold this module together, and each has a test:

1. A reader is only ever shown READER_FIELDS. The worker-only fields are not in
   the schema, not in the prompt, and not in the response type, so there is no
   path by which a model's guess about residency or a bank balance can enter.

2. A field is AGREED only when both readers returned a value AND the two
   normalise to the same Decimal. One reader answering alone is not agreement,
   it is MISSING - including when the other reader failed outright. A reader
   outage therefore degrades to "nothing was established", never to "reader A
   said so".

3. Nothing here computes money, and nothing here invents a confidence. The
   status IS the confidence. A field that is not AGREED goes to the worker.

Reconciliation is pure: reconcile() takes reader output and returns Facts. It
makes no network call and can be tested with canned readings, which is how the
reconciler tests run - no API key, no images, no cost.

## The cache contract

Cache entries are GENERATED OFFLINE, COMMITTED TO THE REPO, and READ-ONLY AT
RUNTIME. Nothing in the request path writes one:

    backend/scripts/make_cache_entry.py   the only writer, run by hand
              |  (entry committed to git)
              v
    backend/demo/extract_cache/*.json
              |
    load_cache_entry()  <- read_with_cache() <- POST /extract

This is the contract, not a workaround for the deployment. The previous version
wrote at runtime, which on a read-only serverless filesystem raised OSError on
every write, was swallowed, and cached nothing - permanently and silently, while
the docs described it as working. See docs/debt.md,
write-path-contradicts-its-own-contract.

Moving writes to /tmp would not fix it: /tmp does not survive between
invocations, so the cache would still be empty when the network is down, having
looked correct in testing.

A miss is never silent. Every reading carries `cache` (HIT/MISS) and the
`cache_key` it looked for, and POST /extract aggregates that to the top of the
response so a screen can say which path it is on.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Protocol

from fairslip.extract_schema import READER_FIELDS, READER_HINTS
from fairslip.rules import Fact, Status

# Bump when the prompt or the schema changes. It is part of the cache key, so a
# cached answer can never be replayed as though a different prompt produced it.
PROMPT_VERSION = "2026-09-07.1"

# Reader output is a handful of short strings. A small ceiling here is a
# deliberate fit to the response shape, not a cost cap: if a reader ever needs
# more than this, the response is not the schema we asked for.
MAX_TOKENS = 2048

DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / "demo" / "extract_cache"

# What a reading's `cache` field says about where it came from.
CACHE_HIT = "HIT"  # replayed from an entry committed to the repo
CACHE_MISS = "MISS"  # no entry existed; this reading was made live


class ExtractionError(RuntimeError):
    """A reader could not be reached, or answered with something that was not the
    schema. Never swallowed into an empty reading: an empty reading would read as
    'the document does not show this', which is a different claim."""


# --------------------------------------------------------------------------
# Inputs
# --------------------------------------------------------------------------

# The documents a reader may be given, and the words used to introduce each one.
# A reader is told which image is which, because "hours" on a payslip and
# "hours" on a roster are not the same fact.
DOCUMENT_ROLES: dict[str, str] = {
    "payslip": "a payslip (an itemised pay record issued by the employer)",
    "roster": "a work roster, timesheet or schedule showing days and hours worked",
    "ket": "a key employment terms (KET) document stating the agreed terms",
}


# Loading an image from a path, in ONE place.
#
# The cache key covers each image's role, so the role a file is given must be
# the same wherever it is computed. It was briefly not: the generator script
# inferred the role from the filename while the precondition test defaulted
# every image to "payslip", so a roster's entry could never be found by the
# test that demanded it. Both now call the same function.

MEDIA_TYPES_BY_SUFFIX: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

# A filename is the only hint about what a document is, and the role changes
# what the reader is told the image shows. An unguessable name is an error, not
# a silent default.
ROLE_HINTS: dict[str, tuple[str, ...]] = {
    "payslip": ("payslip", "slip", "pay"),
    "roster": ("roster", "timesheet", "schedule", "hours", "whatsapp"),
    "ket": ("ket", "terms", "contract"),
}


class UnknownDocumentError(ValueError):
    """A file whose role cannot be determined from its name."""


def role_for_filename(path: Path) -> str:
    name = path.stem.lower()
    for role, hints in ROLE_HINTS.items():
        if any(h in name for h in hints):
            return role
    raise UnknownDocumentError(
        f"cannot tell what {path.name} is from its name. Rename it to contain one of "
        f"{sorted(h for hs in ROLE_HINTS.values() for h in hs)}, or give the role explicitly."
    )


def image_from_path(path: Path, role: str | None = None) -> ImageInput:
    """Read an image off disk as the readers will see it. The role is inferred
    from the filename unless given."""
    suffix = path.suffix.lower()
    media_type = MEDIA_TYPES_BY_SUFFIX.get(suffix)
    if media_type is None:
        raise UnknownDocumentError(
            f"{path.name}: unsupported image type {suffix!r}; "
            f"expected one of {sorted(MEDIA_TYPES_BY_SUFFIX)}"
        )
    return ImageInput(
        role=role or role_for_filename(path),
        media_type=media_type,
        data=path.read_bytes(),
    )


@dataclass(frozen=True)
class ImageInput:
    """One document. `data` is the raw bytes; the base64 encoding happens at the
    edge of each reader, because the two APIs want it in different envelopes."""

    role: str
    media_type: str
    data: bytes

    def __post_init__(self) -> None:
        if self.role not in DOCUMENT_ROLES:
            raise ValueError(f"unknown document role {self.role!r}")
        if not self.data:
            raise ValueError(f"{self.role}: no image data")

    @property
    def b64(self) -> str:
        return base64.standard_b64encode(self.data).decode("ascii")


# --------------------------------------------------------------------------
# The one schema both readers are given
# --------------------------------------------------------------------------


def reader_field_order() -> tuple[str, ...]:
    """Sorted, so the prompt bytes are stable for a given field set. An unstable
    ordering would change the cache key on every call and defeat the cache."""
    return tuple(sorted(READER_FIELDS))


def reader_json_schema() -> dict:
    """Derived from READER_FIELDS, never retyped. Every field is nullable and
    every field is required: a reader must answer each one, and 'null' is the
    answer that means 'this document does not show it'. Values are strings so
    that nothing becomes a float between the model and the Decimal comparison."""
    return {
        "type": "object",
        "properties": {
            name: {
                "type": ["string", "null"],
                "description": READER_HINTS[name],
            }
            for name in reader_field_order()
        },
        "required": list(reader_field_order()),
        "additionalProperties": False,
    }


def reader_prompt(images: tuple[ImageInput, ...]) -> str:
    """The instruction both readers receive, verbatim. It asks for transcription
    and forbids inference, because a reader that reasons its way to a plausible
    number produces a value that looks exactly like a value it read."""
    listing = "\n".join(
        f"Image {i + 1} is {DOCUMENT_ROLES[img.role]}." for i, img in enumerate(images)
    )
    return f"""You are transcribing figures from Singapore employment documents.

{listing}

Report ONLY what is legibly printed or written in the images. Specifically:

- Do not calculate. If a total is not shown, answer null rather than adding
  numbers up yourself. The one exception is a column of overtime hours that the
  document itself presents as a list of daily entries to be totalled.
- Do not infer. If a figure is implied but not stated, answer null.
- Do not guess at unclear handwriting. If you cannot read a digit with
  confidence, answer null rather than choosing the more likely reading.
- Give numbers as plain digits with no currency symbol and no thousands
  separator: 1200.00, not $1,200.00.
- A field that the documents do not show must be null. null is a complete and
  correct answer, and is strongly preferred over an approximation.

Another reader is transcribing the same images independently. Do not try to
produce an expected or a round answer; report what you see.

Return the JSON object described by the schema and nothing else."""


# --------------------------------------------------------------------------
# One reader's answer
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ReaderReading:
    """What one reader returned, or why it returned nothing.

    `values` maps a reader field to the raw string the model gave, or None where
    it answered null. On failure `values` is empty and `error` says what
    happened - the two are never conflated, because an empty reading means "the
    document does not show these" and a failed reading means "we do not know"."""

    key: str
    label: str
    model: str
    provider: str
    values: dict[str, str | None] = field(default_factory=dict)
    ok: bool = True
    error: str | None = None
    latency_ms: int | None = None
    # CACHE_HIT if a committed entry was replayed, CACHE_MISS if this reading was
    # made live. `cache_key` names the entry that was looked for either way, so a
    # miss can be acted on rather than merely noticed.
    cache: str = CACHE_MISS
    cache_key: str = ""

    @property
    def from_cache(self) -> bool:
        """Derived, never stored separately: two fields that can disagree about
        the same fact are a defect waiting to happen."""
        return self.cache == CACHE_HIT

    @staticmethod
    def failed(
        reader: Reader,
        error: str,
        latency_ms: int | None = None,
        cache_key: str = "",
    ) -> ReaderReading:
        return ReaderReading(
            key=reader.key,
            label=reader.label,
            model=reader.model,
            provider=reader.provider,
            values={},
            ok=False,
            error=error,
            latency_ms=latency_ms,
            cache=CACHE_MISS,
            cache_key=cache_key,
        )


class Reader(Protocol):
    key: str
    label: str
    model: str
    provider: str

    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        """Return the raw schema answer, or raise ExtractionError."""


def _parse_reader_json(raw: str) -> dict[str, str | None]:
    """Accept the schema and nothing else. A reader that returns extra keys has
    not answered the schema; say so rather than salvaging the parts that fit."""
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ExtractionError(f"reader did not return JSON: {e}") from e
    if not isinstance(parsed, dict):
        raise ExtractionError(f"reader returned {type(parsed).__name__}, not a JSON object")

    expected = set(READER_FIELDS)
    extra = set(parsed) - expected
    if extra:
        raise ExtractionError(f"reader returned fields outside the schema: {sorted(extra)}")

    out: dict[str, str | None] = {}
    for name in expected:
        v = parsed.get(name)
        if v is None:
            out[name] = None
        elif isinstance(v, str):
            out[name] = v
        else:
            # A bare JSON number would have passed through float on the way here;
            # keep it as text and let normalise() be the one thing that parses.
            out[name] = str(v)
    return out


# --------------------------------------------------------------------------
# Reader A: Claude, via the Anthropic API
# --------------------------------------------------------------------------


class ClaudeReader:
    """Primary reader. The model is configurable so the pick is visible in the
    environment rather than buried in a constant; docs/reader-models.md records
    how the current default was chosen."""

    key = "reader_a"
    provider = "Anthropic"

    def __init__(self, model: str | None = None, api_key: str | None = None) -> None:
        self.model = model or os.getenv("FAIRSLIP_READER_A_MODEL", "claude-haiku-4-5")
        self.label = f"Claude ({self.model})"
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY")

    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        try:
            import anthropic
        except ImportError as e:  # pragma: no cover - dependency is declared
            raise ExtractionError(f"anthropic SDK not installed: {e}") from e

        if not self._api_key:
            raise ExtractionError("ANTHROPIC_API_KEY is not set")

        client = anthropic.Anthropic(api_key=self._api_key)
        content: list[dict] = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": img.media_type, "data": img.b64},
            }
            for img in images
        ]
        content.append({"type": "text", "text": reader_prompt(images)})

        try:
            resp = client.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": content}],
                output_config={"format": {"type": "json_schema", "schema": reader_json_schema()}},
            )
        except Exception as e:  # the SDK raises a family of typed errors; all mean "no reading"
            raise ExtractionError(f"{type(e).__name__}: {e}") from e

        if resp.stop_reason == "refusal":
            raise ExtractionError("the model declined to transcribe this image")

        text = next((b.text for b in resp.content if b.type == "text"), None)
        if text is None:
            raise ExtractionError(f"no text block in the response (stop_reason={resp.stop_reason})")
        return _parse_reader_json(text)


# --------------------------------------------------------------------------
# Reader B: a second vision model, from a second vendor, called directly
# --------------------------------------------------------------------------


class OpenAIReader:
    """Auditor. A different vendor's model, called against OpenAI's own API.

    Direct, not through an aggregator. The independence this architecture rests
    on is independence of *vendor*: two models that share training tend to share
    their mistakes, and a shared mistake arrives as an AGREED, which is the one
    failure two readers cannot catch. Routing through a third party would add a
    shared dependency between the two readers - one account, one balance, one
    outage - which is the opposite of what the second reader is for.
    """

    key = "reader_b"
    provider = "OpenAI"

    def __init__(self, model: str | None = None, api_key: str | None = None) -> None:
        self.model = model or os.getenv("FAIRSLIP_READER_B_MODEL", "gpt-5.6-luna")
        self.label = f"OpenAI ({self.model})"
        self._api_key = api_key or os.getenv("OPENAI_API_KEY")

    def read(self, images: tuple[ImageInput, ...]) -> dict[str, str | None]:
        try:
            from openai import OpenAI
        except ImportError as e:  # pragma: no cover - dependency is declared
            raise ExtractionError(f"openai SDK not installed: {e}") from e

        if not self._api_key:
            raise ExtractionError("OPENAI_API_KEY is not set")

        client = OpenAI(api_key=self._api_key)
        content: list[dict] = [{"type": "text", "text": reader_prompt(images)}]
        content += [
            {
                "type": "image_url",
                "image_url": {"url": f"data:{img.media_type};base64,{img.b64}"},
            }
            for img in images
        ]

        request = {
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "fairslip_document_fields",
                    "strict": True,
                    "schema": reader_json_schema(),
                },
            },
        }

        # Newer OpenAI models take `max_completion_tokens`; older ones take
        # `max_tokens` and reject the new name. Try the current spelling and fall
        # back once, rather than pinning the reader to one model generation.
        try:
            resp = client.chat.completions.create(
                **request, max_completion_tokens=MAX_TOKENS
            )
        except Exception as first:
            if "max_tokens" not in str(first):
                raise ExtractionError(f"{type(first).__name__}: {first}") from first
            try:
                resp = client.chat.completions.create(**request, max_tokens=MAX_TOKENS)
            except Exception as e:
                raise ExtractionError(f"{type(e).__name__}: {e}") from e

        if not resp.choices:
            raise ExtractionError("no choices in the response")
        text = resp.choices[0].message.content
        if not text:
            raise ExtractionError(
                f"empty response content (finish_reason={resp.choices[0].finish_reason})"
            )
        return _parse_reader_json(text)


def default_readers() -> tuple[Reader, Reader]:
    return ClaudeReader(), OpenAIReader()


# --------------------------------------------------------------------------
# Cache, keyed by content
# --------------------------------------------------------------------------


def cache_key(reader: Reader, images: tuple[ImageInput, ...]) -> str:
    """Includes the model id and the prompt version, not only the image bytes.
    A cached answer is only ever replayed for the exact model and prompt that
    produced it; change either and the key changes and the cache misses."""
    h = hashlib.sha256()
    h.update(PROMPT_VERSION.encode())
    h.update(b"\0")
    h.update(reader.model.encode())
    for img in images:
        h.update(b"\0")
        h.update(img.role.encode())
        h.update(b"\0")
        h.update(img.media_type.encode())
        h.update(b"\0")
        h.update(hashlib.sha256(img.data).digest())
    return h.hexdigest()


class CacheMissError(ExtractionError):
    """No committed entry for these images, and live calls were not permitted.

    Distinct from a reader failure: the readers were never asked. Raised only
    when the caller has explicitly demanded the cached path."""


def cache_entry_path(reader: Reader, images: tuple[ImageInput, ...], cache_dir: Path) -> Path:
    return cache_dir / f"{cache_key(reader, images)}.json"


def load_cache_entry(
    reader: Reader, images: tuple[ImageInput, ...], cache_dir: Path | None
) -> ReaderReading | None:
    """Read a committed entry, or return None. Never calls a reader, never writes.

    A corrupt or truncated entry is a miss, not a reading: returning half a
    parsed file would be presenting a guess as a transcription.
    """
    if cache_dir is None:
        return None
    key = cache_key(reader, images)
    path = cache_dir / f"{key}.json"
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        values = payload["values"]
        if not isinstance(values, dict):
            return None
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return ReaderReading(
        key=reader.key,
        label=reader.label,
        model=reader.model,
        provider=reader.provider,
        values=dict(values),
        ok=True,
        latency_ms=payload.get("latency_ms"),
        cache=CACHE_HIT,
        cache_key=key,
    )


def read_with_cache(
    reader: Reader,
    images: tuple[ImageInput, ...],
    cache_dir: Path | None = DEFAULT_CACHE_DIR,
    *,
    allow_live: bool = True,
) -> ReaderReading:
    """Replay a committed entry if one exists; otherwise call the reader.

    THIS FUNCTION NEVER WRITES. Entries are generated deliberately, offline, by
    backend/scripts/make_cache_entry.py, and committed. That is not a limitation
    of the deployment - it is the contract. A runtime write path would be
    unreachable on a read-only serverless filesystem and would fail silently
    there, which is exactly the defect this replaced (docs/debt.md,
    write-path-contradicts-its-own-contract).

    A miss is never silent. The returned reading carries cache=CACHE_MISS and
    the cache_key that was looked for, so a screen can say which path it is on
    and an operator can see which entry is absent.

    With allow_live=False a miss raises CacheMissError rather than reaching the
    network - the setting to use when proving the offline demo path works.
    """
    cached = load_cache_entry(reader, images, cache_dir)
    if cached is not None:
        return cached

    key = cache_key(reader, images)
    if not allow_live:
        raise CacheMissError(
            f"no committed cache entry for {reader.model} at {key}; "
            f"live calls are disabled, so nothing was read"
        )

    started = time.monotonic()
    try:
        values = reader.read(images)
    except ExtractionError as e:
        return ReaderReading.failed(
            reader, str(e), int((time.monotonic() - started) * 1000), cache_key=key
        )

    return ReaderReading(
        key=reader.key,
        label=reader.label,
        model=reader.model,
        provider=reader.provider,
        values=values,
        ok=True,
        latency_ms=int((time.monotonic() - started) * 1000),
        cache=CACHE_MISS,
        cache_key=key,
    )


def write_cache_entry(
    reader: Reader,
    images: tuple[ImageInput, ...],
    cache_dir: Path = DEFAULT_CACHE_DIR,
) -> tuple[Path, ReaderReading]:
    """Call the reader for real and commit the answer to disk.

    The ONLY thing in the codebase that writes a cache entry, and nothing in the
    request path calls it. It is invoked by hand, from
    backend/scripts/make_cache_entry.py, on a machine with a writable checkout
    and working keys, and the resulting file is committed.

    A failed reading is never written: committing one would turn a transient
    outage into a permanent "this document does not show it" that ships.
    """
    started = time.monotonic()
    values = reader.read(images)  # raises ExtractionError; the caller reports it
    latency_ms = int((time.monotonic() - started) * 1000)

    key = cache_key(reader, images)
    path = cache_dir / f"{key}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "prompt_version": PROMPT_VERSION,
                "model": reader.model,
                "provider": reader.provider,
                "reader_key": reader.key,
                "images": [
                    {
                        "role": img.role,
                        "media_type": img.media_type,
                        "sha256": hashlib.sha256(img.data).hexdigest(),
                        "bytes": len(img.data),
                    }
                    for img in images
                ],
                "latency_ms": latency_ms,
                "values": values,
            },
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    return path, ReaderReading(
        key=reader.key,
        label=reader.label,
        model=reader.model,
        provider=reader.provider,
        values=values,
        ok=True,
        latency_ms=latency_ms,
        cache=CACHE_MISS,
        cache_key=key,
    )


# --------------------------------------------------------------------------
# Normalisation, then reconciliation. Pure code from here down.
# --------------------------------------------------------------------------

_STRIP = re.compile(r"[\s,$]|(?i:sgd)|(?i:hrs?)|(?i:hours?)")


def normalise(raw: str | None) -> Decimal | None:
    """Currency symbols, spaces, thousands separators and a trailing unit come
    off; what is left must parse as a Decimal or this is not a value.

    "18", " 18.0 ", "$18.00" and "18 hrs" all normalise to the same Decimal, so
    all four AGREE with each other. That is the point: the comparison is between
    Decimals, never between the strings two models happened to type.
    """
    if raw is None:
        return None
    cleaned = _STRIP.sub("", raw)
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


@dataclass(frozen=True)
class FieldReconciliation:
    """One field, after both readers have spoken.

    `fact` is what the engines will be given. `readings` keeps what each reader
    actually said, including a value that would not normalise, so that a screen
    can show the disagreement rather than only its verdict."""

    name: str
    fact: Fact
    readings: dict[str, str | None]
    unreadable: tuple[str, ...] = ()  # reader keys that answered something unparseable


def reconcile(readings: tuple[ReaderReading, ...]) -> dict[str, FieldReconciliation]:
    """Pure. Takes what the readers returned and produces a Fact per reader field.

    AGREED requires two readings that normalise to the same Decimal. Anything
    else - one reader silent, one reader failed, one value unparseable, or two
    values that differ - is not agreement, and goes to the worker.
    """
    if len(readings) < 2:
        raise ValueError("reconciliation needs two independent readings")

    labels = {r.key: r.label for r in readings}
    failed = [r for r in readings if not r.ok]
    out: dict[str, FieldReconciliation] = {}

    for name in reader_field_order():
        raw: dict[str, str | None] = {}
        parsed: dict[str, Decimal] = {}
        unreadable: list[str] = []

        for r in readings:
            if not r.ok:
                raw[r.key] = None
                continue
            value = r.values.get(name)
            raw[r.key] = value
            norm = normalise(value)
            if norm is not None:
                parsed[r.key] = norm
            elif value is not None and value.strip():
                # The reader said something; it just was not a number. Recording
                # this keeps "answered unreadably" distinct from "answered null".
                unreadable.append(r.key)

        said = ", ".join(f"{labels[k]} {v}" for k, v in parsed.items())
        if len(parsed) >= 2:
            values = list(parsed.values())
            if all(v == values[0] for v in values):
                fact = Fact(values[0], Status.AGREED, f"both readers agree: {said}")
            else:
                fact = Fact(dict(parsed), Status.DISAGREED, f"readers disagree: {said}")
        else:
            fact = Fact(
                None,
                Status.MISSING,
                _missing_reason(parsed, unreadable, failed, labels),
            )

        out[name] = FieldReconciliation(
            name=name, fact=fact, readings=raw, unreadable=tuple(unreadable)
        )

    return out


def _missing_reason(
    parsed: dict[str, Decimal],
    unreadable: list[str],
    failed: list[ReaderReading],
    labels: dict[str, str],
) -> str:
    """Say which of the several ways this field failed to be established actually
    happened. "MISSING" on its own would let a screen invent the reason."""
    parts: list[str] = []
    if failed:
        parts.append("; ".join(f"{r.label} could not be reached ({r.error})" for r in failed))
    if unreadable:
        parts.append(
            "; ".join(f"{labels[k]} answered something that is not a number" for k in unreadable)
        )
    if len(parsed) == 1:
        (only,) = parsed
        parts.append(
            f"only {labels[only]} read a value ({parsed[only]}); one reader is not agreement"
        )
    elif not parsed and not failed and not unreadable:
        parts.append("neither reader found this on the documents")
    return "; ".join(parts) if parts else "not established"
