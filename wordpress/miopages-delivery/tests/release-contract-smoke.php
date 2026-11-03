<?php
/**
 * Offline signed release acceptance/rejection smoke test.
 * php wordpress/miopages-delivery/tests/release-contract-smoke.php
 * Test keys are ephemeral and NEVER used for installed WordPress.
 */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');

class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}

require dirname(__DIR__) . '/includes/class-miopages-release-validator.php';

function ensure(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
}

if (!function_exists('sodium_crypto_sign_keypair')) {
    fwrite(STDERR, "SKIP: libsodium is unavailable; do not deploy without it.\n");
    exit(2);
}
$pair = sodium_crypto_sign_keypair();
$secret = sodium_crypto_sign_secretkey($pair);
$public = sodium_crypto_sign_publickey($pair);
$identity = [
    'keyId' => 'test-key-1',
    'publicKeyBase64' => base64_encode($public),
    'organizationId' => 'test-org',
    'webPresenceId' => 'test-presence',
    'managedSiteId' => 'test-site',
    'installationId' => 'test-install',
];
$active = ['releaseId' => null, 'sequence' => 0];
$now = time();
$payload = [
    'schema' => 'miopages.wordpress.managed-release',
    'version' => 1,
    'releaseId' => 'test-release-1',
    'organizationId' => 'test-org',
    'webPresenceId' => 'test-presence',
    'managedSiteId' => 'test-site',
    'installationId' => 'test-install',
    'sequence' => 1,
    'previousReleaseId' => null,
    'issuedAt' => gmdate('Y-m-d\TH:i:s\Z', $now - 60),
    'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $now + 3600),
    'approval' => ['state' => 'approved', 'approvalId' => 'test-approval'],
    'pages' => [
        ['id' => 'test-page', 'path' => '/', 'title' => 'Test', 'sections' => [
            ['id' => 'test-section', 'type' => 'intro',
             'content' => ['heading' => 'Synthetic proof', 'text' => 'Not public']]
        ]]
    ],
    'assets' => [],
];

function signed(array $data, string $secret): string
{
    $bytes = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $envelope = [
        'schema' => 'miopages.wordpress.release-envelope',
        'version' => 1,
        'keyId' => 'test-key-1',
        'payloadBase64' => base64_encode($bytes),
        'payloadSha256' => hash('sha256', $bytes),
        'signatureBase64' => base64_encode(sodium_crypto_sign_detached("MioPages-WP-Release-v1\n" . $bytes, $secret)),
    ];
    return json_encode($envelope, JSON_THROW_ON_ERROR);
}

function refused(string $json, array $identity, array $active, int $now, string $label): void
{
    ensure(MioPages_Release_Validator::validate($json, $identity, $active, $now) instanceof WP_Error, $label);
}

$valid = signed($payload, $secret);
ensure(is_array(MioPages_Release_Validator::validate($valid, $identity, $active, $now)),
    'valid signed synthetic content eligible for later staging only');

$changedEnvelope = json_decode($valid, true, 64, JSON_THROW_ON_ERROR);
$changedEnvelope['payloadSha256'] = str_repeat('0', 64);
refused(json_encode($changedEnvelope), $identity, $active, $now, 'bad hash refused');

$changedEnvelope = json_decode($valid, true, 64, JSON_THROW_ON_ERROR);
$changedEnvelope['signatureBase64'] = base64_encode(str_repeat('a', SODIUM_CRYPTO_SIGN_BYTES));
refused(json_encode($changedEnvelope), $identity, $active, $now, 'bad signature refused');

$changedEnvelope = json_decode($valid, true, 64, JSON_THROW_ON_ERROR);
$changedEnvelope['payloadBase64'] = base64_encode('tampered payload');
refused(json_encode($changedEnvelope), $identity, $active, $now, 'tampered payload refused');

$other = $identity;
$other['installationId'] = 'other-install';
refused($valid, $other, $active, $now, 'foreign installation refused');
$other = $identity;
$other['organizationId'] = 'other-org';
refused($valid, $other, $active, $now, 'cross tenant refused');
$other = $identity;
$other['keyId'] = 'other-key';
refused($valid, $other, $active, $now, 'key ID mismatch refused');

$change = $payload;
$change['approval']['state'] = 'draft';
refused(signed($change, $secret), $identity, $active, $now, 'unapproved release refused');

$change = $payload;
$change['sequence'] = 2;
refused(signed($change, $secret), $identity, $active, $now, 'out-of-order release refused');
refused($valid, $identity, ['releaseId' => 'test-release-1', 'sequence' => 1], $now,
    'duplicate replay refused');

$change = $payload;
$change['expiresAt'] = gmdate('Y-m-d\TH:i:s\Z', $now - 1);
refused(signed($change, $secret), $identity, $active, $now, 'expired release refused');
$change = $payload;
$change['expiresAt'] = gmdate('Y-m-d\TH:i:s\Z', $now + 90000);
refused(signed($change, $secret), $identity, $active, $now, 'overlong release refused');

$change = $payload;
$change['schema'] = 'miopages.wordpress.public-projection-fixture';
$change['publishable'] = false;
refused(signed($change, $secret), $identity, $active, $now, 'preview fixture schema refused');

$change = $payload;
$change['pages'][0]['sections'][0]['type'] = 'html';
refused(signed($change, $secret), $identity, $active, $now, 'unsupported section refused');
$change = $payload;
$change['pages'][0]['path'] = 'https://external.invalid';
refused(signed($change, $secret), $identity, $active, $now, 'external route refused');
$change = $payload;
$change['pages'][0]['sections'][0]['content']['text'] = '<script>alert(1)</script>';
refused(signed($change, $secret), $identity, $active, $now, 'HTML payload refused');

$change = $payload;
$change['releaseId'] = 'test-release-2';
$change['sequence'] = 2;
$change['previousReleaseId'] = 'test-release-1';
ensure(is_array(MioPages_Release_Validator::validate(
    signed($change, $secret), $identity,
    ['releaseId' => 'test-release-1', 'sequence' => 1], $now
)), 'next release with exact previous pointer eligible');

echo "PASS: offline release-contract smoke tests (signature, targets, approval, replay, time, content gates).\n";
