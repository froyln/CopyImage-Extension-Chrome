const pendingURLs = new Map();
const pendingDownloads = new Map();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.target !== "offscreen") return;
  if (message.action === "convert") {
    convert(message.src, message.type, message.operation).then(respond, (error) => respond({ error: error.message || String(error) }));
    return true;
  }
  if (message.action === "release") release(message.token);
  if (message.action === "download-started") pendingDownloads.set(message.id, message.token);
  if (message.action === "download-finished") {
    release(pendingDownloads.get(message.id));
    pendingDownloads.delete(message.id);
  }
});

async function convert(src, type, operation) {
  if (!["image/png", "image/jpeg"].includes(type) || !["save", "copy"].includes(operation)
      || (operation === "copy" && type !== "image/png")) {
    throw new Error("Invalid conversion request");
  }
  const url = new URL(src);
  if (!["http:", "https:", "file:", "data:"].includes(url.protocol)) throw new Error("Unsupported image URL");
  const response = await fetch(src, { credentials: "include", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const inputURL = URL.createObjectURL(await response.blob());
  try {
    const image = await loadImage(inputURL);
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height) throw new Error("Image has no intrinsic size (SVG without width/height?)");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    if (type === "image/jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0);
    const blob = await encode(canvas, type);
    if (operation === "copy") {
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return { dataURL, type: blob.type, width, height };
    }
    const token = crypto.randomUUID();
    const outputURL = URL.createObjectURL(blob);
    pendingURLs.set(token, outputURL);
    return { url: outputURL, token, type: blob.type, width, height };
  } finally {
    URL.revokeObjectURL(inputURL);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image"));
    image.src = url;
  });
}

function encode(canvas, type) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    blob ? resolve(blob) : reject(new Error("Encoding failed"));
  }, type, 0.92));
}

function release(token) {
  const url = pendingURLs.get(token);
  if (!url) return;
  URL.revokeObjectURL(url);
  pendingURLs.delete(token);
}
