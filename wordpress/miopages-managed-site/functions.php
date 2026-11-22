<?php
/** Styles for Core's managed draft blocks. */
require_once __DIR__ . '/draft-brand.php';
require_once __DIR__ . '/layout-css.php';

add_action('wp_enqueue_scripts', static function (): void {
    wp_enqueue_style('miopages-managed-site', get_stylesheet_uri(), [], wp_get_theme()->get('Version'));
    $post = get_queried_object();
    if ($post instanceof WP_Post) {
        $layout = miopages_layout_css($post->post_content);
        if ($layout !== '') wp_add_inline_style('miopages-managed-site', $layout);
    }
    $brand = miopages_draft_brand();
    if (!$brand) return;
    $p = $brand['palette'];
    $t = $brand['typography'];
    $vars = [
        '--wp--preset--color--surface' => $p['light']['background'],
        '--wp--preset--color--ink' => $p['light']['text'],
        '--wp--preset--color--brand' => $p['brand']['background'],
        '--wp--preset--color--on-brand' => $p['brand']['text'],
        '--wp--preset--color--support' => $p['tonal']['background'],
        '--miopages-tonal-ink' => $p['tonal']['text'],
        '--miopages-accent-surface' => $p['strong']['background'],
        '--miopages-accent-ink' => $p['strong']['text'],
        '--miopages-border' => $p['border'],
        '--miopages-body-font' => $brand['body'],
        '--miopages-heading-font' => $brand['heading'],
        '--miopages-body-size' => $t['baseSize'] . 'px',
        '--miopages-body-leading' => (string)$t['lineHeight'],
        '--miopages-title-size' => ($t['baseSize'] * $t['headingScale']) . 'px',
    ];
    if ($brand['designed']) {
        // A design Core's AI chose for this site (projection v4): fonts, extra surfaces, corners, spacing.
        wp_enqueue_style('miopages-site-fonts', get_theme_file_uri('fonts/fonts.css'), [], wp_get_theme()->get('Version'));
        $radius = ['square' => ['0', '0', '0'], 'soft' => ['.3rem', '.6rem', '1rem'], 'round' => ['.6rem', '1.1rem', '1.75rem']][$brand['shape']];
        $vars += [
            '--miopages-supporting-surface' => $p['supporting']['background'], '--miopages-supporting-ink' => $p['supporting']['text'],
            '--miopages-contrast-surface' => $p['contrast']['background'], '--miopages-contrast-ink' => $p['contrast']['text'],
            '--miopages-muted' => $p['muted'], '--miopages-heading-weight' => (string)$t['headingWeight'],
            '--mp-radius-sm' => $radius[0], '--mp-radius-md' => $radius[1], '--mp-radius-lg' => $radius[2],
            '--mp-space' => ['compact' => '.75', 'balanced' => '1', 'airy' => '1.4'][$brand['density']],
        ];
    }
    $css = '';
    foreach ($vars as $name => $value) $css .= $name . ':' . $value . ';';
    wp_add_inline_style('miopages-managed-site', 'body.miopages-branded-draft{' . $css . '}');
});
add_filter('body_class', static function (array $classes): array {
    $brand = miopages_draft_brand();
    if ($brand) {
        $classes[] = 'miopages-branded-draft';
        if ($brand['designed']) $classes[] = 'miopages-designed';
        if ($brand['motion'] === 'off') $classes[] = 'miopages-motion-off';
    }
    return $classes;
});
add_filter('render_block_core/site-title', static function (string $html): string {
    $brand = miopages_draft_brand();
    if (!$brand) return $html;
    return '<span class="miopages-draft-wordmark"><img src="data:image/png;base64,' . base64_encode($brand['bytes']) .
        '" alt="' . esc_attr($brand['alt']) . '" width="' . (int)$brand['size'][0] .
        '" height="' . (int)$brand['size'][1] . '"></span>';
});

/* A composed native Page supplies its own reviewed H1. Do not leave a second,
   CSS-hidden title in the accessibility tree. Ordinary theme Pages retain theirs. */
add_filter('render_block_core/post-title', static function (string $html): string {
    $post = get_post();
    if ($post && $post->post_type === 'page'
        && str_contains($post->post_content, 'class="wp-block-group miopages-composed ')
        && str_contains($post->post_content, 'miopages-native-component')) return '';
    return $html;
});
