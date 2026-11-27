# Design rules: proposal for discussion (Nov 27, 2026)

Status: **proposal, nothing changed yet.** This lists every limit on how Core can design a site
today, where it came from, and what Claude proposes: keep, change or remove. The end result is one
short, plain-language rule list (Part C) that a person can review, and that Core and the checks
both follow. It's service Knowledge, not code: the code cites a rule's number and adds no rules of
its own.

## A. Limits in how pages are built (the page builder)

Where they came from: built by Codex between Nov 16 and 19 to get drafts into WordPress quickly.
None trace to a Part 1 requirement.

| # | Limit today | Effect | Proposal |
|---|---|---|---|
| A1 | Every page is a fixed stack: one opening section, body sections, a closing section | Every page has the same rhythm | **Change.** Keep the roles (one opening, one page title) but let Core order, group and lay out sections freely |
| A2 | Each section gets at most one picture, placed beside the text or where Core points | Can't do a full-width picture, a picture behind text, a gallery, or a section with no frame | **Remove.** Core decides how many pictures, and where |
| A3 | Sections sit inside a fixed-width page column | Can't do edge-to-edge bands, colour fields or full-width pictures | **Remove.** Core chooses width per section |
| A4 | Core builds with only 9 kinds of element (group, heading, paragraph, list, image, button, divider, expandable, placeholder) | Missing pull quotes, figures with captions, statistics, tables, logo rows, comparison layouts | **Change.** Add the missing kinds that ordinary business sites use |
| A5 | Phones always show blocks in the desktop order | Can't put the picture after the text on phones, for example | **Remove** |
| A6 | Spacing, surfaces and sizes come from short fixed lists (3 sizes, 7 surfaces, 4 widths) | Pushes every site toward the same look | **Change.** Core may use the lists or its own values in its stylesheet |
| A7 | The menu is a plain list of links inside the page, with no phone version; WordPress's own phone menu is switched off | On phones, a sideways-scrolling strip that hides most links | **Change.** The theme supplies a working phone menu that switches on when the text menu would wrap to two lines; Core designs how it looks |
| A8 | The header and footer are fixed by the theme | Core can restyle them but not decide what's in them | **Change.** Core decides their content within the site's facts (contact details, legal links) |

## B. Limits in the check on Core's stylesheet

Where they came from: Claude wrote this check on Nov 26 when Core first got its own stylesheet.
It was built as a list of everything allowed, which made it too narrow.

| # | Rule today | Proposal |
|---|---|---|
| B1 | Nothing loads or runs from outside (no imports, no outside addresses, no scripts) | **Keep** (security). Allow the site's own uploaded pictures as backgrounds |
| B2 | Styles touch only the site's own pages, never WordPress admin | **Keep** (security), applied automatically, so Core never has to think about it |
| B3 | Only listed properties, functions, page elements, class names and states | **Remove.** Replace the allow-lists with B1, B2 and the render checks in C |
| B4 | Nothing may be hidden (no `display: none`, no `visibility`) | **Remove.** It blocks phone menus, tabs and show-more. Replaced by C5: every approved word can be reached on every screen size |
| B5 | Nothing may be pinned in place (no fixed headers or buttons) | **Remove.** Replaced by C6: pinned elements must not cover the content on a phone |
| B6 | Very faint elements (below 35% opacity) refused | **Remove.** Covered by the readability check, C4 |
| B7 | No text added by styling (only short symbols) | **Keep** (C2: words on the site are Core's approved words) |
| B8 | Fonts from the licensed set only | **Keep** (licensing). The set can grow |
| B9 | Placeholder and FPO frames can't be hidden, shrunk, faded or clipped | **Keep, simplified** (C7) |
| B10 | Stylesheet at most 40,000 characters | **Keep** as a generous size limit (cost and page speed) |

## C. Proposed design rules (the list a person reviews)

Each rule has a reason. Checks run on the **rendered page**, desktop and phone, so they judge what a
visitor sees instead of guessing from the code.

1. **Safe.** The site loads nothing from outside and runs nothing Core wrote; styling never reaches
   WordPress admin. *(Security.)*
2. **Faithful.** Every word on the page is Core's approved copy, unchanged; styling adds no text.
   *(Part 1: Core writes, the Specialist approves.)*
3. **Structured.** One page title per page, headings in order, every picture described for screen
   readers. *(Accessibility and search; legal exposure.)*
4. **Readable.** Text meets standard contrast (WCAG AA) against its background, and body text is
   at a readable size on phones. *(Visitors, accessibility.)*
5. **Reachable.** Every approved word and link can be reached on desktop and phone; the menu works
   by touch and keyboard. *(Visitors, accessibility.)*
6. **Fits the phone.** No sideways scrolling of the page; nothing pinned covers more than a small
   part of a phone screen; buttons and links are big enough to tap. *(Visitors.)*
7. **Honest about gaps.** FPO frames and missing-material notices stay clearly visible and
   recognisable. *(Part 1 #12.)*
8. **Licensed.** Fonts and pictures come from licensed sources, with credits recorded. *(Legal.)*
9. **Respectful of motion.** Animation stops for visitors who ask their device for reduced
   motion. *(Accessibility.)*

What's **not** a rule: colour choices, corner shapes, layout, section order, density, number of
pictures, typefaces within the licensed set. Those are Core's design decisions, informed by its
research and the Client's taste, and reviewable by the Specialist and the Client like any other
design choice.

## D. Cost and time

- Building this is local engineering: no paid calls. Roughly a day of Claude's work, in order:
  the stylesheet check (B), the menu (A7), then the page builder (A1–A6, A8).
- Then one paid redesign of C0 by Core to show the result. Claude estimates a few dollars, within
  what's left of the $15, and will ask before running it.
