# One guarded WordPress rehearsal fixture

The hosted inventory confirmed the recorded C0 graph and both hostname bindings, 38 C0 records across 21 canonical grant tables, zero unknown/real records, acceptable PUBLIC permissions, and no separate rehearsal fixture. This initializer supplies that missing fixture in the existing database.

The only accepted operations are create-rehearsal-fixture and verify-rehearsal-fixture through the existing protected migration command. They use the established migration-role Session Pooler URL on port 5432, verify-full TLS, trusted CA and expected database. The command normalizes the previously documented trailing database-path backslash in memory.

## Exact write scope for approval

The create operation establishes one synthetic inactive Organization, one inactive Web Presence with no primary domain, and one inactive Managed Site with no hostname binding. It creates one activation/customer binding and one public-scope synthetic Knowledge fact with a matching immutable revision. It creates no Page, Section, Action, hostname, publication or release.

To satisfy the existing activation rules, it creates one synthetic Direct Start intake and submission owned by the existing C0 intake entry point, one activation case and exactly three events for create, synthetic commercial confirmation and customer initialization. The new intake records reference C0. Existing C0 records and both hostname bindings retain their exact contents.

The initializer reuses IntakeService, ActivationService, initializeCustomer and the canonical revision writer. The default activation path remains disposable-only. The initializer supplies a transaction boundary bound to its own connection, fixed pending scope and fixed synthetic authority. The new approved inactive Knowledge writer requires an exact inactive activation-bound owner and one explicitly confirmed public fact. The ordinary onboarding writer remains internal-only.

Creation runs in one transaction, with writer operations nested as savepoints and existing deferred activation guards checked at commit. It takes application-table locks to verify exact preservation of the previous inventory. Lock wait is bounded to five seconds and statements to thirty seconds. These locks can briefly delay application writes, so use the approved controlled rehearsal window.

The initializer records its IDs and digests in the new Organization metadata. A repeated create verifies the complete fixture and performs no new writes. Partial or conflicting records, changed baseline, changed C0 bindings, unexpected fixture-owned rows or an ineligible canonical fact cause refusal. A disconnect around commit requires the independent verify operation before any create retry.

Local validation passed with disposable PostgreSQL 18 and the consolidated WordPress gate. Tests cover complete rollback after foundation creation, independent read-only verification, a repeated create with no new rows, conflicting fixture content, C0 hostname drift and preservation of the default activation guard.

## Approval-ready 20i CLOUD procedure

Use the separate rehearsal checkout after retrieving the committed implementation. Keep the existing protected migration environment, expected database and CA. The public Core process on port 8080 is outside this operation.

After explicit approval for this fixture write, run once:

```bash
MIOPAGES_WP_SCHEMA_ACTION=create-rehearsal-fixture \
MIOPAGES_WP_FIXTURE_APPROVAL=create-synthetic-rehearsal \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

Then run the independent read-only verification in a fresh invocation:

```bash
MIOPAGES_WP_SCHEMA_ACTION=verify-rehearsal-fixture \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

Require verified=true, readOnly=true, inactive fixture identity, and the reported canonical fact ID, key, revision and fingerprint. Verification performs no DML, obtains no write lock and rolls back its read-only snapshot. Record the sanitized site and fact identifiers for the existing rehearsal commands.

If the initializer refuses, share only its sanitized stage and code. Do not edit records to repair it. The fixture's preservation receipt describes the exact state before the private rehearsal. Subsequent legitimate writes outside the fixture, or proposal preparation on the fixture, can invalidate that strict initialization checkpoint. Verify immediately after creation, before the rehearsal begins.

## Next operation and closure

Once fixture verification passes, obtain the previously required approval for the restricted WordPress roles and shared-table grants, apply 0016/0017, run the role session probes, and use the existing [HTTPS rehearsal procedure](wordpress-private-stage-rehearsal.md). The source Page must bind its text to the returned Knowledge fact revision and fingerprint. Use the existing Cloud server, protected miopages.org installation and private storage.

Complete exact independent approval, projection review, issuance, authenticated pull, private stage, receipt retry and revocation. Confirm active sequence 0 and unchanged public output, restore WordPress v0.0.6 and close the temporary listener. Retain evidence and return to Commercial V1 Media-to-Publication.
