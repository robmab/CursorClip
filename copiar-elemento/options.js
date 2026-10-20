// Página de opciones: grabar los atajos y guardarlos en chrome.storage.sync
(() => {
  // Atajos que Chrome se queda antes que la página, o que se usan muchísimo
  const RESERVED = [
    'Ctrl+N', 'Ctrl+Shift+N', 'Ctrl+T', 'Ctrl+Shift+T', 'Ctrl+W', 'Ctrl+Shift+W', 'Ctrl+Tab', 'Ctrl+Shift+Tab',
    'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C', 'Ctrl+Shift+Q', 'Alt+F4', 'Ctrl+L', 'Ctrl+R', 'Ctrl+P',
  ];
  const MODIFIERS = ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'OS'];
  const OTHER = { html: 'full', full: 'html' };

  let config = structuredClone(SETTINGS_DEFAULTS);
  const status = document.getElementById('status');

  let statusTimer;
  const say = (msg, kind) => {
    status.textContent = msg;
    status.className = kind;
    clearTimeout(statusTimer);
    if (kind === 'ok') statusTimer = setTimeout(() => { status.textContent = ''; }, 2000);
  };

  const render = () => {
    for (const k of Object.keys(SHORTCUT_DEFAULTS)) {
      document.querySelector(`[data-rec="${k}"]`).value = formatShortcut(config[k]);
      document.querySelector(`[data-respect="${k}"]`).checked = !!config[k].respectSelection;
    }
    for (const r of document.querySelectorAll('[name="output"]')) r.checked = r.value === config.output;
    for (const r of document.querySelectorAll('[name="cursor"]')) r.checked = r.value === cursorIdOf(config.cursor);
  };

  // Una casilla por cursor, que al pasar por encima ya usa ese cursor
  const cursorsBox = document.getElementById('cursors');
  for (const c of CURSORS) {
    const opt = document.createElement('label');
    opt.className = 'cursor-opt';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'cursor';
    radio.value = c.id;
    opt.append(radio);
    if (c.id === 'system') {
      opt.insertAdjacentHTML('beforeend', '<span class="cross">+</span><span>Sistema</span>');
      opt.style.cursor = 'crosshair';
    } else {
      const img = document.createElement('img');
      img.src = `cursors/${c.id}.png`;
      img.alt = `Cursor ${c.id}`;
      opt.append(img);
      opt.style.cursor = `url("cursors/${c.id}.png") ${c.x} ${c.y}, crosshair`;
    }
    // Franja con el color que tendrá el resaltado con este cursor
    opt.style.boxShadow = `inset 0 -4px 0 ${c.color || DEFAULT_COLOR}`;
    radio.addEventListener('change', () => {
      config.cursor = c.id;
      save(c.id === 'system' ? 'Guardado: cruz del sistema' : `Guardado: cursor ${c.id}`);
    });
    cursorsBox.append(opt);
  }

  const save = (msg = 'Guardado', kind = 'ok') => chrome.storage.sync.set(config, () => say(msg, kind));

  // Teclas que usa el propio selector mientras eliges
  const PICKER_KEYS = ['Enter', 'ArrowUp', 'ArrowDown'];

  const record = (k, input, s) => {
    const name = formatShortcut(s);
    if (name === formatShortcut(config[OTHER[k]])) {
      say(`${name} ya lo usa la otra acción`, 'error');
      return;
    }
    config[k] = { ...config[k], ...s };
    input.blur();
    if (RESERVED.includes(name)) save(`Guardado, pero ${name} lo usa Chrome y puede que la página no llegue a recibirlo`, 'warn');
    else if (isBareKey(s)) save(`Guardado: ${name} (solo funciona fuera de los campos de texto)`, 'warn');
    else save(`Guardado: ${name}`);
  };

  const mods = (e) => ({ ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });

  for (const input of document.querySelectorAll('[data-rec]')) {
    const k = input.dataset.rec;
    input.addEventListener('focus', () => { input.value = 'Pulsa una tecla, combinación o botón del ratón…'; });
    input.addEventListener('blur', render);
    input.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (MODIFIERS.includes(e.key)) return;
      if (e.key === 'Escape' || e.key === 'Tab') { input.blur(); return; }
      const s = { ...mods(e), code: e.code, key: (e.key || '').toLowerCase(), button: null };
      if (isBareKey(s) && PICKER_KEYS.includes(e.key)) {
        say(`${formatShortcut(s)} sola la usa el selector; combínala con Ctrl, Alt o Win`, 'error');
        return;
      }
      record(k, input, s);
    });
    // Botones del ratón: el primer clic enfoca la casilla, el siguiente se graba
    input.addEventListener('mousedown', (e) => {
      if (document.activeElement !== input || e.button === 0) return;
      e.preventDefault();
      if (!MOUSE_LABELS[e.button]) {
        say('El clic derecho no se puede asignar; usa el central o los laterales', 'error');
        return;
      }
      record(k, input, { ...mods(e), code: '', key: '', button: e.button });
    });
    // Que los botones laterales no hagan atrás/adelante ni salga el menú al grabar
    for (const t of ['mouseup', 'auxclick', 'contextmenu']) {
      input.addEventListener(t, (e) => { if (e.button !== 0) e.preventDefault(); });
    }
  }

  for (const box of document.querySelectorAll('[data-respect]')) {
    box.addEventListener('change', () => {
      config[box.dataset.respect].respectSelection = box.checked;
      save();
    });
  }

  for (const r of document.querySelectorAll('[name="output"]')) {
    r.addEventListener('change', () => {
      config.output = r.value;
      save(r.value === 'file' ? 'Guardado: se copiará como fichero' : 'Guardado: se copiará como texto');
    });
  }

  document.getElementById('reset').addEventListener('click', () => {
    config = structuredClone(SETTINGS_DEFAULTS);
    render();
    chrome.storage.sync.clear(() => save('Restaurado todo por defecto'));
  });

  chrome.storage.sync.get(SETTINGS_DEFAULTS, (stored) => { config = stored; render(); });

  // Con ayudante el .md va al portapapeles como fichero; sin él, se copia @"ruta" a un .md de Descargas
  const helper = document.getElementById('helper');
  const steps = document.getElementById('helper-steps');
  const openFolder = document.getElementById('open-folder');

  const card = document.getElementById('helper-card');

  const checkHelper = () => {
    helper.textContent = 'Comprobando el ayudante…';
    chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: 'ping' }, (res) => {
      const ok = !chrome.runtime.lastError && res && res.ok;
      card.classList.toggle('ok', !!ok);
      helper.textContent = ok
        ? '✓ Ayudante instalado: el .md se guarda oculto en Temp y se pega como fichero adjunto.'
        : 'Ayudante sin instalar: funciona igual, pero se guarda en Descargas\\copiar-elemento y se copia @"ruta" en vez del fichero.';
      steps.hidden = ok;
      openFolder.hidden = ok;
    });
  };

  // La extensión no sabe su ruta en disco; en sus detalles de chrome://extensions, "Cargado desde" abre la carpeta
  openFolder.addEventListener('click', () => {
    chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  });
  document.getElementById('recheck').addEventListener('click', checkHelper);
  checkHelper();
})();
