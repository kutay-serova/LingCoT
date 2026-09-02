#!/usr/bin/env python3
# =============================================================================
# Linguistic Corpus Toolkit (LingCoT), corpus_ingest.py
# Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# See LICENSE in the project root for the full license text.
# =============================================================================
#
# PURPOSE
#   Reads .txt and .epub source files and structures their content into the
#   hierarchical JSONL schema used throughout the LingCoT pipeline.
#   Each input file becomes one corpus document; multiple files are appended
#   to the same output. Outputs to ~/LingCoT-Data/corpora/<slug>/<slug>_corpus.jsonl.
#
# STRUCTURE
#   Config, dataclass holding output path, metadata overrides, flags
#   ID helpers, _pad(), doc_id(), sec_id(), para_id(), sent_id(), word_id()
#   RawDocument /
#   RawSection, intermediate data structures between reading and building
#   TxtReader, plain-text parser (blank-line → paragraph, punctuation → sentence)
#   EpubReader. EPUB parser using lxml; maps chapters → sections
#   Processor chain, pipeline steps applied per word/sentence (reserved slot
#                      for future auto-morpheme processor)
#   CorpusBuilder, orchestrates readers → processors → schema dicts → JSONL
#   next_doc_number, auto-detects the starting doc number from the output file
#   _slugify /
#   _default_output, derive a corpora/<slug>/ path from title or filename
#   main(), argparse entry point
#
# USAGE
#   # Auto-named output (~/LingCoT-Data/corpora/my_novel/my_novel_corpus.jsonl):
#   python scripts/corpus_ingest.py input.txt --title "My Novel" --language kor
#
#   # Multiple files into one corpus:
#   python scripts/corpus_ingest.py ch1.epub ch2.epub --title "Novel" --language zho
#
#   # Explicit output path:
#   python scripts/corpus_ingest.py input.txt -o /path/to/corpus.jsonl
#
# NOTE
#   Translation is intentionally not handled here.  Use corpus_annotate.py
#   after ingestion, it supports both NLLB offline and Google Translate with
#   full resume/cursor support and rate-limit protection.
# =============================================================================
# ── Environment bootstrap ─ B-179: byte-identical in all four scripts ─────────
# Re-exec with the venv Python if .venv/ exists and we are not already inside it,
# so nobody has to run "source .venv/bin/activate" by hand.
#
# THREE things this gets wrong if written the obvious way, and all three were
# live until v3.14.344:
#
#   1. It must not fire on IMPORT. os.execv never returns, so a module-level
#      re-exec replaces the process of ANYTHING that imports this file. Under
#      `python -c`, sys.argv is ['-c'] — the script text is not in argv — so the
#      re-exec built `python -c` with no argument and the caller got
#      "Argument expected for the -c option" in place of the module. Found by
#      workspace_test.js, which imports corpus_ingest.py to ask where the CLI
#      writes fieldwork (B-041) and got the argv error instead.
#   2. Windows keeps its interpreter at .venv\Scripts\python.exe. A bin/python
#      check is false there, so the venv is silently never adopted — the same
#      layout fork nllb_diag_test.py already checks for the NLLB launcher.
#   3. Four scripts carry this block, and they had already drifted in how they
#      computed the project root. Finding the venv by walking UP removes the one
#      line that differed, so the four are byte-identical and
#      venv_bootstrap_test.js holds them that way.
#
# sys.prefix, not the executable path: a venv Python is often a symlink back to
# the same binary as the system one, so a path comparison fails where a prefix
# comparison does not. The walk is bounded at four levels, or a stray .venv
# further up someone's home directory becomes this project's interpreter.
import sys as _sys, os as _os


def _lingcot_venv_bootstrap():
    """Replace this process with the project venv's Python, once, at startup."""
    from pathlib import Path
    sub = "Scripts" if _os.name == "nt" else "bin"
    exe = "python.exe" if _os.name == "nt" else "python"
    for up in list(Path(_os.path.abspath(__file__)).parents)[:4]:
        py = up / ".venv" / sub / exe
        if py.exists():
            if Path(_sys.prefix) != up / ".venv":
                _os.execv(str(py), [str(py)] + _sys.argv)
            return


if __name__ == "__main__":
    _lingcot_venv_bootstrap()
# ── end environment bootstrap ────────────────────────────────────────────────

"""
corpus_ingest.py  –  LingCoT ingestion script  v0.6.0

Reads .txt or .epub files and outputs corpus documents in the JSONL format
(schema v1.4: document > section > paragraph > sentence > word).

Translation is not handled here, run corpus_annotate.py after ingestion.
It supports NLLB offline (200 languages) and Google Translate with full
resume/cursor support and rate-limit protection.

Usage
-----
  # Basic ingestion, auto-detects next doc number from the output file
  python corpus_ingest.py input.txt -o corpus.jsonl

  # With metadata overrides
  python corpus_ingest.py input.epub -o corpus.jsonl \\
      --author "J. Doe" --language kor

  # Multiple files in one run (each becomes its own document)
  python corpus_ingest.py ch1.txt ch2.txt -o corpus.jsonl

Reserved for future implementation (flags accepted but not yet active)
-------------------
  --auto-morpheme    Auto-segment morphemes       (not yet implemented)

Requirements
------------
  Core (always needed):
    ebooklib, beautifulsoup4, lxml  (all in .venv/ after running build_env.py)
"""

import argparse
import json
import re
import sys
import unicodedata
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

# ── Logging ───────────────────────────────────────────────────────────────────
# log_setup.py lives in source/ (two levels up from source/scripts/).
# Using a session logger so each ingest run gets its own timestamped file.
sys.path.insert(0, str(Path(__file__).parent.parent))
from log_setup import setup_session_logger as _setup_logger

_PROJECT_ROOT_FOR_LOG = Path(__file__).parent.parent.parent
_log = _setup_logger(_PROJECT_ROOT_FOR_LOG, prefix='scripts')

# ── Constants ──────────────────────────────────────────────────────────────────

TODAY = date.today().isoformat()   # YYYY-MM-DD

# Project root: three levels up from source/scripts/corpus_ingest.py
_PROJECT_ROOT = Path(__file__).parent.parent.parent
# B-041. This was _PROJECT_ROOT / "corpora", inside the application folder,
# which is the public Git repository. The GUI moved user data out of it in
# v3.14.77; the CLI never followed, so ingesting from the command line dropped
# fieldwork straight back into the repo. workspace.py is the one definition.
_sys.path.insert(0, str(_PROJECT_ROOT / "source"))
try:
    from workspace import CORPORA_DIR as _CORPORA_DIR, ensure_workspace as _ensure_ws
    _ensure_ws()
except Exception as _exc:
    # v3.14.146: this fallback used to hard-code the workspace path, so it was a
    # SECOND definition of a constant workspace.py exists to define once. It
    # survived because the happy path never touches it; the rename would have
    # left the CLI writing to the old folder whenever the import failed, which is
    # B-041 again. Now it refuses rather than guesses: a wrong corpus location is
    # what B-041 cost, and ingestion that stops is cheaper than ingestion that
    # scatters fieldwork.
    raise SystemExit(
        f"Could not load workspace.py, so the corpus destination is unknown: {_exc}\n"
        "Run the ingester from inside the LingCoT folder, or set LINGCOT_WORKSPACE."
    )


# @fn _slugify
def _slugify(text: str) -> str:
    """
    Convert a title or filename to a safe directory name.
    Lowercases, replaces runs of non-alphanumeric characters with underscores,
    and strips leading/trailing underscores. Truncated to 64 characters.

    Examples:
        "My Novel Title"      → "my_novel_title"
        "第一章.txt"           → "txt"   (non-ASCII stripped, fallback to input stem)
        "  War & Peace  "     → "war_peace"
    """
    import re
    slug = text.lower()
    slug = re.sub(r'[^a-z0-9]+', '_', slug)
    slug = slug.strip('_')[:64]
    return slug or "corpus"


# @fn _default_output
def _default_output(args_input: list, args_title: str | None) -> str:
    """
    Derive the default output path when -o / --output is not supplied.

    Priority:
      1. --title flag  →  <workspace>/corpora/<slug(title)>/<slug>_corpus.jsonl
      2. First input filename stem  →  <workspace>/corpora/<slug(stem)>/<slug>_corpus.jsonl
      3. Fallback  →  <workspace>/corpora/corpus/corpus_corpus.jsonl
    """
    if args_title:
        slug = _slugify(args_title)
    elif args_input:
        stem = Path(args_input[0]).stem
        slug = _slugify(stem) or _slugify(Path(args_input[0]).name)
    else:
        slug = "corpus"
    slug = slug or "corpus"
    # B-041: the filename must be <slug>_corpus.jsonl, not corpus.jsonl. The app
    # pairs a corpus with its dictionary and participants by stripping the
    # "_corpus.jsonl" suffix (LingCoT.pyw open_project). A file called
    # corpus.jsonl has no prefix to pair on, so a script-ingested corpus opened
    # in the app silently found no companions.
    return str(_CORPORA_DIR / slug / f"{slug}_corpus.jsonl")


# ── Provenance ─────────────────────────────────────────────────────────────────
# B-157, v3.14.365. `make_prov` and `init_prov` moved to source/prov.py, which
# corpus_annotate.py now imports too. They were duplicated across the two scripts
# with only this copy carrying `init_prov`, so B-134 — the fix that made the CLI
# write a `prov_history` trail — reached one of the two programs that needed it.
# `source/` is already on the path; see the workspace import above.
from prov import make_prov, init_prov          # noqa: E402


# @fn _pad
def _pad(n: int) -> str:
    """Zero-pad to three digits: 1 → '001', 12 → '012'."""
    return str(n).zfill(3)

# @fn doc_id
def doc_id(n: int) -> str:            return f"doc_{_pad(n)}"
# @fn sec_id
def sec_id(doc: str, n: int) -> str:  return f"{doc}.sec_{_pad(n)}"
# @fn par_id
def par_id(sec: str, n: int) -> str:  return f"{sec}.p_{_pad(n)}"
# @fn sent_id
def sent_id(par: str, n: int) -> str: return f"{par}.s_{_pad(n)}"
# @fn word_id
def word_id(snt: str, n: int) -> str: return f"{snt}.w_{_pad(n)}"


# ── Configuration ──────────────────────────────────────────────────────────────

@dataclass
# @class Config
class Config:
    """
    All runtime settings for the ingestion pipeline.

    Holds I/O paths, metadata overrides, the annotator label, and all
    feature-toggle flags.  The auto-morpheme toggle is already present as False
    so the Config interface doesn't need to change when that processor is implemented.
    """

    # I/O
    output_file: str = "corpus.jsonl"
    doc_number:  int = 1              # current doc number (incremented per file)

    # Metadata overrides applied on top of whatever the reader extracts
    title:        Optional[str] = None
    author:       Optional[str] = None
    language:     Optional[str] = None   # ISO 639-3, e.g. "kor", "tur", "zho"
    source:       Optional[str] = None   # citation, URL, ISBN, …
    publisher:    Optional[str] = None   # stored in document metadata
    content_date: Optional[str] = None
    notes:        Optional[str] = None

    # Provenance label written into all prov stamps generated by this run
    annotator: str = "automatically-parsed"

    # ── Feature toggles ──────────────────────────────────────────────────────

    # Reserved, accepted via CLI already, wired to False until implemented.
    # When a processor is ready, flip the default and update is_enabled().
    auto_morpheme_parse: bool = False   # → AutoMorphemeProcessor (future)

    # ── Output verbosity ──────────────────────────────────────────────────────
    verbose: bool = False    # print section/paragraph/sentence progress


# ── Text normalisation ─────────────────────────────────────────────────────────

# @fn normalize_text
def normalize_text(text: str) -> str:
    """
    Prepare raw file text for corpus storage:

      1. Strip byte-order mark (U+FEFF) from the start.
      2. NFC Unicode normalisation, critical for combining characters
         (Arabic diacritics, Korean jamo, accented Latin, etc.).
      3. Unify line endings: CRLF and CR → LF.
      4. Drop C0/C1 control characters; keep newline (U+000A) and tab (U+0009).
      5. Collapse runs of 3+ consecutive blank lines down to 2
         (preserves paragraph breaks without runaway whitespace).
    """
    text = text.lstrip('\ufeff')                             # 1. BOM
    text = unicodedata.normalize('NFC', text)                # 2. NFC
    text = text.replace('\r\n', '\n').replace('\r', '\n')    # 3. line endings
    text = ''.join(                                          # 4. control chars
        ch for ch in text
        if unicodedata.category(ch) != 'Cc' or ch in ('\n', '\t')
    )
    text = re.sub(r'\n{3,}', '\n\n', text)                  # 5. blank-line runs
    return text.strip()


# ── Segmentation, ported from LingCoT.html ─────────────────────────────
# These functions are kept in sync with the viewer's JavaScript implementations
# so that auto-parsed output is identical regardless of whether the file is
# ingested here or added manually through the viewer's "Add section" flow.

# Terminal punctuation across many writing systems
# (mirrors TERM_PUNCT in LingCoT.html splitIntoSentences)
_TERM_PUNCT: frozenset[str] = frozenset({
    '.',  '!',  '?',        # Latin / ASCII
    '\u3002',               # CJK Ideographic Full Stop          。
    '\uFF01',               # Fullwidth Exclamation Mark          ！
    '\uFF1F',               # Fullwidth Question Mark             ？
    '\u061F',               # Arabic Question Mark                ؟
    '\u06D4',               # Arabic Full Stop (Urdu)             ۔
    '\u0964',               # Devanagari Danda                    ।
    '\u0965',               # Devanagari Double Danda             ॥
    '\u1362',               # Ethiopic Full Stop                  ።
    '\u0F0D',               # Tibetan Shad                        །
    '\u0589',               # Armenian Full Stop                  ։
    '\u104B',               # Myanmar Section Mark                ။
    '\u17D4',               # Khmer Khan                          ។
    '\u1803',               # Mongolian Full Stop                 ᠃
    '\u1809',               # Mongolian Manchu Full Stop          ᠉
    '\u0DF4',               # Sinhala Kunddaliya                  ෴
})

# Closing quotes / brackets absorbed after terminal punctuation
# (mirrors CLOSE_QUOT in LingCoT.html splitIntoSentences)
_CLOSE_QUOT: frozenset[str] = frozenset({
    '\u201C', '\u201D',     # "Left / Right Double Quotation Marks"
    '\u2018', '\u2019',     # 'Left / Right Single Quotation Marks'
    ')', ']',               # ASCII parenthesis / bracket
    '\u300F',               # White Right Corner Bracket          』
    '\u300D',               # Right Corner Bracket                」
    '\u3009',               # Right Angle Bracket                 〉
    '\u300B',               # Right Double Angle Bracket          》
    '\uFF09',               # Fullwidth Right Parenthesis         ）
    '\u00BB',               # Right-Pointing Double Angle Quote   »
})


# @fn split_sentences
def split_sentences(text: str) -> list[str]:
    """
    Character-by-character sentence splitter (port of splitIntoSentences).

    Rules:
      - An explicit newline immediately flushes the current buffer as a sentence.
      - After a terminal punctuation character, any immediately following
        closing quotes/brackets are absorbed into the sentence, then the buffer
        is flushed.
      - Any text remaining after the last terminal mark is emitted as a final
        (possibly unterminated) sentence.

    Returns a list of stripped, non-empty sentence strings.
    """
    if not text or not text.strip():
        return []

    results: list[str] = []
    buf: list[str] = []
    chars = list(text)
    i = 0

    while i < len(chars):
        ch = chars[i]

        # Explicit newline → sentence boundary
        if ch == '\n':
            s = ''.join(buf).strip()
            if s:
                results.append(s)
            buf = []
            i += 1
            continue

        buf.append(ch)

        if ch in _TERM_PUNCT:
            # Don't split a decimal number: skip '.' when the preceding char
            # and the immediately following char are both decimal digits in any
            # Unicode script (category Nd covers 0-9, Arabic-Indic ٠-٩,
            # Devanagari ०-९, etc.).  We use the Nd category rather than
            # str.isdigit() so that superscripts (², ³ – category No) are not
            # mistakenly treated as decimal digits.
            if ch == '.' and len(buf) >= 2 \
                    and unicodedata.category(buf[-2]) == 'Nd' \
                    and i + 1 < len(chars) \
                    and unicodedata.category(chars[i + 1]) == 'Nd':
                i += 1
                continue

            # Absorb any closing quotes / brackets that follow
            while i + 1 < len(chars) and chars[i + 1] in _CLOSE_QUOT:
                i += 1
                buf.append(chars[i])
            # Absorb following spaces / tabs (but not newlines)
            while i + 1 < len(chars) and chars[i + 1] in (' ', '\t'):
                i += 1

            s = ''.join(buf).strip()
            if s:
                results.append(s)
            buf = []

        i += 1

    # Flush any remaining text (unterminated sentence)
    remaining = ''.join(buf).strip()
    if remaining:
        results.append(remaining)

    return results


# @fn text_uses_spaces
def text_uses_spaces(text: str) -> bool:
    """
    Return True if the text uses spaces as word separators.

    Port of LingCoT.html textUsesSpaces(): looks for at least one
    occurrence of a non-whitespace character, whitespace, non-whitespace.
    Returns False for CJK, Thai, Khmer, and other scriptio continua.
    """
    return bool(re.search(r'\S\s+\S', text))


# @fn split_paragraphs
def split_paragraphs(section_text: str) -> list[str]:
    """
    Split a section's text into paragraph strings on blank lines.

    Single newlines within a paragraph (hard-wrapped lines) are joined with
    a space so they become one continuous sentence block for the sentence
    splitter.
    """
    raw_groups = re.split(r'\n[ \t]*\n+', section_text)
    paragraphs: list[str] = []
    for group in raw_groups:
        # Join hard-wrapped lines within each paragraph group
        joined = ' '.join(line.strip() for line in group.splitlines() if line.strip())
        if joined:
            paragraphs.append(joined)
    return paragraphs


# ── Intermediate data types ────────────────────────────────────────────────────
# These live between the reader output and the final schema-shaped dicts.

@dataclass
# @class RawSection
class RawSection:
    """A chapter or section as extracted by a reader, before schema building."""
    title: Optional[str]
    text:  str

@dataclass
# @class RawDocument
class RawDocument:
    """A document as extracted by a reader, before schema building."""
    title:        Optional[str]
    author:       Optional[str]
    publisher:    Optional[str]
    language:     Optional[str]
    source:       Optional[str]
    content_date: Optional[str]
    sections:     list[RawSection] = field(default_factory=list)


# ── File readers ───────────────────────────────────────────────────────────────

# @class BaseReader
class BaseReader(ABC):
    """Abstract base class for file-format readers."""

    @abstractmethod
    def can_read(self, path: Path) -> bool:
        """Return True if this reader handles the given file extension."""

    @abstractmethod
    def read(self, path: Path) -> RawDocument:
        """Parse the file and return a RawDocument."""


# @class TxtReader
class TxtReader(BaseReader):
    """
    Reader for plain-text (.txt) files.

    Encoding detection tries, in order:
      utf-8-sig  (handles BOM-prefixed UTF-8)
      utf-8
      utf-16     (handles BOM-prefixed UTF-16)
      latin-1    (guaranteed fallback, maps every byte to a code point)

    Section detection heuristics (applied in priority order):
      1. Explicit keyword patterns: "Chapter N", "제N장", "第N章",
         "Bölüm N", "Section N", Roman-numeral headings, etc.
      2. Short ALL-CAPS Latin-script lines (3–60 chars, no trailing period).
      3. Fallback: if no headings are detected, the whole file is one section.
    """

    # English ordinal number words, used in e.g. "Chapter One", "Part Three"
    _EN_ORDINALS = (
        r'(?:one|two|three|four|five|six|seven|eight|nine|ten|'
        r'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|'
        r'eighteen|nineteen|twenty(?:\s*(?:one|two|three|four|five|'
        r'six|seven|eight|nine))?|thirty|forty|fifty|'
        r'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)'
    )

    # Matches common chapter/section heading patterns across several languages
    _HEADING_RE = re.compile(
        r'^(?:'
        r'chapter\s+(?:[\divxlcIVXLC]+|' + _EN_ORDINALS + r')|'  # Chapter 1 / Chapter Four
        r'section\s+(?:[\divxlcIVXLC\d]+|' + _EN_ORDINALS + r')|'  # Section 2
        r'part\s+(?:[\divxlcIVXLC\d]+|' + _EN_ORDINALS + r')|'    # Part Three
        r'prologue|epilogue|introduction|conclusion|preface|'       # common unnumbered sections
        r'appendix(?:\s+\w+)?|'                                     # Appendix / Appendix A
        r'제\s*\d+\s*[장절편]|'                   # Korean: 제1장, 제2절
        r'第\s*[一二三四五六七八九十百\d]+\s*[章節]|'  # Chinese: 第一章
        r'bölüm\s+\d+|'                            # Turkish: Bölüm 1
        r'kısım\s+\d+|'                            # Turkish: Kısım 2
        r'[\divxlcIVXLC]+\.\s'                     # Numbered: "1. ", "IV. "
        r').*$',
        re.IGNORECASE | re.UNICODE,
    )

    def can_read(self, path: Path) -> bool:
        return path.suffix.lower() == '.txt'

    def read(self, path: Path) -> RawDocument:
        text = self._read_with_fallback(path)
        text = normalize_text(text)
        sections = self._detect_sections(text)
        return RawDocument(
            title=path.stem,              # filename without extension as fallback
            author=None,
            publisher=None,
            language=None,
            source=str(path.resolve()),
            content_date=None,
            sections=sections,
        )

    def _read_with_fallback(self, path: Path) -> str:
        """Attempt multiple encodings; raise only if all fail."""
        for enc in ('utf-8-sig', 'utf-8', 'utf-16', 'latin-1'):
            try:
                return path.read_text(encoding=enc)
            except (UnicodeDecodeError, ValueError):
                continue
        raise RuntimeError(
            f"Could not decode '{path}' with utf-8-sig, utf-8, utf-16, or latin-1."
        )

    def _detect_sections(self, text: str) -> list[RawSection]:
        """
        Walk the file line by line.  Each heading flushes the accumulated
        body text as a completed RawSection, then starts a new one.
        """
        lines = text.splitlines()
        sections: list[RawSection] = []
        current_title: Optional[str] = None
        current_lines: list[str] = []

        for line in lines:
            stripped = line.strip()
            if self._is_heading(stripped):
                # Flush the previous accumulation
                body = '\n'.join(current_lines).strip()
                if body:
                    sections.append(RawSection(title=current_title, text=body))
                current_title = stripped
                current_lines = []
            else:
                current_lines.append(line)

        # Flush the final section
        body = '\n'.join(current_lines).strip()
        if body:
            sections.append(RawSection(title=current_title, text=body))

        # No headings found → the entire text is one unnamed section
        if not sections:
            sections = [RawSection(title=None, text=text)]

        return sections

    def _is_heading(self, line: str) -> bool:
        """Heuristic: is this line a section heading?"""
        if not line or len(line) > 80:
            return False
        # Matches keyword-based heading patterns
        if self._HEADING_RE.match(line):
            return True
        # Short ALL-CAPS line (Latin script)
        if line.isupper() and 3 <= len(line) <= 60 and not line.endswith('.'):
            return True
        return False


# @class EpubReader
class EpubReader(BaseReader):
    """
    Reader for EPUB files (.epub).

    Uses ebooklib to iterate the spine; BeautifulSoup extracts clean plain
    text from each HTML chapter document.  EPUB chapters map 1-to-1 onto
    corpus Sections.  OPF Dublin Core metadata (title, creator, publisher,
    language, date) is extracted automatically and can be overridden via CLI.

    Install:  pip install ebooklib beautifulsoup4
    """

    def can_read(self, path: Path) -> bool:
        return path.suffix.lower() == '.epub'

    def read(self, path: Path) -> RawDocument:
        try:
            import ebooklib
            from ebooklib import epub
            from bs4 import BeautifulSoup
        except ImportError:
            raise ImportError(
                "EPUB support requires ebooklib and beautifulsoup4.\n"
                "Install with:  pip install ebooklib beautifulsoup4"
            )

        book = epub.read_epub(str(path))

        # ── OPF metadata ─────────────────────────────────────────────────────
        title     = self._meta(book, 'title')    or path.stem
        author    = self._meta(book, 'creator')
        publisher = self._meta(book, 'publisher')
        language  = self._meta(book, 'language')
        pub_date  = self._meta(book, 'date')

        # ── Extract sections from spine documents ─────────────────────────────
        sections: list[RawSection] = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), 'html.parser')

            # Section title: first heading element in the chapter HTML
            heading_tag = soup.find(['h1', 'h2', 'h3', 'h4'])
            sec_title = heading_tag.get_text(strip=True) if heading_tag else None

            # Strip non-content elements before text extraction
            for tag in soup(['script', 'style', 'head', 'nav']):
                tag.decompose()

            # Collect block-level elements as paragraph-separated text
            blocks: list[str] = []
            for elem in soup.find_all(['p', 'div', 'blockquote', 'li', 'td']):
                part = elem.get_text(separator=' ', strip=True)
                if part:
                    blocks.append(part)

            body = normalize_text('\n\n'.join(blocks))
            if body:
                sections.append(RawSection(title=sec_title, text=body))

        if not sections:
            raise ValueError(f"No readable content found in '{path}'.")

        return RawDocument(
            title=title,
            author=author,
            publisher=publisher,
            language=language,
            source=str(path.resolve()),
            content_date=pub_date,
            sections=sections,
        )

    def _meta(self, book, key: str) -> Optional[str]:
        """Safely pull a Dublin Core metadata value; return None if missing."""
        try:
            values = book.get_metadata('DC', key)
            if values:
                return str(values[0][0]).strip() or None
        except Exception:
            pass
        return None


# Reader registry, add new readers here; order determines priority
_READERS: list[BaseReader] = [TxtReader(), EpubReader()]


# @fn get_reader
def get_reader(path: Path) -> BaseReader:
    """Return the first reader that claims the file, or raise ValueError."""
    for reader in _READERS:
        if reader.can_read(path):
            return reader
    supported = ', '.join(
        f'.{type(r).__name__.lower().replace("reader", "")}'
        for r in _READERS
    )
    raise ValueError(
        f"Unsupported file format: '{path.suffix}'.  Supported: {supported}"
    )


# ── Processing pipeline ────────────────────────────────────────────────────────
#
# Each processor is a self-contained transformation step applied after the
# corpus document tree has been built from the raw text.
#
# To add a new processor:
#   1. Subclass BaseProcessor.
#   2. Set a unique class-level `name` string.
#   3. Implement is_enabled(), checks the relevant Config flag.
#   4. Override process_sentence() and/or process_word() as needed.
#   5. Add an instance to _ALL_PROCESSORS below in the desired order.

# @class BaseProcessor
class BaseProcessor(ABC):
    """
    Abstract base for all corpus processors.

    Override any combination of the hook methods below:
      process_document(doc, cfg), document-level transform
      process_sentences_batch(sents, cfg), paragraph-level batch transform
                                                 (default: calls process_sentence
                                                 + process_word per sentence)
      process_sentence(sent, cfg), per-sentence transform
      process_word(word, cfg), per-word transform

    For translation and other API-backed processors, override
    process_sentences_batch() to send multiple sentences in one call
    instead of one call per sentence.
    """
    name: str = "base"

    @abstractmethod
    def is_enabled(self, config: Config) -> bool:
        """Return True if this processor should run for this config."""

    def process_document(self, doc: dict, config: Config) -> dict:
        return doc

    def process_sentences_batch(self, sentences: list[dict], config: Config) -> list[dict]:
        """
        Process all sentences in a paragraph (and their words).
        Default: applies process_sentence then process_word one by one.
        Override this for batched API calls (e.g. translation).
        """
        result = []
        for sent in sentences:
            sent = self.process_sentence(sent, config)
            sent['words'] = [self.process_word(w, config) for w in sent.get('words', [])]
            result.append(sent)
        return result

    def process_sentence(self, sent: dict, config: Config) -> dict:
        return sent

    def process_word(self, word: dict, config: Config) -> dict:
        return word


# ── Reserved processors (future implementation slots) ─────────────────────────
# These classes exist so that:
#   (a) the --auto-* CLI flags are wired into the Config now (no API changes later)
#   (b) the execution order in _ALL_PROCESSORS is already decided
#   (c) any enabled-but-unimplemented processor raises clearly, not silently

# @class AutoMorphemeProcessor
class AutoMorphemeProcessor(BaseProcessor):
    """[Reserved] Auto-segment words into morphemes."""
    name = "auto_morpheme"
    def is_enabled(self, config: Config) -> bool:
        return config.auto_morpheme_parse
    def process_word(self, word: dict, config: Config) -> dict:
        raise NotImplementedError("AutoMorphemeProcessor is not yet implemented.")


# Processor registry, determines execution order.
_ALL_PROCESSORS: list[BaseProcessor] = [
    AutoMorphemeProcessor(),
]


# @fn build_pipeline
def build_pipeline(config: Config) -> list[BaseProcessor]:
    """
    Return the subset of _ALL_PROCESSORS enabled by the current config.
    Does not yet filter out unimplemented processors, they will raise
    NotImplementedError at runtime, which CorpusBuilder catches and reports.
    """
    return [p for p in _ALL_PROCESSORS if p.is_enabled(config)]


# ── Corpus builder ─────────────────────────────────────────────────────────────

# @class CorpusBuilder
class CorpusBuilder:
    """
    Orchestrates the full pipeline:
      read  →  build schema objects  →  run processors  →  write JSONL
    """

    def __init__(self, config: Config):
        self.config   = config
        self.pipeline = build_pipeline(config)
        if self.pipeline:
            print(f"Active processors: {', '.join(p.name for p in self.pipeline)}")

    # ── Verbose helper ─────────────────────────────────────────────────────────

    def _vprint(self, *args, end: str = '\n', flush: bool = False) -> None:
        """Print only when --verbose is active."""
        if self.config.verbose:
            print(*args, end=end, flush=flush)

    # ── Public ─────────────────────────────────────────────────────────────────

    def ingest_file(self, path: Path) -> dict:
        """Read a file, build a corpus document dict, and return it."""
        print(f"Reading: {path}")
        reader = get_reader(path)
        self._vprint(f"  Format: {type(reader).__name__}")
        raw    = reader.read(path)
        self._apply_overrides(raw)
        self._vprint(f"  Title:    {raw.title!r}")
        self._vprint(f"  Language: {raw.language!r}")
        self._vprint(f"  Sections: {len(raw.sections)}")
        doc = self._build_document(raw, self.config.doc_number)
        doc = self._run_processors(doc)
        return doc

    def write_jsonl(self, doc: dict, output: Path) -> None:
        """Append a corpus document as a single minified JSONL line."""
        with open(output, 'a', encoding='utf-8') as fh:
            json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
            fh.write('\n')

        # Summary stats for feedback
        n_secs  = len(doc.get('sections', []))
        n_paras = sum(len(s.get('paragraphs', [])) for s in doc.get('sections', []))
        n_sents = sum(
            len(p.get('sentences', []))
            for s in doc.get('sections', [])
            for p in s.get('paragraphs', [])
        )
        print(
            f"  → {output}  "
            f"(id: {doc['id']}, {n_secs} section(s), "
            f"{n_paras} paragraph(s), {n_sents} sentence(s))"
        )

    # ── Private: metadata overrides ────────────────────────────────────────────

    def _apply_overrides(self, raw: RawDocument) -> None:
        """Overwrite reader-extracted metadata with any CLI-provided values."""
        cfg = self.config
        if cfg.title:        raw.title        = cfg.title
        if cfg.author:       raw.author       = cfg.author
        if cfg.language:     raw.language     = cfg.language
        if cfg.source:       raw.source       = cfg.source
        if cfg.publisher:    raw.publisher    = cfg.publisher
        if cfg.content_date: raw.content_date = cfg.content_date

    # ── Private: schema builders ───────────────────────────────────────────────

    def _build_document(self, raw: RawDocument, doc_num: int) -> dict:
        did  = doc_id(doc_num)
        prov = make_prov(self.config.annotator)

        # S1 (v3.14.151): publisher used to go in document `annotations`, retired at
        # G34. It sits with the other bibliographic fields in metadata instead.
        # None of those (authors, content_sources, content_date, publisher, notes)
        # is in the app's documented metadata schema; see SCRIPTS_AUDIT §5a.
        return {
            # v3.14.151: `schema_version` and a doc-level `field_prov: None` were
            # dropped. Nothing has ever read either, and the app's schema admits
            # neither, so they failed the CLI conformance guard for no benefit.
            # D50 stage 4c: every stored row declares its kind. A document used
            # to be "the row that is not the event table", which is a negative
            # test, and a negative test claims every row nobody has met yet.
            "record_type":    "document",
            "id":             did,
            "metadata": {
                "title":           raw.title or "Untitled",
                "authors":         raw.author,
                "content_sources": raw.source,
                "content_date":    raw.content_date,
                "corpus_created":  TODAY,
                "language":        raw.language,
                "notes":           self.config.notes,
                "publisher":       raw.publisher,
                "metadata_prov":   prov,
                "field_prov":      None,
            },
            **init_prov(self.config.annotator),
            "sections": [
                self._build_section(sec, did, i)
                for i, sec in enumerate(raw.sections, 1)
            ],
        }

    def _build_section(self, raw: RawSection, did: str, n: int) -> dict:
        sid  = sec_id(did, n)
        return {
            "id":          sid,
            "title":       raw.title,
            **init_prov(self.config.annotator),
            "paragraphs": [
                self._build_paragraph(para_text, sid, i)
                for i, para_text in enumerate(split_paragraphs(raw.text), 1)
            ],
        }

    def _build_paragraph(self, text: str, sid: str, n: int) -> dict:
        pid  = par_id(sid, n)
        return {
            "id":                pid,
            # S1 (v3.14.151): the app reads translations[] / transliterations[],
            # both {label, text} arrays since G31. This wrote free_translation and
            # a scalar transliteration, so a CLI corpus opened with its
            # translations invisible: sentTrans() had no fallback for the old key.
            "translations":      [],
            "transliterations":  [],
            **init_prov(self.config.annotator),
            "sentences": [
                self._build_sentence(sent_text, pid, i)
                for i, sent_text in enumerate(split_sentences(text), 1)
            ],
        }

    @staticmethod
    def _is_word_char(c: str) -> bool:
        """
        Return True for letters (L*), digits (N*), and combining marks (M*).
        Everything else, punctuation (P*), symbols (S*), separators (Z*),
        control chars (C*), is treated as punctuation/symbol.
        """
        cat = unicodedata.category(c)
        return cat[0] in ('L', 'N', 'M')

    # Characters kept when genuinely word-internal (letter/digit on both sides).
    # All other punctuation/symbols are always separated.
    #
    #   ASCII / near-universal
    #   '-'      (U+002D) – ASCII hyphen-minus, e.g. "high-quality"
    #   '.'      (U+002E) – full stop / decimal dot, e.g. "to.upper", "3.4"
    #   '\''     (U+0027) – ASCII apostrophe, e.g. "it's", "kitabı'nda"
    #
    #   Typographic quotation / apostrophe
    #   '\u2019'          – Right Single Quotation Mark / curly apostrophe '
    #   '\u02BC'          – Modifier Letter Apostrophe (used in some transliterations)
    #
    #   Typographic hyphens (functionally identical to ASCII hyphen in most
    #   languages; produced by word-processors and some keyboard layouts)
    #   '\u2010'          – Hyphen ‐  (the "true" Unicode hyphen)
    #   '\u2011'          – Non-Breaking Hyphen ‑  (same as above, non-breaking)
    _INTERNAL_KEEP: frozenset[str] = frozenset({
        '-',       # U+002D  ASCII hyphen-minus
        '.',       # U+002E  full stop / decimal dot
        "'",       # U+0027  ASCII apostrophe
        '\u2019',  # U+2019  right single quotation mark / curly apostrophe
        '\u02BC',  # U+02BC  modifier letter apostrophe
        '\u2010',  # U+2010  hyphen ‐
        '\u2011',  # U+2011  non-breaking hyphen ‑
    })

    @staticmethod
    def _split_punct_from_token(token: str) -> list[str]:
        """
        Split a whitespace-delimited token into word and punctuation forms.

        Rule: separate ALL punctuation/symbol characters except hyphens and
        dots that are genuinely word-internal (letter/digit on BOTH sides).

        Walks the token character-by-character:
          - Word chars (letter, digit, combining mark) → accumulate.
          - '-' or '.' with word-char neighbours on both sides → accumulate.
          - Everything else → flush current accumulator, emit as its own form.

        "(Who"          → ["(", "Who"]
        "said,"         → ["said", ","]
        "under-powered" → ["under-powered"]   (internal hyphen kept)
        "to.upper"      → ["to.upper"]        (internal dot kept)
        "%25"           → ["%", "25"]         (leading symbol split off)
        "3.4"           → ["3.4"]             (internal dot kept)
        "hello."        → ["hello", "."]      (trailing dot split off)
        "it's"          → ["it's"]            (word-internal apostrophe kept)
        "kitabı'nda"    → ["kitabı'nda"]      (Turkish possessive apostrophe kept)
        ","             → [","]               (standalone punct unchanged)
        """
        is_word = CorpusBuilder._is_word_char
        keep    = CorpusBuilder._INTERNAL_KEEP
        result: list[str] = []
        current = ''

        for i, ch in enumerate(token):
            if is_word(ch):
                # Plain word character, always accumulate.
                current += ch
            elif ch in keep:
                # '-' or '.', keep only when truly word-internal:
                # both the preceding and following characters must be word chars.
                prev_ok = i > 0 and is_word(token[i - 1])
                next_ok = i < len(token) - 1 and is_word(token[i + 1])
                if prev_ok and next_ok:
                    current += ch       # internal dash/dot → stay in token
                else:
                    if current:         # flush accumulated word
                        result.append(current)
                        current = ''
                    result.append(ch)   # edge or punct-adjacent dash/dot → own form
            else:
                # All other punctuation/symbol, always separate.
                if current:
                    result.append(current)
                    current = ''
                result.append(ch)

        if current:
            result.append(current)

        return result if result else [token]  # guard: never return empty list

    def _build_sentence(self, text: str, pid: str, n: int) -> dict:
        sid  = sent_id(pid, n)

        # Word tokenisation: whitespace-split for space-using scripts only.
        # CJK, Thai, Khmer, etc. get an empty words array, consistent with
        # LingCoT.html which leaves word-level tokenisation to the annotator
        # for scripts without inter-word spaces.
        #
        # After the whitespace split, leading/trailing punctuation is peeled
        # off each token into its own word object (see _split_punct_from_token).
        # This keeps ingest tokenisation consistent with Stanza's tokeniser,
        # which also separates punctuation, and prevents index-shift bugs in
        # corpus_annotate.py's POS alignment.
        if text_uses_spaces(text):
            forms = []
            for raw_token in text.split():
                forms.extend(self._split_punct_from_token(raw_token))
            # Punctuation-only tokens are trivially glossed as "PUNCT".
            # A form is punctuation-only when it contains no word characters
            # (letters, digits, combining marks), same definition as
            # _split_punct_from_token uses via _is_word_char().
            words = [
                self._build_word(
                    form, sid, i,
                    gloss="PUNCT" if not any(self._is_word_char(c) for c in form) else None
                )
                for i, form in enumerate(forms, 1)
            ]
        else:
            words = []

        return {
            "id":               sid,
            "sentence_index":   n - 1,   # 0-based position within parent paragraph
            "text":             text,
            "translations":     [],      # S1: was free_translation, which the app never read
            "transliterations": [],
            # D25 P1 (2026-08-06): syntactic_parse retired.  Dependency parses
            # live on the word objects (word.head / word.dep_rel) and are added
            # in the app's sentence editor, never at ingest time.
            **init_prov(self.config.annotator),
            "words":            words,
        }

    def _build_word(self, form: str, sid: str, n: int,
                    gloss: str | None = None) -> dict:
        """
        Build a single word dict.  Punctuation tokens pass gloss="PUNCT"
        so they are immediately labelled without needing an annotator pass.
        """
        return {
            "id":                  word_id(sid, n),
            "word_index":          n - 1,   # 0-based position within parent sentence
            "form":                form,
            "transliterations":    [],   # S1: was a scalar `transliteration`
            "gloss":               gloss,
            "morphological_parse": None,
            **init_prov(self.config.annotator),
            "morphemes":           [],   # populated by future AutoMorphemeProcessor
        }

    # ── Private: processor runner ──────────────────────────────────────────────

    def _run_processors(self, doc: dict) -> dict:
        """
        Apply each active processor to the full document tree.

        Iterates section → paragraph and calls process_sentences_batch() per
        paragraph, so processors that support batch API calls (e.g. translation)
        send multiple sentences per request instead of one per sentence.

        Verbose mode prints a live progress line for each paragraph processed.
        """
        sections = doc.get('sections', [])
        n_secs   = len(sections)

        for proc in self.pipeline:
            self._vprint(f"\n[{proc.name}]")
            try:
                doc = proc.process_document(doc, self.config)

                # Precompute total sentence count for the progress display
                total_sents = sum(
                    len(p.get('sentences', []))
                    for s in sections for p in s.get('paragraphs', [])
                ) if self.config.verbose else 0
                done_sents = 0

                for si, sec in enumerate(sections, 1):
                    n_paras = len(sec.get('paragraphs', []))
                    self._vprint(
                        f"  Section {si}/{n_secs}: "
                        f"{sec.get('title') or '(untitled)'!r}"
                    )

                    for pi, para in enumerate(sec.get('paragraphs', []), 1):
                        sents = para.get('sentences', [])
                        n_sents = len(sents)

                        # Live progress line (overwritten with \r, finalised with \n)
                        self._vprint(
                            f"    Para {pi}/{n_paras}  "
                            f"({done_sents}/{total_sents} sents done)  ",
                            end='\r', flush=True,
                        )

                        try:
                            para['sentences'] = proc.process_sentences_batch(
                                sents, self.config
                            )
                        except NotImplementedError as exc:
                            print(f"\nWarning: '{proc.name}' skipped — {exc}",
                                  file=sys.stderr)

                        done_sents += n_sents

                # Clear the \r progress line and print final count
                self._vprint(
                    f"    Done — {done_sents} sentence(s) processed.          "
                )

            except NotImplementedError as exc:
                print(f"Warning: '{proc.name}' skipped — {exc}", file=sys.stderr)

        return doc


# ── Auto doc-number detection ──────────────────────────────────────────────────

# @fn next_doc_number
def next_doc_number(output_path: Path) -> int:
    """
    If the output JSONL file already exists, count its non-empty lines and
    return (count + 1) as the next document number.  Returns 1 for new files.
    This ensures IDs never collide when appending to an existing corpus.
    """
    if not output_path.exists():
        return 1
    n = sum(1 for line in output_path.read_text(encoding='utf-8').splitlines()
            if line.strip())
    return n + 1


# ── CLI ────────────────────────────────────────────────────────────────────────

# @fn parse_args
def parse_args():
    parser = argparse.ArgumentParser(
        prog='corpus_ingest.py',
        description=(
            'Ingest .txt or .epub files into the corpus JSONL format (schema v1.4).\n'
            'Each input file becomes one corpus document; sections/chapters within\n'
            'it become Section objects.'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        'input', nargs='+',
        help='Input file(s): .txt or .epub'
    )
    parser.add_argument(
        '-o', '--output', default=None,
        help=(
            'Output JSONL file path. If omitted, defaults to '
            'corpora/<title-slug>/corpus.jsonl (folder created automatically). '
            'Appended to if it already exists.'
        )
    )
    parser.add_argument(
        '--doc-num', type=int, default=None,
        help='Starting document number for ID generation (default: auto-detected from output)'
    )

    # ── Metadata overrides ────────────────────────────────────────────────────
    m = parser.add_argument_group('Metadata overrides (applied on top of auto-detected values)')
    m.add_argument('--title',     help='Document title')
    m.add_argument('--author',    help='Author(s), comma-separated')
    m.add_argument('--language',  help='ISO 639-3 language code, e.g. kor, tur, zho')
    m.add_argument('--source',    help='Content source: citation, URL, ISBN, etc.')
    m.add_argument('--publisher', help='Publisher name (stored in document metadata)')
    m.add_argument('--date',      dest='content_date',
                   help='Content date, e.g. "1997" or "1990-2007"')
    m.add_argument('--notes',     help='Free-form notes about this document')

    # ── Processing toggles ────────────────────────────────────────────────────
    p = parser.add_argument_group('Processing toggles')
    # ── Output options ────────────────────────────────────────────────────────
    o = parser.add_argument_group('Output options')
    o.add_argument(
        '--verbose', '-v', action='store_true',
        help='Print section / paragraph / sentence progress during processing'
    )

    # Reserved future flags, already accepted so existing scripts won't break
    # when these features are implemented.  Hidden from the help text.
    p.add_argument('--auto-morpheme', action='store_true', help=argparse.SUPPRESS)

    return parser.parse_args()


# @fn main
def main():
    args = parse_args()

    # Resolve output path: use explicit -o if given, otherwise auto-generate
    # a subfolder under corpora/ derived from the title or first input filename.
    if args.output is None:
        args.output = _default_output(args.input, args.title)
        print(f"Output: {args.output}")

    output_path = Path(args.output)

    # Create the parent directory (e.g. corpora/my_novel/) if it doesn't exist.
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Warn clearly for flags that are reserved but not yet implemented
    for flag, label in [
        (args.auto_morpheme, '--auto-morpheme'),
    ]:
        if flag:
            print(
                f"Note: {label} is reserved for a future release and will be ignored.",
                file=sys.stderr,
            )

    config = Config(
        output_file  = args.output,
        title        = args.title,
        author       = args.author,
        language     = args.language,
        source       = args.source,
        publisher    = args.publisher,
        content_date = args.content_date,
        notes        = args.notes,
        verbose      = args.verbose,
        # Reserved flag wired to False until the implementation is ready
        auto_morpheme_parse = False,
    )

    builder = CorpusBuilder(config)

    # Auto-detect the starting doc number from the output file unless overridden
    start_num = args.doc_num if args.doc_num is not None else next_doc_number(output_path)

    _log.info(f"Ingest started — output: {output_path} | inputs: {len(args.input)}")

    for offset, input_str in enumerate(args.input):
        input_path = Path(input_str)
        if not input_path.exists():
            print(f"Error: '{input_path}' not found — skipping.", file=sys.stderr)
            _log.error(f"Input file not found — skipping: {input_path}")
            continue

        config.doc_number = start_num + offset

        try:
            doc = builder.ingest_file(input_path)
            builder.write_jsonl(doc, output_path)
            _log.info(f"Ingested: {input_path.name} → {output_path.name}")
        except Exception as exc:
            print(f"Error processing '{input_path}': {exc}", file=sys.stderr)
            _log.error(f"Ingest failed for {input_path.name}: {exc}", exc_info=True)
            import traceback
            traceback.print_exc()

    _log.info("Ingest complete.")
    print("Done.")


if __name__ == '__main__':
    main()
