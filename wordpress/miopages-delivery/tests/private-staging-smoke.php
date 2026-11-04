<?php
/**
 * Synthetic-only WordPress staging facade test. No WordPress or host dependencies.
 * php wordpress/miopages-delivery/tests/private-staging-smoke.php
 */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');

class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}
require dirname(__DIR__) . '/includes/class-miopages-filesystem-probe.php';
require dirname(__DIR__) . '/includes/class-miopages-release-validator.php';
require dirname(__DIR__) . '/includes/class-miopages-release-store.php';
require dirname(__DIR__) . '/includes/class-miopages-private-staging.php';

function ensurePrivateStage(bool $ok, string $label): void
{
    if (!$ok) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
}
if (!function_exists('sodium_crypto_sign_keypair')) {
    fwrite(STDERR, "SKIP: sodium unavailable; synthetic staging untested.\n");
    exit(2);
}
$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mp-private-stage-' . bin2hex(random_bytes(8));
$public = $root . DIRECTORY_SEPARATOR . 'public_html';
$private = $root . DIRECTORY_SEPARATOR . 'signed-stage';
ensurePrivateStage(mkdir($root, 0700), 'test account root');
ensurePrivateStage(mkdir($public, 0700), 'test webroot');
ensurePrivateStage(mkdir($private, 0700), 'test private staging root');

register_shutdown_function(static function () use ($root, $public, $private): void {
    $objects = $private . DIRECTORY_SEPARATOR . 'objects';
    if (is_dir($objects)) {
        foreach (glob($objects . DIRECTORY_SEPARATOR . '*.json') ?: [] as $file) {
            if (!is_link($file) && is_file($file)) {
                unlink($file);
            }
        }
        rmdir($objects);
    }
    foreach (['.release.lock', 'active.json'] as $name) {
        $file = $private . DIRECTORY_SEPARATOR . $name;
        if (!is_link($file) && is_file($file)) {
            unlink($file);
        }
    }
    @rmdir($private);
    @rmdir($public);
    @rmdir($root);
});

$keypair = sodium_crypto_sign_keypair();
$secret = sodium_crypto_sign_secretkey($keypair);
$identity = [
    'keyId' => 'synthetic-test-key',
    'publicKeyBase64' => base64_encode(sodium_crypto_sign_publickey($keypair)),
    'organizationId' => 'synthetic-org',
    'webPresenceId' => 'synthetic-presence',
    'managedSiteId' => 'synthetic-site',
    'installationId' => 'synthetic-installation',
];
$config = ['directory' => $private, 'identity' => $identity];
$empty = MioPages_Private_Staging::status($config, $public, $public);
ensurePrivateStage(is_array($empty) && $empty['activeSequence'] === 0
    && $empty['publicationEnabled'] === false, 'read-only status shows no active publication');

$payload = [
    'schema' => 'miopages.wordpress.managed-release', 'version' => 1,
    'releaseId' => 'synthetic-r1', 'organizationId' => 'synthetic-org',
    'webPresenceId' => 'synthetic-presence', 'managedSiteId' => 'synthetic-site',
    'installationId' => 'synthetic-installation',
    'sequence' => 1, 'previousReleaseId' => null,
    'issuedAt' => gmdate('Y-m-d\TH:i:s\Z', time() - 60),
    'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 3600),
    'approval' => ['state' => 'approved', 'approvalId' => 'synthetic-approval'],
    'pages' => [['id' => 'synthetic-page', 'path' => '/', 'title' => 'Synthetic',
        'sections' => [['id' => 'synthetic-intro', 'type' => 'intro',
            'content' => ['heading' => 'Synthetic heading', 'text' => 'Never publish']]]]],
    'assets' => []
];
function syntheticSigned(array $payload, string $secret): string
{
    $bytes = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    return json_encode([
        'schema' => 'miopages.wordpress.release-envelope',
        'version' => 1,
        'keyId' => 'synthetic-test-key',
        'payloadBase64' => base64_encode($bytes),
        'payloadSha256' => hash('sha256', $bytes),
        'signatureBase64' => base64_encode(
            sodium_crypto_sign_detached("MioPages-WP-Release-v1\n" . $bytes, $secret))
    ], JSON_THROW_ON_ERROR);
}
$envelope = syntheticSigned($payload, $secret);
$valid = MioPages_Private_Staging::stage($envelope, $config, $public, $public);
ensurePrivateStage(is_array($valid) && $valid['state'] === 'staged',
    'valid synthetic envelope stored privately');
ensurePrivateStage(is_file($private . '/objects/' . $valid['objectSha256'] . '.json'),
    'only immutable private object created');
ensurePrivateStage(!file_exists($private . '/active.json'), 'no active marker created');

$second = MioPages_Private_Staging::stage($envelope, $config, $public, $public);
ensurePrivateStage(is_array($second) && $second['objectSha256'] === $valid['objectSha256'],
    'idempotent retry uses same object');

$foreign = $payload;
$foreign['installationId'] = 'synthetic-foreign';
ensurePrivateStage(MioPages_Private_Staging::stage(
    syntheticSigned($foreign, $secret), $config, $public, $public
) instanceof WP_Error, 'foreign installation refused');

$nonSynthetic = $payload;
$nonSynthetic['releaseId'] = 'production-release';
ensurePrivateStage(MioPages_Private_Staging::stage(
    syntheticSigned($nonSynthetic, $secret), $config, $public, $public
) instanceof WP_Error, 'non-synthetic release refused');

$notApproved = $payload;
$notApproved['approval']['state'] = 'draft';
ensurePrivateStage(MioPages_Private_Staging::stage(
    syntheticSigned($notApproved, $secret), $config, $public, $public
) instanceof WP_Error, 'draft content refused');

$bad = json_decode($envelope, true);
$bad['payloadSha256'] = str_repeat('0', 64);
ensurePrivateStage(MioPages_Private_Staging::stage(
    json_encode($bad, JSON_THROW_ON_ERROR), $config, $public, $public
) instanceof WP_Error, 'bad content hash refused');

$badConfig = $config;
$badConfig['directory'] = $public;
ensurePrivateStage(MioPages_Private_Staging::stage(
    $envelope, $badConfig, $public, $public
) instanceof WP_Error, 'public webroot refused');

$badConfig = $config;
$badConfig['identity']['organizationId'] = 'real-org';
ensurePrivateStage(MioPages_Private_Staging::stage(
    $envelope, $badConfig, $public, $public
) instanceof WP_Error, 'real identity enrollment refused');

$after = MioPages_Private_Staging::status($config, $public, $public);
ensurePrivateStage(is_array($after) && $after['activeSequence'] === 0
    && $after['publicationEnabled'] === false, 'all cases leave activation unchanged');
ensurePrivateStage(count(glob($private . '/objects/*.json') ?: []) === 1,
    'rejected inputs do not add objects');

echo "PASS: private synthetic WordPress staging (signed acceptance, tenant refusal, no activation, no publication).\n";
