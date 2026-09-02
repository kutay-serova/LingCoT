#!/usr/bin/env python3
# =============================================================================
# Linguistic Corpus Toolkit (LingCoT), setup.py
# Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# See LICENSE in the project root for the full license text.
# =============================================================================
#
# PURPOSE
#   First-time setup checker and model downloader.  Verifies that all required
#   components are present: the NLLB-200 translation model (if requested),
#   config files, and the functional word table.  Can download missing models
#   and generate missing config files automatically.
#
# RELATIONSHIP TO build_env.py
#   build_env.py installs Python packages (in tiers: minimal or nllb).
#   setup.py downloads data, the NLLB model weights, into source/models/nllb/.
#   When run with --nllb, this script also auto-upgrades the venv to the nllb
#   tier if needed (so a user who started on minimal can switch on offline
#   translation without separately re-running build_env.py).
#
# STRUCTURE
#   check_python(), verifies Python >= 3.9
#   check_nllb_packages(), verifies the venv is on the nllb tier
#   check_nllb_model(), verifies models/nllb/ directory and weights
#   check_config(), checks annotator_config.json
#   ensure_nllb_packages(), upgrades venv to nllb tier if needed (calls
#                               build_env.py --tier nllb under the hood)
#   download_nllb(), fetches via huggingface_hub +
#                               ct2-transformers-converter
#   write_default_config(), writes annotator_config.json with safe defaults
#   main(), interactive or non-interactive mode; flags:
#                               --check, --all, --nllb, --require-nllb
#
# USAGE
#   .venv/bin/python3 setup.py              # interactive check-and-fix
#   .venv/bin/python3 setup.py --check      # exit 1 only if minimal tier broken
#   .venv/bin/python3 setup.py --check --require-nllb  # also require NLLB ready
#   .venv/bin/python3 setup.py --nllb       # upgrade to nllb tier + download
#
# THIRD-PARTY TOOLS
#   NLLB-200  https://github.com/facebookresearch/fairseq/tree/nllb
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
setup.py  –  LingCoT first-time setup and dependency checker

Checks that all required models, data files, and configuration are present
and offers to download or generate anything that is missing.

Usage:
  .venv/bin/python3 setup.py               # interactive: check everything, prompt to fix
  .venv/bin/python3 setup.py --check       # check minimal tier; exit 1 only if broken
  .venv/bin/python3 setup.py --check --require-nllb   # also require NLLB packages + model
  .venv/bin/python3 setup.py --all         # download/generate everything missing automatically
  .venv/bin/python3 setup.py --nllb        # upgrade venv to nllb tier + download model

What this script sets up
------------------------
  models/nllb/
    flores200_sacrebleu_tokenizer_spm.model   ~4.7 MB   FLORES-200 SentencePiece tokenizer
    nllb-200-distilled-600M-int8/             ~594 MB   CTranslate2 int8 weights
      config.json
      model.bin
      shared_vocabulary.txt

  annotator_config.json        (written with safe defaults if absent)

Minimum viable setup
--------------------
For online translation only:     nothing to download (minimal tier is enough).
For offline translation (NLLB):  run --nllb.  This pulls the venv up to the
                                 "nllb" tier (installing ctranslate2,
                                 sentencepiece, transformers, torch, etc.) if
                                 it isn't already, then downloads and converts
                                 the model.

NLLB upgrade path
-----------------
If the user created the venv with `build_env.py` at the minimal tier and later
decides they want offline translation, running

    .venv/bin/python3 setup.py --nllb

is sufficient: this script will invoke `build_env.py --tier nllb` to add the
missing packages, then proceed to download + convert the model.  No manual
re-run of build_env.py is required.

NLLB download method
--------------------
After the nllb tier is installed, the script converts the official
facebook/nllb-200-distilled-600M model from HuggingFace to CTranslate2 int8
format using ct2-transformers-converter (from the ctranslate2 package).  The
converter needs the `transformers` + `torch` packages, which are part of the
nllb tier, so the package-tier check must succeed before conversion runs.

Total download: ~1.2 GB (source fp32 model → HF cache in ~/.cache/huggingface/),
producing ~600 MB int8 weights on disk after conversion.  Peak disk use during
conversion: ~1.8 GB.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path
from typing import Optional

# ── Logging ───────────────────────────────────────────────────────────────────
# Append-mode: all setup.py runs accumulate in one logs/setup.log file so the
# full install history is visible in a single place.
sys.path.insert(0, str(Path(__file__).parent))  # ensure source/ is importable
from log_setup import setup_append_logger as _setup_log

# ── Project paths ──────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent   # source/ → project root
MODELS_DIR   = PROJECT_ROOT / "source" / "models"
DATA_DIR     = PROJECT_ROOT / "source" / "resources"
SCRIPTS_DIR  = PROJECT_ROOT / "source" / "scripts"
CONFIG_FILE  = PROJECT_ROOT / "source" / "config" / "annotator_config.json"

from version import __version__ as APP_VERSION
from workspace import (WORKSPACE, CORPORA_DIR, ensure_workspace as _ensure_ws,
                       migrate_legacy_corpora as _migrate_ws,
                       migrate_workspace as _migrate_home)
NLLB_DIR       = MODELS_DIR / "nllb"
NLLB_MODEL_NAME = "nllb-200-distilled-600M-int8"
NLLB_MODEL_DIR  = NLLB_DIR / NLLB_MODEL_NAME
NLLB_TOKENIZER  = NLLB_DIR / "flores200_sacrebleu_tokenizer_spm.model"

# Initialise logger now that PROJECT_ROOT is available.
_log = _setup_log(PROJECT_ROOT, filename='setup.log', logger_name='setup')

# HuggingFace sources
HF_NLLB_SOURCE_REPO   = "facebook/nllb-200-distilled-600M"  # fp32 HF Transformers model
HF_TOKENIZER_FILENAME = "sentencepiece.bpe.model"            # HF name → renamed locally

# Default annotator config (mirrors the hard-coded defaults in corpus_annotate.py)
DEFAULT_CONFIG = {
    "version":    "2.0",
    "benchmarked": None,
    "system":     {"cpu_cores": os.cpu_count() or 1},
    "sample":     {"src_lang": None, "tgt_lang": "eng_Latn", "n_sentences": 0},
    "nllb": {
        "compute_type":    "int8",
        "inter_threads":   1,
        "intra_threads":   2,
        "beam_size":       1,
        "rate_sent_per_s": None,
        "all_results":     [],
    },
    "google": {
        "batch_size":              50,
        "delay_between_batches":   2.0,
        "rate_sent_per_s":         None,
        "all_results":             [],
    },
    "default_translator": "nllb",
}


# ── Formatting helpers ──────────────────────────────────────────────────────────

BOLD  = "\033[1m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED   = "\033[31m"
CYAN  = "\033[36m"
RESET = "\033[0m"


# @fn _c
def _c(color: str, text: str) -> str:
    """Wrap text in an ANSI color code (noop when stdout is not a tty)."""
    if not sys.stdout.isatty():
        return text
    return color + text + RESET


# @fn header
def header(title: str) -> None:
    print(f"\n{_c(BOLD, '── ' + title + ' ──')}")


# @fn ok
def ok(msg: str) -> None:
    print(f"  {_c(GREEN, '✓')}  {msg}")


# @fn warn
def warn(msg: str) -> None:
    print(f"  {_c(YELLOW, '!')}  {msg}")


# @fn missing
def missing(msg: str) -> None:
    print(f"  {_c(RED, '✗')}  {msg}")


# @fn info
def info(msg: str) -> None:
    print(f"     {_c(CYAN, '→')} {msg}")


# @fn ask
def ask(prompt: str) -> bool:
    """Ask a yes/no question; return True for yes."""
    while True:
        reply = input(f"     {prompt} [y/n] ").strip().lower()
        if reply in ("y", "yes"):
            return True
        if reply in ("n", "no"):
            return False
        print("     Please answer y or n.")


# ── Check functions ─────────────────────────────────────────────────────────────
#
# (Note: the urllib-based single-file downloaders that used to live here were
#  removed, the NLLB download path uses huggingface_hub.snapshot_download
#  exclusively, which handles multi-file downloads, resume, and hashing.)


# @fn check_python
def check_python() -> bool:
    """Python ≥ 3.9 required."""
    header("Python version")
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 9):
        missing(f"Python {major}.{minor} detected — Python 3.9+ required.")
        return False
    ok(f"Python {major}.{minor}")
    return True


# Python packages that must be importable for the NLLB backend to work.
# Split into "runtime" (needed to RUN NLLB-200 inference) and "conversion"
# (needed only once, by setup.py --nllb, to download + convert the model).
# Both are installed together by the `nllb` extra in pyproject.toml.
_NLLB_RUNTIME_PACKAGES    = ("ctranslate2", "sentencepiece", "numpy")
_NLLB_CONVERSION_PACKAGES = ("huggingface_hub", "transformers", "torch")

# Packages for the dictionary PDF export feature.
# fpdf2 is installed as the "fpdf2" distribution but imported as "fpdf".
# python-bidi is imported as "bidi".
# Both are installed by the `pdf` extra in pyproject.toml.
_PDF_PACKAGES = ("fpdf", "bidi")


# @fn _check_import
def _check_import(pkg: str) -> bool:
    """True if the package can be imported from the currently running Python."""
    try:
        __import__(pkg)
        return True
    except ImportError:
        return False


# @fn check_nllb_packages
def check_nllb_packages(verbose: bool = True) -> dict:
    """
    Check that the venv has the Python packages required for the NLLB tier.
    Runtime packages are required to RUN NLLB; conversion packages are only
    needed during model download/conversion but we check them together because
    both are installed by the `nllb` extra.
    Returns a dict summarising which group(s) are present.
    """
    if verbose:
        header("NLLB Python packages")

    runtime_ok    = all(_check_import(p) for p in _NLLB_RUNTIME_PACKAGES)
    conversion_ok = all(_check_import(p) for p in _NLLB_CONVERSION_PACKAGES)

    if verbose:
        for pkg in _NLLB_RUNTIME_PACKAGES:
            (ok if _check_import(pkg) else missing)(f"{pkg}  (runtime)")
        for pkg in _NLLB_CONVERSION_PACKAGES:
            (ok if _check_import(pkg) else missing)(f"{pkg}  (conversion / one-time)")

    return {"runtime": runtime_ok, "conversion": conversion_ok,
            "all": runtime_ok and conversion_ok}


# @fn check_pdf_packages
def check_pdf_packages(verbose: bool = True) -> bool:
    """
    Check that the venv has the Python packages required for dictionary PDF export.
    Returns True if all packages are present.
    Install with:  python3 build_env.py --tier pdf
    """
    if verbose:
        header("PDF export packages")

    all_ok = all(_check_import(p) for p in _PDF_PACKAGES)

    if verbose:
        pkg_labels = {"fpdf": "fpdf2 — PDF generation", "bidi": "python-bidi — RTL bidi reordering"}
        for pkg in _PDF_PACKAGES:
            (ok if _check_import(pkg) else missing)(f"{pkg}  ({pkg_labels.get(pkg, pkg)})")
        if not all_ok:
            info("Install with:  python3 build_env.py --tier pdf")

    return all_ok


# @fn ensure_pdf_packages
def ensure_pdf_packages() -> bool:
    """
    Make sure fpdf2 and python-bidi are installed.  If missing, invoke
    `build_env.py --tier pdf` to install them into the existing venv.
    Returns True when all packages are importable after this call.
    """
    if all(_check_import(p) for p in _PDF_PACKAGES):
        return True

    header("Installing PDF export packages")
    info("fpdf2 and python-bidi are required for dictionary PDF export.")
    info("Calling  build_env.py --tier pdf  to install them.")
    print()

    build_env = PROJECT_ROOT / "source" / "build_env.py"
    if not build_env.exists():
        missing(f"build_env.py not found at {build_env}")
        info("Install manually:  .venv/bin/pip install fpdf2 python-bidi")
        return False

    result = subprocess.run([sys.executable, str(build_env), "--tier", "pdf"],
                            cwd=str(PROJECT_ROOT))
    if result.returncode != 0:
        warn("build_env.py --tier pdf failed.  See output above for details.")
        return False

    import importlib
    importlib.invalidate_caches()

    if not all(_check_import(p) for p in _PDF_PACKAGES):
        warn("PDF packages still not importable after install.")
        info("Try:  .venv/bin/pip install fpdf2 python-bidi")
        return False

    ok("PDF export packages are ready.")
    return True


# @fn check_nllb_model
def check_nllb_model() -> dict:
    """
    Check for the NLLB model weights and tokenizer on disk.
    Returns a dict: {'tokenizer': bool, 'model': bool, 'model_dir': Path|None}
    """
    header("NLLB model files")

    # Tokenizer, a single ~4.7 MB SentencePiece file
    tok_ok = NLLB_TOKENIZER.exists()
    if tok_ok:
        ok(f"Tokenizer  {NLLB_TOKENIZER.name}  ({NLLB_TOKENIZER.stat().st_size / 1e6:.1f} MB)")
    else:
        missing(f"Tokenizer missing:  {NLLB_TOKENIZER}")

    # Model directory: any nllb-200-* dir under NLLB_DIR (we accept variants
    # like -distilled-600M-int8 or -distilled-1.3B-int8 so the user can swap).
    model_dirs = [
        d for d in (NLLB_DIR.iterdir() if NLLB_DIR.exists() else [])
        if d.is_dir() and d.name.startswith("nllb-200-")
    ]
    model_dir: Optional[Path] = model_dirs[0] if model_dirs else None

    if model_dir:
        size_mb = sum(f.stat().st_size for f in model_dir.rglob("*") if f.is_file()) / 1e6
        ok(f"Model weights  {model_dir.name}  ({size_mb:.0f} MB)")
    else:
        missing(f"No nllb-200-* model directory found under  {NLLB_DIR}/")

    return {"tokenizer": tok_ok, "model": model_dir is not None, "model_dir": model_dir}


# @fn check_config
def check_config() -> bool:
    """Check that annotator_config.json exists and is valid JSON."""
    header("Annotator config")
    if not CONFIG_FILE.exists():
        warn("annotator_config.json not found — scripts will use built-in defaults.")
        info("Run  .venv/bin/python3 scripts/corpus_optimize.py  to generate an optimised config.")
        info("Or run this script with --all to write a default config now.")
        return False
    try:
        cfg = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        translator = cfg.get("default_translator", "?")
        ok(f"annotator_config.json  (default_translator: {translator})")
        return True
    except json.JSONDecodeError as exc:
        missing(f"JSON parse error in {CONFIG_FILE}: {exc}")
        return False



# ── Download / generate functions ───────────────────────────────────────────────

# @fn ensure_nllb_packages
def ensure_nllb_packages() -> bool:
    """
    Make sure the venv has all the Python packages needed to download, convert,
    and run NLLB-200.  If they are missing, invoke `build_env.py --tier nllb`
    to install them into the existing venv.

    Returns True when every required package is importable after this call.

    Why this exists
    ---------------
    A user may have run `build_env.py` at the minimal tier and later decided
    they want offline translation.  Rather than forcing them to re-read the
    docs and re-run build_env.py themselves, --nllb transparently performs
    the tier upgrade first.  The cost is a single subprocess round-trip into
    build_env.py, which is cheap compared to the model download that follows.
    """
    status = check_nllb_packages(verbose=False)
    if status["all"]:
        return True

    # One or more packages are missing, announce the upgrade and delegate
    # the actual install to build_env.py so the tier logic stays in one place.
    header("Upgrading venv to the NLLB tier")
    info("The NLLB backend needs: " + ", ".join(
        list(_NLLB_RUNTIME_PACKAGES) + list(_NLLB_CONVERSION_PACKAGES)))
    info("Calling  build_env.py --tier nllb  to install them into the existing venv.")
    print()

    build_env = PROJECT_ROOT / "source" / "build_env.py"
    if not build_env.exists():
        missing(f"build_env.py not found at {build_env}")
        info("Cannot auto-upgrade.  Reinstall the project files or run manually:")
        info(f"  {sys.executable} -m pip install 'ctranslate2>=4.7,<5' sentencepiece numpy "
             "huggingface_hub transformers torch")
        return False

    # sys.executable here is the venv Python (setup.py re-exec'd into it at
    # import time), passing it to build_env.py is harmless; build_env.py
    # resolves the venv by path, not by interpreter.
    result = subprocess.run([sys.executable, str(build_env), "--tier", "nllb"],
                            cwd=str(PROJECT_ROOT))
    if result.returncode != 0:
        warn("build_env.py --tier nllb failed.  See output above for details.")
        return False

    # Re-check after the install.  Note: we're still running in the same Python
    # interpreter, which means freshly installed packages may or may not be
    # importable in this process depending on site-packages caching.  Force a
    # re-scan by invalidating the import caches.
    import importlib
    importlib.invalidate_caches()

    post = check_nllb_packages(verbose=False)
    if not post["all"]:
        warn("Some NLLB packages are still not importable after upgrade.")
        info("Try running this command again in a new terminal:")
        info("  .venv/bin/python3 setup.py --nllb")
        return False

    ok("NLLB tier is ready.")
    return True


# @fn download_nllb
def download_nllb() -> bool:
    """
    Download and convert the NLLB-200-distilled-600M model to CTranslate2 int8.

    Strategy
    --------
    1. Make sure the venv has the NLLB packages (ensure_nllb_packages()).
    2. Download the HuggingFace Transformers model
       (facebook/nllb-200-distilled-600M) into the HF cache.
    3. Convert it with ct2-transformers-converter (from ctranslate2).
    4. Copy the SentencePiece tokenizer to models/nllb/.

    Disk use: downloads ~1.2 GB of source weights into ~/.cache/huggingface/,
    produces ~600 MB of int8 weights under models/nllb/.  Peak ~1.8 GB during
    conversion.  The HF cache is intentionally preserved so a re-run (e.g.
    after moving to another machine or re-quantising) doesn't re-download.
    """

    print()
    print(_c(BOLD, "  Downloading NLLB-200 Distilled 600M (int8 CTranslate2 format)"))
    print("  Source: facebook/nllb-200-distilled-600M on HuggingFace")
    print("  ~1.2 GB source download → ~600 MB on disk after int8 conversion")
    print("  (source stays cached in ~/.cache/huggingface/ for future re-use)")
    print()

    # ── Step 1: Make sure the NLLB Python packages are all installed ──────────
    # This covers the minimal-tier → nllb-tier upgrade path: if any of
    # ctranslate2 / sentencepiece / huggingface_hub / transformers / torch is
    # missing, ensure_nllb_packages() calls build_env.py --tier nllb for us.
    if not ensure_nllb_packages():
        _print_nllb_manual_instructions()
        return False

    # ── Step 2: Download HF model into the HF cache ────────────────────────────
    model_tmp: Optional[Path] = None
    try:
        import huggingface_hub as hfh

        print(f"  Downloading  {HF_NLLB_SOURCE_REPO}  from HuggingFace…")
        print("  (progress is shown per-file below)\n")

        # ignore_patterns drops files we don't need: alternative framework
        # weights (flax/tf/rust/h5), extra tokenizer wrappers (tokenizer.json
        # et al., we use the raw SentencePiece), and repo metadata.  The
        # pytorch .bin weights + sentencepiece.bpe.model + config.json are
        # kept, which is exactly what ct2-transformers-converter needs.
        model_tmp_str = hfh.snapshot_download(
            repo_id    = HF_NLLB_SOURCE_REPO,
            ignore_patterns = ["*.msgpack", "flax_*", "tf_*", "rust_*", "*.h5",
                               "*.ot", "vocab.json", "tokenizer.json",
                               "tokenizer_config.json", "special_tokens_map.json",
                               "*.md", ".gitattributes"],
        )
        model_tmp = Path(model_tmp_str)
        ok(f"Source model downloaded to HF cache: {model_tmp}")
    except Exception as exc:
        warn(f"HuggingFace download failed: {exc}")
        _print_nllb_manual_instructions()
        return False

    # ── Step 3: Convert to CTranslate2 int8 ───────────────────────────────────
    NLLB_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n  Converting to CTranslate2 int8 → {NLLB_MODEL_DIR}")
    print("  (this takes 1–5 minutes on a typical laptop CPU)\n")

    # ct2-transformers-converter is provided by the ctranslate2 package and
    # loads the HF checkpoint via the `transformers` + `torch` packages, all
    # of which are guaranteed present at this point by ensure_nllb_packages().
    converter_cmd = [
        sys.executable, "-m", "ctranslate2.converters.transformers",
        "--model",        str(model_tmp),
        "--output_dir",   str(NLLB_MODEL_DIR),
        "--quantization", "int8",
        "--force",  # overwrite a stale output dir from a previous run
    ]

    result = subprocess.run(converter_cmd)
    if result.returncode != 0:
        warn("Model conversion failed.  Manual instructions:")
        _print_nllb_manual_instructions()
        _log.error("NLLB model conversion failed.")
        return False
    ok(f"Conversion complete  →  {NLLB_MODEL_DIR}")
    _log.info(f"NLLB model converted: {NLLB_MODEL_DIR}")

    # ── Step 4: Copy the SentencePiece tokenizer ──────────────────────────────
    # HF ships it as sentencepiece.bpe.model; we rename it to the FLORES-200
    # filename the rest of the pipeline expects.
    sp_src = model_tmp / HF_TOKENIZER_FILENAME
    if sp_src.exists():
        NLLB_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(sp_src, NLLB_TOKENIZER)
        ok(f"Tokenizer saved  →  {NLLB_TOKENIZER.name}")
    else:
        # Defensive fallback: different HF revisions have occasionally named
        # this file differently.  Try the common alternates before giving up.
        for alt_name in ("spm.model", "tokenizer.model", "flores200.spm.model"):
            alt_src = model_tmp / alt_name
            if alt_src.exists():
                shutil.copy2(alt_src, NLLB_TOKENIZER)
                ok(f"Tokenizer saved (from {alt_name})  →  {NLLB_TOKENIZER.name}")
                break
        else:
            warn(f"Tokenizer file not found in downloaded model ({HF_TOKENIZER_FILENAME}).")
            info("Find  sentencepiece.bpe.model  or  spm.model  in the HF cache and copy it to:")
            info(f"  {NLLB_TOKENIZER}")

    # Note: the HF cache under model_tmp is left in place so repeated runs
    # don't re-download.  Users who want to reclaim that ~1.2 GB can delete
    # ~/.cache/huggingface/ manually.
    success = NLLB_MODEL_DIR.exists() and NLLB_TOKENIZER.exists()
    if success:
        _log.info("NLLB download complete — model and tokenizer present.")
    else:
        _log.warning("NLLB download finished but model or tokenizer still missing.")
    return success


# @fn _print_nllb_manual_instructions
def _print_nllb_manual_instructions() -> None:
    """Print step-by-step manual download + conversion instructions.
    Shown as a fallback when the automated path fails (e.g. no internet,
    disk full, or HuggingFace rate-limiting)."""
    print()
    print("  ── Manual NLLB setup ─────────────────────────────────────────────")
    print("  1. Make sure the venv is on the nllb tier:")
    print("       python3 build_env.py --tier nllb")
    print()
    print("  2. Convert the HF model to CTranslate2 int8:")
    print(f"       .venv/bin/python3 -m ctranslate2.converters.transformers \\")
    print(f"         --model facebook/nllb-200-distilled-600M \\")
    print(f"         --output_dir {NLLB_MODEL_DIR} \\")
    print(f"         --quantization int8 --force")
    print()
    print("  3. Copy the tokenizer:")
    print("       Find sentencepiece.bpe.model in ~/.cache/huggingface/, then:")
    print(f"       cp <hf_cache>/sentencepiece.bpe.model \\")
    print(f"           {NLLB_TOKENIZER}")
    print()
    print("  Alternatively, download a pre-converted CTranslate2 model from HuggingFace")
    print("  (search for 'nllb-200-distilled-600M ct2 int8') and place the files in:")
    print(f"    {NLLB_DIR}/")
    print("  Expected structure:")
    print("    flores200_sacrebleu_tokenizer_spm.model")
    print("    nllb-200-distilled-600M-int8/")
    print("      config.json")
    print("      model.bin")
    print("      shared_vocabulary.txt")
    print("  ──────────────────────────────────────────────────────────────────")


# @fn write_default_config
def write_default_config() -> bool:
    """Write annotator_config.json with safe built-in defaults."""
    try:
        cfg = dict(DEFAULT_CONFIG)
        cfg["benchmarked"] = str(date.today())
        CONFIG_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
                               encoding="utf-8")
        ok(f"Wrote default config  →  {CONFIG_FILE.name}")
        info("Run  .venv/bin/python3 scripts/corpus_optimize.py  to tune settings for this machine.")
        return True
    except Exception as exc:
        warn(f"Could not write config: {exc}")
        return False



# ── Main orchestrator ───────────────────────────────────────────────────────────

# @fn parse_args
# @fn ensure_workspace
def ensure_workspace() -> None:
    """Create the user's workspace and say where it is.

    Thin wrapper over workspace.py so this file has no second definition of the
    path, v3.14.77 had two, in two files, and they could have drifted."""
    header("Workspace")
    if not _ensure_ws():
        warn(f"Could not create {WORKSPACE}")
        info("The app will still run; it will ask where to save instead.")
        _log.error(f"ensure_workspace failed for {WORKSPACE}")
        return
    ok(f"{WORKSPACE}")
    info("Your corpora, dictionaries and participant records live here.")
    info("The application folder stays separate and holds no data of yours.")
    _say = {"ok": ok, "warn": warn, "info": info, "plain": lambda m: print(f"     {m}")}
    moved = _migrate_ws(PROJECT_ROOT, ask, lambda kind, msg: _say[kind](msg))
    if moved:
        _log.info(f"legacy corpora migrated: {moved}")
    # v3.14.146: the workspace itself moved, ~/LingCoT to ~/LingCoT-Data.
    homed = _migrate_home(ask, lambda kind, msg: _say[kind](msg))
    if homed:
        _log.info(f"workspace migrated from the old location: {homed}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="LingCoT first-time setup and dependency checker.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  .venv/bin/python3 setup.py                        # interactive check\n"
            "  .venv/bin/python3 setup.py --check                # exit 1 if minimal tier broken\n"
            "  .venv/bin/python3 setup.py --check --require-nllb # also require NLLB ready\n"
            "  .venv/bin/python3 setup.py --all                  # fill in everything missing\n"
            "  .venv/bin/python3 setup.py --nllb                 # upgrade to nllb tier + download model\n"
            "  .venv/bin/python3 setup.py --pdf                  # install PDF export packages\n"
        ),
    )
    p.add_argument("--check",        action="store_true",
                   help="Check only — do not download or create anything.  "
                        "By default, optional tiers are treated as warnings, not errors.")
    p.add_argument("--require-nllb", action="store_true",
                   help="Combined with --check: treat missing NLLB packages or "
                        "model files as errors (exit 1).  Use in CI / health scripts "
                        "for deployments that must have offline translation available.")
    p.add_argument("--all",          action="store_true",
                   help="Download and generate all missing components automatically "
                        "(includes upgrading the venv to the nllb tier and downloading the model).")
    p.add_argument("--nllb",         action="store_true",
                   help="Upgrade the venv to the nllb tier if needed, then download and "
                        "convert the NLLB translation model.  ~1.2 GB transient, ~600 MB on disk.")
    p.add_argument("--pdf",          action="store_true",
                   help="Install PDF export packages (fpdf2, python-bidi) into the venv.  "
                        "~5 MB.  Required to use the dictionary PDF export feature.")
    return p.parse_args()


# @fn main
def main() -> int:
    args = parse_args()
    interactive = not any([args.check, args.all, args.nllb, args.pdf])
    _log.info(f"setup.py started — check: {args.check} | nllb: {args.nllb} | "
              f"pdf: {args.pdf} | all: {args.all} | py: {sys.version.split()[0]}")

    print()
    print(_c(BOLD, f"LingCoT v{APP_VERSION} — Setup & Dependency Check"))
    print(f"Application folder: {PROJECT_ROOT}")
    print()

    # First, before any dependency check, it is the step that explains the layout.
    ensure_workspace()

    # Missing items are split by severity:
    #   errors, break the minimal tier; always cause --check to exit 1.
    #   nllb_issues, only fail --check when --require-nllb is set (NLLB is opt-in).
    #   pdf_issues, informational warnings; the app works without PDF export.
    errors:      list[str] = []
    nllb_issues: list[str] = []
    pdf_issues:  list[str] = []

    # ── Venv notice ────────────────────────────────────────────────────────────
    # setup.py re-execs into .venv/ when it exists (see bootstrap at top of file).
    # If we're still on the system Python here.venv/ was not found, which
    # means build_env.py hasn't been run yet.
    venv_present = (PROJECT_ROOT / ".venv" / "bin" / "python").exists()
    if not venv_present:
        warn("Virtual environment (.venv/) not found.")
        info("Run  python3 build_env.py  first.")
        print()
        errors.append(".venv/ missing — run  python3 build_env.py")

    # ── Python version ─────────────────────────────────────────────────────────
    if not check_python():
        print("\nCannot continue with an unsupported Python version.")
        return 1

    # ── NLLB packages (only relevant if the user wants offline translation) ───
    # We always report their status so `setup.py` alone paints a complete
    # picture of what's installed, but missing NLLB packages are only an
    # *error* when the user explicitly wants NLLB (via --require-nllb or
    # when running --nllb / --all).
    nllb_pkg_status = check_nllb_packages()
    nllb_pkgs_complete = nllb_pkg_status["all"]
    if not nllb_pkgs_complete:
        nllb_issues.append(
            "NLLB Python packages missing (install with: python3 build_env.py --tier nllb)"
        )

    # ── NLLB model files on disk ───────────────────────────────────────────────
    nllb_model_status = check_nllb_model()
    nllb_model_complete = nllb_model_status["tokenizer"] and nllb_model_status["model"]
    if not nllb_model_complete:
        nllb_issues.append(
            "NLLB model/tokenizer missing (install with: .venv/bin/python3 setup.py --nllb)"
        )

    # ── PDF export packages (optional, app works without them) ──────────────
    pdf_pkgs_ok = check_pdf_packages()
    if not pdf_pkgs_ok:
        pdf_issues.append(
            "PDF export packages missing (install with: python3 build_env.py --tier pdf)"
        )

    # ── Annotator config (optional, scripts have built-in defaults) ──────────
    cfg_ok = check_config()
    # Intentionally NOT added to `errors`: a missing config is informational only.

    # ── Summary ────────────────────────────────────────────────────────────────
    header("Summary")

    if not errors and not nllb_issues and not pdf_issues and cfg_ok:
        ok("Everything looks good — no action required.")
        _log.info("setup.py check passed — all components present.")
        return 0

    for e in errors:
        missing(e)
    for n in nllb_issues:
        # Nudge as a warning by default; the --require-nllb flag below escalates.
        warn(n)
    for p in pdf_issues:
        warn(p)
    if not cfg_ok:
        warn("annotator_config.json missing (scripts will use built-in defaults)")
    print()

    # ── Check-only mode: decide exit code by severity ─────────────────────────
    if args.check:
        if errors:
            missing("Core components are missing.  Re-run without --check to fix them.")
            _log.error(f"setup.py --check failed: {errors}")
            return 1
        if args.require_nllb and nllb_issues:
            missing("NLLB components are missing and --require-nllb is set.")
            _log.error(f"setup.py --check --require-nllb failed: {nllb_issues}")
            return 1
        ok("Minimal tier is healthy.  (Optional-tier warnings above are informational.)")
        _log.info("setup.py --check passed (minimal tier OK).")
        return 0

    # ── Action phase ───────────────────────────────────────────────────────────

    # PDF packages, small install, no model download needed.
    if not pdf_pkgs_ok:
        if args.pdf or args.all:
            ensure_pdf_packages()
        elif interactive:
            print()
            print("  PDF export packages (fpdf2, python-bidi) are not installed.")
            print("  These are required to export the dictionary as a PDF (~5 MB).")
            if ask("Install PDF export packages now?"):
                ensure_pdf_packages()
            else:
                info("Skipped.  Run  .venv/bin/python3 setup.py --pdf  at any time.")

    # NLLB model, download_nllb() also handles the package tier upgrade.
    if not (nllb_pkgs_complete and nllb_model_complete):
        if args.nllb or args.all:
            download_nllb()
        elif interactive:
            print()
            print("  NLLB offline translation requires additional packages and a model download.")
            print("  Total: ~500 MB of packages + ~1.2 GB transient → ~600 MB on disk.")
            print("  (Skip this step if you only plan to use the Google Translate backend.)")
            if ask("Set up NLLB now?"):
                download_nllb()
            else:
                info("Skipped.  Use  --translator google  to translate without NLLB.")

    # Annotator config
    if not cfg_ok:
        if args.all:
            write_default_config()
        elif interactive:
            print()
            print("  annotator_config.json is missing.")
            print("  Option A: Write default values now (fast, sub-optimal settings).")
            print("  Option B: Run corpus_optimize.py to benchmark this machine (recommended,")
            print("           but requires NLLB packages + model).")
            choice = input("  Enter A or B (or Enter to skip): ").strip().upper()
            if choice == "A":
                write_default_config()
            elif choice == "B":
                subprocess.run([sys.executable,
                                str(SCRIPTS_DIR / "corpus_optimize.py")])

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
