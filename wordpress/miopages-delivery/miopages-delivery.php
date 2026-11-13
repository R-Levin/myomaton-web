<?php
/**
 * Plugin Name: MioPages Delivery (Development Proof)
 * Description: Restricted, read-only C0 fixture preview for the MioPages WordPress delivery feasibility proof.
 * Version: 0.0.10
 * Requires PHP: 8.3
 * Text Domain: miopages-delivery
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/includes/class-miopages-fixture-preview.php';
require_once __DIR__ . '/includes/class-miopages-environment-check.php';
require_once __DIR__ . '/includes/class-miopages-filesystem-probe.php';
require_once __DIR__ . '/includes/class-miopages-release-validator.php';
require_once __DIR__ . '/includes/class-miopages-release-store.php';
require_once __DIR__ . '/includes/class-miopages-private-staging.php';

if (defined('WP_CLI') && WP_CLI && defined('MIOPAGES_NATIVE_DRAFT_IDENTITY') && is_array(MIOPAGES_NATIVE_DRAFT_IDENTITY)) {
    require_once __DIR__ . '/includes/class-miopages-native-draft-writer.php';
    require_once __DIR__ . '/includes/class-miopages-native-draft-receipt.php';
    WP_CLI::add_command('miopages native-draft', static function (): void {
        try {
            $pull = defined('MIOPAGES_PRIVATE_PULL') ? MIOPAGES_PRIVATE_PULL : null;
            $key = $pull['secretHex'] ?? null;
            if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/D', $key)
                || !is_string(MIOPAGES_NATIVE_DRAFT_IDENTITY['installationId'] ?? null)
                || ($pull['identity']['installationId'] ?? null) !== MIOPAGES_NATIVE_DRAFT_IDENTITY['installationId']) {
                throw new RuntimeException('Native draft receipt installation unavailable.');
            }
            $wire = stream_get_contents(STDIN, 1048577);
            if (!is_string($wire)) {
                throw new RuntimeException('Native draft input unavailable.');
            }
            $applied = MioPages_Native_Draft_Writer::apply($wire, MIOPAGES_NATIVE_DRAFT_IDENTITY);
            WP_CLI::line(wp_json_encode(MioPages_Native_Draft_Receipt::create($applied, hex2bin($key))));
        } catch (Throwable $error) {
            WP_CLI::error('Native draft operation refused or failed. Verify WordPress state before retry.');
        }
    });
}

if (defined('WP_CLI') && WP_CLI && defined('MIOPAGES_PRIVATE_PULL') && is_array(MIOPAGES_PRIVATE_PULL)) {
    require_once __DIR__ . '/includes/class-miopages-release-pull.php';
    WP_CLI::add_command('miopages private-stage', static function (): void {
        $config = MIOPAGES_PRIVATE_PULL;
        foreach (['coreOrigin', 'credentialId', 'secretHex', 'releaseId', 'directory', 'documentRoot'] as $name) {
            if (!is_string($config[$name] ?? null)) {
                WP_CLI::error('Invalid private-stage configuration.');
            }
        }
        if (!preg_match('/^[a-f0-9]{64}$/D', $config['secretHex']) || !is_array($config['identity'] ?? null)) {
            WP_CLI::error('Invalid private-stage configuration.');
        }
        $site = wp_parse_url(home_url());
        $origin = ($site['scheme'] ?? '') . '://' . ($site['host'] ?? '') . (isset($site['port']) ? ':' . $site['port'] : '');
        $result = MioPages_Release_Pull::stage($config['coreOrigin'], $origin, $config['credentialId'],
            hex2bin($config['secretHex']), $config['releaseId'], $config['identity'], $config['directory'],
            ABSPATH, $config['documentRoot']);
        if ($result instanceof WP_Error) {
            WP_CLI::error('Private staging or receipt failed. Verify state before retry.');
        }
        WP_CLI::success('Private release staged and reconciled: ' . $result['objectSha256']);
    });
}


add_action('admin_menu', static function (): void {
    add_management_page(
        'MioPages Development Preview',
        'MioPages Preview',
        'manage_options',
        'miopages-development-preview',
        'miopages_render_development_preview'
    );

    add_management_page(
        'MioPages Hosting Readiness',
        'MioPages Environment',
        'manage_options',
        'miopages-environment-check',
        'miopages_render_environment_check'
    );
});

// Only load development preview styling on its administrator-only Tools screen.
add_action('admin_enqueue_scripts', static function ($hook): void {
    if ($hook !== 'tools_page_miopages-development-preview'
        || !current_user_can('manage_options')) {
        return;
    }

    wp_enqueue_style(
        'miopages-private-preview',
        plugin_dir_url(__FILE__) . 'assets/preview.css',
        [],
        '0.0.2'
    );
});

/**
 * Private proof interface only. Never creates WP posts or releases.
 */
function miopages_render_development_preview(): void
{
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('You do not have permission to view this page.', 'miopages-delivery'));
    }

    echo '<div class="wrap"><h1>MioPages — development-only fixture preview</h1>';
    echo '<p>Paste the checked-in C0 v3 public-projection JSON fixture to inspect its text and section structure. ';
    echo 'This proof does not import, approve, publish, or retain content.</p>';

    $json = '';
    if (isset($_POST['miopages_preview_json'])) {
        check_admin_referer('miopages_development_preview');
        $raw = wp_unslash($_POST['miopages_preview_json']);
        if (!is_string($raw) || strlen($raw) > 1024 * 1024) {
            echo '<div class="notice notice-error"><p>Invalid or oversized JSON input.</p></div></div>';
            return;
        }
        $json = $raw;
    }

    echo '<form method="post">';
    wp_nonce_field('miopages_development_preview');
    echo '<label for="miopages_preview_json"><strong>Nonpublishable JSON fixture</strong></label>';
    echo '<textarea id="miopages_preview_json" name="miopages_preview_json" rows="7" class="large-text code" spellcheck="false">'
        . esc_textarea($json) . '</textarea>';
    submit_button('Render private preview');
    echo '</form>';

    if ($json !== '') {
        $result = MioPages_Fixture_Preview::parse($json);
        if (is_wp_error($result)) {
            echo '<div class="notice notice-error"><p>' . esc_html($result->get_error_message()) . '</p></div>';
        } else {
            echo '<hr/><h2>Private preview — not an approved release</h2>';
            echo MioPages_Fixture_Preview::render($result); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- controlled, escaped renderer
        }
    }

    echo '</div>';
}

/**
 * Read-only capability report; not a staging/enrollment setup screen.
 */
function miopages_render_environment_check(): void
{
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('Permission denied.', 'miopages-delivery'));
    }
    echo '<div class="wrap"><h1>MioPages — Hosting Environment Check</h1>';
    echo '<p>Administrator-only, read-only hosting readiness diagnostics. '
        . 'No release files, filesystem writes, WordPress pages, API calls or signing keys are created. '
        . 'Function availability does not establish filesystem atomicity or production readiness.</p>';
    echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>Check</th><th>Result</th></tr></thead><tbody>';
    foreach (MioPages_Environment_Check::report() as $label => $result) {
        echo '<tr><th scope="row">' . esc_html($label) . '</th><td>'
            . esc_html($result) . '</td></tr>';
    }
    echo '</tbody></table><p><strong>Do not share server paths or credentials.</strong> '
        . 'This screen intentionally does not display paths, secrets, enrollment IDs or private keys.</p></div>';
}

/**
 * The probe is opt-in, and no private directory is selected automatically.
 * The operator must configure MIOPAGES_PROBE_PRIVATE_DIR outside the document
 * root in server-local wp-config.php, and only then explicitly submit a nonce.
 */
add_action('admin_menu', static function (): void {
    add_management_page(
        'MioPages Private Filesystem Proof',
        'MioPages Filesystem Probe',
        'manage_options',
        'miopages-filesystem-probe',
        'miopages_render_filesystem_probe'
    );
});

function miopages_render_filesystem_probe(): void
{
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('Permission denied.', 'miopages-delivery'));
    }
    echo '<div class="wrap"><h1>MioPages — Private Filesystem Probe (development only)</h1>';
    echo '<p>This one-shot synthetic test creates a random child directory only within an '
        . 'already configured private directory. It does not stage real releases, publish WordPress '
        . 'pages, or transmit filesystem paths. Do not run on an unprotected public installation.</p>';

    if (!defined('MIOPAGES_PROBE_PRIVATE_DIR') || !is_string(MIOPAGES_PROBE_PRIVATE_DIR)
        || MIOPAGES_PROBE_PRIVATE_DIR === '') {
        echo '<p><strong>Disabled:</strong> no private path has been explicitly configured. '
            . 'The existing outside-webroot directory must be manually verified before enabling.</p></div>';
        return;
    }

    $docRoot = isset($_SERVER['DOCUMENT_ROOT']) && is_string($_SERVER['DOCUMENT_ROOT'])
        ? $_SERVER['DOCUMENT_ROOT'] : '';
    if (!MioPages_Filesystem_Probe::safeDirectory(
        MIOPAGES_PROBE_PRIVATE_DIR, ABSPATH, $docRoot
    )) {
        echo '<p><strong>Refused:</strong> the configured directory is missing or fails '
            . 'private-path safety checks. No writes attempted.</p></div>';
        return;
    }

    if (isset($_POST['miopages_run_filesystem_probe'])) {
        check_admin_referer('miopages_run_filesystem_probe');
        if ($_POST['miopages_run_filesystem_probe'] !== 'run') {
            wp_die(esc_html__('Invalid action.', 'miopages-delivery'));
        }
        $results = MioPages_Filesystem_Probe::run(
            MIOPAGES_PROBE_PRIVATE_DIR, ABSPATH, $docRoot
        );
        echo '<h2>One-shot results</h2><table class="widefat striped" style="max-width:900px"><tbody>';
        foreach ($results as $label => $value) {
            echo '<tr><th scope="row">' . esc_html($label) . '</th><td>' . esc_html($value) . '</td></tr>';
        }
        echo '</tbody></table>';
    }

    echo '<p>The configured directory passes preliminary structural checks. '
        . 'This does not verify permissions, HTTP isolation or filesystem crash durability.</p>';
    echo '<form method="post">';
    wp_nonce_field('miopages_run_filesystem_probe');
    echo '<input type="hidden" name="miopages_run_filesystem_probe" value="run">';
    submit_button('Run one-shot synthetic filesystem probe', 'secondary');
    echo '</form></div>';
}

/**
 * Synthetic-only private release staging; never exposed as a public or REST route.
 * Deliberately no stage-to-activate controls, Cron hooks, imports, or WP writes.
 */
add_action('admin_menu', static function (): void {
    add_management_page(
        'MioPages Synthetic Staging',
        'MioPages Private Staging',
        'manage_options',
        'miopages-private-staging',
        'miopages_render_private_staging'
    );
});

function miopages_render_private_staging(): void
{
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('Permission denied.', 'miopages-delivery'));
    }

    echo '<div class="wrap"><h1>MioPages — Synthetic Private Staging</h1>';
    echo '<p>Development-only, administrator-triggered storage for synthetic signed releases. '
        . 'No central release signer or production enrollment is installed. '
        . 'This screen does not activate releases, create WordPress posts, or publish web pages.</p>';

    if (!defined('MIOPAGES_SYNTHETIC_STAGE_CONFIG')) {
        echo '<p><strong>Disabled:</strong> separately enrolled synthetic test identity and '
            . 'private staging directory have not been configured.</p></div>';
        return;
    }

    $docRoot = isset($_SERVER['DOCUMENT_ROOT']) && is_string($_SERVER['DOCUMENT_ROOT'])
        ? $_SERVER['DOCUMENT_ROOT'] : '';
    $configuration = MIOPAGES_SYNTHETIC_STAGE_CONFIG;
    $valid = MioPages_Private_Staging::checkedConfig($configuration, ABSPATH, $docRoot);
    if (is_wp_error($valid)) {
        echo '<p><strong>Refused:</strong> synthetic enrollment or staging directory is invalid. '
            . 'No writes performed.</p></div>';
        return;
    }

    $status = MioPages_Private_Staging::status($configuration, ABSPATH, $docRoot);
    if (is_wp_error($status)) {
        echo '<p><strong>Refused:</strong> private release store failed integrity checks. '
            . 'Do not repeat writes until investigated.</p></div>';
        return;
    }

    echo '<p><strong>Enabled for synthetic test releases only.</strong> '
        . 'Public publication: disabled. Active sequence: '
        . esc_html((string) $status['activeSequence']) . '.</p>';

    if (isset($_POST['miopages_synthetic_release'])) {
        check_admin_referer('miopages_stage_synthetic_release');
        $input = wp_unslash($_POST['miopages_synthetic_release']);
        if (!is_string($input) || strlen($input) > 1048576) {
            echo '<div class="notice notice-error"><p>Invalid or oversized release envelope.</p></div>';
        } else {
            $result = MioPages_Private_Staging::stage($input, $configuration, ABSPATH, $docRoot);
            if (is_wp_error($result)) {
                echo '<div class="notice notice-error"><p>Release refused: '
                    . esc_html($result->get_error_message()) . '</p></div>';
            } else {
                echo '<div class="notice notice-success"><p>Synthetic release staged privately; '
                    . 'not activated or published. Digest: '
                    . esc_html($result['objectSha256']) . '</p></div>';
            }
        }
    }

    echo '<form method="post">';
    wp_nonce_field('miopages_stage_synthetic_release');
    echo '<label for="miopages_synthetic_release"><strong>Signed synthetic envelope JSON</strong></label>';
    echo '<textarea id="miopages_synthetic_release" name="miopages_synthetic_release" '
        . 'rows="7" class="large-text code" spellcheck="false"></textarea>';
    submit_button('Validate and stage synthetic release (no publication)', 'secondary');
    echo '</form></div>';
}
