#!/usr/bin/env python3
# =============================================================================
# dict_export.py. LingCoT dictionary PDF export
# =============================================================================
#
# Renders the LingCoT dictionary (or a filtered subset) to a PDF file using
# fpdf2.  Called from LingCoT.pyw via the export_dict_pdf() API method.
#
# DEPENDENCIES (install with: python3 source/build_env.py --tier pdf)
#   fpdf2>=2.7        PDF generation (pure Python, supports TTF Unicode fonts)
#   python-bidi>=0.6  Unicode bidi algorithm, reorders RTL text (Arabic,
#                     Hebrew, etc.) to visual order before fpdf2 renders it.
#
# FONT STRATEGY
#   1. NotoSans-Regular.ttf / NotoSans-Bold.ttf in source/resources/fonts/
#      (bundled; covers Latin, Greek, Cyrillic, and many other scripts).
#   2. System DejaVu Sans as a fallback (broad Latin/Greek/Cyrillic coverage).
#   3. fpdf2 core "Helvetica" as last resort (ASCII/Latin-1 only, glyphs for
#      non-Latin scripts will be missing but the PDF will not crash).
#   For full Arabic/Hebrew/CJK coverage, drop the matching NotoSans* TTFs
#   (e.g. NotoSansArabic-Regular.ttf) into source/resources/fonts/; fpdf2 uses
#   the same font object for all glyphs when only one font is loaded, so a single
#   combined font like the bundled NotoSans is the simplest approach.
#
# INPUT (options dict, serialised as JSON by the caller)
#   entries       list of dict-entry objects (already filtered + sorted by JS)
#   sentences     dict mapping sentence_id → sentence object (for corpus pins)
#   fields        dict of {field_name: bool}, which fields to include
#   title         str, document title (shown on first page)
#   out_path      str, absolute destination file path
#
# FIELD KEYS  (all optional; headword is always printed)
#   transliteration, pos_type, semantic_domain, gloss, definition,
#   usage_notes, allomorphs, pinned_examples, constituent_forms
#
# RETURN  {ok: bool, path?: str, error?: str, install_hint?: str}
# =============================================================================

import os
import sys
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
_SCRIPTS_DIR  = Path(__file__).resolve().parent
_SOURCE_DIR   = _SCRIPTS_DIR.parent
_FONTS_DIR    = _SOURCE_DIR / "resources" / "fonts"

# Known system DejaVu locations (macOS / Linux)
_DEJAVU_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/DejaVuSans.ttf",
    "/Library/Fonts/DejaVuSans-Bold.ttf",
]


# ── Import guards ──────────────────────────────────────────────────────────────

def _check_deps() -> str | None:
    """Return an install hint string if required packages are missing, else None."""
    missing = []
    try:
        import fpdf  # noqa: F401
    except ImportError:
        missing.append("fpdf2")
    if missing:
        pkgs = " ".join(missing)
        return (
            f"PDF export requires: {pkgs}\n"
            "Install with:  python3 source/build_env.py --tier pdf\n"
            "or:            .venv/bin/pip install fpdf2 python-bidi"
        )
    return None


# ── RTL helpers ────────────────────────────────────────────────────────────────

_RTL_RANGES = [
    (0x0590, 0x08FF),   # Hebrew, Arabic, Syriac, Thaana, …
    (0xFB00, 0xFDFF),   # Arabic Presentation Forms A
    (0xFE70, 0xFEFF),   # Arabic Presentation Forms B
]

def _has_rtl(text: str) -> bool:
    """Heuristic: True if the string contains any strong RTL codepoints."""
    for ch in text:
        cp = ord(ch)
        if any(lo <= cp <= hi for lo, hi in _RTL_RANGES):
            return True
    return False

def _bidi(text: str) -> str:
    """Apply Unicode bidi reordering when the string contains RTL characters."""
    if not text or not _has_rtl(text):
        return text
    try:
        from bidi.algorithm import get_display
        return get_display(text)
    except ImportError:
        return text  # python-bidi absent, render as-is (LTR only)


# ── Font resolution ────────────────────────────────────────────────────────────

def _resolve_fonts() -> tuple[str | None, str | None]:
    """
    Return (regular_path, bold_path) for the best available Unicode TTF pair.
    Either path may be None if that weight is missing, the caller handles it.
    """
    noto_r = _FONTS_DIR / "NotoSans-Regular.ttf"
    noto_b = _FONTS_DIR / "NotoSans-Bold.ttf"
    if noto_r.exists() and noto_b.exists():
        return str(noto_r), str(noto_b)

    # Try system DejaVu
    dv_r = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    dv_b = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    # macOS alternatives
    if not dv_r.exists():
        dv_r = Path("/Library/Fonts/DejaVuSans.ttf")
        dv_b = Path("/Library/Fonts/DejaVuSans-Bold.ttf")
    if dv_r.exists():
        return str(dv_r), str(dv_b) if dv_b.exists() else None

    return None, None   # fall back to fpdf2 core font (Latin-1 only)


# ── PDF layout helpers ─────────────────────────────────────────────────────────

# Layout constants (millimetres)
_MARGIN        = 18
_PAGE_W        = 210   # A4
_CONTENT_W     = _PAGE_W - 2 * _MARGIN
_HEAD_SIZE     = 14    # headword font size
_BODY_SIZE     = 9
_SMALL_SIZE    = 7.5
_LABEL_SIZE    = 7
_ENTRY_GAP     = 6     # vertical gap between entries
_SECTION_GAP   = 2     # gap between fields within an entry
_RULE_THICK    = 0.2   # separator line thickness


class _DictPDF:
    """Thin wrapper around FPDF that tracks font state and exposes helper methods."""

    def __init__(self, font_r: str | None, font_b: str | None):
        from fpdf import FPDF

        self.pdf = FPDF(unit="mm", format="A4")
        self.pdf.set_margins(_MARGIN, _MARGIN, _MARGIN)
        self.pdf.set_auto_page_break(auto=True, margin=_MARGIN + 4)
        self.pdf.add_page()

        self._use_ttf = font_r is not None
        if self._use_ttf:
            self.pdf.add_font("main",  "",  font_r, uni=True)
            self.pdf.add_font("main",  "B", font_b or font_r, uni=True)
            self._fn = "main"
        else:
            self._fn = "Helvetica"  # Latin-1 core font, no add_font needed

    def _set(self, size: float, bold: bool = False, color: tuple = (0, 0, 0)):
        style = "B" if bold else ""
        self.pdf.set_font(self._fn, style, size)
        self.pdf.set_text_color(*color)

    def write_title(self, text: str):
        self._set(_HEAD_SIZE + 4, bold=True)
        self.pdf.cell(0, 10, _bidi(text), ln=True, align="C")
        self.pdf.set_draw_color(180, 180, 180)
        self.pdf.set_line_width(0.4)
        self.pdf.line(_MARGIN, self.pdf.get_y(), _PAGE_W - _MARGIN, self.pdf.get_y())
        self.pdf.ln(5)

    def label(self, text: str):
        """Print a small uppercase section label."""
        self._set(_LABEL_SIZE, bold=True, color=(120, 120, 120))
        self.pdf.cell(0, 4, text.upper(), ln=True)
        self.pdf.ln(0.5)

    def body(self, text: str, indent: float = 0):
        """Print a body paragraph with automatic line wrapping."""
        self._set(_BODY_SIZE)
        self.pdf.set_x(_MARGIN + indent)
        self.pdf.multi_cell(_CONTENT_W - indent, 5, _bidi(text))

    def small(self, text: str, color: tuple = (80, 80, 80), indent: float = 0):
        self._set(_SMALL_SIZE, color=color)
        self.pdf.set_x(_MARGIN + indent)
        self.pdf.multi_cell(_CONTENT_W - indent, 4.5, _bidi(text))

    def field_line(self, label_text: str, value: str,
                   label_color: tuple = (100, 100, 100)):
        """Print a label + value on the same line; wraps value if long."""
        # Label column (fixed 32mm)
        self._set(_LABEL_SIZE, bold=True, color=label_color)
        x0 = self.pdf.get_x()
        y0 = self.pdf.get_y()
        self.pdf.cell(32, 5, label_text.upper())
        # Value column, multi_cell from the current x position
        self._set(_BODY_SIZE)
        self.pdf.set_xy(x0 + 32, y0)
        self.pdf.multi_cell(_CONTENT_W - 32, 5, _bidi(value))

    def separator(self):
        """Thin horizontal rule between entries."""
        self.pdf.set_draw_color(210, 210, 210)
        self.pdf.set_line_width(_RULE_THICK)
        y = self.pdf.get_y()
        self.pdf.line(_MARGIN, y, _PAGE_W - _MARGIN, y)
        self.pdf.ln(_ENTRY_GAP)

    def ln(self, h: float = _SECTION_GAP):
        self.pdf.ln(h)

    def output(self, path: str):
        self.pdf.output(path)

    def check_page(self, needed_mm: float = 20):
        """Add a page if less than needed_mm of space remains."""
        remaining = self.pdf.h - self.pdf.get_y() - self.pdf.b_margin
        if remaining < needed_mm:
            self.pdf.add_page()


# ── Entry renderer ─────────────────────────────────────────────────────────────

def _render_entry(doc: _DictPDF, entry: dict, fields: dict,
                  sentences: dict) -> None:
    """Render one dictionary entry to the PDF."""

    # ── Headword line ──────────────────────────────────────────────────────────
    doc.check_page(30)
    doc._set(_HEAD_SIZE, bold=True)
    headword = entry.get("form", "")
    doc.pdf.cell(0, 8, _bidi(headword), ln=True)

    # ── Transliteration ────────────────────────────────────────────────────────
    if fields.get("transliteration", True):
        trans_list = entry.get("transliterations") or []
        if trans_list:
            parts = [t.get("text", "") for t in trans_list if t.get("text")]
        elif entry.get("transliteration"):
            parts = [entry["transliteration"]]
        else:
            parts = []
        if parts:
            doc.small("  " + "  ·  ".join(parts), color=(80, 80, 80))

    # ── POS + type + semantic domain ───────────────────────────────────────────
    if fields.get("pos_type", True):
        pos  = entry.get("part_of_speech", "")
        typ  = entry.get("type", "")
        dom  = entry.get("semantic_domain", "") if fields.get("semantic_domain", True) else ""
        meta_parts = [p for p in [pos, typ, dom] if p]
        if meta_parts:
            doc._set(_SMALL_SIZE, bold=True, color=(90, 90, 150))
            doc.pdf.cell(0, 4.5, "  " + "  ·  ".join(meta_parts), ln=True)

    doc.ln(1.5)

    # ── Gloss ──────────────────────────────────────────────────────────────────
    if fields.get("gloss", True) and entry.get("gloss"):
        doc._set(_BODY_SIZE, color=(40, 40, 40))
        doc.pdf.cell(0, 5, f'"{_bidi(entry["gloss"])}"', ln=True)
        doc.ln(1)

    # ── Definition ────────────────────────────────────────────────────────────
    if fields.get("definition", True) and entry.get("meaning"):
        doc.label("Definition")
        doc.body(entry["meaning"], indent=2)
        doc.ln(1)

    # ── Usage notes ────────────────────────────────────────────────────────────
    if fields.get("usage_notes", True) and entry.get("usage_notes"):
        doc.label("Usage")
        doc.body(entry["usage_notes"], indent=2)
        doc.ln(1)

    # ── Allomorphs table ───────────────────────────────────────────────────────
    if fields.get("allomorphs", True):
        allos = entry.get("allomorphs") or []
        if allos:
            doc.label("Allomorphs")
            for allo in allos:
                form = allo.get("form", "")
                env  = allo.get("environment", "")
                line = form + (f"  — {env}" if env else "")
                doc.small(line, indent=4)
            doc.ln(1)

    # ── Constituent forms ──────────────────────────────────────────────────────
    if fields.get("constituent_forms", True):
        cf = entry.get("constituent_forms") or []
        if cf:
            doc.field_line("Parts", "  +  ".join(cf))
            doc.ln(1)

    # ── Pinned examples ────────────────────────────────────────────────────────
    if fields.get("pinned_examples", True):
        pins = entry.get("pinned_examples") or []
        if pins:
            doc.label("Examples")
            for px in pins:
                if px.get("type") == "corpus":
                    sent = sentences.get(px.get("sentence_id", ""))
                    if sent:
                        words = sent.get("words") or []
                        target_id = px.get("token_id", "")
                        # Reconstruct sentence with target word in square brackets
                        parts = []
                        for w in words:
                            form = w.get("form", "")
                            parts.append(f"[{form}]" if w.get("id") == target_id else form)
                        sent_text = " ".join(parts)
                        doc.body(sent_text, indent=4)
                        # First translation if present
                        trans = (sent.get("translations") or [{}])[0].get("text", "")
                        if trans:
                            doc.small(trans, color=(100, 100, 100), indent=6)
                elif px.get("type") == "manual":
                    if px.get("text"):
                        doc.body(px["text"], indent=4)
                    if px.get("translation"):
                        doc.small(px["translation"], color=(100, 100, 100), indent=6)
                    if px.get("gloss"):
                        doc.small(px["gloss"], color=(130, 100, 100), indent=6)
                doc.ln(1.5)

    doc.ln(2)


# ── Public entry point ─────────────────────────────────────────────────────────

def export_dict_pdf(options: dict) -> dict:
    """
    Render a PDF dictionary from the supplied options dict.
    Returns {ok: bool, path?: str, error?: str, install_hint?: str}.
    """
    # Check deps before importing anything from fpdf
    hint = _check_deps()
    if hint:
        return {"ok": False, "install_hint": hint,
                "error": "Required packages not installed."}

    entries   = options.get("entries",   [])
    sentences = options.get("sentences", {})   # id → sentence object
    fields    = options.get("fields",    {})
    title     = options.get("title",     "Dictionary")
    out_path  = options.get("out_path",  "")

    if not out_path:
        return {"ok": False, "error": "No output path provided."}
    if not entries:
        return {"ok": False, "error": "No entries to export."}

    font_r, font_b = _resolve_fonts()
    try:
        doc = _DictPDF(font_r, font_b)
        doc.write_title(title)

        for entry in entries:
            _render_entry(doc, entry, fields, sentences)
            doc.separator()

        doc.output(out_path)
        return {"ok": True, "path": out_path}

    except Exception as exc:
        return {"ok": False, "error": str(exc)}
