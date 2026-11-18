<?php
/** Read-only rendering proof against an already disposable local WordPress. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || count($argv) !== 2) exit(2);
$root = realpath($argv[1]);
if ($root === false || !is_file($root . '/wp-load.php')) exit(2);
$_SERVER['HTTP_HOST'] = '127.0.0.1:4473';
define('MIOPAGES_LOOPBACK_EVALUATION_REQUEST', true);
putenv('MIOPAGES_FIXTURE_CASE=c0');
require $root . '/wp-load.php';
if (get_option('home') !== 'http://127.0.0.1:4473') exit(2);
require dirname(__DIR__) . '/wordpress/miopages-delivery/includes/class-miopages-native-component.php';
global $wpdb;
$before = hash('sha256', serialize($wpdb->get_results("SELECT ID,post_status,post_content,post_name FROM {$wpdb->posts} ORDER BY ID", ARRAY_A)));
if ($wpdb->query('START TRANSACTION') === false) exit(3);
try {
    $value = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    $content = MioPages_Native_Component::render($value, [], [], []);
    $blocks = parse_blocks($content);
    if (serialize_blocks($blocks) !== $content) throw new RuntimeException('Native block serialization differs.');
    $rendered = do_blocks($content);
    if (str_contains($rendered, 'wp:')) throw new RuntimeException('Native block comments were not rendered.');
} finally { $wpdb->query('ROLLBACK'); }
$after = hash('sha256', serialize($wpdb->get_results("SELECT ID,post_status,post_content,post_name FROM {$wpdb->posts} ORDER BY ID", ARRAY_A)));
if (!hash_equals($before, $after)) exit(4);
echo json_encode(['status'=>'PASS','wordpress'=>get_bloginfo('version'),'nativeBlocks'=>true,
    'unchangedPosts'=>true,'html'=>$rendered], JSON_THROW_ON_ERROR);
