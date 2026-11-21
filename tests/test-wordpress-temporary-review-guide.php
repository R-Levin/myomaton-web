<?php
define('ABSPATH', __DIR__);
$allowed = true; $preview = true; $origin = 'https://miopages.org'; $id = 13;
$post = (object) ['ID' => 13, 'post_type' => 'page', 'post_status' => 'draft', 'post_name' => 'home', 'post_title' => '<Home>', 'post_content' => 'Exact saved content'];
$state = ['current' => ['revision' => 6, 'posts' => ['/' => (array) $post]]];
function home_url() { return $GLOBALS['origin']; }
function current_user_can($permission, $id) { return $GLOBALS['allowed']; }
function get_post($id) { return $id === 13 ? $GLOBALS['post'] : null; }
function get_option($name) { return $GLOBALS['state']; }
function is_preview() { return $GLOBALS['preview']; }
function get_queried_object_id() { return $GLOBALS['id']; }
function esc_html($value) { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
function add_action(...$args) {}
require __DIR__ . '/../scripts/wordpress-temporary-review-guide.php';
function output() { ob_start(); miopages_temporary_review_guide(); return ob_get_clean(); }
function check($condition) { if (!$condition) throw new RuntimeException('Review guide regression'); }
check(str_contains(output(), 'revision 6') && str_contains(output(), '&lt;Home&gt;'));
$before = serialize([$post, $state]); output(); check($before === serialize([$post, $state]));
$post->post_content = 'Unreviewed edit'; check(str_contains(output(), 'differs from the recorded'));
$allowed = false; check(output() === ''); $allowed = true;
$preview = false; check(output() === ''); $preview = true;
$origin = 'https://other.example'; check(output() === ''); $origin = 'https://miopages.org';
$id = 14; check(output() === ''); $id = 13;
$post->post_status = 'publish'; check(output() === '');
echo "PASS: temporary guide scope, drift, escaping and no mutations\n";
