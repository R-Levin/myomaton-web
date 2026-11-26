<?php
/** Render the approved brand of the current private draft. No network reads. */
function miopages_draft_brand(): ?array {
    static $cache = [];
    $post = get_queried_object();
    if (!is_preview() || !($post instanceof WP_Post) || $post->post_type !== 'page' ||
        $post->post_status !== 'draft' || !current_user_can('edit_post', $post->ID)) return null;
    if (array_key_exists($post->ID, $cache)) return $cache[$post->ID];
    $cache[$post->ID] = null;
    $signed = apply_filters('miopages_signed_draft_brand', null, $post);
    $binding = $signed['projection'] ?? (defined('MIOPAGES_NATIVE_DRAFT_IDENTITY')
        ? null : get_post_meta($post->ID, '_miopages_draft_brand', true));
    if (!is_array($binding) || ($binding['version'] ?? null) !== 1) return null;
    $designed = ($binding['design']['grammar'] ?? null) === 'core-designed' && in_array($binding['design']['version'] ?? null, [4, 5], true);
    // Version 5: the site's own stylesheet, checked by Core and again by the delivery plugin.
    $stylesheet = $designed && ($binding['design']['version'] ?? null) === 5 ? ($binding['design']['stylesheet'] ?? null) : null;
    if ($stylesheet !== null) {
        if (!class_exists('MioPages_Native_Draft_Brand')) return null;
        try { MioPages_Native_Draft_Brand::stylesheet($stylesheet); } catch (InvalidArgumentException) { return null; }
    }
    if (!$designed && (($binding['design']['grammar'] ?? null) !== 'service-led' ||
        !in_array($binding['design']['version'] ?? null, [1, 2, 3], true))) return null;
    $palette = $binding['design']['palette'] ?? [];
    $typography = $binding['design']['typography'] ?? [];
    foreach ($designed ? ['light', 'brand', 'tonal', 'strong', 'supporting', 'contrast'] : ['light', 'brand', 'tonal', 'strong'] as $role) {
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
    if ($designed) {
        // Self-hosted curated fonts (fonts/fonts.css). Unknown ids are refused, never passed through as CSS.
        $families = miopages_site_fonts();
        $body = $families[$typography['bodyFamily'] ?? ''] ?? null;
        $heading = $families[$typography['headingFamily'] ?? ''] ?? null;
        if (!in_array($typography['headingWeight'] ?? null, [400, 500, 600, 700, 800], true) ||
            !in_array($binding['design']['shape'] ?? null, ['square', 'soft', 'round'], true) ||
            !in_array($binding['design']['density'] ?? null, ['compact', 'balanced', 'airy'], true)) return null;
    } else {
        $bodyFont = $typography['bodyFont'] ?? null;
        $headingFont = $typography['headingFont'] ?? null;
        $body = is_string($bodyFont) ? ($stacks[$bodyFont] ?? null) : null;
        $heading = is_string($headingFont) ? ($stacks[$headingFont] ?? null) : null;
    }
    if (!$body || !$heading) return null;
    foreach (['baseSize' => [14, 22], 'headingScale' => [1.5, 3.5], 'lineHeight' => [1.2, 2]] as $field => [$min, $max]) {
        $value = $typography[$field] ?? null;
        if ((!is_int($value) && !is_float($value)) || !is_finite($value) || $value < $min || $value > $max) return null;
    }
    $logo = $binding['logo'] ?? [];
    $attachment = $binding['logoAttachment'] ?? null;
    $alt = $logo['alt'] ?? null;
    $digest = $logo['sha256'] ?? null;
    if ($signed !== null) {
        $bytes = $signed['bytes'];
    } else {
        if (!is_int($attachment) || get_post_mime_type($attachment) !== 'image/png') return null;
        $file = get_attached_file($attachment, true);
        if (!$file || !is_file($file) || !is_readable($file)) return null;
        $bytes = file_get_contents($file);
    }
    if (!is_string($alt) || trim($alt) === '' || !is_string($digest) ||
        !is_string($bytes) || !hash_equals($digest, hash('sha256', $bytes))) return null;
    $size = getimagesizefromstring($bytes);
    if ($size === false || $size['mime'] !== 'image/png') return null;
    return $cache[$post->ID] = ['palette' => $palette, 'typography' => $typography, 'designed' => $designed,
        'shape' => $designed ? $binding['design']['shape'] : null, 'density' => $designed ? $binding['design']['density'] : null,
        'motion' => ($binding['design']['motion'] ?? null) === 'off' ? 'off' : 'minimal', 'stylesheet' => $stylesheet,
        'body' => $body, 'heading' => $heading, 'alt' => $alt, 'bytes' => $bytes, 'size' => $size];
}

/** Curated self-hosted fonts and their fallbacks. Keep in step with lib/platform/design-systems/site-design.ts. */
function miopages_site_fonts(): array {
    $sans = ", system-ui, -apple-system, 'Segoe UI', sans-serif";
    $serif = ", Georgia, 'Times New Roman', serif";
    return [
        'inter' => "'MP Inter'" . $sans, 'manrope' => "'MP Manrope'" . $sans, 'dm-sans' => "'MP DM Sans'" . $sans,
        'work-sans' => "'MP Work Sans'" . $sans, 'space-grotesk' => "'MP Space Grotesk'" . $sans,
        'plus-jakarta-sans' => "'MP Plus Jakarta Sans'" . $sans, 'source-sans-3' => "'MP Source Sans 3'" . $sans,
        'fraunces' => "'MP Fraunces'" . $serif, 'source-serif-4' => "'MP Source Serif 4'" . $serif, 'lora' => "'MP Lora'" . $serif,
        'playfair-display' => "'MP Playfair Display'" . $serif, 'newsreader' => "'MP Newsreader'" . $serif,
        'jetbrains-mono' => "'MP JetBrains Mono', ui-monospace, Consolas, monospace",
    ];
}
