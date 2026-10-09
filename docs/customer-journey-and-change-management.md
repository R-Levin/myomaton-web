# Customer journey and business-change management

## Authority and implementation status

This document owns the intended prospect-to-customer journey, approval checkpoints,
commercial handoff and ongoing business-change process. These are service/product
decisions, not an implemented workflow, public offer, contract or launch approval.
Commercial hypotheses are labeled separately below; no prices become canonical here.

The [service operating model](service-operations-model.md) owns delivery scope,
responsibilities, cadence and operator-time hypotheses. The [Web Presence service
model](web-presence-service-model.md) owns the reusable service proposition. The
[MioPages C0 product model](miopages-c0-product-model.md) supplies proving context,
not platform invariants. Detailed content, measurement and intelligence contracts
remain in the [content-growth loop](content-growth-loop.md), [measurement model](measurement-and-analytics.md)
and [onboarding/optimization model](onboarding-optimization.md).

| Status | Boundary |
| --- | --- |
| Implemented foundation | Canonical business/content records, bounded rendering, Navigation, Actions and managed media provide building blocks. Existing development-gated Contact submission is not a production Review service. Local media-acquisition and operator-QC work does not implement prospect synthesis, customer approvals or billing. See the [capability catalog](platform-capabilities.md), [media acquisition](media-acquisition.md) and [operator QC](operator-qc.md) for their narrower status. |
| Planned core / pre-launch | Gated Review, prospect records, tailored synthesis, confirmed promotion into customer state, progressive paid onboarding, customer approval workflow, business-change impact planning, durable approval/change history and Ongoing recommendation approvals. These require explicit implementation and the applicable gates. |
| Commercial / legal validation required | Payment/commitment mechanics, Launch installments, cancellation obligations, billing terms and customer agreement language. No final terms or payment-provider choice is specified here. |
| Future | Low-risk Review auto-delivery, confidence/risk routing, richer account/team scaling, CRM-assisted outcome closure and any licensed operator network. |

The [architecture register](deferred-architecture.md) owns implementation gates;
[security and operations](security-operations.md) constrains every stage.

## One continuous service journey

The intended funnel is:

1. Discover MioPages.
2. Provide a small amount of information for a gated, free Web Presence Review.
3. Receive a concise tailored review and synthesis.
4. Choose self-service or assisted start.
5. Confirm commercial scope and commitment/payment.
6. Continue through paid onboarding using information already supplied.
7. Approve business understanding.
8. Approve the Presence Plan.
9. Review implementation in a rendered preview.
10. Give pre-launch approval, then go live once operational gates are also satisfied.
11. Continue through Ongoing optimization, content and reporting.
12. Approve meaningful proposed work, publish/implement it, measure and repeat.

This is not a free consultation followed by a website project and an unrelated
monthly retainer. The free stage demonstrates understanding and capability; paid
Launch executes on it; Ongoing continually improves the living Web Presence.
Payment, fact confirmation, plan approval and publication authorization are separate
decisions. None implies all the others.

## Gated free Web Presence Review

The exchange should be explicit and fair: the prospect supplies a small amount of
useful information; MioPages returns a concise, business-specific review. The gate
must not feel like a complete sales questionnaire or paid onboarding exercise.

Likely required inputs are name, business name, email, website URL if one exists,
what the business does, who it wants to attract, its primary business/Web Presence
goal and one key pain point or concern. Phone, a reference/competitor site and
social/profile links may be optional. Having no existing website is valid input,
not a reason to fabricate an audit of one.

The Review has one primary job: prove that MioPages understands the business and
can identify useful next steps without giving away the paid Launch work.

| Review part | Intended substance |
| --- | --- |
| What we understand | Concise business summary, likely audience and primary conversion objective; uncertainties remain visible. |
| What appears to be working | One or two relevant strengths, where evidence supports them. |
| Top opportunities | Two or three meaningful weaknesses/opportunities, rather than a generic website score. |
| What we would focus on first | Short prioritized direction, not a complete strategy or implementation plan. |
| Likely fit | Standard Launch, Expanded Launch or outside fit/requires review; provisional classification is not a binding quote. |
| Next step | Start on your own or talk it through first. |

### Free and paid value boundary

Free value is diagnosis, opportunity identification, directional recommendation
and evidence of business understanding. It may identify likely Page needs or a
Visual Direction, but does not deliver a complete Presence Plan, full copy or design.

Paid Launch deepens synthesis and establishes complete confirmed structured customer
state for the agreed scope. It includes recommended information/Page architecture,
Visual Direction, full content work, implementation, conversion structure,
measurement setup, an initial content-growth backlog and migration/integration
where applicable and supported. Reporting setup, launch and Ongoing delivery belong
on the paid side. These are intended service responsibilities, subject to actual
capability readiness and agreed scope, not assertions that the workflows exist today.

### Initial review operation and future autonomy

Initial delivery is AI-generated and operator-reviewed. The system may ingest
answers, inspect permitted public information, summarize the business, identify
likely audience/conversion goals and obvious opportunities, classify likely Launch
fit and draft the Review. Public source material remains untrusted evidence; it
does not establish customer truth, ownership or permission to reuse assets.

The operator initially confirms understanding, removes generic or weak observations,
corrects overconfident claims, checks that recommendations are worthwhile and
approves delivery. A normal Review eventually taking approximately **5–10 minutes
of operator review** is a planning hypothesis, not a contractual target. Broader
operator-time economics remain owned by the service operating model.

The intended maturity path is:

1. C0/development: the operator sees and reviews everything.
2. Early prospects: AI drafts every Review; the operator approves every delivery.
3. Proven system: normal low-risk Reviews may auto-deliver under an explicitly
   authorized policy; flagged cases require operator attention.
4. Mature operation: the operator concentrates on exceptions and high-value opportunities.

Potential flags include ambiguous business models, contradictory information,
regulated/high-risk claims, unusually strong criticism, uncertain Launch fit,
multiple brands, unusual integrations, no existing presence and low synthesis
confidence. This is not an implemented routing policy. Permission to auto-deliver
a prospect Review would not authorize unattended publication of customer content.

## Synthesis, self-service and assisted start

The pre-sale synthesis should be short and decisive:

| Part | Content |
| --- | --- |
| What we understand | Business, audience, offers, differentiators, geography and primary conversion goal. |
| What we recommend | Likely presence direction, high-level Page needs, primary Action, initial content priorities, likely Visual Direction and probable Standard/Expanded Launch fit. |
| What we still need | Only high-value missing questions, contradictions, missing proof/assets and integration questions. |

The desired internal reaction is that MioPages understands the business remarkably
quickly. It is not a promise of magical results or a complete free strategy engagement.

Self-service is a first-class path into the same structured process. The customer
supplies business knowledge, goals, preferences, assets and examples; the system
recommends structure and design within bounded rules. Assisted start allows an
operator/intake person to guide that same process. It is not a separate bespoke offer.

Help should remain easy to invoke during self-service. A future assistance entry
point could offer a callback, scheduled conversation or question submission. Exact
copy and UX remain unspecified; unavailable destinations must not appear operational.

Self-service does **not** mean customer customization. Customers do not choose
arbitrary layouts, CSS, typography, spacing, breakpoints, component construction or
page-builder behavior. They supply evidence and approve outcomes. Complexity may
scale; customization does not.

### AI synthesis and canonical truth

The conceptual authority flow is:

Customer input → structured business data → AI synthesis → validated structured
proposal → customer/operator confirmation within their authority → canonical
customer state → deterministic platform implementation.

AI advises and synthesizes; its output is not authoritative customer truth. An
operator may confirm only within explicitly granted authority; operator access or
QC alone does not establish authority to approve a customer's business claims.
Unconfirmed facts and fit estimates remain proposals. Free-form AI output must not
become arbitrary customer HTML, layout or executable code. Existing canonical
records remain the authority after confirmation, not a reusable intake template.

## Commercial handoff and paid onboarding

The commercial line precedes deeper paid work. Explain Launch scope, Ongoing,
supported integrations, exclusions and probable Expanded Launch needs before
commitment whenever possible. If deeper intake later exposes material expansion,
explain the change and agree scope/cost before proceeding; avoid surprise charges.

Once commitment/payment is confirmed through an authorized process, reuse all
applicable prospect/Review data with its provenance and confirmation status. Do not
require re-entry. Deepen intake only where needed, reflect understanding early,
ask targeted questions, obtain operator review where required and prepare the
Presence Plan for approval and implementation/preview.

A first paid experience may show what is already known, what is still needed and
what will be prepared next. This is an experience principle, not a prescribed UI.
Customers should not need a sitemap, wireframes, design brief or technical knowledge.

### Launch payment hypotheses and review gate

Launch is a real, separately valued service cost; Ongoing is the recurring service.
Current commercial hypotheses, **not final prices or terms**, are:

| Option | Planning rationale |
| --- | --- |
| Pay Launch up front | Lowest total price, better cash flow and least collection risk; meaningful savings may be appropriate. |
| Spread Launch over approximately six months | Lower initial adoption barrier with a slightly higher total Launch cost. Installments remain distinguishable from the Ongoing fee. |
| Possible twelve-month treatment later | May further lower the initial barrier, but increases collection/churn risk; not an approved option. |

Do not disguise Launch installments as a permanently higher subscription. Billing
must make Launch and Ongoing understandable. Unpaid Launch obligations after
cancellation, termination treatment and any installment arrangement require
commercial/legal review before use. This document defines neither legal financing
nor credit, final contract terms, amounts or collection rights. See P26 in the
architecture register; manual/external commercial tools may bridge initially if
they satisfy the same confirmation, authorization and reconciliation boundaries.

As automation genuinely reduces Launch labor, MioPages may pass part of the
efficiency gain to customers rather than preserve agency-era overhead. Future
price reductions are not promised. Operator time remains an important scaling
cost; low routine minutes and automation quality affect capacity. Detailed pricing
calculations and operator-time hypotheses do not belong in canonical business truth
merely because they appear in internal planning.

## Four approval checkpoints

| Checkpoint | Customer confirms | Result and boundary |
| --- | --- | --- |
| 1. Business understanding | Identity, offers, audience, differentiators, important proof/claims, geography and primary goals/conversion path. | Establish trusted business truth; confirmed corrections enter canonical business knowledge. This alone does not authorize every public presentation. |
| 2. Presence Plan | Recommended Pages, major offer groupings, primary Actions, Visual Direction, content priorities, supported integrations and intentional exclusions. | Approve outcomes/direction, not pixel mechanics. This is not approval of unseen final copy. |
| 3. Pre-launch | Actual rendered presence: important copy/claims, contact data, forms/Actions, primary media, business metadata and overall direction. | Authorize go-live for the reviewed scope/revision, subject also to operational/security gates. Customer approval cannot make an unavailable workflow operational. |
| 4. Recurring Ongoing | New content, business-information changes, material optimizations, new offer presentation and significant positioning changes. | Approve, request change, not now or reject. Keep decisions simple rather than introduce complex project management. |

### Meaningful approval scope

Approve meaningful substance, destinations and the reviewed revision, not every
implementation detail. Approval of an article about commercial HVAC maintenance
does not require separate approvals for ordinary responsive spacing, internal
links, metadata, semantic markup, accessibility corrections or established Visual
Direction rendering that preserve the approved meaning and destination scope.

However, approving a **topic** authorizes preparation, not publication of an unseen
AI-assisted draft. The initial publication rule requires human review of the actual
content. If the actual draft and destination are included in the approval, one
substantive approval suffices. Material revision or changed context requires renewed
review. Detailed draft/review/publish rules remain in the
[content approval contract](content-growth-loop.md#human-review-and-publication-approval).

Within approved truth and authorized platform policy, routine work may include
technical metadata refinement, broken-link/accessibility correction, internal
measurement, maintenance, implementing an already-approved recommendation,
technical propagation of approved facts and ordinary responsive/design-system
behavior. This is not permission to change claims, publish new drafts, remove
meaningful public material or bypass existing Navigation approval requirements.
Internal measurement remains subject to privacy/access/retention controls.

### Durable approval evidence

Important approvals should eventually identify what was presented, what was
approved, the reviewed revision/destination scope, approver, date/time and later
revision/supersession. Authority must be explicit and tenant-scoped. A stale approval
must not silently authorize a changed proposal or overwrite later customer edits.

This is lightweight evidence for trust, support, operator clarity and auditability,
not a full schema or permanent archive. Retention, access, export and deletion remain
bounded by P2/P4/P5/P7 and the security/operations contract.

## Ongoing content and optimization

Ongoing includes continuous optimization, useful content-opportunity identification,
gathering missing knowledge, preparing content-marketing assets, customer review,
publishing/implementation, measurement and refinement. The intended value replaces
a significant amount of conventional recurring agency/content-marketing labor;
it does not assert that this automation or reporting is already operational.

The system recommends and prepares; the customer confirms business truth and
publication, or explicitly delegates appropriate authority. Initially, externally
published AI-assisted drafts, material claims, substantial service/product changes
and significant positioning changes require human/customer sign-off. Customers
need not author everything; approval should be fast. Operator QC is complementary,
not an automatic substitute for customer authority. Use the existing
[content-growth loop](content-growth-loop.md), rather than a second publishing workflow.

## Business change is expected

A Web Presence is a living representation of the business. The intended customer
entry point is simply: **Something changed in my business.** Bounded categories may
include add/change/remove a service or product, hours/contact/location changes,
add/remove staff, pricing/availability changes, add a location and other significant
changes. Geography, proof/credentials, conversion paths and supported business-unit
changes also belong in this process.

The customer reports the business fact, not which Pages or Sections to edit. These
categories do not assert that every domain already has an implemented structured
contract; unsupported domains require a supported model before canonical writing.

### Impact planning and change sets

The conceptual workflow is:

1. Capture the reported fact and propose a canonical business change.
2. Identify affected entities and presence surfaces.
3. Prepare a recommended change set and classify commercial scope.
4. Obtain required fact, publication, operator and commercial approvals.
5. Apply authorized changes with current-state guards and explicit effective timing.
6. Record resulting state/history and reporting context where relevant.

Affected surfaces may include Pages, Sections, Navigation, Actions, service/product
records, Articles, metadata/search presentation, conversion paths, content
opportunities and reporting context. Confirmation of a canonical fact and publication
of its presentation are distinct: bindings must not bypass staging/approval or
publish unreviewed material as an incidental consequence of a fact edit.

Explain impact in business language: “We recommend updating these four places,”
“This retired service appears in two existing Articles,” or “Your current Contact
path already supports this change.” A new service may justify a dedicated Page,
but this is a recommendation requiring appropriate plan/Navigation approval, not
automatic Page creation or an excuse to reopen approved IA casually.

### Approval and review levels

| Level | Examples and safeguards |
| --- | --- |
| Automatic / routine within authorized policy | Technical propagation of approved facts, semantically safe stale-reference removal, metadata/internal-link updates and technical/accessibility corrections within approved meaning. Removing meaningful public content is not routine cleanup. |
| Customer approval required | New/materially changed claims, new service/product presentation, meaningful public-content removal, significant positioning changes and new externally published content. |
| Operator review required | Ambiguity, broad impact, search/URL continuity risk, pricing/scope classification, conflicting information or integration implications. Operator review does not replace required customer approval. |

These levels can overlap. Validate current canonical and externally managed state
before application; do not overwrite divergent customer/CMS edits blindly. Paused,
rejected or superseded proposals must not become effective through retries.

### Included evolution, supported expansion and bespoke work

| Commercial class | Intended boundary |
| --- | --- |
| Routine / included in Ongoing | Normal service changes, staff updates, hours/contact details, ordinary business facts and modest content updates. |
| Material supported expansion | Several new locations, a major new service division, large catalog import, significant migration/redirect work or a new supported integration may carry a bounded incremental charge agreed before execution. |
| Bespoke / outside scope | Customer-specific applications, arbitrary custom layouts/components and unsupported one-off integrations. |

These are scope principles, not unlimited entitlements, fixed quotas or final terms.
Expanded Launch is supported complexity, not customization or a mandatory lifecycle
stage. The [service operating model](service-operations-model.md) owns detailed scope.

Material changes may trigger affected-Page, Navigation and conversion-path review,
content-gap and search-opportunity analysis, metadata updates, reporting baseline
markers and revised recommendations. Business evolution is optimization context,
not merely maintenance.

### History and measurement context

Retain lightweight, bounded history sufficient to answer what changed, who supplied
and approved it, when it became effective and which presence changes resulted.
This supports support, AI context, reporting, operator understanding and appropriate
rollback/recovery; it does not promise that every external operation is reversible.

Material changes should eventually produce reporting markers, for example
“Commercial Maintenance launched — Oct 15.” A later statement such as “14 leads
since launch” requires actual eligible lead evidence and the stated time window;
it is not a fabricated example result or proof of causation. Intentional changes
should not appear as unexplained performance anomalies. The
[measurement model](measurement-and-analytics.md#business-change-context) owns this
reporting relationship; no event schema or collector is implemented here.

## Experience, capacity and C0 proving

MioPages' operator-supplied credibility context is decades of web development,
optimization, hosting, systems administration, troubleshooting, WordPress, search,
email, integration and ongoing operations experience. Verify public formulations
and permissions before publication. Experience supports the product; it should
not require a founder/figurehead-led sales model or make one individual the product.
The product thesis is that smaller organizations face unnecessarily fragmented,
labor-intensive and expensive Web Presence delivery.

The internal experience target is unusually useful early understanding through
less duplicated labor, fewer unnecessary handoffs, less redundant manual work and
appropriate automation of overhead. Public claims must remain grounded; no magical,
guaranteed or “too good to be true” outcomes are promised.

Initial operation may be owner-operated; limited backup/helper capacity may improve
near-term resilience. Employees, contractors or specialist roles are possible later.
A licensed/franchise-like independent operator network is only a future business-model
hypothesis, with training, permissions, quality, economics, legal and branding issues.
Do not design today's platform around that hypothesis.

MioPages C0 should test the gated Review and lead capture, AI synthesis and operator
review, self-service/assisted paths, free/paid boundary, paid onboarding, Launch fit,
all four approvals, business-change impact/history, content recommendations and
approvals, operator minutes and customer reaction to early synthesis. These are
proving objectives, not implemented capabilities or MioPages-specific invariants.

## Implementation gates and document ownership

Reuse P11 for prospect/intake handoff and confirmed canonical updates; P13 for
synthesis, impact proposals and approval safeguards; P14 for gated public input;
P1/P2/P3 for safe current-state writes and provenance; P7 for customer/operator
authority; P4/P5 for bounded history/export; P12 for change-aware measurement;
C3/C7 for content publication and external-edit continuity; and P18–P20 for production
operation/recovery. P26 separately owns commercial/payment confirmation and legal
review of installment/cancellation terms. This document does not close any gate.

Functional foundations and isolated development tooling are not evidence that a
production prospect, payment, approval or business-change workflow is complete.
Commercial launch remains unauthorized until separately reviewed and authorized.
