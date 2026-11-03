# MioPages → WordPress Release Contract v0.1 — bounded engineering proof

Status: **experimental draft implemented as an offline validator, not authorized for production publishing**. 2026-11-03. This is a **provider-neutral outbound delivery adapter** contract. Keep WordPress editorial proposals and the optional 20i infrastructure adapter separate.

## Authority and trust boundary

MioPages canonical knowledge and governed editorial artifacts remain central. Only the *authorized central release signing service* may sign a release after all required content and publication gates have passed. The WordPress plugin is not allowed to treat an ordinary draft, a C0 preview fixture, a WordPress login, or a successful cryptographic check alone as approval. The signer must be behind existing central approval policies; those controls are **not implemented or proven** by this work.

WordPress installations must be explicitly enrolled to a single organization, Web Presence and Managed Site. An installation receives a pinned **Ed25519 public verification key**, permitted tenant/site IDs and its own immutable installation ID through a future protected enrollment process; trust configuration must not come from the inbound release envelope. The **private signing key must never be stored in WordPress or Git**. Public keys are not secrets, but wrong-key replacement must require an authorized credential-rotation workflow.

## Envelope transport and signature

JSON envelope (UTF-8, size-limited):

```json
{
  "schema": "miopages.wordpress.release-envelope",
  "version": 1,
  "keyId": "release-key-1",
  "payloadBase64": "<strict base64 of exact UTF-8 JSON payload bytes>",
  "payloadSha256": "<lowercase hex SHA-256 of decoded payload bytes>",
  "signatureBase64": "<strict base64 detached Ed25519 signature>"
}
```

The Ed25519 signature covers the **exact decoded payload bytes prefixed by the ASCII domain separator** `MioPages-WP-Release-v1\n`. Decoding must verify strict base64 and SHA-256 in constant-time comparison before signature verification. The payload is parsed only *after* signature verification; no reserialization or ambiguously canonicalized JSON is used for signature input. Additional incompatible schema versions must refuse. The key ID must match the configured pin; never resolve a key from an untrusted URL in the envelope.

Expected signed payload (bounded v0.1 scope; not a complete site representation):

```json
{
  "schema": "miopages.wordpress.managed-release",
  "version": 1,
  "releaseId": "stable-id",
  "organizationId": "org-id",
  "webPresenceId": "presence-id",
  "managedSiteId": "site-id",
  "installationId": "installation-id",
  "sequence": 1,
  "previousReleaseId": null,
  "issuedAt": "2026-11-03T20:00:00Z",
  "expiresAt": "2026-11-04T20:00:00Z",
  "approval": {"state": "approved", "approvalId": "central-approval-id"},
  "pages": [
    {"id": "page-id", "path": "/", "title": "Test site", "sections": [
      {"id": "section-id", "type": "intro", "content": {"heading": "Synthetic proof only", "text": "Not public"}}
    ]}
  ],
  "assets": []
}
```

The receiver must reject payloads that are not expressly `miopages.wordpress.managed-release`; the existing `miopages.wordpress.public-projection-fixture` with `publishable:false` is **always rejected**. Test payloads are synthetic, never production claims.

## Validation ordering

1. Validate envelope shape/size, key ID and strict encoding. Hash decoded bytes and verify Ed25519 detached signature using pinned public key. Fail closed when libsodium is absent.
2. Parse signed JSON with depth limits; allow only the contract's bounded fields and shapes. Check signed target matches configured installation and tenant/site identity.
3. Require approval claim with a nonempty central approval ID. This is trustworthy **only when the signing service enforces central authorization**, not a substitute for that implementation.
4. Enforce UTC issued/expiry bounds, a small acceptable clock skew and max lifetime. Reconfirm expiration before activation.
5. Compare `sequence` and `previousReleaseId` with the **durably stored active release state**: exactly next sequence and exact previous release pointer. Refuse duplicates, stale/out-of-order releases, forks and foreign installations. The v0.1 library accepts this state as an explicit input; durable compare-and-swap is **not yet implemented**.
6. Validate bounded pages/sections, unique IDs/paths, permitted relative routes and allowlisted section types. No external scripts, arbitrary HTML, unresolved media or active forms; v0.1 permits no assets.
7. A validated payload is **eligible for a later staging operation, not an activated/published release**. Successful validation must not write WordPress posts/options or activate routes.

## Missing production capabilities / required gates

- Secure enrollment, credential/key rotation and revocation; central audit and operator authorities.
- Real approved release exporter using existing public canonical projection gates; source asset bytes, rights, media integrity and all section-type content schemas.
- Authenticated provider-neutral HTTPS notify/pull transport, rate limiting, request provenance and idempotent network retries.
- Durable **transactional** staging/activation, active marker compare-and-swap, last-known-good release, cached-media atomicity, recovery and rollback.
- Publication expiry semantics: envelope expiry is an *acceptance deadline*, not an instruction to remove an already activated last-good site.
- WordPress routing, SEO and forms; drift detection, host cache purges and protected generated page permissions.
- CI/PHP compatibility/security audit and deployment verification, second-host portability and C0/C1 isolation.

## Acceptance checks for this slice

Standalone PHP tests must show: valid synthetic signed payload accepted **for staging eligibility only**; altered signature/payload/hash rejected; wrong installation or cross-tenant target rejected; absent approval rejected; stale/duplicate/out-of-order sequence rejected; expired/too-long lifetime refused; public-projection fixture refused; unknown section/refused route rejected. No WordPress publication or live database changes occur.

## Source and review

`wordpress/miopages-delivery/includes/class-miopages-release-validator.php` implements the pure verifier; `wordpress/miopages-delivery/tests/release-contract-smoke.php` creates **ephemeral test-only keys in memory** and executes the offline tests. This validator is deliberately **not hooked into the live plugin admin, REST endpoint, scheduled job or post storage yet**. Use only after isolated tests and a subsequent reviewed staged-storage design.
