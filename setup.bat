@echo off
:: LingCoT — first-time setup (Windows)
:: Run once. Installs all dependencies (app + corpus scripts) into a local .venv\ folder.
:: To add offline NLLB translation later, run setup_NLLB.bat.

cd /d "%~dp0"

echo =============================================
echo  LingCoT ^— first-time setup
echo =============================================
echo.

:: ── Check for Python ─────────────────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python 3 is not installed on this machine.
    echo.
    echo Opening the Python download page in your browser...
    echo IMPORTANT: Check "Add Python to PATH" during installation.
    start https://www.python.org/downloads/
    echo.
    echo Install Python 3, then run setup.bat again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo Found: %%v
echo.

:: ── Run the unified environment builder ──────────────────────────────────────
:: build_env.py creates .venv\ and installs the full minimal-tier dependency set:
:: pywebview (desktop app), ingestion libraries, online translation, and utilities.
:: Uses uv if available (faster, hash-pinned); falls back to venv + pip.
echo Setting up Python environment...
echo.
python source\build_env.py
if %errorlevel% neq 0 (
    echo.
    echo =============================================
    echo  Setup failed.
    echo  Check the output above for details.
    echo =============================================
    echo.
    pause
    exit /b 1
)

echo.
echo =============================================
echo  Setup complete!
echo  Double-click LingCoT.bat to launch.
echo.
echo  For offline NLLB translation, run
echo  setup_NLLB.bat next.
echo =============================================
echo.
pause
