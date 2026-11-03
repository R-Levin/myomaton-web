<?php
/**
 * Read-only 20i/WordPress environment diagnostic for protected staging design.
 * Never writes, installs, stages, publishes, prints paths, or sends telemetry.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Environment_Check
{
    /**
     * @return array<string,string>
     */
    public static function report(): array
    {
        $root = realpath(ABSPATH);
        $docRoot = isset($_SERVER['DOCUMENT_ROOT']) && is_string($_SERVER['DOCUMENT_ROOT'])
            ? realpath($_SERVER['DOCUMENT_ROOT']) : false;
        $candidate = $root !== false ? realpath(dirname($root)) : false;

        return [
            'PHP runtime' => PHP_VERSION . ' (' . PHP_SAPI . ')',
            'Sodium detached verification' => function_exists('sodium_crypto_sign_verify_detached')
                ? 'Available' : 'Unavailable — stop',
            'Local locking (flock)' => function_exists('flock') ? 'Function available; behavior unverified' : 'Unavailable — stop',
            'Immutable publication (link)' => function_exists('link') ? 'Function available; behavior unverified' : 'Unavailable — stop',
            'Atomic pointer replacement (rename)' => function_exists('rename') ? 'Function available; behavior unverified' : 'Unavailable — stop',
            'Private storage candidate' => self::candidateStatus($root, $docRoot, $candidate),
            'PHP filesystem restriction' => ini_get('open_basedir') ? 'open_basedir is enabled; access requires testing' : 'No open_basedir setting detected',
            'Filesystem writes performed' => 'None',
            'WordPress publication performed' => 'None',
        ];
    }

    /**
     * Classifies a candidate, without emitting paths or assuming it is secure.
     * @param string|false $wpRoot
     * @param string|false $docRoot
     * @param string|false $candidate
     */
    public static function candidateStatus($wpRoot, $docRoot, $candidate): string
    {
        if (!is_string($wpRoot) || !is_string($docRoot) || !is_string($candidate)) {
            return 'Unknown — document/root path could not be resolved';
        }
        $root = self::normalized($wpRoot);
        $doc = self::normalized($docRoot);
        $parent = self::normalized($candidate);

        if ($parent === $doc || self::within($parent, $doc)) {
            return 'Not suitable — candidate is inside web document root';
        }
        // An ancestor of the document root is NOT automatically private:
        // it may contain sibling sites or be user-accessible.
        if (!self::within($doc, $parent) || ($root !== $doc && !self::within($root, $doc))) {
            return 'Unknown — unexpected WordPress/document-root arrangement';
        }
        return 'Potential off-webroot parent detected; private subdirectory, rights and access are NOT verified';
    }

    private static function normalized(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        $trimmed = rtrim($path, '/');
        $result = $trimmed === '' ? '/' : $trimmed;
        return PHP_OS_FAMILY === 'Windows' ? strtolower($result) : $result;
    }

    private static function within(string $child, string $parent): bool
    {
        return $child !== $parent && str_starts_with($child, rtrim($parent, '/') . '/');
    }
}
