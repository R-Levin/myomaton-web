# WordPress delivery feasibility and implementation gap analysis

Status: **Committed integration direction. Bounded private delivery acceptance closed.** Production migration and publication retain separate approval gates.
Scope: alternate Managed Site delivery adapter using standard WordPress sites, initially 20i Reseller; existing Next.js delivery and hosted synthetic C0 preserved.

## Decision and boundaries

The operator approved proceeding under the WordPress Delivery Feasibility Specification v0.1 and subsequent clarifications:
- 100 customers would use standardized copies of one controlled WordPress distribution, **not 100 bespoke themes**.
- Ordinary customers can participate in the managed service without WordPress Admin. The [customer interaction contract](service-operations-model.md#minimal-commercial-v1-customer-experience) owns the channel decisions. Authorized Operators and designers may use WordPress tools within scoped permissions.
- Even when authorized administrators/agencies have WordPress access, **MioPages-owned pages/blocks/releases need protection and divergence detection**. Gutenberg block locking is not sufficient authorization.
- Prefer a very small plugin footprint and reuse existing 20i Reseller features including reported 30-day WordPress backup retention; do not assume that backups replace release rollback.
- A future agency/connected-WordPress channel should be enabled by a host-independent transport, without broadening the first commercial prototype.
- Maintain the existing Next.js renderer and Supabase database. Suspend speculative expansion of the current runtime's customer-domain hosting workaround during the feasibility proof.

The recovered November 4–7 direction retains managed delivery, authorized publishing,
editorial workflows, media, SEO, management and operations. Private HTTPS acceptance
verified signed transport and staging. Remaining production capabilities have separate
implementation and verification gates. Standardized Managed Site delivery comes first.
Connected Presence may begin with bounded operator-assisted work for existing WordPress
installations. Broader designer and agency support follows separately. Exact launch
sequencing requires owner review under the
[Commercial V1 architecture](platform-service-architecture.md#wordpress-delivery-and-designer-adoption).

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

## Core-specified site and WordPress round-trip clarification

**Owner's intended architecture clarified November 8, 2026; detailed
synchronization contract and Commercial V1 inbound editing scope remain
pending.** Core defines and retains the authoritative managed site blueprint,
including page/section structure, navigation, initial theme/design choices,
typography, layout/spacing intent, content, media placements and relevant
metadata. The WordPress plugin should materialize the approved initial release
as native WordPress pages, blocks, templates and media/presentation structures
for frontend rendering and authorized Gutenberg refinement. This does **not**
mean building a second visual page builder in Core, nor leaving WordPress as
the independent source of business truth.

After an authorized Operator reviews and edits the actual WordPress site,
the plugin should capture supported changes with stable Core/WP identity,
source revision and scope, including intentional presentation refinements,
and return them as structured inbound proposed changes. Core reconciles and
governs these edits, preserving authorized refinements across later managed
updates/rollbacks and rejecting or flagging drift/conflicts. Core records
the approved evolving structure/content/design decisions for ongoing
measurement, review and improvement; not every incidental internal WP
implementation detail needs its own canonical domain field. No direct
WP save is automatically a Core approval or publication mandate.

New pages/sections may originate from a Core-generated proposal or from
authorized WordPress editing, provided the plugin can express the result
through a supported canonical Page/Section proposal and the relevant
review/release authorities. A WordPress-only page must not silently become
authoritative managed structure. Exact edit vocabulary, identity mapping,
conflict policy, visual-configuration preservation and when/how drafts appear
publicly are still to be specified and proved. Arbitrary Gutenberg HTML,
plugins and theme customizations cannot be assumed to round-trip losslessly.

For ordinary blog/articles, the owner still prefers a constrained, consistent
WordPress editorial experience (a principal article body/design area,
featured image and necessary title/SEO/editorial metadata), rather than
rebuilding each post with arbitrary layouts. Core remains responsible for
governed article information, provenance, optimization and release history.
Specific blog template/editor limits remain open for practical testing.

This clarification further specifies, rather than replaces, the existing
commitment to Gutenberg for visual execution. The closed private signed
delivery proof is not proof of inbound synchronization, protection of edited
presentation or production publishing. No additional implementation or
hosted operations are authorized by this documentation alone.

## Appearance and CSS round-trip boundary

**Owner expectation, November 8, 2026; design for a bounded contract,
not arbitrary lossless WordPress theme synchronization.** The MioPages
WordPress plugin must participate in visual configuration as well as
content delivery: Core's approved design specification governs supported
theme/style choices (type, palette, spacing, layout/breakpoints), theme
templates and patterns, navigation/header/footer composition, media
presentation and permissible custom CSS. Prefer native WordPress
theme.json, Global Styles, block templates and registered settings/
capabilities where applicable. Theme and Appearance APIs/settings differ
among classic themes, block themes and third-party plugins, so enumerate
the supported distribution's concrete interfaces rather than promising
a universal bridge.

Capture authorized changes in supported WordPress Appearance/Site Editor
and Gutenberg surfaces as scoped versioned proposals with old/new
effective values, author/source, Core base revision and affected pages/
sections/sites. Core reviews and promotes approved revisions to the
managed site design specification, while later Core releases must preserve
those accepted refinements. Treat site-wide adjustments differently from
page-level overrides; detect unmanaged custom CSS, unsupported theme
options, third-party plugin changes, stylesheet modifications and
incompatible theme switches as divergence requiring review, not silent
auto-import or overwrite. Govern editability and release authority
centrally, enforcing WP-side privileges too. Initial integration is
limited to a known standardized controlled WordPress distribution;
external themes/plugins may require explicit adapters or remain
unsupported. These are desired design boundaries, not implemented
capabilities.

**New WordPress page/section approval:** An authorized Operator may
create a page or section in Gutenberg, but plugin capture forms a
pending structured addition to Core with source provenance. It does not
become managed canonical site structure or automatically public simply
because saved in WordPress; Core approval and governed release remain
required. Exact WP draft/publication guards must be proved in the
supported distribution.

## Observed WordPress reality and configuration reconciliation

**Owner-approved direction, November 8, 2026; detailed implementation pending.**
For the controlled standardized WordPress distribution, Core must retain enough
information to account for the *actual* WordPress site, even when Core cannot
independently reproduce every visual setting or WordPress rendering behavior.
Do not conflate "Core specification is known" with "live WP output is verified."
Core remains authoritative over supported site design/content and approved
releases, while WordPress is the real rendered surface reviewed by Operators.

Build the plugin around a versioned **observed configuration manifest** per
installation/site, with stable identifiers and timestamps for the active
theme and relevant versions, managed plugins/versions, theme/global style
configuration and supported appearance settings, page/section/template/
navigation identities, relevant CSS and customization references, release
identity and source/version/provenance. The manifest should distinguish
canonical Core-managed structured settings from locally observed state.
Capture supported changes through scoped events/versioned proposals and
periodic reconciliation to catch unsupported or missed mutations. Record
what changed, where, when, by whom if attributable, previous/observed
versions and whether the change has been approved and incorporated into Core.
When an edit cannot be understood as structured Core design, preserve a
bounded auditable record and its preservation/conflict rule rather than
pretending to round-trip its rendering semantics. Define safe storage,
access, and retention for potentially sensitive configuration data.

Show simple operational states (at least **verified in sync**,
**known change awaiting review**, **unmanaged/unsupported difference**,
and an explicit **unknown/not recently verified** state). A status reflects
the last successful observed comparison, not perfect visual fidelity.
Visual acceptance must use WordPress frontend pages and, when justified,
responsive/browser captures and human review. A verified manifest or
checksum alone does not prove the design renders correctly. Discrepancy
classification should generate work only when meaningful and avoid
operator-facing noise.

Do not claim to detect arbitrary changes made outside the supported
surface with perfect accuracy. Prefer a known, versioned block theme
and controlled plugin footprint initially; identify the minimum verified
WP APIs, hooks, setting snapshots, permission boundaries and hash/drift
checks for Commercial V1. Define a tested merge/preservation contract
so that legitimate accepted local refinements survive Core updates and
rollback while unexpected divergence cannot silently become approved
Core state or be silently overwritten. At ~100 installations, event
capture plus scheduled verification should remain efficient.

**Automatic capture, no Operator bookkeeping (owner clarification, November 8, 2026).** Authorized WordPress customizations, including supported custom CSS and Appearance changes, should be observed and recorded by the plugin **without an Operator manually reporting or registering them**. Prefer scoped hooks/events with stable source identity, before/after values or hashes, actor when attributable, timestamps, affected surfaces and revision lineage; supplement with scheduled configuration reconciliation to discover missed or out-of-band changes. Recording is not the same as approving a business claim, accepting a design revision into the canonical specification, or authorizing publication. Preserve legitimate local work during pending review where safe; if a customization is unsupported or cannot be preserved confidently across release/rollback, clearly flag the exception and recommend a bounded resolution. Do not promise universal observation of arbitrary direct file/database or third-party changes. Keep routine collection invisible to Operators and surface only actionable exceptions.

## Content ownership and Gutenberg protection

The owner clarified the presentation direction on November 7, 2026. For WordPress
delivery, use Gutenberg, native themes, patterns, templates, blocks and styling
tools for most visual composition and refinement. The native renderer established
useful business, content and structural concepts. Keep those in Core and use
WordPress's existing tools for visual execution. A proprietary Core page builder
is outside this direction. Authorized Operators and designers need practical latitude to refine presentation within supported ownership and
service boundaries. MioPages offers managed outcomes without a pixel-perfect
customization commitment.

Core retains canonical content and business knowledge, approvals, optimization
intelligence and release coordination. Define which presentation changes may be
made locally, which regions are Core-managed and what authority applies to each.
Before implementing the affected editing flow, define the preservation and
conflict contract. Before enabling the flow, verify that legitimate refinements
survive a managed update and rollback, that unauthorized changes are refused or
surfaced as divergence, and that stale or conflicting changes have a review path.
The ownership mapping, synchronization and V1 placement remain open. Signed
private staging established transport and delivery controls. Presentation
preservation remains to be designed and verified.

- Turnkey managed sites: Core owns the managed page tree, managed content and approved release configuration. Evaluate explicit presentation boundaries for authorized local refinements.
- Use server-side WordPress capability checks to protect managed content, plugin configuration and release markers. Review all write entry points, including Gutenberg, REST, XML-RPC where enabled, CLI and imports.
- Use Gutenberg `templateLock` / block locking for **operator ergonomics only**; the plugin must validate content ownership in server-side permissions and publish actions. Prefer immutable managed renderer/blocks or plugin-controlled post types as appropriate to avoid uncontrolled block HTML drift.
- An agency/connected-site mode, **deferred**, distinguishes local/agency-owned regions from named MioPages-managed sections and defines conflict/drift policy. Do not overwrite unrestricted existing theme content.
- Code/theme customization rights cannot be taken away from a site owner who controls hosting; the architecture should fail closed on publish, detect divergent local state, and explain corrective options.

## Pending media delivery architecture

Recommended for review. Keep authoritative Asset identity, approved master bytes,
provenance, rights, usage and release/synchronization history in Core. Evaluate
optimized WordPress Media Library delivery copies for Gutenberg workflows and a
usable independently hosted exit. WordPress already provides attachment identity,
media metadata and URLs. A standard WXR export omits attachment bytes, so a usable
exit must include authorized media files and resolved references.
[WordPress Media reference](https://developer.wordpress.org/rest-api/reference/media/)
and [WP-CLI export reference](https://developer.wordpress.org/cli/commands/export/).

Local copies add storage, rendition/backup costs, attachment drift and
synchronization work. Externally served media avoids duplicating bytes and can
make centrally enforced withdrawal simpler. It also makes rendering dependent
on a reachable authorized origin and requires an explicit export/rewrite for
portable exit. Prefer testing the hybrid path for managed images whose rights
permit copying. Evaluate externally served media where size, licensing or
delivery policy favors it. Measure actual storage, operator effort and portability
before choosing the production policy.

A future contract should map installation and attachment IDs to Core Asset IDs,
approved usage, exact derivative digests and release versions. Signed releases
should declare media expectations and verify bytes before staging completes.
Replacements need distinct byte identities and atomic binding changes. Rollback
may restore eligible prior mappings only. Revocation must withdraw affected
managed references and copies under an explicit cache/retention policy. Once a
copy leaves managed custody, Core cannot guarantee its removal. Authorized
WordPress-originated uploads can be source inputs through the same staged
validation, rights and approval lifecycle. Attachment edits or uploads do not
establish canonical authority. Preserve customer-controlled media on connected
sites and respect the [usable exit contract](web-presence-service-model.md#customer-ownership-and-understandable-exit).

Production storage, attachment synchronization and inbound editorial scope
remain pending. This decision review leaves the existing text-only WordPress
staging gate in place.

## Chosen reference fixture: accepted service-led v3 C0

Operator clarification (2026-11-02): the first WordPress rendering and transport proof **must use the newest human-accepted C0 design**, **A Business in Focus / service-led v3**, not the older synthetic C0 deployed on 20i. The authoritative review/promotion documentation is [reviewed canonical promotion](miopages-canonical-promotion.md), with frozen reviewed source at `scripts/customer-updates/miopages-focus-reviewed.json`. Expected four routes: `/` (5 Sections), `/service` (8), `/experience` (5), `/review` (5), totalling **23 Sections**; approved Source Sans 3 typography and palette; two eligible wordmark assets. The five unresolved media needs remain unapproved, so never fabricate/insert FPO imagery, historical proof, or a pretend functional Review form. The canonical release must enforce existing confirmed-content and media eligibility boundaries. The v3 promotion's frozen development preconditions **do not match** the hosted fresh PG17/16-migration C0 state; **do not replay its operator against the hosted database**. Construct and verify a read-only/exported deterministic fixture from reviewed code and development test data, with no hosted database changes. This tests visual fidelity and content semantics, not authorization for commercial public launch.

## Operator Gutenberg editing as an inbound knowledge proposal channel (2026-11-03)

**Pending owner decision recovered from November 5.** Decide Commercial V1 inclusion
before starting inbound native editing development. Compare deferral with a bounded
operator workflow for an editorial draft and one structured knowledge-backed type.
Resolve editable posts, pages and descriptions, edit ownership, review authority,
dependent surfaces, version conflicts and synchronization. The approved presentation
direction leaves this inbound editorial scope decision open. Outbound delivery
retains its own authorization. Native edits can propose a change for review. Changes to
canonical knowledge require existing trusted authority and approval.

**Historical exploration.** Evaluate WordPress's native editor for authorized MioPages operator-authored content-form knowledge (posts, pages, CPT entries). This proposed editorial adapter preserves Core's canonical authority and managed-page protection.

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
