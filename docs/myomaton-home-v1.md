# Customer #1 Home v1 operator transition

This is a one-time reviewed change to canonical customer state, not a platform
template or synchronizing seed. The normal future source is business knowledge
interpreted into structured customer state, then customer review/approval.
Editing, revisions, publishing and onboarding remain deferred.

Implementation does **not** execute the update. After separate execution approval,
the operator command is:

```powershell
npm.cmd run update:myomaton-home-v1
```

It loads `.env.local` and requires `DATABASE_URL`. It accepts no force, reset,
alternate customer, or content arguments. Seed, customer bootstrap and photograph
bootstrap are unchanged and do not import this operation. PostgreSQL owns the
result; future edits must not be applied by changing this transition definition.

## Reviewed live baseline (2026-10-01)

The frozen JSON evidence retains historical `microsites` / `microsite_id` keys.
`home-v1-baseline-adapter.ts` projects only those identifiers to `managed_sites` /
`managed_site_id` in memory. The original file, customer values and expected-state
guards remain unchanged. The operator queries the renamed schema and therefore
requires [migration 0006](managed-site-rename.md) before future execution.

Read in PostgreSQL repeatable-read, read-only transactions. All listed records
are active. There are no material differences from the repository baseline.
CTA version 2 is the existing first-class Action conversion, not a conflict.

| Identity | UUID |
| --- | --- |
| Myomaton Web Presence | `1b72cd7d-92b9-4f55-aba6-825d69d493af` |
| Myomaton Managed Site | `7fd60824-a933-401d-8099-7b64f24cc408` |
| Home Page (`/`) | `fd7bdc57-c9b7-4274-b871-43cf2e9b09ee` |
| Photograph Asset | `eb1ea754-2f6d-4514-bf42-f4781f5f1d80` |
| Introduction image AssetUsage | `9475a91c-e0ad-4373-b5e9-65ca6fe649e7` |

| Section UUID | Internal name | Type / variant | Order | Current content |
| --- | --- | --- | --- | --- |
| `6c763a29-4404-4fe7-be6f-ab60de3bfcbe` | Hero | hero / default | 0 | Myomaton; Open practical robotics for everyday life. |
| `680318d0-a606-4d70-af92-1b5a69735ca6` | Introduction | intro / default | 10 | Robots we can understand, repair, and make our own.; practical, affordable robotics around open systems and real-world applications |
| `a0afbe15-927b-46f6-bb2b-474523124934` | Primary Call to Action | cta / default | 20 | Follow the project; Myomaton is being developed in the open.; existing Action reference |

The only Action is `d8a3924b-52af-41c7-b6c9-c4b3b41f035f`, internal name
**Learn about Myomaton**, label **Learn more**, type `section`, destination `#about`.
The only Subject is `abfcc180-4bcd-478b-8c3b-1f0fd3664ac3`, **Myomaton**, description
“An open practical robotics project.” Its active `project` Subject Type is
`4a1cf484-bfc3-4e3d-baee-0882353a6590`. TaBot and A-Bot are absent.

Primary Navigation is `9dfdb35b-ef37-4656-b56e-1468b5ba9690`:

- Order 0: **About**, item `4d8b5c08-534e-4566-ac8d-8a84351d2b13`, targets Introduction by Section UUID.
- Order 10: **Learn more**, item `258a8640-91a8-49de-a0be-fca753937494`, targets the existing Action by UUID.

The image usage has entity type `section`, Introduction as entity UUID and role
`image`. The Asset is the managed 1448 × 1086 PNG **Tabot robotics hardware**.
The reviewed source key, alt text and other guard fields are in the frozen
[baseline](../scripts/customer-updates/myomaton-home-v1-baseline.json).
Neither the Asset/usage records nor photograph bytes are written by this operation.

## Proposed records

| Order | Internal name / displayed heading | UUID | Type / variant |
| --- | --- | --- | --- |
| 0 | Hero / Myomaton | `6c763a29-4404-4fe7-be6f-ab60de3bfcbe` (retained) | hero / default |
| 10 | Ownership / What does "My Own Robot" mean? | `7cb671bc-8d5b-423e-bd17-87922bd5f9b0` | intro / stack |
| 20 | Introduction / Build. Test. Learn. Repeat. | `680318d0-a606-4d70-af92-1b5a69735ca6` (retained) | intro / split-text-first |
| 30 | Current Projects | `c6cf2724-3fc4-49ab-9ccd-134ab614c423` | collection / grid (2 columns) |
| 40 | Robot Ecosystem / More Than One Robot | `9d7472fd-f453-4690-8596-fd3e57c9ddca` | intro / stack |
| 50 | Principles / What makes something Myomaton? | `1d8815d4-147a-4f27-8e2b-65ca703e024e` | collection / grid (3 columns) |
| 60 | Physical Experimentation / Reality is an excellent design review | `07d7c37b-4345-4721-9f70-4a8c8b935d53` | intro / stack |
| 70 | Sharing / Share what proves useful | `e79a7b8f-a8f9-4da7-9c7a-a8424464d4e3` | intro / stack |
| 80 | Primary Call to Action / See what happens next. | `a0afbe15-927b-46f6-bb2b-474523124934` (retained) | cta / default |

Hero uses `eyebrow: My Own Robot`, with the question and proposition in plain
`text`. Paragraph separators are stored as double newlines, not HTML. The shared
plain-text renderer presents intentional blank-line breaks as separate escaped
paragraphs, including collection introduction and card text. Stored copy is unchanged.

Current Projects has anchor `current-projects`. Its items `project-001` and
`project-002` store only Subject references. Missing Subjects use reserved IDs:
TaBot `5a07b8d7-a388-48c4-9bc5-9b4b575d33cd`, A-Bot
`845c03b7-cd6d-4cc4-b6a5-de98893cc057`. Matching existing Subjects keep their IDs,
versions and metadata. Different descriptions, types, status, configuration,
reserved-ID conflicts or ambiguous names require review; none are overwritten.
Principles use five inline items `principle-001` through `principle-005`.

The Hero Action is **See what we're building**, type `section`, destination
`#current-projects`, reserved ID `af558c75-18b1-44b5-9c79-d14a7a66e13f`.
The existing Action model stores a validated fragment destination; it has no
Section-UUID destination field. Equivalent existing Actions are reused; conflicts
refuse. No routing system or project detail Pages are introduced.

**YouTube destination is unconfirmed.** Neither repository nor canonical customer
state supplies one. Customer confirmation is needed before execution if a linked
YouTube CTA is required. This reviewed operation leaves the CTA valid without an
Action and reports that omission. It never infers a URL or auto-adopts one added
later. Adding that destination requires a separately reviewed change.

The old Learn more Action loses its CTA reference but remains referenced by
Primary Navigation and retains destination `#about`; it is not obsolete.
The new Ownership Section (`7cb671bc-8d5b-423e-bd17-87922bd5f9b0`) owns `about`.
Retained Introduction loses that anchor. The existing About Navigation item
(`4d8b5c08-534e-4566-ac8d-8a84351d2b13`) changes only target reference to Ownership,
version from 1 to 2, and update time, in the same transaction. Its identity, label,
order, configuration and metadata remain unchanged. All other Navigation stays intact.

## Guard and transaction behavior

- One checked-out PostgreSQL connection owns BEGIN/preflight/writes/COMMIT;
  errors roll back. All validation completes before the first write.
- A short `SHARE ROW EXCLUSIVE` lock on the eleven inspected tables protects
  against concurrent inserts, changes and deletes, including uncoordinated
  writers. This is a maintenance operation: it temporarily blocks writers across
  customers, while ordinary readers remain available. Lock timeout is 5 seconds,
  statement timeout 30 seconds, with no automatic retry. It reads these small
  development tables to detect global reserved-ID collisions.
- Checks include known ownership/identity, active status, reviewed reference
  records, Navigation, Asset and usage, and all Home Sections including inactive
  ones. Extra Sections, replacement UUIDs, ambiguous identities and polymorphic
  usage conflicts refuse. Configuration and versions are checked conservatively.
- Home must be the complete three-record baseline or complete nine-record result.
  Mixed/partial transitions and later removal/customization refuse, never repair.
  Navigation must match the same baseline/result phase as Sections; partial anchor
  moves and the superseded Home v1 anchor arrangement refuse. A complete result
  with missing Subjects/Actions also refuses restoration.
- The three retained Sections update content, variant, order, version and
  update time; Introduction also removes its reviewed `about` configuration key.
  Versions become Hero 2, Introduction 2, CTA 3. Names, UUIDs,
  other configuration, metadata and creation times remain unchanged. Metadata and
  timestamps are excluded from comparison because they are not update authority.
- New records have durable reserved identities, active status and version 1.
  Baseline execution creates six Sections, two Subjects and one Action. Exact
  rerun does zero INSERTs/UPDATEs and leaves all timestamps unchanged. No deletes,
  upserts, Asset writes, permanent completion flag, migrations or history tables.
- Unrelated records are left untouched. The frozen baseline and approved copy
  must never be refreshed automatically from whatever state happens to exist.

## Verification and architecture assessment

The later [secondary Pages transition](myomaton-secondary-pages-v1.md) deliberately
changes Navigation. After it is applied, this historical Home v1 updater is
expected to refuse the evolved state. Its original guards and baseline remain
frozen; do not broaden them to accept subsequent customer transitions.

`tests/myomaton-home-v1.test.tsx` executes the real planner and SQL writer against
an isolated in-memory SQL fixture. It covers all conflict/preservation cases,
Subject/Action reuse, rendering normalization, exact no-op, and forced rollback
at every one of the thirteen write steps (including the About Navigation update).
It opens no database connection. This proves transaction control flow, not PostgreSQL lock/constraint execution.

The live database was inspected read-only before and after implementation.
All public-table data and the six-row Drizzle migration journal were unchanged.
No real updater, seed, bootstrap, migration or PostgreSQL mutation test was run.

Deferred-register assessment: this satisfies the bounded P1 customer-state writer
gate using explicit expected-state refusal; P1 remains ongoing. P2/P3 customer
editing/provenance/revision/publishing and future onboarding are not complete.
There is no new Asset attachment/lifecycle writer or Content Engine work, and no
new deferred architecture requirement was exposed.
