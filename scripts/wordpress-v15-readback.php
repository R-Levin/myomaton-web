<?php
/** Read-only inventory for the exact development apply and rollback. */
if (!defined('WP_CLI') || !WP_CLI || home_url() !== 'https://miopages.org') {
    exit(1);
}
$state = get_option('miopages_native_draft_' . hash('sha256', 'd84ebc69-46d5-4c64-adc6-ac7b87468f89'));
if (is_string($state)) {
    $state = json_decode($state, true, 512, JSON_THROW_ON_ERROR);
}
$posts = [];
foreach ([13, 14] as $id) {
    $post = get_post($id);
    if (!$post || $post->post_type !== 'page' || !wp_revisions_enabled($post)) {
        exit(1);
    }
    preg_match_all('/href="([^"]+)"/', $post->post_content, $links);
    $posts[] = [
        'id' => $id, 'slug' => $post->post_name, 'status' => $post->post_status,
        'sha256' => hash('sha256', $post->post_content),
        'links' => array_map('html_entity_decode', $links[1]),
        'revisions' => array_map(static fn($revision) => (int)$revision->ID, array_values(wp_get_post_revisions($id)))
    ];
}
$pages = get_posts(['post_type' => 'page', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids', 'orderby' => 'ID', 'order' => 'ASC']);
echo wp_json_encode([
    'revision' => $state['current']['revision'], 'digest' => $state['current']['digest'],
    'highWater' => $state['highWaterRevision'], 'restoredFrom' => $state['restoredFrom'] ?? null,
    'posts' => $posts, 'pageIds' => $pages, 'theme' => wp_get_theme()->get_stylesheet()
]), PHP_EOL;
