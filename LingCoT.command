#!/bin/bash
# LingCoT — launcher (macOS / Linux)
# Double-click this file to open LingCoT.
# Run setup.command first if you haven't already.

# Always run from the folder this script lives in
cd "$(dirname "$0")"

# ── Check that setup has been run ────────────────────────────────────────────
if [ ! -f ".venv/bin/python" ]; then
    echo "Setup is not complete."
    echo "Please double-click setup.command first, then try again."
    read -p "Press Enter to close..."
    exit 1
fi

# ── Launch using the local Python environment ─────────────────────────────────
.venv/bin/python source/LingCoT.pyw
