<?php
/** Applies a Core-signed package from stdin with the stand-in WordPress; prints the drafts as JSON. */
declare(strict_types=1);
ob_start();
require __DIR__ . '/writer-stubs.php';
ob_end_clean();
try {
    $input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
    $wpdb = new DraftTestDatabase();
    $out = [];
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
