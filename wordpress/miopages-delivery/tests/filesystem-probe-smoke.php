<?php
/** Local-only synthetic filesystem probe regression; never touches a website. */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');
require dirname(__DIR__) . '/includes/class-miopages-filesystem-probe.php';

function requireProbe(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
}
$base = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mp-probe-test-' . bin2hex(random_bytes(8));
$public = $base . DIRECTORY_SEPARATOR . 'public_html';
$private = $base . DIRECTORY_SEPARATOR . 'private-probe';
requireProbe(mkdir($base, 0700), 'test root');
requireProbe(mkdir($public, 0700), 'fake public root');
requireProbe(mkdir($private, 0700), 'fake private root');
register_shutdown_function(static function () use ($base, $public, $private): void {
    // Probe must have cleaned its own random child.
    @rmdir($private);
    @rmdir($public);
    @rmdir($base);
});
requireProbe(!MioPages_Filesystem_Probe::safeDirectory($public, $public, $public),
    'document root forbidden');
requireProbe(!MioPages_Filesystem_Probe::safeDirectory($base, $public, $public),
    'public root ancestor forbidden');
requireProbe(MioPages_Filesystem_Probe::safeDirectory($private, $public, $public),
    'off-webroot sibling admitted for synthetic proof');
$report = MioPages_Filesystem_Probe::run($private, $public, $public);
foreach (['Private temporary subdirectory', 'Write and read', 'Exclusive lock',
    'Immutable hard link', 'Atomic rename candidate', 'Cleanup'] as $field) {
    requireProbe(str_starts_with($report[$field] ?? '', 'PASS'), $field . ' succeeded');
}
requireProbe((glob($private . DIRECTORY_SEPARATOR . '*') ?: []) === [],
    'all temporary files and directories cleaned');
$refused = MioPages_Filesystem_Probe::run($public, $public, $public);
requireProbe(str_starts_with($refused['Directory boundary'] ?? '', 'FAIL'),
    'refuse test inside web root');
echo "PASS: synthetic filesystem probe (off-webroot guard, lock, hard link, rename, cleanup).\n";
