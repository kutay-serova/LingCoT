# LingCoT tester build

**Updated:** 2026-10-28 · **Version:** v3.16.1

This build is for testing. It is complete enough to annotate a real text from
start to finish; what it needs now is people other than its author doing that.

## Getting started

| | |
|---|---|
| **System** | macOS 11 or later, Apple Silicon or Intel; Python 3.9 or later. Offline translation (NLLB): Apple Silicon only. Full requirements: [setup.md](setup.md#requirements) |
| **Not supported** | Linux and Windows, in this build; see Known issues |
| **Time** | about 10 minutes to install, half an hour for the quickstart |

1. **Install and open LingCoT**: [Tutorial 1](#1-download-set-up-and-open).
   If setup stops, see [Tutorial 2](#2-if-setup-stops).
2. Work through [QUICKSTART.md](QUICKSTART.md) with a short text of your own.
3. Report what you find (below).

## Tutorials

| | for | time |
|---|---|---|
| [1. Download, set up and open](#1-download-set-up-and-open) | everyone | about 10 minutes |
| [2. If setup stops](#2-if-setup-stops) | no Python, or an old Python | 5 to 15 minutes |

### 1. Download, set up and open

1. **Download.** On the [release page](https://github.com/kutay-serova/LingCoT/releases/tag/v3.16.1), under *Assets*, click
   **LingCoT-3.16.1-macOS.zip**.
2. **Unzip and place the folder.** Double-click the zip in Downloads (Safari
   may already have unzipped it). Move the `LingCoT` folder to where it will
   stay, for example Documents. Setup records this location, so move the folder
   before step 3, not after.
3. **Open `setup.command`** in the `LingCoT` folder. macOS blocks it the first
   time, because LingCoT is not signed by a registered Apple developer. Allow
   it once:

   | macOS | what appears | what to do |
   |---|---|---|
   | 14 Sonoma or earlier | "cannot be opened because the developer cannot be verified" | **Cancel**, then right-click (or Control-click) `setup.command` → **Open** → **Open** |
   | 15 Sequoia or later | "Apple could not verify `setup.command` is free of malware" | **Done**, then **System Settings** → **Privacy & Security**, scroll to *Security* → **Open Anyway** next to `setup.command` → confirm with **Open Anyway** and your password |

   This is the only file that needs it: setup clears the flag on the rest of
   the folder.
4. **Let setup run.** A Terminal window opens and installs what LingCoT needs,
   a few minutes. If macOS asks whether Terminal may access your Documents
   folder, click **Allow**. It ends with *Setup complete!*; press Enter to close
   the window. If it ends with *Setup failed* or *system requirement not met*,
   go to [Tutorial 2](#2-if-setup-stops).
5. **Open LingCoT.** Double-click `LingCoT.app`, which setup has just created
   in the folder. The LingCoT window opens; no Terminal window, and no further
   security prompt. If macOS asks whether LingCoT may access your Documents
   folder, click **Allow**. To keep it at hand, drag `LingCoT.app` to the Dock.

Your work is saved in `LingCoT-Data` in your home folder, not in the `LingCoT`
folder. If you move the `LingCoT` folder later, run `setup.command` again.

### 2. If setup stops

| what you see | cause | do |
|---|---|---|
| A dialog: the `python3` command requires the command line developer tools | no Python on this Mac | [A](#a-install-apples-developer-tools) |
| Terminal: *Python 3 is not installed on this machine*, and python.org opens | no Python on this Mac | [B](#b-install-python-from-pythonorg) |
| Terminal: *Python 3.9 or later is needed; this is Python 3.x* | Python too old | [B](#b-install-python-from-pythonorg) |
| Terminal: *macOS 11 or later is needed* | Mac too old | this build cannot run on it; say so in a report |
| Terminal: *Setup failed*, for any other reason | | send a report with `logs/setup.log` from the `LingCoT` folder |

#### A. Install Apple's developer tools

1. In the dialog, click **Install**, then **Agree**. The download takes 5 to
   15 minutes; leave it to finish.
2. Close the Terminal window that setup opened.
3. Double-click `setup.command` again. The tools include Python 3.9, which
   LingCoT supports, and setup continues from
   [Tutorial 1, step 4](#1-download-set-up-and-open).

#### B. Install Python from python.org

1. On [python.org/downloads](https://www.python.org/downloads/), click the
   **Download Python 3.x** button. It gives the macOS installer (`.pkg`).
2. Open the downloaded `.pkg` and follow the installer to the end. When it
   finishes, a Finder window opens; it can be closed.
3. Close the Terminal window that setup opened. A new window is needed to find
   the new Python.
4. Double-click `setup.command` again. Setup now reports *Found: Python 3.x*
   and continues from [Tutorial 1, step 4](#1-download-set-up-and-open).

To check which Python setup will use: open **Terminal** (in Applications →
Utilities) and type `python3 --version`. 3.9 or later works.

## New in this build

| | where |
|---|---|
| **Reader**: the whole document without editors, as text against translation or as interlinear glossed text, with word highlighting and read-only detail popups | **Read** on the document or a section |
| **Interface language**: a picker, with ʻŌlelo Hawaiʻi listed; it is not translated yet and shows English | **File** → **Language** |
| **Repeated sentences**: a sentence with the same text as an annotated one is offered its translation, transliteration and word analyses, and can copy them after a review | the sentence and word editors |
| Machine translation writes into English when a corpus has no translation language set | the corpus's **Translation language** field |
| Settings and tags you add to the POS and morpheme-type lists are kept in `LingCoT-Data`, so an update does not reset them | |
| Setup checks the system first (macOS 11, Python 3.9, 64-bit) and names the one not met; it runs on the Python 3.9 that comes with Apple's developer tools | `setup.command` |
| Setup creates `LingCoT.app`, which opens without a Terminal window; `setup.command` is the only file macOS asks you to approve | the `LingCoT` folder |

## Known issues

| | |
|---|---|
| PDF dictionary export has no page numbers or running header (B-028) | |
| The native name *словѣньскъ* resolves to Old Russian, never Old Church Slavonic; use the code `cu` (B-035) | |
| Exports (PDF, LaTeX) are in English whatever the interface language | by decision, for now |
| Linux: setup completes but the app does not open, because the window toolkit it needs (Qt or GTK) is not installed (B-224) | [setup.md](setup.md), Linux |
| Linux: messages in pop-up dialogs show `\n` and quotation marks (B-225) | |

## Reporting

For each problem:

- **What you did**, step by step, and which sentence or word.
- **What you expected**, and **what happened**.
- **The version**: open the help sidebar (**?**, top right) and click the
  version line at the bottom; it is copied to the clipboard.
- **The log**: the newest `app_….log` in the `logs` folder inside the
  application folder. Logs record what the app did, never the text you annotate.

Your corpus files stay on your computer, in `LingCoT-Data`. Send one only if you
choose to.

Beyond problems, the questions at the end of the quickstart,
[What I would like to hear about](QUICKSTART.md#what-i-would-like-to-hear-about),
are the most useful part of a report.
