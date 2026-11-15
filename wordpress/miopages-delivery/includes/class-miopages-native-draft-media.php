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
            || !is_array($candidate['pages'] ?? null) || count($media) > count($candidate['pages'])) {
            throw new InvalidArgumentException('Native draft media claims refused.');
        }
        $usedPages = [];
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
                || isset($usedPages[$item['pageId']]) || isset($usages[$item['usageId']])) {
                throw new InvalidArgumentException('Native draft media placement refused.');
            }
            $pages = array_values(array_filter($candidate['pages'], static fn($page) => ($page['id'] ?? null) === $item['pageId']));
            $targets = array_filter($pages[0]['sections'] ?? [], static fn($section) =>
                ($section['id'] ?? null) === $item['sectionId'] && ($section['type'] ?? null) === 'intro');
            if (count($pages) !== 1 || count($targets) !== 1) {
                throw new InvalidArgumentException('Native draft media placement mismatch.');
            }
            $usedPages[$item['pageId']] = true;
            $usages[$item['usageId']] = true;
        }
    }

    public static function bytes(array $item): string
    {
        $directory = defined('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY') ? MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY : '';
        $pull = defined('MIOPAGES_PRIVATE_PULL') ? MIOPAGES_PRIVATE_PULL : [];
        $doc = realpath($pull['documentRoot'] ?? '');
        $wp = realpath(ABSPATH);
        $owner = function_exists('posix_geteuid') ? posix_geteuid() : null;
        $directoryInfo = is_string($directory) && $directory !== '' ? @lstat($directory) : false;
        if ($owner === null || !is_string($directory) || !$directoryInfo || !is_dir($directory)
            || realpath($directory) !== $directory || $directoryInfo['uid'] !== $owner || ($directoryInfo['mode'] & 0777) !== 0700
            || empty($pull['documentRoot']) || $doc === false || $wp === false
            || !preg_match('/^[a-f0-9]{64}$/D', $item['copyDigest'] ?? '')) {
            throw new RuntimeException('Private draft media location refused.');
        }
        foreach ([$doc, $wp] as $root) {
            if ($root === $directory || str_starts_with($directory, $root . '/') || str_starts_with($root, $directory . '/')) {
                throw new RuntimeException('Private draft media must be outside web roots.');
            }
        }
        $file = $directory . '/' . $item['copyDigest'] . '.webp';
        clearstatcache(true, $file);
        $before = @lstat($file);
        if (!$before || !is_file($file) || realpath($file) !== $file || $before['uid'] !== $owner
            || ($before['mode'] & 0777) !== 0600 || $before['nlink'] !== 1 || $before['size'] < 1 || $before['size'] > self::LIMIT) {
            throw new RuntimeException('Private draft media file refused.');
        }
        $handle = @fopen($file, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Private draft media read unavailable.');
        }
        try {
            $opened = fstat($handle);
            $bytes = stream_get_contents($handle, self::LIMIT + 1);
            if (!$opened || $opened['dev'] !== $before['dev'] || $opened['ino'] !== $before['ino']
                || !is_string($bytes) || strlen($bytes) !== $before['size']) {
                throw new RuntimeException('Private draft media copy changed.');
            }
            self::verifyBytes($item, $bytes);
            return $bytes;
        } finally {
            fclose($handle);
        }
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
            // Bytes are deliberately never registered under wp-content/uploads.
            $id = wp_insert_attachment(['post_title' => 'MioPages provisional image', 'post_mime_type' => 'image/webp',
                'post_status' => 'private'], false, $postId, true, false);
            if (!is_int($id) || $id < 1 || !update_post_meta($id, '_wp_attachment_image_alt', $item['alt'])) {
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
            || get_post_meta($attachment['id'], '_wp_attached_file', true) !== ''
            || get_post_meta($attachment['id'], '_wp_attachment_image_alt', true) !== $attachment['media']['alt']) {
            throw new RuntimeException('Private draft attachment readback failed.');
        }
        return self::bytes($attachment['media']);
    }

    public static function previewBytes(string $installation, int $attachmentId): string
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
                return self::verifyAttachment($item);
            }
        }
        throw new RuntimeException('Private draft image unavailable.');
    }
}
