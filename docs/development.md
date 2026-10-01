# Development

Convert Image is a Chromium 116+ Manifest V3 extension using plain JavaScript and native browser APIs. There is no build step or runtime dependency installation. Load `src/` unpacked at `chrome://extensions` with Developer mode enabled.

## Source layout

| File | Purpose |
| --- | --- |
| `src/manifest.json` | Extension metadata, minimum browser version, permissions, and icons. |
| `src/background.js` | Image context menus, downloads, offscreen document lifecycle, notifications, and current-tab clipboard injection. |
| `src/offscreen.html`, `src/offscreen.js` | Fetching, decoding, canvas conversion, and download object URL ownership. |
| `src/name.js` | Sanitized output filenames, reused from the Firefox edition. |
| `test/name.test.js` | Filename checks. |
| `test/offscreen.test.js` | Source-fetch timeout check through the offscreen message listener. |
| `scripts/check-clipboard.mjs` | Isolated headless clipboard compatibility and production copy probe. |

## Image processing

The three image-only menu actions are **Save image as PNG**, **Save image as JPG**, and **Copy image as PNG**. Conversion preserves intrinsic dimensions and PNG transparency. JPG saving produces actual JPEG bytes with a white background at quality 0.92. Only PNG is copied; JPEG clipboard writes were rejected in the tested Chromium browser.

The service worker owns menu and download APIs. A reusable offscreen document fetches images with `credentials: "include"`, decodes them, and converts them through canvas. Fetch and response-body reads time out after 30 seconds. Image load/error events are used before drawing because `Image.decode()` reproduced an unresolved promise in the offscreen document on Brave 151.

Temporary decode URLs are revoked after conversion. Download URLs remain owned by the offscreen document until completion or interruption, including across worker suspension. Failed or cancelled download starts release their URLs. Save dialogs use `saveAs: true`; cancellation is quiet, while other failures produce notifications.

Copy converts the image offscreen and passes PNG data to a clipboard writer injected into the current tab's isolated script context. It does not open or navigate tabs. Clipboard writing requires a focused secure page such as HTTPS or localhost; insecure and browser-protected pages report errors. Conversion completes before writing, preserving clipboard contents if conversion fails. HTTP saving remains supported.

HTTP/HTTPS host access allows fetching selected images from arbitrary sites. Local file images require **Allow access to file URLs** in extension settings. Site fetch restrictions can block images, and page-owned `blob:` URLs are inaccessible from the extension. Chromium's decoder determines supported formats. SVGs need intrinsic dimensions. Canvas uses the animation's default image, or first frame when no default image exists. No telemetry or remote executable code is included.

Output names use the decoded final pathname segment for HTTP, HTTPS, and file URLs, ignoring query strings and fragments. The last extension is removed, unsafe characters are replaced with underscores, surrounding dots and whitespace are trimmed, and the stem is limited to 100 characters. Unusable names and data/blob URLs fall back to `image.png` or `image.jpg`.

## Automated checks

Use Node.js 22 or newer:

```bash
node --test
node scripts/check-clipboard.mjs /usr/bin/brave
```

The clipboard probe launches Brave with a temporary profile. It checks offscreen focus rejection, native JPEG rejection, production current-tab PNG copy/paste, preserved dimensions and transparency, unchanged tab count and URL, and focus-loss rejection. It uses the headless clipboard and does not prove desktop image-editor paste or real context-menu interaction.

## Verification status

As of 2026-10-01, filename and source-fetch timeout tests passed. Production PNG copy/paste passed in headless Brave with Chromium 151.0.7922.173. Current-page copying was also reported working during manual use. Chromium 116 is the declared minimum and has not been tested.

Remaining browser acceptance checks:

- Exercise all three real context-menu actions with PNG, JPEG, WebP, AVIF, GIF, and intrinsically sized SVG inputs.
- Inspect saved image signatures, dimensions, PNG transparency, white JPG backgrounds, and sanitized filenames.
- Paste copied PNGs into a desktop image editor and a headed browser destination; check focus loss and retry.
- Check corrupt images, failed HTTP responses, blocked fetches, SVGs without intrinsic size, and inaccessible blob URLs.
- Check rapid actions, save cancellation, interrupted downloads, worker suspension, extension reload, and browser restart with developer tools closed.
- Confirm download URL cleanup and error notifications, and verify the minimum supported browser version.

## Packaging

After browser acceptance, create a ZIP containing only the contents of `src/`, with `manifest.json` at the archive root. Extract it and load the extracted folder unpacked to verify the package. Tests, development scripts, and documentation are excluded from the extension package. Packaging and store publication remain pending.
