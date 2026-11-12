<?php
declare(strict_types=1);
require __DIR__ . '/native-draft-content.php';
define('WP_CLI', true);
define('DB_NAME', 'test');
define('ARRAY_A', 'array');
require dirname(__DIR__) . '/includes/class-miopages-native-draft-writer.php';

final class DraftTestDatabase
{
    public string $posts = 'posts';
    public string $postmeta = 'postmeta';
    public string $options = 'options';
    public string $last_error = '';
    public array $pages = [];
    public array $history = [];
    public ?array $state = null;
    private array $before;

    public function prepare(string $sql, ...$args): array { return [$sql, $args]; }
    public function get_col(array $query): array { return ['InnoDB', 'InnoDB', 'InnoDB']; }
    public function get_var(array $query): string { return '1'; }
    public function query(string $sql): int
    {
        if ($sql === 'START TRANSACTION') {
            $this->before = [$this->pages, $this->history, $this->state];
        } elseif ($sql === 'ROLLBACK') {
            [$this->pages, $this->history, $this->state] = $this->before;
        }
        return 1;
    }
    public function get_row(array $query, string $format): ?array
    {
        [$sql, $args] = $query;
        check(str_contains($sql, 'FOR UPDATE'), 'Verified rows must be locked.');
        if (str_contains($sql, 'option_value')) {
            return $this->state === null ? null : ['option_value' => json_encode($this->state, JSON_THROW_ON_ERROR)];
        }
        $row = $this->pages[$args[0]] ?? null;
        unset($row['ID']);
        return $row;
    }
    public function insert(string $table, array $fields): int { return $this->update($table, $fields, []); }
    public function update(string $table, array $fields, array $where): int
    {
        $this->state = json_decode($fields['option_value'], true, 48, JSON_THROW_ON_ERROR);
        return 1;
    }
}

function current_user_can(string $permission): bool { return $permission === 'edit_pages'; }
function wp_slash(array $post): array { return $post; }
function is_wp_error(mixed $value): bool { return false; }
function clean_post_cache(int $id): void {}
function sanitize_title(string $title): string { return $title; }
function wp_unique_post_slug(string $slug, ...$args): string { return $slug; }
function wp_insert_post(array $post, ...$args): int
{
    global $wpdb;
    $id = $post['ID'] ?? count($wpdb->pages) + 13;
    $wpdb->pages[$id] = ['ID' => $id, ...$post, 'post_name' => $post['post_name'] ?? ''];
    return $id;
}
function get_post(int $id): ?object
{
    global $wpdb;
    return isset($wpdb->pages[$id]) ? (object) $wpdb->pages[$id] : ($wpdb->history[$id] ?? null);
}
function wp_revisions_enabled(object $post): bool { return true; }
function wp_get_post_revisions(int $id): array
{
    global $wpdb;
    return array_reverse(array_filter($wpdb->history, static fn($post) => $post->post_parent === $id), true);
}
function wp_is_post_autosave(object $post): bool { return false; }
function wp_is_post_revision(object $post): int { return $post->post_parent; }
function add_filter(string $name, string $callback): void {}
function remove_filter(string $name, string $callback): void {}
function wp_save_post_revision(int $id): int
{
    global $wpdb;
    $revision = get_post($id);
    $revision->post_parent = $id;
    $revisionId = count($wpdb->history) + 100;
    $wpdb->history[$revisionId] = $revision;
    return $revisionId;
}

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
    $payload = json_encode(['schema' => 'miopages.wordpress.native-draft', 'version' => 1,
        'purpose' => 'non-public-draft-only', 'operation' => $operation, 'issuedAt' => $now,
        'expiresAt' => $now + 900, 'digest' => hash('sha256', (string) $number),
        'candidate' => $body + ['revision' => $number, 'previousDigest' => $prior]], JSON_THROW_ON_ERROR);
    $wire = json_encode(['schema' => 'miopages.wordpress.native-draft-envelope', 'version' => 1,
        'keyId' => 'key', 'payloadBase64' => base64_encode($payload), 'payloadSha256' => hash('sha256', $payload),
        'signatureBase64' => base64_encode(sodium_crypto_sign_detached("MioPages-WP-Native-Draft-v1\n" . $payload,
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
echo "Native draft stable identity and rollback passed.\n";
