/**
 * The site's own stylesheet, written by Core's AI as part of the Presence Direction (Part 1 #13,
 * #15, #16c). Core designs each site's actual look; the WordPress theme only renders it.
 *
 * This check enforces only the design rules a stylesheet can break by itself
 * (design-rules.ts): 1 Safe (nothing loads or runs; every rule is scoped to the site's own pages),
 * 2 Faithful (styling adds no text), 7 Honest about gaps (FPO frames and missing-material notices
 * are not hidden, shrunk, faded or clipped) and 8 Licensed (fonts). Everything else is allowed;
 * rules 3 to 6 and 9 are checked on the rendered page, where a visitor sees the result. The sheet
 * is rebuilt from what passes, so only checked CSS reaches WordPress.
 */
import { designRulesText } from "./design-rules";
import { siteFonts } from "./site-fonts";

/** What Core is told about the stylesheet: the page's hooks and the rules. */
export const stylesheetContract = [
  "Write the site's stylesheet: plain CSS that gives this site its own look, as a skilled designer would for this business today, informed by your research and the sites the Client admires. You design everything: layout, widths (sections may run edge to edge), header, menu, footer, sections, cards, buttons, typography, colour, corners, imagery treatment, spacing and motion. Every rule is scoped to the site's pages for you; write selectors from the hooks below and any plain elements.",
  "Page frame: header.wp-block-template-part (the site header: logo .miopages-draft-wordmark img, and the menu); footer.wp-block-template-part (the site footer: the logo, then the footer you wrote in the Site plan, .miopages-site-footer with .miopages-footer-columns, .miopages-footer-column, .miopages-footer-heading, .miopages-footer-text, .miopages-footer-links and .miopages-footer-note); main; .wp-block-post-content (the page column; .alignfull children may span the full width).",
  "Menu: nav.miopages-draft-nav holds the page links (a; the current page has [aria-current=\"page\"]). The theme switches it to a phone menu by itself when the links would not fit on one line: the header then gets .miopages-menu-compact, button.miopages-menu-toggle (with [aria-expanded]) opens it, and the open menu has .miopages-menu-open on the header. Style both states. .miopages-draft-related is the footer link row.",
  "Sections, in page order: section.miopages-draft-section, with .miopages-draft-hero (the opening), .miopages-draft-intro (body sections) or .miopages-draft-cta (closing call to action); .miopages-authored-section when you composed it; .miopages-draft-with-image when it holds an image; .miopages-draft-copy is its text column; .miopages-native-component is your composed block, with .miopages-component-<name> using the name you gave it.",
  "Inside composed blocks: .miopages-node is every element; .miopages-node-columns lays its children out in the column proportions you chose, given as var(--mp-columns) (you may override it); .miopages-node-row is a row of items; .miopages-node-surface-*, .miopages-node-type-*, .miopages-node-border, .miopages-node-rounded and .miopages-semantic-group/-grid are the choices you made when composing.",
  "Actions: .wp-block-buttons, .wp-block-button, a.wp-block-button__link (buttons); .miopages-pending-action (an action not yet connected).",
  "Images: figure.wp-block-image and img; figure.miopages-fpo is a marked FPO frame (.miopages-fpo-badge, .miopages-fpo-label, .miopages-fpo-brief); aside.miopages-placeholder is a marked notice of missing material (.miopages-placeholder-badge, .miopages-placeholder-label, .miopages-placeholder-text).",
  "Colours: the theme turns your palette into variables, in background-and-text pairs. Always set a background's own text colour with it (and let headings, lists, links and quotes inside inherit it). Your palette's light pair is var(--wp--preset--color--surface) with var(--wp--preset--color--ink); brand is var(--wp--preset--color--brand) with var(--wp--preset--color--on-brand); tonal is var(--wp--preset--color--support) with var(--miopages-tonal-ink); strong is var(--miopages-accent-surface) with var(--miopages-accent-ink); supporting is var(--miopages-supporting-surface) with var(--miopages-supporting-ink); contrast is var(--miopages-contrast-surface) with var(--miopages-contrast-ink). Also var(--miopages-border) and var(--miopages-muted) (muted text on the light surface). You may write colours directly, keeping text readable. A rule that sets both a background and a text colour that do not read together is refused. Fonts: var(--miopages-heading-font), var(--miopages-body-font), or only the licensed fonts offered to you.",
  "Technical limits (security): no url(), @import or @font-face; no \"<\" anywhere (use min-width/max-width in media queries); content: only empty, a short symbol or a counter. Anything else in CSS is available, including display: none for menus and disclosures, position: sticky or fixed, @media, @supports, @container and @keyframes.",
  designRulesText,
].join("\n");

const maximumLength = 40_000;
const scope = "body.miopages-designed:not(#mp-core-design)";

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

// Rule 1 (Safe): scope every selector to the site's own pages; WordPress's admin bar is not the site's.
function selector(raw: string): string {
  const value = raw.trim().replace(/\s+/gu, " ");
  if (!value) refuse("empty selector");
  if (!/^[a-zA-Z0-9\s.#:[\]="'()_*>+~^$|,%-]+$/u.test(value) || /wpadminbar|wp-admin/iu.test(value)
    || (value.match(/"/gu)?.length ?? 0) % 2 || (value.match(/'/gu)?.length ?? 0) % 2) refuse(`selector "${value}"`);
  if (value.startsWith(scope)) return value;
  const root = /^(html\s*>?\s*body|html|:root|body)(?=$|[\s>+~.:[#])/u.exec(value);
  return root ? scope + value.slice(root[0].length) : scope + " " + value;
}

/** The marked FPO frames and missing-material notices stay visible where they are (rule 7). */
const protectedParts = /(fpo|placeholder)/u;
const sizeOnProtected = /^(max-)?(width|height|inline-size|block-size)$|^font-size$/u;
let fontNameSet: Set<string> | undefined;
const fontNames = () => fontNameSet ??= new Set([...Object.values(siteFonts).map(font => "mp " + font.label.toLowerCase()),
  "system-ui", "-apple-system", "sans-serif", "serif", "monospace", "ui-monospace", "ui-sans-serif", "ui-serif", "segoe ui", "georgia", "inherit", "initial"]);

function declarations(body: string, protectedRule: boolean): string {
  const out: string[] = [];
  for (const raw of body.split(";")) {
    if (!raw.trim()) continue;
    const colon = raw.indexOf(":");
    if (colon < 1) refuse(`declaration "${raw.trim().slice(0, 60)}"`);
    const name = raw.slice(0, colon).trim().toLowerCase();
    let value = raw.slice(colon + 1).trim();
    const important = /!\s*important$/iu.test(value);
    value = value.replace(/!\s*important$/iu, "").trim();
    if (!/^(-?[a-z][a-z0-9-]*|--[a-z0-9-]+)$/u.test(name)) refuse(`property "${name}"`);
    if (!value || value.length > 2000) refuse(`value of ${name}`);
    const lower = value.toLowerCase();
    // Rule 2 (Faithful): styling adds no words; a symbol, a counter or quote marks are decoration.
    if (name === "content" && !/^(none|normal|""|''|"[^a-z0-9"]{1,3}"|'[^a-z0-9']{1,3}'|(no-)?(open|close)-quote|counters?\([a-z0-9, "'.-]+\))$/iu.test(value))
      refuse("generated text");
    if (name === "quotes" && /[a-z0-9]/iu.test(value.replace(/^(none|auto)$/iu, ""))) refuse("generated text");
    // Rule 8 (Licensed): only the licensed fonts, or system fallbacks.
    if (name === "font-family") for (const family of lower.split(",").map(part => part.trim().replace(/^["']|["']$/gu, "")))
      if (!fontNames().has(family) && !/^var\(--(miopages|mp)-[a-z-]+\)$/u.test(family)) refuse(`font "${family}"`);
    // Rule 7 (Honest about gaps): the marks may be restyled and sized up, never hidden, shrunk, faded or clipped.
    if (protectedRule) {
      const hidden = (name === "display" && /\bnone\b/u.test(lower)) || (name === "visibility" && /hidden|collapse/u.test(lower))
        || (name === "content-visibility" && /hidden/u.test(lower)) || name === "clip-path" || name === "clip"
        || (name === "opacity" && Number.parseFloat(lower) < 0.85)
        || (sizeOnProtected.test(name) && /^(0|[0-9.]+px)$/u.test(lower) && Number.parseFloat(lower) < 12)
        || (/^(transform|scale)$/u.test(name) && (/scale[xyz3d]*\(\s*0*\.?[0-4]?\d*\s*[,)]/u.test(lower) && !/scale[xyz3d]*\(\s*(0?\.[5-9]|[1-9])/u.test(lower) || /^0*\.?[0-4]\d*$/u.test(lower)));
      if (hidden) refuse(`${name} hides an FPO frame or missing-material notice`);
    }
    out.push(`${name}:${value}${important ? " !important" : ""}`);
  }
  return out.join(";");
}

function rules(css: string, depth: number): string {
  let out = "", at = 0;
  while (at < css.length) {
    const open = css.indexOf("{", at);
    if (open < 0) { if (css.slice(at).trim()) refuse("text outside a rule"); break; }
    const prelude = css.slice(at, open).trim().replace(/\s+/gu, " ");
    const { body, end } = block(css, open);
    at = end;
    if (prelude.startsWith("@")) {
      if (depth > 3) refuse("at-rules nested too deep");
      const group = /^@(media|supports|container|layer)\b([a-zA-Z0-9\s():.,%>=/-]*)$/u.exec(prelude);
      const frames = /^@keyframes ([a-z][a-z0-9-]*)$/iu.exec(prelude);
      if (group) out += `@${group[1]}${group[2]!.trimEnd()}{${rules(body, depth + 1)}}`;
      else if (frames) {
        let inner = "", i = 0;
        while (i < body.length) {
          const o = body.indexOf("{", i);
          if (o < 0) { if (body.slice(i).trim()) refuse("keyframes"); break; }
          const step = body.slice(i, o).trim();
          if (!/^(from|to|\d{1,3}(\.\d+)?%)(\s*,\s*(from|to|\d{1,3}(\.\d+)?%))*$/u.test(step)) refuse(`keyframe "${step}"`);
          const { body: decl, end: e } = block(body, o);
          inner += `${step}{${declarations(decl, false)}}`;
          i = e;
        }
        out += `@keyframes ${frames[1]}{${inner}}`;
      } else refuse(`at-rule "${prelude.slice(0, 40)}"`);
      continue;
    }
    const selectors = prelude.split(/,(?![^(]*\))/u).map(selector);
    out += `${selectors.join(",")}{${declarations(body, protectedParts.test(prelude))}}`;
  }
  return out;
}

/** Check Core's stylesheet and rebuild it from what passes; anything unsafe refuses the whole sheet. */
export function readSiteStylesheet(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) refuse("empty");
  if (value.length > maximumLength) refuse("too long");
  const css = value.replace(/\/\*[\s\S]*?\*\//gu, "");
  // Rule 1 (Safe): nothing loads, runs or reads from elsewhere.
  if (/[<\\]|url\s*\(|@import|@font-face|@charset|@namespace|expression\s*\(|javascript:|(?<![a-z-])behavior\s*:|-moz-binding|image-set|(?<![a-z-])element\s*\(|(?<![a-z-])attr\s*\(|(?<![a-z-])src\s*\(/iu.test(css))
    refuse("it loads, runs or reads something");
  const out = rules(css, 0);
  if (!out) refuse("no rules");
  return out;
}
