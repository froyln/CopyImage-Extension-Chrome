importScripts("name.js");

const actions = {
  "save-png": { operation: "save", type: "image/png", extension: "png", title: "Save image as PNG" },
  "save-jpg": { operation: "save", type: "image/jpeg", extension: "jpg", title: "Save image as JPG" },
  "copy-png": { operation: "copy", type: "image/png", extension: "png", title: "Copy image as PNG" },
  "copy-jpg": { operation: "copy", type: "image/jpeg", extension: "jpg", title: "Copy image with JPG appearance (PNG clipboard)" },
};
let creatingOffscreen;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, action] of Object.entries(actions)) {
      chrome.contextMenus.create({ id, title: action.title, contexts: ["image"] });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const action = actions[info.menuItemId];
  if (!action) return;
  let source;
  try {
    source = new URL(info.srcUrl);
    if (!["http:", "https:", "file:", "data:"].includes(source.protocol)) throw new Error("Unsupported image URL");
  } catch (error) {
    notify(error, info.srcUrl);
    return;
  }
  if (action.operation === "copy") {
    const query = new URLSearchParams({ src: info.srcUrl, type: action.type });
    chrome.tabs.create({ url: chrome.runtime.getURL(`copy.html?${query}`) }, () => {
      if (chrome.runtime.lastError) notify(chrome.runtime.lastError, info.srcUrl);
    });
  } else {
    saveImage(info.srcUrl, action).catch((error) => {
      if (!/cancel/i.test(error?.message || "")) notify(error, info.srcUrl);
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.target !== "worker") return;
  if (message.action === "copy-convert") {
    convertForCopy(message.src, message.type).then(respond, (error) => {
      notify(error, message.src);
      respond({ error: error.message || String(error) });
    });
    return true;
  }
  if (message.action === "copy-release" && typeof message.token === "string") {
    chrome.runtime.sendMessage({ target: "offscreen", action: "release", token: message.token });
  }
});

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state || delta.state.current === "in_progress") return;
  chrome.downloads.search({ id: delta.id }, (items) => {
    if (chrome.runtime.lastError || !items[0]?.url.startsWith(`blob:${chrome.runtime.getURL("")}`)) return;
    ensureOffscreen().then(() => chrome.runtime.sendMessage({
      target: "offscreen",
      action: "download-finished",
      id: delta.id,
    })).catch(() => {});
  });
});

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  if ((await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] })).length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BLOBS"],
      justification: "Decode images and hold converted blobs while downloads or copy actions finish",
    }).finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

async function convert(src, type, operation) {
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({ target: "offscreen", action: "convert", src, type, operation });
  if (result?.error) throw new Error(result.error);
  if (!result?.url || !result?.token) throw new Error("Image conversion returned no result");
  return result;
}

async function saveImage(src, action) {
  const result = await convert(src, action.type, "save");
  try {
    const downloadId = await chrome.downloads.download({
      url: result.url,
      filename: outputName(src, action.extension),
      saveAs: true,
    });
    await chrome.runtime.sendMessage({ target: "offscreen", action: "download-started", token: result.token, id: downloadId });
    const [download] = await chrome.downloads.search({ id: downloadId });
    if (download && download.state !== "in_progress") {
      chrome.runtime.sendMessage({ target: "offscreen", action: "download-finished", id: downloadId });
    }
  } catch (error) {
    chrome.runtime.sendMessage({ target: "offscreen", action: "release", token: result.token });
    throw error;
  }
}

async function convertForCopy(src, type) {
  const result = await convert(src, type, "copy");
  return { url: result.url, token: result.token, clipboardType: "image/png" };
}

function notify(error, src = "") {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/128.png",
    title: "Copy Image As failed",
    message: `${error?.message || error}\n${String(src).slice(0, 200)}`,
  });
}
