<?php
/** Exact private brand projection carried by the native draft, including its rollback. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Native_Draft_Brand
{
    public static function bytes(array $brand, array $scope): string
    {
        $projection = $brand['projection'] ?? null;
        $logo = $projection['logo'] ?? null;
        $design = $projection['design'] ?? null;
        $encoded = $brand['pngBase64'] ?? null;
        if (count($brand) !== 3 || !self::digest($brand['digest'] ?? null) ||
            !is_array($projection) || count($projection) !== 4 || ($projection['version'] ?? null) !== 1 ||
            ($projection['scope']['webPresenceId'] ?? null) !== ($scope['webPresenceId'] ?? null) ||
            ($projection['scope']['managedSiteId'] ?? null) !== ($scope['managedSiteId'] ?? null) ||
            !is_array($logo) || count($logo) !== 4 || !self::digest($logo['sha256'] ?? null) ||
            !is_string($logo['alt'] ?? null) || trim($logo['alt']) === '' || strlen($logo['alt']) > 640 ||
            preg_match('/[<>\x00-\x1f\x7f]/', $logo['alt']) ||
            !is_array($design) || count($design) !== 5 || ($design['grammar'] ?? null) !== 'service-led' ||
            !in_array($design['version'] ?? null, [1, 2, 3], true) ||
            !in_array($design['motion'] ?? null, ['off', 'minimal'], true) ||
            !is_string($encoded) || strlen($encoded) > 174764) {
            throw new InvalidArgumentException('Native draft brand binding refused.');
        }
        foreach (['assetId', 'usageId'] as $key) {
            if (!is_string($logo[$key] ?? null) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $logo[$key])) {
                throw new InvalidArgumentException('Native draft brand AssetUsage refused.');
            }
        }
        self::validateDesign($design);
        if (!hash_equals($brand['digest'], self::projectionDigest($projection))) {
            throw new InvalidArgumentException('Native draft brand projection digest refused.');
        }
        $raw = base64_decode($encoded, true);
        $size = is_string($raw) ? @getimagesizefromstring($raw) : false;
        if ($raw === false || strlen($raw) > 131072 || base64_encode($raw) !== $encoded ||
            !hash_equals($logo['sha256'], hash('sha256', $raw)) || !$size || $size[2] !== IMAGETYPE_PNG ||
            $size[0] < 1 || $size[1] < 1 || $size[0] * $size[1] > 40000000) {
            throw new InvalidArgumentException('Native draft brand PNG refused.');
        }
        return $raw;
    }

    private static function validateDesign(array $design): void
    {
        $palette = $design['palette'] ?? null;
        $type = $design['typography'] ?? null;
        if (!is_array($palette) || count($palette) !== 8 || !is_array($type) || count($type) !== 5 ||
            !in_array($type['bodyFont'] ?? null, ['sans', 'serif', 'mono'], true) ||
            !in_array($type['headingFont'] ?? null, ['sans', 'serif', 'mono'], true)) {
            throw new InvalidArgumentException('Native draft brand design refused.');
        }
        foreach (['light', 'strong', 'tonal', 'brand', 'supporting', 'contrast'] as $role) {
            if (!is_array($palette[$role] ?? null) || count($palette[$role]) !== 2) {
                throw new InvalidArgumentException('Native draft brand colors refused.');
            }
            foreach (['background', 'text'] as $key) {
                self::color($palette[$role][$key] ?? null);
            }
        }
        self::color($palette['border'] ?? null);
        self::color($palette['muted'] ?? null);
        foreach (['baseSize' => [14, 22], 'headingScale' => [1.5, 3.5], 'lineHeight' => [1.2, 2]] as $key => [$min, $max]) {
            $number = $type[$key] ?? null;
            if ((!is_int($number) && !is_float($number)) || !is_finite($number) || $number < $min || $number > $max) {
                throw new InvalidArgumentException('Native draft brand type scale refused.');
            }
        }
    }

    private static function color(mixed $value): void
    {
        if (!is_string($value) || !preg_match('/^#[a-f0-9]{6}$/iD', $value)) {
            throw new InvalidArgumentException('Native draft brand color refused.');
        }
    }

    public static function projectionDigest(array $projection): string
    {
        $sort = static function (array $record) use (&$sort): array {
            ksort($record, SORT_STRING);
            return array_map(static fn($value) => is_array($value) ? $sort($value) : $value, $record);
        };
        return hash('sha256', json_encode($sort($projection),
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS));
    }

    private static function digest(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) === 1;
    }

    /** Return the brand for this exact current draft. Retired and edited drafts have no brand binding. */
    public static function preview(string $installation, array $scope, WP_Post $post): ?array
    {
        if (!is_preview() || $post->post_type !== 'page' || $post->post_status !== 'draft' ||
            !current_user_can('edit_post', $post->ID)) return null;
        global $wpdb;
        $key = 'miopages_native_draft_' . hash('sha256', $installation);
        $raw = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name=%s", $key));
        $current = is_string($raw) ? (json_decode($raw, true, 48, JSON_THROW_ON_ERROR)['current'] ?? null) : null;
        if (!is_array($current['brand'] ?? null)) return null;
        foreach ($current['posts'] ?? [] as $expected) {
            if (($expected['ID'] ?? null) === $post->ID && $expected['post_title'] === $post->post_title &&
                $expected['post_name'] === $post->post_name && $expected['post_content'] === $post->post_content) {
                return ['projection' => $current['brand']['projection'], 'bytes' => self::bytes($current['brand'], $scope)];
            }
        }
        return null;
    }
}
