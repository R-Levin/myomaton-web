# Security, operations and recovery

This is the intended low-admin, low-blast-radius operating posture of the Web
Presence platform, not a claim of production security or disaster recovery
readiness. Implementation gates live in [deferred architecture](deferred-architecture.md).
The [capability catalog](platform-capabilities.md) and [onboarding/optimization
model](onboarding-optimization.md) retain their product and approval boundaries.

## Minimal public surface

A public Managed Site should expose only what visitors need: structured rendering,
managed media delivery, bounded validated forms/endpoints and intentional
analytics/event collection when those capabilities are implemented. Avoid public
privileged administration, unnecessary APIs/CMS endpoints, arbitrary executable
code, customer-installed plugins, arbitrary PHP/JS and HTML/script injection.
Constrained native Article bodies must remain safely validated/rendered; they do
not grant arbitrary markup or scripting capability.

The system may informally be called headless or decoupled. That label does not
make it secure. The advantage is minimal public privileged surface, structured
validated data, no per-customer arbitrary runtime/plugin capability, controlled
management interfaces and centralized maintenance. Vulnerabilities in application
code, dependencies, credentials or operations remain possible.

## Shared platform and customer boundaries

Prefer one shared application/platform, centralized deployment, monitoring and
security controls, and shared dependency maintenance over an independently patched
application stack per customer. One platform patch should benefit many customers.
Customer state must remain logically isolated with enforced authorization; a shared
platform is not permission to share customer access. Shared infrastructure also
concentrates risk and needs the isolation and recovery controls below.

Customers may manage approved structured business/content state. They may not
install executable extensions, run arbitrary server code, bypass validation,
access other tenants or change infrastructure/security controls outside permitted
policy. The [site-global policy foundation](site-globals.md#bounded-platform-policy)
is a bounded presentation capability flag, not security authorization. Future
automation needs operation-scoped permissions and approval; protected business
facts cannot be autonomously invented or silently changed.

## Management access and tenant isolation

Before production customer or operator management surfaces/APIs are exposed,
establish explicit authentication, server-side authorization, least privilege and
tenant isolation. Define operator/admin/customer roles as needed. Hidden URLs and
tenant-scoped queries alone are not authorization. Privileged management should
be separable from public site serving, even when code or infrastructure is shared.
Operator-assisted guided onboarding has the same access obligations; it is not
an exemption while customer self-service is deferred.

Cross-Web-Presence/Managed-Site access is a catastrophic defect class. Derive and
validate ownership throughout relationships. Data/media resolution and management
must fail closed for foreign references, missing/inactive records, ambiguous
identity or unauthorized actions. UUID knowledge is not permission. Review tenant
boundaries explicitly before multi-customer production, including routing, queries,
media, caches, management, background work and exports where present.

Current [routing](managed-site-routing.md) selects one explicit deployment; it does
not implement production host-based tenant selection (P9). Existing public active
content is not a private-content or draft/publish authorization model.

## Database privileges and canonical state

Separate normal runtime application credentials, migration/schema-admin execution
and operational/admin credentials. Grant runtime only needed data privileges;
schema administration must not be an incidental runtime permission. Scope
operational access to its task and keep credentials out of client responses.

Use reviewed, versioned migrations, isolated upgrade/fresh replay rehearsal,
coordinated application deployment and an explicit rollback/recovery plan. Consider
locking and application/schema compatibility, as in the [terminology cutover](managed-site-rename.md).
An application rollback does not undo a database migration or customer writes;
choose a compatible release, reviewed forward correction or recovery procedure.

PostgreSQL owns current customer state after initialization. Source-controlled
seed/bootstrap and historical transition definitions are neither ongoing authority
nor backups. Recovery must restore canonical state, not reconstruct it by rerunning
customer bootstrap or old transitions. Preserve the [bootstrap boundary](bootstrap.md).

## Assets and customer uploads

Before general customer uploads, review allowed types, actual byte/content
validation rather than filename extensions, bounded byte/pixel/resource limits,
ownership, non-executable storage and controlled delivery. Do not trust supplied
MIME, dimensions, paths or other client metadata. Assess malware scanning and other
security controls against supported formats and threat exposure; structural
validation alone is not malware clearance.

Keep managed Asset objects separate from application executable storage. Public
delivery must enforce eligibility and safe response behavior rather than expose
raw storage locations. Apply the [Asset integrity/storage contracts](assets.md),
including immutable object keys and association ownership. Existing operator
ingestion validates supported formats and bounds storage; it does not complete
authenticated customer upload hardening. In particular PDF validation is
structural, not removal of all active content or malware scanning.

## Public input and Contact

Before production Contact/forms, establish server-side validation, rate limiting,
spam/bot protection, abuse controls, safe submission/email handling and defined
privacy, access and retention. No arbitrary relay behavior: untrusted requests
must not select unrestricted recipients, headers or credentials. Lead/event
capture must not expose secrets. Future forms consume shared canonical contact
identity; current phone/email links and Contact Actions do not implement forms.
First-party analytics is canonical, but event endpoints are also untrusted input
and need bounded collection, abuse protection and privacy controls (P12).

## Secrets and repeatable deployment

Secrets/API keys must never enter Git or client-rendered data/bundles. Manage them
through deployment environments or a secret store, scope them minimally, support
rotation and isolate provider credentials where practical. Logs, diagnostics and
backup access must not become alternate credential-disclosure paths.

Use source-controlled application code, reproducible builds/deployments, explicit
environment configuration, versioned migrations and a recoverable release process.
Rehearse in staging/disposable environments where appropriate. Document compatible
application/schema versions and rollback steps. A lost application server should
be replaceable from code, configuration and deployment instructions, not contain
the only copy of customer state or Assets. Production storage must be persistent;
the development local Asset directory is not an ephemeral-host durability strategy.

## Backups and disaster recovery

Plan for hosting/server loss, bad deployment, database corruption, mistaken
operator action, compromised credentials and Asset-storage failure. Recovery covers:

- Application code and a known deployable release.
- Canonical PostgreSQL state, including identities and relationships.
- Managed Asset bytes and their matching database references.
- Critical configuration and infrastructure/deployment instructions.
- A protected secrets recovery/rotation process, including compromised credentials.

Define service-appropriate recovery objectives and bounded retention before launch,
without inventing fixed durations here. Protect recovery copies/access from the
same accidental deletion or credential compromise where practical. Establish how
database and object-storage recovery points remain consistent: PostgreSQL and
filesystem/object provisioning are not one atomic transaction.

Backups are not sufficient merely because jobs report success. Periodically
restore into an isolated environment and verify actual PostgreSQL records,
relationships, Asset availability/bytes and application/media serving using
recoverable deployment/configuration. Record results, gaps and corrective action;
rehearse again after material recovery-path changes. Do not claim disaster recovery
readiness before this combined restore has succeeded. Backup is not long-term
archive; P4, O1 and D1/D2 govern bounded retention and separate archival decisions.

## Blast radius and low-admin operations

Reduce the consequences of a single failure through tenant isolation, deployment
rollback, database recovery, durable Assets, scoped credentials and bounded
automation permissions. Consider provider/account separation for recovery and
critical functions where it materially reduces risk. Avoid operational complexity
whose maintenance burden exceeds its risk reduction; low routine administration
and centralized controls are product goals, not excuses to omit recovery.

Production monitoring should cover uptime/health, application errors,
database/storage failures, failed authentication or suspicious management access,
form abuse/rate-limit events, deployment failures, backup failures and resource
exhaustion as those surfaces exist. Define alert ownership and actionable response
instructions; keep sensitive data out of telemetry and retain it deliberately.

Maintain a deliberate dependency/security-update process: inventory relevant
dependencies, review advisories/updates, prioritize by exposure, validate releases
and deploy centrally with rollback awareness. One controlled platform is cheaper
to maintain than hundreds of independent CMS/plugin stacks, but centralized
patching does not imply automatic safety or eliminate supply-chain risk.

## Ownership, export and implementation status

Customer-owned canonical state, content and Asset data/bytes must stay identifiable
and separable from implementation machinery, enabling usable export and easy exit
without platform lock-in (P5/P6/D4). This also aids recovery, but an export is not
automatically a complete platform backup, and a backup is not necessarily a usable
customer export.

This document adds no runtime controls, hosting configuration or recovery system.
Existing routing and Asset checks are bounded implementations, not evidence that
production management, multi-customer isolation, uploads or disaster recovery are
complete. Guided onboarding, future authenticated management and production launch
must satisfy the applicable gates in the register. P9/P10 remain deferred.
