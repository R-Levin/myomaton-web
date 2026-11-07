# Media acquisition operating foundation

Canonical customer records own facts, content, VisualNeed, Assets and AssetUsage.
The acquisition service owns work, candidates, budget, review and audit. Providers
return normalized results only. Rendering consumes eligible canonical Assets.

## Commercial V1 completion boundary

Managed Assets / AssetUsage, safe operator ingestion, media delivery and the bounded
provider-independent generated-image acquisition pilot already exist. They are
reusable foundations, not proof of production customer upload or stock acquisition.
The pilot details below retain their original disposable scope and approval rules.

Commercial V1 requires these acquisition and use paths:

- **Customer-supplied media:** uploads, existing website assets and previously
  authorized media. Verify authority to acquire and use them, validate and ingest
  safely, and retain ownership, provenance, tenant scope and supported presentation
  and accessibility metadata.
- **Permissioned stock:** practical provider-neutral stock sourcing. Pixabay is
  the preferred first live candidate, subject to the gate below. Openverse is
  the fallback for verified CC0 assets. Pexels is deferred while new keys are
  paused and MioPages has no key. Retain source, rights and usage
  conditions before ingestion or placement.
- **AI-generated media:** extend the bounded image-generation pilot, preserving
  generation and transformation provenance, Operator review, cost controls and
  applicable rights and disclosure review.

All paths converge on protected staging, validation, source and rights review,
canonical Asset, proposed AssetUsage and placement, page-context preview, exact
approval, release, verification and rollback or revocation as applicable. Reuse
the existing acquisition and Asset boundaries and approval machinery. Customer
upload and practical stock acquisition remain required V1 completion work.
The [disposable Intro proof](content-authority-and-editing.md#media-to-publication-handoff)
covers the integration from an already prepared and permissioned fixture through
release and rollback. The generated Hero pilot retains its existing context checks.
A multi-provider marketplace/ecosystem and deterministic graphics expansion are
later capabilities, not V1 requirements. Media recommendations belong in generation
orchestration; unresolved visual gaps must remain explicit until safely resolved.

## Permissioned stock fixture and provider integration

The disposable stock intake takes a normalized local selection and one
project-created PNG under an explicit synthetic project grant. Its provider
label and reserved source URL identify it as fixture data. Scoped Operator
authority binds the exact Web Presence, Page and Intro slot. Record provider
and source ID, source page, available creator credit, selected representation
and source SHA-256, license and intended use, expiry, and the separate provider
integration reference, copy mode and attribution requirement. Keep this evidence
and the prepared SHA-256 in the existing acquisition ledger.

The fixture permits only its reviewed local-copy license and optional
attribution. A license that forbids copying, a provider-hosted-only rule,
an obligation the renderer cannot fulfill, or unknown or expired permission
refuses. The intake validates and privately stages the prepared bytes. An
Operator approves the exact candidate digest, provider-license reference,
suitability and contextual alt text before an unattached canonical Asset
is prepared. The separate page preview displays synthetic provenance and
the actual raster. It binds that evidence to exact approval and release.
Expiry and recorded withdrawal block a new release, and rollback rechecks
eligibility before restoring a prior stock association. No live provider
adapter, external-image renderer or export permission is implied.

### Pixabay first, Openverse fallback

The owner requested a new provider evaluation on November 7, 2026. Prefer
ordinary customer pages without per-image credits and providers without routine
per-image usage reporting. Show source credit wherever an API requires it.
Use a centralized customer credits page only when the applicable terms permit
that placement. The [Pexels key notice](https://help.pexels.com/hc/en-us/articles/900004904026-How-do-I-get-an-API-key)
reports a pause and MioPages has no Pexels key. The prior fixture continues to
prove the shared lifecycle.

Pixabay fits the first low-volume, Operator-initiated pilot. The public API docs
direct new users to join or log in and show the standard key under Search
Images. Full-resolution fields require separate approval. The API is described
as free, with a default quota of 100 requests per 60 seconds per key. The
docs require caching requests for 24 hours, call for real human requests
and prohibit systematic mass downloads. One explicit Operator search over a
short editable phrase is the recommended boundary. A generated visual brief may
suggest a phrase. Background searching, autonomous selection, scraping and
batch acquisition are outside this policy. Confirm provider permission before
expanding the use or assuming suitability across many customer accounts.
[Pixabay API documentation](https://pixabay.com/api/docs/) and
[developer API overview](https://pixabay.com/service/about/api/).

Show Pixabay source credit and source-page links with Operator search results.
The content license makes credit optional for ordinary licensed uses and permits
copying and adapting covered images subject to its terms. The API requires local
copies for ongoing image use rather than permanent Pixabay hotlinks. Use only
selected images integrated into the customer site and review suitability,
recognizable marks, people, implied endorsements and third-party rights.
Avoid using hosted search thumbnails on customer pages. The reviewed public
docs specify no routine per-image usage reports or tracking callbacks. Confirm
any account-specific terms before live integration, including permitted creator
metadata for attribution. [API documentation](https://pixabay.com/api/docs/),
[license summary](https://pixabay.com/service/license-summary/) and
[full terms](https://pixabay.com/service/terms/).

Keep the search cache separate from licensed selected-image storage. For a
live trial, approve exact source, representation, permitted-use evidence,
bounded retention, withdrawal and audit rules. Use a controlled local copy
only after reviewing the placement and term restrictions. Suppress withdrawn
uses and record the action. Review exit delivery separately, because
standalone redistribution is restricted and resizing alone does not remove
that restriction. Where transfer is unavailable, plan a permitted replacement
or a separately cleared copy. WordPress Media Library synchronization, master
storage and exit packaging remain pending. [Pixabay full terms](https://pixabay.com/service/terms/)
and [usable website handoff](web-presence-service-model.md#customer-ownership-and-understandable-exit).

Openverse is the fallback for a small set of independently verified CC0
images. The API supports anonymous, rate-limited access and authenticated
application credentials with tiered quotas. Its catalog aggregates sources.
Check the original work's license and host terms before download or copying.
CC0 is compatible with the no-visible-credit preference where the original
claim is verified and third-party rights permit the use. Other CC licenses
may require attribution or restrict use and should stay outside the first
fallback. No fallback connector was implemented. [Openverse licensing guidance](https://openverse.org/about),
[API terms](https://docs.openverse.org/terms_of_service.html),
[authentication](https://docs.openverse.org/api/reference/authentication_and_throttling.html)
and [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/).

The local recorded-response adapter builds one bounded safe-search photo request,
normalizes source and creator credit, and exposes the selected web-sized
representation. The provider-neutral search and selection layer authorizes
the exact Operator and placement, caches successful responses for 24 hours
in process, and pins a selected result by digest. The selected result is an
unapproved draft for the acquisition workflow. It has no downloaded-byte
digest or reviewed license grant. Existing staging still requires those
bindings and accepts only the separately approved synthetic stock policy.
The reusable adapter has no downloader or publication path. The one-shot
local transport below is limited to the owner's single authorized test.

Before enabling repeatable live search, add shared 24-hour caching and key-wide
quota control with protected credentials, time and response bounds, allowed
hosts and redirect policy. Respect provider backoff on 429. Review credit
presentation and permitted use, retention and exit before any selected download
or release. Higher access, broad automation and new providers remain separately
scoped.

### C0 brand imagery review

The owner rejected TiBine’s workbench photo (Pixabay `384740`) for the C0 Home
Intro. The first live `workshop workbench` search was a technical API proof.
Its results and the previously proposed placement at `9a638b2` are historical.
The old exact download plan is withdrawn. Its guarded local transport and
safe ingestion remain reusable.

After reviewing the second search, the owner also declined Cleanly’s laundry-shop
photo (`6389104`) and F1Digitals’ freelancer photo (`7642551`). Both fell short
of improving the accepted Home. C0 stock discovery is closed and neither image
is approved for acquisition. The validated Pixabay capability remains available
for separately scoped use on suitable customer sites.

The accepted service-led v3 Home offers a clearer web presence with less work
to manage. The first Intro recognizes owners who are busy serving customers.
The later Intro, “Your business judgment. Our web responsibility.”, explains
the division of work between the business and MioPages. Consider a believable
owner in a small-business setting with a meaningful digital touchpoint for the
first Intro, or a natural consultation or handoff for the later one. Screen
out generic office posing, unrelated trades, invented testimonials, client
implications, readable branding and sensitive screen content. Keep the
conceptual Hero and illustrative Review report. When the relationship or the
process is the subject, consider keeping the text or using authored illustration.

The owner authorized one search for this brief. The fixed phrase
`small business laptop` balances business context and a digital cue while
leaving the provider room to return relevant settings. The launcher reuses
the verified HTTPS, hidden key and one-attempt controls. Keep its result cache
and editorial notes local and Git-ignored. The owner review links to the
Pixabay source pages, identifies each creator and explains potential placement.
The review uses the accepted Home capture as context. Candidate selection
and any image-specific license, third-party rights and exact download
authorization remain separate. See [Pixabay API conditions](https://pixabay.com/api/docs/),
[Pixabay terms](https://pixabay.com/service/terms/) and the
[accepted v3 design](miopages-business-focus.md).

### One authorized local live search

The first live trial is one human-initiated, safe-search photo request for
`workshop workbench`. The server-side launcher makes a single HTTPS request
to the fixed Pixabay search endpoint, verifies TLS, and bounds the response.
Pixabay requires the key as a query parameter. Keep the request path in process
memory and exclude it from output, telemetry and receipts. The launcher follows
no redirects and issues no retry. The local exclusive attempt marker survives
interruptions and blocks a second request even after a failure or cache expiry.

The owner completed the trial on November 7, 2026. The verified evidence
contains one request, HTTP 200 and eight results. It remains in the private,
Git-ignored directory `runtime-content/pixabay-live/first-search-574c573`.
The normalized cache is retained for the required 24 hours. Open its
`review.html` to inspect provider tags, creators and representation dimensions.
The source links open only when selected. The review loads no images
automatically.

The successful credential handoff used a standalone hidden PowerShell prompt
followed by a separate command passing the key through stdin. The previously
saved encrypted value failed local validation before transport. It remains
untouched, and this run established no reusable persistent key. The attempt
marker records the consumed authorization. This trial ends at discovery.
A later explicit selection would pin the result digest and exact placement
before separate rights review and authorized media acquisition.

## Standing customer media rights and authenticated upload

The owner approved agreement-based rights evidence on November 7, 2026. For
ordinary customer-owned submissions, use the standing media warranty and
authorization accepted by an authorized customer representative. The upload
records the applicable acceptance and avoids a per-image legal questionnaire.
Operator acceptance of that basis is distinct from independently verified rights.
Stock and generated sources require their own license, provider and provenance
policies.

The desired agreement covers the customer's representation and warranty that it
owns or has sufficient rights for the intended uses, authorization for MioPages
to store, reproduce, process, optimize, modify, distribute and publish as needed
for the service, responsibility for accurate representations, appropriate defense
and indemnification for specified claims, and notice of changed, expired or
disputed permissions. Before commercial launch, qualified counsel must review
the actual language, enforceability, DMCA applicability, insurance and relevant
third-party rights. This direction settles product evidence handling. Legal terms,
protections and liability remain open.

Route known restricted third-party licenses, conflicting ownership claims, signs
of unauthorized use, identifiable-person privacy or publicity questions, expired
or limited commercial permissions, complaints and revocations for exception
review. Ask for targeted evidence when needed. An active dispute or withdrawal
blocks eligibility. Routine submission can proceed with standing agreement
evidence, while the existing scoped Operator review, exact page approval and
separate release mandate remain in force. Automation requires a separate decision.

The disposable implementation handles a POST request carrying one raw PNG up
to 1 MiB and a scoped submission ID. Authentication precedes body reads. A trusted
adapter resolves the submitter, upload grant, exact Web Presence and placement,
agreement version, acceptance reference, accepting representative and acceptance
time. Request fields cannot establish that authority. The existing acquisition
ledger records the submission identity and time, restricted Intro use, agreement
evidence, source and prepared SHA-256 and subsequent review decisions. The original
and prepared bytes are content-addressed in private staging. Credentials are
excluded from evidence. Exact retries reuse the candidate, and conflicting
bytes or agreement evidence refuse.

The same authority adapter verifies the current grant and agreement in the
intake, review and exact page proposal/release transactions. When rollback would
restore a supplied image, its current eligibility is checked again. Image-specific
revocation uses the existing candidate ledger. A missing verifier, stale
acceptance, dispute or withdrawal refuses release. Preview and release verify
the prepared bytes. The Operator review also verifies the privately retained
original.

Only the isolated fixture supplies authentication and agreement evidence. The
request handler is exercised locally and has no registered app route. Production
requires P7 identity, session and scoped delegation, durable representative
acceptance and current-state checks that serialize with relevant writes, reviewed
database permissions, upload deadline/rate and abuse limits, privacy, retention,
dispute/withdrawal operations and a minimal customer interface. The shared
authority and legal review gates remain open before real customer use.

## Operator-assisted customer-supplied raster

The disposable intake extends the same work, candidate and append-only review
records as the generated pilot. An authenticated capability adapter supplies
scoped receive, review and revoke authority for the exact Web Presence, Managed
Site, Page and existing Intro Section. The test adapter grants synthetic
capabilities only. Supplier identity is recorded as reported by the Operator and
is separate from the Operator's authenticated identity.

| Source kind | Accepted input in this proof |
| --- | --- |
| Upload | Supplied bytes and an identifiable submission record. |
| Website reuse | A supplied copy and source/permission reference. The intake does no network fetching. |
| Authorized Asset reuse | An exact owned, active managed PNG and its recorded authority. The source Asset stays intact. Previously acquired lineage requires its own eligibility path and is outside this reuse branch. |

Record the ownership, license or permission claim, supplier reference, any
supporting record reference and the exact Intro image placement. The bounded
raster validator decodes the actual file, enforces dimensions and byte limits,
prepares a single PNG and records the source and prepared SHA-256 and
transformation identity. Existing prepared Asset reuse validates and pins the
owned source and uses its exact bytes. The prepared candidate stays in a separate
private root. Exact retries under the same scoped submission ID return the same
candidate. Conflicting bytes, claims or placement refuse.

The Operator inspects the staged bytes and current placement, then records
suitability, contextual alt text and a reason against the candidate digest.
Approval distinguishes acceptance of the supplied attestation from independent
verification, which requires its own evidence reference. An attestation reference
must match the supplied record. This is an attributable review of referenced
evidence and is limited to the disposable proof. The service cannot authenticate
the supplier or independently interpret a license.

Approval and Asset preparation commit with the existing acquisition evidence.
The Asset is unattached and marked with acquisition lineage so legacy delivery
cannot use it. The separate page preview and approval bind the reviewed bytes,
placement, rights review and exact AssetUsage. The existing release operation
installs the usage. Candidate withdrawal, expiry, changed managed bytes or
a changed original Asset blocks a new release. Rejected candidates never create
an Asset. The existing release fingerprint and rollback checks apply.

The subtype is enabled only by the guarded fixture setup on loopback PostgreSQL.
It adds no table and changes no installed migration or production schema.
The generated Hero policy remains context-bound. Before production, review
the shared migration and permission surface, authenticated supplier/tenant
binding, authorization to accept an agreement or resolve an exception, when
independent evidence is required, permitted use, withdrawal, expiry, retention
and abuse safeguards.
Customer upload UI and authenticated submissions and practical stock sourcing
remain required Commercial V1 work. WordPress storage and synchronization
remain separate pending decisions.

## Schema review before migration

The existing nineteen customer tables have no durable external job, private
candidate or attributable media decision equivalent. Migration 0009 adds only
`external_work`, `media_candidates` and `external_work_events`. No customer table
changes are needed. After disposable rehearsal, 0009 was applied as an inert schema
foundation to shared development, followed normally by 0010 (eleven journal rows).
All three acquisition tables remain empty. Table existence starts no work/provider
call and enables no shared/public acquisition runtime. Existing disposable pilot,
quarantine, budget and approval/refusal boundaries remain unchanged. See the
[durable development intake checkpoint](free-review-intake.md#current-durable-development-checkpoint).

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

The generated Hero pilot remains separate from stock selection. Live stock sourcing is pending. Practical stock
acquisition and customer media upload are Commercial V1 completion work above;
deterministic graphics and broader non-image intelligence remain later extensions.
Editorial/canonical reconciliation remains a reusable non-image direction. Real
canonical attachment, public publication, commercial launch, customer UI and
commit/push are outside this
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
