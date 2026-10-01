// Isolated headless clipboard probe; no packages or desktop clipboard access.
// Usage: node scripts/check-clipboard.mjs /usr/bin/brave
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const root = await mkdtemp(join(tmpdir(), 'copyimage-clipboard-'));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><title>Ordinary browser paste destination</title><textarea autofocus></textarea>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const extension = join(root, 'extension');
await mkdir(extension);
await writeFile(join(extension, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Clipboard compatibility probe', version: '0.0.1',
  minimum_chrome_version: '116', permissions: ['offscreen', 'clipboardWrite'],
  background: { service_worker: 'worker.js' },
}));
await writeFile(join(extension, 'worker.js'), `
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'worker') return;
  chrome.offscreen.createDocument({url: 'offscreen.html', reasons: ['CLIPBOARD', 'BLOBS'],
    justification: 'Probe image clipboard compatibility'}).then(() => reply({ok: true}),
    error => reply({error: error.message}));
  return true;
});
`);
await writeFile(join(extension, 'offscreen.html'), '<!doctype html><script src="offscreen.js"></script>');
await writeFile(join(extension, 'offscreen.js'), `
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'offscreen') return;
  probe(message.mode).then(reply, error => reply({error: error.name + ': ' + error.message}));
  return true;
});
async function probe(mode) {
  const canvas = document.createElement('canvas');
  canvas.width = 8; canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (mode !== 'png') { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 8, 8); }
  ctx.fillStyle = 'red'; ctx.fillRect(4, 0, 4, 8);
  const encode = type => new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Encoding failed')), type, 0.92));
  let blob = await encode(mode === 'png' ? 'image/png' : 'image/jpeg');
  const encodedType = blob.type;
  if (mode === 'fallback') {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      ctx.clearRect(0, 0, 8, 8); ctx.drawImage(image, 0, 0);
      blob = await encode('image/png');
    } finally { URL.revokeObjectURL(url); }
  }
  await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
  return {encodedType, clipboardType: blob.type};
}
`);
const offscreenSource = await readFile(join(extension, 'offscreen.js'), 'utf8');
await writeFile(join(extension, 'focused.js'), offscreenSource.slice(offscreenSource.indexOf('async function probe')));
await writeFile(join(extension, 'probe.html'), '<!doctype html><textarea autofocus></textarea><script src="focused.js"></script>');

const browser = spawn(process.argv[2] || '/usr/bin/brave', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${join(root, 'profile')}`, '--remote-debugging-port=0',
  `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let log = '';
browser.stderr.on('data', chunk => { log = (log + chunk).slice(-8000); });
let socket;
try {
  let endpoint;
  for (let i = 0; i < 100; i++) {
    if (browser.exitCode !== null) throw new Error(`Browser exited: ${log}`);
    try {
      const [port, path] = (await readFile(join(root, 'profile', 'DevToolsActivePort'), 'utf8')).trim().split('\n');
      endpoint = `ws://127.0.0.1:${port}${path}`; break;
    } catch { await delay(100); }
  }
  assert.ok(endpoint, `Debug endpoint unavailable: ${log}`);
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
  };
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10000);
    pending.set(id, {resolve, reject, timer});
    socket.send(JSON.stringify({id, method, params, sessionId}));
  });
  const evaluate = async (session, expression) => {
    const result = await call('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, session);
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  console.log(JSON.stringify(await call('Browser.getVersion')));
  let worker;
  for (let i = 0; i < 100; i++) {
    worker = (await call('Target.getTargets')).targetInfos.find(t => t.type === 'service_worker' && t.url.startsWith('chrome-extension://') && t.url.endsWith('/worker.js'));
    if (worker) break;
    await delay(100);
  }
  assert.ok(worker, `Probe extension did not load: ${log}`);
  // URL.origin is "null" for extension URLs in Node.
  const extensionOrigin = worker.url.slice(0, worker.url.lastIndexOf('/'));
  const {targetId} = await call('Target.createTarget', {url: `${extensionOrigin}/probe.html`});
  const {sessionId} = await call('Target.attachToTarget', {targetId, flatten: true});
  await call('Runtime.enable', {}, sessionId);
  for (let i = 0; i < 100; i++) {
    if (await evaluate(sessionId, `typeof chrome.runtime?.sendMessage === 'function' && !!document.querySelector('textarea')`)) break;
    await delay(100);
  }
  assert.deepEqual(await evaluate(sessionId, `chrome.runtime.sendMessage({target:'worker'})`), {ok: true});
  const {targetId: pasteTarget} = await call('Target.createTarget', {url: `http://127.0.0.1:${server.address().port}/`});
  const {sessionId: pasteSession} = await call('Target.attachToTarget', {targetId: pasteTarget, flatten: true});
  await call('Runtime.enable', {}, pasteSession);
  for (let i = 0; i < 100; i++) {
    if (await evaluate(pasteSession, `!!document.querySelector('textarea')`)) break;
    await delay(100);
  }
  await evaluate(pasteSession, `
    window.pasted = null;
    document.addEventListener('paste', async event => {
      event.preventDefault();
      const file = event.clipboardData.files[0];
      if (!file) { window.pasted = {error: 'No image file'}; return; }
      const image = await createImageBitmap(file);
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); image.close();
      window.pasted = {type: file.type, width: canvas.width, height: canvas.height,
        pixel: Array.from(ctx.getImageData(0, 0, 1, 1).data)};
    });
    document.querySelector('textarea').focus();
  `);
  const offscreenWrite = await evaluate(sessionId, `chrome.runtime.sendMessage({target:'offscreen', mode:'png'})`);
  console.log(JSON.stringify({offscreenWrite}));
  assert.match(offscreenWrite.error || '', /Document is not focused/);
  await call('Page.bringToFront', {}, sessionId);
  for (const mode of ['png', 'fallback']) {
    await call('Page.bringToFront', {}, sessionId);
    const write = await evaluate(sessionId, `probe(${JSON.stringify(mode)}).catch(error => ({error:error.name + ': ' + error.message}))`);
    console.log(JSON.stringify({focusedPageMode: mode, write}));
    assert.equal(write.clipboardType, 'image/png');
    await call('Page.bringToFront', {}, pasteSession);
    await evaluate(pasteSession, 'window.pasted = null; document.querySelector("textarea").focus()');
    await call('Input.dispatchKeyEvent', {type:'keyDown', key:'v', code:'KeyV', windowsVirtualKeyCode:86, modifiers:2}, pasteSession);
    await call('Input.dispatchKeyEvent', {type:'keyUp', key:'v', code:'KeyV', windowsVirtualKeyCode:86, modifiers:2}, pasteSession);
    let pasted;
    for (let i = 0; i < 50; i++) {
      pasted = await evaluate(pasteSession, 'window.pasted');
      if (pasted) break;
      await delay(100);
    }
    console.log(JSON.stringify({mode, pasted}));
    assert.equal(pasted?.type, 'image/png');
    assert.equal(pasted.width, 8); assert.equal(pasted.height, 8);
    assert.equal(pasted.pixel[3], mode === 'png' ? 0 : 255);
    if (mode === 'fallback') assert.ok(pasted.pixel.slice(0, 3).every(value => value >= 240));
  }
  console.log(JSON.stringify(await evaluate(sessionId, `({png:ClipboardItem.supports('image/png'), jpeg:ClipboardItem.supports('image/jpeg')})`)));
  await call('Page.bringToFront', {}, sessionId);
  const jpeg = await evaluate(sessionId, `probe('jpeg').then(() => ({ok:true}), error => ({error:error.name + ': ' + error.message}))`);
  console.log(JSON.stringify({focusedPageJpeg: jpeg}));
  assert.match(jpeg.error || '', /image\/jpeg.*not supported|not supported.*image\/jpeg/i);
  console.log('Compatibility probe passed: offscreen focus failure reproduced; focused-page PNG/JPG fallback paste works. Desktop editor paste remains manual.');
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  if (browser.exitCode === null) await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(5000)]);
  if (browser.exitCode === null) browser.kill('SIGKILL');
  await rm(root, {recursive: true, force: true});
  await new Promise(resolve => server.close(resolve));
}
