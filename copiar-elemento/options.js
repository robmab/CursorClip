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
    checkUpdatesBox.checked = config.checkUpdates;
  };

  // Versión nueva: la mira background.js, que es quien pone el aviso en el icono
  const updateText = document.getElementById('update');
  const checkUpdatesBox = document.getElementById('check-updates');

  const checkNow = document.getElementById('check-now');

  const showUpdate = (u) => {
    updateText.className = '';
    checkNow.disabled = false;
    if (u && u.manual && u.failed) {
      updateText.textContent = "Couldn't reach GitHub. Check your connection and try again.";
    } else if (!u || (!u.enabled && !u.manual && !u.available)) {
      updateText.textContent = `You have version ${chrome.runtime.getManifest().version}. Automatic checks are off; use Check now whenever you want.`;
    } else if (u.available) {
      updateText.className = 'update-new';
      updateText.textContent = `Version ${u.version} is available (you have ${u.current}). `;
      const link = document.createElement('a');
      link.href = u.url;
      link.target = '_blank';
      link.textContent = 'Download it from GitHub';
      updateText.append(link, ', then replace the extension folder and click reload in chrome://extensions.');
    } else {
      updateText.textContent = u.version
        ? `You have the latest version (${u.current}).`
        : `You have version ${u.current}. No release has been published yet.`;
    }
  };

  const checkUpdate = (manual) => chrome.runtime.sendMessage({ type: 'checkUpdate', manual }, showUpdate);

  checkNow.addEventListener('click', () => {
    checkNow.disabled = true;
    updateText.className = '';
    updateText.textContent = 'Checking GitHub…';
    checkUpdate(true);
  });

  checkUpdatesBox.addEventListener('change', () => {
    config.checkUpdates = checkUpdatesBox.checked;
    save(config.checkUpdates ? 'Saved: checks for updates' : 'Saved: no update checks');
  });
  // Ya guardada la casilla (o tras "Reset"), se vuelve a mirar para pintar el texto y el aviso del icono
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && 'checkUpdates' in changes) checkUpdate();
  });
  checkUpdate();

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
      opt.insertAdjacentHTML('beforeend', '<span class="cross">+</span><span>System</span>');
      opt.style.cursor = 'crosshair';
    } else {
      const img = document.createElement('img');
      img.src = `cursors/${c.id}.png`;
      if (c.hd) img.srcset = `cursors/${c.id}.png 1x, cursors/${c.id}@2x.png 2x`;
      img.alt = `Cursor ${c.id}`;
      opt.append(img);
      opt.style.cursor = `${cursorValue(c, (n) => `cursors/${n}.png`)}, crosshair`;
    }
    // Franja con el color que tendrá el resaltado con este cursor
    opt.style.boxShadow = `inset 0 -4px 0 ${c.color || DEFAULT_COLOR}`;
    radio.addEventListener('change', () => {
      config.cursor = c.id;
      save(c.id === 'system' ? 'Saved: system crosshair' : `Saved: cursor ${c.id}`);
    });
    cursorsBox.append(opt);
  }

  const save = (msg = 'Saved', kind = 'ok') => chrome.storage.sync.set(config, () => say(msg, kind));

  // Teclas que usa el propio selector mientras eliges
  const PICKER_KEYS = ['Enter', 'ArrowUp', 'ArrowDown'];

  const record = (k, input, s) => {
    const name = formatShortcut(s);
    if (name === formatShortcut(config[OTHER[k]])) {
      say(`${name} is already used by the other action`, 'error');
      return;
    }
    config[k] = { ...config[k], ...s };
    input.blur();
    if (RESERVED.includes(name)) save(`Saved, but Chrome uses ${name} and the page may never receive it`, 'warn');
    else if (isBareKey(s)) save(`Saved: ${name} (only works outside text fields)`, 'warn');
    else save(`Saved: ${name}`);
  };

  const mods = (e) => ({ ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });

  for (const input of document.querySelectorAll('[data-rec]')) {
    const k = input.dataset.rec;
    input.addEventListener('focus', () => { input.value = 'Press a key, a combination or a mouse button…'; });
    input.addEventListener('blur', render);
    input.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (MODIFIERS.includes(e.key)) return;
      if (e.key === 'Escape' || e.key === 'Tab') { input.blur(); return; }
      const s = { ...mods(e), code: e.code, key: (e.key || '').toLowerCase(), button: null };
      if (isBareKey(s) && PICKER_KEYS.includes(e.key)) {
        say(`${formatShortcut(s)} on its own is used by the picker; combine it with Ctrl, Alt or Win`, 'error');
        return;
      }
      record(k, input, s);
    });
    // Botones del ratón: el primer clic enfoca la casilla, el siguiente se graba
    input.addEventListener('mousedown', (e) => {
      if (document.activeElement !== input || e.button === 0) return;
      e.preventDefault();
      if (!MOUSE_LABELS[e.button]) {
        say("Right click can't be assigned; use the middle or side buttons", 'error');
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
      save(r.value === 'file' ? 'Saved: copies as a file' : 'Saved: copies as text');
    });
  }

  document.getElementById('reset').addEventListener('click', () => {
    config = structuredClone(SETTINGS_DEFAULTS);
    render();
    chrome.storage.sync.clear(() => save('Everything reset to defaults'));
  });

  chrome.storage.sync.get(SETTINGS_DEFAULTS, (stored) => { config = stored; render(); });

  // Con ayudante el .md va al portapapeles como fichero; sin él, se copia @"ruta" a un .md de Descargas
  const helper = document.getElementById('helper');
  const steps = document.getElementById('helper-steps');
  const openFolder = document.getElementById('open-folder');

  const card = document.getElementById('helper-card');
  const title = document.getElementById('helper-title');

  const checkHelper = () => {
    helper.textContent = 'Checking the helper…';
    chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: 'ping' }, (res) => {
      const ok = !chrome.runtime.lastError && res && res.ok;
      card.classList.toggle('ok', !!ok);
      card.classList.toggle('missing', !ok);
      title.textContent = ok ? 'Helper to paste as a file' : 'RECOMMENDED: INSTALL THE HELPER TO PASTE COPIES AS A FILE';
      helper.textContent = ok
        ? '✓ Helper installed: the .md is saved hidden in your temp folder and pastes as a file attachment.'
        : 'Helper not installed: copies cannot be pasted as a file. The .md goes to Downloads/copiar-elemento and only @"path" is copied.';
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
