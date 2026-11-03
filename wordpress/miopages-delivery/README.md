# MioPages WordPress Delivery — first code proof

**State:** Experimental private preview plugin with initial visual renderer committed to the WordPress evaluation branch. **Not a functioning production renderer, not customer-ready and not approved for public installation/content publishing.** No signed transport, activation, rollback, governance/role mapping or editorial inbound changes exist yet.

## What it does now

The `miopages-delivery.php` plugin adds **Tools → MioPages Preview** to a WordPress administrator's interface. An authorized administrator can paste the repo's `docs/wordpress-c0-v3-public-projection-fixture.json` into a temporary form and render its section/page structure in a scoped visual shell: **4 pages, 23 sections**, using only `hero`, `intro`, `relationship`, `collection` and `cta`. Input is bounded at 1 MiB and guarded by the WordPress administrator capability and nonce.

The proof requires the `miopages.wordpress.public-projection-fixture` schema, version 1, reviewed four routes/section count and `publishable:false`. It renders escaped text, restricted item lists, structured responsibility comparisons, reviewed surface colors, basic responsive layouts and **nonclickable** proposed action labels. CSS is loaded only on the administrator-only preview screen. It deliberately does **not** import media or logos, write WP posts or options, call external services, expose a public route, register a CPT, publish a release, or modify MioPages canonical data. No generated output should be treated as approved public content.

**Caution:** The current guard checks structural eligibility for the preview tool, not the frozen source digest or a cryptographic signature. It is not a production release verifier, and it must not be repurposed as one. The 0.0.2 visual slice uses the reviewed C0 v3 palette and selected layout rules, but it does not assert visual fidelity to the approved C0 design: no verified logos/media, accurate graphic layers, font files or screenshot comparison.

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
3. In WP admin, visit **Tools → MioPages Preview**, paste the locally opened C0 v3 public projection JSON, and inspect the four read-only views. This is now a styled visual-development preview, **not** the final block/theme rendering. The plugin version is 0.0.2; existing 0.0.1 installations must be replaced using the portable ZIP procedure below.
4. Record nonsecret results in Git. Stop if the package attempts any public content changes, side effects, or unexpected permissions.

## Next engineering boundaries

- Map constrained theme/section rendering and approved asset loading, with real fidelity checks.
- Implement provider-neutral authenticated outbound release contract and fail-closed staging/rollback; public rendering must never accept the nonpublishable fixture.
- Implement a separately authenticated and idempotent **inbound WordPress editorial proposal adapter** with review workflows and central authority in MioPages.
- Integrate optional **20i service adapter** strictly for provisioning and operations, beginning with read-only inventory.

Refer to `docs/wordpress-delivery-feasibility.md` and `docs/development-control.md` before extending scope.

## Upgrade from private-preview v0.0.1 to visual-preview v0.0.2

From the Windows repository root, first fetch and fast-forward the active branch, then run the PHP syntax/smoke checks above. **Do not upload if they fail.** Build the plugin ZIP with correct directory separators:

```powershell
git switch docs/wordpress-delivery-feasibility-2026-11-02
git pull --ff-only
php -l .\wordpress\miopages-delivery\miopages-delivery.php
php -l .\wordpress\miopages-delivery\includes\class-miopages-fixture-preview.php
php -l .\wordpress\miopages-delivery\tests\preview-smoke.php
php .\wordpress\miopages-delivery\tests\preview-smoke.php
Remove-Item .\miopages-delivery.zip -Force -ErrorAction SilentlyContinue
tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery
tar -tf .\miopages-delivery.zip
```

On the **password-protected development WordPress instance only**, upload the replacement ZIP using the existing plugin update/replace flow and confirm version 0.0.2; if WordPress cannot safely replace it, back up and use a controlled manual directory replacement. Do not delete other plugins or disable directory protection. Visit **Tools → MioPages Preview**, paste the same nonpublishable fixture and verify that all 4 pages / 23 sections appear with purple/cream/peach/lavender styling. Check at a desktop and narrow viewport. The preview must remain entirely inside wp-admin, not as public pages.

**Known issues / unproven:** Font loads from installed system fallback unless Source Sans 3 is already present; brand labels are explicitly textual placeholders, not approved wordmark images. Nonclickable navigation/actions do not establish routing. Layered illustrations and real media are intentionally omitted. CSS is scoped to the admin preview and does not style public WP pages. No local PHP execution, screenshot-based parity comparison, WordPress update test or rendered visual review is proven solely by committing the code.

## v0.0.3 — read-only hosting/environment capability diagnostic

This update adds **Tools → MioPages Environment** for administrators, separate from the existing private visual preview. It reports the installed WordPress PHP runtime, Ed25519 verification availability, whether `flock`, `link` and `rename` functions exist, whether `open_basedir` restrictions are configured, and whether the parent of the WP installation appears outside the web document root. It deliberately **does not display absolute paths, configuration secrets or keys**, create directories, write marker files, access the 20i API, or touch existing WP content.

**Do not interpret a “Potential off-webroot parent detected” result as permission to store files there.** We must confirm actual hosting layout, filesystem access, private subdirectory permissions, HTTP non-exposure, backup treatment, and lock/hard-link/rename behavior before any protected staging. The diagnostic reports *function availability only*, not successful filesystem operations. No installation ID, signing key enrollment, site release transport or publication controls are configured.

Local checks after fetching the active branch:

```powershell
php -l .\wordpress\miopages-delivery\miopages-delivery.php
php -l .\wordpress\miopages-delivery\includes\class-miopages-environment-check.php
php -l .\wordpress\miopages-delivery\tests\environment-check-smoke.php
php .\wordpress\miopages-delivery\tests\environment-check-smoke.php
php .\wordpress\miopages-delivery\tests\preview-smoke.php
```

After those pass, create the portable ZIP with `tar -a -c -f miopages-delivery.zip -C wordpress miopages-delivery` (remove the previous ZIP first), replace the plugin **only on the existing password-protected `miopages.org` development WordPress installation**, and visit Tools → MioPages Environment. Report the descriptive check results, **not** paths or credentials. Ensure Tools → MioPages Preview still renders the nonpublishable C0 v3 fixture after upgrade.

**Important:** This plugin version is `0.0.3` and still does not load or invoke the offline release store/validator; those classes remain disconnected from WP activation/public serving.
