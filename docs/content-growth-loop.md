# Content growth and continuous optimization

## Purpose and scope

The Web Presence platform should not stop at publishing a website. Its long-term
core loop turns observation and trusted business knowledge into compact,
understandable improvements to a customer's public presence:

```text
OBSERVE → INTERPRET → RECOMMEND → GATHER BUSINESS KNOWLEDGE → DRAFT
→ HUMAN REVIEW / APPROVAL → PUBLISH → DISTRIBUTE → MEASURE → REPEAT
```

This is an optimization/content-growth system, not an autonomous content farm.
Useful discovery, trust, service/product understanding and qualified Contact
outcomes matter more than publication volume. Measurement may recommend improving
existing content, gathering evidence, pausing or retiring a topic instead of
creating another article. The trusted-knowledge path can reuse confirmed knowledge
without asking the customer the same questions again.

This document owns the durable loop, customer experience and expansion boundaries.
It does not define a schema, provider, scheduler, analytics implementation or large
editorial project-management system. The [capability catalog](platform-capabilities.md)
owns the product envelope; [onboarding and optimization](onboarding-optimization.md)
owns intake and operating policy; [deferred architecture](deferred-architecture.md)
owns implementation gates.

## Implementation boundaries

| Status | Current boundary |
| --- | --- |
| Implemented now | PostgreSQL-backed Web Presence / Managed Site / Page / Section state; Subjects; managed Assets and usages; first-class Actions and canonical Navigation; bounded Design System / Visual Direction rendering; shared public identity and bounded social links. |
| Implemented foundation | Reusable Contact Definitions, development-gated scoped submissions and provider-neutral delivery/accepted-event hooks. These are not production Contact activation, a CRM, durable analytics or an optimization system. |
| Planned core | Guided business-knowledge intake and updates; a small opportunity queue; provider-neutral recommendations and grounded drafting; bounded native Article/Update content engine; human review/approval and publication; first-party measurement and understandable optimization feedback. Intended before/near launch as applicable, not a delivery-date promise. |
| Planned supported presence | Inventory and link external profiles, record their role and capabilities, and measure attributable referrals where possible. Existing public social links are only a subset of this inventory. |
| Future extensions | Automated social publishing, channel-specific derivative generation, managed external-profile integrations, additional distribution channels and richer cross-channel reporting/optimization. |

No opportunity queue, Article publisher, analytics reporting, AI integration,
external-profile verification or automated social distribution is implemented by
this document. The historical local editor prototype is not the current publishing
workflow. Current active Page/Section state is not a draft/review/publish contract.
Production readiness remains subject to the existing gates, especially P1–P7,
P10–P14 and C1–C7; see the [register](deferred-architecture.md).

## Canonical knowledge and content ownership

Canonical business knowledge and substantial platform-managed content belong in
customer-owned structured platform state. PostgreSQL owns current customer state;
templates, source-controlled transition files and AI conversation history do not
become competing authorities. Important facts, sources and approved decisions
must remain reviewable outside individual memories or conversations.

A Managed Site Page or native Article can be the canonical public presentation of
that knowledge. An external CMS/content-engine publication, LinkedIn or X post,
Facebook derivative, Google Business Profile reference/link, YouTube description
or supporting copy, and campaign landing material are representations derived from
the same trusted facts. An external social platform must not become the only
canonical home of important platform-managed business knowledge.

Preserve stable identity and ownership, supported internal Action destinations,
Asset identity/usage and the relationship between a canonical artifact and its
derivatives. Do not scatter duplicate global facts across channel copies. A fact
correction should identify affected outputs for reviewed reconciliation; it does
not authorize blindly overwriting external edits. Existing unmanaged external
content may remain external without an ingestion commitment.

The [native publishing and optional external-engine contract](onboarding-optimization.md#native-articles-and-optional-external-engines)
already defines constrained Article bodies, provider boundaries and divergence
handling. This loop does not turn Articles into arbitrary Section compositions or
Gutenberg/Divi-style pages. [Visual Direction](visual-direction.md) supplies bounded
presentation, not invented business meaning. Ownership includes eventual usable
export, subject to retention/offboarding policy; canonical does not mean permanent
archive. See [security and operations](security-operations.md).

## A small content-opportunity queue

Maintain a short prioritized backlog, not an unlimited AI idea generator. An
opportunity may come from unanswered customer/prospect questions, search/query
signals, incomplete or underperforming service/product coverage, supporting content
for an important Page, traffic/conversion behavior, social/referral interest, a
seasonal or business event, newly supplied knowledge, an optimization content gap,
or a customer/operator idea.

Each opportunity should eventually be able to record:

| Information | Purpose |
| --- | --- |
| Topic and why it matters | A comprehensible recommendation tied to a business need. |
| Evidence/signals | Source, observation period and uncertainty; distinguish evidence from interpretation. |
| Related business/service/product/Page | Connect the topic to supported customer knowledge and conversion context; a future Offering domain is not assumed to exist now. |
| Intended audience and outcome | Identify who should benefit and what useful result is expected. |
| Known supporting knowledge | Trusted facts, customer-specific examples and source context available for drafting. |
| Missing information | A small, answerable set of questions or evidence requests. |
| Priority and status | An understandable reason to do this before other candidates. |
| Eventual published artifact | Connect the approved outcome to its canonical publication and derivatives. |
| Measured result | Observation window, useful signals, limitations and the next recommendation. |

A lightweight conceptual lifecycle is:

```text
suggested → gathering information → ready to draft → draft → review
→ approved → published → measured
```

Stages can be skipped when their conditions are already satisfied, such as existing
approved knowledge. Review can return a draft for correction; an opportunity may
be deferred or dismissed with a reason. Merge duplicates and revisit priorities
instead of multiplying similar ideas. These names are product concepts, not a
prescribed enum or an implemented workflow. A small visible set, such as three
useful opportunities, is a presentation goal rather than an arbitrary storage cap.

## Two drafting paths

**Knowledge-gathering path:** recommend a topic, explain why it matters, and ask
the customer a few targeted questions. Answers become trusted business knowledge
after the relevant customer/operator confirmation. Draft from those answers and
existing structured knowledge, preserving source context and unresolved questions.
Visitor Contact submissions can suggest questions; untrusted visitor input is not
automatically business truth or publishable customer testimony.

**Trusted-knowledge path:** when sufficient approved, relevant and current
information already exists, prepare a draft directly from it. Do not ask redundant
questions, silently treat stale facts as current, or fill gaps with plausible claims.
Return unsupported assertions or ambiguities for clarification.

In both paths, customer/business facts remain authoritative and drafts remain
unpublished until approval. The intelligence boundary can assist synthesis,
structure, metadata and internal-link proposals without choosing a domain-specific
AI provider or bypassing [Action validation](actions.md).

## Human review and publication approval

The [customer journey's approval model](customer-journey-and-change-management.md#four-approval-checkpoints)
places this loop within recurring Ongoing approval. Approval of a topic permits
preparation, not publication of an unseen draft; approve the actual reviewed
substance/revision and destination scope. Routine technical implementation within
approved meaning need not become a series of separate approvals. Material business
changes use the [impact-planning process](customer-journey-and-change-management.md#impact-planning-and-change-sets),
including references to retired offers in existing Articles.

For initial product versions, human customer/operator review and approval is a
platform invariant for externally published AI-assisted/generated content, including
channel derivatives. Automatic drafting does not authorize automatic publication.
Approval belongs to the specific reviewed outcome and destination scope; material
changes after approval require review again. Do not publish an unreviewed revision
because an earlier draft was approved.

Customers should approve outcomes rather than manually write every sentence.
Review should be fast: show the proposed content, intended audience/outcome, trusted
support and remaining questions, with a clear approve/revise/defer choice. Check
incorrect claims, missing context, stale information, unsupported statements,
inappropriate tone, generic/repetitive language, accidental duplication and poor
customer-specific relevance. Approval also requires an authorized operation and
valid current state; it is not merely a conversational acknowledgement.

This is a deliberately narrower initial constraint than the conceptual selective
or managed-automatic policies in the [operating model](onboarding-optimization.md#business-truth-and-approval-policy)
and C3. Those future options do not enable unattended AI-content publication in
the initial product. Any later autonomy requires a separate explicit product and
policy decision. Protected business facts and pricing/offer approval remain
stricter boundaries regardless of automation policy.

## Content quality and AI fingerprint risk

Do not base product policy on an assumption that search engines universally detect
and penalize AI authorship, or frame approval as defeating a universal AI detector.
The practical concern is quality and authenticity: generated content can become
generic, repetitive, derivative, thin, factually weak, stylistically uniform,
disconnected from first-hand knowledge, or focused on keywords instead of usefulness.

Ground drafts in trusted customer knowledge and specific examples. Check duplicate
topics and repeated wording, flag unsupported claims, assess usefulness and tone,
and obtain human approval. Publish at a sensible business-relevant cadence and
measure afterward; no automatic volume quota or promise of ranking improvement.
AI should multiply useful human effort, not manufacture anonymous filler. Content
quality checks are planned workflow safeguards, not implemented detector claims.

## Observation, measurement and uncertain attribution

First-party measurement is the canonical product measurement system and must work
without GA4 or Search Console. Those preferred optional intelligence sources
supplement it where configured and authorized. The
[measurement architecture](measurement-and-analytics.md) owns the minimal core,
normalized ingestion, provider-access spikes and unavailable/stale-source behavior.
GBP reporting is future optional scope, not an initial measurement dependency.
Future recommendations may use:

- Page traffic, landing Pages, referrers and known campaign source/medium.
- Search/query signals, including Search Console where configured and available.
- GA4 where configured; internal Actions/conversions and phone/email clicks.
- Contact submissions and engagement with important Pages.
- Content performance over time, social/referral traffic and business/operator input.

An Action click, Contact submission and qualified business outcome are different
signals. Existing [Contact accepted-event hooks](contact-forms.md) are not durable
analytics. Low traffic or a short observation window should produce uncertainty,
not confident causal conclusions. Recommendations should state what was observed,
what is inferred and what further evidence would help.

Do not promise perfect attribution. AI assistants and some external services may
provide inconsistent or absent source information. Preserve known, likely and
unknown classifications rather than assert that every visit has an identifiable
origin. Referrals do not by themselves prove that a publication caused conversion.

Before collection, implement P12 event semantics, tenant/site scope, privacy/consent,
minimization, access and bounded retention. Contact and analytics input remain
untrusted. Do not routinely send private inquiry bodies or personal information
to drafting providers; data access must be necessary, authorized and scoped through
the intelligence/security boundaries. See [security and operations](security-operations.md#public-input-and-contact).

## Distribution and deterministic links

The future distribution loop is:

```text
canonical article/content → channel-specific derivative → publication
→ attributed referral → measurement → optimization feedback
```

Adapt length, framing, CTA, metadata and format to the channel without changing
underlying facts. Initial distribution can be operator-assisted/manual; automated
social publishing is not an initial requirement. Preserve the relationship to the
reviewed canonical artifact and respect account permissions and channel policy.

When generating outbound links, use deterministic campaign/source/medium identifiers
where appropriate. Keep a stable link between identifiers, topic/artifact and
channel; do not embed private facts or visitor identities in public URLs. This is
bounded attribution, not a full marketing-attribution platform or a change to
canonical Action destinations.

Measurement should help answer whether an article generated useful discovery,
whether a derivative sent qualified traffic, which topics preceded conversions,
which channels are useful, and whether an important Page performed differently
after supporting content appeared. Report the observation period and limitations;
do not promise complete cross-device or cross-channel journeys.

## External presence without mandatory management

Recognize Google Business Profile, LinkedIn, X, Facebook, Instagram where appropriate,
YouTube and relevant public profiles/directories even when the platform does not
operate them. A planned lightweight inventory may record provider/type, public URL,
handle/name, active/inactive state, verified/claimed/manual status, informational-only
status, and whether publishing and referral measurement are available. Clarify who
confirmed a status; a recorded public URL is not proof of account ownership or a
provider connection. Publishing and measurement availability are separate capabilities.

Google Business Profile can matter greatly without direct management being an
initial service. Google Business Profile, YouTube and other services may involve
account ownership, verification, permissions, external policies and difficult
onboarding/API requirements. Start with discovery/inventory, public links, setup
guidance, checklists and operator assistance. Future partner/affiliate assistance
or managed integrations can be evaluated separately. These dependencies are not
launch blockers; inventory must not imply an unbuilt integration exists.

## Deliberate service expansion

| Stage | Customer value and boundary |
| --- | --- |
| Initial core | Managed Web Presence / Site, trusted canonical knowledge, native content engine, recommendations, draft/review/publish and measurement. The loop is planned core, not a statement that all parts exist today. |
| Supported presence | Know profiles exist, inventory/link them, understand their role and track attributable referral where possible; no promise to operate each service. |
| Future value adds | Automated social distribution, derivative generation, richer cross-channel reporting, external-profile optimization assistance, managed integrations and additional channels. Adopt based on recurring value and support cost. |

Each extension can add value for existing customers and provide a meaningful
new-customer acquisition announcement without bloating the initial offering.
Keep provider credentials and channel operations behind scoped integration
boundaries; failures in an optional channel should not block canonical publication
or first-party measurement. Observe per-customer infrastructure/AI usage and human
service minutes alongside business outcomes, without fixing pricing here.

## Compact customer experience

Translate analytics into comprehensible action, such as “Three useful content
opportunities,” rather than an overwhelming marketing dashboard. An illustrative
recommendation, conditional on actual evidence, could read:

> **Recommended:** How does your emergency service process work?
>
> **Why:** Visitors frequently reach the emergency-service Page, but few continue
> to Contact. This suggests a possible explanation gap; it does not establish cause.
>
> **What we need:** Three short answers about response area, hours and what
> customers should expect.
>
> **Next:** Answer questions → review draft → approve/publish → measure.

This example is not customer content or a claim about current traffic. Show a
small next step, supporting evidence and expected outcome. Make it easy to correct
the premise, defer the topic or supply missing knowledge. Avoid forcing customers
to interpret event charts or specify mechanical optimization settings.

## Human and system contributions

The customer/operator supplies purpose, business knowledge, judgment, values,
priorities, approval and responsibility. AI/system assistance supplies synthesis,
pattern identification, recommendations, structural reasoning, drafting, adaptation,
measurement interpretation and coordination leverage. These are complementary
functions, not a transfer of business authority to a model.

Externalize important knowledge and decisions in reviewable customer-owned state
with bounded provenance. Neither human memory nor AI conversational state should
be the sole repository. This operating philosophy is shared with Myomaton / Open
Practical Robotics, while Web Presence remains a separate application domain; it
does not import robotics-specific requirements into the platform.

## Customer 0: MioPages

MioPages is a useful Customer #0/generalization proving ground. Its
[canonical customer graph](miopages-c0-canonical-state.md) exists; that does not
mean the complete journey or content-growth workflow exists. It can test commercial
content opportunities, Web Presence service/business topics, lead-generation
intent, limited-imagery design/content, external social/profile inventory, the
existing 20i relationship, eventual distribution and measurement recommendations.

Its commercial intent complements Myomaton Customer #1. MioPages-specific topics,
partners, channels and operating choices are proving inputs, never platform
invariants. The 20i relationship is not a mandatory hosting/integration dependency.

## Related contracts and implementation discipline

- [Web Presence service model](web-presence-service-model.md): reusable launch/ongoing service, responsibility and infrastructure boundaries.
- [MioPages C0 product model](miopages-c0-product-model.md): commercial customer hypothesis and non-robotics generalization proving ground.
- [Platform capabilities](platform-capabilities.md): product envelope, native Articles versus Managed Site purpose, ownership and status vocabulary.
- [Onboarding and optimization](onboarding-optimization.md): trusted intake, intelligence/provider boundary, protected facts and broader policy.
- [Deferred architecture](deferred-architecture.md): P1–P7, P10–P14 and C1–C7 gates; D1–D6 retention, ownership and operating constraints.
- [Visual Direction](visual-direction.md): bounded approved presentation and customer-outcome selection, not pixel mechanics.
- [Actions](actions.md), [Contact](contact-forms.md) and [site globals](site-globals.md): existing reusable destinations, inquiry and public-identity contracts.
- [Security and operations](security-operations.md): access, privacy, secrets, recovery and export boundaries.

Apply existing gates when a concrete slice reaches them; this document does not
silently close them or create runtime features. Any new domain must preserve
customer ownership, tenant isolation, protected truth, reviewable approval and
bounded retention. Grow the smallest useful loop before adding channels or a
larger marketing system.
