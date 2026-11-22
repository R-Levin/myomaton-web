<?php
declare(strict_types=1);
require __DIR__ . '/writer-stubs.php';

$wpdb = new DraftTestDatabase();
$scope = ['organizationId' => 'org', 'webPresenceId' => 'presence', 'managedSiteId' => 'site'];
$candidate += ['scope' => $scope, 'installationId' => 'installation', 'siteProposalId' => 'proposal'];
$candidate['pages'][0]['id'] = 'core-home';
$candidate['pages'][1]['id'] = 'core-service';
$keys = sodium_crypto_sign_keypair();
$identity = $scope + ['installationId' => 'installation', 'keyId' => 'key',
    'publicKeyBase64' => base64_encode(sodium_crypto_sign_publickey($keys))];
$apply = static function (array $body, int $number, ?string $prior, string $operation = 'apply') use ($keys, $identity): array {
    $now = time();
    $version = isset($body['brand']) ? 5 : (isset($body['rollback']) ? 2 : 1);
    $payload = json_encode(['schema' => 'miopages.wordpress.native-draft', 'version' => $version,
        'purpose' => 'non-public-draft-only', 'operation' => $operation, 'issuedAt' => $now,
        'expiresAt' => $now + 900, 'digest' => hash('sha256', (string) $number),
        'candidate' => $body + ['revision' => $number, 'previousDigest' => $prior]], JSON_THROW_ON_ERROR);
    $wire = json_encode(['schema' => 'miopages.wordpress.native-draft-envelope', 'version' => $version,
        'keyId' => 'key', 'payloadBase64' => base64_encode($payload), 'payloadSha256' => hash('sha256', $payload),
        'signatureBase64' => base64_encode(sodium_crypto_sign_detached("MioPages-WP-Native-Draft-v{$version}\n" . $payload,
            sodium_crypto_sign_secretkey($keys)))], JSON_THROW_ON_ERROR);
    return MioPages_Native_Draft_Writer::apply($wire, $identity)['applied'];
};
$digest1 = hash('sha256', '1');
$digest2 = hash('sha256', '2');
$digest3 = hash('sha256', '3');

// Model the hosted restored legacy pointer and the two retired Pages.
$legacy = MioPages_Native_Draft_Content::posts($candidate, ['/' => 13, '/service' => 14]);
foreach ($legacy as $post) { wp_insert_post($post); }
foreach (MioPages_Native_Draft_Content::posts($candidate, ['/' => 15, '/service' => 16]) as $post) { wp_insert_post($post); }
$wpdb->state = ['current' => ['siteProposalId' => 'proposal', 'revision' => 1, 'digest' => $digest1, 'posts' => $legacy],
    'previous' => null, 'restoredFrom' => $digest2, 'highWaterRevision' => 2];
$historical = array_slice($wpdb->pages, 2, null, true);
$baseline = $apply($candidate, 3, $digest2);
check($baseline['posts']['/']['post_name'] === 'home-miopages-13', 'Legacy Home gets a stable slug.');
check($baseline['posts']['/service']['post_name'] === 'service-miopages-14', 'Legacy Service gets a stable slug.');

$replaced = $candidate;
$replaced['pages'][1]['id'] = 'other-core-page';
try {
    $apply($replaced, 4, $digest3);
    throw new LogicException('A different logical Page reused the Service ID.');
} catch (RuntimeException $error) {
    check($error->getMessage() === 'Native draft logical Page identity changed.', 'New logical identity must be refused.');
}
$changed = $candidate;
$changed['pages'][1]['sections'][0]['content']['text'] = 'Bring your current website address.';
$revision = $apply($changed, 4, $digest3);
check(array_column($revision['posts'], 'ID') === [13, 14] && count($wpdb->pages) === 4, 'No duplicate Pages.');
check($revision['posts']['/'] === $baseline['posts']['/'], 'Home retains the same navigation and Action.');
check($revision['posts']['/service']['post_name'] === $baseline['posts']['/service']['post_name'], 'Slug retained.');
check(count(wp_get_post_revisions(14)) === 2, 'Exact prior and updated content are inspectable.');
check($apply($changed, 4, $digest3) === $revision && count(wp_get_post_revisions(14)) === 2, 'Apply retry is idempotent.');

$wpdb->pages[14]['post_content'] .= ' Unreviewed edit.';
try {
    $apply($changed, 4, $digest3, 'restore');
    throw new LogicException('Unreviewed edit was overwritten.');
} catch (RuntimeException $error) {
    check($error->getMessage() === 'Native WordPress draft readback mismatch.', 'Restore must refuse drift.');
}
$wpdb->pages[14] = $revision['posts']['/service'];
check($apply($changed, 4, $digest3, 'restore') === $baseline, 'Rollback restores the prior exact content and identities.');
check($apply($changed, 4, $digest3, 'restore') === $baseline, 'Restore retry is idempotent.');
check(count(wp_get_post_revisions(14)) === 3, 'Restore preserves both versions.');
check(array_slice($wpdb->pages, 2, null, true) === $historical, 'Historical Pages are untouched.');
$digest4 = hash('sha256', '4');
$digest5 = hash('sha256', '5');
$forward = $candidate;
$forward['pages'][1]['sections'][0]['content']['text'] = 'Review the goal for your existing website.';
$before = [$wpdb->state, $wpdb->pages, $wpdb->history];
foreach ([
    [$forward, 5, $digest4, 'Native draft materialized rollback claim required.'],
    [$forward + ['rollback' => ['revision' => 3, 'digest' => $digest1]], 5, $digest4, 'Native draft materialized baseline mismatch.'],
    [$forward + ['rollback' => ['revision' => 3, 'digest' => $digest3]], 5, $digest2, 'Native draft predecessor mismatch.'],
    [$candidate, 3, $digest2, 'Native draft predecessor mismatch.'],
] as [$request, $number, $previous, $message]) {
    try {
        $apply($request, $number, $previous);
        throw new LogicException('Invalid forward operation accepted.');
    } catch (RuntimeException $error) {
        check($error->getMessage() === $message, 'Incorrect forward failure.');
    }
    check([$wpdb->state, $wpdb->pages, $wpdb->history] === $before, 'A refusal changed draft state.');
}
$forward['rollback'] = ['revision' => 3, 'digest' => $digest3];
$five = $apply($forward, 5, $digest4);
check(array_column($five['posts'], 'ID') === [13, 14] && $five['digest'] === $digest5, 'Revision 5 updates stable Pages.');
check($wpdb->state['previous'] === $baseline && $wpdb->state['highWaterRevision'] === 5, 'Materialized baseline retained separately.');
check($apply($forward, 5, $digest4) === $five, 'Forward apply retry returns the same drafts.');
check($apply($forward, 5, $digest4, 'restore') === $baseline, 'Revision 5 restores revision 3 byte for byte.');
check($apply($forward, 5, $digest4, 'restore') === $baseline, 'Forward restore retry is idempotent.');
check($wpdb->state['highWaterRevision'] === 5 && $wpdb->state['restoredFrom'] === $digest5, 'Restore preserves monotonic history.');
try {
    $apply($forward, 5, $digest4);
    throw new LogicException('Restored revision was reapplied.');
} catch (RuntimeException $error) {
    check($error->getMessage() === 'Native draft predecessor mismatch.', 'Reapplication after restore is stale.');
}
$forward['rollback'] = ['revision' => 3, 'digest' => $digest3];
check($apply($forward, 6, $digest5)['revision'] === 6, 'A later forward revision remains possible.');
check(array_slice($wpdb->pages, 2, null, true) === $historical, 'Historical Pages are untouched.');
echo "Native draft stable identity and rollback passed.\n";

class WP_Post
{
    public function __construct(public int $ID, public string $post_type, public string $post_status,
        public string $post_title, public string $post_name, public string $post_content) {}
}
$draftPreview = true;
function is_preview(): bool { return $GLOBALS['draftPreview']; }
$png = file_get_contents(dirname(__DIR__, 3) . '/brand/miopages/MioPagesDV.png');
$brand = [
    'digest' => hash('sha256', 'reviewed brand'),
    'projection' => ['version' => 1, 'scope' => ['webPresenceId' => $scope['webPresenceId'], 'managedSiteId' => $scope['managedSiteId']],
        'logo' => ['assetId' => 'f70e5831-843a-4e9f-a1d4-87f864160680', 'usageId' => '1ea3a399-8680-4303-a019-9e8026ab9f60',
            'sha256' => hash('sha256', $png), 'alt' => 'MioPages'],
        'design' => ['grammar' => 'service-led', 'version' => 3, 'motion' => 'off',
            'palette' => array_fill_keys(['light','strong','tonal','brand','supporting','contrast'],
                ['background' => '#ffffff', 'text' => '#000000']) + ['border' => '#000000', 'muted' => '#000000'],
            'typography' => ['bodyFont' => 'sans', 'headingFont' => 'sans', 'baseSize' => 18, 'headingScale' => 2.5, 'lineHeight' => 1.55]]],
    'pngBase64' => base64_encode($png),
];
$brand['digest'] = MioPages_Native_Draft_Brand::projectionDigest($brand['projection']);
$wpdb = new DraftTestDatabase();
$legacy = $apply($candidate, 1, null);
$branded = $apply($candidate + ['brand' => $brand], 2, $digest1);
check($branded['brand'] === $brand, 'The exact signed brand is part of the applied revision.');
$post = new WP_Post(...$branded['posts']['/']);
check(MioPages_Native_Draft_Brand::preview('installation', $scope, $post)['bytes'] === $png, 'Exact private brand reads from current draft.');
$draftPreview = false;
check(MioPages_Native_Draft_Brand::preview('installation', $scope, $post) === null, 'A public request cannot read the brand.');
$draftPreview = true;
$denyDraftImages = true;
check(MioPages_Native_Draft_Brand::preview('installation', $scope, $post) === null, 'An unprivileged request cannot read the brand.');
$denyDraftImages = false;
$post->post_content .= 'drift';
check(MioPages_Native_Draft_Brand::preview('installation', $scope, $post) === null, 'Edited draft cannot borrow signing authority.');
$post = new WP_Post(...$branded['posts']['/']);
$changedBrand = $brand;
$changedBrand['projection']['design']['motion'] = 'minimal';
$changedBrand['digest'] = MioPages_Native_Draft_Brand::projectionDigest($changedBrand['projection']);
$next = $apply($candidate + ['brand' => $changedBrand], 3, $digest2);
check($next['brand'] === $changedBrand, 'Successor applies its own reviewed brand.');
check($apply($candidate + ['brand' => $changedBrand], 3, $digest2, 'restore') === $branded, 'Restore reproduces the exact prior PNG and brand projection.');
check(MioPages_Native_Draft_Brand::preview('installation', $scope, $post)['projection'] === $brand['projection'], 'Rendered projection returns to the exact prior brand.');
$broken = $brand;
$broken['pngBase64'] = base64_encode('different bytes');
try {
    $apply($candidate + ['brand' => $broken, 'rollback' => ['revision' => 2, 'digest' => $digest2]], 4, $digest3);
    throw new LogicException('Wrong PNG accepted.');
} catch (InvalidArgumentException $error) {
    check($error->getMessage() === 'Native draft brand PNG refused.', 'Signed mismatch refused before state mutation.');
}
check($wpdb->state['current'] === $branded, 'Refusal leaves restored brand in place.');
$wpdb = new DraftTestDatabase();
$apply($candidate, 1, null);
$apply($candidate + ['brand' => $brand], 2, $digest1);
check($apply($candidate + ['brand' => $brand], 2, $digest1, 'restore') === $legacy, 'Roll back across envelope versions.');
check(MioPages_Native_Draft_Brand::preview('installation', $scope, $post) === null, 'Legacy rollback removes the brand binding.');
echo "Signed private brand apply, isolation, refusal and exact restoration passed.\n";
