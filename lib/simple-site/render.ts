import type { Page, Section } from "./site";

/**
 * Each section as ordinary WordPress blocks (group, heading, paragraph, buttons), so the page can be
 * edited in WordPress's own editor. The theme's stylesheet gives each layout kind and tone its look.
 */
const esc = (text: string) => text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
const paragraphs = (text: string) => text.split(/\n\s*\n/u).map(part => part.trim()).filter(Boolean)
  .map(part => `<!-- wp:paragraph -->\n<p>${esc(part).replace(/\n/gu, "<br>")}</p>\n<!-- /wp:paragraph -->`).join("\n");
const heading = (text: string, level: number) =>
  `<!-- wp:heading {"level":${level}} -->\n<h${level} class="wp-block-heading">${esc(text)}</h${level}>\n<!-- /wp:heading -->`;
const group = (className: string, inner: string) =>
  `<!-- wp:group {"className":"${className}","layout":{"type":"default"}} -->\n<div class="wp-block-group ${className}">\n${inner}\n</div>\n<!-- /wp:group -->`;

function button(section: Section, link: (path: string) => string) {
  const b = section.words.button;
  if (!b) return "";
  return `<!-- wp:buttons -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${esc(link(b.page))}">${esc(b.label)}</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`;
}

export function renderSection(section: Section, first: boolean, link: (path: string) => string) {
  const { kind, tone } = section.layout, w = section.words;
  const parts = [heading(w.heading, first ? 1 : 2), paragraphs(w.text)];
  if (w.items.length) parts.push(group("mp-items", w.items.map(item => group("mp-item", [item.title ? heading(item.title, 3) : "", paragraphs(item.text)].join("\n"))).join("\n")));
  parts.push(button(section, link));
  return `<!-- wp:group {"align":"full","className":"mp-section mp-${kind} mp-tone-${tone}","layout":{"type":"constrained"}} -->\n` +
    `<div class="wp-block-group alignfull mp-section mp-${kind} mp-tone-${tone}" id="${section.id}">\n${parts.filter(Boolean).join("\n")}\n</div>\n<!-- /wp:group -->`;
}

export function renderPage(page: Page, link: (path: string) => string) {
  return page.sections.map((section, index) => renderSection(section, index === 0, link)).join("\n\n");
}
