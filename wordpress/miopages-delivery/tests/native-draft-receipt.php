<?php
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');
require dirname(__DIR__) . '/includes/class-miopages-native-draft-receipt.php';
$input = json_decode(stream_get_contents(STDIN, 8192), true, 32, JSON_THROW_ON_ERROR);
echo json_encode(MioPages_Native_Draft_Receipt::create($input['result'], hex2bin($input['key'])), JSON_THROW_ON_ERROR);
