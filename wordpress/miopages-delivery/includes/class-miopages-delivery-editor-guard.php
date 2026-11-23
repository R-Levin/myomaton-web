<?php
/**
 * Protects Core's deliveries from editors left open on an older copy (owner, Nov 23).
 *
 * The block editor never refreshes itself. When Core delivers a new version of a page that
 * someone has open, the editor would otherwise keep the old text and a Save would put it back.
 * The editor remembers which Core version it loaded; WordPress's own "taken over" message
 * appears on the next heartbeat once Core has delivered a newer one, and a save from the
 * older copy is refused. Operator edits to the current version are unaffected.
 */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Delivery_Editor_Guard
{
    public const HEADER = 'X-MioPages-Delivery';
    public const NAME = 'MioPages Core';

    public static function register(string $installation): void
    {
        add_action('enqueue_block_editor_assets', static fn() => self::enqueue($installation));
        add_filter('heartbeat_received', static fn($response, $data) => self::heartbeat($installation, $response, $data), 20, 2);
        add_filter('rest_pre_dispatch', static fn($result, $server, $request) => self::guard($installation, $result, $request), 10, 3);
    }

    /** Core's current version of one delivered page, or null when Core does not manage it. */
    public static function version(string $installation, int $postId): ?string
    {
        global $wpdb;
        $key = 'miopages_native_draft_' . hash('sha256', $installation);
        $raw = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name=%s", $key));
        if (!is_string($raw)) return null;
        try {
            $current = json_decode($raw, true, 48, JSON_THROW_ON_ERROR)['current'] ?? null;
        } catch (JsonException) {
            return null;
        }
        foreach (is_array($current['posts'] ?? null) ? $current['posts'] : [] as $post) {
            if (($post['ID'] ?? null) === $postId && is_string($post['post_content'] ?? null) && is_string($post['post_title'] ?? null)) {
                return hash('sha256', $post['post_title'] . "\0" . $post['post_content']);
            }
        }
        return null;
    }

    private static function enqueue(string $installation): void
    {
        $post = get_post();
        if (!$post instanceof WP_Post || $post->post_type !== 'page' || !current_user_can('edit_post', $post->ID)) return;
        $version = self::version($installation, $post->ID);
        if ($version === null) return;
        wp_register_script('miopages-delivery-editor-guard', false, ['wp-api-fetch', 'heartbeat', 'jquery'], '0.1.4', true);
        wp_enqueue_script('miopages-delivery-editor-guard');
        wp_add_inline_script('miopages-delivery-editor-guard', self::script($post->ID, $version));
    }

    /** The editor reports the version it loaded on every heartbeat and with every save. */
    public static function script(int $postId, string $version): string
    {
        $config = wp_json_encode(['post' => $postId, 'version' => $version, 'header' => self::HEADER]);
        return <<<JS
(function (config) {
  var page = new RegExp('^/wp/v2/pages/' + config.post + '(/autosaves)?(\\\\?|$)');
  wp.apiFetch.use(function (options, next) {
    var method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET' && typeof options.path === 'string' && page.test(options.path)) {
      options = Object.assign({}, options, { headers: Object.assign({}, options.headers, { [config.header]: config.version }) });
    }
    return next(options);
  });
  jQuery(document).on('heartbeat-send', function (event, data) {
    data['miopages-delivery'] = { post: config.post, version: config.version };
  });
})({$config});
JS;
    }

    /** A newer Core delivery shows WordPress's own "taken over" message in the open editor. */
    public static function heartbeat(string $installation, $response, $data)
    {
        $seen = is_array($data) ? ($data['miopages-delivery'] ?? null) : null;
        if (!is_array($response) || !is_array($seen)) return $response;
        $postId = absint($seen['post'] ?? 0);
        if ($postId < 1 || !current_user_can('edit_post', $postId)) return $response;
        $current = self::version($installation, $postId);
        if ($current === null || hash_equals($current, (string) ($seen['version'] ?? ''))) return $response;
        $response['wp-refresh-post-lock'] = ['lock_error' => ['name' => self::NAME,
            'text' => sprintf(__('%s has taken over and is currently editing.'), self::NAME)]];
        $response['miopages-delivery'] = ['changed' => true];
        return $response;
    }

    /** Refuse a save made from an older copy of a page Core has since delivered again. */
    public static function guard(string $installation, $result, $request)
    {
        if ($result !== null || !$request instanceof WP_REST_Request ||
            !in_array($request->get_method(), ['POST', 'PUT', 'PATCH'], true) ||
            !preg_match('#^/wp/v2/pages/(\d+)(/autosaves)?$#D', $request->get_route(), $match)) return $result;
        $seen = $request->get_header(self::HEADER);
        if ($seen === null || $seen === '') return $result;
        $postId = (int) $match[1];
        $current = self::version($installation, $postId);
        if ($current === null || hash_equals($current, $seen)) return $result;
        // An autosave by someone other than the page's author is kept apart as an autosave
        // revision, so unsaved work is preserved without touching Core's delivery.
        $post = get_post($postId);
        if (($match[2] ?? '') !== '' && $post instanceof WP_Post && (int) $post->post_author !== get_current_user_id()) return $result;
        return new WP_Error('miopages_delivery_changed',
            'MioPages Core has delivered a newer version of this page since you opened it, so this save was not made. '
            . 'Copy any unsaved text you want to keep, then reload the editor to see the new version.', ['status' => 409]);
    }
}
