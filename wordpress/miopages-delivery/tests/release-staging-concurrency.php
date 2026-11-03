<?php
/**
 * Two-process offline race test for release staging/activation.
 * php wordpress/miopages-delivery/tests/release-staging-concurrency.php
 * Runs only in a private, randomly named temporary directory; no WordPress I/O.
 */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');

class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}

require dirname(__DIR__) . '/includes/class-miopages-release-validator.php';
require dirname(__DIR__) . '/includes/class-miopages-release-store.php';

function confirm(bool $yes, string $why): void
{
    if (!$yes) {
        fwrite(STDERR, "FAIL: {$why}\n");
        exit(1);
    }
}

if (!function_exists('sodium_crypto_sign_keypair')) {
    fwrite(STDERR, "SKIP: sodium unavailable.\n");
    exit(2);
}

// Worker entrypoint deliberately receives only ephemeral local test paths.
if (($argv[1] ?? '') === 'worker') {
    $root = $argv[2] ?? '';
    $identityPath = $root . DIRECTORY_SEPARATOR . 'test-identity.json';
    $envelopePath = $root . DIRECTORY_SEPARATOR . 'test-envelope.json';
    $identity = json_decode((string) file_get_contents($identityPath), true);
    $envelope = file_get_contents($envelopePath);
    confirm(is_array($identity) && is_string($envelope), 'worker input');

    $deadline = microtime(true) + 8;
    while (!is_file($root . DIRECTORY_SEPARATOR . 'go') && microtime(true) < $deadline) {
        usleep(10000);
    }
    confirm(is_file($root . DIRECTORY_SEPARATOR . 'go'), 'worker start signal');
    $store = new MioPages_Release_Store($root, $identity);
    $staged = $store->stage($envelope);
    if ($staged instanceof WP_Error) {
        echo "REFUSED_STAGE\n";
        exit(3);
    }
    // Overlap both processes after staging when possible.
    usleep(30000);
    $result = $store->activate($staged['objectSha256']);
    if ($result instanceof WP_Error) {
        echo "REFUSED_ACTIVATE\n";
        exit(3);
    }
    confirm(is_array($result) && ($result['active']['sequence'] ?? null) === 1,
        'worker activation advances exactly one sequence');
    echo "ACTIVATED\n";
    exit(0);
}

confirm(function_exists('proc_open'), 'proc_open available for race proof');
$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mp-release-race-' . bin2hex(random_bytes(8));
confirm(mkdir($root, 0700), 'temporary test root created');
register_shutdown_function(static function () use ($root): void {
    // Restrict cleanup to known files under this test-owned random root.
    $objects = $root . DIRECTORY_SEPARATOR . 'objects';
    if (is_dir($objects)) {
        foreach (glob($objects . DIRECTORY_SEPARATOR . '*.json') ?: [] as $p) {
            if (is_file($p) && !is_link($p)) {
                unlink($p);
            }
        }
        rmdir($objects);
    }
    foreach (['active.json', '.release.lock', 'go', 'test-identity.json', 'test-envelope.json'] as $file) {
        $p = $root . DIRECTORY_SEPARATOR . $file;
        if (is_file($p) && !is_link($p)) {
            unlink($p);
        }
    }
    if (is_dir($root)) {
        rmdir($root);
    }
});

$pair = sodium_crypto_sign_keypair();
$secret = sodium_crypto_sign_secretkey($pair);
$identity = [
    'keyId' => 'race-key',
    'publicKeyBase64' => base64_encode(sodium_crypto_sign_publickey($pair)),
    'organizationId' => 'race-org',
    'webPresenceId' => 'race-presence',
    'managedSiteId' => 'race-site',
    'installationId' => 'race-installation'
];
$now = time();
$payload = [
    'schema' => 'miopages.wordpress.managed-release', 'version' => 1,
    'releaseId' => 'race-release-1', 'organizationId' => 'race-org',
    'webPresenceId' => 'race-presence', 'managedSiteId' => 'race-site',
    'installationId' => 'race-installation', 'sequence' => 1,
    'previousReleaseId' => null,
    'issuedAt' => gmdate('Y-m-d\TH:i:s\Z', $now - 60),
    'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $now + 1200),
    'approval' => ['state' => 'approved', 'approvalId' => 'race-approval'],
    'pages' => [['id' => 'race-page', 'path' => '/', 'title' => 'Synthetic',
        'sections' => [['id' => 'race-section', 'type' => 'intro',
            'content' => ['heading' => 'Test', 'text' => 'Race test']]]]],
    'assets' => []
];
$bytes = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
$envelope = json_encode([
    'schema' => 'miopages.wordpress.release-envelope', 'version' => 1,
    'keyId' => 'race-key',
    'payloadBase64' => base64_encode($bytes),
    'payloadSha256' => hash('sha256', $bytes),
    'signatureBase64' => base64_encode(
        sodium_crypto_sign_detached("MioPages-WP-Release-v1\n" . $bytes, $secret))
], JSON_THROW_ON_ERROR);
confirm(file_put_contents($root . '/test-identity.json', json_encode($identity, JSON_THROW_ON_ERROR)) !== false,
    'identity fixture written');
confirm(file_put_contents($root . '/test-envelope.json', $envelope) !== false,
    'signed envelope fixture written');

$workers = [];
for ($n = 0; $n < 2; $n++) {
    $proc = proc_open([PHP_BINARY, __FILE__, 'worker', $root],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    confirm(is_resource($proc), 'start worker');
    fclose($pipes[0]);
    $workers[] = [$proc, $pipes];
}
confirm(file_put_contents($root . '/go', 'start') !== false, 'send shared start signal');
$won = 0;
$refused = 0;
foreach ($workers as [$proc, $pipes]) {
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($proc);
    if ($exitCode === 0 && trim($stdout) === 'ACTIVATED') {
        $won++;
    } elseif ($exitCode === 3 && str_starts_with(trim($stdout), 'REFUSED_')) {
        $refused++;
    } else {
        fwrite(STDERR, "Worker unexpected: exit={$exitCode} stdout={$stdout} stderr={$stderr}\n");
        exit(1);
    }
}
confirm($won === 1 && $refused === 1, 'exactly one activation and one refusal');
$store = new MioPages_Release_Store($root, $identity);
$status = $store->status();
confirm(is_array($status) && $status['releaseId'] === 'race-release-1'
    && $status['sequence'] === 1, 'final active pointer correct');
echo "PASS: two-process release activation race (one winner, one refused, single monotonic active pointer).\n";
