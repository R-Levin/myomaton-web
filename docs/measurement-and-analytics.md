# Measurement and analytics architecture

## Decision and scope

The intended measurement architecture is:

```text
FIRST-PARTY CORE
+ OPTIONAL / PREFERRED GOOGLE INTELLIGENCE
+ NORMALIZED OPTIMIZATION SIGNALS
```

GA4 and Google Search Console are preferred external intelligence sources when
available and authorized. They enrich a minimal independent first-party layer;
the platform should not recreate their full analytics, search reporting or UI.
Core operation, lead/conversion reporting and the optimization loop must continue
without them, using the observations actually available and explaining limitations.
Independent does not mean complete, infallible or equivalent to Google's data.

Google Business Profile (GBP) is outside the initial measurement/search integration
specification. It remains a future optional local-presence signal source, not
planned-core reporting or a launch dependency.

This document owns measurement source roles, integration validation, normalized
signal boundaries and degraded reporting. It specifies no schema, vendor SDK,
event endpoint or implemented connector. The [content-growth loop](content-growth-loop.md)
owns recommendation-to-publication behavior; the [service model](web-presence-service-model.md)
owns customer outcomes; the [implementation register](deferred-architecture.md)
owns gates. Preferred Google sources do not change the provider-independent core.

## Implementation status

| Status | Actual boundary |
| --- | --- |
| Implemented now | Bounded development Contact submission persistence and delivery status; an optional best-effort `ContactEvents.accepted` hook emits `form_submit` after new durable acceptance. The hook is not durable analytics, a report or proof that an inquiry became a customer. |
| Near-term technical spike | Separately prove service-account/property-grant access to Search Console and GA4 with Myomaton and MioPages, where customer-owned properties are available and authorized. No proof or commercial onboarding promise exists yet. |
| Planned core | Minimal first-party events, normalized ingestion, independent value reporting enriched by available external data, provider-failure handling and optimization use of imported signals. Production privacy/security and event semantics must be implemented first. |
| Future extensions | Optional GBP investigation, richer provider integrations, expanded technical-health automation and deeper attribution/reporting. Existing technical monitoring obligations still apply before production; this is not their deferral. |

No first-party visit/click analytics collector, GA4/Search Console integration,
normalized measurement store, outcome-confirmation UI or analytics dashboard is
implemented today. Existing Action rendering is not click measurement. See
[Contact measurement boundaries](contact-forms.md#delivery-and-measurement-boundaries)
for the precise implemented hook and production activation limits.

## Minimal first-party core

Directly observe what the platform controls or can reliably measure. Planned scope:

- Page/route visits at a defined useful level, with landing route and available
  referrer/source context; distinguish requests from estimated human visits.
- Important Actions, including click-to-call, click-to-email and other explicitly
  defined lead-generation Actions. A click is not proof of a completed call/email.
- Accepted Contact submissions, distinct from delivery success, retry or rejection.
- Useful bounded article/content engagement, when native publishing exists.
- Platform-generated campaign/source/medium identifiers where appropriate.
- Operational delivery/health observations where relevant, kept separate from
  visitor/conversion measurements.

Define event eligibility and ownership before collection: Web Presence / Managed
Site / Page context, Action identity where applicable, event time, duplicate/retry
behavior, bot/internal traffic treatment and observation limitations. Stable
customer identities and valid [Action destinations](actions.md) remain authoritative.
Do not interpret missing events as proof of no activity, or count repeated
idempotent Contact requests as new leads.

Keep this layer sufficient for questions about observed activity and leads, useful
content and next actions when external data is absent. Avoid reconstructing GA4
sessions, audiences, user journeys or every dimension just to claim parity.
Measurement choices should follow customer value and proportionate data collection,
not an assumption that persistent visitor identifiers are necessary.

P12 owns event semantics, privacy/consent, minimization, access and bounded retention.
First-party collection is not a privacy exemption. Do not collect inquiry bodies,
email addresses, credentials or sensitive URL/query values into ordinary analytics.
Public event input is untrusted and requires scope validation and abuse controls;
the caller must not choose unrestricted tenant identities. See
[security and operations](security-operations.md#public-input-and-contact).

## GA4: preferred external analytics

When configured and authorized, customer-owned GA4 can supplement observations
with traffic/session/user trends, acquisition/source/medium, landing Pages,
engagement, events/conversions, campaign performance and other useful dimensions
and metrics supported by the integration.

Its role is richer external intelligence, familiar independently accessible
customer reporting and portability, avoiding the cost of rebuilding a large
analytics suite. Ingest only data needed for platform recommendations/reporting.
Do not reproduce the GA4 interface or assume a property's events and conversion
definitions align with the platform's lead semantics.

Reading reports is separate from configuring collection, tags or events. API
access alone does not establish that GA4 is collecting suitable data. Account
configuration, consent, reporting definitions and usable history must be understood
before interpreting an imported metric. The spike must prove the needed reports,
not merely authenticate. Google's [Data API overview](https://developers.google.com/analytics/devguides/reporting/data/v1)
and [API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart)
are technical starting points, not evidence of a working platform connector.

## Search Console: preferred search intelligence

When available and authorized, Search Console can provide search queries,
impressions, clicks, CTR, average position and search-visible Pages. Supported
API coverage may also inform indexing/discovery and sitemap questions. Do not
assume every Search Console UI report has equivalent API coverage; validate the
required endpoint and permission for each selected signal. Search Console is not
a prerequisite for the core service or a replacement for first-party conversion data.

Useful optimization interpretations include high impressions with low CTR,
emerging query opportunity, a Page gaining visibility, an important Page not
appearing as expected, or content suggested by search demand. Treat each as a
candidate explanation/opportunity, not proof of cause or guaranteed search gain.
Absence from an incomplete report does not prove a Page is unindexed or has zero
demand. Search Console's [API reference](https://developers.google.com/webmaster-tools/v1/api_reference_index)
is the integration scope reference, not a mandate to implement every endpoint.

## Service-account/property-grant hypothesis

**Preferred technical hypothesis, not proven capability:** where supported and
operationally reliable, grant a service-account identity access to the appropriate
customer-owned GA4/Search Console property. Prefer this to building per-customer
interactive OAuth refresh-token infrastructure as the initial default.

Potential benefits to validate are fewer per-customer token lifecycle problems,
clear property-grant revocation, simpler authorization/offboarding and less
customer credential handling. Consent-screen/verification burden may differ;
do not promise exemption without reviewing the actual integration requirements.
Service identities still need protected credentials, least privilege, rotation
and blast-radius review. Do not trade many customer tokens for an unrestricted
shared identity with unnecessary access to every customer.

This does not mean “no OAuth.” Google's
[Search Console authorization documentation](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)
describes OAuth 2.0 authorization, including service accounts, and the GA4
[quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart)
demonstrates a service-account reporting path. Those documented paths are a basis
for testing; reliable property grants and usable reports remain unproven here.
Technical references were reviewed on 2026-10-05 and must be rechecked during the spike.

### Spike acceptance and refusal boundaries

Test Search Console and GA4 separately, first with Myomaton and MioPages. Confirm
actual property availability and customer authority; a site or reseller account
is not a verified Google property. With explicit authorization, demonstrate:

1. Customer retains independent ownership/access and grants only necessary access.
2. The service identity can read the selected property's required representative
   reports with the intended permission scope, without cross-customer resolution.
3. Data meaning, coverage, date ranges and freshness support a useful recommendation.
4. Revoking the property grant stops platform access without deleting customer data;
   missing permission is clearly reported and first-party reporting still works.
5. Credential protection/rotation, API enablement, quota/retry behavior and onboarding
   effort are operationally acceptable. No keys or private reports enter Git.
6. Repeatable instructions and observed limitations are recorded independently for
   each provider and proving customer; lack of traffic does not prove report usefulness.

No account connection, credential provisioning or property change is authorized by
this architecture document. Do not promise this onboarding method commercially
until both provider paths are demonstrated. If unsuitable, record why and reassess
operator assistance, scoped alternatives or an explicitly reviewed OAuth path;
do not force an unmaintainable token architecture or make Google access a launch blocker.

## Customer ownership and access

GA4 and Search Console should normally remain customer-owned external
properties/accounts, with independent customer access. Platform permissions cover
only authorized reporting/optimization needs; ownership transfer or account-wide
administration is not required merely to read reports. Authentication and property
permission are separate checks, and external property identity must be bound to
the correct Web Presence before ingestion.

Revoking platform access must not destroy the customer's Google data. Retained
platform copies remain subject to disclosed bounded retention/export policy;
revocation is not permission to keep fetching or publish cached private data.
This supports the existing no-lock-in principle without promising implemented
export or unlimited retention. See [service ownership](web-presence-service-model.md#customer-ownership-and-understandable-exit).

## Normalized signals, not provider-shaped recommendations

The conceptual pipeline is:

```text
SOURCE → INGEST → NORMALIZE → STORE/OBSERVE → INTERPRET → RECOMMEND
```

Sources include first-party measurement, GA4, Search Console, customer-confirmed
outcomes and future external channels. Provider adapters resolve credentials,
property permissions and external formats; the optimization engine consumes
defined signal meaning and provenance rather than a provider UI or raw terminology.

Keep source/property and customer ownership, measurement definition/unit,
observation period, freshness, applicable Page/content/campaign identity and
coverage/uncertainty distinguishable. Distinguish event time, reporting period and
ingestion time. Map external URLs to canonical Pages conservatively; unresolved
or ambiguous mappings are not guessed. This is a conceptual contract, not a schema.

Normalize without pretending incompatible metrics are interchangeable. GA4 users,
server requests, first-party visits, Search Console clicks and accepted Contacts
are not one count. Do not sum overlapping provider totals or count one lead twice.
Keep known zero separate from missing/unavailable/incomplete data. Recommendations
requiring absent search signals should say what is missing or use other evidence,
not fabricate query opportunities.

## Resilience and provider failure

The operator cannot guarantee Google API availability, product continuity, accuracy,
completeness, reporting latency, customer account configuration/permissions,
third-party quota behavior or future API/policy compatibility. External failure
must not be presented as failure of the independent core measurement layer.
First-party failure must likewise not be concealed behind available Google data.

Each source should have explicit connection/freshness/coverage status. Separate
not configured, permission/revocation problems, temporary failure, rate limitation,
stale/incomplete results and a successful empty report. Use bounded retries and
safe diagnostics; do not block a core report or public serving while waiting on
an optional provider. A last successful summary may be useful if its age and scope
are clearly shown and retention/access policy permits it; never present it as live.

When Google is unavailable, continue first-party observations and applicable
recommendations. State the missing enrichment and avoid unsupported conclusions.
Before activation, test permission revocation, outage/quota/error handling,
partial ingestion, duplicate retries and recovery without losing or double-counting
first-party events. A successful spike is not production resilience verification.

## Conversion ladder and business value reports

| Level | Meaning and reporting limit |
| --- | --- |
| Observed | A platform-measured visit/Action/form/contact event. External observations retain their separate source; an observed click is not a sale. |
| Attributed | A reasonable association with source/campaign/channel, including uncertainty and method; not complete causal or full-funnel attribution. |
| Customer confirmed | Customer reports that a lead became a customer/client or produced business value. Preserve who confirmed what; do not infer it from a click. |
| Unknown | Downstream outcome is not reported or observable. Unknown is not failure or zero value. |

These are evidence levels, not a claim that every lead progresses through an
implemented tracked funnel. Reporting should answer: what happened, what generated
useful activity, what became leads, which outcomes were customer-confirmed, what
improved, and what useful step comes next. Show an appropriate observation window
and limitations; Google enriches this story rather than defining it. Prefer a
small understandable report to analytics clutter. The
[growth loop](content-growth-loop.md#compact-customer-experience) owns recommendation presentation.

## Business-change context

The [opportunity model's measurement contract](opportunity-and-optimization-model.md#measurement-contract-and-post-action-evaluation)
links each meaningful approved action to rationale, expected outcome, baseline,
primary metrics, action-specific window, minimum evidence, result and next decision.
It owns evaluation states and selection; this document retains source semantics,
coverage, privacy and attribution authority. Lead-quality feedback (good prospect,
poor fit, unclear) complements confirmed sales outcomes; neither is inferred from
anonymous clicks. Sparse/confounded data must remain inconclusive, not false precision.

Material business changes should eventually contribute dated reporting markers,
linked to the approved change and its actual effective/publication timing. For
example, a new service launch gives context to later traffic, inquiries and
customer-confirmed outcomes. See the
[business-change history contract](customer-journey-and-change-management.md#history-and-measurement-context).
Intentional offer changes should not be treated as unexplained anomalies.

Markers are planned reporting context, not a collector/event-schema implementation.
Any statement about leads since a change requires eligible observations and an
explicit window; chronology alone does not establish causation or ROI. Preserve
the conversion ladder, unknown outcomes and provenance above. Reuse P12, with
P2/P4/P7 for change linkage, bounded history and access.

## Technical health is a separate track

Uptime, response time, HTTP errors, broken routes/resources, SSL/domain health,
deployment failures and performance/PageSpeed/Core Web Vitals-related signals are
technical/delivery health. They can explain a business observation but are not
traffic acquisition or confirmed conversion. Contact acceptance and delivery are
also distinct: delivery failure must not erase an accepted inquiry.

Search Console may supply some indexing/experience information within supported
coverage; it is not independent uptime/deployment monitoring. Existing production
monitoring obligations remain in [security and operations](security-operations.md)
and P18–P20. This document does not scope a new full technical-health implementation.

## GBP: future reference only

Google Business Profile remains relevant to local-service customers and the wider
presence inventory. Initial service support can record a public profile URL,
acknowledge its role and offer setup guidance/operator assistance. It does not
include GBP reporting or API management in planned-core measurement.

Ownership/authorization complexity, uncertain API/quota/approval requirements and
potential support burden warrant a separate future value assessment. GA4/Search
Console and the independent core take priority. Investigate optional GBP signals
only if access, authorization, operations and customer value justify promotion;
no near-term GBP gate or launch blocker is created here.

## Product messaging and later terms review

Customer-owned GA4/Search Console access can be presented as familiar, recognized,
portable, independently accessible measurement complementary to MioPages/Web
Presence first-party reporting. Do not imply Google endorsement, infallibility,
guaranteed attribution or a proven connector. “Gold standard” is at most internal
shorthand, not an objective service guarantee or preferred public claim.

For later Terms/Service Agreement review: external analytics/search providers are
outside the operator's direct control. The service may configure, ingest, interpret
or report their data, but cannot warrant their availability, accuracy, completeness,
continuity, response time or future compatibility. Customer-owned external accounts
remain subject to provider terms/policies. The platform's own core measurement and
operation should remain independently functional where reasonably possible.

This is a product expectation and a legal-review input, not final legal terms,
legal advice or a claim of legal sufficiency. It does not disclaim responsibility
for the platform's own collection, access control, ingestion or reporting defects.

## Related contracts and gates

- [Content-growth loop](content-growth-loop.md): opportunities, trusted knowledge, approval and attributed distribution.
- [Service model](web-presence-service-model.md): outcomes, ownership and wider-presence scope.
- [Platform capabilities](platform-capabilities.md): intended envelope and status vocabulary.
- [Onboarding and optimization](onboarding-optimization.md): trusted intake, protected facts and intelligence boundary.
- [Security and operations](security-operations.md): least privilege, secrets, privacy and operational responsibility.
- [Deferred architecture](deferred-architecture.md): P12 event/normalized signal/resilience gates, P24/P25 provider access spikes; reuse P4/P5/P7/P13/P18 where triggered.

No source availability authorizes a customer-state change. Recommendations remain
proposals under the existing operation-scoped approval policy. Implement the
smallest useful first-party core and prove external access before promising richer
reporting; do not close gates merely by documenting them.
