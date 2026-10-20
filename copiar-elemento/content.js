// Atajo "full": elegir un elemento y copiar su HTML + el CSS que le aplica · atajo "html": solo el HTML
// Los atajos salen de la página de opciones (por defecto Ctrl+C y Ctrl+Alt+C, ver shortcuts.js)
// Mientras eliges: clic o Enter copia, arrastrar coge el padre común, ↑/↓ sube al padre o baja al hijo, Esc cancela
// En modo fichero se guarda un .md (background.js): con el ayudante nativo queda en el portapapeles como fichero;
// sin él se copia @"ruta" del .md
(() => {
  const MAX_HTML = 4000;
  const MAX_NAME = 60;
  const FENCE = '```';
  const TOP = '2147483647';

  let mode = null; // 'html' | 'full' mientras se está eligiendo
  let current = null;
  let hovered = null;
  let box = null;
  let label = null;
  let cursor = null;

  // Configuración guardada en opciones; si se cambia, se aplica sin recargar la pestaña
  let settings = SETTINGS_DEFAULTS;
  if (globalThis.chrome && chrome.storage) {
    chrome.storage.sync.get(SETTINGS_DEFAULTS, (stored) => { settings = stored; });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const next = { ...settings };
      for (const k of Object.keys(changes)) next[k] = changes[k].newValue || SETTINGS_DEFAULTS[k];
      settings = next;
    });
  }

  // Lo que hay bajo el ratón, para resaltarlo nada más pulsar el atajo
  window.addEventListener('mouseover', (e) => { hovered = e.target; }, true);

  // --- Texto que se copia ---

  const describe = (n) => {
    const tag = n.tagName.toLowerCase();
    if (n.id) return tag + '#' + n.id;
    const cls = [...n.classList].slice(0, 3);
    return cls.length ? tag + '.' + cls.join('.') : tag;
  };

  // Nombre del .md: etiqueta + id o primera clase, sin caracteres raros
  const fileNameOf = (el) => {
    const tag = el.tagName.toLowerCase();
    const first = el.id ? '#' + el.id : (el.classList[0] ? '.' + el.classList[0] : '');
    return (tag + first).replace(/[^\w.#-]+/g, '_').slice(0, MAX_NAME) + '.md';
  };

  const selectorOf = (el) => {
    const path = [];
    for (let n = el; n && n.nodeType === 1 && path.length < 5; n = n.parentElement) {
      path.unshift(describe(n));
      if (n.id) break;
    }
    return path.join(' > ');
  };

  // --- CSS: reglas propias, heredadas de los padres, variables y valores calculados ---

  // Propiedades que se heredan: las que explican por qué un texto se ve como se ve aunque el elemento no las fije
  const INHERITED = new Set([
    'color', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'font-stretch', 'line-height',
    'letter-spacing', 'word-spacing', 'text-align', 'text-indent', 'text-transform', 'text-shadow', 'white-space',
    'white-space-collapse', 'text-wrap-mode', 'word-break', 'overflow-wrap', 'word-wrap', 'hyphens', 'direction',
    'visibility', 'cursor', 'list-style-type', 'list-style-position', 'list-style-image', 'quotes', 'caret-color',
  ]);
  const MAX_INHERITED = 8;

  // Valores finales que se copian, quitando los neutros (0px, none, auto, transparente…). El tamaño ya va en
  // la cabecera, y color y fuente solo cuando el elemento tiene texto propio (en una img o un contenedor no dicen nada)
  const COMPUTED = ['display', 'position', 'margin', 'padding', 'background-color', 'background-image', 'border',
    'border-radius', 'box-shadow', 'opacity'];
  const COMPUTED_TEXT = ['color', 'font-family', 'font-size', 'font-weight', 'line-height'];
  const COMPUTED_FLEX = ['flex-direction', 'justify-content', 'align-items', 'gap'];
  const NEUTRAL = /^(0px( 0px)*|none|auto|normal|static|visible|row|rgba\(0, 0, 0, 0\)|transparent|1|0px none .*)$/;

  // Resets genéricos (`canvas, caption, center, … { margin: 0 }`): salen en todo y no dicen nada del elemento
  const isReset = (sel) => {
    const parts = sel.split(',').map((s) => s.trim());
    return parts.length >= 8 && parts.every((p) => /^[a-z][a-z0-9-]*$/i.test(p));
  };

  // Nombre de la hoja: el fichero si lo tiene; si no (p. ej. YouTube), dominio y ruta
  const sheetName = (sh) => {
    if (!sh.href) return '<style> de la página';
    try {
      const u = new URL(sh.href);
      const last = u.pathname.split('/').pop();
      return /\.\w{2,5}$/.test(last) ? last : (u.host + u.pathname).slice(0, 80);
    } catch (e) {
      return sh.href.slice(0, 80);
    }
  };

  const hasInherited = (rule) => {
    for (let i = 0; i < rule.style.length; i++) if (INHERITED.has(rule.style[i])) return true;
    return false;
  };

  // Una sola pasada por todas las hojas: hits[0] son las reglas del elemento y hits[i] las del padre i
  // (de los padres solo interesan las reglas con alguna propiedad heredable)
  const collectRules = (chain) => {
    const hits = chain.map(() => []);
    let unreadable = 0;
    const matches = (node, sel) => { try { return node.matches(sel); } catch (e) { return false; } };
    const walk = (list, sheet, media) => {
      for (const r of list) {
        if (r instanceof CSSStyleRule) {
          const sel = r.selectorText.trim();
          if (sel.startsWith('*') || isReset(sel)) continue;
          if (matches(chain[0], sel)) hits[0].push({ rule: r, sheet, media });
          if (!hasInherited(r)) continue;
          for (let i = 1; i < chain.length; i++) if (matches(chain[i], sel)) hits[i].push({ rule: r, sheet, media });
        } else if (r.cssRules) {
          if (r.media && !matchMedia(r.media.mediaText).matches) continue;
          walk(r.cssRules, sheet, r.media ? r.media.mediaText : media);
        }
      }
    };
    for (const sh of document.styleSheets) {
      let list;
      try { list = sh.cssRules; } catch (e) { unreadable++; continue; } // hojas de otro dominio
      walk(list, sheetName(sh), null);
    }
    return { hits, unreadable };
  };

  const declsOf = (rule, keep) => {
    const out = [];
    for (let i = 0; i < rule.style.length; i++) {
      const p = rule.style[i];
      const v = rule.style.getPropertyValue(p);
      if (!keep(p) || v === 'initial') continue;
      out.push({ p, text: `${p}: ${v}${rule.style.getPropertyPriority(p) ? ' !important' : ''}` });
    }
    return out;
  };
  const inMedia = (media, text) => (media ? `@media ${media} { ${text} }` : text);

  // Por cada propiedad heredable, la regla del padre más cercano que la fija; las que ya fija el elemento no
  const inheritedCss = (hits, chain) => {
    const covered = new Set();
    for (const { rule } of hits[0]) declsOf(rule, (p) => INHERITED.has(p)).forEach((d) => covered.add(d.p));
    for (let i = 0; i < chain[0].style.length; i++) covered.add(chain[0].style[i]);
    const out = [];
    for (let i = 1; i < chain.length && out.length < MAX_INHERITED; i++) {
      const setHere = new Set();
      for (const { rule, media } of hits[i]) {
        const decls = declsOf(rule, (p) => INHERITED.has(p) && !covered.has(p));
        if (!decls.length) continue;
        decls.forEach((d) => setHere.add(d.p));
        out.push(inMedia(media, `${rule.selectorText} { ${decls.map((d) => d.text).join('; ')}; }`));
        if (out.length >= MAX_INHERITED) break;
      }
      setHere.forEach((p) => covered.add(p));
    }
    return out;
  };

  // Solo las variables que aparecen en las reglas copiadas, con el valor que tienen en el elemento
  const variablesOf = (el, cssText) => {
    const names = [...new Set([...cssText.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))];
    const cs = getComputedStyle(el);
    return names.map((n) => `${n}: ${cs.getPropertyValue(n).trim() || '(sin valor)'};`);
  };

  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  const computedCss = (el) => {
    const cs = getComputedStyle(el);
    const props = [...COMPUTED];
    if (/flex|grid/.test(cs.display)) props.push(...COMPUTED_FLEX);
    if (hasOwnText(el)) props.push(...COMPUTED_TEXT);
    return props
      .map((p) => [p, cs.getPropertyValue(p).trim()])
      .filter(([, v]) => v && !NEUTRAL.test(v))
      .map(([p, v]) => `${p}: ${v};`);
  };

  // --- Esquema de la estructura, para cuando el HTML es demasiado grande para copiarlo entero ---

  const MAX_OUTLINE_DEPTH = 5;
  const MAX_OUTLINE_LINES = 120;
  const OUTLINE_SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);

  const outlineTag = (n) => {
    const cls = [...n.classList];
    const id = n.id ? ` id="${n.id}"` : '';
    const c = cls.length ? ` class="${cls.slice(0, 3).join(' ')}${cls.length > 3 ? ' …' : ''}"` : '';
    return `<${n.tagName.toLowerCase()}${id}${c}>`;
  };

  const outlineText = (n) => {
    const t = [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim();
    return t ? ` "${t.length > 40 ? t.slice(0, 40) + '…' : t}"` : '';
  };

  // Etiquetas, id y clases hasta MAX_OUTLINE_DEPTH niveles; los hermanos iguales seguidos se agrupan en "× N"
  const outlineOf = (root) => {
    const lines = [];
    let full = false;
    const visit = (n, depth) => {
      if (lines.length >= MAX_OUTLINE_LINES) { full = true; return; }
      const kids = [...n.children].filter((c) => !OUTLINE_SKIP.has(c.tagName));
      const leaf = !kids.length || depth >= MAX_OUTLINE_DEPTH || n instanceof SVGElement;
      lines.push('  '.repeat(depth) + outlineTag(n) + outlineText(n) + (leaf && kids.length ? ' …' : ''));
      if (leaf) return;
      for (let i = 0; i < kids.length;) {
        const sig = outlineTag(kids[i]);
        let j = i + 1;
        while (j < kids.length && outlineTag(kids[j]) === sig) j++;
        const at = lines.length;
        visit(kids[i], depth + 1);
        if (j - i > 1 && at < lines.length) lines[at] += ` × ${j - i}`;
        i = j;
      }
    };
    visit(root, 0);
    if (full) lines.push('<!-- … sigue; elige un elemento más concreto para ver el resto -->');
    return lines.join('\n');
  };

  const build = (el, withCss) => {
    let html = el.outerHTML;
    if (html.length > MAX_HTML) {
      html = `<!-- HTML demasiado grande (${html.length.toLocaleString('es-ES')} caracteres): esquema de la estructura -->\n`
        + outlineOf(el);
    }
    const r = el.getBoundingClientRect();
    const out = [
      `**Elemento:** \`${selectorOf(el)}\` · ${Math.round(r.width)}×${Math.round(r.height)}`,
      `**Página:** ${location.href.split('#')[0]}`,
      '',
      FENCE + 'html', html, FENCE,
    ];
    let rules = 0;
    if (withCss) {
      const chain = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
      const { hits, unreadable } = collectRules(chain);
      rules = hits[0].length;

      const bySheet = new Map();
      for (const { rule, sheet, media } of hits[0]) {
        if (!bySheet.has(sheet)) bySheet.set(sheet, []);
        bySheet.get(sheet).push(inMedia(media, rule.cssText));
      }
      const parts = [...bySheet].map(([sheet, list]) => `/* ${sheet} */\n${list.join('\n')}`);
      const inherited = inheritedCss(hits, chain);
      if (inherited.length) parts.push(`/* Heredado de los padres */\n${inherited.join('\n')}`);
      const vars = variablesOf(el, parts.join('\n'));
      if (vars.length) parts.push(`/* Variables */\n${vars.join('\n')}`);

      out.push('', '**CSS que le aplica** (en orden de carga; a igual especificidad gana la última):');
      out.push(FENCE + 'css', parts.join('\n\n') || '/* sin reglas */', FENCE);
      if (unreadable) out.push(`_(${unreadable} hoja(s) de otro dominio no se han podido leer)_`);

      const computed = computedCss(el);
      if (computed.length) out.push('', '**Valores calculados** (sin los que están por defecto):', FENCE + 'css', computed.join('\n'), FENCE);
    }
    return { text: out.join('\n'), rules };
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.documentElement.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  };

  const toast = (msg, ok) => {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `position:fixed;z-index:${TOP};right:16px;bottom:16px;padding:8px 12px;border-radius:6px;`
      + `font:13px/1.4 system-ui,sans-serif;color:#fff;background:${ok ? '#198754' : '#dc3545'};box-shadow:0 2px 8px rgba(0,0,0,.3)`;
    document.documentElement.append(t);
    setTimeout(() => t.remove(), 2000);
  };

  // --- Selector visual ---

  const highlight = (el) => {
    if (!el || el.nodeType !== 1 || el === box || el === label) return;
    current = el;
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    label.textContent = `${describe(el)}  ${Math.round(r.width)}×${Math.round(r.height)}${mode === 'full' ? '  + CSS' : ''}`;
    label.style.left = Math.max(0, r.left) + 'px';
    label.style.top = (r.top > 24 ? r.top - 22 : r.bottom + 2) + 'px';
  };

  // --- Arrastrar: el resaltado sube al padre común de donde empezaste y de donde estás; al soltar se copia ese ---

  const DRAG_MIN = 5;
  let dragStart = null; // { x, y, el }
  let dragging = false;
  let rectBox = null;

  const commonParent = (a, b) => {
    for (let n = a; n; n = n.parentElement) if (n.contains(b)) return n;
    return document.body;
  };

  const farFromStart = (e) => !!dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > DRAG_MIN;

  const updateDrag = (x, y) => {
    Object.assign(rectBox.style, {
      display: 'block',
      left: Math.min(dragStart.x, x) + 'px', top: Math.min(dragStart.y, y) + 'px',
      width: Math.abs(x - dragStart.x) + 'px', height: Math.abs(y - dragStart.y) + 'px',
    });
    const under = document.elementFromPoint(x, y);
    if (under) highlight(commonParent(dragStart.el, under));
  };

  const endDrag = () => {
    dragStart = null;
    dragging = false;
    if (rectBox) rectBox.style.display = 'none';
  };

  const onMove = (e) => {
    if (farFromStart(e)) dragging = true;
    if (dragging) { updateDrag(e.clientX, e.clientY); return; }
    if (e.target !== current) highlight(e.target);
  };
  const onScroll = () => { if (current) highlight(current); };

  // Que la página no se entere de los clics mientras eliges. El arrastre va con pointer*: al cancelar
  // pointerdown el navegador ya no manda mousedown/mousemove/mouseup con el botón pulsado
  const block = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.button !== 0) return;
    if (e.type === 'pointerdown') dragStart = { x: e.clientX, y: e.clientY, el: e.target };
    if (e.type === 'pointerup') {
      // Aunque no hayan llegado movimientos, si se suelta lejos de donde se pulsó es un arrastre
      if (farFromStart(e)) { dragging = true; updateDrag(e.clientX, e.clientY); }
      if (dragging) {
        const el = current;
        endDrag();
        // finish quita estos listeners: el click que llega tras soltar se traga aparte
        const swallow = (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, true), 300);
        finish(el);
        return;
      }
      dragStart = null;
    }
    if (e.type === 'click') finish(current || e.target);
  };
  const BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'];

  const start = (m) => {
    mode = m;
    // Cursor elegido en opciones; si no carga (o es 'system'), la cruz del navegador. El resaltado va a juego
    const c = CURSORS.find((k) => k.id === cursorIdOf(settings.cursor) && k.id !== 'system');
    const color = (c && c.color) || DEFAULT_COLOR;
    box = document.createElement('div');
    box.style.cssText = `position:fixed;z-index:${TOP};pointer-events:none;background:${color}26;outline:2px solid ${color}`;
    rectBox = document.createElement('div');
    rectBox.style.cssText = `position:fixed;z-index:${TOP};pointer-events:none;display:none;border:1px dashed ${color};background:${color}0f`;
    label = document.createElement('div');
    label.style.cssText = `position:fixed;z-index:${TOP};pointer-events:none;background:${color};color:#fff;`
      + 'font:12px/1.5 monospace;padding:1px 6px;border-radius:3px;white-space:nowrap';
    const img = c && globalThis.chrome && chrome.runtime && chrome.runtime.getURL
      ? `url("${chrome.runtime.getURL(`cursors/${c.id}.png`)}") ${c.x} ${c.y}, ` : '';
    cursor = document.createElement('style');
    cursor.textContent = `*, *::before, *::after { cursor: ${img}crosshair !important; }`;
    document.documentElement.append(box, rectBox, label, cursor);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('scroll', onScroll, true);
    BLOCKED.forEach((t) => window.addEventListener(t, block, true));
    if (hovered) highlight(hovered);
  };

  const stop = () => {
    endDrag();
    mode = null;
    current = null;
    box.remove();
    rectBox.remove();
    label.remove();
    cursor.remove();
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('scroll', onScroll, true);
    BLOCKED.forEach((t) => window.removeEventListener(t, block, true));
  };

  const finish = async (el) => {
    const withCss = mode === 'full';
    stop();
    const { text, rules } = build(el, withCss);
    const extra = withCss ? ` + ${rules} reglas CSS` : '';
    if (settings.output === 'file' && globalThis.chrome && chrome.runtime && chrome.runtime.id) {
      const name = fileNameOf(el);
      const res = await chrome.runtime.sendMessage({ type: 'save', name, text }).catch((e) => ({ error: e.message }));
      if (res && res.path) {
        // Con el ayudante el fichero ya está en el portapapeles; sin él, se copia la mención
        const ok = res.native ? true : await copyText(`@"${res.path}" `);
        toast(ok ? `Copiado como fichero ${name}${extra}` : 'No se ha podido copiar', ok);
        return;
      }
      // Si no se ha podido guardar, que al menos quede el texto
      const ok = await copyText(text);
      toast(`No se pudo guardar el fichero (${(res && res.error) || 'sin respuesta'})${ok ? '; copiado como texto' : ''}`, false);
      return;
    }
    const ok = await copyText(text);
    toast(ok ? `Copiado ${describe(el)}${extra}` : 'No se ha podido copiar', ok);
  };

  const hasSelection = () => String(getSelection()).length > 0;
  const inField = () => {
    const a = document.activeElement;
    return !!a && (a.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName));
  };

  // Si el atajo debe apartarse: teclas solas al escribir, o "respetar selección" con texto seleccionado o en un campo
  const shouldYield = (m) => !mode && ((isBareKey(settings[m]) && inField())
    || (settings[m].respectSelection && (hasSelection() || inField())));

  const trigger = (e, m) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!mode) start(m);
    else { mode = m; if (current) highlight(current); }
  };

  // Atajos de ratón; el botón que ha disparado se traga también al soltarlo (para que el lateral no vaya atrás)
  let swallowButton = null;
  window.addEventListener('mousedown', (e) => {
    swallowButton = null;
    const m = ['html', 'full'].find((k) => matchesMouse(e, settings[k]));
    if (!m || shouldYield(m)) return;
    swallowButton = e.button;
    trigger(e, m);
  }, true);
  for (const t of ['mouseup', 'auxclick']) {
    window.addEventListener(t, (e) => {
      if (e.button !== swallowButton) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  // Clic en el icono de la extensión (background.js): igual que pulsar el atajo
  if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'start') return;
      if (!mode) start(msg.mode);
      else { mode = msg.mode; if (current) highlight(current); }
    });
  }

  window.addEventListener('keydown', (e) => {
    const m = ['html', 'full'].find((k) => matchesShortcut(e, settings[k]));
    if (m) {
      if (shouldYield(m)) return;
      trigger(e, m);
      return;
    }
    if (!mode) return;
    const keys = {
      Escape: () => stop(),
      Enter: () => current && !dragging && finish(current),
      ArrowUp: () => current && current.parentElement && current.parentElement !== document.documentElement && highlight(current.parentElement),
      ArrowDown: () => current && current.firstElementChild && highlight(current.firstElementChild),
    };
    if (keys[e.key]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      keys[e.key]();
    }
  }, true);
})();
