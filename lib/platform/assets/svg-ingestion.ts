import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { imageDimensions } from "./source";

// Static SVG only. XML parsing is strict; DOMPurify supplies the security boundary.
// No script execution or resource loading is enabled in either DOM.
export function prepareSvg(input: Buffer) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  const parsed = new JSDOM(text, { contentType: "image/svg+xml" });
  const window = new JSDOM("").window;
  try {
    const root = parsed.window.document.documentElement;
    if (parsed.window.document.doctype || root.localName !== "svg" || root.namespaceURI !== "http://www.w3.org/2000/svg") throw new Error("Invalid SVG document.");
    const purify = createDOMPurify(window);
    purify.addHook("uponSanitizeAttribute", (_node, data) => {
      // Remove URI-bearing attributes; permit only local paint-server references.
      if (["href", "xlink:href", "src", "xml:base"].includes(data.attrName)) data.keepAttr = false;
      if (["fill", "stroke", "filter", "clip-path", "mask", "marker-start", "marker-mid", "marker-end", "cursor"].includes(data.attrName)
        && !/^(?:none|currentColor|transparent|[a-zA-Z]+|#[a-fA-F0-9]{3,8}|[0-9.,%()\s+-]+|url\(#[a-zA-Z_][\w.-]*\))$/.test(data.attrValue)) data.keepAttr = false;
    });
    const clean = purify.sanitize(root.outerHTML, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["style", "script", "foreignObject", "image", "use", "a", "animate", "animateMotion", "animateTransform", "set", "discard", "feImage"],
      FORBID_ATTR: ["style"], ALLOW_DATA_ATTR: false,
    });
    const checked = new JSDOM(clean, { contentType: "image/svg+xml" });
    try {
      const svg = checked.window.document.documentElement;
      if (svg.localName !== "svg" || svg.namespaceURI !== "http://www.w3.org/2000/svg") throw new Error("SVG could not be sanitized.");
      const numeric = (value: string | null) => value && /^\d+(?:\.\d+)?(?:px)?$/.test(value) ? Number.parseFloat(value) : 0;
      const view = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
      const width = Math.ceil(numeric(svg.getAttribute("width")) || (view.length === 4 ? view[2] : 0));
      const height = Math.ceil(numeric(svg.getAttribute("height")) || (view.length === 4 ? view[3] : 0));
      // Dimensions are optional for canonical SVG Assets; presentation needs both.
      return { bytes: Buffer.from(clean), type: "image" as const, mimeType: "image/svg+xml",
        width: imageDimensions(width, height) ? width : null, height: imageDimensions(width, height) ? height : null };
    } finally { checked.window.close(); }
  } finally { parsed.window.close(); window.close(); }
}
