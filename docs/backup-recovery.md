# PostgreSQL and managed-object recovery baseline

## Current result: restore-mechanics gate SATISFIED; automation pending

The verified backup on operator-approved `F:\MyomatonBackups` has passed an isolated
restore with semantic schema, security/ownership, locale, sequence and all 20 table
content comparisons. The complete canonical customer fingerprint matches. All five
managed objects were restored to private temporary storage and verified by hash;
the generated target was stopped and removed. No live repair/migration was performed.

The legacy catalog hash differed because two attestation CHECK constraints were
deparsed with different associative AND nesting. Diagnostic reports/hashes remain
local evidence; archive/manifest/checksums were not rewritten. The semantic contract below
normalizes only that Boolean representation and retains exact conditions/order.
The original test also used a different locale and omitted owners/privileges; the
corrected test recreates and verifies original locale, owners, grants and role flags.

Backup/restore gate criteria are satisfied for this development checkpoint. This
does not authorize durable prospect collection. Remaining automation: rehearse the
scheduler wrapper, obtain explicit job authorization, install and prove an automatic
run. Verify appropriate encryption/key recovery for removable prospect-data backups.
The attached disk protects against primary-disk loss, not whole-machine loss/theft
or administrator/ransomware compromise. No scheduled job has been installed/run.

Migration 0010 remains unapplied publicly. Durable prospect intake, Review synthesis,
operator approval UI and delivery remain disabled/deferred. This checkpoint covers
backup/recovery tooling, comparison, tests and documentation only; it does not
authorize scheduler installation, encryption changes, cloud configuration or intake activation.

## Storage topology and scope

Current source: PostgreSQL 18.6, `localhost:5432/myomaton_dev`, with its live data
directory on C: according to the PostgreSQL Windows service configuration. Public
state owns organizations, customers/Web Presences, Managed Sites, Pages/Sections,
Actions/Navigation, Subjects, Design Systems, Assets/AssetUsages, Contact state,
canonical Knowledge/Offering records and revision history. Drizzle's migration
tracker is in `drizzle.__drizzle_migrations`. Nine migrations are installed; public
media-acquisition and prospect-intake tables are absent. Checked-in migration 0010
is pending source. Configuration is read from protected `.env.local`; connection
URLs/passwords are never arguments, manifests or logs.

The five managed objects live at
`<managed-root>/<web-presence UUID>/objects/<SHA-256>`; configured root precedence
is MANAGED_ASSET_ROOT, MYOMATON_ASSET_ROOT, then runtime-assets. Metadata/associations
live in PostgreSQL; those durable bytes cannot be reconstructed from database rows.
All canonical managed references, including inactive managed Assets, are copied
and verified by content hash. Other resolver metadata remains in the database;
external resources are not fetched or promised recoverable.

The native archive includes non-system durable schemas and excludes only recognized
UUID-named disposable test/preview schemas. This excludes existing human intake
test submissions: they remain separately preserved as ignored test evidence.
No runtime-content evidence, quarantine/preview output, unreferenced files, caches,
build output, node_modules, source checkout or environment secrets are copied.
Git supplies the recorded application release; secrets/roles/server configuration
require separate protected recovery procedures. A database dump is not a cluster
configuration/global-role backup, WAL/PITR service or full-host image.

No previous application backup job or provider backup coverage was found. WAL
archiving is off. C: is physical disk 0; approved F: (LaCie) is physical disk 3.
F: encryption status could not be read by the current account. No cloud credentials
or uploads are introduced, and no database artifact belongs in GitHub.

## Native method and artifact structure

[CLI](../scripts/backup-recovery.ts), [implementation](../scripts/backup/core.ts),
[boundary/retention policy](../scripts/backup/policy.ts) and
[Windows wrapper](../scripts/run-backup.ps1) require an explicit absolute root
outside live/project/PostgreSQL-tool directories. A nonempty unmarked directory is
refused. Windows root access is restricted and checked for the current user,
SYSTEM and Administrators. POSIX roots must be private. No public links are created.

```
F:\MyomatonBackups\
  backup-root.json
  points\<UTC timestamp>_<random suffix>\
    database.dump
    objects\<owner UUID>\objects\<content hash>
    manifest.json
    checksums.txt
    COMPLETE
  proofs\<point>_<test UUID>.json
  restore-tests\<invocation UUID>\    # temporary, private test target
```

The manifest records safe database/version identifiers, included/excluded schemas,
application HEAD, migration rows, customer/table fingerprints/counts, sequence and
schema signatures, native custom-format archive size/hash and managed-object
identities/references/sizes/hashes. It does not contain credentials or full answer
snapshots. The archive remains sensitive. The exported read-only PostgreSQL snapshot
ties pg_dump and metadata to the same transaction; immutable content-addressed
objects tie bytes to those references. A post-backup customer-drift check refuses
a success if that state changed. Avoid migrations/schema changes during backup;
quiesce writers for recovery rehearsals. Sequence state is not MVCC data.

Work starts in a new .partial directory, never by overwriting a known-good point.
Missing bytes, dump/native failures, manifest/checksum failure and verification
failure return nonzero and do not retain a successful COMPLETE marker. Hash checks
are integrity checks, not signatures or protection against a malicious administrator.
Only trusted operator-created archives may be restored.

The format follows PostgreSQL's [custom archive documentation](https://www.postgresql.org/docs/18/app-pgdump.html)
and [pg_restore documentation](https://www.postgresql.org/docs/18/app-pgrestore.html).
Verification checks every declared artifact, checksums, archive listing and full
archive readability. Only a successful real isolated restore establishes recovery.

## Commands

Run from the repository with PostgreSQL 18 binaries (default installed Windows
path; PG_BIN_DIR may select another matching installation) and PowerShell 7.
Do not put connection passwords in commands.

```powershell
node --env-file=.env.local --import tsx scripts/backup-recovery.ts backup --root F:\MyomatonBackups
node --env-file=.env.local --import tsx scripts/backup-recovery.ts verify --root F:\MyomatonBackups --point <reported-point-id>
# Creates its own private target; never specify a live restore destination.
node --env-file=.env.local --import tsx scripts/backup-recovery.ts restore-test --root F:\MyomatonBackups --point <reported-point-id>
node --env-file=.env.local --import tsx scripts/backup-recovery.ts retention-plan --root F:\MyomatonBackups
```

An optional copy operation can duplicate a verified complete point to another
explicitly authorized dedicated root; it never establishes a failure domain merely
from a different folder. F: is the sole authorized artifact destination in this
review. No alternate copy destination was used.

Restore-test has no user-supplied destination connection. It initializes its own
SCRAM-authenticated cluster under the dedicated root, binds loopback on a fresh port,
creates a random backup_restore database with the original owner/locale, and never
issues restore SQL to the source. Original roles are provisioned only in that private
cluster; role password hashes are not captured. A generated bootstrap password is
held temporarily in a protected initialization
file, removed after initdb, and never logged. Controller startup uses detached
stdio to avoid inherited background-server pipes. The generated target is stopped
and removed after comparison, only after verifying its bounded path/ownership marker.
Incomplete diagnostic scratch directories are not valid restore points and remain
local evidence, excluded from source control. No live storage was overwritten.

Successful comparison verifies canonical and all durable table contents,
migrations, sequence state, schema signatures and object inventory, then restores
bytes to a private temporary directory and verify each hash. A mismatch fails and
does not change the source. Isolated restoration applies original owners/ACLs and
verifies operational roles. Compatible binaries, server configuration, authentication
secrets and application serving still require independent checks before real cutover.

## Recovery equivalence contract

The [catalog comparator](../scripts/backup/catalog.ts) compares semantic schema and
security separately. Its original legacy hash comprised information_schema column
names/positions/types/defaults/nullability/identity, constraint type/validation/
pg_get_constraintdef text, index names/definitions, non-internal trigger names/state/
definitions and function names/definitions. Owners, ACLs, extensions, OIDs, comments,
locale and sequence definitions were absent. Table/migration hashes and current
sequence values were separate checks.

The two differences were public.business_knowledge_revisions /
knowledge_revision_attestation and public.offering_revisions /
offering_revision_attestation: `((A AND B) AND (C AND D))` became
`(A AND B AND (C AND D))`. This is representation only. Atom token text and order
remain exact; only adjacent AND nodes flatten. Arithmetic parentheses, OR/NOT/NULL,
casts and unsupported expressions are not simplified. Boundary and NULL behavior
was verified in PostgreSQL. Definition functions reconstruct SQL rather than return
the original DDL text; see [PostgreSQL introspection](https://www.postgresql.org/docs/18/functions-info.html).

Application schemas, relation kinds/storage/replica identity/RLS, full column type
modifiers/collation/nullability/default/identity/generated expressions, named
constraints/validation/enforcement/deferrability, logical indexes/validity/uniqueness,
functions/triggers, enum/domain types/constraints, required extensions/versions,
policies, sequence definitions/ownership links and exact sequence current values
must match. All application rows, migration state and canonical fingerprint must
match using UTC timestamp representation. Sorting uses a stable application order,
independent of database collation; conditions themselves are not reordered.

The internal tuple label of index pages_managed_site_id_slug_unique retained the
pre-rename microsite_id name; rebuilding produced managed_site_id. It is not an
application column: application columns and exact pg_get_indexdef keys agree.
Index tuple labels are excluded from the application-column inventory, while full
logical index definitions and flags remain required. OIDs are resolved to portable
names, never compared numerically. Unknown representation differences fail closed.

Separate security checks require schema/relation/column/function/type/default/
database/extension owners and ACLs, role flags/limits, memberships/settings and
function security attributes to match. Database encoding/locale/provider/version
must match; the original C test locale was a meaningful difference and was corrected.
Password hashes are separate protected recovery configuration, not manifest data.
ACL text is exact; unproven equivalent ACL reordering still refuses success.

Future backups record the full version-2 recovery contract. The existing version-1
point is immutable: its baseline is supplemented from read-only current source only
after every legacy catalog/data/sequence invariant matches the recorded point.
This proves recovery against current security, not historical unrecorded security.
Unsupported role settings/expiry/membership, explicit database ACL or non-libc
locale recovery refuses rather than dropping checks. Broader infrastructure recovery
remains separately authorized work.

The [private PostgreSQL regression](../tests/integration/backup-recovery.test.ts)
proves missing/changed columns, types, nullability, defaults, indexes, constraints,
sequence definitions/values, functions, triggers, extensions, owners and public
privileges fail the comparison. Only private rollback fixtures are mutated.

## Retention and automation proposal

Initial policy: retain the newest verified point per UTC day for 14 days, plus the
newest verified point per seven-day bucket for the preceding eight weeks (22 points
at a regular daily cadence). Always preserve the latest verified point. The policy
planner performs no deletions; malformed/incomplete directories remain unmanaged
for operator inspection. No existing user files or backup points were pruned.
Review the exact plan before any later separately authorized bounded cleanup.
Retention must eventually include restored prospect deletion/expiry obligations;
backup is not indefinite archive, and this policy is not a production privacy waiver.

Proposed Windows Task Scheduler job, **not installed**:

- Name: MioPages Development Backup; daily 03:00 local time.
- Account: the current operator, only while logged on; no stored task password or
  elevated principal. Source read access and backup-root access are required.
- Program: installed PowerShell 7 pwsh.exe.
- Arguments: `-NoProfile -NonInteractive -File C:\Users\mplxs\Projects\myomaton-web\scripts\run-backup.ps1 -BackupRoot F:\MyomatonBackups -NodePath "C:\Program Files\nodejs\node.exe"`.
- Start in: `C:\Users\mplxs\Projects\myomaton-web`; StartWhenAvailable; IgnoreNew
  while another run executes; one-hour execution limit. Do not bypass execution
  policy; sign/authorize local scripts through the operator's existing policy.
- Wrapper exits unsuccessfully for failed backup or verify. Monitor task exit codes
  and last verified point; missing/offline F: is a failure, not permission to silently
  write to a different disk. Local task history is not centralized alerting.

The CLI backup was exercised; the wrapper requires an operational rehearsal before
job creation. Install a machine-level task only after explicit operator authorization
and clean restore proof. No scheduled task or Codex automation was silently installed.

## Actual disaster recovery procedure

1. Operator declares the incident, stops writes, preserves evidence and selects a
   verified restore point. A real destructive restore/cutover requires explicit
   operator authorization; these scripts intentionally provide no live overwrite.
2. Recover the recorded Git release, compatible PostgreSQL/Node runtimes, required
   extension/database locale configuration and infrastructure. Recover secrets from
   approved protected storage; recreate least-privilege roles/ACLs and rotate exposed
   credentials. Do not obtain credentials from Git or an archive manifest.
3. Verify artifact checksums/archive, restore into separate infrastructure, restore
   matching managed objects into a new volume and compare every recorded state/hash.
4. Check migration prefix (do not automatically apply pending 0010), customer scopes,
   relationships, contact/prospect state, expiry/privacy requirements, roles/ACLs,
   source/restore fingerprints, object references/bytes and application/media serving.
   Verify backups/schedule on recovered infrastructure and resolve every discrepancy.
5. Only after review and explicit approval switch connection/object-root configuration
   and serving traffic. Keep rollback/evidence and bounded incident copies. Test again
   after recovery-path changes and periodically; a successful rehearsal is not cutover approval.

Separate/off-machine or removable-media storage should be encrypted at rest, with
protected recoverable keys and restricted access. Encryption/key recovery remains
unverified here; no key-management or volume-encryption changes were attempted.
The [security/recovery posture](security-operations.md#backups-and-disaster-recovery)
and [intake gate](free-review-intake.md) remain authoritative.
