<?php
/** The MioPages site theme: the site's design as variables, its one stylesheet, its menu and footer. */
require_once __DIR__ . '/draft-brand.php';

add_action('wp_enqueue_scripts', static function (): void {
    wp_enqueue_style('miopages-managed-site', get_stylesheet_uri(), [], wp_get_theme()->get('Version'));
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
        // The design Core chose for this site: its fonts, the other palette pairs, corners and spacing.
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
    }
    return $classes;
});

/* The logo in the header. */
add_filter('render_block_core/site-title', static function (string $html): string {
    $brand = miopages_draft_brand();
    if (!$brand) return $html;
    return '<span class="miopages-draft-wordmark"><img src="data:image/png;base64,' . base64_encode($brand['bytes']) .
        '" alt="' . esc_attr($brand['alt']) . '" width="' . (int)$brand['size'][0] .
        '" height="' . (int)$brand['size'][1] . '"></span>';
});

/* A Core-rendered page carries its own title (its first heading); don't show a second one. */
add_filter('render_block_core/post-title', static function (string $html): string {
    $post = get_post();
    if ($post && $post->post_type === 'page' && str_contains($post->post_content, 'mp-section')) return '';
    return $html;
});

/* The menu is WordPress's own navigation: the site's menu the delivery plugin keeps (miopages_draft_navigation_id). */
add_filter('render_block_data', static function (array $block): array {
    if (($block['blockName'] ?? null) === 'core/navigation' && empty($block['attrs']['ref'])) {
        $menu = (int) get_option('miopages_draft_navigation_id', 0);
        if ($menu > 0) $block['attrs']['ref'] = $menu;
    }
    return $block;
});

/* The site's footer, written by Core in the Site plan. It travels with each page's content; the theme
   shows it in the site footer, after the logo. */
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
