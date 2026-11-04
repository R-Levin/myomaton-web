<?php
/** One-command offline smoke tests for experimental WordPress delivery. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { exit(2); }
$base = dirname(__DIR__) . '/wordpress/miopages-delivery/';
$lint = [
    'miopages-delivery.php',
    'includes/class-miopages-release-validator.php',
    'includes/class-miopages-release-store.php',
    'includes/class-miopages-private-staging.php',\n    'tests/node-issuer-compat.php',
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
foreach (array_merge(array_map(static fn($p) => ['-l', $base . $p], $lint),
                      array_map(static fn($p) => [$base . $p], $suites)) as $args) {
    $cmd = implode(' ', array_map('escapeshellarg', array_merge([PHP_BINARY], $args)));
    passthru($cmd, $status);
    if ($status !== 0) {
        $failures++;
        echo "FAIL: " . basename(end($args)) . " status {$status}\n";
    }
}
echo $failures ? "FAIL: {$failures} checks failed.\n" : "PASS: consolidated WordPress offline regression gate.\n";
exit($failures ? 1 : 0);
