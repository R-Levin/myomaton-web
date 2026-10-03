# Myomaton secondary Pages v1 operator transition

Applied to the development database after separate approval and verification;
implementation and automated tests did not apply it to real customer state.
Myomaton is Customer #1, not a platform template. PostgreSQL remains canonical.
Neither seed nor bootstrap restores these Pages.

Home, About, Projects and Principles are the accepted Myomaton v1 structural
baseline. This source-controlled operator is historical transition tooling, not
ongoing synchronization authority. Future content or presentation changes belong
in later guarded customer-state modifications or editing mechanisms. Do not edit
this transition definition or frozen baseline to impose those changes.

After separate approval, the explicit command is:

```sh
npm run update:myomaton-secondary-pages-v1
```

It accepts no force, reset or repair option. Review current state first. Do not
refresh its frozen baseline to bypass a conflict.

## Reviewed baseline and intended result

Web Presence `1b72cd7d-92b9-4f55-aba6-825d69d493af`, Managed Site
`7fd60824-a933-401d-8099-7b64f24cc408`, and Home
`fd7bdc57-c9b7-4274-b871-43cf2e9b09ee` at `/` are retained. The reviewed baseline
has nine Home Sections, two Actions, three Subjects, three Assets, one AssetUsage,
two Primary Navigation items, no secondary Pages, and seven installed migrations.

| Page | Reserved UUID | Path | Sections |
| --- | --- | --- | --- |
| About | de8728f0-3bfe-40b4-a721-37f7779634d2 | /about | Hero; Why this exists; Reality is an excellent design review; One person, amplified; Open Practical Robotics; Projects CTA |
| Projects | c4bcb2b1-84e0-4ef5-a374-383563ed7c85 | /projects | Hero; Subject-backed Current Projects; TaBot; A-Bot; Small robot experiments; More Than One Robot; Principles CTA |
| Principles | 5cdc56f1-d2f4-4d66-a0f8-d3871a612176 | /principles | Hero; five inline core principles; Ownership matters; Complexity has a cost; Use what works; Share what proves useful; Projects CTA |

The content module records approved plain text and reserved random UUIDs. Projects
references only existing TaBot/A-Bot Subjects. Principles uses the same five inline
items as the frozen Home baseline. No Subject, Asset or managed file is created.

Three Page-target Actions store stable Page UUIDs: “See what we’re building” and
“See the projects” target Projects; “What makes something Myomaton?” targets
Principles. An unambiguous compatible existing Page Action with the same label and
target is reused without changing its identity or metadata. None exists in the
reviewed baseline. Home's Section-target Action is a different destination and is
preserved.

Primary Navigation becomes Home / Projects / Principles / About using Page UUIDs.
The two reviewed scaffolding items are deleted only after all dependencies exist,
within the same transaction. The underlying Learn more Action remains unchanged;
it becomes unreferenced. Automatic Action deletion/lifecycle management is outside
this transition.

## Image reuse

New usage `5172857b-99ec-4b70-bf36-4b1785f5637e` reuses TaBot Asset
`eb1ea754-2f6d-4514-bf42-f4781f5f1d80` in the Projects TaBot Section.
Its existing factual hardware description remains appropriate there. Home's
Introduction UUID/name and photograph usage are never written.

New usage `3cc28c9c-cbc8-4bae-b733-2ff77192e3e2` reuses A-Bot angle Asset
`2cd65369-3c6f-4017-a51d-71759d6115db`. Visual inspection favored this shot because
it shows more chassis and front sensor hardware. Its existing description is
accurate for this informative presentation. Both usages explicitly set
`configuration.image.decorative: false` and use Asset-level alt fallback; no
contextual override is necessary. The close-up Asset
`e1a699d7-19ca-43a1-9dbe-3d7d523381ef` remains unattached.

## Guards and lifecycle

The frozen JSON captures the reviewed public records, including timestamp
microseconds. All original fields must still match, except the two deliberately
retired Navigation items in the completed phase. Additional unrelated records are
preserved; extra Pages in this Managed Site, conflicting reserved identities,
ambiguous canonical identities, or extra usage of the protected Assets refuse.

Only the complete initial phase or complete intended phase is accepted. Partial
or customized state is not repaired. New records compare every intended field
except database-assigned creation/update timestamps. Exact rerun performs zero
inserts, updates or deletes. Baseline transition performs 32 inserts, zero updates
and two Navigation-item deletions (fewer inserts when compatible Actions exist).

The transaction takes SHARE ROW EXCLUSIVE locks on the thirteen checked tables
before inspection, with bounded lock/statement timeouts. The image writer also
locks and verifies the active Section/Page/Managed Site/Web Presence ownership
chain and checks singular image-role occupancy. Failures roll back all writes.
Schedule this operator during a quiet maintenance window; it blocks other writers.

The historical [Home v1 updater](myomaton-home-v1.md) and its frozen baseline remain
unchanged. After this later Navigation transition, that updater correctly refuses
the evolved state. Never broaden its guard to accept a later transition.

## Validation and deferred assessment

Isolated unit fixtures cover exact transition/no-op, Page/Section/Navigation and
Action identity, reuse/fallback, customization conflicts, unrelated preservation,
and failure at each write step. Disposable PostgreSQL replay covers real rollback,
no-op, original-record preservation, AssetUsage reuse and production HTTP rendering
through the existing Page/Section/Navigation/Action/media services. Tests never run
the operator against the real customer schema.

This satisfies the bounded P1 writer gate and A1/A2/A6 checks for these two intro
image attachments. Usage accessibility reuses the already implemented contract.
It adds customer content, not a new Page archetype, navigation capability or
onboarding automation. General editing, revision/provenance and publishing remain
deferred. P8 is preserved; P9 host routing and P10 SEO/canonical URLs remain deferred.
These local development Pages do not imply production indexing readiness.
