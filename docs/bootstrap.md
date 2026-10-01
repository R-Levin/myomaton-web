# Seed, customer initialization, and canonical state

The database owns a customer's current Web Presence after initialization. Source
definitions are initial inputs, not a synchronizer, repair recipe or backup.

## Commands

Both commands load `.env.local` and require `DATABASE_URL` pointing at the intended
database. Neither runs during application startup or build.

```powershell
npm.cmd run db:seed
npm.cmd run bootstrap:myomaton
```

`db:seed` inserts the generic `project` Subject Type if its unique key is absent.
Existing reference values/status/IDs are preserved. It never reads or writes
customer tables and cannot restore removed customer content.

`bootstrap:myomaton` is an explicit Customer #1 initialization command, not a
platform tenant special case or general onboarding engine. Definitions live in
`scripts/customer-bootstrap/`, separate from `scripts/seed-data/platform.ts`.
For a fresh customer it requires an existing active `project` Subject Type and
creates the old three-section baseline unchanged in a single transaction:

| Former seed data | Classification / new owner |
| --- | --- |
| `project` Subject Type | Platform reference seed |
| Open Practical Robotics Organization | Myomaton customer bootstrap |
| Myomaton Web Presence and Subject | Myomaton customer bootstrap |
| Myomaton Design System and Learn about Myomaton Action | Myomaton customer bootstrap |
| Myomaton Microsite and Home Page | Myomaton customer bootstrap |
| Hero, Introduction, Primary Call to Action Sections | Myomaton customer bootstrap |
| Primary Navigation, About and Learn about Myomaton items | Myomaton customer bootstrap |

There were no separate development-only fixtures in the old seed. No placeholder
customer is added. Home v1 content is not part of this boundary refactor.

## Initialization semantics

- Before customer reads/writes, a transaction advisory lock serializes this
  operator command (including simultaneous first runs). All new customer records
  and their UUID relationships commit together or roll back together. This lock
  coordinates this command, not unrelated writers.
- Recognition checks all statuses for Web Presences with the original domain or
  name, ignoring case and surrounding whitespace. Multiple candidates, including
  conflicting name/domain matches, fail without writes.
- A single existing Web Presence means **no-op**, not "baseline complete".
  No child tables are inspected or repaired. Missing Sections, Pages, Actions,
  Navigation, Subjects or Design System may reflect deliberate customer changes.
  Existing values, IDs, names, statuses, versions and timestamps stay untouched.
  The old legacy CTA conversion is removed, not moved to customer bootstrap.
- When both identifying name and domain were changed, explicitly identify the
  existing Web Presence by its retained UUID:

  ```powershell
  npm.cmd run bootstrap:myomaton -- --web-presence-id "<existing-uuid>"
  ```

  This option only recognizes an existing record; an absent/invalid UUID or a
  different matching Myomaton record fails. It never creates a supplied UUID.
- Without an existing match, an Organization still named Open Practical Robotics
  is evidence of existing/partial state: initialization refuses to recreate or
  adopt it. Inspect the canonical state instead of using bootstrap as repair.
- Only when no customer identity is recognized and no residual named Organization
  exists does fresh initialization proceed. Retain the Web Presence UUID for
  later operator use. Without a UUID, if *all* identifying names/domain records
  have been renamed or deleted, the command cannot distinguish that history from
  a fresh customer. No persistent completion flag or historical identity registry
  is introduced. Do not use a fresh bootstrap invocation as customer recovery.

There is no reapply, reset, force, merge or synchronization mode. Existing partial
state from older tooling requires a separately reviewed canonical-state operation.

## Photograph and future onboarding

The optional photograph remains independent: `db:bootstrap-photo` is an explicit
operator command requiring the chosen Asset UUID, local bytes and approved alt
text. Its implementation moves beside other customer bootstrap code; association
behavior is unchanged. Neither generic seed nor customer bootstrap invokes it,
stores photo bytes in Git, or restores a removed association. An explicit photo
command can still attach to an empty role as documented in [Assets](assets.md).
No real photograph or AssetUsage is changed by this refactor.

Future clients normally originate from interview/business knowledge interpreted
into structured Organization/Web Presence, Subjects, Design System, Microsite,
Pages, Sections, Actions and Navigation through application onboarding and
customer review/approval. They should not require permanent source-controlled
customer seed files. This operator baseline is not that product or a template
system. Subsequent approved edits must operate on canonical IDs and current
database state, not reapply these initial definitions.

## Verification

`tests/bootstrap-seed.test.tsx` runs actual Drizzle statements through an isolated
in-memory driver, covering reference-only seed, baseline relationships, no-op,
customization/removal preservation, conflicts and transaction rollback. It never
connects to the real customer DB; it does not claim live PostgreSQL lock/constraint
coverage. Existing Asset integration behavior is unchanged.
