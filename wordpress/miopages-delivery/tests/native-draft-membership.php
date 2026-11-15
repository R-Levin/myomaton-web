<?php
/** Signed membership, native file staging and rollback with an isolated WP API/DB harness. */
declare(strict_types=1);
ob_start();
require __DIR__ . '/native-draft-writer.php';
ob_end_clean();

function admin_url(string $path): string { return 'https://development.example.test/wp-admin/' . $path; }
function esc_attr(string $text): string { return esc_html($text); }
function refused(callable $attempt, string $reason): void
{
    try {
        $attempt();
    } catch (Throwable $error) {
        check(stripos($error->getMessage(), $reason) !== false, 'Unexpected refusal: ' . $error->getMessage());
        return;
    }
    throw new LogicException('Expected refusal: ' . $reason);
}

$proof = json_decode(stream_get_contents(STDIN), true, 60, JSON_THROW_ON_ERROR);
$identity = $proof['identity'];
$apply = static fn(string $key) => MioPages_Native_Draft_Writer::apply(json_encode($proof[$key], JSON_THROW_ON_ERROR), $identity);
refused(fn() => $apply('duplicate'), 'media placement refused');
$wpdb = new DraftTestDatabase();
$old = $apply('original')['applied'];
$before = $wpdb->state;
refused(fn() => $apply('invalidPrior'), 'Page membership baseline mismatch');
check($wpdb->state === $before, 'wrong prior identity changed state');

$posix = DIRECTORY_SEPARATOR === '/' && function_exists('posix_geteuid');
if ($posix) {
    $root = realpath(sys_get_temp_dir()) . '/miopages-wp-membership-' . bin2hex(random_bytes(12));
    mkdir($root, 0700);
    define('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY', $root);
    define('MIOPAGES_PRIVATE_PULL', ['documentRoot' => ABSPATH]);
    $stage = static fn(array $transfer) => MioPages_Native_Draft_Media::stage(json_encode($transfer, JSON_THROW_ON_ERROR), $identity);
    $transfer = $proof['transfer'];
    $file = $root . '/' . $transfer['copyDigest'] . '.webp';
    $installation = $identity['installationId'];
    try {
        refused(fn() => $apply('apply'), 'private draft media file refused');
        check($wpdb->state === $before && count($wpdb->pages) === 3, 'failure left a Page or revision');
        refused(fn() => $stage(array_replace($transfer, ['envelope' => $proof['restore']])), 'lacks apply authority');
        refused(fn() => $stage(array_replace($transfer, ['bytesBase64' => base64_encode('modified')])), 'copy or shape changed');
        check($stage($transfer) === $transfer['copyDigest'] && $stage($transfer) === $transfer['copyDigest'], 'stage retry changed bytes');
        check((fileperms($file) & 0777) === 0600, 'private media mode differs');
        $result = $apply('apply')['applied'];
        check($result === $apply('apply')['applied'], 'apply retry changed a Page or attachment');
        check(array_keys($result['posts']) === ['/', '/new', '/service'], 'new membership or order differs');
        check($result['posts']['/']['ID'] === $old['posts']['/']['ID'] && $result['posts']['/service']['ID'] === $old['posts']['/service']['ID'], 'shared Pages changed identity');
        check($result['posts']['/']['post_name'] === $old['posts']['/']['post_name'], 'shared slug changed');
        check(!str_contains($result['posts']['/']['post_content'], 'Previous information') &&
            str_contains($result['posts']['/']['post_content'], 'New Action'), 'navigation or Action still refers to old Page');
        check($wpdb->pages[$old['posts']['/old']['ID']] === $old['posts']['/old'], 'historical retired draft changed');
        check(substr_count($result['posts']['/']['post_content'], '<!-- wp:image') === 2, 'both Home placements must render');
        $attachments = array_values($result['attachments']);
        check(count($attachments) === 2 && $attachments[0]['id'] !== $attachments[1]['id'], 'distinct placements reused an attachment ID');
        foreach ($attachments as $item) {
            check(get_attached_file($item['id'], true) === $file, 'native attachment file mapping missing');
            check(MioPages_Native_Draft_Media::previewBytes($installation, $item['id']) === file_get_contents($file), 'native preview did not read the exact file');
        }
        $denyDraftImages = true;
        check(!MioPages_Native_Draft_Media::previewAllowed($installation, $attachments[0]['id']), 'unauthorized preview was exposed');
        $denyDraftImages = false;
        chmod($file, 0644);
        refused(fn() => $apply('apply'), 'Private draft media file refused');
        chmod($file, 0600);
        $oldId = $old['posts']['/old']['ID'];
        $wpdb->pages[$oldId]['post_content'] = 'unreviewed edit';
        refused(fn() => $apply('restore'), 'draft readback mismatch');
        check($wpdb->state['current'] === $result, 'failed rollback changed current state');
        $wpdb->pages[$oldId] = $old['posts']['/old'];
        check($apply('restore')['applied'] === $old && $apply('restore')['applied'] === $old, 'restore or exact retry failed');
        check($wpdb->state['highWaterRevision'] === 2, 'restore lowered revision high water');
        check(!MioPages_Native_Draft_Media::previewAllowed($installation, $attachments[0]['id']), 'superseded attachment still routable');
        refused(fn() => $apply('apply'), 'predecessor mismatch');
        $forward = $apply('forward')['applied'];
        check($forward['posts']['/new']['ID'] === $result['posts']['/new']['ID'], 'archived Page identity was lost on reactivation');
        check($forward['posts']['/new']['post_name'] === $result['posts']['/new']['post_name'], 'archived Page slug changed');
    } finally {
        if (is_file($file)) unlink($file);
        rmdir($root);
    }
}
echo json_encode(['verified' => true, 'posix' => $posix], JSON_THROW_ON_ERROR);
