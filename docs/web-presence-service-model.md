# Web Presence service model

## Core service

The Web Presence service captures what an organization knows about its business
and what its customers need, turns that knowledge into a professionally presented
public presence, and continuously improves that presence through content,
measurement and guided optimization.

The service is a managed business outcome. Website/page building, bespoke agency
labor, hosting resale and autonomous AI content generation do not define the
product. Customers should be able to concentrate on their business while retaining
authority over its facts, claims and publication decisions.

This is the reusable model, independent of the prospective commercial brand or
hosting provider. The [MioPages C0 model](miopages-c0-product-model.md) is one
commercial/proving application. [Platform capabilities](platform-capabilities.md)
owns the product envelope and current capability status;
[deferred architecture](deferred-architecture.md) owns implementation gates.
This document defines intent, not a completed launch offer or a service-level guarantee.

The [MioPages Launch/Ongoing deliverable summary](miopages-c0-product-model.md#launch-and-ongoing-customer-deliverable-summary)
is the C0/commercial expression of this reusable service, preserved as guidance
for later product-detail and marketing work rather than final public copy or terms.

The [Launch and Ongoing operations model](service-operations-model.md) owns supported
Launch envelopes, continuous handoff, cadence, attention routing, responsibility
and non-canonical service-time hypotheses. It does not expand implemented scope.

## Launch-stage customer outcome

The likely launch offer combines the following, conditional on customer need and
implemented/operational readiness:

| Service element | Intended customer result and current boundary |
| --- | --- |
| Structured onboarding and trusted knowledge | Confirm business facts, audience, goals and customer questions. Guided intake and general authorized updates are planned core. |
| Professional Managed Site | Explain the business through supported Pages, Sections, Navigation, Design System and Visual Direction. Rendering foundations exist; repeatable customer delivery and production deployment are distinct work. |
| Core service/product information | Help prospects understand relevant offerings and proof. Existing Subjects/content are usable within bounds; a general Offering/Testimonial domain is planned, not implied. |
| Contact / lead path | Provide appropriate valid Actions and canonical contact methods. Contact has a bounded development foundation; production forms/delivery remain gated. |
| Hosting/deployment and ongoing operation | Coordinate managed hosting where applicable, maintenance, media durability and recovery. Production readiness is not established merely by a working development site. |
| Analytics/search configuration | Useful first-party measurement and appropriate discovery configuration; optional GA4/Search Console where supported. Analytics and full discovery contracts remain planned. |
| External-presence inventory | Understand relevant public profiles, links and ownership/status. Bounded social-link presentation exists; richer inventory/integrations are planned. |
| Initial content foundation | Appropriate conversion content and, when implemented, native Articles supporting discovery. Native Article/review/publish workflows are planned core. |

Do not sell an unbuilt integration as available. State the actual supported scope
and operational responsibilities for each launch deployment. Full Presence,
Adjunct and Campaign share the same architecture; coexistence requires explicit
URL ownership, forms and analytics coordination, not automatic import of an
existing website. The [operating model](onboarding-optimization.md) owns these details.

## Ongoing service and value

Ongoing work may include a small set of content opportunities, targeted customer
questions, AI-assisted drafting, human approval, publication, measurement,
optimization and understandable reporting. Business/service updates and conversion
improvements keep the presence useful as the organization changes. Maintenance and
operation support continuity; future channel support can extend the service.

The [content-growth loop](content-growth-loop.md) owns the detailed lifecycle,
canonical ownership, quality checks and distribution boundaries. Reference that
contract rather than invent a second editorial workflow. Initial externally
published AI-assisted/generated content requires human review/approval. Operator
assistance can precede self-service without relaxing authorization or business truth.

Retention comes from ongoing useful work and evidence of learning/improvement,
not dependence on a control panel or inaccessible data. Reporting should explain
what changed, why, what was observed and the next useful action. Do not equate
activity volume with value or promise guaranteed traffic, rankings or revenue.

## Wider presence and content distribution

A customer's public presence extends beyond the Managed Site: Google Business
Profile, LinkedIn, X, Facebook, Instagram, YouTube, directories/listings and other
relevant channels. Initial support can inventory them, record public links and
their roles, offer setup guidance/checklists, help maintain factual consistency
and measure attributable referral where practical. Account ownership, verification
and publishing access must be distinguished from public-link existence.

Direct management of every external service is outside the initial commitment.
Difficult verification, permissions and external onboarding should not block
the core service. Add managed integrations only when recurring value and operational
feasibility justify them. Refer to [external presence boundaries](content-growth-loop.md#external-presence-without-mandatory-management).

The long-term model is:

```text
canonical customer/business knowledge → canonical substantial content
→ channel-specific derivatives → distribution
→ referral/engagement measurement → optimization feedback
```

The website/native content engine is the canonical substantial-content source;
when an optional external engine is used, the platform retains canonical managed
content. Social outputs adapt presentation without changing facts or becoming the
only home of important knowledge. Automated social publishing is a future extension
unless separately implemented. Detailed derivative approval and attribution remain
in the [growth contract](content-growth-loop.md#distribution-and-deterministic-links).

## Useful measurement, explicit uncertainty

Use first-party analytics, deterministic campaign identifiers, referrals, search,
configured Search Console/GA4, Contact submissions, phone/email Actions, social
referrals, content performance and identifiable AI-assistant/referral traffic as
available. First-party measurement must not depend on optional external providers.

Unknown or likely attribution stays explicitly uncertain. A click is not a
qualified lead, and correlation is not proof of causal improvement. The objective
is useful decision support, not a giant marketing analytics suite or perfect
cross-channel attribution. The [measurement architecture](measurement-and-analytics.md)
defines the independent core plus preferred optional GA4/Search Console intelligence,
normalized signals and degraded-mode reporting. P12 governs collection/ingestion;
service-account onboarding is unproven and GBP reporting remains future optional scope.

## 20i and infrastructure boundary

20i is a provisional likely infrastructure option because of the existing reseller
relationship, not a platform dependency. Potential leverage to evaluate includes
hosting, domains, email, DNS, backups, customer/package provisioning, billing/account
infrastructure, reseller API and possibly portal/account functions. This is a
candidate integration inventory, not a verified entitlement, API contract or claim
that each function is implemented or suitable for this service.

The Web Presence platform should own the primary product/customer experience:
onboarding, business knowledge, content, Visual Direction, recommendations,
optimization, approvals, reporting, presence inventory and business-level service
status. Infrastructure/account operations can use provider facilities without
turning the hosting panel into the conceptual product model.

Keep this allocation provisional pending deeper portal/integration review. Establish
source-of-truth and responsibility boundaries for accounts, provisioning, billing,
credentials and status before connecting them; avoid competing customer authorities
or assuming an infrastructure login grants content-management access. Hosting
providers remain replaceable behind supported deployment/operational boundaries.
20i is leverage, not product identity. [Security and operations](security-operations.md)
owns secrets, least privilege, recovery and infrastructure obligations.

## Customer ownership and understandable exit

Customers retain ownership of business knowledge, customer-provided content and IP,
domains where applicable, portable data/exports and appropriate account ownership
and credentials. Coordinate access securely; credentials must not be exposed in
public state or handed around as routine content. Third-party licenses and provider
terms still apply; ownership is not a promise to transfer assets the customer does
not own.

Support an understandable exit path: what can be exported, what account/domain
control the customer retains, how services transfer or cease, and applicable
retention/deletion. Export is an existing product commitment gated by P5/P6, not an
implemented feature asserted here. Maintain separable customer state and Asset bytes
so exit remains achievable. Infrastructure dependence is not a retention strategy;
backup, usable export and permanent archive remain distinct concepts.

## Responsibility split

| Party | Intended responsibility |
| --- | --- |
| Customer / business authority | Provides business truth, answers targeted questions, reviews important content, approves publication and owns final business claims. |
| Operator / platform service | Organizes and presents knowledge; recommends, drafts, measures, maintains, optimizes and coordinates supporting technical services within authorized scope. Human operators retain responsibility for service operations. |
| AI/system assistance | Provides synthesis, structure, pattern identification, drafting and coordination leverage; has no independent approval authority or business responsibility. |

Reduce customer workload without removing customer authority. Preserve important
state and approvals in reviewable platform records rather than human memory or
provider conversation history. Knowledge changes, publishing and external account
operations require their appropriate permission and current-state checks. Contact
input is visitor input, not automatically confirmed business truth.

## Initial fit and non-fit

Good-fit organizations want a managed outcome, have real business knowledge but
limited web-management capacity, value measurable improvement and accept curated
bounded design. The [MioPages ICP](miopages-c0-product-model.md#initial-customer-hypothesis)
is a useful initial acquisition hypothesis, not an industry or head-count limit
on the reusable service.

Poor fit includes demands for arbitrary HTML/CSS, exhaustive pixel-level control,
continuous bespoke redesign, highly custom application development or a full CRM /
marketing-automation suite in the initial offering. Discuss scope honestly or use
an appropriate external service. Do not promise bespoke exceptions that undermine
the shared platform or treat every request as justification for a new capability.

## Durable product principles

These are product principles, not finished marketing slogans:

- Web presence extends beyond the website; business knowledge precedes page building.
- Design serves outcomes: purposeful, professional, conversion-aware quality.
- Spend effort where it produces value; customers approve outcomes rather than pixel mechanics.
- Launch is the beginning; earn continued service through useful work.
- Measure before guessing, and retain uncertainty when evidence is weak.
- Recommend understandable next actions rather than overwhelm customers with dashboards.
- Human approval retains business authority; AI provides leverage, not autonomous responsibility.
- Bounded does not mean visually conservative; use reusable semantic capabilities, not a free-form builder.
- Customer ownership and understandable exit matter; no lock-in as a retention strategy.
- Expand external-channel capability progressively rather than promise everything at launch.

## Implementation boundaries and related contracts

- **Implemented now:** the current structured customer-state and presentation
  foundations cataloged in [platform capabilities](platform-capabilities.md),
  including [Visual Direction](visual-direction.md), [site globals](site-globals.md)
  and the bounded [Contact foundation](contact-forms.md). A development proof is
  not blanket production readiness.
- **Planned core / pre-launch:** repeatable onboarding and trusted knowledge updates,
  production delivery/operation, first-party measurement, bounded native publishing,
  approvals and understandable content/optimization workflows. Apply the existing
  [register gates](deferred-architecture.md) at their triggers.
- **Future value-add/extensions:** automated social distribution, managed external
  profiles, richer cross-channel reports and additional channels. Provider-specific
  work is not implemented simply because it is conceptually supported.

The [onboarding operating model](onboarding-optimization.md) owns detailed intake,
policy and coexistence; the [growth loop](content-growth-loop.md) owns content and
optimization flow; [security and operations](security-operations.md) owns access,
privacy and recoverability. Packaging, price, service levels and contractual terms
remain separate commercial decisions. This model adds no runtime feature, customer
record, provider connection or operational authorization.
