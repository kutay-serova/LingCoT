"""
sysreq.py: minimum system requirements, checked before setup installs anything.

Used by build_env.py (base install, and the NLLB tier) and setup.py (NLLB model).
Each check returns a list of messages; an empty list means the system qualifies.
Kept to Python 3.6 syntax so it can run, and refuse, under an old interpreter.

Where the minimums come from:
  Python 3.9      pyproject.toml requires-python
  macOS 11        ctranslate2 wheels (macOS 11+); the app's CSS and JS need the
                  WebKit of Safari 14.1 or later
  Windows 10      WebView2 for Windows 7 and 8.1 stopped at version 109;
                  Python 3.13 and later do not install on 8.1
  64-bit          torch and ctranslate2 publish 64-bit wheels only
  NLLB, macOS     torch has no Intel macOS wheel for the versions in uv.lock;
                  it is needed once, to convert the model
  NLLB, Linux     torch and ctranslate2 wheels are manylinux_2_28 (glibc 2.28)
"""

import platform
import struct
import sys

MIN_PYTHON = (3, 9)
MIN_MACOS = (11, 0)
MIN_WINDOWS_MAJOR = 10
MIN_GLIBC_NLLB = (2, 28)

PYTHON_URL = "https://www.python.org/downloads/"


def _ver(text):
    """'11.6.2' -> (11, 6). Unparseable -> (0, 0)."""
    parts = []
    for p in str(text).split(".")[:2]:
        digits = "".join(c for c in p if c.isdigit())
        parts.append(int(digits) if digits else 0)
    while len(parts) < 2:
        parts.append(0)
    return tuple(parts)


def _macos_version():
    return _ver(platform.mac_ver()[0])


def _rosetta():
    """True when this Python is an Intel build running on Apple Silicon."""
    try:
        import subprocess
        out = subprocess.run(["sysctl", "-n", "sysctl.proc_translated"],
                             capture_output=True, text=True, timeout=5).stdout
        return out.strip() == "1"
    except Exception:
        return False


def _bits():
    return struct.calcsize("P") * 8


def check_base(sysname=None, py=None, macos=None, win_major=None, bits=None):
    """Problems that stop the app from installing or running. Arguments
    override detection, for tests."""
    sysname = sysname or platform.system()
    py = py or tuple(sys.version_info[:2])
    bits = bits or _bits()
    out = []
    if py < MIN_PYTHON:
        out.append("Python %d.%d or later is needed; this is Python %d.%d. "
                   "Install a current Python from %s and run setup again."
                   % (MIN_PYTHON + py + (PYTHON_URL,)))
    if bits < 64:
        out.append("A 64-bit system and Python are needed; this Python is %d-bit." % bits)
    if sysname == "Darwin":
        mv = macos or _macos_version()
        # Interpreters built against an older SDK report Big Sur and later as 10.16.
        if mv == (10, 16):
            mv = (11, 0)
        if mv < MIN_MACOS:
            out.append("macOS %d or later is needed; this Mac runs macOS %d.%d."
                       % (MIN_MACOS[0], mv[0], mv[1]))
    elif sysname == "Windows":
        major = win_major if win_major is not None else sys.getwindowsversion().major
        if major < MIN_WINDOWS_MAJOR:
            out.append("Windows %d or 11 is needed." % MIN_WINDOWS_MAJOR)
    return out


def check_nllb(sysname=None, machine=None, glibc=None, py=None, rosetta=None):
    """Problems specific to offline translation (NLLB), on top of check_base."""
    sysname = sysname or platform.system()
    machine = (machine or platform.machine()).lower()
    py = py or tuple(sys.version_info[:2])
    out = []
    if sysname == "Darwin" and machine in ("x86_64", "i386"):
        if rosetta is None:
            rosetta = _rosetta()
        if rosetta:
            out.append("This Python is an Intel build running under Rosetta. Offline "
                       "translation (NLLB) needs a native Apple Silicon Python: install "
                       "one from %s, then run setup.command and setup_NLLB.command again."
                       % PYTHON_URL)
            return out
        out.append("Offline translation (NLLB) needs an Apple Silicon Mac for now: "
                   "the model conversion depends on torch, which has no Intel macOS "
                   "build. Online translation (Google) works on this Mac.")
    if sysname == "Windows" and machine in ("arm64", "aarch64") and py >= (3, 11):
        out.append("Offline translation (NLLB) on Windows on ARM needs Python 3.10 "
                   "or earlier; torch has no ARM build for newer Python versions.")
    if sysname == "Linux":
        lib, ver = platform.libc_ver() if glibc is None else ("glibc", glibc)
        if lib == "glibc" and ver and _ver(ver) < MIN_GLIBC_NLLB:
            out.append("Offline translation (NLLB) needs glibc %d.%d or later "
                       "(Ubuntu 20.04, Debian 10, RHEL 8 or newer); this system has %s."
                       % (MIN_GLIBC_NLLB + (ver,)))
    return out


def report(problems, fail, info, log=None):
    """Print problems through the caller's output helpers; True when none."""
    for p in problems:
        fail(p)
        if log:
            log.error("system requirement not met: %s" % p)
    if problems:
        info("System requirements: README.md, section 1. Setup.")
    return not problems
