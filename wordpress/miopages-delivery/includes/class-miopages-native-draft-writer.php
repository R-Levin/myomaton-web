<?php
/** Internal native draft writer. Requires a verified Core envelope and CLI composition. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-miopages-native-draft-envelope.php';
require_once __DIR__ . '/class-miopages-native-draft-content.php';

final class MioPages_Native_Draft_Writer
{
    public static function apply(string $wire, array $identity): array
    {
        if (!defined('WP_CLI') || !WP_CLI || !current_user_can('edit_pages')) {
            throw new RuntimeException('Native draft writer requires scoped CLI composition.');
        }
        $payload = MioPages_Native_Draft_Envelope::verify($wire, $identity);
        $candidate = $payload['candidate'];
        $digest = $payload['digest'];
        if ($payload['operation'] === 'restore') {
            return ['operation' => 'restore', 'installationId' => $candidate['installationId'],
                'requestedDigest' => $digest, 'applied' => self::restore($candidate, $digest)];
        }
        $applied = self::transaction($candidate['installationId'], function (?array $state) use ($candidate, $digest): array {
            $current = $state['current'] ?? null;
            if ($current !== null && $current['siteProposalId'] !== $candidate['siteProposalId']) {
                throw new RuntimeException('Native draft proposal scope changed.');
            }
            if ($current !== null && $current['digest'] === $digest && $state['highWaterRevision'] === $candidate['revision']) {
                self::verifyDrafts($current);
                return $state;
            }
            $restoredFrom = $state['restoredFrom'] ?? null;
            $predecessor = $restoredFrom ?? ($current['digest'] ?? null);
            if ($predecessor !== $candidate['previousDigest']
                || ($state['highWaterRevision'] ?? 0) + 1 !== $candidate['revision']) {
                throw new RuntimeException('Native draft predecessor mismatch.');
            }
            $rollback = $candidate['rollback'] ?? null;
            if ($restoredFrom !== null && isset($current['logicalPageIds']) && $rollback === null) {
                throw new RuntimeException('Native draft materialized rollback claim required.');
            }
            if ($rollback !== null && ($restoredFrom === null || $current === null ||
                $current['revision'] !== $rollback['revision'] || $current['digest'] !== $rollback['digest'])) {
                throw new RuntimeException('Native draft materialized baseline mismatch.');
            }
            $logicalIds = array_column($candidate['pages'], 'id', 'path');
            ksort($logicalIds);
            if (count($logicalIds) !== count($candidate['pages'])
                || count(array_unique($logicalIds)) !== count($logicalIds)) {
                throw new RuntimeException('Native draft logical Page identity invalid.');
            }
            if ($current !== null) {
                self::verifyDrafts($current);
                $currentIds = $current['logicalPageIds'] ?? null;
                $currentPaths = array_keys($current['posts']);
                sort($currentPaths);
                if ($currentPaths !== array_keys($logicalIds) || ($currentIds !== null && $currentIds !== $logicalIds)) {
                    throw new RuntimeException('Native draft logical Page identity changed.');
                }
            }
            $ids = [];
            foreach ($candidate['pages'] as $page) {
                $path = $page['path'];
                $ids[$path] = $current['posts'][$path]['ID'] ?? self::savePost([
                    'post_type' => 'page', 'post_status' => 'draft',
                    'post_title' => $page['title'], 'post_content' => '',
                ]);
            }
            $posts = MioPages_Native_Draft_Content::posts($candidate, $ids);
            foreach ($posts as $path => &$post) {
                $post['post_name'] = $current['posts'][$path]['post_name']
                    ?? self::newSlug($path, $post['ID']);
                self::updateDraft($post, $current['posts'][$path] ?? null);
            }
            unset($post);
            $next = ['siteProposalId' => $candidate['siteProposalId'], 'revision' => $candidate['revision'],
                'digest' => $digest, 'posts' => $posts, 'logicalPageIds' => $logicalIds];
            self::verifyDrafts($next);
            // The signed predecessor of a forward revision after a restore is
            // the high-water authorization, not the currently materialized content.
            // A v2 authorization explicitly binds the actual materialized baseline.
            $previous = $restoredFrom === null || $rollback !== null ? $current : null;
            if ($previous !== null && !isset($previous['logicalPageIds'])) {
                $previous['logicalPageIds'] = $logicalIds;
                foreach ($previous['posts'] as $path => &$post) {
                    $post['post_name'] = $posts[$path]['post_name'];
                }
                unset($post);
            }
            return ['current' => $next, 'previous' => $previous, 'highWaterRevision' => $candidate['revision']];
        });
        return ['operation' => 'apply', 'installationId' => $candidate['installationId'],
            'requestedDigest' => $digest, 'applied' => $applied];
    }

    private static function restore(array $candidate, string $digest): array
    {
        return self::transaction($candidate['installationId'], function (?array $state) use ($candidate, $digest): array {
            $current = $state['current'] ?? null;
            $previous = $state['previous'] ?? null;
            if ($current === null || $current['siteProposalId'] !== $candidate['siteProposalId']) {
                throw new RuntimeException('Native draft restoration scope mismatch.');
            }
            $rollback = $candidate['rollback'] ?? ['digest' => $candidate['previousDigest'], 'revision' => $candidate['revision'] - 1];
            if (($state['restoredFrom'] ?? null) === $digest && $current['digest'] === $rollback['digest']
                && $current['revision'] === $rollback['revision'] && $state['highWaterRevision'] === $candidate['revision']) {
                self::verifyDrafts($current);
                return $state;
            }
            if ($current['digest'] !== $digest || $current['revision'] !== $candidate['revision']
                || $previous === null || $previous['digest'] !== $rollback['digest']
                || $previous['revision'] !== $rollback['revision'] || $state['highWaterRevision'] !== $candidate['revision']) {
                throw new RuntimeException('Native draft restoration predecessor mismatch.');
            }
            self::verifyDrafts($current);
            if (isset($current['logicalPageIds'])) {
                if (($previous['logicalPageIds'] ?? null) !== $current['logicalPageIds']) {
                    throw new RuntimeException('Native draft restoration identity mismatch.');
                }
                foreach ($current['posts'] as $path => $post) {
                    $prior = $previous['posts'][$path] ?? null;
                    if ($prior === null || $prior['ID'] !== $post['ID'] || $prior['post_name'] !== $post['post_name']) {
                        throw new RuntimeException('Native draft restoration target mismatch.');
                    }
                    self::updateDraft($prior, $post);
                }
            }
            self::verifyDrafts($previous);
            return ['current' => $previous, 'previous' => null, 'restoredFrom' => $digest,
                'highWaterRevision' => $state['highWaterRevision']];
        });
    }

    private static function newSlug(string $path, int $id): string
    {
        $name = $path === '/' ? 'home' : sanitize_title(trim($path, '/'));
        return wp_unique_post_slug(substr($name, 0, 160) . '-miopages-' . $id, $id, 'publish', 'page', 0);
    }

    private static function updateDraft(array $post, ?array $previous): void
    {
        $id = $post['ID'];
        if ($post === $previous) {
            return;
        }
        clean_post_cache($id);
        if ($previous !== null && ($previous['post_title'] !== $post['post_title']
            || $previous['post_content'] !== $post['post_content'])) {
            self::saveRevision($id);
        }
        if (self::savePost($post) !== $id) {
            throw new RuntimeException('Native draft target changed.');
        }
        self::saveRevision($id);
    }

    private static function saveRevision(int $id): void
    {
        $post = get_post($id);
        if (!$post || !wp_revisions_enabled($post)) {
            throw new RuntimeException('Native WordPress revisions are unavailable.');
        }
        foreach (wp_get_post_revisions($id) as $revision) {
            if (wp_is_post_autosave($revision)) {
                continue;
            }
            if ($revision->post_title === $post->post_title && $revision->post_content === $post->post_content) {
                return;
            }
            break;
        }
        // WordPress normally folds whitespace when deciding whether to save.
        // Preserve exact reviewed bytes when a managed revision changes them.
        add_filter('wp_save_post_revision_check_for_changes', '__return_false');
        try {
            $saved = wp_save_post_revision($id);
        } finally {
            remove_filter('wp_save_post_revision_check_for_changes', '__return_false');
        }
        $revision = is_int($saved) && $saved > 0 ? get_post($saved) : null;
        if (!$revision || wp_is_post_revision($revision) !== $id
            || $revision->post_title !== $post->post_title || $revision->post_content !== $post->post_content) {
            throw new RuntimeException('Native WordPress revision write failed.');
        }
    }

    private static function savePost(array $post): int
    {
        $result = wp_insert_post(wp_slash($post), true, false);
        if (is_wp_error($result) || !is_int($result) || $result < 1) {
            throw new RuntimeException('Native WordPress draft write failed.');
        }
        return $result;
    }

    private static function verifyDrafts(array $revision): void
    {
        global $wpdb;
        foreach ($revision['posts'] as $expected) {
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT post_type,post_status,post_title,post_content,post_name FROM {$wpdb->posts} WHERE ID=%d FOR UPDATE",
                $expected['ID']
            ), ARRAY_A);
            unset($expected['ID']);
            // The original draft writer always left the slug empty.
            $expected['post_name'] ??= '';
            if ($row !== $expected) {
                throw new RuntimeException('Native WordPress draft readback mismatch.');
            }
        }
    }

    private static function transaction(string $installation, callable $change): array
    {
        global $wpdb;
        $key = 'miopages_native_draft_' . hash('sha256', $installation);
        $lock = hash('sha256', DB_NAME . ':' . $wpdb->options . ':' . $key);
        $engines = $wpdb->get_col($wpdb->prepare(
            'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (%s,%s,%s)',
            $wpdb->posts, $wpdb->postmeta, $wpdb->options
        ));
        if (count($engines) !== 3 || array_filter($engines, static fn($engine) => $engine !== 'InnoDB') !== []
            || (string) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)', $lock)) !== '1') {
            throw new RuntimeException('Native draft transaction or lock unavailable.');
        }
        try {
            if ($wpdb->query('START TRANSACTION') === false) {
                throw new RuntimeException('Native draft transaction unavailable.');
            }
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT option_value FROM {$wpdb->options} WHERE option_name=%s FOR UPDATE", $key
            ), ARRAY_A);
            if ($wpdb->last_error !== '') {
                throw new RuntimeException('Native draft state read failed.');
            }
            $state = $row === null ? null : json_decode($row['option_value'], true, 48, JSON_THROW_ON_ERROR);
            $next = $change($state);
            if ($next !== $state) {
                $fields = ['option_value' => json_encode($next, JSON_THROW_ON_ERROR), 'autoload' => 'no'];
                $written = $row === null
                    ? $wpdb->insert($wpdb->options, ['option_name' => $key, ...$fields])
                    : $wpdb->update($wpdb->options, $fields, ['option_name' => $key]);
                if ($written !== 1) {
                    throw new RuntimeException('Native draft state write failed.');
                }
            }
            if ($wpdb->query('COMMIT') === false) {
                throw new RuntimeException('Native draft commit uncertain.');
            }
            return $next['current'];
        } catch (Throwable $error) {
            $wpdb->query('ROLLBACK');
            throw $error;
        } finally {
            $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        }
    }
}
