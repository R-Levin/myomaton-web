# MioPages platform and service architecture

## Purpose and authority

MioPages is the product/system. Hosting, domain registration, DNS, mailbox email,
payment/billing and infrastructure vendors are replaceable services used by
MioPages. The operator's existing access to the 20i reseller ecosystem makes 20i
a practical initial provider candidate, not the definition of the product.

**MioPages is the system. 20i is one provider MioPages can use.**

This document establishes long-term logical service and deployment boundaries. It
does not assert that the described services are implemented, select final vendors
or authorize production activation. The [service model](web-presence-service-model.md)
owns customer outcomes and responsibilities; [platform capabilities](platform-capabilities.md)
owns capability scope/status; the [architecture register](deferred-architecture.md)
owns implementation gates. This contract makes provider independence and interface
ownership explicit while leaving provider procedures to later integration runbooks.

## Architectural principles

- Deliver a managed service with bounded customization, not bespoke site-building;
  preserve the [service model](web-presence-service-model.md) and customer ownership.
- PostgreSQL remains the database architecture. Launch for 100+ customers uses
  many hostnames → shared runtime (or small shared pool) → immutable request-scoped
  tenant context → shared PostgreSQL → strict isolation. C0/C1 is the initial
  same-process proof; see [shared routing](shared-hostname-routing.md).
- Confirmed business knowledge is distinct from intake, inference and Review
  recommendations. [Canonical authority](canonical-foundation.md) and
  [content authority](content-authority-and-editing.md) govern promotion.
- Content approval, release and go-live are separate authorities under the
  [journey](customer-journey-and-change-management.md) and
  [readiness](progressive-onboarding-and-launch-readiness.md) contracts.
- [Managed recovery](managed-postgres-recovery.md) verifies application-owned state
  and provider dependencies without pretending to recreate provider infrastructure.
- Keep the core domain provider-neutral. Organizations, Web Presences and Managed
  Sites must not depend on 20i vocabulary, identifiers or implementation assumptions.
- Use a centralized MioPages control plane with MioPages-owned operator and
  customer experiences. Managed Site delivery is operated by MioPages.
- Integrate ancillary services through explicit provider boundaries. An existing
  customer need not move domain registration, DNS, email or an existing website
  merely to use MioPages.
- Normal delivery of an already-provisioned Managed Site should not depend on
  synchronous availability of a registrar, billing/mailbox provider, HostShop or
  similar ancillary integration. Represent synchronization/provisioning failures
  as scoped operational state rather than automatically causing site outages.
  Exceptions include providers supplying required runtime infrastructure.
- Preserve customer ownership, practical portability and understandable exit.
  Infrastructure dependence must not become unnecessary customer lock-in.
- Fail closed in production when identity, ownership, authorization, configuration
  or readiness is missing. A working development deployment is not launch authority.
- Prefer bounded structured configuration to arbitrary script/code injection.
  Provider configuration is not permission to execute customer-supplied code.
- Services may initially coexist on one managed server while remaining logically
  separable. Later movement of a component should not require product redesign.

## Logical service layers

### MioPages control plane

The control plane is the canonical MioPages application. Its responsibilities
include the operator console; prospect intake; the Free Web Presence Review
workflow and evidence/operator review; organizations, Web Presences and Managed
Sites; structured business knowledge/content; Pages, Sections, Actions and Assets;
customer approvals; provisioning/orchestration; analytics/reporting; service status;
and a minimal Commercial V1 customer portal, with broader self-service later.

These responsibilities describe the architecture, not a claim of current general
self-service or automation. The application must not become a skin over a hosting
provider's control panel. Provider responses inform scoped integration state;
they do not replace MioPages business truth, approvals or authorization.

### MioPages data/services

PostgreSQL, background jobs/workers, immutable revisions/audit history, Review
evidence, Assets/generated artifacts, configuration and backup/recovery are
distinct architectural responsibilities. They may initially share infrastructure,
but their ownership, access, retention and recovery boundaries remain explicit.

Review evidence remains distinct from canonical customer knowledge. The current
[Review implementation](free-review-synthesis.md) uses immutable local development
packets/revisions; this architecture does not imply shared production Review storage.
Immutable history is subject to authorized retention, not a permanent-archive promise.

### Managed Site delivery

Delivery serves rendered customer sites and preview/staging destinations. It owns
host/custom-domain routing, TLS/HTTPS, deployment state and content serving from
the appropriate approved/configured state. It may initially run alongside the
control plane, but the delivery role remains separable.

The current [shared routing contract](shared-hostname-routing.md) resolves hostnames
to exact tenant context and has local C0/C1 proof. The older
[Page routing contract](managed-site-routing.md) also documents nonproduction
single-site compatibility. Hosted proxy/CDN/TLS, deployment orchestration and
production authorization remain separate gates.

### Ancillary customer infrastructure

Domain registration, DNS, customer mailboxes, optional traditional hosting,
WordPress or another external CMS/content engine, external CRM and analytics/search
integrations may support a customer's Web Presence. MioPages may provision or
manage them when useful and authorized. They need not be supplied by one vendor,
and an existing customer service may remain in place.

## Interface boundaries

### MioPages Operator

The operator console is the operating interface for prospects/intake, Reviews,
evidence/QC, customer/Web Presence administration, content, Managed Sites,
analytics/results, provisioning/service state and operational controls. Appropriate
roles and authorization govern actions; infrastructure access alone is insufficient.

### MioPages Customer

The minimal Customer Portal is required for Commercial V1 and remains incomplete.
Its narrow responsibilities are onboarding/interview access, site/content review,
corrections/feedback, exact approvals, current service/site status, concise reports,
change/support requests and links/handoff to HostShop account/billing functions
where supported. HostShop is the preferred account/billing bridge where practical;
its actual capabilities and integration still need verification.

Full native billing, CRM, sophisticated account administration, unrestricted page
building and broad self-service infrastructure administration are outside V1.
Customers manage business information and outcomes. Portal access requires scoped
customer authentication/authorization; a prospect or provider login does not
establish customer authority. The [customer journey](customer-journey-and-change-management.md)
and [onboarding contract](progressive-onboarding-and-launch-readiness.md) retain
their distinct approval and commercial boundaries.

### Provider control panels

Hosting panels, registrar interfaces and mail administration remain infrastructure
tools. They may be used by authorized operators or customers for appropriate
provider-specific tasks; they are not the MioPages product interface. A provider
account/login does not establish MioPages organization membership or application access.

## Domains

Represent domains generically, supporting both customer-owned/existing domains
retained at their current registrar/DNS provider and MioPages-assisted registration
or provisioning through a provider such as 20i. The customer should remain the
registrant/owner wherever practical, with authorized management delegated as needed.

The conceptual representation includes the domain, registrar/provider, external
provider identifier, DNS provider, verification/status and connection to a Web
Presence/Managed Site. External identifiers belong to scoped integration records,
not core business identity. A "20i domain" must not become a core domain object.
These are modeling constraints for future work, not a new schema in this checkpoint.

## DNS and TLS / HTTPS

The current launch policy prioritizes streamlined onboarding and low operational
burden over minimum certificate price. It supersedes the earlier requirement for
self-managed ACME at launch, while preserving provider-neutral product boundaries.

- **Default:** where reasonably appropriate for the customer, use 20i authoritative
  DNS and the included 20i wildcard SSL as the simplest operating path.
- **Established-presence exception:** retain existing authoritative DNS when moving
  it would create unnecessary responsibility. Initially prefer the simplest
  20i-managed paid SSL option that works with external DNS. MioPages may absorb a
  modest annual cost initially; a later transparent pass-through requires appropriate
  commercial agreement, not a silent price change.
- **Deferred options:** self-managed Let's Encrypt/ACME and Cloudflare for SaaS are
  not launch dependencies. Revisit if external-DNS exceptions become common, paid
  SSL expense is material, or automation demonstrably reduces long-term cost/risk.

This records intended policy, not verified provider entitlement or configured TLS.
Hosted proof must verify the selected product's actual hostname coverage, DNS
requirements, runtime/proxy integration, issuance, renewal and failure behavior.
The public Host/tenant contract still applies. No certificate/provider is provisioned
or permanently selected by this document.

Moving substantial authoritative DNS can create responsibility for Microsoft 365 /
Google Workspace, SPF/DKIM/DMARC, third-party applications, verification records,
subdomains and unrelated infrastructure. A full transfer is acceptable when simple
and appropriate, but is not an unconditional MioPages requirement merely to obtain
SSL. Inventory affected records/services, confirm ownership and authorize changes
before cutover; preserve existing mail and other services. Track exceptions in
[cost-to-serve reviews](service-operations-model.md#cost-to-serve-and-provider-expenses).

## Email

### Customer mailbox email

A mailbox such as person@customer-domain.com is ancillary customer infrastructure.
It may use 20i, Microsoft 365, Google Workspace, another provider or an existing
customer system. MioPages must not require mailbox migration. Connecting a Managed
Site must account for preserving existing mail-related DNS and service continuity.

### MioPages transactional email

Intake confirmations, Review-ready notices, lead/operator notifications,
authentication/reset messages and service notices are application delivery concerns.
They belong to the MioPages platform and should use a centrally configured
transactional SMTP/API delivery provider, with appropriate identity and delivery controls.

Customer mailbox hosting and transactional application delivery are separate roles,
even if one vendor can supply both. This direction does not activate mail delivery;
the current Review slice has no delivery implementation.

## Billing, commerce and entitlements

20i HostShop is an initial integration candidate for customer accounts, contracts,
recurring billing, invoices, payment processing, domain/hosting provisioning and
communications/support functions. These are potential uses, subject to capability,
API, terms and operational review, not assertions of a verified integration.

HostShop must not become the canonical definition of a MioPages organization,
Web Presence or service entitlement. MioPages should maintain provider-neutral
internal service/entitlement state, keeping external financial status distinct
from the reviewed business rules that grant or change service access.

Billing integrations can record provider, external customer/account ID,
subscription/contract ID, payment/billing status and synchronization state. This
permits replacement or coexistence with another billing system without changing
the core domain model. It does not require building a billing engine now or imply
that synchronization and entitlement enforcement already exist.

MioPages should avoid storing raw card/payment credentials. Payment instruments
should remain with the payment/billing provider wherever practical; MioPages should
retain only the provider references, billing/payment status and service/entitlement
information it actually needs.

## Provider adapter boundaries

Conceptual boundaries include DomainProvider, DnsProvider, MailProvider,
HostingProvider, BillingProvider, DeploymentTarget and TransactionalEmailProvider.
20i may be the first implementation of several roles; separate vendors can also
fill different roles for the same customer.

These names describe responsibilities, not a requirement to create interfaces,
classes or a generic framework immediately. Add concrete adapters when an actual
integration requires them; generalize further when a second implementation or
concrete need justifies it. MioPages owns its domain model and isolates provider
vocabulary/configuration. Provider independence does not require pretending that
all providers have identical capabilities. Unsupported operations remain explicit.

## 20i initial role

20i is a strong practical first provider candidate for domain registration, DNS
where appropriate, customer mailboxes, traditional/shared hosting where required,
WordPress hosting where appropriate, and HostShop billing/provisioning. Managed,
cloud or VPS infrastructure for the MioPages runtime is another possibility to evaluate.

These are provider/deployment choices, not product-domain assumptions or verified
service entitlements. The preferred hosted proof is 20i Managed Cloud for the
shared runtime with Supabase managed PostgreSQL. Neither is permanently selected
or provisioned for this proof. Existing reseller access is useful, not a dependency.

## Core runtime / server

MioPages requires a server/cloud application environment capable of running the
central platform and Managed Site delivery. Prefer a managed server/cloud service
over unnecessary low-level infrastructure administration when cost and control are
acceptable. Managed hosting still requires accountable security, monitoring and recovery.

The preferred proof separates the 20i application runtime from candidate Supabase
PostgreSQL. Protected colocation remains an architectural option, not the current
proof plan. Logical separation does not always require separate machines.

Scale or reliability needs may later separate PostgreSQL, workers, object/Asset
storage, Managed Site delivery and application/control-plane nodes. Deployment
configuration and interfaces should allow that movement without redefining the product.
No compute provider, server sizing or mandatory permanent colocation is selected here.

## Identity and access

Allow distinct roles/scopes for MioPages operators/admins, customer organization
users, prospects/intake participants and service/integration identities. Keep
customer isolation and operation-specific authorization explicit. Provider
credentials and provider control-panel identity remain separate from MioPages
application identity; no identity is inferred from matching account names or domains.

This document does not design the complete authentication/authorization system.
The [security contract](security-operations.md) and existing gates continue to apply.

## Data, backups and recovery

MioPages controls and is operationally responsible for its PostgreSQL/application
state independently of ancillary provider models. Customer/business data must
remain recoverable without the continued availability of one ancillary provider.
Preserve customer isolation and appropriate immutable/auditable records, with
bounded retention and protected secrets.

The [backup/recovery baseline](backup-recovery.md) records local development
backup and isolated restore proof. That proof is not off-machine/cloud resilience
or production readiness. Off-machine backup, including AWS/S3 or an alternative,
remains a separate deployment concern. Restoration must be provable, including
applicable database state, Asset bytes, configuration and separately protected
credentials; a successful backup command alone is insufficient.

Use the detailed recovery contract rather than duplicating its procedures here.
Customer ownership/export and service exit remain governed by the existing service
contracts; provider choice must not make data inaccessible or unrecoverable.

## External content / CMS and adoption modes

MioPages may coexist with an existing WordPress or other web/content presence.
An external CMS/content engine can be used where valuable, but it is not the
canonical MioPages business/domain model. Preserve platform-managed content and
business knowledge under MioPages authority; distinguish externally managed content
and resolve divergence rather than silently overwriting external edits.

The adoption modes remain full MioPages Web Presence, adjunct to an existing
presence, and campaign-focused deployment. They share the architecture, with
explicit URL/content ownership, forms and measurement coordination. Native Articles
remain the intended baseline; optional external engines follow the
[onboarding/content contract](onboarding-optimization.md#native-articles-and-optional-external-engines).

## Non-goals

This architecture does not require building a hosting control panel, registrar,
email service, full CRM or complete accounting/billing engine. It does not call
for adapters for every hypothetical provider, select final production infrastructure,
migrate every existing customer service into MioPages or require 20i.

## Decisions now and choices deferred

| Established now | Intentionally deferred |
| --- | --- |
| Provider-neutral MioPages core and centralized control plane | Production compute provider and exact VPS/server sizing |
| MioPages-owned operator and customer interfaces | Full identity/authentication/authorization implementation |
| Generic domain/provider representation; existing customer services can remain | Final DNS automation strategy and concrete domain/provider integration |
| 20i DNS/included wildcard SSL default where appropriate; external-DNS/paid SSL exception | Actual hosted coverage/renewal/proxy proof; self-managed ACME and Cloudflare for SaaS deferred |
| Customer mailbox email separate from transactional email | Transactional email vendor and delivery implementation |
| Provider-neutral service/entitlement state and billing-provider boundary | Final billing integration, synchronization and enforcement |
| 20i Managed Cloud preferred for the shared-runtime proof, not a permanent dependency | Hosted feasibility and final production selection |
| Separable data, delivery and recovery responsibilities | Object storage provider and AWS/S3 or alternative off-machine backup implementation |

## Current implementation and next boundary

Verified implementation checkpoint: `7bd79c02048e7537074463fc148122fc728dc7a1`,
Add managed PostgreSQL compatibility and recovery. Shared development is PG18.6,
16 migrations (0000–0015), zero pending; hostname/activation/proposal/release domains
are empty. Five live managed objects remain unchanged. Development intake and local
Review approval are implemented; Draft D Revision 3 is APPROVED and undelivered.
Earlier Review-frontier notes are superseded by this summary and the domain docs.

PG17.11 bootstrap through 0015, managed roles/workflows, PG17→PG17 and PG17→PG18
logical recovery, PG18 controlled recovery and C0/C1 isolation are proven locally.
They do not prove provider permissions, production authentication or hosted capacity.
The next execution boundary is a separately authorized synthetic hosted proof after
this documentation review/checkpoint. No external provisioning is authorized by
this document. The [deferred register](deferred-architecture.md) owns remaining work.

## Commercial V1 scope and development sequence

Commercial V1 must onboard a paying customer, interpret structured business
knowledge and generate a largely near-finished professional site for operator QA
and customer approval; publish safely, capture leads/actions, measure useful
first-party activity, report understandable results, propose operator-approved
improvements and maintain the site safely. This is completion of the existing
platform, with production proof still outstanding, rather than a greenfield build.

Reusable foundations already include Organization / Web Presence / Managed Site,
structured Knowledge / Offerings, Pages, Sections, Navigation, Actions / CTAs,
Visual Direction, responsive rendering, managed Assets / AssetUsage, multi-page
initialization/generation, proposal / preview / exact approval / release / rollback
and hostname-based shared delivery. Versioned/resumable intake, immutable
submissions, activation/customer foundation and canonical confirmation also exist
within their documented development/disposable boundaries. PG17/PG18 compatibility
and recovery are implemented locally; hosted operation remains unproven.

The remaining generation work is completion/orchestration:

**confirmed onboarding knowledge → AI interpretation → site/page plan → supported
Page/Section selection and composition → draft copy → SEO preparation → media
selection/recommendations → unresolved-gap flags → near-finished candidate →
operator QA → customer approval → authorized release**.

Practical V1 AI assistance covers intake interpretation, gaps/ambiguities, site
architecture, copy, supported Section composition, SEO metadata/preparation, media
recommendations, subsequent revisions and improvement recommendations. Confirmed
facts retain their authority; claims, preferences, AI recommendations and gaps
remain distinct. Operator QA and existing approval/release authority are mandatory.
Autonomous publication and sophisticated autonomous optimization remain deferred.

Use this development sequence under the existing readiness and deferred gates:

1. **Hosted foundation — immediate:** separately authorized 20i Managed Cloud,
   Supabase managed PostgreSQL and AWS independent backup proof; shared C0/C1
   runtime, TLS/DNS, persistent media, deploy/restart/recovery, actionable monitoring
   and capacity observations. Provider selection alone is not operational proof.
2. **Production authority:** operator authentication, scoped production authorization
   and protected management operations before production management exposure.
3. **Commercial intake + generation completion:** full structured interview, confirmed
   knowledge/gaps, AI interpretation, site/page plan, near-finished multi-page
   generation, copy/SEO preparation, customer media upload, practical provider-neutral
   stock sourcing (Pexels is the first candidate) and operator QA.
4. **Minimal customer portal:** onboarding, review/corrections, approvals, status,
   concise reporting, support/change requests and supported HostShop account/billing
   handoff. Customer access must satisfy P7 before exposure; later reporting and
   publication capabilities complete the end-to-end portal flow.
5. **Production publication + conversion:** proposal, exact approval, authorized
   release, rollback, one reliable visitor conversion path, Contact/lead durable
   acceptance and delivery state, verified customer/operator handoff and operational
   communications sufficient for onboarding, approvals and support. Apply existing
   abuse, privacy and retention controls; CRM and Mailchimp are not dependencies.
6. **First-party measurement + improvement:** site/activity/Action collection,
   normalized metrics, Performance Snapshot, recommendation, AI-assisted revision,
   operator approval, release and remeasurement. Stage 5 verifies production
   mechanics; first-party collection/reporting must be ready before real go-live.
7. **Commercial V1 rehearsal:** prove prospect → Free Review/direct start → commercial
   commitment → full intake → confirmed knowledge → near-finished generation →
   operator QA → customer approval → release → lead/action → reporting → improvement
   → rollback/recovery, with evidence for each applicable readiness gate.
8. **C0 then Customer #1:** move real miopages.com onto MioPages only after hosted
   proof/readiness; use C0 as the first real production proving ground, then onboard
   the first external paying customer.

Ordinary sites should emerge near-finished. Operators review, correct/refine,
resolve exceptional gaps, make judgment calls and prepare/approve the customer
candidate; routine page-by-page manual assembly is not the delivery model. Quantify
operator time and cost-to-serve from future real operations rather than assumptions.

Commercial V1, shortly-after-V1 refinements and later expansion remain distinct in
[the existing register](deferred-architecture.md#commercial-v1-and-later-boundaries).
For Commercial V1 scope/status, this section and the current specialist contracts
in readiness, measurement, media, operations and the deferred register supersede
older interview-deferral, future-portal and Google-primary wording in the capability
catalog, onboarding, customer journey, service model, C0 and historical slice notes.
Their approved technical/authority contracts remain in force. This sequence changes
scope/priorities, not schema, runtime behavior or authority to provision/publish.

## Recent durable decisions

These concise records preserve the accepted direction and rationale; they are not
provider entitlements or claims that hosted tests have run.

| Decision | Rationale and boundary |
| --- | --- |
| Retain PostgreSQL over MariaDB after the portability audit | Current integrity depends on PostgreSQL JSONB, PL/pgSQL guards, deferred constraints, advisory locking and migration/recovery semantics. A MariaDB move would require porting and re-proving these contracts rather than replacing a connection setting. It is not the current launch path. |
| Shared runtime rather than one deployment per customer | Central deployment/patching and a shared pool avoid per-customer runtime overhead and maintenance. The 100+ customer model requires strict isolation and explicit shared-platform blast-radius review. Capacity remains unproved. |
| Hostname-based tenant resolution | Many customer domains must resolve an exact active Web Presence/Managed Site per request. Global mutable tenant selection and browser-supplied tenant IDs cannot grant scope. |
| C0 plus distinct C1 in the initial same-process proof | A single customer cannot demonstrate refusal of cross-tenant data/media or cache/context leakage. MioPages alone is insufficient evidence. |
| Prototype Supabase before committing to a self-managed 20i PostgreSQL VPS | Seek reduced database administration while preserving standard PostgreSQL and application-owned recovery. Acceptance depends on the hosted proofs below. If required permissions, connectivity, recovery or capacity cannot be met safely, review the 20i PostgreSQL DB VPS fallback and its administration burden with the human owner; do not provision it automatically. |
| Prefer the 20i application/hosting ecosystem | Existing reseller relationship and useful hosting/domain/mail infrastructure justify evaluating Managed Cloud first, without making provider vocabulary or APIs product dependencies. |
| AWS is available for independent off-provider backup | A separate failure domain can reduce dependence on the application/database provider. Availability of an account is not configured backup, approved spend or verified recovery. |
| Separate application recovery from provider infrastructure | Own and verify application schema/data/history/media and required privileges/dependencies. Provider roles, extensions, settings and services require explicit target contracts, not a claim that MioPages owns or can clone the provider cluster. |

The preferred synthetic proof remains **20i Managed Cloud → shared MioPages runtime
→ Supabase managed PostgreSQL**, with **AWS off-provider backup** as the independent
recovery direction. No external resource has been provisioned for that proof.
The 20i self-managed PostgreSQL VPS remains fallback; Cloudflare for SaaS is optional
and self-managed ACME is deferred under the SSL policy above. These directions do
not grant provisioning or spending authority.

Commercial V1 requires MioPages-owned first-party measurement and a restrained
Performance Snapshot. GA4/Search Console are optional later enrichment, outside
the critical path. If separately pursued, measurement access direction belongs to the
[measurement contract](measurement-and-analytics.md#service-accountproperty-grant-hypothesis):
operator-assisted/server-to-server access first, customer-facing OAuth deferred,
with external access proven separately from V1 reporting. The
[service operations model](service-operations-model.md#cost-to-serve-and-provider-expenses)
owns cost-to-serve review; [business readiness](progressive-onboarding-and-launch-readiness.md#business-readiness)
owns the sole-proprietor starting direction and professional/operational obligations.

## Human and AI operating charter

The human product owner retains product, commercial, customer and acceptable-risk
authority, including explicit authorization for material infrastructure, commercial
and destructive actions. ChatGPT supports continuity, architecture, sequencing,
synthesis, review, thread checkpoints and conversion of business intent into bounded
tasks. Codex performs bounded inspection, implementation, tests, verification and
evidence/reporting. AI assistance has no independent production authority.
Material customer, infrastructure, commercial or destructive actions require
explicit human authorization for that operation and environment.

| Operation | Authority boundary |
| --- | --- |
| Analyze / inspect | Read-only evidence gathering within authorized scope; access is not permission to change state. |
| Propose / prepare | Produce a reviewable recommendation or artifact; neither authorizes execution. |
| Approve | Accept the identified substance/revision/scope, not every adjacent operation. |
| Provision / incur cost | Explicit human authorization for the resource, environment and material expenditure. |
| Mutate / migrate | Explicit authority for the affected customer/data/schema operation and environment; honor baseline/refusal guards. |
| Restore | Isolated rehearsal and destructive live restore/cutover are separate scopes; live replacement needs explicit human authority. |
| Publish | Content approval, release execution, external delivery and go-live retain their separate mandates. |
| Delete | Explicit human authority for material deletion, scope and recovery/retention consequences. |

Authorization already granted for a bounded task remains usable within that scope;
analysis/proposal or adjacent approval does not grant destructive or external-cost
authority. No project-management RBAC system is implied.

After launch the loop continues: **observe → analyze → decide → authorize →
implement → verify → release → monitor → learn**. Apply it to infrastructure,
performance, content, measurement, leads/conversion, recovery and provider changes.
Each actionable item needs an owner, evidence, scoped authority, verification and
follow-up; a manual record can suffice. Use the existing
[service cadences](service-operations-model.md#operating-cadences) and
[opportunity model](opportunity-and-optimization-model.md), not a parallel backlog.

## Hosted assumptions and proof questions

These are unproven facts, distinct from decisions and completed local proofs.
The human owner authorizes each proof; its bounded task identifies executor and
verification evidence. Failures return for a decision rather than silent adaptation.

| Question | Proof required | Consequence / decision | Revisit trigger |
| --- | --- | --- | --- |
| 20i Managed Cloud Node/runtime behavior | Deploy the reviewed build; verify supported runtime, startup and same-process C0/C1 responses. | Accept the runtime contract or reconsider hosting. | Authorized synthetic hosted deployment. |
| Outbound connectivity/egress | Verify app-to-DB DNS/TCP/TLS, restrictions and failure behavior without leaking credentials. | Accept topology or review a supported alternative. | Before hosted DB connection. |
| Persistent media | Verify durable byte storage, restart/redeploy behavior, access isolation and independent restore. | Select a proven storage contract; ephemeral disk is insufficient. | Before hosted media claims or real data. |
| Restart supervision | Verify process restart, logs, configuration recovery and owned failure response. | Establish a manual/managed supervision procedure. | Synthetic runtime proof. |
| Actual Supabase PostgreSQL version | Inspect actual major and capabilities; rehearse the pinned migration chain. | Use proven PG17/18 path or stop for compatibility review. | After separately authorized project creation. |
| Roles/default ACLs | Verify migration ownership, runtime/backup least privilege, default grants and future-object behavior. | Accept only a supported effective privilege model. | Hosted bootstrap and role proof. |
| TLS/network/direct versus session-pooler | Verify trust and network path, transaction/session/advisory-lock behavior and dump/restore access for the chosen endpoint. | Choose a tested endpoint; unsupported pooler behavior refuses. | Before hosted workflows or recovery proof. |
| Hosted recovery/provider exit | Export application-owned bundle plus media; independently restore and verify histories, privileges and C0/C1 isolation. | Accept recovery contract or review provider/fallback. | Before real hosted customer data. |
| Latency/connection pressure/capacity | Measure representative traffic, pool multiplication, locks, resource limits and isolation under load. | Size/bound the shared runtime; two tenants do not prove 100-customer capacity. | Synthetic hosted load proof and material scaling changes. |
| AWS backup integration | Verify protected access, independent destination, retention and usable restore with configuration/secrets recovery. | Accept off-provider resilience or review another destination. | Separately authorized backup setup, before relying on real hosted state. |
| Transactional email | Verify sender identity, delivery/retry/reconciliation, recipients and mail-DNS preservation. | Enable only the proven delivery scope. | Before public lead/Review/system email promises. |
| Production operator authentication | Verify caller identity, operation-specific authority, tenant isolation and credential/session lifecycle. | Keep management private until verified and authorized. | Before exposing production management. |
| 20i default/exception SSL operating paths | Verify actual included wildcard coverage and a managed paid option usable with external DNS, renewal, proxy behavior and service-preserving DNS changes. | Accept a proven low-burden path or return for a decision; no forced zone transfer or automatic ACME/Cloudflare adoption. | Authorized hosted TLS proof and before each customer domain cutover. |

## External resource inventory

**No 20i/Supabase/AWS test or production resources have been provisioned for this
hosted proof as of this reconciliation. The inventory below is intentionally empty.**
Existing 20i account access and operator-stated AWS availability are account context,
not resources created by this project checkpoint. This is not an account-wide audit.

Distinguish **available account**, **candidate**, **authorized to provision** (a
specific human decision), and **provisioned** (an observed resource). Candidate
selection is not provisioning authorization. Supabase remains a prototype candidate.

| Provider | Resource | Environment | Region | Purpose | Non-secret identifier | State | Owner | Dependencies | Data classification | Recovery role | Replacement / decommission reference |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Future entries may include role names, domain/hostname assignments, backup
destinations and certificate boundaries, or link to a reviewed non-secret record.
Git holds durable metadata/decisions. Passwords, API keys, connection strings,
private keys and recovery material belong in approved protected storage/provider
accounts, never this table. Temporary test URLs/processes and detailed logs belong
in restricted ignored local state, not the durable resource inventory.

## External provisioning checkpoints

For each material provider change, record resource/provider/environment/region,
non-secret identifier, purpose, dependencies, accountable owner, current state,
authorization scope, synthetic versus real data, verification/evidence, remaining
unknowns, backup/recovery responsibility and rollback/replacement/decommission
procedure. Update the inventory and link relevant domain runbooks; record the Git
source/configuration checkpoint and separately protected configuration dependencies.
An unsuccessful attempt still needs its actual resource state recorded.

Git records metadata and decisions; it does not itself provision or recover external
resources. A source checkpoint is not proof of live provider state. Readiness uses
the existing [state/responsibility model](progressive-onboarding-and-launch-readiness.md#launch-readiness-as-a-tracked-workflow).
No new management application, ADR framework or parallel work register is introduced.
