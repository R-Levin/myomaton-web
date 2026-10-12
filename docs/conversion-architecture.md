# Conversion Architecture

## Core decision and ownership

The platform must generate a Web Presence around an explicit visitor-to-business-outcome
model, not merely accurate content and attractive presentation. **Conversion
Architecture sits between Business Knowledge and Page/content planning.** A Page
having a CTA is not sufficient evidence of a coherent conversion path.

The conceptual sequence is:

Business Knowledge → Conversion Architecture → Page/content plan → presentation →
Action/lead → measurement → optimization.

**A funnel is not a sequence of Pages. It is the shortest sensible path from a
visitor's intent to the appropriate business outcome, with the right information,
proof and friction supplied at the right moments.** Materially different intents
may need different outcomes; do not optimize every visitor toward one site-wide CTA.

This document owns the Site Conversion Brief, materially necessary Offering/intent
profiles, Page conversion roles and conceptual Conversion QC. These are planned
core capabilities and durable design decisions, not a schema, runtime resolver,
personalization engine or new competing source of business truth.

The [customer journey](customer-journey-and-change-management.md) owns customer
approvals, commercial commitment and ongoing business-change handling. Conversion
Architecture describes how visitors reach appropriate outcomes; it does not replace
that prospect-to-service lifecycle. The [opportunity model](opportunity-and-optimization-model.md)
owns next-action selection, effort, sustainable growth and post-action evaluation;
the [content-growth loop](content-growth-loop.md) owns drafting/publication and
distribution. The [measurement architecture](measurement-and-analytics.md) owns
signal definitions, privacy, provenance and attribution limits.

The [onboarding model](onboarding-optimization.md), [service operations model](service-operations-model.md),
[service proposition](web-presence-service-model.md), [MioPages C0 model](miopages-c0-product-model.md),
[capability catalog](platform-capabilities.md) and [architecture register](deferred-architecture.md)
retain their existing authority. [Actions](actions.md) own valid destinations and
[Contact](contact-forms.md) owns submission semantics. Presentation realizes the
approved conversion plan through supported capabilities; it does not invent one
from a visual recipe or create operational availability.

## Intent, relationship and context

Visitor **intent** is the primary journey discriminator. Urgency is an attribute
of that intent, not the higher-level classification. One business may serve several
intents even within a related set of offers.

| Illustrative plumbing intent | Information/proof needed before action | Appropriate path, if operational |
| --- | --- | --- |
| Emergency repair | Immediate availability, service area, reassurance/trust and accurate response expectation. High urgency. | Call now or request an immediate callback with minimal friction. |
| Plan a bathroom remodel | Process, examples, schedule and cost expectations, with relevant proof. Lower urgency and a considered decision. | Consultation/estimate; modest qualification can be useful. |
| Routine service | Scope, availability and basic expectations. Moderate urgency depending on need. | Schedule/request quote through a supported destination. |

These are conceptual examples, not claims that a customer offers these services or
that callback, scheduling or quoting workflows exist in the platform.

Relationship is a separate dimension: new prospect, returning prospect, existing
customer and referral source/partner where relevant. An existing customer needing
urgent service may need little persuasion; a new prospect with the same intent may
need proof, service-area confirmation, qualification and response expectations.
Self-selection such as “Already a customer?” is a legitimate initial mechanism.
Do not require automatic recognition or treat self-selection as authentication or
permission to expose account/private information.

Other context can include urgency, readiness, qualification needs, acquisition
source/referrer, customer capacity, season/time sensitivity and device/context only
when materially relevant. Relationship remains conceptually distinct even if it is
carried with other context. A referrer is evidence of entry context, not proof of
identity, relationship or intent; unknown context stays unknown.

Specialize only when context materially changes information, proof, appropriate
friction, conversion action, qualification or response expectation. Do not create
a journey for every combination of offer, audience, device, source and readiness.

## Compact inheritance, not a journey matrix

Use the conceptual hierarchy:

Site default Conversion Brief → Offering-specific override → intent-specific
override → relationship-specific override.

Most Pages/intents inherit the site strategy. An override contains only a deliberate,
material difference and applies only within its defined scope. Intent need not be
identical to an Offering, and may recur across offers; do not duplicate a complete
profile per possible combination. If no specialized profile matches, use the site
default rather than guess the visitor's attributes or require recognition.

This is an inheritance principle, not an implemented precedence algorithm. Future
configuration must make scope/matching unambiguous and refuse conflicting or
unsupported choices during preparation. Every resolved path must preserve truthful
availability, supported Action destinations, eligibility, accessibility and customer
authority. An override cannot bypass qualification required for safe service,
commercial commitment or protected business facts.

## Site Conversion Brief

Before detailed Page/content generation, derive a compact brief understandable to
operator and system. Use confirmed Business Knowledge; unresolved recommendations
remain proposals until reviewed within the existing approval model.

| Brief element | Question to answer |
| --- | --- |
| Primary prospect/audience | Who is the main presence for, and what relevant intent brings them here? |
| Primary business outcome | What useful business result should the presence support? |
| Primary conversion | What visitor action most appropriately advances that outcome? |
| Secondary/direct-start conversion | How can an already-ready visitor act without mandatory education? |
| Assistance path | How can someone get useful help without a competing purchase funnel? |
| Qualification needs | What must be known to distinguish fit, route the request or set expectations? |
| Major objections/questions | What information could prevent an appropriate decision? |
| Proof requirements | What verified, permissioned evidence is needed and where does it matter? |
| CTA hierarchy | Which action is primary, secondary or supporting in the relevant context? |
| Response expectation | What can the business reliably promise after the action? |
| Page-to-conversion role map | How do approved Pages support the path without unnecessary detours? |

The brief connects business goals to a proposed presence; it does not itself
authorize new claims, final copy, forms, prices or production activation. Approve
direction through the Presence Plan and inspect the actual rendered outcome before
pre-launch acceptance. Revisit affected paths when confirmed business facts,
capacity, offers or response commitments materially change.

### Offering/intent conversion profiles

Create a specialized profile only when inheritance is insufficient. It may record
Offering, visitor intent, relationship if material, urgency, readiness, information
and proof needed before action, appropriate friction, preferred conversion,
qualification information, response expectation, supporting content and meaningful
measurement steps.

For example, emergency plumbing/immediate repair could need availability, service
area and trust before a minimal-friction call/callback path. Bathroom remodeling/
planning a substantial project could need process, examples, schedule/cost guidance
before a consultation with modest qualification. These differences follow intent
and evidence, not a universal rule to reduce or increase form fields.

Profile references should use existing authoritative offers/Actions where supported;
they must not copy mutable business facts into a competing truth store. No database
contract, automatic intent detection or arbitrary conditional form system is defined
here. Missing proof or an unavailable action is a gap to resolve or honestly explain,
not permission to fabricate evidence or silently substitute a misleading CTA.

## Page roles and journey continuity

Every Page should have an intentional conversion role. Possible roles are **Attract,
Orient, Explain, Build trust, Qualify, Remove objection, Convert, Support later
conversion, Existing-customer action**. A Page may serve compatible roles but need
not do everything; the site must provide the coherent path. These are planning
roles, separate from Page archetypes or visual recipes, not new stored Page types.

Decide what information/proof a visitor needs, when it is needed, appropriate
friction and the action before detailed copy and composition selection. Give enough
information and trust to act without forcing consumption of the whole site.
Exploring, comparing, evaluating and ready-to-act visitors need not follow the same
educational sequence. A direct-start shortcut may skip explanations, not required
fit/scope, commercial or factual approvals.

Qualification should favor useful prospects and business capacity, not maximum
submissions. Copy/questions may intentionally reduce poor-fit inquiries. Emergency
contact generally calls for low friction; a substantial considered project may
benefit from more context and modest qualification. Do not universally minimize
fields or maximize qualification regardless of intent.

Place proof where lack of trust would block action, not only on a separate proof
Page. Testimonials, certifications, case material, examples, credentials, pricing
guidance, policies/guarantees and response expectations must be verified, approved
and eligible for use. A missing testimonial, unsupported guarantee or provisional
internal price cannot be invented or published to make the path more persuasive.

Informational Pages should not endlessly circulate visitors among explanations.
Important paths lead naturally to conversion, qualification, assistance or a
consciously deferred next step. Reading unrelated material must not be the price
of acting. An unavailable workflow must remain clearly unavailable; conceptual
CTA hierarchy is not permission to present a working submission control.

Supporting content preserves entry context: an Article about remodeling should
connect naturally to the relevant confirmed offer, useful proof and its appropriate
consultation/estimate path. It should not send visitors back through generic Home
education. Reuse approved links/destinations and the content-growth ownership rules;
do not infer a visitor's complete history or invent attribution.

Existing-customer service, support, account/status or repeat-service paths can be
separate from acquisition when material. Self-selection can keep them accessible
without competing with the primary prospect action. This does not implement an
account portal, status lookup, identity detection or any unbuilt operational workflow.

## Post-conversion confidence and response expectations

The journey continues after an Action. The visitor should understand whether the
request was received, expected response time, what happens next, what to prepare
and whether another immediate action would help. These messages must reflect
actual workflow state. A click is not a submitted request, and submission acceptance
is not delivery success, a booking, payment or a completed service outcome.

When an operational request is durably accepted, confirm that fact without claiming
delivery or follow-up beyond available evidence. Failed or uncertain acceptance
requires truthful recovery guidance under the Contact contract. Informational
prototype links and disabled preview controls must not produce success messaging
or imply data collection. A future live workflow can reuse the planned path only
after its functional/authorization gates are satisfied.

Immediate callback, same/next business day or scheduled consultation are examples
of response expectations, not default promises. Use only timing the customer/operator
can reliably meet. Confirm service area, hours, capacity and responsibility as needed;
an urgent intent cannot make an unavailable response operational.

## Measurement and Conversion QC

Map meaningful journey steps rather than count only final submissions:

Qualified visit → relevant Page/offer engagement → CTA engagement → inquiry/request
→ good prospect → customer/business outcome where known.

Different intents may need different intermediate evidence. Define each signal's
meaning, source and limits; a relevant Page visit does not establish qualification,
a click does not prove a call and an accepted inquiry is not a good prospect.
This is a planning map, not an implemented tracked funnel or complete visitor identity.
The measurement model retains Observed/Attributed/Customer-confirmed/Unknown
distinctions, privacy, minimization and provider-independent operation.

The opportunity model consumes gaps and measured results through its existing
prioritization and measurement contracts: hypothesis, baseline, action-specific
window, evidence sufficiency, result and next decision. Do not create another
analytics store, scoring system or attribution authority here. Poor-fit volume,
capacity limits, sparse data and confounding changes remain material context.

Before customer acceptance, conceptually review:

> For each important visitor intent, can the visitor get the information, proof
> and action appropriate to that intent without unnecessary friction or detours?

Check primary conversion clarity; ready-visitor shortcuts; subordinate assistance;
CTA wording/destination match; each Page's role; high-value intent coverage;
qualification; material existing-customer paths; proof before trust becomes a barrier;
post-action expectations; and meaningful measurement mapping.

QC should identify dead ends, circular CTA chains and forced unrelated reading.
A reciprocal informational link is not inherently a defect if a clear appropriate
action remains available. Destination validity alone is insufficient: “Start” must
not imply submission when it only opens explanation. Verify truthful availability
and label meaning in the actual rendered context.

Conversion QC is planned core, not a claim that the current
[operator-QC tooling](operator-qc.md) automatically assesses intent, persuasion or
journey effectiveness. Automated checks can establish routing/containment and some
structural risks; operator/customer judgment establishes business appropriateness.
QC complements the existing approval checkpoints and never replaces actual-content
review or authorizes launch by itself.

## Generation and ongoing review

The intended Customer 2+ onboarding/generation sequence is:

1. Capture Business Knowledge and confirm essential truth under existing policy.
2. Identify Offerings and audiences.
3. Derive the Site Conversion Brief.
4. Identify materially different intents and relationships.
5. Define specialized profiles only where needed.
6. Assign Page conversion roles.
7. Propose information architecture, respecting existing approved IA unless change is justified.
8. Generate content/compositions from the reviewed direction through bounded capabilities.
9. Render the actual presence.
10. Run Conversion QC.
11. Obtain human/customer review, including the existing plan/content/pre-launch approvals.
12. Launch only with separate operational readiness and authorization.
13. Measure and optimize through the existing opportunity/content loops.

This is the intended process, not a new generation engine. Corrections can return
to the appropriate earlier decision; Page roles are inputs to IA, not permission
to automatically add Pages or reorder approved customer content. AI may recommend
the model, but canonical facts and material direction require confirmation. Customers
approve outcomes, not funnel mechanics, CSS or arbitrary page-builder controls.

## MioPages C0 evidence and Myomaton follow-up

MioPages C0's first revamp improved business accuracy, presentation, integrated
product explanation and Page structure, but initially sent visitors sideways
through information instead of clearly advancing them toward conversion. The
[conversion-story refinement](miopages-conversion-story.md) exposed the missing
explicit Conversion Architecture layer; good IA/presentation alone did not supply it.

The emerging site-level hierarchy is:

- Primary: **Get Your Free Web Presence Review**.
- Secondary: **Ready to start now?**
- Support: **Questions or need help?**

Normal path: understand MioPages → free Review → decide to continue → fit/scope →
commercial commitment → paid onboarding → Launch.

Direct start: ready to start → foundational information → fit/scope → commercial
commitment → paid onboarding. Both paths reuse known information and deepen intake
only where needed; a shortcut does not skip commercial or approval safeguards.

The [accepted C0 checkpoint](miopages-c0-checkpoint.md) is current stage/route
authority; earlier preview commands/routes are historical. It separates explanatory
How It Works (`/getting-started`), Free Review (`/review`) and contextual Start
(`/start`). The [conversion-surface learning](miopages-conversion-surfaces.md)
records progressive information reuse and distinct responsibilities. These are
MioPages proving decisions, not required Pages, labels or a universal platform funnel.
This document changes neither the accepted IA nor the active preview.

The accepted isolated presentation is not a live Review/onboarding service. Its
disabled preview controls do not submit; prospect persistence, payment and operator
assistance remain unimplemented. Public conversion availability, production
activation and real-customer application require separate authorization.

When returning to Myomaton, intentionally derive its own Conversion Architecture.
Exploring projects, following development, subscribing, using/downloading open work,
contributing or supporting the project are possible outcomes to investigate, not
decisions made here. Its information architecture must not be treated as proof
that those paths already form an appropriate funnel. No Myomaton state changes.

## Implementation boundaries and existing gates

| Status | Boundary |
| --- | --- |
| Implemented / foundation | Confirmed business/Offering records, bounded Pages/Sections, Navigation, valid Action destinations, managed media and development Contact semantics. The accepted isolated C0 refinement demonstrates content/CTA planning, not a reusable stored Conversion Brief or live acquisition workflow. |
| Planned core | Site Conversion Brief, materially necessary Offering/intent profiles, Page conversion roles, CTA hierarchy, Conversion QC and journey-step measurement mapping integrated with onboarding/approval. |
| Future / advanced | Dynamic journey weighting, sophisticated recognition, automatic relationship detection and adaptive presentation/personalization. None is a launch prerequisite. |

Reuse P11/P13 for intake, reviewed synthesis and proposed conversion configuration;
P1/P2/P3/P7 for authorized persistence and explicit inheritance/approval provenance;
P8/P10 for Page/URL continuity; P14 for Contact/public-input availability; P15 for
bounded precedence; P12 for step semantics/mapping/evaluation; and P21 for compatible
presentation without business-truth invention. Existing Action destination and
tenant-scope validation remains authoritative. C3/C7 retain actual-content review
and publication rules; P26 retains commercial commitment. No new gate ID, schema,
runtime implementation, preview mutation or commercial launch authorization is
created by this document.
