# Content authority and bounded text drafts

## Implemented boundary

The runtime text descriptor and local operator draft service are implemented without
a schema migration. They derive fields from existing Section content and canonical
projections. They grant text editing only; CSS, layout, fonts, palette, spacing,
breakpoints, Section composition and Visual Grammar are outside the contract.
The original text harness is trusted local development tooling, not a customer
HTTP editor. The bounded proposal extension below adds explicit authority and
exact approval. The separate disposable content-release foundation below can apply
that candidate; production identity and go-live remain unavailable.

Current implementation checkpoint: shared development has migrations 0000–0015
applied (16 total). The earlier 0013/0014 implementation notes below preserve their
then-pending shared status; separate authorized migration checkpoints subsequently
installed them. Empty shared proposal/release tables do not authorize shared
operational execution. See the [current architecture boundary](platform-service-architecture.md#current-implementation-and-next-boundary).

| Source | Owner and behavior |
| --- | --- |
| Canonical business truth | Identity, Offering, relationships, commercial structure, ownership and reusable knowledge belong to their existing canonical records. Projected fields refuse Page-local overrides. A future change must propose or update the canonical source with its review/version contract. |
| Page editorial | Headlines, introductions, explanations and transitions belong to a Page/Section. A validated text change updates only a local working draft and remains pending review and canonical assessment. |
| Derived/system | Projection labels and generated commercial explanations belong to the projection contract. They refuse direct override. Component names still belong to the Offering. |

`describeTextFields` provides stable Section/path identity, current value, owning
authority, source type, direct edit permission, reconciliation requirement, bounded
plain-text constraints, Section version, complete source-context fingerprint and
provenance. No duplicate database content model or editable layout configuration
is introduced. Modeled business facts use canonical bindings; surrounding editorial
framing remains explicit. Other rendering surfaces such as identity, navigation
and Action labels retain their existing owners and are outside this Section harness.

## Draft service and harness

`loadSectionContext` reads an explicit Web Presence/Managed Site/Section scope in
a read-only repeatable transaction. It checks active owned ancestors, canonical
source ownership and projection eligibility. It retains canonical payload/version
context locally for later assessment; private canonical values do not become public
rendered copy or descriptor values.

`createEditorialDraft` / `editEditorialDraft` retain previous/new text, owner,
actor, reason, timestamp, sequence, source provenance and revision context. They
reject stale context, foreign scope, invalid/overlong/markup/control text, altered
configuration and unjournaled content. A replayed journal verifies the working copy.
Existing typed Section/relationship validation is reused. No database update or
automatic publication occurs. Source content/configuration remain unchanged.

List fields with `node --import tsx --env-file=.env.local scripts/edit-text-draft.ts`
and explicit `--web-presence UUID --managed-site UUID --section UUID`. Add
`--field FIELD_ID --text-file PATH --actor ID --reason TEXT` to create/update an
ignored local draft under `runtime-content/editorial-drafts/`. This single-operator
harness demonstrates the contract; collaborative draft persistence/conflict
coordination and customer UI are subsequent work. Draft files are operator-private,
not portable published artifacts. A malformed or stale draft fails rather than resets.

## Reconciliation and proofreading hooks

Every editorial edit preserves the original complete Section and relevant canonical
sources, configuration, metadata and versions. Its journal records
`reconciliation: pending-assessment`. A later intelligence service can compare
wording-only change, clarification, possible business change, contradiction or new
knowledge and propose a canonical review. No keyword heuristic decides meaning.
No OpenAI API integration or semantic assessment is implemented here.

`proofreading: not-run` is a distinct hook. Later spelling/grammar service should
flag likely errors and suggest corrections while preserving voice and meaning.
It must never silently rewrite customer text; proofreading and substantive rewriting
remain separate. Current validation checks plain-text safety and bounds only.

Draft, review and publication are separate boundaries. This slice has local drafts
and reviewed canonical promotion; it implements no published snapshot or publish
writer. See [the promotion](miopages-canonical-promotion.md) and
[the next architecture boundary](deferred-architecture.md#media-acquisition-and-external-intelligence-pipeline).

## Reviewable Managed Site change proposals

`SiteProposalService` in [the existing content-editing area](../lib/platform/content-editing/proposals.ts)
adds `prepare`, `inspect`, `preview` and `approve`. Preparing again with an exact
current binding creates a new immutable revision, including after approval. This
extends the working-copy boundary using existing Page/Section contracts and the
shared Section renderer; it does not replace active content or the existing
Section text-edit journal. The latter remains useful for individual text edits.
This first representative-page slice accepts create/replace of one exact Page and
one to six ordered `hero`, `intro` or `cta` Sections with bounded heading/body text.
Existing eligible owned Actions may be referenced, not edited; preview CTAs are
shown with labels/destinations but are inert. Arbitrary HTML/CSS, new Section
types, navigation edits and broad structural CRUD are outside this slice. The
[disposable Intro extension](#media-to-publication-handoff) supports one exact image.
Page/Section UUIDs identify proposed destinations only and are never inserted.

Each textual field is either an exact confirmed canonical reference (Knowledge
entry key, or Offering name/summary/detail) or editorial judgment with a rationale.
The service resolves facts from the owned current canonical revision and verifies
its immutable snapshot/fingerprint and confirmation evidence. It records exact
source references, values and provenance in the proposal revision. No raw intake,
UNCONFIRMED assessment, Review recommendation or edited canonical fact is an
accepted factual source. Editorial labeling is not a semantic truth detector:
the authorized human must check that judgment/framing does not disguise a new
business claim. Such claims first require separate canonical confirmation. Nothing
in a proposal writes language back to Knowledge or Offering. Confirmed internal
facts may appear only in this private candidate; approval grants no public
visibility or publication eligibility to those sources.

The proposal's ID, scope, revision, base fingerprint, full operations/resolved
candidate, source evidence, author/authority and timestamp form its SHA-256 digest.
The baseline includes the exact inactive bound Organization/Web Presence/Managed
Site graph, Pages/Sections, Actions, Navigation/items, Design System/Visual Direction
configuration, canonical sources and relevant media/subject/contact-definition rows.
The local adapter reads in a read-only repeatable PostgreSQL transaction. The
durable adapter reads the same baseline and appends only proposal evidence within
one serializable transaction. Snapshot timestamps use UTC consistently across
reopened connections. A changed base or
canonical source refuses preview/approval; explicit re-preparation against the
current base creates a new revision, never a silent rebase. Historical approval
remains recorded; inspection reports `stale` and `approvalValid: false` if its
base has changed. Approval records a point-in-time decision, not a lock against
later site edits. A future publication service must revalidate all bindings again.

`ProposalAuthority` follows the existing trusted-context/operation/scope authority
contract. Preparing, inspecting, revising, previewing and approving require distinct
permissions on the exact Web Presence/Managed Site. Arbitrary actor strings are
not capabilities. Approval additionally requires a trusted `customer` mandate:
`business-representative` or explicitly `accepted-authority`, subject identity and
authority reference. The recording operator and approving authority are separate
fields. An operator-only grant cannot substitute for customer approval. A later
trusted adapter may verify a representative's direct consent or an operator-mediated
record; no login, self-service UI or production identity verification is claimed.
Synthetic fixtures represent this mandate for proof only.

The caller renders the full candidate with `preview`, then passes its exact preview
event/hash plus the proposal binding and consent reference to `approve`. The ledger
records the exact HTML digest and recomputes it before approval. Changed content,
renderer, revision, destination or baseline refuses. Changed request bodies under
the same idempotency key refuse; exclusive local writer locks prevent competing
revisions from both succeeding. Edits create a new PROPOSED revision and clear its
current approval, while preserving prior decisions. Approval leaves the Page,
Sections, Actions, Navigation, routing and all canonical state untouched. `publish`
always refuses; there is no release/deployment/publication operation.

### Persistence and operator proof

The retained disposable adapter needs no migration. Like the existing local Review ledger, the bounded
`LocalProposalStore` stores append-only, hash-chained revision/preview/approval events
under ignored `runtime-content/site-change-proposals/<UUID>/`. Exclusive file creation,
sync and local locks preserve history; corrupt/partial history refuses rather than
resets. A stale lock after interruption requires explicit inspection/recovery, not
automatic lock removal. Files use restricted creation modes and reject redirected
directories; Windows ACLs must still come from the restricted local workspace.
These are operator-private development artifacts, excluded from normal backup by
the existing runtime-content policy. They are not shared durable customer storage;
use the durable adapter below for shared persistence. Do not put real customer
proposals into this disposable adapter.

For local storage the environment must explicitly be `NODE_ENV=development` and
`MIOPAGES_SITE_PROPOSALS=local-operator`. Database operations additionally require
the existing isolated `canonical_test_<32 hex>_intake` fixture schema and its exact
bound inactive foundation. Shared/public and production execution refuse even
when a caller supplies authority. No customer HTTP endpoint or Next Server Action
is exposed. No preview is mounted on public application routes.

### Durable PostgreSQL adapter

`ProposalPersistence` / `ProposalStore` separate service semantics from storage.
Both adapters use the same event construction and `replayProposal` validation,
proposal model, renderer and authority contracts. The default remains local.
Explicitly inject `PostgresProposalPersistence(pool)` into `SiteProposalService`
to store the same immutable history in migration **0013_site_change_proposals**:

- `site_change_proposals`: immutable Organization/Web Presence/Managed Site identity
  and creation time, indexed by owner. No mutable published/status pointer.
- `site_change_revisions`: exact revision JSON, resolved confirmed source references
  and evidence, editorial rationale, candidate inputs, base snapshot/fingerprint,
  author/authority/time and digest. Events reference the exact relational binding.
- `site_change_events`: ordered immutable request/hash chain, preview identity/digest,
  customer mandate and recording operator separately, consent reference/time, and
  exact approval. Revision JSON is stored once and joined back into revision events.

Database guards reject retargeting, UPDATE/DELETE/TRUNCATE, orphan identities/revisions,
foreign/unconfirmed canonical source revisions, broken event order, mismatched
revision/digest/base/preview and approvals without the exact preview/customer mandate.
One approval per revision and unique request IDs are enforced relationally. Current
state is derived through the existing replay rules; editing never transfers consent.
Revision JSON is bounded to 2 MiB, event JSON to 32 KiB and history to the existing
128-event limit. No publication/release tables, active content writes or account
model are introduced.

Per-proposal locks are acquired before the serializable snapshot. Request identity,
ledger append and baseline/source reads share the transaction; failures roll back
everything, including a first identity. Bounded serialization/deadlock retries
re-evaluate the exact request. Duplicate retries return the same immutable event;
competing revisions/approvals cannot silently overwrite or inherit consent.

Durable shared development requires all of: an explicitly injected PostgreSQL
adapter, `NODE_ENV=development`, `MIOPAGES_SITE_PROPOSALS=shared-development`, migration
0013 installed, and the existing operation-specific trusted authority and exact
bound inactive foundation. `local-operator` with that adapter is restricted to
disposable schemas. Shared execution does not fall back to local files. Production
still refuses: real operator authentication, customer mandate verification, DB
privileges and deployment controls require separate operational authorization.
Table existence or environment configuration alone grants no authority. This task
does not apply 0013 or activate any real shared proposal.

Preview events additionally persist `site-proposal-section-renderer/1`. Full
revision inputs and the exact HTML digest are durable; previews are regenerated
and compared, not stored as duplicate HTML. Renderer/output changes invalidate
approval validity until explicitly reviewed again. Preserve the matching renderer
version when historical visual reproduction is required. Correctness and approval
history do not depend on an ignored HTML file or local ledger. There is deliberately
no automatic import of synthetic local approvals into shared commercial evidence.

The [same semantic suite](../tests/integration/site-proposals.test.ts) runs against
both adapters. [Durable tests](../tests/integration/site-proposal-persistence.test.ts)
prove concurrency, reopening, source/authority binding and direct SQL refusal.
[Migration rehearsal](../tests/integration/site-proposal-migration.test.ts) covers
0012 upgrade, fresh replay and no-op rerun in private databases. The
[existing backup/restore proof](../tests/integration/site-proposal-recovery.test.ts)
recovers exact approval/history in a second isolated cluster without runtime files.
Normal PostgreSQL backups already include every non-disposable schema/table; no
backup exclusion or mechanism changes are needed. After a separately authorized
0013 deployment, retain these tables as commercial approval evidence under the
same backup, access and recovery policy. Retention/purge is not implemented here.

The readable durable example is ignored
`runtime-content/site-proposal-durable-proof/inspection.md` plus `inspection.json`
and `candidate.html`. It contains only synthetic disposable evidence; shared
PostgreSQL, active content and the approved Free Review are unchanged.
Run the same fixed-artifact viewer with `--durable-synthetic-proof` to inspect
that approved durable snapshot. It checks the durable evidence label, reopened
approval and preview digest and retains the same loopback/CSP/inert boundaries.
The viewer still uses the `local-operator` environment and never opens a database.

The [disposable proof helper](../scripts/site-proposals/disposable.ts) uses the
existing activation fixture, Direct Start and explicit Knowledge/Offering confirmation.
Its service workflow is: prepare with a request UUID, inspect sources/revisions,
preview the exact binding, revise with that binding when needed, preview again,
and approve using a separately trusted customer-representative capability. The
[PostgreSQL test](../tests/integration/site-proposals.test.ts) writes readable ignored
`runtime-content/site-proposal-proof/candidate.html`, `inspection.md` and
`inspection.json`, including sources, inactive baseline, changes, earlier revisions
and customer approval. Open the HTML locally; it makes no network requests, runs
no scripts and enables no CTA submission. It uses the current Section renderer
with default bounded presentation, not a polished full-site Visual Direction
preview. The test removes its disposable schema; retained artifacts are labeled
synthetic development evidence and do not imply a live candidate database.

For loopback browser inspection of that exact synthetic artifact, run
`npx tsx scripts/site-proposals/preview.ts --synthetic-proof` with the explicit
development/operator environment above. The read-only server checks the evidence
digest, serves only the fixed HTML snapshot at a random token path on `127.0.0.1`,
and refuses other routes/methods/Host values. CSP disables scripts, forms, external
resources and framing. It does not read live customer state or expose approval
actions; regenerating the artifact requires restarting this snapshot viewer.

Later authoritative onboarding Home direction may use this machinery only after
sufficient canonical knowledge is confirmed. The optional Free Review Home concept
remains separate, illustrative, non-canonical and unimplemented. No Customer #1
site or real Home direction is created; manual gap collection remains acceptable
while the fuller onboarding interview is deferred. Publication/release/rollback
and public visibility approval remain separate guarded stages.

## Controlled content release and rollback

The [release service](../lib/platform/content-editing/releases.ts) consumes an exact
durable approved proposal; the proposal service's `publish` method still refuses.
Release requires a separate scoped `release-managed-site-change` mandate from a
trusted capability adapter, not a free-form name or customer approval alone. It
verifies latest revision, proposal/approval event, customer mandate, destination,
base, confirmed canonical sources and unchanged candidate/preview digest. No copy
is regenerated and no intake or Review recommendation becomes a fact.

This first slice requires `NODE_ENV=development`,
`MIOPAGES_SITE_RELEASES=disposable-operator`, a private non-5432 generated rehearsal
database and the exact disposable inactive bound site. Shared/public/production
release is refused. No HTTP writer, real Customer #1 proposal, hostname, site
activation, deployment, DNS or TLS is introduced. Canonical current content means
the existing Page and ordered Section rows, not a parallel published-content model.
Active Page rows on an inactive site do not make that site publicly available.

Only existing create/replace-one-Page proposals with one to six supported Sections
are accepted. Existing eligible Actions remain unchanged references. Navigation,
site identity/status, business sources, media and other Pages remain untouched.
Text-only releases refuse media-bound targets. Deletion of referenced Pages or
Sections also refuses. The single disposable media exception below uses the same
authority and release path.

### Media-to-Publication handoff

The approved next Commercial V1 slice is one permissioned asset through the existing
acquisition and AssetUsage boundary, operator QA, exact approval, and a disposable
release and rollback. Acquisition already has a disposable proof of approval,
ingestion, eligible delivery and revocation. The current content release preview
omits managed media, so a text approval cannot stand in for review of an image or
its placement. A disposable PostgreSQL 18 integration check verified that an
exactly approved text proposal refused release of a Page with a synthetic media
attachment. The Page, Sections, AssetUsage and release history were preserved.
The release and historical preview checks passed together (13 tests).

The owner approved the bounded Intro proof on November 7, 2026. The durable
proposal may name one existing active Intro Section on the exact replacement
Page, one owned project-created PNG, one singular AssetUsage ID and a contextual
informative alt. The existing stack layout is fixed for the proof. Canonical
Asset metadata supplies explicit fixture-only permission and source evidence.
The prepared object key supplies the SHA-256 of the reviewed bytes. The revision
binds the source digest and reference, permission, prepared digest, dimensions,
MIME, target, role, accessibility configuration and exact prior usage, if any.
A prior usage must already refer to this same fixture image and slot. All other
media usages on the affected Page or Sections are out of scope and cause refusal.

Preparation, preview, approval and release re-read the owned Asset and verify
the managed object's hash, format and dimensions. The private preview embeds
the verified raster in the existing Section renderer and displays its evidence
reference and digest. The immutable approval binds the full candidate revision
and exact rendered HTML. A changed base, permission, prior usage, or prepared
object requires refusal and explicit review. Existing text-only revisions retain
their original schema, rendering and digest. The generated Hero acquisition
pilot retains its separate context-bound eligibility and revocation semantics.

The separate disposable release mandate applies unchanged. The existing locks
cover the usage write, Page/Section mutation, and release evidence in one
transaction. An exact retry returns the original event. Rollback checks the
current full site fingerprint, resolves the original immutable proposal revision,
and removes a newly added usage or restores the exact prior usage row, including
timestamp precision and presentation metadata. If a predecessor image would
be restored, verify its bytes again. Changed canonical eligibility or unrelated
edits block rollback. Rollback cannot restore permissions or rewrite Assets.

No database migration is required for this proof. Media evidence lives inside
the existing candidate JSON, the existing release trigger continues to check
exact Page/Section rows, and the application verifies the usage write under the
same transaction. Before production, review database-level AssetUsage evidence
enforcement, trusted rights/revocation, concurrency and delivery contracts.
Media-aware execution requires an explicit fixture storage root, durable
proposal storage, an inactive bound fixture, and the existing nondefault-port
disposable release boundary on loopback PostgreSQL. WordPress private staging
v1 continues to refuse media-bound proposals.

The PostgreSQL proposal transaction serializes proposal changes and site release
requests. The private release adapter conservatively takes canonical-table
`SHARE ROW EXCLUSIVE` locks before its first snapshot-bearing SELECT. This blocks
phantom inserts and unrelated canonical writers until commit and ensures a waiter
sees their committed state before eligibility checks. Reads remain available;
this coarse private-proof boundary is not a claim of production-scale concurrency.
Complete Page/Section mutation and one successful append-only
`site_content_events` record commit together or both roll back. Migration **0014**
adds only this bounded history table and integrity/immutability guards. Records
bind proposal/revision/digest/base, exact approval event and rendered-preview hash,
destination, affected Page/Section IDs, separate release actor/mandate/reference,
request identity/time, before/after site fingerprints and exact affected-row
snapshots. One release per proposal revision; matching retries return the original
result and conflicting reuse refuses. Editing or rollback does not transfer consent.

`rollback-managed-site-change` is a separate mandate. Only the current latest
successful release may roll back, and only while its entire canonical site
fingerprint still matches. No arbitrary rollback chain/time travel is supported.
Unrelated content/source/Action/Navigation changes refuse. Rollback restores the
stored prior Page/Section rows atomically with a new immutable rollback record,
including metadata, versions and PostgreSQL microsecond timestamps. Exact restore
therefore returns the prior content fingerprint; the rollback has a new distinct
history identity/digest. Prior history is never deleted. An already released
proposal revision cannot be released again after restoration; prepare/review a new
proposal instead. Limits: 24 predecessor Sections, 1 MiB per affected-row snapshot,
256 history records per site; exceeding a bound refuses atomically.

Proposal fingerprints retain their existing definition. Release fingerprints use
the same site graph with Page/Section and related owned-row timestamps represented
at full PostgreSQL precision, explicitly separate from JS Date millisecond projection. This avoids
losing exact rollback state or missing sub-millisecond drift.

The [disposable integration proof](../tests/integration/site-releases.test.ts)
checks exact replacement/restoration, authority, stale state, concurrency, retries,
failure before commit and reopen. [Ordered migration rehearsal](../tests/integration/site-release-migration.test.ts)
covers upgrade/fresh/no-op. Normal database backup/restore covers release history,
snapshots and current rows; no runtime ledger is needed. The synthetic inspection
under ignored `runtime-content/site-release-proof/` shows exact before, released
and restored rendering using the existing Section renderer with inert Actions.

Content release/publication changes canonical content only. Runtime deployment,
customer go-live, production authorization, domain/TLS and readiness are separate.
The illustrative Free Review Home concept and authoritative onboarding Home
direction both remain deferred. Migration 0014 is not applied to shared development
in this implementation task; shared remains at 14 applied migrations.
