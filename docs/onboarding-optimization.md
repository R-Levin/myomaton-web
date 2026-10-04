# Onboarding, measurement and continuous optimization

This is the intended operating model, **Core planned** unless an implemented
boundary is explicitly identified. It adds no runtime capability. The
[capability catalog](platform-capabilities.md) owns the product envelope;
[deferred architecture](deferred-architecture.md) owns implementation gates.

## Canonical knowledge comes first

The Web Presence is a managed traffic/lead-generation system. Its Managed Site
is the public conversion-focused surface / tip of the funnel. Structured business
knowledge is reusable canonical customer state; Pages, Sections, global Contact
and other presentations consume it instead of maintaining separate global facts.

The normal flow is guided interview/business knowledge → structured interpretation
→ customer/operator review under policy → canonical state → appropriate Managed
Site capabilities and native publishing. The existing PostgreSQL authority and
[initialization-only bootstrap boundary](bootstrap.md) already apply. Myomaton's
source-controlled transitions are historical tooling, not ongoing authority.

## Guided onboarding and ongoing updates

Onboarding is a core product function that should be both easy and complete.
Initial production can use operator-assisted guided intake; sales need not wait
for fully automated customer self-service. Questions are conditional on business
type, known answers and goals, rather than a mandatory form for every capability.

The interview builds structured knowledge covering:

- Business identity, audiences and goals.
- Contact methods, locations and service areas.
- Offerings and availability.
- Projects, proof and testimonials.
- Branding/logo, Assets and social profiles.
- Conversion goals and appropriate Pages/capabilities.

Unknown facts remain unknown or return for clarification. AI interpretation may
structure and suggest, but does not establish truth by inference. Review confirms
the relevant facts and proposals before canonical writes according to policy.
After onboarding, customers must be able to update global business information
directly without repeating the interview or editing every consuming Page.
Authenticated, authorized editing, validation, provenance and publication effects
must be designed at the existing P1/P2/P3/P7 gates; they are not currently complete.

The [Contact foundation](contact-forms.md) adds reusable finite definitions and
private, expiring submissions. Inquiry fields are visitor input, not automatically
canonical business truth. Its accepted-submission hook is not the analytics
collection/reporting system described below.

## Canonical first-party measurement

First-party/internal analytics is the canonical product measurement system.
Collection, reporting and optimization must work without GA4 or Google Search
Console. Those services may be supported through structured integration
configuration for compatibility/customer preference; their presence must not
determine whether the platform can measure its own conversion outcomes.

The intended useful event scope includes page views, CTA clicks, phone/email
clicks, contact opens, form starts/submissions, source/referrer/landing page,
appropriate engagement signals and eventual lead/outcome feedback where available.
Click, submission and business outcome are different signals; do not imply that
a click is a qualified lead or that attribution proves causality.

Before production collection, define event semantics and ownership, tenant/site
scope, consent/privacy requirements, data minimization, access and bounded
retention. First-party collection does not remove those obligations. This document
does not prescribe persistent visitor tracking, a vendor or an analytics schema.

## Continuous optimization and intelligence boundary

Optimization is core product behavior:

```text
measure → analyze → recommend → approve/implement → measure again
```

Recommendations should identify the evidence, intended outcome, proposed change
and affected canonical records. Implementation must respect current state,
authorization, approval policy and bounded provenance; subsequent measurement
evaluates the result rather than assuming every recommendation improves it.

AI/API assistance belongs behind a clean intelligence/provider boundary. Potential
uses include onboarding interpretation, analytics summaries, opportunity
detection, content recommendations, Article drafting/improvement, metadata,
internal-link recommendations and controlled optimization proposals. No provider,
including OpenAI, is a domain or architecture dependency. Domain state and approval
decisions belong to the platform, not provider conversation history. Provider data
access, usage/cost attribution and failure handling need explicit treatment when
the first integration is introduced; no provider framework is implemented here.

## Business truth and approval policy

Optimization must never autonomously invent or silently alter canonical facts:
phone/address, location, staff identity/title, service availability, pricing/offers,
credentials or other factual business state. Trusted/customer input establishes
truth according to policy. Recommendations may propose better presentation around
facts or ask for a factual correction; a model's suggestion is not confirmation.

Approval is first-class customer/service policy, potentially different for each
operation. Conceptual levels are “review everything,” “selective automation” and
“managed automatic”; the names and eventual UI are not fixed. Even managed
automatic operation cannot authorize fabricated facts or bypass explicit approval
for pricing/offers.

| Operation | Intended policy boundary |
| --- | --- |
| Article draft | May be generated automatically; publication is a separate decision and may require approval. |
| Metadata | Candidate for automatic handling when authorized; factual assertions still require trusted support. |
| Internal links | Candidate for automatic handling under policy and valid destination checks. |
| Managed Site copy | Generally approval; factual edits retain the stricter truth boundary. |
| Navigation | Approval. |
| Canonical business facts | Never autonomously invented/changed; trusted/customer input is required. |
| Pricing/offers | Explicit approval and trusted factual input. |

Policies need explicit scope, allowed operations and enforcement before automated
changes. Broad automation settings cannot override narrower protected operations.
Preview/approval, stale-state conflict handling and bounded revision/provenance
apply at the relevant editing/publishing gates; current `active` Page state is
not a draft/publish implementation.

## Native Articles and optional external engines

The baseline intended publishing capability is a minimal native Article/Update:
title, slug, featured image, excerpt/summary, publish state/date, optional author,
and one coherent constrained rich-text body, similar in spirit to the classic
WordPress editor. Include standard listing/archive and article presentation,
internal analytics and SEO/discovery metadata when its contract exists.

Article bodies are not arbitrary Section compositions. They deliberately avoid
Gutenberg/Divi-style layout building. General design/rendering capabilities may be
shared, while the body stays constrained and safely rendered. Before publishing,
define the body validation/sanitization contract, publication eligibility, routing
and URL ownership, Asset usages and approval behavior. Existing plain-text Section
behavior is unchanged; no rich-text format or editor is selected by this decision.

Much ongoing discovery/content optimization may occur through Articles, with
deliberate internal links into Managed Site conversion Pages. Persuasive business
content still belongs in the Managed Site when that is its purpose. Native
publishing must not become a workaround for a missing reusable site capability.

WordPress or another external Content Engine is optional/heavier integration when
publishing requirements exceed native Articles. This explicitly supersedes the
earlier WordPress-first provider decision. Preserve a provider boundary and a
canonical platform copy of platform-managed content. Existing external/unmanaged
content can remain external; integrating it does not imply ingesting it. If direct
external editing is possible, detect/reconcile divergence rather than overwrite
it. External engines are not dumping grounds for missing Managed Site features.

## Coexistence and service operations

“Keep what you have” is coexistence/integration, not ingestion, reconstruction or
migration of an existing Web Presence into the Managed Site model. The Managed
Site can be the conversion-focused face/front-end while existing content engines,
sites or infrastructure remain where appropriate. Initially treat this as
operator-assisted/custom integration. Explicitly establish URL ownership, routing,
canonical/SEO behavior, forms and analytics responsibilities for each deployment;
standardize only when repeated patterns justify it. Full Presence and Campaign
are easier standardization paths, within the same architecture as Adjunct.

The catalog's bounded global capabilities and platform/service policy support
these workflows: shared Contact and business identity, controlled Header/Footer,
branding, Navigation and conditional Search; platform defaults, operator/service
policy and permitted presence/site overrides. These are operational controls,
not arbitrary design controls or permission to bypass factual/approval safeguards.

Preserve customer ownership, usable export and easy exit. Measure infrastructure
and AI usage per customer, and human service minutes per customer as a critical
scalability metric. Customer 0 is the product's own intended Web Presence;
Myomaton remains Customer #1/proving ground. Guided service can precede self-service.
Pricing, promotions, crowdfunding and revenue forecasts are experiments, not
platform invariants.
