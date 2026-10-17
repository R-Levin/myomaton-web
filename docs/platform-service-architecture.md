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
and a future customer portal.

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

The current [routing contract](managed-site-routing.md) uses explicit deployment
selection. Production host/domain routing and deployment orchestration still require
their implementation and readiness gates; this document does not activate them.

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

The future customer interface should support appropriate business-level work:
reviewing/updating structured business information, submitting content/information,
approvals, results/reporting, leads where appropriate, service/domain status and
billing/service summaries or links. Customers should primarily manage information
about their business and outcomes, rather than website infrastructure.

This does not promise every function at launch or make a prospect an authorized
customer user. The [customer journey](customer-journey-and-change-management.md)
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

MioPages Managed Site HTTPS must not depend on 20i reseller wildcard SSL. For a
normal custom domain, the appropriate DNS record points the domain to the MioPages
delivery runtime. That runtime obtains and renews an appropriate certificate
automatically through a standard certificate/ACME mechanism. Certificate validation,
issuance, renewal and failure handling belong to Managed Site delivery infrastructure.

The customer's authoritative DNS may remain with 20i, Cloudflare, GoDaddy, another
registrar/provider or the customer's IT environment. Ordinary per-domain automatic
HTTPS must not require transferring DNS authority to 20i. Required validation and
record changes still need customer authorization and verified readiness.

The exact reverse proxy/certificate mechanism is deferred: no choice between Caddy,
Traefik, nginx/certbot, a cloud load balancer or another implementation is made here.
Provider-specific SSL products may help services actually hosted on those providers;
they are separate from MioPages Managed Site TLS architecture.

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
service entitlements. Whether the core MioPages runtime itself will be hosted on
20i remains undecided. Existing reseller access is useful leverage, not a dependency.

## Core runtime / server

MioPages requires a server/cloud application environment capable of running the
central platform and Managed Site delivery. Prefer a managed server/cloud service
over unnecessary low-level infrastructure administration when cost and control are
acceptable. Managed hosting still requires accountable security, monitoring and recovery.

An initial appropriately protected/managed environment may colocate reverse
proxy/TLS, the Next.js MioPages application, workers/background services and
PostgreSQL. Logical separation does not require separate machines on day one.

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
| MioPages-managed Managed Site TLS, independent of reseller wildcard SSL | TLS/reverse-proxy implementation |
| Customer mailbox email separate from transactional email | Transactional email vendor and delivery implementation |
| Provider-neutral service/entitlement state and billing-provider boundary | Final billing integration, synchronization and enforcement |
| 20i as useful initial provider candidate, not architectural dependency | Whether 20i hosts the central runtime or any particular ancillary service |
| Separable data, delivery and recovery responsibilities | Object storage provider and AWS/S3 or alternative off-machine backup implementation |

## Implications for current development

Continue product feature work without prematurely implementing provisioning
infrastructure. New schemas/services/interfaces must avoid assuming that all
customers use 20i, MioPages DNS or MioPages mailbox hosting; that HostShop is the
customer database; or that operator/customer identity equals provider identity.

The immediate product-development frontier remains:

1. Operator-friendly Prospect Q&A presentation.
2. Claim-level Review evidence/provenance presentation.
3. Durable question-wording context.
4. Subsequent human Review Revision 2.
