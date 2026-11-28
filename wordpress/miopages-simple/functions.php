<?php
// MioPages Simple: the theme's one stylesheet.
add_action('wp_enqueue_scripts', static function (): void {
    wp_enqueue_style('miopages-simple', get_stylesheet_uri(), [], wp_get_theme()->get('Version'));
});
