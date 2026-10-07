# MioPages C0 implementation plan

## Status and authority

**READY TO BEGIN C0 IMPLEMENTATION.** This is the approved development handoff
from [C0 discovery](miopages-c0-business-brief.md) into implementation. It preserves
the IA, customer journeys, content model, capability mapping, conversion model,
Review/onboarding contracts, Visual Direction inputs, gaps and phased roadmap.

It is not final marketing copy, customer-state authorization, permission to
publish MioPages or commercial-launch authorization. It does not create a dataset
or authorize Phase 1 implementation. Discovery remains closed unless a genuine
contradiction or missing business fact is exposed.

Implementation findings reflect repository checkpoint `277c094`. The
[capability catalog](platform-capabilities.md) and
[deferred register](deferred-architecture.md) own detailed capability and gate
contracts; this handoff does not close those gates.

## Proposed public information architecture

Use four essential public Pages. Pricing, process and service boundaries should
be understandable together rather than scattered across agency-style Pages.

| Page | Purpose / audience question | Primary Action | Secondary Action | Content responsibilities |
| --- | --- | --- | --- | --- |
| Home `/` | Is this for a business like mine? | Request Web Presence Review | Understand the service | Managed-presence proposition, fit, outcomes, credible proof preview, Launch-to-Ongoing continuity and pricing signpost. |
| Service `/service` | What do I receive, what does it cost and how does it work? | Request Review | Start intake when available | Standard Launch, Expanded boundary, Ongoing, public pricing, process, responsibilities, bounded integrations, ownership/exit, selected FAQs and exclusions. |
| Experience `/experience` | What experience and evidence support this? | Request Review | Understand the service | Verified historical snapshots; distinguish operator experience from new-platform proof; accurately describe Myomaton/C0 proving work. Publication requires verified evidence and permissions. |
| Review `/review` | What will the Review provide and how do I request it? | Submit Review request | Start a conversation | Review scope, required information, provisional turnaround, fit assessment, continuation options, privacy and contact context. A working request path requires operational capability. |

Workflow and utility routes have separate responsibilities:

- `/start`: guided intake entry, not another marketing Page or a DIY builder.
  Do not promise working self-service before the workflow exists.
- Customer service/private access: later authenticated reports, approvals,
  questions and updates. Secure assisted delivery may bridge limited initial
  needs; public Pages are not a private account area.
- Legacy hosting/account access: verified existing utility destination. Prefer a
  direct link; add an explanatory route only if instructions or multiple
  destinations require it. No forced new-product funnel or automatic migration.
- Privacy/service terms: supporting production routes requiring appropriate review.

Do not initially split out How It Works, Launch + Ongoing, Pricing, About, Contact
or FAQ. Those responsibilities belong in Service and Review unless later evidence
justifies separate Pages. Primary Navigation is Service, Experience and Review;
Home is accessible through brand identity. Legacy access stays in utility Navigation.

## Customer journeys

| Journey | Progression |
| --- | --- |
| Existing-business prospect | Home → Service → Experience if useful → Review → conversation, continued intake or confirmed Launch scope. Review may conclude that MioPages is not a fit. |
| New or starting business | Home or Service → guided intake → synthesis → correction/confirmation → Launch scope. This alternate journey does not broaden the initial established-business ICP; sufficient legitimate business knowledge is still needed. |
| Ongoing customer | Private service access → report, approval or targeted question → action. Do not require re-entry through acquisition. |
| Legacy hosting customer | Utility access → verified existing account/service destination. |

These are customer journeys, not operator/admin workflows.

## Content and entity model

Structure information when identity, reuse, validation or workflow warrants it.
Do not create entities merely because they are imaginable.

| Concept | Conceptual information / reason for structure | Current boundary and timing |
| --- | --- | --- |
| Trusted Business Knowledge | Identity, audience, goals, geography/service area, differentiators, constraints, sources, confirmation and responsible approver. Reusable facts should not drift across Pages. | Shared identity is partial; trusted knowledge/confirmation contract is C0/core work. |
| One Managed Web Presence Offering | Service identity, type, summary/detail, audience, outcomes, scope/exclusions, status, Actions and Assets. | Offering is planned. Existing Subject name/description projection is not a complete Offering contract. |
| Launch/Ongoing components | Purpose, inclusions, boundaries, timing guidance and commercial relationship; Expanded means supported complexity. | Initially render through Sections. Separate package entities are not automatically justified. |
| Pricing terms | Approved amount, currency, one-time/recurring basis, status/effectivity, scope and disclosed third-party costs. Complexity increments only once defined. | Minimal reusable contract needed; no checkout or commerce pricing engine required. |
| Experience/proof provenance | Context, verified contribution, historical date/version, permitted imagery, permission status, demonstrated capability and substantiated results; historical/new-platform distinction. | Existing Sections/Assets can present evidence. Structured provenance is needed, but a dedicated entity/renderer is not automatically a C0 prerequisite. |
| External Presence inventory | Provider, public URL, handle, status, ownership/verification context and available publishing/measurement support. | Public social links cover only a subset; inventory is planned core. |
| Review/intake request | Prospect facts, sources, questions, synthesis, fit/scope proposal, status and continuation. | New workflow state; Contact submission alone is insufficient. |
| Opportunity/draft/approval | Prioritized opportunity, trusted supporting facts, grounded draft, reviewed version, approval scope and publication relationship. | Planned Ongoing/content-growth capability. |
| Lead/customer outcome | Lead reference, confirmed result, confirmation source/date and explicit unknown state. | Planned operational state, not public content. |

FAQ can remain Page-owned question/answer content. A Testimonial entity is not a
C0 dependency without genuine endorsements. Service functions can remain content;
operator roles and permissions are operational state. Supported Integration records
should exist only for genuinely supported integrations, not hypothetical connectors.

Page explanations belong in Sections; shared identity belongs in Web Presence
facts; labels/destinations belong in Actions. Private requests, approvals, reports
and outcomes must not become publicly active Pages or generic Subjects.
**Flexible JSON storage is not a validated reusable domain contract.**

## Page and Section capability mapping

The existing presentation vocabulary is sufficient for the proposed public site.
No bespoke composition, arbitrary grid or page builder is required.

| Page | Conceptual archetype | Existing Section capability | Remaining representation gap |
| --- | --- | --- | --- |
| Home | Home | Hero, editorial explanation, grouped benefits, image evidence, selective statement and conversion CTA. | Canonical Offering/fact reuse. |
| Service | Flex / service detail | Hero, compact editorial regions, grouped component information, Page-owned FAQ and conversion band. | Offering/pricing projection; recipe automation is not required for reviewed assembly. |
| Experience | Listing with editorial evidence | Intro text/media, AssetUsage imagery, inline or Subject-backed collections and CTA. | Full proof provenance is not in current Subject cards; they expose name/description, not per-item imagery or evidence fields. |
| Review | Campaign / Contact | Hero, explanation, expectations, Contact Section and Actions. | Typed intake, assessment and response workflow. |
| Start | Guided workflow | Existing presentation can explain the process. | Persistent progressive intake and synthesis are not Section rendering capabilities. |

Existing finite semantic compositions are `asymmetric-field`, `editorial-row`,
`statement-break`, `image-evidence`, `grouped-field` and `conversion-band`.
Statement meaning requires explicit semantic selection. Manual reviewed Page
assembly can precede automatic recipes; conceptual archetypes do not imply an
implemented archetype engine. See [Sections](sections.md) and
[Visual Direction](visual-direction.md).

## Action and conversion model

Current Actions resolve scoped Page UUID destinations, safe internal/external
links and local Section anchors. They do not implement destination workflows.

| Intended Action | Representation and boundary |
| --- | --- |
| Request Web Presence Review | Internal Review Page Action; structured submission/processing still required. |
| Start a Conversation | Internal Contact/path Action or verified external scheduling link; production delivery/integration must be proven. |
| Start Self-Service Intake | Page/path entry once implemented; no intake workflow currently exists. |
| Proceed with Standard Launch | Scoped confirmation of reviewed scope and commercial terms, not a generic public buy link. |
| Request Expanded Launch confirmation | Review complexity and confirm fixed scope/price; not automated custom quoting. |
| Legacy account access | Verified safe external destination in utility Navigation. |
| Email / phone | Canonical shared identity projects `mailto:`/`tel:` links; these schemes are not ordinary Action destinations. Click measurement is missing. |

Initial conversion priority is **Review request → conversation or intake →
confirmed Launch scope**. A click is not a completed Review, qualified lead or sale.

## Web Presence Review model

| Stage | Minimum durable information |
| --- | --- |
| Input | Name/contact, business identity, website/domain where present, current problem/desired outcome and consequential constraints where relevant. |
| Discovery | Public site/profile references, observations, source/date/provenance; public visibility does not prove ownership or accuracy. |
| Synthesis | What is understood, obstacles, roughly three priorities, likely fit, provisional Standard/Expanded classification and material unanswered questions. |
| Output | Concise reviewed response, limitations, continuation options, responsible reviewer and delivered version. |
| Continuation | Conversation, continued intake or Launch confirmation, preserving knowledge/request lineage. |

Existing Contact accepts only name, email, phone, organization and message. There
are no dedicated website, goal or presence-reference fields. Free text can support
an assisted conversation but is not a sufficient structured Review workflow.
Public discovery must not silently become approved business truth.

## Onboarding synthesis contract

| Mode | Examples / authority |
| --- | --- |
| Ask directly | Actual offerings, service area, availability, goals, constraints and account authority: customer/operator is authoritative. |
| Discover then verify | Public presence, content, profiles and apparent accounts: verify accuracy, ownership and permission. |
| Infer then confirm | Audience, IA, content priorities, likely Visual Direction and complexity classification: recommendations remain proposals. |
| Approve | Business brief, claims, scope, commercial terms and publication: approval applies to a particular version and operation. |

Eventually preserve answers, sources, confirmation/confidence state, unresolved
questions, synthesis versions, corrections, responsible identities and approval
records. Keep bounded decision provenance, not an unlimited transcript archive.
Do not require a fixed number of synthesis passes. Progressive enrichment asks
only for the highest-value missing information. See
[onboarding](onboarding-optimization.md).

## Visual Direction input requirements

The next intake needs personality, formality, warmth, commercial confidence,
liked/disliked reference traits and priorities, brand/logo Assets, color constraints,
imagery availability, proof/evidence style, tone/accessibility needs and visual
dislikes. Distinguish explicit intent from provisional defaults.

Customer supplies preference and constraint; AI/operator recommends bounded
implementation. Customers approve outcomes, not composition names, animation
timings, spacing or other mechanics. No final Visual Direction is selected here.

## Implementation gap register

Classes describe actual implementation and dependency, not blanket blockers.
Some areas have an implemented foundation and a separate missing completion.

| Class | Scope and dependency |
| --- | --- |
| **A — implemented / usable now** | Public Page/Section/composition rendering; Action destination model; shallow Navigation; shared identity foundation; structural customer separation. Read scoping is not caller authorization or proven multi-tenant production isolation. |
| **B — configuration / dataset** | Reviewed MioPages Page content/order, Navigation, Assets, Actions and eventual separately authorized C0 dataset. |
| **C — canonical content capability** | Trusted Business Knowledge; minimal Offering; Pricing/service-component contract; appropriate proof provenance. Existing rendering does not supply these validated domain contracts. |
| **C — acquisition / authority workflow** | Typed Review/intake; progressive onboarding; provider-neutral AI proposal boundary; approval/publishing state; Review workflow; minimum customer workflow/access; scoped operator authorization. Needed before the corresponding production or self-service promise. |
| **C — Ongoing value** | Lightweight attention queue/service-time tracking; independent analytics; Action/lead/outcome tracking; concise value reporting; opportunity/draft/review/publish loop. Contact persistence and its best-effort accepted-event hook are not durable analytics or reporting. |
| **C — reusable serving / ownership** | Generic deployment/customer selection; validated SEO/canonical contract and redirect continuity where migration requires it; usable export/offboarding; external-presence inventory. Current deployment selection explicitly names Myomaton. |
| **D — public operation** | Production Contact/email delivery; distributed abuse/spam controls; deployment/tenant routing; authorization/isolation; monitoring; backups/recovery; privacy/retention; audit/approval records. Public Contact submission is currently development-gated, not production-ready. |
| **D — commercial service** | Repeatable billing/payment process, legal/operational procedures and understandable exit. External/manual commercial tooling can bridge initially; native billing software is not automatically required. |
| **E — future / non-blocking** | Automated 20i reseller provisioning; GBP reporting; automated social publishing; deep CRM attribution; optional integrations not justified by actual need. Real hosting/deployment readiness remains required. |

GA4 and Search Console are **optional near-term proof spikes**, P24/P25, not
implemented integrations. They must not block independent first-party measurement.
See [measurement architecture](measurement-and-analytics.md).

Automatic Page recipes are not implemented, but reviewed assembly with existing
Sections can proceed. Operator roles need minimum production authorization before
management is exposed; elaborate team administration can wait. Native Article
publication and the growth loop are planned core, not public IA blockers. See
[content growth](content-growth-loop.md).

Relevant gates remain P1–P7 for writers, state, provenance, retention, ownership,
export and access; P9/P10 for routing/SEO; P11–P14 for intake, measurement,
intelligence and public forms; P18–P20 for production/isolation/recovery; and C2/C3/C7
for canonical native content and approved publishing. Apply each at its trigger.

## Phased development roadmap

Phase 1's reusable contracts are now implemented in the
[canonical foundation](canonical-foundation.md). The roadmap below preserves the
approved scope; it does not claim dataset creation, final visual selection or production readiness.

### Phase 1 — Canonical C0 content foundation

**Objective:** represent MioPages cleanly without one-off conventions.

- Define minimal trusted Business Knowledge and one Offering contract.
- Define Launch/Ongoing component representation and minimal Pricing contract.
- Establish reviewed writers with applicable authority/provenance safeguards.
- Make explicit deployment selection reusable for an isolated second customer.
- Confirm Page/Action/content responsibilities.
- Later obtain separate authorization for MioPages dataset creation.

**Afterward:** MioPages can have a genuine platform-backed public preview using
existing bounded compositions. Final Visual Direction, self-service, integrations,
recipe automation and commercial publication remain deferred.

### Phase 2 — Review-to-Launch workflow

**Objective:** make acquisition and onboarding repeatable.

Add structured Review/intake, progressive knowledge confirmation, provider-neutral
AI synthesis proposals, approvals, minimum scoped operator authorization and the
customer access required for self-service.

**Afterward:** prospects can request Review and continue into confirmed Launch
scope without reconstructing chat history. Elaborate team administration, CRM
replacement and automated commercial decisions remain deferred.

### Phase 3 — Minimum Ongoing value loop

**Objective:** make recurring value real.

Add independent first-party measurement, lead/outcome distinctions, concise value
reports, a small attention/opportunity queue, grounded draft/review/publish and
service-time observation. Run GA4/Search Console spikes in parallel and integrate
only after proof.

**Afterward:** C0 can test recommendations, customer questions, approved content
and measured improvement. Automated distribution, deep attribution and broad
external-profile management remain deferred.

### Phase 4 — Production / first-cohort readiness

**Objective:** make the service safely and commercially operable.

Prove deployment/tenant handling, domain/SEO continuity, production forms/email,
abuse controls, authorization/isolation, monitoring, backup/restore,
privacy/retention, exit/export and commercial procedures. Assess actual 20i
suitability rather than assume it from the reseller relationship.

**Afterward:** a controlled first outside cohort can begin once required gates pass.
Infrastructure automation and optional integrations remain deferred unless they
reduce demonstrated service burden. Investigate production constraints in parallel
where they can expose architectural problems early.

## Development principle

**MioPages completion and the first sellable Web Presence V1 should converge.**
For every implementation decision ask: does this only make MioPages work, or does
it make MioPages **and the next customer** work? Customer-specific hacks are a
warning sign. Complexity may scale; customization does not.

Every phase follows **Discuss → Decide → Implement → Analyze → Adjust**.
Use [service operations](service-operations-model.md) for operating responsibilities
and [the service model](web-presence-service-model.md) for reusable offer boundaries.

## Business fact gaps and readiness

No contradiction requires reopening discovery. These remain non-blocking until
the relevant implementation, publication or commercial stage:

- Verified public contact/identity values.
- Historical proof permissions, contribution, date/version.
- Verified legacy account destination.
- GA4/Search Console account/property status.
- Final prices and complexity increments.
- Payment/cancellation wording.
- Final operational, legal and exit commitments.

They are not exemptions from verification at that stage. Reopen only the specific
fact if it exposes a real implementation contradiction.

**READY TO BEGIN C0 IMPLEMENTATION.** The first implementation decision is the
smallest reusable canonical model for trusted business knowledge, one Offering,
Launch/Ongoing components and pricing, together with reusable second-customer
deployment selection without Myomaton-specific assumptions. This readiness verdict
does not authorize C0 customer-state writes.
