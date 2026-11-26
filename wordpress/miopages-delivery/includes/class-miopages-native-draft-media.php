<?php
/** Private WebP delivery copies for exact native draft placement. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Native_Draft_Media
{
    private const LIMIT = 2000000;

    public static function validate(array $candidate): void
    {
        $media = $candidate['media'] ?? null;
        if (!is_array($media) || !array_is_list($media) || $media === []
            || !is_array($candidate['pages'] ?? null)) {
            throw new InvalidArgumentException('Native draft media claims refused.');
        }
        $usedSections = [];
        $usages = [];
        foreach ($media as $item) {
            if (!is_array($item) || count($item) !== 10) {
                throw new InvalidArgumentException('Native draft media item refused.');
            }
            foreach (['pageId', 'sectionId', 'assetId', 'usageId'] as $key) {
                if (!is_string($item[$key] ?? null) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $item[$key])) {
                    throw new InvalidArgumentException('Native draft media identity refused.');
                }
            }
            foreach (['masterDigest', 'evidenceDigest', 'copyDigest'] as $key) {
                if (!is_string($item[$key] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $item[$key])) {
                    throw new InvalidArgumentException('Native draft media digest refused.');
                }
            }
            if (!is_int($item['width'] ?? null) || !is_int($item['height'] ?? null)
                || min($item['width'], $item['height']) < 1 || max($item['width'], $item['height']) > 1600
                || !is_string($item['alt'] ?? null) || trim($item['alt']) === '' || strlen($item['alt']) > 2000
                || preg_match('/[<>\x00-\x1f\x7f]/', $item['alt'])
                || isset($usedSections[$item['sectionId']]) || isset($usages[$item['usageId']])) {
                throw new InvalidArgumentException('Native draft media placement refused.');
            }
            $pages = array_values(array_filter($candidate['pages'], static fn($page) => ($page['id'] ?? null) === $item['pageId']));
            $targets = array_filter($pages[0]['sections'] ?? [], static fn($section) =>
                ($section['id'] ?? null) === $item['sectionId'] && in_array($section['type'] ?? null, ['hero', 'intro', 'relationship', 'collection', 'cta'], true));
            if (count($pages) !== 1 || count($targets) !== 1) {
                throw new InvalidArgumentException('Native draft media placement mismatch.');
            }
            $usedSections[$item['sectionId']] = true;
            $usages[$item['usageId']] = true;
        }
    }

    /** Windows (a local preview) has no Unix owner or permission bits; everywhere else both are enforced. */
    private static function posix(): bool
    {
        return PHP_OS_FAMILY !== 'Windows';
    }

    private static function same(string|false $a, string $b): bool
    {
        return $a !== false && str_replace('\\', '/', $a) === str_replace('\\', '/', $b);
    }

    private static function file(array $item): string
    {
        $directory = defined('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY') ? MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY : '';
        $pull = defined('MIOPAGES_PRIVATE_PULL') ? MIOPAGES_PRIVATE_PULL : [];
        $doc = realpath($pull['documentRoot'] ?? '');
        $wp = realpath(ABSPATH);
        $owner = function_exists('posix_geteuid') ? posix_geteuid() : null;
        $directoryInfo = is_string($directory) && $directory !== '' ? @lstat($directory) : false;
        if (($owner === null && self::posix()) || !is_string($directory) || !$directoryInfo || !is_dir($directory)
            || !self::same(realpath($directory), $directory)
            || (self::posix() && ($directoryInfo['uid'] !== $owner || ($directoryInfo['mode'] & 0777) !== 0700))
            || empty($pull['documentRoot']) || $doc === false || $wp === false
            || !preg_match('/^[a-f0-9]{64}$/D', $item['copyDigest'] ?? '')) {
            throw new RuntimeException('Private draft media location refused.');
        }
        $slashed = str_replace('\\', '/', $directory);
        foreach ([$doc, $wp] as $root) {
            $root = rtrim(str_replace('\\', '/', $root), '/');
            if ($root === $slashed || str_starts_with($slashed, $root . '/') || str_starts_with($root, $slashed . '/')) {
                throw new RuntimeException('Private draft media must be outside web roots.');
            }
        }
        return $directory . '/' . $item['copyDigest'] . '.webp';
    }

    public static function bytes(array $item): string
    {
        $file = self::file($item);
        $owner = self::posix() ? posix_geteuid() : null;
        clearstatcache(true, $file);
        $before = @lstat($file);
        if (!$before || !is_file($file) || !self::same(realpath($file), $file)
            || (self::posix() && ($before['uid'] !== $owner || ($before['mode'] & 0777) !== 0600)) || $before['nlink'] !== 1
            || $before['size'] < 1 || $before['size'] > self::LIMIT) {
            throw new RuntimeException('Private draft media file refused.');
        }
        $handle = @fopen($file, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Private draft media read unavailable.');
        }
        try {
            $opened = fstat($handle);
            $bytes = stream_get_contents($handle, self::LIMIT + 1);
            if (!$opened || (self::posix() && ($opened['dev'] !== $before['dev'] || $opened['ino'] !== $before['ino']))
                || !is_string($bytes) || strlen($bytes) !== $before['size']) {
                throw new RuntimeException('Private draft media copy changed.');
            }
            self::verifyBytes($item, $bytes);
            return $bytes;
        } finally {
            fclose($handle);
        }
    }

    /** Store only a copy identified by a valid apply envelope. Safe to repeat. */
    public static function stage(string $wire, array $identity, bool $web = false): string
    {
        // From the command line, or from Core's web endpoint as the delivery account; either way the signed envelope is the authority.
        if ((!$web && (!defined('WP_CLI') || !WP_CLI)) || !current_user_can('edit_pages') || !current_user_can('upload_files') || strlen($wire) > 3800000) {
            throw new RuntimeException('Native draft media requires scoped CLI composition.');
        }
        $input = json_decode($wire, true, 60, JSON_THROW_ON_ERROR);
        if (!is_array($input) || count($input) !== 3 || !is_array($input['envelope'] ?? null) || !is_string($input['bytesBase64'] ?? null)
            || !is_string($input['copyDigest'] ?? null) || strlen($input['bytesBase64']) > 2666668) {
            throw new InvalidArgumentException('Native draft media transfer refused.');
        }
        $payload = MioPages_Native_Draft_Envelope::verify(json_encode($input['envelope'], JSON_THROW_ON_ERROR), $identity);
        $matches = array_values(array_filter($payload['candidate']['media'] ?? [], static fn($item) => $item['copyDigest'] === $input['copyDigest']));
        if ($payload['operation'] !== 'apply' || $matches === []) {
            throw new InvalidArgumentException('Native draft media transfer lacks apply authority.');
        }
        $bytes = base64_decode($input['bytesBase64'], true);
        if ($bytes === false || base64_encode($bytes) !== $input['bytesBase64']) {
            throw new InvalidArgumentException('Native draft media encoding refused.');
        }
        $item = $matches[0];
        foreach ($matches as $match) {
            self::verifyBytes($match, $bytes);
        }
        $file = self::file($item);
        clearstatcache(true, $file);
        if (@lstat($file) === false) {
            $temporary = dirname($file) . '/.' . bin2hex(random_bytes(16)) . '.tmp';
            $handle = @fopen($temporary, 'xb');
            if ($handle === false) {
                throw new RuntimeException('Private draft media staging file unavailable.');
            }
            try {
                try {
                    if (!chmod($temporary, 0600) || fwrite($handle, $bytes) !== strlen($bytes) || !fflush($handle) || !fsync($handle)) {
                        throw new RuntimeException('Private draft media write failed.');
                    }
                } finally {
                    fclose($handle);
                }
                if (!@link($temporary, $file) && @lstat($file) === false) {
                    throw new RuntimeException('Private draft media commit unavailable.');
                }
            } finally {
                if (!unlink($temporary)) {
                    throw new RuntimeException('Private draft media staging cleanup failed.');
                }
            }
        }
        if (!hash_equals(self::bytes($item), $bytes)) {
            throw new RuntimeException('Private draft media copy readback mismatch.');
        }
        return $item['copyDigest'];
    }

    public static function verifyBytes(array $item, string $bytes): void
    {
        $size = @getimagesizefromstring($bytes);
        if (strlen($bytes) > self::LIMIT || !hash_equals($item['copyDigest'], hash('sha256', $bytes))
            || !$size || $size[0] !== $item['width'] || $size[1] !== $item['height'] || $size[2] !== IMAGETYPE_WEBP) {
            throw new InvalidArgumentException('Private draft media copy or shape changed.');
        }
    }

    public static function attach(array $candidate, array $ids, array $prior): array
    {
        $attachments = [];
        $paths = array_column($candidate['pages'], 'path', 'id');
        foreach ($candidate['media'] ?? [] as $item) {
            self::bytes($item);
            $postId = $ids[$paths[$item['pageId']]];
            if (($prior[$item['sectionId']]['media'] ?? null) === $item && $prior[$item['sectionId']]['postId'] === $postId) {
                $attachments[$item['sectionId']] = $prior[$item['sectionId']];
                continue;
            }
            if (!current_user_can('upload_files') || !current_user_can('edit_post', $postId)) {
                throw new RuntimeException('Private draft attachment permission refused.');
            }
            // Use WordPress's native file mapping with a protected absolute path.
            // A later authorized release can export the verified local copy.
            $id = wp_insert_attachment(['post_title' => 'MioPages provisional image', 'post_mime_type' => 'image/webp',
                'post_status' => 'private'], self::file($item), $postId, true, false);
            // WordPress unslashes stored meta; a Windows path keeps its backslashes only when slashed first (no effect elsewhere).
            if (is_int($id) && $id > 0) update_post_meta($id, '_wp_attached_file', wp_slash(self::file($item)));
            if (!is_int($id) || $id < 1 || !update_post_meta($id, '_miopages_private_draft', '1')
                || !update_post_meta($id, '_wp_attachment_image_alt', wp_slash($item['alt']))
                || !wp_update_attachment_metadata($id, self::metadata($item))) {
                throw new RuntimeException('Private draft attachment write failed.');
            }
            $attachments[$item['sectionId']] = ['id' => $id, 'postId' => $postId, 'media' => $item];
        }
        return $attachments;
    }

    public static function verifyAttachment(array $attachment): string
    {
        clean_post_cache($attachment['id']);
        $post = get_post($attachment['id']);
        if (!$post || $post->post_type !== 'attachment' || $post->post_status !== 'private'
            || (int) $post->post_parent !== $attachment['postId'] || $post->post_mime_type !== 'image/webp'
            || get_post_meta($attachment['id'], '_miopages_private_draft', true) !== '1'
            || !self::same(get_attached_file($attachment['id'], true), self::file($attachment['media']))
            || wp_get_attachment_metadata($attachment['id'], true) !== self::metadata($attachment['media'])
            || get_post_meta($attachment['id'], '_wp_attachment_image_alt', true) !== $attachment['media']['alt']) {
            throw new RuntimeException('Private draft attachment readback failed.');
        }
        return self::bytes($attachment['media']);
    }

    private static function metadata(array $item): array
    {
        // Preserve native width/height without generating routable derivatives.
        return ['width' => $item['width'], 'height' => $item['height'], 'file' => $item['copyDigest'] . '.webp', 'sizes' => []];
    }

    public static function url(int $id): string
    {
        return admin_url('admin-post.php?action=miopages_native_draft_image&attachment=' . $id);
    }

    public static function previewAllowed(string $installation, int $attachmentId): bool
    {
        try {
            return self::currentAttachment($installation, $attachmentId) !== null;
        } catch (Throwable $error) {
            return false;
        }
    }

    public static function previewBytes(string $installation, int $attachmentId): string
    {
        $item = self::currentAttachment($installation, $attachmentId);
        if ($item === null) {
            throw new RuntimeException('Private draft image unavailable.');
        }
        return self::verifyAttachment($item);
    }

    private static function currentAttachment(string $installation, int $attachmentId): ?array
    {
        global $wpdb;
        $key = 'miopages_native_draft_' . hash('sha256', $installation);
        $record = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name=%s", $key));
        $state = is_string($record) ? json_decode($record, true, 48, JSON_THROW_ON_ERROR) : null;
        foreach ($state['current']['attachments'] ?? [] as $item) {
            if ($item['id'] !== $attachmentId || !current_user_can('edit_post', $item['postId'])) {
                continue;
            }
            $page = get_post($item['postId']);
            if ($page && $page->post_type === 'page' && $page->post_status === 'draft') {
                return $item;
            }
        }
        return null;
    }
}
