<?php
/** Render the approved brand of the current private draft. No network reads. */
function miopages_draft_brand(): ?array {
    static $cache = [];
    $post = get_queried_object();
    if (!is_preview() || !($post instanceof WP_Post) || $post->post_type !== 'page' ||
        $post->post_status !== 'draft' || !current_user_can('edit_post', $post->ID)) return null;
    if (array_key_exists($post->ID, $cache)) return $cache[$post->ID];
    $cache[$post->ID] = null;
    $binding = get_post_meta($post->ID, '_miopages_draft_brand', true);
    if (!is_array($binding) || ($binding['version'] ?? null) !== 1 ||
        ($binding['design']['grammar'] ?? null) !== 'service-led' ||
        !in_array($binding['design']['version'] ?? null, [1, 2, 3], true)) return null;
    $palette = $binding['design']['palette'] ?? [];
    $typography = $binding['design']['typography'] ?? [];
    foreach (['light', 'brand', 'tonal', 'strong'] as $role) {
        foreach (['background', 'text'] as $channel) {
            if (!is_string($palette[$role][$channel] ?? null) ||
                !preg_match('/^#[0-9a-f]{6}$/iD', $palette[$role][$channel])) return null;
        }
    }
    if (!is_string($palette['border'] ?? null) || !preg_match('/^#[0-9a-f]{6}$/iD', $palette['border'])) return null;
    $stacks = [
        'sans' => "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        'serif' => "Georgia, 'Times New Roman', serif",
        'mono' => "ui-monospace, Consolas, monospace",
    ];
    $bodyFont = $typography['bodyFont'] ?? null;
    $headingFont = $typography['headingFont'] ?? null;
    $body = is_string($bodyFont) ? ($stacks[$bodyFont] ?? null) : null;
    $heading = is_string($headingFont) ? ($stacks[$headingFont] ?? null) : null;
    if (!$body || !$heading) return null;
    foreach (['baseSize' => [14, 22], 'headingScale' => [1.5, 3.5], 'lineHeight' => [1.2, 2]] as $field => [$min, $max]) {
        $value = $typography[$field] ?? null;
        if ((!is_int($value) && !is_float($value)) || !is_finite($value) || $value < $min || $value > $max) return null;
    }
    $logo = $binding['logo'] ?? [];
    $attachment = $binding['logoAttachment'] ?? null;
    $alt = $logo['alt'] ?? null;
    $digest = $logo['sha256'] ?? null;
    if (!is_int($attachment) || get_post_mime_type($attachment) !== 'image/png' ||
        !is_string($alt) || trim($alt) === '' || !is_string($digest) || !preg_match('/^[a-f0-9]{64}$/D', $digest)) return null;
    $file = get_attached_file($attachment, true);
    if (!$file || !is_file($file) || !is_readable($file)) return null;
    $bytes = file_get_contents($file);
    if (!is_string($bytes) || !hash_equals($digest, hash('sha256', $bytes))) return null;
    $size = getimagesizefromstring($bytes);
    if ($size === false || $size['mime'] !== 'image/png') return null;
    return $cache[$post->ID] = ['palette' => $palette, 'typography' => $typography,
        'motion' => ($binding['design']['motion'] ?? null) === 'off' ? 'off' : 'minimal',
        'body' => $body, 'heading' => $heading, 'alt' => $alt, 'bytes' => $bytes, 'size' => $size];
}
