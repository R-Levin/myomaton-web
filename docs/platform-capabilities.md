# Web Presence platform capabilities

## Purpose

This document defines the intended capability envelope of the managed Web Presence
platform: a data-driven lead-generation and business-presence system, not a
free-form page builder or general-purpose CMS.

The platform aims to:

- Turn structured business knowledge into an effective web presence.
- Support full-presence, adjunct, and campaign deployments.
- Provide flexibility for real client needs without accumulating one-off
  site-builder complexity.
- Favor controlled semantic choices and platform-owned responsive behavior.
- Keep customer/business state structured, reusable, and manageable as a service.

Myomaton is Customer #1 and the proving ground for these capabilities. Its content
is canonical customer state, not a permanent platform template. See the
[customer-state and bootstrap boundaries](bootstrap.md).

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
  broader lifecycle and management remain deferred. See [Assets](assets.md).
- **Action:** first-class labels and destinations referenced by Sections and
  Navigation.

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

See [Section presentation](sections.md) for the implemented variants, safe
plain-text paragraphs, validation and finite configuration choices.

**Core planned:**

- Gallery.
- Testimonials.
- Locations.
- Contact Information.
- Lead / Contact Form.
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

The current Page/Section foundation and Myomaton Home are **Implemented**. The
archetype catalog, automated composition and general multi-page delivery are not
therefore implemented. Archetypes describe page purpose and sensible composition,
not a requirement to create one of every kind.

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

No architectural page-count limit exists; Microsites remain structurally
multi-page. Product/service quantities are not arbitrarily capped in the intended
product envelope. The platform remains optimized for manageable lead-generation
catalogs rather than giant commerce catalogs. This is not a claim of unbounded
operational capacity or completed multi-page routing.

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

WordPress is the initial Content Engine provider, not a platform assumption.
Content Engine integration and its canonical-state, editing and publishing
requirements are **Deferred** at the triggers in the architecture register.
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

## 7. Capability-growth rule

For a client request:

1. **Existing capability:** use it.
2. **Reusable new capability:** add it only if it represents a recurring, valuable
   need consistent with the product mission.
3. **Flex Page:** use existing capabilities in an unusual combination when normal
   Page archetypes are too restrictive.
4. **Content Engine / external system:** use when the requirement is fundamentally
   publishing-heavy, operational, transactional, or outside the Web Presence
   mission. Publishing fits the Content Engine; other systems own operational
   and transactional behavior.
5. **Outside product fit:** some requirements, particularly exhaustive pixel-level
   design control, may simply be incompatible with the service.

## 8. Product design principle

The platform is first a lead-generation/business-outcome system. Design supports
clarity, trust, usability, accessibility, performance, discovery, conversion, and
appropriate visual quality. It is not intended for clients requiring exhaustive
pixel-perfect art direction.

## 9. Production readiness track

Launching Myomaton should drive the following from theory into implementation
and operational verification:

- Hosting/deployment.
- Persistent managed Asset storage.
- Custom domains, DNS and SSL.
- Host -> Web Presence resolution.
- Forms/submission handling.
- SMTP/outbound email.
- Email deliverability/sender-domain setup.
- Spam protection.
- Analytics/conversion measurement.
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
