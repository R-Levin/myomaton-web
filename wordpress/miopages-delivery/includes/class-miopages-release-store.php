<?php
/**
 * Local, offline-only immutable storage proof for signed MioPages releases.
 * No WordPress registration, HTTP route or publication hooks.
 *
 * Security note: caller MUST provide a pre-existing private directory outside
 * the document root, and enforce filesystem permissions separately.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Release_Store
{
    private string $root;
    private string $objects;
    /** @var array<string,mixed> */
    private array $identity;

    /** @param array<string,mixed> $identity */
    public function __construct(string $privateDirectory, array $identity)
    {
        $real = realpath($privateDirectory);
        if ($real === false || !is_dir($real) || is_link($privateDirectory)) {
            throw new InvalidArgumentException('An existing, private directory is required.');
        }
        // A parent directory reached via a symlink is not permitted for this proof.
        // The caller must separately enforce that this is outside any web root.
        $segments = explode(DIRECTORY_SEPARATOR, $real);
        $cursor = str_starts_with($real, DIRECTORY_SEPARATOR) ? DIRECTORY_SEPARATOR : array_shift($segments);
        foreach ($segments as $segment) {
            if ($segment === '') {
                continue;
            }
            $cursor = rtrim($cursor, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $segment;
            if (is_link($cursor)) {
                throw new InvalidArgumentException('Symlinked storage ancestors are not permitted.');
            }
        }
        $this->root = $real;
        $this->objects = $real . DIRECTORY_SEPARATOR . 'objects';
        $this->identity = $identity;
    }

    /**
     * @return array<string,mixed>|WP_Error
     */
    public function stage(string $envelope, ?int $now = null)
    {
        return $this->locked(function () use ($envelope, $now) {
            $active = $this->readActive();
            if ($active instanceof WP_Error) {
                return $active;
            }
            $validated = MioPages_Release_Validator::validate($envelope, $this->identity, $active, $now);
            if ($validated instanceof WP_Error) {
                return $validated;
            }
            $digest = hash('sha256', $envelope);
            if (!$this->objectFolderReady()) {
                return $this->fail('object_directory');
            }
            $target = $this->objectPath($digest);
            if (is_link($target) || (file_exists($target) && !is_file($target))) {
                return $this->fail('object_unsafe');
            }
            if (file_exists($target)) {
                $old = file_get_contents($target);
                if (!is_string($old) || !hash_equals(hash('sha256', $old), $digest)
                    || !hash_equals($old, $envelope)) {
                    return $this->fail('immutable_object_conflict');
                }
            } elseif (!$this->writeAtomic($target, $envelope, false)) {
                return $this->fail('object_write');
            }
            return [
                'state' => 'staged',
                'releaseId' => $validated['releaseId'],
                'sequence' => $validated['sequence'],
                'objectSha256' => $digest,
            ];
        });
    }

    /**
     * Activate *only a previously staged object* using current active state.
     * @return array<string,mixed>|WP_Error
     */
    public function activate(string $digest, ?int $now = null)
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $digest)) {
            return $this->fail('invalid_digest');
        }
        return $this->locked(function () use ($digest, $now) {
            $active = $this->readActive();
            if ($active instanceof WP_Error) {
                return $active;
            }
            if (!$this->objectFolderReady()) {
                return $this->fail('object_directory');
            }
            $target = $this->objectPath($digest);
            if (!is_file($target) || is_link($target)) {
                return $this->fail('missing_or_unsafe_object');
            }
            $bytes = file_get_contents($target);
            if (!is_string($bytes) || !hash_equals(hash('sha256', $bytes), $digest)) {
                return $this->fail('object_integrity');
            }
            // Re-check signature, target, approval, time and sequence under lock.
            $validated = MioPages_Release_Validator::validate($bytes, $this->identity, $active, $now);
            if ($validated instanceof WP_Error) {
                return $validated;
            }
            $newActive = [
                'releaseId' => $validated['releaseId'],
                'sequence' => $validated['sequence'],
                'objectSha256' => $digest,
            ];
            $encoded = json_encode($newActive, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
            if (!$this->writeAtomic($this->root . DIRECTORY_SEPARATOR . 'active.json', $encoded, true)) {
                return $this->fail('active_write');
            }
            return ['state' => 'activated_offline', 'active' => $newActive];
        });
    }

    /** @return array<string,mixed>|WP_Error */
    public function status()
    {
        return $this->locked(fn() => $this->readActive());
    }

    /** @return array<string,mixed>|WP_Error */
    private function readActive()
    {
        $file = $this->root . DIRECTORY_SEPARATOR . 'active.json';
        if (is_link($file) || (file_exists($file) && !is_file($file))) {
            return $this->fail('active_unsafe');
        }
        if (!file_exists($file)) {
            return ['releaseId' => null, 'sequence' => 0, 'objectSha256' => null];
        }
        $json = file_get_contents($file);
        if (!is_string($json)) {
            return $this->fail('active_unreadable');
        }
        try {
            $value = json_decode($json, true, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            return $this->fail('active_corrupt');
        }
        if (!is_array($value) || !self::exactKeys($value, ['releaseId', 'sequence', 'objectSha256'])
            || !is_int($value['sequence']) || $value['sequence'] < 1
            || !is_string($value['releaseId']) || $value['releaseId'] === ''
            || !is_string($value['objectSha256'])
            || !preg_match('/^[a-f0-9]{64}$/D', $value['objectSha256'])) {
            return $this->fail('active_invalid');
        }
        $target = $this->objectPath($value['objectSha256']);
        if (is_link($target) || !is_file($target)) {
            return $this->fail('active_missing_object');
        }
        $bytes = file_get_contents($target);
        if (!is_string($bytes)
            || !hash_equals(hash('sha256', $bytes), $value['objectSha256'])) {
            return $this->fail('active_integrity');
        }
        // Note: signature of active object checked at activation, not every status call.
        return $value;
    }

    /** @return mixed */
    private function locked(callable $callback)
    {
        $lockFile = $this->root . DIRECTORY_SEPARATOR . '.release.lock';
        if (is_link($lockFile) || (file_exists($lockFile) && !is_file($lockFile))) {
            return $this->fail('lock_unsafe');
        }
        $handle = @fopen($lockFile, 'c+b');
        if ($handle === false) {
            return $this->fail('lock_unavailable');
        }
        try {
            if (!flock($handle, LOCK_EX)) {
                return $this->fail('lock_failed');
            }
            try {
                return $callback();
            } finally {
                flock($handle, LOCK_UN);
            }
        } finally {
            fclose($handle);
        }
    }

    private function objectFolderReady(): bool
    {
        if (is_link($this->objects)) {
            return false;
        }
        if (!is_dir($this->objects) && !@mkdir($this->objects, 0700)) {
            return false;
        }
        return is_dir($this->objects);
    }

    private function objectPath(string $digest): string
    {
        return $this->objects . DIRECTORY_SEPARATOR . $digest . '.json';
    }

    private function writeAtomic(string $path, string $bytes, bool $replace): bool
    {
        $dir = dirname($path);
        if (is_link($path) || (file_exists($path) && !is_file($path)) || !is_dir($dir)) {
            return false;
        }
        $temp = tempnam($dir, '.mp-tmp-');
        if ($temp === false) {
            return false;
        }
        try {
            if (@file_put_contents($temp, $bytes, LOCK_EX) !== strlen($bytes) || !@chmod($temp, 0600)) {
                return false;
            }
            // Atomic no-clobber for immutable objects via hard-link publication.
            // If hard links are unsupported we fail closed rather than overwrite.
            if (!$replace) {
                if (file_exists($path) || is_link($path)) {
                    return false;
                }
                return @link($temp, $path);
            }
            return @rename($temp, $path);
        } finally {
            if (file_exists($temp)) {
                unlink($temp);
            }
        }
    }

    /** @param array<mixed> $object @param list<string> $expected */
    private static function exactKeys(array $object, array $expected): bool
    {
        $keys = array_keys($object);
        sort($keys);
        sort($expected);
        return $keys === $expected;
    }

    private function fail(string $reason): WP_Error
    {
        return new WP_Error('miopages_staging_refused', 'Offline staging refused: ' . $reason);
    }
}
