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
The reader uses a read-only repeatable PostgreSQL transaction. A changed base or
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

### Local persistence and operator proof

No migration is required. Like the existing local Review ledger, the bounded
`LocalProposalStore` stores append-only, hash-chained revision/preview/approval events
under ignored `runtime-content/site-change-proposals/<UUID>/`. Exclusive file creation,
sync and local locks preserve history; corrupt/partial history refuses rather than
resets. A stale lock after interruption requires explicit inspection/recovery, not
automatic lock removal. Files use restricted creation modes and reject redirected
directories; Windows ACLs must still come from the restricted local workspace.
These are operator-private development artifacts, excluded from normal backup by
the existing runtime-content policy. They are not shared durable customer storage;
review retention, restricted shared persistence and backup inclusion before real
use. Do not put real customer proposals into this disposable adapter.

The environment must explicitly be `NODE_ENV=development` and
`MIOPAGES_SITE_PROPOSALS=local-operator`. Database operations additionally require
the existing isolated `canonical_test_<32 hex>_intake` fixture schema and its exact
bound inactive foundation. Shared/public and production execution refuse even
when a caller supplies authority. No customer HTTP endpoint or Next Server Action
is exposed. No preview is mounted on public application routes.

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
