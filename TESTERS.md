# LingCoT tester build

**Updated:** 2026-09-24 · **Version:** v3.15.3

This build is for testing. It is complete enough to annotate a real text from
start to finish; what it needs now is people other than its author doing that.

## Getting started

1. Install: [setup.md](setup.md). **macOS only.** Linux and Windows are not
   supported in this build; see Known issues.
2. Work through [QUICKSTART.md](QUICKSTART.md) with a short text of your own,
   about half an hour.
3. Report what you find (below).

## New in this build

| | where |
|---|---|
| **Reader**: the whole document without editors, as text against translation or as interlinear glossed text, with word highlighting and read-only detail popups | **Read** on the document or a section |
| **Interface language**: a picker, with ʻŌlelo Hawaiʻi listed; it is not translated yet and shows English | **File** → **Language** |
| **Repeated sentences**: a sentence with the same text as an annotated one is offered its translation, transliteration and word analyses, and can copy them after a review | the sentence and word editors |
| Machine translation writes into English when a corpus has no translation language set | the corpus's **Translation language** field |
| Settings and tags you add to the POS and morpheme-type lists are kept in `LingCoT-Data`, so an update does not reset them | |

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
