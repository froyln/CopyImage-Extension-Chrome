importScripts("name.js");

const actions = {
  "save-png": { operation: "save", type: "image/png", extension: "png", title: "Save image as PNG" },
  "save-jpg": { operation: "save", type: "image/jpeg", extension: "jpg", title: "Save image as JPG" },
  "copy-png": { operation: "copy", type: "image/png", extension: "png", title: "Copy image as PNG" },
};
let creatingOffscreen;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, action] of Object.entries(actions)) {
      chrome.contextMenus.create({ id, title: action.title, contexts: ["image"] });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
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
  const operation = action.operation === "copy"
    ? copyImage(info.srcUrl, action.type, tab?.id)
    : saveImage(info.srcUrl, action);
  operation.catch((error) => {
    if (action.operation !== "save" || !/cancel/i.test(error?.message || "")) notify(error, info.srcUrl);
  });
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
  if (operation === "copy" ? !result?.dataURL : !result?.url || !result?.token) {
    throw new Error("Image conversion returned no result");
  }
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

async function copyImage(src, type, tabId) {
  if (!Number.isInteger(tabId)) throw new Error("No page is available for copying");
  const result = await convert(src, type, "copy");
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: writePNG,
    args: [result.dataURL],
  });
  if (!injection?.result?.ok) throw new Error(injection?.result?.error || "Image copy did not complete");
}

async function writePNG(dataURL) {
  try {
    if (!navigator.clipboard?.write) throw new Error("Image copy requires an HTTPS page or another secure page");
    if (!document.hasFocus()) throw new Error("Keep this page focused until copying finishes, then try again");
    const bytes = Uint8Array.from(atob(dataURL.split(",")[1]), character => character.charCodeAt(0));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) })]);
    return { ok: true };
  } catch (error) {
    return { error: error.message || String(error) };
  }
}

function notify(error, src = "") {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/128.png",
    title: "Copy Image As failed",
    message: `${error?.message || error}\n${String(src).slice(0, 200)}`,
  });
}
