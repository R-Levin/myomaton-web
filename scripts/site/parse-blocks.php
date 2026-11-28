<?php
// Parse block markup from stdin with WordPress's own parser and print the block tree as JSON.
// Usage: php scripts/site/parse-blocks.php <wordpress-dir> < page.html
declare(strict_types=1);
$wp = rtrim($argv[1] ?? '', '/\\');
foreach (['class-wp-block-parser-block.php', 'class-wp-block-parser-frame.php', 'class-wp-block-parser.php'] as $file) {
    if (is_file("$wp/wp-includes/$file")) require_once "$wp/wp-includes/$file";
}
$tree = (new WP_Block_Parser())->parse(stream_get_contents(STDIN));
$walk = static function (array $blocks) use (&$walk): array {
    $out = [];
    foreach ($blocks as $b) {
        $b = (array) $b;
        if ($b['blockName'] === null && trim((string) $b['innerHTML']) === '') continue;
        $out[] = ['name' => $b['blockName'], 'attrs' => $b['attrs'], 'html' => $b['innerHTML'], 'inner' => $walk($b['innerBlocks'])];
    }
    return $out;
};
echo json_encode($walk($tree), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
