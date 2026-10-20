// Atajos por defecto y utilidades compartidas entre content.js y la página de opciones
const SHORTCUT_DEFAULTS = {
  html: { ctrl: true, alt: true, shift: false, meta: false, code: 'KeyC', key: 'c', respectSelection: false },
  full: { ctrl: true, alt: false, shift: false, meta: false, code: 'KeyC', key: 'c', respectSelection: true },
};

// Cursores del modo selección (cursors/N.png); x,y es la punta y color el del resaltado, a juego.
// 'system' es la cruz del navegador; sin color se usa el rosa de siempre. El primero (el puntero del icono) es el de por defecto
const CURSORS = [
  { id: '14', x: 3, y: 3, hd: true },
  { id: '3', x: 0, y: 0, color: '#2b8ae6' },
  { id: '4', x: 2, y: 1, color: '#a8874f' },
  { id: '5', x: 5, y: 0, color: '#8e44ad' },
  { id: '7', x: 0, y: 0, color: '#6b7d2a' },
  { id: '8', x: 0, y: 0, color: '#1f9d55' },
  { id: '9', x: 3, y: 0, color: '#5b6b84' },
  { id: '10', x: 0, y: 0, color: '#0b8ea5' },
  { id: '11', x: 0, y: 0, color: '#d26a0c' },
  { id: '12', x: 0, y: 0, color: '#a0522d' },
  { id: '13', x: 0, y: 1, color: '#d32f2f' },
  { id: 'system' },
];
const DEFAULT_COLOR = '#d63384';

// Valor de 'cursor' (sin el respaldo); los hd llevan también N@2x.png, que Chrome usa con el escalado de pantalla
const cursorValue = (c, url) => (c.hd
  ? `image-set(url("${url(c.id)}") 1x, url("${url(`${c.id}@2x`)}") 2x) ${c.x} ${c.y}`
  : `url("${url(c.id)}") ${c.x} ${c.y}`);

// Un cursor guardado que ya no existe vuelve al de por defecto; la antigua cruz '1', a la del sistema, que es lo más parecido
const cursorIdOf = (id) => (id === '1' ? 'system' : CURSORS.some((c) => c.id === id) ? id : CURSORS[0].id);

// Toda la configuración guardada; output: 'file' copia el .md como fichero (o @"ruta" sin ayudante), 'text' el contenido.
// checkUpdates: una vez al día mira en GitHub si hay versión nueva
const SETTINGS_DEFAULTS = { ...SHORTCUT_DEFAULTS, output: 'file', cursor: '14', checkUpdates: true };

// Repo de donde salen las versiones (sus releases)
const REPO = 'robmab/CursorClip';

// Ayudante nativo, registrado con install.bat (Windows) o install.sh (macOS/Linux)
const NATIVE_HOST = 'com.copiar_elemento.helper';

const KEY_LABELS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Backquote: 'º' };

// Botones del ratón que se pueden asignar (event.button); el izquierdo y el derecho no
const MOUSE_LABELS = { 1: 'Middle mouse', 3: 'Mouse back', 4: 'Mouse forward' };

// Un atajo es de teclado (code/key) o de ratón (button)
const isMouseShortcut = (s) => s.button != null;

// Sin Ctrl, Alt ni Win y sin ser tecla F: solo cuenta fuera de los campos de texto
const isBareKey = (s) => !isMouseShortcut(s) && !s.ctrl && !s.alt && !s.meta && !/^F\d+$/.test(s.code || '');

const sameModifiers = (e, s) => e.ctrlKey === !!s.ctrl && e.altKey === !!s.alt && e.shiftKey === !!s.shift && e.metaKey === !!s.meta;

const formatShortcut = (s) => {
  const parts = [];
  if (s.ctrl) parts.push('Ctrl');
  if (s.alt) parts.push('Alt');
  if (s.shift) parts.push('Shift');
  if (s.meta) parts.push('Win');
  if (isMouseShortcut(s)) {
    parts.push(MOUSE_LABELS[s.button] || `Mouse ${s.button}`);
    return parts.join('+');
  }
  const code = s.code || '';
  let key = KEY_LABELS[code] || code.replace(/^Key|^Digit|^Numpad/, '');
  if (!key) key = (s.key || '?').toUpperCase();
  parts.push(key);
  return parts.join('+');
};

const matchesShortcut = (e, s) => {
  if (!s || isMouseShortcut(s) || !sameModifiers(e, s)) return false;
  // Sin code (eventos sintéticos) se compara por la tecla
  return e.code ? e.code === s.code : (e.key || '').toLowerCase() === s.key;
};

const matchesMouse = (e, s) => !!s && isMouseShortcut(s) && e.button === s.button && sameModifiers(e, s);
