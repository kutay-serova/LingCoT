#!/usr/bin/env python3
# =============================================================================
# Linguistic Corpus Toolkit (LingCoT), build_env.py
# Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# See LICENSE in the project root for the full license text.
# =============================================================================
#
# PURPOSE
#   Creates a self-contained virtual environment (.venv/) at the project root
#   and installs Python dependencies from pyproject.toml.  Once .venv/ exists,
#   all corpus_*.py scripts automatically activate it via an os.execv re-exec
#   at startup, no manual `source .venv/bin/activate` is needed.
#   Uses uv (fast, hash-pinned) if available, falls back to stdlib venv + pip.
#
# DEPENDENCY TIERS
#   minimal (default)
#     Core packages only: ingestion, online translation via Google, HTTP.
#     No ML, no large downloads.  Fast install (~30 MB).
#
#   nllb
#     Everything in "minimal", plus the packages needed to run and convert
#     NLLB-200 offline translation (ctranslate2, sentencepiece, numpy,
#     huggingface_hub, transformers, torch CPU wheel).  Install is ~500 MB.
#     After this, `setup.py --nllb` downloads the ~1.2 GB model and converts
#     it to ~600 MB int8 CTranslate2 weights.
#
#   pdf
#     Everything in "minimal", plus fpdf2 (PDF generation) and python-bidi
#     (Unicode bidi reordering for RTL scripts).  Small install (~5 MB).
#     Enables the dictionary PDF export feature in the desktop app.
#
#   Tiers are re-runnable: starting on minimal and later re-running with
#   --tier nllb or --tier pdf upgrades the existing venv in place.
#
# STRUCTURE
#   find_uv(), locate the uv binary on PATH
#   create_venv_uv(), `uv venv` + `uv sync` (with optional extras)
#   create_venv_pip(), stdlib venv.create() + pip install (fallback)
#   sync_existing_venv(), `uv sync` against an already-built venv (tier upgrade)
#   _parse_deps_from_pyproject(), minimal TOML parser (no tomllib dependency);
#                                  reads [project].dependencies and extras
#   check_venv(), subprocess import tests; scope matches active tier
#   main(), argparse entry point; flags:
#                            --tier, --check, --recreate, --show, --dev
#
# USAGE
#   python3 build_env.py                    # create/update .venv/ (minimal tier)
#   python3 build_env.py --tier nllb        # install with NLLB extras
#   python3 build_env.py --tier pdf         # install with PDF export extras
#   python3 build_env.py --check            # verify environment health
#   python3 build_env.py --check --tier nllb  # also verify NLLB extras
#   python3 build_env.py --recreate         # wipe and rebuild from scratch
#   python3 build_env.py --show             # list installed package versions
# =============================================================================
"""
build_env.py  –  LingCoT Python environment builder

Creates a self-contained virtual environment (.venv/) at the project root and
installs Python dependencies into it from PyPI.  After this script runs, every
corpus_*.py script will automatically use the venv without the user needing to
activate it first (see the "self-activating bootstrap" below).

Dependency tiers
----------------
  minimal  (default)   Ingestion + Google Translate only.
  nllb                 Everything in minimal, plus offline NLLB translation
                       (ctranslate2, sentencepiece, transformers, torch, …).
  pdf                  Everything in minimal, plus PDF export for the dictionary
                       (fpdf2, python-bidi).  Small install (~5 MB).

Upgrading tiers later is safe: re-run with --tier nllb or --tier pdf and
uv/pip will add the new packages without rebuilding from scratch.

Usage
-----
  python3 build_env.py                    # minimal tier (default)
  python3 build_env.py --tier nllb        # install NLLB extras as well
  python3 build_env.py --tier pdf         # install PDF export extras
  python3 build_env.py --check            # verify the venv is healthy
  python3 build_env.py --check --tier nllb  # also verify NLLB extras are installed
  python3 build_env.py --check --tier pdf   # also verify PDF extras are installed
  python3 build_env.py --recreate         # delete .venv and rebuild from scratch
  python3 build_env.py --show             # print venv path + package versions

After the first run, scripts self-activate the venv automatically, no need
to run  source .venv/bin/activate  or prefix commands with .venv/bin/python.

Self-activating bootstrap (how it works)
-----------------------------------------
Each corpus_*.py script starts with a shim at the top:

    _ROOT    = Path(__file__).parent.parent
    _VENV_PY = _ROOT / '.venv' / 'bin' / 'python'
    if _VENV_PY.exists() and Path(sys.prefix) != _ROOT / '.venv':
        os.execv(str(_VENV_PY), [str(_VENV_PY)] + sys.argv)

If .venv/ exists and the script isn't already running inside it, it re-execs
itself with the venv Python, same process slot, same PID, no performance cost.
Uses sys.prefix (not sys.executable) to detect venv activation reliably even
when the venv Python is a symlink to the system binary.
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

# ── Paths ───────────────────────────────────────────────────────────────────────
PROJECT_ROOT  = Path(__file__).resolve().parent.parent  # source/ → project root

# ── Logging ───────────────────────────────────────────────────────────────────
# Append-mode: all build_env runs accumulate in one logs/setup.log file so the
# full install history is visible in a single place.  Import after PROJECT_ROOT
# is set so the logs/ directory lands at project root.
sys.path.insert(0, str(Path(__file__).parent))  # ensure source/ is importable
from log_setup import setup_append_logger as _setup_log
_log = _setup_log(PROJECT_ROOT, filename='setup.log', logger_name='build_env')

# Where the user's corpora live, outside PROJECT_ROOT. build_env.py is what
# setup.command / setup.bat actually run, so this is the entry point that must
# create the workspace. (v3.14.77 put it in setup.py, which those scripts never
# invoke; the step silently never ran. See workspace.py.)
from version import __version__ as APP_VERSION
from workspace import (WORKSPACE, CORPORA_DIR, ensure_workspace as _ensure_ws,
                       migrate_legacy_corpora as _migrate_ws,
                       migrate_workspace as _migrate_home)
VENV_DIR      = PROJECT_ROOT / ".venv"
# Windows uses Scripts\python.exe; macOS/Linux uses bin/python
if sys.platform == "win32":
    VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
    VENV_PIP    = VENV_DIR / "Scripts" / "pip.exe"
else:
    VENV_PYTHON = VENV_DIR / "bin" / "python"
    VENV_PIP    = VENV_DIR / "bin" / "pip"
PYPROJECT     = PROJECT_ROOT / "pyproject.toml"


# ── ANSI helpers ────────────────────────────────────────────────────────────────
# @fn _c
def _c(code: str, text: str) -> str:
    return (code + text + "\033[0m") if sys.stdout.isatty() else text

BOLD   = "\033[1m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"

# @fn header
def header(msg: str)  -> None: print(f"\n{_c(BOLD, '── ' + msg + ' ──')}")
# @fn ok
def ok(msg: str)      -> None: print(f"  {_c(GREEN,  '✓')}  {msg}")
# @fn warn
def warn(msg: str)    -> None: print(f"  {_c(YELLOW, '!')}  {msg}")
# @fn fail
def fail(msg: str)    -> None: print(f"  {_c(RED,    '✗')}  {msg}")
# @fn info
def info(msg: str)    -> None: print(f"     {_c(CYAN, '→')} {msg}")

# @fn _prompt_yes_no
def _prompt_yes_no(prompt: str) -> bool:
    """Ask a yes/no question; True for yes. Defaults to NO on a closed stdin, an unattended run must never move a user's fieldwork unasked."""
    while True:
        try:
            reply = input(f"     {prompt} [y/n] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return False
        if reply in ("y", "yes"): return True
        if reply in ("n", "no"):  return False
        print("     Please answer y or n.")


# ── Tool detection ──────────────────────────────────────────────────────────────

# @fn find_uv
def find_uv() -> str | None:
    """Return the path to uv if available, else None."""
    return shutil.which("uv")


# @fn find_pip
def find_pip() -> str | None:
    """Return the path to the system pip3 / pip if available."""
    return shutil.which("pip3") or shutil.which("pip")


# ── Tier names ──────────────────────────────────────────────────────────────────
# "minimal" is pseudo, it installs only the [project].dependencies block, no
# extras.  "nllb" installs the [project.optional-dependencies].nllb extra.
# "pdf"  installs the [project.optional-dependencies].pdf extra (fpdf2 + python-bidi).
# Tiers are additive: --tier pdf gives minimal + pdf packages.
TIER_MINIMAL = "minimal"
TIER_NLLB    = "nllb"
TIER_PDF     = "pdf"
VALID_TIERS  = (TIER_MINIMAL, TIER_NLLB, TIER_PDF)


# ── Environment creation ────────────────────────────────────────────────────────

# @fn _uv_sync_cmd
# Marker packages: importable module names that prove an extra is installed.
# Chosen as the ones with no other source, `torch` also arrives with nllb, but
# ctranslate2 is unambiguous.
EXTRA_MARKERS = {
    TIER_NLLB: ("ctranslate2", "sentencepiece"),
    TIER_PDF:  ("fpdf", "bidi"),
}


# @fn detect_installed_extras
def detect_installed_extras() -> set:
    """Which optional extras are already present in the venv.

    `uv sync` is EXACT by default: it removes anything outside the resolved set
    for the extras it is given. setup.command runs this file with no --tier, so
    it defaulted to minimal and silently deleted the user's nllb and pdf packages, offline translation and PDF export both stopped working while their 601 MB
    model sat on disk (B-025). Detecting what is installed and preserving it is
    the difference between "setup" and "reset"."""
    sp = _site_packages_dir()
    if sp is None:
        return set()
    found = set()
    for extra, markers in EXTRA_MARKERS.items():
        if any((sp / m).exists() or list(sp.glob(f"{m}-*.dist-info")) or
               list(sp.glob(f"{m}.*")) for m in markers):
            found.add(extra)
    return found


# @fn _site_packages_dir
def _site_packages_dir():
    """The venv's site-packages, or None if there is no venv yet."""
    if not VENV_DIR.exists():
        return None
    for pat in ("lib/python*/site-packages", "Lib/site-packages"):
        hits = sorted(VENV_DIR.glob(pat))
        if hits:
            return hits[-1]
    return None


# @fn _uv_sync_cmd
def _uv_sync_cmd(uv: str, tier: str, dev: bool, extras=None) -> list[str]:
    """
    Build the `uv sync` command for the requested tier PLUS anything already
    installed. Centralised so both the fresh-create and upgrade-existing paths
    stay in sync.

    `--inexact` is deliberate and load-bearing: without it, syncing to one extra
    removes every other. The tiers are not mutually exclusive in practice, a
    user can legitimately want offline translation and PDF export at once, and
    a re-run of setup must never take away what a previous run installed.
    """
    cmd = [uv, "sync", "--no-dev", "--inexact"]
    wanted = set(extras or ())
    if tier in (TIER_NLLB, TIER_PDF):
        wanted.add(tier)
    for extra in sorted(wanted):
        cmd += ["--extra", extra]
    # Dev tools are orthogonal to the tier, flip them back on if requested.
    if dev:
        # --dev negates the earlier --no-dev; leave --no-dev in front for
        # explicitness, uv tolerates later flags overriding earlier ones.
        cmd += ["--dev"]
    return cmd


# @fn create_venv_uv
def create_venv_uv(uv: str, tier: str, dev: bool = False) -> bool:
    """
    Create .venv/ with uv and install the requested tier from pyproject.toml.

    uv is much faster than pip (typically 10–100×) and produces uv.lock,
    a hash-pinned lockfile that guarantees reproducible installs on any machine.
    """
    print(f"  Using:  uv  ({uv})")
    print(f"  Tier:   {tier}")

    # uv venv, create the virtual environment using the current Python
    result = subprocess.run(
        [uv, "venv", str(VENV_DIR), "--python", sys.executable],
        cwd=str(PROJECT_ROOT),
    )
    if result.returncode != 0:
        fail("uv venv failed.")
        return False
    ok(f"Virtual environment created at  {VENV_DIR}/")

    # Sync packages for the requested tier (and optionally dev extras)
    sync_cmd = _uv_sync_cmd(uv, tier, dev)

    print()
    print("  Installing packages (uv resolves and locks all versions) …")
    print("  First run downloads wheels from PyPI — subsequent runs use the cache.")
    if tier == TIER_NLLB:
        # Heads-up so the user knows this is the ~500 MB path, not ~30 MB.
        print("  Note: NLLB tier includes torch CPU wheel (~200 MB) and transformers.")
    print()
    result = subprocess.run(sync_cmd, cwd=str(PROJECT_ROOT))
    if result.returncode != 0:
        fail("uv sync failed.")
        return False

    ok("All packages installed and locked in  uv.lock")
    return True


# @fn create_venv_pip
def create_venv_pip(tier: str, dev: bool = False) -> bool:
    """
    Create .venv/ with the stdlib venv module and install packages with pip.
    Slower than uv but requires no extra tools, used when uv is unavailable.
    """
    print("  (uv not found — falling back to venv + pip)")
    print(f"  Tier:   {tier}")

    # Create venv
    result = subprocess.run(
        [sys.executable, "-m", "venv", str(VENV_DIR)],
        cwd=str(PROJECT_ROOT),
    )
    if result.returncode != 0:
        fail("python -m venv failed.")
        return False
    ok(f"Virtual environment created at  {VENV_DIR}/")

    # Upgrade pip inside the venv first for fewer install quirks
    subprocess.run([str(VENV_PYTHON), "-m", "pip", "install", "--quiet", "--upgrade", "pip"])

    # Parse dependencies from pyproject.toml
    core_deps, extra_map = _parse_deps_from_pyproject()
    if not core_deps:
        fail("Could not parse core dependencies from pyproject.toml.")
        return False

    # Build the list of packages to install
    deps = list(core_deps)
    if tier == TIER_NLLB:
        nllb_extras = extra_map.get("nllb", [])
        if not nllb_extras:
            fail("pyproject.toml has no [project.optional-dependencies].nllb extra.")
            return False
        deps += nllb_extras
    if dev:
        deps += extra_map.get("dev", [])

    print()
    print(f"  Installing {len(deps)} packages with pip …")
    if tier == TIER_NLLB:
        # Without uv's pytorch-cpu index, pip will download the default torch
        # wheel, which on Linux pulls CUDA libs (~2 GB).  Warn the user so
        # they can install uv first and avoid the huge download.
        warn("pip fallback cannot use the CPU-only torch index configured in "
             "pyproject.toml.  On Linux this may download a ~2 GB CUDA-enabled "
             "torch wheel instead of the ~200 MB CPU wheel.")
        info("Install uv first for the fast / small install path:")
        info("  curl -LsSf https://astral.sh/uv/install.sh | sh")
    print()

    if deps:
        result = subprocess.run(
            [str(VENV_PIP), "install", "--quiet"] + deps,
            cwd=str(PROJECT_ROOT),
        )
        if result.returncode != 0:
            fail("pip install of packages failed.")
            return False

    ok("All packages installed.")
    warn("No lockfile generated.  Consider installing uv for reproducible installs.")
    return True


# @fn sync_existing_venv
def sync_existing_venv(tier: str, dev: bool = False) -> bool:
    """
    The venv already exists, add or update packages to match the requested tier.
    Used by both the default "re-run" path and the external upgrade-from-setup.py
    path (minimal → nllb).
    Returns True on success.
    """
    uv = find_uv()
    # Preserve what is already installed. Without this, `setup.command` (which
    # passes no --tier, so tier=minimal) strips the user's nllb and pdf packages
    # on every run. B-025.
    keep = detect_installed_extras()
    if keep:
        info(f"Preserving already-installed extras: {', '.join(sorted(keep))}")
    if uv:
        # Preferred path: uv sync honours the extras flag and installs only the
        # delta, which is fast even on a minimal → nllb upgrade.
        sync_cmd = _uv_sync_cmd(uv, tier, dev, extras=keep)
        result = subprocess.run(sync_cmd, cwd=str(PROJECT_ROOT))
        if result.returncode != 0:
            fail("uv sync failed.")
            return False
        ok("Packages synced.")
        return True

    # Fallback: no uv available, so hand-install the nllb extras with pip.
    # (For the minimal tier there's nothing to do on re-run.)
    if tier == TIER_MINIMAL:
        warn("uv not found — nothing to sync at the minimal tier.")
        info("To force a full rebuild from pyproject.toml, run --recreate.")
        return True

    # Tier == nllb: pip-install the nllb extras into the existing venv.
    core_deps, extra_map = _parse_deps_from_pyproject()
    nllb_extras = extra_map.get("nllb", [])
    if not nllb_extras:
        fail("pyproject.toml has no [project.optional-dependencies].nllb extra.")
        return False

    print()
    print(f"  Adding {len(nllb_extras)} NLLB package(s) to existing venv with pip …")
    warn("pip fallback cannot use the CPU-only torch index — on Linux this may "
         "pull a ~2 GB CUDA torch wheel.  Install uv to avoid this.")
    print()
    result = subprocess.run(
        [str(VENV_PIP), "install", "--quiet"] + nllb_extras,
        cwd=str(PROJECT_ROOT),
    )
    if result.returncode != 0:
        fail("pip install of NLLB extras failed.")
        return False
    ok("NLLB extras installed.")
    return True


# @fn _parse_deps_from_pyproject
def _parse_deps_from_pyproject() -> tuple[list[str], dict[str, list[str]]]:
    """
    Minimal TOML parser for the [project] dependencies and optional-dependencies.
    Avoids depending on tomllib (Python 3.11+ only).

    Returns a tuple of:
      core_deps, list of dependency strings from [project].dependencies
      extra_map, dict mapping extra name → list of dependency strings
                   (e.g. {"spacy": [..], "stanza": [..], "full": [..], "dev": [..]})
    """
    if not PYPROJECT.exists():
        return [], {}

    text = PYPROJECT.read_text(encoding="utf-8")
    lines = text.splitlines()

    core_deps: list[str] = []
    extra_map: dict[str, list[str]] = {}

    # ── Parse [project].dependencies ──────────────────────────────────────────
    in_core = False
    for line in lines:
        stripped = line.strip()
        if stripped == "dependencies = [":
            in_core = True
            continue
        if in_core:
            if stripped == "]":
                break
            dep = stripped.split("#")[0].strip().strip('",').strip("'")
            if dep:
                core_deps.append(dep)

    # ── Parse [project.optional-dependencies] extras ───────────────────────────
    in_optional_section = False
    current_extra: str | None = None
    in_extra_list = False

    for line in lines:
        stripped = line.strip()

        # Detect the optional-dependencies section header
        if stripped == "[project.optional-dependencies]":
            in_optional_section = True
            continue

        # Stop at the next [] section header (other than optional-dependencies)
        if in_optional_section and stripped.startswith("[") and not stripped.startswith("[project.optional-dependencies]"):
            if not stripped.startswith("[tool"):
                in_optional_section = False
                current_extra = None
                in_extra_list = False
            continue

        if not in_optional_section:
            continue

        # Detect "extra_name = [" lines
        if not in_extra_list and "= [" in stripped:
            name = stripped.split("=")[0].strip()
            current_extra = name
            extra_map[name] = []
            if stripped.endswith("]"):
                # Single-line empty list: extra_name = []
                in_extra_list = False
                current_extra = None
            else:
                in_extra_list = True
            continue

        # Collect items inside a multi-line list
        if in_extra_list and current_extra is not None:
            if stripped == "]":
                in_extra_list = False
                current_extra = None
                continue
            dep = stripped.split("#")[0].strip().strip('",').strip("'")
            if dep:
                extra_map[current_extra].append(dep)

    return core_deps, extra_map


# ── Health check ────────────────────────────────────────────────────────────────

# Packages that must be present for the minimal tier to work.
_CORE_CHECKS = [
    ("ebooklib",       "EPUB ingestion"),
    ("bs4",            "BeautifulSoup HTML parsing"),
    ("lxml",           "XML/HTML parser"),
    ("deep_translator","Google Translate backend"),
    ("requests",       "HTTP client"),
    ("tqdm",           "progress bars"),
]

# Additional packages expected in the NLLB tier.
# Split into "runtime" (needed to RUN NLLB-200) and "conversion" (needed only
# to download + convert the model once via setup.py --nllb).  We check both
# because both are installed together by the nllb extra.
_NLLB_RUNTIME_CHECKS = [
    ("ctranslate2",   "NLLB inference engine"),
    ("sentencepiece", "NLLB tokeniser"),
    ("numpy",         "numerical"),
]
_NLLB_CONVERT_CHECKS = [
    ("huggingface_hub", "HF model downloader"),
    ("transformers",    "HF model loader (one-time for conversion)"),
    ("torch",           "required by transformers for .bin loading"),
]

# PDF-tier packages: fpdf2 is imported as "fpdf" (the package exposes that name);
# python-bidi is imported as "bidi".
_PDF_CHECKS = [
    ("fpdf",  "PDF generation (fpdf2)"),
    ("bidi",  "Unicode bidi reordering for RTL scripts (python-bidi)"),
]


# @fn _import_check
def _import_check(pkg: str, desc: str) -> bool:
    """Run `python -c 'import <pkg>'` inside the venv; print status + version."""
    result = subprocess.run(
        [str(VENV_PYTHON), "-c",
         f"import {pkg}; print({pkg}.__version__ if hasattr({pkg}, '__version__') else 'ok')"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        ok(f"{pkg} {result.stdout.strip()}  ({desc})")
        return True
    # Surface the last meaningful stderr line as the hint rather than a full traceback.
    err = result.stderr.strip().splitlines()
    hint = next((l for l in reversed(err) if l and not l.startswith(" ")), "ImportError")
    fail(f"{pkg}  ({desc}) — {hint}")
    return False


# @fn check_venv
def check_venv(tier: str = TIER_MINIMAL) -> bool:
    """
    Verify that the venv exists and the packages for the requested tier are
    all importable.  Returns True if everything is healthy.

    Passing tier="minimal" checks only the core packages.
    Passing tier="nllb" additionally checks the NLLB runtime + conversion deps.
    Passing tier="pdf"  additionally checks fpdf2 + python-bidi.
    """
    header(f"Venv health check  (tier: {tier})")

    if not VENV_PYTHON.exists():
        fail(f".venv/ not found at  {VENV_DIR}")
        info("Run  python3 build_env.py  to create it.")
        return False
    ok(f"Venv python:  {VENV_PYTHON}")

    all_ok = True
    print()
    print(_c(BOLD, "  Core packages:"))
    for pkg, desc in _CORE_CHECKS:
        if not _import_check(pkg, desc):
            all_ok = False

    if tier == TIER_NLLB:
        print()
        print(_c(BOLD, "  NLLB runtime packages:"))
        for pkg, desc in _NLLB_RUNTIME_CHECKS:
            if not _import_check(pkg, desc):
                all_ok = False
        print()
        print(_c(BOLD, "  NLLB conversion packages:"))
        for pkg, desc in _NLLB_CONVERT_CHECKS:
            if not _import_check(pkg, desc):
                all_ok = False

    if tier == TIER_PDF:
        print()
        print(_c(BOLD, "  PDF export packages:"))
        for pkg, desc in _PDF_CHECKS:
            if not _import_check(pkg, desc):
                all_ok = False

    return all_ok


# @fn show_venv
def show_venv() -> None:
    """Print a summary of the venv: path, Python version, every known package."""
    header("Environment summary")
    if not VENV_PYTHON.exists():
        fail("No .venv/ found.")
        return

    result = subprocess.run(
        [str(VENV_PYTHON), "--version"], capture_output=True, text=True
    )
    ok(f"Python:   {result.stdout.strip()}   ({VENV_PYTHON})")

    # Show every package from every tier; packages that aren't installed print
    # "not installed" so the user can see at a glance which tier is active.
    sections = [
        ("Core (minimal tier)",         _CORE_CHECKS),
        ("NLLB runtime (nllb tier)",    _NLLB_RUNTIME_CHECKS),
        ("NLLB conversion (nllb tier)", _NLLB_CONVERT_CHECKS),
        ("PDF export (pdf tier)",       _PDF_CHECKS),
    ]
    # beautifulsoup4 is imported as "bs4" but listed as "beautifulsoup4" in PyPI
    display_names = {"bs4": "beautifulsoup4", "huggingface_hub": "huggingface-hub"}

    for title, checks in sections:
        print(f"\n  {title}:")
        for pkg, _desc in checks:
            r = subprocess.run(
                [str(VENV_PYTHON), "-c", f"import {pkg}; print({pkg}.__version__)"],
                capture_output=True, text=True,
            )
            ver = r.stdout.strip() if r.returncode == 0 else "not installed"
            display = display_names.get(pkg, pkg)
            marker = "  " if r.returncode == 0 else "  -"
            print(f" {marker} {display:<22} {ver}")

    print(f"\n  Lockfile: {'uv.lock exists ✓' if (PROJECT_ROOT / 'uv.lock').exists() else 'no uv.lock (pip install used)'}")


# ── Main ────────────────────────────────────────────────────────────────────────

# @fn parse_args
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Create and validate the LingCoT Python virtual environment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 build_env.py                      # minimal tier (default)\n"
            "  python3 build_env.py --tier nllb          # install NLLB extras too\n"
            "  python3 build_env.py --tier pdf           # install PDF export extras\n"
            "  python3 build_env.py --check              # verify existing venv\n"
            "  python3 build_env.py --check --tier nllb  # also verify NLLB extras\n"
            "  python3 build_env.py --check --tier pdf   # also verify PDF extras\n"
            "  python3 build_env.py --recreate           # wipe and rebuild from scratch\n"
            "  python3 build_env.py --show               # print installed package versions\n"
            "\n"
            "Tiers:\n"
            "  minimal  Ingestion + Google Translate only (~30 MB)\n"
            "  nllb     Adds offline NLLB translation deps (~500 MB; plus\n"
            "           `setup.py --nllb` to download the ~600 MB model)\n"
            "  pdf      Adds PDF export deps: fpdf2 + python-bidi (~5 MB)\n"
            "\n"
            "Upgrade path:  run again with --tier nllb to add NLLB packages\n"
            "to an existing minimal install without rebuilding from scratch.\n"
        ),
    )
    p.add_argument("--tier",     default=TIER_MINIMAL, choices=list(VALID_TIERS),
                   help=f"Dependency tier to install.  Default: {TIER_MINIMAL}.")
    p.add_argument("--check",    action="store_true",
                   help="Check the venv health only — no changes made.  "
                        "Combine with --tier nllb to also verify NLLB extras.")
    p.add_argument("--recreate", action="store_true",
                   help="Delete .venv/ and rebuild it from scratch.")
    p.add_argument("--show",     action="store_true",
                   help="Print a summary of the venv and installed versions.")
    p.add_argument("--dev",      action="store_true",
                   help="Also install dev extras (pytest, mypy).")
    return p.parse_args()


# @fn main
def main() -> int:
    args = parse_args()
    _log.info(f"build_env started — tier: {args.tier} | recreate: {args.recreate} | "
              f"check: {args.check} | py: {sys.version.split()[0]}")

    print()
    print(_c(BOLD, f"LingCoT v{APP_VERSION} — Environment Builder"))
    print(f"Project root:  {PROJECT_ROOT}")
    print(f"Target venv:   {VENV_DIR}")
    print(f"Target tier:   {args.tier}")
    print()

    # ── Workspace ───────────────────────────────────────────────────────────────
    # MUST run before any branch below can return. v3.14.78 put this at the END of
    # main(), which is only reached when a venv is created FRESH, every re-run on
    # an existing install took the "venv already exists" branch and returned early,
    # so the step never ran for anyone already installed (B-023).
    #
    # Creating the folder is silent and idempotent. The migration only speaks when
    # there is something to move, and is skipped in the read-only query modes:
    # --check and --show answer a question, they do not move a user's fieldwork.
    header("Workspace")
    if _ensure_ws():
        ok(f"{WORKSPACE}")
        info("Your corpora, dictionaries and participant records live here —")
        info("outside this application folder, which is a public code repository.")
    else:
        warn(f"Could not create {WORKSPACE}")
        info("The app will still run; it will ask where to save instead.")
        _log.error(f"ensure_workspace failed for {WORKSPACE}")
    if not (args.check or args.show):
        _say = {"ok": ok, "warn": warn, "info": info,
                "plain": lambda m: print(f"     {m}")}
        _moved = _migrate_ws(PROJECT_ROOT, _prompt_yes_no,
                             lambda kind, msg: _say[kind](msg))
        if _moved:
            _log.info(f"legacy corpora migrated: {_moved}")
        # v3.14.146: the workspace itself moved, ~/LingCoT to ~/LingCoT-Data.
        _homed = _migrate_home(_prompt_yes_no, lambda kind, msg: _say[kind](msg))
        if _homed:
            _log.info(f"workspace migrated from the old location: {_homed}")
    print()

    # ── Show mode ───────────────────────────────────────────────────────────────
    if args.show:
        show_venv()
        return 0

    # ── Check mode ──────────────────────────────────────────────────────────────
    if args.check:
        # Scope the check to the requested tier, a minimal install is "healthy"
        # even without NLLB packages, so don't falsely flag them missing.
        ok_flag = check_venv(tier=args.tier)
        return 0 if ok_flag else 1

    # ── Recreate: remove existing venv ──────────────────────────────────────────
    if args.recreate and VENV_DIR.exists():
        header("Removing existing venv")
        shutil.rmtree(VENV_DIR)
        ok(f"Removed  {VENV_DIR}/")

    # ── Already exists and not recreating: sync / tier-upgrade in place ────────
    if VENV_DIR.exists() and not args.recreate:
        header(f"Venv already exists — syncing to tier: {args.tier}")
        if not sync_existing_venv(tier=args.tier, dev=args.dev):
            return 1
        print()
        header("Verifying installation")
        if check_venv(tier=args.tier):
            print()
            print(_c(GREEN, "  Environment is on tier: " + args.tier))
            if args.tier == TIER_NLLB:
                print()
                print("  Next step:  .venv/bin/python3 setup.py --nllb")
                print("              (downloads + converts the NLLB-200 model)")
        return 0

    # ── Create fresh venv ───────────────────────────────────────────────────────
    if not PYPROJECT.exists():
        fail(f"pyproject.toml not found at  {PYPROJECT}")
        info("Make sure you are running this script from the project root.")
        return 1

    header("Creating virtual environment")

    uv = find_uv()
    if uv:
        success = create_venv_uv(uv, tier=args.tier, dev=args.dev)
    else:
        warn("uv not found — using venv + pip (slower, no lockfile).")
        info("Install uv for faster, reproducible installs:")
        info("  curl -LsSf https://astral.sh/uv/install.sh | sh")
        success = create_venv_pip(tier=args.tier, dev=args.dev)

    if not success:
        fail("Environment creation failed.")
        _log.error(f"Venv creation failed for tier: {args.tier}")
        return 1

    print()
    header("Verifying installation")
    ok_flag = check_venv(tier=args.tier)

    print()
    if ok_flag:
        _log.info(f"build_env complete — tier: {args.tier} OK")
        print(_c(GREEN, f"  Environment ready  (tier: {args.tier})."))

        print()
        print("  All corpus_*.py scripts now self-activate this venv automatically.")
        print("  You can also activate it manually with:")
        print(f"    source {VENV_DIR}/bin/activate")
        print()
        if args.tier == TIER_MINIMAL:
            print("  Next step:  use Google Translate backend out of the box:")
            print("    .venv/bin/python3 scripts/corpus_annotate.py <corpus> --translate --translator google")
            print()
            print("  To add offline NLLB later, run:")
            print("    python3 build_env.py --tier nllb")
            print("    .venv/bin/python3 setup.py --nllb")
        else:
            print("  Next step:  download the NLLB-200 model")
            print("    .venv/bin/python3 setup.py --nllb   # ~1.2 GB transient → ~600 MB on disk")
    else:
        fail("Some packages failed to install.  Check the errors above.")
        _log.error(f"Some packages failed to install for tier: {args.tier}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
