@echo off
:: LingCoT launcher (Windows)
:: Double-click this file to open LingCoT. Run setup.bat first.
::
:: Runs python.exe, not pythonw.exe, so this window stays open while LingCoT
:: runs. Errors that stop the app before its own log starts go to
:: logs\launcher_stderr.log, as on macOS, and are shown here.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Setup is not complete.
    echo Please double-click setup.bat first, then try again.
    pause
    exit /b 1
)

if not exist "logs" mkdir "logs"
title LingCoT
echo LingCoT is running. Closing this window also closes LingCoT.

".venv\Scripts\python.exe" source\LingCoT.pyw 2> "logs\launcher_stderr.log"
if %errorlevel% neq 0 (
    echo.
    echo LingCoT stopped with an error ^(code %errorlevel%^).
    echo Please include logs\launcher_stderr.log in your report:
    echo.
    type "logs\launcher_stderr.log"
    echo.
    pause
    exit /b 1
)
