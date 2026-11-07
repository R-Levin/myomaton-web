# Protected WordPress private-stage rehearsal

**Current status.** Private delivery acceptance is closed at `51d9041`. Retain
`miopages.org` as the production-like reference WordPress installation and
`wp-acceptance.miopages.com` as reusable test infrastructure, including its account,
DNS and valid SSL. Temporary listeners, deployed credential copies and rehearsal files
were removed. Retained audit and recovery artifacts have separate purposes. The idle
502 is test-host maintenance. Testing and public publication require distinct
authority. See the [closeout evidence](development-control.md#wordpress-private-delivery-acceptance-closed).

The following procedure records the bounded rehearsal. Reuse its evidence and
operating machinery for later authorized work. The public Core security deployment
and WordPress v0.0.6 rollback were separately verified in the continuity record.

20i documents that successful discovery starts the registered application. In this
rehearsal My20i displayed an `unknown` row and later an empty list while SSH still
found a live and saved PM2 application. The display cause remains unknown. Verify
the package account, PM2 manager and socket owner, exact app name, executable, cwd,
process identity and bound listener before any process action. Approved cleanup
withdraws discovery files, deletes only that app through the package-local manager,
verifies the live list is empty and saves the empty list. Verify both processes
and the listener are gone independently. Retain the earlier clean restart as an
unresolved observation. [20i registration documentation](https://docs.20i.com/managed-cloud-servers/using-the-nodejs-application-registration-tool).

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

### Preferred self-service package plan — approved implementation

The owner explicitly approved the bounded change set in `cba52f3`: only the temporary package/hostname on the existing server, zero additional charge, isolated listener, scoped test identities, temporary v0.0.7 and full rollback. Exact candidate approval remains separate after durable preparation and digest inspection. Stop on unexpected cost, limitation or failed security/integrity/rollback gates. This supersedes the pending-approval wording in the historical planning checkpoint.

The private artifact enables Next's skipTrailingSlashRedirect/skipProxyUrlNormalize flags only for the private build. Its fixed `.rehearsal/private-server.cjs` starts the same single loopback listener and denies non-allowlisted raw methods/targets before Next's unconditional normalization redirects; root `proxy.ts` remains a second guard. Normal Core build/start/routing remains unchanged. Existing endpoint ingress and authentication remain mandatory. `.github/workflows/wordpress-rehearsal-build.yml` builds Linux x64 on Node22.23.2 without hosted credentials, then runs `scripts/wordpress-rehearsal-artifact.mjs`. Its283-case smoke includes trailing slashes, repeated separators/backslashes, encoded/dot/query/internal/absolute paths, alternate methods and CONNECT. The runtime has no normal DATABASE_URL; exact delivery POSTs must reach the existing missing-authentication refusal and unrelated requests must return404/no-store without redirects. Failures capture tightly sanitized status/headers. Only success produces the checksummed runtime archive/source manifest. Artifacts expire after seven days; no CI deployment access is configured. Reuse independently verified matching Linux dependencies in the new package; do not compile Next.js on the shared server.

**Corrective execution gate passed:** source `b6fc873` passed [Linux build42146115923](https://github.com/R-Levin/myomaton-web/actions/runs/42146115923), zero production advisories, retained approved HTML/digest compatibility and the relocated packaged private-listener smoke without a normal Core database credential. Keep React DOM external for the standalone Node renderer (`serverExternalPackages`); exact approval/digest revalidation remains unchanged. The runtime archive and manifest were independently downloaded and verified:308 files/four portable locked dependency links; tar SHA-256 `232b6ec21654d61badbdc16cd19c10121443d1df60b9778fb5eab1e07acdee65`. Install matching dependencies with the lockfile in the new package before using those relative links. See development-control for retained local artifact paths and the separately prepared public security candidate. No hosted changes occurred in the corrective task; its explicit no-hosted-change/no-new-credentials boundary was honored. Resume this procedure at fixture-scoped principal bootstrap/durable preparation and exact owner approval, retaining the prior bounded infrastructure authorization and completed database/recovery evidence.

The owner completed read-only My20i inspection: the existing server is Node.js Optimised (1 CPU, 2 GB RAM, 50 GB SSD), with one package, runtime.miopages.com. Add Hosting permits another domain on this same server and shows no additional charge; subdomains have independent document roots. The original app was registered from its package public_html using `.env`, `ecosystem.config.js` and Node Application Manager discovery. A **separate temporary package on this server is feasible and preferred**. No new server or database service is required. This supersedes the earlier request for two path-specific proxy overrides on runtime.miopages.com; do not request those from Support unless the self-service approach actually fails a verified requirement.

The proposed temporary hostname is `wp-acceptance.miopages.com`, application name `miopages-wp-acceptance`, port `8081`, on server `vps-bef564.mvps.stackcp.net`. No package, hostname, DNS, certificate, application registration or process has been created. The owner must approve the actual change set before those operations. This infrastructure approval will not substitute for the later exact candidate approval.

1. **Prepare and test before provisioning.** Retain the accepted authenticated WordPress baseline, successful database rollout/recovery checkpoint, v0.0.6 rollback ZIP and reviewed v0.0.7 ZIP. Do not repeat database role creation or 0016/0017. Prepare the two already selected fixture-scoped test principals through the existing migration-role credential/grant mechanism, verify their distinct authentication and separation of duties, and report actual operator UUIDs/grant references before use. Prepare/preview the exact synthetic candidate, obtain the owner's digest-bound approval and perform Codex's independent technical projection review. No canonical content or hostname binding is written.

2. **Prepare a Linux production artifact away from the live server.** Use one deliberate build job in the existing GitHub repository with the reviewed commit, lockfile and Node 22; no hosted secrets or deployment access in CI. Build-time module evaluation needs DATABASE_URL to be present, so use only a nonsecret unusable loopback build placeholder. Dynamic request code must not query a hosted database during build. Include the matching source/build manifest and checksums, and install matching Linux dependencies in the new package. Do not copy the live package's build or a Windows-native artifact. Run the consolidated local checks before this one build. No unbounded Next.js build runs alongside the live process on the shared 2 GB server.

   One bounded code preparation is required: when the existing private-stage flag is enabled, the new Next.js deployment must return 404 for all paths/methods except the two exact delivery POST endpoints. The current `privateStageIngress` validates those endpoints but does not disable unrelated app routes. Implement/test that outer allowlist using the installed Next.js request-filter convention; keep the existing ingress/HMAC/role checks unchanged and leave normal deployments unaffected when the flag is absent. The private listener receives no normal Core DATABASE_URL, intake credentials, tenant environment binding, signer, operator token or migration login. A startup smoke test must prove the private API works without normal Core credentials and unrelated requests fail closed.

3. **Create only the temporary package.** My20i → existing Cloud server → Options → Add Package / Add Hosting → proposed hostname → the **same existing Node.js Optimised server**. Check the target/server and zero additional charge before submission; stop if a paid upgrade, profile change, primary-domain move or unrelated package change is requested. Discover the newly assigned package ID, account root and SSH details after creation rather than guessing paths. Authorize only the required existing public SSH key for this temporary account; never copy a private key. Leave runtime.miopages.com, its `.env`, ecosystem file, protected runtime.env, PM2 process and discovery state untouched.

4. **Configure only the new hostname's DNS and SSL.** Read-only DNS checks found 20i StackDNS authority for miopages.com; the proposed hostname and random labels currently resolve through a wildcard, and the proposed address does not match runtime.miopages.com's Cloud address. Resolution alone is not proof that the name is unallocated. First inspect exact DNS/package ownership and stop on a conflict. Add only the approved specific hostname record(s) to the new package's advertised Cloud target; do not edit apex/wildcard records, runtime.miopages.com or domain-test.miopages.com. Use an IPv6 record only if the new package supplies a verified IPv6 target. Manage DNS at the authoritative parent package/zone if the subdomain package has no DNS screen. Issue/verify a dedicated trusted HTTPS certificate for the new full hostname through the new package's SSL/TLS control. Do not reuse or replace the live runtime certificate or bypass certificate checks. No canonical hostname binding is added.

5. **Configure the new account and one bounded process.** Its own public_html contains the verified private build, `package.json`, `.env` discovery metadata (`PORT=8081`, `NODE_ENV=production`) and an ecosystem entry named `miopages-wp-acceptance`, whose cwd is this new package only. The private supervisor outside the webroot loads a mode-0600 configuration under a mode-0700 parent, then launches the verified `.rehearsal/private-server.cjs` artifact entry on127.0.0.1:8081. Retain the256MiB child heap,384MiB total RSS,512MiB available-memory floor and verified process cleanup; bounded smoke has a90-second maximum and automatic restart is disabled. Give the child only the existing restricted pull-role connection, verified CA, installation HMAC secret and `MIOPAGES_WP_CORE_ORIGIN=https://wp-acceptance.miopages.com`, with private-stage enabled. Transfer only this scoped configuration; never the two-role file, normal DATABASE_URL, operator/migration credentials or signer. Keep operator tokens and signer separate, and give WordPress no database or signer credential.

   Use one fork-mode worker, no watch and no automatic restarts for this bounded run. Start with a 256 MiB V8 heap ceiling; monitor actual RSS and server headroom because the heap limit is not a total-memory cap. Read-only inspection found approximately 1,009 MiB available and no swap, with port 8081 unused. A 384 MiB rehearsal-process RSS ceiling and 512 MiB minimum MemAvailable are stop thresholds for this test, not production capacity claims. Stop only the test app if exceeded; never adjust the public runtime, add swap, resize the server or automatically increase limits. Disk headroom was approximately 44,288 MiB. The second package shares the existing CPU/RAM/disk allocation.

6. **Register only the new package after all prerequisites pass.** New package → Node Application Manager / Discover Applications. Discovery is an actual deployment: it starts the app automatically. Verify the discovered name/cwd/port before proceeding; never use server-wide rediscovery or rediscover the live package. Require a valid public HTTPS chain, correct upstream Host and X-Forwarded-Proto, an externally inaccessible direct port 8081, no credential-header logging and no cached private responses. Test the two actual endpoints with well-formed but unenrolled identities and require authorization refusal (403), distinguishing it from ingress rejection (400) or unavailable service (503). Unrelated methods/paths must fail closed. If the managed proxy cannot reach loopback or preserves the wrong headers, stop without binding publicly or requesting changes to the live package. Only then investigate the precise new-package limitation with 20i.

7. **Execute the already reviewed acceptance sequence.** Preserve/hash-check the v0.0.6 ZIP in protected Reseller storage before replacement, use PHP8.4/WP-CLI, and temporarily deploy only the reviewed v0.0.7 package. Use the dedicated private child and CLI-only pull configuration, leaving old synthetic storage untouched. Verify clocks against the existing authentication window without changing system time. After all participants are ready, issue the approved signed release with the signer only in the operator command; pull over the new HTTPS origin, stage privately and reconcile exact object/receipt hashes and first timestamp. Retry with fresh authenticated request nonces, confirm the same immutable object and one staged/one receipt-retry event, revoke the installation and confirm refusal with unchanged private object and no active marker. No publication, canonical Page/Section write, C0 change or hostname binding is permitted.

8. **Rollback rehearsal resources; retain the reusable hosting account.** Restore and verify v0.0.6, remove the temporary CLI configuration/secrets and verify authenticated WordPress output against the retained digest. Revoke/expire the scoped test credentials/grants through their existing protected mechanism while retaining audit records; keep the approved persistent DB roles/schema and original recovery/credential artifacts. Preserve sanitized acceptance evidence before removing rehearsal-only resources. Unregister only `miopages-wp-acceptance`; verify/stop only its named process and confirm8081 is unused while8080 and both original hostname outputs remain unchanged. Remove only reviewed rehearsal runtime/configuration/credential files and approved disposable test resources after preserving required staged-object/audit evidence; do not delete canonical C0, fixture/approval audit or recovery records as general cleanup. **Retain wp-acceptance.miopages.com, its hosting account and DNS/SSL unchanged** for future testing. Do not Suspend/Disable/delete any hosting account or domain. No `pm2 kill`, global service stop or deletion of existing webroots is permitted.

Stop acceptance on any unexpected security, integrity, authorization, resource or rollback failure. Do not retry writes, widen binding or change the live package automatically. Once success and full rollback are evidenced, close this WordPress milestone and return to Commercial V1 Media-to-Publication.

Provider contract references: [same-server package creation](https://docs.20i.com/managed-cloud-servers/add-managed-cloud-server-package), [Node.js deployment and automatic start](https://docs.20i.com/managed-cloud-servers/install-nodejs-cloud-server), [registration/unregister controls](https://docs.20i.com/managed-cloud-servers/using-the-nodejs-application-registration-tool), [subdomain package DNS and disable caveat](https://docs.20i.com/domain-names/host-subdomains-different-platforms). Charges and current account controls above are owner-reported read-only findings, not a purchased service or a guarantee about a future checkout screen.

The remaining sections retain the existing protocol/acceptance commands. The preferred plan above governs account placement and the new Core origin: the listener belongs only in the new package; protected operator commands remain in the original separate rehearsal checkout. Historical database setup blocks are already completed prerequisites and must not be rerun.

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

**Earlier privileged-routing alternative, superseded.** Do not pursue path-specific overrides on runtime.miopages.com while the preferred separate-package plan is feasible. The prior contract was two exact delivery POST paths to loopback 8081 with fixed trusted Host/proto, no caching/credential-header logging and no effect on other routes. It remains an unexecuted fallback requiring a verified limitation and revised approval, not the current implementation plan.

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
