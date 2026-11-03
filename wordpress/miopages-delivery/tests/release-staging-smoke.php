<?php
/**
 * Local/offline release staging proof with no WordPress or hosted connections.
 * php wordpress/miopages-delivery/tests/release-staging-smoke.php
 */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');

class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}

require dirname(__DIR__) . '/includes/class-miopages-release-validator.php';
require dirname(__DIR__) . '/includes/class-miopages-release-store.php';

function checkStage(bool $ok, string $label): void
{
    if (!$ok) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
}

if (!function_exists('sodium_crypto_sign_keypair')) {
    fwrite(STDERR, "SKIP: sodium unavailable. No staging tests executed.\n");
    exit(2);
}

$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mp-release-' . bin2hex(random_bytes(8));
checkStage(mkdir($root, 0700), 'create isolated temporary store');
register_shutdown_function(static function () use ($root): void {
    // Only remove test-owned files, and only within uniquely generated temporary root.
    $objects = $root . DIRECTORY_SEPARATOR . 'objects';
    if (is_dir($objects)) {
        foreach (glob($objects . DIRECTORY_SEPARATOR . '*.json') ?: [] as $file) {
            if (is_file($file) && !is_link($file)) {
                unlink($file);
            }
        }
        rmdir($objects);
    }
    foreach (['active.json', '.release.lock'] as $file) {
        $path = $root . DIRECTORY_SEPARATOR . $file;
        if (is_file($path) && !is_link($path)) {
            unlink($path);
        }
    }
    if (is_dir($root)) {
        rmdir($root);
    }
});

$keypair = sodium_crypto_sign_keypair();
$secret = sodium_crypto_sign_secretkey($keypair);
$identity = [
    'keyId' => 'test-key-1',
    'publicKeyBase64' => base64_encode(sodium_crypto_sign_publickey($keypair)),
    'organizationId' => 'synthetic-org',
    'webPresenceId' => 'synthetic-presence',
    'managedSiteId' => 'synthetic-site',
    'installationId' => 'synthetic-install',
];
$now = time();
$base = [
    'schema' => 'miopages.wordpress.managed-release',
    'version' => 1,
    'releaseId' => 'synthetic-r1',
    'organizationId' => 'synthetic-org',
    'webPresenceId' => 'synthetic-presence',
    'managedSiteId' => 'synthetic-site',
    'installationId' => 'synthetic-install',
    'sequence' => 1,
    'previousReleaseId' => null,
    'issuedAt' => gmdate('Y-m-d\TH:i:s\Z', $now - 60),
    'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $now + 3600),
    'approval' => ['state' => 'approved', 'approvalId' => 'synthetic-central-approval'],
    'pages' => [
        ['id' => 'page-1', 'path' => '/', 'title' => 'Synthetic',
         'sections' => [
             ['id' => 'section-1', 'type' => 'intro',
              'content' => ['heading' => 'Content A', 'text' => 'Only synthetic copy']]
         ]]
    ],
    'assets' => [],
];

function makeEnvelope(array $payload, string $secret): string
{
    $bytes = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    return json_encode([
        'schema' => 'miopages.wordpress.release-envelope',
        'version' => 1,
        'keyId' => 'test-key-1',
        'payloadBase64' => base64_encode($bytes),
        'payloadSha256' => hash('sha256', $bytes),
        'signatureBase64' => base64_encode(
            sodium_crypto_sign_detached("MioPages-WP-Release-v1\n" . $bytes, $secret)
        )
    ], JSON_THROW_ON_ERROR);
}

$store = new MioPages_Release_Store($root, $identity);
$empty = $store->status();
checkStage(is_array($empty) && $empty['sequence'] === 0, 'starts with no active release');
$r1 = makeEnvelope($base, $secret);
$s1 = $store->stage($r1, $now);
checkStage(is_array($s1) && $s1['state'] === 'staged', 'signed release 1 staged');
checkStage(is_array($store->status()) && $store->status()['sequence'] === 0,
    'staging does not activate');
$repeat = $store->stage($r1, $now);
checkStage(is_array($repeat) && $repeat['objectSha256'] === $s1['objectSha256'],
    'identical stage retry idempotent');

$foreign = $base;
$foreign['installationId'] = 'other-install';
checkStage($store->stage(makeEnvelope($foreign, $secret), $now) instanceof WP_Error,
    'foreign installation staging refused');

$active1 = $store->activate($s1['objectSha256'], $now);
checkStage(is_array($active1) && $active1['active']['sequence'] === 1,
    'release 1 pointer activated offline');
checkStage($store->stage($r1, $now) instanceof WP_Error, 'already active release replay refused');
checkStage($store->activate($s1['objectSha256'], $now) instanceof WP_Error,
    'duplicate activation refused');

$r2Payload = $base;
$r2Payload['releaseId'] = 'synthetic-r2';
$r2Payload['sequence'] = 2;
$r2Payload['previousReleaseId'] = 'synthetic-r1';
$r2Payload['pages'][0]['sections'][0]['content']['heading'] = 'Content B';
$r2 = makeEnvelope($r2Payload, $secret);
$s2 = $store->stage($r2, $now);
checkStage(is_array($s2), 'release 2 staged');

$object2 = $root . DIRECTORY_SEPARATOR . 'objects' . DIRECTORY_SEPARATOR . $s2['objectSha256'] . '.json';
file_put_contents($object2, 'malicious replacement');
checkStage($store->activate($s2['objectSha256'], $now) instanceof WP_Error,
    'corrupt staged bytes refused');
checkStage($store->stage($r2, $now) instanceof WP_Error, 'immutable conflict refused');
checkStage(is_array($store->status()) && $store->status()['sequence'] === 1,
    'failed activation leaves pointer unchanged');

// Test independently staged release after tampering, with fresh identity and sequence.
$r2Payload['releaseId'] = 'synthetic-r2-repaired';
$r2 = makeEnvelope($r2Payload, $secret);
$s2 = $store->stage($r2, $now);
checkStage(is_array($s2), 'distinct release 2 staged');
$active2 = $store->activate($s2['objectSha256'], $now);
checkStage(is_array($active2) && $active2['active']['sequence'] === 2, 'release 2 activated');
checkStage($store->activate($s1['objectSha256'], $now) instanceof WP_Error,
    'unauthorized pointer rewind refused');

$r3Payload = $base;
$r3Payload['releaseId'] = 'synthetic-r3-restore-A';
$r3Payload['sequence'] = 3;
$r3Payload['previousReleaseId'] = 'synthetic-r2-repaired';
$r3Payload['pages'][0]['sections'][0]['content']['heading'] = 'Content A';
$s3 = $store->stage(makeEnvelope($r3Payload, $secret), $now);
checkStage(is_array($s3), 'new signed restoration release staged');
$active3 = $store->activate($s3['objectSha256'], $now);
checkStage(is_array($active3) && $active3['active']['sequence'] === 3,
    'signed restoration forward sequence accepted');
checkStage($active3['active']['releaseId'] === 'synthetic-r3-restore-A',
    'restoration is new release, not pointer rewind');
checkStage(is_file($root . '/objects/' . $s1['objectSha256'] . '.json'),
    'original immutable object remains');
checkStage(is_file($root . '/objects/' . $s3['objectSha256'] . '.json'),
    'restoration object retained');

// Interrupted/uncertain activation: inspect persisted state before any retry.
// Fault injection and restoration are confined to this test's private temporary root.
$markerPath = $root . DIRECTORY_SEPARATOR . 'active.json';
$originalMarker = file_get_contents($markerPath);
checkStage(is_string($originalMarker), 'active marker available for fault injection');
file_put_contents($markerPath, '{incomplete-write');
checkStage($store->status() instanceof WP_Error, 'corrupt active marker refused');
checkStage($store->stage(makeEnvelope($r3Payload, $secret), $now) instanceof WP_Error,
    'corrupt active marker blocks staging');
checkStage($store->activate($s3['objectSha256'], $now) instanceof WP_Error,
    'corrupt active marker blocks activation');
checkStage(file_get_contents($markerPath) === '{incomplete-write',
    'store does not silently reset a corrupted marker');
file_put_contents($markerPath, $originalMarker);
checkStage(is_array($store->status()) && $store->status()['sequence'] === 3,
    'test-only restoration permits read-only reconciliation');

// Missing active object must not be treated as an empty installation.
$activePath = $root . DIRECTORY_SEPARATOR . 'objects' . DIRECTORY_SEPARATOR
    . $s3['objectSha256'] . '.json';
$originalObject = file_get_contents($activePath);
checkStage(is_string($originalObject), 'active immutable object exists');
unlink($activePath);
checkStage($store->status() instanceof WP_Error, 'missing active object refused');
checkStage($store->stage(makeEnvelope($r3Payload, $secret), $now) instanceof WP_Error,
    'missing active object blocks staging');
file_put_contents($activePath, $originalObject);
checkStage(is_array($store->status()) && $store->status()['sequence'] === 3,
    'test-only object restoration returns consistent state');

echo "PASS: offline immutable staging proof (signed stage, retry, tamper refusal, activation order, forward restoration, corrupt-state refusal).\n";
