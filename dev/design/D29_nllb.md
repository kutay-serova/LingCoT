# D29: NLLB: diagnostics, then in-GUI model download
**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

Raised 2026-08-24 from two user reports: "linking to the NLLB model does not work", and "downloading NLLB from the GUI requires a terminal, which most intended users cannot do".

**P1, capture the failure ✅ shipped v3.14.63.** Output → `logs/nllb_server_<ts>.log` with a header recording the interpreter and whether it came from the venv; `start_nllb_server` waits 1.5 s and reports a process that died on the spot; `get_server_status` gained a `crashed` state with `exit_code` + `stderr_tail`; the settings modal renders it. The POSIX-only venv path was fixed at the same time (`_venv_python()` checks both layouts). Guarded by `dev/tests/nllb_diag_test.py` (15 assertions, no model or macOS needed).

**P1 delivered its answer immediately (2026-08-24).** `OSError: [Errno 48] Address already in use`, see B-016. The app never stopped the server it started, so quitting left an orphan on port 5001; and the GUI health check tested liveness rather than identity, so a foreign occupant showed a green dot while translations returned nothing. Fixed v3.14.64. **Both hypotheses below were wrong.** kept only as a record that inspection did not settle in two days what one captured stderr line settled at once.

_What it replaced:_ `start_nllb_server` launched the server with `stdout=DEVNULL, stderr=DEVNULL`. `NLLBBackend.__init__` raises an informative error for all four failure modes. Missing packages, missing model dir, no `nllb-200-*` weights dir, missing tokenizer, and every one was discarded, so the user saw "Loading model…" → 120 s of polling → "server down" no matter what went wrong.

Ruled out by inspection: weights (`model.bin`, 594 MB), the flores200 tokenizer, and `ctranslate2` 4.7.1 + `sentencepiece` are all present; `models_root` in `corpus_annotate.py` resolves (though it is brittle; it hardcodes the folder name `"source"`).

Two live hypotheses for P1 to confirm or kill:

1. **Leading.** `.venv/pyvenv.cfg` says Python 3.13.7 but the app log reports 3.13.13. Homebrew upgraded `python@3.13` underneath the venv, and a compiled wheel like `ctranslate2` is exactly what breaks on an in-place interpreter upgrade.
2. Something else entirely. Which is the honest reason the stderr had to exist first.

**P2, in-GUI model download (M).** Decided 2026-08-24: full in-GUI download, not a copy-button. A "Download model" button runs `setup.py --nllb` as a managed subprocess, reusing the `start_nllb_server`/`stop_nllb_server`/`get_server_status` bridge pattern.

The new piece is a **progress channel.** starting a server is binary and HTTP-pingable; a 1.2 GB download plus a CPU-bound int8 conversion is not. Preferred: `setup.py --nllb` writes phase + percent to a JSON status file the GUI polls each second (no new plumbing, degrades to "still working" if it goes stale). Alternative considered: a `huggingface_hub` callback into `window.evaluate_js`, truer progress, but couples `setup.py` to the GUI process.

Also needs: a size/time warning up front (~1.2 GB transits, ~600 MB lands), cancellability, resumability (`snapshot_download` already resumes), and honest failure reporting, now available from P1.

**Open design question, not settled.** `setup.py --nllb` also mutates the venv: it shells out to `build_env.py --tier nllb` to install `ctranslate2`, `sentencepiece`, `transformers`, `torch`. Downloading a model and changing the user's Python environment are different acts of consent. Should the GUI button do both, or refuse and explain when packages are missing?

---
