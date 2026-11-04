<?php
/**
 * Read an ephemeral Node-generated test envelope from STDIN, then invoke the
 * exact production-format PHP validator. No filesystem writes or WP runtime.
 */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');

class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}
require dirname(__DIR__) . '/includes/class-miopages-release-validator.php';

$input = stream_get_contents(STDIN, 2 * 1024 * 1024);
if (!is_string($input) || strlen($input) >= 2 * 1024 * 1024) {
    fwrite(STDERR, "FAIL: bounded test input required.\n");
    exit(1);
}
try {
    $data = json_decode($input, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    fwrite(STDERR, "FAIL: invalid test JSON.\n");
    exit(1);
}
if (!is_array($data) || !is_string($data['envelope'] ?? null)
    || !is_string($data['publicKeyBase64'] ?? null)) {
    fwrite(STDERR, "FAIL: invalid test input fields.\n");
    exit(1);
}
$identity = [
    'keyId' => 'synthetic-node-test',
    'publicKeyBase64' => $data['publicKeyBase64'],
    'organizationId' => 'synthetic-org',
    'webPresenceId' => 'synthetic-presence',
    'managedSiteId' => 'synthetic-site',
    'installationId' => 'synthetic-installation',
];
$active = ['releaseId' => null, 'sequence' => 0];
$ok = MioPages_Release_Validator::validate($data['envelope'], $identity, $active);
if ($ok instanceof WP_Error || !is_array($ok)
    || $ok['releaseId'] !== 'synthetic-node-cross-runtime') {
    fwrite(STDERR, "FAIL: Node-signed envelope rejected by PHP.\n");
    exit(1);
}
$forgedIdentity = $identity;
$forgedIdentity['installationId'] = 'synthetic-other-installation';
if (!(MioPages_Release_Validator::validate(
    $data['envelope'], $forgedIdentity, $active
) instanceof WP_Error)) {
    fwrite(STDERR, "FAIL: foreign installation accepted.\n");
    exit(1);
}
$replayed = ['releaseId' => $ok['releaseId'], 'sequence' => 1];
if (!(MioPages_Release_Validator::validate(
    $data['envelope'], $identity, $replayed
) instanceof WP_Error)) {
    fwrite(STDERR, "FAIL: already-active release replay accepted.\n");
    exit(1);
}
$bad = json_decode($data['envelope'], true);
$bad['payloadSha256'] = str_repeat('0', 64);
if (!(MioPages_Release_Validator::validate(
    json_encode($bad, JSON_THROW_ON_ERROR), $identity, $active
) instanceof WP_Error)) {
    fwrite(STDERR, "FAIL: changed payload digest accepted.\n");
    exit(1);
}
echo "PASS: Node Ed25519 envelope accepted by PHP, foreign/replay/tamper refused.\n";
