# Web Presence platform capabilities

## Purpose

This document defines the intended capability envelope of the managed Web Presence
platform: a managed traffic/lead-generation and business-presence system, not a
free-form page builder or general-purpose CMS.

**Web Presence** is the broader customer-owned managed presence. A **Managed
Site** is one concrete rendered/deployable multi-page site within it; a **Page**
is addressable content within that site. “Conversion Site” may be product-facing
wording, but is not an internal/domain type. Historical “Microsite” terminology
refers to the current Managed Site concept; see the [rename deployment note](managed-site-rename.md).

The Managed Site is the public conversion-focused surface / tip of the funnel.
Structured customer/business knowledge is canonical and reusable. Pages and
Sections consume that knowledge rather than owning duplicated global facts.

The platform aims to:

- Turn structured business knowledge into an effective web presence.
- Support full-presence, adjunct, and campaign deployments.
- Provide flexibility for real client needs without accumulating one-off
  site-builder complexity.
- Favor controlled semantic choices and platform-owned responsive behavior.
- Keep customer/business state structured, reusable, and manageable as a service.
- Make onboarding, first-party measurement and continuous optimization core
  product functions, with explicit approval policy and protected business truth.

Myomaton is Customer #1 and the proving ground for these capabilities. Its content
is canonical customer state, not a permanent platform template. See the
[customer-state and bootstrap boundaries](bootstrap.md).
Customer 0 is the concept for the product's own Web Presence; it does not imply
an existing customer record. The [onboarding and optimization operating model](onboarding-optimization.md)
records the core planned workflow and its trust/provider boundaries.

The [Web Presence service model](web-presence-service-model.md) defines launch and
ongoing service intent; the [MioPages C0 model](miopages-c0-product-model.md) records
the commercial/generalization proving context. Neither changes capability status.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Implemented | Available in the current platform within the stated bounds; does not imply a complete customer-facing editor or production readiness. |
| Core planned | Part of the intended core product; not a claim of current implementation or an immediate delivery commitment. |
| Deferred | An established requirement awaits its implementation trigger; consult the active register for scope and unresolved questions. |
| Optional/later | A candidate capability requiring evidence of value before adoption. |
| Outside scope | Excluded from the managed platform; use an external system where appropriate or decline the requirement. |

[Deferred architecture](deferred-architecture.md) owns active implementation state,
triggers, and unresolved requirements. This catalog owns the intended product
envelope. Listing a planned capability here does not automatically create a
backlog item or satisfy a REQUIRED gate there. Its REQUIRED/DECISION/OPEN/OPTIONAL
classifications serve a different purpose from the capability statuses above.

## 1. Business entity catalog

**Implemented:**

- **Subject:** canonical customer-owned identity and descriptive content, including
  the existing project Subject Type. This is not an implemented Offering domain.
- **Asset:** managed media identity, metadata, ingestion and bounded usage support;
  usage-specific image alt/decorative presentation with Asset defaults. Broader
  lifecycle and management remain deferred. See [Assets](assets.md).
- **Action:** first-class labels and destinations referenced by Sections and
  Navigation, including stable Page UUID targets resolved within the selected
  Managed Site at presentation time. See [Actions](actions.md).
- **Contact Definition:** multiple reusable finite form contracts per Web Presence,
  with versioned acceptance and expiring submissions. This is a bounded foundation,
  not a CRM or public-production activation. See [Contact/forms](contact-forms.md).

**Core planned:**

- **Offering**, with intended structured information:
  - Type: `product | service`.
  - Name.
  - Short description.
  - Substantial/detail description.
  - Status.
  - Primary Asset and additional Assets.
  - Optional grouping/category.
  - Relevant Actions.
  - Structured discovery metadata where justified.
- **Location**.
- **Person / Team Member**.
- **Testimonial**.
- **Business / Contact Identity**.

Offering is intended for lead-generation catalogs, not commerce. These are product
concepts, not a prescribed schema change. Existing Organization/Web Presence
records do not constitute the complete planned Business / Contact Identity
capability.

**Optional/later:** Event; Promotion/offer; a reusable FAQ entity if cross-page
reuse proves valuable; other entity domains only when recurring client
requirements justify them. A promotional offer is distinct from an Offering's
product/service identity.

**Outside scope:** carts, orders, payment transactions, inventory, shipping, and
complex SKU/variant systems. Those belong to external systems/integrations.

## 2. Section capability catalog

| Status | Capability | Scope |
| --- | --- | --- |
| Implemented | Hero | Structured heading, eyebrow, plain text and optional Action. |
| Implemented | Editorial | Current stored type `intro`: stack and text/media split, with controlled semantic presentation variants. Current rendered media support is associated images. |
| Implemented | Collection | Inline editorial items or Subject-backed items; controlled 2/3-column grids. |
| Implemented | CTA | Structured heading, plain text and optional Action. |
| Implemented foundation | Contact | References one reusable Contact Definition, canonical phone/email and an accessible finite form. Public-production submission activation remains gated. |

See [Section presentation](sections.md) for the implemented variants, safe
plain-text paragraphs, validation and finite configuration choices.

**Core planned:**

- Gallery.
- Testimonials.
- Locations.
- Broader Contact experiences beyond the implemented Section, including overlay
  and production lead-form delivery/abuse/retention operations.
- Metrics / Statistics.
- Logo / Client Strip.
- FAQ.
- Team / People.
- Map.
- Process / Timeline.

The existing ubiquitous presentation vocabulary is content width, spacing,
alignment, surface/background role, divider treatment, media fit, and finite
layout variants. Each capability accepts only the applicable choices; for example,
media fit currently applies to Intro images, not collections. Responsive behavior
remains platform-owned.

**Outside scope for the Section model:** arbitrary HTML/CSS, arbitrary nested
columns, custom width percentages, draggable positioning, absolute positioning,
arbitrary per-breakpoint rules, animation builders, arbitrary colors/effects,
and general WYSIWYG/page-builder behavior. Visual choices use the Design System
and controlled semantic roles.

A new Section capability should be added only when it represents a broadly
reusable business/presentation need. A planned FAQ Section does not by itself
require a reusable FAQ entity.

## 3. Page archetype catalog

**Core planned archetypes:** Home, About, Contact, Listing / Index, Detail,
Campaign / Landing, and Flex / Generic.

The current Page/Section foundation, Myomaton Home and active multi-page serving
within an explicitly selected Managed Site are **Implemented**. See
[Managed Site routing](managed-site-routing.md). Myomaton's Home, About, Projects
and Principles are accepted canonical customer state; see the
[secondary Pages transition](myomaton-secondary-pages-v1.md). This does not
implement general archetype automation or production host/domain routing.
Archetypes describe page purpose and sensible composition, not a requirement to
create one of every kind.

The **Flex Page** is an operator/admin escape hatch. It may combine any supported
Section capabilities in a sensible order without normal archetype automation
restricting it. It does not bypass structured content, Section validation, Design
System rules, responsive behavior, or finite capability boundaries. It is not a
free-form page builder.

Common conditional archetypes within the planned envelope are:

- Products / Services Listing.
- Product / Service Detail.
- Projects / Case Studies.
- Project / Case Study Detail.
- Locations.
- Location Detail.
- Team.
- Team / Regional Detail.
- Thank-you / Conversion.

Pages should be created according to known business data and goals rather than
because a template expects them. For example:

- No physical location: no Locations page.
- One location: a Contact/Location section may be sufficient.
- Several meaningful locations: a Locations page and optional detail pages.

No architectural page-count limit exists; Managed Sites remain structurally
multi-page. Product/service quantities are not arbitrarily capped in the intended
product envelope. The platform remains optimized for manageable lead-generation
catalogs rather than giant commerce catalogs. This is not a claim of unbounded
operational capacity or completed production host/domain routing.

## 4. Navigation hierarchy

Normal managed navigation remains shallow. The default is a top-level item with
one child level:

```text
Top-level item
└── one child level

Teams
├── Northeast
├── Southeast
├── Midwest
└── West
```

Avoid deep menu trees unless repeated real-world evidence demonstrates the need.
Navigation may be generated or suggested from Page/entity structure, but remains
explicit canonical customer state. Flex Pages participate in the same navigation
constraints.

Canonical Navigation and parent/child relationships are **Implemented**. The
shallow default is product policy, not a claim that current code enforces exactly
two levels. Generation/suggestion and managed authoring policy are **Core planned**.

## 5. Managed Web Presence vs Content Engine

Classify content by its primary purpose, not merely by length or format.

| Managed Web Presence | Content Engine |
| --- | --- |
| Understand the organization and its products/services. | Publishing, news and ongoing editorial output. |
| Establish trust and evaluate options. | Discovery and SEO/AEO expansion. |
| Convert/contact and find locations/people. | Thought leadership and long-form education. |
| See persuasive projects, testimonials, galleries or proof. | Editorial archive/history. |

**Core planned:** a minimal native Article/Update publishing capability: title,
slug, featured image, excerpt/summary, publish state/date, optional author, one
coherent constrained rich-text body, standard listing/archive and article
presentation, internal analytics, and SEO/discovery metadata when that capability
exists. The body is similar in spirit to the classic WordPress editor; it is not
arbitrary Section composition or a Gutenberg/Divi-style builder. General design
and rendering capabilities may be reused without changing that boundary.

Articles can carry much of the ongoing discovery/content optimization work, with
deliberate internal links into conversion-oriented Managed Site Pages.
**Optional/later:** WordPress or another external Content Engine for publishing
needs beyond the native capability. Neither is a baseline dependency.
This supersedes the earlier decision naming WordPress as the initial provider;
the provider boundary and canonical-state/approval safeguards remain. Concrete
publishing and integration requirements are **Deferred** at register triggers.
Editorial archive/history does not imply indefinite retention of platform
revisions, logs or backups; the register's retention constraints still apply.

The Content Engine must not become a dumping ground for capabilities inconvenient
to implement in the managed presence. A reusable business-presence need should
be evaluated on its product value, even when it requires a new capability.

## 6. Adoption modes

**Core planned** support includes:

- **Full Presence:** the organization's primary managed web presence.
- **Adjunct:** a managed presence complementing an existing website or system.
- **Campaign:** a focused presence serving a particular campaign or conversion goal.

These are deployment/adoption modes, not separate architectures. They share
structured customer state, supported capabilities and the same product boundaries;
listing the modes does not claim their deployment workflows are complete.

“Keep what you have” means coexistence/integration, not ingestion, reconstruction
or migration of an existing Web Presence into the Managed Site model. A Managed
Site may become the conversion-focused face/front-end while an existing site,
Content Engine or infrastructure remains in place. Initially this is an
operator-assisted/custom integration mode: URL ownership, routing, SEO/canonical
behavior, forms and analytics need explicit coordination. Standardize only when
repeatable patterns justify it. Full Presence and Campaign are the easier modes
to standardize, not claims of already completed deployment workflows.

## 7. Capability-growth rule

For a client request:

1. **Existing capability:** use it.
2. **Reusable new capability:** add it only if it represents a recurring, valuable
   need consistent with the product mission.
3. **Flex Page:** use existing capabilities in an unusual combination when normal
   Page archetypes are too restrictive.
4. **Native Content Engine / external system:** use when the requirement is fundamentally
   publishing-heavy, operational, transactional, or outside the Web Presence
   mission. Simple publishing fits native Articles; heavier publishing may justify
   an external Content Engine. Other systems own operational and transactional behavior.
5. **Outside product fit:** some requirements, particularly exhaustive pixel-level
   design control, may simply be incompatible with the service.

## 8. Product design principle

The platform is first a lead-generation/business-outcome system. Design supports
clarity, trust, usability, accessibility, performance, discovery, conversion, and
appropriate visual quality. It is not intended for clients requiring exhaustive
pixel-perfect art direction.

Design quality is part of product value, onboarding, acquisition, customer
confidence and retention. Sites should feel authored and intentional through a
finite curated vocabulary. **Implemented foundation:** [Visual Direction](visual-direction.md)
combines shared Design System primitives into bounded profiles and semantic
preferences, with platform-owned accessibility, responsive behavior and motion
ceilings. It is not an unlimited theme system, CSS editor or bespoke design service.
Two generic versioned runtime profiles support opt-in semantic presentation and
bounded Page-level motion. Customer visual selection/editing and icon expansion
remain planned. Myomaton is stored as reference v2 following its applied and
verified [guarded customer transition](myomaton-visual-direction-v2.md). Reusable reference-v2
capabilities are implemented and human visually accepted for checkpoint purposes;
the accepted customer presentation is now canonical development state.

[Reference v2](visual-direction.md#reference-v2-expression-contract) implements
explicit bounded Editorial statement treatment with readability fallback, six
finite compositions, responsive hierarchy/rhythm/wrapping, primary/supporting
Actions, readable primary/secondary accents and one reserved staged Hero event.
Peer collections remain equal. Clean image presentation and the accessible mobile
Navigation panel are shared behavior. Primitive palette values and disposable
Page/Section/Action/image selections remain customer choices, not profile defaults.
Customer self-service, broad icons, split-media Heroes and real testimonial/proof
semantics remain separate planned capabilities. No proof domain is invented by the
visual system. Applying a new customer profile/version requires its own authorization.

## 9. Production readiness track

Launching Myomaton should drive the following from theory into implementation
and operational verification:

- Hosting/deployment.
- Persistent managed Asset storage.
- Custom domains, DNS and SSL.
- Host -> Web Presence / Managed Site resolution.
- Forms/submission handling.
- SMTP/outbound email.
- Email deliverability/sender-domain setup.
- Spam protection.
- First-party analytics/conversion measurement, independent of optional GA4/Search Console integration.
- SEO metadata.
- Sitemap/robots/canonical URLs.
- Structured data.
- Redirects.
- Accessibility verification.
- Security headers.
- Secrets management.
- Error logging.
- Monitoring.
- Health/uptime checks.
- Privacy/cookie requirements where applicable.
- Backup/retention behavior.

This is a **Core planned** production-readiness track, with established
requirements **Deferred** where the active register already defines triggers.
Existing pieces, such as local managed storage and media-response security
headers, do not establish production readiness for the whole platform. Stage
these concerns through [deferred architecture](deferred-architecture.md) as their
triggers become real; reuse existing entries such as A3, P4, P7 and P9 rather than
duplicating them. This list alone neither opens new backlog items nor declares
every item a blocker for every deployment mode.

## 10. Workflow linkage

Before each implementation slice:

1. Check this capability catalog.
2. Check [deferred architecture](deferred-architecture.md).
3. Determine whether an existing REQUIRED trigger has been reached.
4. Determine whether the client need fits an existing capability.
5. If not, decide whether it justifies a reusable new capability, Flex Page
   composition, Content Engine/external handling, or exclusion from product scope.
6. Update both documents only when product envelope or implementation state
   genuinely changes, keeping each document's responsibility distinct.

The catalog is not an implementation plan, schema specification, or completion
log. The active register remains the place to record concrete triggers and
unresolved implementation requirements.

## 11. Managed Site global capabilities

**Implemented foundation:** Web Presence-owned public display name, phone/email
and bounded social destinations; AssetUsage-backed logo read/delivery with name
fallback; controlled responsive Header/Footer; existing Primary and optional
separate Utility Navigation; optional configured Header Action and generated
copyright. See [site globals](site-globals.md). No customer-state writer or editor
is included; the full Business / Contact Identity domain remains planned.

**Core planned beyond this foundation:** a bounded site-wide layer above Pages/Sections for branding/logo,
Header, Footer, primary and utility Navigation, a shared Contact experience,
social profiles, Search where useful, site-wide conversion behavior and
analytics/integration configuration. Existing canonical Navigation is implemented;
this list does not claim a complete global capability layer or its authoring UI.

Header/Footer are controlled semantic capabilities, not arbitrary builders.
Logo belongs in structured onboarding/business data with a sensible business-name
fallback when absent. Search is conditional on usefulness and content scale.
Shared canonical contact information should support a Contact Page, Contact
Section, overlay/drawer/modal experience and clickable phone/email Actions without
duplicating global facts in each presentation.

## 12. Onboarding, measurement and optimization

**Core planned:** conditional guided onboarding, ongoing direct updates to global
business knowledge, canonical first-party analytics and a continuous
measure → analyze → recommend → approve/implement → measure-again loop.
Operator-assisted intake can support initial production sales before full
customer self-service automation. GA4 and Google Search Console are optional
structured integrations, never dependencies of measurement or optimization.

AI/API assistance belongs behind a provider-neutral intelligence boundary for
intake interpretation, analytics summaries, opportunity detection, content/Article
recommendations and drafting, metadata, internal links and controlled proposals.
Approval is first-class customer/service policy and can vary by operation.
Canonical business facts must never be autonomously invented or silently changed.
See the [operating model](onboarding-optimization.md) for protected facts, event
scope, approval examples and the native publishing workflow. None of these
planned workflows is claimed as implemented by current operator tooling.

## 13. Bounded platform/service policy

**Core planned:** validated operational/product settings with conceptual layers
of platform default, operator/service policy, and Web Presence / Managed Site
override where allowed. Distinguish a capability from its current recommendation,
default, soft maximum or enforced limit. Avoid arbitrary hard limits unless
technology, economics, safety/abuse or service constraints justify them.

Examples include Gallery recommended item count/soft maximum, upload limits,
Navigation depth, Search policy, managed-video availability, revision retention,
client Flex Page access and automation/approval defaults. These are not arbitrary
CSS/design controls. A minimal typed precedence foundation is implemented for
the social-link capability flag with trusted service-level override permissions;
see [site policy](site-globals.md#bounded-platform-policy). The broader policy
settings and UI are not implemented; current code
limits (such as managed-object size limits) still apply. Allowed overrides must
respect enforced safety/service boundaries and protected business truth.

## 14. Ownership and operating principles

Customer ownership, usable export and easy exit/no lock-in remain product
principles, subject to explicit retention and offboarding policies. Export is
still gated by P5, not claimed as implemented. Full Presence, Adjunct and Campaign
share the same architecture; Customer 0 and Myomaton Customer #1 are proving
contexts, not separate product architectures.

Measure infrastructure and AI usage per customer. Human service minutes per
customer are a critical scalability metric, alongside business outcomes. Guided
operator-assisted onboarding allows selling before complete self-service.
Final pricing, 90-day promotion terms, Kickstarter plans and revenue forecasts
remain business/marketing experiments, not architectural requirements.

## Reusable v2 composition refinement

Implemented and accepted for the reusable checkpoint: six type-specific semantic compositions,
explicit statement-break with separate readable support, structural contrast and
secondary editorial surfaces, and initial-style staged Hero entrance. See the
[finite contract](visual-direction.md#finite-semantic-compositions). The disposable
operator presentation file uses existing structured content and palette primitives;
no customer-specific CSS, schema, arbitrary canvas or state transition is added.
The specific Myomaton v2 transition is applied and verified in development;
its customer choices remain separate from reusable profile defaults.
