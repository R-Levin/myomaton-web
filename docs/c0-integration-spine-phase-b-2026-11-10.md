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
