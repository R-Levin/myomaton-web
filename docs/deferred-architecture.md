# Deferred architecture requirements and decisions

This is an active architecture register, not a general TODO list or delivery plan.
Items come from established platform requirements and the [Asset foundation](assets.md).
Content Engine entries are commitments for future implementation, not claims that
those capabilities already exist. A trigger is an implementation gate, not a date.

The [platform capability catalog](platform-capabilities.md) defines the intended
product envelope; this register owns active implementation state, triggers and
deferred requirements. A capability's inclusion there does not by itself create
a backlog item here.

The [onboarding and optimization operating model](onboarding-optimization.md)
records foundational knowledge, measurement, approval and publishing decisions.
Review it when applying the related gates below; its planned capabilities are
not claims of implementation.

The [security and operations posture](security-operations.md) defines minimal
public surface, shared maintenance, tenant boundaries and recoverability. Review
it at the security/production gates below; it does not claim those controls or
disaster recovery are implemented.

## Classifications and status

- **REQUIRED**: established requirement; implementation is pending until its trigger. Do not silently omit it when triggered.
- **DECISION**: established, ongoing constraint that future implementation must preserve.
- **OPEN**: unresolved question; decide when its trigger supplies the necessary context.
- **OPTIONAL**: possible enhancement, not a product or architecture commitment.

Remaining REQUIRED scopes below are pending at their stated gates; DECISION items apply
continuously; OPEN items remain unresolved. No OPTIONAL items are currently recorded.

## Slice workflow

For each coherent implementation slice:

1. Check the [capability catalog](platform-capabilities.md), then review this register's implementation triggers against that envelope and identify REQUIRED gates the proposed slice reaches.
2. Satisfy or explicitly reconsider triggered REQUIRED items; never silently bypass them. Record the rationale and revised requirement/trigger if reconsidered.
3. Record material new deferrals, with an explicit trigger wherever possible and a reason when useful.
4. Architecture review must distinguish genuine future requirements from speculative enhancements.
5. Remove resolved items from the active list; preserve only a useful minimal decision or reference after resolution, not a growing completion log.

## REQUIRED: Assets

Satisfied for the first managed site slice: **A1/A2** for transactional `intro` Section
`image` and document `attachment` roles only; **A3** for the format-neutral managed-object/local-storage contract; **A6**
for that writer and relevant PostgreSQL constraints in disposable fixtures, with
installed migration-chain and replayed-schema fidelity checks. See
[Assets](assets.md). This does not complete broader Asset lifecycle or management.

The intentional Asset-reuse accessibility prerequisite is satisfied for the
initial `AssetUsage.configuration.image` contract: informative alt override,
Asset-level fallback and explicit decorative treatment. See [usage-specific image
accessibility](assets.md#usage-specific-image-accessibility). This does not complete
usage editing, captions, cropping, focal points or renditions. Future usage writers
must preserve these semantics and the existing A1/A2/A6 gates.

The applied [Myomaton secondary Pages transition](myomaton-secondary-pages-v1.md)
applies these gates to two additional intro image usages: ownership-chain locking,
transactional attachment, contextual alt fallback and disposable PostgreSQL
rollback/rendering coverage. This is a bounded customer-state operation, not
general Asset lifecycle management or a new platform capability. Its frozen
baseline/complete-result guards also satisfy the ongoing P1 gate for this writer;
customer editing, revisions, publishing, P9 and P10 remain deferred.

| ID | Deferred requirement | Implementation trigger / reason |
| --- | --- | --- |
| A1 | Validate AssetUsage target existence and Web Presence ownership, following Page/Section ownership through their parents. | Before each additional target writer or operation. Section intro image/document attachment is covered; the composite FK still does not validate generic targets. |
| A2 | Maintain usages transactionally when references are attached, replaced, removed, or their target is deleted. | Before replacement/removal/target deletion or other attachment writers are introduced. The implemented Section attachment is transactional. |
| A3 | Establish a durable `source_type` / `source_reference` contract. Keep stable Asset identity independent of location; canonical records must not depend on transient delivery URLs or credentials. | Before additional source kinds or production storage/provider integration. Format-neutral managed/local semantics are established and must be preserved. |
| A4 | Track asset lifecycle and unreferenced state explicitly; do not use `updated_at` as the unreferenced timestamp. | Before retention/purge implementation; see O1 and D1. |
| A5 | Define safe physical-file cleanup for replacement/deletion, including displaced source locations and concurrent references. | Before asset replacement/deletion or automatic orphan-file cleanup. Local provisioning can leave retryable bytes after a DB failure; do not delete them blindly. A source-reference overwrite loses cleanup information. |
| A6 | Add live PostgreSQL integrity coverage for relevant cross-tenant, reference, and delete constraints. | With each additional Asset write operation or target type. Section attachment and relevant FK/uniqueness/delete rejection now have live PostgreSQL coverage, migration hash/timestamp preflight, replayed-schema catalog comparison, and cloned-FK fidelity checks. |
| A7 | Before enabling managed video ingestion, define the large-media storage and delivery policy, including capacity/cost behavior, file-size constraints, optimization/transcoding strategy where appropriate, retention implications, and external-provider options. The policy must accommodate legitimate high-video customers without imposing arbitrary growth penalties while protecting platform storage and delivery economics. | Before managed video ingestion is enabled. Video is deliberately unsupported in this slice; this policy has not been designed. |

Customer-facing Asset authorization is covered by P7. Asset data **and bytes** in
customer export/offboarding are covered by P5; these are REQUIRED, not optional
Asset enhancements.

## REQUIRED: Platform

The [site-global foundation](site-globals.md) implements shared read-only business
identity, controlled Header/Footer, optional Utility Navigation and a single typed
policy flag with trusted override permissions. P15 is satisfied for this bounded
resolver, not a policy UI or new customer writer. P14's shared presentation identity
is established; production Contact/forms, SMTP/delivery, spam and privacy work remain
gated. Logo read/delivery adds no attachment writer: A1/A2/A6 must be satisfied
before a logo writer is introduced. Search, onboarding, analytics, legal content
authoring and publishing are not implemented by this slice.

The [Contact foundation](contact-forms.md) implements multiple reusable definitions,
shared Section presentation, transactional scoped/idempotent submissions, persisted
expiration and provider-neutral delivery/accepted-event hooks. P14/P15 are covered
for this bounded development contract only. **Before public form activation**, P14
still requires distributed abuse/rate limiting and spam controls, trusted delivery
routes/provider deployment, privacy policy and usable retention/export/purge plus
uncertain-delivery reconciliation. The HTTP endpoint is gated outside development.
P7 management, P12 analytics and P18/P19/P20 production/recovery gates remain open;
no overlay, CRM or full analytics is implied. Definition contract writers must
increment version and preserve historical submissions under P1/P2.

The seed/customer-initialization part of P1 is implemented: generic seed contains
only reference data; explicit Myomaton initialization creates a fresh customer
graph atomically and performs no child repair or updates once the Web Presence
exists. The legacy CTA seed updater is retired. See [bootstrap boundaries](bootstrap.md).
P1 remains an ongoing gate for every later customer-state writer; this does not
implement customer editing, provenance, revisions or publishing (P2/P3).
The [Customer #1 Home v1 operator transition](myomaton-home-v1.md) uses a frozen
expected-state guard for this bounded update; it does not complete those future
workflows or make its source definition continuing authority over customer state.

[Multi-page serving](managed-site-routing.md) is implemented within one explicitly
selected active Managed Site, preserving P8 without a page-count cap. It introduces
no customer-state writer or management surface. P9 remains deferred: deployment
selection is explicit configuration, not request-host/domain tenant resolution.
Basic per-Page titles do not complete the capability catalog's production SEO track.

[Page-target Actions](actions.md) now resolve stable Page UUIDs in the explicit
Managed Site context using the same Page destination policy as Navigation. This
adds no customer Pages or authoring workflow; P9 and P10 remain deferred.

| ID | Requirement to implement or preserve | Implementation trigger / reason |
| --- | --- | --- |
| P1 | Keep the platform database canonical for the customer's current Web Presence. Customer edits become canonical and must not be silently overwritten by templates, AI, automation, or reseeding. Seeds/source files must not remain a competing authority. | When real customer editing is introduced, and whenever a later writer can update existing customer state. |
| P2 | Introduce bounded revision/provenance mechanics; distinguish editable/draft, published, and rendered/deployed state. | Revisions/provenance: when customer editing is introduced. Concrete state separation: when editing/publishing workflows require it. |
| P3 | Preserve enough origin/definition ancestry to distinguish platform-managed/default, customer-customized, and deliberately detached state. | Before reusable definitions/templates update existing customer instances. |
| P4 | Implement bounded retention for revisions, obsolete assets, logs, and backups. | When each history starts accumulating real customer data; permanent history is not the default. See D1-D3 and O1. |
| P5 | Provide a usable export of current customer-owned Web Presence state and applicable Asset data and bytes, usable without the proprietary platform. | When customer export is introduced, and before supporting real customer offboarding. |
| P6 | Keep customer-owned state distinguishable from platform implementation/IP. | Whenever a new domain or integration stores customer state; use D4 as the architecture check. |
| P7 | Implement explicit authentication, server-side authorization, least privilege and tenant-isolation review for customer/operator management, including Assets; define roles as needed and keep privileged management separable from public serving. | Before any customer-facing management surface/API, or production operator management surface/API, is exposed. Hidden URLs and tenant-scoped queries alone are not caller authorization. See [management boundaries](security-operations.md#management-access-and-tenant-isolation). |
| P8 | Preserve structurally multi-page Managed Sites; any page-count restriction is product policy, not a schema limitation. | Whenever page management, product limits, or Managed Site schema changes are introduced. |
| P9 | Implement robust request-host/domain-to-Web-Presence / Managed Site resolution. | Before production multi-presence/tenant routing depends on request domains. |
| P10 | Define a validated canonical Page/Web Presence SEO metadata contract, including description and public canonical-URL rules. Do not treat untyped metadata JSON or Section copy as that contract. | Before SEO metadata authoring or production indexing/launch. Multi-page routing currently uses Page title with name fallback; the schema has no defined description contract. See [routing metadata](managed-site-routing.md#metadata-and-not-found-behavior). |
| P11 | Define conditional guided intake, trusted fact confirmation and direct subsequent updates to canonical/global business knowledge; preserve shared consumers rather than copying facts into Pages. Apply P1/P2/P3/P7 to the writer and customer access. | Before production onboarding writes, including operator-assisted intake; authorization and complete review/update paths before customer self-service onboarding. |
| P12 | Establish minimal independent first-party event semantics, conversion/outcome distinctions, tenant/site scope, privacy/consent, minimization, access and bounded retention. Normalize authorized external signals with provenance, freshness, coverage and uncertainty; do not merge incompatible counts. Preferred optional GA4/Search Console enrichment must not be required for internal measurement. Verify provider failure/revocation, stale/partial data, duplicate retry and recovery behavior while first-party reporting continues. See [measurement architecture](measurement-and-analytics.md). | Event/privacy contract before production collection; normalized ingestion and degraded-mode verification before external reporting or analytics-driven optimization is activated. Reuse P4/P5/P7/P13/P18; provider-access spikes P24/P25 do not satisfy production resilience. |
| P13 | Define a provider-neutral intelligence boundary and per-customer usage attribution. Enforce operation-scoped approval, protected business truth, current-state validation and bounded change provenance; pricing/offers require explicit approval. | Provider/data-access boundary before the first intelligence/API integration; approval and change safeguards before automated optimization can write or publish. Reuse P1/P2/P3/P7 and C3. |
| P14 | Define shared canonical contact data and its Page/Section/global consumers, accessible Contact interactions, server-side submission validation, rate limiting, spam/bot and abuse controls, safe email/delivery without arbitrary relay, privacy/access/retention and measurement integration. | Before production Contact/forms; apply P7 to management and P12 to collected events. Existing contact Actions do not complete this requirement. See [public input](security-operations.md#public-input-and-contact). |
| P15 | Define typed policy scopes, precedence, permitted overrides, enforced boundaries and operator/customer authorization; distinguish recommendations/soft maxima from hard limits. | Before introducing configurable layered service policy or a generalized Platform Policy UI. Reuse A7/P4/P7 for video, retention and access constraints. |
| P16 | Establish URL ownership/routing, canonical/SEO responsibility, forms and analytics ownership for coexistence deployments; do not ingest/reconstruct the existing presence. | Before each custom “keep what you have” integration; require demonstrated repeatable patterns and a supported contract before standardizing the mode. Reuse P9/P10/P12/P14 where triggered. |
| P17 | Review upload type/content validation, resource limits, non-executable storage, controlled delivery, untrusted metadata and justified malware/security controls. | Before general customer uploads. Existing operator ingestion is a bounded foundation; reuse A1/A2/A3/A6 and P7. See [upload security](security-operations.md#assets-and-customer-uploads). |
| P18 | Establish scoped runtime/migration/operational credentials, secrets management/rotation, appropriate security headers, repeatable deployment and compatible rollback, centralized patching, actionable monitoring and a bounded backup/restore plan. | Before production launch; reassess when deployment or exposed surfaces materially change. Define recovery objectives, alert ownership and configuration recovery. Reuse A3/P4 and [deployment/recovery posture](security-operations.md#secrets-and-repeatable-deployment). |
| P19 | Perform an explicit tenant-boundary and shared-platform blast-radius review, with verification of foreign/ambiguous reference refusal across exposed data, media and management paths. | Before multi-customer production, and when expanding tenant boundaries. P7 caller authorization and P9 host resolution remain separate required gates where triggered. |
| P20 | Demonstrate an isolated restore of PostgreSQL plus matching managed Assets and deployment/configuration, including usable application/media serving and secrets recovery/rotation procedures; record results and resolve gaps. | Before claiming disaster recovery readiness, periodically thereafter and after material recovery-path changes. Reuse P4/O1/D2 for retention; backup-job success alone is insufficient. See [recovery verification](security-operations.md#backups-and-disaster-recovery). |
| P21 | Implement validated Visual Direction/profile resolution and shared semantic link, typography and form-state roles with accessible surface pairings, compatibility fallback and explicit-choice preservation. Define permitted preference/override scope; examples must map to supported capabilities. | Before activating a Visual Direction; verify supported examples before using them in onboarding and enforce authorized bounded choices before customer visual self-service. Reuse P1/P2/P7/P15 and the [visual contract](visual-direction.md). |
| P22 | Enforce cumulative Page-level motion allocation, policy ceilings, reduced-motion override, content visibility and performance. | Before enabling motion; a Section-local allowance is insufficient. See [motion budget](visual-direction.md#page-level-motion-budget). |
| P23 | Establish an approved bounded icon source, licensing and shared accessible rendering policy without uploaded executable code. | Before expanding beyond current local functional icons/text links into a shared icon system. See [icon boundaries](visual-direction.md#elevation-backdrops-and-icons). |
| P24 | Prove Search Console service-account/property-grant access on authorized Myomaton and MioPages properties: needed reports, least privilege, ownership/tenant binding, credential protection, revocation, operational burden and documented limitations. Reassess the access method if unsuitable; no commercial promise before proof. See [spike acceptance](measurement-and-analytics.md#spike-acceptance-and-refusal-boundaries). | Near-term technical spike, before selecting or promising Search Console onboarding. Missing properties/permission require operator resolution, not bypass; availability is not a launch prerequisite. |
| P25 | Separately prove GA4 service-account/property-grant access on authorized Myomaton and MioPages properties, including useful report coverage/configuration, ownership/tenant binding, least privilege, credential/revocation behavior and repeatability. Record the decision rather than default to brittle per-customer refresh-token infrastructure. See [spike acceptance](measurement-and-analytics.md#spike-acceptance-and-refusal-boundaries). | Near-term technical spike, before selecting or promising GA4 onboarding. Reuse P7/P18 for access/secrets and P12 for reporting; absence of usable GA4 is not a core-service blocker. |

## REQUIRED: Content Engine

The native Article baseline and optional external-engine direction supersede the
earlier WordPress-first decision. C1/C7 reflect that explicit change; existing
canonical-state, approval and external-edit divergence safeguards remain.
See the [native publishing model](onboarding-optimization.md#native-articles-and-optional-external-engines).

| ID | Requirement to implement or preserve | Implementation trigger / reason |
| --- | --- | --- |
| C1 | Keep external Content Engines behind a provider boundary. Native Articles are the intended baseline; WordPress or another external engine is optional for heavier needs, never a platform dependency. | At native publishing and external Content Engine integration or provider/domain changes. |
| C2 | Maintain canonical platform state for platform-managed Articles; an external engine must not be their only authoritative copy. | Before creating or managing Articles through the platform. |
| C3 | Let customers preview and approve managed content before publication unless an explicit autonomy policy authorizes automatic publishing. Make publishing autonomy explicit, such as approval-required versus automatic. | Preview/approval: before managed publication. Autonomy policy: before automated publishing. |
| C4 | Support editing managed Content Engine content through the platform rather than requiring an external CMS administration interface. | When the managed-content editing workflow is introduced. |
| C5 | Detect and reconcile divergence; direct CMS edits must not be silently overwritten. | When two-way/direct CMS editing becomes possible, including integrations where direct editing is already available. |
| C6 | Distinguish platform-managed content from external/unmanaged CMS content. | When integrating existing Content Engine content. |
| C7 | Implement the bounded native Article contract in the capability catalog, including safe constrained-body validation/rendering, publication state/date, listing/article routes, Asset usage and approval. Bodies are not arbitrary Sections. Reuse C2/C3, A1/A2/A6, P2/P7/P10/P12 for canonical state, publishing, media, access, SEO and analytics. | Before native Article publishing; recheck scope at each model expansion. No general block/page builder is implied. |
| C8 | Do not expand into general remote WordPress administration without a concrete requirement. Drive Content Engine complexity by discovery, publishing, syndication, attribution, or optimization utility. | At every proposed Content Engine capability expansion. |

## OPEN

| ID | Unresolved question | Decision trigger |
| --- | --- | --- |
| O1 | Exact bounded-retention periods, superseded-asset handling, and archive timing. | When real retention behavior is implemented; resolve before enabling it. |
| O2 | Should retired assets be periodically packaged for customer archival before purge? | When defining customer archival/purge policy, before enabling the affected purge behavior. Packaging is not yet a commitment. |

O3's link/form visual-policy question is resolved by the
[Visual Direction contract](visual-direction.md). P21 is implemented for the bounded
opt-in runtime: two versioned profiles, validated preferences, semantic roles and
preservation of explicit Section choices. [Reference v2](visual-direction.md#reference-v2-expression-contract)
adds stronger expression, optional contrast-paired secondary accent and bounded
decoration policy. Customer visual self-service, supported
example selection and authorized preview/approval writers remain gated. P22 is
satisfied for capped Hero/CTA effects: v1 serialized settle and v2 fixed staged
CSS Hero. P22 has been reassessed: heading/support/Action are one reserved Hero
event, with bounded overlapping child timing, not three independent consumers.
Separate Hero events serialize by reservation, and the optional non-Hero observer
queues allocated downstream events after Hero completion and one another.
Reduced-motion/focus overrides, content visibility and 0/1/3 allocation remain.
No card-cascade exemption or new automatic consumer type is introduced. Reassess
before adding consumers or extending the fixed recipe. Explicit Intro statement
presentation uses the existing content/JSON boundary and adds no writer/migration.
P23 remains deferred: functional icon intent is resolved but no shared icon registry
or expanded icon rendering is implemented. Reusable v2 compositions and responsive
expression are implemented and human visually accepted for this checkpoint.
Myomaton is stored as reference v2 after its separately authorized, applied and
verified [guarded customer-state transition](myomaton-visual-direction-v2.md).
That application does not implement general customer authoring or approval workflows.
The catalog owns the capability envelope,
the visual document owns the design contract, and this register owns its gates.

## DECISION: Ongoing architecture constraints

| ID | Decision | Apply when |
| --- | --- | --- |
| D1 | The platform is an operational current-state system, not a permanent historical archive. Canonical does not mean retained forever. | Modeling canonical state, revisions, and asset lifecycle. |
| D2 | Backup is not archive; backup retention must also be bounded. Long-term archival history beyond the stated retention/export policy is not implicitly the platform's responsibility. | Designing backup, archival, retention, and customer-facing service policies. |
| D3 | Lightweight audit/provenance may outlive full historical content. For stored information, architecture must be able to explain why it is retained and when it can be deleted. | Adding stored information or defining its retention policy; this is not a permanent-audit mandate. |
| D4 | Exportability is an architecture check: new domains must keep customer-owned canonical state clearly separable from platform machinery and capable of eventual export where applicable. | Reviewing every new customer-data domain; implementing export is gated by P5. |
| D5 | Preserve canonical first-party measurement, trusted business knowledge and operation-scoped approval across onboarding and optimization; provider output is not business truth. | Designing intake, intelligence, measurement or automated changes; see P11-P13 and the operating model. |
| D6 | Keep service economics observable per customer: infrastructure/AI usage and human service minutes. Do not encode experimental pricing, promotion terms, crowdfunding plans or forecasts as invariants. | Adding metered integrations, service workflows and operating reports. |
