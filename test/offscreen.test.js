const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("a stalled source fetch returns a timeout error to the caller", { timeout: 1000 }, async () => {
  let listener;
  const context = {
    URL,
    chrome: { runtime: {
      id: "test-extension",
      onMessage: { addListener(callback) { listener = callback; } },
    } },
    AbortSignal: { timeout(milliseconds) {
      assert.equal(milliseconds, 30000);
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Image request timed out", "TimeoutError")), 10);
      return controller.signal;
    } },
    fetch: async (url, options) => {
      assert.equal(url, "https://example.com/image.png");
      assert.equal(options.credentials, "include");
      assert.ok(options.signal, "source fetch must have an abort signal");
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/offscreen.js"), "utf8"), context);
  const response = await new Promise(resolve => {
    assert.equal(listener({ target: "offscreen", action: "convert",
      src: "https://example.com/image.png", type: "image/png", operation: "copy" },
    { id: "test-extension" }, resolve), true);
  });
  assert.equal(response.error, "Image request timed out");
});
