<?php
/**
 * Isolated lock-permission regression, safe on local Windows or 20i PHP CLI.
 * php wordpress/miopages-delivery/tests/lock-permissions-smoke.php
 * Never points at any configured WordPress, tenant, or hosted release directory.
 */
declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');
class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}
require dirname(__DIR__) . '/includes/class-miopages-release-store.php';

$root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mp-lock-permissions-' . bin2hex(random_bytes(10));
if (!mkdir($root, 0700)) {
    fwrite(STDERR, "FAIL: isolated temporary directory could not be created.\n");
    exit(1);
}
register_shutdown_function(static function () use ($root): void {
    $lock = $root . DIRECTORY_SEPARATOR . '.release.lock';
    if (is_file($lock) && !is_link($lock)) {
        @unlink($lock);
    }
    @rmdir($root);
});

$store = new MioPages_Release_Store($root, []);
// Even read-only status takes the same lock path and does not create release content.
$status = $store->status();
if (!is_array($status) || $status['sequence'] !== 0) {
    fwrite(STDERR, "FAIL: fresh store status refused.\n");
    exit(1);
}
$lock = $root . DIRECTORY_SEPARATOR . '.release.lock';
if (!is_file($lock) || is_link($lock) || filesize($lock) !== 0) {
    fwrite(STDERR, "FAIL: isolated lock file missing, unsafe, or nonempty.\n");
    exit(1);
}
if (is_file($root . DIRECTORY_SEPARATOR . 'active.json')
    || is_dir($root . DIRECTORY_SEPARATOR . 'objects')) {
    fwrite(STDERR, "FAIL: status unexpectedly created release or activation state.\n");
    exit(1);
}
if (PHP_OS_FAMILY === 'Windows') {
    // NTFS ACLs, not POSIX file mode bits, govern Windows permissions.
    echo "PASS: isolated new lock created; no activation or release files.\n";
    echo "NOT VERIFIED: POSIX mode requires a Linux CLI run (Windows ACL semantics).\n";
    exit(0);
}
clearstatcache(true, $lock);
$mode = fileperms($lock);
if (!is_int($mode) || ($mode & 0777) !== 0600) {
    fwrite(STDERR, 'FAIL: fresh lock mode is '
        . (is_int($mode) ? sprintf('%04o', $mode & 0777) : 'unavailable')
        . "; expected 0600.\n");
    exit(1);
}
echo "PASS: new lock created with mode 0600 and no activation/publication state.\n";
