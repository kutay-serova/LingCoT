@echo off
:: LingCoT — launcher (Windows)
:: Double-click this file to open LingCoT.
:: Run setup.bat first if you haven't already.

cd /d "%~dp0"

:: ── Check that setup has been run ─────────────────────────────────────────────
if not exist ".venv\Scripts\pythonw.exe" (
    echo Setup is not complete.
    echo Please double-click setup.bat first, then try again.
    pause
    exit /b 1
)

:: ── Launch using the local Python environment (pythonw = no console window) ───
start "" ".venv\Scripts\pythonw.exe" source\LingCoT.pyw
