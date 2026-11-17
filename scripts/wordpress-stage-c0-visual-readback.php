<?php
/** Verify the exact approved C0 native readback in the existing private installation. */
declare(strict_types=1);

function check(bool $ok): void {
    if (!$ok) {
        fwrite(STDERR, "BLOCKED: exact C0 staged readback differs.\n");
        exit(1);
    }
}

check(defined('WP_CLI') && WP_CLI && home_url() === 'https://miopages.org'
    && current_user_can('edit_pages'));
$installation = 'd84ebc69-46d5-4c64-adc6-ac7b87468f89';
check(MIOPAGES_NATIVE_DRAFT_IDENTITY['installationId'] === $installation);
$operation = $args[0] ?? null;
check(in_array($operation, ['verify-apply', 'verify-rollback', 'verify-restored'], true));
$state = get_option('miopages_native_draft_' . hash('sha256', $installation));
if (is_string($state)) {
    $state = json_decode($state, true, 48, JSON_THROW_ON_ERROR);
}
check(is_array($state) && $state['highWaterRevision'] === 6);
$before = json_decode(file_get_contents(__DIR__ . '/baseline-site.json'), true, 48, JSON_THROW_ON_ERROR)['state'];
if (is_string($before)) {
    $before = json_decode($before, true, 48, JSON_THROW_ON_ERROR);
}
$baselines = $before['current']['posts'];
$verifyPost = static function (array $row): void {
    $post = get_post($row['ID']);
    check($post !== null && $post->post_type === 'page' && $post->post_status === 'draft'
        && $post->post_name === $row['post_name'] && $post->post_title === $row['post_title']
        && $post->post_content === $row['post_content']);
};

if ($operation === 'verify-restored') {
    check($state['current'] === $before['current'] && $state['previous'] === null);
    foreach ($baselines as $post) {
        $verifyPost($post);
    }
    echo wp_json_encode(['status' => 'PASS', 'revision' => 3, 'highWater' => 6]), PHP_EOL;
    exit;
}

$wire = json_decode(file_get_contents(__DIR__ . '/apply.json'), true, 48, JSON_THROW_ON_ERROR);
$issued = json_decode(base64_decode($wire['envelope']['payloadBase64'], true), true, 48, JSON_THROW_ON_ERROR)['issuedAt'];
// Historical verification for readback only. The write command checks current time.
$envelope = MioPages_Native_Draft_Envelope::verify(wp_json_encode($wire['envelope']), MIOPAGES_NATIVE_DRAFT_IDENTITY, $issued);
$candidate = $envelope['candidate'];
$current = $state['current'];
check($current['revision'] === 6 && $current['digest'] === $envelope['digest'] && $state['previous'] === $before['current']);
check(($state['archive']['/service']['post'] ?? null) === $baselines['/service']);
$verifyPost($baselines['/service']);

if ($operation === 'verify-rollback') {
    $restore = MioPages_Native_Draft_Envelope::verify(file_get_contents(__DIR__ . '/rollback-check.json'), MIOPAGES_NATIVE_DRAFT_IDENTITY);
    check($restore['operation'] === 'restore' && $restore['digest'] === $envelope['digest'] && $restore['candidate'] === $candidate);
    check($candidate['rollback']['revision'] === 3 && $candidate['rollback']['digest'] === $before['current']['digest']);
    echo wp_json_encode(['status' => 'PASS', 'restorableRevision' => 3, 'verifiedCurrentRevision' => 6]), PHP_EOL;
    exit;
}

$ids = array_map(static fn($post) => $post['ID'], $current['posts']);
check(count($ids) === 13 && $ids['/'] === 13 && count($current['attachments']) === 2);
$expected = MioPages_Native_Draft_Content::posts($candidate, $ids, $current['attachments']);
$paths = [];
foreach ($expected as $path => $post) {
    $actual = $current['posts'][$path];
    check($post['ID'] === $actual['ID'] && $post['post_content'] === $actual['post_content']
        && $post['post_title'] === $actual['post_title']);
    $verifyPost($actual);
    $html = do_blocks(get_post($actual['ID'])->post_content);
    check(str_contains($html, 'class="miopages-draft-nav"') && substr_count($html, '<h1>') === 1 && !str_contains($html, '<form'));
    $paths[] = ['path' => $path, 'id' => $actual['ID']];
}
foreach ($current['attachments'] as $item) {
    $media = $item['media'];
    check(hash('sha256', MioPages_Native_Draft_Media::previewBytes($installation, $item['id'])) === $media['copyDigest']);
    check(get_post_mime_type($item['id']) === 'image/webp');
}
echo wp_json_encode(['status' => 'PASS', 'revision' => 6, 'pages' => $paths, 'images' => 2,
    'actions' => count($candidate['actions']), 'digest' => $current['digest']]), PHP_EOL;
