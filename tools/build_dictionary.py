#!/usr/bin/env python3
"""Reproducible builder for the cursor-zh Simplified Chinese dictionary.

Reads three read-only seed sources and writes our own schema:

  dictionaries/zh-CN.json      merged entries + patterns (the shipped dictionary)
  dictionaries/conflicts.json  every conflicting translation and what was rejected
  dictionaries/manifest.json   counts, provenance, license notes

Sources
  1. vibepm666/cursor-localization-zh Core_Dictionary.json + Pattern_Dictionary.json
     (community seed, no LICENSE upstream -> used as translation memory with attribution)
  2. our own additions, which live in the same Core_Dictionary.json under the section
     ids "cursor_3_27_补充" / "cursor_3_27_设置与自动化补充", plus 5 patterns that are
     not part of the upstream base
  3. MIT dictionaries: Uncle-Gao/Live-Translator-Hub (nested JSON) and
     lsh2253823857/cursor-i18n-tool (dict.js, parsed as text - never executed)

Resolution priority on conflicting translations: own > MIT > upstream seed.
The build is deterministic: no wall-clock timestamps, entries sorted by key, every
list ordered explicitly. Running it twice with the same inputs yields identical bytes.

Environment overrides
  CURSOR_ZH_UPSTREAM_DIR       directory holding Core_Dictionary.json / Pattern_Dictionary.json
                               (default ~/.cursor-zh-sources/cursor-localization-zh/localization)
  CURSOR_ZH_DICTIONARY_DIR     output directory (default <repo>/dictionaries)
  CURSOR_ZH_GENERATED_AT       value for generatedAt (default 2026-11-03)
  CURSOR_ZH_CURSOR_VERSIONS    comma separated Cursor versions (default 3.27.x)
  CURSOR_ZH_LIVE_DICT_PATH     local copy of Live-Translator-Hub dictionary.zh-CN.json
  CURSOR_ZH_I18N_TOOL_DICT_PATH local copy of cursor-i18n-tool dict.js
  CURSOR_ZH_SOURCE_CACHE       download cache directory (default <system temp>/cursor-zh-sources)
  CURSOR_ZH_OFFLINE            set to 1 to refuse network access (cache/local paths only)
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

SCHEMA_VERSION = 1
LOCALE = "zh-CN"

REPO_ROOT = Path(__file__).resolve().parent.parent
UPSTREAM_DIR = Path(
    os.environ.get(
        "CURSOR_ZH_UPSTREAM_DIR",
        str(Path.home() / ".cursor-zh-sources" / "cursor-localization-zh" / "localization"),
    )
)
OUT_DIR = Path(os.environ.get("CURSOR_ZH_DICTIONARY_DIR", REPO_ROOT / "dictionaries"))
OVERRIDES_FILE = Path(
    os.environ.get("CURSOR_ZH_OVERRIDES_PATH", REPO_ROOT / "dictionaries" / "overrides.json")
)
GENERATED_AT = os.environ.get("CURSOR_ZH_GENERATED_AT", "2026-11-03")
CURSOR_VERSIONS = [
    v.strip()
    for v in os.environ.get("CURSOR_ZH_CURSOR_VERSIONS", "3.27.x").split(",")
    if v.strip()
]
CACHE_DIR = Path(
    os.environ.get("CURSOR_ZH_SOURCE_CACHE", Path(tempfile.gettempdir()) / "cursor-zh-sources")
)
OFFLINE = os.environ.get("CURSOR_ZH_OFFLINE", "").strip() not in ("", "0", "false")

# Section ids inside Core_Dictionary.json that hold *our* additions, not the upstream base.
OWN_SECTION_IDS = ("cursor_3_27_补充", "cursor_3_27_设置与自动化补充")

# The 5 patterns that are ours and not part of the upstream base:
# 2 AI-stat readouts and the 3 "N minutes/hours/days left" countdowns.
OWN_PATTERN_REGEXES = (
    r"^Agent AI Stats: (\d+) accepted out of (\d+) suggested, (\d+) percent acceptance rate$",
    r"^Tab AI Stats: (\d+) accepted out of (\d+) suggested, (\d+) percent acceptance rate$",
    r"^(\d+) minutes? left$",
    r"^(\d+) hours? left$",
    r"^(\d+) days? left$",
)

PRIORITY = {"override": 4, "own": 3, "mit": 2, "seed": 1}

UPSTREAM_REPO = "https://github.com/vibepm666/cursor-localization-zh"
OWN_REPO = "https://github.com/Javey-Li/cursor-zh"

# MIT sources are pinned to a commit so a rebuild fetches the exact same bytes.
MIT_SOURCES = (
    {
        "name": "Uncle-Gao/Live-Translator-Hub cursor dictionary",
        "role": "mit",
        "license": "MIT",
        "repo": "https://github.com/Uncle-Gao/Live-Translator-Hub",
        "commit": "c667b8bd922fe08c3a1bf4a767ba1c8c53fe9013",
        "path": "packages/patcher-cursor/i18n/dictionary.zh-CN.json",
        "filename": "live-translator-dictionary.zh-CN.json",
        "env": "CURSOR_ZH_LIVE_DICT_PATH",
        "parser": "json",
    },
    {
        "name": "lsh2253823857/cursor-i18n-tool dict.js",
        "role": "mit",
        "license": "MIT",
        "repo": "https://github.com/lsh2253823857/cursor-i18n-tool",
        "commit": "a5dbf9ea7c1d915221cdf4de6af86bd69b7cc7ab",
        "path": "dict.js",
        "filename": "cursor-i18n-tool-dict.js",
        "env": "CURSOR_ZH_I18N_TOOL_DICT_PATH",
        "parser": "js",
    },
)

CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
LATIN_RE = re.compile(r"[A-Za-z]")
# Regex tokens never occur in a natural UI label, so such "translations" are pattern noise.
REGEX_NOISE_RE = re.compile(r"\\[dswSDWbB]|\(\?[:=!]|\\\(|\.\*|\.\+|\\\[")
URL_NOISE_RE = re.compile(
    r"^(?:https?://|www\.|[a-z][a-z0-9+.-]*://|file://|\.{0,2}/)", re.IGNORECASE
)
FILENAME_NOISE_RE = re.compile(
    r"^[\w./\\-]+\.(?:json|jsonc|js|mjs|cjs|ts|tsx|md|txt|py|sh|bat|ps1|vsix|log|yml|yaml)$",
    re.IGNORECASE,
)
CODE_NOISE_RE = re.compile(r"(?:=>|</?[a-z][a-z0-9]*>|\bfunction\s*\(|;\s*\}|\{\s*\})", re.IGNORECASE)


# --------------------------------------------------------------------------------------
# generic helpers
# --------------------------------------------------------------------------------------


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_dump(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")


def is_usable_pair(key: object, value: object) -> bool:
    """Keep only real English -> Chinese string pairs."""
    if not isinstance(key, str) or not isinstance(value, str):
        return False
    key = key.strip()
    value = value.strip()
    if not key or not value:
        return False
    if key == value:  # untranslated
        return False
    if not LATIN_RE.search(key):  # nothing English to translate
        return False
    if not CJK_RE.search(value):  # no Chinese in the "translation"
        return False
    if len(key) > 600:  # runaway blob, not a UI string
        return False
    if URL_NOISE_RE.match(key) or FILENAME_NOISE_RE.match(key):
        return False
    if REGEX_NOISE_RE.search(key) or CODE_NOISE_RE.search(key):
        return False
    return True


# --------------------------------------------------------------------------------------
# safe parsers (no eval / no JS execution)
# --------------------------------------------------------------------------------------

_JS_SIMPLE_ESCAPES = {
    "n": "\n",
    "t": "\t",
    "r": "\r",
    "b": "\b",
    "f": "\f",
    "v": "\v",
    "0": "\0",
    "\n": "",  # line continuation
}


def _tokenize_js(text: str) -> list[tuple[str, str]]:
    """Tokenize enough JS to read object literals: comments, strings, idents, punctuation."""
    tokens: list[tuple[str, str]] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c in " \t\r\n\ufeff":
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            i = n if j < 0 else j + 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            if j < 0:
                raise ValueError("unterminated block comment")
            i = j + 2
            continue
        if c in "\"'`":
            quote = c
            i += 1
            buf: list[str] = []
            while i < n:
                ch = text[i]
                if ch == "\\":
                    if i + 1 >= n:
                        raise ValueError("dangling escape in string")
                    nxt = text[i + 1]
                    buf.append(_JS_SIMPLE_ESCAPES.get(nxt, nxt))
                    i += 2
                    continue
                if ch == quote:
                    i += 1
                    break
                buf.append(ch)
                i += 1
            else:
                raise ValueError("unterminated string literal")
            tokens.append(("str", "".join(buf)))
            continue
        if c.isalpha() or c in "_$":
            j = i
            while j < n and (text[j].isalnum() or text[j] in "_$"):
                j += 1
            tokens.append(("ident", text[i:j]))
            i = j
            continue
        tokens.append(("punct", c))
        i += 1
    return tokens


class _JsObjectReader:
    """Recursive-descent reader for JS object literals built from :func:`_tokenize_js`."""

    def __init__(self, tokens: list[tuple[str, str]]) -> None:
        self.tokens = tokens
        self.pos = 0

    def _peek(self) -> tuple[str, str] | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def _at_punct(self, ch: str) -> bool:
        tok = self._peek()
        return tok is not None and tok == ("punct", ch)

    def _skip_balanced(self, opening: str, closing: str) -> None:
        depth = 0
        while self.pos < len(self.tokens):
            kind, value = self.tokens[self.pos]
            self.pos += 1
            if kind == "punct" and value == opening:
                depth += 1
            elif kind == "punct" and value == closing:
                depth -= 1
                if depth <= 0:
                    return
        raise ValueError(f"unbalanced {opening}{closing}")

    def read_object(self, pairs: list[tuple[str, str]]) -> None:
        if not self._at_punct("{"):
            raise ValueError("expected object literal")
        self.pos += 1
        while True:
            tok = self._peek()
            if tok is None:
                raise ValueError("unterminated object literal")
            if tok == ("punct", "}"):
                self.pos += 1
                return
            if tok[0] not in ("str", "ident"):
                raise ValueError(f"unexpected token {tok!r} in object key position")
            key = tok[1]
            self.pos += 1
            if not self._at_punct(":"):
                raise ValueError(f"expected ':' after key {key!r}")
            self.pos += 1
            value_tok = self._peek()
            if value_tok is None:
                raise ValueError("unterminated object literal")
            if value_tok[0] == "str":
                pairs.append((key, value_tok[1]))
                self.pos += 1
            elif value_tok == ("punct", "{"):
                self.read_object(pairs)  # nested sections: flatten the leaf pairs
            elif value_tok == ("punct", "["):
                self._skip_balanced("[", "]")
            elif value_tok == ("punct", "("):
                self._skip_balanced("(", ")")
            else:
                self.pos += 1  # numbers, booleans, identifiers: not translatable pairs
            tok = self._peek()
            if tok == ("punct", ","):
                self.pos += 1
            elif tok == ("punct", "}"):
                continue
            elif tok is None:
                raise ValueError("unterminated object literal")
            else:
                raise ValueError(f"unexpected token {tok!r} after object entry")


def parse_json_pairs(text: str) -> list[tuple[str, str]]:
    """Nested JSON of sections -> every leaf string pair."""
    data = json.loads(text)
    pairs: list[tuple[str, str]] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if isinstance(value, str):
                    pairs.append((str(key), value))
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                if isinstance(item, (list, tuple)) and len(item) == 2:
                    pairs.append((str(item[0]), str(item[1])))
                else:
                    walk(item)

    walk(data)
    return pairs


def parse_js_pairs(text: str) -> list[tuple[str, str]]:
    """Read `const|let|var NAME = { ... }` object literals as text, never executing them."""
    tokens = _tokenize_js(text)
    pairs: list[tuple[str, str]] = []
    found = 0
    for index in range(len(tokens) - 3):
        if tokens[index][0] != "ident" or tokens[index][1] not in ("const", "let", "var"):
            continue
        if tokens[index + 1][0] != "ident" or tokens[index + 2] != ("punct", "="):
            continue
        if tokens[index + 3] != ("punct", "{"):
            continue
        reader = _JsObjectReader(tokens)
        reader.pos = index + 3
        reader.read_object(pairs)
        found += 1
    if not found:
        raise ValueError("no `const NAME = { ... }` object literal found")
    return pairs


# --------------------------------------------------------------------------------------
# source records
# --------------------------------------------------------------------------------------


@dataclass
class Provider:
    name: str
    url: str
    license: str
    role: str
    sha256: str | None = None
    raw_pairs: int = 0
    usable_pairs: int = 0
    filtered_pairs: int = 0
    duplicate_keys: int = 0
    entries: dict[str, str] = field(default_factory=dict)  # first occurrence wins
    intra_conflicts: list[tuple[str, str, str]] = field(default_factory=list)
    pattern_count: int = 0

    @property
    def priority(self) -> int:
        return PRIORITY[self.role]

    def add_pairs(self, pairs: Iterable[tuple[object, object]]) -> None:
        for key, value in pairs:
            self.raw_pairs += 1
            if not is_usable_pair(key, value):
                self.filtered_pairs += 1
                continue
            key = key.strip()
            value = value.strip()
            self.usable_pairs += 1
            if key in self.entries:
                self.duplicate_keys += 1
                if self.entries[key] != value:
                    self.intra_conflicts.append((key, self.entries[key], value))
                continue
            self.entries[key] = value


def load_upstream_core(path: Path) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    data = json.loads(read_text(path))
    base: list[tuple[str, str]] = []
    own: list[tuple[str, str]] = []
    sections = data.get("sections")
    if not isinstance(sections, list):
        raise ValueError(f"{path}: missing 'sections' array")
    for section in sections:
        target = own if section.get("id") in OWN_SECTION_IDS else base
        for item in section.get("entries") or []:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                target.append((item[0], item[1]))
    return base, own


def load_upstream_patterns(path: Path) -> tuple[list[dict], list[dict]]:
    data = json.loads(read_text(path))
    raw = data.get("patterns")
    if not isinstance(raw, list):
        raise ValueError(f"{path}: missing 'patterns' array")
    base: list[dict] = []
    own: list[dict] = []
    for item in raw:
        pattern = {
            "regex": item.get("regex", ""),
            "flags": item.get("flags", ""),
            "replacement": item.get("replacement", ""),
        }
        (own if pattern["regex"] in OWN_PATTERN_REGEXES else base).append(pattern)
    missing = [r for r in OWN_PATTERN_REGEXES if all(p["regex"] != r for p in own)]
    if missing:
        raise ValueError(f"{path}: own patterns missing: {missing}")
    return base, own


def fetch_mit_source(spec: dict) -> Path:
    override = os.environ.get(spec["env"])
    if override:
        path = Path(override).expanduser()
        if not path.is_file():
            raise SystemExit(f"{spec['name']}: {spec['env']}={path} does not exist")
        return path
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / spec["filename"]
    if cached.is_file():
        return cached
    if OFFLINE:
        raise SystemExit(
            f"{spec['name']}: not cached and CURSOR_ZH_OFFLINE is set; "
            f"provide {spec['env']} or a cached copy at {cached}"
        )
    url = f"https://raw.githubusercontent.com/{spec['repo'].split('github.com/')[1]}/{spec['commit']}/{spec['path']}"
    request = urllib.request.Request(url, headers={"User-Agent": "cursor-zh-dictionary-builder"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SystemExit(
            f"{spec['name']}: download failed ({exc}); set {spec['env']} to a local copy"
        ) from exc
    cached.write_bytes(payload)
    return cached


# --------------------------------------------------------------------------------------
# merge
# --------------------------------------------------------------------------------------


def merge_patterns(
    own_patterns: list[dict], seed_patterns: list[dict]
) -> tuple[list[dict], list[dict]]:
    """Union by regex, keeping the source order; our version wins on a duplicate."""
    merged: list[dict] = []
    index: dict[str, int] = {}
    replaced: list[dict] = []

    def register(pattern: dict, ours: bool) -> None:
        regex = pattern["regex"]
        if regex in index:
            if ours:
                position = index[regex]
                previous = merged[position]
                if (
                    previous["replacement"] != pattern["replacement"]
                    or previous["flags"] != pattern["flags"]
                ):
                    replaced.append(
                        {
                            "regex": regex,
                            "chosen": {
                                "source": "own",
                                "replacement": pattern["replacement"],
                                "flags": pattern["flags"],
                            },
                            "rejected": [
                                {
                                    "source": "seed",
                                    "replacement": previous["replacement"],
                                    "flags": previous["flags"],
                                }
                            ],
                        }
                    )
                merged[position] = dict(pattern)
            return
        index[regex] = len(merged)
        merged.append(dict(pattern))

    for pattern in seed_patterns:
        register(pattern, ours=False)
    for pattern in own_patterns:
        register(pattern, ours=True)
    return merged, replaced


def build() -> int:
    core_path = UPSTREAM_DIR / "Core_Dictionary.json"
    pattern_path = UPSTREAM_DIR / "Pattern_Dictionary.json"
    for required in (core_path, pattern_path):
        if not required.is_file():
            raise SystemExit(f"missing upstream source: {required}")

    providers: list[Provider] = []

    # 1. upstream community seed (everything except the two sections that are ours)
    seed = Provider(
        name="vibepm666/cursor-localization-zh Core_Dictionary seeds",
        url=f"{UPSTREAM_REPO}/blob/main/localization/Core_Dictionary.json",
        license="NOASSERTION (upstream has no LICENSE; used as seed translation memory with attribution)",
        role="seed",
        sha256=sha256_of(core_path),
    )
    seed_base_pairs, own_pairs = load_upstream_core(core_path)
    seed.add_pairs(seed_base_pairs)

    # 2. our own Cursor 3.27 additions, stored in the same file
    own = Provider(
        name="cursor-zh Cursor 3.27 additions (own sections + 5 patterns)",
        url=OWN_REPO,
        license="MIT",
        role="own",
    )
    own.add_pairs(own_pairs)

    # 3. MIT dictionaries
    mit_providers: list[Provider] = []
    for spec in MIT_SOURCES:
        path = fetch_mit_source(spec)
        text = read_text(path)
        pairs = parse_js_pairs(text) if spec["parser"] == "js" else parse_json_pairs(text)
        provider = Provider(
            name=spec["name"],
            url=f"{spec['repo']}/blob/{spec['commit']}/{spec['path']}",
            license=spec["license"],
            role=spec["role"],
            sha256=sha256_of(path),
        )
        provider.add_pairs(pairs)
        mit_providers.append(provider)

    override = Provider(
        name="cursor-zh high-priority overrides",
        url=f"{OWN_REPO}/blob/main/dictionaries/overrides.json",
        license="MIT",
        role="override",
        sha256=sha256_of(OVERRIDES_FILE) if OVERRIDES_FILE.is_file() else None,
    )
    if OVERRIDES_FILE.is_file():
        override_data = json.loads(read_text(OVERRIDES_FILE))
        override.add_pairs((override_data.get("entries") or {}).items())

    providers = [override, seed, own, *mit_providers]

    # patterns
    seed_patterns, own_patterns = load_upstream_patterns(pattern_path)
    merged_patterns, pattern_conflicts = merge_patterns(own_patterns, seed_patterns)
    seed.pattern_count = len(seed_patterns)
    own.pattern_count = len(own_patterns)

    # resolve entries by priority: own > mit > seed, stable inside a priority band
    ranked = sorted(providers, key=lambda p: -p.priority)
    chosen: dict[str, tuple[Provider, str]] = {}
    for provider in ranked:
        for key, value in provider.entries.items():
            chosen.setdefault(key, (provider, value))

    # conflicts: any key with more than one distinct value
    offers: dict[str, list[tuple[Provider, str]]] = {}
    for provider in ranked:
        for key, value in provider.entries.items():
            offers.setdefault(key, []).append((provider, value))

    conflicts: list[dict] = []
    by_pair: dict[str, int] = {}
    role_of = {provider.name: provider.role for provider in providers}
    for key in sorted(offers):
        chosen_provider, chosen_value = chosen[key]
        rejected = [
            {"source": p.name, "value": v}
            for p, v in offers[key]
            if v != chosen_value
        ]
        # intra-source duplicates with a different value
        for conflict_key, first_value, later_value in chosen_provider.intra_conflicts:
            if conflict_key != key:
                continue
            if first_value != chosen_value:
                rejected.append({"source": chosen_provider.name, "value": first_value})
            if later_value != chosen_value:
                rejected.append({"source": chosen_provider.name, "value": later_value})
        if not rejected:
            continue
        # de-duplicate identical (source, value) rejections, keep first
        seen: set[tuple[str, str]] = set()
        unique_rejected = []
        for item in rejected:
            marker = (item["source"], item["value"])
            if marker in seen:
                continue
            seen.add(marker)
            unique_rejected.append(item)
        types = {
            "within-source"
            if item["source"] == chosen_provider.name
            else "cross-source"
            for item in unique_rejected
        }
        conflicts.append(
            {
                "key": key,
                "type": "within-source" if types == {"within-source"} else "cross-source",
                "chosen": {"source": chosen_provider.name, "value": chosen_value},
                "rejected": unique_rejected,
            }
        )
        for item in unique_rejected:
            pair = f"{chosen_provider.role}>{role_of[item['source']]}"
            by_pair[pair] = by_pair.get(pair, 0) + 1

    entries = {key: chosen[key][1] for key in sorted(chosen)}

    contributed = {p.name: 0 for p in providers}
    for provider, _value in chosen.values():
        contributed[provider.name] += 1

    dictionary = {
        "schemaVersion": SCHEMA_VERSION,
        "locale": LOCALE,
        "generatedAt": GENERATED_AT,
        "cursorVersions": CURSOR_VERSIONS,
        "entries": entries,
        "patterns": merged_patterns,
        "sources": [
            {
                "name": p.name,
                "url": p.url,
                "license": p.license,
                "entries": contributed[p.name],
                "role": p.role,
            }
            for p in providers
        ],
    }

    conflict_doc = {
        "schemaVersion": SCHEMA_VERSION,
        "locale": LOCALE,
        "generatedAt": GENERATED_AT,
        "total": len(conflicts),
        "byPair": dict(sorted(by_pair.items())),
        "conflicts": conflicts,
    }

    pattern_conflicts_total = len(pattern_conflicts)
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "locale": LOCALE,
        "generatedAt": GENERATED_AT,
        "cursorVersions": CURSOR_VERSIONS,
        "totalUniqueEntries": len(entries),
        "patternCount": len(merged_patterns),
        "conflictCount": len(conflicts),
        "patternConflictCount": pattern_conflicts_total,
        "sources": [
            {
                "name": p.name,
                "url": p.url,
                "license": p.license,
                "role": p.role,
                "sha256": p.sha256,
                "rawEntries": p.raw_pairs,
                "usableEntries": p.usable_pairs,
                "filteredEntries": p.filtered_pairs,
                "uniqueEntries": len(p.entries),
                "duplicateKeys": p.duplicate_keys,
                "contributedEntries": contributed[p.name],
                "patterns": p.pattern_count,
            }
            for p in providers
        ],
        "conflicts": {
            "total": len(conflicts),
            "byPair": dict(sorted(by_pair.items())),
            "file": "conflicts.json",
        },
        "provenance": [
            "Seed: vibepm666/cursor-localization-zh publishes no LICENSE file. Its English-to-Chinese "
            "pairs are reused as translation memory with attribution; no upstream code, installer, "
            "binary, or Microsoft language pack is copied. Individual short UI strings carry weak "
            "copyright; the compilation was not copied verbatim (own schema, own filtering, own merge).",
            "Own additions: sections 'cursor_3_27_补充' (85) and 'cursor_3_27_设置与自动化补充' (226) "
            "inside the same Core_Dictionary.json, plus 5 patterns "
            "(2 AI Stats readouts, 3 'N minutes/hours/days left' countdowns).",
            "MIT: Uncle-Gao/Live-Translator-Hub dictionary.zh-CN.json and "
            "lsh2253823857/cursor-i18n-tool dict.js, both MIT licensed, pinned to the commits listed "
            "below. The JS file is parsed as text with a small safe tokenizer, never executed.",
            "Priority on conflicting translations: own > MIT > upstream seed. When two MIT "
            "dictionaries disagree, the one listed first in this manifest wins. Every conflict is "
            "recorded in conflicts.json with the rejected values.",
            "Filtering drops untranslated pairs (Chinese == English), values without any Chinese "
            "character, URLs, file names, and regex/code noise.",
            "The build is deterministic: entries are sorted by key, lists are ordered explicitly, "
            "no wall-clock timestamp is used (generatedAt is fixed), and the MIT sources are pinned "
            "to the commits below. Rebuilding from the same inputs produces identical bytes.",
            "Rebuild with: python3 tools/build_dictionary.py (sources overridable via "
            "CURSOR_ZH_UPSTREAM_DIR and the per-source path env vars).",
        ],
        "licenseNotes": {
            "seed": "No LICENSE upstream; data used as seed with attribution (see NOTICE owned elsewhere).",
            "own": "MIT, this repository.",
            "mit": "MIT; reproduce the upstream copyright notice when redistributing.",
        },
        "mitSources": [
            {
                "name": spec["name"],
                "repo": spec["repo"],
                "commit": spec["commit"],
                "path": spec["path"],
                "license": spec["license"],
            }
            for spec in MIT_SOURCES
        ],
        "patternConflicts": pattern_conflicts,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    json_dump(OUT_DIR / "zh-CN.json", dictionary)
    json_dump(OUT_DIR / "conflicts.json", conflict_doc)
    json_dump(OUT_DIR / "manifest.json", manifest)

    print(f"wrote {OUT_DIR / 'zh-CN.json'}")
    print(f"wrote {OUT_DIR / 'conflicts.json'}")
    print(f"wrote {OUT_DIR / 'manifest.json'}")
    print(f"entries: {len(entries)}  patterns: {len(merged_patterns)}  conflicts: {len(conflicts)}")
    for provider in providers:
        print(
            f"  {provider.role:4s} {provider.name}: raw {provider.raw_pairs}, "
            f"unique {len(provider.entries)}, filtered {provider.filtered_pairs}, "
            f"contributed {contributed[provider.name]}, patterns {provider.pattern_count}"
        )
    return 0


def main(argv: list[str]) -> int:
    if any(arg in ("-h", "--help") for arg in argv[1:]):
        print(__doc__)
        return 0
    return build()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
