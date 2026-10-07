#!/bin/bash
# Builds LingCoT.app in the LingCoT folder so the app starts without a Terminal
# window. Run by setup.command on macOS; safe to run again (the app is rebuilt).
#
#   bash source/scripts/make_mac_app.sh [LingCoT folder]
#
# The app is a folder with a launch script inside. Created on this machine, it
# carries no download quarantine flag, so macOS does not block it.

set -e
ROOT="$(cd "${1:-$(dirname "$0")/../..}" && pwd)"
APP="$ROOT/LingCoT.app"
VERSION="$(sed -n 's/^__version__ = "\([^"+]*\).*/\1/p' "$ROOT/source/version.py")"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>LingCoT</string>
  <key>CFBundleDisplayName</key><string>LingCoT</string>
  <key>CFBundleIdentifier</key><string>org.lingcot.app</string>
  <key>CFBundleExecutable</key><string>LingCoT</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${VERSION:-0}</string>
  <key>CFBundleVersion</key><string>${VERSION:-0}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# The launcher. ROOT is written in as an absolute path so the app also works
# after being dragged to Applications or the Dock.
{
  echo '#!/bin/bash'
  echo '# LingCoT launcher, written by setup.command (source/scripts/make_mac_app.sh).'
  printf 'ROOT=%q\n' "$ROOT"
  cat <<'LAUNCH'

# Shows a macOS dialog. Arguments: message, then button labels; prints the
# button pressed. Text goes in as arguments, so no quoting rules apply to it.
dialog() {
  /usr/bin/osascript - "$@" <<'OSA' 2>/dev/null
on run argv
  set msg to item 1 of argv
  set btns to rest of argv
  set r to display dialog msg with title "LingCoT" buttons btns default button (count of btns) with icon caution
  return button returned of r
end run
OSA
}

if [ ! -d "$ROOT/source" ]; then
  dialog "The LingCoT folder was not found at:
$ROOT

If it was moved, double-click setup.command in its new location." "OK"
  exit 1
fi

if [ ! -x "$ROOT/.venv/bin/python" ]; then
  answer="$(dialog "Setup is not complete. Run setup.command in the LingCoT folder first." "Cancel" "Open Setup")"
  [ "$answer" = "Open Setup" ] && /usr/bin/open "$ROOT/setup.command"
  exit 1
fi

cd "$ROOT"
mkdir -p logs
"$ROOT/.venv/bin/python" source/LingCoT.pyw 2> "$ROOT/logs/launcher_stderr.log"
code=$?
if [ $code -ne 0 ]; then
  answer="$(dialog "LingCoT stopped with an error (code $code). The logs folder has the details." "OK" "Show Logs")"
  [ "$answer" = "Show Logs" ] && /usr/bin/open "$ROOT/logs"
fi
exit $code
LAUNCH
} > "$APP/Contents/MacOS/LingCoT"
chmod +x "$APP/Contents/MacOS/LingCoT"

# Ask Finder to pick up the new bundle.
touch "$APP"
echo "Created $APP"
