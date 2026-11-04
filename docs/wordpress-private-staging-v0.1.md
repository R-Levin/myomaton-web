# WordPress private signed staging, synthetic enrollment slice (2026-11-04)

**Status: source committed, tests NOT YET executed, NOT deployed.** Experimental plugin v0.0.5. This is an intentional stepping stone toward *private, centrally authorized* release staging, **not production enrollment or publication**.

## Scope

The existing protected WordPress admin plugin now has **Tools → MioPages Private Staging**. Without an explicit server-local PHP constant `MIOPAGES_SYNTHETIC_STAGE_CONFIG`, the screen shows **Disabled**, performs no write and accepts no release. Even when explicitly configured, the only action is an admin capability + nonce-protected POST to validate and stage a bounded, signed, **synthetic-only** JSON envelope. It never calls `activate()`, alters the active marker, writes WordPress posts/options/taxonomy/pages, installs real routing, imports the C0 v3 preview fixture, or accesses central services. The signed fixture is stored as an immutable digest-named object by the existing locked release store.

The facade `class-miopages-private-staging.php` enforces a synthetic namespace for organization/presence/site/installation, release ID and claimed approval ID. Those are **not actual central approvals**. An authentic detached Ed25519 signature and pinned public key are required for any accepted test object. The existing pure validator still checks exact signed payload bytes, digest, target IDs, claimed approval, content grammar, expiration and sequence. The signing **private** key is never stored in WordPress or in Git.

## Explicit local enrollment, only after further review

The intended shape of the **server-local, non-Git** constant is described below solely to define the contract. Do **not** fill it out or enable it on 20i until a separate synthetic key, isolated private staging subdirectory, file permissions and approval boundary have been reviewed:

```php
define('MIOPAGES_SYNTHETIC_STAGE_CONFIG', [
    'directory' => /* existing verified off-webroot, distinct test staging subdirectory */,
    'identity' => [
        'keyId' => 'synthetic-test-key-id',
        'publicKeyBase64' => /* pinned base64 Ed25519 32-byte public key only */,
        'organizationId' => 'synthetic-org-id',
        'webPresenceId' => 'synthetic-presence-id',
        'managedSiteId' => 'synthetic-site-id',
        'installationId' => 'synthetic-installation-id',
    ],
]);
```

The plugin never generates or imports a private signing key. A real provider-managed enrollment must later use established central canonical IDs, issuer-key trust, change approval, revocation, rotation and tenant-scoped audit history, and must replace this synthetic-only facade rather than assuming this test constant is production authorization. The previously installed `MIOPAGES_PROBE_PRIVATE_DIR` setting is **not** an automatic opt-in to staging.

## Risks and open checks

- WordPress `manage_options` and nonce guard a development form; these do not authenticate a central signer or make an operator a canonical release approver.
- A staged signed object is *unpublished*; an approval claim in a signed synthetic payload has **no commercial authorization meaning**.
- The current immutable store uses local cooperative locks; the hosted CLI two-process proof passed, but PHP-FPM versus CLI behavior, full filesystem threat review, process crash durability and distributed multi-server coordination are not complete.
- Storage retention, audit, certificate/key enrollment and revocation, issuer authorization, real asset references, release transport and recovery from unknown commit outcomes remain unimplemented.
- `publishable:false` C0 v3 public-projection fixture is NOT a release and must never be signed and shipped as an approved public deployment.
- Multi-tenant platform 100+ capacity and isolation require separate load/recovery tests. This proof is only one isolated installation.

## Test and installation gate

After pulling active branch:

```powershell
php -l .\wordpress\miopages-delivery\miopages-delivery.php
php -l .\wordpress\miopages-delivery\includes\class-miopages-private-staging.php
php -l .\wordpress\miopages-delivery\tests\private-staging-smoke.php
php .\wordpress\miopages-delivery\tests\private-staging-smoke.php
php .\wordpress\miopages-delivery\tests\release-contract-smoke.php
php .\wordpress\miopages-delivery\tests\release-staging-smoke.php
php .\wordpress\miopages-delivery\tests\preview-smoke.php
```

Only explicit PASS for all four smoke suites and three successful syntax checks clear this gate. **Do not upload v0.0.5 until reviewed and tested.** After successful local checks, package with the proven portable `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery` method. The initial hosted check must confirm Tools → MioPages Private Staging is **Disabled** and that existing preview/environment/probe screens remain functional. No synthetic enrollment config or live staging should be enabled during that initial upgrade.

Next: separately establish an isolated test signing issuer and pinned verification public key, protected staging subfolder, and an end-to-end nonpublic signed test, while preserving central authority. No public release/rollback until subsequent milestones.
