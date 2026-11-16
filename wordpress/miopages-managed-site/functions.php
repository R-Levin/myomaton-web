<?php
/** Styles for Core's managed draft blocks. */
add_action('wp_enqueue_scripts', static function (): void {
    wp_enqueue_style('miopages-managed-site', get_stylesheet_uri(), [], wp_get_theme()->get('Version'));
});
