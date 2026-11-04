# Batch 1 — governed Core → WordPress release delivery

Status: **implementation boundary and acceptance contract**, not completed integration.
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

## Current status / next engineering action

The initial consolidated local PHP test runner is checked in at `scripts/test-wordpress-delivery.php`, **not yet executed**. The next implementation work is the central entitlement/issuer boundary and cross-runtime cryptographic contract tests, followed by authenticated pull and receipt reconciliation in one reviewed batch. Do not call this integration complete based on the successful synthetic manual stage.
