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
    // The site's own look, designed by Core (projection v5), after the base styling it replaces.
    if (is_string($brand['stylesheet'] ?? null)) wp_add_inline_style('miopages-managed-site', $brand['stylesheet']);
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

/* The site menu (design rule 5: it works by touch and keyboard on every screen). The page's menu
   sits in the header where visitors expect it; it shows as text links and switches to a phone
   menu (a button that opens the list) when the links would wrap to two lines (the Principal,
   Nov 27). Core designs how both states look. Without JavaScript the text links stay. */
function miopages_draft_menu(): ?string
{
    static $menu = false;
    if ($menu !== false) return $menu;
    $menu = null;
    $post = get_queried_object();
    if ($post instanceof WP_Post && preg_match('#<nav class="miopages-draft-nav"[^>]*>.*?</nav>#s', $post->post_content, $found)) {
        $menu = str_replace('<nav class="miopages-draft-nav"', '<nav id="miopages-site-menu" class="miopages-draft-nav"', $found[0]);
    }
    return $menu;
}
add_filter('render_block_core/navigation', static function (string $html): string {
    $menu = miopages_draft_menu();
    if ($menu === null) return $html;
    return '<div class="miopages-menu"><button type="button" class="miopages-menu-toggle" aria-controls="miopages-site-menu"'
        . ' aria-expanded="false" aria-label="' . esc_attr__('Open menu', 'miopages-managed-site') . '">'
        . '<span class="miopages-menu-icon" aria-hidden="true"><span></span><span></span><span></span></span></button>' . $menu . '</div>';
});
add_filter('render_block_core/post-content', static function (string $html): string {
    if (miopages_draft_menu() === null) return $html;
    return preg_replace('#<nav class="miopages-draft-nav"[^>]*>.*?</nav>#s', '', $html, 1) ?? $html;
});
add_action('wp_enqueue_scripts', static function (): void {
    if (miopages_draft_menu() === null) return;
    wp_enqueue_script('miopages-menu', get_theme_file_uri('menu.js'), [], wp_get_theme()->get('Version'), ['strategy' => 'defer', 'in_footer' => true]);
    wp_localize_script('miopages-menu', 'miopagesMenu', ['open' => __('Open menu', 'miopages-managed-site'), 'close' => __('Close menu', 'miopages-managed-site')]);
});

/* The site's footer, written by Core in the Site plan (the Principal, Nov 27). It travels with each
   page's content; the theme shows it in the site footer, after the logo. */
function miopages_draft_footer(): ?string
{
    static $footer = false;
    if ($footer !== false) return $footer;
    $footer = null;
    $post = get_queried_object();
    if ($post instanceof WP_Post && preg_match('#<!-- miopages-site-footer -->(.*?)<!-- /miopages-site-footer -->#s', $post->post_content, $found)) $footer = $found[1];
    return $footer;
}
add_filter('render_block_core/post-content', static function (string $html): string {
    if (miopages_draft_footer() === null) return $html;
    return preg_replace('#<!-- miopages-site-footer -->.*?<!-- /miopages-site-footer -->#s', '', $html, 1) ?? $html;
});
add_filter('render_block_core/template-part', static function (string $html, array $block): string {
    $footer = miopages_draft_footer();
    if ($footer === null || ($block['attrs']['slug'] ?? null) !== 'footer') return $html;
    $at = strrpos($html, '</footer>');
    return $at === false ? $html . $footer : substr($html, 0, $at) . $footer . substr($html, $at);
}, 10, 2);

/* Design rule 4 (Readable) is guaranteed by the theme on every site Core designs: text that would
   not read on its background takes the site's own dark or light text color (readable.js). */
add_action('wp_enqueue_scripts', static function (): void {
    $brand = miopages_draft_brand();
    if (!$brand || !$brand['designed']) return;
    wp_enqueue_script('miopages-readable', get_theme_file_uri('readable.js'), [], wp_get_theme()->get('Version'), ['strategy' => 'defer', 'in_footer' => true]);
});
