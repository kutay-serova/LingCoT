#!/usr/bin/env python3
# =============================================================================
# Linguistic Corpus Toolkit (LingCoT), log_setup.py
# Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# See LICENSE in the project root for the full license text.
# =============================================================================
#
# PURPOSE
#   Shared logging initialisation for all LingCoT Python components.
#   Provides two entry points:
#     setup_session_logger(), one timestamped log file per run; old files pruned.
#     setup_append_logger(), all runs append to the same file (used for setup).
#
# USAGE
#   from log_setup import setup_session_logger, setup_append_logger
#
#   # App / corpus scripts, per-run file:
#   logger = setup_session_logger(project_root, prefix='app')
#   logger.info("App started")
#   logger.error("Something broke", exc_info=True)
#
#   # Setup scripts, single append file:
#   logger = setup_append_logger(project_root, filename='setup.log')
#   logger.info("Build env started")
#
# LOG FORMAT
#   2026-04-25 14:30:22  INFO      app. File opened: corpus.jsonl (142 KB)
#   2026-04-25 14:30:31  ERROR     app.js. TypeError: Cannot read 'text' of undefined
#
# FILES CREATED
#   logs/app_YYYY-MM-DD_HHMMSS.log, per app session
#   logs/scripts_YYYY-MM-DD_HHMMSS.log, per corpus-script run
#   logs/setup.log, all setup runs, append mode
# =============================================================================

import logging
import sys
from datetime import datetime
from pathlib import Path

# Maximum number of per-session log files kept before the oldest is deleted.
MAX_SESSION_LOGS = 20

# Name of the logs directory (relative to project root).
LOGS_DIR_NAME = "logs"

# Shared formatter used by all handlers.
_LOG_FORMAT   = "%(asctime)s  %(levelname)-8s  %(name)s — %(message)s"
_DATE_FORMAT  = "%Y-%m-%d %H:%M:%S"


# @fn _get_logs_dir
def _get_logs_dir(project_root: Path) -> Path:
    """Return the logs/ directory path, creating it if it does not exist."""
    logs_dir = project_root / LOGS_DIR_NAME
    logs_dir.mkdir(exist_ok=True)
    return logs_dir


# @fn _prune_old_session_logs
def _prune_old_session_logs(logs_dir: Path, prefix: str) -> None:
    """
    Delete the oldest session log files for `prefix` if there are more than
    MAX_SESSION_LOGS.  Files are matched by glob '{prefix}_*.log' and sorted
    lexicographically, since the timestamp is part of the name this puts them
    in chronological order, so the oldest (smallest) names are deleted first.
    """
    pattern = f"{prefix}_*.log"
    files = sorted(logs_dir.glob(pattern))  # oldest first (timestamp in name)
    while len(files) > MAX_SESSION_LOGS:
        try:
            files.pop(0).unlink(missing_ok=True)
        except OSError:
            break
        files = sorted(logs_dir.glob(pattern))


# @fn _make_logger
# @class _LevelCounter
class _LevelCounter(logging.Handler):
    """
    Counts records at WARNING and above so a session can report its own tally on
    the way out.

    Why this exists: `App exited cleanly.` was logged unconditionally, including
    on runs that had thrown fifteen times. B-008 sat in a log from 2026-05-29, captured perfectly, with a full stack, for nearly three months, because
    nothing ever said "this session recorded errors". The logging was never the
    problem; the silence at the end was.

    Counting only. It stores no message text, so it adds no memory pressure and
    cannot leak corpus content into a second place.
    """

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.counts: dict[str, int] = {}

    def emit(self, record: logging.LogRecord) -> None:
        self.counts[record.levelname] = self.counts.get(record.levelname, 0) + 1

    # @fn summary
    def summary(self) -> str:
        """One-line tally, or '' when the session was genuinely clean."""
        if not self.counts:
            return ""
        order = ("CRITICAL", "ERROR", "WARNING")
        parts = [f"{self.counts[k]} {k.lower()}" for k in order if self.counts.get(k)]
        return " · ".join(parts)


def _make_logger(name: str, log_file: Path, file_mode: str = "w") -> logging.Logger:
    """
    Build and return a Logger with two handlers:
      • FileHandler. DEBUG and above, writes to log_file.
      • StreamHandler. WARNING and above, writes to stderr so the terminal
        still shows important messages even when running headlessly.

    Using a unique name per invocation avoids the Python logging module
    returning a cached (already-configured) logger on repeated calls, which
    would accumulate duplicate handlers across module reloads or unit tests.
    """
    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT)

    # File handler, captures everything
    fh = logging.FileHandler(log_file, mode=file_mode, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(formatter)

    # Console handler, warnings and above only (avoids spamming the terminal)
    sh = logging.StreamHandler(sys.stderr)
    sh.setLevel(logging.WARNING)
    sh.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False   # don't double-log to the root logger
    logger.addHandler(fh)
    logger.addHandler(sh)

    # Attached to the logger so callers can read the tally without threading an
    # extra return value through every call site.
    counter = _LevelCounter()
    logger.addHandler(counter)
    logger.level_counter = counter   # type: ignore[attr-defined]

    return logger


# @fn setup_session_logger
def setup_session_logger(project_root: Path, prefix: str) -> logging.Logger:
    """
    Create a per-session log file at:
        logs/{prefix}_YYYY-MM-DD_HHMMSS.log

    Old session files for this prefix are pruned to MAX_SESSION_LOGS.
    Returns a configured Logger named `prefix`.

    Parameters
    ----------
    project_root : Path
        Project root directory (logs/ will be created inside it).
    prefix : str
        Short name for this component, e.g. 'app' or 'scripts'.
        Used as both the logger name and the filename prefix.
    """
    logs_dir = _get_logs_dir(project_root)
    ts       = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    log_file = logs_dir / f"{prefix}_{ts}.log"

    logger = _make_logger(prefix, log_file, file_mode="w")

    _prune_old_session_logs(logs_dir, prefix)

    return logger


# @fn setup_append_logger
def setup_append_logger(project_root: Path, filename: str,
                        logger_name: str = "setup") -> logging.Logger:
    """
    Create (or reuse) an append-mode logger that writes to:
        logs/{filename}

    All runs accumulate in the same file, useful for setup scripts that are
    run infrequently and where a full run history in one file is convenient.

    A blank line + timestamp separator is written at the start of each
    invocation so individual runs are clearly delineated.

    Parameters
    ----------
    project_root : Path
        Project root directory.
    filename : str
        Log file name, e.g. 'setup.log'.
    logger_name : str
        Logger name (default 'setup').  Use distinct names if multiple
        components append to the same file and you want to tell them apart.
    """
    logs_dir = _get_logs_dir(project_root)
    log_file = logs_dir / filename

    # Write a visual separator so each run is clearly delineated in the file.
    sep = f"\n{'='*72}\n  Session started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*72}\n"
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(sep)
    except OSError:
        pass  # If we can't write the separator, continue anyway

    return _make_logger(logger_name, log_file, file_mode="a")
