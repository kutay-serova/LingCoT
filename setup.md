# LingCoT: Setup & Running

---

## Requirements

**Python 3.** [python.org/downloads](https://www.python.org/downloads/)

On macOS this is usually pre-installed. On Windows, check **"Add Python to PATH"** during installation.

---

## First-time setup

Run once. Creates `.venv/` in the project folder and installs all dependencies (desktop app + corpus scripts).

**macOS:**
```
double-click setup.command
```
If macOS refuses to open it: right-click → Open → Open, or in Terminal:
```bash
chmod +x setup.command LingCoT.command setup_NLLB.command
bash setup.command
```

**Windows:**
```
double-click setup.bat
```

Setup installs the **minimal tier**: pywebview (desktop app), ingestion libraries (TXT/EPUB), and online translation via Google Translate. Offline NLLB translation and PDF export are separate tiers, see below.

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

**macOS:** double-click `LingCoT.command`
**Windows:** double-click `LingCoT.bat`

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

## PDF dictionary export (optional)

Exporting a dictionary to PDF needs one extra tier:

```bash
python3 source/build_env.py --tier pdf
```

Adds `fpdf2` and `python-bidi` (right-to-left scripts). Tiers are **additive.** installing this does not remove NLLB, and vice versa.

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
| `LingCoT.command` | **macOS.** launch the desktop app |
| `LingCoT.bat` | **Windows.** launch the desktop app |
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
Right-click → Open → Open. Or: `chmod +x setup.command && bash setup.command`.

**App window is blank or shows an error**
Check that `source/LingCoT.html` and `source/LingCoT.pyw` are both present. Launch from terminal to see error output:
```bash
.venv/bin/python source/LingCoT.pyw
```

**NLLB download fails or is interrupted**
Re-run `setup_NLLB.command` / `setup_NLLB.bat`. HuggingFace Hub resumes partial downloads automatically.

**`source/build_env.py` fails on the NLLB tier (torch)**
torch requires Python 3.9+. Check with `python3 --version`. Use `setup_NLLB.command` instead of running build_env.py directly. It handles the tier upgrade and model download in the correct order.

**Offline translation or PDF export stopped working after running setup**
Fixed in v3.14.81. `uv sync` removes anything outside the tier it is given, so
earlier versions uninstalled the NLLB and PDF packages whenever setup re-ran.
Reinstall what you need, `python3 source/build_env.py --tier nllb` and
`--tier pdf`, and note that they no longer undo each other.

**Something misbehaved and you want to report it**
Every run writes `logs/app_<date>_<time>.log`, and the app's version is on its
first line. The help panel (**?**, top right) shows the same string, click it to
copy. Include it.
