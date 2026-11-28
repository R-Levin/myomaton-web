# Recovery program: rebuild the rendering tools, keep what's sound

**What we're building:** the MioPages product, meaning Core's way of designing, building and running
any Client's site, from onboarding through Launch and Ongoing. Nothing here is written for C0. C0 is
only the test case: its existing onboarding stands in for a Client's onboarding, and running the
product on it shows whether the product works.

**It covers Ongoing, not only the first build.** The same design source, components, content records
and change scopes are what Ongoing uses for every later modification: content updates, optimization
from measurement, adding or changing pages, and a full redesign. There is no separate Ongoing path.

## Context
Working through items 1–5 (Nov 29) and reading the code showed the following.
- **Sound:** the work up to and including the Site plan (onboarding knowledge, research, Report,
  Direction, Site plan), the engine, the design tokens, and delivery.
- **Broken:** the rendering layer:
  - a raw stylesheet Core writes blind, layered on theme CSS and patch scripts;
  - free-form node trees instead of components;
  - pages written without the rest of the site;
  - inflating instructions;
  - policing machinery.

The Principal: "Most likely there is a huge recovery component, but most of the tools need to be
rethought or rebuilt … I would think the mission is clear."

**Mission (agreed items 1–5):**
- One whole-site design first, then logical, reusable components (like Gutenberg blocks or block
  groups) to build pages from.
- Content is separate as source and laid into the layout.
- Pages are made one at a time, knowing the whole site.
- Changes and redesigns can be made at any scope, up to the whole site.
- Right-sized, with no arbitrary limits or minimums.
- One design process that also serves Ongoing.
- No invented methods, no patches, no hidden rules.

## Keep (unchanged)
- **The engine and record:** `lib/platform/service/cycle.ts`, with every Version kept and restore.
- **Onboarding knowledge, research, Report, Site plan:** the stages and their records.
- **Design tokens:** palette, fonts, corners, spacing, imagery direction
  (`lib/platform/design-systems/site-design.ts`, `site-fonts`).
- **Delivery transport:** signing, upload, media, read-back (`lib/platform/service/delivery.ts`
  and the plugin's transport classes).

## Rebuild
1. **One design source.**
   - The Direction's design holds the tokens plus the site's component choices: which components
     the site uses, and each one's variants (for example, an image left or right, a dark or light
     band).
   - The theme renders all of it from one stylesheet driven by that design.
   - Removed: Core's raw stylesheet and its contract (`site-stylesheet.ts`), and the patch scripts
     (`readable.js`, `menu.js`). Text readability comes from the token pairs Core already chooses.
     The menu uses WordPress's own navigation.
2. **A site component set.**
   - A small library of components built on WordPress blocks: opening, text, text with picture,
     set of points, steps, questions, gallery, call to action.
   - Each component has named slots for content and a few variants. Pictures and FPO frames go in
     picture slots; a placeholder for needed material goes in its own slot.
   - Core may propose a new component where a business needs one (Part 1 #15), and it's added to
     the library.
   - Removed: the node trees (`presence-native-component.ts`) and the fixed section frames in the
     plugin (`class-miopages-native-draft-content.php`).
3. **Content as source.**
   - Each page's content is its own record: headings, text, items, pictures, actions.
   - The page's layout lists components and points each slot at that content.
   - Words and layout change independently. This replaces `page-words.ts` (pieces, mend, adopt)
     with something much simpler.
4. **Pages written with the whole site in view.** Core gets the Site plan, the design and
   component set, and the content of the pages already written.
5. **Instructions rewritten.**
   - Removed: "use all of it," "completely," "every section must…".
   - Kept: "visually rich," and placeholders for material that's needed.
   - Size: in the Principal's own words ("a natural limit to what a visitor can comprehend";
     "neither extravagant nor too constricted").
6. **Changes at any scope, at Launch and in Ongoing.** A Request (from the Client, a Specialist,
   measurement, or Core) can target a section, a page, several pages, or the whole site, and can
   change content, layout or design. A redesign is a change to the design, and every page
   re-renders from it. These are the same operations Ongoing uses for optimization and updates.
7. **Policing removed or made visible.**
   - Removed: the stylesheet refusal rules (only real security checks stay), the automatic
     rendered-check correction loop, and mend/adopt.
   - The rendered-page check stays only as information a Specialist can see.
8. **Cleanup.** Retire the simplified side path (`lib/simple-site`, `scripts/simple-site`,
   `wordpress/miopages-simple`) once the rebuilt layer works.

## The Principal's input
- **Approve this program,** once.
- **Two looks on miopages.org, using C0 as the test case:**
  1. The design and component set, shown with the test case's existing approved words (free).
  2. The product run on the test case: Core designs and builds from C0's onboarding as it would
     for any Client (paid).
- **Genuine decisions only:** spending, plus the brand color and heading font. Nothing else is asked.

## Order and cost
1. Record the decisions, then build steps 1–7 on the free stand-in, with tests. Tests also cover
   the Ongoing changes: a content update, a layout change across several pages, and a whole-site
   redesign.
2. **Look 1** on miopages.org (free).
3. The product's paid run on the test case (C0): the design, then the pages. Estimate given before
   asking.
4. **Look 2.**

## Verification
- `npm test` passes, with new tests for components, content slots and change scope.
- A free stand-in run goes end to end to miopages.org.
- Claude looks at every page on desktop and phone (`scripts/service/draft-pdf.ts`) before showing
  the Principal.
