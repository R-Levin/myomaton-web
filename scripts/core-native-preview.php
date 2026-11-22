<?php
/** Read-only Core preview adapter. Uses the identical native WordPress renderer. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || count($argv) !== 1) exit(1);
set_error_handler(static function (int $severity, string $message): never { throw new ErrorException($message, 0, $severity); });
define('ABSPATH', __DIR__ . '/');
function esc_html(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function esc_attr(string $value): string { return esc_html($value); }
function esc_url(string $value): string { return esc_html($value); }
function home_url(string $value): string { return $value; }
require __DIR__ . '/class-miopages-native-component.php';
require __DIR__ . '/class-miopages-native-draft-content.php';
require __DIR__ . '/layout-css.php';
try {
    $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    if (array_keys($input) !== ['candidate', 'unresolvedActions', 'path']) throw new RuntimeException('Preview fields refused.');
    $candidate = $input['candidate'];
    $paths = array_column($candidate['pages'], 'path');
    $ids = array_combine($paths, range(1, count($paths)));
    $posts = MioPages_Native_Draft_Content::posts($candidate, $ids, [], true, $input['unresolvedActions']);
    if (!isset($posts[$input['path']])) throw new RuntimeException('Preview page refused.');
    $content = $posts[$input['path']]['post_content'];
    // The theme adds these column rules in WordPress; the preview carries them with the page.
    $layout = miopages_layout_css($content);
    echo ($layout !== '' ? '<style>' . $layout . '</style>' : '') . $content;
} catch (Throwable $error) {
    fwrite(STDERR, 'Native preview validation failed.');
    exit(2);
}
