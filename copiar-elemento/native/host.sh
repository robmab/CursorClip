#!/usr/bin/env bash
# Ayudante nativo de CursorClip para macOS y Linux: el mismo trabajo que host.ps1, solo con lo que trae el sistema.
# Guarda el .md en $TMPDIR/.cursorclip (carpeta oculta, hasta 50, los más antiguos fuera) y lo pone en el portapapeles
# como fichero: macOS con osascript; Linux con wl-copy o xclip si están (si no, la extensión copia @"ruta").
# Protocolo de Chrome: 4 bytes de longitud (little-endian) + JSON en UTF-8, por stdin y stdout.
set -u
export LC_ALL=C
MAX_FILES=50
TMP="${TMPDIR:-/tmp}"
DIR="${TMP%/}/.cursorclip"

send() {
  local len
  len=$(printf '%s' "$1" | wc -c | tr -d ' ')
  printf "$(printf '\\%03o\\%03o\\%03o\\%03o' $((len & 255)) $(((len >> 8) & 255)) $(((len >> 16) & 255)) $(((len >> 24) & 255)))"
  printf '%s' "$1"
}

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

# Los valores que manda la extensión no llevan comillas (nombre saneado y base64), así que basta con sed
field() { printf '%s' "$BODY" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }

# Un mensaje por proceso: longitud con dd (lee exactamente 4 bytes) y el resto es el cuerpo
LEN=$(dd bs=1 count=4 2>/dev/null | od -An -tu4 | tr -d ' \n')
[ -n "$LEN" ] || exit 0
BODY=$(head -c "$LEN")

case "$(field type)" in
  ping) send '{"ok":true,"version":1}'; exit 0 ;;
  save) ;;
  *) send '{"ok":false,"error":"mensaje desconocido"}'; exit 0 ;;
esac

fail() { send "{\"ok\":false,\"error\":\"$(json_escape "$1")\"}"; exit 0; }

mkdir -p "$DIR" || fail "no se puede crear $DIR"

NAME=$(field name | tr -d '\n' | tr -c 'A-Za-z0-9_.#-' '_')
[ -n "$NAME" ] || NAME="elemento.md"
case "$NAME" in *.md) ;; *) NAME="$NAME.md" ;; esac
BASE="${NAME%.md}"

# Si el nombre ya está cogido: nombre_2.md, nombre_3.md…
FILE="$DIR/$NAME"
n=2
while [ -e "$FILE" ]; do FILE="$DIR/${BASE}_$n.md"; n=$((n + 1)); done

# base64 -d en Linux y macOS modernos; -D en macOS antiguos
if printf 'YQ==' | base64 -d >/dev/null 2>&1; then B64D='-d'; else B64D='-D'; fi
field b64 | base64 "$B64D" > "$FILE" 2>/dev/null || fail "no se pudo escribir el fichero"

# Se guardan los últimos MAX_FILES; los más antiguos fuera (los nombres van saneados, sin espacios)
ls -t "$DIR"/*.md 2>/dev/null | tail -n +$((MAX_FILES + 1)) | while IFS= read -r old; do rm -f "$old"; done

CLIP=false
case "$(uname -s)" in
  Darwin)
    osascript -e "set the clipboard to (POSIX file \"$FILE\")" >/dev/null 2>&1 && CLIP=true
    ;;
  Linux)
    URI="file://$(printf '%s' "$FILE" | sed 's/%/%25/g; s/#/%23/g; s/ /%20/g')"
    # Se quedan en segundo plano sirviendo el portapapeles: sin heredar nuestra salida, que es la de Chrome
    if [ -n "${WAYLAND_DISPLAY:-}" ] && command -v wl-copy >/dev/null 2>&1; then
      printf '%s\n' "$URI" | wl-copy -t text/uri-list >/dev/null 2>&1 && CLIP=true
    elif command -v xclip >/dev/null 2>&1; then
      printf '%s\n' "$URI" | xclip -selection clipboard -t text/uri-list >/dev/null 2>&1 && CLIP=true
    fi
    ;;
esac

send "{\"ok\":true,\"path\":\"$(json_escape "$FILE")\",\"clipboard\":$CLIP}"
