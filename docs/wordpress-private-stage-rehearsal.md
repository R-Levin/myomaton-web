# Protected WordPress private-stage rehearsal

This milestone composes Core's durable proposal, preview, approval and canonical projection checks with the Batch 1 delivery adapter. A private release is an independently reviewed, exact text-only projection of an approved proposal for a bound, inactive Managed Site. The release ID is an adapter record. The existing disposable canonical release service retains its original guard, and the protected operator role cannot write canonical Pages, Sections or routing state.

## Identity and evidence

- Run the protected Core operator command from an access-controlled operator environment. An individually issued 32-byte random token identifies an operator and is checked against a durable SHA-256 verifier, expiry and revocation. The command does not accept an asserted actor or customer mandate. Operations require a current grant scoped to the exact Web Presence and Managed Site. The grant identifies the verified customer mandate for an approval. Keep token input off the command line and out of files, logs and history.
- Core prepares, renders and approves through `SiteProposalService` and the existing append-only proposal ledger. The protected operator appends an approval provenance marker in the same transaction as approval, after rechecking the operation grant and mandate. An existing development approval does not have that marker.
- A different operator with `review-private-stage` can inspect the exact WordPress projection and record their review against its digest. The release stores the proposal, approval digest and reviewer grant. Issuance and pull rederive the projection from the current canonical source and verify the approved revision, candidate and preview. A stale baseline or revoked approval/review grant closes eligibility. Operator credential expiry or rotation governs new actions. Revoking an approval or review grant also stops distribution of the evidence made under that grant.
- The bounded v1 source is one text-only Page from an exact approved candidate. Each bound fact must pass Core's current public-visibility and approval rules. The source includes neither canonical evidence metadata nor private facts, media or Actions. The rehearsal needs separately authorized public-scope facts already in the inactive fixture. The operator command has no canonical visibility-promotion permission.

## Database rollout and permissions

Current status: the shared-database inventory, inactive synthetic fixture and database-only rollout are complete, with all nine hosted receipts validated in [development control](development-control.md#hosted-wordpress-database-only-rollout-complete--november-5-2026). The database provisioning/migration instructions below record completed prerequisites and must not be blindly rerun. The owner has now separately authorized one protected HTTPS rehearsal, including the required operator/installation configuration, temporary private listener, exact proxy routes and temporary v0.0.7 plugin, subject to the preflight, exact owner approval and rollback gates below. This is rehearsal authorization only, with no public publication or canonical content changes.

Review on an isolated rehearsal database with the existing 16 canonical migrations and their verified ledger. Provision dedicated `miopages_wp_operator` and `miopages_wp_pull` LOGIN roles with no provider administration flags or role memberships. They need database CONNECT and public schema USAGE, and must have no schema CREATE privileges. Use individual operator tokens in the protected command environment. Keep the pull role and its credentials out of the operator and migration provisioning workflow.

The prepared migration command is `node --import tsx scripts/db/wordpress-private-stage.ts`. It requires `MIOPAGES_WP_SCHEMA_ACTION=apply-private-stage`, an exact `MIOPAGES_WP_EXPECTED_DATABASE`, and `MIOPAGES_WP_MIGRATION_URL` for the existing migration role over verified TLS. Supply a trusted certificate chain through `MIOPAGES_WP_DATABASE_CA` if required. The command checks the authenticated migration role, database identity and canonical ledger, applies 0016 and 0017 into the separately owned `miopages_wp` schema in one transaction, and records normalized checksums. Repeat execution verifies the recorded hashes and reapplies the scoped grants. An unknown commit outcome requires independent inspection before retry.

The migration owner provisions identity verifiers and grants after verifying real operator identity and customer mandate. The operator role can append proposal, private-release and delivery evidence. The pull role can read the required evidence, consume bounded nonces and record the first stage timestamp. It cannot read operator token hashes, change installation status or replace the issued envelope. The normal app runtime role has no access to the adapter schema.

The canonical managed backup verifier recognizes the exact adapter grants on canonical tables and preserves its portable canonical manifest. Plan a separate protected backup and restore rehearsal for `miopages_wp`, including its foreign-key dependencies on the matching canonical snapshot. Keep adapter data and key history during rollback. Disable the entry points and revoke access if necessary. A schema drop or ledger rewind would discard evidence.

## Disabled-by-default composition

- The Core operator command is `node --import tsx scripts/wordpress-private-operator.ts`. It reads a single bounded JSON object on stdin with `token`, `operation` and `input`. The supported operations are `prepare` (including a revision with `expected`), `preview`, `approve`, `review`, `enroll`, `issue`, `rotate` and `revoke`. Review first with the site, proposal ID and approval digest. Supply `commit.releaseId` and `commit.projectionDigest` only after inspecting the exact returned projection.
- Both Core entry points require `MIOPAGES_WP_PRIVATE_STAGE=enabled` and `MIOPAGES_WP_CORE_ORIGIN`. The operator process uses `MIOPAGES_WP_OPERATOR_URL` and receives the Ed25519 private key as `MIOPAGES_WP_SIGNING_KEY` only for issuance. The HTTPS pull process uses `MIOPAGES_WP_PULL_URL` and a separate 32-byte installation secret resolved from `MIOPAGES_WP_CREDENTIAL_<UUID_WITH_UNDERSCORES>` as lowercase hex. Database URLs require `sslmode=verify-full`. Keep the signer key, operator tokens and migration credentials out of the pull process and WordPress. Preserve the exact HTTPS origin through the reverse proxy and redact authentication headers.
- WordPress registers `wp miopages private-stage` only when WP-CLI is active and protected local configuration defines `MIOPAGES_PRIVATE_PULL`. The configuration pins `coreOrigin`, `credentialId`, `secretHex`, `releaseId`, `identity`, `directory` and `documentRoot`. The installation origin comes from WordPress's configured home URL. The directory must be private and outside both the WordPress and web document roots. The command stages and reconciles only.

## Operator procedure on the existing 20i environments

Use the existing Cloud server, the protected miopages.org WordPress installation and the existing Supabase project. The public Core checkout at `~/public_html` and its listener on port 8080 stay in service throughout. Reuse the existing off-webroot WordPress parent directory, with a dedicated private child for this release so its objects and lock are separate from the v0.0.6 synthetic store. The operator reported Core `5b94a1d`, Node 22.23.2, and WordPress v0.0.6 with WP-CLI and Sodium. Treat these as reported baseline evidence.

### 1. Read-only preflight

**20i CLOUD.** From the Cloud shell, use the exact **Session Pooler** hostname from the existing Supabase project on port 5432. The operator verified the direct endpoint resolves to IPv6 and Cloud returns ENETUNREACH, so skip further direct connectivity checks from Cloud. Use the already authorized migration login in role.project-ref form with sslmode=verify-full and the provider CA. Keep the URL in the protected session. From a checkout of the reviewed branch outside `~/public_html`, with dependencies already present, run:

```bash
MIOPAGES_WP_SCHEMA_ACTION=preflight-private-stage \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

Supply `MIOPAGES_WP_EXPECTED_DATABASE`, `MIOPAGES_WP_MIGRATION_URL` and, if needed, the CA PEM through `MIOPAGES_WP_DATABASE_CA`. Require 16 exact canonical migrations, the compatibility receipt on PG17, the expected restricted existing roles and migration ownership, and an absent or correctly owned adapter schema. Missing new rehearsal roles can be recorded for the approval step. Confirm a distinct local port and a temporary HTTPS route limited to the two delivery POST paths. The proxy must overwrite `Host` and `X-Forwarded-Proto`, keep the listener private and redact `X-MioPages-*` headers. Use a prebuilt compatible Linux checkout or a separately scheduled build if Cloud memory is constrained.

Keep normal Core on its existing Session Pooler URL. The adapter accepts the dashboard's Supabase Session Pooler host, explicit port 5432 and matching role.project-ref login. It rejects 6543 and independently checks certificate hostname, TLS and the actual backend login and effective roles. The read-only preflight must report sessionVerified: true. It proves the same backend retains the required search path, UTC settings and session advisory lock across a read-only transaction and rollback. With existing authorized credentials, run the same script with MIOPAGES_WP_SCHEMA_ACTION=probe-operator-session or probe-pull-session in the corresponding role's own environment. Supply only its role URL, expected database and CA. If the roles do not exist yet, run those probes after approved provisioning and before enabling either entry point.

The adapter migration uses session mode only if this probe and the exact database/ledger preflight pass. It repeats the probe and role/database checks at apply time. The DDL and migration journal run in one transaction under a transaction-level lock. An ambiguous result still requires read-only inspection before retry. If the probe fails, stop and arrange a separately approved migration execution path. This decision covers the adapter DDL, not pg_dump or recovery tooling. See [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).

The shared-database inventory, restricted-role/shared-grant approval, [fixed rehearsal fixture](wordpress-rehearsal-fixture.md), recovery point and adapter setup have now passed. Refer to the latest development-control checkpoint for the recorded receipts. Retain these completed gates and proceed to the remaining listener, operator/installation configuration and WordPress change review.

**Database isolation decision.** Use a distinct bound inactive synthetic Organization, Web Presence and Managed Site with an authorized public-scope fact and no hostname binding. The current grants include SELECT on shared canonical tables and allow the operator role to append to the shared proposal ledger. Use the existing database only if its relevant inventory is verified synthetic-only and the owner expressly approves those database-wide grants for these restricted service logins. The application's site grants do not constrain direct SQL by those logins. If the database contains live customer records or the grants cannot be accepted, use a separately permissioned database within the existing service where supported. A new service is unnecessary unless the existing service cannot supply the required boundary. Record the matching canonical and adapter recovery plan before rollout.

**Shared-database inventory.** After the verified PostgreSQL preflight, use the same protected migration environment from the separate Cloud checkout:

```bash
MIOPAGES_WP_SCHEMA_ACTION=inventory-private-stage \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

The command verifies the recorded C0 graph and both hostname bindings, counts rows by canonical ownership over the adapter SELECT allowlist, and checks PUBLIC database and application ACLs. If a separate synthetic fixture is already known, set MIOPAGES_WP_REHEARSAL_SITE to the reviewed JSON object with organizationId, webPresenceId and managedSiteId. Optionally supply MIOPAGES_WP_SYNTHETIC_SITES as an array of other reviewed synthetic graph objects. Ownership and operator attestations drive classification. The command cannot determine whether individual contents under an attested graph are real customer data. Only attest graphs verified synthetic. An unclassified record blocks the shared grants.

The report contains counts and checks without content or credentials. PASS still requires database-owner approval for rollout. BLOCKED lists the remaining conditions. If the fixture is absent, separately review one narrowly scoped inactive, unhosted synthetic graph and activation binding with one revision-linked public-scope fact. The existing hosted operator command has no fixture initializer. Preserve C0 and its routes.


**20i RESELLER.** In the existing WordPress account, confirm the plugin version and the exact configured synthetic staging root. Inspect its `active.json` without calling the plugin status method, which may acquire or create a lock. Absence at the exact verified root means sequence 0. Stop for a present, unreadable, symlinked or inconsistent marker. Confirm the proposed new child under `~/miopages-private` will be owned by the WP-CLI account, mode 0700, and outside every served root or alias. Capture the logged-out access challenge and a stable authenticated page-content baseline. Confirm the exact v0.0.6 rollback package can be preserved outside the webroot.

The existing Reseller account's default `php` is 8.0.30 without Sodium. Read-only inspection verified `/usr/php84/usr/bin/php` is already installed as PHP 8.4.27 with Sodium and cURL, and runs the existing WP-CLI 2.5.0 PHAR. Use this temporary shell function for the Reseller commands below; do not change PHP defaults or the site's configuration:

```bash
wp_rehearsal() {
  /usr/php84/usr/bin/php /usr/local/bin/wp --path=/home/sites/36a/9/9fe7ae6df4/public_html "$@"
}
```

For the authenticated HTTP baseline, the local Windows launcher is `C:\Python314\python.exe scripts/wordpress-http-baseline.py`. It uses the existing Reseller agent key, prompts for the existing HTTP Basic Auth credential, sends it only over encrypted stdin to PHP8.4, and requires two identical HTTP 200 page responses with TLS verification and redirects disabled. Only sanitized status/size/hash evidence is saved under the existing ignored `runtime-content` directory. A failed login or unstable response stops without retry, password reset or hosted writes. No PowerShell execution-policy change is required. Keep the receipt for comparison after rollback.

### 2. Approval boundary

For this authorized synthetic technical run, the owner selected `rehearsal-owner-approver` (owner makes the exact approval decision) and `rehearsal-technical-reviewer` (Codex reviews the projection). These are proposed nonsecret references, not already-enrolled accounts. Provision and independently authenticate distinct random-token principals through the existing Core credential/grant tables, and report actual operator UUIDs and grant references before use. Bind every grant only to Organization `b3b46645-0364-4329-83c7-86a6ea9e56c4`, Web Presence `819d007a-595d-4374-a2f0-96b900d46559` and Managed Site `1d92a248-416f-4e22-baaf-d2f1fca70352`. Record functional separation of authenticated test principals; do not claim independent human governance, real customer identity evidence or a real customer mandate. Prepare and preview the durable candidate before requesting the owner's exact digest-bound approval. Preserve the existing different-operator review check.

**Privileged routing handoff, pending provider confirmation.** The account has no `.htaccess` or account-owned proxy controls. The owner identified 20i support or a privileged operator as the route manager; no provider confirmation or scheduled change has been received yet. Request only reversible overrides on the existing `runtime.miopages.com` HTTPS vhost for exact POST paths `/api/wordpress-delivery/pull` and `/api/wordpress-delivery/receipt` to `http://127.0.0.1:8081`, preserving paths, bodies and authentication headers. Overwrite upstream Host with `runtime.miopages.com` and X-Forwarded-Proto with `https`. Disable caching and credential-header logging for these routes, preserve all other routes on port 8080, and do not expose 8081 externally. Confirm the actual provider-specific installation/removal method and responsible operator before enabling anything. This contract is a support handoff, not a claim that arbitrary proxy directives are writable from the account. Do not use application rediscovery to replace the public runtime.

Review one change set naming the chosen database, synthetic fixture, role grants, recovery point, listener, proxy route and the temporary v0.0.7 replacement on the existing protected WordPress installation. The following commands are for that approved window.

**20i CLOUD — migration and listener.** On the approved, preflight-verified migration connection, provision the scoped roles and synthetic fixture, take the agreed recovery point, and rerun the read-only preflight. Apply the adapter schema from the rehearsal checkout:

```bash
MIOPAGES_WP_SCHEMA_ACTION=apply-private-stage \
  node --import tsx scripts/db/wordpress-private-stage.ts
```

Verify checksums and grants. Install only the rehearsal role credentials in their respective processes. In the isolated Core process load `MIOPAGES_WP_CORE_ORIGIN`, `MIOPAGES_WP_PULL_URL`, the CA as needed, and the installation credential. Use the approved private port and start the prebuilt application from its separate checkout:

```bash
MIOPAGES_WP_PRIVATE_STAGE=enabled \
  npm run start -- --hostname 127.0.0.1 --port "$REHEARSAL_PORT"
```

If the provider proxy cannot reach loopback, stop and review the binding rather than exposing the listener. Confirm a bodyless unauthenticated POST to each exact HTTPS path is rejected before sending credentials.

**20i CLOUD — protected operator session.** Use the separate operator-role URL, the approved Core origin and MIOPAGES_WP_PRIVATE_STAGE=enabled in the protected operator session. For each operation send a single `{token,operation,input}` object on stdin to `node --import tsx scripts/wordpress-private-operator.ts`. Supply the token interactively or through the approved secret channel, never in command arguments or a saved request file. Prepare, preview and approve the exact revision, then review the derived WordPress projection with a different operator. The input fields, in order, are:

| Operation | Input keys |
|---|---|
| `prepare` | `scope` (Web Presence and Managed Site IDs), `proposalId`, `requestId`, `page` |
| `preview` | returned `binding`, new `requestId` |
| `approve` | `binding`, new `requestId`, `previewDigest`, `previewEvent`, `reference` |
| `review` | `site` (Organization, Web Presence and Managed Site IDs), `proposalId`, `approvalId`. Repeat after inspection with `commit: {releaseId, projectionDigest}`. |
| `enroll` | `organizationId`, `webPresenceId`, `managedSiteId`, `installationId`, `origin`, `keyId`, `publicKeyBase64`, `credentialId` |
| `issue` | `installationId`, `releaseId`. Supply the signing key to this command only. |

**20i RESELLER — temporary upgrade and stage.** Preserve and verify the v0.0.6 rollback ZIP before replacing the plugin. Confirm the v0.0.7 ZIP SHA-256 is `6f25e75a4e5255cea51fc11240abb235e5950f23e23b1047ae1ddc0f2d88c5c6`. From the verified WordPress root:

```bash
wp_rehearsal plugin install "$REHEARSAL_ZIP" --force
wp_rehearsal plugin get miopages-delivery --field=version
```

Require 0.0.7 and verify the existing access challenge. Provision the approved private child and supply `MIOPAGES_PRIVATE_PULL` through a protected CLI-only configuration. Pin the approved Core origin, release and installation identity, real document root and private child. WordPress receives the installation secret and public verification key only. Run twice within envelope expiry:

```bash
wp_rehearsal miopages private-stage
# Pause for CLOUD to record the first staged_at and envelope_sha256.
wp_rehearsal miopages private-stage
sha256sum "$REHEARSAL_STAGE_DIR/objects/$EXPECTED_ENVELOPE_SHA256.json"
test ! -e "$REHEARSAL_STAGE_DIR/active.json" && test ! -L "$REHEARSAL_STAGE_DIR/active.json"
```

**20i CLOUD — reconcile and revoke.** Use a read-only query by installation and release ID to compare `miopages_wp.wordpress_deliveries.envelope_sha256` and `staged_at` with the private object digest and the first stage timestamp. Require one `staged` event and one `receipt-retry` event in `miopages_wp.wordpress_delivery_events`. Run protected `revoke` with the installation ID.

**20i RESELLER — refusal and restore.** Repeat the same stage command and require refusal. Confirm the prior object digest, absence of the active marker, unchanged public baseline and untouched synthetic storage. Remove the temporary pull configuration and restore the preserved plugin:

```bash
wp_rehearsal plugin install "$ROLLBACK_V006_ZIP" --force
wp_rehearsal plugin get miopages-delivery --field=version
```

Require 0.0.6 active and the original access challenge. **20i CLOUD:** remove the temporary route, stop only the rehearsal listener, clear rehearsal credentials and verify the port-8080 Core still serves the baseline. Retain the private object, audit and recovery evidence. Stop on any mismatch or uncertain commit outcome and verify exact state before retrying. After the first successful test, close the rehearsal and return to Commercial V1, prioritizing Media-to-Publication.
