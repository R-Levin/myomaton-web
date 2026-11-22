<?php
/** Applies a Core-signed package from stdin with the stand-in WordPress; prints the drafts as JSON. */
declare(strict_types=1);
ob_start();
require __DIR__ . '/writer-stubs.php';
ob_end_clean();
function get_user_by(string $field, string $value): ?object { return $value === 'core-delivery' ? (object) ['ID' => 7] : null; }
function wp_set_current_user(int $id): void {}
try {
    $input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
    $wpdb = new DraftTestDatabase();
    $out = [];
    if (($input['mode'] ?? 'writer') === 'endpoint') {
        // Core's web endpoint, exactly as the REST route calls it.
        require_once dirname(__DIR__) . '/includes/class-miopages-delivery-endpoint.php';
        foreach ($input['wires'] as $wire) {
            [$status, $body] = MioPages_Delivery_Endpoint::draft($wire, $input['identity'], $input['pull'] ?? null);
            $out[] = ['status' => $status, 'body' => $body];
        }
        echo json_encode(['status' => 'PASS', 'responses' => $out], JSON_THROW_ON_ERROR);
        exit(0);
    }
    foreach ($input['wires'] as $wire) {
        $result = MioPages_Native_Draft_Writer::apply($wire, $input['identity']);
        $out[] = ['revision' => $result['applied']['revision'], 'brand' => isset($result['applied']['brand']),
            'posts' => array_map(static fn($post) => $post['post_content'], $result['applied']['posts'])];
    }
    echo json_encode(['status' => 'PASS', 'applied' => $out], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    fwrite(STDERR, get_class($error) . ': ' . $error->getMessage());
    exit(1);
}
