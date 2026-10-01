# Chromium extension implementation plan

## Active task

**Goal:** Port Convert Image from `/home/froyln/Dev/CopyImage-Firefox` to Chromium, preserving save/copy PNG and JPG behavior with explicit clipboard compatibility.

**Status:** Steps 1–9 implemented. Step 10 browser and failure-path acceptance is pending; package only after acceptance.

**Scope:** User continued the planned port through implementation Steps 4–9. Use plain JavaScript, native browser APIs, and no build system or new runtime dependencies. Leave the Firefox project unchanged.

## Step 1 — Initialize the workspace (complete)

- Copy the supplied template into this project.
- Customize AGENTS.md, README.md, and PLAN.md; retain CLAUDE.md as an import of AGENTS.md.
- Validate template setup.

**Completion check:** `python3 scripts/check-agent-setup.py` passed with `Agent setup is valid`.

**Repository binding (2026-09-30):** Initialized local Git on `main` and set `origin` to `https://github.com/froyln/CopyImage-Extension-Chrome.git`. `git ls-remote origin` succeeded with no advertised refs. Re-ran the setup validator successfully. No commit or push was made.

## Step 2 — Confirm the behavior to preserve (complete)

- Re-read Firefox `src/manifest.json`, `src/background.js`, `src/name.js`, and `test/name.test.js` before implementation.
- Record the four menu labels, filename rules, save dialog behavior, notification behavior, original dimensions, PNG transparency, white JPG background, and JPEG quality 0.92.
- Confirm actual animated-image behavior rather than relying only on the Firefox README's first-frame claim.
- Establish Chromium 116+ as the proposed minimum, using runtime.getContexts() to discover the offscreen document.

**Completion check:** The port has a concrete behavior checklist and a recorded target browser/version.

### Recorded behavior (2026-09-30)

Read Firefox `src/manifest.json` (Convert Image 1.0.2), `src/background.js`, `src/name.js`, `test/name.test.js`, and README directly. Preserve these observable behaviors:

| Area | Behavior to preserve |
| --- | --- |
| Menus | Image-only `save-png` → **Save image as PNG**, `save-jpg` → **Save image as JPG**, `copy-png` → **Copy image as PNG**, `copy-jpg` → **Copy image as JPG**. JPG copy wording remains subject to Step 3. |
| Fetch | Fetch from the extension with `credentials: "include"`; unsuccessful HTTP responses raise `Download failed: HTTP <status>`. Host access and inaccessible page-owned blob URLs remain explicit limitations. |
| Decode and dimensions | Decode a fetched blob through an object URL and `Image.decode()`. Use `naturalWidth` and `naturalHeight`, without resizing; reject zero dimensions with `Image has no intrinsic size (SVG without width/height?)`. Revoke the decode URL in `finally`. |
| PNG | Encode `image/png`, preserving transparent pixels. |
| JPG | Fill the canvas white before drawing; encode `image/jpeg` with quality `0.92`. |
| Animation | Existing code uses `Image` → `drawImage`, with no frame-selection code. The HTML canvas specification requires the animation's default image, or its first frame when no default exists. Preserve this native behavior; README's unconditional first-frame statement is too broad. Runtime GIF/APNG/WebP verification is pending Step 7/10, not claimed here. |
| Names | For HTTP, HTTPS, and file URLs, use the decoded last pathname segment, ignoring query/fragment. Remove the last extension; replace backslash, slash, colon, asterisk, question mark, quote, angle brackets, pipe, and ASCII control characters with `_`; trim leading/trailing dots and whitespace; cap the stem at 100 characters; append `.png` or `.jpg`. Empty/unusable names, malformed URLs/percent escapes, and data/blob URLs use `image.<ext>`. Copy the helper unchanged. |
| Saving | Use the generated filename and `saveAs: true`. Keep the output URL alive until download completion/interruption; revoke it if starting the download fails. |
| Clipboard | Firefox writes actual PNG/JPEG bytes through `browser.clipboard.setImageData`. Chromium parity is unverified; Step 3 must establish the exact representation and ordinary paste behavior. Conversion must finish before writing the clipboard. |
| Errors | Firefox suppresses errors whose message matches `/cancel/i`; other failures produce a basic notification titled **Copy Image As failed**, with the error followed by a newline and at most 200 source-URL characters. Preserve quiet save cancellation and meaningful failures; Chromium needs a bundled notification icon. Null canvas context is not explicitly checked in Firefox; handle it in the port. |

**Target:** Chromium/Chrome 116 or newer, Manifest V3, `chrome.runtime.getContexts()` for offscreen discovery. Chrome's [runtime reference](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-getContexts) identifies this method as Chrome 116+; the [offscreen reference](https://developer.chrome.com/docs/extensions/reference/api/offscreen) documents reusable-document discovery and creation. This is the minimum target, not a tested browser/version.

**Animation source:** [HTML canvas image-source rules](https://html.spec.whatwg.org/multipage/canvas.html#image-sources-for-2d-rendering-contexts). This conclusion comes from the actual conversion path plus the standard, not a browser experiment.

**Verification:** `node --test /home/froyln/Dev/CopyImage-Firefox/test/name.test.js` passed (exit 0). The Firefox reference was left unchanged. No extension/browser/clipboard checks were run in this step.

## Step 3 — Resolve clipboard compatibility before completing the menus (complete)

- Test image/png clipboard writes from an extension offscreen document with clipboardWrite permission; if focus blocks them, establish a working alternative before implementation.
- Check native image/jpeg support and actual paste behavior in the target Chromium browser.
- If native JPEG is unsupported, record the proposed fallback: convert to JPG with white background and quality 0.92, decode that result, then write PNG for ordinary image paste.
- Make the clipboard format distinction explicit in the menu wording or documentation; resolve any required user choice before claiming four-action parity.
- Do not substitute custom JPEG clipboard formats without proving ordinary destination applications accept them.

**Completion check:** PNG paste works and the JPG action's exact behavior is settled and documented. Native JPEG parity is never assumed.

### Clipboard probe results (2026-09-30)

Added dependency-free `scripts/check-clipboard.mjs`, which creates a temporary MV3 probe extension and isolated headless browser profile, sends real runtime messages to an offscreen document, and exercises real Ctrl+V paste events in an ordinary localhost web page. It uses the browser's headless clipboard, not the desktop clipboard. Run with Node 22+ (built-in WebSocket):

```bash
node scripts/check-clipboard.mjs /usr/bin/brave
```

Passed with Brave 151.1.93.138, Chromium **151.0.7922.173**, Linux, Node 26.7.0:

- Offscreen document with `clipboardWrite` and `CLIPBOARD`/`BLOBS` reasons: `navigator.clipboard.write()` rejects PNG with `NotAllowedError: Document is not focused`. This is a reproduced architectural failure, not a passing offscreen copy implementation.
- Focused extension page: PNG write succeeds; ordinary Ctrl+V yields an `image/png` file. Decoding it into a canvas preserves 8×8 dimensions and transparent pixels (alpha 0).
- Focused extension page: native JPEG write rejects with `NotAllowedError: Type image/jpeg not supported on write`; `ClipboardItem.supports('image/jpeg')` is false, PNG is true.
- Proposed JPG fallback: fill white, encode actual JPEG at quality 0.92, decode the JPEG, encode PNG, then write PNG. Ctrl+V yields `image/png`, 8×8, with a near-white opaque pixel `[255,254,254,255]` (JPEG encoding can introduce slight color changes). This provides JPG appearance, **not native JPEG clipboard data**.

The [Chromium clipboard implementation](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/modules/clipboard/clipboard_item.cc) supports ordinary PNG but not ordinary JPEG. [Clipboard preconditions](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/modules/clipboard/clipboard_promise.cc) enforce document focus. These agree with the runtime results. No custom `web image/jpeg` format is proposed.

**Additional attempts:** The first launch was sandbox-blocked (`setsockopt: Operation not permitted`); the same probe ran successfully outside the sandbox after approval. Google Chrome 154.0.8037.57 launched, but the command-line probe extension was not usable; no Chrome clipboard results are claimed. A selected-image `execCommand('copy')` experiment stalled in headless Brave; it is not a proven fallback and was removed from the runnable probe.

**Approved decision:** The user approved the focused copy-page approach and explicit PNG clipboard fallback after the explanation of its visible-page behavior. Keep conversion offscreen and use a focused extension copy page for clipboard writes. Label the JPG copy action **Copy image with JPG appearance (PNG clipboard)** and explain the JPEG encode/decode step in README. This replaces the offscreen-only clipboard constraint; no further approval is needed for this choice.

**Completion:** PNG and JPG-fallback paste into an ordinary localhost web page passed, and the user settled the exact copy behavior. Step 3's compatibility decision is complete. Desktop image-editor paste, headed browser behavior, minimum-version verification, and the production copy-page interaction remain explicit acceptance gates in Steps 9–10. The canvas paste check does not prove desktop editor acceptance.

## Step 4 — Create the minimal extension files (complete)

- Create `src/manifest.json`, `src/background.js`, `src/offscreen.html`, and `src/offscreen.js`.
- Create `src/copy.html` and `src/copy.js` for the approved focused clipboard flow.
- Copy the existing `src/name.js` helper and `test/name.test.js` without changing naming behavior unnecessarily.
- Export the existing SVG artwork to PNG icons at 16, 32, 48, and 128 pixels; retain artwork attribution if present.
- Use bundled external scripts in HTML rather than inline scripts.

**Completion check:** The extension uses plain JavaScript and bundled files, the reused filename helper/tests, PNG exports of the existing VTracer icon, and a focused copy page. No framework, package manager, or dependency was added.

## Step 5 — Configure Manifest V3 (implemented)

- Preserve Convert Image's name and purpose; choose an explicit initial Chromium release version.
- Declare background.service_worker and minimum_chrome_version.
- Declare contextMenus, downloads, clipboardWrite, notifications, and offscreen permissions.
- Put HTTP/HTTPS and file image-fetch access in host_permissions. Document why arbitrary image hosts require access and the browser's additional file URL toggle.
- Reference PNG icons and remove Firefox-only metadata and Manifest V2 background scripts.

**Completion check:** Manifest V3 declares the required APIs, Chromium 116 minimum, host permissions, service worker, and PNG icon assets. Unpacked browser loading remains in Step 10.

## Step 6 — Register menus and route actions (implemented)

- Register the four image-only actions through chrome.contextMenus during installation/update, without creating duplicates on worker restarts.
- Register event listeners synchronously at the service worker's top level.
- Validate menu IDs and source URLs before processing; accept only the four intended actions.
- Ensure one offscreen document exists before sending a request. Guard simultaneous creation and rediscover an existing document after worker restart.
- Route conversion/clipboard requests through runtime messages containing JSON-compatible values. Check message destination and sender; return structured success/error results.
- For copy actions, open the focused extension copy page from the worker. Keep conversion in the offscreen document and clipboard writes in the copy page; track temporary copy resources through completion, failure, and page closure.

**Completion check:** Each menu action reaches the correct operation once; rapid clicks and worker restarts do not duplicate menus or create competing offscreen documents.

## Step 7 — Port image conversion (implemented)

- Fetch images from the extension context with the existing credentials behavior and host permissions.
- Reject unsuccessful HTTP responses; decode fetched bytes through an object URL and Image.
- Require nonzero intrinsic dimensions and preserve source dimensions.
- Draw to canvas. Preserve PNG alpha; fill white before JPG rendering; encode JPG at quality 0.92.
- Handle decode failure, unavailable canvas context, and failed encoding.
- Release temporary decode object URLs in finally blocks.
- Verify animated-image output; choose deterministic first-frame decoding if the reused flow does not provide the intended result.

**Completion check:** PNG, JPEG, WebP, AVIF, GIF, and intrinsically sized SVG inputs produce valid images with expected dimensions, backgrounds, and frame behavior.

## Step 8 — Implement save and resource cleanup (implemented)

- Use the existing outputName helper for PNG/JPG filenames.
- Create the download object URL in the offscreen document; pass its string to the worker and invoke chrome.downloads.download with saveAs: true.
- Keep the offscreen document and URL alive until the download completes or is interrupted; revoke immediately if starting the download fails or is cancelled.
- Keep pending URL ownership in the offscreen document so worker suspension does not lose the cleanup mapping. Route download terminal events back through runtime messaging, accounting for events arriving before registration completes.
- Filter download completion events to this extension's blob URLs; register each download in the offscreen document, then query once to cover completion before registration.
- Retain one reusable offscreen document instead of closing it while operations or downloads are active.

**Completion check:** Files save with correct names and actual PNG/JPEG contents; cancellation is quiet, interrupted downloads clean up, and worker suspension does not break a pending save.

## Step 9 — Implement clipboard actions and errors (implemented)

- Write PNG using navigator.clipboard.write and ClipboardItem in the focused extension copy page. Handle lost focus explicitly and provide a Copy button to retry; never report success before the write resolves.
- Implement the approved JPG-to-PNG clipboard fallback: white background, JPEG quality 0.92, decode JPEG, then write PNG. Use the explicit JPG-appearance/PNG-clipboard menu label.
- Preserve existing clipboard contents when conversion fails by writing only after successful encoding.
- Send failures to the worker for notifications with a bundled icon and bounded source URL text.
- Treat save cancellation quietly and avoid swallowing genuine conversion or clipboard errors.

**Completion check:** Both copy actions paste correctly into an image editor and an ordinary browser paste destination; failures produce meaningful notifications.

## Step 10 — Run focused verification (pending)

- Run `node --test` for the reused filename tests.
- Add only focused runnable checks for substantive new routing/lifecycle logic when implementation is authorized; use Node's built-in test runner rather than adding a framework.
- Manually check each of the four actions against representative supported image inputs.
- Check transparency, white JPG backgrounds, dimensions, image signatures, JPEG quality behavior, encoded/query-string filenames, and fallback filenames.
- Check corrupt images, failed HTTP responses, blocked fetches, SVGs without intrinsic size, and inaccessible blob URLs.
- Check rapid repeated actions, cancelled save dialogs, interrupted downloads, worker suspension during operations, extension reload, and browser restart.
- Verify normal operation with developer tools closed so inspection does not hide lifecycle issues.
- Verify the focused copy page, loss of focus and retry, copy-page closure cleanup, desktop image-editor paste, and headed-browser paste. Record tested versions; Chromium 116 remains an untested minimum until verified.

**Completion check:** Record browser/version, exact automated commands/results, manual outcomes, and any unverified behavior. No unexplained runtime errors remain.

## Step 11 — Document installation and limitations

- Replace the placeholder README status with features and unpacked installation steps.
- Document requirements, Node verification command, permissions, clipboard format behavior, supported decoding formats, animation behavior, and known limitations.
- Update AGENTS.md with real implementation entry points and verification commands.
- Run `python3 scripts/check-agent-setup.py` after documentation changes.

**Completion check:** A new developer can load and verify the extension using the README; project instructions describe the actual implementation.

## Step 12 — Package the verified extension

- Create a ZIP containing only `src/` contents, with manifest.json at the archive root.
- Exclude tests, template tooling, development instructions, secrets, and Firefox artifacts.
- Extract the archive and load that extracted copy unpacked to verify packaging.
- Mark implementation complete only after acceptance checks pass. Publishing to a store is outside this implementation plan and requires separate authorization.

**Completion check:** The release ZIP contains a working extension and the handoff records its location and validation results.

## Final acceptance

- Four image-only context menu actions operate with explicitly documented clipboard compatibility.
- Saved PNG/JPG files have correct formats, dimensions, names, and transparency/background behavior.
- Copied images paste into ordinary destinations.
- Failure, cancellation, concurrency, download cleanup, and worker restart checks pass.
- The project uses Manifest V3, bundled code, native APIs, no telemetry, and no unnecessary dependencies.
- README, AGENTS.md, PLAN.md, and packaged files match the verified result.

## State for handoff

**Files changed:** MV3 extension files and PNG icons in src/, copied filename helper/test, scripts/check-clipboard.mjs, and updated README.md, AGENTS.md, PLAN.md.

**Decisions:** Reuse Firefox behavior and helper/tests; minimum target Chromium version is 116. Preserve canvas default-image/first-frame animation behavior. Offscreen async clipboard writes fail on tested Chromium 151; focused-page PNG and JPEG-to-PNG fallback writes/pastes pass. User approved the focused copy page and explicit PNG clipboard representation; do not claim native JPEG parity.

**Checks completed:** Setup validator, reference filename check, and filename test passed. Syntax checks passed for extension and probe scripts; manifest JSON parses and all four icons are valid PNGs. Headless Brave clipboard probe passed, including offscreen focus failure, native JPEG rejection, and ordinary-page PNG/fallback paste. Production extension, desktop editor paste, and unpacked browser checks have not run.

**Next action:** Step 10 — run filename tests, load src/ unpacked in Chromium, then check all four actions, save cancellation/interruption, clipboard focus retry, and cleanup. Do not package until acceptance passes or limitations are recorded.
