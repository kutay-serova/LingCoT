# LingCoT: Setup & Running

**Updated:** 2026-10-28 · **Version:** v3.16.3

---

## Requirements

| | Minimum | Notes |
|---|---|---|
| **macOS** | 11 Big Sur, Apple Silicon or Intel | tested on 14 and 26 |
| **Windows** | 10 or 11, 64-bit | preview, first tester run in v3.16.2; use Python 3.13 or earlier |
| **Linux** | 64-bit; GTK with WebKit2GTK, or Qt | not supported in this build (B-224) |
| **Python** | 3.9 or later, 64-bit | [python.org/downloads](https://www.python.org/downloads/) |
| **Disk** | about 250 MB | plus your corpora |
| **Offline translation (NLLB)** | Apple Silicon Mac, or 64-bit Windows or Linux (glibc 2.28+) | about 1.1 GB more on disk, 1.2 GB download; 4 GB RAM or more recommended. Not available on Intel Macs yet; online translation works there |

Setup checks these before it installs anything and says which one is not met.

On Windows, check **"Add Python to PATH"** when installing Python. On macOS, check
the version with `python3 --version`; older macOS versions can come with 3.8.

---

## First-time setup

Run once. Creates `.venv/` in the project folder and installs all dependencies (desktop app + corpus scripts).

**macOS:**
```
double-click setup.command
```
If macOS says it cannot check the file for malicious software, which is usual
for a downloaded zip:

- macOS 14 and earlier: right-click `setup.command` → **Open** → **Open**.
- macOS 15 and later: try to open it once, then go to **System Settings →
  Privacy & Security** and click **Open Anyway**.

Only `setup.command` needs this. Setup clears the download flag on the rest of
the folder and then creates `LingCoT.app`, which macOS does not block because it
was made on your Mac.

**Windows:**
```
double-click setup.bat
```
Extract the zip first (right-click → **Extract All…**). Each `.bat` file shows a
warning the first time: *Windows protected your PC* → **More info** → **Run
anyway**. Use Python 3.13 or earlier for now: pywebview's Windows backend
(pythonnet 3.0.5) supports Python up to 3.13. Step by step:
[TESTERS.md, Tutorial 3](TESTERS.md#3-windows-preview-set-up-and-open).

**Linux:** not supported in the current tester build (B-224). Setup completes, but
the app does not open: pywebview needs Qt or GTK, and setup installs neither.
What made it run on Ubuntu 24.04:
```bash
.venv/bin/pip install "pywebview[qt]"     # about 530 MB
sudo apt install libxcb-cursor0
```
With Qt, messages in pop-up dialogs show `\n` and quotation marks (B-225).

Setup installs the **minimal tier**: pywebview (desktop app), ingestion libraries (TXT/EPUB), and online translation via Google Translate, and PDF dictionary export. Offline NLLB translation is a separate tier, see below.

Setup also creates your **workspace** at `~/LingCoT-Data/`, and tells you where it is.

---

## Where your corpora go

`~/LingCoT-Data/corpora/`, **outside this folder**, deliberately. The application
folder is a public code repository; your corpora are not.

Two things follow:

- **Back up `~/LingCoT-Data/`.** Copying the application folder will not save your work.
- Set `LINGCOT_WORKSPACE` before launching to put it somewhere else, a shared
  drive, or an encrypted volume.

If an older version left corpora inside the application folder, setup offers to
move them the next time you run it.

---

## Launching the app

**macOS:** double-click `LingCoT.app` (no Terminal window). `LingCoT.command`
also works and shows the app's output in Terminal.
**Windows:** double-click `LingCoT.bat`. A console window stays open while the
app runs; if the app stops with an error, it is shown there and written to
`logs\launcher_stderr.log`.

The app opens as a native window. No browser needed.

---

## Offline NLLB translation (optional)

Adds local neural machine translation using NLLB-200. Run after setup is complete.

**What it downloads:** ~1.2 GB (cached in `~/.cache/huggingface/`) → converts to ~600 MB model in `source/models/nllb/`. Also installs ~500 MB of additional packages (ctranslate2, sentencepiece, torch CPU wheel).

**macOS:**
```
double-click setup_NLLB.command
```

**Windows:**
```
double-click setup_NLLB.bat
```

This does three things in sequence:
1. Upgrades `.venv/` to the NLLB tier (adds packages on top of the existing venv, no rebuild)
2. Downloads and converts the NLLB-200-distilled-600M model
3. Benchmarks your CPU and writes `source/config/annotator_config.json` with optimal thread settings

After running, NLLB is available in both the app (via the local translation server) and the corpus annotation scripts.

**To start the in-app translation server:**
```bash
.venv/bin/python3 source/scripts/corpus_annotate.py --serve --port 5001   # macOS/Linux
.venv\Scripts\python.exe source\scripts\corpus_annotate.py --serve --port 5001  # Windows
```

---

## Corpus scripts (advanced)

The scripts handle bulk ingestion and translation. They self-activate `.venv/` automatically, no manual activation needed.

```bash
# Ingest a text or EPUB into the corpus format.
# Writes ~/LingCoT-Data/corpora/my_title/my_title_corpus.jsonl
.venv/bin/python3 source/scripts/corpus_ingest.py input.txt --title "My Title" --language tur

# Translate with Google Translate
.venv/bin/python3 source/scripts/corpus_annotate.py ~/LingCoT-Data/corpora/my_title/my_title_corpus.jsonl \
    --translate --translator google --source-lang tur

# Translate offline with NLLB (requires NLLB setup)
.venv/bin/python3 source/scripts/corpus_annotate.py ~/LingCoT-Data/corpora/my_title/my_title_corpus.jsonl \
    --translate --translator nllb --source-lang tur
```

See `README.md` for full flag reference.

---

## PDF dictionary export

Part of the base install since v3.16.3: setup installs `fpdf2` and `python-bidi`
(right-to-left scripts). If **Export PDF** says PDF export is not installed, run
setup again. `--tier pdf` is still accepted and does the same as plain setup.

---

## Verifying your environment

```bash
python3 source/build_env.py --check              # verify minimal tier
python3 source/build_env.py --check --tier nllb  # also verify NLLB packages
.venv/bin/python3 source/setup.py --check --require-nllb  # also verify model files
```

To rebuild from scratch:
```bash
python3 source/build_env.py --recreate
```

---

## File reference

| File | Purpose |
|---|---|
| `setup.command` | **macOS.** first-time setup (minimal tier) |
| `setup.bat` | **Windows.** first-time setup (minimal tier) |
| `setup_NLLB.command` | **macOS.** add offline NLLB translation |
| `setup_NLLB.bat` | **Windows.** add offline NLLB translation |
| `LingCoT.app` | **macOS.** launch the desktop app; built by `setup.command` |
| `LingCoT.command` | **macOS.** launch the desktop app with a Terminal window |
| `LingCoT.bat` | **Windows.** launch the desktop app; errors to `logs\launcher_stderr.log` |
| `pyproject.toml` | Dependency specification |
| `uv.lock` | Locked dependency versions (used by build_env.py when uv is available) |
| `source/LingCoT.pyw` | App entry point (opened by launchers) |
| `source/LingCoT.html` | The app itself |
| `source/build_env.py` | Python environment builder (called by setup scripts) |
| `source/setup.py` | NLLB model downloader (called by setup_NLLB scripts) |
| `source/scripts/` | Corpus annotation, ingestion, and optimization scripts |
| `source/models/nllb/` | NLLB-200 model weights (downloaded by setup_NLLB) |
| `source/resources/` | Reference data files (language codes, Leipzig glosses) |
| `source/config/annotator_config.json` | Machine-specific NLLB tuning (written by corpus_optimize.py) |
| `source/version.py` | The application version, reported in logs and the help panel |
| `source/workspace.py` | Where your corpora live; one definition, shared by app and scripts |
| `samples/` | Test corpora shipped with the app |
| `logs/` | One log per run |
| `~/LingCoT-Data/` | **Your workspace, corpora, dictionaries, participants. Not in this folder.** |

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'webview'`**
Run setup again. pywebview is now part of the standard minimal tier; it should be installed automatically.

**`setup.command` won't open on macOS**
See [First-time setup](#first-time-setup): right-click → Open on macOS 14 and
earlier, **Open Anyway** in Privacy & Security on macOS 15 and later.

**`LingCoT.app` is missing or says the folder was not found**
Run `setup.command` again. The app records where the LingCoT folder is, so it
has to be rebuilt after the folder is moved.

**App window is blank or shows an error**
Check that `source/LingCoT.html` and `source/LingCoT.pyw` are both present. Launch from terminal to see error output:
```bash
.venv/bin/python source/LingCoT.pyw
```

**NLLB download fails or is interrupted**
Re-run `setup_NLLB.command` / `setup_NLLB.bat`. HuggingFace Hub resumes partial downloads automatically.

**Setup stops with "system requirement not met"**
The message names the requirement; see [Requirements](#requirements). On an Intel
Mac this is expected for `setup_NLLB.command`: offline translation is not
available there yet, and online translation is.

**`source/build_env.py` fails on the NLLB tier (torch)**
Use `setup_NLLB.command` instead of running build_env.py directly. It handles the tier upgrade and model download in the correct order.

**Offline translation or PDF export stopped working after running setup**
Fixed in v3.14.81. `uv sync` removes anything outside the tier it is given, so
earlier versions uninstalled the NLLB and PDF packages whenever setup re-ran.
Reinstall offline translation with `python3 source/build_env.py --tier nllb`;
PDF export comes back with plain setup.

**Something misbehaved and you want to report it**
Every run writes `logs/app_<date>_<time>.log`, and the app's version is on its
first line. The help panel (**?**, top right) shows the same string, click it to
copy. Include it.
