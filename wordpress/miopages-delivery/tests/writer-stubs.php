<?php
/** Stand-in WordPress for writer tests: post storage, revisions, options and locking. */
declare(strict_types=1);
require __DIR__ . '/native-draft-content.php';
if (!function_exists('esc_attr')) {
    function esc_attr(string $value): string { return esc_html($value); }
}
define('WP_CLI', true);
define('DB_NAME', 'test');
define('ARRAY_A', 'array');
require dirname(__DIR__) . '/includes/class-miopages-native-draft-writer.php';

final class DraftTestDatabase
{
    public string $posts = 'posts';
    public string $postmeta = 'postmeta';
    public string $options = 'options';
    public string $last_error = '';
    public array $pages = [];
    public array $history = [];
    public array $attachmentMeta = [];
    public ?array $state = null;
    private array $before;

    public function prepare(string $sql, ...$args): array { return [$sql, $args]; }
    public function get_col(array $query): array { return ['InnoDB', 'InnoDB', 'InnoDB']; }
    public function get_var(array $query): string
    {
        return str_contains($query[0], 'SELECT option_value') ? json_encode($this->state, JSON_THROW_ON_ERROR) : '1';
    }
    public function query(string $sql): int
    {
        if ($sql === 'START TRANSACTION') {
            $this->before = [$this->pages, $this->history, $this->state, $this->attachmentMeta];
        } elseif ($sql === 'ROLLBACK') {
            [$this->pages, $this->history, $this->state, $this->attachmentMeta] = $this->before;
        }
        return 1;
    }
    public function get_row(array $query, string $format): ?array
    {
        [$sql, $args] = $query;
        check(str_contains($sql, 'FOR UPDATE'), 'Verified rows must be locked.');
        if (str_contains($sql, 'option_value')) {
            return $this->state === null ? null : ['option_value' => json_encode($this->state, JSON_THROW_ON_ERROR)];
        }
        $row = $this->pages[$args[0]] ?? null;
        // Only the columns the writer's query selects, as real WordPress returns them.
        return $row === null ? null : array_intersect_key($row, array_flip(['post_type', 'post_status', 'post_title', 'post_content', 'post_name']));
    }
    public function insert(string $table, array $fields): int { return $this->update($table, $fields, []); }
    public function update(string $table, array $fields, array $where): int
    {
        $this->state = json_decode($fields['option_value'], true, 48, JSON_THROW_ON_ERROR);
        return 1;
    }
}

function current_user_can(string $permission, int $id = 0): bool
{
    global $denyDraftImages;
    return in_array($permission, ['edit_pages', 'upload_files'], true) || ($permission === 'edit_post' && $id > 0 && !$denyDraftImages);
}
$denyDraftImages = false;
function wp_insert_attachment(array $post, string|false $file, int $parent, bool $error, bool $hooks): int
{
    check(is_string($file) && str_starts_with($file, MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY . '/'), 'Media must map to a protected attachment file.');
    $id = wp_insert_post($post + ['post_type' => 'attachment', 'post_parent' => $parent]);
    update_post_meta($id, '_wp_attached_file', $file);
    return $id;
}
function update_post_meta(int $id, string $key, mixed $value): bool
{
    global $wpdb;
    $wpdb->attachmentMeta[$id][$key] = $value;
    return true;
}
function get_post_meta(int $id, string $key, bool $single): mixed
{
    global $wpdb;
    return $wpdb->attachmentMeta[$id][$key] ?? '';
}
function wp_slash(mixed $post): mixed { return $post; }
function get_attached_file(int $id, bool $unfiltered): string { return get_post_meta($id, '_wp_attached_file', true); }
function wp_update_attachment_metadata(int $id, array $metadata): bool { return update_post_meta($id, '_wp_attachment_metadata', $metadata); }
function wp_get_attachment_metadata(int $id, bool $unfiltered): array { return get_post_meta($id, '_wp_attachment_metadata', true); }
function is_wp_error(mixed $value): bool { return false; }
function clean_post_cache(int $id): void {}
function sanitize_title(string $title): string { return $title; }
function wp_unique_post_slug(string $slug, ...$args): string { return $slug; }
function wp_insert_post(array $post, ...$args): int
{
    global $wpdb;
    $id = $post['ID'] ?? count($wpdb->pages) + 13;
    $wpdb->pages[$id] = ['ID' => $id, ...$post, 'post_name' => $post['post_name'] ?? ''];
    return $id;
}
function get_post(int $id): ?object
{
    global $wpdb;
    return isset($wpdb->pages[$id]) ? (object) $wpdb->pages[$id] : ($wpdb->history[$id] ?? null);
}
function wp_revisions_enabled(object $post): bool { return true; }
function wp_get_post_revisions(int $id): array
{
    global $wpdb;
    return array_reverse(array_filter($wpdb->history, static fn($post) => $post->post_parent === $id), true);
}
function wp_is_post_autosave(object $post): bool { return false; }
function wp_is_post_revision(object $post): int { return $post->post_parent; }
function add_filter(string $name, string $callback): void {}
function remove_filter(string $name, string $callback): void {}
function wp_save_post_revision(int $id): int
{
    global $wpdb;
    $revision = get_post($id);
    $revision->post_parent = $id;
    $revisionId = count($wpdb->history) + 100;
    $wpdb->history[$revisionId] = $revision;
    return $revisionId;
}

// WordPress functions the draft menu uses (MioPages_Native_Draft_Writer::navigation).
if (!function_exists('wp_json_encode')) { function wp_json_encode(mixed $value): string|false { return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); } }
if (!function_exists('update_option')) { function update_option(string $key, mixed $value, mixed $autoload = null): bool { $GLOBALS['harness_options'][$key] = $value; return true; } }
if (!function_exists('get_post_type')) { function get_post_type(int $id): string|false { return get_post($id)->post_type ?? false; } }
if (!function_exists('wp_update_post')) { function wp_update_post(array $post, ...$args): int { global $wpdb; $wpdb->pages[$post['ID']] = [...($wpdb->pages[$post['ID']] ?? []), ...$post]; return $post['ID']; } }

// WordPress's own block parser (from a local WordPress copy), and the cleaning functions, for Core-rendered pages.
if (!function_exists('parse_blocks')) {
    $wpIncludes = getenv('WORDPRESS_SOURCE') ? rtrim((string) getenv('WORDPRESS_SOURCE'), '/') . '/wp-includes' : dirname(__DIR__, 4) . '/p022-wp-validation/wordpress/wp-includes';
    foreach (['class-wp-block-parser-block.php', 'class-wp-block-parser-frame.php', 'class-wp-block-parser.php'] as $file) require_once $wpIncludes . '/' . $file;
    function parse_blocks(string $content): array { return array_map(static fn($block) => (array) $block + ['innerBlocks' => []], (new WP_Block_Parser())->parse($content)); }
}
if (!function_exists('esc_url')) { function esc_url(string $url): string { return str_replace('&', '&#038;', htmlspecialchars($url, ENT_QUOTES)); } }
// The harness has no kses; WordPress's real wp_kses_post cleans the markup on a live site.
if (!function_exists('wp_kses_post')) { function wp_kses_post(string $content): string { return $content; } }
