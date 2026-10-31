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

Dependencies include PG17/18, UTF-8, exact libc or ICU locale/collation/version, UTC sessions,
PL/pgSQL version and built-in UUID/JSONB capabilities. Application workflows also
require advisory locks and deferred triggers. Other majors, RLS-enabled application
tables, role memberships and unreviewed locale providers refuse. Remote connections
require `sslmode=verify-full` and an actual TLS backend connection. Plain loopback
is explicitly local-test evidence. Credentials/trust roots remain protected config.

Only explicit locale providers `c` (libc) and `i` (ICU) are supported; builtin
(`b`) and unknown providers still refuse. Every managed snapshot/bundle retains
all six database locale identity fields without normalization: `encoding`,
`datlocprovider`, `datcollate`, `datctype`, `datlocale` and `datcollversion`.
Non-null custom ICU rules (`daticurules`) refuse because they are outside this
six-field recovery identity; supporting them needs a separate contract review.
For libc, `datlocale` is null and its existing nullable collation version is
preserved. ICU requires a nonempty provider locale and collation version; the
reported PG17 hosted identity (`UTF8`, `i`, `en_US.UTF-8`, `en_US.UTF-8`, `en-US`,
`153.121`) satisfies this contract without hardcoding Supabase or that locale.
See the [PG17 database catalog](https://www.postgresql.org/docs/17/catalog-pg-database.html).

Managed restore preflight and final equivalence require exact recorded identity:
libc ↔ ICU, ICU locale spelling and collation-version differences refuse, as do
encoding, collation or character-classification differences. Major-version
compatibility alone does not establish locale equivalence. A provider/ICU upgrade
or provider exit with a different version needs separately reviewed compatibility
and recovery evidence; do not strip versions, normalize locale names, or refresh
catalog version metadata merely to make a comparison pass. Controlled-cluster
PG18 recovery remains libc-only with its existing exact environment comparison.
No historical migration, PG17 0006 compatibility receipt, role model or ownership
scope changes as a result of adding managed ICU acceptance.

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

## Transactional application role provisioning

The authorized synthetic hosted proof exposed provider/default ACLs on the explicit
MioPages inventory: broad table grants to roles such as `anon`, `authenticated`,
`service_role` and `postgres`, and PUBLIC/provider EXECUTE on trigger functions.
The old verifier correctly refused `Unowned/PUBLIC application ACL grant`; the
attempt rolled back without permanent application roles. Provider-created defaults
are not permission to expose application data through those identities.

Use the [operator entry point](../scripts/provision-managed-postgres-roles.ts) and
[transactional provisioner](../scripts/db/managed-roles.ts), not the disposable test
helper or ad hoc chat SQL. This procedure changes database roles/ownership/ACLs;
run it only within separately authorized database/environment scope. No hosted
execution is implied by this document or its local tests.

Supply protected process configuration explicitly; the entry loads no `.env` file
and accepts no passwords or connection URLs in command arguments:

| Environment key | Required value / boundary |
| --- | --- |
| `MIOPAGES_DATABASE_OPERATION` | `managed-role-provision` |
| `MIOPAGES_ROLE_ACTION` | `create` or `verify`; no repair or reset mode |
| `DATABASE_URL` | Create: authorized provider-owner connection. Verify: prefer the supplied backup-role connection, or migration role. Remote connections require verified TLS. |
| `MIOPAGES_DATABASE_NAME` | Exact expected database name, also checked against the connected database |
| `MIOPAGES_PROVIDER_OWNER` | Exact initial application-object owner; create requires this caller/session identity |
| `MIOPAGES_RUNTIME_ROLE`, `MIOPAGES_MIGRATION_ROLE`, `MIOPAGES_BACKUP_ROLE` | Three distinct dedicated LOGIN role names, for example `miopages_runtime`, `miopages_migration`, `miopages_backup` |
| `MIOPAGES_RUNTIME_PASSWORD`, `MIOPAGES_MIGRATION_PASSWORD`, `MIOPAGES_BACKUP_PASSWORD` | Create only: distinct cryptographically random printable ASCII secrets, 32–256 characters. Inject through protected configuration; never commit them. |

With that configuration supplied, run:

```text
npx tsx scripts/provision-managed-postgres-roles.ts
```

Create requires all three role names absent, the complete bootstrapped inventory,
exact 16-entry migration history/required PG17 receipt, and uniform declared initial
ownership. Partial/existing roles, mixed ownership, missing/overloaded functions,
unreviewed dependent sequences and unrelated contents in a schema whose ownership
would transfer refuse. Quiesce application/migration writers before conversion. The
provider owner needs the actual database/schema/role/ownership capabilities; local
proof includes a non-superuser CREATEROLE/database owner. Inherited PUBLIC database
or shared-schema CREATE that violates the application role contract causes refusal;
the tool does not remove shared provider privileges to force success.

One bounded transaction serializes conversion, locks and rechecks the inventoried
tables, creates restricted SCRAM-backed LOGIN roles, transfers the reviewed relations,
sequence, functions and dedicated `drizzle` schema, and preserves provider ownership
of `public`. The provider database/public ACLs keep their existing non-application
edges. No `REASSIGN OWNED`, schema-wide relation grant/revoke or provider-object scan
is used to select mutation targets. Unrelated provider tables, sequences, functions,
data, column ACLs and provider-role default privileges remain untouched.

The [shared privilege policy](../scripts/backup/managed-permissions.ts) backs
`applyApplicationGrants`, provisioning and guarded test setup. It enumerates actual
relation/function/column ACL grantees on each inventory object; all non-owner grants
and dependent grant chains on that object are removed before exact runtime/backup
grants are applied. PUBLIC, unknown and quoted provider identities are handled by
catalog identity, not a Supabase name allowlist. Unreviewed signatures/dependencies
or an inability to remove an ACL refuse and roll back. Provider administrators'
inherent administrative power is not removed by deleting their explicit ACL edges.

Migration-role defaults are deliberately owner-only for future tables, sequences
and functions. Global PUBLIC EXECUTE is explicitly revoked for the dedicated
migration role; schema-local revocation alone cannot cancel PostgreSQL's global
function default. Provider-owner defaults are unchanged. Future migrations must
run as the migration role, review new inventory and apply explicit application
grants; runtime/backup get no automatic access to unreviewed new objects. The
verifier now requires safe defaults, LOGIN roles, migration ownership of dedicated
schemas and the exact ACL policy, including rejection of column ACLs, delegation
and runtime/backup MAINTAIN. See PostgreSQL's
[default privilege rules](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

Verification runs under migration authority before commit and compares application
semantics, data/sequence values, shared provider authority and bootstrap provenance
with pre-conversion state. Temporary SET membership is revoked before commit;
PostgreSQL's non-superuser creator ADMIN-only grants may remain, with no SET or
INHERIT capability. Any failure rolls back roles, ownership, ACLs and defaults.
The CLI emits only a bounded phase/SQLSTATE diagnostic, never SQL, passwords,
SCRAM verifiers or connection strings. A connection loss during COMMIT is an
unknown outcome, not proof of rollback: inspect with `verify` before any retry.

Create deliberately refuses every existing-role retry. `verify` requires the full
existing set and runs the repository verifier in a read-only transaction; it does
not rotate passwords, repair ACL drift or adopt partial roles. Existing roles with
unsafe defaults require a separately reviewed upgrade plan. Restore target setup
remains separate: this converter requires an existing complete bootstrap and does
not authorize overwriting application state during recovery.

Local synthetic [provisioning tests](../tests/integration/managed-roles.test.ts)
cover PG17 ICU/PG18 libc, the hosted grant pattern plus arbitrary/quoted/column
and delegated grantees, unchanged provider objects/defaults, concurrent creation,
partial/mixed states, unreviewed automatic sequence-owner transfers, late verifier
rollback, non-repairing read-only verification,
future-object defaults and ACL/MAINTAIN/default negative controls. Existing
managed recovery tests reuse the production conversion policy. No historical
migration, ownership inventory, PG17 0006 mechanism or ICU/libc identity comparison
is changed by this role-provisioning path.

## Bounded provisioning verification diagnostics

A later authorized hosted `create` reached `verification` and rolled back. That
stage alone does not identify the failing invariant. Repository-only reproduction
with the exact checkpoint implementation passed on PG17.11 ICU and PG18 with a
non-superuser CREATEROLE source owner, `pg_database_owner` ownership of `public`,
schema-local provider defaults (including source-owner grants), unrelated database
CREATE grants, storage objects/defaults and broad application ACLs. These patterns
alone do not reproduce the hosted refusal. The local Windows ICU environment is
not an exact copy of the hosted Linux provider environment. The exact hosted
assertion and root cause remain unproven; no permission correction is justified
by this evidence, and successful hosted conversion is not yet established.

The protected CLI now adds an allowlisted `reason` only for verification failures.
It reports the last verification operation entered, never arbitrary assertion text,
SQL, connection strings, passwords or provider details. Codes distinguish:

- `provider-dependencies`, `application-defaults` and `role-contract`;
- `application-ownership`, `application-acl` and `application-catalog`;
- `snapshot-data`, `application-dependencies` and `migration-history`;
- `semantic-equivalence`, `data-equivalence`, `shared-provider-authority` and
  `bootstrap-equivalence`.

A code identifies the bounded operation, not necessarily its individual assertion
or cause. For example, `role-contract` covers effective privileges and required
built-in execution as well as role flags. It is not proof of a membership issue.
`pg_auth_members.member = application-role OID` tests memberships held by the
application role. Non-superuser creator ADMIN membership points in the opposite
direction. The existing assertions, exact equality comparisons, transactional
rollback and permission writer are unchanged. Provider source-owner global/public/
storage defaults and shared authority must remain intact.

After review/checkpoint, a separately authorized hosted attempt can collect the
safe reason. Pull that checkpoint onto the runtime, establish the protected
verify-full administrative connection, and securely inject the existing three
saved passwords and explicit identities from the provisioning table above. Do
not place credentials in shell history or arguments. With that configuration
already supplied, use this sequence (shell syntax for the 20i runtime):

```sh
export MIOPAGES_DATABASE_OPERATION=managed-role-provision
MIOPAGES_ROLE_ACTION=create node --import tsx scripts/provision-managed-postgres-roles.ts
```

Stop on any failure and retain only the bounded stage/reason/SQLSTATE for further
investigation. Do not loop, repair provider ACLs or assume the reported reason is
itself a demonstrated cause. Confirm rollback/all three roles absent before any
later deliberate create retry; a COMMIT connection loss remains an unknown outcome
and requires read-only inspection. If create succeeds, clear administrative
connection/password configuration, securely supply the independent backup-role
verify-full `DATABASE_URL` and run:

```sh
MIOPAGES_ROLE_ACTION=verify node --import tsx scripts/provision-managed-postgres-roles.ts
```

Confirm the three permanent LOGIN roles and exact ACL/ownership contract from
successful independent verification. In all outcomes, clear administrative
credentials and provisioning secrets from the shell, including `DATABASE_URL`,
`PGPASSWORD` if used, and `MIOPAGES_RUNTIME_PASSWORD`, `MIOPAGES_MIGRATION_PASSWORD`,
`MIOPAGES_BACKUP_PASSWORD`. Do not rerun bootstrap or migrations: the reported
hosted database already has 16 applied / 0 pending and a valid PG17 receipt.
This documentation and its synthetic tests authorize no external execution.

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
provider capabilities. An additional local PG17 ICU proof exercises full snapshots,
backup/media/restore and receipt preservation, with a real different-ICU-locale
target refused before application writes. Unit and integration controls reject
unsupported providers, libc/ICU mismatch, ICU locale and collation-version drift;
existing libc PG17/PG18 and controlled PG18 tests remain in place. The local ICU
library's version is recorded, not assumed to equal the hosted version. Disposable
clusters are removed after testing. Readable
evidence remains ignored under `runtime-content/managed-postgres-proof` and
`runtime-content/pg17-bootstrap-proof`. Negative bootstrap controls include lost or
wrong-column NOT NULL, changed constraints/types, wrong checksums/ledger/receipt,
unrelated SQL, unsupported adapter majors, populated PG17 prefixes and later
migration failure. These must not falsely record 0006 as applied.

## Broad regression fixture prerequisites

A bounded local comparison against unchanged `main` checkpoint
`9236fa076e1975772c0a52f7a2219c5fd5b78e3b` reran the same broad PG18 harness
with and without the ICU changes. Both produced 114 passes / 27 failures, with
the same failing tests and failure types. The generic source created by
`managedEnvironment` plus `seedManagedTenants` is not a universal historical fixture.
It contains two synthetic tenants, no canonical Knowledge revisions, a 16-entry
migration journal, two synthetic PNGs and an explicit migration-role database ACL.

The 27 reported failures comprise 18 frozen-content prerequisite failures, three
historical-media-root failures, three controlled database-ACL refusals, one
historical 6-to-9-entry migration-prefix requirement, one missing foreign canonical
revision and its failing parent test. The promotion test's existing unconditional
schema cleanup masks its earlier frozen-baseline fingerprint refusal with a
missing-schema error. These behaviors also occur on unchanged main.

Supplying the exact existing historical Asset bytes in a private media root and
one supported synthetic foreign canonical revision makes the nine corresponding
unchanged checks pass. Providing the exact checked-in accepted C0 source graph
and original managed bytes passes all 11 unchanged acquisition tests. Using the
supported no-explicit-database-ACL controlled fixture passes all 49 controlled
recovery/proposal/release checks. This does not
waive exact content, ownership, locale or privilege comparisons. Historical
rehearsals need their documented source state/bytes; do not rewrite frozen evidence,
relax migration-prefix assertions, or remove ACL checks to turn a generic run green.
No recovery implementation correction was required by this comparison.

Provider exit remains standard PostgreSQL: no Supabase Auth, Storage, Realtime,
Edge Functions, generated APIs or provider migration history are dependencies.
