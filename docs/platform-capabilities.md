# Web Presence platform capabilities

The [customer journey and change-management contract](customer-journey-and-change-management.md)
defines the intended prospect-to-customer flow and recurring business-change process.
Gated Review/prospect state, customer approvals and their durable history, paid
onboarding mechanics and business-change impact planning remain **Core planned**;
existing rendering, media acquisition or operator QC does not complete them.
Commercial/payment terms require separate validation; Review auto-delivery and an
operator network remain future hypotheses. See P11–P14 and P26 in the
[architecture register](deferred-architecture.md).

<a id="current-functional-map--november-18-2026"></a>

## Current functional map — November 20, 2026

This reconciles the complete approved service with current development evidence.
It refines dated statuses below without replacing the architecture register or
declaring Commercial V1 complete. The November 13 local handoff assessment remains
historical. C0 is development evidence, not a different product. There are no
customers yet using the new service.

The November 20 reconciliation checked canonical contracts, source boundaries,
the existing operational-cycle implementation/tests and dated hosted handoffs.
It made no fresh hosted-health test or provider dispatch. The owner-approved
product remains the complete growth service, with reuse across all development
and delivery/provider independence. See the [service principles](web-presence-service-model.md#governing-product-principles).

| Service stage | Functioning evidence to preserve | Connection still needed for ordinary service |
| --- | --- | --- |
| Free Review / Direct Start | Shared versioned intake, progress/submissions and Review synthesis; distinct generated journey pages at [4473](http://127.0.0.1:4473/). | Public intake, reliable private Review delivery and commercial handoff. Current candidate links do not submit requests. |
| Research / adaptive interview | Real API-generated C0, C2 and startup reasoning; answer-dependent assessment and isolated persistence. Complete original text and actual peer pixels reached the genuine original-evidence run. | Integrate useful questioning and source reuse into ordinary onboarding. Transmission/retention alone does not establish high-quality research or intelligence. |
| Living business understanding | Retained answers/provenance, report review/corrections, canonical Knowledge/Offering writers and immutable revisions. | Seamless Customer/Operator My Business correction/confirmation and independent versioned proposal storage. Generated findings and the ten retained answers do not become confirmed facts automatically. |
| Assessment / Presence Direction | Genuine hosted report/Direction and source-bound strategy plans. | Consistently useful intelligence, explained consequences and normal customer confirmation; generation success is not acceptance. |
| Complete site creation | Genuine retained research/report/Direction/Page outputs and source-bound Core review. Current local source97 has six Pages, improved theme0.1.2 layout and no photo placements at [the exact Home preview](http://127.0.0.1:4474/?page_id=203&preview=true). Paid three-Page revision106 was recovered/validated without regeneration, not applied. Earlier eight-Page/two-photo source75 and other candidates remain retained. | Consistently useful business intelligence, full growth-service explanation, original design/purposeful media and ordinary resumable editorial operation. Neither technical tests nor recovered106 establish owner acceptance. Do not overwrite earlier work or blindly regenerate. |
| Review / private delivery | Exact Page/site governance, signed HTTPS pull, scoped principals, stable WordPress IDs, application receipts, monotonic revisions and rollback; protected revision 6 retained. | Carry a good candidate through resumable Customer/Operator review. Local visual critique is not signed approval. New component version 2 remains local-only. |
| Account / Launch / operations | Hosted protected owner login; customer binding, activation, roles/permissions and readiness foundations. Legacy HostShop remains separate. | Ordinary customer account/recovery, payment/commercial reconciliation, Launch readiness and delivery operations. No complete automated signup/billing or public launch is claimed. |
| Contact / leads / outcomes | Canonical Contact acceptance; a restricted hosted synthetic inquiry with revision lineage and improvement recommendation. | Genuine submissions, abuse/privacy/retention, notification/delivery, customer-confirmed qualification and outcomes. Synthetic inquiries are not leads. |
| First-party measurement / reporting | Durable local scoped page/Action events, deduplication, accepted-Contact reconciliation and Performance Snapshot/recommendation fixtures. | Installation-bound collection, coverage/consent/internal/bot treatment and useful real reports. No claimed traffic/conversion/revenue. Google integrations remain optional enrichment. |
| Ongoing improvement / growth | Recommendation → Operator change → signed private revision/receipt/restore exercised with synthetic inputs; shared generation supports revisions. | Actual observation and confirmed outcomes driving prioritization, Articles, approval, delivery and remeasurement. Ongoing remains core scope, not maintenance-only or optional future work. |

**Current coordinated increment:** guidance/recovery reconciliation and the
critical-path review are complete. The owner agreed the account-cycle direction
and requested [a bounded implementation scope](service-operations-model.md#proposed-implementation-scope--one-connected-account-cycle).
It connects understanding, useful AI work, shared review, authorized delivery/
inbound reconciliation and actual observation/next action. Local implementation
has begun as recorded below; no new model dispatch, public-site work or hosted
write occurred. Preserve completed repairs/proofs and launch distinctions.

The [service model](web-presence-service-model.md), [progressive onboarding](progressive-onboarding-and-launch-readiness.md),
[knowledge transfer](paid-onboarding-knowledge-transfer-contract.md), [measurement](measurement-and-analytics.md),
[content growth](content-growth-loop.md), [operations](service-operations-model.md)
and [active gates](deferred-architecture.md) retain the full requirements.
Publication, consequential customer decisions, protected writes, spending and
merges retain their existing authority. A fresh hosted-health audit was not
performed in this local increment; cited hosted results are retained evidence.

### Connected account cycle — first local implementation checkpoint

**November 20, 2026.** The owner asked Codex to act on the scoped next step. This
extends the existing portal, workflow events and measurement ledger; it does not
create a second account/task/approval system. It is local implementation, not a
protected rollout or owner product acceptance.

- [Account work projection](../lib/platform/intake/account-work.ts) and
  [existing portal integration](../scripts/intake/c0-site-journey-client.tsx) show
  the current case's sources/status, retained work, pending corrections and next
  action. Confirmed My Business records are grouped for reading, with full entries
  and version history retained. This connects the currently authorized case view;
  it does **not** reparent isolated106 or grant cross-case/tenant access.
- [Existing workflow](../lib/platform/intake/presence-workflow.ts) now appends
  source/digest-bound proposed corrections without clearing report, Direction,
  blueprint, Pages or output custody. Exact retry is idempotent; stale, foreign,
  malformed and conflicting changes are refused. Pending notes identify directly
  cited findings/Direction/Page plans or sections and require reassessment before
  further mutation/delivery. Citation impact is a dependency aid, **not** model
  reasoning or proof that uncited material is unaffected.
- Notes stay unconfirmed and leave canonical knowledge unchanged. Author-only
  withdrawal requires a reason and retains history; it is not confirmation or
  resolution of the underlying business question. Existing report corrections
  retain their original separate behavior and historical contracts. Normal scoped
  portal actions can save proposed notes; they cannot use proposal permission to
  confirm facts. Actual canonical confirmation/reassessment wiring remains next.
- [Internal review collector](../lib/platform/measurement/account-review.ts) uses
  the existing authenticated local intake boundary and first-party ledger. It
  derives account/source/revision/routes server-side, captures real account views
  and open-work clicks, deduplicates exact events and rejects foreign fields,
  invalid Actions and Contact events. `development` is distinct from `synthetic`
  and `live`. No IP, browser identifier or form text is collected. Its counts
  establish **internal review activity only**; WordPress visitor collection,
  inquiry acceptance/outcomes and hosted collector policy are not supplied by it.
- Save/conflict/permission errors now display in the workflow view; previously
  that branch hid the common status/error message. Failed saves preserve entered
  text. A workflow read failure is surfaced while older intake remains available;
  review telemetry failure does not hide retained work.

**Verified:** new real PostgreSQL/HTTP test plus existing workflow integration
regression pass;26 focused review/source-authority/transport/cycle tests pass
(28 automated tests total, zero failures/skips/provider dispatches). Fixture
reasoning is explicitly labeled. Actual headless Edge at 1440px and 390px verifies
correction save, reload, citation links, withdrawal, internal collection, no
horizontal overflow and no browser errors. An explicitly injected409 verifies
visible failure and retained input before a successful save. Zero external browser
requests/provider calls. Browser receipts/screenshots are private ignored runtime
evidence; no founder acceptance of a simulated interview/site is requested.

Full `tsc --noEmit` and targeted ESLint pass. Initial typecheck exposed a pre-existing
type error in an ignored November19 diagnostic helper; `tsconfig.json` now excludes
ignored runtime-content/runtime-assets from application compilation. Tracked app,
library, script and test sources remain included; no customer artifact was removed
or compiler error suppressed. Disposable PostgreSQL/listeners/browser were stopped.

**Remaining at that earlier checkpoint:** source-aware canonical confirmation/reassessment, explicit permitted
original/evaluation case association, genuinely useful live AI work, ordinary
inquiries/notifications/confirmed outcomes, installation-bound WordPress collection,
inbound edit reconciliation and account-level applied receipt/readback. Existing
signed outbound delivery is preserved. Further local engineering is authorized;
new provider use, protected policies/deployment/application and publication still
require their applicable concrete authority. Protected41/WordPress6, local97,
isolated106 and prior ledgers were not touched. This is a first working connection,
not completion of the six-step service cycle or a new spending grant.

### Connected account cycle — protected preparation and actual host findings

**November 20, 2026; preparation only.** The owner said to start the hosted
integration preparation. Read-only encrypted SSH and verified-TLS PostgreSQL
sessions found the original C0 organization/presence/site are **inactive**, bound
to their original activation case. Intake28 and workflow41 remain current. There
is one existing public-use Knowledge record (one fact, version1). The restricted
Core role has no direct canonical table privileges; the owner login has inspect/
prepare proposal grants, with no customer mandate. No activation, reparenting,
canonical promotion or new credentials may be inferred from those grants.

The local [composition](../lib/platform/intake/protected-account.ts) and
[prepared policy](../lib/platform/intake/protected-account-policy.sql) therefore
reuse the existing **inactive** canonical writers. Internal onboarding stays
internal-only; the existing approved-public path still requires one confirmed
public fact. Active-account behavior is unchanged. The protected owner must have
an actual separately scoped business-confirmation grant and business-representative
mandate; proposal authority and simulated role switches do not suffice. The same
opaque authenticated session reaches that check, and every borrowed database
connection establishes the restricted boundary. No broad public-table grants.

[Outcome policy](../lib/platform/intake/protected-account-outcomes.sql) provides
metadata-only inquiry readback and development-only append-only outcomes, using
the existing Contact journal. Ordinary Contact correctly refuses an inactive
site. The protected proof may use only the existing labeled rehearsal intake;
this does **not** establish ordinary hosted visitor acceptance, notification,
revision attribution or commercial performance. Outcome reads that fail display
unknown status. Full inquiry text is excluded from this view and AI projection.

**Actual outage, distinct from code readiness:** `/core` and `/core/` both return
502; loopback8081 refuses connections. The existing acceptance-account PM2 still
contains exactly `miopages-protected-core`, stopped, PID0, restart count10. Its
170 checksummed deployed files match source `4df15c1`; the saved PM2 dump is older
and empty, so it is not evidence that the actual registration disappeared. No
cause or stop time is established. Preparation did not restart, rediscover or
change it. Restore only this existing process during authorized deployment, and
persist only the independently verified acceptance-account list. No new hostname,
package, ports, public-runtime or WordPress change is proposed.

**Verified locally:** restricted-role canonical update/history, rollback, stale
and foreign binding refusal, immutable history, customer-mandate/opaque-session
checks, revocation and development-only outcome RLS run against real disposable
PostgreSQL and original migrations/activation guards. The original inactive
Contact refusal remains intact. Existing contrast/reassessment and ordinary
active-account Contact tests remain separate. Controlled reasoning is not a new
live intelligence result. Full TypeScript, focused lint, routing and regression
checks pass. Fresh Linux verification for this preparation is recorded at the
next pushed checkpoint; the previous `6da668d` Linux build passed already.

The [SQL composition](../scripts/db/protected-account-policy.ts) hashes the exact
forward/rollback sources. Rollback withdraws new access and restores the old grant
view, retaining facts/history/outcomes/audit rows rather than deleting evidence.
The additive permission vocabulary alone grants nothing. Actual enrollment and
any hosted SQL/build replacement remain unexecuted and require the consolidated
scope approval. Original41/WP6, local97, isolated106, protected inputs, credentials
and usage records have not changed; no model request or spending occurred.

This prepares a bounded account-cycle rollout, not a claim that the complete
service now works. Independent versioned proposal storage, Offering editing,
explicit original/evaluation association, WP inbound reconciliation, actual
visitor collection/notification and recurring evidence-led operations remain open.
Do not generate another whole C0 website merely to test storage or login. A live
reassessment needs a meaningful reviewed business correction and fresh exact
egress pins; do not reuse an old grant or silently restrict available knowledge.

### Connected account cycle — confirmed understanding and outcomes

**November 20, 2026; local implementation after the owner's explicit go-ahead.**
This extends the same account cycle, canonical writers, workflow and Contact;
there is no second intake, approval system, generation engine or demo framework.

- The [canonical correction service](../lib/platform/canonical/confirmed-information.ts)
  requires an independently resolved existing `CustomerAuthority` contract and
  explicit confirmation of an owned Knowledge entry. A proposed note cannot
  approve itself. Record/fact classification stays fixed: public-use evidence
  needs explicit attestation, internal evidence cannot be promoted by this path,
  and neither authorizes publication. Unrelated entries retain exact evidence.
  Existing inactive onboarding authority is unchanged; both reuse the nested
  canonical transaction adapter.
- The [existing workflow](../lib/platform/intake/presence-workflow.ts) commits
  Knowledge and its confirmation receipt atomically, rejects stale/foreign/forged
  inputs and makes exact retry idempotent. Confirmation retains current work;
  separate reassessment archives full prior report/Direction/plan/Pages and keeps
  consumed revision/replan allowances. Old approval/quality targets do not transfer.
- The existing generation stages require an explained **retain/revise/add** decision
  for every Page after a knowledge change. Retained Pages remain exact; only
  revised/new Pages need drafting. No fixed Page count or default whole-site rewrite.
  Core shows before/after findings, approach and Pages; later canonical drift stops
  dispatch. Controlled response tests verify this connection, not AI intelligence.
- The [existing provider](../lib/platform/intake/presence-workflow-provider.ts)
  requires fresh exact development egress pins plus added canonical evidence;
  old authority cannot transmit new corrections. Reasoning inputs omit customer/
  Operator authority metadata. Complete approved original knowledge remains
  available; stage projection avoids repeating derived candidates: planning sees
  the complete prior site, drafting its prior Page, editorial the changed prior
  Pages. Revisions meter as revisions. Internal facts are analysis, not copy
  authority. These development pins do **not** establish permanent per-answer owner
  approval; governed session authorization remains the intended service direction.
- [Inquiry outcomes](../lib/platform/contact/outcomes.ts) and their
  [local append-only journal](../lib/platform/contact/outcomes.sql) reuse ordinary
  Contact acceptance. Scoped explicit customer confirmation records qualification,
  outcomes and corrections with history/retry. Actual notification state remains
  separate; unknown stays unknown. Reporting does not copy inquiry fields into AI.
  Development/live classification is server-controlled; site-revision attribution
  remains unconnected. Expiry prevents new outcomes and inquiry retention can
  cascade its journal. No email provider, CRM or business performance is invented.

**Verified:**49 tests pass:36 focused provider/source/authority/review/transport/cycle
tests,4 actual disposable PostgreSQL/HTTP integrations and9 existing inactive-
onboarding confirmation tests. Forced canonical-history, workflow-receipt and
outcome failures roll back completely. Contrasting recorded responses change the
relevant finding, approach and Page while preserving unrelated offering text,
exact Home and fictional C2 records. Consumed allowances persist. Controlled
Responses transport exercises real metering/custody code, egress refusal and
no-request recovery; it makes no provider call.

Actual headless Edge at 1440/390 verifies confirmation, reload, before/after,
retained/revised Pages, ordinary Contact acceptance and reported-outcome reload:
no overflow/page errors/external requests. Private screenshots/receipt are in
ignored `runtime-content/confirmation-reassessment-browser-20261120`. Legacy-suite
setup initially lacked its required bootstrapped owner fixture; the disposable
runner was corrected without weakening checks or modifying canonical migrations.
All9 then passed. Test-only source-ID/typing errors were corrected before final
verification, not hidden or counted as passing results.

**Before protected activation:** compose actual account/case and confirmation
authority, verify the protected account's active/inactive binding and appropriate
existing writer, Linux artifact and restricted policies, then authorize fresh live
inputs/model/budget. No capability/grant/outcome table was installed on the host.
New active correction supports existing Knowledge fields; active Offering editing,
inquiry-detail/notification handling, WordPress visitor attribution/inbound edits
and account-level delivery receipts remain incomplete. Fixtures do not establish
commercial quality. Original Core41/WP6/local97/isolated106 and all ledgers remain
untouched; no provider spending, hosted writes, WP application, merge or publication.

### Service-process framework: existing foundations and missing connections

The requested framework is **partly implemented**, not absent and not commercially
complete. Reuse these actual components rather than start a new framework project:

| Existing component | What the source establishes | What it does not establish |
| --- | --- | --- |
| Shared intake and protected Core | [Intake service](../lib/platform/intake/service.ts), [hosted request boundary](../lib/platform/intake/hosted-core.ts), [Customer/Operator journey](../scripts/intake/c0-site-journey-client.tsx) and [My Business](../lib/platform/intake/my-business.ts) hold scoped progress, evidence, review and corrections. | A fully usable ordinary-customer signup/interview/account/support lifecycle or owner acceptance of the earlier scripted interview. |
| Core generation orchestration | [Shared workflow](../lib/platform/intake/presence-workflow.ts) and [case/worker composition](../lib/platform/intake/protected-presence-workflow.ts) retain research, report, Direction, plan, Pages, review, failures and no-provider recovery. Real API outputs exist. | Consistent commercial intelligence/design quality, a complete autonomous service or authority to dispatch under expired/consumed grants. |
| Proposal and delivery | Existing canonical proposals, approval/release controls and [workflow projection](../lib/platform/intake/presence-workflow-delivery.ts) connect to signed native WordPress staging/receipts/rollback. | Complete WP-origin knowledge/design synchronization, media policy or plugin/Admin-only portability. See the [WP review](wordpress-delivery-feasibility.md#coordination-media-and-adoption-review--november-20). |
| Inquiry and feedback | Canonical Contact acceptance, [protected inquiry](../lib/platform/contact/protected-inquiry.ts) and [cycle readback](../lib/platform/wordpress-delivery/cycle-measurement.ts) connect a labeled synthetic observation to a revision-linked recommendation. | Real notifications, qualified leads, customer-confirmed outcomes or proven commercial performance. |
| Measurement and Ongoing | [First-party ledger/snapshot](../lib/platform/measurement/first-party.ts) and [connected cycle evidence](c0-integration-spine-phase-b-2026-11-10.md#first-connected-operational-cycle) establish scoped/deduplicated signals and a fixture-backed improvement/revision sequence. | Live collection coverage, mature analysis/reporting, opportunity-driven Article/content operations and remeasurement as one ordinary service. The fixed synthetic recommendation is a beacon, not actual AI analysis of customer demand. |

The evidence supports both reuse and further integration. A missing connection is
not proof that the component must be rebuilt; a fixture is not proof that the
corresponding product function is finished. Customer/Operator permissions and
approval history remain distinct from simulated role perspectives. Early public
site work and manual operator coverage are tracked as transitional launch work,
not replacement definitions of this framework or the whole product.

### Indispensable system capabilities — critical-path assessment

**Owner clarification, November 20:** substantial manual effort is acceptable
during early operation. The constraint is delivery of the system contributions
that a human cannot reasonably supply through memory, manual reconstruction or
invented observations. This is an assessment using the completed review, not a
new product definition, framework, implementation assignment or external grant.

| System contribution | Actual position from the review | Missing functional connection / business acceptance |
| --- | --- | --- |
| Durable connected understanding | Scoped intake, sources/corrections, canonical Knowledge/Offering, My Business and revisioned workflow storage exist. | An authorized correction is retained once, confirmed at the proper authority, and visibly affects the relevant assessment/proposal and account views without re-interviewing the customer or promoting unconfirmed facts. Reload/resume and stale-change handling work through ordinary supported actions. |
| Useful genuine AI intelligence | Actual adaptive questions, research, report/Direction and site generation have run. Output custody, metering and source-aware revisions exist. | Intelligence consistently improves business understanding, content/design and decisions. Current C0 commercial quality has not passed; valid citations/API connection alone are insufficient. The system must retain and recover useful output, explain consequences and avoid repeating paid work. Human editing may improve a deliverable but cannot be claimed as proof of Core intelligence. |
| Trustworthy observation and learning | First-party ledger/deduplication/snapshot and canonical Contact acceptance exist; existing connected-cycle inputs/recommendations are partly synthetic. | Collect real scoped activity with explicit start/coverage, distinguish zero from unmeasured, and connect accepted inquiries and manually confirmed outcomes to the relevant site revision. Reports must explain evidence/uncertainty and support a justified next action, not manufacture performance. |
| Coordinated governed execution | Shared case progression/recovery, review/proposals, exact approval, signed WP drafts, receipts and rollback exist. | A real account work item carries purpose, source/base revision, proposed change, actual review/decision, delivery result and follow-up across Core/portal/WP. A manual Operator can initiate or perform a step, but completion/state/history cannot live only in chat, terminal memory or disconnected documents. |

**Dependency judgment:** the existing account/case/review state is the connecting
structure to extend. Intelligence quality and real observation are both necessary
workstreams; neither should wait for a perfect website or be replaced by a beacon
when claiming real service. Reuse the existing delivery path instead of rebuilding
it to solve a knowledge or measurement problem. Customer confirmation, judgments
and consequential approvals remain human responsibilities within that structure.

**Recommended next bounded increment for discussion:** connect one existing
customer account from retained understanding or a documented change/opportunity
through an editable evidence-bound proposal, real private site review/delivery
where authorized, and a retained result/next action in the same account. In
parallel, connect actual first-party collection/reporting to that account through
the existing measurement machinery. A small explicit observation can be genuine;
there is no need to invent traffic or claim business impact before it exists.
Operator initiation can bridge scheduling and manual review can bridge immature
automation, with the actual responsibility recorded. Do not create another demo
architecture or replace the work with a wholesale website rerun.

The [implementation scope prepared for review](service-operations-model.md#proposed-implementation-scope--one-connected-account-cycle)
uses these findings; the proposal is not an execution grant. Public C0
publication/measurement activation, provider use and protected WP application
retain separate concrete authority. 20i-only versus broader adoption and early
public-site decisions remain open; manual-effort tolerance does not decide them.

### November 20 reconciliation findings and limits

The canonical service, content-growth, conversion, opportunity and architecture
contracts substantially preserve the complete service. The review did not find
grounds to replace them wholesale. Demonstrated steering/continuity drift was:

- The recovery index had become a large C0/hosting execution chronology with
  competing historical Current/next-step labels. The new front page restores
  service purpose, current state, contract ownership and a safe next action;
  original details and old incoming anchors remain linked to immutable history.
- The owner-critical index linked a shared Creation/Ongoing architecture, P0-22/23
  assignment and stage-appropriate access policy that existed on `main` but were
  absent from this implementation branch. Restored the existing records/policy
  with source/status provenance, without merging or changing application grants.
  Reconciled a shared-architecture sentence that wrongly grouped reuse of owned
  R3 material with prohibited copying of third-party designs; useful authorized
  owned work may be retained/improved while outside originality/rights rules stand.
- The local Markdown recovery note stopped at November 1 and was absent from
  the active worktree. It now records current owner decisions and uncommitted
  progress, with a root-checkout pointer and preserved original note. Its
  pre-commit readback is a process check, not automatic capture of unwritten chat.
- README/agent entry guidance and the capability map needed current product
  identity, correct branch/local-note recovery and honest C0 state. Old eight-Page
  and current six-Page candidates are retained rather than conflated.
- The earlier WordPress media discussion still said text-only staging while a
  later section described signed native media. That sentence is now explicitly
  historical. Inbound knowledge/design sync, portal consistency, complete media
  policy and off-host/plugin-only behavior remain open, not silently completed.
- Temporary public-site urgency, manual operator coverage and a possible20i-only
  launch now have explicit separate status in the operations/architecture contracts.
  None is a permanent reduction of the complete service or a new launch decision.

The provider/marketing source boundaries were inspected: processing instructions,
approved Knowledge, editorial reference, analytical material and unconfirmed
answers are distinct; the genuine Core workflow and no-provider recovery exist.
This does not establish consistently good research/design output. It does not
erase documented earlier source/schema/judgment failures or approve106. No frozen
proposal/grant/source hash, stored context, model ledger or deployed worker was
rewritten to match the documentation. Archived source-pack hashes still identify
their original approved bytes; do not update an old manifest to authorize new text.

This is a bounded review of active steering assets and source/evidence, not a
forensic reading of every ChatGPT turn or proof that every historical influence
has been eliminated from all software. Current `main`/other worktrees were not
merged or rewritten. The exact active-branch/Issue handoff governs this correction.
Application behavior and hosted operation have not changed. Choose the next
coordinated product increment after owner review of these findings.

**Verification of this correction:** 20 existing focused source/authority/reasoning/
synthetic-cycle tests passed,0 failed/0 skipped, with no provider calls. The existing
documentation checker validated local links/anchors. A separate disk/Git-only
readback started at the older root checkout, followed the repaired local note,
recovered all 12 pending source files and their exact hashes **before commit**, and
verified all 147 historical recovery anchors remain available. The original local
note and full old recovery index were retained byte-for-byte. No background chat
recorder, new permissions system or second service framework was built.

**Remaining owner decisions:** the first supported launch scope (20i-only or a
broader supported subset), the separate public-site/measurement launch path, and
which manual responsibilities can credibly bridge an early service. These do not
decide the ultimate product boundaries. The next coordinated product increment
should connect the largest useful remaining service gap using existing components;
do not automatically resume a C0 generation loop or create another framework.
The owner should receive a concise product-level discussion, with detailed
engineering performed under its eventual bounded implementation scope.

## Purpose

This document defines the intended capability envelope of the managed Web Presence
platform: a managed traffic/lead-generation and business-presence system, not a
free-form page builder or general-purpose CMS.

**Web Presence** is the broader customer-owned managed presence. A **Managed
Site** is one concrete rendered/deployable multi-page site within it; a **Page**
is addressable content within that site. “Conversion Site” may be product-facing
wording, but is not an internal/domain type. Historical “Microsite” terminology
refers to the current Managed Site concept; see the [rename deployment note](managed-site-rename.md).

The Managed Site is the public conversion-focused surface / tip of the funnel.
Structured customer/business knowledge is canonical and reusable. Pages and
Sections consume that knowledge rather than owning duplicated global facts.

The platform aims to:

- Turn structured business knowledge into an effective web presence.
- Support full-presence, adjunct, and campaign deployments.
- Provide flexibility for real client needs without accumulating one-off
  site-builder complexity.
- Favor controlled semantic choices and platform-owned responsive behavior.
- Keep customer/business state structured, reusable, and manageable as a service.
- Make onboarding, first-party measurement and continuous optimization core
  product functions, with explicit approval policy and protected business truth.

Myomaton is Customer #1 and the proving ground for these capabilities. Its content
is canonical customer state, not a permanent platform template. See the
[customer-state and bootstrap boundaries](bootstrap.md).
Customer 0 is the product's own proving presence. MioPages now has a separately
authorized [canonical C0 graph](miopages-c0-canonical-state.md) in development,
with provisional copy/presentation and no commercial publication authority.
The [onboarding and optimization operating model](onboarding-optimization.md)
records the core planned workflow and its trust/provider boundaries.

The [Web Presence service model](web-presence-service-model.md) defines launch and
ongoing service intent; the [MioPages C0 model](miopages-c0-product-model.md) records
the commercial/generalization proving context. Neither changes capability status.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Implemented | Available in the current platform within the stated bounds; does not imply a complete customer-facing editor or production readiness. |
| Core planned | Part of the intended core product; not a claim of current implementation or an immediate delivery commitment. |
| Deferred | An established requirement awaits its implementation trigger; consult the active register for scope and unresolved questions. |
| Optional/later | A candidate capability requiring evidence of value before adoption. |
| Outside scope | Excluded from the managed platform; use an external system where appropriate or decline the requirement. |

[Deferred architecture](deferred-architecture.md) owns active implementation state,
triggers, and unresolved requirements. This catalog owns the intended product
envelope. Listing a planned capability here does not automatically create a
backlog item or satisfy a REQUIRED gate there. Its REQUIRED/DECISION/OPEN/OPTIONAL
classifications serve a different purpose from the capability statuses above.

## 1. Business entity catalog

**Implemented:**

- **Subject:** canonical customer-owned identity and descriptive content, including
  the existing project Subject Type. This is not an implemented Offering domain.
- **Asset:** managed media identity, metadata, ingestion and bounded usage support;
  usage-specific image alt/decorative presentation with Asset defaults. Broader
  lifecycle and management remain deferred. See [Assets](assets.md).
- **Action:** first-class labels and destinations referenced by Sections and
  Navigation, including stable Page UUID targets resolved within the selected
  Managed Site at presentation time. See [Actions](actions.md).
- **Contact Definition:** multiple reusable finite form contracts per Web Presence,
  with versioned acceptance and expiring submissions. This is a bounded foundation,
  not a CRM or public-production activation. See [Contact/forms](contact-forms.md).

**Phase 1 implemented:**

- **Offering**, with intended structured information:
  - Type: `product | service`.
  - Name.
  - Short description.
  - Substantial/detail description.
  - Status.
  - One canonical image AssetUsage in Phase 1; additional Assets remain planned.
  - Optional grouping/category remains planned.
  - Relevant Actions.
  - Structured discovery metadata remains planned where justified.

The implemented subset is the strict [canonical foundation](canonical-foundation.md):
Business Knowledge, Offering/components/pricing, bounded revisions, local scoped writers
and finite projections. Category/discovery extensions remain planned.

**Core planned:**

- **Location**.
- **Person / Team Member**.
- **Testimonial**.
- **Business / Contact Identity**.

Offering is intended for lead-generation catalogs, not commerce. These are product
concepts, not a prescribed schema change. Existing Organization/Web Presence
records do not constitute the complete planned Business / Contact Identity
capability.

**Optional/later:** Event; Promotion/offer; a reusable FAQ entity if cross-page
reuse proves valuable; other entity domains only when recurring client
requirements justify them. A promotional offer is distinct from an Offering's
product/service identity.

**Outside scope:** carts, orders, payment transactions, inventory, shipping, and
complex SKU/variant systems. Those belong to external systems/integrations.

## 2. Section capability catalog

| Status | Capability | Scope |
| --- | --- | --- |
| Implemented | Hero | Structured heading, eyebrow, plain text and optional Action. |
| Implemented | Editorial | Current stored type `intro`: stack and text/media split, with controlled semantic presentation variants. Current rendered media support is associated images. |
| Implemented | Collection | Inline editorial items or Subject-backed items; controlled 2/3-column grids. |
| Implemented | CTA | Structured heading, plain text and optional Action. |
| Implemented foundation | Contact | References one reusable Contact Definition, canonical phone/email and an accessible finite form. Public-production submission activation remains gated. |

See [Section presentation](sections.md) for the implemented variants, safe
plain-text paragraphs, validation and finite configuration choices.

**Core planned:**

- Gallery.
- Testimonials.
- Locations.
- Broader Contact experiences beyond the implemented Section, including overlay
  and production lead-form delivery/abuse/retention operations.
- Metrics / Statistics.
- Logo / Client Strip.
- FAQ.
- Team / People.
- Map.
- Process / Timeline.

The existing ubiquitous presentation vocabulary is content width, spacing,
alignment, surface/background role, divider treatment, media fit, and finite
layout variants. Each capability accepts only the applicable choices; for example,
media fit currently applies to Intro images, not collections. Responsive behavior
remains platform-owned.

**Outside scope for the Section model:** arbitrary HTML/CSS, arbitrary nested
columns, custom width percentages, draggable positioning, absolute positioning,
arbitrary per-breakpoint rules, animation builders, arbitrary colors/effects,
and general WYSIWYG/page-builder behavior. Visual choices use the Design System
and controlled semantic roles.

A new Section capability should be added only when it represents a broadly
reusable business/presentation need. A planned FAQ Section does not by itself
require a reusable FAQ entity.

## 3. Page archetype catalog

**Core planned archetypes:** Home, About, Contact, Listing / Index, Detail,
Campaign / Landing, and Flex / Generic.

The current Page/Section foundation, Myomaton Home and active multi-page serving
within an explicitly selected Managed Site are **Implemented**. See
[Managed Site routing](managed-site-routing.md). Myomaton's Home, About, Projects
and Principles are accepted canonical customer state; see the
[secondary Pages transition](myomaton-secondary-pages-v1.md). This does not
implement general archetype automation or production host/domain routing.
Archetypes describe page purpose and sensible composition, not a requirement to
create one of every kind.

The **Flex Page** is an operator/admin escape hatch. It may combine any supported
Section capabilities in a sensible order without normal archetype automation
restricting it. It does not bypass structured content, Section validation, Design
System rules, responsive behavior, or finite capability boundaries. It is not a
free-form page builder.

Common conditional archetypes within the planned envelope are:

- Products / Services Listing.
- Product / Service Detail.
- Projects / Case Studies.
- Project / Case Study Detail.
- Locations.
- Location Detail.
- Team.
- Team / Regional Detail.
- Thank-you / Conversion.

Pages should be created according to known business data and goals rather than
because a template expects them. For example:

- No physical location: no Locations page.
- One location: a Contact/Location section may be sufficient.
- Several meaningful locations: a Locations page and optional detail pages.

No architectural page-count limit exists; Managed Sites remain structurally
multi-page. Product/service quantities are not arbitrarily capped in the intended
product envelope. The platform remains optimized for manageable lead-generation
catalogs rather than giant commerce catalogs. This is not a claim of unbounded
operational capacity or completed production host/domain routing.

## 4. Navigation hierarchy

Normal managed navigation remains shallow. The default is a top-level item with
one child level:

```text
Top-level item
└── one child level

Teams
├── Northeast
├── Southeast
├── Midwest
└── West
```

Avoid deep menu trees unless repeated real-world evidence demonstrates the need.
Navigation may be generated or suggested from Page/entity structure, but remains
explicit canonical customer state. Flex Pages participate in the same navigation
constraints.

Canonical Navigation and parent/child relationships are **Implemented**. The
shallow default is product policy, not a claim that current code enforces exactly
two levels. Generation/suggestion and managed authoring policy are **Core planned**.

## 5. Managed Web Presence vs Content Engine

Classify content by its primary purpose, not merely by length or format.

| Managed Web Presence | Content Engine |
| --- | --- |
| Understand the organization and its products/services. | Publishing, news and ongoing editorial output. |
| Establish trust and evaluate options. | Discovery and SEO/AEO expansion. |
| Convert/contact and find locations/people. | Thought leadership and long-form education. |
| See persuasive projects, testimonials, galleries or proof. | Editorial archive/history. |

**Core planned:** a minimal native Article/Update publishing capability: title,
slug, featured image, excerpt/summary, publish state/date, optional author, one
coherent constrained rich-text body, standard listing/archive and article
presentation, internal analytics, and SEO/discovery metadata when that capability
exists. The body is similar in spirit to the classic WordPress editor; it is not
arbitrary Section composition or a Gutenberg/Divi-style builder. General design
and rendering capabilities may be reused without changing that boundary.

Articles can carry much of the ongoing discovery/content optimization work, with
deliberate internal links into conversion-oriented Managed Site Pages.
**Optional/later:** WordPress or another external Content Engine for publishing
needs beyond the native capability. Neither is a baseline dependency.
This supersedes the earlier decision naming WordPress as the initial provider;
the provider boundary and canonical-state/approval safeguards remain. Concrete
publishing and integration requirements are **Deferred** at register triggers.
Editorial archive/history does not imply indefinite retention of platform
revisions, logs or backups; the register's retention constraints still apply.

The Content Engine must not become a dumping ground for capabilities inconvenient
to implement in the managed presence. A reusable business-presence need should
be evaluated on its product value, even when it requires a new capability.

## 6. Adoption modes

**Core planned** support includes:

- **Full Presence:** the organization's primary managed web presence.
- **Adjunct:** a managed presence complementing an existing website or system.
- **Campaign:** a focused presence serving a particular campaign or conversion goal.

These are deployment/adoption modes, not separate architectures. They share
structured customer state, supported capabilities and the same product boundaries;
listing the modes does not claim their deployment workflows are complete.

“Keep what you have” means coexistence/integration, not ingestion, reconstruction
or migration of an existing Web Presence into the Managed Site model. A Managed
Site may become the conversion-focused face/front-end while an existing site,
Content Engine or infrastructure remains in place. Initially this is an
operator-assisted mode using supported integration/configuration patterns, not
bespoke customer software: URL ownership, routing, SEO/canonical
behavior, forms and analytics need explicit coordination. Standardize only when
repeatable patterns justify it. Full Presence and Campaign are the easier modes
to standardize, not claims of already completed deployment workflows.

## 7. Capability-growth rule

For a client request:

1. **Existing capability:** use it.
2. **Reusable new capability:** add it only if it represents a recurring, valuable
   need consistent with the product mission.
3. **Flex Page:** use existing capabilities in an unusual combination when normal
   Page archetypes are too restrictive.
4. **Native Content Engine / external system:** use when the requirement is fundamentally
   publishing-heavy, operational, transactional, or outside the Web Presence
   mission. Simple publishing fits native Articles; heavier publishing may justify
   an external Content Engine. Other systems own operational and transactional behavior.
5. **Outside product fit:** some requirements, particularly exhaustive pixel-level
   design control, may simply be incompatible with the service.

## 8. Product design principle

The platform is first a lead-generation/business-outcome system. Design supports
clarity, trust, usability, accessibility, performance, discovery, conversion, and
appropriate visual quality. It is not intended for clients requiring exhaustive
pixel-perfect art direction.

Design quality is part of product value, onboarding, acquisition, customer
confidence and retention. Sites should feel authored and intentional through a
finite curated vocabulary. **Implemented foundation:** [Visual Direction](visual-direction.md)
combines shared Design System primitives into bounded profiles and semantic
preferences, with platform-owned accessibility, responsive behavior and motion
ceilings. It is not an unlimited theme system, CSS editor or bespoke design service.
Two generic versioned runtime profiles support opt-in semantic presentation and
bounded Page-level motion. Customer visual selection/editing and icon expansion
remain planned. Myomaton is stored as reference v2 following its applied and
verified [guarded customer transition](myomaton-visual-direction-v2.md). Reusable reference-v2
capabilities are implemented and human visually accepted for checkpoint purposes;
the accepted customer presentation is now canonical development state.

[Reference v2](visual-direction.md#reference-v2-expression-contract) implements
explicit bounded Editorial statement treatment with readability fallback, six
finite compositions, responsive hierarchy/rhythm/wrapping, primary/supporting
Actions, readable primary/secondary accents and one reserved staged Hero event.
Peer collections remain equal. Clean image presentation and the accessible mobile
Navigation panel are shared behavior. Primitive palette values and disposable
Page/Section/Action/image selections remain customer choices, not profile defaults.
Customer self-service, broad icons, split-media Heroes and real testimonial/proof
semantics remain separate planned capabilities. No proof domain is invented by the
visual system. Applying a new customer profile/version requires its own authorization.

## 9. Production readiness track

The [Launch Readiness model](progressive-onboarding-and-launch-readiness.md#launch-readiness-as-a-tracked-workflow)
is **Core planned**: applicable item states (Not needed / Needed / In progress /
Ready / Verified), MioPages/customer/external-provider responsibility and verification
evidence, separating pre-launch requirements, applicable dependencies and later
maturation. It coordinates existing gates; a checklist or customer visual approval
does not complete them. Provider-specific runbooks/automation remain separate.

Launching Myomaton should drive the following from theory into implementation
and operational verification:

- Hosting/deployment.
- Persistent managed Asset storage.
- Custom domains, DNS and SSL.
- Host -> Web Presence / Managed Site resolution.
- Forms/submission handling.
- SMTP/outbound email.
- Email deliverability/sender-domain setup.
- Spam protection.
- First-party activity, Action and lead evidence as the V1 baseline. GA4 and Search Console supply optional distinct evidence where authorized and verified.
- SEO metadata.
- Sitemap/robots/canonical URLs.
- Structured data.
- Redirects.
- Accessibility verification.
- Security headers.
- Secrets management.
- Error logging.
- Monitoring.
- Health/uptime checks.
- Privacy/cookie requirements where applicable.
- Backup/retention behavior.

This is a **Core planned** production-readiness track, with established
requirements **Deferred** where the active register already defines triggers.
Existing pieces, such as local managed storage and media-response security
headers, do not establish production readiness for the whole platform. Stage
these concerns through [deferred architecture](deferred-architecture.md) as their
triggers become real; reuse existing entries such as A3, P4, P7 and P9 rather than
duplicating them. This list alone neither opens new backlog items nor declares
every item a blocker for every deployment mode.

## 10. Workflow linkage

Before each implementation slice:

1. Check this capability catalog.
2. Check [deferred architecture](deferred-architecture.md).
3. Determine whether an existing REQUIRED trigger has been reached.
4. Determine whether the client need fits an existing capability.
5. If not, decide whether it justifies a reusable new capability, Flex Page
   composition, Content Engine/external handling, or exclusion from product scope.
6. Update both documents only when product envelope or implementation state
   genuinely changes, keeping each document's responsibility distinct.

The catalog is not an implementation plan, schema specification, or completion
log. The active register remains the place to record concrete triggers and
unresolved implementation requirements.

## 11. Managed Site global capabilities

**Implemented foundation:** Web Presence-owned public display name, phone/email
and bounded social destinations; AssetUsage-backed logo read/delivery with name
fallback; controlled responsive Header/Footer; existing Primary and optional
separate Utility Navigation; optional configured Header Action and generated
copyright. See [site globals](site-globals.md). No customer-state writer or editor
is included; the full Business / Contact Identity domain remains planned.

**Core planned beyond this foundation:** a bounded site-wide layer above Pages/Sections for branding/logo,
Header, Footer, primary and utility Navigation, a shared Contact experience,
social profiles, Search where useful, site-wide conversion behavior and
analytics/integration configuration. Existing canonical Navigation is implemented;
this list does not claim a complete global capability layer or its authoring UI.

Header/Footer are controlled semantic capabilities, not arbitrary builders.
Logo belongs in structured onboarding/business data with a sensible business-name
fallback when absent. Search is conditional on usefulness and content scale.
Shared canonical contact information should support a Contact Page, Contact
Section, overlay/drawer/modal experience and clickable phone/email Actions without
duplicating global facts in each presentation.

## 12. Onboarding, measurement and optimization

**Core planned:** [progressive Review-to-launch onboarding](progressive-onboarding-and-launch-readiness.md),
including one reused information model, conditional questions, operator-approved
Review and private Web delivery, commercial gate, understanding confirmation,
targeted gaps, one Presence Direction/Home concept and final go-live approval.
Free Review implementation is not added here. Provider-task/access automation and
richer analytics may mature later; critical lead delivery, security and basic
first-party measurement must not be hidden behind that deferral.

**Core planned:** [Conversion Architecture](conversion-architecture.md) between
Business Knowledge and Page/content planning: a Site Conversion Brief, materially
necessary Offering/intent/relationship profiles, inherited defaults/overrides,
Page conversion roles, CTA hierarchy, Conversion QC and measurement-step mapping.
Existing Action destinations and isolated C0 CTA refinement are foundations, not
that reusable workflow. Intent is primary; urgency is an attribute. Sophisticated
recognition, automatic relationship detection, dynamic journey weighting and
adaptive personalization remain future, not launch dependencies.

The [opportunity and optimization model](opportunity-and-optimization-model.md)
defines **Core planned** customer-specific opportunity persistence/prioritization,
maintain/watch/intervene assessment, effort budgeting, explainable recommendations,
measurement contracts, post-action evaluation and customer-specific learning.
Content is one response, not a quota; capacity and lead quality constrain sustainable
growth. Existing Actions/rendering and Contact hooks do not implement these workflows.
Advanced Campaign automation, aggregate learning, category benchmarking,
learning-driven weights and predictive scoring remain **Optional/later**, with
privacy/legal review before cross-customer learning. No new service tier is implied.

**Core planned:** conditional guided onboarding, ongoing direct updates to global
business knowledge, the preferred-primary/fallback measurement hierarchy and a continuous
measure → analyze → recommend → approve/implement → measure-again loop.
Operator-assisted intake can support initial production sales before full
customer self-service automation. First-party measurement is primary in V1.
External traffic and organic-search evidence can enrich reports. Direct leads and
customer feedback remain distinct. The core service works independently of Google. The
[measurement architecture](measurement-and-analytics.md) defines source priority,
normalized signals and explicit fallback reporting. Service-account
access is an unproven near-term spike; GBP reporting remains future optional scope.

AI/API assistance belongs behind a provider-neutral intelligence boundary for
intake interpretation, analytics summaries, opportunity detection, content/Article
recommendations and drafting, metadata, internal links and controlled proposals.
Approval is first-class customer/service policy and can vary by operation.
Canonical business facts must never be autonomously invented or silently changed.
See the [operating model](onboarding-optimization.md) for protected facts, event
scope, approval examples and the native publishing workflow. None of these
planned workflows is claimed as implemented by current operator tooling.

## 13. Bounded platform/service policy

**Core planned:** validated operational/product settings with conceptual layers
of platform default, operator/service policy, and Web Presence / Managed Site
override where allowed. Distinguish a capability from its current recommendation,
default, soft maximum or enforced limit. Avoid arbitrary hard limits unless
technology, economics, safety/abuse or service constraints justify them.

Examples include Gallery recommended item count/soft maximum, upload limits,
Navigation depth, Search policy, managed-video availability, revision retention,
client Flex Page access and automation/approval defaults. These are not arbitrary
CSS/design controls. A minimal typed precedence foundation is implemented for
the social-link capability flag with trusted service-level override permissions;
see [site policy](site-globals.md#bounded-platform-policy). The broader policy
settings and UI are not implemented; current code
limits (such as managed-object size limits) still apply. Allowed overrides must
respect enforced safety/service boundaries and protected business truth.

## 14. Ownership and operating principles

The [service operations model](service-operations-model.md) defines Standard/Expanded
Launch, continuous Ongoing, integration classification and attention-driven human
work. Complexity can scale within supported capabilities; customization is not
an Expanded Launch entitlement. Its scope/time ranges are planning guidance, not
platform limits or customer promises.

Customer ownership, usable export and easy exit/no lock-in remain product
principles, subject to explicit retention and offboarding policies. Export is
still gated by P5, not claimed as implemented. Full Presence, Adjunct and Campaign
share the same architecture; Customer 0 and Myomaton Customer #1 are proving
contexts, not separate product architectures.

Measure infrastructure and AI usage per customer. Human service minutes per
customer are a critical scalability metric, alongside business outcomes. Guided
operator-assisted onboarding allows selling before complete self-service.
Final pricing, 90-day promotion terms, Kickstarter plans and revenue forecasts
remain business/marketing experiments, not architectural requirements.

## Reusable v2 composition refinement

Implemented and accepted for the reusable checkpoint: six type-specific semantic compositions,
explicit statement-break with separate readable support, structural contrast and
secondary editorial surfaces, and initial-style staged Hero entrance. See the
[finite contract](visual-direction.md#finite-semantic-compositions). The disposable
operator presentation file uses existing structured content and palette primitives;
no customer-specific CSS, schema, arbitrary canvas or state transition is added.
The specific Myomaton v2 transition is applied and verified in development;
its customer choices remain separate from reusable profile defaults.


## Commercial presentation Phase 1

Implemented, pending human visual acceptance: explicit Visual Direction contract 2,
service-led grammar v1, optional arrival/service/evidence/assessment/editorial recipes
v1, three structural text Hero families, relationship v1 (stages/responsibilities/
scope), three conversion families, paired semantic palette roles, coordinated sans
typography and bounded global chrome. One resolved plan selects a separate renderer;
legacy state never passes through new recipes. See [the contract](visual-direction.md#commercial-presentation-contract-version-2).

Automated validation covers contracts, safety, determinism, responsiveness, contrast
pairs, containment, ownership, managed bytes and exact legacy regressions. Human
review assesses business appropriateness, expressive quality and brand fit.
Restrained-editorial fixtures remain functional tests, not proof of aesthetic range.

Phase 2 visual evidence collections, portfolio/media grammar and media/evidence-led
Heroes remain unimplemented V1 range work. Phase 3 technical-detail Sections,
specification/comparison structures and technical recipes remain unimplemented.
Review/onboarding/analytics/billing/hosting automation and launch remain deferred.

## Evidence-led commercial range

Service-led v3 is implemented and human accepted as MioPages' provisional **A Business
in Focus** direction. It adds coordinated Source Sans, graphic/layered service arrival,
continuing fields, annotated artifact/evidence FPO and graphic sign-off. This is
now represented in reviewed [canonical MioPages state](miopages-canonical-promotion.md),
with FPO production refusal and publication withheld. The bounded
[text draft foundation](content-authority-and-editing.md) exposes content authority,
not presentation controls. See [the acceptance record](miopages-business-focus.md).

Implemented opt-in service-led v2 includes a finite Source Editorial font-resource
system, semantic warm/brand/contrast palette relationships, acquisition navigation,
connected service stages with attached scope extensions, contextual light wordmark,
and preview-only explanatory FPO/artifacts. Normal production cannot render FPO.
Typography and structure express a recommended direction; automated tests prove
functional safety, not customer design acceptance. See [Visual Direction](visual-direction.md#evidence-led-commercial-grammar-v2).
General media/evidence-led Heroes, permission-aware visual evidence, portfolio and
media grammars remain near-term V1 requirements. Technical detail/specifications/
comparisons and technical recipe remain a separate V1 range slice; see the
[roadmap](deferred-architecture.md#evidence-led-commercial-presentation-range).
