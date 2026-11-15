<?php
/** Offline cross-runtime contract, no WordPress or provider operations. */
declare(strict_types=1);
ob_start();
require __DIR__ . '/native-draft-writer.php';
ob_end_clean();
require dirname(__DIR__) . '/includes/class-miopages-native-draft-receipt.php';

function admin_url(string $value): string
{
    return 'https://development.example.test/wp-admin/' . $value;
}

function esc_attr(string $value): string
{
    return esc_html($value);
}

$proof = json_decode(stream_get_contents(STDIN), true, 60, JSON_THROW_ON_ERROR);
$payload = MioPages_Native_Draft_Envelope::verify(json_encode($proof['envelope'], JSON_THROW_ON_ERROR), $proof['identity']);
$candidate = $payload['candidate'];
[$image] = $candidate['media'];
$bytes = base64_decode($proof['bytes'], true);
MioPages_Native_Draft_Media::verifyBytes($image, $bytes);
refuses(static fn() => MioPages_Native_Draft_Media::verifyBytes($image, $bytes . 'changed'));
$wrong = $candidate;
$wrong['media'][0]['sectionId'] = '00000000-0000-4000-8000-000000000000';
refuses(static fn() => MioPages_Native_Draft_Media::validate($wrong));

$attachments = [$image['sectionId'] => ['id' => 44, 'postId' => 21, 'media' => $image]];
$posts = MioPages_Native_Draft_Content::posts($candidate, ['/' => 21, '/service' => 22], $attachments);
check(str_contains($posts['/']['post_content'], 'miopages_native_draft_image&amp;attachment=44'), 'Private image source missing.');
check(str_contains($posts['/']['post_content'], 'alt="' . esc_attr($image['alt']) . '"'), 'Reviewed alt missing.');
check(!str_contains($posts['/service']['post_content'], 'miopages_native_draft_image'), 'Media leaked to another page.');
check(!str_contains($posts['/']['post_content'], 'data:image'), 'Image bytes were embedded in content.');
$result = ['operation' => 'apply', 'installationId' => $candidate['installationId'], 'requestedDigest' => $payload['digest'],
    'applied' => ['siteProposalId' => $candidate['siteProposalId'], 'digest' => $payload['digest'],
        'revision' => $candidate['revision'], 'posts' => $posts, 'attachments' => $attachments]];
$posix = DIRECTORY_SEPARATOR === '/' && function_exists('posix_geteuid');
if ($posix) {
    $wpdb = new DraftTestDatabase();
    $root = realpath(sys_get_temp_dir()) . '/miopages-native-image-' . bin2hex(random_bytes(12));
    mkdir($root, 0700);
    define('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY', $root);
    define('MIOPAGES_PRIVATE_PULL', ['documentRoot' => ABSPATH]);
    $file = $root . '/' . $image['copyDigest'] . '.webp';
    try {
        file_put_contents($file, $bytes);
        chmod($file, 0600);
        $run = static fn(string $key) => MioPages_Native_Draft_Writer::apply(
            json_encode($proof[$key], JSON_THROW_ON_ERROR), $proof['identity']
        );
        $base = $run('baseline');
        $result = $run('envelope');
        $attachment = $result['applied']['attachments'][$image['sectionId']];
        check($result === $run('envelope'), 'Media retry changed the application.');
        check(array_column($base['applied']['posts'], 'ID') === array_column($result['applied']['posts'], 'ID'), 'Media changed Page identity.');
        check(MioPages_Native_Draft_Media::previewBytes($candidate['installationId'], $attachment['id']) === $bytes, 'Exact copy only.');
        $denyDraftImages = true;
        try {
            MioPages_Native_Draft_Media::previewBytes($candidate['installationId'], $attachment['id']);
            throw new LogicException('Unapproved reader accessed draft image.');
        } catch (RuntimeException $error) {
            check($error->getMessage() === 'Private draft image unavailable.', 'Wrong boundary refused the image.');
        } finally {
            $denyDraftImages = false;
        }
        chmod($file, 0644);
        try {
            $run('envelope');
            throw new LogicException('Readable file was accepted.');
        } catch (RuntimeException $error) {
            check($error->getMessage() === 'Private draft media file refused.', 'Wrong boundary refused changed permissions.');
        }
        chmod($file, 0600);
        $restore = $run('restore');
        check($restore['applied'] === $base['applied'] && $wpdb->state['highWaterRevision'] === 2, 'Media rollback did not restore the full prior draft.');
        check($restore === $run('restore'), 'Media restore retry was not exact.');
        try {
            MioPages_Native_Draft_Media::previewBytes($candidate['installationId'], $attachment['id']);
            throw new LogicException('Restored site leaked the superseded draft image.');
        } catch (RuntimeException $error) {
            check($error->getMessage() === 'Private draft image unavailable.', 'Wrong boundary refused the archived image.');
        }
    } finally {
        unlink($file);
        rmdir($root);
    }
}
echo json_encode(['wire' => MioPages_Native_Draft_Receipt::create($result, hex2bin($proof['secret'])), 'posix' => $posix], JSON_THROW_ON_ERROR);
