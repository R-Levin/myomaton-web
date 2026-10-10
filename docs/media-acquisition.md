# Media acquisition operating foundation

Canonical customer records own facts, content, VisualNeed, Assets and AssetUsage.
The acquisition service owns work, candidates, budget, review and audit. Providers
return normalized results only. Rendering consumes eligible canonical Assets.

## Schema review before migration

The existing nineteen customer tables have no durable external job, private
candidate or attributable media decision equivalent. Migration 0009 adds only
`external_work`, `media_candidates` and `external_work_events`. No customer table
changes are needed. It is rehearsed in disposable schemas; the live journal is
deliberately left at nine rows pending separate operational deployment review.

Each record belongs to a Web Presence. Composite foreign keys keep work,
candidates and events in that same tenant. Work IDs and deterministic identities
are unique within that owner. Queue/lease and candidate retention indexes support
bounded operator queries. JSON payloads are bounded; events are append-only.
Work and candidate lifecycle updates require the next row version and permitted
transitions. Candidate representation revision is immutable: lifecycle row
version changes do not change what a human approved. Edited descendants receive
new IDs, digests and decisions. There is no cascading deletion of audit evidence.

## Scope and context

Only `image-generation` is executable now. `editorial-reconciliation` is reserved
for future intelligence contracts, not implemented execution. The canonical
Home Hero `metadata.visualNeed` remains authoritative; no parallel need table is
introduced. The frozen context binds Section/Page/site versions and content,
design system, grammar and need. Dispatch, approval, ingestion and eligibility
reload this context. A stale job fails until explicitly reassessed as new work.
The operator explicitly selects `generated-illustrated` despite the existing
`customer-owned` sourcing hint. That selection does not alter canonical metadata.

The versioned conceptual brief uses purple, blue-violet, lavender and warm paper,
flat geometric planes and business understanding → public presence → continuing
attention. No screenshots, dashboards, analytics, logos, claims, copy, people or
documentary evidence are requested. Reference Assets are empty in this slice.

## Provider and cost

The [provider-independent contract](../lib/platform/acquisition/contracts.ts) `generateImage(request, executionContext)` also
leaves optional edit/iterate operations. OpenAI uses a single bounded server-side
POST to `/v1/images/generations`, one PNG at 1536×1024, medium quality, automatic
moderation and an explicit configured model. No provider objects enter canonical
writes. See the [official API reference](https://developers.openai.com/api/reference/resources/images/methods/generate).

Set `OPENAI_API_KEY` in the existing local process environment or untracked local
environment file; never in customer configuration or browser code. Optional
`OPENAI_IMAGE_MODEL` defaults to `gpt-image-1.5`. The CLI requires an explicit
maximum job budget and per-dispatch reservation in USD microdollars. These are
operator-supplied conservative caps, not an asserted provider price. Unknown
actual cost remains unknown; usage and request IDs are recorded when supplied.
The reserve remains consumed after an ambiguous timeout or unknown-cost result.
This bounds authorized dispatch exposure; it cannot guarantee a provider price
or exactly-once charging. A known actual cost above the reserve terminates work
and requires operator reconciliation before further dispatch.

Rows are locked for atomic reservation and lease creation before network work.
At most two paid iterations and two explicitly requested transient retries are
allowed. A rate-limit response may be retried within those bounds; uncertain
timeouts require explicit reconciliation, never automatic redispatch. Missing
credentials, refusal, invalid input, stale context and budget exhaustion do not
retry. Lease expiry is an uncertain outcome; late results cannot create a
candidate. Local identity binds tenant, capability, context, provider/model,
template, strategy and iteration. A duplicate command cannot dispatch twice.

## Candidate, review and application

Provider output is validated and prepared with existing ingestion limits before
human review. Private quarantine uses a separate operator-controlled root, scoped
by tenant and content digest. It has no public route. Prepared bytes are immutable
and reviewed exactly as later ingested; source digest and transformation history
are retained privately. No raw provider errors, secrets or reasoning are stored.

The CLI supports inspect, materialize, approve, reject, revoke, cancel and an
explicit next iteration/retry. Approval records the local authenticated operator
identity, operator role/authority, decision, candidate ID, immutable revision,
representation digest, intended Section/role, timestamp and concise reason.
The CLI is a local trusted-operator boundary, not a web authorization endpoint.
Human review evaluates suitability; provider success never supplies approval.
Approval and ingestion are separate operations. Synthetic fixture approvals
test the mechanics and never imply acceptance of generated imagery.

Only disposable application is implemented. The writer verifies current
approval, context, owner, digest and prepared bytes, locks the target Hero, then
creates a managed Asset and singular `section/service-illustration` usage.
Asset metadata contains safe lineage references and artificial-media flag, not
provider URLs or private prompts. No Asset ID enters Section JSON.

## Eligibility, delivery and revocation

The [new role evaluator](../lib/platform/acquisition/eligibility.ts) alone checks owned active parents/Asset, unambiguous singular slot,
exact dimensions/MIME/bytes digest, provenance digest, generated record, current
operator approval, revision, policy version, current context, intended usage,
accessibility and expiry/revocation. Both page presentation and direct media
delivery use the same gate. Acquired Assets cannot bypass it through a legacy
role. Ineligible media is omitted and direct delivery returns 404. Legacy Assets
without acquisition lineage retain their existing resolver semantics.

Revocation appends evidence and changes lifecycle state. The Hero falls back and
its canonical unresolved need remains available; immutable audit evidence stays.
Rejected/expired candidate bytes may be pruned after 30 days; approved/ingested
or revoked evidence is retained for manual policy review. Cleanup never deletes
events or changes canonical Assets. The CLI only removes rejected/expired objects
with no other retained candidate referring to those bytes.

## Disposable slice and stop boundary

Run `node --import tsx --env-file=.env.local scripts/acquisition-pilot.ts create
--budget-micros 1000000 --reserve-micros 500000` to copy the exact accepted MioPages
graph into a newly created isolated schema and execute one request. Outputs live
under ignored `runtime-content/acquisition`; inspect the receipt with subsequent
`list`, `inspect`, `materialize`, `approve`, `reject`, `revoke`, `iterate`, `retry`, `cancel`,
`cleanup`, `expire`, `expire-lease` or `ingest` commands plus `--receipt <path>`. Decisions require
`--actor`, `--reason`, `--candidate`, `--digest` and `--revision`; ingestion also
requires meaningful `--alt`. `preview` opens a read-only production fixture.
These commands refuse public schemas. The real candidate remains proposed until
a human explicitly reviews and approves it. API key absence produces no candidate.

Accepted disposable direction remains **A Business in Focus / service-led v3**.
Unresolved visuals stay canonical metadata; preview FPOs are not production
Assets. Production-safe fallback omits unresolved visuals without revoking
acceptance. A future eligible illustration fills only the Home Hero slot.

Stock/Pexels, deterministic graphics and non-image intelligence remain future
provider-independent capabilities. Editorial/canonical reconciliation is the
recommended first non-image capability. Real canonical attachment, public
publication, commercial launch, customer UI and commit/push are outside this
slice. Operational deployment and human illustration approval are the next
review boundaries.

### Versioned pilot iteration briefs

Historical `miopages-service-illustration/1` remains unchanged. The explicit
`--template miopages-service-illustration/2` iteration uses structured business
information, a coherent public presence and recognizable continuing-care cues.
A second iteration retains the same need/context and aggregate reservation cap.
Its immutable queued event and candidate provenance retain the parent candidate,
exact subject/revision/byte/provenance digests and attributable review event.
Rejection preserves the parent's bytes and does not approve its successor.
Each request version has its own identity and prompt digest; eligibility verifies
the job's specific request version. Runtime receipts, PNGs and reports remain
ignored evidence, not reusable source or canonical Assets.

### Explicit operator escalation for an exhausted disposable pilot

The default service and checked-in schema retain the two-iteration cap. An
operator can authorize one third attempt using the disposable-only `escalate`
command with an attributable actor and reason. It requires two rejected,
reviewed candidates and exactly $1.00 already reserved. An atomic transaction
records the decision, parent lineage, prior cap and exact new limits, creates
one immutable work identity, and adds a constraint exception only for that work
UUID/owner/context in that isolated schema. Public schema and migration files
are untouched. This is local pilot authorization, not general production
escalation infrastructure.

The exception fixes total iterations at three, the aggregate budget ceiling at
$1.50, the additional reservation at $0.50, and additional attempts at one with
zero retries. Dispatch validates the recorded authority; provenance binds the
escalation event digest. Rejection or provider failure retains reservations and
requires another human escalation. No automatic fourth iteration is available.
The version-3 brief supports Hero copy through restrained clarity and continuity.
