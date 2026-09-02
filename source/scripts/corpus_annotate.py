#!/usr/bin/env python3
# =============================================================================
# Linguistic Corpus Toolkit (LingCoT), corpus_annotate.py
# Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# See LICENSE in the project root for the full license text.
# =============================================================================
#
# PURPOSE
#   Adds annotations to an existing corpus JSONL file produced by
#   corpus_ingest.py. Supports annotation type:
#     --translate   free sentence translations (offline NLLB-200 or Google)
#   A cursor file tracks progress so interrupted runs resume where they stopped.
#   Also exposes a local HTTP server (--serve) used by the corpus viewer's
#   online Auto-Translate button.
#
# STRUCTURE
#   Cursor, reads/writes a .cursor JSON file next to the corpus
#   GoogleTranslateBackend, online translation via deep-translator
#   NLLBBackend, offline translation via ctranslate2 + NLLB-200-distilled-600M
#                          (https://github.com/facebookresearch/fairseq/tree/nllb)
#   CorpusAnnotator, streams corpus JSONL, fills sentence translations,
#                          commits batches to disk with cursor updates
#   serve(), minimal HTTP server exposing /translate; its _Handler is nested
#   load_annotator_config(), reads annotator_config.json written by corpus_optimize.py
#   main(), argparse entry point (--translate, --serve, etc.)
#
# USAGE
#   python source/scripts/corpus_annotate.py corpora/my_corpus/corpus.jsonl --translate \
#       --translator nllb --source-lang kor
#   python source/scripts/corpus_annotate.py --serve --port 5001
#
# THIRD-PARTY TOOLS
#   NLLB-200  https://github.com/facebookresearch/fairseq/tree/nllb
#   Stanza    https://stanfordnlp.github.io/stanza/
#   Google Translate  https://translate.google.com
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
corpus_annotate.py  –  LingCoT batch annotator  v1.7.0

Adds annotations (translations, glosses, etc.) to an existing corpus JSONL
file produced by corpus_ingest.py, without re-ingesting source files.

Designed for rate-limited APIs:
  • Translates up to --max-sentences sentences per run, then exits cleanly.
  • Saves a cursor after every batch so a re-run picks up where it stopped.
  • Safe to interrupt at any point, partial results are committed atomically
    after each batch (JSONL is never left in a corrupted state).
  • Works with Google Translate (online) or NLLB-200 (offline, 200-language
    neural model, single model covers all languages automatically).

Typical workflow
----------------
  # Step 1, ingest without translation (fast, no API needed)
  python source/scripts/corpus_ingest.py book.epub -o corpus.jsonl

  # Step 1b, run the optimizer once to find the fastest settings for this machine
  python source/scripts/corpus_optimize.py                  # writes annotator_config.json

  # Step 2, annotate in safe chunks (run this repeatedly until done)
  # annotator_config.json is loaded automatically; CLI flags override it
  python source/scripts/corpus_annotate.py corpus.jsonl --translate \\
      --translator google --target-lang en --max-sentences 100

  # Step 3, after API cooldown, run again; cursor auto-resumes
  python source/scripts/corpus_annotate.py corpus.jsonl --translate \\
      --translator google --target-lang en --max-sentences 100

  # Alternative: offline NLLB-200 run (200-language model, no cooldown)
  python source/scripts/corpus_annotate.py corpus.jsonl --translate \\
      --translator nllb --source-lang tur --target-lang en

Cursor file
-----------
  A sidecar JSON file is kept next to the corpus:
    corpus.jsonl.translate_en.cursor
  It records the last sentence ID that was successfully annotated.
  Delete it to restart from the beginning.

Scheduled use
-------------
  Run corpus_annotate.py from a scheduled task with --max-sentences set to
  a safe limit (e.g. 90) and --delay-between-batches 5 to stay well under
  API rate limits.  The cursor ensures each scheduled run continues from
  where the previous one left off.

Requirements
------------
  Google backend:  pip install deep-translator
  NLLB backend:    pip install ctranslate2 sentencepiece
                   (model lives under models/nllb/, see corpus_optimize.py)
"""

import argparse
import json
import re
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any, Optional

# ── Logging ───────────────────────────────────────────────────────────────────
# log_setup.py lives in source/ (two levels up from source/scripts/).
# Per-run session logger: each annotate invocation gets its own timestamped file.
sys.path.insert(0, str(Path(__file__).parent.parent))
from log_setup import setup_session_logger as _setup_logger
_log = _setup_logger(Path(__file__).parent.parent.parent, prefix='scripts')

# Shared language-code resolver, lives in source/resources/ after restructure.
# Import after bootstrap so the venv / lib path is already set.
sys.path.insert(0, str(Path(__file__).parent.parent / "resources"))
from lang_utils import (
    to_google_bcp47,
    to_nllb_code,
)
_SCRIPT_ROOT = Path(__file__).parent.parent.parent   # project root, for lang_utils loader


# ── Constants ──────────────────────────────────────────────────────────────────

SCHEMA_VERSION = "1.4"


# ── Provenance ─────────────────────────────────────────────────────────────────
# B-157, v3.14.365. `make_prov` used to live here as an identical copy of the one
# in corpus_ingest.py, and only that copy had the `init_prov` twin — so B-134 was
# closed in one of the two programs that needed it. One definition now, in
# source/prov.py, which is already on the path (log_setup is imported the same way).
# `derived_prov` is the thing neither copy could do: say the machine made a value.
from prov import make_prov, derived_prov, stamp_element   # noqa: E402


# ── Cursor ─────────────────────────────────────────────────────────────────────

# @
# ── S2 (v3.14.151): the app's translation field ────────────────────────────────
# The app reads `translations`, a [{label, text}] array, since G31. This module
# read and wrote `free_translation`, so --stats reported 0 of 13 translated for a
# fully translated corpus and --translate would have re-translated all of it,
# writing the results where nothing displays them. One reader and one writer, so
# the two can never disagree again.

# @fn sent_translation
def sent_translation(sent: dict) -> Optional[str]:
    """The sentence's translation, or None.

    D58 §3, v3.14.386: the `free_translation` fallback is gone. This module was
    the last writer of that key and stopped at v3.14.151; the reader outlived the
    writer by 235 versions, which is the shape D58 §3 exists to close."""
    arr = sent.get('translations')
    if isinstance(arr, list) and arr:
        return (arr[0] or {}).get('text') or None
    return None


# @fn set_sent_translation
def set_sent_translation(sent: dict, text: str, prov: dict) -> None:
    """Write a translation the app will display, and stamp it as MACHINE-MADE.

    Replaces the first entry rather than appending: a re-translation is a new
    value for the same slot, not a second opinion. Any further entries a human
    added by hand are left alone.

    B-157, v3.14.365. Two things were wrong here and they compounded.

    THE STAMP WAS IN THE WRONG PLACE. It went to `field_prov['translations']`,
    and the app reads list-field provenance from the ELEMENT (`_humanField`,
    B-138) — a field-level stamp on a list is not read by anything. So an NLLB
    or Google translation arrived carrying no element stamp at all, and the
    app's rule for that case is that an unstamped element is a person's work.
    That rule is right and deliberate: unattributed data predates the stamps,
    and calling somebody else's work automatic is the worse error. The app was
    never the defect; the CLI simply had no way to say otherwise.

    AND THE SILENCE DID NOT LAST. `assignList` reconciles a list on every save
    and stamps any element that arrives without a `prov` with the moment of
    whoever saved it. So the first ordinary save of a `--translate`d sentence
    turned "nobody said who made this" into "ann_001 wrote this" — in the file,
    permanently, indistinguishable from a translation they typed. The window
    for any remedy was the minutes between the two.

    THE `label` KEY IS GONE, and it made that certain rather than likely. The
    documented schema for a translation is `{text, source_id, date}`; only a
    TRANSLITERATION carries a label. Nothing read this one — but `_listKeyOf`
    includes `label` in the identity it reconciles by, so a CLI translation and
    the same text rebuilt by the app's editor (which never writes a label) were
    two different elements to `assignList`, guaranteeing the re-stamp above.
    Writing the app's own shape is what makes the element matchable.

    `prov` must be a DERIVED stamp from `prov.derived_prov()`. It is stamped on
    the element, which is where a per-translation attribution belongs.
    """
    arr = sent.get('translations')
    if not isinstance(arr, list):
        arr = []
    arr = [stamp_element({"text": text, "source_id": None, "date": None}, prov)] + arr[1:]
    sent['translations'] = arr
    # The field-level key is removed rather than left behind: it was never read
    # for a list field, and a stamp nothing reads is a claim nobody checks.
    if isinstance(sent.get('field_prov'), dict):
        sent['field_prov'].pop('translations', None)
        if not sent['field_prov']:
            sent.pop('field_prov', None)


class Cursor:
    """
    Tracks progress through a corpus JSONL file so annotation runs can be
    resumed after interruption or API rate-limiting.

    The cursor file is a small JSON document stored next to the corpus:
      corpus.jsonl.translate_en.cursor

    Format:
      {
        "last_sentence_id": "doc_001.sec_003.p_002.s_047",
        "sentences_done": 423,
        "updated": "2026-04-03"
      }

    A sentence is considered 'done' once it has been committed to disk, the cursor is never advanced speculatively.
    """

    def __init__(self, cursor_path: Path):
        self.path = cursor_path
        self.last_sentence_id: Optional[str] = None
        self.sentences_done: int = 0
        self._load()

    def _load(self) -> None:
        """Read cursor state from disk (silently starts from scratch if missing)."""
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text(encoding='utf-8'))
                self.last_sentence_id = data.get('last_sentence_id')
                self.sentences_done   = data.get('sentences_done', 0)
                print(f"Cursor: resuming after sentence {self.last_sentence_id!r} "
                      f"({self.sentences_done} done so far)")
            except Exception as exc:
                print(f"Warning: Could not read cursor file ({exc}). Starting from scratch.",
                      file=sys.stderr)
                _log.warning(f"Could not read cursor file: {exc}")

    def save(self, last_id: str, total_done: int) -> None:
        """Commit cursor state to disk atomically."""
        self.last_sentence_id = last_id
        self.sentences_done   = total_done
        data = {
            "last_sentence_id": last_id,
            "sentences_done":   total_done,
            # B-157: was the import-time TODAY. A batch run that crosses midnight
            # wrote the previous day into every cursor save after it.
            "updated":          date.today().isoformat(),
        }
        # Write to a temp file then rename, avoids corrupting the cursor if
        # the process is killed mid-write.
        tmp = self.path.with_suffix('.tmp')
        tmp.write_text(json.dumps(data, indent=2), encoding='utf-8')
        tmp.replace(self.path)

    def is_past(self, sentence_id: str) -> bool:
        """Return True if this sentence has already been processed."""
        if not self.last_sentence_id:
            return False
        # Sentence IDs are lexicographically ordered within a document.
        # We compare them to decide whether this sentence was already visited.
        return self._id_lte(sentence_id, self.last_sentence_id)

    @staticmethod
    def _id_lte(a: str, b: str) -> bool:
        """
        Compare two hierarchical IDs like 'doc_001.sec_003.p_002.s_047'.
        Returns True if a <= b (a was visited before or at the same point as b).
        """
        def parts(s):
            # Extract numeric parts for correct numeric comparison
            return [int(x) for x in re.findall(r'\d+', s)]
        try:
            return parts(a) <= parts(b)
        except Exception:
            return a <= b

    def reset(self) -> None:
        """Delete the cursor file and reset state (start over)."""
        self.last_sentence_id = None
        self.sentences_done   = 0
        if self.path.exists():
            self.path.unlink()
            print("Cursor reset.")


# ── Translation backends ───────────────────────────────────────────────────────

# @class GoogleBackend
class GoogleBackend:
    """
    Wraps deep_translator.GoogleTranslator.

    Source language mapping: ISO 639-3 → Google BCP-47 codes.
    Falls back to 'auto' detection for unmapped codes (works for most
    European languages but can silently fail for CJK, always pass
    --language for those).
    """

    def __init__(self, source_lang: Optional[str], target_lang: str):
        try:
            from deep_translator import GoogleTranslator as _GT
        except ImportError:
            raise ImportError(
                "Google backend requires deep-translator:\n"
                "  pip install deep-translator"
            )
        # Resolve any alias (ISO 639-3, full name, BCP-47, …) → Google BCP-47.
        # Falls back to 'auto' for codes not in the lookup table.
        src = (
            to_google_bcp47(source_lang, _SCRIPT_ROOT)
            if source_lang
            else None
        ) or source_lang or 'auto'
        self._translator = _GT(source=src, target=target_lang)
        self.annotator = "auto-translated-google"
        print(f"Google backend ready  (source={src!r} → target={target_lang!r})")

    def translate_batch(self, texts: list[str]) -> list[Optional[str]]:
        """Translate a batch; returns None for any item that fails."""
        try:
            results = self._translator.translate_batch(texts)
            return results if results else [None] * len(texts)
        except Exception as exc:
            # Return a sentinel so the caller knows the whole batch failed
            raise RuntimeError(f"Google batch failed: {exc}") from exc



# @class NLLBBackend
class NLLBBackend:
    """
    Offline NLLB-200 translation backend (ctranslate2 + SentencePiece).

    Supports ~200 languages using META's NLLB-200 model with flores200
    language codes (e.g. 'tur_Latn', 'ara_Arab', 'zho_Hant').

    Expected directory layout:
      models/nllb/
        flores200_sacrebleu_tokenizer_spm.model   ← shared flores200 tokenizer
        nllb-200-distilled-600M-int8/             ← ctranslate2 weights dir
          model.bin
          config.json
          shared_vocabulary.txt

    Benchmarked-optimal CPU config (4-core machine):
      inter_threads=1, intra_threads=2, beam_size=1  →  ~8.7 sent/s
      Key findings from benchmarking:
        • beam=1 (greedy) is 28% faster than beam=2 with minimal quality loss
        • inter=1, intra=2 beats inter=2, intra=2 with beam=1 (less scheduling overhead)
        • Batch all sentences together, never call translate_batch one sentence at a time
        • max_batch_size: leave at default (ctranslate2's auto-detection is well-tuned)
        • multiprocessing hurts (model load overhead dominates on small batches)

    Input format per NLLB paper:
      [src_lang_code]  token_1  token_2 … token_N  </s>
    Output: first token is always the target language code, strip it.
    """

    def __init__(self, source_lang: Optional[str], target_lang: str,
                 compute_type: str = "int8",
                 inter_threads: int = 1,   # 1 job owns all intra_threads
                 intra_threads: int = 2,   # 2 threads per job, sweet spot on 4-core
                 beam_size: int = 1):      # greedy: 28% faster, nearly identical quality
        try:
            import ctranslate2
            import sentencepiece as spm
        except ImportError:
            raise ImportError(
                "NLLB backend requires ctranslate2 and sentencepiece:\n"
                "  pip install ctranslate2 sentencepiece"
            )

        models_root = Path(__file__).parent.parent.parent / "source" / "models" / "nllb"
        if not models_root.exists():
            raise FileNotFoundError(
                f"NLLB model directory not found: {models_root}\n"
                "Place the nllb-200-* ctranslate2 weights and the "
                "flores200_sacrebleu_tokenizer_spm.model file there."
            )

        # Auto-discover the weights directory (works with any nllb-200-* variant)
        model_dirs = sorted(
            d for d in models_root.iterdir()
            if d.is_dir() and d.name.startswith("nllb-200-")
        )
        if not model_dirs:
            raise FileNotFoundError(
                f"No NLLB weights directory found under {models_root}/. "
                "Expected a directory whose name starts with 'nllb-200-'."
            )
        model_dir = model_dirs[0]  # use the first match (alphabetically)

        sp_path = models_root / "flores200_sacrebleu_tokenizer_spm.model"
        if not sp_path.exists():
            raise FileNotFoundError(
                f"NLLB tokenizer not found: {sp_path}"
            )

        # Resolve source language (required for NLLB, no auto-detection)
        # Resolve any alias → NLLB flores200 code; pass unknown codes through as-is
        # so users can supply raw flores200 codes (e.g. 'zho_Hant') directly.
        self._src_nllb = to_nllb_code(source_lang, _SCRIPT_ROOT) or source_lang or 'eng_Latn'
        self._tgt_nllb = to_nllb_code(target_lang, _SCRIPT_ROOT) or target_lang
        self._beam_size = beam_size

        if not source_lang:
            # main() auto-detects from corpus metadata; this fallback only fires
            # if called directly without a source language.
            print("Warning: source language not set — defaulting to 'eng_Latn'.",
                  file=sys.stderr)
            _log.warning("source language not set — defaulting to 'eng_Latn'")

        print(
            f"Loading NLLB  {self._src_nllb} → {self._tgt_nllb}  "
            f"({model_dir.name}, {compute_type}, "
            f"inter={inter_threads}, intra={intra_threads}, beam={beam_size}) …",
            end=' ', flush=True
        )

        self._sp = spm.SentencePieceProcessor()
        self._sp.Load(str(sp_path))

        self._ct = ctranslate2.Translator(
            str(model_dir), device="cpu",
            compute_type=compute_type,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
        )
        print("ready.")
        self.annotator = f"auto-translated-nllb200-{compute_type}"

    def translate_batch(self, texts: list[str]) -> list[Optional[str]]:
        """
        Tokenise all texts, format for NLLB, run one batched ctranslate2 call.

        NLLB input format:  [src_lang]  tok1  tok2 … tokN  </s>
        Output: first token is always the target language code, strip it.
        All sentences are submitted in a single batch call for maximum
        throughput (inter_threads handles parallelism internally).
        """
        tokenized = []
        for text in texts:
            tokens = self._sp.Encode(text, out_type=str)
            # Prepend source language code and append end-of-sentence token
            tokenized.append([self._src_nllb] + tokens + ["</s>"])

        results = self._ct.translate_batch(
            tokenized,
            # Tell the decoder which language to generate
            target_prefix=[[self._tgt_nllb]] * len(tokenized),
            beam_size=self._beam_size,
        )

        out = []
        for r in results:
            # Skip index 0, it's always the target_prefix language token
            out_tokens = r.hypotheses[0][1:]
            out.append(self._sp.Decode(out_tokens))
        return out





# ── Corpus patcher ─────────────────────────────────────────────────────────────

# @class CorpusAnnotator
class CorpusAnnotator:
    """
    Reads a corpus JSONL file, adds translations to unannotated sentences,
    and writes the results back atomically.

    Progress is tracked in a cursor file so work can be interrupted and
    resumed without re-processing already-translated sentences.

    API-safety parameters
    ---------------------
    max_sentences      Stop after translating this many sentences in one run.
                       Set to 0 for unlimited.  Recommended: 80–100 for Google.
    batch_size         Sentences per API call (Google accepts up to ~100).
    delay_between_batches  Seconds to sleep after each API call.  Increasing
                       this reduces the chance of hitting rate limits.
    """

    def __init__(self, corpus_path: Path, backend, target_lang: str,
                 max_sentences: int = 0,
                 batch_size: int    = 50,
                 delay_between_batches: float = 2.0,
                 cursor: Optional[Cursor] = None,
                 verbose: bool = False):
        self.corpus_path           = corpus_path
        self.backend               = backend
        self.target_lang           = target_lang
        self.max_sentences         = max_sentences
        self.batch_size            = batch_size
        self.delay_between_batches = delay_between_batches
        self.cursor                = cursor
        self.verbose               = verbose

    def _vprint(self, *args, **kw) -> None:
        if self.verbose:
            print(*args, **kw)

    # ── Public entry point ────────────────────────────────────────────────────

    def run(self) -> dict:
        """
        Annotate sentences in the corpus and return a summary dict.

        Iterates over every sentence in every document.  Skips sentences that
        are before the cursor, and sentences that already have a translation
        for the target language.  Collects unannotated sentences into batches,
        translates them, commits results to disk, then updates the cursor.

        Stops early if max_sentences is reached or if the backend raises an
        exception (e.g. API rate limit hit).
        """
        docs        = self._read_corpus()
        total_done  = self.cursor.sentences_done if self.cursor else 0
        total_skip  = 0     # already had translation
        total_new   = 0     # translated this run
        hit_limit   = False
        api_error   = None
        past_cursor = self.cursor is not None  # start in "fast-forward" mode

        # We process the corpus document-by-document.  After each batch is
        # committed we rewrite the entire JSONL, for large corpora a more
        # surgical patch would be faster, but this keeps the code simple and
        # the JSONL always valid.
        pending_batch: list[tuple]  = []  # (doc_idx, sent_ref) tuples
        last_committed_id: Optional[str] = None

        def flush_batch() -> bool:
            """
            Translate pending_batch, write results back into docs[], commit
            to disk, advance cursor.  Returns False if the backend errored.
            """
            nonlocal total_new, last_committed_id, api_error

            texts    = [sr['text'].strip() for _, sr in pending_batch]
            annotator = self.backend.annotator
            # B-157: DERIVED. `annotator` is already `auto-translated-…`, but a
            # readable name is not a flag — `isDerived()` tests `derived === true`
            # and nothing else, and every "did a person do this" reader in the app
            # is downstream of it.
            prov      = derived_prov(annotator)

            try:
                translations = self.backend.translate_batch(texts)
            except Exception as exc:
                api_error = exc
                print(f"\nAPI error — stopping: {exc}", file=sys.stderr)
                _log.error(f"Translation API error: {exc}", exc_info=True)
                return False

            for (_, sent_ref), trans in zip(pending_batch, translations):
                if trans and trans != sent_ref.get('text', ''):
                    set_sent_translation(sent_ref, trans, prov)

            # Atomic commit: write to .tmp then replace
            last_id = pending_batch[-1][1].get('id', '')
            self._write_corpus(docs)
            if self.cursor:
                self.cursor.save(last_id, total_done + total_new + len(pending_batch))
            last_committed_id = last_id
            total_new += len(pending_batch)
            pending_batch.clear()

            if self.delay_between_batches > 0:
                time.sleep(self.delay_between_batches)

            return True

        for doc_idx, doc in enumerate(docs):
            if hit_limit or api_error:
                break
            self._vprint(f"\nDocument {doc.get('id', doc_idx+1)}")

            for sec in doc.get('sections', []):
                if hit_limit or api_error:
                    break
                self._vprint(f"  Section {sec.get('id', '?')}")

                for para in sec.get('paragraphs', []):
                    if hit_limit or api_error:
                        break

                    for sent in para.get('sentences', []):
                        sent_id = sent.get('id', '')

                        # Fast-forward past already-processed sentences
                        if past_cursor and self.cursor and self.cursor.is_past(sent_id):
                            continue
                        past_cursor = False  # cursor is passed; process normally

                        # Skip if already translated
                        if sent_translation(sent):
                            total_skip += 1
                            continue

                        # Skip empty sentences
                        if not sent.get('text', '').strip():
                            continue

                        pending_batch.append((doc_idx, sent))

                        # Check hard sentence limit
                        if (self.max_sentences > 0 and
                                total_new + len(pending_batch) >= self.max_sentences):
                            hit_limit = True
                            break

                        # Flush full batch to API
                        if len(pending_batch) >= self.batch_size:
                            self._vprint(
                                f"    Batch {total_new // self.batch_size + 1}: "
                                f"{len(pending_batch)} sentences …", end=' ', flush=True
                            )
                            if not flush_batch():
                                break
                            self._vprint(f"done  ({total_new} total)")

            # Flush any remaining sentences when we finish a document
            if pending_batch and not api_error:
                self._vprint(
                    f"    Final batch: {len(pending_batch)} sentences …",
                    end=' ', flush=True
                )
                if flush_batch():
                    self._vprint(f"done  ({total_new} total)")

        # Final flush if we hit the sentence limit mid-paragraph
        if pending_batch and not api_error:
            self._vprint(f"    Limit batch: {len(pending_batch)} sentences …",
                         end=' ', flush=True)
            if flush_batch():
                self._vprint("done")

        return {
            "translated_this_run": total_new,
            "already_had_translation": total_skip,
            "total_done_in_cursor": (self.cursor.sentences_done
                                     if self.cursor else total_new),
            "hit_sentence_limit": hit_limit,
            "api_error": str(api_error) if api_error else None,
        }

    # ── I/O helpers ───────────────────────────────────────────────────────────

    def _read_corpus(self) -> list[dict]:
        """Read all JSONL documents from the corpus file."""
        docs = []
        with open(self.corpus_path, encoding='utf-8') as fh:
            for lineno, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    docs.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    print(f"Warning: Skipping malformed line {lineno}: {exc}",
                          file=sys.stderr)
                    _log.warning(f"Skipping malformed JSONL line {lineno}: {exc}")
        return docs

    def _write_corpus(self, docs: list[dict]) -> None:
        """
        Atomically rewrite the corpus JSONL file.

        Writes to a .tmp file first, then replaces the original.
        This ensures the corpus file is never left in a half-written state
        if the process is killed during the write.
        """
        tmp_path = self.corpus_path.with_suffix('.jsonl.tmp')
        with open(tmp_path, 'w', encoding='utf-8') as fh:
            for doc in docs:
                json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
                fh.write('\n')
        tmp_path.replace(self.corpus_path)


# ── Language auto-detection ────────────────────────────────────────────────────

# @fn detect_corpus_language
def detect_corpus_language(corpus_path: Path) -> Optional[str]:
    """
    Read the first 10 documents from the corpus and return the source language
    stored in their metadata.language field, or None if it cannot be determined.

    The field is written by corpus_ingest.py from the --language flag or the
    EPUB's OPF Dublin Core metadata.  It may be an ISO 639-3 code ('zho', 'tur')
    or a BCP-47 code ('zh-TW', 'tr'), both are accepted by NLLBBackend._SRC_MAP.

    If the corpus contains documents in more than one source language, returns
    None and prints a warning directing the user to pass --source-lang explicitly.
    """
    langs: set[str] = set()
    with open(corpus_path, encoding='utf-8') as fh:
        for i, line in enumerate(fh):
            if i >= 10:
                break
            line = line.strip()
            if not line:
                continue
            try:
                doc  = json.loads(line)
                lang = doc.get('metadata', {}).get('language')
                if lang:
                    langs.add(lang)
            except json.JSONDecodeError:
                continue

    if not langs:
        return None
    if len(langs) > 1:
        print(
            f"Warning: corpus contains documents in multiple languages: {sorted(langs)}.\n"
            "  Use --source-lang to specify which language to translate from.",
            file=sys.stderr
        )
        return None
    return langs.pop()


# ── Stats helpers ──────────────────────────────────────────────────────────────

# @fn corpus_stats
def corpus_translation_language(corpus_path: Path) -> Optional[str]:
    """The metalanguage a corpus says its translations are written in.

    B-072: the target used to be a hard-wired 'en' here and in three places in
    the app. The translation field holds the METALANGUAGE of the documentation,
    not English, so the corpus is the thing that knows. Reads only the first
    document: one corpus documents into one language, and a file that disagreed
    with itself would be a different problem.
    """
    try:
        with open(corpus_path, encoding='utf-8') as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                doc = json.loads(line)
                lang = (doc.get('metadata') or {}).get('translation_language')
                return lang.strip() if isinstance(lang, str) and lang.strip() else None
    except (OSError, ValueError):
        return None       # an unreadable corpus is the caller's problem to report
    return None


def corpus_stats(corpus_path: Path, target_lang: str) -> dict:
    """
    Count total sentences and how many already have a translation.
    Useful for estimating remaining work before starting an annotation run.
    """
    total = 0
    translated = 0
    with open(corpus_path, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                doc = json.loads(line)
            except json.JSONDecodeError:
                continue
            for sec in doc.get('sections', []):
                for para in sec.get('paragraphs', []):
                    for sent in para.get('sentences', []):
                        total += 1
                        if sent_translation(sent):
                            translated += 1
    return {"total": total, "translated": translated, "remaining": total - translated}


# ── Config loader ─────────────────────────────────────────────────────────────

_CONFIG_FILENAME = "annotator_config.json"

# @fn load_annotator_config
def load_annotator_config(script_dir: Path) -> dict:
    """
    Load annotator_config.json from the script directory if it exists.

    Returns a flat dict of the relevant settings so main() can use them as
    defaults that CLI flags override.  Falls back to hard-coded defaults if
    the file is missing or unreadable (so the script always works without it).

    The config file is written by corpus_optimize.py after it benchmarks the
    current machine.  Running the optimizer once is the recommended setup step.
    """
    config_path = script_dir / _CONFIG_FILENAME
    defaults = {
        "translator":            "nllb",
        # NLLB compute settings (benchmarked optimal on a 4-core machine):
        # beam=1 (greedy) is 28% faster than beam=2 with minimal quality loss.
        # inter=1, intra=2 is the sweet spot: one job, two decode threads.
        "compute_type":          "int8",
        "inter_threads":         1,
        "intra_threads":         2,
        "beam_size":             1,
        # Google / rate-limiting settings
        "batch_size":            50,
        "delay_between_batches": 2.0,
    }
    if not config_path.exists():
        return defaults

    try:
        raw = json.loads(config_path.read_text(encoding='utf-8'))
    except Exception as exc:
        print(f"Warning: Could not read {_CONFIG_FILENAME} ({exc}). Using defaults.",
              file=sys.stderr)
        _log.warning(f"Could not read {_CONFIG_FILENAME}: {exc}. Using defaults.")
        return defaults

    # Pull best values from each backend section
    nllb_cfg   = raw.get("nllb",   {})
    google_cfg = raw.get("google", {})

    return {
        "translator":            raw.get("default_translator", defaults["translator"]),
        # All NLLB ctranslate2 settings come from the "nllb" section
        "compute_type":          nllb_cfg.get("compute_type",   defaults["compute_type"]),
        "inter_threads":         nllb_cfg.get("inter_threads",  defaults["inter_threads"]),
        "intra_threads":         nllb_cfg.get("intra_threads",  defaults["intra_threads"]),
        "beam_size":             nllb_cfg.get("beam_size",       defaults["beam_size"]),
        "batch_size":            google_cfg.get("batch_size",    defaults["batch_size"]),
        "delay_between_batches": google_cfg.get("delay_between_batches",
                                                defaults["delay_between_batches"]),
    }


# ── CLI ────────────────────────────────────────────────────────────────────────

# Identity marker returned by GET / so a caller can tell THIS server apart from
# whatever else might be sitting on the port. Changing these strings is a
# protocol change. LingCoT.html checks them.
SERVER_IDENT = 'lingcot-nllb'
SERVER_PROTOCOL_VERSION = 1


# @fn run_translation_server
def run_translation_server(port: int, cfg: dict) -> None:
    """Start a minimal HTTP server that exposes POST /translate for LingCoT.html.

    The viewer's "Translate" button calls this endpoint when Google Translate is
    unreachable (offline mode).  The server loads the NLLB model once on first
    request for each language pair and caches it for subsequent calls.

    Endpoint
    --------
    POST http://localhost:<port>/translate
    Body  (JSON): { "text": str, "source_lang": str, "target_lang": str }
    Response (JSON): { "translation": str, "source_lang": str, "target_lang": str }

    CORS headers are set to allow requests from file:// origins (local viewer).
    """
    import json
    from http.server import BaseHTTPRequestHandler, HTTPServer

    # Read NLLB settings from the config written by corpus_optimize.py
    nllb_cfg      = cfg.get("nllb", {})
    compute_type  = nllb_cfg.get("compute_type",  "int8")
    inter_threads = nllb_cfg.get("inter_threads",  1)
    intra_threads = nllb_cfg.get("intra_threads",  2)
    beam_size     = nllb_cfg.get("beam_size",       1)

    # Cache loaded backends by (source_lang, target_lang), avoids re-loading
    # the 600 MB model for every request when the language pair stays the same.
    _backend_cache: dict = {}

    def get_backend(src: str, tgt: str) -> 'NLLBBackend':
        key = (src, tgt)
        if key not in _backend_cache:
            print(f"  [server] Loading NLLB model for {src} → {tgt} …", flush=True)
            _backend_cache[key] = NLLBBackend(
                source_lang   = src,
                target_lang   = tgt,
                compute_type  = compute_type,
                inter_threads = inter_threads,
                intra_threads = intra_threads,
                beam_size     = beam_size,
            )
            print(f"  [server] Model ready.", flush=True)
        return _backend_cache[key]

    class _Handler(BaseHTTPRequestHandler):
        """Minimal request handler, only handles POST /translate and CORS preflight."""

        # D29 P1b: identity endpoint.
        #
        # The GUI health check used to be `fetch('http://localhost:5001/')` and
        # treat ANY resolved response as "the NLLB server is up". This class had
        # no do_GET at all, so the check was passing on BaseHTTPRequestHandler's
        # 501 Not Implemented, and it passed just as happily for any unrelated
        # service that happened to own the port (macOS AirPlay Receiver is the
        # classic one). Liveness was being measured; identity never was. A
        # foreign listener therefore showed a green "server up" dot while every
        # translation silently returned nothing.
        #
        # Answering with a known marker lets the caller tell "something is
        # listening" from "the thing need is listening".
        def do_GET(self):
            self._json({
                'service': SERVER_IDENT,
                'version': SERVER_PROTOCOL_VERSION,
                'endpoints': ['/translate', '/translate_batch'],
            })

        def do_OPTIONS(self):
            """Handle CORS preflight sent by browsers before cross-origin POSTs."""
            self.send_response(200)
            self._add_cors_headers()
            self.end_headers()

        def do_POST(self):
            if self.path not in ('/translate', '/translate_batch'):
                self.send_error(404, "Supported endpoints: /translate  /translate_batch")
                return
            try:
                length = int(self.headers.get('Content-Length', 0))
                body   = json.loads(self.rfile.read(length))
            except Exception:
                self._json({'error': 'invalid JSON body'}, 400)
                return

            source_lang = (body.get('source_lang') or 'auto').strip()
            target_lang = (body.get('target_lang') or 'en').strip()

            if self.path == '/translate':
                # Single-sentence endpoint
                text = (body.get('text') or '').strip()
                if not text:
                    self._json({'error': 'text field is empty'}, 400)
                    return
                try:
                    backend = get_backend(source_lang, target_lang)
                    [translated] = backend.translate_batch([text])
                    self._json({
                        'translation': translated,
                        'source_lang': source_lang,
                        'target_lang': target_lang,
                    })
                except Exception as exc:
                    print(f"  [server] Translation error: {exc}", flush=True)
                    self._json({'error': str(exc)}, 500)

            else:  # /translate_batch
                # Batch endpoint: accepts a list of texts, returns a list of translations.
                # Uses ctranslate2's native translate_batch() for efficient parallel decoding.
                texts = body.get('texts')
                if not isinstance(texts, list) or not texts:
                    self._json({'error': 'texts must be a non-empty list'}, 400)
                    return
                # Strip empty strings; remember their original positions for re-insertion
                indexed = [(i, t.strip()) for i, t in enumerate(texts) if isinstance(t, str) and t.strip()]
                translations = [None] * len(texts)
                try:
                    backend = get_backend(source_lang, target_lang)
                    translated = backend.translate_batch([t for _, t in indexed])
                    for (i, _), result in zip(indexed, translated):
                        translations[i] = result
                    self._json({
                        'translations': translations,
                        'source_lang':  source_lang,
                        'target_lang':  target_lang,
                    })
                except Exception as exc:
                    print(f"  [server] Batch translation error: {exc}", flush=True)
                    self._json({'error': str(exc)}, 500)

        def _add_cors_headers(self):
            """Allow requests from any origin (needed for file:// → localhost).
            Covers both /translate and /translate_batch endpoints."""
            self.send_header('Access-Control-Allow-Origin',  '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')

        def _json(self, data: dict, status: int = 200) -> None:
            body = json.dumps(data).encode('utf-8')
            self.send_response(status)
            self._add_cors_headers()
            self.send_header('Content-Type',   'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):  # noqa: N802
            # Print a compact request line instead of the default verbose format
            print(f"  [server] {fmt % args}", flush=True)

    print(f"NLLB translation server starting on http://localhost:{port}")
    print(f"  Identity:  GET / → {{\"service\": \"{SERVER_IDENT}\"}}")
    print(f"  Endpoints: POST /translate (single)  POST /translate_batch (array)")
    print(f"  Settings:  compute={compute_type}  inter={inter_threads}  "
          f"intra={intra_threads}  beam={beam_size}")
    print("  Model loads on first request (~2 s).  Ctrl+C to stop.\n")
    try:
        HTTPServer(('localhost', port), _Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


# @fn parse_args
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Annotate (translate, gloss, etc.) an existing corpus JSONL file.\n"
            "Designed for resumable, rate-limit-aware batch processing.\n\n"
            f"Defaults are loaded from {_CONFIG_FILENAME} (written by corpus_optimize.py).\n"
            "Any flag provided on the command line overrides the config file."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # corpus is optional when --serve is used (server mode doesn't operate on a file)
    parser.add_argument('corpus', nargs='?', default=None,
                        help='Corpus JSONL file to annotate (edited in-place). '
                             'Not required when using --serve.')

    # ── Server mode ───────────────────────────────────────────────────────────
    s = parser.add_argument_group('Server mode (for LingCoT.html offline translation)')
    s.add_argument(
        '--serve', action='store_true',
        help='Start a local HTTP translation server on localhost (port set by --port). '
             'The LingCoT.html "Translate" button uses this when offline. '
             'Reads NLLB settings from annotator_config.json if present.'
    )
    s.add_argument(
        '--port', type=int, default=5001, metavar='PORT',
        help='Port for --serve mode (default: 5001).'
    )

    # ── Translation options ───────────────────────────────────────────────────
    t = parser.add_argument_group('Translation')
    t.add_argument(
        '--translate', action='store_true',
        help='Translate sentences that have no translation yet'
    )
    t.add_argument(
        '--translator', default=None, choices=['google', 'nllb'],
        metavar='BACKEND',
        help='"google" (online, rate-limited) or "nllb" (offline, 200 languages, no limits). '
             f'Default: from {_CONFIG_FILENAME}, or "nllb" if no config found.'
    )
    t.add_argument(
        '--source-lang', metavar='LANG',
        help='ISO 639-3 source language code (e.g. zho, kor). '
             'Defaults to auto-detect (unreliable for CJK).'
    )
    t.add_argument(
        '--target-lang', default=None, metavar='LANG',
        help="Translation target. Defaults to the corpus's own "
             "metadata.translation_language, then to 'en'."
    )

    # ── Rate-limiting / batch controls ────────────────────────────────────────
    r = parser.add_argument_group('Rate limiting')
    r.add_argument(
        '--max-sentences', type=int, default=0, metavar='N',
        help='Stop after translating N sentences. 0 = unlimited. '
             'Recommended: 80-100 for Google free tier.'
    )
    r.add_argument(
        '--batch-size', type=int, default=None, metavar='N',
        help=f'Sentences per API call. Default: from {_CONFIG_FILENAME}, or 50.'
    )
    r.add_argument(
        '--delay', type=float, default=None, dest='delay_between_batches',
        metavar='SECONDS',
        help=f'Sleep between API calls. Default: from {_CONFIG_FILENAME}, or 2.0s. '
             'Use 0 for Argos (offline, no limit).'
    )

    # ── NLLB tuning ───────────────────────────────────────────────────────────
    a = parser.add_argument_group('NLLB backend tuning (ctranslate2)')
    a.add_argument(
        '--compute-type', default=None,
        choices=['default', 'int8', 'int16', 'float16', 'float32'],
        help=f'ctranslate2 quantization precision. Default: from {_CONFIG_FILENAME}, or int8.'
    )
    a.add_argument(
        '--inter-threads', type=int, default=None, metavar='N',
        help='Number of parallel translation jobs (each uses intra_threads cores). '
             f'Default: from {_CONFIG_FILENAME}, or 1.'
    )
    a.add_argument(
        '--intra-threads', type=int, default=None, metavar='N',
        help='(NLLB only) Threads per translation job for parallel beam decoding. '
             'inter_threads × intra_threads should ≤ total CPU cores. '
             f'Default: from {_CONFIG_FILENAME}, or 2.'
    )
    a.add_argument(
        '--beam-size', type=int, default=None, metavar='N',
        help='(NLLB only) Beam search width. Larger = slightly higher quality, slower. '
             f'Default: from {_CONFIG_FILENAME}, or 2.'
    )

    # ── Cursor / progress ─────────────────────────────────────────────────────
    c = parser.add_argument_group('Cursor / progress')
    c.add_argument(
        '--reset-cursor', action='store_true',
        help='Ignore any saved cursor and restart from the beginning.'
    )
    c.add_argument(
        '--stats', action='store_true',
        help='Print translation progress statistics for the corpus and exit.'
    )

    # ── Output ────────────────────────────────────────────────────────────────
    parser.add_argument(
        '--verbose', '-v', action='store_true',
        help='Print per-section/paragraph progress'
    )

    return parser.parse_args()


# @fn main
def refuse_if_journal(corpus_path: Path) -> None:
    """D50 stage 3d: refuse to touch a corpus that has unfolded edits beside it.

    Since v3.14.241 the app appends annotation to a journal and folds it into the
    corpus file only on a compaction trigger, so between those the corpus file is
    BEHIND what the annotator has done. Reading it here would work on a stale
    corpus; writing it back would destroy whatever the journal holds.

    The alternative was to replay the journal in Python, which means a second
    implementation that has to stay byte-identical to the JavaScript one — the
    two-writers problem that produced SCRIPTS_AUDIT in the first place. Refusing
    costs the user one open-and-close of the app and cannot be subtly wrong.
    """
    journal = corpus_path.parent / (
        corpus_path.name.replace('_corpus.jsonl', '') + '.journal.jsonl')
    if journal.is_file() and journal.stat().st_size > 0:
        print(f"Error: '{journal.name}' holds edits that are not in the corpus file yet.",
              file=sys.stderr)
        print("       Open the project in LingCoT and close it again; that folds them in.",
              file=sys.stderr)
        print(f"       (Working from the corpus alone would use a stale copy and "
              f"overwrite {journal.stat().st_size:,} bytes of annotation.)", file=sys.stderr)
        _log.error(f"Refused: unfolded journal beside {corpus_path} ({journal.stat().st_size} bytes)")
        sys.exit(2)


def main():
    args       = parse_args()
    script_dir   = Path(__file__).parent                    # source/scripts/
    project_root = script_dir.parent.parent                  # project root (LingCoT/)
    config_dir   = project_root / "source" / "config"        # source/config/

    # ── Server mode, does not need a corpus file ─────────────────────────────
    if args.serve:
        cfg = load_annotator_config(config_dir)
        run_translation_server(port=args.port, cfg=cfg)
        return  # serve_forever() blocks until Ctrl+C

    # All other modes require a corpus file
    if not args.corpus:
        print("Error: a corpus JSONL file is required unless --serve is used.",
              file=sys.stderr)
        _log.error("No corpus file supplied — exiting.")
        sys.exit(1)

    corpus_path = Path(args.corpus)

    if not corpus_path.exists():
        print(f"Error: '{corpus_path}' not found.", file=sys.stderr)
        _log.error(f"Corpus file not found: {corpus_path}")
        sys.exit(1)

    refuse_if_journal(corpus_path)

    # B-072: an explicit flag wins; otherwise the corpus says what language its
    # translations are in, and 'en' is the last resort rather than the default.
    if not args.target_lang:
        args.target_lang = corpus_translation_language(corpus_path) or 'en'
        _log.info(f"target language: {args.target_lang} "
                  f"({'from corpus' if args.target_lang != 'en' else 'fallback'})")

    # ── Stats-only mode ───────────────────────────────────────────────────────
    if args.stats:
        stats = corpus_stats(corpus_path, args.target_lang)
        pct   = (stats['translated'] / stats['total'] * 100) if stats['total'] else 0
        print(f"Corpus: {corpus_path}")
        print(f"  Total sentences:      {stats['total']}")
        print(f"  Already translated:   {stats['translated']}  ({pct:.1f}%)")
        print(f"  Remaining:            {stats['remaining']}")
        return

    # ── Require at least one annotation mode ─────────────────────────────────
    if not args.translate:
        print("Nothing to do.  Use --translate or --stats to annotate the corpus.",
              file=sys.stderr)
        sys.exit(0)

    # ── Translation mode ──────────────────────────────────────────────────────

    # ── Load annotator_config.json; CLI flags override any config value ────────
    cfg = load_annotator_config(config_dir)
    config_path = config_dir / _CONFIG_FILENAME
    if config_path.exists():
        print(f"Config: {config_path}")
    else:
        print(f"Config: none found — using built-in defaults  "
              f"(run corpus_optimize.py to generate {_CONFIG_FILENAME})")

    # Resolve each setting: CLI flag (not None) > config file > built-in default
    translator            = args.translator            or cfg["translator"]
    compute_type          = args.compute_type          or cfg["compute_type"]
    inter_threads         = args.inter_threads         if args.inter_threads is not None else cfg["inter_threads"]
    intra_threads         = args.intra_threads         if args.intra_threads is not None else cfg["intra_threads"]
    beam_size             = args.beam_size             if args.beam_size     is not None else cfg["beam_size"]
    batch_size            = args.batch_size            if args.batch_size    is not None else cfg["batch_size"]
    delay_between_batches = args.delay_between_batches if args.delay_between_batches is not None else cfg["delay_between_batches"]

    # Build the cursor file path: corpus.jsonl.translate_en.cursor
    cursor_path = corpus_path.parent / (
        corpus_path.name + f".translate_{args.target_lang}.cursor"
    )
    cursor = Cursor(cursor_path)
    if args.reset_cursor:
        cursor.reset()

    # ── Resolve source language ───────────────────────────────────────────────
    # Use --source-lang if provided; otherwise read metadata.language from the
    # corpus itself.  For NLLB this is required, for Google it improves
    # accuracy over auto-detect (especially for CJK scripts).
    source_lang = args.source_lang
    if source_lang is None:
        detected = detect_corpus_language(corpus_path)
        if detected:
            source_lang = detected
            print(f"  Source language: {source_lang!r}  (auto-detected from corpus metadata)")
        elif translator == 'nllb':
            print(
                "Warning: --source-lang not provided and no language found in corpus metadata.\n"
                "  NLLB will default to 'eng_Latn', which is probably wrong.\n"
                "  Pass --source-lang (e.g. --source-lang tur) for correct results.",
                file=sys.stderr
            )

    # Build the translation backend
    try:
        if translator == 'google':
            backend = GoogleBackend(
                source_lang=source_lang,
                target_lang=args.target_lang,
            )
        else:  # nllb, offline, 200 languages, no rate limits
            backend = NLLBBackend(
                source_lang=source_lang,
                target_lang=args.target_lang,
                compute_type=compute_type,
                inter_threads=inter_threads,
                intra_threads=intra_threads,
                beam_size=beam_size,
            )
    except (ImportError, FileNotFoundError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        _log.error(f"Failed to initialise translation backend ({translator}): {exc}")
        sys.exit(1)

    # Print a pre-run summary
    stats = corpus_stats(corpus_path, args.target_lang)
    limit_str = f"up to {args.max_sentences}" if args.max_sentences else "all"
    _log.info(f"Annotation started — corpus: {corpus_path.name} | backend: {translator} | "
              f"source: {source_lang} | remaining: {stats['remaining']}/{stats['total']}")
    print(f"\nCorpus: {corpus_path}")
    print(f"  Sentences remaining: {stats['remaining']} / {stats['total']}")
    if translator == 'nllb':
        backend_info = (f"compute={compute_type}  inter={inter_threads}  "
                        f"intra={intra_threads}  beam={beam_size}")
    else:  # google
        backend_info = f"batch={batch_size}  delay={delay_between_batches}s"
    print(f"  Translator: {translator}  {backend_info}")
    print(f"  Translating {limit_str} sentences this run")
    print()

    # Run the annotator
    import time as _time
    t0 = _time.perf_counter()

    annotator = CorpusAnnotator(
        corpus_path           = corpus_path,
        backend               = backend,
        target_lang           = args.target_lang,
        max_sentences         = args.max_sentences,
        batch_size            = batch_size,
        delay_between_batches = delay_between_batches,
        cursor                = cursor,
        verbose               = args.verbose,
    )
    result = annotator.run()

    elapsed = _time.perf_counter() - t0

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'─' * 60}")
    print(f"Run complete in {elapsed:.1f}s")
    print(f"  Translated this run:     {result['translated_this_run']}")
    print(f"  Already had translation: {result['already_had_translation']}")

    if result['hit_sentence_limit']:
        print(f"\n⚠  Sentence limit ({args.max_sentences}) reached.")
        remaining = stats['remaining'] - result['translated_this_run']
        print(f"   ~{remaining} sentences still to go.  "
              f"Re-run the same command to continue.")

    if result['api_error']:
        print(f"\n✗  API error encountered: {result['api_error']}")
        print("   Cursor saved — re-run the same command after the cooldown period.")
        _log.error(f"API error — run ended early: {result['api_error']}")
        sys.exit(2)   # exit code 2 signals partial completion (useful for schedulers)

    # Final stats
    stats_after = corpus_stats(corpus_path, args.target_lang)
    pct = (stats_after['translated'] / stats_after['total'] * 100) if stats_after['total'] else 0
    print(f"\n  Overall progress: {stats_after['translated']} / {stats_after['total']} "
          f"sentences translated  ({pct:.1f}%)")
    if stats_after['remaining'] == 0:
        print("  ✓ All sentences translated!")
        _log.info(f"Annotation complete — all {stats_after['total']} sentences translated "
                  f"in {elapsed:.1f}s")
    else:
        print(f"  {stats_after['remaining']} sentences remaining — "
              f"run again to continue.")
        _log.info(f"Annotation run complete — {result['translated_this_run']} translated "
                  f"in {elapsed:.1f}s | {stats_after['remaining']} remaining")


if __name__ == '__main__':
    main()
