# Convert Image for Chromium

A Chromium port of the Firefox Convert Image extension, offering save as PNG/JPG and copy as PNG.

## Current state

Initialized from the supplied project template. Production implementation exists; browser acceptance checks are pending. See PLAN.md.

PLAN.md Steps 1–9 are implemented. Chromium 116+ is the target minimum. The user replaced the focused copy-page decision with direct copying from the current page. Production current-tab copy/paste passed in headless Brave 151; desktop paste, context-menu interaction, and save acceptance remain pending.

## Commands

- Setup check: `python3 scripts/check-agent-setup.py`
- Filename and source-fetch timeout tests: `node --test`
- Isolated headless clipboard and production copy probe (Node 22+ and Brave): `node scripts/check-clipboard.mjs /usr/bin/brave`. Requires permission to launch the browser outside restricted sandboxing; it tests current-tab copy without navigation and headless clipboard paste, not desktop editor paste.
- After implementation: load `src/` unpacked at `chrome://extensions` and verify all three actions, saved formats, clipboard paste, and failure handling. Add automated commands when their files exist.

## Where to work

- `PLAN.md` — implementation steps, acceptance, and handoff.
- `scripts/check-agent-setup.py` — template validation.
- Firefox edition `src/` — read-only reference for existing behavior when that checkout is available.
- `src/background.js` — context menus, download API, offscreen lifecycle, notifications.
- `src/offscreen.js` — fetch, decode, convert, and hold object URLs through downloads.
- `src/background.js` — also injects the PNG clipboard writer into the current page using `chrome.scripting`.
- `src/name.js`, `test/name.test.js` — filename helper and copied Firefox checks.
- `scripts/check-clipboard.mjs` — isolated headless clipboard compatibility probe.

## Project constraints

- Preserve save PNG, save JPG, and copy PNG. The user removed the JPG-appearance copy action because its clipboard format was PNG; do not reintroduce it.
- Use Manifest V3 and native APIs; plain JavaScript, no build step or new dependencies without demonstrated need.
- Preserve dimensions, PNG transparency, white JPG backgrounds, quality 0.92, sanitized filenames, save dialogs, and error notifications.
- Use an offscreen document for conversion and inject a clipboard writer into the current tab's isolated script context. Do not open or navigate tabs for copy actions. Downloads and menu APIs belong in the service worker.
- Copy requires a focused secure page (HTTPS/localhost); report failures on insecure or protected pages. Preserve HTTP saving. Use image load events before drawing: `Image.decode()` reproduced an unresolved promise in the offscreen document on Brave 151.
- Saving JPG produces actual JPEG with a white background at quality 0.92. Only PNG may be copied.
- HTTP/HTTPS access is broad because selected images can come from any site. File images require users to enable **Allow access to file URLs** in extension settings.
- Verify JPEG clipboard support before claiming parity. Do not silently describe PNG clipboard data as native JPEG.
- No telemetry or remote executable code. Document fetch permissions and limitations.

## Working agreement

- Inspect relevant code and existing changes before editing; keep changes within the request.
- Scope searches and output to the question; preserve meaningful failure details.
- Use focused checks and report relevant verification commands and results, including checks that could not run.
- Update this file when its facts or commands change.
- Keep PLAN.md current for dependent steps and handoffs; retain decisions and remaining checks after context resets.
- Do not read or disclose secrets. Ask before destructive actions or external publication unless already authorized.
