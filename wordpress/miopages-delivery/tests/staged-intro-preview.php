<?php
/** CLI fixture preview only. The caller must first recheck Core delivery eligibility. */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
define('ABSPATH', __DIR__ . '/');
class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}
require dirname(__DIR__) . '/includes/class-miopages-filesystem-probe.php';
require dirname(__DIR__) . '/includes/class-miopages-release-validator.php';

try {
    $pins = json_decode(stream_get_contents(STDIN, 8192), true, 16, JSON_THROW_ON_ERROR);
    $root = $pins['directory'];
    $digest = $pins['digest'];
    if (!MioPages_Filesystem_Probe::safeDirectory($root, $pins['webroot'], $pins['webroot'])
        || !preg_match('/^[0-9a-f]{64}$/D', $digest)) {
        throw new RuntimeException('Invalid stage configuration');
    }
    $root = realpath($root);
    if ($root === false) {
        throw new RuntimeException('Missing stage directory');
    }
    $active = $root . DIRECTORY_SEPARATOR . 'active.json';
    $objects = $root . DIRECTORY_SEPARATOR . 'objects';
    $file = $objects . DIRECTORY_SEPARATOR . $digest . '.json';
    if (file_exists($active) || is_link($active) || is_link($objects) || realpath($file) !== $file || !is_file($file)) {
        throw new RuntimeException('Unexpected stage');
    }
    $bytes = @file_get_contents($file, false, null, 0, 1048577);
    if (!is_string($bytes) || !hash_equals($digest, hash('sha256', $bytes))) {
        throw new RuntimeException('Stage digest mismatch');
    }
    $payload = MioPages_Release_Validator::validate($bytes, $pins['identity'], ['sequence' => 0, 'releaseId' => null]);
    if ($payload instanceof WP_Error || $payload['releaseId'] !== $pins['releaseId']
        || $payload['approval']['approvalId'] !== $pins['approvalId'] || count($payload['pages']) !== 1) {
        throw new RuntimeException('Stage identity or approval mismatch');
    }
    $page = $payload['pages'][0];
    $expectedPath = $pins['path'] ?? '/service';
    if (!in_array($expectedPath, ['/', '/service'], true) || $page['path'] !== $expectedPath
        || count($page['sections']) !== 1 || $page['sections'][0]['type'] !== 'intro') {
        throw new RuntimeException('Unexpected Intro shape');
    }
    $section = $page['sections'][0];
    $escape = static fn(string $text): string => htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    echo json_encode([
        'objectSha256' => $digest,
        'pageId' => $page['id'],
        'sectionId' => $section['id'],
        'html' => '<article aria-label="Private staged Intro"><p>' . $escape($page['title']) . ' · ' . $escape($expectedPath) . '</p>'
            . '<h3>' . $escape($section['content']['heading']) . '</h3>'
            . '<p>' . nl2br($escape($section['content']['text']), false) . '</p></article>',
    ], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    // Input may contain protected local paths. Keep diagnostics bounded.
    fwrite(STDERR, "Private staged Intro refused.\n");
    exit(1);
}
