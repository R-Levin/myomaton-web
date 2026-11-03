<?php
/** Offline, read-only classification tests for WordPress hosting diagnostic. */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');
require dirname(__DIR__) . '/includes/class-miopages-environment-check.php';

function ensureResult(bool $ok, string $message): void
{
    if (!$ok) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$check = [MioPages_Environment_Check::class, 'candidateStatus'];
$good = $check('/srv/account/public_html', '/srv/account/public_html', '/srv/account');
ensureResult(str_starts_with($good, 'Potential off-webroot'), 'same root can identify possible parent');
$inside = $check('/srv/account/public_html/site', '/srv/account/public_html', '/srv/account/public_html');
ensureResult(str_starts_with($inside, 'Not suitable'), 'nested WordPress parent in document root refused');
$unknown = $check('/srv/account/public_html', false, '/srv/account');
ensureResult(str_starts_with($unknown, 'Unknown'), 'unresolvable document root not guessed');
$sibling = $check('/other/wordpress', '/srv/account/public_html', '/srv/account');
ensureResult(str_starts_with($sibling, 'Unknown'), 'unrelated paths not treated as secure');
$report = MioPages_Environment_Check::report();
ensureResult(isset($report['Sodium detached verification'], $report['Private storage candidate']),
    'report contains crypto and private storage eligibility');
ensureResult(($report['Filesystem writes performed'] ?? '') === 'None',
    'read-only contract reported');

echo "PASS: WordPress environment read-only diagnostic (root classification and capabilities).\n";
