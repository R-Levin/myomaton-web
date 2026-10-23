# Managed PostgreSQL recovery foundation

## Status

This is a local foundation, not authorization to provision Supabase or 20i.
Supabase remains a prototype candidate. Hosted permissions, TLS/network/pooler
behavior, quotas and restore operations remain empirical questions.

PostgreSQL 17.11 portable binaries came from the EDB archive linked by the
[PostgreSQL Windows page](https://www.postgresql.org/download/windows/).
PG17 fresh bootstrap, representative application workflows, managed roles,
PG17-to-PG17 recovery and PG17-to-PG18 logical provider exit are locally proven.
Historical migration 0006 unconditionally renames named NOT NULL constraints
introduced in PG18; raw unadapted Drizzle replay still refuses on PG17.
The explicit compatibility path below resolves this without rewriting history.
The [PG17 constraint catalog](https://www.postgresql.org/docs/17/catalog-pg-constraint.html)
and [PG18 release notes](https://www.postgresql.org/docs/18/release-18.html)
describe the representation/enforcement change.

## Immutable 0006 bootstrap compatibility

This is classification A: name/history-only incompatibility for ten NOT NULL
renames. They originate in ordinary NOT NULL column declarations in the early
migrations. PG17 enforces those same columns through `attnotnull`, but has no
independent table-constraint names to rename. The nine site columns are `id`,
`web_presence_id`, `name`, `status`, `configuration`, `metadata`, `version`,
`created_at`, `updated_at`; the tenth is Page `microsite_id`/`managed_site_id`.
Later SQL and runtime code do not reference these NOT NULL names. Snapshots record
nullability. Controlled PG18 catalog verification continues checking its names.

Option 1 is implemented in the [bootstrap adapter](../scripts/db/bootstrap.ts).
Options 2/3 are unnecessary: no artificial PG18-like constraints or parallel
baseline/history are needed. All 0000–0015 SQL, snapshots, journal and checksums
remain immutable. A [pinned identity list](../scripts/db/bootstrap-identities.json)
checks every migration before execution. The complete 0006 source SHA-256 is
`916b37ef27eba28149f1093a170993026f080a5258276d59c30180d1c2a83180`.

The PG17-only plan matches that exact complete body and exact terminal suffix.
Only the nine-name loop and tenth NOT NULL name rename are inapplicable; every
preceding lock, legacy-visibility refusal, table/column/PK/FK/unique rename executes
unchanged. There is no general statement search/removal or version override.
Pre/post guards compare exact columns/types/defaults/nullability, constraints and
indexes for the four affected tables, reject partial/colliding state, triggers/RLS,
and require the known PG17 application prefix to contain no customer data.
PG18 executes the original complete body with its original NOT NULL names.

The public entry uses the normal Drizzle migrator on one transaction-bound client.
Only the pinned 0006 statement is intercepted. Drizzle records all 16 original
identities in order, after semantic satisfaction. PG17 does **not** claim the raw
PG18-only suffix executed: a durable `miopages-pg17-bootstrap/1` receipt in the
Drizzle journal table comment records the original and executed hashes, precise
equivalence, pre/post schema digests, actual source major and timestamp. The
receipt and migration rows commit/roll back together, including on later failure.
No migration rows/timestamps are inserted or advanced manually by the adapter.
Status validates the exact prefix; PG17 progress past 0006 without its valid
receipt refuses. Completed reruns are read-only no-ops. Existing PG18 rows are not
rewritten; ordinary PG18 bootstrap has no compatibility receipt.

Use explicit `MIOPAGES_DATABASE_OPERATION=managed-bootstrap`, protected migration-role
`DATABASE_URL`, then `npx tsx scripts/bootstrap-managed-postgres.ts`. The
[entry point](../scripts/bootstrap-managed-postgres.ts) does not load shared local
configuration automatically. Do not run it on an existing populated PG17 prefix.
Existing disposable fixture replay shares the same bounded guard with private
schema qualification; it never rewrites the public receipt.

Table comments are included in the selected PostgreSQL archive. Managed recovery
also records/verifies the receipt explicitly, including on a PG18 logical restore.
It requires no local runtime evidence to retain bootstrap provenance. A later
application migration requires normal identity/inventory review, not a second
permanent migration lineage.

## Explicit modes and ownership

Existing `myomaton-backup/1` [controlled-cluster recovery](backup-recovery.md)
retains environment, ownership, ACL, role, membership, setting, extension, schema,
sequence, data and managed-object comparisons. There is no fallback when it fails.

[Managed tooling](../scripts/backup/managed.ts) requires `mode: managed-postgres`
and creates `miopages-managed-recovery/1` bundles. Provider infrastructure is
dependency evidence, not recreated state. No public endpoint or scheduled managed
backup activation is introduced.

[The explicit inventory](../scripts/backup/application-ownership.json) names 32
public application tables, the Drizzle journal/sequence and 17 trigger functions.
It includes canonical histories, Contact, intake, acquisition, activation,
proposals, releases and hostname bindings. Migrations create no roles/extensions.
Constraints, indexes, triggers (including deferred guards), columns and sequence
properties on those objects belong to the contract. Unowned FK/trigger dependencies
refuse. Unrelated public provider objects are excluded; everything in `public` is
not implicitly MioPages-owned. New migrations require inventory review; the current
contract verifies exactly 16 logically applied original migration entries/hashes
and any required bootstrap receipt.

Only the managed projection excludes PG18 NOT NULL constraint rows, retaining
exact column `attnotnull` obligations. Enforcement flags, CHECKs, function bodies,
partial indexes and trigger enablement/deferral remain compared. Controlled mode
retains the full PG18 representation and all existing comparison guarantees.

## Provider and role contract

Dependencies include PG17/18, UTF-8, exact libc locale/collation/version, UTC sessions,
PL/pgSQL version and built-in UUID/JSONB capabilities. Application workflows also
require advisory locks and deferred triggers. Other majors, RLS-enabled application
tables, role memberships and unreviewed locale providers refuse. Remote connections
require `sslmode=verify-full` and an actual TLS backend connection. Plain loopback
is explicitly local-test evidence. Credentials/trust roots remain protected config.

Three distinct configurable roles are required; provider role names are not assumed:

- Runtime: application SELECT/INSERT/UPDATE/DELETE, journal SELECT only; no DDL,
  ownership, TRUNCATE, REFERENCES, TRIGGER or migration-sequence authority.
- Migration: owns application objects, with CREATE in application schemas and on
  the database. Normal Drizzle schema creation needs database CREATE even when
  `drizzle` exists. Superuser/CREATEDB/CREATEROLE/replication/BYPASSRLS flags are absent.
- Backup: application/journal SELECT, sequence SELECT and schema USAGE; no DML,
  DDL, TRUNCATE or application function execution.

Effective table/column/sequence/function/schema privileges and memberships are
verified. Runtime cannot disable guards or alter their functions. The provider
supplies database/public-schema ownership and must support this bounded role model.

## Archive and independent restore

`managedBackup` uses a consistent exported snapshot and matching-source-major
`pg_dump`. Explicit table/sequence selections create `application.dump` without
provider objects. `functions.sql` separately supplies only inventoried functions
because table-only dumps omit dependency functions. The bundle contains semantic
schema/integrity, migration/data/sequence hashes, effective privileges, dependencies,
managed media, manifest, checksums and completion marker. Existing private-root
ACL/reparse checks are reused; a dedicated empty bundle root is required.

`restoreManagedBundle` requires an empty application namespace, pre-provided roles
and dependencies. It refuses existing application table/function identities,
restores without source owners/ACLs, and reapplies explicit app grants under migration
credentials. Provider roles/extensions/settings/infrastructure are not recreated.
A failure is not a verified restore: use an isolated target and discard partial
targets. `restoreManagedMedia` and `verifyManagedRestore` verify bytes and the full
application contract. No runtime artifact is required to reconstruct future data.

Dump clients must match the source major; restore clients must match the target
major, with target >= source. Downgrades refuse. Binaries are external configuration,
never distributed in the repository. PG17-to-PG18 is proven as logical application
recovery with PG17 dump and PG18 restore binaries, not a physical cluster downgrade
or a reconstruction of the former provider's infrastructure.
This deliberately bounded client policy is narrower than PostgreSQL's general
[logical dump portability](https://www.postgresql.org/docs/17/app-pgdump.html).

## Local proof

Supply external `PG17_BIN_DIR` and `PG18_BIN_DIR`, then run
`npx tsx --test --test-concurrency=1 tests/integration/managed-recovery.test.ts`.
After the documented Webpack build, `ASSET_TEST_PRODUCTION=1` enables restored
C0/C1 HTTP checks. Also run
`npx tsx --test --test-concurrency=1 tests/integration/pg17-bootstrap.test.ts` for
prefix/negative/no-op proofs. The raw SQL refusal is preserved as an explicit
control; successful PG17 bootstrap uses the reviewed adapter.

The independent PG17/PG18 proofs use non-superuser app/migration/backup roles,
synthetic activation/canonical/confirmed-information/proposal/approval/release/rollback
history, Contact retries and C0/C1 content/navigation/metadata/media. Provider-marker
state is excluded. Negative controls cover tables, constraints, functions, deferred
guards, partial indexes, migration state, privileges, data, media, hostnames and
provider capabilities. Disposable clusters are removed after testing. Readable
evidence remains ignored under `runtime-content/managed-postgres-proof` and
`runtime-content/pg17-bootstrap-proof`. Negative bootstrap controls include lost or
wrong-column NOT NULL, changed constraints/types, wrong checksums/ledger/receipt,
unrelated SQL, unsupported adapter majors, populated PG17 prefixes and later
migration failure. These must not falsely record 0006 as applied.

Provider exit remains standard PostgreSQL: no Supabase Auth, Storage, Realtime,
Edge Functions, generated APIs or provider migration history are dependencies.
