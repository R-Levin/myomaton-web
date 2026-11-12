<?php
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');
require dirname(__DIR__) . '/includes/class-miopages-native-draft-envelope.php';

try {
    $input = json_decode(stream_get_contents(STDIN, 1048576), true, 48, JSON_THROW_ON_ERROR);
    $payload = MioPages_Native_Draft_Envelope::verify(json_encode($input['envelope'], JSON_THROW_ON_ERROR), $input['identity']);
    echo json_encode(['digest' => $payload['digest'], 'revision' => $payload['candidate']['revision']], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    fwrite(STDERR, "Native draft verification refused.\n");
    exit(1);
}
