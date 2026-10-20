#!/usr/bin/env bash
# Registra el ayudante de CursorClip en Chrome, Chromium, Brave y Edge (macOS y Linux, solo tu usuario)
# Si mueves la carpeta de la extensión, vuelve a ejecutarlo
set -eu
HOST="com.copiar_elemento.helper"
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/native/host.sh"
ORIGIN=$(sed -n 's/.*"\(chrome-extension:\/\/[a-p]*\/\)".*/\1/p' "$HERE/native/host.json")

chmod +x "$SCRIPT"

case "$(uname -s)" in
  Darwin)
    BASE="$HOME/Library/Application Support"
    BROWSERS="Google/Chrome|Chromium|BraveSoftware/Brave-Browser|Microsoft Edge"
    ;;
  Linux)
    BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
    BROWSERS="google-chrome|chromium|BraveSoftware/Brave-Browser|microsoft-edge"
    ;;
  *) echo "Unsupported system: use install.bat on Windows"; exit 1 ;;
esac

# En Mac/Linux Chrome exige ruta absoluta en el manifiesto, así que se genera aquí
MANIFEST=$(cat <<EOF
{
  "name": "$HOST",
  "description": "CursorClip helper: saves the .md and puts it on the clipboard as a file",
  "path": "$SCRIPT",
  "type": "stdio",
  "allowed_origins": ["$ORIGIN"]
}
EOF
)

installed=0
IFS='|'
for b in $BROWSERS; do
  # Solo en los navegadores que existen; Chrome siempre, por si aún no se ha abierto nunca
  if [ -d "$BASE/$b" ] || [ "$b" = "Google/Chrome" ] || [ "$b" = "google-chrome" ]; then
    mkdir -p "$BASE/$b/NativeMessagingHosts"
    printf '%s\n' "$MANIFEST" > "$BASE/$b/NativeMessagingHosts/$HOST.json"
    echo "Helper installed for: $b"
    installed=$((installed + 1))
  fi
done

if [ "$(uname -s)" = "Linux" ] && ! command -v wl-copy >/dev/null 2>&1 && ! command -v xclip >/dev/null 2>&1; then
  echo "Note: without wl-copy or xclip the file is still saved, but its @path is copied instead of the file."
fi
echo "Go back to the extension options and click \"Check again\"."
