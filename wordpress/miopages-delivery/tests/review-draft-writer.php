<?php
/**
 * Test harness: the plugin's real writer, web endpoint and read-back code on a stand-in
 * WordPress. Input JSON on stdin; prints JSON. With "store", the stand-in site persists
 * between calls, so a sequence behaves like one real site.
 *
 * Modes: writer (default) applies "wires" directly; endpoint posts "wires" through the
 * draft endpoint; readback answers the signed "request"; operator simulates the
 * Operator's "edits" ({path: [from, to]}) and "notes" ([{id, path, parent?, text, status?}]).
 */
declare(strict_types=1);
ob_start();
require __DIR__ . '/writer-stubs.php';
ob_end_clean();
function get_user_by(string $field, string $value): ?object { return $value === 'core-delivery' ? (object) ['ID' => 7] : null; }
function wp_set_current_user(int $id): void {}
function get_option(string $key): mixed { global $wpdb; return $wpdb->state === null ? false : json_encode($wpdb->state); }
function get_comments(array $args): array { return array_values(array_filter($GLOBALS['testNotes'] ?? [],
    static fn($note) => in_array($note->comment_post_ID, $args['post__in'], true))); }
function get_comment_meta(int $id, string $key, bool $single): string {
    foreach ($GLOBALS['testNotes'] ?? [] as $note) if ($note->comment_ID === $id) return $note->status;
    return ''; }

function harness_finish(?string $store, array $result): never
{
    global $wpdb;
    foreach ($wpdb->pages as $id => $page) $wpdb->pages[$id]['post_modified_gmt'] ??= '2026-11-22 19:00:00';
    if ($store !== null) {
        file_put_contents($store, serialize(['pages' => $wpdb->pages, 'history' => $wpdb->history, 'state' => $wpdb->state,
            'attachmentMeta' => $wpdb->attachmentMeta, 'notes' => $GLOBALS['testNotes'] ?? []]));
    }
    echo json_encode(['status' => 'PASS'] + $result, JSON_THROW_ON_ERROR);
    exit(0);
}

try {
    $input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
    $wpdb = new DraftTestDatabase();
    $store = $input['store'] ?? null;
    if ($store !== null && is_file($store)) {
        $saved = unserialize((string) file_get_contents($store));
        [$wpdb->pages, $wpdb->history, $wpdb->state, $wpdb->attachmentMeta] = [$saved['pages'], $saved['history'], $saved['state'], $saved['attachmentMeta']];
        $GLOBALS['testNotes'] = $saved['notes'];
    }
    foreach ($wpdb->pages as $id => $page) $wpdb->pages[$id]['post_modified_gmt'] ??= '2026-11-22 19:00:00';
    $mode = $input['mode'] ?? 'writer';
    $ids = static fn() => array_map(static fn($post) => $post['ID'], $wpdb->state['current']['posts'] ?? []);
    if ($mode === 'endpoint' || $mode === 'readback') {
        require_once dirname(__DIR__) . '/includes/class-miopages-delivery-endpoint.php';
    }
    if ($mode === 'endpoint') {
        $out = [];
        foreach ($input['wires'] as $wire) {
            [$status, $body] = MioPages_Delivery_Endpoint::draft($wire, $input['identity'], $input['pull'] ?? null);
            $out[] = ['status' => $status, 'body' => $body];
        }
        harness_finish($store, ['responses' => $out]);
    }
    if ($mode === 'operator' || $mode === 'readback') {
        foreach ($input['wires'] ?? [] as $wire) MioPages_Native_Draft_Writer::apply($wire, $input['identity']);
        // Real WordPress always records a modification time.
        foreach ($wpdb->pages as $id => $page) $wpdb->pages[$id]['post_modified_gmt'] ??= '2026-11-22 19:00:00';
        $map = $ids();
        foreach ($input['edits'] ?? [] as $path => [$from, $to]) {
            $wpdb->pages[$map[$path]]['post_content'] = str_replace($from, $to, $wpdb->pages[$map[$path]]['post_content']);
        }
        foreach ($input['notes'] ?? [] as $note) {
            $GLOBALS['testNotes'][] = (object) ['comment_ID' => $note['id'], 'comment_post_ID' => $map[$note['path']],
                'comment_parent' => $note['parent'] ?? 0, 'comment_author' => 'Owner', 'comment_content' => $note['text'],
                'comment_date_gmt' => '2026-11-22 20:00:00', 'status' => $note['status'] ?? ''];
        }
        if ($mode === 'operator') harness_finish($store, ['ids' => $map]);
        [$status, $body] = MioPages_Delivery_Readback::handle($input['request'], $input['identity'], $input['pull']);
        harness_finish($store, ['responses' => [['status' => $status, 'body' => $body]], 'ids' => $map]);
    }
    $out = [];
    foreach ($input['wires'] as $wire) {
        $result = MioPages_Native_Draft_Writer::apply($wire, $input['identity']);
        $out[] = ['revision' => $result['applied']['revision'], 'brand' => isset($result['applied']['brand']),
            'posts' => array_map(static fn($post) => $post['post_content'], $result['applied']['posts'])];
    }
    harness_finish($store, ['applied' => $out]);
} catch (Throwable $error) {
    fwrite(STDERR, get_class($error) . ': ' . $error->getMessage());
    exit(1);
}
