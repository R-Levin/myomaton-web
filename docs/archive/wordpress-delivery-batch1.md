# Batch 1 — governed Core → WordPress release delivery

Status: **local integration verified**. The subsequent protected operator and route composition is recorded in [the private-stage rehearsal handoff](wordpress-private-stage-rehearsal.md).
Development branch: `docs/wordpress-delivery-feasibility-2026-11-02`.
The existing v0.0.6 WordPress private staging proof remains installed; public publication is disabled.

## Repository findings (verified November 4, 2026)

- `lib/platform/content-editing/releases.ts` provides `SiteReleaseService.release()`, a durable per-site immutable release-history append, a scoped authority callback, exact approved proposal/revision/preview proof, idempotency by request ID, full-site fingerprint comparison and transaction-level locking.
- Crucially, `lib/platform/content-editing/release.ts:releaseEnvironment()` **refuses all non-disposable development databases**. This is not a production release signer or approval API. No extension of that privilege is authorized merely by making a WordPress adapter.
- `wordpress/miopages-delivery/includes/class-miopages-release-validator.php` and `class-miopages-release-store.php` verify Ed25519 v1 envelopes, strict targets, ordering and immutable private staging. Hosted 20i synthetic proof passed. The v0.0.6 plugin only permits manual **synthetic** staging; it does not activate, publish or expose remote ingest.
- The accepted service-led C0 v3 public-projection fixture is `publishable:false`, and cannot be recast as an approved release.
- `docs/wordpress-delivery-feasibility.md` specifies installation enrollment, signed HTTPS notification as a hint, authenticated pull, immutable staging, reconciliation and eventual controlled activation. This batch implements **through private staging only**; approval and public release stay central.

## Batch 1 implementation contract

One cohesive engineering batch, avoiding iterative plugin installs:

1. **Central entitlement and release eligibility.** Introduce a central `WordPressDeliveryEntitlement` tied to a verified organization/Web Presence/Managed Site and installation ID. Derive the authorization decision exclusively from trusted Core authority, durable release history and a reviewed public projection. Require explicit centrally permitted publishable surface, approved exact source/revision and release lineage. A request body, WordPress post status, synthetic fixture or `approval.state` alone cannot satisfy authorization. The existing disposable-only `SiteReleaseService` must remain restricted until a separately reviewed production authority service exists.
2. **Enrollment.** Operator-controlled, auditable installation registration pins the Ed25519 public verification key, key ID, site scope, allowed host, installation ID and revocation status. Key rotation must preserve old verification for already-staged objects while refusing unauthorized new issuances. No central DB credential or issuer private key in WordPress. Document initial manual enrollment as *synthetic only*, not production enrollment.
3. **Issuer and exact payload.** Central signer uses an isolated private Ed25519 key and signs `MioPages-WP-Release-v1\\n` plus exact payload JSON bytes, matching `docs/wordpress-release-contract-v0.1.md`. Enforce bounded schema, sequential per-installation release state, valid approved provenance and an acceptance expiry. Add cross-runtime Node → PHP verification and negative signature/target/replay tests. Never export arbitrary HTML, unapproved assets or private knowledge.
4. **Delivery and transport.** Preferred installation-initiated authenticated HTTPS pull; central notification is only a hint. Define authenticated requests, strict TLS, bounded response body, replay/idempotency, retry with jitter and a no-network simulated client test. No unauthenticated REST upload, inbound signer key, direct Supabase connection or 20i-specific transport dependency. Any poll fallback must be narrowly scoped and rate-limited.
5. **Private stage and acknowledgement.** WordPress accepts only a fully validated signed envelope for its pinned installation; stages immutably outside webroot with existing locks. Return a receipt containing release ID, digest and stage status; Core reconciles receipts with expected installation/release/digest. Never infer success solely from a notification or HTTP 200. **Do not activate, create posts or publish routes in Batch 1.**
6. **Audit and isolation.** Record enrollment, issuer decision, notification, authenticated pull, stage outcome, idempotent retry, key revocation and failure by tenant/installation, with redacted metadata. Prove foreign tenant/installation, invalid approval, stale sequence and duplicate deliveries are refused. Distinguish authorization policy errors from transient transport failures.

## Acceptance matrix (single batch gate)

- Core tests: authorized exact target and immutable approved release eligible; denied/revoked/cross-site/stale/unapproved/nonpublishable cases refuse without signing.
- Cryptographic compatibility: Node central signer generates an envelope that the **actual PHP v1 validator** accepts, with test-only ephemeral keys. Modification, wrong key, wrong installation and expiry fail.
- Transport tests: authenticated pull only, no secrets logged, bounded content, retries/idempotency, failure isolation, receipts reconciled to exact digest.
- WordPress tests: private staging only; no active marker, WordPress post/option changes or public rendering. Existing regression suite passes.
- Operational tests: package install once at the end, confirm staging/readiness on 20i, isolated nonpublic test, no production key disclosure.
- Cross-installation and 100+ tenant scale/load testing is a later dedicated acceptance gate, but every Batch 1 state transition must be installation-scoped.

## Efficient execution rules

- Develop and review all related code before upgrading WordPress. Use one consolidated command: `php scripts/test-wordpress-delivery.php`; include TypeScript tests via the repository's existing `npm test` conventions as implemented. Preserve explicit PASS/FAIL and record evidence in Git.
- Only request operator input when an external credential/authority decision or actual hosted acceptance is required. Avoid one-message-per-file upload workflows.
- Never remove or bypass the development-only restriction of `releaseEnvironment()` as an expedient shortcut. Until a production release-authority implementation is reviewed, keep the entire Core-to-WordPress flow synthetic/offline and publication disabled.

## Implemented and verified locally

- The server-only service in `lib/platform/wordpress-delivery/service.ts` authorizes enrollment, rotation, revocation and issuance through an injected site-scoped operator check. The PostgreSQL registry binds one immutable installation ID to an organization, Web Presence, Managed Site and HTTPS origin. It retains key generations and credential IDs, with separate audit rows for operator and authenticated transport activity. Only the credential resolver receives a credential ID. The database contains public verification pins and references to externally held credentials.
- `authority.ts` defaults to denying issuance and delivery. An internal authority implementation must supply a reviewed, explicitly publishable version 1 projection. The service independently checks the latest hash-chained Core release, its exact approval event and revision, its preview digest, the current canonical source fingerprint and the reviewed pages digest. Core's existing release guard still permits only disposable development databases. The integration test supplies authority only inside the disposable fixture.
- The Core handler accepts bodyless HTTPS POSTs to the fixed pull and receipt paths. The HMAC binds the Core origin, operation, enrolled WordPress origin, installation, credential generation by ID, release, timestamp, nonce and receipt. The stored nonce window is two minutes either side of the timestamp, with at most 60 live nonces per installation. Retry transient failures using a new nonce. The handler signs and returns bounded v1 release bytes only while the enrolled issuer, approved current source and exact projection still match.
- The WordPress client uses the safe HTTP API with TLS verification, no redirects and a bounded response. It checks the envelope digest and stages through the existing locked v1 store using a protected, off-webroot directory and pinned identity. It sends the stage receipt only after storage succeeds. Core records an authenticated receipt for the exact pulled release, installation, sequence 1 and envelope digest. An exact retry leaves the first stage timestamp intact. The receipt represents an installation's report of private staging.
- Batch 1 permits one release per installation while active sequence is zero. First receipt acceptance ends at envelope expiry. Exact receipts already reconciled can be retried while the credential remains current. Rotation retains earlier public pins and disables the older credential. Pending unreconciled deliveries require review before rotation or recovery. Revocation blocks new pulls and receipts. Neither the Core request handler nor the WordPress pull caller is registered in a live application.

## Schema and rollback boundary

`lib/platform/wordpress-delivery/0016_wordpress_delivery.sql` is an opt-in adapter schema exercised in a disposable PostgreSQL database. It is outside the hosted bootstrap journal because that journal and its ownership and recovery contracts are pinned to 16 migrations. The adapter schema requires the existing canonical and site-content tables in the intended search path. Production schema ownership, grants, migration sequencing, backup and recovery need review before enrollment. No hosted migration was applied.

Before any hosted schema rollout, code rollback can simply disable the adapter. After enrollment, preserve the registry, key history, exact envelopes and audit when disabling service. Do not drop the tables, rewind WordPress state or replay old credentials as a rollback procedure.

## Consolidated local acceptance

Set `WORDPRESS_TEST_PG_BIN` to the PostgreSQL 18 binary directory and run `npm run test:wordpress-delivery`. On Windows this passed using Node 24, PHP 8.3 with Sodium and a freshly created disposable PostgreSQL 18 cluster. The gate ran TypeScript checking, 337 repository tests, seven synthetic transport tests, seven PHP lints, eight PHP suites, Node-to-PHP signature compatibility and one durable Core/PHP integration suite. The PHP suites include corrupt-state recovery and a two-process stage/activation lock regression. Windows verified lock creation. The POSIX 0600 assertion requires the Linux CI gate. WordPress HTTP functions are stubbed in the integration test, which exercises real PHP signature verification and storage and sends captured authenticated headers to the real Core handler.

## Next milestone

Implement and review production operator identity, current publishable projection and release approval authority. Then review the adapter migration and grants, provision scoped credentials and mount the Core and WordPress entry points for an isolated HTTPS private-stage rehearsal. Require evidence from that rehearsal before considering activation or publication.
