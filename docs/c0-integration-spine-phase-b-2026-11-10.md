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

#### Approved v15 preparation

The owner approved preparation scope
`1333ddc4e88cb0cdaef0ab379c16f3ac71e0c36dcb18160b2192350d5b70a4da`.
The approved input and Page/Action mapping alone were transferred over SSH
to the existing Cloud WordPress Operator account. The receiver verified
13,757 bytes at SHA-256
`d1766a4be45f5103ffe47ff630099b48754af2c12faa42e77e9b372a5b7cc9e6`
and account ownership with directory mode 0700 and file mode 0600. The
private copy is `~/miopages-wp-review-1333ddc4/input.json`. Keep the
packet, private review HTML and credential custody out of Git.

Read-only evidence matched both historical signed envelopes and both
authenticated receipts. The restricted PostgreSQL role independently
matched the canonical base, active installation and signed high-water
revision 4 with revision 3 as its predecessor. WordPress still runs
Delivery 0.0.9 at high-water 4 and materialized revision 3. Home 13 and
Service 14 remain drafts with their original slugs and exact baseline
content hashes. The first no-password check caught a receipt comparison
using the wrong field name. The corrected check passed without writes.

The checksummed Cloud launcher
`bash ~/miopages-wp-rehearsal/scripts/wordpress-prepare-v15-review.sh`
requires the existing `miopages_migration` password at a hidden prompt.
It checks scope, current base, installation and signed recovery evidence
before creating two short-lived scoped principals. The author can revise
and preview the exact Page proposals. The reviewer can independently
inspect them. Neither can approve, authorize a draft, issue or publish.
Wait for the sanitized result before treating the Page revisions and
preview events as durable. The existing local review entry is
`runtime-content/c0-wordpress-private-preview-v15-verified/index.html`,
with both projected Pages, before/after comparisons and source notes.

The proposed application updates only existing Home 13 and Service 14
on the target installation, with the exact content hashes and Actions
above. It would reconcile the native application receipts, restore
displayed revision 3 using the signed materialized baseline, and
reconcile the restore receipt with high-water 5 retained. Durable exact
Page preview approvals, site-level authorization, a compatible WordPress
installation and separately approved application are pending. No revision
5 envelope was issued or applied. The protected transfer did not
authorize a plugin change or public launch.

Local work advanced an evidence-bound site planning operation separate
from the interview. It reuses the editable Presence Direction model. It
projects exact approved unconfirmed answers, excludes superseded answers
and private source pointers, and validates citations at the direction,
Page and Section levels. Internal visitor links must resolve within the
proposed page set. Unresolved claims remain review material. Offline
samples exercised different architectures for managed Web Presence and
tree service. Next, connect it to the existing metered provider and Core
proposal review under new authorization for provider dispatch. This
checkpoint made no provider calls.

Verification passed 400 app tests, TypeScript, focused lint, the
consolidated PHP gate, both disposable PostgreSQL WordPress integration
tests and both Node/PHP receipt tests. A subsequent focused rerun passed
after the planning projection dropped raw interview question text. The
PHP Windows run does not verify POSIX mode behavior. Cloud preflight
independently verified private file permissions and the restricted TLS
session.

#### Durable v15 previews and application decision

The hidden-prompt preparation completed. A fresh Cloud SSH verification
authenticated both principals and replayed each durable revision through
the independent reviewer. The two mode-0600 HTML files matched a new
render byte for byte and their exact recorded preview digests. Both
proposals remain current, proposed and unapproved. The author had only
revision and preview grants, and the reviewer had only the inspection
grant. Both expire at 2026-11-14 05:27:21 UTC. Historic approval evidence
remains intact. The signed native high-water revision is still 4.

| Page | Core proposal and revision | Exact preview digest | Durable preview event |
| --- | --- | --- | --- |
| Home 13 | `e631a860-41a0-455e-9038-b3be357a2782` r2 | `e340530a1ee2575f5134416eaa9c81db1bfc24ee4bcfccabf08fcbfc6cad4210` | `d6c4a5d21efc0224c0c707d3f6491c079d8f8d48dbbd990d83ece61df8d3ff17` |
| Service 14 | `bc30b7c0-386f-4cf0-b444-f6506f9ce832` r5 | `4ae9f56011651a49e31ea0fffe066a4c33d5eae3e7c25bff4ef3f8657f186e13` | `6c84c776c187b82ae4c619cd738a148d3c344a1cd94279ad101dc1d64b3970ba` |

The exact governed application scope is
`ba185f4c51f60e04c787678df9722ecbf76445596840f23d11f668b753433646`.
It binds the original approved preparation scope, the two durable
preview bindings and events, the exact projected content hashes and
internal Actions, installation and site proposal, canonical base,
signed predecessor 4, and materialized rollback to 3. This is the
review scope fingerprint. Core's signed site candidate digest depends
on the approval events and can be computed only after they exist.

The owner can open the existing private local review index at
`runtime-content/c0-wordpress-private-preview-v15-verified/index.html`.
A new comparison confirmed both local preview bodies match the durable
Cloud review bodies byte for byte apart from the revision label and
machine-readable details. The index also links both exact WordPress
before/after comparisons. The full governed HTML, including exact
revision labels and machine-readable data, remains in `home.html` and
`service.html` under the protected Cloud review directory.

Proposed authorization for owner review:

- Approve only the two recorded Core previews for this synthetic
  non-public revision. Create only the short-lived fixture-specific
  Page approver with recorded mandate, private projection reviewer
  and native draft authorizer through existing custody. A read-only
  grant inventory found no active principals for those operations.
  Keep those three roles distinct. The current preparation principals
  have no approval, signing or application authority.
- Enable the v2 recovery-compatible 0.0.10 delivery plugin on the
  existing protected development installation exclusively, from
  `07992bf`, after verifying the current 0.0.9 package and its rollback
  copy. Use the corresponding protected Core Operator tooling. Recheck
  the same canonical base, approved previews, active installation and
  authenticated live recovery evidence before issuance. Stop on drift.
- Apply only site revision 5 to existing draft Home 13 and Service 14,
  with reviewed Home-to-Service and Service-to-Home Actions. Verify
  preserved IDs, slugs and draft status, both exact content SHA-256
  values, and navigation. Reconcile the authenticated apply receipt,
  verify an exact retry, then restore the exact displayed revision 3
  on the same IDs and reconcile the restore receipt. Keep signed
  high-water 5 and the previous evidence. Stop on a mismatched gate.
  This scope authorizes neither publication nor provider dispatch.

No new WordPress file, content, plugin, revision, approval or signature
was changed during independent verification.

#### Hosted revision 5 apply and restore

**PASS.** Executed the owner-approved scope
`ba185f4c51f60e04c787678df9722ecbf76445596840f23d11f668b753433646`
on the existing protected `miopages.org` development installation.
Three independently authenticated, fixture-scoped principals recorded
the two exact development Page approvals, reviewed the site
projection, and authorized the native draft. The approved Page
events were Home
`9f59c79689dd5a164511524a949df9fb56d65ea33ac42877a214497d96f07a5f`
and Service
`82a8177a30fac5a7be11692672c5c1797c54f7c037783fdc902db8111442ac2a`.
The signed v2 candidate digest was
`2fd1dd2b6780a5f4e8af35c45f80845578032de06b632b05a9012ff52a455ae0`.

The previously retained 0.0.9 ZIP matched all 14 installed files
byte for byte. Its SHA-256 is
`6c3f812f0eb03016f97d433a8ea365c732d12e31c19662c8c1159ace9742fa7e`.
The first staged 0.0.10 ZIP used Windows line endings. It was replaced
before installation with exact LF Git blobs from `07992bf`.
The installed package SHA-256 is
`ec75ecd6906742aa9eb5a714263720752afbc80ab547d027910de81d9ee4797c`.
Only the plugin entry point, native envelope verifier and draft
writer differ. Delivery 0.0.10 is active. The preserved 0.0.9
directory and original ZIP both remain off-webroot.

| State | Signed high-water | Displayed revision | Home 13 content SHA-256 | Service 14 content SHA-256 |
| --- | --- | --- | --- | --- |
| Before and after restore | 4 before, 5 after | 3 | `960fea54ac23eb52c15eb9aedec4e84023903c845160942ebc96256b58999940` | `90c4917bfe9fa5fd7d478df98a972c6cfd26050e47d54a0c735ef369d9cbc39e` |
| Applied and retried | 5 | 5 | `9a2a218c24ab25bd5f31c6122617f28786ea705a6db9d91d81f8d1bde2d2816b` | `eb3c0a43811f6c6f882317ede97c8e8e0cdbfc8b6d4c513fef12a6b91ab75b5f` |

Both Pages remained drafts with unchanged IDs and slugs. Both
navigation links and the reviewed reciprocal Actions matched the
signed revision 5 projection. After restore, the original links
returned with the original bytes. The exact apply retry produced an
identical receipt without adding WordPress revisions. Core reconciled
the HMAC-authenticated apply and restore receipts, and a fresh SSH
readback confirmed the persisted journals match the WordPress copies.
Receipt file SHA-256 values are
`37102465ac26b20163684c5d3c69cb2b9dfd0ad36ed047391d84d51b1ef3f8ad`
for apply and
`d024db68cf9a8f2368c16d56cd3fbf02853f0ef6429e142c2ad0f6811f6e36ec`
for restore. The baseline, application and recovery evidence remain
in their respective protected directories. The WordPress Page
inventory and active theme matched throughout. Unauthenticated HTTPS
to the site and both draft URLs returned 401. No public publication,
production Core change or additional provider dispatch occurred.

To inspect restored drafts, use the existing site protection and
WordPress login for [Home 13](https://miopages.org/?page_id=13&preview=true)
and [Service 14](https://miopages.org/?page_id=14&preview=true).
The previous private local review remains the way to see the proposed
revision 5 copy and before/after comparisons after restoration.

Local verification passed 401 application tests, TypeScript, focused
ESLint, the consolidated PHP smoke gate and four disposable PostgreSQL
and Node/PHP integration tests. The distinct, evidence-bound site
planning operation now shares the existing Responses usage ledger,
token count, expense reservation and request cap. It revalidates the
authorized input before generation and before returning a plan. An
offline transport test verified the request sequence, duplicate
refusal and a changed projection stopping after the token count.
No generated site plan was sent live or saved into hosted Core.
Next, connect this operation to authenticated Core review and draft
persistence, then authorize a bounded live test of exact C0 and
fictional-business evidence to verify that substantially different
business needs lead to different page structures and visitor actions.

#### Authenticated site planning and exact live decision

Core's existing authenticated intake now supports a separate generated
site proposal with resumable Operator review. It reuses the restricted
draft view and existing row version check. Generation stores the
original model proposal, permitted source excerpts, business-evidence
binding and model identity. The editor stores changes separately.
Review is bound to the edited plan and visitor actions. Edits and
evidence changes prevent stale approval from qualifying for preparation.
An approved review packet uses the established WordPress Operator
compiler, and the individual Core Page approval and native authorization
gates still apply. Unresolved contact destinations block preparation.

The existing protected inquiry report can attach its revision-scoped
synthetic recommendation to a selected generated Page. That creates a
new review revision. It establishes no customer interest, lead quality
or conversion. The hosted scope still contains only C0. The contrasting
tree service was exercised on disposable PostgreSQL with an offline
transport. It is not another hosted customer.

[Exact proposed live inputs](site-planning-live-proof-inputs.json) list
the two proposed model projections. C0 would use only those curated
business statements and that exact saved unconfirmed answer if it still
matches Core. No other answers, interview questions, provenance
pointers, private reviews or credentials may leave Core. C2 is fictional
and would use only its two fixture statements in a separately attributed
development proof. The proof does not add C2 to the existing hosted
C0 database grant. Review actual generation in Core for C0 and in the
isolated development review for C2.

Proposed authority is one token count and one generation per business
on `gpt-5.4-mini-2026-03-17`, four requests total, no retries, no external
tools, provider response storage disabled, and a 24-hour maximum grant.
Each generation is bounded to 4,000 input and 1,200 output tokens, for
a combined upper bound of $0.0168 new usage at standard rates under
the existing aggregate $0.50 hard cap. Compare the proposed page set,
visitor decisions, source evidence and unresolved claims. No live
provider dispatch is authorized by this checkpoint. See the [official
model card](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

Protected Core at [the existing development URL](https://wp-acceptance.miopages.com/core)
runs `9786247d3a11b94c8ac9e81d107f70edd1c73a8f`. The reviewed
[Linux build](https://github.com/R-Levin/myomaton-web/actions/runs/43546193419)
passed, and all 163 artifact files matched. Tar SHA-256 was
`b30c7a36850fc74232aa315ce2e931f33a24768e82916c6efff3d241499cc64a`.
The first build `fdb0458` refused unapproved generation with a generic
503. Awaiting the protected operation within its status handler
corrected that. External HTTPS verified the deployed review assets,
anonymous 401, authenticated retained C0 draft v15, inquiry readback,
and a clean 403 for unauthorized generation without changing the draft.
Both public Core HTML digests matched before and after. The previous
protected build and config checksums stay in off-webroot rollback
custody. WordPress and the verified revision 5 receipts were untouched.

Local verification passed 401 app tests, TypeScript, focused ESLint,
and disposable PostgreSQL coverage of generation, resume, separate
review, stale evidence, and the existing WordPress preparation compiler.
The new editor pages and source review build are online. No live model
proposal exists yet. The two-case site-structure comparison used
recorded offline outputs and does not establish model quality.

The [exact outbound evidence and limits](site-planning-live-proof-inputs.json)
bind to manifest fingerprint
`3437eb2491bd7d44dea7cb707319771158b6d61db1f3ac56b4019e908e4e66d6`.
The separate projected input fingerprints are C0
`852a29a77307e671ce56f75b0e879da9a7856ff775ed1c9d36d70d9354775923`
and fictional C2
`20a4f3c074a53b53cb641fa14d49443e868711d64e6c1cc8c28a80ab4ac32ddf`.
The sole provided current C0 interview answer was matched read-only.
Once authorized, use the exact curated C0 manifest and current draft
basis in the existing account's private planning grant. Run fictional
C2 through the separately attributed, off-webroot proof runner without
granting hosted C0 database access. Both runs share the existing
metered ledger, with 10 prior requests and $0.005629 estimated usage.
Use the exact per-input two-request limits and a $0.022429 absolute
usage ceiling, inclusive of prior usage. The proof runner also
enforces an aggregate 14-request ceiling. No grant file was created. Retain
sanitized page/visitor strategy comparison and keep real Private
WordPress application under its own exact approval.

#### Bounded live AI site comparison stopped

The [owner-delegated authorization](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6870250745)
approved only manifest
`3437eb2491bd7d44dea7cb707319771158b6d61db1f3ac56b4019e908e4e66d6`
at `df38103`. The protected C0 draft (version 15), its sole current
provided interview answer, both exact input digests, deployed Core
`9786247`, the governing expiry, and the settled starting ledger
were verified before enabling dispatch. Fictional C2 was staged
off-webroot from the unchanged source with no new tenant, grant or
customer-data access.

C0 used exactly one Responses token count and one generation at
`gpt-5.4-mini-2026-03-17`. The receipt recorded 699 input and 1,200
output tokens, zero cached or reasoning tokens, an estimated $0.005925
and its original $0.008400 reservation. A valid usage record reached the
output ceiling and the ledger marked the response uncertain. The
recorded estimate was within its reservation. The original adapter did
not retain the provider's incomplete reason or partial text. The
ceiling is directly supported by usage, while the exact provider
reason is unavailable. Core refused the result and saved
`generation_failed` at draft version 17. There is no saved model plan,
Page/Section output, visitor action, or citation to compare.

The uncertainty stop gate prevented C2 dispatch and there were no
retries. The temporary C0 grant was withdrawn and the uncertain ledger
was copied and verified off-webroot. The authoritative ledger remains
untouched. It records 12 requests and six generation attempts overall,
with $0.011554 estimated including prior usage. Authenticated HTTPS
verified the preserved C0 input and inquiry, no new proposal, and
site planning dispatch disabled. The first loopback check immediately
after restart arrived before the socket opened. The authenticated
HTTPS check passed once the existing listener was ready. Prior
WordPress approvals, publication and receipt boundaries remain intact.

Offline follow-through records an allowlisted provider incomplete code
and presents the specific output-limit case to an Operator. It still
marks incomplete usage uncertain and refuses all later dispatches
until independently reconciled. The focused regression reproduces the
699/1,200 usage and confirms that no model text or additional request
is emitted.

Next, verify the recorded charge and completion status through the
existing OpenAI project usage evidence, keeping the original receipt.
Prepare a compact evidence-linked generation format and size its
output offline against both business cases. A new exact authorization
is required before any new dispatch. Assess actual content, site
structure and conversion differences only once both cases return
complete saved plans.

#### Compact site planning and usage reconciliation gate

The November 13 C0 request receipt was checked in the hosted workspace.
The original ledger and its protected copy match byte for byte at SHA-256
`a3864195d357f662c529d7b5084d14878ceb72c415a9f33d32e2a9aba2beeb18`.
The stored provider response usage is 699 input, 1,200 output, zero
cached and zero reasoning tokens. Standard model rates independently
recompute to $0.00592425, rounded up to the ledger's $0.005925 USD.
The owner read back one dashboard request, 1,899 total tokens and a
rounded $0.0059. This strongly corroborates the estimate. The dashboard
did not independently show the 699/1,200 split, and project, model and
request attribution were not independently verified. The original
request remains uncertain, the authoritative ledger stays untouched,
and both cases remain disabled. A matching provider export should
isolate the development project, model and generation on November 13
around 9:36 p.m. Eastern (November 14 around 02:36 UTC). The aggregate
does not establish the original provider completion reason. Preserve
the original receipt even after its charge is independently reconciled.
[OpenAI Usage Dashboard](https://platform.openai.com/usage) ·
[Official model rates](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

The compact response contract puts copy, numeric source citations and
the action with each Page and Section, eliminating the parallel Page
metadata array and repeated long source IDs. It validates and normalizes
into the same persisted review and delivery shape. It refuses missing,
duplicate or foreign citations, unsafe destinations and malformed copy,
keeps open questions, and does not choose a page count for the model.
Older review records and their digests keep the existing representation.

| Authored offline case | Structure | Visitor strategy | Compact tokens | Previous shape tokens | Indented compact |
| --- | --- | --- | ---: | ---: | ---: |
| Real C0 evidence | 3 pages, 6 sections | Review-first for an existing website, with a separate conversation path. Launch and Ongoing eligibility remain open. | 733 | 988 | 993 |
| Fictional C2 evidence | 5 pages, 9 sections | Storm triage and routine pruning estimates have different information and contact needs. Hours, coverage, license and insurance remain unverified. | 1028 | 1204 | 1411 |

Counts are local `o200k_base` estimates for the authored JSON, excluding
provider framing. Both cases also fit the existing draft byte envelope
in the offline test. These measurements support a single response for
each of these two cases at the proposed allowance. They do not
establish live model quality or how large sites will fit. If a later
case needs more space, use resumable architecture planning and scoped
page-writing steps in the existing Core review, with evidence bindings
and independent decisions per saved stage.

Operator review can now edit the inquiry-recommended section while
preserving the exact synthetic inquiry and source draft references.
A changed section invalidates the prior review decision. Reapplying
the same recommendation to the same Page preserves the Operator's
edits and current draft version. This records a proposed improvement,
without claiming real traffic, demand or measured outcomes.

**Prepared authorization.** [Comparison scope](site-planning-compact-proof-scope.json)
fingerprint `fda4e83664a481649979d7069acd65e0cd52a2bd42caf12b209ff52d4e6b0a6d`.
Use the exact evidence manifest at `df38103` and its unchanged C0/C2
input digests. C0 keeps the existing scope and its sole, unconfirmed
approved answer projection. C2 uses exact fictional evidence, separate
attribution and off-webroot output without a hosted tenant or C0
database access. Use `gpt-5.4-mini-2026-03-17`, one token count and one
generation per case, 4,000 input and 6,000 output tokens per generation,
no retries or tools, and `store:false`. Activation expires within 24
hours and by the expiry of any governing grant. The request envelopes
reserve at most $0.030000 each or $0.060000 combined. The requested
additional hard cap is $0.10. The prepared implementation uses the
stricter $0.071554 cumulative ceiling including the known $0.011554
estimate, contingent on reconciliation, and 16 cumulative requests.
The product design target is less than $1 total AI cost for a useful,
reviewable candidate, including research, planning, copy and necessary
revisions. Track actual usage per operation and assess business relevance
and Operator effort before adjusting the design.

Next, obtain independent project usage evidence and reconcile outside the
original receipt, then independently verify the updated Linux artifact and
activate the exact grants only after owner authorization. Confirm each
saved plan, citations, visitor destinations and open questions before
continuing. WordPress approval, application and publication remain separate.

The [Linux production build and smoke](https://github.com/R-Levin/myomaton-web/actions/runs/43600191588)
passed for `63542dfabc2ad9109ead89edb00cd675e7d718e7`. Artifact
`14115977882` independently matched its outer ZIP and inner tar checksums
and all 163 manifest files. Tar SHA-256 is
`074c30d4a66fce1e33e5bf1335bdaf0276af3e98b5b83fa21590b89bde7d8386`.
Hosted Core still runs the previous build. Local checks passed 404
application tests, 14 focused tests, TypeScript and ESLint.

#### Conditional compact comparison blocked at project attribution

Read [owner authorization](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6878168944)
and its [underlying assessment](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6878148736).
The conditional approval for the exact comparison at `b307b45` is
recorded. Both local manifest fingerprints matched the approved
scope. The owner-reported dashboard figures match the recorded model's
1,899 total tokens and $0.0059 rounded charge after model filtering.
They do not establish which development project or request produced
the dashboard entry. Browser automation could not open an authenticated
dashboard and no matching provider export was available in the checked
locations. No credentials or permissions were changed to gain access.

Read-only SSH confirmed the live ledger and preserved copy are still
byte-identical at SHA-256
`a3864195d357f662c529d7b5084d14878ceb72c415a9f33d32e2a9aba2beeb18`.
The last ledger write was 2026-11-14 02:35:44 UTC, which is November
13 at 9:35:44 p.m. Eastern. Use this host timestamp to locate the
event, rather than shifting the earlier reported Eastern time.
The retained record has the provider response ID, 699 input tokens,
1,200 output tokens, $0.005925 estimated usage and its $0.008400
reservation. It is still uncertain. Both case grants were absent,
the total remained 12 requests, and hosted Core still reports
`9786247`. No dispatch, reconciliation entry, hosted deployment,
WordPress change or publication occurred. No genuine comparison
outputs exist for either business.

Next obtain an independently inspectable, project-and-model-filtered
Usage export for the original UTC window. It must isolate the one
generation, or provider-side confirmation must correlate it with the
retained request or response ID. Keep those identifiers in protected
custody. Once matched, retain the incomplete receipt and record the
monetary reconciliation separately before scheduling dispatch. Recheck
the governing grant expiry and the exact compact artifact at execution.

#### Owner decision on the earlier incomplete charge

The owner instructed Codex to proceed with the exact compact test without
the project-filtered dashboard export. Project attribution remains
unverified. For this comparison only, account for the full $0.008400
reservation of the exact retained receipt, leaving it uncertain and
unchanged. The absolute ceiling is $0.074029, made up of prior settled
$0.005629, the retained reservation, and $0.060000 for the two request
envelopes. It retains the original four new requests, exact input pins
and no retries. Every other unresolved receipt still blocks dispatch.

#### Compact C0 completed but hit the draft storage limit

After the owner waived the dashboard export for this bounded test,
the exact compact runner used the full reservation for the original
uncertain receipt. The earlier six receipts were independently compared
against the byte-preserved ledger copy after the new dispatch and all
matched. Project attribution remains unverified. The prior receipt
remains uncertain, with its outcome and accounting fields intact.

The protected build at `64b3f55dce1bdefaf7703299b429fb14edd9dd6b`
passed [Linux CI](https://github.com/R-Levin/myomaton-web/actions/runs/43601786879).
Artifact 14116557604 matched its published outer ZIP checksum, inner tar
SHA-256 `1378c7fdb747f9f037f20dddfd2c2cf6c73434543a0666e33531690f4427235a`,
and all 163 files before swapping only the protected Core build.
The previous build was retained off-webroot. Public Core responses on
both existing hostnames matched their baseline bytes.

C0 used one token count and one generation. The usage receipt completed
and recorded 578 input tokens, 1,122 output tokens, and zero cached or
reasoning tokens. The standard-rate estimate is $0.00548250, recorded
as $0.005483, against a $0.030000 envelope. The model response passed
structured proposal validation, but combining it with the existing
interview and provenance exceeded Core's 14 kB draft write limit. Core
saved `draft_capacity` at version 19. The content was not persisted.
There is no reliable basis to report its pages, copy, citations, visitor
actions or unresolved claims. C2 remained disabled and was not dispatched.
There were no retries, WordPress changes or publication. The grants are
absent. Authenticated HTTPS confirmed Core is available with the
preserved interview evidence and synthetic inquiry.

The follow-through changes only protected proposal persistence. It
stores the review losslessly in a bounded compressed representation
inside the same restricted intake record and reads older review
objects as before. The existing row size, tenant checks, optimistic
version, normalized proposal and approval digests remain intact. A
disposable PostgreSQL regression uses a substantial plan whose full
uncompressed review and retained provenance exceed the former write
limit. It verifies exact reload, review, delivery preparation, and the
editable synthetic inquiry link through the same scope. A sufficiently
large or incompressible review still needs a separately scoped storage
design. The storage fix has not been deployed.

Next verify the fixed artifact and seek a fresh exact dispatch decision.
The compact C0 request was consumed, its payload was not retained
(`store:false`), and this scope permits no retry. A new test also needs
an unexpired governing grant and updated starting spend/request counts.

#### Protected storage deployment and database guard

The protected Core build at `6d64706cb255087f2fc707c668cc5d28a6759c3e`
is running at the existing protected HTTPS origin. The
[Linux production artifact](https://github.com/R-Levin/myomaton-web/actions/runs/43602335416)
passed independent ZIP, tar and 163-file verification. Only the build
and its manifest were swapped in the acceptance package. The previous
build and manifest remain available off-webroot for recovery.

A rollback-only hosted fixture saved a lossless, compressed proposal of
five pages and 24 sections. The uncompressed review plus retained
interview provenance exceeded 14 kB and the saved proposal matched the
offline input. A later reload-and-review step returned PostgreSQL
`42501`. The run did not record which operation in that combined step
returned the error. A fresh scoped read returned zero fixture rows.
Hosted persistence, editing and review have therefore passed only in
part.

The live function body matches the original intake trigger in migration
0010. Its combined submission-state predicate and submission lookup can
check table privileges on a generic query plan even during draft-only
updates. This was reproduced with the same restricted role policy in
disposable PostgreSQL. The forward-only SQL in
[the draft guard correction](../lib/platform/intake/protected-core-draft-guard.sql)
checks the state in a separate branch. It preserves invoker behavior,
the managed-site check, all grants and the matching-snapshot requirement
for actual submission. The focused regression preserves rejection of
an unattested submission, accepts the matching snapshot and refuses
edits after submission. All nine targeted tests passed. A separate
legacy intake suite in a bootstrapped disposable cluster failed its
fixture owner check and dependent cases. That suite loads the unmodified
canonical migrations and does not install this correction.

The C0 draft is still at version 19 with its prior capacity-failure
record, interview evidence and synthetic inquiry. The usage ledger
matched its recorded hash and the starting totals remain 14 requests
and seven generation attempts. No provider calls occurred. Both public
Core HTTPS outputs matched their preserved bytes. Read-only WordPress
checks matched active Delivery 0.0.10 and the restored content, slugs
and draft status for Home 13 and Service 14.

Automatic approval review rejected a repeat hosted write after the
authorization error. The database correction has only been tested
locally. The next action is specific approval for an authorized
database owner to replace only `public.prospect_intake_guard()` in a
transaction, with the original definition retained for rollback. Match
the current body hash
`039d1df064a3a7117d7b318b2a09a033bcb68ccd77e12653a2a95df83e4821e3`,
verify unchanged owner, ACL, invoker settings and enabled trigger, and
verify the corrected definition before commit. Then rerun one rollback-only
fixture using [the storage proof](../scripts/site-planning-hosted-storage-proof.ts)
under the existing restricted role. Require distinct save, reload,
edit, review and cleanup evidence. Stop on failure. No grants, intake
data, migration ledger entries, credentials or WordPress state are
part of the correction. Fresh C0/C2 model authorization follows
successful hosted verification, with the existing ledger preserved.

Compression is a temporary compatibility measure for the intake row.
Commercial V1 needs independently versioned, tenant-scoped site proposal
storage. Bind each generated version to its exact intake evidence and
retain the original output, Operator edits, scoped decisions and delivery
references as distinct history. Keep the existing approval and editorial
digests. This would let adaptive onboarding and Ongoing improvements use
the same review workflow without tying proposal size or retention to the
intake record. The storage design and rollout remain pending.

#### Authorized draft guard rollout and storage verification

The legacy intake suite on the unchanged canonical migrations reproduced
`Intake owner mismatch` against a fresh database containing only schema.
The test fixture copies the canonical customer graph from its source and
expects its pinned, active pilot owner plus a second active site for the
cross-tenant checks. After seeding those two synthetic graphs in the same
disposable cluster, all 11 tests passed. No trigger replacement or
canonical migration change was involved.

The protected-host read-only checks confirmed database `postgres`,
verified TLS, owner `miopages_migration`, the exact original body hash,
security invoker with caller search path, the existing two execution ACL
entries and the enabled intake trigger. No writer lock was present.
The approved launcher takes an advisory transaction lock and a short
`NOWAIT` table lock that permits ordinary readers. It retains the
original function definition in a private file before replacement,
verifies the unchanged function and trigger identities, ACL and settings,
and checks the resulting definition before and after commit. The only
database operation authorized here is the function replacement, with
exact restoration if the verification fails.

The five-page, 24-section rollback-only verifier passed locally against
the corrected trigger under forced generic plans. The fixture used
22,694 uncompressed and 9,049 stored provenance bytes. It verified
exact original and edited reloads, preservation of the generated source
relationships, rejection and approval in the synthetic fixture only,
delivery preparation, capability and table-access refusals, and zero
residual fixture rows. The companion disposable policy regression also
verified rejection without a matching submission, acceptance with the
matching snapshot, and immutability after that transition.

The privileged launcher and the scoped proof are staged off-webroot.
The existing migration password is available only through the owner's
established hidden prompt. Before the launcher runs, hosted Core still
uses the original function. The one hosted rollback-only test, final
state comparison and any request for fresh live C0/C2 authorization
remain pending. No model dispatch or WordPress action was taken.

#### Hosted draft storage verification passed

The migration owner applied the approved function-only correction in
the guarded transaction. A fresh restricted session verified the new
body SHA-256
`1ed36464403915c24606bbeaeac6edf40d89320cdb0e11a01894303dd39b7696`,
unchanged owner and execution ACL, invoker security, caller search path,
and the enabled trigger. The original definition is retained off-webroot
with mode 0600, and its original body hash was independently verified.
Function rollback was unnecessary.

The one hosted run used the existing restricted role and forced generic
PostgreSQL plans. It saved five pages and 24 sections from an offline
fixture, comparing a 22,694-byte uncompressed provenance payload with
9,061 stored bytes. The scoped service reloaded the generated proposal
exactly, preserved generated source relationships through editing,
exercised synthetic rejection and approval, prepared a review-bound
delivery input, and reloaded the edited result. Unknown resume
capabilities, direct canonical/submission access, tenant reassignment
and a submission-state write were refused. The restricted view did
not expose submitted drafts for editing. The disposable regression
separately verified rejection of an unattested submission, acceptance
of the matching snapshot and immutability of the submitted intake.
The fixture transaction rolled back and both the verifier and a fresh
independent restricted session found zero fixture rows. The hosted
proof receipt SHA-256 is
`1fe4bc1615ebd3c4f84a2673e4bc22cb20af10ec33b4ddd69578a8fe1955a2b9`.

Authenticated HTTPS readback verified C0 draft 19 and its retained
interview and synthetic inquiry. The usage ledger matched its original
SHA-256. Both public Core HTTPS bodies matched their preserved
baselines byte for byte. WordPress Delivery 0.0.10 and draft Page IDs
13 and 14, restored revision 3 and high-water 5 all matched. The hosted
fixture ran through the deployed service implementation's storage path.
There was no customer approval, model dispatch, WordPress application
or publication. Independent, versioned proposal storage remains
required. Compression serves only as transitional intake compatibility.

#### Proposed fresh C0/C2 comparison authorization

Authorize one new comparison using the pinned [compact evidence and input scope](site-planning-compact-proof-scope.json)
and the exact existing C0 and fictional C2 input digests. C0 includes
only already allowed evidence and the single previously approved,
unconfirmed answer projection. C2 takes only its fictional manifest,
stays separately attributed, and writes its candidate off-webroot.
Use `gpt-5.4-mini-2026-03-17` with one count and one generation per
case, at most 4,000 input and 6,000 output tokens per generation,
no tools, `store:false`, zero retries and expiry within 24 hours
and the governing grant. Keep the previous C0 result receipt and the
earlier uncertain receipt. No model requests have been made under
this proposed authorization.

The unchanged starting ledger records 14 requests and seven generation
attempts, with $0.011112 in settled Core estimates and one uncertain
receipt carrying a $0.005925 estimate. Carry its full $0.008400
reservation unchanged, for an accounted starting total of $0.019512.
Request a $0.10 maximum additional authorized spend. Enforce the
stricter $0.060000 combined request envelopes and $0.079512 cumulative
ceiling with at most 18 cumulative requests and nine generations.
Stop on any unexpected ledger, scope or result. Before any dispatch,
bind the new approval to one distinct, exact comparison identity,
test that C0's prior dispatch remains deduplicated and unmodified,
and verify the governing grant and protected build. The earlier
compact grant is exhausted. Existing WordPress and publication
approvals do not change.

#### Fresh compact comparison stopped after C0

The owner approved the exact `b42f6e6` comparison. The new comparison
identity bound it to the original seven-receipt ledger, pinned inputs,
and unchanged model, expiry and spend limits. An offline preflight
with the real ledger copied to protected temporary storage exercised
two cases with simulated transport, rejected duplicate and out-of-order
dispatch, refused crossed input scope and preserved the live ledger.
Ten focused tests passed. The [Linux build and smoke](https://github.com/R-Levin/myomaton-web/actions/runs/43608798345)
passed for `c493e6558f03970adb28d781dfd0e870f234e9fd`. Artifact
14119413241 matched its outer checksum and inner tar SHA-256
`8d44ac47cd53b50cc437996c27ac5cb295638e9bfac83d0a5ebc3603d89069a6`;
all 163 files matched before replacing only the protected Core build.
The prior build and a byte-exact pre-run ledger were retained off-webroot.

Only C0 dispatched, once for count and once for generation. The
provider completed at 578 input and 880 output tokens, with zero cached
and reasoning tokens. Core recorded a $0.004394 standard-rate
estimate from returned usage against a $0.030000 envelope. No provider
invoice was available in this run. Core reported `generation_failed`
and saved no proposal at draft version 21. The provider receipt confirms
a completed response with parseable JSON. The later failure occurred
before the normalized proposal file was written. The existing code
collapses semantic validation, the post-response evidence recheck, and
the protected file write into the same failure status, so the exact
cause remains unverified. The raw response was not retained under this
run's controls. No new generation should be used to diagnose it.

The previous seven ledger receipts remain exact. The updated ledger has
16 requests and eight generations, $0.015506 in settled estimates and
an unchanged $0.008400 reserve for the earlier uncertain charge,
for $0.023906 accounted. Updated ledger SHA-256
`3b919bb56cee5edba6c67d5217f2bbcf7e0e837bb2666595d798650e38856999`.
The spent C0 grant was moved to protected evidence custody. C2 was
never activated or dispatched. Neither candidate output exists.
Authenticated HTTPS confirmed the same C0 evidence basis, the same
unconfirmed interview answer and the retained synthetic inquiry, with
generation disabled. Both public Core HTTPS bodies matched their
baselines. WordPress drafts 13 and 14 remained at restored revision 3
and high-water 5. No customer approval, WordPress write or publication
occurred.

Next distinguish post-response evidence mismatch, schema or semantic
validation, private evidence persistence, and proposal storage failures
through allowlisted diagnostic stages. Use adversarial offline examples
of provider-valid JSON with rejected citations, routes and copy, then
verify that accepted results appear in protected Operator review with
their provenance intact. The next live operation needs separate
authorization and the updated ledger. Independent, versioned proposal
storage remains part of the Commercial V1 direction.

#### Current workstream cost and next outcome — owner procedure update, November 14, 2026

The owner has explicitly prioritized delivering a persistent, reviewable
generate → edit → private preview product experience over repeated
penny-level stop gates. The binding development operating rules and
cost-reporting format are now in
[development-control](development-control.md#outcome-first-execution-and-proportional-controls--owner-decision-2026-11-14).
Do not infer a new provider grant from these instructions; do not break
the current ledger or privacy boundaries.

**Running cost, as of checkpoint `894240b` (not a live current balance):**

| Scope / result | Estimated provider-model usage | Uncertain reservation | Accounting ceiling | Owner time |
| --- | ---: | ---: | ---: | --- |
| C0 site-planning comparison: three generations, none retained; C2 zero | $0.015802 (includes $0.005925 uncertain) | $0.008400 replaces the uncertain estimate for accounting | $0.018277 | Several hours reported; exact time/rate unverified |
| Entire scoped Core AI ledger: 16 requests, eight generations | $0.015506 settled (excludes the $0.005925 uncertain estimate) | $0.008400 | $0.023906 | Not separately measured |

The first row is **included** in the overall Core total, **not** an additional
charge. Accounted amounts include a reservation and are not invoices.
No grants are active as of this checkpoint. Known C0 provider-generation
deltas: $0.005925 (uncertain first run), $0.005483 (subsequent valid
model output lost to draft capacity), and $0.004394 (latest parseable
output lost after provider completion). The last receipt had 578 input
and 880 output tokens. The project has no retained live site
proposal from these attempts. Track additional runs as deltas against
this baseline in the same handoff, stating both task subtotal and wider
Core balance with provider ledger receipt evidence. Do not invent
unrecorded time or costs.

**Next owner-visible outcome:** Codex instruments and offline-replays
post-response validation/persistence, preserves recoverable private
model output under existing custody limits, and makes a real proposal
survive normalized save, reload, Operator edit/review and later private
WordPress preview. Only consequential external model spend, protected
hosted writes and publication require fresh applicable authority.

#### Local proposal response custody and recovery

The proven defect at `894240b` was loss of evidence across stages. Core
recorded a completed provider response and parsed JSON, then ran a
second evidence check, semantic normalization and private artifact
write before committing the draft. All three could return the same
`generation_failed` status. With no exact response retained, the
historical C0 failure cannot be assigned to one of them. The recorded
cost and receipt remain valid. Replaying a new model request would
produce different evidence.

Core now takes the exact completed HTTP response body into private
custody after checking model and tier and before validating usage or
decoding proposal output. Its private record binds the response to
the draft attempt, tenant, input digest, evidence basis, model and
ledger work identity. The record contains the exact bounded outbound
projection and response body, with no authorization headers, database
credential or raw interview context beyond the permitted projection.
The hosted application requires an owned off-webroot mode 0700 folder,
and writes mode 0600 files with an exclusive final name, fsync and an
integrity readback. Recovery requires a settled usage receipt with a
durable marker confirming that the post-response authorization and
evidence recheck passed. The
provider still uses `store:false`. No additional proposal byte ceiling
was introduced. Existing transport, token and editorial constraints
and the transitional intake row limit remain.

The Operator sees allowlisted outcomes for evidence changes, ledger,
provider count, transport, identity, completeness and usage, response
decoding, proposal shape, citations, routes, copy, private capture and
draft persistence. Raw evidence and exception strings stay off the
browser and logs. The existing protected recovery action checks the
current draft and reuses the same validator without contacting the
provider. It refuses changed evidence, unrelated owner/input, tampering,
an unsettled receipt and expired captures. A valid response recovered
from a failed draft write remains proposed until the ordinary review
workflow. C2 keeps a separate capture directory and a separate
local-only recovery entry point in its existing runner. C0 review
does not load fictional C2 evidence.

Verification used provider-shaped offline responses covering invalid
JSON, duplicate citations, invalid visitor routes, unsafe copy,
missing sections, changed evidence, incompatible usage, private
write failure, row capacity and simulated database failure. Exact
response bytes, checksum refusal, expiry, no duplicate provider
request, and scope isolation were checked. Disposable PostgreSQL
exercised a substantial provider-shaped draft through the restricted
writer, reload, edit, review and delivery preparation, including the
existing synthetic inquiry path. Application regressions and the
retained WordPress approval digest passed. No hosted mutation or
provider dispatch was performed.

**Smallest rollout pending explicit authorization.** Verify the Linux
artifact, back up the current protected build, and replace only that
build. Provision owned 0700 `site-planning-proof/responses` and
`site-planning-proof/c2-responses` off-webroot. Permit recovery for up
to 24 hours from capture. The implementation prunes expired purpose-named
files before capture; schedule a bounded private expiry sweep or
remove expired captures at the approved cleanup even if there is no
further generation. Verify exact authenticated Core readback with
both dispatch grants inactive. Keep C0 draft 21, ledger, public Core
and WordPress at their recorded baselines. No migration, privilege
expansion or new account is required. A failure to write secure
storage still requires repair before any dispatch. A permanently
invalid response remains evidence for diagnosis and cannot be
promoted with missing citations or an invalid route. Independent,
versioned site proposal storage remains pending for Commercial V1.

**One later comparison.** Obtain a fresh exact authorization for the
rollout plus the C0-then-fictional-C2 comparison, with the same
evidence manifest and model and one count and one generation per
case. Use the existing 4,000 input and 6,000 output caps, `store:false`,
no tools, no automatic retries and expiry within 24 hours and an
unexpired governing grant. Start from the verified 16 requests,
eight generations and $0.023906 accounted including the existing
reserve. A $0.060000 maximum in added request envelopes would put
the cumulative ceiling at $0.083906, 20 requests and ten generations.
The previous identity is consumed. A new exact grant, ledger pin,
expiry and run identity need to be configured and tested after
authorization. Require a verified C0 protected Operator readback
before permitting C2. If there is a failure, use the retained capture
and stop before another dispatch. Private WordPress preview still
requires governed review and the existing delivery approvals.

**Running cost at local recovery checkpoint.** Site planning since the
first C0 comparison has three generations and six requests, with an AI
delta of $0 and $0.015802 in cumulative usage estimates including the
earlier uncertain estimate. The $0.008400 reserve puts the task at
$0.018277 accounted. The inclusive Core total remains 16 requests,
eight generations, $0.015506 settled and $0.023906 accounted. Evidence
is the preserved ledger at `894240b`. Additional project cash cost
was not incurred. Owner minutes are unknown. This increment used
offline replay to avoid another external generation. Hosted rollout
and a fresh aggregate grant remain pending.

#### Owner-approved consolidated response recovery and live comparison — November 14, 2026

**Owner approved** one integrated protected rollout and model comparison:
[Issue #12 approval comment 6880548834](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6880548834).
This supersedes only the previously proposed $0.06 / zero-retry limit,
not the immutable C0/C2 evidence scope, security/tenancy gates,
customer knowledge authority or WordPress publication controls.

Verify and deploy exact reviewed protected Core response-custody build
`a842527` with rollback and the separate private C0/C2 response
directories, retention no longer than 24 hours and verified cleanup.
Test authenticated readback while dispatch remains disabled. Then
one bounded live cycle with `gpt-5.4-mini-2026-03-17`, the unchanged
pinned C0/C2 inputs, and `compact/2` output may use **up to three
generations per case** (six total), one count per generation
(twelve provider requests total), standard maxima of 4,000 input /
6,000 output tokens per generation, no tools and `store:false`.
**New additional AI model authorization cap is $0.25**; grant window
is at most 24 hours. Prefer recovery and offline diagnosis to another
provider call. C0 must have a genuine saved Operator-reviewable
proposal before C2 is dispatched. No blind retry after an uncertain
provider outcome or budget/identity discrepancy.

**Cumulative cost before new calls** (historical ledger at `894240b`):
16 requests / eight generations, $0.015506 settled estimated usage
plus $0.008400 uncertain reservation = **$0.023906 accounted**.
New additional grant maximum $0.25; inclusive ceiling $0.273906
if fully used. Six full max-token envelopes at prior standard rates
would reserve at most $0.18 additional ($0.203906 inclusive), subject
to rates and preflight checks. Owner attention not measured; avoid
inventing time/rates. Record actual spend deltas and remaining
authorization in this handoff at material checkpoints. This is
not an invoice verification. Original unsuccessful generation
receipts and source/custody remain immutable.

**Accepted next outcome:** Real model-generated C0 and isolated
fictional C2 proposals safely persist through authenticated
Operator review/edit, with actual business-specific page content,
evidence citations, visitor decisions and unresolved claims available
to the owner in readable form. Private WordPress application and
publication remain separate approval gates. Approval recorded,
**not execution verified**.


#### Consolidated hosted C0/C2 result

**Both proposals are retained for review.** The protected rollout first
installed the authorized recovery build `a842527` and confirmed
authenticated C0 baseline readback with both grants disabled. The
follow-up `5f0e4e3` bound the approved cycle and diagnosed retries to
the intact 16-request ledger. Its [Linux build](https://github.com/R-Levin/myomaton-web/actions/runs/43616880886),
artifact 14121649255, matched inner SHA-256
`72a8588ea6e809c2353d0b3db5852edc8e8591ed0a9c86cf2f138217fc576ba4`.
The [final recovery build](https://github.com/R-Levin/myomaton-web/actions/runs/43617879598)
at `5219ebf`, artifact 14122649391, matched inner SHA-256
`9300777495dd7433cc40915b9372b14f92d2f5bcf02d27e7e0e0be6b4104df6b`.
Each ZIP checksum and all 163 hosted artifact files were verified.
Prior protected builds remain in off-webroot rollback custody.

All three C0 provider responses completed and were captured. The first
exceeded the audience and Home description constraints. The second
exceeded three search-description constraints. The third exceeded only
the Home search description limit, at 162 characters against 160.
The count limit was exhausted. Recovery used the third exact capture,
passed the same validation with one source-grounded editorial correction
to the Home search description, and saved the result at Core draft 28.
The receipt and capture remain exact. The correction is visible in
Operator review, with the retained capture digest and scoped actor.
Automated review blocked printing raw protected copy through SSH. No
protected text was emitted. The correction was validated on the host
and only sanitized scope, length and digest evidence was returned.

Open [Protected Core](https://wp-acceptance.miopages.com/core), sign in
with the existing Operator credential and open **AI site proposal**.
C0 proposes Home, Free Web Presence Review and Short Conversation,
with nine sections. Home points to the Review, and both primary entry
pages propose contact actions whose destinations need confirmation.
The reviewed result cites the approved service direction and entry-path
evidence. The exact outbound answer remains marked unconfirmed and
was not promoted. Proposal digest
`6904fc782422af25c9e7dab2f15a82edb527f3b03527e26047bd1564583f46cc`.
Authenticated readback matched the original interview and synthetic
inquiry and showed the draft awaiting Operator review.

After verified C0 readback, fictional C2 passed on its first generation.
It proposes Home, Services, Storm Damage and Estimate Help, with 12
sections. It distinguishes routine estimates from urgent assessment
and gives visitors an estimate checklist. Hours, response times,
coverage, licensing and insurance remain open. Contact destinations
are unresolved. Assertions about the fictional business are not live
business facts. The normalized C2 proposal is in separate off-webroot
custody and a Git-ignored local review file. Proposal digest
`f5d242b33b126f19f2187bb87c1daa35060cf80a920ceb3af7e6f154a25700d3`.
C2 has no Core customer record or C0 evidence.

**Usage and continuity.** This cycle used four counts and four
generations. Returned input/output tokens were C0 658/1,267, 658/1,176
and 658/1,063, then C2 610/1,089. The usage-priced deltas were
$0.006195, $0.005786, $0.005277 and $0.005358, or **$0.022616** total.
All four settled as estimates. Site-planning cumulative is 14 requests
and seven generations with $0.038418 in estimates including the older
uncertain estimate, or $0.040893 accounted at the full uncertainty
reserve. Inclusive Core totals are 24 requests, 12 generations,
$0.038122 settled and $0.008400 reserved, or **$0.046522 accounted**.
No provider invoice was independently checked. No other incremental
cash cost was recorded. Owner minutes are unknown. Ledger SHA-256
`664b5c1f8cfd82d10ee13de24a4d218288b476089e7e3a4d125a2c25b1e55d53`.
The eight starting receipts matched byte for byte. Both grants are
inactive. No further dispatch is planned under this cycle.

A protected scheduler canary executed successfully. The one-time
capture removal job is queued for 2026-11-15 16:20 UTC, less than 24
hours after the first capture. Actual execution is pending a later
read-only check of the expiry receipt. It only sweeps the C0 and C2
exact-response directories. The normalized proposals and financial
ledger are retained separately. Both public HTTPS body baselines and
WordPress drafts 13 and 14, restored revision 3/high-water 5, matched.
No customer approval, WordPress application or publication occurred.

Next, review the C0 copy and resolve the two contact destinations,
then use the existing Operator editor and exact delivery-preparation
workflow. The private WordPress preview remains a separately governed
step. Independent, versioned proposal storage remains pending.

#### Persistent owner access for protected C0 review

The existing protected Core Operator principal is `f2cd3fe8-58b3-4dfa-9125-fd8f1bd35f8e`.
The production-shaped development role's read-only view confirmed
that all visible scoped credentials are expired. This principal's
temporary token expired November 14, 2026 at 12:15 p.m. Eastern and
its protected copy still exists with mode 0600. HTTPS sign-in with
that token is refused. A separate read-only query under the scoped
role verified C0 draft 28 and the exact saved proposal digest
`6904fc782422af25c9e7dab2f15a82edb527f3b03527e26047bd1564583f46cc`.
This established draft persistence before access was restored.

The local candidate adds a normal username and password form for
`owner` at the existing protected Core URL. The owner chooses and
saves a unique password in their password manager. Core derives a
salted scrypt verifier, and stores only its domain-separated digest
in the existing credential record. The verifier cannot authenticate
via the legacy WordPress/Operator token path. The persistent login
retains the principal and its two exact C0 grants,
`inspect-site-proposal` and `prepare-site-proposal`. No new identity,
auth service, database schema, grant, DNS record or approval authority
is needed. MFA and wider Operator identity management remain separate
product work. The existing rate limit and Secure, HttpOnly,
SameSite=Strict session cookie stay in place. The owner session
lasts eight hours, signs out immediately and rechecks the current
credential and grants on request.

**One approval gate.** Deploy only the verified protected build with
the previous build kept for rollback, then replace this single expired
credential verifier and set its expiry to indefinite until reset or
revoked. Preserve the original protected custody and existing grants.
The same migration-owner transaction supports future password resets
and refuses a revoked identity or changed grants. The owner chooses
the password privately and enters it twice, plus the existing
`miopages_migration` password, at the hidden prompts in the existing
Cloud SSH shell. Confirm the identity and the grant list before commit.
Verify HTTPS sign-in, draft readback and logout without returning
passwords or content. After a reset the previous verifier is refused.
Give the owner the final setup command only after the deployment and
staging have been authorized. No provider calls, customer content,
WordPress changes or publication are in scope.

**Acceptance.** The owner opens [Protected Core](https://wp-acceptance.miopages.com/core),
signs in as `owner` with the saved password and opens **AI site proposal**
to view the existing draft 28. The technical verification and personal
owner readback remain pending. Local tests cover the persistent
credential on the restricted SQL policy, exact principal binding,
normal-token refusal, cross-site refusal, the unchanged review/edit
grants and invalidation after reset.

**Running cost.** Access recovery added zero provider requests or
generations and $0 estimated provider spend. The inclusive Core
checkpoint remains 24 requests, 12 generations and $0.046522 accounted
including $0.008400 reserved. Other incremental project cash cost and
owner minutes have not been measured.

#### Protected owner login verified

The approved build `740e3c1d983aa442d53ee45ecb0f5c8a90755a9d` is
running on the existing protected Core host. Its Linux artifact
passed all 163 file checks and the previous build remains in protected
rollback storage. The owner ran the password setup with hidden prompts.
The launcher returned PASS after HTTPS sign-in as `owner`,
authenticated proposal readback and HTTPS sign-out.

A separate read-only query under the restricted development role
verified the persistent credential on the existing C0 principal, both
original scoped grants and zero other active credentials in that scope.
C0 draft 28 still has proposal digest
`6904fc782422af25c9e7dab2f15a82edb527f3b03527e26047bd1564583f46cc`.
The deployment checks matched the existing usage ledger, both public
HTTPS response bodies and the restored private WordPress revision.
The owner can now open
[Protected Core](https://wp-acceptance.miopages.com/core), sign in with
the password saved in their password manager and open **AI site proposal**.
Personal review of the proposal is pending. The access recovery made
zero model requests.

#### Researched C0 understanding and complete site candidate

**Status.** The owner’s full-outcome direction is recorded in [Issue #12](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6886774731). Review the [Business Understanding and Presence Direction Report](c0-business-understanding-and-presence-direction.md), then the [complete text website candidate](c0-researched-website-candidate.md). These are research-informed editorial drafts prepared by Codex from reconciled C0 material without a new OpenAI API generation. They omit protected reply bodies and submitted values. Draft 28 remains the genuine retained live proposal from the earlier comparison. This cycle made no hosted writes. Neither artifact confirms business facts, approves a site, stages WordPress or publishes anything.

**Projection diagnosis and correction.** The previous dispatch was correctly pinned to the two statements in `site-planning-live-proof-inputs.json` and one exact answer projection. In `hosted-core.ts`, `SitePlanGrant.sources` and approved interview turns were the only inputs to `prepareSitePlanning`. The saved intake answers, approved business brief, distinct Free Review, site observations and other sources were not traversed by that grant. Widening the existing projection implicitly would change both privacy authority and historical digests. The reviewed-corpus shape now enters through the same server-side `prepareSitePlanning` boundary with explicit authority and observation date. The grant binds the internal source reference and curated statement, while the provider projection omits internal references. The previous format still serializes identically. Rich evidence uses the full planning instruction and is refused by the historical compact path. A separate [reviewable corpus](c0-researched-planning-corpus.json) contains 20 curated and sanitized C0 source units available for exact review. Its file SHA-256 is `9399dc157eea8add7940bdc3a2c61105c6039eebf9b147df7843ee2f08f73591`. The ten private local answers remain unconfirmed and the protected record stays out of the outbound packet. Startup audience evidence and the existing-site hypothesis retain separate authority. The fictional C2 fixture supplies no data to this case.

**What fits Core today.** All public copy in the seven proposed Pages was tested through the existing PresencePlan parser with Page and Section citation arrays, route validation and one governing Action per Page. The text draft also describes secondary links, distinct inquiry reasons, form behavior, SEO titles and visual intent. These remain in the review document because the current planning schema does not carry every piece of that metadata or a distinct versioned, customer-correctable business report. Next, use the existing scoped review, durable response custody and proposal workflow for an independent versioned understanding report and incremental site generation, with the report approval separate from a site approval. Reuse the same report contract after enough evidence is available on either Review-led or Direct Start. Operator can resolve citations from the authorized source inventory and propose changes without granting customer confirmation or publication. The protected UI continues to show draft 28. The reports in this Git handoff have browser-readable, independent review paths, and the new report’s feedback is still on the document rather than persisted through Core.

**Proposed next live cycle for owner authorization.** C0 only, use the pinned curated corpus linked here, its versioned prompt set and outputs from the same authorized run. Send no raw interview, protected answers, account records, private URLs, credentials, C2 data or raw competitor copy. Reuse `gpt-5.4-mini-2026-03-17`, Responses with `store:false`, and existing protected response custody. Run first understanding and unresolved-claim synthesis, then plan the page graph and Actions. Draft coherent page groups in separate continuations, each bound to the accepted prior work and citeable sources. Finish with an editorial pass for fact scope, duplication, originality, accessibility, internal destinations and service coverage. Store exact provider outputs before validating meaning. Resume or retry only unsettled work under the ledger. No WordPress actions, no customer confirmation. The fixture permits more pages when the evidence justifies them.

Propose an **additional $0.70 hard cap** and **up to nine generations / 18 requests** including two optional diagnosable retries, with at most 24,000 counted input and 12,000 output tokens per generation, no automatic retries or external tools, and 24 hours from a verified activation. At standard rates of $0.75 / $4.50 per million uncached input/output tokens, and the previously verified free token count, the maximum request envelope is $0.072 and nine such envelopes total $0.648. Budget and attempts are ceilings for this run, independent of site size. Preserve the existing reservation and record pricing, source digest, exact prompt/operation manifest, ledger and measured tokens before activation. The signed-off compact grant is exhausted. The current dispatcher’s 4,000 input / 1,200 full output limit and existing ledger ceilings cannot support this plan. A tested, separately scoped multi-pass envelope and existing reservation recognition are rollout prerequisites. A budget/data decision here does not authorize hosted changes. [OpenAI model and standard rates](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

**Verification.** All 423 application tests passed. The added coverage checks reviewed-source scope, reference redaction, expiry, exact legacy serialization, fake metered transport and all seven Pages in the actual text candidate. TypeScript, focused ESLint and whitespace checks passed. The fake transport neither verified the live account nor incurred provider usage.

**Parallel direction.** The November 15 owner decisions put native Articles, website optimization and first-party remeasurement at the center of the next Ongoing increment. Preparing optional manual social copy for the customer or authorized partner is supporting work. The [canonical content growth contract](content-growth-loop.md#distribution-and-deterministic-links) records this direction and the remaining permission decisions.

**Running cost.** This cycle added zero provider requests, generations or metered provider spend. Carry forward the prior inclusive Core checkpoint of 24 requests, 12 generations and $0.046522 accounted, including $0.008400 reserved. The proposed additional $0.70 would make the authorization ceiling $0.746522 inclusive. Other cash costs and owner time were not measured.

#### Core intake-to-site workflow with durable local review

The [current execution assignment](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6897105246) governs this work. The earlier Codex-written business report, curated 20-source examples and seven-page site remain quality benchmarks. The new runtime uses its own case evidence and workflow. Neither benchmark text nor its completed conclusions are provided to the model adapter.

**Owner review.** From this branch, run `node --import tsx scripts/intake/c0-onboarding.ts --workflow` and open [the local Core review](http://127.0.0.1:4338/onboarding). Enter the local access code printed in your terminal. Choose **Resume retained onboarding**, then **Start the local workflow**. Gather research and prepare the report. Use **Correct what the next visitor should do** to enter an example such as “Ask which booking or form path must survive an existing-site handoff.” Save, reload, and prepare the report again. The distinct offering finding still appears. Confirm this report in the rehearsal, then follow Core through Presence Direction, sitemap, each actual planned page, and editorial review. Open **Project conversation** to see the corrected visitor action in the page copy. Record a simulated Operator review and reload to read it again. The **Performance Snapshot** opens in the same review. The command starts an independent disposable database and stops it on Ctrl+C. It does not restart or update the earlier local or hosted rehearsals. An optional exact path to the already verified `verified-evidence.json` can follow `--workflow` to read the ten unconfirmed preserved responses into the isolated copy. The default uses the existing locally prepared C0 sources and labels missing retained Review evidence.

**Group A.** Core computes the next task and persists the intake-bound case in PostgreSQL with optimistic version checks and an exact context digest. An in-progress or unknown outcome cannot silently start a fresh dispatch. Operation results are stored separately from the intake record, hashed before validation, and can be replayed by a new worker when the captured result is usable. A correction is scoped to a finding and its report digest. Core retains previous revisions, withdraws downstream work from review, requests a fresh report and waits for distinct confirmation. The candidate carries a variable page set, navigation, multiple Actions, allowed or unresolved destinations, section citations and visual intent, SEO metadata, internal links, planned Articles and editorial concerns. Its exact Operator review is recorded separately from report confirmation. Neither confers publication authority. In this checkpoint the Customer and Operator actors and external results are simulated; case ownership, persistence, scheduler decisions, custody, review gates and versioning are real. The HTTP proof covers the existing Direct Start UI and the same case service resumed with a Free Review-bound record. The complete Review-to-paid transition and authenticated customer controls are pending.

**Real operations prepared offline.** The configurable research adapter retrieves and extracts dated observations from only exact public HTTPS pages, without following redirects or passing business data to those sites. It retains the extracted observations and the fetched-body digest. Model passes reuse the existing Responses metering and ledger, a pinned baseline and exact run/evidence scope, structured output, custody before semantic validation, and recovery against the recorded usage receipt. The structured Operations path can synthesize, plan, draft by Page and audit a candidate through real Responses transport once composed and approved. No provider, research account, protected deployment, WordPress, or external website changes were made. This local browser uses deterministic examples, and the provider-path tests substitute network responses in memory. C0 draft 28 and earlier delivery proofs remain separate.

**Remaining for real acceptance.** Map each authentic source and public research input to the exact outbound manifest, approve every sensitive excerpt, verify account/model access and the protected ledger, and compose hosted DB privileges, retention, egress and a bounded worker using the existing trust boundary. The browser needs the authorized correction/confirmation roles, editing or redrafting after editorial concerns, Review-led entry, and an exact export to existing WordPress delivery. The candidate and evidence need a production retention decision, with repeated snapshot growth measured before enrolling multiple customers. Formal quality assessment requires genuine report/site outputs and the owner’s review of the real text and path choices. No live-generation grant is active. The earlier $0.70 proposal is unapproved. For the next approval, a working estimate is up to $1.00 additional for one C0 run, up to twelve generations and 24 total count/generation requests, including two bounded deliberate retry opportunities. At 24,000 input and 12,000 output tokens per generation at previously verified standard rates, the envelope is $0.072 and twelve envelopes total $0.864. This is a proposed test envelope, not a page, question or report limit. Any authorization should pin the exact source/operation manifest, model `gpt-5.4-mini-2026-03-17`, approved public destinations, protected storage destination, 24-hour activation, and prior ledger reservation. No automatic retries. The protected live composition and explicit retry adjudication are prerequisites, so this checkpoint does not ask the owner to enable it now. [Official model rates](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

**Group B.** The same tenant-scoped local journey uses durable first-party event ingestion and readback. It stores whitelisted page/Action and coarse source fields for one pinned revision, suppresses exact duplicate receipts, and rejects changed duplicates or unregistered Actions. A covered empty period can show zero. Partial or missing coverage remains unknown. The fixture reports one page observation, one Action selection and zero accepted Contacts with the caveat that those counts do not measure abandonment. Notification, qualification and business outcomes are unknown. No public collector, bot/internal exclusion, consent or installation-bound ingress is active. The next local step is to feed only durable accepted Contact events and reviewed release annotations into this store, with authenticated WordPress sources and agreed coverage start. Public launch coordination owns the launch scope and measurement-start verification.

**Group C.** Read-only spot check from the existing Core account showed 1 visible CPU, 1,707 MiB reported RAM with 746 MiB available, roughly 39.4 GiB available disk, and a listening development port. The scoped TLS PostgreSQL read reported 14,857,907 bytes for the database and one visible client session including the probe, with server `max_connections=60`. That is one sample and says nothing about peak load, pool capacity, queue lag, live Core traffic or provider plan. The [hosting and external WordPress review](wordpress-delivery-feasibility.md#host-and-connector-readiness-checkpoint) records deployment decisions and the smallest nonproduction comparison.

**Verification.** 424 application tests and three disposable PostgreSQL integration tests passed. TypeScript, focused ESLint and whitespace checks passed. The integration run verified the served browser bundle and used its authenticated HTTP operations, including simultaneous attempts, resume and correction against the ten checksummed unconfirmed C0 responses in a disposable copy. It proved the earlier protected local rehearsal still resumes. The provider-shaped proof rechecked the grant, refused changed evidence and an exhausted request budget, and replayed captured output with its receipt. A full interactive owner walkthrough remains pending. Remote main was one commit ahead of the starting development branch on the opposing side of the divergence. No merge or concurrent Issue #10 edit was made.

**RECOVERY / RESUME HERE.** Read [Issue #12’s execution assignment](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6897105246) and the latest checkpoint comment. In the active branch run `node --import tsx --test tests/integration/presence-workflow.test.ts tests/presence-workflow-provider.test.tsx`. Then bind the exact source and grant manifest to the protected worker and preview through the same journey. First run the composition offline with actual authorized-source structures and a realistic variable candidate, and verify restart, lease adjudication, editorial redrafting, custody replay and old-draft isolation. Only after that prepare the one explicit model/data/rollout request. Preserve the current hosted build, draft 28, the retained private WordPress revision and the separate public launch. No hosted rollback was needed.

**Running cost.** Zero external research or API requests from Core, zero generations and $0 incremental model spend. Current protected ledger readback returned 24 requests, 12 generations, $0.038122 estimated settled plus one $0.008400 uncertain reservation, $0.046522 accounted. These are Core figures, separate from a provider invoice. Other cash and owner time unmeasured.

#### Local Core access cookie recovery

After a valid local access-code POST, the browser reads the current draft. Earlier local rehearsals set a draft cookie for `127.0.0.1` and `/api/onboarding`. Browsers can send it to port 4338 because cookie scope ignores ports. The disposable workflow could not find the earlier draft and returned `404 session_unavailable`; the interface displayed its generic failure. The HTTP integration reproduced that sequence with a valid access response and an earlier draft cookie.

Workflow access and resume now use separate cookie names. An authenticated GET with a stale workflow draft token expires only that workflow resume cookie and offers the fresh start screen. Earlier rehearsals retain their cookie contracts. The regression covers an old intake cookie present during unlock, rejection of the old access cookie name, expiry of a stale workflow cookie, and normal save and resume. Existing local launchers keep their loaded code for the life of the process. A private browser window with a fresh cookie jar is the immediate workaround for an already-running pre-fix listener. For a new corrected launch, use the existing procedure above. No hosted changes or provider usage.

**RECOVERY / RESUME HERE.** Re-run `node --import tsx --test tests/integration/presence-workflow.test.ts tests/integration/adaptive-onboarding.test.ts` for an access report. After confirming owner access, continue the protected worker and exact C0 source preparation from the [main workflow checkpoint](#core-intake-to-site-workflow-with-durable-local-review).

#### Protected C0 generation worker and exact activation plan

This continuation follows [Issue #12’s execution review](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6897680289). The starting branch contained the access fix at `8314b6e`, a descendant of `0df0881`. The simulated browser walkthrough is engineering evidence. Owner review resumes with genuine Core output after authorization.

**C0 evidence.** The protected intake inventory confirmed separate retained discovery and site observations, four Free Review answers, eight approved-but-undelivered Free Review sections, and ten unconfirmed rehearsal answers. The local activation proof used the previously checksummed copy. The source projection combines those records with exact sections from the prior business brief, discovery recovery audit and current product contract. The November startup correction remains authoritative. It excludes the older editorial report/site, private account references in provider payloads, C2, and five unrelated workflow/routing fields. The [proposed manifest](c0-protected-workflow-authorization.json) identifies 20 candidate records by content/provenance digest and bytes. All selected source digests must independently match on the existing protected intake before grant activation. The genuine three-pass discovery and retained evidence stand in for the unfinished full adaptive interview. They do not turn any unconfirmed response into business truth.

**Execution path.** The existing protected Operator opt-in can start a separate review case, mark an exact report as reviewed for development continuation, request a redraft of flagged pages and record a distinct final Operator review. It has no provider dispatch capability. The background worker owns discovery, budgeted Responses stages, durable claims and raw response custody. First the worker fetches exact approved public entry pages, then scores relevant links under the approved same-origin path boundaries. Global IPv4 validation, pinned TLS connections, explicit no redirects and bounded payloads precede dated evidence and link-provenance custody. It uses no search API or user-supplied research URL. A denied or incomplete fetch stops the run for diagnosis. Verified response recovery stays distinct from re-dispatch. An evidenced invalid output can be retried only through an Operator action within the new grant. Editorial concerns hold final review. Redrafting reuses the original targeted page and exact audit, keeps unrelated pages and then reruns the editorial pass. A newly typed correction is retained as a proposed correction and requires a matching future evidence authorization before transmission. Provider requests are built from the approved sources and same-run artifacts; the Operator review does not approve customer facts, release WordPress or publish anything.

**Verification.** The protected composition ran with a restricted PostgreSQL role and the existing owner-scoped control shape, using recorded HTTPS and Responses test doubles. It retained a 12-finding report and five generated-schema pages with 30 sections, metadata, Actions, section provenance and an Article plan. It rejected and retained an invalid citation, verified its usage receipt before a deliberate retry, restored the case with a new worker, discovered a linked source within the grant, and redrafted only the flagged page. The role could not write another intake or delete captured outputs. This verifies the machinery and production data shape. The test text is explicitly test material and makes no claim about live model or research quality. The optimized Windows Webpack build passed with offline font data and disposable PostgreSQL after the first build encountered the existing intake route’s missing database configuration. It is not the Linux deployment artifact. The application suite, PostgreSQL case and Contact integrations, focused TypeScript and ESLint checks, and existing WordPress PHP suite passed. The PHP filesystem test still requires a Linux CLI run to verify POSIX modes.

**Group B and C.** Local measurement can reconcile eligible accepted Contact receipts by exact site, page, definition and measurement window. It persists acceptance once with no contact body, routing or delivery claim. The existing WordPress diagnostic now distinguishes missing runtime support, unknown CLI capability, and configured prerequisites that still need outbound TLS/private-storage verification. An isolated off-host handshake is a separate approval. Neither public collector nor off-host WordPress is activated. [Measurement](measurement-and-analytics.md#minimal-first-party-core) · [WordPress host checkpoint](wordpress-delivery-feasibility.md#host-and-connector-readiness-checkpoint)

**Historical proposed owner authorization, superseded by Issue #12 / 6900216299.** The unapproved [prior exact launch manifest](c0-protected-workflow-authorization.json), SHA-256 `f7cf560dfdb8f16e809dc0ba535c5d86520a28654953c28b14c84558bab00545`. It proposed staging the identified public-Git reference files and a verified Linux build on the existing protected Core account, the exact one-draft append-only SQL policy in existing Supabase, and a 24-hour C0-only research and OpenAI run upon passing the protected checks. Up to **11 public HTTPS page reads**, **12 generations and 24 total Responses count/generation requests**, **two deliberate retries** within that total and **$1.00 additional**. The maximum per-generation envelope is $0.078 at the pinned model’s standard rates. The previous balance of $0.046522 includes an $0.008400 uncertain reservation, for a proposed inclusive ceiling of $1.046522. Use Responses with `store:false`, the pinned model and existing development project. Retain new research and raw responses in the protected workflow schema for a 30-day review window, then explicitly decide how to handle this run’s retention. Obtain protected source and usage readback, verified Linux build/rollback, exact restricted-role and policy checks, and existing project/data-controls verification before enabling the worker. Preserve draft 28, prior receipts, current public sites and the WordPress revision. [Official model and rates](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

**Historical activation notes, superseded.** Use the latest recovery instructions below. To reproduce locally run `node --import tsx --test tests/integration/protected-presence-workflow.test.ts tests/integration/presence-workflow.test.ts tests/presence-workflow-provider.test.tsx`. To activate after approval, stage only the three tracked reference files named by `c0-workflow-knowledge.ts` at mode 0600 under the existing off-webroot `presence-workflow-evidence` directory (0700), the exact manifest at mode 0600, and the independently checked Linux artifact. Use `node --import tsx scripts/intake/protected-presence-worker.ts INSPECT-WORKFLOW-MANIFEST` with the existing protected Core connection to compare source digests. Derive the exact intake inside that protected boundary. The migration owner applies only `presence-workflow.sql` and `protected-presence-workflow-policy.sql` in one transaction that first creates `miopages_core_workflow`, then uses `SET LOCAL search_path=miopages_core_workflow,public` and the exact transaction-local `miopages.workflow_intake` setting. Verify the single binding, row isolation, and append-only permissions. After Linux rollback and usage gates, run the same worker CLI with `ACTIVATE-EXACT-WORKFLOW-GRANT` and the manifest SHA. Enable only the existing protected development review and run `WATCH-AUTHORIZED-WORKFLOW` from its separate process. Stop on changed sources, an uncertain new outcome, permissions drift or ambiguous usage. The prior grant remains untouched and the new grant file uses exclusive creation. No current deployment or rollback was performed.

**GitHub-only recovery check.** Fetched the full owner-critical index at main `059ebaf` and recovered the operating split from its linked decisions. Core owns the customer lifecycle; the model and tools generate substantive evidence and artifacts; ChatGPT/Work reviews product quality; Codex builds and verifies Core; the owner approves material decisions, spending, deployment and publication. Entry is Free Review or Direct Start, followed by shared intake, knowledge, report, governed site and later Article-led Ongoing grounded in first-party measurement. Public launch is separate and the initial AI review requires actual Core/API output. GitHub retained those decisions and the execution branch. The full historical transcript and private chat permalinks remain absent. This was a fresh source-retrieval check in the current session. It did not create a new chat or merge main.

**Cost and custody.** Zero external research or model calls, zero generations and $0 of new provider use. The protected ledger readback confirmed 24 requests, 12 generations and $0.046522 accounted. Automated approval review rejected an attempted transfer of base64-encoded C0 reference excerpts for the hosted comparison because that egress lacked an approved exact scope and destination. The attempt was abandoned without transfer. The local checksummed manifest is complete. The actual hosted consented comparison is a pre-dispatch gate in the single request above. No customer or Operator testing of the offline fixture is requested. Other cash and owner time unmeasured.

### Market discovery and governed draft media (2026-11-15)

**Direction and authority.** [Issue #12 / 6900216299](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6900216299) authorizes the local engineering increment. Core operates the research, report, Presence Direction, variable site planning and editorial review. A single future approval covers external use and protected private staging. The previous $1/24-hour manifest is superseded. The worker refuses its exact digest. Prior evidence and grants remain in custody.

**Core research and recovery.** A market search takes only an exact public query from the grant. It uses the existing pinned Responses model with `store:false` and a bounded tool-call envelope. Core attributes usage and retains the response before using the source list. It fetches eligible HTTPS results, pins global IPv4 and TLS, prohibits redirects and private network destinations, and requires useful coverage across new origins. Each observation has a URL, date, identifier and body digest. An explicit worker operation can recover a retained response after a failed public-source read while the grant remains active, without another model dispatch. Text drafting sends only the separately reviewed evidence projection and same-run artifacts. [OpenAI Web Search contract](https://developers.openai.com/api/docs/guides/tools-web-search) · [OpenAI pricing](https://developers.openai.com/api/docs/pricing)

**Placement and media.** The local composition selects a Section with a visual need from the exact reviewed candidate, calls the existing OpenAI image adapter with a test transport and retains an immutable raster master in private storage. The provisional result binds candidate, Section and prompt digests, source and provider provenance, dimensions and alt intent. An image dispatch reserves its full envelope in the same locked ledger as search and text. Offline fixture permission permits preparation of an optimized WebP. Native draft envelope v3 signs the Asset and AssetUsage identifiers, reviewed placement, master and copy digests, dimensions and reviewed alt. The writer checks off-webroot copy permissions and bytes, uses a native private attachment and emits a Gutenberg image link for an authorized session on the currently materialized draft. The signed receipt verifies the mapping. Core compares restored attachment and Page readback against the previous verified receipt. Earlier text-only envelope, receipt and release contracts remain supported.

**Verification.** The restricted disposable PostgreSQL proof used locally retained C0 evidence and provider-shaped test responses. It saved a 12-finding report, five pages and 30 Sections, then redrafted the flagged Page. It retained an invalid citation response and recovered from a failed public read without buying another search. The cross-runtime test bound an actual raster to a two-Page subset and verified its private master, WebP copy, Node signature, PHP projection, exact placement and authenticated receipt. Changed bytes, forged placement, duplicate and over-budget image dispatch, and foreign-intake media selection were refused. Windows exercised the text-only WordPress apply/restore harness and cross-runtime media contract. POSIX permissions and the new attachment apply/restore still require Linux verification. Application suite 424 passed. Five focused workflow/receipt tests passed. The disposable Contact and Intro media suites passed all 12 cases after the fixture launch was corrected to supply a seeded loopback database. TypeScript, focused ESLint, consolidated PHP (11 lints, nine smoke suites and one signing compatibility test) and optimized Windows Webpack with offline font data passed.

**Measurement and host.** First-party snapshots retain the collector ID and exact revision alongside the coverage window and any recommendation. No new production collector or outcome coverage. A read-only SSH check found WordPress 7.1.4, Delivery 0.0.10 active, and the private directory at mode 0700 on `miopages.org`. The existing explicit PHP 8.4.27 CLI has Sodium, POSIX identity checks and WebP type support and runs WP-CLI 2.5.0. The default 8.0.30 CLI lacks Sodium. The web PHP process and actual authenticated media preview still need verification with a dedicated media directory.

**RECOVERY / RESUME HERE.** Read Issue #12 and this branch checkpoint. Reproduce the workflow and signed media boundaries with `node --import tsx --test tests/integration/protected-presence-workflow.test.ts tests/integration/presence-workflow.test.ts tests/presence-workflow-provider.test.tsx tests/integration/wordpress-native-draft-receipt.test.ts` and `php scripts/test-wordpress-delivery.php`. Next wire the visual selection and metered image acquisition into durable protected Operator review and established Asset/AssetUsage evidence; current protected approval still refuses hosted proposal media. Finish exact signed full-site staging for an expanded Page set, including stable prior IDs and reversible membership, and run the Linux build and attachment rollback gate. Only then pin one executable manifest to the exact C0 source and ledger, allowed research and image inputs, aggregate cap, expiry, protected install/retention and private WordPress rollback. No external-use request is ready at this checkpoint.

**Cost and custody.** Since this November 15 increment, zero external AI/research/image dispatch and $0 new provider spend. Previous protected ledger remains 24 requests, 12 generations, $0.038122 priced usage plus $0.008400 uncertain reserve, $0.046522 accounted. Other new cash $0. Owner minutes unmeasured. No protected C0 transfer, hosted write, WordPress update or publication. Automated verification establishes behavior, with product quality reserved for the authorized real run.

### Protected visual review and flexible WordPress drafts (2026-11-15)

[Approved local closeout](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6901091240). Core now records Operator-selected visual placements, request attribution, private masters and review decisions in the existing protected, append-only case. Its worker rechecks the current grant and uses the shared ledger. Recovery reads the retained result and exact receipt. Approval binds each visual to the reviewed Section text, alt text, image bytes and stable Asset/AssetUsage references. The private proposal carries those records as private placements. It does not create active canonical Assets or grant publication. The protected review supports several justified placements on a Page. Rejection or withdrawal prevents new private projection. Existing supplied-media and historical Page approvals retain their contracts.

The protected operator can prepare complete Page proposals from the reviewed workflow and stage a signed bundle only after the normal independent Page and site approvals. The signed membership envelope binds the prior Page set and revision. It preserves existing IDs and slugs, supports additions and retirement from active navigation, retains retired drafts for history and verifies rollback against prior receipts. The WordPress CLI accepts each exact signed WebP copy into an installation-specific mode-0700 directory. Private native attachment metadata points to the verified file. The plugin serves only a current draft image to an authorized session. Actual media is placed as local, portable WebP bytes. A conversion to ordinary public uploads still needs a separate release decision. Delivery 0.0.12 is the local candidate; active hosted Delivery remained 0.0.10 at the prior read-only checkpoint.

**Verification.** The isolated PostgreSQL proof used the retained C0 shape and offline provider adapters. It verified two completed placement approvals, saved/reopened the same decisions and bytes, refused changed copy, another intake, duplicate placement and withdrawn eligibility, and prepared the entire five-Page plan. The 424 application tests, TypeScript, focused lint, earlier preview digest and Node/PHP receipt checks passed. The Windows WordPress suite passed the previous compatibility checks and the signed membership and multiple-placement assertions. The existing Linux checks execute the POSIX private-file, attachment readback and rollback portions. Only their recorded run results establish Linux verification.

**RECOVERY / RESUME HERE.** Recheck active Git state and latest Issue #12. Use the existing PHP consolidated gate and the protected workflow and native receipt integrations. Review the exact Linux runtime and adapter results before the approval gate. The v2 worker activation compiler requires a new manifest binding the exact protected C0 intake and ledger, approved public search and illustration briefs, provider ceiling, deployment artifact, installation and expiry. Compare it with the actual protected baseline and confirm ready directory, role, signer, adapter backup and rollback prerequisites through the existing host procedures. Any genuine run requires the owner-approved manifest and exact case connection. Preserve the previous grant history, public runtime and WordPress staging evidence.

**Cost.** No external model, image or research calls, no protected transfers or hosted mutations in this local increment. Prior ledger accounting remains 24 requests, 12 generations and $0.046522 accounted, including the $0.008400 uncertain reservation. New provider spend $0. Owner time unmeasured.

**Linux and read-only hosted baseline.** The standard [WordPress adapter run](https://github.com/R-Levin/myomaton-web/actions/runs/43763420951) at `8d0dcd8` passed the POSIX private-copy transfer, shared-file two-placement readback, changed Page membership, archive handling and rollback with stable IDs. The [protected Linux build](https://github.com/R-Levin/myomaton-web/actions/runs/43763420986) passed its isolated runtime smoke. The existing protected Core account held the verified draft and ledger at mode 0600. The read-only Core-role probe confirmed draft 28, the exact disclosure projection and 20 source hashes. The ledger SHA and one prior uncertain receipt matched. A separate WordPress read verified Home 13 and Service 14 against their retained content, materialized revision 3 and high-water revision 5.

The existing hosted artifact lacked the worker and Operator commands. The build now bundles those exact commands with runtime dependencies external, stages only the tracked public source references and the reviewed workflow SQL, and tests that the relocated commands refuse when unconfigured. The standard Linux workflow emits the Core archive and a separately checksummed Delivery 0.0.12 ZIP without the adapter test fixtures. No change to the actual hosts was made by either build. Use the final packaged artifact and verified manifest for any future approved execution.

The first [worker packaging run](https://github.com/R-Levin/myomaton-web/actions/runs/43764425096) built Core, then failed before artifact upload because the standalone Operator bundle used an ESM import for Next's `next/image` subpath. Both packaged commands now use CommonJS with existing production dependencies. A local relocation proof ran each binary with an empty configuration and confirmed the expected refusal. The restore-only signing command verifies the original independent authorization, enrolled key and HMAC receipts, then reissues that exact restoration from the retained apply envelope. It permits rollback even after an Operator withdraws a visual from future use. The focused receipt test refused missing apply proof, an unrelated authorizer, the reviewer substituting for the authorizer, and an unrelated signer.

### Exact hosted C0 run awaiting owner authorization (2026-11-15)

The local closeout is ready for one bounded hosted run. The final Linux build and adapter checks passed at `eb2518f61bd4dfa0ba5cd460057a4e713a5c24f6`. The download was verified independently against the run. Core archive SHA-256 is `f5f4decfbff35cb16bdb6e217bb31cab05d831a9b83f63b8652dafcf8e981ea3`, and Delivery 0.0.12 ZIP SHA-256 is `38668108f522d24da4fbf1b52a96b818539a645116cda135725ba453bd4d3862`. The Linux build covered dependency audit, retained preview compatibility, request metering, recovery, routing and startup refusal from both standalone protected commands. The Linux PHP harness exercised actual private WebP bytes, native attachment readback, additions and retirements, stable Page IDs and exact rollback against disposable data. [Linux build and package](https://github.com/R-Levin/myomaton-web/actions/runs/43764920839) · [Linux delivery checks](https://github.com/R-Levin/myomaton-web/actions/runs/43764920828)

**Requested authority.** Approve the complete [pinned hosted manifest](c0-hosted-presence-run.json), SHA-256 `3bf0209a1bdabfc80e2b6f783b5365039c08bbeebb000db7d6de1c5eab7d9bc4`. It covers one C0 development run ending November 22, 2026 at 21:00 UTC. The active protected account and installed WordPress site remain the ones previously used. Core may send the exact 20 sources from retained C0 draft 28 and same-run outputs to Responses. Retain source status and unresolved issues. No new customer correction is authorized for transmission. Web Search receives the fixed, generic public query only, with up to four tool calls and twelve new eligible origins. Each retained source has an independently fetched HTTPS observation. The image endpoint receives only the matching pinned public-safe brief and fixed illustration instruction, selected by the Operator for a justified Section. Its result remains provisional until an Operator reviews the exact image, rights, placement and alt text for private use.

Authorize the existing development project and pinned models under up to **$20.00 additional** in combined model, search and image reservations, up to 80 new provider requests and 40 new generations, `store:false` for Responses, zero automatic retries, up to two explicit retries of a retained, invalid provider result after validation and metering checks, and three editorial revisions. The unchanged prior ledger carries $0.038122 priced usage and $0.008400 uncertain reserve, making the maximum accounted total $20.046522. Count, generation, and tool/visual reservations share one ledger. Recheck pricing, access, privacy controls, remaining headroom and exact custody before enabling dispatch. In the run, retain actual usage separately from unresolved provider charges. [Pinned text model](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [Provider pricing](https://developers.openai.com/api/docs/pricing)

1. On the protected Core account, verify disk, memory, account-local listener and existing public-service baselines. Retain matched application and configuration rollback. Recheck the installed restricted role, exact intake `91733e9a-70d5-4799-92c7-d045422f0e5b`, 20-source projection, unchanged ledger and permanent owner login. Prepare only the artifact's reviewed reference files, workflow grant, evidence, media and bundle directories under the existing protected root. Check real paths, ownership and modes 0700 for directories and 0600 for sensitive files. Stage the exact build for the existing protected listener.
2. Apply only the two checksummed workflow SQL files from that artifact through the existing migration procedure. Create `miopages_core_workflow` and set `SET LOCAL search_path TO miopages_core_workflow, public` and the exact `miopages.workflow_intake` in the guarded transaction before running the DDL and policy. Verify the migration owner, protected role, exact allowlist, forced row security, denied foreign-case access and append-only grants. Retain previous database and application evidence. Fail if an existing schema conflicts. Use the established hidden prompt if the existing migration password is required.
3. From the deployed protected build use `node .rehearsal/private-listener.cjs --workflow INSPECT-WORKFLOW-MANIFEST` to compare source evidence. Save the manifest bytes as `c0-hosted-presence-run.json` in the existing protected root. Use `ACTIVATE-EXACT-WORKFLOW-GRANT <manifest-sha256>` on the same launcher, with no model key in that operation. Start the verified protected build with the grant present and confirm existing authenticated Core evidence and new case review. Use `WATCH-AUTHORIZED-WORKFLOW` during the attended run only after those checks. The authenticated Operator may continue from the report under the development grant while preserving every fact's source status and any unresolved claims. Retain research, report, site plan, Page drafts and editable review, prior failure evidence, authorized editorial changes and visual decisions. Use `RECOVER-RETAINED-WORKFLOW-RESEARCH` or existing retained-response recovery first when applicable. An uncertain charge remains reserved. Stop on unverified authorization, source drift, ambiguous spend, integrity or host capacity.
4. Use the existing independently scoped Core Operator roles and signer. Confirm exact Page previews and approval records for the generated candidate, then independent site-level draft authorization for the resulting Page set, navigation, Actions, visual bindings and installation. Those exact decisions occur after the candidate exists. This run grants neither customer acceptance nor publication. Verify the enrolled credential, historical journal and present materialized WordPress state. Retain the complete Delivery 0.0.10 rollback package and prior configuration. Install only the checksummed 0.0.12 ZIP on the existing protected WordPress installation and verify PHP 8.4 CLI and actual web PHP custody for `MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY`. Authorize any temporary grants through the existing enrollment procedure, preserving unrelated credentials and permissions.
5. Transfer only the exact signed draft bundle and optimized WebP copies to that installation. Use the established SSH channel and `miopages native-draft-media` on stdin. Apply signed revision 6 if high-water 5 and materialized revision 3 still match the manifest. Keep retained Page IDs and slugs stable. Verify the real protected WordPress pages, navigation, Actions, bytes, native attachment metadata, independent Core application-receipt reconciliation, refusal without authorized access, and exact retry. Verify actual image rendering and editorial usefulness at the protected browser path. Retain the exact apply envelope, reconciled receipt, materialized revision 3 baseline and original independent authorization in private custody. Verify that the original authorizer, independent reviewer and enrolled signer will be available through the agreed review window. The restore envelope is issued fresh just before use because its signature expires after 15 minutes. Stop on a recovery mismatch.
6. Give the owner the authenticated Core report and private WordPress preview links. Keep the complete candidate staged under the existing access protection until the owner confirms review is complete or an agreed review window has elapsed. The model dispatch expiry ends provider activity and does not trigger a restore. Keep receipts, approved drafts, provisional WebP files and private attachments intact during review. If a confirmed access or integrity failure requires immediate containment, preserve the evidence and notify the owner.
7. After the review opportunity, issue a fresh restore with `issue-retained-site-draft-restore`, verify materialized revision 3 and reconcile its receipt with high-water 6 retained. Restore the previous plugin and configuration, and recheck the known WordPress and public Core baselines. Preserve the protected report, site, images and receipts for Operator review for up to 30 days. Review disposition before extending retention. Keep rollback evidence and prior canonical history. Report actual paid use, editorial and visual gaps and the final hosted state without revealing protected records or credentials.

**Known limits before real execution.** The verified package has run in Linux isolation. The authorized-host policy install, actual provider response quality, live PHP media access and new WordPress apply/restore remain to be verified. WordPress stores private local file copies and native attachment records. Ordinary public Media Library delivery, final rights and customer exit remain governed by later release decisions. No new measurement collection was exercised here. No additional provider spend, protected transfer or hosted write occurred.

**RECOVERY / RESUME HERE.** Confirm latest Issue #12 and the exact owner's authorization for the manifest above. Recheck expiry, Git branch, Linux artifacts, retained Core evidence and WordPress baseline. Follow the ordered run. Open [protected Core](https://wp-acceptance.miopages.com/core) with the existing owner login. Record the actual generated results and the authenticated WordPress review path only after verification. Keep the private candidate available for the agreed owner review, then restore from the retained independent receipt. If the scope expires or a material source, artifact, cost or rollback pin changes, retain evidence for a revised exact decision.

#### Hosted read-only preflight and owner review hold (2026-11-15)

The remote branch and the committed manifest were independently verified. The unchanged manifest SHA-256 is `3bf0209a1bdabfc80e2b6f783b5365039c08bbeebb000db7d6de1c5eab7d9bc4`. The [verified Linux artifact](https://github.com/R-Levin/myomaton-web/actions/runs/43764920839) remains available. Both HTTPS certificates validated. Protected Core HTTPS returned 200 for its sign-in shell and 403 for the unauthenticated protected API. Core still runs `740e3c1`. The restricted PostgreSQL session verified TLS, read-only operation, draft 28, an active scoped preparation grant, and the unchanged 12-attempt ledger. The new workflow schema and active run grant are absent. The existing API key is configured. Available memory was approximately 746 MiB and free filesystem space was approximately 39 GiB during the probe. Recheck both at rollout.

From that same Core host, each of the six exact public research URLs passed verified HTTPS using global IPv4, no redirects, identity-encoded HTML and the configured byte limit. Those probes used no customer data, cookies or provider endpoints. Public OpenAI documentation confirms the pinned text and search prices. The existing credential's provider-side access and project data controls remain unexercised for this run. `store:false` controls Responses application state. Standard provider abuse-monitoring retention may still apply, so disclose the exact pinned C0 projection only under the owner grant and verified project controls. [Text pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [Search pricing](https://developers.openai.com/api/docs/pricing) · [Provider data controls](https://developers.openai.com/api/docs/guides/your-data)

WordPress HTTPS returned 401 for the site and both current draft links without credentials. The read-only database session confirmed stable Home 13 and Service 14 draft IDs, slugs and content hashes, displayed revision 3 and signed high-water 5. WordPress 7.1.4 still has Delivery 0.0.10 active. All 14 installed plugin files match the protected rollback ZIP. Both retained receipt file digests match the previous successful apply and restore. PHP CLI 8.4.27 supports Sodium, POSIX and WebP, and the existing native CLI config is off-webroot at mode 0600. The live web PHP media read and browser navigation must be verified during the authorized staging run.

**Owner approval received.** The owner approved the exact manifest SHA-256 `3bf0209a1bdabfc80e2b6f783b5365039c08bbeebb000db7d6de1c5eab7d9bc4`, the $20 additional cap and the specified protected Core, OpenAI and private WordPress operations in Codex on November 15, 2026. Preserve Entry, first-party measurement and Ongoing work. No new production telemetry collection or public release was included.

#### Authorized rollout prepared, waiting for the migration credential (2026-11-15)

The exact Core archive is staged off-webroot in `~/miopages-private-acceptance/hosted-c0-3bf0209a` on the protection account. Candidate verification matched all 170 files, and the current deployment matched all 163 files on `740e3c1`. The retained dependency lock matches byte for byte. The candidate has its own copy of the installed Linux dependencies. The compiled worker inspected the live database using the restricted Core role and independently matched all 20 approved source hashes and the complete context digest. Its workflow grant is absent. The new reference, media and bundle directories are privately owned. The separately staged Delivery 0.0.12 ZIP matches its pin in the existing private WordPress account. Both current services still run their previous versions.

The existing OpenAI key returned both pinned snapshots in one authenticated, non-generating model-list request. No C0 evidence was in that request. A one-time keyed comparison matched the protected hosted key to the existing local development key. The owner previously verified the only project and disabled sharing settings for that key. The dashboard could not be reopened here, so no newer dashboard observation is claimed. Keep `store:false` for Responses and preserve the standard provider retention boundary. Prior ledger is unchanged and $0 additional was charged. [Prior project-control verification](https://github.com/R-Levin/myomaton-web/issues/10#issuecomment-6778994149)

The guarded migration is staged as `~/miopages-c0-workflow-3bf0209a/install.sh` on the existing `runtime.miopages.com` Cloud Bash session. It reads the `miopages_migration` password only at a hidden prompt, uses the existing verified TLS and recovery path, and checks the exact two pinned SQL files. The transaction targets only C0 draft 28 and checks forced row isolation and append-only access before committing. The Linux syntax and uploaded file hashes passed. The new privilege verifier passed with the exact SQL on a disposable PostgreSQL intake, refused an extra UPDATE grant, and rolled the disposable transaction back. The owner supplied the installer PASS at the hidden prompt. A separate read-only connection using the development role checked the exact draft 28 binding, forced row isolation on both workflow tables, append-only rights, zero initial event/output rows and the unchanged provider ledger. The approved `activate-protected-c0-core.sh APPLY-EXACT-PROTECTED-C0-CORE` then passed on the protected acceptance account. That script stops only the verified protected PM2 process, preserves the full matching old runtime, swaps the pinned build, activates the exact grant without calling OpenAI, and verifies private and public HTTPS behavior. It restores the prior protected runtime on failure. Actual Core HTTPS deployment is complete. Provider generation, WordPress installation and browser review remain ahead.

#### Protected C0 build activated (2026-11-15)

The running protected process now serves artifact `eb2518f61bd4dfa0ba5cd460057a4e713a5c24f6`. The active grant is mode 0600 and expires November 22, 2026 at 21:00 UTC. The complete prior `740e3c1` runtime is retained off-webroot at `~/miopages-private-acceptance/hosted-c0-3bf0209a/previous-runtime-740e3c1`. External HTTPS verified the Core shell (200), the protected API refusal (401 with its request header) and the anonymous WordPress refusal (401). The deployment verified that the public Core and Web Presence output digests matched before and after. Delivery 0.0.12 remains in private staging and was not installed.

**Current action.** Sign in as `owner` at [Protected Core](https://wp-acceptance.miopages.com/core), then choose **Start protected workflow** under **Business report and website**. The last readback showed zero workflow events, zero outputs and one active credential with both C0 inspection and preparation rights. The existing browser account owns that authenticated operation. After the first event is queued, start the verified worker from the deployed Core checkout with `node .rehearsal/private-listener.cjs --workflow WATCH-AUTHORIZED-WORKFLOW`. Reopen the protected page after the Business Understanding Report is retained. Continue into site planning only through its authenticated development review. No model generation occurred at deployment. The baseline still holds 12 previous attempts and $0 new spend under this grant.

**Later independent visual review.** The hosted Core development-grants view currently exposes only C0 inspect and prepare. The shipped visual decision operation also requires `review-private-stage`. The live view cannot currently surface that independent authority. This does not block starting research or producing the report. Resolve it through the existing independent WordPress Operator boundary or review a narrowly scoped policy correction before recording a visual approval. No grant was broadened or bypassed. The separate WordPress site approval, public publication boundary and owner review hold remain in force.

**RECOVERY / RESUME HERE.** Read the current Issue #12 handoff before touching hosts. The scoped migration and protected Core swap both passed. Read the existing case state, wait for the authenticated owner start if the case is empty, and continue the same case with its approved worker. Do not regenerate or initialize a second case if an operation already succeeded. Issue actual candidate approval and staging only through the retained independent authority, then leave the private candidate available for owner review.

#### Live C0 research, retained assessment and owner review correction (2026-11-16 UTC)

The owner’s start action queued the single C0 case at revision 1. The pending screen then showed historical references ahead of any deliverable. The owner explicitly rejected that review experience. The earlier action and the screen do not indicate report, site or UX acceptance. No retained answers need to be supplied again. [Owner UX finding](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6903696590)

The guarded worker ran once under the approved manifest. The pinned model completed public research with one web-search tool call. Core independently fetched and retained nine public source observations. The subsequent real report response contained eight findings and cited known source IDs. The semantic validator stopped at workflow revision 5 because seven findings had been marked established while their citations included historical, proposed or unconfirmed material. Both responses remain in protected custody with verified digests. No paid retry was made. The ledger added **$0.036271 estimated usage** across three metered requests and two generations. Research accounted for $0.018406 and report generation for $0.017865. The prior approvals, published product and WordPress remain untouched.

The correction keeps the strict source validation and classifies only those mixed-evidence provider findings as proposed. It never promotes a status, invents a citation or overwrites the raw response. The new report-only recovery operation rechecks the exact retained response and metering receipt without loading a provider key. A separate read-only execution of the new validator against the exact hosted copy validated all eight findings, with seven proposed and one unresolved. Finding wording and citation IDs matched the original. The retained material addresses startups and the managed Launch-to-Ongoing service. Core's exact receipt verifier also matched the retained report to its live metering entry in a read-only protected process. These checks have not committed the report into the live case.

**Exact replacement ready.** Application regressions passed 425/425. Focused provider, owner review rendering and disposable PostgreSQL workflow regressions, TypeScript and ESLint passed. [Independent Linux package](https://github.com/R-Levin/myomaton-web/actions/runs/43779907005) passed the isolated protected runtime and was independently downloaded and verified. It is built from `cd0ac249b066f372a42a8a0e8777a79d1fb248ba`. The Core archive SHA-256 is `8a21d99309e271030da3731227e604d48b7b77c62bea913138e7262be5afa269`. Replace only the protected Core runtime after explicit approval for this artifact. Preserve the active grant, exact C0 evidence, current report response, metering ledger, running public sites and protected WordPress. The earlier separately pinned WordPress package remains the candidate for later authorized staging. The replacement and report-only recovery do not require a provider retry, a budget increase or a database-policy change.

The revised interface puts operation status first until a report exists. It groups the readable assessment by certainty, labels provenance near each finding, keeps source history secondary, and loads a source body into the UI only when the owner chooses the individual record. Corrections stay private until their transmission is authorized. The normal review action proceeds to development site planning and does not approve publication. The owner separately approved Core archive `8a21d99309e271030da3731227e604d48b7b77c62bea913138e7262be5afa269` in Codex. The live deployment and report readback are below.

**Recovery procedure used for the revision 5 pause.** The paused case had two valid retained response receipts and the unchanged active grant. Do not click Start again, resend report inputs or reset usage. Once the independently built Linux replacement is specifically approved, preserve the current protected runtime, swap only that protected build, and retain the active grant and ledger as-is. Do not activate a second grant. Use `node .rehearsal/private-listener.cjs --workflow RECOVER-RETAINED-WORKFLOW-REPORT`, verify the saved report and unchanged spend, and present the authenticated [Core report](https://wp-acceptance.miopages.com/core) for a meaningful assessment review. Once the owner records the development review, resume the same worker through site planning. Retain the separate independent visual and exact WordPress draft approvals, and preserve the private review hold before restoration.

#### Recovered report ready for authenticated owner review (2026-11-16 UTC)

The approved Core-only runtime `cd0ac249b066f372a42a8a0e8777a79d1fb248ba` has been deployed on the existing protected account. All 170 archive files and the previous 170 deployment files were independently verified. The full prior `eb2518f` runtime is retained at `~/miopages-private-acceptance/report-recovery-cd0ac24/previous-runtime-eb2518f`. The existing scoped provider grant was preserved without reactivation. Public Core and public Web Presence body hashes matched before and after the protected restart. The anonymous protected Core API and WordPress draft each refused access. The canonical Core sign-in page and a served application JS bundle returned 200. The existing `/core?utm_source=chatgpt.com` defect still returns 404. Use exact `/core` without a query. No authenticated owner-browser acceptance is claimed.

The protected command `RECOVER-RETAINED-WORKFLOW-REPORT` settled the live case to **revision 6, awaiting owner review**. An independent read-only query under the development role verified eight findings, seven proposed and one unresolved, and nine public observations. It compared each finding's original wording and citation IDs against the exact retained response and rehashed both raw provider outputs. The provider usage ledger remained byte-for-byte identical, with 14 total ledger attempts and **$0.036271** estimated added use for the original research and report. Recovery made no provider request. Neither WordPress nor public publication changed.

**Owner review.** Sign in at [Protected Core](https://wp-acceptance.miopages.com/core) and open **Business report and website**. The work product is the saved Business Understanding Report. Check the described managed Launch-to-Ongoing offer and that the audience includes startups. Review the open audience/scope decision and proposed interpretations. Use **Flag a correction** to record a private change, or **Continue to development site planning** once the report provides a sound basis. This is a meaningful assessment decision, with no need to reconstruct earlier answers. The seven proposals are not confirmed facts.

**RECOVERY / RESUME HERE.** Reconcile the latest authorized issue comment and read the existing hosted case. Revision 6 awaits the actual authenticated owner's report decision. Do not recover or start it again. Once the exact development continuation is recorded, resume `WATCH-AUTHORIZED-WORKFLOW` under the original grant from the existing deployment. Check newly supplied correction authority before any transmission. Preserve separate visual and WordPress approvals and the protected review hold.

#### Owner continuation and live Presence Direction (2026-11-16)

The owner reported the completed review in Core. Independent restricted-role readback verified development continuation at workflow revision 7, a queued direction step, nine retained public observations, no correction pending transmission and the exact active C0 grant. The pre-existing worker resumed that same case with its exclusive lock. [Owner’s persisted-continuation finding](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6920017340)

Real generated Presence Direction was saved at revision 9. It addresses startup eligibility and the transition to the managed offer, cites 21 evidence IDs and gives six visitor decisions. The retained offer direction is proposed. Preserve the owner's distinction between target service, reliably staffed Operator delivery and capabilities still in development. Full automation is unnecessary for launch if the promised work can be reliably fulfilled and evidenced. Keep readiness, economics, staffing and outcomes distinct from approved strategy. [Owner launch-readiness decision](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6919923491)

The next live response proposed 12 Pages, 11 navigation entries and six Article ideas. Strict validation stopped at revision 11. The response used exact declared labels instead of paths for navigation and repeated a known citation. Both new completed responses, the prior research and report, and their usage receipts are still in protected custody. New estimated usage was **$0.034159**. The total added estimated usage under this grant is **$0.070430** for four generations and seven metered requests. No retry was dispatched. Page drafting and editorial review have not run. WordPress and public state remain unchanged.

The new blueprint validator resolves exact, unique declared labels to their existing paths and removes repeated identical evidence IDs while retaining their first occurrence. Unmatched or ambiguous labels, duplicate resulting destinations, and invalid citations remain refused. A protected read-only check with the exact retained response and original usage receipt verified all 12 Pages, all 11 navigation paths and all six Article ideas. The page paths, labels and purpose wording were unchanged. The new `RECOVER-RETAINED-WORKFLOW-BLUEPRINT` command reuses the saved response without loading a provider key. The checked result has not yet been written to the live case.

**Verified replacement.** The exact Core package is from `419b88423c80192ebee82195070d430475e06c74`, archive SHA-256 `3c7a1aac9bc582e3502f10092b419a927f5510f6e612740bf94b3aaa0680bae0`. [Independent Linux release, isolated private runtime and focused browser tests](https://github.com/R-Levin/myomaton-web/actions/runs/43894997620) passed. The downloaded archive digest was independently checked. The final application suite passed 427/427 and the two disposable PostgreSQL regressions passed sequentially. The first concurrent check exposed a browser timer race and a Windows fixture-cleanup lock. The polling effect now stops on the review response and the standalone sequential verification passed. The earlier exact artifact remains active. The new executable needs the separate exact Core-only replacement decision. Recovery requires no paid repeat, new source or policy change.

The updated hosted interface automatically checks the existing authenticated read endpoint while generation is queued or running, stops polling at review and preserves the current response across refresh. It shows the actual stage and moves to the proposed site when ready. No new customer action or alternate worker is introduced. The signed-in browser regression exercises the continuation click, queued status and automatic transition to visible draft output with a controlled test transport. The protected PostgreSQL integration independently verifies that the authenticated continuation queues a durable direction stage and the worker progresses to the generated site fixture. A managed background runner for normal product operation remains outstanding. Production checks remain separate from these tests. The newer [correction and portal acceptance boundary](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6920389025) adds a safe disposable correction proof and distinct authenticated account shells. This build warns that a late correction pauses planning and requires fresh review. It does not test by changing the live C0 case or change portal permissions.

**RECOVERY / RESUME HERE.** The real case is paused at revision 11 with a saved Presence Direction. Do not start a second case, re-approve the report, re-enter evidence or purchase another blueprint. Keep the existing exact manifest, metering ledger and active provider grant. Once the exact protected replacement is approved, swap only the protected Core runtime with rollback and use `node .rehearsal/private-listener.cjs --workflow RECOVER-RETAINED-WORKFLOW-BLUEPRINT`. Verify the retained blueprint and unchanged ledger, then resume the same worker through Page drafts and editorial review. Bring the owner a meaningful complete site proposal when ready. Independent visual review, exact private WordPress approval, and publication controls still apply.

#### Blueprint recovered and first live Page retained (2026-11-16)

The owner explicitly approved protected Core build `419b884`, archive SHA-256 `3c7a1aac9bc582e3502f10092b419a927f5510f6e612740bf94b3aaa0680bae0`. All 170 deployment files and the previous 170 files matched. The existing protected runtime restarted successfully. The prior `cd0ac24` runtime is retained at `~/miopages-private-acceptance/planning-recovery-419b884/previous-runtime-cd0ac24`. Public output digests matched across the swap. The approved scope and active grant were preserved.

The keyless blueprint command recovered the original response to revision 12 without a provider call. Independent scoped readback matched every Page label, path, purpose and citation, all eleven navigation paths and six Article ideas. The metering ledger was byte-for-byte unchanged with 16 attempts. The twelve Pages are the generated proposal. They have no Operator site approval, customer acceptance or publication authority.

The same worker generated Home. Core retained its real completed output and paused at revision 14 because the text suggested an unverified account destination and a separate undeclared internal path. Home has eight sections. No subsequent Page or editorial generation ran. The provider response remains recoverable with verified SHA-256 custody and actual metering. The original Home attempt added **$0.021135** estimated. The approved run has added **$0.091565** estimated across five generations and nine metered requests. No paid retry, WordPress staging or publication happened.

The new provider-only Page settlement preserves the exact draft copy, canonical Page identities and allowed citations. It keeps an unverified action as a review item with no destination. Suggested internal paths outside the blueprint are displayed separately as unresolved and never passed to delivery as links. External or invalid internal-link syntax, forged citations and mismatched navigation actions remain refused. An independent protected read-only check of the exact Home output and original receipt preserved all eight sections and their citations, separated nine valid internal paths and one unresolved suggestion, and left the unverified account action inactive. The retained Home can be recovered without another provider request using `RECOVER-RETAINED-WORKFLOW-PAGE` once the next exact code build is approved.

**Exact protected Core package.** Candidate source `b7f7e7a601d83ee17b5cdf6237b9ec0c293cc3af`, archive SHA-256 `804fb3e62658574f4661f44811b89184421c78d81badda269eaa884506f2d305`. [Independent Linux build and recovery tests](https://github.com/R-Levin/myomaton-web/actions/runs/43904507901) passed, and the downloaded artifact and Core archive hashes were verified independently. The local application suite passed 428/428. All seven focused browser, provider and disposable PostgreSQL tests passed, followed by TypeScript and ESLint. The deployed artifact is still `419b884`. The next exact Core-only replacement is pending and carries no new provider input, policy, budget, WordPress or publication permission. The separate WordPress readback still shows its prior protected revision 3 and high-water revision 5.

**Parallel local development.** The bounded correction test drives the actual browser controls against a disposable, session-protected PostgreSQL case. It checks refusal of unauthenticated, stale, empty, actor-forged and wrong-scope corrections, the warning before superseding a reviewed report, correction persistence with actor and report digest, independent authenticated readback, preservation of the reviewed event and downstream report, Direction and Page changes. The saved note does not dispatch anything. The scoped provider adapter separately refuses unsigned corrections before dispatch. Existing authentication now projects server-derived workspace identity and account/site context. The hosted Operator foundation uses the current scoped development account, and the Customer foundation uses the disposable role-labeled rehearsal. Neither shell changes permissions. Production customer identity and the canonical My Business editor are still open. [P0-13 and portal boundary](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6920389025) · [P0-14 living business knowledge](https://github.com/R-Levin/myomaton-web/issues/12#issuecomment-6921407180)

**RECOVERY / RESUME HERE.** Read the latest Issue #12 checkpoint. The materialized protected case is at revision 14 with approved development continuation, a verified recovered blueprint and the original Home output. Do not regenerate Home or reset the case. Once the exact next Core artifact is approved, preserve the active grant, ledger and earlier rollback copies, run `node .rehearsal/private-listener.cjs --workflow RECOVER-RETAINED-WORKFLOW-PAGE` and verify the actual Home, unresolved destinations and unchanged ledger. Then resume the existing worker through the remaining drafts and editorial review. Bring the complete candidate for owner review. Independent visual review, exact private WordPress staging and public publication remain separate gates.

#### Home recovered and tenth Page retained (2026-11-16)

The approved protected-only replacement deployed source `b7f7e7a601d83ee17b5cdf6237b9ec0c293cc3af`, archive SHA-256 `804fb3e62658574f4661f44811b89184421c78d81badda269eaa884506f2d305`. All 170 incoming files and 170 backup files matched. The preceding `419b884` release is retained under the protected account at `~/miopages-private-acceptance/home-recovery-b7f7e7a/previous-runtime-419b884`. The protected route and authentication refusal passed. Public HTTPS output matched across the swap.

Core recovered Home at workflow revision 15 with the provider key removed from the recovery process. Readback verified the exact heading, search metadata, eight section bodies and their citations, and nine declared internal paths against the original retained response. It retains one undeclared suggested path and the original existing-account action without an active destination. The ledger was byte-for-byte unchanged during recovery at 17 attempts.

The same authorized worker saved eight more Pages and paused at revision 33. Nine of twelve proposed Pages are saved. The tenth response completed and passed custody verification. Its exact Page identity, citations and internal path list match. A navigation action points back to its own Page, which the validator refused. The worker exited at the recovery gate. The completed response is retained in protected custody under SHA-256 `d5a22b5093a1dd043270596e8792025cf92a5034da3cf82377e180b26210dfdf`. No editorial result exists yet. The site structure remains a proposal.

The local correction accepts only the exact canonical self-target from provider output and stores that action inactive, with its original label and target visible in editorial review. It preserves the strict reader, valid navigation, other undeclared-action refusal and citation checks. The site-wide editorial panel explicitly lists each retained unresolved path and inactive action even if the editorial model omits it. Six focused provider, browser and disposable PostgreSQL tests passed. This correction has no hosted deployment authority.

**Verified replacement.** [Linux build, focused tests and isolated smoke](https://github.com/R-Levin/myomaton-web/actions/runs/43909100278) passed for `d8775ba4d9cd93f0d2fa7a8f8fa53b0f0d942f00`. The local archive independently matched SHA-256 `82cf1f3a7edd5ed00cf7ece0c70e508812820f9b2e722cda79d857bc6300b3d0`, all 170 runtime file hashes, and the embedded manifest. A separate read-only run of that validator against the actual retained Page confirmed all five section bodies and citations, search metadata, other actions and declared internal links match. The self-link is inactive with its exact target recorded, both Home requirements are still present, and the protected revision and ledger did not change.

**Parallel portal work.** The disposable Customer workspace now opens My Business alongside the same business report. It reads confirmed, public-scope canonical Knowledge and active Offering records from the signed-in Web Presence, with source kind, confirmation date and record revision. The isolated browser regression verifies persistence on reload and that another Web Presence, internal material, provisional claims and raw source references do not appear. The reviewed C0 baseline is loaded locally through the canonical writer. The existing correction affordance continues to flag report interpretations only. Production Customer identity, the protected Operator knowledge read and confirmation/editing through the existing scoped canonical flow still need integration. This local slice adds no hosted permissions or deployment and is separate from the exact Page recovery archive. The full application suite passed 428/428, the six focused provider, browser and disposable PostgreSQL tests passed, and TypeScript and targeted ESLint passed.

The live ledger has 26 attempts and SHA-256 `5ab3f7c8db11634a84cc24232f65b1d67de8535ccc2612bd0e2d88346558731b`. The latest progression added 18 metered requests including nine completed generations, at **$0.077468 estimated usage**. The approved run totals 27 metered requests including fourteen completed generations, at **$0.169033 estimated usage**. These are ledger usage estimates. The wider ledger independently reads 51 requests, 26 generations, $0.207155 settled usage estimates and a pre-existing $0.008400 uncertain reservation, for $0.215555 accounted. The live-run subtotal is already included. The worker is stopped and this pause added no uncertainty. Owner time is unmeasured. No other expenditure was initiated. Independent WordPress readback confirmed Delivery 0.0.10, materialized draft revision 3, high-water 5, unchanged Home and Service IDs 13 and 14, and matching apply and restore evidence.

**RECOVERY / RESUME HERE.** Read the latest Issue #12 handoff. The existing protected case is paused at revision 33 on Page ten. Use the verified Linux archive pin and exact Core-only authorization before replacing `b7f7e7a`. Recover Page ten with `RECOVER-RETAINED-WORKFLOW-PAGE` without the provider key and verify the unchanged ledger, exact copy and citations, and inactive self-target. Then resume the same authorized worker on the remaining two Pages and whole-site editorial review. Keep both Home requirements visible and inactive. Preserve the prior rollbacks and current WordPress. Owner review is of the complete candidate. Private WordPress staging and publication require their own authority.
