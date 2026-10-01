# Convert Image for Chromium

Chromium port of the Firefox Convert Image extension: right-click an image to save or copy it as PNG or JPG.

## Features

Right-click an image to save as PNG/JPG or copy as PNG. The JPG copy action is labeled **Copy image with JPG appearance (PNG clipboard)**: Chromium's Async Clipboard API accepts PNG image writes but rejects native JPEG writes. It creates JPEG pixels with a white background at quality 0.92, then copies the decoded result as PNG. Saved JPGs are JPEG.

Reference extension: `/home/froyln/Dev/CopyImage-Firefox`. The port targets Chromium 116+ using Manifest V3, a service worker, and an offscreen document for conversion.

The copy flow opens a focused extension page because offscreen clipboard writes fail on tested Chromium 151 when the document is not focused. Click **Copy image** on that page to write the clipboard. PNG copy preserves transparency. The JPG appearance action encodes JPEG with a white background at quality 0.92, decodes it, and copies PNG pixels. Native JPEG clipboard writes are unsupported in the tested browser. The source icon artwork is from the Firefox project and identifies VTracer 0.6.4 as its generator.

## Install for development

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project's `src/` folder.

The extension targets Chromium 116+. Use Node.js 22 or newer for the built-in tests and clipboard probe.

The extension requests context menus, downloads, clipboard writes, notifications, offscreen documents, and HTTP/HTTPS/file host access. It needs arbitrary HTTP/HTTPS host access to fetch the image selected from any site in the extension context. To convert local file images, enable **Allow access to file URLs** for the extension in `chrome://extensions`. Site fetch rules may still block some images, and page-owned `blob:` URLs cannot be fetched from the extension.

Supported inputs depend on Chromium's image decoder. Conversion preserves intrinsic pixel dimensions; the browser's native canvas image path uses the animation default image or first frame when the format has no default image. SVGs without intrinsic size cannot be converted.

## Project setup

[AGENTS.md](AGENTS.md) contains shared instructions; CLAUDE.md imports it. [AI_WORKFLOW.md](AI_WORKFLOW.md) provides the template's optional workflow guide.

Validate setup with Python 3:

```bash
python3 scripts/check-agent-setup.py
```

Run the isolated headless compatibility probe with Node 22+ and Brave:

```bash
node scripts/check-clipboard.mjs /usr/bin/brave
```

Run filename tests with:

```bash
node --test
```

The clipboard probe checks offscreen focus rejection, native JPEG rejection, and focused-page PNG/fallback paste. It uses a temporary profile and headless clipboard. Production extension flows, headed browser behavior, desktop image-editor paste, and minimum Chromium version still need manual verification; see [PLAN.md](PLAN.md).
