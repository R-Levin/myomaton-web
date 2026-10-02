# Managed Site terminology deployment

Migration `0006_managed-site-terminology.sql` aligns the application/domain term
Managed Site with physical SQL names. Historical Microsite means the same entity.
Web Presence remains the owning customer-level concept, with Pages beneath a
Managed Site. This is a terminology transition, not a routing or content feature.

## Coordinated cutover

The development database remains on 0000–0005 until separate migration approval.
The new application requires `managed_sites` and `pages.managed_site_id`; old code
requires the old identifiers. Deploy the application and migration together in a
controlled maintenance window, stopping old application/operator writers first.
Do not start this code against the unmigrated development database. No permanent
SQL views, aliases or dual-name compatibility layer are provided.

The migration takes ACCESS EXCLUSIVE locks on the site, Page, Navigation and
Navigation Item tables. It can wait for active transactions and blocks concurrent
reads/writes during cutover; plan the window and operational lock/timeout policy
accordingly. Preflight and renames execute atomically in one DO statement.

It renames the table, Page FK column, site primary key, both affected foreign-key
constraints, Page `(managed_site_id, slug)` unique constraint and its backing
index, and PostgreSQL 18 named NOT NULL constraints (nine site columns plus the
Page FK column). Renaming the primary key also renames its backing index. There
is no row DML, table replacement, UUID regeneration or timestamp update. This
migration targets the reviewed PostgreSQL 18 schema; another server version or
schema drift requires review before execution.

## Navigation serialization preflight

The runtime surface is now `managedSite`; visibility configuration is
`surfaces.managedSite`. The migration checks both `navigations.configuration`
and `navigation_items.configuration` and refuses any `surfaces.microsite` key,
including false/null values or simultaneous old/new keys. The locked preflight
prevents a legacy write racing that check. Runtime normalization also fails closed
if a legacy key is reintroduced, rather than silently making hidden links visible.

The reviewed Myomaton state has no such keys and needs no customer-record rewrite.
For another deployment containing them, stop and review each affected record.
An explicitly approved, transactional customer-state operation must move each
valid boolean to `surfaces.managedSite`, preserving its visibility meaning and
unrelated configuration. Resolve malformed values and conflicting old/new keys
explicitly; do not overwrite a different new-key value or silently drop the old
key. Recheck both tables before retrying this migration. No automatic conversion
is bundled here.

## Historical evidence and verification

Migrations/snapshots 0000–0005 and their journal entries remain unchanged. The new
snapshot describes the renamed schema and links to 0005. The frozen Home v1
baseline retains its original physical names; a narrow in-memory adapter projects
only those names to the current schema for the same strict expected-state guards.
No stored customer copy or JSON is translated.

After `npm.cmd run build`, set `ASSET_TEST_DATABASE_URL` explicitly and run
`npm.cmd run test:postgres` (set `ASSET_TEST_PRODUCTION=1` to include all Asset HTTP
format checks). The rename rehearsal always checks production routing/media.
It reads public customer state, replays 0000–0005 in a disposable schema, copies
that state there, applies 0006 there, and compares all row values, timestamps,
relationships and constraint/index identities. It verifies preflight refusal,
Home v1 no-op/conflict guards, and a fresh 0000–0006 replay. Fixture-only secondary
Pages exercise nested routing. Production fixture connections use only the
fixture search path and are read-only. Test schemas are dropped on completion;
public state and the installed migration journal are rechecked unchanged.

Standard tests also pin historical file hashes and compare the new snapshot to
the active Drizzle schema. Remaining legacy terms are migration inputs, frozen
evidence/adapters, preflight rejection tests and explicit history notes.

P8 remains structurally multi-page. P9 host resolution remains deferred and P10's
SEO/canonical-URL requirement is unchanged. This bounded cleanup adds no capability
or long-lived deferred item.
