<?php
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');
function esc_html(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function esc_attr(string $value): string { return esc_html($value); }
function esc_url(string $value): string { return esc_html($value); }
function home_url(string $value): string { return 'http://127.0.0.1:4473' . $value; }
require dirname(__DIR__) . '/includes/class-miopages-native-component.php';
try {
    $value = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    if (isset($value['candidate'])) {
        require dirname(__DIR__) . '/includes/class-miopages-native-draft-content.php';
        echo MioPages_Native_Draft_Content::posts($value['candidate'], $value['postIds'], [], $value['localSemanticBlocks'] ?? true, $value['pendingActions'] ?? [])['/']['post_content'];
    } else echo MioPages_Native_Component::render($value, [], [], []);
} catch (Throwable $error) {
    fwrite(STDERR, "Native component refused.\n");
    exit(1);
}
