#!/usr/bin/env bash
# Quita el ayudante de CursorClip (macOS y Linux) y los .md temporales; la extensión vuelve al modo @ruta
set -u
HOST="com.copiar_elemento.helper"

case "$(uname -s)" in
  Darwin)
    BASE="$HOME/Library/Application Support"
    BROWSERS="Google/Chrome|Chromium|BraveSoftware/Brave-Browser|Microsoft Edge"
    ;;
  Linux)
    BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
    BROWSERS="google-chrome|chromium|BraveSoftware/Brave-Browser|microsoft-edge"
    ;;
  *) echo "Unsupported system: use uninstall.bat on Windows"; exit 1 ;;
esac

IFS='|'
for b in $BROWSERS; do rm -f "$BASE/$b/NativeMessagingHosts/$HOST.json"; done
TMP="${TMPDIR:-/tmp}"
rm -rf "${TMP%/}/.cursorclip"
echo "Helper uninstalled."
