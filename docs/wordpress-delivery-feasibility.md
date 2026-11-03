# WordPress delivery feasibility and implementation gap analysis

Status: **Approved for evaluation and bounded proof, not approved for production migration** (operator decision, 2026-11-02).
Scope: alternate Managed Site delivery adapter using standard WordPress sites, initially 20i Reseller; existing Next.js delivery and hosted synthetic C0 preserved.

## Decision and boundaries

The operator approved proceeding under the WordPress Delivery Feasibility Specification v0.1 and subsequent clarifications:
- 100 customers would use standardized copies of one controlled WordPress distribution, **not 100 bespoke themes**.
- Customers normally **do not receive WordPress credentials**. MioPages portal is their normal interface.
- Even when authorized administrators/agencies have WordPress access, **MioPages-owned pages/blocks/releases need protection and divergence detection**. Gutenberg block locking is not sufficient authorization.
- Prefer a very small plugin footprint and reuse existing 20i Reseller features including reported 30-day WordPress backup retention; do not assume that backups replace release rollback.
- A future agency/connected-WordPress channel should be enabled by a host-independent transport, without broadening the first commercial prototype.
- Maintain the existing Next.js renderer and Supabase database. Suspend speculative expansion of the current runtime's customer-domain hosting workaround during the feasibility proof.

This *reopens* the historical post-V1 WordPress placement in `docs/platform-service-architecture.md`; that document's older release target is **not silently superseded**. A separate architecture/roadmap review is required before any formal Commercial V1 change. The existing `docs/development-control.md` Commercial V1 sequence remains authoritative until changed by an approved review.

## Source-derived existing capability versus proposed new work

| Boundary | Reusable / known from current architecture | New work or open proof |
| --- | --- | --- |
| Customer and site model | Organizations, Web Presences, Managed Sites; canonical PostgreSQL data; request-scoped tenant identity | Binding a remote WordPress installation to exactly one authorized Managed Site; credential lifecycle |
| Knowledge and content | Structured knowledge, pages, sections, actions, assets and reviewed site recipes | Serializer that produces an adapter-neutral, versioned, immutable site release compatible with WordPress |
| Approval | Distinct customer approval/release authorities are documented | Verify only approved release IDs can be synchronized; host-side publish acknowledgement cannot grant approval |
| Current delivery | Next.js renderer and hostname routing already demonstrated for synthetic C0 at two hostnames | WordPress renderer/theme/block mapping; no requirement to reimplement tenant lookup inside each WP site |
| Site content state | Hosted synthetic C0 currently 4 pages / 19 sections; later reviewed design 4 / 23 sections not hosted | Use the **accepted service-led v3 C0** (4 Pages / 23 Sections) as the immutable proof fixture, from verified development/frozen promotion sources; no direct hosted C0 mutation |
| Release/recovery | Central revisions, release and rollback design/contracts | Remote staging, atomic activation, idempotent retry, last-good release, drift detection, remote reconciliation |
| Media/SEO/integrations | Content architecture covers assets, analytics and discovery integration requirements | Media copy/link handling, SEO/meta/schema rendering, GA4 and verification integration; avoid arbitrary customer scripts |
| Site provisioning | 20i Reseller infrastructure and operator familiarity | Live API entitlement/Blueprint capabilities, domain/SSL exceptions, mailbox preservation, alternate-host onboarding |
| Security | Platform tenant isolation and protected operator credentials | Per-site plugin enrollment, scoped signing/authentication, replay protection, no central DB secrets in WP |
| Backup/ops | Operator reports 30-day reseller WP backups; managed PostgreSQL backup contracts exist | Restore drill, PHP/WP/theme/plugin updates, fleet monitoring, capacity and cost verification |

This is an architectural **gap analysis**, not a complete code-level inventory. Before implementation, inspect actual repository release functions, schemas, and renderer contracts to assign exact module-level reuse and test ownership.

## Preferred transport: HTTPS release notification + authenticated pull

1. **Enrollment:** Operator provisions WordPress site and installs versioned theme/plugin. A scoped one-time enrollment handshake links the installed plugin to the exact MioPages organization/Web Presence/Managed Site and records an installation identity, host, capabilities and secret or asymmetric key. Binding is operator-approved and revocable.
2. **Release preparation:** MioPages produces an immutable, versioned manifest for a *specific* Managed Site. It references approved page/section models, navigation, actions, assets, SEO, canonical host and compatibility requirements.
3. **Notification:** Central service calls the installation's HTTPS plugin endpoint with a signed notification containing only release identity and metadata. Notification is a **hint**, not publishing authority. If callbacks are blocked by hosting/security plugins, the plugin polls for pending approved releases as fallback.
4. **Pull:** Plugin authenticates to central MioPages API, retrieves exact approved release and assets, validates site identity, signature/integrity, expiry/replay protection, schema version, renderer capabilities, allowed media and safe content fields.
5. **Stage:** Create local candidate pages/media/navigation and validate before public activation. No page-by-page live update without a coherent activation plan.
6. **Activate:** Swap to a complete validated release with an application-level last-known-good pointer (implementation mechanism to be proven). Flush only necessary WordPress/object/page cache after activation.
7. **Acknowledge:** Plugin reports installed release hash, success/failure and health to the central platform. Central platform reconciles declared and observed state; no status-only success claim.
8. **Retry/rollback:** Repeated notification and pull must be idempotent. Failure preserves the previous live site; recovery supports operator-approved rollback. A central outage does not prevent WordPress serving last-good published content.

**Host-neutral invariant:** The plugin uses outbound HTTPS to MioPages and a narrowly authenticated inbound endpoint only when supported, never direct Supabase PostgreSQL credentials, 20i-only APIs, or public-visitor dynamic calls to the central system. Domain, DNS, SSL and hosting provisioning live in separate provider adapters.

**Security qualification:** A WordPress server owner/administrator with code or DB access can bypass UI-based locks; for such sites, the platform must enforce authorizations centrally, detect unsupported mutations or drift, and avoid claiming physical impossibility of tampering.

## Content ownership and Gutenberg protection

- Turnkey managed sites: central platform owns the page tree, managed blocks and published configuration. Customers use the MioPages portal, **no WP login by default**.
- WordPress roles/capabilities prohibit routine editing of managed pages, plugin deployment config, REST endpoints and release markers. Review capability checks for all write entry points, including Gutenberg, REST, XML-RPC where enabled, CLI and imports.
- Use Gutenberg `templateLock` / block locking for **operator ergonomics only**; the plugin must validate content ownership in server-side permissions and publish actions. Prefer immutable managed renderer/blocks or plugin-controlled post types as appropriate to avoid uncontrolled block HTML drift.
- An agency/connected-site mode, **deferred**, distinguishes local/agency-owned regions from named MioPages-managed sections and defines conflict/drift policy. Do not overwrite unrestricted existing theme content.
- Code/theme customization rights cannot be taken away from a site owner who controls hosting; the architecture should fail closed on publish, detect divergent local state, and explain corrective options.

## Chosen reference fixture: accepted service-led v3 C0

Operator clarification (2026-11-02): the first WordPress rendering and transport proof **must use the newest human-accepted C0 design**, **A Business in Focus / service-led v3**, not the older synthetic C0 deployed on 20i. The authoritative review/promotion documentation is [reviewed canonical promotion](miopages-canonical-promotion.md), with frozen reviewed source at `scripts/customer-updates/miopages-focus-reviewed.json`. Expected four routes: `/` (5 Sections), `/service` (8), `/experience` (5), `/review` (5), totalling **23 Sections**; approved Source Sans 3 typography and palette; two eligible wordmark assets. The five unresolved media needs remain unapproved, so never fabricate/insert FPO imagery, historical proof, or a pretend functional Review form. The canonical release must enforce existing confirmed-content and media eligibility boundaries. The v3 promotion's frozen development preconditions **do not match** the hosted fresh PG17/16-migration C0 state; **do not replay its operator against the hosted database**. Construct and verify a read-only/exported deterministic fixture from reviewed code and development test data, with no hosted database changes. This tests visual fidelity and content semantics, not authorization for commercial public launch.

## Operator Gutenberg editing as an inbound knowledge proposal channel (2026-11-03)

**Operator-requested scope addition:** Evaluate WordPress's native editor for authorized MioPages operator-authored *content-form knowledge* (posts, pages, CPT entries). This is a **proposed editorial adapter**, not WordPress becoming the canonical business-data authority and not an authorization to unlock generated Managed Site pages.

- Distinguish **authoritative canonical knowledge** (structured Organization/Offering/knowledge, approved revisions) from **editorial documents** (articles, descriptions, FAQs, business profiles) and **derived presentation pages** (managed site output). Do not equate editing a paragraph with approving an externally asserted business fact.
- Turnkey managed sites normally have no customer WordPress logins. Authorized operators may use a dedicated restricted WordPress editorial role, with CPT-specific permissions, drafts and native revisions. Generated MioPages-managed pages remain protected. WordPress administrators with filesystem/DB control cannot be physically prevented from overriding plugin protections; detect divergence.
- For a first proof, prefer **one editorial draft type** (e.g. an article), then **one structured knowledge-backed CPT** (e.g. service description). No generic ingestion of arbitrary Gutenberg HTML, arbitrary blocks or arbitrary custom fields into canonical records.
- On operator save, capture stable installation/tenant/content IDs, editor identity mapped to a verified MioPages operator, WP post/revision ID, normalized allowed fields, base canonical revision, timestamp and payload hash. Preserve the original source revision/provenance. Treat autosaves, background updates, imports and transport retries explicitly; don't mistake `save_post` for completed approval.
- The plugin delivers a **signed outbound HTTPS proposed-change event** (or queues it for retry) to a provider-neutral MioPages endpoint. Central MioPages validates tenant ownership, actor scope, content kind, schema, expected base version, business-evidence/public-visibility rules, and idempotency. Accept it as a **pending revision/proposal**, not as public canonical truth and never as immediate publication. The platform returns a durable receipt/decision; operators resolve version conflicts rather than last-write-wins.
- An authorized MioPages approval promotes the revision through existing canonical write/approval rules, then builds a new managed release for every affected site. WordPress local draft status is not central publication authority. Echo/feedback-loop prevention is mandatory when MioPages subsequently publishes content back to WP.
- WordPress-native posts may remain editorial source documents, but knowledge-backed CPT fields require a reviewed structured mapping; bounded block vocabularies and sanitized rich-text are required. Preserve meta descriptions, excerpts, media ownership/rights and approval scope deliberately.
- **100-site operational concern:** Operators must not have to navigate 100 independent WordPress dashboards to update central knowledge. Test whether this is best implemented through an operator-only editorial workspace, targeted installation editing, or a future centralized WordPress editing hub. Do not pick a hub architecture prematurely. Limit first proof to one `miopages.org` installation.
- This functionality is a **separate inbound editorial adapter** from the existing outbound site-release adapter; the 20i API continues to manage hosting/services only. External-host WordPress installations must not gain core authority merely by installing the plugin.

**Two-operator approval and cross-presence consequence boundary (2026-11-03 clarification):**

- **Editorial Operator (WordPress):** May propose edits to a supported post, page, article or canonical-knowledge-backed record such as a service description or business location. WordPress permissions define editable record types and fields. Saving a WP draft is not permission to publish locally or mutate canonical state.
- **Reviewing Operator (MioPages):** A separately authorized role reviews the exact proposed diff, current canonical base version, evidence/provenance and intended affected entities. May approve, reject or request revision according to existing MioPages policy. Enforce separation of duties when required; operator role names here are conceptual, not a new hard-coded hierarchy.
- On approval, the proposal updates the **appropriate canonical knowledge entity or governed editorial artifact**, not merely the origin WP row. MioPages determines affected managed surfaces via explicit dependency/impact analysis: site pages, articles, search metadata, listings or other presence channels where supported. An editorial page edit need not be recast as a business fact; a service/location fact should not be stored only as page prose.
- **Approval of a knowledge change is distinct from approval of every downstream publication.** Deterministic allowed updates may follow preauthorized release rules; generated or materially altered copy, claims, media, SEO/local profiles or external channels require their applicable validation/approval. Review UI should preview the proposed impact, record approval scope, and allow staged release; do not interpret “can update anything” as unrestricted automatic cascade.
- Every proposed change and each subsequent canonical revision/release retains origin WP installation/post/revision, actor, reviewing authority, scope, timestamps and causal linkages. Ensure local WP output is not changed publicly before release; outbound sync must not recurse as an inbound proposal. Approval controls must be enforced by the central system, not WordPress role names alone.

**Further workflow-design consideration (2026-11-03):** Do not assume every submitted revision follows a linear propose → approve → release process. A reviewer may propose an alternative text or request more evidence, send it back to an editorial operator or to the customer for factual confirmation, and then review the resulting revised version. Preserve proposals as versioned discussion/decision artifacts with assignment, comments, participant roles, immutable revision history, explicit customer-confirmation versus operator-approval authority, and a final scoped decision. Reviewers' suggested alternatives are *not* automatically approved facts. Do not implement a broad workflow engine yet; use one bounded return-for-revision/customer-confirmation scenario to validate the model.

**Dependency and impact analysis consideration:** A change to a structured fact such as a business location can have certain direct references and uncertain semantic implications. Classify downstream effects as explicit/dependency-linked, potential/needs-review, or unaffected. Present an impact assessment and proposed updates; do not blanket-regenerate everything or silently cascade edits into other pages/channels. Keep knowledge approval, derivative copy approval, and each release authorization distinct; version dependency references so changes can be traced and conflicts detected.

**Added acceptance tests:** approved operator draft save produces exactly one tenant-scoped pending proposal; autosave/retry duplicates are idempotent; unrecognized actor/foreign tenant/unapproved block/schema rejected; stale base version causes explicit conflict; no public site changes until central approval/release; approval and subsequent outbound sync do not create a loop; an outage queues/resumes safely and preserves provenance; ordinary site users cannot modify protected generated pages.

## Minimal prototype

**Phase A: contract and static mapping** (no hosted writes)
- Inventory current actual data schemas, existing release/approval gates and renderer input.
- Produce example adapter-neutral release JSON from the **accepted C0 A Business in Focus / service-led v3** (4 Pages / 23 Sections), not the older hosted 4/19 state. Inspect the reviewed frozen promotion source and development canonical graph, ensure exact identity/sections/design-system/approved wordmarks and preserve unresolved-media refusal. Map a representative page with header, hero, services/benefits, CTA, navigation and SEO to a lightweight WordPress block/theme design.
- Specify compatibility versioning, URL/canonical behavior, media and rollback mechanism. Avoid arbitrary generated HTML and introducing a general page builder.

**Phase B: isolated 20i proof** (explicit authorization for provisioning and writes required)
- Provision **one** separate non-customer WordPress test package and domain with valid HTTPS; preserve existing DNS/mail.
- Install minimum required plugin/theme manually once, then validate repeatable packaging.
- Enroll with a bounded test identity; publish fixture; update; deliberate invalid release rejection; rollback; central API unavailable while public site works; verify plugin update and backup restore.

**Phase C: provider-independence proof**
- Install **same package/version** on a second isolated WordPress host, change only host-specific secrets/URL configuration; reproduce publish/rollback without transport redesign.
- Do not add full partner UI/features in this phase.

**Phase D: 100-installation economics and operations**
- Confirm *current plan* 20i account/storage/CPU/PHP/DB/inode/backup/mail/SSL and API limits and prices; avoid treating 'unlimited accounts' as unlimited resources.
- Model domain SSL exceptions, monitoring, update rollout, backup/storage, provisioning, per-site media and support cost. Test update/restore and representative concurrency/load before declaring 100-site readiness.

## Prototype pass/fail gates

- A page and navigation are rendered faithfully from an existing reviewed synthetic release without duplicate content decisions.
- Cross-tenant, wrong-installation, unsigned, stale/replayed or unapproved releases do **not** publish.
- Partial media/content failure does not expose a half-updated public site.
- Central outage leaves previous public site available.
- Update and rollback produce independently verifiable expected revision.
- WordPress edit permissions and Gutenberg locks reduce casual corruption; unauthorized API writes fail; authorized admin tampering is detected, not hand-waved away.
- Same release protocol works on a second host without 20i APIs.
- Real recurring and operational costs at 100 standardized installations are acceptable and bounded.
- Failed proof preserves current Next.js delivery and leaves hosted C0 unmodified.

## Next bounded engineering task

**Read-only code inventory:** inspect schema/types for Pages/Sections/Assets/Actions and existing release/rollback, authorization and renderer input. Write a module-to-adapter mapping and a complete **sample synthetic release manifest**. No migrations, deploys, secrets, live hostname changes, new customer provisioning or hosted writes in this first task.

## Continuity and operational caution

This document records an operator-approved **feasibility direction**, not production deployment approval. Existing hosted C0 remains initialized/bound; do not rerun fresh-hosted initialization, migrations or permanent role provisioning. Historical note: a persistent runtime `DATABASE_URL` path anomaly remains separately outstanding; do not copy secret config into Git. Current Git `main` and deployed 20i checkout must be independently checked before any later source-dependent operations.
