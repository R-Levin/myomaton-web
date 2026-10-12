# MioPages C0 guarded development transition

The operator authorized and applied this transition to **real development MioPages**
on 2026-10-12 after the preparation and scaffolding correction described below.
This is not public publication or operational workflow activation. The reviewed
transition tooling/documentation is checkpointed only after post-application validation.
Authority is accepted commit `847c5754dcaf83426938e570ac73076757197b63`,
`Finalize MioPages C0 revamp preview`; see the [accepted checkpoint](miopages-c0-checkpoint.md).

Before preparation, HEAD/main/local origin/main and live origin/main all matched
that commit; index/tree were clean. Read-only complete real-state fingerprint:
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
All nine migration rows and five managed Asset objects were read and verified.

## Authority and mechanism

The [specific transition](../scripts/customer-updates/miopages-c0-revamp.ts) consumes
the [consolidated accepted builder](../scripts/customer-previews/miopages-c0.ts) and
pins the [accepted manifest](../scripts/customer-previews/miopages-c0-accepted.json)
fingerprint. It never reconstructs historical intermediate preview scripts.
The old graph is the committed canonical promotion's exact `after` graph.
Other-customer/migration state is pinned to that promotion's preservation digest.
The entire complete old customer state must match the known baseline; only the
exact resulting MioPages graph with that same preserved remainder is a retry.

This follows the established [Myomaton v2](../scripts/customer-updates/myomaton-visual-direction-v2.ts)
and [MioPages promotion](../scripts/customer-updates/miopages-focus.ts) pattern:
one transaction, bounded table/column allowlists, locks covering row drift and
phantoms, UTC, lock/statement timeouts, parameterized typed rows, exact predecessor
row predicates, complete postcondition, rollback on any failure. Unexpected old,
partial, foreign, migration or post-application state refuses without repair.
After success, retry performs zero inserts/updates/deletes. No force/sync mode.

Business payloads use the existing canonical normalizers and preserve original
approved evidence and approval identities. Knowledge and integrated Offering each
advance from version 1 to 2 with an immutable revision; original revision 1 remains
exact. This bounded frozen transition writes deterministic current/revision pairs
directly, rather than use the ordinary writer's random execution-time audit values.
Revision snapshots follow [canonical writes](../lib/platform/canonical/writes.ts),
including normalized dates and Offering related AssetUsage. The ordinary canonical
writer's exact retry validates both resulting pairs in PostgreSQL tests. The fixed
`preparedAt` is a transition preparation timestamp, not a claimed application or
new customer approval timestamp. No applied-state receipt is added to customer data.

The [dry-run runner](../scripts/prepare-miopages-c0-transition.ts) has **no real apply
flag**. Its [fixture](../scripts/customer-previews/miopages-c0-transition-fixture.ts)
always creates a fresh random schema, clones both customers and a private copy of
all migration rows, copies all managed bytes into a temporary root, and redirects
every transition query/lock to that schema. The real source pool is read-only.
Disposable servers are read-only. Cleanup drops only the self-created schema.

```powershell
node --env-file=.env.local --import tsx scripts/prepare-miopages-c0-transition.ts
# Optional desktop/mobile inspection; stop with Ctrl+C to drop only its fixture:
node --env-file=.env.local --import tsx scripts/prepare-miopages-c0-transition.ts --serve
```

Ignored evidence is written to `runtime-content/miopages-c0-transition/report.json`
and `exact-diff.json`. The latter includes every predecessor/successor row, changed
field and addition. These are output, never durable source or commit candidates.

## Identity and visitor state

PRESERVE describes identity retention, which also applies to every UPDATE/RETIRE.
UNCHANGED means the entire row remains byte-equivalent in the state snapshot.
No existing record is deleted or recreated. Knowledge, integrated Offering, Home,
`/service`, `/experience`, `/review`, all three existing Actions, primary Navigation,
all three original navigation items, all 23 original Sections and both logo
Assets/usages retain their IDs. Accepted Sections intentionally evolve existing
records, including moves from Service/Experience to the new informational Pages.
Some canonical-bound Sections become accepted inline editorial compositions; their
IDs remain and the canonical business records/history remain authoritative.
Unused original Actions remain exact history; none exposes `/experience`.

Four Pages are added with the accepted stable IDs: `/what-you-get`,
`/getting-started`, `/faq`, `/start`. Seven Pages are active. Navigation has five
active items in accepted order: Why MioPages?, What You Get, How It Works,
Questions & Answers, Get Your Free Review. Review is last/highlighted. Home remains
through the logo; Start is contextual. No additional Navigation record is created.

`/experience` becomes inactive using the established Page status. Its former nav
item becomes inactive; its former Action evolves to Why MioPages? → `/service`.
Useful historical identities are retained, including its accepted inactive-Page
Hero. Section status alone does not imply visitor visibility: 37 Sections have
active row status, but only 36 are under active Pages. Two other historical Section
rows are explicitly inactive. Production requirement before public launch, if
redirect continuity is needed: **`/experience` → `/service`**. No redirect machinery
is introduced here; current inactive routing returns 404.

## Canonical intent versus disposable scaffolding

Accepted R3 content and subsequent CTA/IA wording, Page titles, section order,
compositions, Navigation, Review and Start explanations are retained exactly,
except for the explicitly authorized removal of disposable Review scaffolding.
The exact Home Hero remains: **Help the right people find you online. Make
contacting you a breeze.** Home Review is primary, direct Start secondary, assistance
subordinate. How It Works remains informational. Fifteen original R3 FAQ answers
remain governed by the accepted source and existing regression coverage.

Disposable `c0Preview` metadata receipts are omitted. The operator subsequently
authorized treating both Review controls and their specific explanation as
preview-only scaffolding. At the transition mapping boundary, exactly three fields
are removed: `previewControlLabel` on the Review Hero and lower conversion Section,
and the lower Section's `text`, exactly **“This preview control is disabled. No
information is collected or submitted.”** The original accepted manifest and
preview builder remain unchanged, so the isolated development preview can still
show both disabled, non-submitting controls and its explanation.

Canonical/post-transition content contains neither control labels nor this
explanation; production-safe and explicitly gated transitioned rendering both omit
them. All other main/header/footer HTML remains identical to the accepted preview.
No runtime gate is broadened and no workflow is enabled. Cost-free Review, prospect
inputs, Review outputs, no paid commitment, direct Start and the informational
Review/Start relationship remain exact. Unrelated approved Start commercial-stage
text retains “No final prices or terms are offered in this preview.” No stale
“Development preview” label or removed generic disclosure is reintroduced.

Existing unresolved visual metadata remains exact; no FPO, quarantined candidate,
new production Asset or AssetUsage is introduced. Production-safe omission of
unresolved visuals remains permitted and does not revoke visual-direction
acceptance. The Visual Direction and Design System rows remain unchanged.
No submissions, prospect persistence, entry-state detection, data reuse, payments,
onboarding, assistance workflow or customer publication is implemented.

## Verification

Focused [unit tests](../tests/miopages-c0-transition.test.tsx) cover bounded identity
preservation, deterministic source equivalence and refusal of incomplete graphs.
The [PostgreSQL test](../tests/integration/miopages-c0-transition.test.ts) checks:
first/final-write rollback including immutable revisions; unexpected baseline and
post-state refusal; foreign collision refusal; exact old-to-new application; zero
write retry; canonical writer compatibility; other customer/migration/AssetUsage
preservation; all five managed byte objects; and all seven rendered routes.
It independently reconstructs the accepted preview through its existing fixture,
then compares main and both navigation trees exactly against transitioned state,
permitting only removal of the two gated buttons and their one specific explanatory
paragraph. Canonical structured-state comparison independently proves the exact
three-field removal and no other copy changes.

The preparation required explicit authorization before real application; that
authorization was subsequently supplied. Per-record inventory and historical
preparation results follow; current application results are recorded at the end.

## Exact planned inventory

| Table | Current | Planned | Update | Retire/inactivate | Add | Unchanged |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| organizations | 1 | 1 | 0 | 0 | 0 | 1 |
| web_presences | 1 | 1 | 0 | 0 | 0 | 1 |
| managed_sites | 1 | 1 | 0 | 0 | 0 | 1 |
| design_systems | 1 | 1 | 0 | 0 | 0 | 1 |
| pages | 4 | 8 | 3 | 1 | 4 | 0 |
| sections | 23 | 39 | 21 | 2 | 16 | 0 |
| actions | 3 | 9 | 2 | 0 | 6 | 1 |
| navigations | 1 | 1 | 0 | 0 | 0 | 1 |
| navigation_items | 3 | 6 | 2 | 1 | 3 | 0 |
| subjects | 0 | 0 | 0 | 0 | 0 | 0 |
| subject_types | 0 | 0 | 0 | 0 | 0 | 0 |
| assets | 2 | 2 | 0 | 0 | 0 | 2 |
| asset_usages | 2 | 2 | 0 | 0 | 0 | 2 |
| contact_definitions | 0 | 0 | 0 | 0 | 0 | 0 |
| contact_submissions | 0 | 0 | 0 | 0 | 0 | 0 |
| business_knowledge | 1 | 1 | 1 | 0 | 0 | 0 |
| business_knowledge_revisions | 1 | 2 | 0 | 0 | 1 | 1 |
| offerings | 1 | 1 | 1 | 0 | 0 | 0 |
| offering_revisions | 1 | 2 | 0 | 0 | 1 | 1 |

Totals: **34 updates (including four retirements), 31 additions, zero deletions**.
All existing identities are PRESERVE; UNCHANGED counts distinguish exact untouched rows.

### Exact affected record identities and fields

| Table | Identity | Class | Route/name or revision | Changed fields |
| --- | --- | --- | --- | --- |
| pages | 16a9ec53-f447-4dac-a968-b165f0dc1531 | UPDATE | /service | name, title, version, updated_at, configuration |
| pages | 56e8802d-f643-4a95-93db-e683a27e8186 | UPDATE | /review | name, title, version, sort_order, updated_at, configuration |
| pages | 5c147663-3a34-4708-943f-bf34b3d3ea14 | RETIRE / INACTIVATE | /experience | name, title, status, version, sort_order, updated_at, configuration |
| pages | f4155bb3-e2a0-4db1-b88f-9ec55de5af0d | UPDATE | / | version, updated_at, configuration |
| sections | e00562b2-9ef8-4ff5-8857-5cd3631f2200 | UPDATE | What Is MioPages?: Your business, clearly presented. Your web presence, looked after. | name, content, version, updated_at, configuration |
| sections | e5b72ca3-6deb-427e-8fde-a1700f9e388d | UPDATE | What Is MioPages?: Start with what makes your business worth choosing. | name, type, content, variant, version, updated_at, configuration |
| sections | 1f27f21c-9ed9-4c46-a154-6987cc93e31c | UPDATE | What You Get: A presence that works together. Support that continues. | name, type, content, page_id, version, sort_order, updated_at, configuration |
| sections | ea8920d3-c629-4f1e-9cd3-a8c4d4dec113 | UPDATE | What You Get: A clear foundation for discovery and enquiries. | name, content, page_id, version, sort_order, updated_at, configuration |
| sections | 4029e8f7-69c2-4808-9cd9-3f875eb445b3 | UPDATE | Getting Started: From business knowledge to an agreed direction. | name, type, content, page_id, variant, version, sort_order, updated_at, configuration |
| sections | fb79e5af-9199-440b-95c6-d13467c94742 | RETIRE / INACTIVATE | reviewed-focus-5 | status, version, updated_at |
| sections | 1d156d4e-27d1-4f2b-89e3-17ac2721f21c | UPDATE | Questions & Answers: Ownership, trust and the next step. | name, type, content, page_id, variant, version, sort_order, updated_at, configuration |
| sections | e09e1f2f-96bb-4e44-8d9b-324dbae2a386 | UPDATE | What Is MioPages?: See what the relationship includes. | version, name, sort_order, content, configuration, updated_at |
| sections | 4af04629-9b7a-4ffd-b6b3-322af962ee5d | UPDATE | Web Presence Review: Find the next useful step for your web presence. | name, content, version, updated_at, configuration |
| sections | 831fd96b-52cc-41ac-91b3-0c9472cbeda5 | UPDATE | Web Presence Review: Useful clarity before a paid commitment. | name, content, version, sort_order, updated_at, configuration |
| sections | 4d95d0d8-0a1b-4202-90ed-f8870b6355aa | UPDATE | Web Presence Review: Enough context to make it relevant. | name, content, variant, version, sort_order, updated_at, configuration |
| sections | e4de122b-13f4-47c0-ad16-cb6c7f6f6655 | UPDATE | Web Presence Review: A clear boundary between free and paid work. | name, content, version, sort_order, updated_at, configuration |
| sections | 9944bdd0-58a2-431a-8bda-bca8cec181c3 | UPDATE | Web Presence Review: See what would happen next. | version, type, variant, name, sort_order, content, configuration, updated_at |
| sections | e7d1b2aa-1257-4a47-9cdc-0d79da12f6e8 | UPDATE | Why MioPages?: Put experience to work. Keep the work focused. | name, content, version, updated_at, configuration |
| sections | fd416786-38fb-46f4-9b96-104a4f5527f7 | UPDATE | Why MioPages?: Judgment where it matters. Less repetition everywhere else. | name, content, page_id, version, sort_order, updated_at, configuration |
| sections | 1d5f4429-d66b-4229-a53a-bcbb633afafe | UPDATE | Why MioPages?: A different way to organize the work. | name, type, content, page_id, variant, version, sort_order, updated_at, configuration |
| sections | 07ce2622-c610-405c-bc63-bde141651795 | UPDATE | Why MioPages?: Design should help people understand and act. | name, content, page_id, variant, version, sort_order, updated_at, configuration |
| sections | a66098d7-b693-4fd1-8bfb-c834da1d226f | RETIRE / INACTIVATE | reviewed-focus-4 | version, status, updated_at |
| sections | cce9affd-4875-477e-9848-da52eec40826 | UPDATE | Home revamp 1 | name, content, version, updated_at, configuration |
| sections | c18776da-f19a-481a-a239-6644eda51f94 | UPDATE | Home revamp 2 | name, type, content, variant, version, updated_at, configuration |
| sections | d67c9c6b-b15e-4e8b-9e76-015701386fdb | UPDATE | Home revamp 4 | name, type, content, variant, version, sort_order, updated_at, configuration |
| sections | 8052f100-3265-4e63-b3a2-d4f4b69642e4 | UPDATE | Home revamp 3 | name, content, variant, version, sort_order, updated_at |
| sections | 7e089212-fae6-4090-8986-e5f30c803e1c | UPDATE | Home revamp 6 | version, name, sort_order, content, configuration, updated_at |
| actions | 19aaf955-92fe-47cc-870e-01465f9eab09 | UPDATE | see-experience | label, version, updated_at, destination |
| actions | ba6ee5af-ebce-4529-8072-dd0a1ecadc6f | UPDATE | request-review | label, version, updated_at |
| navigation_items | 5a84f6c4-7fd7-4f85-9642-86d29d5bd340 | UPDATE | Review | label, version, sort_order, updated_at |
| navigation_items | cd92fb3c-0e28-4758-8e4c-8b54476c3c8e | UPDATE | What Is MioPages? | name, label, version, updated_at |
| navigation_items | f21c42e0-7c82-4ffd-b8ac-5e3471cdfe9e | RETIRE / INACTIVATE | Experience | status, version, updated_at |
| business_knowledge | 3b233b77-a935-4d7c-9133-949760cb3116 | UPDATE |  | payload, version, updated_at |
| offerings | ad9aa219-0cd2-4d8c-b707-739eee07d60c | UPDATE | Managed Web Presence | payload, version, updated_at |
| pages | b67ad2da-e72a-4ab8-b603-bbd8db5464d5 | ADD | /what-you-get | new row |
| pages | 84c76c34-6207-42d0-9ca1-9387c8e8f78b | ADD | /getting-started | new row |
| pages | c74fa19e-3e8a-451a-8fa7-a8fa7fa25d12 | ADD | /faq | new row |
| pages | b0bf642c-a4bc-4568-ba42-fcbff2628116 | ADD | /start | new row |
| sections | 3b03cf8f-ca8a-4a40-ac1f-5202c2c2fa58 | ADD | Home revamp 5 | new row |
| sections | e083a053-5ea2-4dc1-ae67-d74660bc14fc | ADD | What You Get: After launch, the work stays connected to your goals. | new row |
| sections | c597c6e6-63e1-4bc8-8257-9ddd8627fc84 | ADD | What You Get: Agree the scope before the work begins. | new row |
| sections | fbe323bb-fcde-4edc-9ea7-759ed9522ce3 | ADD | Getting Started: Begin with a clearer view of what you need. | new row |
| sections | b8bf111c-2394-4381-9aa6-9966377374f0 | ADD | Getting Started: Two ways to begin. The same considered service. | new row |
| sections | fac8d1de-702a-4290-b305-ae9e10810cf5 | ADD | Getting Started: Launch is the beginning of the relationship. | new row |
| sections | 267b46a6-105b-4d14-8d4b-2fe171834c94 | ADD | Review: primary preview conversion | new row |
| sections | 0775ed85-a954-436b-87aa-3070325b3cb4 | ADD | Review: direct-start alternative | new row |
| sections | 1cf779a6-1f31-4080-8e82-68970b1dc85a | ADD | Questions & Answers: Practical questions. Straightforward answers. | new row |
| sections | 5cab8ff3-34cf-4e40-97ed-7a4df79a3e15 | ADD | Questions & Answers: Keeping the presence useful. | new row |
| sections | 7a5795b5-d5bf-414f-ae52-e8978961b8ac | ADD | Questions & Answers: Existing websites and connected services. | new row |
| sections | b3fd732f-0351-4e04-b80a-ba3a55d440c6 | ADD | Questions & Answers: Your involvement and the service model. | new row |
| sections | 6f26a264-db54-4b8e-a611-a418bb80c589 | ADD | FAQ: Free Review next step | new row |
| sections | a077eb28-b0cd-48d8-84fe-5f79479ebeed | ADD | Start MioPages: entry | new row |
| sections | 94561089-d6f1-4396-9080-920e48b1b013 | ADD | Start MioPages: known information | new row |
| sections | e1ed4ba1-0093-47d2-ac33-e251155f0b92 | ADD | Start MioPages: progressive journey | new row |
| actions | 3518dc28-9324-4af6-bf15-f6a21f6f7a6c | ADD | conversion-10 | new row |
| actions | 375db6fd-a4cb-44c2-83ca-ab898f6fb10c | ADD | conversion-9 | new row |
| actions | 426c5333-34ab-44ca-b9f6-246111c85741 | ADD | conversion-11 | new row |
| actions | 8476824c-b1fe-47e7-a78f-32572f9a36fd | ADD | preview-13 | new row |
| actions | 8ff0544b-60b3-4e23-87c0-e3837dc0e9af | ADD | conversion-12 | new row |
| actions | c79ba04e-22ed-401b-93cf-97dc0e796699 | ADD | explore-start | new row |
| navigation_items | 1b7e0ff3-f022-48a0-bc94-6f45f5a4d44b | ADD | What You Get | new row |
| navigation_items | fa49d5ec-784a-4753-ae25-e23da235beb0 | ADD | Getting Started | new row |
| navigation_items | c893b7c2-e355-48a2-b365-fdefb9c8e0b7 | ADD | FAQ | new row |
| business_knowledge_revisions | 3b233b77-a935-4d7c-9133-949760cb3116:2 | ADD | revision 2 | new row |
| offering_revisions | ad9aa219-0cd2-4d8c-b707-739eee07d60c:2 | ADD | revision 2 | new row |

### Exact unchanged identities

| Table | Identity | Class |
| --- | --- | --- |
| organizations | 152aebd3-00b3-4296-a64e-e281522e64f0 | UNCHANGED / PRESERVE |
| web_presences | 926cb772-7507-4542-8acd-e7e57ce71324 | UNCHANGED / PRESERVE |
| managed_sites | 312b8081-4582-47fa-bedb-a551fd6e2b36 | UNCHANGED / PRESERVE |
| design_systems | 4e047506-49e0-45ea-b161-b96d54d27dc2 | UNCHANGED / PRESERVE |
| actions | d6f20426-e80f-4f50-b838-9b7b144cf81b | UNCHANGED / PRESERVE |
| navigations | 1a398908-7e8d-4052-a966-fa8f0e35c7ee | UNCHANGED / PRESERVE |
| assets | 7be912cd-02f2-41f1-8499-fee93819b74e | UNCHANGED / PRESERVE |
| assets | 2ee36bbb-8c8c-486e-8f9b-812380f712d7 | UNCHANGED / PRESERVE |
| asset_usages | 7537f3bc-a9c9-40e8-806b-fd62f221b22c | UNCHANGED / PRESERVE |
| asset_usages | 0d09f932-73ea-497a-86e1-e6833fe8cfcb | UNCHANGED / PRESERVE |
| business_knowledge_revisions | 3b233b77-a935-4d7c-9133-949760cb3116:1 | UNCHANGED / PRESERVE |
| offering_revisions | ad9aa219-0cd2-4d8c-b707-739eee07d60c:1 | UNCHANGED / PRESERVE |

## Historical preparation results

Initial preparation passed **215 standard tests** and full lint. After the bounded
scaffolding correction, reran **eight focused unit/rendering checks**, **six guarded
PostgreSQL checks** (parent plus five subtests) and **twelve existing PostgreSQL
regression checks** for canonical establishment, promotion and the accepted
preview; affected-file lint; standalone type-check; documentation link checks;
strict UTF-8/replacement-character/whitespace checks; `git diff --check`. Zero test skips.
Compiled runtime files are untouched; rendered tests reuse the accepted production
build. No production rebuild was needed for this operator-tooling-only change.

During initial preparation, all seven production-safe Pages were checked at 1440px and 360px: no horizontal
overflow, stale Development preview labels, exposed `/experience` links or forms.
Mobile Navigation keeps Review last and its clicked link reaches `/review`.
Initial screenshots and DOM metrics remain ignored historical evidence. Following
the correction, independent accepted/transitioned render comparison passes on
every Page with exactly the authorized removal of two controls and their one
explanatory paragraph. Production-safe `/review` has no missing/disabled-control
reference. The documented discrepancy is resolved; no other approved copy changed.
Ignored `scaffolding-correction.json` compares the prior planned graph field by field:
only the three specified fields changed, with every other planned field exact.

Final read-only real fingerprint remains:
`4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`.
Real MioPages still matches the **pre-transition** canonical promotion exactly.
Myomaton, all other customers, all nine migration rows, all five managed objects
and their before/after byte hashes remain unchanged.

Disposable planned MioPages-only fingerprint:
`46bac90be54a93030525032805c61f6b1abb17c3d9c557d91f371459691ccf8b`.
Disposable complete post-transition fingerprint (including unchanged other state):
`5bc262817185f533992f8af139eef0dba1edb6dd655c62849d66bf395ded9275`.

Preparation-time review servers were read-only and isolated:
`http://127.0.0.1:65138/` (transitioned state with disposable gate) and
`http://127.0.0.1:65148/` (production-safe). Both omit scaffolding. They belong to the dry-run runner's
fresh schema; stopping that runner removes only its disposable state. The accepted
preview at `http://127.0.0.1:62349/` remains separate and unchanged.

At the end of preparation, exactly six new files were untracked and unstaged:

- `docs/miopages-c0-transition.md`
- `scripts/customer-updates/miopages-c0-revamp.ts`
- `scripts/customer-previews/miopages-c0-transition-fixture.ts`
- `scripts/prepare-miopages-c0-transition.ts`
- `tests/miopages-c0-transition.test.tsx`
- `tests/integration/miopages-c0-transition.test.ts`

At that preparation checkpoint, no tracked files were modified, the index was
empty and HEAD/main/origin/main were at `847c575`. No real application occurred
until the subsequent explicit operator authorization.

## Real development application

Preconditions verified before writing: HEAD/main/live origin/main were exactly
`847c5754dcaf83426938e570ac73076757197b63`; no unrelated dirty paths or staged
files; real fingerprint matched the frozen predecessor; reviewed transition
successor and exact update/insert lists matched the corrected dry-run artifact.
All nine migration rows and all five managed byte hashes matched their baseline.

Applied exactly **34 updates, 31 additions, zero deletions** through the reviewed
atomic guarded transition. Every existing customer identity remains present.
Actual MioPages graph equals the complete approved successor, with no adaptation.
The second execution returned `changed: false`, `updated: 0`, `inserted: 0`,
`deleted: 0`; its before/after fingerprints are identical.

Complete real-state fingerprints:

- Before: `4758d79cea7a0ecb9019cc59b4fd8d824c2c8bdb845c37552e1b019c491cb980`
- After: `5bc262817185f533992f8af139eef0dba1edb6dd655c62849d66bf395ded9275`
- MioPages-only after: `46bac90be54a93030525032805c61f6b1abb17c3d9c557d91f371459691ccf8b`

Myomaton and every other customer remain state equivalent; all nine migration
rows, five managed Asset objects/byte hashes, Assets and AssetUsage rows remain
unchanged. Business Knowledge/Offering IDs and original revisions remain intact,
with the expected version-2 revisions. Page/Section/Action/Navigation identity and
inactive-history treatment are exactly as inventoried above. `/experience` is
inactive/404 and unlinked; no redirect infrastructure is introduced.

### Historical fixture continuity

After real application, disposable tooling recognizes only the exact guarded
predecessor or successor. The transition fixture reconstructs the frozen old graph
only inside its new schema, while verifying that real state remains at whichever
exact endpoint it began with. Its returned baseline uses PostgreSQL row order so
unchanged-row comparisons do not mistake ordering for a state change.

Two existing fixture files also require bounded continuity updates:
[accepted C0 fixture](../scripts/customer-previews/miopages-c0-fixture.ts) and
[historical disposable fixture](../scripts/customer-previews/disposable.ts).
They recognize the exact new graph through the unchanged real transition guard,
then reproduce their pinned historical sources only in self-created schemas.
They do not reset, repair or weaken guards on real state. This preserves original
isolated accepted-preview behavior, including its development-only controls,
without returning that scaffolding to canonical content.

The two historical preview regressions now compare disposable business rows with
their pinned historical source rather than live post-transition rows:
[business-focus regression](../tests/integration/business-focus-preview.test.ts)
and [original-preview regression](../tests/integration/miopages-preview.test.ts).
Their independent checks that real state remains unchanged are retained.

The final source boundary is the six preparation files listed above plus these
two existing fixture files and two existing regression tests: **ten files**.
Runtime application receipts,
before/after snapshots, validation logs and screenshots are ignored evidence under
`runtime-content/miopages-c0-application/`, never checkpoint source.

### Final validation and rendering

Passed after application: 215 standard tests (including the focused transition
tests), 20 PostgreSQL checks across six relevant suites, full lint, affected-test
lint, standalone type-check and production build. The guarded PostgreSQL suite
proves disposable application, exact successor, no-op rerun, baseline-drift
refusal and canonical-writer compatibility. Documentation links, strict UTF-8,
whitespace and Git diff checks also pass for the final ten-file source boundary.

All seven active real pages have identical main/header/footer HTML to the freshly
regenerated approved production-safe dry run. Exact structured copy, navigation,
CTA destinations and inactive `/experience` are checked. Desktop (1440px) and
mobile (360px) screenshots and DOM measurements show no clipping or horizontal
overflow on any of the seven pages. Review contains neither disposable controls
nor their disabled-control explanation; no stale Development Preview label is
rendered. The Review-to-Start link was also exercised in the browser.

The real development rendering remains available at `http://127.0.0.1:63962/`
using a read-only public-schema connection with preview gates disabled. This URL
is a local running-process endpoint, not a deployment. Screenshots and render
receipts are ignored local evidence. The original isolated accepted-preview
source and behavior remain reproducible through their historical fixture.

Final independent read-only verification reconfirmed the complete post-apply
fingerprint above, exact approved MioPages graph, unchanged other customers,
nine migration rows, Assets and AssetUsage, and all five managed objects. Managed
bytes match both the original receipt (canonical fingerprint of base64 bytes)
and their raw SHA-256 content addresses; an initial final-check command used the
wrong receipt hash representation and was corrected without modifying data.

Exact checkpoint inventory:

- [Transition documentation](miopages-c0-transition.md)
- [Guarded transition](../scripts/customer-updates/miopages-c0-revamp.ts)
- [Transition fixture](../scripts/customer-previews/miopages-c0-transition-fixture.ts)
- [Preparation runner](../scripts/prepare-miopages-c0-transition.ts)
- [Focused tests](../tests/miopages-c0-transition.test.tsx)
- [PostgreSQL transition tests](../tests/integration/miopages-c0-transition.test.ts)
- [Accepted C0 fixture](../scripts/customer-previews/miopages-c0-fixture.ts)
- [Historical disposable fixture](../scripts/customer-previews/disposable.ts)
- [Business-focus preview regression](../tests/integration/business-focus-preview.test.ts)
- [Original preview regression](../tests/integration/miopages-preview.test.ts)

### Deferred boundaries

Before public production, implement `/experience` → `/service` redirect handling
if required. Review submission, prospect persistence, direct-start persistence,
progressive Review→Start data reuse, payment, onboarding and operator assistance
remain non-operational. No Conversion Architecture documentation or Free Review
implementation is part of this transition.
