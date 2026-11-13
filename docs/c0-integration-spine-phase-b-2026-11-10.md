# C0 integration spine · Phase B local proof

[Owner authorization](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6774531879) · November 10, 2026 · **Local technical stage and review**

One saved answer in a disposable C0-derived interview reached the private WordPress review surface as one versioned, text-only Service Intro. The existing protected Core delivery and PHP stage handled the signed payload. The [public launch plan](miopages-accelerated-public-launch-2026-11-10.md) recommends a separate manual WordPress release on the existing public site.

## Inspect the walkthrough

From a checkout of `codex/c0-integration-spine-phase-b-2026-11-10` with the repository's locked dependencies, Windows PowerShell can generate and open a fresh copy. Use a local PostgreSQL 18 tool directory and PHP CLI with Sodium on PATH.

```powershell
& {
    $env:WORDPRESS_TEST_PG_BIN = 'C:/Program Files/PostgreSQL/18/bin'
    $env:MIOPAGES_C0_SPINE_REVIEW = '1'
    try {
        $run = node --import tsx --test --test-name-pattern='Protected operator' tests/integration/wordpress-delivery.test.ts
        $code = $LASTEXITCODE
        $run
        if ($code -ne 0) { throw 'Local proof failed' }
        $receipt = $run | Select-String '^C0 spine review: (.+)$'
        if ($receipt.Count -ne 1) { throw 'Local review snapshot missing or ambiguous' }
        Invoke-Item -LiteralPath $receipt.Matches[0].Groups[1].Value
    } finally {
        Remove-Item Env:MIOPAGES_C0_SPINE_REVIEW,Env:WORDPRESS_TEST_PG_BIN -ErrorAction SilentlyContinue
    }
}
```

The ignored HTML is a read-only capture from a successful run. Follow **Interview → Operator → Customer preview**. The fixture database, test principals, stage and signer are disposed before the HTML is written. The capture contains synthetic evidence and one escaped rendered fragment, with no key, token, raw envelope or customer records. The browser file records the validated stage at capture time and has no live approval or publishing action.

## What was connected

1. Both commercial-gated paths use the same [Issue #10 engine](../lib/platform/intake/intelligent.ts). The managed-service direction comes from the [C0 brief](miopages-c0-business-brief.md) and the old site's description is separately attributed. Review-led intake uses the exact approved disposable Review, with no Review evidence on the direct path. The [fixture adapter](../tests/helpers/c0-spine.ts) responds deterministically to a stored answer. The existing-site response leads to a planning-review finding and a handoff follow-up. The new-site response produces a different follow-up and leaves a material evidence question open. Both answers remain staged.
2. The direct case's existing activation binding supplies the inactive delivery tenant. The protected fixture author's proposal uses the selected finding for an editorial headline and binds the exact draft digest in its rationale. The body uses a separately seeded and confirmed public fixture fact. The protected proposal service records the exact preview approval under a fixture mandate. A different authenticated principal reviews the canonical projection and issues to one enrolled installation. The browser capture shows case, draft, proposal, principal and grant references, approval and projection digests, release and artifact IDs, and the exact Core receipt.
3. The [protected integration test](../tests/integration/wordpress-delivery.test.ts) validates PHP's generated pull and receipt requests against the real Core handler. The [compatibility harness](../wordpress/miopages-delivery/tests/core-pull-compat.php) substitutes the network response while retaining PHP's real stage validation and storage. The [read-only PHP preview](../wordpress/miopages-delivery/tests/staged-intro-preview.php) takes trusted fixture pins after Core rechecks current release eligibility. It reads the digest-named stage file, checks its digest, signature, approval, scope and exact Intro shape, and renders from those bytes. There is no new plugin hook or endpoint. The frozen preview and accepted release/pull implementation are unchanged.

## Verification and remaining boundaries

The proof refuses the wrong draft schema or scope, stale draft versions, wrong preview tenant/site/release/digest or approval, changed stage bytes, stale canonical base and revoked approval or installation. It also verifies exact receipt retry, independent reviewer refusal for the approver, no active pointer or canonical page creation, and unchanged canonical fact. The C2 isolation control runs in the separate offline onboarding regression. All writes were confined to a newly created local PostgreSQL cluster or private test directories. The narrow intake change allows only the explicitly named disposable schema for intelligent draft operations and preserves the existing local database, host, port and ownership guards.

Local verification used Windows, Node 24.18, PostgreSQL 18.6 and PHP 8.3.27 with Sodium. The consolidated WordPress command passed 388 application tests, seven gateway/pull tests, four PostgreSQL integration tests and the PHP offline gate. The additional onboarding and Operator run passed all ten tests. The final focused run passed the changed-canonical-base refusal and produced the local review file. Route type generation, TypeScript, targeted lint, PHP syntax and the documentation diff passed. POSIX mode checks remain outside the Windows run.

Review still needed on true customer/Operator authentication, native WordPress Pages/blocks/media/navigation and actions, whole-site customer signoff, and measured Ongoing outcomes. The example Ongoing prompt is labeled in the walkthrough. Issue #10 owns genuine AI questions and any provider approval. The [closed hosted delivery milestone](development-control.md#wordpress-private-delivery-acceptance-closed) remains accepted. The local proof used fixture networking and did not exercise live TLS.

[Issue #10's continuity decision](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6774762930) keeps the preserved C0 interview and owner corrections available for its separate reconciliation. The Phase B fixture did not use that private evidence.

The next public decision is to review the [WordPress editorial release plan](miopages-accelerated-public-launch-2026-11-10.md), confirm authorized editing and rollback access, and authorize exact draft preparation and inquiry delivery verification separately. Publishing requires a further exact go-live approval.

## First connected operational cycle

[Owner direction](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6813306713) · November 12, 2026

Run the same PowerShell walkthrough above from the checkout of
`codex/first-operational-cycle-2026-11-12`. The generated HTML opens to
**Business knowledge → Customer preview → Inquiry and measurement → Operator
review → Improved preview**. The report is a read-only capture. The test
executes the connected operations before writing it and disposes the fixture.

| Step | Working component | Temporary beacon and replacement |
| --- | --- | --- |
| Entry and evidence | The same commercial-gated Core interview reads both saved entry paths. It scopes the synthetic approved Review to the Review-led case and keeps the existing-site observation and C0 brief separate. | The Phase B answer adapter is deterministic. Replace it with Issue #10’s real AI interview once its allowed input contract and product interaction pass review. The preserved owner interview and fictional C2 records are outside this tenant. |
| Assessment and Presence Direction | The two saved findings produce different audience and Service emphasis. The direct-start finding supplies the first candidate. | A small mapping attaches draft digest, uncertainty, page purpose and action intent. Replace it with versioned, evidence-bound Presence Direction proposals. |
| Private site | Protected Core authorship, exact proposal preview, separate fixture approval and independent projection review feed signed Home and Service Intros. PHP validates and stores each envelope. Core reconciles the exact receipt. | The adapter accepts one Intro per release and keeps the latest reviewed source per site. Separate fixture installations and the read-only captured page links assemble the walkthrough. Replace with an exact multi-page proposal and native private WordPress page, navigation, media and Action integration. The captures do not represent simultaneous current release eligibility. |
| Inquiry | The same disposable site scope accepts one request through Core Contact. Exact retry returns duplicate, foreign-site submission is refused, and a stored submission and accepted event reconcile. | A temporary local Contact definition and page stand in for the WordPress visitor action. No notification route was configured. Replace with the staged site's scoped native action, authorized notification and separate lead qualification. |
| Measurement and improvement | One accepted event and the saved synthetic visitor question identify uncertainty about what to bring. Service revision 2 keeps the same Page and proposal IDs and explicitly asks visitors to bring their current site's address. Core and PHP stage the changed bytes and reconcile a new receipt. | The snapshot and interpretation are fixture rules. Visits, rate, lead quality and conversion are unknown. Replace with durable first-party measurement and an Operator workflow that records decisions and remeasurement against an actual baseline. |
| Customer and Operator | The capture has customer progress and before/after previews, plus a separate Operator evidence section with approval, scope, revision and receipt references. | Local test authority and a static review capture. Replace with authenticated Customer and Operator views over live scoped workflow records, with separately authorized real approvals. |

The walkthrough performs no provider calls, sends no notification and applies
no publication. The previous live AI evidence remains on Issue #10. This
branch keeps its worktree and Git history separate and does not repeat the
hosted WordPress acceptance. A subsequent measurement is proposed in the
capture. No post-change outcome is asserted.

Verification passed both local WordPress integration tests, all six offline
onboarding checks, PHP syntax, TypeScript and targeted lint. The rendered
capture was checked for working section links, three staged page captures
and the before/after wording. The original Phase B revocation, receipt retry,
tampered-byte and inactive-pointer checks still ran.

## Unified private site candidate

[Source review](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6825669795)
and [owner go-ahead](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6825736318).

The Managed Site candidate is non-public. The [architecture](platform-service-architecture.md)
defines stage-appropriate review and response by both customers and Operators,
with separately scoped Operator evidence and exact-revision approval authority.
The local capture illustrates those views. Authenticated sharing, feedback,
and approval interactions remain outside this increment.

Regenerate using the PowerShell command above on
`codex/first-operational-cycle-2026-11-12`. Choose **Customer preview → Open
the private candidate**. Use **Home**, **Service** and **Ask about your website**
in the site header. The inquiry link opens the local sample and its accepted
Contact outcome. Return to **Operator review** for the trace, then choose
**Service before** and **Service after** under **Improved private candidate**.
Both versions keep the same Home and Service page identities and navigation.

The review bridge groups two PHP-verified staged pages only when their site,
canonical base and exact staged receipts agree. The version manifest binds
each page ID, proposal, revision, exact preview digest, projection, stage
digest and receipt. Version 2 references the version 1 digest, retains the
exact Home capture, and accepts only the next revision of the same Service
proposal and Page. Core revalidates Home's approval and projection after
staging the revised Service. The Contact definition is seeded before the
first page approvals so the temporary inquiry route leaves the same base
available after the sample. Its accepted event, explicit recommendation,
protected Service revision and new acknowledged staging receipt remain
in the walkthrough.

Home describes MioPages as moving from legacy offerings toward a managed
Web Presence service. Service explains the planned Launch and Ongoing
relationship. These fixture projections carry no claim of commercial
availability, commitment, pricing, launch date or measured outcome.

**Native boundary.** The signed envelope validator already accepts multiple
pages. The protected source still resolves one latest `PageProposal` and
one approval event per release. It excludes Action-bound content, and the
WordPress staging store writes an immutable object rather than private
WordPress Pages or navigation. Combining the pages into a single signed
delivery here would require changing what the approval attests to. This
increment preserves that boundary. The candidate manifest is a local
review identifier, with no signing or approval authority. The two stages
are individually authenticated and captured while eligible, without
claiming simultaneous pull eligibility.

Replace the bridge with an exact site-level proposal and preview covering
the full page set, navigation and Action targets, plus a WordPress private
draft materializer with rollback and Core receipt reconciliation. The
local navigation and Contact action are presentation bridges. The
inquiry, measurement interpretation and Operator decision are fixtures.
Native notification delivery and post-change measurement remain open.
Issue #10's AI path stays separate and the interview provider here remains
deterministic. No new model calls, real approvals, deployment or publication
are part of this run. Local verification does not establish owner acceptance.

Both WordPress integration tests passed. The final focused rerun regenerated
both site versions and verified the navigation, inquiry link, C0 transition
copy, manifest digests and before/after Service text. The integration test
also refused foreign-scope members, mismatched bases and receipts, and a
revised member from a different proposal. TypeScript and targeted lint passed.

## Role-played Operator review and draft plan

[Owner decision](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6826131281)

Regenerate the walkthrough using the PowerShell command above on the
current `codex/first-operational-cycle-2026-11-12` checkout. Open **Operator
review** and choose **Content Reviewer**. Compare the Service wording and
add an observation or change request. Switch to **Technical Operator** in
the same page. Read the handoff, inspect the version 2 manifest and draft
plan, and add a QA observation or technical change request back to Content
Reviewer. Both perspectives use version 2 of the same candidate. Notes
stay in the page and clear on reload. The roles are provisional examples
to evaluate which responsibilities and handoffs make sense.

The separate Customer preview is still a non-public local capture.
Customer sharing and response remain subject to staged access and P7.
Role-play can neither record a real decision nor satisfy principal separation,
customer consent, exact approval, or release authorization.

The PHP test preview extracts draft-only Page inputs from each exact
validated signed object. The candidate manifest now binds each source
approval and draft input digest. The local draft plan collects both inputs,
paths, navigation and Contact intent under that manifest digest. Its state
is blocked pending site-level approval and native materialization. No
WordPress record is created by the plan. The next integration step is an
exact site-level preview and approval, followed by a rollback-capable
private draft writer and receipt reconciliation. The synthetic inquiry and
measurement still exercise the existing local cycle. Real AI interviewing,
lead qualification and durable first-party measurement remain separate
development tracks.

Both local WordPress integration tests passed. The final focused rerun
verified role switching and notes in both directions in the generated
browser document, literal rendering of note text, the script policy hash,
and both draft input digests. TypeScript, targeted lint and PHP syntax passed.

## Pending native draft authorization

The current [Issue #12 milestone](https://github.com/R-Levin/myomaton-web/issues/12)
is to create actual native, non-public Home and Service drafts and carry the
synthetic inquiry through a governed revision, rollback and remeasurement
handoff. This advances the approved [managed service](web-presence-service-model.md#ongoing-service-and-value),
[content-growth loop](content-growth-loop.md#human-review-and-publication-approval)
and [measurement contract](measurement-and-analytics.md#business-change-context).
It adds a real surface for reviewing and testing improvements while leaving
business outcomes, approved public release and remeasurement as distinct stages.

**Implemented boundary.** The protected [release source](../lib/platform/wordpress-delivery/private-source.ts)
resolves one latest `PageProposal` and one exact approval. It explicitly
refuses Action-bound content. [Migration 0017](../lib/platform/wordpress-delivery/0017_private_stage_authority.sql)
requires the matching proposal and approval pair. The signed envelope
accepts multiple pages, but it does not establish approval of their
combined navigation and visitor actions. The existing PHP staging store
writes immutable files and the receipt acknowledges those bytes. Neither
is a native WordPress draft write or an application receipt.

**Proposed decision for owner discussion.** Preserve the existing per-page
approvals and add one exact, site-scoped non-public draft authorization
over the ordered page revisions, navigation, resolved Actions, canonical
base, installation and prior draft version. Reuse Core's protected
principal and independent review pattern. Use separate fixture principals
in the disposable test. A scoped Operator would authorize materialization
for QA and customer review. The customer would review the resulting
non-public revision, request changes, or provide exact launch acceptance
when eligible. Customer launch acceptance and public release authority
remain separate from the draft authorization. Simulated roles have no
authority in this path.

**Acceptance after the decision.** Reject stale or foreign members, changed
navigation or Action targets, and approval/reviewer conflicts. Write or
revise only the identified native drafts, link Home and Service, and
reconcile a new draft-application receipt to the exact site version.
Keep the staged-object receipt distinct. Roll back to the matching prior
draft revision and verify the restored pages, links and Action. The local
test needs an isolated real WordPress runtime and database. The current
CLI test runs PHP with WordPress shims and has no native writer.

The tempting shortcut is to write drafts from the existing local manifest
using two Page approvals. That would leave the site's composition and
Action outside the authority evidence. This is a material approval-contract
change, so implementation is paused. No new grant, migration, native write
or owner approval has been recorded.

Baseline verification from `37cac856` passed both local PostgreSQL/PHP
delivery integration tests, including the inquiry-driven revision, signed
receipts and simulated role handoff. This verifies the existing bridge.
Native draft creation and rollback are still unverified.

Keep Issue #10's genuine AI interview on its separate branch. The next
measurement slice should attach a customer-confirmed qualification or
outcome to an accepted inquiry and preserve an explicit unknown when no
answer exists. First-party signals should tie to an exact candidate and
baseline before any post-change comparison. Those are parallel product
capabilities under the existing contracts. The current inquiry, snapshot,
recommendation and role notes remain local fixtures.

## Hosted native draft continuation

[Owner execution directive](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6829990525)
supersedes the earlier pause for a design decision. The target remains the
existing 20i Cloud, Supabase and protected WordPress installation. No
parallel environment was created.

The existing protected review service can now derive an exact read-only
site preview. It revalidates current per-page approvals, canonical source
and independent reviewer authority, checks that the installation is active
and scoped to the same site, and binds the ordered pages, navigation,
internal Actions and revision link into one digest. This is a review
operation. Durable draft authorization, a native writer, a distinct
application receipt and rollback remain required. Launch acceptance and
publication continue under separate authority. Fixture review notes carry
no authority.

The existing protected operator CLI exposes this review as
`preview-site-draft`. It takes the site, exact Page proposal and approval
references, and the draft selection over the existing protected stdin
channel. It uses the scoped private-stage reviewer grant and does not
need a signer. Both local delivery integration tests passed on rerun.
They verify the original connected cycle, deterministic before and after
site previews, an independent reviewer, installation scope, navigation
digest changes and refusal of an out-of-site Action. An earlier run hit
a transient Windows file lock during disposable PostgreSQL cleanup.

Read-only HTTPS requests returned 200 for Core, 401 for the protected
WordPress host and 502 for the retained idle acceptance hostname. The
three account SSH probes returned permission denied. The Windows command
session could not connect to an OpenSSH agent. Current host files, roles,
database reachability and WordPress state could not be independently
verified in this pass. Prior accepted delivery and database evidence is
historical. No hosted writes were performed.

### Hosted access reverified

The existing Windows agent became available. Read-only SSH verified the
public Core checkout at `62439fc` on Node 22.23.2, the separate rehearsal
checkout at `7e44f3a`, and an empty acceptance webroot with no port 8081
listener. On the protected WordPress host, WP-CLI reported WordPress 7.1.4,
MioPages Delivery 0.0.6 active, and a successful local database query.
The retained protected role file was owned by the Cloud account with
mode 0600. Both restricted Supabase role probes independently passed
verified TLS and Session Pooler session integrity using that file.

A read-only scoped inventory found zero active fixture installations and
zero fixture grants backed by unexpired, unrevoked operator credentials.
Database login and SSH access therefore exist. The old rehearsal authority
cannot issue a new release. The remaining hosted authorization decision is
whether to enroll fresh short-lived, fixture-scoped test principals and one
installation through the existing protected process. That would be a new
scoped enrollment, without replacing existing credentials. No hosted data,
credentials, plugins, listeners, approvals or grants were changed.

### Native plugin development

The owner authorized fresh scoped rehearsal enrollment and the necessary
development plugin update. Enrollment is timed for the hosted run because
the test principals are short-lived.

The plugin source now has a draft content projection for reviewed Intro
sections, ordered navigation and internal Page Actions. It maps to native
Gutenberg heading and paragraph blocks and WordPress preview links. The
Contact beacon remains outside this projection. Local PHP verified fixed
draft status, escaping and refusal of duplicate or foreign targets. WP-CLI
on the existing development installation parsed both synthetic page
inputs with WordPress's native block parser. No posts were written and
the installed plugin was unchanged. This projection has no CLI entry
point. Durable authorization, a guarded writer, rollback and a
Core-reconciled application receipt remain open.

### Theme and draft authorization

The [service model](web-presence-service-model.md) and [content-growth loop](content-growth-loop.md)
remain the controlling plan. Native drafts provide the review surface for
the inquiry-to-improvement cycle. The theme only renders that surface.

- **Hosted:** MioPages Managed Site 0.1.0 was checksum-verified and installed
  on the protected WordPress development installation. WordPress recognized
  it as a block theme. A process-local WP-CLI preview exercised its page
  template, global stylesheet, palette and Gutenberg content with a synthetic
  sample. Twenty Twenty-Five 1.5 remains active and MioPages Delivery 0.0.6
  remains installed. The sample HTML is ignored locally at
  `runtime-content/miopages-managed-site-hosted-theme-0.1.0.html`.
  It illustrates the reusable theme and contains no native draft posts.
- **Theme boundary:** Semantic surface, ink, brand and supporting presets
  give Core stable presentation targets. The same block theme can serve
  multiple Managed Sites. Mapping Core visual direction to selected presets
  and reviewable page design remains open. The theme has no synchronization,
  canonical content, approvals or business logic.
- **Locally implemented:** Protected `authorize-site-draft` requires a
  distinct scoped authorizer and an independently authenticated reviewer.
  It rederives the exact site digest and binds immutable revision and
  predecessor records under migration 0018. It does not confer customer
  acceptance or public publication. The existing staging receipt still
  acknowledges only signed staged bytes.
- **Pending:** Migration 0018 has not been applied to hosted Supabase.
  The existing migration runner exposes separate `apply-native-draft-stage`
  and `verify-native-draft-stage` operations. Signed draft authorization
  transport, guarded native materialization, application receipt and
  rollback must be connected before updating the hosted plugin or creating
  WordPress drafts. No short-lived principals were enrolled in this slice.
  Issue #10 remains separate. Inquiry acceptance remains connected in the
  local cycle, and customer outcome feedback and first-party measurement
  remain separate product work.

Both WordPress delivery integration tests and all ten database rollout
regressions passed. The tests exercised the 0017-to-0018 upgrade and retry,
exact authorization retries, reviewer-only refusal, mismatched digest
refusal, restricted pull-role access and two linked authorized revisions.
TypeScript and targeted lint passed.

### Signed native draft continuation

The hosted integration milestone remains actual non-public native drafts
and a reversible inquiry-driven change under the managed service and
content-growth contracts. Issue #12 clarifies that scoped Operators may
use WordPress for site work while Core remains the operating workspace.
Customer review through Core remains a separate protected sharing flow.

Core now rederives the authorized site revision and checks the current
enrollment key, exact reviewer and authorizer grants, and latest durable
decision before issuing a domain-separated draft-only envelope. PHP checks
the signature, time window, intended use and installed site identity.
The v1 staging envelope and receipt stay separate. The internal writer
contains draft-only copy-on-write, a predecessor check, native readback,
and a transaction-protected pointer. It is not registered as a command
or deployed. Core application receipt reconciliation and intentional
restoration of a prior draft remain required.

Both local delivery integration tests passed, including PHP verification
of a Core-issued envelope and refusal before authorization, on wrong
signer, on changed bytes, and on a foreign installation. The hosted
WordPress database verified that posts, postmeta and options use InnoDB.
WordPress remains on Delivery 0.0.6 and Twenty Twenty-Five 1.5 active,
with Managed Site 0.1.0 installed and inactive. No draft posts or hosted
database changes were made during these checks.

The migration launcher `scripts/wordpress-native-draft-migration.sh`
requires the existing migration-role password through a hidden prompt
in the established Cloud rehearsal checkout. It reuses the known
Session Pooler parameters and verified CA, then runs the explicit 0018
apply and independent verify operations. Retained credentials are for
the Operator and pull roles. They do not supply the migration password.
No new credential or database environment is needed.

The reviewed source for the migration was transferred as a checksum-verified
Git bundle into the existing detached Cloud rehearsal checkout at
`0758217`. The first transfer command failed at shell quoting before
checkout. The corrected command verified the bundle and the final HEAD.
The migration awaits the operator's hidden input and PASS receipts.

The subsequent development plugin source is version 0.0.8. Its
CLI-only native draft command requires a protected installation identity,
an authorized WordPress editor and an exact Core-signed apply or restore
operation. Apply allocates versioned native draft posts and switches only
the private review pointer. Restore verifies the current and previous
versions before returning the pointer to the prior draft set. The CLI
reports exact readback hashes and post IDs. These reports are not yet
reconciled to Core. The implementation does not expose public routes,
and intentional restore ends this bounded two-version rehearsal. Further
revisions after restore need an explicit resumption contract. Plugin 0.0.8
has not been installed or used to write hosted drafts.

The next receipt increment authenticates WordPress's native readback with
the scoped installation secret. The receipt uses a separate HMAC context
from staging. Core validates the requested and applied digests, operation,
installation, site proposal, revision, page paths, draft status and unique
WordPress post IDs, and retains the exact content hashes for reconciliation.
The verifier takes its expected values from the caller's Core decision.
Durable receipt recording, lookup of the authoritative expected decision
and the hosted apply/restore test remain open. The test used synthetic
readback data and the real PHP receipt format. No hosted plugin or
credentials changed in this increment.

### Hosted migration 0018 verified

The operator's protected Cloud launcher returned PASS for both
`apply-native-draft-stage` and `verify-native-draft-stage`, each with
three recorded adapter migrations. Independent read-only hosted probes
confirmed the new authorization table is empty. The restricted Operator
role has SELECT and column INSERT access, with no UPDATE or DELETE. The
pull role has none of these permissions. No migration retry is needed.
This checkpoint did not enroll principals or create WordPress drafts.

### Native application receipt reconciliation

The protected Core operator CLI now accepts `reconcile-site-draft`.
It verifies the enrolled installation's signature on the exact operation,
looks up the current durable site authorization under the scoped reviewer,
then checks WordPress's application MAC using the enrolled installation
secret. Core writes immutable receipt evidence in a configured owner-only
directory on the existing Cloud rehearsal account. This file journal is
the development receipt store and does not require a second migration.
It accepts exact retries, rejects conflicts, and compares a restore with
the prior application receipt's exact WordPress post IDs and content hashes.
It also requires a reconciled application of the revision being restored.
The existing staged-object receipt remains independent.

Both local delivery tests and both receipt tests passed, as did TypeScript,
targeted lint, PHP syntax and the native content check. Hosted read-only
checks still found zero active installations and zero usable scoped
Operator grants for the designated fixture. The restricted Operator login
cannot insert principal or grant rows. Migration 0018 is complete. The
concrete authorization dependency is the previously approved scoped
enrollment through the existing protected migration-role procedure.

Delivery 0.0.8 is active on the protected WordPress development installation.
Package SHA-256 is `4d28e5e90fe2e67ab5235cb6522d17421c5138d90762b04518e133ef04406b2e`.
The verified previous 0.0.6 rollback ZIP is retained off-webroot in
`~/miopages-native-draft-plugin.rSmjFa49` with SHA-256
`42de1d2190c7ad8d9db88a50c02db01618303fe4f791ceb2bd3e0d3a31e3e85a`.
The protected hostname returned HTTP 401 without authentication. WP-CLI
reported Managed Site 0.1.0 active. No theme switch was performed in this
increment. Native identity and pull configuration were both absent and
the database contained zero native draft pointers. There are no owner
draft URLs, hosted application receipts or verified native rollbacks yet.

### Hosted re-enrollment blocked by the revoked origin binding

A read-only probe through the verified hosted Operator role found one
`https://miopages.org` installation row, revoked at generation 1. The
hosted database confirmed `UNIQUE (origin)` on the installations table.
The existing enrollment command inserts a new row and therefore cannot
reuse this origin. The rotation command refuses revoked installations.
The approved enrollment did not start, so no migration password,
principals, grants, credentials or WordPress changes were needed.

The narrow proposed correction is a forward adapter migration that
enforces one **active** installation per origin while retaining revoked
rows, keys and receipts. An enrollment test must confirm the old
installation remains refused and a second active enrollment conflicts.
This is pending owner approval. No migration rerun, credential rotation,
origin workaround, or modification to the revoked audit record was made.

### Active-origin migration and scoped enrollment

The owner approved forward migration 0019. It adds a unique index for
active origins and removes the broader constraint in one transaction.
The existing rows and grants are unchanged. The protected launcher checks
the 0018 ledger, applies 0019, verifies all four migration checksums,
permissions and the exact index, then enrolls the fixture. It uses one
hidden prompt for the existing migration password and never writes it to
disk.

In the existing authenticated 20i Cloud Bash shell, run:

```bash
bash ~/miopages-wp-rehearsal/scripts/wordpress-native-draft-migration.sh APPLY-0019-AND-ENROLL-NATIVE-DRAFT
```

Expect two migration PASS lines and an `enroll-native-draft` PASS line.
The launcher checks the exact fixture and revoked installation before
enrolling four distinct, 24-hour test principals for authoring, Page
approval, independent review and native draft authorization. It verifies
each token's allowed and refused operations, then enrolls one new
installation through the existing Core operator service. The revoked
installation, key and delivery history remain retained. Only the new
test material is stored in an off-webroot 0700 directory and 0600 file
for the hosted test. Keep its contents out of chat and Git. On BLOCKED,
preserve the report and stop. A partial enrollment must be inspected
before any retry. No native draft or publication is part of this launcher.

Both local WordPress integration tests passed. The protected test verified
the original constraint refuses reuse, the forward upgrade and retry keep
revoked rows, keys, deliveries and audit records identical, a scoped actor
can enroll a replacement, a second active enrollment fails and the old
installation still refuses pull and rotation.

#### Hosted 0019 verified and enrollment-only retry

The hosted launcher passed apply and independent verify with four adapter
migrations. A separate read-only hosted check confirmed the valid active-only
origin index, the original generation 1 revoked installation, zero active
fixture grants and no new custody directory. Enrollment stopped at
`enrollment-preflight` before any enrollment writes. The old fixture
initializer's verifier required a read-only transaction and an unchanged
initialization snapshot. The correction runs the established shared
inventory in a read-only transaction against the current fixture and
retained proposal history, then checks and locks the exact inactive
site scope in the separate enrollment write transaction.

Use only the enrollment retry after the corrected source is installed:

```bash
bash ~/miopages-wp-rehearsal/scripts/wordpress-native-draft-migration.sh ENROLL-NATIVE-DRAFT-ONLY
```

The retry verifies the existing 0019 ledger and grants before enrollment.
It has no apply step. Expect PASS for verification and enrollment.

### Hosted native draft apply and restore

On November 12, 2026, the enrollment-only launcher verified migration 0019
and enrolled installation `d84ebc69-46d5-4c64-adc6-ac7b87468f89` for the
existing inactive fixture. Independent protected authentication verified
the author, Page approver, reviewer and site authorizer grants. The old
installation `9a511424-79af-4d02-801e-8d191d4b0d2f` remains revoked.
The four test credentials expire at 2026-11-13 18:37:37.609 UTC. The
off-webroot WordPress CLI configuration remains restricted to this
installation. No secret or signer was copied into Git.

The first Core prepare operation refused an editorial-only Page before
saving it. After verifying that no new proposal existed, preparation used
the existing fixture's revision-linked canonical fact on both Pages.
The rendered Core previews were fetched and independently matched their
approval digests. A distinct scoped principal recorded each synthetic
Page approval, and a separate authorizer and reviewer authorized the
complete site. Neither operation records Customer acceptance or launch
approval. The scoped installation credential relay initially reported a
trailing line-ending error. The decoded file was independently verified
for ownership, permissions, syntax and scope before the first write.

| Hosted operation | Exact candidate digest | Native WordPress Pages |
| --- | --- | --- |
| Apply revision 1 | `d6b9d28e20de0f9605fb60a70c5df3b5e3278d19a13bb858f186fd3a90ca9c4d` | Home 13, Service 14 |
| Apply revision 2 | `3d9e6e560c69cea1ccb001fd8239ab5f8baff1e8dc566354350a0587f1bd8a98` | Home 15, Service 16 |
| Restore revision 1 | `d6b9d28e20de0f9605fb60a70c5df3b5e3278d19a13bb858f186fd3a90ca9c4d` | Original Home 13 and Service 14 |

The Core site proposal is `1e28f792-624d-4141-96db-45c4ba05e17d`.
The same Service Page proposal was revised to tell visitors to bring
their existing website address. That change responds to the established
synthetic inquiry. No new hosted Contact or outcome measurement was
performed. WordPress created actual draft Pages via the signed CLI
delivery on the existing development installation. Core authenticated
and durably recorded all three application receipts, then accepted
each exact retry. The restore receipt matched the original native
IDs and hashes, and the independent WordPress pointer readback returned
revision 1. These are application receipts, separate from the original
signed staging receipt contract.

WordPress 7.1.4 ran Delivery 0.0.8 with Managed Site 0.1.0 active. A
read-only WP-CLI render of the active theme's Page template with all
four actual posts verified the draft text, native block output,
navigation and the Home Action. All posts remain drafts. The stored
links are HTTPS, and logged-out requests to all four returned 401.
Authenticated browser rendering is available for the owner's review
using the existing site protection and WordPress editor login:
[restored Home](https://miopages.org/?page_id=13&preview=true),
[restored Service](https://miopages.org/?page_id=14&preview=true),
and [revision 2 Service](https://miopages.org/?page_id=16&preview=true).
The revision 2 draft set is retained for comparison. No public
publication, theme switch or Core public deployment occurred.

### Stable native WordPress Page identities

The owner approved stable native Page identities in [Issue #12](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6833439688).
The restored installation pointer selected Home 13 and Service 14.
Read-only inspection confirmed that all four earlier proof Pages were
drafts with empty slugs. Delivery 0.0.9 adopted the restored pair and
assigned `home-miopages-13` and `service-miopages-14` once. It now pins
the signed Core Page IDs and routes to this pair, locks and verifies
the current draft rows before writing, and preserves the IDs and slugs
on updates and restores. Native WordPress revisions preserve the before
and after content for authorized Operators. Core continues to govern
exact proposal previews, Page approvals and site-level authorization.
Customer acceptance and public release remain separate.

| Hosted operation | Exact authorized or restored site digest | WordPress readback |
| --- | --- | --- |
| Apply revision 3, adopting the restored baseline | `85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db` | Home 13, Service 14, original content |
| Apply revision 4, asking visitors to bring their existing website address | `1a6343c049c0430e51ef7fa3780123c9475352af0328301d661a38a9b500eb2a` | Home 13 unchanged, Service 14 updated |
| Restore revision 3 | `85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db` | Home 13 and Service 14, exact revision 3 hashes |

The Core receipt journal verified all three application receipts and
their exact retries. Home's SHA-256 remained
`960fea54ac23eb52c15eb9aedec4e84023903c845160942ebc96256b58999940`.
Service changed from
`90c4917bfe9fa5fd7d478df98a972c6cfd26050e47d54a0c735ef369d9cbc39e`
to `fa9596ba187dd3c2ee4293b3a751b58a86835200595bbd209e3cbd8bd9d44e95`
and returned to the original hash. The WordPress Pages count stayed
at six. Historical Pages 15 and 16 kept their status, slugs and
content hashes. Their disposition requires a separately reviewed plan.

The active Managed Site theme 0.1.0 rendered navigation between the
two actual drafts and the Home Action in each tested state. With
the existing HTTP protection and WordPress editor login, open
[Home](https://miopages.org/?page_id=13&preview=true),
[Service](https://miopages.org/?page_id=14&preview=true),
or the [Service change in WordPress Revisions](https://miopages.org/wp-admin/revision.php?revision=20).
The authenticated preview links always point to the currently applied
drafts. The historical comparison is available in WordPress Revisions.
Independent readback matched the exact Service hashes on native
revisions 19 (baseline), 20 (change) and 21 (restored). The two
preview URLs each returned HTTP 401 without credentials. Hosted
public Core remained at `62439fc`.

Forward delivery after a restore must extend the highest Core
authorization. Revision 3 therefore carried forward the already
restored content while authorizing the new stable baseline. The
first forward application after a restore cannot itself roll back
to a different physical snapshot than its signed predecessor.
Exact restore of a normal revision targets its immediate signed
predecessor. Page set or route changes require explicit reconciliation.
If a WordPress title, body, draft status or managed slug drifts,
the writer refuses the update or restore pending review.

Local verification passed the PHP stable writer regression and
four delivery and receipt tests, including two PostgreSQL integration
tests. Coverage includes legacy
adoption, duplicate prevention, logical identity change refusal,
native history, drift refusal and exact restore. The first plugin
install command stopped at the default CLI PHP 8.0 compatibility
check and left 0.0.8 active. The same archive installed successfully
with PHP 8.4.27 after verifying the retained 0.0.8 archive. Plugin
archive SHA-256 `6c3f812f0eb03016f97d433a8ea365c732d12e31c19662c8c1159ace9742fa7e`.
Rollback archive SHA-256 `000e5a5dcbb818b9721559b16008dfccbc72aeb468ea91b12dc1600530c5ac53`.
The archived plugin predates the stable pointer format and must
only be restored with a compatible reviewed state. The hosted test
used a signed content restore through 0.0.9.

### Connected operating cycle hosted readback

[Owner direction](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6842102841).
The local and remote cycle branch started at `c114ba77`, the isolated
Issue #10 worktree and remote branch remained at `d9ef9aec`, and remote
`main` was `68d77e59`. These histories have not been merged.

**Owner walkthrough.** Start with the evidence and decision in the table
below. Sign in through the existing WordPress protection and editor login,
then open [Home](https://miopages.org/?page_id=13&preview=true) and follow
the Service link. Compare the restored Service draft with
[revision 20](https://miopages.org/wp-admin/revision.php?revision=20),
which asked the visitor to bring their current website address. The
restored draft is the current revision. These links use existing
Operator access. Customer browser access through Core remains open.

| Stage | Verified behavior or beacon | Replacement boundary |
| --- | --- | --- |
| Entry | Both entry paths converge in the existing disposable Core integration. Review-led entry adds Review evidence. Direct start reuses known facts and skips the Review. The C0-derived test scope excludes protected C0 interview records and C2. | Hosted resumable customer intake and authorized role-scoped views must consume the same Core records. |
| Understanding | The earlier OpenAI proof generated the synthetic buyer follow-up, “What specific customer evidence could later show Launch and Ongoing changed an actual site, not just our intended process?” Without dated evidence, the assessment recommended proceeding with process descriptions while holding buyer-proof claims. With a dated internal comparison, it recommended internal review before considering shareable proof. This is retained real generated evidence, replayed here. | A hosted provider operation must take the allowed evidence projection, use the existing strict Responses validation and metered budget, and emit a draft finding. No new API request or protected data transfer occurred. |
| Direction | For this synthetic site, describe the planned Launch and Ongoing process and clarify the existing-site handoff. No customer results are asserted. This mapping uses the earlier proof as supporting reasoning and the hosted draft history as implementation evidence. | Persist an evidence-linked Presence Direction proposal with Operator review. This readback does not claim the AI response caused the historical hosted revision. |
| Site and Operator review | The existing hosted Core journal authenticated the exact prior apply, authorized change and restore receipts. WordPress keeps Home 13 and Service 14 under the installed Managed Site theme. The historical change used distinct scoped test principals. | Serve the same governed evidence through a scoped Core Operator view and protected Customer preview. Neither the readback nor a simulated role grants authority. |
| Inquiry and performance | The CLI composes one explicitly synthetic existing-website question as a fixture and attaches it to the verified baseline draft. It is not sent through Contact. The snapshot separates this sample, a verified navigation check, visitor coverage, accepted inquiry, notification, qualified leads and outcome. | Send an explicit development event through a scoped Action and the existing Contact writer when the inactive native fixture has an approved eligible form/definition. Replace the sample with a durable accepted-submission reference. Notification and customer-confirmed outcomes have separate state. |
| Recommendation and remeasurement | The sample yields the recommendation to tell existing-site visitors what to bring. The hosted readback reconciles both revisions, verifies stable Service navigation and confirms that retained revision 20 contains the clarification absent from the baseline. This is a content/Action verification. No change in visitor behavior, lead quality or business outcome is established. | Bind the observation window to the actual deployment and compare real first-party observations. Keep missing data unknown. |

The protected host-side readback uses the existing Core receipt journal
and scoped installation receipt key. A fresh WordPress CLI readback
supplies only Page IDs, content digests and bounded booleans. The
temporary scripts are removed after execution. No runtime, active site,
database, credentials, customer approval or publication changes were
made by this readback. The existing local connected fixture retains
Contact acceptance and duplicate handling evidence.

**Next integration.** The inactive hosted draft fixture cannot accept
the existing canonical Contact request because the handler requires
an active Web Presence, Managed Site, Page, Section and definition.
The native draft writer currently supports Intro blocks and internal
page Actions. The next functional slice should connect a protected
development Action to the existing Contact submission path without
making the fixture publicly routable. A decision is needed on how that
path establishes test eligibility while retaining the active public
Contact checks. It can proceed alongside the separately scoped hosted
Responses operation and Customer/Operator view. This checkpoint is
partial and does not establish acceptance of a complete hosted cycle.

### Source-aware understanding readback

The next business acceptance is a protected browser journey where the owner
can resume without re-entering known facts, see why a question matters, save
a meaningful correction, and compare the resulting assessment, Presence
Direction and real non-public WordPress Pages. In the same account context,
an Operator should be able to follow a development inquiry to durable
acceptance and revision-linked measurement, with notification, qualification
and business outcomes represented independently.

The first implementation step reads the same scoped draft and source
projection used to generate questions. Review-led entry retains its
Review evidence, while direct start excludes it. The readback links each
finding to its exact generating turn and cited answer, without promoting
answers to canonical facts or granting approval. The existing connected
local delivery test consumes this readback and fingerprints its sources
and turns when preparing its proposal. Its provider and inquiry remain
fixtures. Both entry paths, resume and cross-customer refusal are covered
by the disposable PostgreSQL test.

This is a Core service integration, with no hosted browser surface,
durable Presence Direction proposal or fresh WordPress revision yet.
The confirmed C0 brief and retained source evidence remain available for
the next composition step. No new C0 data was transmitted and no provider
spend occurred. The previous synthetic API proof does not authorize
sending protected C0 answers. A fresh real-C0 reasoning call needs its
exact allowed input and spend scope confirmed. The existing intake writer
is development-only and the hosted native fixture is inactive. Connecting
Contact there requires a scoped non-public eligibility path that retains
public eligibility checks. Customer acceptance and release authority stay
separate.

### Protected C0 browser journey

The owner-facing acceptance is to open a protected local Core view,
resume the retained C0 answers, change the priority of an existing
visitor path and see the assessment, Home, Service and primary Action
change together. A reload must retain the correction and all earlier
answers. Site and approval readiness must remain visibly separate.

Run the existing onboarding launcher with `--retained-c0` and the
owner's verified local evidence file. It verifies the original evidence
checksum and source fingerprint, reuses the progressive intake store in
a disposable PostgreSQL cluster, and protects the evidence with a
loopback-only listener, a fresh console access code and the existing
draft cookie. At [local onboarding](http://127.0.0.1:4322/onboarding),
enter the access code shown in the same terminal, choose **Resume retained
onboarding**, then save a different prospect priority and compare both
pages. Edits survive browser reload while the launcher runs. The
protected original capture remains unchanged. The disposable copy is
removed when the launcher stops.

The retained case uses Direct Start. Earlier Free Review material remains
historical evidence, with its original approval and delivery status.
The question is an editorial decision grounded in a real saved visitor
preference. The resulting assessment and page copy are an editorial
projection, with no fresh model output or automated knowledge promotion.
The prospect paths keep the Review optional. No visitor destination is
activated and no notification, lead quality or visitor outcomes are
claimed. The local view is not a customer login or a real approval.

The browser readback exposes a fingerprint of the exact scoped draft
version and evidence. The same planning projection can add a proposed
Intro section to existing canonical-backed Page inputs. The disposable
Core test prepares, previews and separately approves both Pages,
authorizes the exact site as the next revision, and verifies the
envelope in PHP with the existing WordPress verifier. It preserves
logical Page IDs and the existing internal Action. The browser does
not invoke the approval or signing path. The exact proposal test
uses isolated fixture approvals and does not stage the retained C0
answers or private source text.

The local browser review was exercised in Edge through access,
resume, correction, Home/Service navigation, a narrow viewport and
reload. The HTTP regression also checks preserved answers and source
provenance, stale edits, an exact retry, scoped access and refusal to
submit the retained copy. Existing Contact and cycle measurement
checks still use isolated development data. The protected production
drafts remain outside this run.

**Next scoped decisions.** For fresh reasoning, approve one exact
public-source-only projection covering the published C0 service
transition, the optional Review and Direct Start, and the question of
what an existing-site prospect should bring. Permit the approved
snapshot `gpt-5.4-mini-2026-03-17` to receive that projection through
the OpenAI Responses input count and generation endpoints with
`store:false` on generation, a proposed maximum of $0.05, one
generation, one count and zero retries. Review the projection before
dispatch. Raw saved answers, account identifiers and routing details
are outside that proposal. The expected result is one original
question with a reason and source references.

Proposed outbound context, with source labels only:

- `c0-service-direction`: MioPages is moving from legacy offerings
  to one managed Web Presence service, beginning with Launch and
  continuing with Ongoing care.
- `c0-entry-paths`: Prospects can request an optional Free Review
  or start a conversation directly.
- `first-conversation`: For an established business with an existing
  website, what should the first conversation require up front, and
  what can the business supply later?

Ask for one original question, a concise reason, and citations to
those labels. Keep the question distinct from any customer confirmation,
site approval or routing decision.

After the owner reviews the local choice and proposed copy, the
separate hosted operation is to prepare and independently review the
exact Home and Service revision in the existing inactive hosted
fixture, sign and apply it on the existing protected WordPress
installation, reconcile its application receipt, and verify exact
rollback. Review the exact site digest and allow only those scoped
development writes. No AI or hosted operation is authorized by this
checkpoint itself.

### Protected HTTPS Core

[Owner P0 direction](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6858083745)
supersedes the localhost and one-call milestone. A browser session must
resume retained understanding, support meaningful generated questions and
answers, show an evidence-linked direction and editable site candidate,
and carry an independently approved revision to the protected WordPress
installation. The browser must distinguish real delivery and inquiry
evidence from missing outcomes.

Read-only verification on November 13 found the production Core at
`62439fc` with HTTP 200, rehearsal checkout `4c93def`, and Node 22.23.2
on both 20i accounts. The retained acceptance account's webroot was
empty and HTTPS returned the known idle 502. The protected WordPress
Service preview returned 401 to an anonymous request. No hosted changes
were made. The parallel live AI branch remains at `d9ef9aec`.

The protected Next route uses the retained local journey component and
the same progressive intake store. It rechecks scoped Operator grants
on each request, uses short-lived opaque Secure/HttpOnly/SameSite
sessions, and has same-origin mutation checks and a host-bound route.
The package must run a single loopback worker behind the existing 20i
proxy, which must set trusted Host and X-Forwarded-Proto. The production
runtime does not enable these routes. Scoped reads and updates require
the inactive development graph and a separately restricted database role.
The local proof path retains its existing guards.

The retained package launcher supports `--core --smoke` for bounded
loopback verification and `--core` for the supervised development
process. It loads `core-config.json`, `core-input.json` and, when
enabled, `ai-scope.json` off-webroot with existing custody and
resource checks. The existing private server rejects raw requests
outside the exact Core page, API and static build assets before Next
normalizes them. The earlier WordPress-only mode remains separate.
Windows Webpack production build and compiled loopback smoke passed.
The smoke checked the actual protected shell, anonymous 401/no-store
and raw 404 for disallowed or normalized targets. Linux artifact
packaging and actual provider routing remain open. The anonymous
compiled smoke uses no private configuration.

The interview stores versioned answers and reserves a generation before
dispatch. The real Responses transport pins the hostname and endpoints,
uses verified TLS and no retries, and retains the existing usage ledger's
charge reservations and exact response checks. The runtime projects only
approved source records and the answer whose text matches an approved
digest. The hosted route has no fixed four-turn rule. The ledger,
payload, expiry and storage bounds still apply. No new provider requests
were sent. An unresolved reservation needs reconciliation before retry.

This checkpoint is implementation progress. The hosted interview uses
the retained Direct Start capture. General hosted Review continuation,
AI-derived Presence Direction driving an editable substantial proposal,
private application of a new site revision and durable hosted
Contact/measurement are pending. The current site view remains the
earlier editorial planning projection. A provider recommendation does
not approve a claim or publication.

**Consolidated authorization packet for owner review.**

1. **Hosting.** Deploy the checksummed production build to the retained
   `wp-acceptance.miopages.com` 20i account only. Register one package-local
   Core development app at loopback port 8081, with no new hosting charge.
   Verify trusted HTTPS forwarding, protected sessions and resource
   headroom. Retain the account, DNS and SSL on rollback. Preserve the
   public Core process, production configuration and WordPress Pages.
2. **Database and custody.** Use verified-TLS Supabase Session Pooler
   and the existing inactive rehearsal tenant. Provision only a dedicated
   protected development role with scoped draft read/insert/update and
   read-only verification of the graph and existing credentials/grants.
   Restrict writes to the single development scope through database
   policy and verify foreign access refusal. Enroll the Operator credential
   with only scoped inspect and prepare permissions. Confirm recovery
   coverage first. Import the checksum-verified C0 prepared evidence,
   ten saved answers and their original provenance to the acceptance
   account, in an off-webroot mode-0600 input. Persist the owned intake
   draft in Supabase. The original evidence and public C0 graph remain
   intact. Configure the approved key through the owner's protected method.
   No hosted role SQL has run. Review the table policies and existing
   role behavior before applying any scoped permissions. This approval
   does not authorize enabling a default-deny policy that changes
   existing runtime role behavior.
3. **AI.** Approve the three exact statements under the earlier
   protected browser journey as internal approved development inputs.
   They do not require a claim that they are publicly published.
   Authorize their transmission to OpenAI `api.openai.com` through
   Responses input counting and generation. Pin
   `gpt-5.4-mini-2026-03-17`, use `store:false` for generation and
   no automatic retries. Proposed session scope is up to 20 requests
   and $0.50 estimated usage exposure with a 24-hour expiry. Later
   turns may include only the latest generated question, the question
   history used for duplicate checks, and a separately allowlisted
   answer. The raw retained capture, private Review, customer IDs
   and contact/routing details stay outside the model payload. Confirm
   current project access, pricing, budget and data controls before
   enabling dispatch. Expected result is a source-labeled question,
   then a changed assessment and relevant follow-up based on an approved
   answer. [OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
4. **WordPress and operating evidence.** After exact candidate review,
   authorize preparation and application of the selected non-public
   draft revision using the existing installation, with receipt
   reconciliation and signed rollback. Keep reviewer and authorizer
   separate. Allow one labeled development inquiry and revision-linked
   event only once protected Contact eligibility is defined and tested.
   Customer confirmation and public release remain separate.

#### Approved hosted rollout checkpoint

The owner approved the consolidated development scope at `eb14d80`,
with Linux and database-policy verification before deployment. No
separate WordPress revision application or publication was authorized.
The PostgreSQL role uses check-option views for the inactive fixture,
with column-scoped writes and no change to existing table RLS. The
existing intake trigger reads a role-specific view of the same fixture.
The local policy regression exercised create, exact retry, draft
updates and refusal of foreign or canonical changes. The earlier Linux
run inherited a build flag in the ordinary-mode test. The corrected
[Linux build](https://github.com/R-Levin/myomaton-web/actions/runs/43464170667)
passed production build, the relocated protected shell and anonymous
route smoke, and artifact packaging at `63cf410`.

The artifact's outer ZIP, inner tar, manifest and 161 files verified
independently. Its staged copy passed the same hash check off-webroot in
the acceptance account. Installed Node 22.23.2, Next 16.4.5 and sharp
0.35.5 loaded with libvips 8.18.7. A bounded, secret-free hosted loopback
smoke returned 200 for the shell, 401 for the anonymous API, and 404 for
the slash variant and unrelated Contact route. Port 8081 was free after
the test. The ten verified answers and their provenance are staged with
mode 0600 off-webroot. The original capture remains intact. PostgreSQL
has not received the draft.

The first hosted database action requires the original Supabase project
`postgres` administrator password and the existing `miopages_migration`
password. Read-only checks found that the provider administrator lacks
CREATE in the adapter schema, while the migration role has that
authority and owns the credential/grant writes. The corrected launcher
authenticates both before creating the new role with NOLOGIN, then
installs the scoped views and grants before enabling LOGIN. If it
reports a partial commit, independently inspect the role and custody
before continuing. The approved connection uses the same Session Pooler
and verified TLS. Run in the established runtime account Cloud Bash
shell, from any directory:

```bash
bash ~/miopages-wp-rehearsal/scripts/db/provision-protected-core.sh PROVISION-PROTECTED-CORE
```

Return only the sanitized PASS or BLOCKED JSON. Both prompts are hidden.
The hosted process and OpenAI key belong to the separate acceptance
account. The existing public Core and WordPress drafts are outside this
rollout. The disposable interview test persists a question, answer and
answer-dependent follow-up through the restricted writer, with a
substitute provider. No authenticated hosted run or live model response
has been verified.

#### Restricted role enrolled and deployment files staged

The owner ran the two-prompt launcher and reported PASS for
`miopages_core_development`, principal
`f2cd3fe8-58b3-4dfa-9125-fd8f1bd35f8e`. A fresh SSH process
independently verified the role's TLS and PostgreSQL session
integrity and exactly one eligible inactive scope. The protected
runtime credential remains in Cloud custody.

The acceptance account's package-local PM2 list was empty. The
exact Linux `63cf410` build and locked dependencies were copied
to that account's webroot and the artifact manifest rehashed.
Discovery metadata is absent and port 8081 was free. The ten
retained answers remain staged off-webroot with mode 0600 under
a mode 0700 directory. The database draft has not been imported.
The two public Core HTTPS routes still returned 200, the protected
WordPress preview returned 401, and the acceptance Core URL
returned the idle 502.

Automatic approval review declined the SSH relay of the generated
scoped database connection and existing OpenAI development key
into the protected acceptance configuration. The operation did
not run. The owner was asked to explicitly authorize that exact
source, destination and custody. After that decision, verify both
scoped grants, configure the worker, validate authenticated HTTPS
and persist the approved source-bound AI workflow. The second
provider turn still requires an explicitly allowlisted answer.

#### Hosted HTTPS activation

The owner explicitly authorized the two-secret encrypted relay. The
off-webroot config passed ownership and mode checks. The existing
acceptance package registered only `miopages-protected-core` on its
package-local PM2. Its listener binds loopback 8081. HTTPS Core and
both public Core hostnames returned 200. Anonymous WordPress preview
remained 401. A scoped HTTPS sign-in issued the Secure, HttpOnly,
SameSite session and read back ten retained answers from PostgreSQL.

The first live count and generation completed on the pinned model.
Usage was 408 input and 196 output tokens, estimated $0.001188.
Core rejected the output at semantic validation and retained a
recoverable draft with no pending operation. The provider ledger
settled the request. The response text was not retained, so the
exact failing field is unknown. The next build makes the initial
question and null assessment explicit in the response schema and
records only a bounded rejection category. Any next request is a
deliberate development operation within the remaining budget.

The verified Linux build at `8f9b047` replaced the earlier build
inside the same acceptance package. The previous build is retained
off-webroot. A deliberate second count and generation saved the
first real question at draft version 6 with all three approved source
references and no pending operation. It asks which existing-site
information MioPages needs in the first conversation and what can
wait. The two completed generations and two counts totaled 820 input
and 297 output tokens, with $0.001952 estimated usage. The first
validation refusal remains part of that total.

Open [Protected Core](https://wp-acceptance.miopages.com/core) and
use the temporary scoped Operator credential held in the approved
Cloud custody file. Secure HTTPS API sign-in, retained draft readback
and generation persistence were independently verified. The hosted
account's listener remains on loopback 8081 and both public Core
hostnames remained 200. WordPress draft access remained protected.
The next live turn requires the owner's exact answer transmission
allowlist. The hosted proposal remains editorial pending that
evidence-driven connection. No new WordPress revision was applied.

#### External Core access

Issue #12 records the owner's external 404. Direct HTTPS and the
loopback listener both returned 200 for literal `/core` and 404 for
`/core/` before the fix, with no redirect from the literal URL.
The slash variant was refused by the raw-path gate before Next.js.
The exact request that failed in the owner's browser is unavailable.
The scoped correction `57f0a20` redirects only GET `/core/` to
`/core` with 307/no-store. Query variants, API aliases and unrelated
routes remain refused. Only the acceptance app restarted. The
installed launcher SHA-256 is
`dc9a08edaad4dde0210b8c440eef7cb58a659b5df35ee3608378d0eeb8fe6b89`.
The Next build remains `8f9b047`. The prior launcher is retained
off-webroot. External Edge verified canonical navigation, loaded
assets, scoped sign-in, retained understanding, saved AI question,
reload and sign-out through the actual HTTPS origin.

Use [the current development Core](https://wp-acceptance.miopages.com/core)
with the existing scoped Operator credential in Cloud custody. The
development credential has a bounded expiry and remains separate
from the API key and database role.

Recommend `app.miopages.com` for the unified portal. It currently
resolves to 185.146.167.193 and its root redirects to miopages.com.
The acceptance host resolves to 185.146.167.100. Both `app` and
`core` currently return 404 for `/core` with valid TLS. The origin
change needs explicit authorization to replace the current app
redirect with an exact hostname binding to the existing development
package, adjust only its DNS/SSL if required, and move the configured
Core origin and its host-only session. Capture the existing DNS and
redirect for rollback before change. Verify the actual provider
binding and preserve the apex, existing Core hosts and WordPress.

The local branch also links a cited, same-gap saved answer to the
AI recommendation and its unresolved evidence in the site review.
The existing editorial proposal compiler can bind that finding to
proposal provenance. This change is not yet deployed and does not
generate editable site copy. The exact outbound test answer is
still awaiting owner authorization. Hosted Contact, measurement,
new private WordPress application and Ongoing remain open.


#### Business answer to editable site direction

The immediate acceptance gate is one actual scoped business answer, a
cited change in understanding with remaining uncertainty, and a consequential
change in positioning, page structure, copy or a visitor action that an
Operator can review and edit after reload. Any WordPress application has its
own exact scope and approval.

Core now requests business-specific gaps about the offer, customer decision,
trust and service boundaries. A follow-up can return a variable page set with
positioning, audience, offering, page purpose, proposed sections, search
descriptions and visitor action labels. Core requires the matching saved
answer and citation before showing the resulting direction. A version- and
finding-bound edit preserves the original generated plan and saved answer.
The existing editorial proposal composer can carry the proposed title,
purpose and all matching sections into a canonical-backed Page proposal using
explicit Section identities. New routes, Action destinations, SEO application
and media require resolution through their existing Core contracts. Customer
acceptance, exact native draft authorization and public approval remain separate.

The protected AI grant can carry a session batch of exact answer digests or
separately curated projections, scoped to the same owner, sources, model,
expiry and usage ledger. Core rereads the protected grant for each projection
and rechecks it before generation. Revoked, changed or expired authorization
blocks the outbound projection. A change between token count and generation
settles the count and refuses generation. The original approved grant remains
compatible. This is an operator-managed mechanism; customer self-service
consent and confirmation remain open.

One development answer remains pending explicit authorization. The answer
would be saved as unconfirmed and sent only in its exact approved form for
one count and one generation under the current grant. The retained capture
stays outside the provider input. The owner can review the exact proposed text
in the active handoff. No additional provider usage has occurred.

Contact can now report durable inquiry acceptance and separate notification
counts for a previously authorized Web Presence and Managed Site in a bounded
time interval, without projecting messages or routing. Disposable PostgreSQL
verified exact retry, one counted acceptance and scope exclusion. Qualified
leads and customer outcomes remain unknown. The current protected Core
database role cannot read or write Contact records. The active-site Contact
gate remains intact; a fixture-scoped protected acceptance and measurement
path still needs to be connected. Prior hosted WordPress receipt and rollback
evidence remains valid for the earlier revision. A new candidate has not
been issued or applied.

Recommend `core-dev.miopages.com` for development and reserve
`app.miopages.com` for the eventual unified portal. Public DNS returned
185.146.167.193 for both candidates and a wildcard control; `/core` was 404
on the candidates while the existing acceptance host returned 200 at its
separate 185.146.167.100 target. This is consistent with wildcard resolution;
the exact zone entries and Node alias behavior require provider-console
verification. The pending narrow operation is an exact package alias, DNS
record, TLS and protected origin for `core-dev` only, with a preserved
rollback. The existing app redirect remains in place.


Linux Webpack [run 43486073425](https://github.com/R-Levin/myomaton-web/actions/runs/43486073425)
passed the production dependency audit, retained rendering, eight private
routing checks and isolated runtime smoke. Artifact 14066253966 binds source
`ae51dbca6178dd0b2cba71461037f0b075181c55`. Independently verified ZIP and
tar checksums and 163 files. Tar SHA-256
`f2018f723eacc627afd40dc4d3ed9de293750bf54d64f6608998c7ef2d7c7463`.
The existing lockfile, dependencies, launcher, static public files and
protected configuration were preserved. TypeScript, changed-file lint,
394 unit tests plus the new consent-change regression, disposable
PostgreSQL Contact and interview tests, both WordPress integration tests
and the Windows PHP offline gate passed. One prior C0 fixture test skipped
without its optional private capture. POSIX file-mode verification belongs
to the existing Linux checks.

The first hosted swap passed HTTPS but the deployment guard expected PM2's
restart counter to increase after a commanded stop/start. It stayed at 1
and rollback restored the previous build. PM2's log confirmed only the
commanded transitions. One corrected retry verified the same app, cwd and
launcher, a new process, unchanged restart counter, zero unstable
restarts and exactly one commanded stop/start. The prior build is retained
off-webroot under `update-ae51dbc/retry-rollback`.

The updated [protected HTTPS Core](https://wp-acceptance.miopages.com/core)
is live. External Microsoft Edge verified canonical routing, assets,
Operator sign-in, retained interview readback, reload and sign-out.
A separate HTTPS readback verified eight assets, the Secure/HttpOnly/
SameSite session, unchanged draft version 6 with ten retained answers and
one saved AI question, and 401 after sign-out. Both public HTML digests
matched their pre-update values. Anonymous WordPress draft access remained
401. The AI ledger still has two counts, two generations and $0.001952
estimated total, with no pending attempt or answer allowlist entry. At
verification the existing AI grant expires November 14 at 17:30 UTC.
No new real follow-up or generated site plan exists yet. The next action
is to allowlist and save the exact approved development answer and run one
follow-up within that grant. Verify the actual result and review the edited
proposal before requesting exact private WordPress application authority.


#### Approved neutral development hostname

The owner approved the exact `core-dev.miopages.com` secondary hostname,
DNS, TLS and protected Core origin on the existing 20i development package.
Keep the primary package hostname and preserve the existing `app.miopages.com`
redirect. The legacy Core origin remains available during cutover. No
provider spend, new package or broader origin wildcard is authorized.

My20i's documented path is Manage Hosting, the existing
`wp-acceptance.miopages.com` package, then Domains for a secondary mapping to
the existing `public_html`. Inspect the exact DNS record in the
`miopages.com` zone before any update. Use the package target
`185.146.167.100` only after verifying the alias, free TLS and Node forwarding.
If certificate issuance requires the record first, coordinate the one exact
DNS change without changing the working Core origin. Preserve the exact
pre-change DNS and mapping so a failed verification can be reversed. My20i
browser automation could not start in this workspace. The existing verified
SSH account cannot edit provider package DNS or TLS.

The reviewed Core build supports the two exact origins only when the new
origin is enabled by its account-owned mode-0600 off-webroot selector.
Origin is checked on each API request and the host-only sessions are bound
server-side to their issuing origin. The same aggregate sign-in limit applies
to both names. Existing WordPress delivery origin is separate. Verify the
alias against the actual Node vhost before selecting it. After cutover,
confirm valid HTTPS, canonical redirects, authenticated readback and sign-out
on both Core hostnames. Confirm the public runtime, WordPress and app redirect.
Roll back the selector, or restore the previous package artifact if needed,
before reverting only the new mapping and exact record.

At the checkpoint, the provider mapping, DNS and TLS remain unverified.
Public DNS still returned 185.146.167.193 for the requested name, whose
`/core` returned 404. The existing development URL returned 200 and the
future portal's root returned 301 to `https://miopages.com/`. This hostname
decision does not authorize dispatch of the pending AI answer.


Focused local verification passed 13 tests, TypeScript and changed-file lint.
[Linux run 43504040742](https://github.com/R-Levin/myomaton-web/actions/runs/43504040742)
passed with nine default-origin checks and twelve neutral-origin checks.
The latter retain the legacy shell, refuse cross-origin POST and exclude the
unrelated app hostname. Source `9c02afc9266793e0a42d89619a7c6d8539fbe623`,
artifact 14074763360, tar SHA-256
`9da65b0c1fa74e00666e921d4dcabe985c70a3010330b91091e048c24ac970ca`.
The archive and all 164 files were independently verified and staged
off-webroot in `update-9c02afc` inside the development package's private
directory. The live app and origin selector were untouched.

Direct HTTPS to the existing package IP with the proposed name validated
TLS but produced 404 for `/core`, 503 for `/core/` and 503 for the protected
API. The current hostname on that same IP returned 200, 307 and 401
respectively. The proposed name has yet to prove Node forwarding. The
next operation is the authorized secondary mapping in My20i, followed by
a forced-address HTTPS check and the exact DNS and TLS verification before
installing the staged candidate. My20i control-plane interaction must come
from an authenticated operator session while browser startup is unavailable.


#### Integrated Core operating cycle

The owner superseded the `core-dev` execution approval. The existing
development URL, package and port remain the only runtime target. The
earlier alias artifact is historical. This increment removes its runtime
selector. No provider-control-plane changes were made.

The owner approved one exact C0 development answer, one token count and one
follow-up. Hosted Core saved the answer as unconfirmed and retained all ten
prior answers. The Responses call completed on the pinned model. Core
refused the proposed turn under semantic validation, cleared the pending
operation and retained draft version 9 without an assessment or site plan.
The raw response was not retained. The existing logger did not yield a
validation subtype, so the specific field is unknown. The latest request used
835 input and 109 output tokens for an estimated $0.001117. The ledger now has
six requests and $0.003069 total estimated usage. The exact answer allowlist
entry was removed after settlement. No automatic retry occurred. A second
live follow-up needs explicit, scoped authorization.

Core now persists a safe validation category, makes the required answer
reference explicit, and preserves a corrected answer alongside its historical
version. A finding based on a superseded answer is excluded from site review
until reassessed. Reported validation failures never include model text.
Positioning, offering, audience, page purpose, copy, search descriptions and
action labels are editable. The exact saved review input can be captured from
Core for the existing protected WordPress Operator tool. It validates every
Page and Action destination and composes Page inputs while preserving a
canonical factual source. The resulting Page proposals still pass existing
preview, approval and independent staging authorization. SEO and media
remain outside the current native draft envelope. The stable Home 13 and
Service 14 restore receipt was reverified with its existing HMAC. The
previous rehearsal principals have expired. New exact approval and usable
independent credentials are required before authorizing or applying a new
WordPress revision. No new WordPress Page was applied.

The scoped inquiry policy reuses canonical Contact storage and accepts only
one labeled, fixed synthetic inquiry for the inactive development scope
and restored revision 3. It grants a checked view to the existing development
role, accepts no visitor details, and disables notifications. Contact durable
acceptance supplies the first-party test count directly. Its recommendation is
tied to the exact receipt scope and accepted submission. An Operator may add
the suggested improvement to an editable draft and carry the inquiry reference
into the review input. It does not measure
traffic, conversion or business outcomes. Disposable PostgreSQL verified
retry, scope refusal and denied direct canonical reads. Installing the SQL
requires the existing migration authority to add one fixture Contact
definition, one restricted view and column grants to the existing role.
The protected app also requires a mode-0600 scoped enablement file. Reverify
the restored WordPress revision and current recovery coverage before enabling
the one test write. The public Contact route remains gated.


The owner subsequently authorized one corrected follow-up with the same
exact outbound text and existing grant, plus installation of the scoped
Contact policy and one synthetic inquiry. The policy can be installed only
from the rehearsal checkout using the established hidden migration-password
procedure and retained recovery evidence. A retired hostname approval is
not part of these operations.


Linux run 43510372579 failed on Windows-encoded client source before
packaging. Commit `509b34e` restored UTF-8, and
[Linux run 43510753823](https://github.com/R-Levin/myomaton-web/actions/runs/43510753823)
passed. The archive and all 163 files matched, and only the existing
development app was swapped. The previous build and launcher are retained
under `update-509b34e/rollback`. The protected HTTPS shell and slash redirect
passed and both production HTML hashes matched their baseline. WordPress
Delivery 0.0.9 and theme 0.1.0 remained installed, and WP-CLI confirmed
draft Pages 13 and 14 with their existing slugs. TypeScript, lint, 396
unit tests, disposable database and WordPress/PHP tests passed.

The one corrected follow-up completed on the provider and Core reported
`invalid_output/citations`. No follow-up, assessment or plan was saved.
Draft version 11 retains the approved answer and all ten prior answers,
without a pending request. The second generation consumed 897 input and
149 output tokens at $0.001344 estimated. Total hosted development usage
is now eight requests and $0.004413 estimated. The exact answer permission
was removed immediately after reconciliation. Core has since been changed
to constrain provider-selected business source IDs in the response schema
and attach the exact dispatched answer reference itself. This preserves
destination, evidence, privacy and usage checks. A focused offline test
covers valid attribution and refusal of invented IDs. Further provider
dispatch requires a new exact authorization.

The approved Contact policy is staged in the existing Cloud rehearsal
checkout as `scripts/core-inquiry-migration.sh`. Its parameter is
`APPLY-PROTECTED-CORE-INQUIRY`. It uses the hidden existing migration
password prompt, checks the retained recovery evidence and executes the
restricted view and definition transaction without creating the inquiry.
Only after a verified policy result should Core enable and record the one
authorized synthetic inquiry. No hosted Contact policy success is recorded
at this checkpoint.


The citation-constrained build `9d7430b` passed
[Linux run 43511827820](https://github.com/R-Levin/myomaton-web/actions/runs/43511827820).
Artifact 14078149111 and all 163 packaged files were independently rehashed.
Tar SHA-256 `04515fb72de1c9abea2ce3b9aa9a1b7fd974c194428d6c343c6f21c54ad40d85`.
Only the existing protected Core app was restarted. Its prior build remains
off-webroot under `update-9d7430b/rollback`. External Microsoft Edge verified
the canonical route, scoped sign-in, retained answer and citation diagnosis,
correction control, Ongoing section, reload and sign-out. The HTTPS API
refused a WordPress review package without a current, reviewed plan.
Both public Core roots continued serving and the WordPress preview remained
protected. No additional model call was made after the citation correction.


#### Hosted synthetic inquiry and Ongoing readback

The owner ran the approved Contact installer and returned PASS. A new
session authenticated as the restricted development role over verified
TLS and proved session integrity, one eligible inactive fixture, view-only
read and insert, no update/delete, no direct canonical Contact privileges,
and zero prior inquiries. The existing native draft journal authenticated
the restored revision 3 receipt, and independent WordPress readback
matched its Home 13 and Service 14 content hashes, statuses and slugs.

An account-owned mode-0600 inquiry scope was enabled off-webroot for the
exact restored revision and expires November 14, 2026 at 4:49 p.m. ET.
Only the existing protected development app restarted. The build remained
`9d7430b`. External Edge signed in as the existing scoped Operator, used
**Record one test inquiry**, and observed the count change from zero to
one. Reload and exact HTTPS retry returned the same evidence and count.
The recommendation asks for a clearer description of what an existing
website owner should bring to the first conversation. A separate read-only
database session confirmed exactly one durable accepted submission,
`fe475728-c2ce-4dbe-bcc5-ec3bfba39f8c`, bound by its idempotency key to
the restored revision. Its acceptance timestamp was November 13,
2026 at 4:50 p.m. ET. The Contact row has a 24-hour expiry and delivery
status disabled. Operator sign-out refused further anonymous readback.

This proves the protected Core action, durable synthetic Contact
acceptance, revision-linked first-party count and evidence-based
recommendation. Visitor traffic, live lead conversion and business
outcomes remain unmeasured. Attaching the recommendation to a current
editable site plan is available in code and still awaits such a plan.
No new WordPress revision was applied. Public Core response digests
matched baseline, and anonymous WordPress preview remained 401.
The saved interview stayed at version 11 with ten retained answers
and the approved unconfirmed answer. The AI ledger remained at eight
requests and $0.004413 estimated with an empty answer allowlist.
The next action is one separately authorized count and generation
through the deployed citation correction, followed by review of any
resulting plan and exact WordPress scope.


#### Live cited follow-up and site preparation

The owner authorized one more exact count and generation. Core verified the
deployed citation correction, existing grant, source boundary and empty
allowlist, then sent the one approved answer. The genuine follow-up asks what
website problems make Launch necessary before Ongoing care. The assessment
recommends learning those triggers and explicitly leaves them unresolved.
Core retained draft version 13, the cited answer and all prior answers, with
no pending operation. The model returned no Presence Direction copy. The
turn used 883 input and 123 output tokens, $0.001216 estimated. Total usage
became ten requests and $0.005629 estimated. The one-use permission was
removed immediately after reconciliation.

A cited, current finding can now support Operator-authored Presence Direction
when the model provides no plan. The editor starts with existing editorial
copy. The saved provenance and exact review packet distinguish Operator
authorship from model-proposed copy. No provider permission is required
for editorial drafting. The protected AI grant also supports one curated
session of turn-bound approved excerpts with an independent end time
inside the existing tenant, model, expiry and metered request limits.
Corrections invalidate a matching turn binding. The ordinary file-based
grant is reread before generation. The hosted grant was left empty;
the new session format creates no implicit authority for more transmissions.

Native WordPress revision 5 on this installation must follow the signed
high-water revision 4; the restored content actually on WordPress is
revision 3. The installed writer deliberately stores no rollback target
for a forward apply after restore. The normal signed restore would target
revision 4, not the current baseline. Before approving an apply, a tested
exact rollback contract must distinguish the signed predecessor from the
currently materialized baseline and reconcile restoration to the latter.
Never issue or apply a new revision on the assumption that revision 3
can be restored by the existing envelope. Page approvals, independent
staging authority, and fresh scoped WordPress principals remain required.


The existing Core deployment now runs `e649108`.
[Linux build 43516047618](https://github.com/R-Levin/myomaton-web/actions/runs/43516047618)
passed the isolated smoke. Artifact 14080682450, all 163 packaged files
and tar SHA-256 `060dd398df27781f40185e506df39045e1b2aad2b4b772f4179001e6a4ea743f`
were verified before swapping only the existing protected app. Its prior
build remains in protected rollback custody. TypeScript, lint and nine
focused tests, including disposable PostgreSQL, passed.

External Edge used the hosted editor to save Operator-authored copy at
version 14 and apply the existing synthetic inquiry recommendation to the
Service draft at version 15. Home now asks for the website address and
the visitor's most important action. Service explains what the team
discusses after looking at the site and separates the first conversation
from Ongoing eligibility. The findings on what specifically triggers Launch
remain open. The saved model turn and original answers were unchanged.
On reload, Core returned the same editable plan with its finding and
answer reference, the synthetic inquiry ID
`fe475728-c2ce-4dbe-bcc5-ec3bfba39f8c`, and the restored revision 3 digest.
The report showed one synthetic inquiry and no measured visitor outcomes.
Remeasurement is a later comparison against a reviewed, applied revision.
The hosted grant was left empty after the live request. Existing public
Core output digests matched and the WordPress preview still required
authentication.

The protected WordPress review input emitted by Core has digest
`99f4dbb6e943ae577a15d30f69532c0a9a21511e94e2589205d354111a9b4e7c`.
Local compilation preserved the Home and Service logical Page IDs and
the canonical-backed Sections, added the reviewed editorial Sections,
and resolved the Home Action to Service and Service Action to Home.
The resulting private preparation scope digest is
`270e57f123d268551888d838b00564c7f9e0336a8fa25bd1964d97946bb38148`.
The intended WordPress targets remain Home 13 and Service 14. Hosted
read-only Core evidence shows Home proposal revision 1 and Service proposal
revision 4, so their proposed next revisions are 2 and 5 respectively.
The site-level candidate would be revision 5 with signed predecessor
revision 4 and an independently verified materialized revision 3 baseline.
The prep digest is neither a persisted Page approval nor a signed site
digest. The two exact governed Page previews and signed apply/restore
receipts have not been produced.

A read-only renderer attempt on the existing Cloud WordPress operator
checkout was rejected by automatic approval review because it included a
transfer of the C0-derived v15 scope to that separate account. Nothing was
transferred. The exact review input and locally compiled scope remain in
Git-ignored local runtime evidence. Obtain permission for the exact scoped
review input transfer before a renderer on that account consumes it, or
use the existing protected Core editor while the rollback contract is
corrected. Keep the signed high-water predecessor and rollback target
independent, verify both against the authorization chain and restored
receipt, and test that a forward revision after a restore can be rolled
back to the current content with stable Page IDs. Only then prepare the
durable Page revisions under fresh scoped credentials and request exact
application approval. No WordPress change, publication or new provider
call took place during site preparation.


#### Private revision 5 review and recovery

Read-only WP-CLI independently confirmed installed Delivery 0.0.9, signed
high-water revision 4 and displayed revision 3. It verified the exact
native pointer and the draft status, titles, slugs and content bytes of
Home 13 and Service 14. Core verified the signed revision 3 envelope,
revision 3 apply receipt, and the matching authenticated restore receipt
for revision 4. The working app and WordPress installation were left
untouched.

The new draft-only v2 envelope binds a separate materialized rollback
revision and digest. Core checks the sequential authorization chain and
authenticates both the baseline apply receipt and predecessor restore
receipt before authorizing or issuing v2. WordPress checks the restored
pointer, stable Page identities and locked current content before apply.
It keeps the baseline snapshot and high-water counter separately. Receipt
reconciliation checks the actual rollback revision and the forward
revision independently. Previously issued v1 envelopes and receipt
formats remain readable. A v1 forward apply after a stable restore is
refused. The earlier one-time legacy Page adoption behavior is retained.
No database migration is needed. Delivery 0.0.10 is the uninstalled
candidate for v2.

The PHP regression exercised the equivalent revision 4 high-water and
revision 3 materialization on simulated WordPress state, applied revision
5, restored exact revision 3 content and stable IDs and slugs, retained
high-water 5, and successfully moved forward to revision 6. It also
verified exact retries, stale applies, false baselines and drift refusal.
Disposable PostgreSQL verified independent grants, both required baseline
receipts, v2 authorization and issuance, PHP signature compatibility,
receipt reconciliation and stale authorization refusal. These are local
tests. Hosted revision 5 has not been applied.

**Review scope fingerprint**
`1333ddc4e88cb0cdaef0ab379c16f3ac71e0c36dcb18160b2192350d5b70a4da`.
It binds existing Core review input v15, the v2 rollback target, both
logical Page IDs, exact draft content hashes and internal Actions. The
latest canonical snapshot differs from the old proposal bases only in
`contact_definitions`, where the scoped inquiry definition was added.
New governed Page revisions must be prepared against current base
`8c342e25aa3c962b98a9292bfd871873aca87364b0a6d44b3be6847c09a11ebd`.
The owned canonical source revision still resolves to the exact previously
signed text. Existing preview approval checks are unchanged.

| WordPress draft | Proposed Core Page revision | Proposed native content SHA-256 |
| --- | --- | --- |
| Home 13, slug `home-miopages-13` | Home 2 | `9a2a218c24ab25bd5f31c6122617f28786ea705a6db9d91d81f8d1bde2d2816b` |
| Service 14, slug `service-miopages-14` | Service 5 | `eb3c0a43811f6c6f882317ede97c8e8e0cdbfc8b6d4c513fef12a6b91ab75b5f` |

The site revision is 5 for installation
`d84ebc69-46d5-4c64-adc6-ac7b87468f89` and site proposal
`1e28f792-624d-4141-96db-45c4ba05e17d`. Signed predecessor revision 4 is
`1a6343c049c0430e51ef7fa3780123c9475352af0328301d661a38a9b500eb2a`.
Materialized rollback revision 3 is
`85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db`.
The Home Action opens Service and the Service Action opens Home. The
Service improvement retains synthetic inquiry
`fe475728-c2ce-4dbe-bcc5-ec3bfba39f8c` and its revision 3 link. The
Launch eligibility question stays unresolved. SEO descriptions stay
in the Core review; the v2 native envelope still delivers only supported
draft content and internal Actions.

Local previews and before/after diffs are Git-ignored in
`runtime-content/c0-wordpress-private-preview-v15-verified/index.html`.
They use the existing Core proposal renderer and the WordPress native
content projector. The local WordPress compatibility functions reproduced
both actual baseline content hashes byte for byte. Edge verified both
local pages, the Service diff and both internal Actions without external
requests. The Core HTML is a read-only preparation artifact, without
durable preview events. Exact governed preview digests and the signed
site digest follow current scoped author/reviewer access and the real
current-base proposal revisions. No protected review input was moved to
another hosted account. Only previously retained native evidence and
canonical source readback came into the existing local review workspace.

The remaining delivery gate is one owner decision covering transfer of
the exact protected v15 review input and prepared Page/Action mapping to
the existing Cloud WordPress operator checkout under private custody,
and fresh independently scoped principals for preparation, preview and
review. Keep actual Page approval and authorization of the final native
apply and restore tied to the resulting digests. No plugin installation,
new WordPress apply, or publication is included in this checkpoint.

For AI site generation, retain the unresolved Launch qualification
question as interview work. With a new bounded AI session, generate site
structure and supported sections from independently sourced facts,
reviewable provisional answers and explicit unknowns. Ask for a
variable page set and business-specific action strategy, then validate
page and section candidates independently through the existing editable
Presence Direction and proposal mechanisms. A single interview turn
may legitimately return no plan. Decouple the generation operation
from answering the last question and bind its full evidence input and
output for review. Keep the current two-page native target as an
installation identity constraint rather than a product-level site design.
