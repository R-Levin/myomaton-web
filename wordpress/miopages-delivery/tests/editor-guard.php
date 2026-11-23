<?php
/** Editor guard: an editor left open on an older copy is told and cannot save over Core's delivery. */
declare(strict_types=1);
define('ABSPATH', __DIR__);
$GLOBALS['option'] = null; $GLOBALS['author'] = 7; $GLOBALS['user'] = 3;
final class StubDb { public string $options = 'wp_options';
    public function prepare(string $sql, ...$args): string { return $sql; }
    public function get_var(string $sql): ?string { return $GLOBALS['option']; } }
$wpdb = new StubDb();
final class WP_Post { public int $ID = 60; public string $post_type = 'page'; public int $post_author = 0; }
final class WP_Error { public function __construct(public string $code, public string $message, public array $data) {} }
final class WP_REST_Request { public function __construct(private string $method, private string $route, private ?string $header) {}
    public function get_method(): string { return $this->method; } public function get_route(): string { return $this->route; }
    public function get_header(string $name): ?string { return $this->header; } }
function current_user_can(string $cap, int $id = 0): bool { return true; }
function absint(mixed $v): int { return abs((int) $v); }
function __(string $text): string { return $text; }
function get_post(int $id = 0): WP_Post { $p = new WP_Post(); $p->post_author = $GLOBALS['author']; return $p; }
function get_current_user_id(): int { return $GLOBALS['user']; }
require __DIR__ . '/../includes/class-miopages-delivery-editor-guard.php';
function deliver(string $content): void { $GLOBALS['option'] = json_encode(['current' => ['posts' => ['/questions' => ['ID' => 60, 'post_title' => 'Questions', 'post_content' => $content]]]]); }
function check(bool $ok, string $what): void { if (!$ok) { fwrite(STDERR, "FAIL: $what\n"); exit(1); } }

$g = 'MioPages_Delivery_Editor_Guard';
deliver('version one');
$loaded = $g::version('site', 60);
check($g::version('site', 61) === null, 'pages Core does not manage are left alone');
check($g::heartbeat('site', [], ['miopages-delivery' => ['post' => 60, 'version' => $loaded]]) === [], 'no message while current');
check($g::guard('site', null, new WP_REST_Request('POST', '/wp/v2/pages/60', $loaded)) === null, 'Operator saves on the current version go through');
deliver('version two');
$beat = $g::heartbeat('site', [], ['miopages-delivery' => ['post' => 60, 'version' => $loaded]]);
check(($beat['wp-refresh-post-lock']['lock_error']['name'] ?? null) === 'MioPages Core', 'open editor is told Core took over');
$refused = $g::guard('site', null, new WP_REST_Request('PUT', '/wp/v2/pages/60', $loaded));
check($refused instanceof WP_Error && $refused->data['status'] === 409, 'save from the older copy is refused');
check($g::guard('site', null, new WP_REST_Request('POST', '/wp/v2/pages/60/autosaves', $loaded)) === null, 'autosave by a non-author is kept apart, not refused');
$GLOBALS['author'] = 3;
check($g::guard('site', null, new WP_REST_Request('POST', '/wp/v2/pages/60/autosaves', $loaded)) instanceof WP_Error, 'autosave that would overwrite the page is refused');
check($g::guard('site', null, new WP_REST_Request('POST', '/wp/v2/pages/60', null)) === null, 'clients that do not report a version are unaffected');
check($g::guard('site', null, new WP_REST_Request('POST', '/wp/v2/pages/60', $g::version('site', 60))) === null, 'after reloading, saves go through');
echo "PASS\n";
