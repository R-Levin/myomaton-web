<?php
/** Consolidated offline WordPress delivery regression gate. */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "FAIL: CLI required.\n");
    exit(2);
}
$root = dirname(__DIR__);
$base = $root . '/wordpress/miopages-delivery/';
$lint = [
    'miopages-delivery.php',
    'includes/class-miopages-release-validator.php',
    'includes/class-miopages-release-store.php',
    'includes/class-miopages-private-staging.php',
    'includes/class-miopages-release-pull.php',
    'tests/core-pull-compat.php',
    'tests/node-issuer-compat.php',
];
$suites = [
    'tests/preview-smoke.php',
    'tests/environment-check-smoke.php',
    'tests/filesystem-probe-smoke.php',
    'tests/release-contract-smoke.php',
    'tests/release-staging-smoke.php',
    'tests/release-staging-concurrency.php',
    'tests/private-staging-smoke.php',
    'tests/lock-permissions-smoke.php',
];
$failures = 0;

$run = static function (array $args, string $label) use (&$failures): void {
    $command = implode(' ', array_map('escapeshellarg', $args));
    passthru($command, $status);
    if ($status !== 0) {
        $failures++;
        echo "FAIL: {$label} exited {$status}\n";
    }
};

foreach ($lint as $path) {
    $run([PHP_BINARY, '-l', $base . $path], 'lint ' . $path);
}
foreach ($suites as $path) {
    $run([PHP_BINARY, $base . $path], $path);
}
$run(['node', $root . '/scripts/wordpress-cross-runtime-signature-proof.mjs'],
    'Node-to-PHP signed envelope compatibility');

if ($failures > 0) {
    echo "FAIL: consolidated WordPress offline gate ({$failures} failed checks).\n";
    exit(1);
}
echo "PASS: consolidated WordPress offline gate (7 lints, 8 smoke suites, 1 Node-to-PHP compatibility test).\n";
