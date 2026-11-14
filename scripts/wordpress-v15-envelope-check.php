<?php
/** Read-only check that signed WordPress operations project the reviewed bytes. */
if (!defined('WP_CLI') || !WP_CLI || home_url() !== 'https://miopages.org' || !current_user_can('edit_pages')) {
    exit(1);
}
try {
    $operation = $args[0] ?? '';
    if (!in_array($operation, ['apply', 'retry', 'restore'], true) || !preg_match('/^[a-f0-9]{64}$/D', $args[1] ?? '')) {
        throw new RuntimeException();
    }
    $wire = file_get_contents(__DIR__ . '/envelope-' . $operation . '.json');
    $payload = MioPages_Native_Draft_Envelope::verify($wire, MIOPAGES_NATIVE_DRAFT_IDENTITY);
    $draft = $payload['candidate'];
    if ($payload['operation'] !== ($operation === 'restore' ? 'restore' : 'apply')
        || $payload['digest'] !== $args[1] || $draft['revision'] !== 5
        || $draft['installationId'] !== 'd84ebc69-46d5-4c64-adc6-ac7b87468f89'
        || $draft['siteProposalId'] !== '1e28f792-624d-4141-96db-45c4ba05e17d'
        || $draft['previousDigest'] !== '1a6343c049c0430e51ef7fa3780123c9475352af0328301d661a38a9b500eb2a'
        || $draft['rollback'] !== ['revision' => 3, 'digest' => '85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db']
        || $draft['navigation'] !== ['/', '/service'] || count($draft['actions']) !== 2) {
        throw new RuntimeException();
    }
    $posts = MioPages_Native_Draft_Content::posts($draft, ['/' => 13, '/service' => 14]);
    if (array_map(static fn($post) => hash('sha256', $post['post_content']), array_values($posts)) !== [
        '9a2a218c24ab25bd5f31c6122617f28786ea705a6db9d91d81f8d1bde2d2816b',
        'eb3c0a43811f6c6f882317ede97c8e8e0cdbfc8b6d4c513fef12a6b91ab75b5f'
    ]) {
        throw new RuntimeException();
    }
} catch (Throwable $error) {
    WP_CLI::error('Signed revision 5 scope or projected WordPress bytes failed verification.');
}
