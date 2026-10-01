const query = new URLSearchParams(location.search);
const src = query.get("src");
const type = query.get("type");
const status = document.querySelector("#status");
const button = document.querySelector("#copy");
let blob;
let token;

if (!src || !["image/png", "image/jpeg"].includes(type)) {
  status.textContent = "Invalid image request.";
} else {
  chrome.runtime.sendMessage({ target: "worker", action: "copy-convert", src, type }).then(async (result) => {
    if (result?.error) throw new Error(result.error);
    token = result.token;
    const response = await fetch(result.url);
    if (!response.ok) throw new Error("Could not read the converted image");
    blob = await response.blob();
    chrome.runtime.sendMessage({ target: "worker", action: "copy-release", token });
    token = null;
    status.textContent = type === "image/jpeg"
      ? "Ready to copy. The clipboard will contain PNG pixels with JPG appearance."
      : "Ready to copy as PNG.";
    button.hidden = false;
  }).catch((error) => {
    if (token) chrome.runtime.sendMessage({ target: "worker", action: "copy-release", token });
    token = null;
    status.textContent = error.message || String(error);
  });
}

button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    status.textContent = "Copied.";
    button.hidden = true;
  } catch (error) {
    status.textContent = `${error.message || error} Click Copy image to retry.`;
    button.disabled = false;
  }
});

addEventListener("pagehide", () => {
  if (token) chrome.runtime.sendMessage({ target: "worker", action: "copy-release", token });
});
