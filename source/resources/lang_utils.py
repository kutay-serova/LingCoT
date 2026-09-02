# =============================================================================
# Linguistic Corpus Toolkit (LingCoT) — lang_utils.py
# Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# See LICENSE in the project root for the full license text.
# =============================================================================
#
# PURPOSE
#   Shared language-code resolver. Loads source/resources/language_codes.json
#   once per process and exposes lookup functions used by corpus_annotate.py.
#
# STRUCTURE
#   _LANGUAGES / _ALIAS_MAP — module-level cache (populated on first call)
#   _load()                 — reads language_codes.json and builds the alias map;
#                             covers ISO 639-1/2/3, BCP-47, NLLB flores200,
#                             English names, and common native names
#   to_google_bcp47()       — any alias → Google BCP-47 code
#   to_nllb_code()          — any alias → NLLB flores200 code
#
# USAGE
#   from lang_utils import to_google_bcp47, to_nllb_code
#   google_code = to_google_bcp47("kor", project_root)   # → "ko"
#   nllb_code   = to_nllb_code("kor", project_root)      # → "kor_Hang"
# =============================================================================
"""
lang_utils.py — Language code resolution for LingCoT scripts.

Loads source/resources/language_codes.json once and exposes resolver functions used by
corpus_annotate.py for mapping user-supplied language codes to the formats
required by the Google Translate and NLLB backends.

Supported input forms:
  - Canonical codes:    zh-hant, ko, tr, de, ja …
  - ISO 639-3:          zho, kor, tur, deu, jpn …
  - ISO 639-1:          zh, ko, tr, de, ja …
  - BCP-47 variants:    zh-TW, zh-CN, zh-Hans, ko-KR …
  - NLLB flores200:     zho_Hant, kor_Hang, tur_Latn …
  - Full English names: "Korean", "Turkish", "Traditional Chinese" …
  - Native names:       한국어, Türkçe, 繁體中文 …
"""

import json
import sys
from pathlib import Path
from typing import Optional, Dict, Any

# ── Module-level cache (loaded once per process) ───────────────────────────────
_LANGUAGES: Optional[Dict[str, Any]] = None   # stanza_code → info dict
_ALIAS_MAP:  Optional[Dict[str, str]] = None  # any alias → stanza_code


# @fn _load
def _load(project_root: Path) -> None:
    """Load language_codes.json into the module cache."""
    global _LANGUAGES, _ALIAS_MAP
    if _LANGUAGES is not None:
        return  # already loaded

    path = project_root / "source" / "resources" / "language_codes.json"
    if not path.exists():
        # Graceful degradation: if the file is missing, return None for unknowns.
        _LANGUAGES = {}
        _ALIAS_MAP  = {}
        print(
            f"Warning: {path} not found. Language name resolution disabled.",
            file=sys.stderr,
        )
        return

    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)

    _LANGUAGES = data.get("languages", {})
    _ALIAS_MAP = {}

    for stanza_code, info in _LANGUAGES.items():
        # The canonical code maps to itself.
        _ALIAS_MAP[stanza_code]         = stanza_code
        _ALIAS_MAP[stanza_code.lower()] = stanza_code

        # Every alias in the list (case-insensitive + exact).
        for alias in info.get("aliases", []):
            _ALIAS_MAP[alias]           = stanza_code
            _ALIAS_MAP[alias.lower()]   = stanza_code

        # ISO 639-1 / iso639_3 fields as additional aliases.
        for field in ("iso639_1", "iso639_3"):
            code = info.get(field)
            if code:
                _ALIAS_MAP[code]        = stanza_code
                _ALIAS_MAP[code.lower()]= stanza_code

        # NLLB flores200 codes as aliases (users sometimes paste these).
        nllb = info.get("nllb_code")
        if nllb:
            _ALIAS_MAP[nllb]            = stanza_code
            _ALIAS_MAP[nllb.lower()]    = stanza_code


# ── Public resolver functions ──────────────────────────────────────────────────

# @fn to_google_bcp47
def to_google_bcp47(raw: str, project_root: Path) -> Optional[str]:
    """
    Resolve any language alias → Google BCP-47 code.

    Returns None if the language has no Google Translate support, or if
    the alias is unrecognised (caller should fall back to 'auto').

    Examples:
        to_google_bcp47("kor",    root) → "ko"
        to_google_bcp47("zh-TW",  root) → "zh-TW"
        to_google_bcp47("Korean", root) → "ko"
    """
    _load(project_root)
    code = _ALIAS_MAP.get(raw) or _ALIAS_MAP.get(raw.lower())
    if code is None:
        return None
    info = _LANGUAGES.get(code, {})
    val  = info.get("google_bcp47")
    return val if val and val != "null" else None


# @fn to_nllb_code
def to_nllb_code(raw: str, project_root: Path) -> Optional[str]:
    """
    Resolve any language alias → NLLB flores200 code (e.g. 'kor_Hang', 'zho_Hant').

    Returns None if the language has no NLLB support, or if the alias is unrecognised.

    Examples:
        to_nllb_code("kor",     root) → "kor_Hang"
        to_nllb_code("Turkish", root) → "tur_Latn"
    """
    _load(project_root)
    code = _ALIAS_MAP.get(raw) or _ALIAS_MAP.get(raw.lower())
    if code is None:
        return None
    return _LANGUAGES.get(code, {}).get("nllb_code")
