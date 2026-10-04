# Bounded Visual Direction

## Purpose and status

Design quality is part of the product value proposition, onboarding, customer
acquisition, confidence and retention. A Managed Site should feel authored and
intentional, not merely structurally correct. High perceived quality comes from
a finite curated vocabulary, not unlimited customization or bespoke art direction.
This also matters for Customer 0: the product's own presence and design-selection
experience should demonstrate quality, professionalism and flexibility within
bounds. Myomaton remains Customer #1 and the proving ground. No pricing or visual
outcome guarantee follows from this architecture.

This document defines **Core planned** visual contracts. It does not implement
profiles, new tokens, motion, icons or a Myomaton redesign. The
[capability catalog](platform-capabilities.md) defines product scope;
[implementation gates](deferred-architecture.md) govern delivery. Business
knowledge remains foundational; customers manage their business more than pixels.

## Model and ownership

Use both a **named, versioned curated profile** and a small validated set of
semantic preferences. A profile combines composition, typography relationships,
Hero treatment, surfaces, imagery, cards, links, elevation, density and decorative
restraint. These are recipes using shared primitives, not independent themes with
separate component implementations. Start with a reference direction and a safe
neutral fallback; add profiles only when recurring needs justify their maintenance.
Labels such as professional, warm, graphic or precise are example-selection
language, not a committed catalog of five themes.

| Layer | Authority |
| --- | --- |
| Design System | Canonical reusable token values and primitives: brand colors, bounded font families, spacing, shape, surfaces and future semantic component roles. |
| Visual Direction | Curated combinations and presentation defaults referencing those roles; no duplicate brand palette or business facts. |
| Platform Policy | Allowed capabilities, defaults, permitted overrides and ceilings; never arbitrary CSS. |
| Customer preference | Plain-language input mapped to supported profiles and permitted semantic choices. |
| Operator | Approved bounded adjustment and review, with the same validation and accessibility limits; not a CSS escape hatch. |

Resolve policy using the existing platform default → trusted service/operator
policy → permitted Web Presence → permitted Managed Site precedence. The service
controls override permissions. A profile and approved preferences then resolve
within those limits, consuming the assigned Design System. Accessibility and
security constraints, reduced-motion preferences and policy ceilings always win.
Operator presentation approval cannot bypass them.

Explicit validated Section choices retain their meaning; direction supplies
defaults for unspecified choices, not an automatic rewrite of stored Sections.
Future implementation must distinguish explicit values from normalization defaults.
Changing a profile must not silently overwrite customer choices, Section order,
copy or business facts. Profile upgrades require review of their visual effect;
versioning identifies the recipe, not a new publishing/revision system.

## Selection through onboarding

Ask which curated examples feel closest to the business, followed by a few
comparisons about tone, density, imagery, boldness and motion. Accept brand/logo
Assets as structured input. Customers should not need to understand tokens,
radius, shadow blur, CSS or breakpoints.

Examples must be reproducible with supported capabilities and show realistic
content and imagery constraints. External references can communicate preferences,
but do not promise reconstruction, copied layouts or bespoke implementation.
Translate customer language into a proposed profile and allowed preferences,
preview representative desktop/mobile content, and obtain approval or a bounded
revision. Do not present every internal semantic choice as a customer control.
See [onboarding and optimization](onboarding-optimization.md).

## Composition and rhythm

Keep Page/Section vocabulary finite. Direction can recommend alternating existing
surface roles, deliberate whitespace, reading/standard/wide content widths,
quiet versus featured emphasis, image-led versus text-led composition, restrained
dividers and grouped cards. Occasional asymmetry uses supported split variants,
not arbitrary columns, offsets or positioning. Recommendations do not rewrite a
Page without an authorized customer-state change.

Avoid treating every Section identically or automatically alternating every row.
A stronger Hero, a small number of emphasized areas and quieter supporting content
should establish hierarchy. A featured treatment must be a reusable semantic
capability before use, not one-off per-customer CSS. Limited imagery must still
produce an intentional result through typography, grouping, surfaces and spacing.
Responsive behavior remains platform-owned. Preserve the current split editorial
mobile source order: heading → image → body → Action, with both desktop variants.

## Typography

Define roles for Hero display, Page title, Section heading, subheading, body,
small/meta, Action/link text and form label/help/error text. Profiles select
bounded scale relationships, weight, line height and measure for these roles;
customers do not edit individual font sizes. Visual size never changes semantic
heading rank: retain a sensible document outline, labels and readable body text.
Avoid oversized display text that overwhelms small screens or truncates content.

Current implementation offers platform-owned sans/serif/mono stacks, base size,
heading scale and line height. A richer role scale is planned, not already exposed.
Keep family selection curated; any future font addition needs licensing, loading,
fallback and performance review, not arbitrary remote font URLs.

## Links and text decoration

Use shared semantic roles rather than component-specific color decisions. Accent
may inform link color, but each surface needs a readable pairing; brand color alone
is not proof of contrast. All links need visible keyboard focus, including on accent
surfaces. Hover must not be the only indication that something is interactive.

| Role | Intended contract |
| --- | --- |
| Inline content | Underlined at rest; readable link/text contrast. Hover strengthens decoration or contrast without shifting layout. |
| Navigation | May omit resting underline within an obvious navigation group; hover and current location have non-color cues, and current location uses appropriate `aria-current`. |
| Footer/utility | Underlined text links by default; a deliberate navigation group may use the Navigation contract. |
| Action/button link | Shape and label provide the affordance; no required underline. Use an anchor for navigation and a button for an operation. |
| Form help/privacy | Inline-link contract; remain distinguishable within small explanatory text. |
| Validation/help destination | Underlined descriptive link, distinguishable from error text; retain associated textual error and focus treatment. |

Default visited styling may match unvisited styling. A future content-link role
may distinguish visited destinations when useful, while maintaining contrast;
Navigation and conversion Actions should not acquire incidental visited colors.
Do not rely on color alone for inline identification, current location or errors.
No custom per-component link CSS controls are implied. These roles do not enable
HTML, Markdown parsing or link authoring in currently plain Section/privacy text;
future structured links need their own validated content contract.

## Contact and form states

Forms use the shared Design System, not a separate theme editor. Define semantic
roles for control background/text/border, label, help, focus, error and success.
Use the same spacing, typography, shape, Action and link relationships as the site.

| State or element | Contract |
| --- | --- |
| Label and required state | Visible associated label; required status expressed in text/semantics, not color or placeholder alone. |
| Input/textarea | Readable content, clear boundary, comfortable platform-owned sizing; no layout change on focus/error. |
| Focus | Visible outline or equivalent across all supported surfaces; never removed without replacement. |
| Help/privacy/consent | Readable secondary text with programmatic association where relevant; links follow the global contract. |
| Invalid/failure | Specific textual feedback, error association and non-color indication; recoverable input remains available where safe. |
| Submit/pending | Clear Action affordance and pending feedback; disabled state remains understandable. |
| Success | Meaningful textual status and accessible announcement/focus behavior, not only a green surface. |

The [Contact foundation](contact-forms.md) already implements labels, required/error
semantics and status feedback with existing tokens. Complete semantic state tokens
and cross-surface styling remain future implementation. This decision resolves the
design contract, not that implementation or the production forms gates.

## Elevation, backdrops and icons

Elevation is finite: **none**, **subtle**, **prominent**. Default to none or subtle.
Prominent is reserved for an intentional layer or conversion emphasis, not every
card. Shared recipes own shadow parameters; borders/surfaces must still communicate
boundaries when shadows are ineffective. No customer shadow editor is allowed.

Blur/translucency is optional for a justified layered Header, overlay or selected
elevated surface. Supply an opaque fallback, maintain readable contrast against
changing backgrounds and avoid excessive rendering cost. It is not a general
glassmorphism treatment. Sticky Headers and overlays are not implied implemented.

Use icons sparingly for phone/email/social or clear functional cues, occasionally
for meaningful supporting markers. Keep text labels where useful; decorative icons
are hidden from assistive technology, and icon-only controls have accessible names.
Current dependencies provide no shared icon library: the local hamburger SVG and
text social links do not establish one. Before expansion, select a bounded approved
source and shared renderer with reviewed static assets/licensing. Do not execute
uploaded SVG/code or introduce a client-extensible icon runtime. Existing managed
Asset security and accessibility rules continue to apply.

## Page-level motion budget

Motion is an accent, not a background condition. Use **Off**, **Minimal**, **Light**;
there is no Medium/High tier. The initial proposed automatic-reveal ceilings are:

| Level | Whole-Page ceiling |
| --- | --- |
| Off | No nonessential animation; state changes remain immediately understandable. |
| Minimal | At most one brief automatic reveal, typically the Hero. |
| Light | At most three brief reveals including the Hero; no concurrent automatic sequences. |

These are platform policy ceilings, not per-Section allowances or promises that all
budget must be spent. Direction requests a level and priorities; effective policy
can reduce it. A deterministic Page-level allocator prioritizes Hero then selected
emphasis in content order. Independently animated cards each consume budget, so a
card cascade cannot count as one effect. Scrolling away/back does not reset budget.

Restrained hover feedback and brief future dialog transitions are interaction
responses, not extra automatic reveals; they still obey the selected intensity,
platform duration/distance bounds and reduced-motion behavior. `prefers-reduced-motion`
forces nonessential motion Off. Content must remain readable without JavaScript or
animation completion. Use no layout-shifting reveals, looping decoration, dramatic
parallax, scroll-jacking or motion-dependent comprehension. Effects normally run
once per Page visit. Verify performance, allocation across all Sections, interruption
and reduced-motion behavior before enabling motion. No runtime allocator exists yet.

## Images, Hero and global chrome

Image treatments are bounded: clean edge, framed/bordered, softly elevated or
contained. Direction chooses an appropriate shared recipe, not per-image CSS.
Existing natural/contain/cover fit remains separate from framing. Feature/background
images require an explicit supported capability and appropriate contrast and
decorative/informative semantics; they must not turn informative content into an
inaccessible decoration. Preserve Asset identity and AssetUsage accessibility
overrides; styling never supplies or changes alt text.

The proposed small Hero vocabulary is quiet/editorial, strong/graphic, split-media
and centered statement. These are semantic treatments of validated content, not
builders. Current Hero supports its existing structured fields/default variant;
new treatments, particularly Hero media support, require implementation before
selection. A strong text-only Hero must work without manufacturing imagery.

Header/Footer retain their controlled structure and canonical identity consumers.
Direction may influence density, typography emphasis, active-link treatment, CTA
emphasis, elevation and optional backdrop. It cannot rearrange arbitrary elements,
copy business facts or expose breakpoints. Primary Navigation's existing 64rem
collapse remains platform-owned. See [site globals](site-globals.md).

## Persistence and compatibility

No schema change is required. `design_systems.configuration` already holds tokens;
`managed_sites.configuration` can hold a validated presentation-level
`visualDirection` object with profile identity/version and permitted preferences.
This is a proposed contract, not a field currently consumed by rendering. Keep
profile recipes in platform code and customer selection in canonical PostgreSQL.
Do not store duplicate token values, arbitrary styles or executable recipes there.
Business/logo facts remain Web Presence-owned and Assets remain reusable.

Extend typed normalization deliberately when implementing semantic tokens and
direction resolution; existing JSON storage alone is not validation or support.
Unknown/invalid choices need safe defaults. A missing direction must preserve the
current rendering path; activation is explicit, not an implicit redesign on deploy.
Unknown profile versions must fail safely to a documented neutral treatment and
surface an operator review need without rewriting canonical state. Reuse the
existing policy resolver rather than adding competing override precedence.
No generalized policy UI, customer writer or theme marketplace is introduced.

## Proposed Myomaton reference direction

Working direction: **technical curiosity / serious fun**. Technical, human, curious,
lightly playful and non-hyped; avoid both sterile documentation and futuristic hype.
This is a proposal for later review/implementation, not current customer state.

- A stronger text-led graphic Hero and confident display/heading hierarchy; keep
  plain-language content and a clear primary Action.
- Restrained blue/green accents with readable neutral surfaces. Any second accent
  role needs a shared token extension and contrast review; the current single-accent
  model must not be bypassed with one-off colors.
- Alternate quiet surfaces selectively; group projects and principles intentionally,
  emphasize a few moments and reduce reliance on repeated thin rules.
- Use existing split variants for selective asymmetry. Frame prototype/product
  photographs consistently with borders or subtle elevation and suitable fit.
- Use deliberate whitespace and restrained cards; avoid an icon for every concept.
- Request Light motion only after the whole-Page budget is implemented and tested;
  until then use no new motion. Reduced-motion presentation is equally complete.
- Keep Header/Footer restrained and readable with current name fallback. Do not
  invent a logo, contact facts, social profiles or new imagery.

Later implementation must preserve the accepted Home/About/Projects/Principles
structure, Section order and copy unless a separate customer-state change is
authorized. Preview all four Pages at phone, tablet and desktop widths with real
content, sparse imagery, keyboard focus and reduced motion. Customer approval of
direction is not approval of arbitrary subsequent content changes.
