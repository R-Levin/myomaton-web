/**
 * The site's own stylesheet, written by Core's AI as part of the Presence Direction (Part 1 #13,
 * #15, #16c; the Principal, Nov 22: the fonts, colours and layouts "were never meant to be
 * permanent rules"). Core designs each site's actual look: header, menu, sections, cards,
 * buttons, headings, lists and image treatment. The WordPress theme only renders it.
 *
 * Only safety limits apply, each for a real need: nothing loads from elsewhere or runs (security);
 * every rule is scoped to the site's own pages (no reach into WordPress admin); content cannot be
 * hidden, and the FPO frames and placeholder notices stay visible (Part 1 #12); no position:fixed
 * overlays. The stylesheet is rebuilt from what passes, so only checked CSS reaches WordPress.
 */
import { siteFonts } from "./site-fonts";

/** The parts of a page Core can style, as the renderer marks them. Told to the AI as the contract. */
export const stylesheetContract = [
  "Write the site's stylesheet: plain CSS that gives this site its own look. Every rule is scoped to the site's pages for you; write selectors from the hooks below (and plain elements such as h1, h2, h3, p, a, ul, li, img, figure, nav, header, footer, section).",
  "Page frame: header.wp-block-template-part (the site header holding the logo, .miopages-draft-wordmark img); footer.wp-block-template-part; main; .wp-block-post-content (the page column).",
  "Menu: nav.miopages-draft-nav holds the page links (a; the current page has [aria-current=\"page\"]); .miopages-draft-related is the footer link row. On phones the menu must stay usable: style it as a compact row, a scrolling strip or similar, not a wall of buttons.",
  "Sections, in page order: section.miopages-draft-section, with .miopages-draft-hero (the opening), .miopages-draft-intro (body sections) or .miopages-draft-cta (closing call to action); .miopages-authored-section when you composed it; .miopages-draft-with-image when it holds an image; .miopages-draft-copy is its text column; .miopages-native-component is your composed block, with .miopages-component-<name> using the name you gave it.",
  "Inside composed blocks: .miopages-node is every element; .miopages-node-columns and .miopages-node-row are your layouts; .miopages-node-surface-light|brand|tonal|strong|supporting|contrast are your surfaces; .miopages-node-type-display|lead|body|small are your type levels; .miopages-node-border and .miopages-node-rounded are your framed elements (cards); .miopages-semantic-group and .miopages-semantic-grid are grouped items.",
  "Actions: .wp-block-buttons, .wp-block-button, a.wp-block-button__link (buttons); .miopages-pending-action (an action not yet connected).",
  "Images: figure.wp-block-image and img; figure.miopages-fpo is a marked FPO frame (.miopages-fpo-badge, .miopages-fpo-label, .miopages-fpo-brief); aside.miopages-placeholder is a marked notice of missing material (.miopages-placeholder-badge, .miopages-placeholder-label, .miopages-placeholder-text). Style them to fit the design, but they must stay clearly visible and recognisable: you cannot hide, shrink, move or clip them.",
  "Use the design's colours and fonts through var(--wp--preset--color--surface), var(--wp--preset--color--ink), var(--wp--preset--color--brand), var(--wp--preset--color--on-brand), var(--wp--preset--color--support), var(--miopages-tonal-ink), var(--miopages-accent-surface), var(--miopages-accent-ink), var(--miopages-supporting-surface), var(--miopages-supporting-ink), var(--miopages-contrast-surface), var(--miopages-contrast-ink), var(--miopages-border), var(--miopages-muted), var(--miopages-heading-font), var(--miopages-body-font); you may also write colours directly, keeping text readable.",
  "Allowed: layout (grid, flex, spacing, sizes), typography, colour, gradients, borders, shadows, radii, transforms, transitions and animations (respect prefers-reduced-motion), @media width queries, @keyframes, and custom properties named --mp-*. Not allowed: url(), @import, @font-face, position: fixed, display: none, visibility: hidden, generated text (content may only be empty or a short symbol). Base styling exists only as a plain fallback: restyle every part so the site is wholly yours. Design mobile and desktop.",
].join("\n");

const maximumLength = 40_000;
const scope = "body.miopages-designed:not(#mp-core-design)";

const elements = new Set(["a", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "img", "figure", "figcaption", "header", "footer", "main",
  "nav", "section", "div", "span", "aside", "strong", "em", "small", "blockquote", "hr", "details", "summary", "button", "svg", "table", "tr", "td", "th"]);
const classPrefixes = /^(miopages-|wp-block-|wp-element-|has-|is-layout-|wp-container-|align(wide|full)$|mp-)/u;
const pseudoClasses = new Set(["hover", "focus", "focus-visible", "focus-within", "active", "visited", "first-child", "last-child", "only-child",
  "first-of-type", "last-of-type", "empty", "nth-child", "nth-of-type", "nth-last-child", "not", "is", "where", "has"]);
const pseudoElements = new Set(["before", "after", "marker", "first-line", "first-letter", "placeholder", "selection"]);

const properties = new RegExp("^(" + [
  "color", "background(-color|-image|-position|-size|-repeat|-blend-mode|-clip|-origin|-attachment)?", "border(-[a-z-]+)?", "outline(-[a-z]+)?",
  "box-shadow", "text-shadow", "box-sizing", "font(-size|-weight|-style|-family|-variant|-feature-settings|-optical-sizing|-stretch)?", "letter-spacing",
  "line-height", "text-(align|decoration|decoration-[a-z]+|transform|indent|underline-offset|underline-position|wrap|overflow|rendering)",
  "word-spacing", "word-break", "overflow-wrap", "white-space", "hyphens", "vertical-align", "(margin|padding)(-[a-z-]+)?", "gap", "row-gap",
  "column-gap", "display", "grid(-[a-z-]+)?", "flex(-[a-z]+)?", "order", "(align|justify|place)-(items|content|self)", "(min-|max-)?(width|height)",
  "(min-|max-)?(inline|block)-size", "aspect-ratio", "position", "inset(-[a-z-]+)?", "top", "right", "bottom", "left", "z-index",
  "overflow(-x|-y)?", "opacity", "transform(-origin|-style)?", "translate", "rotate", "scale", "transition(-[a-z-]+)?", "animation(-[a-z-]+)?",
  "filter", "backdrop-filter", "clip-path", "object-(fit|position)", "list-style(-[a-z]+)?", "content", "counter-(reset|increment|set)",
  "columns", "column-(count|width|rule|rule-[a-z]+|span|fill)", "isolation", "mix-blend-mode", "cursor", "accent-color", "caret-color",
  "scroll-(margin|padding|behavior|snap-type|snap-align)(-[a-z-]+)?", "float", "clear", "quotes", "--mp-[a-z0-9-]+", "text-wrap-style", "font-kerning",
].join("|") + ")$", "u");
const functions = new Set(["var", "calc", "min", "max", "clamp", "rgb", "rgba", "hsl", "hsla", "color-mix", "linear-gradient", "radial-gradient",
  "conic-gradient", "repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient", "cubic-bezier", "steps", "translate",
  "translatex", "translatey", "translate3d", "rotate", "rotatex", "rotatey", "scale", "scalex", "scaley", "skew", "skewx", "skewy", "perspective",
  "minmax", "repeat", "fit-content", "blur", "brightness", "contrast", "drop-shadow", "grayscale", "saturate", "sepia", "opacity", "hue-rotate",
  "invert", "polygon", "circle", "ellipse", "inset", "counter", "counters", "oklch", "oklab", "lab", "lch", "hwb"]);
/** The marked FPO frames and missing-material notices stay visible where they are (Part 1 #12). */
const protectedParts = /(fpo|placeholder|pending)/u;
const notOnProtected = /^(position|inset.*|top|right|bottom|left|transform.*|translate|rotate|scale|clip-path|(min-|max-)?(width|height)|overflow.*|font-size|opacity|filter|z-index|margin.*|float)$/u;
// Built on first use: site-design imports this module too.
let fontNameSet: Set<string> | undefined;
const fontNames = () => fontNameSet ??= new Set([...Object.values(siteFonts).map(font => "mp " + font.label.toLowerCase()),
  "system-ui", "-apple-system", "sans-serif", "serif", "monospace", "ui-monospace", "segoe ui", "georgia", "inherit", "initial"])

function refuse(why: string): never { throw Error("Site stylesheet refused: " + why); }

/** The body inside the braces opened at `open`, and the index after its closing brace. */
function block(css: string, open: number) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return { body: css.slice(open + 1, i), end: i + 1 };
  }
  return refuse("unbalanced braces");
}

function selector(raw: string): string {
  const value = raw.trim().replace(/\s+/gu, " ");
  if (!value) refuse("empty selector");
  const rest = value.replace(/^(body|:root)(?=$|[\s>+~.:[])/u, "");
  const scoped = rest.length < value.length;
  // Each piece: an element, class, allowed attribute, pseudo-class (with checked argument), pseudo-element, combinator or *.
  const piece = /^(?:\s*[>+~]\s*|\s+|\*|[a-z][a-z0-9]*|\.[a-z0-9_-]+|\[(?:aria-current(?:="page")?|open|aria-expanded(?:="(?:true|false)")?)\]|::?[a-z-]+(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?)/u;
  let text = rest;
  while (text) {
    const match = piece.exec(text);
    if (!match || !match[0]) refuse(`selector "${value}"`);
    const token = match[0].trim();
    if (/^[a-z]/u.test(token) && !elements.has(token)) refuse(`element "${token}"`);
    if (token.startsWith(".") && !classPrefixes.test(token.slice(1))) refuse(`class "${token}"`);
    if (token.startsWith("::")) { if (!pseudoElements.has(token.slice(2))) refuse(`pseudo-element "${token}"`); }
    else if (token.startsWith(":")) {
      const [name, argument] = [token.slice(1).replace(/\([\s\S]*$/u, ""), token.match(/\(([\s\S]*)\)$/u)?.[1]];
      if (!pseudoClasses.has(name)) refuse(`pseudo-class "${token}"`);
      if (argument !== undefined) {
        if (["not", "is", "where", "has"].includes(name)) argument.split(",").forEach(inner => selector(inner.replace(/^\s*[>+~]/u, "")));
        else if (!/^[0-9n+\s-]+$|^(odd|even)$/u.test(argument.trim())) refuse(`argument "${token}"`);
      }
    }
    text = text.slice(match[0].length);
  }
  return scoped ? scope + rest : scope + " " + value;
}

function declarations(body: string, protectedRule: boolean, inKeyframes: boolean): string {
  const out: string[] = [];
  for (const raw of body.split(";")) {
    if (!raw.trim()) continue;
    const colon = raw.indexOf(":");
    if (colon < 1) refuse(`declaration "${raw.trim().slice(0, 60)}"`);
    const name = raw.slice(0, colon).trim().toLowerCase();
    let value = raw.slice(colon + 1).trim();
    const important = /!\s*important$/iu.test(value);
    value = value.replace(/!\s*important$/iu, "").trim();
    if (!properties.test(name)) refuse(`property "${name}"`);
    if (!value || value.length > 600) refuse(`value of ${name}`);
    // A decorative symbol (an arrow, a bullet) is the one place other characters may appear.
    const symbol = name === "content" && /^("[^a-z0-9"\\<>]{1,3}"|'[^a-z0-9'\\<>]{1,3}')$/iu.test(value);
    if (!symbol && !/^[#a-zA-Z0-9\s.,%()\-+*/'":]*$/u.test(value)) refuse(`characters in ${name}`);
    for (const [, fn] of value.toLowerCase().matchAll(/([a-z-]+)\(/gu)) if (!functions.has(fn!)) refuse(`function ${fn}() in ${name}`);
    const lower = value.toLowerCase();
    if (/["']/u.test(value) && name !== "content" && name !== "font-family" && name !== "quotes") refuse(`text in ${name}`);
    if (name === "content" && !/^(none|normal|""|''|"[^a-z0-9"]{1,3}"|'[^a-z0-9']{1,3}'|counters?\([a-z0-9, "'.-]+\))$/iu.test(value)) refuse("generated text");
    if (name === "font-family") for (const family of lower.split(",").map(part => part.trim().replace(/^["']|["']$/gu, "")))
      if (!fontNames().has(family) && !/^var\(--(miopages|mp)-[a-z-]+\)$/u.test(family)) refuse(`font "${family}"`);
    if (name === "display" && /\bnone\b/u.test(lower)) refuse("display: none hides content");
    if (name.startsWith("visibility") || (name === "visibility")) refuse("visibility");
    if (name === "position" && /fixed/u.test(lower)) refuse("position: fixed");
    if (name === "opacity" && !inKeyframes && Number.parseFloat(lower) < 0.35) refuse("near-invisible content");
    if (protectedRule && notOnProtected.test(name)) refuse(`${name} on an FPO frame or placeholder notice`);
    out.push(`${name}:${value}${important ? " !important" : ""}`);
  }
  return out.join(";");
}

function rules(css: string, depth: number, inKeyframes = false): string {
  let out = "", at = 0;
  while (at < css.length) {
    const open = css.indexOf("{", at);
    if (open < 0) { if (css.slice(at).trim()) refuse("text outside a rule"); break; }
    const prelude = css.slice(at, open).trim();
    const { body, end } = block(css, open);
    at = end;
    if (prelude.startsWith("@")) {
      if (depth > 0) refuse("nested at-rule");
      const media = /^@media\s+([a-z0-9\s():.,-]+)$/iu.exec(prelude);
      const frames = /^@keyframes\s+(mp-[a-z0-9-]+)$/iu.exec(prelude);
      if (media) {
        if (!/^(?:\s*(?:and|or|not|only|screen|all|,|\((?:min-width|max-width|prefers-reduced-motion|prefers-color-scheme|hover|pointer|orientation)\s*:\s*[a-z0-9.\s-]+\)))+\s*$/iu.test(media[1]!))
          refuse(`media query "${media[1]}"`);
        out += `@media ${media[1]!.trim()}{${rules(body, depth + 1)}}`;
      } else if (frames) {
        let inner = "", i = 0;
        while (i < body.length) {
          const o = body.indexOf("{", i);
          if (o < 0) { if (body.slice(i).trim()) refuse("keyframes"); break; }
          const step = body.slice(i, o).trim();
          if (!/^(from|to|\d{1,3}%)(\s*,\s*(from|to|\d{1,3}%))*$/u.test(step)) refuse(`keyframe "${step}"`);
          const { body: decl, end: e } = block(body, o);
          inner += `${step}{${declarations(decl, false, true)}}`;
          i = e;
        }
        out += `@keyframes ${frames[1]}{${inner}}`;
      } else refuse(`at-rule "${prelude.slice(0, 40)}"`);
      continue;
    }
    if (inKeyframes) refuse("rule inside keyframes");
    const selectors = prelude.split(/,(?![^(]*\))/u).map(selector);
    out += `${selectors.join(",")}{${declarations(body, protectedParts.test(prelude), false)}}`;
  }
  return out;
}

/** Check Core's stylesheet and rebuild it from what passes; anything unsafe refuses the whole sheet. */
export function readSiteStylesheet(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) refuse("empty");
  if (value.length > maximumLength) refuse("too long");
  const css = value.replace(/\/\*[\s\S]*?\*\//gu, "");
  if (/[<\\]|url\s*\(|@import|@font-face|@charset|@namespace|expression\s*\(|javascript:|behavior\s*:|-moz-binding|image-set|element\s*\(|attr\s*\(/iu.test(css))
    refuse("it loads, runs or reads something");
  const out = rules(css, 0);
  if (!out) refuse("no rules");
  return out;
}
