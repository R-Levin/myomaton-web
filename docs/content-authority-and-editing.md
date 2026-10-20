# Content authority and bounded text drafts

## Implemented boundary

The runtime text descriptor and local operator draft service are implemented without
a schema migration. They derive fields from existing Section content and canonical
projections. They grant text editing only; CSS, layout, fonts, palette, spacing,
breakpoints, Section composition and Visual Grammar are outside the contract.
The original text harness is trusted local development tooling, not a customer
HTTP editor. The bounded proposal extension below adds explicit authority and
exact approval; it still has no publication path or production identity adapter.

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
shown with labels/destinations but are inert. Assets, arbitrary HTML/CSS, new
Section types, navigation edits and broad structural CRUD are outside this slice.
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
