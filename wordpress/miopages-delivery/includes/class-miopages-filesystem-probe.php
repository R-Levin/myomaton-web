<?php
/**
 * One-shot, manually triggered synthetic filesystem probe.
 * Does not stage releases, publish content or send server paths to clients.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Filesystem_Probe
{
    /** @return array<string,string> */
    public static function run(string $configuredDirectory, string $wordpressRoot, string $documentRoot): array
    {
        $report = [
            'Directory boundary' => 'FAIL — refused',
            'Private temporary subdirectory' => 'Not attempted',
            'Write and read' => 'Not attempted',
            'Exclusive lock' => 'Not attempted',
            'Immutable hard link' => 'Not attempted',
            'Atomic rename candidate' => 'Not attempted',
            'Cleanup' => 'Not attempted',
        ];

        if (!self::safeDirectory($configuredDirectory, $wordpressRoot, $documentRoot)) {
            return $report;
        }
        $report['Directory boundary'] = 'PASS — existing directory outside WordPress and document root; HTTP privacy not independently verified';

        // Random child created only for the explicit one-shot run, never in any WP directory.
        try {
            $suffix = bin2hex(random_bytes(12));
        } catch (Throwable $exception) {
            return $report;
        }
        $child = rtrim($configuredDirectory, '/\\') . DIRECTORY_SEPARATOR . 'mp-probe-' . $suffix;
        if (!@mkdir($child, 0700)) {
            $report['Private temporary subdirectory'] = 'FAIL — unable to create private test directory';
            return $report;
        }
        $report['Private temporary subdirectory'] = 'PASS';
        $a = $child . DIRECTORY_SEPARATOR . 'source.bin';
        $b = $child . DIRECTORY_SEPARATOR . 'immutable.bin';
        $temp = $child . DIRECTORY_SEPARATOR . 'marker.tmp';
        $marker = $child . DIRECTORY_SEPARATOR . 'marker.json';
        $lockPath = $child . DIRECTORY_SEPARATOR . 'probe.lock';
        $handle = null;
        $locked = false;

        $exercise = static function () use (&$report, &$handle, &$locked, $a, $b, $temp, $marker, $lockPath, $suffix): void {
            $bytes = 'MioPages synthetic filesystem probe ' . $suffix;
            if (@file_put_contents($a, $bytes, LOCK_EX) === strlen($bytes)
                && @file_get_contents($a) === $bytes) {
                $report['Write and read'] = 'PASS';
            } else {
                $report['Write and read'] = 'FAIL';
                return;
            }
            $handle = @fopen($lockPath, 'x+b');
            if (is_resource($handle) && @flock($handle, LOCK_EX | LOCK_NB)) {
                $locked = true;
                $report['Exclusive lock'] = 'PASS — single-process lock only; contention unverified';
            } else {
                $report['Exclusive lock'] = 'FAIL';
                return;
            }
            if (@link($a, $b) && is_file($b)
                && @file_get_contents($b) === $bytes) {
                $report['Immutable hard link'] = 'PASS — same-filesystem hard link';
            } else {
                $report['Immutable hard link'] = 'FAIL';
                return;
            }
            if (@file_put_contents($temp, '{"probe":"synthetic"}', LOCK_EX) === 21
                && @rename($temp, $marker)
                && @file_get_contents($marker) === '{"probe":"synthetic"}') {
                $report['Atomic rename candidate'] = 'PASS — rename completed; crash durability unverified';
            } else {
                $report['Atomic rename candidate'] = 'FAIL';
            }
        };
        try {
            $exercise();
        } finally {
            if (is_resource($handle)) {
                if ($locked) {
                    @flock($handle, LOCK_UN);
                }
                @fclose($handle);
            }
            $complete = true;
            foreach ([$marker, $temp, $b, $a, $lockPath] as $path) {
                if (is_file($path) && !is_link($path) && !@unlink($path)) {
                    $complete = false;
                }
            }
            if (!@rmdir($child)) {
                $complete = false;
            }
            $report['Cleanup'] = $complete ? 'PASS — synthetic files removed' : 'FAIL — manual private-directory inspection required';
        }
        return $report;
    }

    public static function safeDirectory(string $configuredDirectory, string $wordpressRoot, string $documentRoot): bool
    {
        if ($configuredDirectory === '' || !is_dir($configuredDirectory) || is_link($configuredDirectory)) {
            return false;
        }
        $candidate = realpath($configuredDirectory);
        $wp = realpath($wordpressRoot);
        $doc = realpath($documentRoot);
        if ($candidate === false || $wp === false || $doc === false) {
            return false;
        }
        $candidate = self::normal($candidate);
        $wp = self::normal($wp);
        $doc = self::normal($doc);
        // Both public descendants and public ancestors are unsuitable.
        if (self::contains($wp, $candidate) || self::contains($doc, $candidate)
            || self::contains($candidate, $wp) || self::contains($candidate, $doc)) {
            return false;
        }
        // Reject root volumes, home/account ancestors and symbolic-link components.
        if (dirname($candidate) === $candidate || strlen($candidate) < 8) {
            return false;
        }
        $walk = $candidate;
        while (dirname($walk) !== $walk) {
            if (is_link($walk)) {
                return false;
            }
            $walk = dirname($walk);
        }
        return true;
    }

    private static function normal(string $path): string
    {
        $s = str_replace('\\', '/', $path);
        $s = rtrim($s, '/');
        if ($s === '') {
            $s = '/';
        }
        return PHP_OS_FAMILY === 'Windows' ? strtolower($s) : $s;
    }

    private static function contains(string $parent, string $child): bool
    {
        return $parent === $child || str_starts_with($child, rtrim($parent, '/') . '/');
    }
}
