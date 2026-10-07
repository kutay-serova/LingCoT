## macOS: setup clears the download flag and builds LingCoT.app, which starts without Terminal (2026-10-07)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/mac-app/` (v3.15.4)
**Touched:** setup.command · .gitignore · README.md · QUICKSTART.md · TESTERS.md · setup.md · source/scripts/make_mac_app.sh (new) · dev/tests/mac_app_test.js (new) · dev/PRACTICES.md
**Change:** `mac-app` · **Order:** 6

**What changed.**
- `setup.command`, on macOS only: `xattr -dr com.apple.quarantine` on the folder, then `source/scripts/make_mac_app.sh`. Setup ends by naming `LingCoT.app`; if the app cannot be built it says so and names `LingCoT.command`.
- `make_mac_app.sh` writes `LingCoT.app` (Info.plist and a launch script). The launcher holds the folder's absolute path, so the app can be dragged to Applications or the Dock. It reports a moved folder, an incomplete setup (with Open Setup) and a non-zero exit (with Show Logs) in macOS dialogs; Python's stderr goes to `logs/launcher_stderr.log`.
- `.gitignore`: `LingCoT.app/`. The app is built per machine and never ships.
- Docs: launch instructions name `LingCoT.app`; the security-override steps apply to `setup.command` only. `LingCoT.command` stays as the launcher with a Terminal window.
- The managed NLLB server already stops on window close (`events.closed` and `atexit`, D29 P1b), so no process is left running unseen.

**Why.** Post-test item 2. The macOS 26 tester needed a security override per script, and the Terminal window that came with the app invited being closed.

**Guard.** `mac_app_test.js` (new): runs the generator into a folder named with a space and an apostrophe; checks the plist, the executable, the quoted path, the order of checks in the launcher, and setup's wiring and ignore rule. Not executed: the launcher itself, which opens dialogs on a Mac.

**Verification.** `./dev/tests/run_all.sh`: 107 passed. `mac_app_test.js`: 13 passed. Not verifiable from here: Gatekeeper behaviour and the Dock on a real Mac; to check after `setup.command` on a downloaded zip.
