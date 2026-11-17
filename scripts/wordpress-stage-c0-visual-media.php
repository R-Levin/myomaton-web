<?php
/** Private CLI composition for the two signed C0 draft media copies. */
declare(strict_types=1);

$root = '/home/sites/36a/9/9fe7ae6df4';
$install = 'd84ebc69-46d5-4c64-adc6-ac7b87468f89';
$private = $root . '/miopages-private/native-draft-' . $install;
$file = $private . '/cli-config.php';
$stat = lstat($file);
if (PHP_SAPI !== 'cli' || __DIR__ !== $private . '/stage-36f5dbff'
    || !is_array($stat) || !is_file($file) || realpath($file) !== $file
    || ($stat['mode'] & 0777) !== 0600 || $stat['uid'] !== posix_geteuid()
    || hash_file('sha256', $file) !== '104a3efcc8237d95273db2d2dc16a25005038526a4965b5e059799e9daf098db'
    || defined('MIOPAGES_NATIVE_DRAFT_IDENTITY') || defined('MIOPAGES_PRIVATE_PULL')) {
    throw new RuntimeException('Private media CLI custody refused.');
}

// The older loader defines constants directly. Read the checked source in a
// child process and append only the document root, keeping HMAC data in memory.
$code = <<<'PHP'
require $argv[1];
echo json_encode([MIOPAGES_NATIVE_DRAFT_IDENTITY, MIOPAGES_PRIVATE_PULL], JSON_THROW_ON_ERROR);
PHP;
$child = proc_open([PHP_BINARY, '-r', $code, $file],
    [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
if (!is_resource($child)) {
    throw new RuntimeException('Private media CLI composition unavailable.');
}
try {
    $raw = stream_get_contents($pipes[1], 8193);
} finally {
    fclose($pipes[1]);
    $result = proc_close($child);
}
if ($result !== 0 || !is_string($raw) || strlen($raw) > 8192) {
    throw new RuntimeException('Private media CLI composition refused.');
}
[$identity, $pull] = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
unset($raw);
if ($identity['installationId'] !== $install || ($pull['identity']['installationId'] ?? null) !== $install
    || !preg_match('/^[a-f0-9]{64}$/D', $pull['secretHex'] ?? '') || isset($pull['documentRoot'])) {
    throw new RuntimeException('Private media CLI installation binding refused.');
}
$pull['documentRoot'] = $root . '/public_html';
define('MIOPAGES_NATIVE_DRAFT_IDENTITY', $identity);
define('MIOPAGES_PRIVATE_PULL', $pull);
unset($identity, $pull);
