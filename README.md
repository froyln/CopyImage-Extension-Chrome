# Convert Image for Chromium

Chromium port of the Firefox Convert Image extension: right-click an image to save as PNG or JPG, or copy as PNG.

## Features

Three image actions are available: **Save image as PNG**, **Save image as JPG**, and **Copy image as PNG**. Saved JPGs are actual JPEG files, with a white background and quality 0.92. JPG copying is omitted because Chromium does not support native JPEG clipboard writes.

Reference extension: Convert Image for Firefox. The port targets Chromium 116+ using Manifest V3, a service worker, and an offscreen document for conversion.

Copy writes PNG directly from your current page after offscreen conversion, without opening a tab or navigating. Keep that page focused until copying finishes. PNG copy preserves transparency. The source icon artwork is from the Firefox project and identifies VTracer 0.6.4 as its generator.

## Install for development

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project's `src/` folder.

The extension targets Chromium 116+. Use Node.js 22 or newer for the built-in tests and clipboard probe.

The extension requests context menus, downloads, clipboard writes, scripting, notifications, offscreen documents, and HTTP/HTTPS/file host access. It needs arbitrary HTTP/HTTPS host access to fetch the image selected from any site in the extension context. Scripting is used only when copying, to write clipboard pixels from the current page in the extension's isolated script context. Copy requires a secure page such as HTTPS or localhost; ordinary HTTP pages and browser-protected pages cannot use this copy flow. Saving remains available on HTTP pages. To convert local file images, enable **Allow access to file URLs** for the extension in `chrome://extensions`. Site fetch rules may still block some images, and page-owned `blob:` URLs cannot be fetched from the extension. Source fetches time out after 30 seconds.

Supported inputs depend on Chromium's image decoder. Conversion preserves intrinsic pixel dimensions; the browser's native canvas image path uses the animation default image or first frame when the format has no default image. SVGs without intrinsic size cannot be converted.

## Development

See [docs/development.md](docs/development.md) for the source layout, conversion behavior, verification status, and packaging instructions.

Run the isolated headless compatibility probe with Node 22+ and Brave:

```bash
node scripts/check-clipboard.mjs /usr/bin/brave
```

Run filename and source-fetch timeout tests with:

```bash
node --test
```

The clipboard probe checks offscreen focus rejection, native JPEG rejection, and production current-tab PNG copy and paste, including unchanged tab count and page URL. It uses a temporary profile and headless clipboard. Production context-menu interaction, saves, headed browser behavior, desktop image-editor paste, and minimum Chromium version still need manual verification; see [docs/development.md](docs/development.md).
