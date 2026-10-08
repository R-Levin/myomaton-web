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

This document defines the visual contract and its **Implemented** opt-in runtime
foundation and reference-v2 composition system described below. Reusable v2
capabilities received human desktop/tablet/mobile visual acceptance for this
checkpoint. Customer selection/editing UI and shared icon expansion remain planned.
Real development Myomaton uses reference v2 after its applied and verified
[guarded customer transition](myomaton-visual-direction-v2.md). The
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
The read model carries raw configuration alongside normalization to distinguish
explicit values from defaults; direction never modifies either stored representation.
Changing a profile must not silently overwrite customer choices, Section order,
copy or business facts. Profile upgrades require review of their visual effect;
versioning identifies the recipe, not a new publishing/revision system.

## Selection through onboarding

### Reference and context evidence

**Reference-led when useful references exist; context-led when they are absent or
weak after actual inspection.** Required but inaccessible references trigger the
[source-adequacy stop gate](#visual-evidence-and-recommendation-process), not a
context-only substitute. Customer-owned current/historical presence is important
visual evidence when available. Customer-provided sites influence style when explicitly identified as liked,
disliked, representative, aspirational or stylistically appropriate. Approved brand
Assets and relevant peer research may provide additional evidence, never templates
to copy. Record observations separately from recommended interpretation.

Historical client work primarily establishes experience, business-domain context
and operator background. It informs Visual Direction only when explicitly nominated
as a style/reference source. It is not automatically current-customer design evidence.

When inspected references are weak, or references are not required and genuinely
absent, infer from business type and maturity, audience, buying
context, trust/formality needs, emotional register, service/product type, expertise,
desired visitor Action and customer preferences. A law practice may need restraint
and authority; a party-supply business may support brighter color and playful imagery.
Those differences follow business context, not a desire to make sites look different.

Always constrain the recommendation by business purpose, content density, conversion
needs, proof requirements, brand commitments, available imagery/Assets, accessibility
and readability, relevant professional/regulatory expectations, and supported platform
capabilities. **Visual novelty is not a success metric.** Similar businesses may
appropriately receive similar treatment.

The customer supplies preferences, references, dislikes, constraints, Assets and
business/audience context. AI/operator recommends bounded typography, palette roles,
density, imagery/evidence, surfaces, composition tendencies and motion. The customer
approves representative outcomes, not composition names, spacing, breakpoints,
animation timing or implementation mechanics. See
[reference intake](onboarding-optimization.md#external-reference-intake).

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

The planned [external-reference intake](onboarding-optimization.md#external-reference-intake)
records liked/disliked traits, priorities and supported mappings. Curated examples
demonstrate reproducible platform results; customer-provided competitor/unrelated
sites communicate intent and never become copied templates.

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
heading scale and line height. Opt-in semantic roles derive display/Page/Section
scales and body/meta/label/help/error sizing from those primitives.
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
semantics and status feedback. Opt-in Visual Direction now adds shared semantic
state sizing, focus and non-color error/success treatment. This does not complete
production forms gates or add structured links to plain privacy text.

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
there is no Medium/High tier. The implemented automatic-reveal ceilings are:

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
platform duration/distance bounds and reduced-motion behavior. The current runtime
implements only the automatic effect, not animated hover/dialog responses. `prefers-reduced-motion`
forces nonessential motion Off. Content must remain readable without JavaScript or
animation completion. Use no layout-shifting reveals, looping decoration, dramatic
parallax, scroll-jacking or motion-dependent comprehension. Effects normally run
once per Page visit. Verify performance, allocation across all Sections, interruption
and reduced-motion behavior before expanding motion. The current allocator selects
populated Hero/CTA Sections, Hero-first then content order, and emits at most three
slots. Version 1 performs one 180ms, 3px transform-only settle on mount, serialized by
slot delay. Version 2 uses the initial-load Hero contract below. Neither uses an animation
library. CSS and the optional non-Hero coordinator enforce reduced-motion preference.
Effects can replay on a new Page mount; scrolling does not remount or replenish them.

## Images, Hero and global chrome

Image treatments are bounded: clean edge, framed/bordered, softly elevated or
contained. Direction chooses an appropriate shared recipe, not per-image CSS.
Existing natural/contain/cover fit remains separate from framing. Feature/background
images require an explicit supported capability and appropriate contrast and
decorative/informative semantics; they must not turn informative content into an
inaccessible decoration. Preserve Asset identity and AssetUsage accessibility
overrides; styling never supplies or changes alt text.

The runtime Hero vocabulary is editorial, graphic and statement, retaining the
existing structured fields/default Section variant. These are presentation recipes,
not builders. Split-media Hero remains planned because the current Hero has no
media contract. A strong text-only Hero works without manufacturing imagery.

Header/Footer retain their controlled structure and canonical identity consumers.
Direction may influence density, typography emphasis, active-link treatment, CTA
emphasis, elevation and optional backdrop. It cannot rearrange arbitrary elements,
copy business facts or expose breakpoints. Primary Navigation's existing 64rem
collapse remains platform-owned. See [site globals](site-globals.md).

## Persistence and compatibility

No schema change is required. `design_systems.configuration` already holds tokens;
`managed_sites.configuration` can hold a validated presentation-level
`visualDirection` object with profile identity/version and permitted preferences.
This contract is consumed at presentation time by the Managed Site service. Keep
profile recipes in platform code and customer selection in canonical PostgreSQL.
Do not store duplicate token values, arbitrary styles or executable recipes there.
Business/logo facts remain Web Presence-owned and Assets remain reusable.

Typed normalization validates direction resolution; JSON storage alone does not
authorize arbitrary settings or new capabilities.
Unknown/invalid choices need safe defaults. A missing direction must preserve the
current rendering path; activation is explicit, not an implicit redesign on deploy.
Unknown profile versions must fail safely to a documented neutral treatment and
surface an operator review need without rewriting canonical state. Reuse the
existing policy resolver rather than adding competing override precedence.
No generalized policy UI, customer writer or theme marketplace is introduced.

## Runtime contract

Managed Site `configuration.visualDirection` selects either legacy `profileId` /
`profileVersion` or the [versioned grammar](#versioned-visual-grammar), with optional
`preferences`. The following profile contract remains unchanged. Both `editorial` and `reference` have
version `1`, plus `reference` version `2`; unknown identity/version returns legacy rendering with an internal
`unsupported` reason. Missing configuration returns `missing`; malformed objects,
unknown preference keys or invalid values return `invalid`. The whole direction
falls back, not a partially applied unsafe preference set. No stored values change.

```json
{"visualDirection":{"profileId":"reference","profileVersion":1,"preferences":{"hero":"statement","motion":"minimal"}}}
```

This is a generic example, not Myomaton configuration. `editorial` is comfortable,
quiet, balanced, plain imagery, no elevation or motion. `reference` is airy,
alternating, confident, graphic Hero, framed imagery, subtle elevation and requests
Light motion. Both use opaque backdrops and functional icon intent. They share one
renderer and the assigned Design System; neither owns customer colors or fonts.

| Preference | Finite values |
| --- | --- |
| density | comfortable, airy |
| hero | editorial, graphic, statement |
| image | plain, framed, elevated, bordered |
| elevation | none, subtle, prominent |
| motion | off, minimal, light |
| backdrop | opaque, translucent |

The existing trusted `WEB_PRESENCE_SERVICE_POLICY` supports `visualMaxMotion`
(default minimal) and `visualTranslucency` (default false), each with the existing
`value`/`allowPresenceOverride`/`allowSiteOverride` contract. Scoped policy values
live under existing presence/site `configuration.policy`. Trusted service-only
`visualPreferences` is a list of permitted keys; default permissions are density,
hero and motion. Other valid preferences are ignored unless explicitly permitted.
Customer configuration cannot grant itself permissions. No policy UI is added.

Profiles supply only missing surface, divider, spacing and Hero width/alignment
defaults. Even a malformed explicitly present Section key retains its existing
normalizer fallback. Variants, columns, media fit, Actions and content remain intact.
Alternation is based on supported ordered Sections. Icon intent is resolved but
does not create new icons; P23 still applies. Optional translucency affects only the
existing Header, with opaque fallback; it does not make the Header sticky.

All new CSS is scoped to an active `data-visual-direction`. Legacy sites retain
their token/markup path. Derived semantic colors retain the preferred Design System
color when readable against its surface, otherwise use black/white for text/link
roles without changing canonical tokens. Focus uses the local readable foreground;
inline links remain underlined. Navigation has separate hover/current treatment and
`aria-current` for exact Page routes. Shadows and blur are platform-owned constants.
Form privacy remains escaped text; the shared anchor rule covers future supported
help/privacy links without enabling arbitrary markup.

## Presentation intent and checkpoint boundary

Bounded does not mean visually conservative. Design quality is a core product
value: finite semantic recipes should support confident whole-page composition,
not preserve a provisional stub merely because it already exists. Preserve content
meaning and explicit human choices. Missing/default presentation can be recomposed
within supported roles; raw explicit fields remain authoritative, including safe
fallback for invalid values. The runtime does not guess whether a stored field was
bootstrap intent. Operators make any reviewed presentation changes explicitly in
isolated state before a separately authorized customer transition.

The product remains outside the Gutenberg/Divi editing model: no arbitrary HTML,
CSS, grids, pixel mechanics or drag/drop canvas. External references influence
traits and art direction without copying layouts or branded assets. Customers and
operators approve outcomes rather than author animation or spacing mechanics.
External-reference intake and automated approval/writing workflows remain planned.

## Reference v2 expression contract

Reference v2 is implemented and human visually accepted for this reusable
checkpoint, using the accepted four-Page disposable proving preview. It evolved
in place before approval rather than introducing v3. V1 rendering remains intact.
The real development customer is stored as reference v2 after a separately
authorized guarded transition. Selecting profiles, colors, compositions, order,
images or Action labels remains a reviewed customer-state operation; the accepted
Myomaton choices are not platform defaults.

### Finite semantic compositions

Section configuration may select one type-specific composition:

| Type / role | Composition | Reusable behavior |
| --- | --- | --- |
| Hero | asymmetric-field | Wide left display beside readable support and primary Action; optional supplied eyebrow above both. |
| Intro / explanation | editorial-row | Shared left edge, heading and readable body in disciplined columns. |
| Intro / statement | statement-break | Large h2 assertion followed by offset reading-scale support. Requires explicit statement treatment. |
| Intro / image | image-evidence | Large clean image alongside heading/body; mobile heading, image, body order. Requires resolved AssetUsage. |
| Collection | grouped-field | Group-level framing with equal text-led peers; existing two/three-column vocabulary. |
| CTA | conversion-band | Strong next-step heading beside support and existing Action. |

These are authored recipes, not grids, HTML/CSS, pixel controls or breakpoints.
Unsupported values and type/role mismatches fail to ordinary presentation. V1
ignores compositions. Explicit alignment remains authoritative: these compositions
require left alignment; asymmetric Hero also requires wide width, and editorial/
image rows require standard or wide width. Reading/center choices fall back rather
than being overridden. No provenance guess is needed: the disposable preview
explicitly selects its presentations; canonical choices are untouched.

Display maximum derives from 2 times Design System heading size, bounded to
56 to 112px; statement derives from 1.3 times, bounded to 40 to 72px; ordinary Section
heading derives from 1.85 times body size, bounded to 24 to 40px. Responsive clamps and
measure are platform-owned. Strong contrast comes from roles rather than enlarging
all headings. Primary Actions are shaped next steps; supporting Actions are text
links. Destinations and labels remain canonical.

### Explicit statement and accent roles

See [statement treatment](sections.md#explicit-editorial-statement-treatment).
Compact statement bounds remain 120 heading characters / 18 words and 360 support
characters / two paragraphs. Explicit statement-break permits up to 900 support
characters / five paragraphs because support stays separate at reading scale.
Image-backed, absent-heading or overlong content falls back without clipping copy.
The composition alone never grants statement meaning; treatment is required.

Two finite surfaces extend the existing vocabulary: contrast uses Design System
text as structural background with readable inverse foregrounds; editorial uses
secondary accent with a contrast-paired foreground, falling back to primary.
Primary stays navigation/conversion identity. The optional implicit statement wash
remains policy-gated; explicit surfaces suppress it. Explicit editorial surface is
semantic composition, not a decoration-policy workaround. No automatic bar or
other ornament is allocated. Collections never consume positional accents.
Clean imagery has no default border, frame or shadow; existing explicitly selected
elevated/bordered profile treatments remain distinct.

### Staged Hero and Page motion contract

The initial stylesheet prepares allocated semantic Hero parts before their first
paint, without an initial waiting phase, using the fixed stages below. Final grid, widths,
measures and typography exist immediately; no hydration state changes geometry.
Only opacity and transform animate. The earlier post-paint WAAPI reset caused a
visible snap from already-visible content and has been removed. CSS completes the
entrance without JavaScript; unsupported CSS animations leave visible base content.
No observer or scroll dependency controls Hero.

| Semantic part | Start after activation | Duration | Upward travel / opacity |
| --- | --- | --- | --- |
| Supplied eyebrow | 0ms | 360ms | 8px; .35 to 1 |
| Heading | 0ms | 1150ms | 96px desktop / 56px narrow; .35 to 1 |
| Support | 100ms | 650ms | 24px; .35 to 1 |
| Action | 260ms | 450ms | 18px; .35 to 1 |

Ease-out: cubic-bezier(.22,.6,.35,1). The composite lasts 1150ms without an initial
starting delay, approximately 1.15 seconds total. Missing support collapses Action
start to 160ms; missing heading starts support immediately; a lone Action starts
immediately. Eyebrow is a named role, not heading wrapper or DOM-position guess.
No arbitrary hooks, timeline settings, bounce, loops or large dependencies.

The composite counts as ONE event. Off/Minimal/Light ceilings remain 0/1/3;
effective Minimal uses one Hero and no downstream reveal. Optional Light CTA
entries queue behind Hero completion and each other, once, at 460ms/14px.
Reduced motion starts no animations and cancels active/queued work immediately;
focus within Hero cancels motion to make its Action visible. The client boundary only queues optional downstream entries behind actual CSS
Hero completion; cleanup cancels its fallback timer, observer and active animations. Unsupported APIs retain readable content.
V1 keeps its prior settle. Service policy is unchanged.

## Art-direction implementation and review boundary

Human visual acceptance has been received for the reusable checkpoint. Automated
contract/HTTP/image-byte tests establish correctness, not visual taste. Future
profile changes still need outcome review. No customer-state transition, schema
migration, reference intake UI, Contact activation or production approval follows
from acceptance of this development preview.

Disposable operator scripts and presentation records were checkpointed separately
as customer/operator artifacts, not reusable profile defaults. They exercise
existing structured fields in random isolated schemas;
serving connections are read-only and before/after snapshots protect canonical
state. They are not a reusable self-service preview/approval product. Real Myomaton
now uses reference v2 after its separately authorized guarded transition.

## Rendered-review correction pass

The existing vocabulary remains sufficient. Under 60rem, compact/normal/spacious
Section padding stays distinct but caps at 20/28/40px per side. Paragraph margins
and inner gaps avoid compounded empty intervals. Narrow display, statement,
Section and peer scales remain distinct; equal peers use restrained group-level
surfaces and text-led treatment rather than oversized feature boxes.

Disposable operator files may select existing Section sort order and existing
Action references, validated against the frozen copied Page/Section/Action graph.
This uses existing structured fields in isolated state, not a new platform layout
capability or customer editing control. Canonical copy, Actions, assets, Navigation
and state remain intact. No CSS selects a customer, Page, UUID or heading.


### Verified responsive expression

Hero opacity starts at .35 and reaches .9 at 20% of each stage, so the message
becomes readable while substantial travel settles. No layout property animates.
Grouped two-column peers wrap at equal widths and center an incomplete final row;
no item receives positional styling. Narrow grouped gaps are .5rem and mobile
statement display remains 40 to 56px with a short measure and nearby support.
Ink surfaces use a shared high-contrast neutral Action fill, with a foreground
computed against that fill. Palette settings and destinations remain authoritative.
These are reusable refinements, not customer editing controls.


Finishing refinements preserve the current composition: a gentler Hero ease-out
keeps substantial upward movement visible while opacity becomes readable early.
Below 480px, only Hero internal gaps (14px) and eyebrow margins tighten; typography,
Section spacing and touch targets remain unchanged. Tablet statement headings use
up to 22ch, bounded by their container, while narrow phones retain 13ch and desktop
statement asymmetry remains unchanged. These shared rules require no new capability.
The reusable expression is accepted for this checkpoint; applying customer state remains separate.


### Major Section outer rhythm

Collections and editorial-row intros have asymmetric outer rhythm: slightly more
padding above their heading, with existing bottom padding and internal gaps intact.
Compact/normal/spacious remain distinct. Below 960px their top padding is bounded
at 28 to 32px / 32 to 40px / 40 to 48px respectively; ordinary reading sections retain the
previous compact rhythm. Desktop uses bounded top padding derived from the existing
Design System section spacing. Hero, statement, evidence and conversion compositions
retain their own rhythm. There are no Page-specific spacing controls or selectors.
This rhythm is part of the human-accepted reusable checkpoint. Customer transition
choices remain separate from the shared contract.

## Versioned Visual Grammar

Bounded does not mean homogeneous. The authority chain is Design System tokens →
versioned Visual Grammar → optional Page-purpose recipe → compatible Section
compositions. Legacy grammar paths do not consume Page recipes. Grammar coordinates heading character,
Hero proportions, prose/support measures, responsive hierarchy, density/rhythm,
conversion emphasis and omitted presentation defaults; these are not independent
customer styling knobs. Intake recommends a grammar from business/audience, trust,
content density, approved style references, available imagery, buying context and
preferences. Customers approve representative outcomes.

Select the finite opt-in contract in Managed Site configuration:

```json
{"visualDirection":{"grammar":{"id":"restrained-editorial","version":1},"preferences":{"density":"comfortable","motion":"off"}}}
```

Grammar accepts existing density, motion, image, elevation and backdrop preferences,
subject to the same service policy. Hero character belongs to the grammar, not an
independent Hero preference. Grammar and legacy profile identity/version cannot be combined. Unknown identity,
version or malformed configuration fails closed to ordinary rendering. Omitted
grammar does not reinterpret a legacy profile. Reference v2 remains an accepted,
unchanged rendering path; no schema migration or customer transition is required.

Restrained-editorial v1 remains a pinned experimental rendering, not an accepted
MioPages solution or evidence of market-wide visual suitability. Design System palette, font stacks and scale remain
authoritative. Grammar caps Hero display scale and owns its monotonic responsive
relationship, bounded support/prose measures, proportionate rhythm and modest CTA
hierarchy. Comfortable/airy density remains distinct on narrow screens. Existing
compositions use grammar-owned proportions without inventing new Section types.

Container width (reading/standard/wide) is distinct from prose (64ch), Hero heading
(24ch) and support (54ch) limits. Omitted width/alignment/spacing/surface/divider
inherits grammar defaults. Explicit choices win, including conservative normalizer
fallbacks for invalid-present values. Ordinary intros default to reading width;
editorial compositions use standard width, asymmetric Hero uses wide width. CTA
defaults to subtle; accent remains an explicit conversion choice. Service policy,
contrast, focus, touch targets and reduced motion continue to constrain presentation.

Image-brand links use intrinsic fitting without customer width settings; text
brands retain their geometry. No custom CSS, pixel placement, arbitrary grids,
breakpoints, spacing sliders or per-element sizes are exposed.

Image-led Hero, visual evidence/portfolio collections and structured technical
detail are separate future capability slices. This text-led grammar does not pretend
to provide them. Future grammar versions are additive and explicitly selected;
existing state must retain its resolved version, never be reinterpreted automatically.


## Commercial presentation contract version 2

Bounded creativity, not bounded blandness. Business appropriateness constrains visual
choices; technical conservatism constrains state, security and tenancy. Human review
of the restrained-editorial experiment found a continuing house style despite its
correct hierarchy and responsive behavior. Functional fixture passes do not establish
visual acceptance.

Canonical content and managed Assets supply truth. The Design System supplies palette
and typography resources. A versioned Visual Grammar determines character; optional
Page-purpose recipes apply it; compatible compositions realize it. One resolved plan
feeds a separate renderer. The functional foundation constrains every layer.

Managed Site configuration selects the new path explicitly:

```json
{"visualDirection":{"contractVersion":2,"grammar":{"id":"service-led","version":1},"preferences":{"motion":"off"}}}
```

The writer/preparation contract rejects unknown keys, grammars, versions and preferences.
Reads of an invalid new contract resolve a basic text presentation with internal
diagnostics, never another expressive grammar. Selection is additive: reference v2
and restrained-editorial v1 retain separate dispatch and are not reinterpreted.
No schema migration or automatic customer upgrade is introduced.

`service-led` v1 coordinates precise sans typography, display/heading/body/metadata
relationships, prose (62ch) and support (46ch) measures, connected/separated/emphasized/
closing rhythm, semantic surfaces, text-led evidence, supporting media, conversion
families and chrome. Its finite manifest declares compatible recipe/composition
version 1 and Hero fallback chains. Existing Geist sans resources are used. Motion
Off has no entrance animation; minimal is a permitted ceiling, not a promise of a
new motion sequence.

### Page-purpose recipes

Page configuration may contain:

```json
{"presentation":{"recipe":{"id":"arrival","version":1}}}
```

| Recipe v1 | Default Hero | Default conversion | Cadence |
| --- | --- | --- | --- |
| arrival | service-value | closing-emphasis | separated |
| service | orientation | integrated-invitation | connected |
| evidence | editorial-masthead | focused-next-step | separated, text-led evidence |
| assessment | orientation | focused-next-step | connected, compact ending |
| editorial | editorial-masthead | integrated-invitation | separated reading |

Recipes never reorder Sections, write claims or invent evidence. They are optional.
Precedence is safety/semantic validity, valid explicit Section choice, recipe,
grammar, basic fallback. Omitted presentation inherits; deliberate existing width,
alignment, spacing, surface and divider choices remain authoritative. New finite
Section `presentation` choices are `hero`, `conversion`, `surface` and `region`,
validated for their Section type. Legacy composition names cannot be mixed into this
path. Invalid choices refuse preparation; reads retain supported content and use
safe defaults with diagnostics.

### Structural families

Orientation provides compact heading/context/introduction entry. Editorial masthead
places heading and introduction in distinct regions. Service value places proposition
and two to four approved value points in separate regions. They remain structurally
distinct at narrow widths. Service value without a valid scaffold falls back to
masthead, then orientation if introduction is absent. No points are generated.

Relationship version 1 supports ordered stages, aligned named-party responsibilities
and labeled included/boundary/extension scope. Conversion supports integrated
invitation, focused next step and closing emphasis. Actions remain independently
owned and eligible; presentation cannot create a submission destination or disabled
workflow imitation. See [Section contracts](sections.md#commercial-structured-content).

### Palette and chrome

Design System `palette.version: 1` supplies primary, supporting, tonal, light, strong
and contrast background/foreground pairs plus border and muted text. Each text pair
and muted-on-light is validated at 4.5:1. Grammar maps proposition/relationship/
evidence/invitation/closing purposes to roles; Sections never supply hex colors.
Invalid/missing new palette data derives safe supported pairs from existing tokens.
Legacy palette resolution is unchanged.

Service-led uses brand-prominent arrival chrome and compact other-page headers;
commercial navigation emphasizes the authoritative primary Action destination.
Footer is service-led except the compact assessment ending. Basic fallback uses
compact chrome and quiet navigation. Header media fits intrinsically without
customer sizing values. All paths retain keyboard disclosure, focus, touch targets,
landmarks, safe destinations, media eligibility and scoped ownership.

Phase 2 media/evidence-led Heroes, visual evidence collections and portfolio recipes
are not implemented. Phase 3 structured technical detail, specification/comparison
contracts and technical recipes are not implemented. No arbitrary CSS, page builder,
per-breakpoint input, spacing knobs, uploaded fonts or unrestricted colors are added.

## Evidence-led commercial grammar v2

`service-led` version 2 is an additive, explicit contractVersion 2 selection. Version
1, restrained-editorial v1 and accepted Myomaton reference v2 remain pinned. The
working direction for the disposable MioPages proposal is **Clear work, continuing
care**; it is not an industry theme or a new competing configuration authority.

The grammar coordinates Source Editorial v1, paper/purple/ink/lavender/apricot/plum
palette relationships, acquisition navigation, connected service relationships,
preview-supported service arrival, warm integrated invitations and compact dark
brand sign-off. The same recipe purpose/version acquires its coordinated defaults
from the selected grammar; content order remains authoritative. Explicit valid
Section choices still win. Unknown grammar/version refuses preparation and reads
fall back to basic supported content with internal diagnostics.

Source Editorial selects pinned Source Serif 4 semibold for display/major headings
and Source Sans 3 regular/semibold for body, navigation, Actions and minor headings.
No arbitrary fonts or element typography are exposed. See [font provenance and
licenses](../public/fonts/README.md). The registry owns resources; grammar owns their
relationship. Serif is purposeful commercial/editorial character, not universal
luxury styling. Functional tests do not establish aesthetic suitability.

The additional `service-illustrated` Hero is a media-supported **service** structure,
not the general media-led/evidence-led families deferred to Phase 2. This slice
supports explicit FPO service illustration only. Missing/ineligible preview media
falls back to orientation, retaining approved heading, introduction and Actions.
No fabricated value/evidence appears. A future approved-media contract is a separate
eligibility-backed extension, not automatic promotion of the FPO.

`previewMedia` carries version, finite role, importance, intended aspect, plain
purpose, likely source category and unresolved permission. It is operator design
metadata only. A trusted read-only disposable schema/environment must authorize
rendering; ordinary production refuses all slots regardless of stored configuration.
FPO never creates an Asset, AssetUsage or approved image and has no production
promotion transition. Illustrative report outlines contain labels and blank priority
positions, never findings, scores, customer data or performance claims.

The acquisition destination comes from the existing scoped Header Action authority.
Review emphasis remains independent of `aria-current`; the current location has
separate weight/dot treatment. Mobile retains the labeled accessible disclosure.
The compact sign-off uses an eligible contextual `logo-light` AssetUsage where
available, independent of the ordinary Header wordmark; neither source path is public.

See [preview iteration five](miopages-c0-preview.md#clear-work-continuing-care-iteration-five)
and [range roadmap](deferred-architecture.md#evidence-led-commercial-presentation-range).
Human review must judge appropriateness, coherent Page flow and brand character.

## Confirmed historical DNA and service-led v3

[A Business in Focus](miopages-business-focus.md) records the confirmed historical extraction and its additive implementation. Simplify historical techniques, not historical expressiveness. Finite layered fields, continuing-service composition, annotated artifact and evidence FPO families remain operator-selected, versioned capabilities; there are no customer placement controls.

Human visual review accepted service-led v3 as the provisional direction to carry
forward for MioPages Customer #0. Earlier experiments remain pinned architectural
and regression evidence, not accepted MioPages directions. Canonical customer state
has not been promoted; copy, production assets/evidence and operational workflows
remain subject to approval. Commercial launch is not authorized.

## Visual evidence and recommendation process

1. Gather business/intake context and identify customer-owned current/historical presence.
2. Gather explicit liked/disliked references when available; verify visual source adequacy.
3. **STOP if required visual evidence cannot actually be inspected.** Record the gap
   and obtain a usable source. Text extraction, generic adjectives, assumptions and
   incomplete browser evidence cannot silently substitute for visual inspection.
4. Extract concrete Visual DNA, distinguishing recurring behavior, one-off historical
   choices, dated implementation techniques and business-model artifacts.
5. Confirm the interpretation with customer/operator, then supplement with limited
   business-area peer research where useful.
6. Synthesize **one** recommended direction and identify imagery/FPO needs.
7. Render faithfully with reusable capabilities, obtain human review and make bounded adjustments.

Incomplete inspection contributed to failed C0 iterations by reducing expressive
sources to generic traits. Functional correctness does not establish visual success.
**Simplify historical techniques, not historical expressiveness. Bounded creativity,
not bounded blandness.** Technical conservatism belongs in state, schema, security,
tenancy, validation, migrations and rollback. Visual restraint must follow evidence;
it is not the default recommendation.

Customer/operator-owned current or historical sites can establish continuity,
recurring behavior, historical range, imagery, density, color, metaphor and preferences
to preserve or evolve. Historical client work remains experience/proof, business-domain
and operator-history context unless explicitly nominated as a style reference.

Visual DNA is descriptive evidence, not an algorithmic style generator. Use supported
LOW / MODERATE / HIGH descriptions for illustration willingness, photography reliance,
brand color strength/range, visual metaphor, information density, promotional energy,
typography personality, decorative energy, whitespace, layering, shapes/graphic devices,
image prominence, commercial directness, playfulness, technicality and formality.
Record concrete observations and uncertainty; do not invent numerical scores.

An FPO means “the recommended design believes visual material belongs here.” It does
not establish production imagery, require existing customer ownership or permit
placeholder publication. Resolve through customer-owned assets, permissioned existing-site
reuse, supplied/commissioned photography, licensed stock, approved generated or
commissioned illustration, or remove/redesign. FPO remains production-ineligible until
an approved eligible Asset replaces it through a separately reviewed workflow.
