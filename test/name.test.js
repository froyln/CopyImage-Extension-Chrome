// name.js is a plain background script (no exports), so load it into a VM context.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ctx = { URL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/name.js"), "utf8"), ctx);
const { outputName } = ctx;

test("replaces the extension", () => {
  assert.strictEqual(outputName("https://x.com/a/cat.webp?w=200", "png"), "cat.png");
  assert.strictEqual(outputName("https://x.com/photo.final.avif", "jpg"), "photo.final.jpg");
});

test("decodes and sanitizes the name", () => {
  assert.strictEqual(outputName("https://x.com/my%20cat%3F.webp", "png"), "my cat_.png");
  assert.strictEqual(outputName("https://x.com/..hidden.gif", "png"), "hidden.png");
});

test("falls back to image", () => {
  assert.strictEqual(outputName("data:image/webp;base64,AAAA", "png"), "image.png");
  assert.strictEqual(outputName("https://x.com/", "jpg"), "image.jpg");
  assert.strictEqual(outputName("https://x.com/%E0%A4%A.webp", "png"), "image.png");
  assert.strictEqual(outputName("not a url", "png"), "image.png");
});
