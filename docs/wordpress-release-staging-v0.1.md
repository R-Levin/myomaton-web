# MioPages WordPress offline staging proof — v0.1 (2026-11-03)

**Status:** experimental, locally testable **offline PHP storage proof**. Does **not** connect to the installed WordPress plugin, route public requests, or mutate MioPages canonical data. Builds on [signed release contract](wordpress-release-contract-v0.1.md).

## Security and lifecycle

1. **Store location:** The calling application must supply a private directory **outside the web document root** and inaccessible through web URLs, PHP execution, unauthorized OS users and backups exported to public paths. Never treat `wp-content/uploads` as a safe default. No path is guessed by the library.
2. **Trusted enrollment inputs:** Caller supplies locally pinned verification key, key ID, tenant, Web Presence, Managed Site and installation IDs. These do not come from the release envelope.
3. **Stage:** Under an exclusive advisory filesystem lock, validate the signed envelope against *current active state*, store the exact envelope bytes as an immutable digest-named object, verify any existing object's digest, then atomically rename a private temporary file into place. A retry with identical bytes is idempotent; changed bytes and wrong-target/replay are rejected. Stage **does not change the active marker**.
4. **Activate:** Under that same lock, read the immutable staged object by digest, verify its hash and **reverify** its signature, target, approval claim, time and monotonic `sequence/previousReleaseId` against *fresh active state*; atomically replace a small private active marker. The returned status means only that the proof's pointer advanced; **there is no public renderer listening to this marker.**
5. **Recover/rollback:** The previous staged objects remain immutable. To restore earlier content, the central authority must issue a **new signed release**, with a fresh release ID and the next sequence, whose content matches the earlier approved desired state. v0.1 refuses an unauthenticated pointer rewind; prior version retention alone does not constitute a safe, working rollback.

## Offline state model

```text
private-dir/
  .release.lock
  active.json                # {"releaseId":null|string,"sequence":int,"objectSha256":null|string}
  objects/
    <sha256>.json            # exact signed JSON envelope bytes
```

The empty active state is `releaseId:null`, `sequence:0`, `objectSha256:null`. Every accepted activation increases sequence by exactly one. The staging validator returns a payload only after its signature and all contract guards pass.

## Failure, concurrency and portability limitations

- File-lock safety requires all writers on the **same host and cooperative filesystem lock domain**. A multi-server WordPress deployment, NFS, or concurrent independent application processes may require a transactional DB row and CAS instead. This proof does not claim cross-host atomicity.
- The active marker write is temp-file-plus-rename, which avoids a partially written JSON file on a normal local filesystem. This is **not a fully proven crash-durable transaction** (directory fsync, storage failure guarantees and Windows vs Linux rename behavior remain to be investigated). A failure after replacing the marker can have an **unknown outcome**, requiring read-only verification; do not retry an activation blindly.
- Filesystem permissions and symlink protection, cleanup/retention limits, interprocess contention, threat modeling and WordPress-environment compatibility have **not** been independently audited. The offline store is explicitly not production-ready.
- The release contract's current text-only, no-assets content schema and lack of true central signer, approval integration, secure enrollment, key rotation and independent installation identity remain separate blockers. Neither the C0 v3 preview fixture nor other unsigned data can be staged.
- The stored marker points at the versioned payload **only**; it does not coordinate WordPress posts, navigation/SEO tables, media, cache and renderer. Public release activation/rollback will need a separate atomic serving design and end-to-end recovery tests.

## Bounded acceptance tests

The script `wordpress/miopages-delivery/tests/release-staging-smoke.php` creates a **new local temporary directory** and ephemeral Ed25519 keypair. Test the full valid signed envelope path: empty state → stage 1 (no activation) → activate 1 → reject replay/stale/foreign target → stage 2 → reject bad digest or stage tampering → activate 2 → reject rewind; allow rollback *content* through signed release 3 with fresh monotonic identity. Confirm independent stored objects unchanged and marker tracks latest. Finally remove only its own private temporary directory. No WordPress, central API, 20i API or public DNS writes.

**Operational instruction:** Run locally with PHP 8.3 + Sodium, then record exact CLI results in Git. Do not wire the library into the live plugin until the physical storage/security and transaction model have been reviewed.

## Hardening test slice — 2026-11-03

The offline store now rejects nonregular object, active-marker and lock paths, checks for symlinked root ancestors where PHP can detect them, and suppresses expected filesystem warnings so failures return structured refusals instead of proceeding. These checks are **defense in depth, not proof against adversarial TOCTOU filesystem races or a writable untrusted directory**; a private root controlled exclusively by the service user remains mandatory.

The existing `release-staging-smoke.php` additionally injects a malformed active marker and a temporarily missing active object. It requires that `status()`, `stage()` and `activate()` refuse unsafe/inconsistent state, rather than resetting to sequence 0. The script then restores its own test fixture bytes only to finish the smoke run. **Production recovery must not manually repair active state from guessed data.**

A separate `release-staging-concurrency.php` launches two independent PHP processes against one private root, both attempting the same signed first release. Expected result: exactly one worker activates sequence 1 and the other refuses; the active marker remains at sequence 1. Worker contention exercises cooperative local `flock` semantics; it does not establish distributed safety or crash durability.

To validate after fetching the branch:
```powershell
php -l .\wordpress\miopages-delivery\includes\class-miopages-release-store.php
php -l .\wordpress\miopages-delivery\tests\release-staging-smoke.php
php -l .\wordpress\miopages-delivery\tests\release-staging-concurrency.php
php .\wordpress\miopages-delivery\tests\release-staging-smoke.php
php .\wordpress\miopages-delivery\tests\release-staging-concurrency.php
php .\wordpress\miopages-delivery\tests\release-contract-smoke.php
```

**Stop on any failed or skipped test.** Do not deploy these offline-only files into the hosted WordPress plugin or treat passed smoke tests as authorization to publish.
