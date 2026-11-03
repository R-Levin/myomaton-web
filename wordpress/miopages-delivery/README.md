# MioPages WordPress Delivery — first code proof

**State:** Initial experimental plugin files committed to the WordPress evaluation branch. **Not a functioning production renderer, not customer-ready and not approved for public installation/content publishing.** No signed transport, activation, rollback, governance/role mapping or editorial inbound changes exist yet.

## What it does now

The `miopages-delivery.php` plugin adds **Tools → MioPages Preview** to a WordPress administrator's interface. An authorized administrator can paste the repo's `docs/wordpress-c0-v3-public-projection-fixture.json` into a temporary form and render its text structure: **4 pages, 23 sections**, using only `hero`, `intro`, `relationship`, `collection` and `cta`. Input is bounded at 1 MiB and guarded by the WordPress administrator capability and nonce.

The proof requires the `miopages.wordpress.public-projection-fixture` schema, version 1, reviewed four routes/section count and `publishable:false`. It renders escaped text, restricted item lists and **nonclickable** proposed action labels. It deliberately does **not** import media or logos, write WP posts or options, call external services, expose a public route, register a CPT, publish a release, or modify MioPages canonical data. No generated output should be treated as approved public content.

**Caution:** The current guard checks structural eligibility for the preview tool, not the frozen source digest or a cryptographic signature. It is not a production release verifier, and it must not be repurposed as one. It does not assert visual fidelity to the approved C0 design.

## Local source check

From repository root, with PHP CLI available:

```sh
php -l wordpress/miopages-delivery/miopages-delivery.php
php -l wordpress/miopages-delivery/includes/class-miopages-fixture-preview.php
php -l wordpress/miopages-delivery/tests/preview-smoke.php
php wordpress/miopages-delivery/tests/preview-smoke.php
```

The smoke test covers the 4/23 inventory, nonpublishable preview gate, rejection of unapproved section types, nonclickable CTAs and escaped script text. **These are provided as runnable checks; execution results have not been established by the GitHub file commits alone.**

## Manual WordPress experiment (only on isolated protected dev install)

1. Independently verify that the `miopages.org` WordPress site is installed and **protected from public access** (HTTP authentication, allowlist or equivalent; `noindex` alone is not access protection).
2. Package only the `wordpress/miopages-delivery` directory as a plugin ZIP and install it into that isolated test instance; the checked-in fixture must **not** be copied into the public web root. Keep test/customer credentials outside source control.
3. In WP admin, visit **Tools → MioPages Preview**, paste the locally opened C0 v3 public projection JSON, and inspect the four read-only views. This is a low-fidelity structural preview, not the final block/theme rendering.
4. Record nonsecret results in Git. Stop if the package attempts any public content changes, side effects, or unexpected permissions.

## Next engineering boundaries

- Map constrained theme/section rendering and approved asset loading, with real fidelity checks.
- Implement provider-neutral authenticated outbound release contract and fail-closed staging/rollback; public rendering must never accept the nonpublishable fixture.
- Implement a separately authenticated and idempotent **inbound WordPress editorial proposal adapter** with review workflows and central authority in MioPages.
- Integrate optional **20i service adapter** strictly for provisioning and operations, beginning with read-only inventory.

Refer to `docs/wordpress-delivery-feasibility.md` and `docs/development-control.md` before extending scope.
