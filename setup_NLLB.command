#!/bin/bash
# LingCoT — NLLB offline translation setup (macOS / Linux)
# Run after setup.command. Downloads NLLB-200 and optimizes it for your CPU.
#
# What this does:
#   1. Upgrades .venv/ to the NLLB tier (adds ctranslate2, sentencepiece, torch, etc.)
#   2. Downloads the NLLB-200-distilled-600M model from HuggingFace (~1.2 GB download)
#      and converts it to a ~600 MB int8 CTranslate2 format in source/models/nllb/
#   3. Benchmarks your CPU and writes annotator_config.json with optimal settings
#
# Requires: setup.command must have been run first.

cd "$(dirname "$0")"

echo "============================================="
echo " LingCoT — NLLB offline translation setup"
echo "============================================="
echo ""

# ── Check that the base setup has been run ───────────────────────────────────
if [ ! -f ".venv/bin/python" ]; then
    echo "Base setup is not complete."
    echo "Please run setup.command first, then try again."
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

# ── Step 1: upgrade venv to NLLB tier + download model ───────────────────────
echo "Step 1/2 — Downloading NLLB packages and model..."
echo "(This is a large download and may take several minutes.)"
echo ""
.venv/bin/python3 source/setup.py --nllb
if [ $? -ne 0 ]; then
    echo ""
    echo "NLLB setup failed. Check your internet connection and try again."
    read -p "Press Enter to close..."
    exit 1
fi

echo ""

# ── Step 2: benchmark CPU and write optimized config ─────────────────────────
echo "Step 2/2 — Benchmarking your CPU for optimal NLLB settings..."
echo ""
.venv/bin/python3 source/scripts/corpus_optimize.py
if [ $? -ne 0 ]; then
    echo ""
    echo "Optimization failed. NLLB is still usable with default settings."
    echo ""
fi

echo "============================================="
echo " NLLB setup complete!"
echo ""
echo " Offline translation is now available in"
echo " LingCoT and via the corpus scripts."
echo ""
echo " To start the in-app translation server:"
echo "   .venv/bin/python3 source/scripts/corpus_annotate.py --serve --port 5001"
echo "============================================="
echo ""
read -p "Press Enter to close..."
