#!/usr/bin/env python3
"""
LingCoT. Linguistic Corpus Toolkit
Desktop launcher using PyWebView.

Double-click LingCoT.pyw to open the app as a native window.
On Windows.pyw runs Python without a console window.
On macOS/Linux, launch with:  python3 LingCoT.pyw

Requirements:  pip install pywebview   (or run setup.bat / setup.command once)
"""

import atexit
import json
import os
import tempfile
import platform
import re
import shutil
import subprocess
import sys
import threading
import traceback
import zipfile
from datetime import datetime
from pathlib import Path

import webview

# pywebview 5.0 replaced the module-level OPEN_DIALOG / SAVE_DIALOG constants with
# the FileDialog enum (the old names now emit a DeprecationWarning). Resolve the
# dialog modes once here, preferring the new enum and falling back to the legacy
# constants so the app keeps working on pywebview 4.x.
try:
    _DIALOG_OPEN = webview.FileDialog.OPEN
    _DIALOG_SAVE = webview.FileDialog.SAVE
except AttributeError:  # pywebview < 5.0
    _DIALOG_OPEN = webview.OPEN_DIALOG
    _DIALOG_SAVE = webview.SAVE_DIALOG

# BASE = source/ folder (where LingCoT.html and LingCoT.pyw live).
# ROOT = the application folder, one level up from BASE. This is the Git
#        repository: everything inside it is public. NO USER DATA GOES HERE.
BASE        = os.path.dirname(os.path.abspath(__file__))
ROOT        = os.path.dirname(BASE)

# WORKSPACE = where the USER's corpora live. Deliberately OUTSIDE ROOT.
#
# Defined once in source/workspace.py and imported here, by build_env.py and by
# setup.py. It was duplicated across two files in v3.14.77; two definitions can
# drift, and the one that mattered sat in a file the setup scripts never run.
#
# ensure_workspace() at boot: the app must not depend on setup having been run,
# or on WHICH setup script the user ran. Silent and idempotent, a failure here
# just means the save dialog asks where to put things. See below the imports.

# ── Logging setup ─────────────────────────────────────────────────────────────
# log_setup.py and workspace.py live alongside this file in source/. Insert BASE
# on sys.path before either import, do not rely on Python's script-directory
# default, which does not apply when this module is imported rather than run.
sys.path.insert(0, BASE)
from log_setup import setup_session_logger
# Coerce to str at the boundary. workspace.py uses pathlib because setup.py and
# build_env.py want Path idioms; this file hands these values to pywebview, which
# serialises API returns to JSON and passes `directory=` through to the native
# file dialog. A PosixPath breaks both, get_workspace() raised a TypeError JS-side
# and open_dialog() silently returned nothing, so the Open button did nothing at
# all and logged nothing (B-024). Everything crossing the bridge is a string.
from version import __version__ as APP_VERSION
from workspace import (WORKSPACE as _WORKSPACE_PATH,
                       CORPORA_DIR as _CORPORA_DIR_PATH,
                       ensure_workspace, user_file_path)
WORKSPACE   = str(_WORKSPACE_PATH)
CORPORA_DIR = str(_CORPORA_DIR_PATH)
from pathlib import Path as _Path

_log        = setup_session_logger(_Path(ROOT), prefix='app')

# Create ~/LingCoT/corpora/ if absent. Logged, not fatal.
if not ensure_workspace():
    _log.warning(f"Could not create workspace at {WORKSPACE} — "
                 f"save dialogs will fall back to the home directory")
SCRIPTS_DIR = _Path(BASE) / "scripts"   # source/scripts/, for dict_export.py etc.


# ── B-116: the string ceiling ────────────────────────────────────────────────
# V8's maximum string length is 536,870,888 characters, and the whole corpus is
# read into one string on load and rebuilt as one on compaction. JavaScriptCore's
# limit is far higher, so macOS degrades into memory exhaustion rather than
# throwing; either way the failure is late and unexplained without this.
#
# The warning fires at 80%, not at the wall, because the wall is where nothing
# can be done about it any more. A corpus this size is roughly 400,000 fully
# annotated words at the density measured for B-116.
JS_STRING_MAX  = 536_870_888
JS_STRING_WARN = int(JS_STRING_MAX * 0.8)


class Api:
    """
    File I/O bridge between LingCoT.html (JavaScript) and the local filesystem.
    Every public method here is callable from JS as:
        await window.pywebview.api.method_name(args)
    All methods are async on the JS side (they return Promises automatically).
    """

    def __init__(self):
        # D22/A: managed NLLB server subprocess handle.
        # None means not started by us; not None means we own it.
        self._nllb_proc = None
        # D29 P1: path of the file this run's server output is captured to, and
        # the file handle we must close when the process ends. Both None until a
        # server is started by us.
        self._nllb_log_path = None
        self._nllb_log_fh   = None

    # ── JS-side log bridge ────────────────────────────────────────────────────

    def log_js(self, level, message, data=None):
        """
        Receive a log entry from JavaScript and write it to the session log.
        Called by the JS logEvent() helper and the window.onerror / console
        override handlers.

        Parameters
        ----------
        level   : str, 'debug' | 'info' | 'warn' | 'error'
        message : str, human-readable event description
        data    : any, optional structured data (will be serialised inline)
        """
        text = f"[JS] {message}"
        if data:
            text += f"  {data}"
        lvl = (level or 'info').lower()
        if lvl in ('error', 'critical'):
            _log.error(text)
        elif lvl in ('warn', 'warning'):
            _log.warning(text)
        elif lvl == 'debug':
            _log.debug(text)
        else:
            _log.info(text)

    # ── Bundled data files (relative paths, must stay inside source/ folder) ──

    def read_file(self, rel_path):
        """Read a data file relative to the source/ directory.
        Used for: resources/leipzig_glosses.json, etc.
        Raises PermissionError if the path tries to escape the source folder."""
        full = os.path.normpath(os.path.join(BASE, rel_path))
        if not full.startswith(BASE + os.sep) and full != BASE:
            _log.warning(f"read_file blocked path escape attempt: {rel_path!r}")
            raise PermissionError("Access outside the app directory is not allowed.")
        try:
            with open(full, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as exc:
            _log.error(f"read_file failed for {rel_path!r}: {exc}")
            raise

    def list_locales(self):
        """Interface languages: every resources/locale/<code>.json whose _meta.locale
        is <code>. Returns [{'locale', 'language'}], sorted by file name."""
        d = os.path.join(BASE, 'resources', 'locale')
        out = []
        for f in sorted(os.listdir(d)):
            if not f.endswith('.json') or f.startswith('settings'):
                continue
            try:
                with open(os.path.join(d, f), encoding='utf-8') as fh:
                    meta = json.load(fh).get('_meta') or {}
            except (OSError, ValueError, AttributeError) as exc:
                _log.warning(f"list_locales: skipped {f}: {exc}")
                continue
            if meta.get('locale') == f[:-5]:
                out.append({'locale': f[:-5], 'language': str(meta.get('language') or f[:-5])})
        return out

    # ── User settings and vocabulary (workspace, not the app folder) ─────────
    # There is deliberately no write_file: nothing the page does may write inside
    # source/, which is the repository (tb-settings).

    # Shipped copy of settings.json before tb-settings; migrated once.
    _LEGACY_SETTINGS = os.path.join(BASE, 'resources', 'locale', 'settings.json')

    def read_user_file(self, name):
        """Read one of workspace.USER_FILES. Returns None if it does not exist yet,
        which is the normal state on first run, so it is not logged as an error.
        settings.json is first copied from the old in-repo location if only that exists."""
        path = user_file_path(name)
        if name == 'settings.json' and not path.exists() and os.path.isfile(self._LEGACY_SETTINGS):
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(self._LEGACY_SETTINGS, path)
                _log.info(f"settings.json migrated to {path}")
            except OSError as exc:
                _log.warning(f"settings.json migration failed: {exc}")
        if not path.exists():
            return None
        return path.read_text(encoding='utf-8')

    def write_user_file(self, name, content):
        """Write one of workspace.USER_FILES, atomically (temp file + os.replace)."""
        path = user_file_path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + '.tmp')
        try:
            tmp.write_text(content, encoding='utf-8')
            os.replace(tmp, path)
            _log.debug(f"write_user_file: {name} ({len(content):,} chars)")
            return True
        except Exception as exc:
            _log.error(f"write_user_file failed for {name!r}: {exc}")
            raise

    # ── User corpus / dictionary files (absolute paths anywhere on disk) ──────

    def read_abs(self, abs_path):
        """Read a user file at an absolute path (chosen via native dialog).
        Used for: loading corpus and dictionary JSONL files."""
        try:
            size = os.path.getsize(abs_path)
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()
            _log.info(f"File opened: {abs_path} ({size:,} bytes)")
            return content
        except Exception as exc:
            _log.error(f"read_abs failed for {abs_path!r}: {exc}")
            raise

    def write_abs(self, abs_path, content):
        """Write content to an absolute path, ATOMICALLY. Creates parent dirs.
        Used for: autosave and manual save of corpus and dictionary files.

        D50: write to a temp file in the same directory, flush, fsync, then
        os.replace onto the target. os.replace is atomic on POSIX and on Windows,
        so a reader never sees a half-written corpus and a crash mid-write leaves
        the previous file intact rather than a truncated one. The old code wrote
        in place, which at 56 MB is a wide window in which to lose everything.
        Same directory on purpose: a rename across filesystems is not atomic."""
        try:
            parent = os.path.dirname(os.path.abspath(abs_path))
            if parent:
                os.makedirs(parent, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=parent or '.', prefix='.lingcot-', suffix='.tmp')
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write(content)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, abs_path)
            except Exception:
                # Never leave the scratch file behind to be mistaken for data.
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
                raise
            _log.info(f"File saved: {abs_path} ({len(content):,} chars)")
            return True
        except Exception as exc:
            _log.error(f"write_abs failed for {abs_path!r}: {exc}")
            raise

    def append_abs(self, abs_path, content):
        """Append one or more journal lines to an absolute path, durably.

        D50: this is the hot path — a record per annotation action rather than a
        rebuild of the whole corpus. fsync per call, not per line: a flush alone
        leaves the record in the OS buffer, where a power cut still loses it, and
        the whole point of the journal is that the last completed action survives.
        Roughly 1 ms on an SSD and perhaps 10 ms on slow field storage, against
        the 1.5 s full write it replaces.

        Returns the file's size after the append, which is what the size-based
        compaction trigger reads."""
        try:
            parent = os.path.dirname(os.path.abspath(abs_path))
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(abs_path, 'a', encoding='utf-8') as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            size = os.path.getsize(abs_path)
            _log.info(f"Journal appended: {abs_path} (+{len(content):,} chars, {size:,} total)")
            return size
        except Exception as exc:
            _log.error(f"append_abs failed for {abs_path!r}: {exc}")
            raise

    def truncate_abs(self, abs_path):
        """Empty a file, keeping it in place. D50: called after a compaction has
        REPLACED the base, never before — the order is what makes an interrupted
        compaction safe, because replaying an already-folded journal is a no-op
        and replaying a lost one is not."""
        try:
            if os.path.isfile(abs_path):
                with open(abs_path, 'w', encoding='utf-8') as f:
                    f.flush()
                    os.fsync(f.fileno())
                _log.info(f"Journal truncated: {abs_path}")
            return True
        except Exception as exc:
            _log.error(f"truncate_abs failed for {abs_path!r}: {exc}")
            raise

    # ── Native OS file dialogs ────────────────────────────────────────────────

    def open_dialog(self, file_types=None, directory=None):
        """Show a native OS file-open dialog.
        file_types: list of strings like ['Description (*.ext)'..]
        directory:  initial directory; defaults to the user's workspace corpora/.
        Returns a list containing the chosen path, or None if cancelled."""
        ft = tuple(file_types) if file_types else (
            'JSONL Files (*.jsonl;*.json)',
            'All files (*.*)',
        )
        # Land in the workspace, never in the app folder, the dialog is where a
        # user forms their mental model of "where my corpora live", so it must
        # point at the same place setup_corpus_dir() writes to.
        # Fall back to the home directory if the workspace does not exist yet.
        if directory is None:
            directory = CORPORA_DIR if os.path.isdir(CORPORA_DIR) \
                        else (WORKSPACE if os.path.isdir(WORKSPACE)
                              else os.path.expanduser('~'))
        try:
            result = webview.windows[0].create_file_dialog(
                _DIALOG_OPEN,
                allow_multiple=False,
                file_types=ft,
                directory=directory,
            )
            chosen = list(result) if result else None
            if chosen:
                _log.debug(f"open_dialog: user chose {chosen[0]!r}")
            return chosen
        except Exception as exc:
            _log.error(f"open_dialog failed: {exc}")
            raise

    # ── Corpus folder management ──────────────────────────────────────────────

    def get_app_info(self):
        """Version and runtime, for the UI and for bug reports.

        The user needs to be able to read the version off the screen and tell
        you; the log needs it so a report you receive can be tied to a build.
        Both come from source/version.py, one string, several consumers."""
        try:
            import importlib.metadata as _md
            wv = _md.version('pywebview')
        except Exception:
            wv = 'unknown'
        return {
            'version':   str(APP_VERSION),
            'python':    sys.version.split()[0],
            'pywebview': wv,
            'platform':  f"{platform.system()} {platform.release()}",
        }

    def get_workspace(self):
        """Return the user's workspace paths, for display in the UI.

        The front end must never hard-code "~/LingCoT": LINGCOT_WORKSPACE can
        move it, and a prompt that names the wrong folder is worse than one that
        names none. Called once at boot and cached JS-side as _workspaceDir."""
        # str() is redundant given the coercion at import, and kept deliberately:
        # this dict is JSON-serialised by pywebview, and a non-serialisable value
        # here fails as an opaque TypeError on the JS side (B-024).
        return {
            'workspace': str(WORKSPACE),
            'corpora':   str(CORPORA_DIR),
            'exists':    os.path.isdir(CORPORA_DIR),
        }

    # B-149/B-150 (v3.14.289): the naming convention, once. The JS half is
    # source/modules/project_files.js and carries the SAME table; project_files_
    # test.js compares them literally, because the convention crosses a language
    # boundary and neither side can check the other by itself.
    _PROJECT_ROLES = {
        'corpus':       '_corpus.jsonl',
        'dictionary':   '_dictionary.jsonl',
        'participants': '_participants.jsonl',
        'journal':      '.journal.jsonl',
    }

    # Not 'corpus': a fallback that is itself a role name gives corpus_corpus.jsonl.
    _UNTITLED_PREFIX = 'untitled'

    @classmethod
    def _project_file(cls, prefix, role):
        """Filename for one role of one project."""
        return str(prefix or cls._UNTITLED_PREFIX) + cls._PROJECT_ROLES[role]

    @classmethod
    def _project_prefix(cls, name_or_path):
        """The shared stem, from any of the project's own filenames.

        A name carrying no role suffix loses its extension and is used as-is,
        which is how a file named by hand still opens."""
        base = os.path.basename(str(name_or_path or ''))
        for suffix in cls._PROJECT_ROLES.values():
            if len(base) > len(suffix) and base.endswith(suffix):
                return base[:-len(suffix)]
        return os.path.splitext(base)[0]

    def setup_corpus_dir(self, corpus_name):
        """Create a managed corpus folder at <workspace>/corpora/NAME/.

        NOT inside the app folder, see the WORKSPACE note at the top of this file.
        Returns a dict with four keys:
          folder, absolute path to the created folder
          corpusPath, where the corpus JSONL should be written
          dictPath, where the dictionary JSONL should be written
          participantsPath, where the participants (annotators/sources) JSONL should be written
        corpus_name is sanitised to safe ASCII before use as a folder name."""
        try:
            safe = re.sub(r'[^\w\-]', '_', str(corpus_name))[:40].strip('_') or 'corpus'
            folder = os.path.join(CORPORA_DIR, safe)
            os.makedirs(folder, exist_ok=True)
            _log.info(f"Corpus directory created: {folder}")
            return {
                'folder':           folder,
                'corpusPath':       os.path.join(folder, self._project_file(safe, 'corpus')),
                'dictPath':         os.path.join(folder, self._project_file(safe, 'dictionary')),
                'participantsPath': os.path.join(folder, self._project_file(safe, 'participants')),
            }
        except Exception as exc:
            _log.error(f"setup_corpus_dir failed for {corpus_name!r}: {exc}")
            raise

    def open_project(self, any_path):
        """Open a project bundle from any one of its three companion files.
        Accepts a corpus (_corpus.jsonl), dictionary (_dictionary.jsonl), or
        participants (_participants.jsonl) file and derives the other two paths
        from the shared prefix in the same folder.

        Returns a dict with:
          corpusText, raw JSONL text of the corpus file ('' if missing)
          dictText, raw JSONL text of the dict file ('' if missing)
          participantsText, raw JSONL text of the participants file ('' if missing)
          journalText, raw JSONL of the D50 journal ('' when there is none, which
                       is the normal state: it is emptied on every full write)
          corpusPath, absolute path to the derived corpus file
          dictPath, absolute path to the derived dict file
          participantsPath, absolute path to the derived participants file
          missing, list of basenames that could not be found on disk
          oversize, [{name, bytes}] for files past 80% of V8's string limit (B-116)
          prefix, the shared filename prefix (e.g. 'mytext')
        """
        any_path  = os.path.abspath(any_path)
        folder    = os.path.dirname(any_path)
        base_name = os.path.basename(any_path)

        # Derive the shared project prefix from whichever file type was opened
        prefix = self._project_prefix(base_name)

        corpus_path       = os.path.join(folder, self._project_file(prefix, 'corpus'))
        dict_path         = os.path.join(folder, self._project_file(prefix, 'dictionary'))
        participants_path = os.path.join(folder, self._project_file(prefix, 'participants'))
        missing = []

        # B-116: the size of a file is known before it is read, and the JS side
        # cannot hold a string past V8's 536,870,888 characters. Reported here so
        # the refusal names the file and its size rather than surfacing as an
        # opaque throw halfway through the load. Reported, not refused: JSC's
        # limit is far higher, so on macOS the same file loads.
        oversize = []

        def _read(path, label):
            if os.path.isfile(path):
                size = os.path.getsize(path)
                if size > JS_STRING_WARN:
                    oversize.append({'name': os.path.basename(path), 'bytes': size})
                    _log.warning(f"Project file is large enough to risk the JS string "
                                 f"limit: {path} ({size:,} bytes)")
                with open(path, 'r', encoding='utf-8') as f:
                    text = f.read()
                _log.info(f"Project file loaded: {path} ({size:,} bytes)")
                return text
            else:
                missing.append(os.path.basename(path))
                _log.warning(f"Project file missing: {path}")
                return ''

        corpus_text       = _read(corpus_path,       'corpus')
        dict_text         = _read(dict_path,          'dictionary')
        participants_text  = _read(participants_path,  'participants')

        # D50: the journal beside the base, holding whatever was annotated since
        # the last compaction. Absent is the NORMAL state — it is emptied every
        # time the base is written — so its absence is not reported as missing.
        journal_path = os.path.join(folder, self._project_file(prefix, 'journal'))
        journal_text = ''
        if os.path.isfile(journal_path):
            with open(journal_path, 'r', encoding='utf-8') as f:
                journal_text = f.read()
            if journal_text.strip():
                _log.info(f"Journal found: {journal_path} ({len(journal_text):,} chars)")

        return {
            'corpusText':       corpus_text,
            'dictText':         dict_text,
            'participantsText': participants_text,
            'journalText':      journal_text,
            'corpusPath':       corpus_path,
            'dictPath':         dict_path,
            'participantsPath': participants_path,
            'journalPath':      journal_path,
            'missing':          missing,
            'oversize':         oversize,      # B-116
            'prefix':           prefix,
        }

    def zip_export(self, source_folder, dest_zip_path):
        """Zip the immediate contents of source_folder into dest_zip_path.
        Only top-level files are included (no sub-directories).
        Overwrites an existing zip at dest_zip_path."""
        try:
            with zipfile.ZipFile(dest_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for fname in os.listdir(source_folder):
                    fpath = os.path.join(source_folder, fname)
                    if os.path.isfile(fpath):
                        zf.write(fpath, fname)
            _log.info(f"zip_export: {source_folder!r} → {dest_zip_path!r}")
            return True
        except Exception as exc:
            _log.error(f"zip_export failed: {exc}")
            raise

    # ── D22/A. NLLB server lifecycle ────────────────────────────────────────
    # These methods let the GUI start, stop, and query the local NLLB server
    # (corpus_annotate.py --serve) without needing a terminal.
    # Process ownership: only subprocesses started via start_nllb_server() are
    # tracked here; externally-started servers are invisible to these methods
    # (but the JS health-check still detects them via HTTP ping).

    # @fn _venv_python
    def _venv_python(self):
        """
        Path to the project venv's interpreter, or None when there isn't one.

        D29 P1: this used to be hardcoded to `.venv/bin/python`, which is the
        POSIX layout only. On Windows the interpreter is `.venv\\Scripts\\python.exe`,
        so the check always failed there, execution fell back to sys.executable, the app's own interpreter, which has no NLLB packages, and the server
        died instantly with an ImportError nobody could see.
        """
        candidates = (
            os.path.join(ROOT, '.venv', 'Scripts', 'python.exe'),   # Windows
            os.path.join(ROOT, '.venv', 'bin', 'python'),           # macOS / Linux
        )
        for c in candidates:
            if os.path.isfile(c):
                return c
        return None

    # @fn _probe_port
    def _probe_port(self, port):
        """
        Who, if anyone, owns this port?

        Returns:
          'free', nothing is listening; go ahead
          'ours', an NLLB translation server is already there
          'foreign', a real listener that is not ours
          'busy_unknown', bind refused but nobody answered; cause unclear

        B-017: the first version of this got two things wrong and made the app
        WORSE than before it existed.

        1. It bound WITHOUT SO_REUSEADDR while the server it gates is an
           `http.server.HTTPServer`, which sets `allow_reuse_address = 1`. The
           probe was therefore STRICTER than the thing it was checking for: a
           port in TIME_WAIT, normal for seconds after a server with live
           connections shuts down, and the GUI's own health checks guarantee
           live connections, refused the probe's bind while the real server
           would have bound it happily.
        2. It reported 'foreign' when the bind failed and nothing answered HTTP.
           That combination is the TIME_WAIT signature (no listener at all), not
           a foreign listener, and it caused start_nllb_server to refuse a launch
           that would have succeeded.

        Observed 2026-08-23: the app stopped its server cleanly at 21:59:49 and
        the next launch called the port 'foreign' 17 seconds later, with nothing
        listening. A gate must never be more restrictive than what it gates.
        """
        import json as _json
        import socket
        import urllib.error     # explicit: relying on urllib.request's import
        import urllib.request   # side effects for urllib.error is fragile

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # Match HTTPServer.allow_reuse_address so this asks the same question the
        # server will ask, rather than a harder one.
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', int(port)))
            return 'free'
        except OSError:
            pass
        finally:
            s.close()

        # Occupied by a live listener, ask whether it is one of ours.
        try:
            with urllib.request.urlopen(f'http://localhost:{int(port)}/', timeout=2) as r:
                body = _json.loads(r.read().decode('utf-8', 'replace'))
            if body.get('service') == 'lingcot-nllb':
                return 'ours'
            return 'foreign'
        except urllib.error.HTTPError:
            # Something spoke HTTP but not our marker, a foreign service, or an
            # NLLB server from a build before GET / existed (it answers 501).
            return 'foreign'
        except Exception:
            # Nothing answered. With SO_REUSEADDR set, a refused bind and no
            # listener is genuinely ambiguous, so do not claim a conflict.
            return 'busy_unknown'

    # @fn _port_holder
    def _port_holder(self, port):
        """
        Best-effort name of whatever holds the port, for an actionable message.
        POSIX only, never fatal, empty string when it cannot be determined.
        """
        if os.name == 'nt':
            return ''
        try:
            out = subprocess.run(['lsof', '-nP', f'-iTCP:{int(port)}', '-sTCP:LISTEN'],
                                 capture_output=True, text=True, timeout=3).stdout
            lines = [l for l in out.splitlines() if l and not l.startswith('COMMAND')]
            if not lines:
                return ''
            parts = lines[0].split()
            return f"{parts[0]} (pid {parts[1]})" if len(parts) > 1 else parts[0]
        except Exception:
            return ''

    # @fn _nllb_log_tail
    def _nllb_log_tail(self, max_lines=25):
        """
        Last few lines of this run's server output, for showing the user WHY the
        server is not answering. Returns '' when there is nothing to show.

        Kept small deliberately: the point is to surface the exception line, not
        to mirror the whole file into the GUI.
        """
        if not self._nllb_log_path or not os.path.isfile(self._nllb_log_path):
            return ''
        try:
            with open(self._nllb_log_path, 'r', encoding='utf-8', errors='replace') as fh:
                lines = fh.read().splitlines()
            return '\n'.join(lines[-max_lines:]).strip()
        except Exception as exc:
            _log.warning(f"_nllb_log_tail failed: {exc}")
            return ''

    def start_nllb_server(self, port=5001):
        """
        Start corpus_annotate.py --serve as a managed background subprocess.
        Safe to call when already running, returns current status instead.
        The process is tracked in self._nllb_proc; stdout+stderr are discarded
        (the HTTP endpoint is the health signal, not the log output).

        Returns a dict: { status: 'starting'|'running'|'error', pid?, message? }
        """
        # Already running?
        if self._nllb_proc and self._nllb_proc.poll() is None:
            return {'status': 'running', 'pid': self._nllb_proc.pid}

        # D29 P1b, check the port BEFORE launching something that cannot bind.
        owner = self._probe_port(port)
        if owner == 'ours':
            _log.info(f"start_nllb_server: an NLLB server already owns port {port} — using it")
            return {'status': 'running', 'adopted': True,
                    'message': f'An NLLB server is already running on port {port}.'}
        if owner == 'foreign':
            holder = self._port_holder(port)
            _log.error(
                f"start_nllb_server: port {port} is held by "
                f"{holder or 'something that is not an NLLB server'}. "
                f"Stop it, or change the server URL in Translation Settings."
            )
            return {'status': 'error', 'port_conflict': True, 'port': int(port),
                    'holder': holder,
                    'message': (f'Port {port} is already in use'
                                + (f' by {holder}' if holder else '') + '. '
                                'Stop it, or change the port in Translation Settings.')}
        if owner == 'busy_unknown':
            # B-017: bind refused but nothing answered, most often a socket in
            # TIME_WAIT from our own server moments ago. The real server sets
            # SO_REUSEADDR and will very likely bind fine, so proceed and let the
            # launch report its own error if it does not.
            _log.info(
                f"start_nllb_server: port {port} refused a test bind but nothing is "
                f"answering there — proceeding (likely TIME_WAIT from a recent stop)."
            )

        script = os.path.join(BASE, 'scripts', 'corpus_annotate.py')
        if not os.path.isfile(script):
            _log.error(f"start_nllb_server: script not found at {script}")
            return {'status': 'error', 'message': 'corpus_annotate.py not found'}

        # Prefer the venv Python so all NLLB packages are available.
        venv_py = self._venv_python()
        python  = venv_py or sys.executable
        if not venv_py:
            _log.warning(
                "start_nllb_server: no venv interpreter found under .venv/ — "
                f"falling back to {sys.executable}, which may not have the NLLB packages."
            )

        # D29 P1, capture the server's output instead of discarding it.
        #
        # This used to be stdout=DEVNULL, stderr=DEVNULL. NLLBBackend.__init__
        # raises an informative exception for every one of its failure modes
        # (packages missing, model directory missing, no nllb-200-* weights,
        # tokenizer missing) and every one of them went to /dev/null. The GUI
        # then showed the same "server down" for all of them, which is why the
        # reported linking failure could not be diagnosed at all.
        try:
            logs_dir = _Path(ROOT) / 'logs'
            logs_dir.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime('%Y-%m-%d_%H%M%S')
            self._nllb_log_path = str(logs_dir / f'nllb_server_{ts}.log')
            self._nllb_log_fh   = open(self._nllb_log_path, 'w', encoding='utf-8')
            # Record what we are about to run: which interpreter was chosen is
            # the single most useful line when a compiled wheel stops importing
            # (e.g. after the base Python is upgraded underneath the venv).
            self._nllb_log_fh.write(
                f"# LingCoT NLLB server launch {ts}\n"
                f"# interpreter : {python}\n"
                f"# from venv   : {bool(venv_py)}\n"
                f"# script      : {script}\n"
                f"# port        : {int(port)}\n"
                f"# cwd         : {ROOT}\n\n"
            )
            self._nllb_log_fh.flush()
        except Exception as exc:
            # Never let logging failure stop the server from starting.
            _log.warning(f"start_nllb_server: could not open capture log: {exc}")
            self._nllb_log_path = None
            self._nllb_log_fh   = None

        out = self._nllb_log_fh if self._nllb_log_fh else subprocess.DEVNULL
        try:
            self._nllb_proc = subprocess.Popen(
                [python, script, '--serve', '--port', str(int(port))],
                stdout=out,
                stderr=subprocess.STDOUT,   # one stream, chronological order preserved
                cwd=ROOT,
            )
            _log.info(
                f"NLLB server started — pid {self._nllb_proc.pid}, port {port}, "
                f"interpreter {python}, output → {self._nllb_log_path or 'discarded'}"
            )
            # An import error or a missing model kills the process in well under a
            # second. Waiting briefly turns the commonest failures into an answer
            # right now, instead of 120 seconds of polling that ends in "down".
            try:
                code = self._nllb_proc.wait(timeout=1.5)
            except subprocess.TimeoutExpired:
                code = None
            if code is not None:
                tail = self._nllb_log_tail()
                _log.error(
                    f"NLLB server exited immediately (code {code}). "
                    f"Output: {self._nllb_log_path}\n{tail}"
                )
                self._close_nllb_log()
                self._nllb_proc = None
                return {'status': 'error', 'exit_code': code,
                        'log_path': self._nllb_log_path, 'stderr_tail': tail,
                        'message': f'server exited immediately (code {code})'}
            return {'status': 'starting', 'pid': self._nllb_proc.pid,
                    'log_path': self._nllb_log_path}
        except Exception as exc:
            _log.error(f"start_nllb_server failed: {exc}")
            self._close_nllb_log()
            self._nllb_proc = None
            return {'status': 'error', 'message': str(exc)}

    # @fn _close_nllb_log
    def _close_nllb_log(self):
        """Close the capture file handle if we hold one. Path is kept so the
        tail can still be read after the process is gone."""
        if self._nllb_log_fh:
            try:
                self._nllb_log_fh.close()
            except Exception:
                pass
            self._nllb_log_fh = None

    def stop_nllb_server(self):
        """
        Stop the managed NLLB server subprocess.
        If the process was not started by us (self._nllb_proc is None), this is
        a no-op, externally-started servers are not killed.

        Returns { status: 'stopped' }.
        """
        if self._nllb_proc:
            pid = self._nllb_proc.pid
            try:
                self._nllb_proc.terminate()
                try:
                    self._nllb_proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self._nllb_proc.kill()
                    self._nllb_proc.wait()
            except Exception as exc:
                _log.warning(f"stop_nllb_server: error terminating pid {pid}: {exc}")
            finally:
                self._nllb_proc = None
                self._close_nllb_log()
            _log.info(f"NLLB server stopped (pid {pid})")
        return {'status': 'stopped'}

    def get_server_status(self):
        """
        Check whether the managed subprocess is still alive.
        Does NOT check the HTTP endpoint. JS does that via its own fetch.

        Returns { status, pid?, exit_code?, log_path?, stderr_tail? } where
        status is 'running' | 'crashed' | 'stopped'.

        'running' means the process has not exited; the HTTP endpoint may still
        be loading the model (typical load time: 15–30 s on a 4-core laptop).
        'crashed' means we started it and it died, exit_code and stderr_tail
        say why, which before D29 P1 was information the app threw away.
        """
        if self._nllb_proc:
            code = self._nllb_proc.poll()
            if code is None:
                return {'status': 'running', 'pid': self._nllb_proc.pid,
                        'log_path': self._nllb_log_path}
            else:
                # D29 P1: a dead server is the interesting case, say WHY.
                tail = self._nllb_log_tail()
                _log.error(
                    f"NLLB server process exited (code {code}). "
                    f"Output: {self._nllb_log_path}\n{tail}"
                )
                self._close_nllb_log()
                self._nllb_proc = None
                return {'status': 'crashed', 'exit_code': code,
                        'log_path': self._nllb_log_path, 'stderr_tail': tail}
        # B-018: no stderr_tail here. This branch is reached when we do not own a
        # running process, overwhelmingly because the user just pressed Stop.
        # Returning the tail made a deliberate stop indistinguishable from a
        # crash to the caller, and the GUI duly rendered the whole (successful)
        # server log inside a red "the server process exited" panel.
        # log_path is still returned: the file is worth linking to, it just is
        # not evidence of a failure.
        return {'status': 'stopped', 'log_path': self._nllb_log_path}

    def save_dialog(self, suggested_name='', file_types=None, directory=None):
        """Show a native OS file-save dialog.
        Returns the chosen path as a string, or None if cancelled.
        Note: PyWebView returns different types per platform, normalised here.

        B-026 instrumentation. The Export PDF flow hangs somewhere at or inside
        this call: the session log showed no line from here at all, and the JS
        thread stayed blocked (native checkboxes still toggled, those are handled
        in WKWebView's content process, but no JS handler ran, so the panel could
        not be closed).

        pywebview's Cocoa backend releases its semaphore as the LAST statement of
        an inner create_dialog(); if anything in the SAVE branch raises, the
        release never happens and the calling thread waits on acquire() forever.
        The bracketing log lines below distinguish the three possibilities:
        never called · called and never returned · returned and something after
        it failed.

        `directory` is now passed explicitly, matching open_dialog(). The SAVE
        branch skips setDirectoryURL_ when it is empty, and an NSSavePanel with no
        initial directory is the one documented difference from the OPEN panel,
        which works."""
        ft = tuple(file_types) if file_types else (
            'JSONL (*.jsonl)',
            'All files (*.*)',
        )
        if directory is None:
            directory = CORPORA_DIR if os.path.isdir(CORPORA_DIR) \
                        else (WORKSPACE if os.path.isdir(WORKSPACE)
                              else os.path.expanduser('~'))
        directory = str(directory)
        _log.info(f"save_dialog: ENTER name={suggested_name!r} types={ft} dir={directory!r}")
        try:
            result = webview.windows[0].create_file_dialog(
                _DIALOG_SAVE,
                directory=directory,
                save_filename=str(suggested_name),
                file_types=ft,
            )
            _log.info(f"save_dialog: RETURNED {result!r}")
            # Normalise: some platforms return a string, some a tuple/list
            if isinstance(result, (list, tuple)):
                path = result[0] if result else None
            else:
                path = result or None
            if path:
                _log.debug(f"save_dialog: user chose {path!r}")
            else:
                _log.info("save_dialog: cancelled or empty result")
            return path
        except Exception as exc:
            _log.error(f"save_dialog failed: {exc}", exc_info=True)
            raise


    def export_dict_pdf(self, options_json: str) -> dict:
        """Export the dictionary (or filtered subset) to a PDF file.

        Called from JS as: await window.pywebview.api.export_dict_pdf(JSON.stringify(options))

        options_json keys (all strings / JSON-serialisable):
          title, document title
          entries, list of dict entry objects (already filtered + sorted)
          sentences, {sentence_id: sentence_object} for corpus pinned examples
          fields, {field_key: bool}, which fields to include
          out_path, absolute destination path chosen via JS-side save_dialog call

        Returns {ok: bool, path?: str, error?: str, install_hint?: str}
        """
        import json as _json
        try:
            options = _json.loads(options_json)
        except Exception as exc:
            return {"ok": False, "error": f"Invalid options JSON: {exc}"}

        # Lazy-import the export module so missing fpdf2 only raises here,
        # not on app startup.
        try:
            import importlib.util as _ilu
            _spec = _ilu.spec_from_file_location(
                "dict_export",
                str(SCRIPTS_DIR / "dict_export.py"),
            )
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
        except Exception as exc:
            # Logged, not just returned. This is the path a missing fpdf2 takes,
            # and it used to fail silently, the button appeared to do nothing and
            # the session log said nothing at all (B-025 made it reachable by
            # pruning the pdf tier out of the venv).
            _log.error(f"export_dict_pdf: could not load dict_export module: {exc}")
            hint = ("python3 source/build_env.py --tier pdf"
                    if "fpdf" in str(exc).lower() or "bidi" in str(exc).lower() else None)
            return {"ok": False,
                    "error": f"Could not load dict_export module: {exc}",
                    **({"install_hint": hint} if hint else {})}

        try:
            result = _mod.export_dict_pdf(options)
            if result.get("ok"):
                _log.info(f"export_dict_pdf: wrote {result.get('path')}")
            else:
                _log.warning(f"export_dict_pdf failed: {result.get('error')}")
            return result
        except Exception as exc:
            _log.error(f"export_dict_pdf exception: {exc}")
            return {"ok": False, "error": str(exc)}


def main():
    # ── Log startup environment ───────────────────────────────────────────────
    try:
        wv_version = webview.__version__
    except AttributeError:
        wv_version = 'unknown'

    # `webview` exposes no __version__, so the attribute probe above always fell
    # through to 'unknown'. The installed distribution knows, and a log that
    # cannot say which pywebview it ran under is a log that cannot explain a
    # platform-specific hang. B-026 was chased through pywebview internals for
    # two rounds before the real cause turned out to be elsewhere.
    if wv_version == 'unknown':
        try:
            import importlib.metadata as _md
            wv_version = _md.version('pywebview')
        except Exception:
            pass

    _log.info(
        f"App starting — LingCoT v{APP_VERSION} | Python {sys.version.split()[0]} | "
        f"PyWebView {wv_version} | {platform.system()} {platform.release()}"
    )

    api = Api()
    webview.create_window(
        title='LingCoT',
        url=os.path.join(BASE, 'LingCoT.html'),
        js_api=api,
        width=1280,
        height=820,
        min_size=(900, 600),
        background_color='#f5f4f0',   # matches --bg CSS variable
        text_select=True,             # allow user to select/copy text (WKWebView blocks it by default)
    )
    # D29 P1b. THE ROOT CAUSE of the reported NLLB failure.
    #
    # Nothing ever stopped a server this app started. subprocess children are not
    # killed when the parent exits, so quitting LingCoT left an NLLB server
    # holding port 5001 forever; the next launch's Start died on
    # `OSError: [Errno 48] Address already in use`, and the GUI, which only
    # checked that SOMETHING answered on the port, showed a green dot for the
    # orphan while translations went nowhere.
    #
    # Registered both ways on purpose: `closed` fires on a normal window close,
    # atexit covers the paths that never raise it.
    def _shutdown_nllb():
        try:
            if api._nllb_proc:
                _log.info("Shutting down the managed NLLB server before exit.")
                api.stop_nllb_server()
        except Exception as exc:
            _log.warning(f"NLLB shutdown on exit failed: {exc}")

    atexit.register(_shutdown_nllb)
    try:
        webview.windows[0].events.closed += _shutdown_nllb
    except Exception as exc:
        # Older pywebview, or no window yet, atexit still covers us.
        _log.debug(f"could not bind window closed event: {exc}")

    try:
        webview.start()
        # Report what this session actually recorded. `App exited cleanly.` used
        # to be unconditional, so a run that threw repeatedly signed off exactly
        # like one that did not, which is how B-008 stayed unnoticed in the logs
        # from 2026-05-29 until 2026-08-24. WARNING+ also reaches stderr, so this
        # line is visible in the terminal, not only in the log file.
        tally = getattr(_log, 'level_counter', None)
        summary = tally.summary() if tally else ''
        if summary:
            _log.warning(
                f"App exited — THIS SESSION RECORDED {summary}. "
                f"Review the log above, or run `node dev/log_triage.js`."
            )
        else:
            _log.info("App exited cleanly — no warnings or errors recorded.")
    except Exception as exc:
        _log.critical(f"webview.start() crashed: {exc}", exc_info=True)
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        _log.critical(f"Unhandled exception in main: {exc}", exc_info=True)
        traceback.print_exc()
        sys.exit(1)
