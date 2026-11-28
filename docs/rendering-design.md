# Rendering design (recovery program, Nov 29)

The technical design for steps 1–6 of `docs/recovery-program-2026-11-29.md`, approved by the
Principal on Nov 29. It's the product, for any Client, at Launch and in Ongoing; C0 is only the test
case. Nothing here adds a rule the program didn't agree to.

## Objects
Each piece builds on an existing object (`docs/service-object-model.md`); no new object is needed.

- **The site design** is part of the Direction Work product. It holds:
  - the existing tokens: palette pairs, fonts, corners, spacing, imagery direction
    (`site-design.ts`);
  - `components`: for each component the site uses, its default variant. Core chooses these.
- **A page** is a Page Work product with two parts:
  - `content`: the page's own items, each with an id: heading, text, item (title and text),
    question (question and answer), picture (what it shows and its alt text; an Asset once chosen,
    an FPO frame until then), action (label and target page), placeholder (what material is needed
    and why);
  - `layout`: an ordered list of sections. Each names its component, an optional variant, its band
    (one of the design's palette pairs) and its slots, which point at content ids.
- **A change** is the existing Change, at any scope: a section, a page, several pages, the whole
  site (Grain). It changes content, layout, design, or a combination. A redesign changes the design,
  and every page re-renders from it. Ongoing uses the same changes.

## Components
Each component is defined once (`lib/platform/site/components.ts`): its slots, its variants, and how
it renders as ordinary WordPress blocks.

| Component | Slots | Variants |
|---|---|---|
| opening | heading, text, picture?, actions | centered, split (picture beside), banner (picture behind) |
| text | heading, text | single, wide |
| text-picture | heading, text, picture, actions? | picture-left, picture-right |
| points | heading?, text?, items | columns, cards, list |
| steps | heading?, items | row, list |
| questions | heading?, questions | open, folded |
| gallery | heading?, pictures | grid, row |
| call | heading, text, actions | band, card |

- **Any slot that holds items** may hold a placeholder.
- **A new component** is added here when a business needs one (Part 1 #15); Core proposes it, a
  person adds it.

## Rendering and delivery
- **Core renders each page** (`lib/platform/site/render.ts`) into WordPress core blocks:
  - blocks used: group, columns, heading, paragraph, list, image, buttons, details;
  - classes: `mp-c-<component>`, `mp-v-<variant>`, `mp-band-<pair>`;
  - each content item's id goes in the block's metadata name (`mp:<id>`) for read-back.
- **The theme** (`wordpress/miopages-managed-site`) has one stylesheet that implements every
  component and variant from the design's token variables. The menu is WordPress's own navigation.
  Removed from the theme: `readable.js`, `menu.js`, `layout-css.php`, and Core's raw stylesheet.
- **The plugin** keeps its transport: signing, staging, media, receipts, read-back. Its page builder
  is replaced by a check of Core's blocks:
  - only the listed core blocks are allowed;
  - WordPress's own `wp_kses_post` cleans the content;
  - nothing runs or loads.
- **Read-back:** a hand edit to a block named `mp:<id>` becomes a change to that content item. An
  edit that can't be matched becomes a Request, as now.

## What Core is asked
- **Direction:** the design, meaning tokens plus component defaults; no stylesheet.
- **Page, first build:** content and layout together, with the Site plan, the design and component
  set, and the pages already written in view.
- **Change:** only the part asked for (content, layout or design) at the scope asked for. Anything
  else stays as it is.
- **Instructions:** visually rich; placeholders for material that's needed; size in the Principal's
  words. Removed: "use all of it," "completely," "every section must…".

## Removed
- The node trees: `presence-native-component.ts`, `presence-semantic-block.ts`.
- `site-stylesheet.ts` and its contract.
- `page-words.ts`: pieces, mending and adopting.
- The rendered-check correction loop (the check stays as information for a Specialist).
- The plugin's section frames (`class-miopages-native-draft-content.php`,
  `class-miopages-native-component.php`).
- The simplified side path (`lib/simple-site`, `scripts/simple-site`, `wordpress/miopages-simple`).

## Order
1. Components and render, with tests.
2. Page format and design format in the engine and the AI writer.
3. Theme stylesheet.
4. Plugin check and read-back.
5. Change scopes.
6. Removals.
7. Free stand-in run to miopages.org, then **Look 1**.
