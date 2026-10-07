#!/bin/bash
# LingCoT — first-time setup (macOS / Linux)
# Run once. Installs all dependencies (app + corpus scripts) into a local .venv/ folder.
# To add offline NLLB translation later, run setup_NLLB.command.

# Always run from the folder this script lives in
cd "$(dirname "$0")"

echo "============================================="
echo " LingCoT — first-time setup"
echo "============================================="
echo ""

# ── Check for Python 3 ───────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "Python 3 is not installed on this machine."
    echo ""
    echo "Opening the Python download page in your browser..."
    open "https://www.python.org/downloads/" 2>/dev/null \
        || xdg-open "https://www.python.org/downloads/" 2>/dev/null
    echo "Install Python 3, then run setup.command again."
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

echo "Found: $(python3 --version)"
echo ""

# ── Run the unified environment builder ──────────────────────────────────────
# build_env.py creates .venv/ and installs the full minimal-tier dependency set:
# pywebview (desktop app), ingestion libraries, online translation, and utilities.
# Uses uv if available (faster, hash-pinned); falls back to venv + pip.
echo "Setting up Python environment..."
echo ""
python3 source/build_env.py
BUILD_STATUS=$?

echo ""
if [ $BUILD_STATUS -ne 0 ]; then
    echo "============================================="
    echo " Setup failed."
    echo " Check the output above for details."
    echo "============================================="
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

# ── macOS: clear the download flag, build LingCoT.app ───────────────────────
# A browser download marks every file in the zip, and macOS then blocks each
# script until it is approved in System Settings. Clearing the mark here means
# setup.command is the only file that needs that approval.
# LingCoT.app starts the app without a Terminal window.
LAUNCH_HINT="LingCoT.command"
if [ "$(uname)" = "Darwin" ]; then
    xattr -dr com.apple.quarantine . 2>/dev/null || true
    if bash source/scripts/make_mac_app.sh "$PWD" >/dev/null; then
        LAUNCH_HINT="LingCoT.app"
    else
        echo "Could not create LingCoT.app; LingCoT.command still works."
    fi
fi

echo "============================================="
echo " Setup complete!"
echo " Double-click $LAUNCH_HINT to launch."
echo ""
echo " For offline NLLB translation, run"
echo " setup_NLLB.command next."
echo "============================================="
echo ""
read -p "Press Enter to close..."
