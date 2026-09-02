# =============================================================================
#  workspace.py, where the user's data lives, defined exactly once
#  Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# =============================================================================
#  The application folder is a public Git repository. Corpora are not: they hold
#  recorded speech and a participants file carrying real names, affiliations and
#  contact details. Keeping them outside the repository is structural protection
#, nothing confidential sits where Git can reach it, so no ignore rule, hook or
#  habit has to hold for the bad outcome not to happen.
#
#  WHY THIS IS A MODULE, not a constant repeated per entry point.
#  v3.14.77 defined WORKSPACE separately in LingCoT.pyw and setup.py. That was
#  wrong twice over: two definitions can drift, and the workspace step landed in
#  setup.py, which setup.command never runs (it runs build_env.py; setup.py is
#  the NLLB downloader). The result was a setup that silently did nothing.
#  One definition, imported by every entry point, removes both failure modes.
#
#  Import from any of: LingCoT.pyw, build_env.py, setup.py.
# =============================================================================

import os
import shutil
from pathlib import Path

# Override for a shared drive or an encrypted volume.
#
# v3.14.146: the folder was ~/LingCoT, the same name people give the folder they
# unzip the APP into, so "back up LingCoT" and "don't put data in LingCoT" were
# advice nobody could follow. A hyphen rather than a space: these paths are typed
# at the CLI ingester, and an unquoted path with a space fails confusingly.
# WORKSPACE_LEGACY is what migrate_workspace() offers to move, once.
WORKSPACE   = Path(os.environ.get("LINGCOT_WORKSPACE") or (Path.home() / "LingCoT-Data"))
CORPORA_DIR = WORKSPACE / "corpora"

WORKSPACE_LEGACY = Path.home() / "LingCoT"

# The repo ships sample corpora under these names; they belong to the app and are
# never migrated out of it.
SHIPPED_CORPORA = {"samples"}

WORKSPACE_README = """This folder holds your LingCoT corpora, dictionaries and participant records.

It is deliberately OUTSIDE the LingCoT application folder, so that your fieldwork
is never part of the app's public code repository. The application lives in a
folder usually called LingCoT; your work lives here, in LingCoT-Data.

  - Do not move these files into the application folder.
  - Back up THIS folder. Backing up the application folder will not save your work.
    (In the app: Save -> Export as .zip also bundles a single corpus.)
"""


# @fn ensure_workspace
def ensure_workspace() -> bool:
    """Create the workspace if absent. Idempotent, silent, safe to call at boot.

    Returns True if the corpora directory exists afterwards. Never raises: a
    failure here must not stop the app launching, it falls back to asking the
    user where to save."""
    try:
        CORPORA_DIR.mkdir(parents=True, exist_ok=True)
        readme = WORKSPACE / "README.txt"
        if not readme.exists():          # never overwrite the user's own notes
            readme.write_text(WORKSPACE_README, encoding="utf-8")
        return True
    except OSError:
        return False


# @fn find_legacy_workspace
def find_legacy_workspace() -> list:
    """Corpus folders still in the pre-v3.14.146 workspace, ~/LingCoT/corpora.

    Returns [] when there is nothing to move, so callers stay silent in the
    common case: a fresh install, or one already migrated. Also returns [] when
    LINGCOT_WORKSPACE is set, an explicit override is not a stale default."""
    if os.environ.get("LINGCOT_WORKSPACE"):
        return []
    legacy = WORKSPACE_LEGACY / "corpora"
    if not legacy.is_dir() or WORKSPACE_LEGACY == WORKSPACE:
        return []
    return [d for d in sorted(legacy.iterdir())
            if d.is_dir() and not d.name.startswith(".")]


# @fn migrate_workspace
def migrate_workspace(ask, say) -> int:
    """Offer to move corpora from ~/LingCoT to ~/LingCoT-Data. Returns how many moved.

    Same contract as migrate_legacy_corpora: ask() and say() are injected, and
    the answer is asked for rather than assumed. Unlike that migration this one
    is not a safety fix, the old location was never unsafe, only ambiguous, so
    declining leaves a working install and the offer is not repeated with any
    urgency."""
    strays = find_legacy_workspace()
    if not strays:
        return 0

    say("warn", f"Found {len(strays)} corpus folder(s) in {WORKSPACE_LEGACY / 'corpora'}:")
    for d in strays:
        say("plain", f"    {d.name}")
    say("info", "The workspace moved to LingCoT-Data so it cannot be confused with the")
    say("info", "application folder, which is also usually called LingCoT.")

    if not ask(f"Move them to {CORPORA_DIR} ?"):
        say("warn", f"Left in place. LingCoT will keep looking in {CORPORA_DIR};")
        say("warn", f"open them from {WORKSPACE_LEGACY / 'corpora'} or move them later.")
        return 0

    if not ensure_workspace():
        say("warn", f"Could not create {CORPORA_DIR} — nothing moved.")
        return 0

    moved, skipped = 0, []
    for d in strays:
        dest = CORPORA_DIR / d.name
        if dest.exists():                 # never merge or overwrite
            skipped.append(f"{d.name} (already in the new workspace)")
            continue
        try:
            shutil.move(str(d), str(dest))
            moved += 1
        except OSError as exc:
            skipped.append(f"{d.name} ({exc})")
    say("ok", f"Moved {moved} of {len(strays)} corpus folder(s) to {CORPORA_DIR}")
    for s in skipped:
        say("warn", f"Skipped {s}")

    # Leave a note behind. Someone who backs up ~/LingCoT out of habit should
    # find out here rather than from an empty corpus list.
    if moved and not skipped:
        try:
            (WORKSPACE_LEGACY / "MOVED.txt").write_text(
                f"Your LingCoT corpora moved to:\n\n    {CORPORA_DIR}\n\n"
                "The workspace was renamed so it could not be confused with the\n"
                "application folder. Back up the new folder, not this one.\n",
                encoding="utf-8")
        except OSError:
            pass
    return moved


# @fn find_legacy_corpora
def find_legacy_corpora(project_root) -> list:
    """Corpus folders still sitting inside the application folder.

    Pre-v3.14.77 builds wrote them to <app>/corpora/NAME/. Returns [] when there
    is nothing to move, so callers can stay silent in the common case."""
    legacy = Path(project_root) / "corpora"
    if not legacy.is_dir():
        return []
    return [d for d in sorted(legacy.iterdir())
            if d.is_dir() and d.name not in SHIPPED_CORPORA
            and not d.name.startswith(".")]


# @fn migrate_legacy_corpora
def migrate_legacy_corpora(project_root, ask, say) -> int:
    """Offer to move legacy corpora into the workspace. Returns the number moved.

    ask(prompt) -> bool and say(kind, message) are injected so this works from
    any entry point without importing that entry point's console helpers.

    Offer, never assume: moving someone's fieldwork without asking is its own
    kind of wrong, and a corpus may be parked there deliberately, but the folder
    it currently sits in is the one that gets published, so the default is yes."""
    strays = find_legacy_corpora(project_root)
    if not strays:
        return 0

    say("warn", f"Found {len(strays)} corpus folder(s) inside the application folder:")
    for d in strays:
        say("plain", f"    {d.name}")
    say("info", "Older versions saved corpora here. This folder is the code repository —")
    say("info", "anything inside it can be published if the repository is ever shared.")

    if not ask(f"Move them to {CORPORA_DIR} ?"):
        say("warn", "Left in place. Move them yourself before sharing the app folder.")
        return 0

    if not ensure_workspace():
        say("warn", f"Could not create {CORPORA_DIR} — nothing moved.")
        return 0

    moved, skipped = 0, []
    for d in strays:
        dest = CORPORA_DIR / d.name
        if dest.exists():                 # never merge or overwrite
            skipped.append(f"{d.name} (already in workspace)")
            continue
        try:
            shutil.move(str(d), str(dest))
            moved += 1
        except OSError as exc:
            skipped.append(f"{d.name} ({exc})")
    say("ok", f"Moved {moved} of {len(strays)} corpus folder(s) to {CORPORA_DIR}")
    for s in skipped:
        say("warn", f"Skipped {s}")
    return moved
