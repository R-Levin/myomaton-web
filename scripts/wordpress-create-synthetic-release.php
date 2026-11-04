<?php
/**
 * Local operator-only generator for ONE synthetic, unpublished WP staging envelope.
 *
 * Usage (Windows PowerShell, from repository root):
 *   php .\scripts\wordpress-create-synthetic-release.php
 *
 * Secret is loaded only from local user profile config, never from Git or
 * WordPress. Output is written ONLY to the same protected local directory.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "FAIL: CLI-only test generator.\n");
    exit(1);
}
if (!function_exists('sodium_crypto_sign_detached')) {
    fwrite(STDERR, "FAIL: PHP sodium extension is unavailable.\n");
    exit(1);
}
$home = getenv('USERPROFILE');
if (!is_string($home) || $home === '') {
    fwrite(STDERR, "FAIL: Local Windows user profile is unavailable.\n");
    exit(1);
}
$dir = $home . '/.config/miopages/wp-synthetic-issuer';
$secretFile = $dir . '/synthetic-signing-secret.key';
$publicFile = $dir . '/synthetic-signing-public.b64';
$outputFile = $dir . '/synthetic-release-envelope.json';

if (!is_dir($dir) || is_link($dir)) {
    fwrite(STDERR, "FAIL: Protected local issuer directory is missing or unsafe.\n");
    exit(1);
}
if (file_exists($outputFile) || is_link($outputFile)) {
    fwrite(STDERR, "STOP: A synthetic envelope already exists; nothing overwritten.\n");
    exit(2);
}
$secret = @file_get_contents($secretFile);
$publicEncoded = @file_get_contents($publicFile);
$public = is_string($publicEncoded) ? base64_decode(trim($publicEncoded), true) : false;
if (!is_string($secret) || strlen($secret) !== SODIUM_CRYPTO_SIGN_SECRETKEYBYTES
    || !is_string($public) || strlen($public) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
    || !hash_equals(sodium_crypto_sign_publickey_from_secretkey($secret), $public)) {
    fwrite(STDERR, "FAIL: Local signing key and public verification key are invalid or unmatched.\n");
    exit(1);
}

// All identifiers are deliberately synthetic and match the separate
// non-Git wp-config.php development enrollment.
$now = time();
$payload = [
    'schema' => 'miopages.wordpress.managed-release',
    'version' => 1,
    'releaseId' => 'synthetic-first-hosted-stage',
    'organizationId' => 'synthetic-org',
    'webPresenceId' => 'synthetic-presence',
    'managedSiteId' => 'synthetic-site',
    'installationId' => 'synthetic-installation',
    'sequence' => 1,
    'previousReleaseId' => null,
    'issuedAt' => gmdate('Y-m-d\TH:i:s\Z', $now - 60),
    'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $now + 7200),
    'approval' => ['state' => 'approved', 'approvalId' => 'synthetic-test-approval'],
    'pages' => [[
        'id' => 'synthetic-home',
        'path' => '/',
        'title' => 'Synthetic private staging proof',
        'sections' => [[
            'id' => 'synthetic-intro',
            'type' => 'intro',
            'content' => [
                'heading' => 'Synthetic release — never publish',
                'text' => 'This content verifies private signed storage only. No canonical approval or customer publishing.',
            ],
        ]],
    ]],
    'assets' => [],
];

try {
    $payloadBytes = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    $signature = sodium_crypto_sign_detached("MioPages-WP-Release-v1\n" . $payloadBytes, $secret);
    $envelope = [
        'schema' => 'miopages.wordpress.release-envelope',
        'version' => 1,
        'keyId' => 'synthetic-test-key',
        'payloadBase64' => base64_encode($payloadBytes),
        'payloadSha256' => hash('sha256', $payloadBytes),
        'signatureBase64' => base64_encode($signature),
    ];
    $bytes = json_encode($envelope, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
} catch (JsonException $exception) {
    sodium_memzero($secret);
    fwrite(STDERR, "FAIL: Could not encode synthetic test envelope.\n");
    exit(1);
}
sodium_memzero($secret);

if (!sodium_crypto_sign_verify_detached($signature, "MioPages-WP-Release-v1\n" . $payloadBytes, $public)) {
    fwrite(STDERR, "FAIL: Self-check signature verification failed.\n");
    exit(1);
}
$handle = @fopen($outputFile, 'x+b');
if (!is_resource($handle)) {
    fwrite(STDERR, "FAIL: Could not create local protected envelope file.\n");
    exit(1);
}
$written = fwrite($handle, $bytes);
fclose($handle);
if ($written !== strlen($bytes)) {
    @unlink($outputFile);
    fwrite(STDERR, "FAIL: Synthetic test envelope write was incomplete.\n");
    exit(1);
}
echo "PASS: Signed synthetic envelope created in local protected issuer directory.\n";
echo "PASS: Signature self-verification completed.\n";
echo "NOTE: This is a synthetic approval claim ONLY; not a real central approval or publication.\n";
echo "NOTE: Signing secret remained local; no release has been sent to WordPress.\n";
