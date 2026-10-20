// Guarda el elemento como .md: con el ayudante nativo (Temp, oculto y en el portapapeles como fichero)
// o, si no está instalado, en Descargas/copiar-elemento/ devolviendo la ruta. Se guardan los últimos MAX_FILES
importScripts('shortcuts.js');

const DIR = 'copiar-elemento';
const MAX_FILES = 50;

// Nada más instalarla, a Opciones: ahí se ve si falta el ayudante y cómo ponerlo
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

// Clic en el icono = el atajo de HTML + CSS. En pestañas abiertas antes de instalar no hay content script: se inyecta
chrome.action.onClicked.addListener(async (tab) => {
  const msg = { type: 'start', mode: 'full' };
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['shortcuts.js', 'content.js'] });
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch (e2) {
      // Páginas donde Chrome no deja entrar (chrome://, la tienda…): nada que hacer
    }
  }
});

// El texto viaja en base64 (UTF-8): así el ayudante de bash no tiene que desescapar JSON
const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

// null si el ayudante no está instalado o ha fallado
const saveNative = (name, text) => new Promise((resolve) => {
  chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: 'save', name, b64: toBase64(text) }, (res) => {
    resolve(chrome.runtime.lastError || !res || !res.ok ? null : res);
  });
});

const waitComplete = (id) => new Promise((resolve, reject) => {
  const done = (fn, arg) => { chrome.downloads.onChanged.removeListener(check); fn(arg); };
  const check = (delta) => {
    if (delta.id !== id || !delta.state) return;
    if (delta.state.current === 'complete') done(resolve);
    else if (delta.state.current === 'interrupted') done(reject, new Error('download interrupted'));
  };
  chrome.downloads.onChanged.addListener(check);
  // Puede haber terminado antes de empezar a escuchar
  chrome.downloads.search({ id }).then(([item]) => { if (item && item.state === 'complete') done(resolve); });
});

const saveElement = async ({ name, text }) => {
  const native = await saveNative(name, text);
  // clipboard: false si el ayudante no ha podido poner el fichero en el portapapeles (Linux sin wl-copy ni xclip)
  if (native) return { path: native.path, native: true, clipboard: native.clipboard !== false };
  return saveToDownloads({ name, text });
};

const baseName = (p) => p.split(/[\\/]/).pop();

// Si el nombre ya está cogido en Descargas/copiar-elemento: nombre_2.md, nombre_3.md…
const uniqueName = async (name) => {
  const items = await chrome.downloads.search({ filenameRegex: `[\\\\/]${DIR}[\\\\/]`, exists: true });
  const taken = new Set(items.map((i) => baseName(i.filename).toLowerCase()));
  const base = name.replace(/\.md$/, '');
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base}_${n}.md`;
  return candidate;
};

const saveToDownloads = async ({ name, text }) => {
  // Que no salga el aviso de descarga cada vez que se copia
  await chrome.downloads.setUiOptions({ enabled: false }).catch(() => {});
  try {
    const id = await chrome.downloads.download({
      url: 'data:text/markdown;charset=utf-8,' + encodeURIComponent(text),
      filename: `${DIR}/${await uniqueName(name)}`,
      // Por si hay un fichero que Chrome no conoce con ese nombre: que no lo pise
      conflictAction: 'uniquify',
      saveAs: false,
    });
    await waitComplete(id);
    const [item] = await chrome.downloads.search({ id });

    // Los últimos MAX_FILES; los más antiguos se borran del disco y del historial de descargas
    const { saved = [] } = await chrome.storage.local.get('saved');
    saved.push(id);
    for (const old of saved.splice(0, Math.max(0, saved.length - MAX_FILES))) {
      await chrome.downloads.removeFile(old).catch(() => {});
      await chrome.downloads.erase({ id: old }).catch(() => {});
    }
    await chrome.storage.local.set({ saved });
    return { path: item.filename };
  } finally {
    chrome.downloads.setUiOptions({ enabled: true }).catch(() => {});
  }
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'save') return;
  saveElement(msg).then(sendResponse, (e) => sendResponse({ error: e.message }));
  return true;
});
