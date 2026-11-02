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
| Site content state | Hosted synthetic C0 currently 4 pages / 19 sections; later reviewed design 4 / 23 sections not hosted | Select an immutable approved **synthetic** fixture for tests; no direct production hosted C0 mutation |
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

## Minimal prototype

**Phase A: contract and static mapping** (no hosted writes)
- Inventory current actual data schemas, existing release/approval gates and renderer input.
- Produce example adapter-neutral release JSON for one approved synthetic C0 fixture; map one page with representative header, hero, services/benefits, CTA, navigation and SEO to one lightweight WordPress block/theme design.
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
