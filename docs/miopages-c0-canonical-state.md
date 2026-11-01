# MioPages C0 canonical customer slice

For a new hosted database with all 16 migrations and no application/customer rows,
use the [fresh-hosted operator procedure](#fresh-hosted-synthetic-establishment)
below. The historical development transition and its frozen baseline remain
protected and must not be used as a repair path for that environment.

The initial establishment below is historical. The accepted A Business in Focus
direction has now been [promoted into reviewed canonical state](miopages-canonical-promotion.md):
four Pages, 23 Sections, service-led v3, Source Sans 3 and two approved wordmarks.
Publication and commercial launch remain withheld. The original initializer
receipt is preserved; rerunning establishment against later reviewed state refuses
rather than resets it.

## Authority and application status

The approved [business brief](miopages-c0-business-brief.md) supplies business truth;
the [implementation plan](miopages-c0-implementation-plan.md) supplies the IA.
This first customer transition was applied and verified in the real development
database after full disposable validation under separate explicit authorization.
It is not final public copy,
a visual approval, publication permission or commercial-launch authorization.

`active` means structurally renderable under an explicitly selected deployment.
The platform has no separate publication workflow yet. This slice is for local
C0 review only; it does not change public DNS, shared host routing or production.

## Reviewed graph

| Record | UUID |
| --- | --- |
| Organization | `152aebd3-00b3-4296-a64e-e281522e64f0` |
| Web Presence | `926cb772-7507-4542-8acd-e7e57ce71324` |
| Managed Site | `312b8081-4582-47fa-bedb-a551fd6e2b36` |
| Business Knowledge | `3b233b77-a935-4d7c-9133-949760cb3116` |
| Offering | `ad9aa219-0cd2-4d8c-b707-739eee07d60c` |

Public identity contains only MioPages and `miopages.com`. Unknown phone, email,
social URLs and Google property status are not fabricated. X/Facebook existence
remains discovery evidence in the brief until an external-inventory contract and
verified URLs exist. No Assets, Contact definitions or submissions are created.

Business Knowledge contains 25 stable-key confirmed entries with approved-brief
provenance, responsible attestation and visibility. First-cohort planning stays
internal. Display-name evidence binds to the existing identity value by digest.
There is one current record and one immutable initial revision per canonical domain.

The single service Offering, `managed-web-presence`, owns neutral product-definition
text, audiences/outcomes, bounded inclusions/exclusions, three same-owner Page
Actions and the ordered Standard Launch, Expanded Launch and Ongoing components.
Their intended operating responsibilities are qualified as supported/planned;
storing an offer definition does not implement those workflows.

Standard Launch stores USD 109500 minor units, one-time; Ongoing stores USD 24900,
recurring monthly. Both remain provisional hypotheses with **internal** approval
scope. Expanded Launch is scope-confirmed with no amount. Public formatting thus
withholds prices; the pricing-summary Section binding currently fails closed.
No provisional amount is presented as a confirmed commercial term.

## IA and presentation

| Route | Stored Sections | Responsibility |
| --- | --- | --- |
| `/` | Hero, bound Offering Intro, bound knowledge Collection, CTA | Orientation, fit, service and Review signposts |
| `/service` | Hero, bound overview, three bound component Intros, bound pricing Collection, CTA | Service definition and boundaries; six Sections render while pricing is internal |
| `/experience` | Hero, Intro, provisional evidence Intro, CTA | Distinguish verified historical experience from prospective platform proof |
| `/review` | Hero, Intro, process/continuation Intro, CTA | Explain planned Review; explicitly state no operational request workflow exists |

Total: four Pages and 19 stored Sections. Primary Navigation contains Service,
Experience and Review; brand identity links Home. Actions are Request a Web Presence
Review, See How the Service Works and See Our Experience, all targeting Page UUIDs.
Conversation, `/start`, Launch confirmation and legacy access Actions remain absent
until verified destinations/workflows exist. No unsupported proof is asserted.

Managed Site and Design System configurations are empty reusable defaults,
annotated provisional in metadata. No reference profile, palette, imagery or final
Visual Direction is selected. Existing Section types/default presentation suffice.

## Guarded establishment and operation

The first real second-customer graph is now present. Myomaton's complete prior
customer state and the nine-migration journal remain unchanged. The real exact
rerun returned zero inserts, updates and deletes; the full database fingerprint
was verified unchanged across that rerun.

The customer manifest and frozen nine-migration baseline live under
`scripts/customer-initializers/`. The operator command is
`npm run initialize:miopages-c0`. This is a one-time reviewed transition, not a seed,
source-file synchronizer, force/reset mechanism or public management endpoint.

The reusable initializer locks the baseline, inserts the reviewed owned graph and
uses [canonical writers](canonical-foundation.md#scoped-writes-and-bounded-history)
inside savepoints within one transaction. It validates ownership and the complete
postcondition before commit. The initial result is 38 inserts, one update to the
new Organization's initializer receipt, and no deletes. No existing customer row
is updated. The receipt binds the reviewed manifest and complete resulting graph,
including actual timestamps, to digests. Exact reruns write nothing; partial,
customized, foreign or baseline-drifted states refuse. Forced failures roll back
ordinary records and canonical revisions together.

Explicit local deployment uses:

```text
WEB_PRESENCE_ID=926cb772-7507-4542-8acd-e7e57ce71324
MANAGED_SITE_ID=312b8081-4582-47fa-bedb-a551fd6e2b36
```

Use a separate loopback-only process/port from Myomaton; never replace its local
selector configuration. Final copy/Visual Direction, Review/onboarding, analytics,
content growth, billing, production Contact, integrations and commercial readiness
remain deferred. Historical Myomaton transition guards remain frozen; multi-customer
fixtures isolate their original scope rather than weakening operator updater guards.

## Fresh-hosted synthetic establishment

The historical `initialize-miopages-c0.ts` transition preserves a frozen
nine-migration Myomaton development graph before adding C0. The new
[fresh-hosted service](../scripts/customer-initializers/fresh-hosted-miopages-c0.ts)
and [protected entry point](../scripts/initialize-fresh-hosted-miopages-c0.ts)
serve a different contract: the exact checked-in 16-migration lineage, a valid
PG17 compatibility receipt where required, the verified managed PostgreSQL role
contract, and otherwise empty application inventory. They reuse the original
reviewed C0 manifest and canonical initialization/writer machinery; customer
content and historical baseline files are unchanged.

Run this operator action using the dedicated migration login. The live
`miopages_runtime` connection remains for serving and cannot take the required
journal SHARE lock. No runtime permissions are broadened. The entry points load
no environment files and accept no credentials in arguments. Supply protected
`DATABASE_URL` (migration credential, remote `sslmode=verify-full`),
`MIOPAGES_DATABASE_NAME`, `MIOPAGES_RUNTIME_ROLE`, `MIOPAGES_MIGRATION_ROLE` and
`MIOPAGES_BACKUP_ROLE` explicitly. Do not use a live runtime connection for these
operator commands or record connection strings in shell history.

Initialization locks the journal and every inventoried application table in one
transaction. The checked-in bootstrap identities/hashes/order, applied/pending
status and PG17 receipt are verified before any row write. A baseline is derived
only from that verified ledger plus empty customer tables; every other inventoried
operational table, including hostname bindings, must be empty. Provider objects
outside the inventory are excluded. Concurrent starts serialize; a failure rolls
back the whole graph, canonical revisions and receipt.

The existing customer receipt is extended with a fresh-hosted kind, migration
lineage digest (including the exact ledger and compatibility receipt) and
inventory digest. Exact reruns verify manifest/state/context
digests and perform zero writes. Partial, foreign, customized, unreceipted or
unexpected application state refuses; there is no reset, repair or adoption
mode. Independent `verify` uses a read-only repeatable-read transaction and
requires an already initialized graph. It does not try to create missing data.
The original historical initializer still checks its original frozen baseline.

With protected migration configuration already supplied, after review/checkpoint:

```sh
export MIOPAGES_DATABASE_OPERATION=fresh-hosted-c0
MIOPAGES_C0_ACTION=create node --import tsx scripts/initialize-fresh-hosted-miopages-c0.ts
MIOPAGES_C0_ACTION=verify node --import tsx scripts/initialize-fresh-hosted-miopages-c0.ts
```

Stop on either failure; retain only the bounded stage/SQLSTATE. Do not rerun
bootstrap or migrations: the reported hosted source already has 16 applied,
zero pending and a valid PG17 receipt. A lost connection during COMMIT is an
unknown outcome: inspect using read-only verification before a deliberate retry.

### Separate hostname operator

Only after independent C0 verification, use the
[generic hostname service](../scripts/db/managed-hostname.ts) through its
[protected CLI](../scripts/manage-hostname-binding.ts). Binding is a separate
routing/go-live action; it does not derive identity from hosting location or
change C0 content. The command requires an exact normalized DNS hostname and
explicit Web Presence / Managed Site UUIDs. The target and its Organization must
be active, and site ownership must match. Bind locks the registry and target
rows transactionally; conflicting or inactive bindings refuse. Exact reruns are
zero-write, and `verify` is read-only. This generic operator checks active owned
targets, not commercial/content approval; the preceding C0 verification is the
hosted synthetic procedure's prerequisite.

For the separately authorized synthetic hosted invocation only:

```sh
export MIOPAGES_DATABASE_OPERATION=managed-hostname
export MIOPAGES_HOSTNAME=runtime.miopages.com
export MIOPAGES_WEB_PRESENCE_ID=926cb772-7507-4542-8acd-e7e57ce71324
export MIOPAGES_MANAGED_SITE_ID=312b8081-4582-47fa-bedb-a551fd6e2b36
MIOPAGES_HOSTNAME_ACTION=bind node --import tsx scripts/manage-hostname-binding.ts
MIOPAGES_HOSTNAME_ACTION=verify node --import tsx scripts/manage-hostname-binding.ts
```

Then verify the known hostname using the runtime connection and confirm an
unknown Host still returns the fail-closed 404. The hostname is not embedded in
generic platform code. Clear protected connection credentials after the operator
session. Do not repeat fresh establishment after binding or subsequent operations:
the fresh initializer intentionally refuses nonempty operational inventory.

Customer establishment and a technical routing proof do not authorize commercial
publication, approve provisional terms, or expand Commercial V1. All repository
tests use disposable local databases; no hosted writes or DNS changes are implied.
