#!/usr/bin/env python3
"""
nllb_diag_test.py — D29 P1: the NLLB server's failure must be reportable
Run:  python3 dev/tests/nllb_diag_test.py

WHY THIS EXISTS
---------------
`start_nllb_server` launched the server with stdout=DEVNULL, stderr=DEVNULL.
NLLBBackend.__init__ raises an informative exception for every one of its four
failure modes — packages missing, model directory missing, no nllb-200-* weights
directory, tokenizer missing — and every one of them went to /dev/null.
`get_server_status` reported only running/stopped. So the user experience of any
failure was identical: "Loading model…", 120 seconds of polling, "server down".

This exercises the capture path against a stub script that fails the way the real
one does, without needing the NLLB packages, the 600 MB model, or macOS.
"""

import importlib.util
import inspect
import os
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC  = HERE.parent.parent / "source"

_pass = 0
_fail = 0


def check(ok, label, detail=""):
    global _pass, _fail
    if ok:
        _pass += 1
        print(f"  ok   {label}")
    else:
        _fail += 1
        print(f"  FAIL {label}")
        if detail:
            print(textwrap.indent(str(detail), "         "))


def load_api_class(root: Path):
    """
    Import LingCoT.pyw's Api class with `webview` AND `log_setup` stubbed out, so
    this runs headlessly, without pywebview installed, and — importantly —
    without writing into the project's real logs/ directory.

    The log_setup stub is not optional. LingCoT.pyw builds its session logger at
    import time from the real ROOT, so an unstubbed import creates genuine
    `logs/app_*.log` files and writes this test's deliberate failures into them
    as ERROR lines. `dev/tests/log_triage.js` then reports those synthetic errors as
    unacknowledged findings and fails the suite — a test corrupting the evidence
    another guard depends on. Found the hard way on 2026-08-24.
    """
    import logging
    import types

    fake_logs = types.ModuleType("log_setup")

    def _stub_session_logger(project_root, prefix="app"):
        lg = logging.getLogger(f"nllb_diag_test.{prefix}.{id(project_root)}")
        lg.handlers.clear()
        lg.addHandler(logging.NullHandler())
        lg.propagate = False
        return lg

    fake_logs.setup_session_logger = _stub_session_logger
    fake_logs.setup_append_logger = _stub_session_logger
    sys.modules["log_setup"] = fake_logs

    fake = types.ModuleType("webview")

    class _FD:
        OPEN = 10
        SAVE = 20

    fake.FileDialog = _FD
    fake.windows = []
    fake.create_window = lambda *a, **k: None
    fake.start = lambda *a, **k: None
    sys.modules["webview"] = fake

    # `.pyw` is not a recognised source suffix, so spec_from_file_location
    # returns None unless the loader is named explicitly.
    import importlib.machinery

    loader = importlib.machinery.SourceFileLoader("lingcot_app", str(SRC / "LingCoT.pyw"))
    spec = importlib.util.spec_from_file_location("lingcot_app", SRC / "LingCoT.pyw", loader=loader)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # Point the module at our sandbox so it writes logs there, not into the repo.
    mod.ROOT = str(root)
    mod.BASE = str(root / "source")
    return mod


def make_sandbox(script_body: str) -> Path:
    """A minimal project tree whose scripts/corpus_annotate.py is our stub."""
    root = Path(tempfile.mkdtemp())
    (root / "source" / "scripts").mkdir(parents=True)
    (root / "logs").mkdir()
    (root / "source" / "scripts" / "corpus_annotate.py").write_text(script_body, encoding="utf-8")
    return root


print("\nD29 P1 — the server's failure reaches the caller\n")

# ── 1. A server that dies on an import error (the commonest real failure) ─────
root = make_sandbox(textwrap.dedent("""
    import sys
    sys.stderr.write("Traceback (most recent call last):\\n")
    sys.stderr.write("ModuleNotFoundError: No module named 'ctranslate2'\\n")
    sys.exit(1)
"""))
mod = load_api_class(root)
api = mod.Api()
res = api.start_nllb_server(port=5099)

check(res.get("status") == "error", "a server that dies is reported as an error, not 'starting'", res)
check(res.get("exit_code") == 1, "the exit code is reported", res.get("exit_code"))
check("ctranslate2" in (res.get("stderr_tail") or ""),
      "the actual exception text reaches the caller", res.get("stderr_tail"))
check(bool(res.get("log_path")) and os.path.isfile(res["log_path"]),
      "the full output is written to a file", res.get("log_path"))

captured = Path(res["log_path"]).read_text(encoding="utf-8")
check("# interpreter :" in captured,
      "the launch header records which interpreter was used",
      captured.splitlines()[:6])

# ── 2. A server that stays up must NOT be reported as failed ─────────────────
root2 = make_sandbox(textwrap.dedent("""
    import time
    time.sleep(30)
"""))
mod2 = load_api_class(root2)
api2 = mod2.Api()
res2 = api2.start_nllb_server(port=5098)
check(res2.get("status") == "starting", "a healthy server is reported as starting", res2)
st2 = api2.get_server_status()
check(st2.get("status") == "running", "and its status is 'running'", st2)
api2.stop_nllb_server()
check(api2.get_server_status().get("status") == "stopped", "stop() leaves it stopped")

# ── 3. get_server_status must explain a process that died AFTER starting ─────
root3 = make_sandbox(textwrap.dedent("""
    import sys, time
    time.sleep(2.0)
    sys.stderr.write("RuntimeError: NLLB model directory not found\\n")
    sys.exit(3)
"""))
mod3 = load_api_class(root3)
api3 = mod3.Api()
res3 = api3.start_nllb_server(port=5097)
check(res3.get("status") == "starting", "survives the 1.5s early-exit window", res3)
api3._nllb_proc.wait(timeout=10)
st3 = api3.get_server_status()
check(st3.get("status") == "crashed", "a later death is reported as 'crashed'", st3)
check(st3.get("exit_code") == 3, "with its exit code", st3.get("exit_code"))
check("model directory not found" in (st3.get("stderr_tail") or ""),
      "and its reason", st3.get("stderr_tail"))

# ── 4. Cross-platform venv resolution (the latent Windows bug) ────────────────
root4 = make_sandbox("import time; time.sleep(5)")
mod4 = load_api_class(root4)
api4 = mod4.Api()
check(api4._venv_python() is None, "no venv → None, so the caller can warn")

(root4 / ".venv" / "bin").mkdir(parents=True)
posix_py = root4 / ".venv" / "bin" / "python"
posix_py.write_text("#!/bin/sh\n")
check(api4._venv_python() == str(posix_py), "POSIX layout (.venv/bin/python) found")

root5 = make_sandbox("import time; time.sleep(5)")
mod5 = load_api_class(root5)
api5 = mod5.Api()
(root5 / ".venv" / "Scripts").mkdir(parents=True)
win_py = root5 / ".venv" / "Scripts" / "python.exe"
win_py.write_text("")
check(api5._venv_python() == str(win_py),
      "Windows layout (.venv\\\\Scripts\\\\python.exe) found — was never checked before D29 P1")

# ── 5. D29 P1b — port ownership must be established BEFORE launching ─────────
print("\nD29 P1b — port conflicts are diagnosed, not stumbled into\n")

import http.server
import json as _json
import socket
import threading


def serve(handler_cls):
    """Start a throwaway HTTP server on a free port; returns (port, shutdown)."""
    srv = http.server.HTTPServer(('127.0.0.1', 0), handler_cls)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1], srv.shutdown


class OursHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = _json.dumps({'service': 'lingcot-nllb', 'version': 1}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


class ForeignHandler(http.server.BaseHTTPRequestHandler):
    """Stands in for whatever else might own the port — AirPlay Receiver, say."""
    def do_GET(self):
        self.send_response(403)
        self.end_headers()

    def log_message(self, *a):
        pass


root6 = make_sandbox("import time; time.sleep(30)")
mod6 = load_api_class(root6)
api6 = mod6.Api()

free_sock = socket.socket()
free_sock.bind(('127.0.0.1', 0))
free_port = free_sock.getsockname()[1]
free_sock.close()
check(api6._probe_port(free_port) == 'free', "an unused port reads as 'free'")

ours_port, stop_ours = serve(OursHandler)
check(api6._probe_port(ours_port) == 'ours',
      "an NLLB server on the port is recognised as ours (identity, not liveness)")
res6 = api6.start_nllb_server(port=ours_port)
check(res6.get('status') == 'running' and res6.get('adopted') is True,
      "starting against our own running server adopts it instead of launching a doomed process", res6)
stop_ours()

foreign_port, stop_foreign = serve(ForeignHandler)
check(api6._probe_port(foreign_port) == 'foreign',
      "a non-NLLB listener is 'foreign' — the old check called this 'server up'")
res7 = api6.start_nllb_server(port=foreign_port)
check(res7.get('status') == 'error' and res7.get('port_conflict') is True,
      "a foreign occupant is reported as a port conflict, not a crash", res7)
check(api6._nllb_proc is None,
      "and no doomed subprocess was launched")
stop_foreign()

# ── 6. B-017 — the probe must not be stricter than the server it gates ───────
print("\nB-017 — a gate must not be more restrictive than what it gates\n")

import http.server as _hs

check(_hs.HTTPServer.allow_reuse_address == 1,
      "HTTPServer sets SO_REUSEADDR — the premise this probe must match")

probe_src = inspect.getsource(mod6.Api._probe_port)
check("SO_REUSEADDR" in probe_src,
      "the probe sets SO_REUSEADDR too, so it asks the same question the server will")
check("busy_unknown" in probe_src,
      "a refused bind with nothing answering is 'busy_unknown', not 'foreign'")

# A port that a server just vacated (with live connections, so TIME_WAIT is
# likely) must not read as a conflict. Real TIME_WAIT is timing-dependent, so
# assert the states that matter rather than forcing the kernel's hand.
port7, stop7 = serve(OursHandler)
import urllib.request as _u
try:
    _u.urlopen(f"http://127.0.0.1:{port7}/", timeout=2).read()   # create a connection
except Exception:
    pass
check(api6._probe_port(port7) == 'ours', "a live server of ours still reads 'ours'")
stop7()
after = api6._probe_port(port7)
check(after in ('free', 'busy_unknown'),
      f"after shutdown the port reads free or busy_unknown, never 'foreign' (got {after!r})")
check(after != 'foreign',
      "a vacated port is never mistaken for a foreign occupant — the B-017 regression")

res8 = api6.start_nllb_server(port=port7)
check(res8.get('status') in ('starting', 'error') and not res8.get('port_conflict'),
      "and starting there is not refused as a port conflict", res8)
if api6._nllb_proc:
    api6.stop_nllb_server()

# ── 7. B-018 — a deliberate stop must not look like a crash ─────────────────
print("\nB-018 — stopping the server is not a failure\n")

root9 = make_sandbox(textwrap.dedent("""
    import time
    time.sleep(30)
"""))
mod9 = load_api_class(root9)
api9 = mod9.Api()
api9.start_nllb_server(port=5096)
api9.stop_nllb_server()

st9 = api9.get_server_status()
check(st9.get('status') == 'stopped', "after Stop, status is 'stopped'", st9)
check('stderr_tail' not in st9,
      "and carries NO stderr_tail — a healthy log is not evidence of a crash", st9)
check(st9.get('exit_code') is None,
      "and no exit_code, which is what rendered as '(code ?)'", st9)

# The GUI must key off status, not off "is there text to show".
html = (SRC / 'LingCoT.html').read_text(encoding='utf-8')
check("s.status === 'crashed' || s.status === 'error'" in html,
      "the GUI shows the diagnostic panel only for crashed/error, never for stopped")

# A real crash must still report fully — the fix must not silence genuine failures.
root10 = make_sandbox(textwrap.dedent("""
    import sys, time
    time.sleep(2.0)
    sys.stderr.write("RuntimeError: something genuinely broke\\n")
    sys.exit(9)
"""))
mod10 = load_api_class(root10)
api10 = mod10.Api()
api10.start_nllb_server(port=5095)
api10._nllb_proc.wait(timeout=10)
st10 = api10.get_server_status()
check(st10.get('status') == 'crashed', "a real crash is still 'crashed'", st10)
check(st10.get('exit_code') == 9 and 'genuinely broke' in (st10.get('stderr_tail') or ''),
      "and still carries its exit code and reason", st10)

print(f"\n{_pass} passed, {_fail} failed\n")
sys.exit(1 if _fail else 0)
