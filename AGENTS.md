# Convert Image for Chromium

A Chromium port of `/home/froyln/Dev/CopyImage-Firefox`, offering image save and copy as PNG or JPG.

## Current state

Initialized from `/home/froyln/Dev/templates/ClaudeNewProject/template`. Production implementation exists; browser acceptance checks are pending. See PLAN.md.

PLAN.md Steps 1–9 are implemented. Chromium 116+ is the target minimum. The user approved a focused extension copy page after offscreen async clipboard writes failed due to focus on Chromium 151. Desktop paste and production browser verification remain pending.

## Commands

- Setup check: `python3 scripts/check-agent-setup.py`
- Filename tests: `node --test`
- Isolated headless clipboard probe (Node 22+ and Brave): `node scripts/check-clipboard.mjs /usr/bin/brave`. Requires permission to launch the browser outside restricted sandboxing; it tests the headless clipboard, not desktop editor paste.
- After implementation: load `src/` unpacked at `chrome://extensions` and verify all four actions, saved formats, clipboard paste, and failure handling. Add automated commands when their files exist.

## Where to work

- `PLAN.md` — implementation steps, acceptance, and handoff.
- `scripts/check-agent-setup.py` — template validation.
- `/home/froyln/Dev/CopyImage-Firefox/src/` — read-only reference for existing behavior.
- `src/background.js` — context menus, download API, offscreen lifecycle, notifications.
- `src/offscreen.js` — fetch, decode, convert, and hold object URLs through downloads.
- `src/copy.js` — focused clipboard page and PNG clipboard writes.
- `src/name.js`, `test/name.test.js` — filename helper and copied Firefox checks.
- `scripts/check-clipboard.mjs` — isolated headless clipboard compatibility probe.

## Project constraints

- Preserve save PNG, save JPG, copy PNG, and copy JPG with explicitly documented Chromium clipboard compatibility.
- Use Manifest V3 and native APIs; plain JavaScript, no build step or new dependencies without demonstrated need.
- Preserve dimensions, PNG transparency, white JPG backgrounds, quality 0.92, sanitized filenames, save dialogs, and error notifications.
- Use an offscreen document for conversion and a focused extension copy page for clipboard writes (user-approved change). Downloads and menu APIs belong in the service worker; pages use runtime messaging.
- JPG copy encodes JPEG with a white background at quality 0.92, decodes it, and writes PNG. Label it **Copy image with JPG appearance (PNG clipboard)**. Saving JPG produces actual JPEG.
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
