<?php
/**
 * Plugin Name: MioPages Temporary Development Review Guide
 * Description: Removable review annotation outside signed Page content. No writes.
 * Version: 0.0.1
 */
defined('ABSPATH') || exit;

function miopages_temporary_review_context(int $id): ?array {
    if (home_url() !== 'https://miopages.org' || !current_user_can('edit_post', $id)) {
        return null;
    }
    $post = get_post($id);
    if (!$post || $post->post_type !== 'page' || $post->post_status !== 'draft') {
        return null;
    }
    $state = get_option('miopages_native_draft_' . hash('sha256', 'd84ebc69-46d5-4c64-adc6-ac7b87468f89'));
    if (is_string($state)) {
        $state = json_decode($state, true);
    }
    if (!is_array($state) || !is_int($state['current']['revision'] ?? null)) {
        return null;
    }
    foreach (($state['current']['posts'] ?? []) as $path => $row) {
        if (($row['ID'] ?? null) !== $id) {
            continue;
        }
        return ['path' => $path, 'title' => $post->post_title, 'revision' => $state['current']['revision'],
            'matches' => $post->post_content === ($row['post_content'] ?? null)
                && $post->post_title === ($row['post_title'] ?? null) && $post->post_name === ($row['post_name'] ?? null)];
    }
    return null;
}

function miopages_temporary_review_guide(): void {
    if (!is_preview()) {
        return;
    }
    $context = miopages_temporary_review_context((int) get_queried_object_id());
    if (!$context) {
        return;
    }
    echo '<aside aria-label="Temporary review guide" style="box-sizing:border-box;margin:12px auto;padding:12px 16px;max-width:72rem;border:2px solid #35536b;border-radius:6px;background:#edf4f8;color:#183445;font:16px/1.5 system-ui,sans-serif">';
    echo '<strong>Actual WordPress draft · ' . esc_html($context['title']) . '</strong><div>';
    if ($context['matches']) {
        echo 'Installed candidate revision ' . esc_html((string) $context['revision']) . '. Shown to inspect the actual WordPress theme, content and navigation. This is an earlier candidate, separate from the later proposal shown in Core.';
    } else {
        echo 'This draft differs from the recorded installed candidate. Its content has not been confirmed against that revision. Shown for inspection only.';
    }
    echo '</div><small>Temporary development guide · non-public draft · no customer approval or publication implied</small></aside>';
}
add_action('wp_body_open', 'miopages_temporary_review_guide', 1);
