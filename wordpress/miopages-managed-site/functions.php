<?php
/** Styles for Core's managed draft blocks. */
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
    $css = '';
    foreach ($vars as $name => $value) $css .= $name . ':' . $value . ';';
    wp_add_inline_style('miopages-managed-site', 'body.miopages-branded-draft{' . $css . '}');
});
add_filter('body_class', static function (array $classes): array {
    $brand = miopages_draft_brand();
    if ($brand) {
        $classes[] = 'miopages-branded-draft';
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
