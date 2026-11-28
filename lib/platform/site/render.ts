import { components, type ContentItem, type Section, type SitePage } from "./components";

/**
 * A page as ordinary WordPress core blocks (docs/rendering-design.md). Each section is a group with
 * its component, variant and band as classes; the theme's one stylesheet gives them their look from
 * the site's design. Each content item's id is in its block's metadata name (mp:<id>), so a hand edit
 * in WordPress comes back to the right item.
 */
export type RenderContext = {
  /** Where an action's target page is, on the WordPress site. */
  link: (path: string) => string;
  /** The chosen picture for a picture item, if any; otherwise it shows as a marked FPO frame. */
  picture: (id: string) => { url: string; width: number; height: number } | null;
  /** The variant the site's design sets for a component when a section doesn't choose one. */
  defaultVariant: (component: Section["component"]) => string;
};

const esc = (text: string) => text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
const attrs = (value: Record<string, unknown>) => Object.keys(value).length ? " " + JSON.stringify(value).replace(/--/gu, "\\u002d\\u002d") : "";
const named = (id: string) => ({ metadata: { name: "mp:" + id } });
const paragraphsOf = (text: string) => text.split(/\n\s*\n/u).map(part => part.trim()).filter(Boolean);

function paragraph(text: string, id: string, className?: string) {
  const a = { ...named(id), ...(className && { className }) };
  return `<!-- wp:paragraph${attrs(a)} -->\n<p${className ? ` class="${className}"` : ""}>${esc(text).replace(/\n/gu, "<br>")}</p>\n<!-- /wp:paragraph -->`;
}
function heading(text: string, level: number, id: string) {
  return `<!-- wp:heading${attrs({ ...named(id), level })} -->\n<h${level} class="wp-block-heading">${esc(text)}</h${level}>\n<!-- /wp:heading -->`;
}
function group(className: string, inner: string, extra: Record<string, unknown> = {}) {
  return `<!-- wp:group${attrs({ className, ...extra })} -->\n<div class="wp-block-group ${className}">${inner ? "\n" + inner + "\n" : ""}</div>\n<!-- /wp:group -->`;
}

function item(content: ContentItem, level: number, ctx: RenderContext): string {
  switch (content.type) {
    case "heading": return heading(content.text, level, content.id);
    case "text": return paragraphsOf(content.text).map(part => paragraph(part, content.id)).join("\n");
    case "item": return group("mp-item", [content.title ? heading(content.title, level + 1, content.id) : "", ...paragraphsOf(content.text).map(part => paragraph(part, content.id))].filter(Boolean).join("\n"), named(content.id));
    case "question": return `<!-- wp:details${attrs({ ...named(content.id), summary: content.question, className: "mp-question" })} -->\n<details class="wp-block-details mp-question"><summary>${esc(content.question)}</summary>` +
      `\n${paragraphsOf(content.answer).map(part => paragraph(part, content.id)).join("\n")}\n</details>\n<!-- /wp:details -->`;
    case "picture": {
      const found = ctx.picture(content.id);
      if (found) return `<!-- wp:image${attrs({ ...named(content.id), sizeSlug: "large", className: "mp-picture" })} -->\n<figure class="wp-block-image size-large mp-picture"><img src="${esc(found.url)}" alt="${esc(content.alt)}" width="${found.width}" height="${found.height}"/></figure>\n<!-- /wp:image -->`;
      return group("mp-fpo", [paragraph("Image for position only", content.id, "mp-fpo-label"), paragraph(content.shows, content.id, "mp-fpo-brief")].join("\n"), named(content.id));
    }
    case "action": return `<!-- wp:button${attrs(named(content.id))} -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${esc(ctx.link(content.page))}">${esc(content.label)}</a></div>\n<!-- /wp:button -->`;
    case "placeholder": return group("mp-placeholder", [paragraph("Content needed", content.id, "mp-placeholder-label"), paragraph(content.need, content.id, "mp-placeholder-need"), ...paragraphsOf(content.text).map(part => paragraph(part, content.id, "mp-placeholder-text"))].join("\n"), named(content.id));
  }
}

export function renderSection(section: Section, page: SitePage, first: boolean, ctx: RenderContext) {
  const byId = new Map(page.content.map(content => [content.id, content]));
  const filled = (name: string, level: number) => (section.slots[name] ?? []).map(id => byId.get(id)).filter(Boolean).map(content => item(content!, level, ctx)).join("\n");
  const level = first ? 1 : 2;
  const actions = (section.slots.actions ?? []).length ? `<!-- wp:buttons -->\n<div class="wp-block-buttons">\n${filled("actions", level)}\n</div>\n<!-- /wp:buttons -->` : "";
  const variant = section.variant ?? ctx.defaultVariant(section.component);
  const words = [filled("heading", level), filled("text", level)].filter(Boolean).join("\n");
  const set = (name: string) => (section.slots[name] ?? []).length ? group(`mp-set mp-set-${name}`, filled(name, level + 1)) : "";
  const picture = filled("picture", level + 1);
  let inner: string;
  switch (section.component) {
    case "opening": case "text-picture":
      inner = picture ? group("mp-split", [group("mp-words", [words, actions].filter(Boolean).join("\n")), group("mp-visual", picture)].join("\n"))
        : [words, actions].filter(Boolean).join("\n");
      break;
    default: inner = [words, ...Object.keys(components[section.component].slots).filter(name => !["heading", "text", "actions", "picture"].includes(name)).map(set), actions].filter(Boolean).join("\n");
  }
  const className = `mp-section mp-c-${section.component} mp-v-${variant} mp-band-${section.band}`;
  return `<!-- wp:group${attrs({ align: "full", className, anchor: section.id, layout: { type: "constrained" } })} -->\n` +
    `<div id="${esc(section.id)}" class="wp-block-group alignfull ${className}">\n${inner}\n</div>\n<!-- /wp:group -->`;
}

export function renderPage(page: SitePage, ctx: RenderContext) {
  return page.layout.map((section, index) => renderSection(section, page, index === 0, ctx)).join("\n\n");
}
