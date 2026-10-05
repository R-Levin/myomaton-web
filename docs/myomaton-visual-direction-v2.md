# Myomaton reference-v2 customer transition

**Applied and verified in the real development database on 2026-10-05.** Myomaton
now uses reference v2. The separately authorized operator run performed 35 updates,
zero inserts and zero deletes; the exact rerun performed zero writes. This is not
production deployment approval or a general permission to change customer state.

## Acceptance and ownership

Human visual acceptance was given for http://127.0.0.1:53866. The reusable runtime
checkpoint is `59223b8`, already committed and pushed. This transition changes only
structured customer choices needed to reproduce that accepted presentation; no new
platform capability, CSS, schema or migration is introduced.

The intended snapshot was captured directly from the accepted disposable schema
in a read-only transaction on 2026-10-05. It is frozen independently of the mutable
operator preview JSON. The baseline was separately captured from current public
reference-v1 state, also read-only, and checked against the applied historical v1 state.

## Frozen contract and guards

- [Frozen pre-v2 real-v1 baseline](../scripts/customer-updates/myomaton-visual-direction-v2-baseline.json)
- [Accepted intended-v2 state](../scripts/customer-updates/myomaton-visual-direction-v2-intended.json)
- [Guard and updater](../scripts/customer-updates/myomaton-visual-direction-v2.ts)
- [Explicit operator wrapper](../scripts/update-myomaton-visual-direction-v2.ts)

Every row/value/UUID/configuration/version/timestamp in all customer tables and all
eight migration journal entries is guarded. This includes organizations, presence,
site, Design System, Pages, Sections, Navigation/items, Actions, Subjects/types,
Assets/usages and Contact definitions/submissions. An extra foreign/unrelated row
also refuses this deliberately strict development baseline; it is never modified.

Only the full exact v1 baseline may change. The full exact v2 result is a zero-write
rerun. Partial, mixed or customized state refuses; there is no force/reset/repair.
Rows are compared by UUID, not array ordering. Short maintenance locks protect the
customer graph and migration journal, with 5s lock / 30s statement timeouts. Each
UPDATE also predicates on the complete original row. PostgreSQL types values using
its existing row types, and the complete intended state is verified before COMMIT.

Expected result: **0 inserts, 35 updates, 0 deletes** (29 Sections, three Actions,
one Managed Site, one Design System, one AssetUsage). All existing timestamps,
versions and metadata remain exactly as accepted in the preview; no trigger-like
version/timestamp increment is invented. Forced failures, row-count mismatch or
postcondition mismatch roll back the whole transaction. No live downgrade/reset
command is provided; an after-application rollback would need separate review.

## Profile and Design System

`reference` version 2 is now stored intent. Existing preferences remain exactly
`hero: graphic`, `density: airy`, `motion: light`. Service policy is unchanged:
effective Minimal reserves one staged Hero per Page and no downstream reveal.
The shared runtime owns motion, responsiveness, contrast fallback, Navigation and
semantic composition rules; customer state does not store pixel/animation controls.

Every approved preview color is now canonical because each participates
in the accepted composition. No diagnostic-only color was found. Other Design
System fields (fonts, type primitives, spacing, shape) stay unchanged.

| Color role | Intended value | Reason |
| --- | --- | --- |
| text | `#132b30` | Deep structural ink for readable body and contrast regions. |
| muted | `#455c5b` | Readable secondary copy on the accepted neutral base. |
| accent | `#176b4f` | Green primary Action/Navigation identity. |
| border | `#c7d3cb` | Existing bounded control/separation token, not new image framing. |
| surface | `#e8ede6` | Quiet shared group/interface surface. |
| onAccent | `#ffffff` | Light foreground paired with primary accent. |
| background | `#f7f6f0` | Warm neutral base used across all Pages. |
| secondaryAccent | `#315dc4` | Blue editorial identity, especially the Principles statement. |
| onSecondaryAccent | `#ffffff` | Light editorial foreground; runtime still enforces readable pairings. |

## Section presentation and order

All 29 Section UUIDs remain stored. Active visible counts are Home 9, About 6,
Projects 6, Principles 7; Projects summary remains present but inactive. Page IDs,
slugs, status and Page sort order do not change. Section sort orders use the exact
accepted 10-step sequence, including its inactive summary.

The following is the complete intended per-Section presentation. Existing anchors,
variants, item data and media fit are preserved; left alignment and no divider are
explicit for the selected presentations. No body copy is rewritten except the
approved Home lead-question promotion described below.

### /

| Order | Section UUID / heading | Composition | Width / spacing / surface | State |
| --- | --- | --- | --- | --- |
| 10 | `6c763a29-4404-4fe7-be6f-ab60de3bfcbe`<br>What should a useful personal robot actually be? | asymmetric-field | wide / compact / contrast | active |
| 20 | `680318d0-a606-4d70-af92-1b5a69735ca6`<br>Build. Test. Learn. Repeat. | image-evidence | wide / normal / default | active |
| 30 | `7cb671bc-8d5b-423e-bd17-87922bd5f9b0`<br>What does "My Own Robot" mean? | ordinary | reading / compact / default | active |
| 40 | `c6cf2724-3fc4-49ab-9ccd-134ab614c423`<br>Current Projects | grouped-field; 2 equal columns | wide / normal / subtle | active |
| 50 | `9d7472fd-f453-4690-8596-fd3e57c9ddca`<br>More Than One Robot | editorial-row | wide / compact / default | active |
| 60 | `07d7c37b-4345-4721-9f70-4a8c8b935d53`<br>Reality is an excellent design review | statement-break; statement | wide / normal / default | active |
| 70 | `1d8815d4-147a-4f27-8e2b-65ca703e024e`<br>What makes something Myomaton? | grouped-field; 2 equal columns | standard / compact / default | active |
| 80 | `e79a7b8f-a8f9-4da7-9c7a-a8424464d4e3`<br>Share what proves useful | ordinary | reading / compact / default | active |
| 90 | `a0afbe15-927b-46f6-bb2b-474523124934`<br>See what happens next. | conversion-band | wide / normal / contrast | active |

### /about

| Order | Section UUID / heading | Composition | Width / spacing / surface | State |
| --- | --- | --- | --- | --- |
| 10 | `b6142d7e-b8e1-41a7-9ade-ec96a5f37bc9`<br>About Myomaton | asymmetric-field | wide / normal / contrast | active |
| 20 | `a6251ba4-01e7-41b4-87bf-288a864f5454`<br>Why this exists | ordinary | reading / compact / default | active |
| 30 | `2f42e897-8507-4345-a743-18a4a6bbf96e`<br>Reality is an excellent design review | statement-break; statement | wide / normal / default | active |
| 40 | `33113b1e-3a54-49d7-81f0-3f9ebe36a150`<br>One person, amplified | editorial-row | wide / normal / default | active |
| 50 | `e8290a76-95db-4da8-a815-a010cface1ff`<br>Open Practical Robotics | ordinary | reading / compact / default | active |
| 60 | `46dc2e85-4b5a-4524-aebf-a9e2614fe45d`<br>See what we’re building | conversion-band | wide / normal / contrast | active |

### /projects

| Order | Section UUID / heading | Composition | Width / spacing / surface | State |
| --- | --- | --- | --- | --- |
| 10 | `541bed47-e1e4-43d0-8229-b78c8ec91d8f`<br>Projects | asymmetric-field | wide / normal / contrast | active |
| 20 | `211ff9f7-07fc-43df-9780-1f0ea771c047`<br>TaBot | image-evidence | wide / normal / default | active |
| 30 | `ca7d2a60-d54f-40b1-87fa-0673fe9e510a`<br>A-Bot | image-evidence | wide / normal / default | active |
| 40 | `c984b810-387c-4b39-99b8-25ee6f23cd9b`<br>Current Projects | grouped-field; 2 equal columns | wide / normal / subtle | inactive |
| 50 | `4fd4e176-26a4-4c5a-b3dd-d626d80b3c29`<br>Small robot experiments | ordinary | reading / compact / default | active |
| 60 | `1fb0bdd2-c451-4ca9-ab05-9c525685a768`<br>More Than One Robot | editorial-row | wide / normal / default | active |
| 70 | `a7d9b1ba-456f-4936-bc49-bfe861638bbf`<br>What makes something Myomaton? | conversion-band | wide / normal / contrast | active |

### /principles

| Order | Section UUID / heading | Composition | Width / spacing / surface | State |
| --- | --- | --- | --- | --- |
| 10 | `c4edd287-d942-4fb0-868f-cc77fbeb614b`<br>Principles | asymmetric-field | wide / normal / contrast | active |
| 20 | `d1833556-8d59-4b41-a594-7a2c4fe7067c`<br>Ownership matters | statement-break; statement | wide / normal / editorial | active |
| 30 | `c1949ff0-f02f-4474-90e3-53ad7e7e74af`<br>Core principles | grouped-field; 2 equal columns | standard / compact / default | active |
| 40 | `49547304-277d-4a19-aa56-2bc19380feb4`<br>Complexity has a cost | ordinary | reading / compact / default | active |
| 50 | `7cbb70b2-ac0c-49b6-a269-3b3acdaf2be4`<br>Use what works | ordinary | reading / compact / default | active |
| 60 | `d7928e1a-1a50-4068-b635-841b90e1c96d`<br>Share what proves useful | ordinary | reading / compact / default | active |
| 70 | `d0f519e2-27a9-4f67-9d67-118798c67543`<br>See the projects | conversion-band | wide / normal / contrast | active |

## Approved content presentation, Actions and image association

- Home Hero uses the existing question, "What should a useful personal robot
  actually be?", as its h1. The exact first paragraph moves to `heading`; the
  exact remaining paragraph stays in `text`. The prior Myomaton heading remains
  the site identity in Header/Footer. No proposition, fact or supporting copy is invented.
- Home Hero references existing Projects Action `289247dc-d4d0-4cdc-aabb-46c2b4b38940`.
- Home closing CTA references existing Projects Action `ec47c6b5-e75d-4dd7-a59a-dac14a8737d3`.
- Those two existing Action labels become "Explore projects". Existing Principles
  Action `60eeae6f-ae85-433b-9fea-19548b556a7f` becomes "Read the principles".
  Action IDs, types, destinations, facts and all other fields stay unchanged.
- Existing Home AssetUsage `9475a91c-e0ad-4373-b5e9-65ca6fe649e7` switches from
  TaBot hardware Asset `eb1ea754-2f6d-4514-bf42-f4781f5f1d80` to the existing whole
  A-Bot image Asset `2cd65369-3c6f-4017-a51d-71759d6115db`. This is the only usage
  pointer change. Usage UUID/entity/role/metadata/configuration remain unchanged.
  All Assets, source files, dimensions, alt text and bytes stay unchanged. Existing
  Projects TaBot and A-Bot usage associations stay unchanged.
- Projects Current Projects Section `c984b810-387c-4b39-99b8-25ee6f23cd9b` is
  inactive, not deleted; its full content remains available. Home summary stays active.
- Home/About Reality and Principles Ownership are the three explicit statements;
  Projects has none. These selections do not become automatic platform defaults.

## Operator lifecycle and validation

After separate authorization only: `npm run update:myomaton-visual-direction-v2`.
It is never run by startup, seed, bootstrap, build or preview. The historical v1
guard/baseline remain untouched; they are not upgraded into a synchronization tool.

Focused tests check exact baseline/result, every partial transition and table drift,
all identities/unchanged fields, zero-write rerun and rollback at every write.
Disposable PostgreSQL verifies the actual guarded SQL, early/late rollback, no-op,
four-Page rendering, responsive semantic markers, one Hero reservation and exact
managed media bytes. The reproduction fingerprint is compared with the accepted
preview during preparation; generic runtime tests remain in the reusable checkpoint.

Preparation/tests inspect real public state read-only; their writes use disposable
fixtures. Customer artifacts were checkpointed as `54d2b76` and pushed before the
separately authorized real application. Preparation alone never authorizes application.

### Application verification

The real preflight matched the complete frozen v1 baseline. After the guarded
35-update application, the complete real state matched the intended v2 snapshot.
The exact rerun reported zero inserts/updates/deletes and retained the full database
fingerprint. Eight migrations, four Pages and 29 stored Sections remain. UUIDs,
protected copy, Action destinations, Navigation, Subjects, Assets/bytes and Contact
were preserved apart from the explicitly documented approved presentation changes.

All four real Pages reproduced the accepted preview contract: text, order,
compositions, surfaces, Actions, image associations, palette, profile/version and
one Hero motion consumer per Page. Managed image responses matched stored bytes;
an unknown route returned 404. Standard and focused transition tests passed.
The accepted preview at `53866` was then stopped and only its disposable schema
removed; unrelated disposable schemas were preserved. `localhost:3000` remained
running. No runtime, schema or migration changes were needed for application.
