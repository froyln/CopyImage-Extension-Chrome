// Output filename for a converted image: last path segment of the source URL with its
// extension replaced. Falls back to "image" for data:/blob: URLs or unusable names.
function outputName(src, ext) {
  let stem = "";
  try {
    const u = new URL(src);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "file:") {
      stem = decodeURIComponent(u.pathname.split("/").pop())
        .replace(/\.[^.]*$/, "")
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
        .replace(/^[.\s]+|[.\s]+$/g, "")
        .slice(0, 100);
    }
  } catch {}
  return `${stem || "image"}.${ext}`;
}
