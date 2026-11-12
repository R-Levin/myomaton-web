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
            if ($current !== null && $current['digest'] === $digest) {
                self::verifyDrafts($current);
                return $state;
            }
            if (($current['digest'] ?? null) !== $candidate['previousDigest']
                || ($current['revision'] ?? 0) + 1 !== $candidate['revision']
                || ($state['highWaterRevision'] ?? 0) >= $candidate['revision']) {
                throw new RuntimeException('Native draft predecessor mismatch.');
            }
            if ($current !== null) {
                self::verifyDrafts($current);
            }
            $ids = [];
            foreach ($candidate['pages'] as $page) {
                $ids[$page['path']] = self::savePost([
                    'post_type' => 'page', 'post_status' => 'draft',
                    'post_title' => $page['title'], 'post_content' => '',
                ]);
            }
            $posts = MioPages_Native_Draft_Content::posts($candidate, $ids);
            foreach ($posts as $post) {
                if (self::savePost($post) !== $post['ID']) {
                    throw new RuntimeException('Native draft target changed.');
                }
            }
            $next = ['siteProposalId' => $candidate['siteProposalId'], 'revision' => $candidate['revision'],
                'digest' => $digest, 'posts' => $posts];
            self::verifyDrafts($next);
            return ['current' => $next, 'previous' => $current, 'highWaterRevision' => $candidate['revision']];
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
            if (($state['restoredFrom'] ?? null) === $digest && $current['digest'] === $candidate['previousDigest']) {
                self::verifyDrafts($current);
                return $state;
            }
            if ($current['digest'] !== $digest || $current['revision'] !== $candidate['revision']
                || $previous === null || $previous['digest'] !== $candidate['previousDigest']
                || $previous['revision'] + 1 !== $current['revision']) {
                throw new RuntimeException('Native draft restoration predecessor mismatch.');
            }
            self::verifyDrafts($current);
            self::verifyDrafts($previous);
            return ['current' => $previous, 'previous' => null, 'restoredFrom' => $digest,
                'highWaterRevision' => $state['highWaterRevision']];
        });
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
                "SELECT post_type,post_status,post_title,post_content FROM {$wpdb->posts} WHERE ID=%d",
                $expected['ID']
            ), ARRAY_A);
            unset($expected['ID']);
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
