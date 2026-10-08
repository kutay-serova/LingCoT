## B-236: minimum system requirements checked by setup and documented; setup runs on Python 3.9 again (2026-10-08)
**Version:** pending · **Type:** fix · **Archives:** `dev/archive/changes/sysreq/` (v3.16.0)
**Touched:** source/build_env.py · source/setup.py · source/sysreq.py (new) · README.md · setup.md · TESTERS.md · dev/PRACTICES.md · dev/BUGS.md · dev/tests/sysreq_test.js (new)
**Closed:** B-236
**Change:** `sysreq` · **Order:** 1

**What changed.**
- `source/sysreq.py`: `check_base` (Python 3.9, 64-bit, macOS 11, Windows 10) and `check_nllb` (no Intel Mac, with a separate message for an Intel Python under Rosetta; Windows on ARM needs Python 3.10 or earlier; glibc 2.28 on Linux). Each limit names its source in the module docstring.
- `build_env.main()` checks after the workspace step (B-023 keeps that first) and before the venv is touched, adding the NLLB check for `--tier nllb`; `setup.py` checks before the NLLB packages are installed. A failed check prints the reason and returns 1, so `setup.command`, `setup_NLLB.command` and the `.bat` files stop there.
- B-236: `from __future__ import annotations` in `build_env.py`.
- Docs: one requirements table in README and setup.md (macOS 11, Windows 10/11 64-bit, Python 3.9, about 200 MB; NLLB about 1.1 GB more, 4 GB RAM recommended, not on Intel Macs yet); TESTERS states the minimum.

**Why.** Requested after the compatibility review of 2026-10-07: an old system failed partway through installing packages instead of being told why.

**Guard.** `sysreq_test.js` (new): executes both checks with overridden system values (R1 to R7, N1 to N5), reads where `build_env.py` and `setup.py` call them (W1 to W3), and fails a setup module that uses 3.10-only annotations in signatures without the `__future__` import. 4 checks fail on the pre-change files. Also run for real: `build_env.py --check` under Python 3.8 refuses with the message, under 3.9 imports and runs.

**Verification.** `./dev/tests/run_all.sh`: 107 passed, 1 disabled (`cli_schema_test.js`: the repo `.venv` was replaced during this change and is rebuilt separately). `sysreq_test.js`: 21 passed. `build_env.py --check` on a copy: refused under 3.8, runs under 3.9.
