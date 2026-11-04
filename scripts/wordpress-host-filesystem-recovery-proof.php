<?php
/**
 * MioPages synthetic hosted concurrency and interrupted-write proof.
 * CLI ONLY; upload to package sibling "miopages-private", outside public_html.
 * No WordPress, network, private keys, or customer data.
 *
 * Run from that directory with: php wordpress-host-filesystem-recovery-proof.php
 * Do not run as root or upload to a web-accessible directory.
 */
declare(strict_types=1);

function requireProof(bool $ok, string $message): void
{
    if (!$ok) {
        fwrite(STDERR, 'FAIL: ' . $message . PHP_EOL);
        exit(1);
    }
}

function isPrivateSiblings(string $root): bool
{
    $resolved = realpath($root);
    if ($resolved === false || basename($resolved) !== 'miopages-private'
        || is_link($resolved)) {
        return false;
    }
    $parent = dirname($resolved);
    $public = realpath($parent . DIRECTORY_SEPARATOR . 'public_html');
    if ($public === false || !is_dir($public) || is_link($public)) {
        return false;
    }
    return dirname($public) === $parent
        && !str_starts_with($resolved . DIRECTORY_SEPARATOR, $public . DIRECTORY_SEPARATOR);
}

function readMarker(string $file): ?array
{
    if (!is_file($file) || is_link($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    if (!is_string($raw)) {
        return null;
    }
    try {
        $data = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        return null;
    }
    return is_array($data) && ($data['sequence'] ?? null) === 1
        && ($data['releaseId'] ?? null) === 'synthetic-1'
        && count($data) === 2 ? $data : null;
}

requireProof(PHP_SAPI === 'cli', 'Only PHP CLI is supported');
requireProof(PHP_OS_FAMILY !== 'Windows', 'Hosted Linux test only');
requireProof(function_exists('flock') && function_exists('link')
    && function_exists('rename') && function_exists('proc_open'),
    'Required CLI/file functions unavailable');

$worker = ($argv[1] ?? '') === '--worker';
$root = $worker ? ($argv[2] ?? '') : (string) getcwd();
requireProof(isPrivateSiblings($root), 'Run only inside miopages-private sibling of public_html');

if ($worker) {
    $dir = $argv[3] ?? '';
    $real = realpath($dir);
    requireProof($real !== false && dirname($real) === realpath($root)
        && str_starts_with(basename($real), 'mp-host-proof-'), 'Worker test root invalid');
    $go = $real . '/go';
    $lockPath = $real . '/lock';
    $marker = $real . '/active.json';
    $deadline = microtime(true) + 12.0;
    while (!is_file($go) && microtime(true) < $deadline) {
        usleep(10000);
    }
    requireProof(is_file($go), 'Worker start deadline');
    $lock = @fopen($lockPath, 'c+b');
    requireProof(is_resource($lock), 'Worker lock open');
    requireProof(@flock($lock, LOCK_EX), 'Worker lock acquire');
    try {
        // Intentionally deny late contenders by checking current marker under lock.
        if (is_file($marker)) {
            $state = readMarker($marker);
            requireProof($state !== null, 'Existing active marker is valid');
            echo "REFUSED_REPLAY\n";
            exit(3);
        }
        $temp = tempnam($real, '.pending-');
        requireProof(is_string($temp), 'Worker private temp');
        $body = '{"releaseId":"synthetic-1","sequence":1}';
        try {
            requireProof(@file_put_contents($temp, $body, LOCK_EX) === strlen($body),
                'Worker write complete');
            requireProof(@chmod($temp, 0600), 'Worker temp permissions');
            requireProof(@rename($temp, $marker), 'Worker pointer rename');
        } finally {
            if (is_file($temp)) {
                @unlink($temp);
            }
        }
        echo "ACTIVATED\n";
        exit(0);
    } finally {
        @flock($lock, LOCK_UN);
        @fclose($lock);
    }
}

$dir = rtrim($root, '/\\') . DIRECTORY_SEPARATOR . 'mp-host-proof-' . bin2hex(random_bytes(12));
requireProof(@mkdir($dir, 0700), 'Create unique isolated test directory');
$known = ['active.json', 'lock', 'go', 'orphan.pending', 'hard-source', 'hard-target'];
register_shutdown_function(static function () use ($dir, $known): void {
    foreach ($known as $name) {
        $file = $dir . DIRECTORY_SEPARATOR . $name;
        if (is_file($file) && !is_link($file)) {
            @unlink($file);
        }
    }
    foreach (glob($dir . DIRECTORY_SEPARATOR . '.pending-*') ?: [] as $file) {
        if (is_file($file) && !is_link($file)) {
            @unlink($file);
        }
    }
    if (is_dir($dir) && !@rmdir($dir)) {
        fwrite(STDERR, "WARNING: Test cleanup incomplete; inspect private directory.\n");
    }
});

$src = $dir . '/hard-source';
$dst = $dir . '/hard-target';
requireProof(file_put_contents($src, 'test-only') === 9, 'Test source write');
requireProof(@link($src, $dst) && file_get_contents($dst) === 'test-only',
    'Same-host hard-link proof');

$processes = [];
for ($i = 0; $i < 2; $i++) {
    $p = @proc_open([PHP_BINARY, __FILE__, '--worker', $root, $dir],
        [0 => ['pipe','r'], 1 => ['pipe','w'], 2 => ['pipe','w']], $pipes, $root);
    requireProof(is_resource($p), 'Start separate worker process');
    fclose($pipes[0]);
    $processes[] = [$p, $pipes];
}
requireProof(file_put_contents($dir . '/go', 'start') === 5, 'Start signal');
$won = 0;
$refused = 0;
foreach ($processes as [$p, $pipes]) {
    $out = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($p);
    if ($code === 0 && trim($out) === 'ACTIVATED') {
        $won++;
    } elseif ($code === 3 && trim($out) === 'REFUSED_REPLAY') {
        $refused++;
    } else {
        fwrite(STDERR, "FAIL: Worker exit {$code}; {$error}\n");
        exit(1);
    }
}
requireProof($won === 1 && $refused === 1, 'Exactly one winner and one refusal');
$marker = $dir . '/active.json';
requireProof(readMarker($marker) !== null, 'Active marker valid after concurrent activation');

// Simulated interruption before rename leaves an orphan, not a published active marker.
requireProof(file_put_contents($dir . '/orphan.pending', '{"partial":') === 11,
    'Create synthetic interrupted pending file');
requireProof(readMarker($marker) !== null, 'Orphan does not change active pointer');

// Simulated damaged active marker must fail closed instead of silently reset.
$original = file_get_contents($marker);
requireProof(is_string($original), 'Read original marker');
requireProof(file_put_contents($marker, '{"partial":') === 11, 'Fault inject marker');
requireProof(readMarker($marker) === null, 'Corrupt active marker refused');
requireProof(file_put_contents($marker, $original) === strlen($original),
    'Restore only synthetic marker');
requireProof(readMarker($marker) !== null, 'Reconcile marker after synthetic repair');

echo "PASS: 20i CLI synthetic concurrency (one winner), orphan write isolation, corrupt marker refusal.\n";
echo "NOTE: Process contention verified; crash-durable fsync and real WordPress activation remain unverified.\n";
