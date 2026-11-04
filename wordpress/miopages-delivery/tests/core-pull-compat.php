<?php
/** Exercise real private storage and capture the PHP transport headers for Core. */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');

class WP_Error
{
    public function __construct(public string $code, public string $message) {}
}

foreach (['filesystem-probe', 'release-validator', 'release-store', 'release-pull'] as $name) {
    require dirname(__DIR__) . '/includes/class-miopages-' . $name . '.php';
}

$input = json_decode(stream_get_contents(STDIN, 2097152), true, 32, JSON_THROW_ON_ERROR);
$requests = [];

function wp_safe_remote_post(string $url, array $args): array
{
    global $input, $requests;
    if ($args['sslverify'] !== true || $args['redirection'] !== 0 || $args['timeout'] !== 10) {
        throw new RuntimeException('Unsafe transport options');
    }
    $requests[] = ['url' => $url, 'headers' => $args['headers']];
    return str_ends_with($url, '/pull')
        ? ['code' => 200, 'body' => $input['envelope'], 'digest' => $input['digest']]
        : ['code' => 204];
}

function wp_remote_retrieve_response_code(array $response): int { return $response['code']; }
function wp_remote_retrieve_body(array $response): string { return $response['body']; }
function wp_remote_retrieve_header(array $response, string $name): string { return $response['digest']; }

$result = MioPages_Release_Pull::stage($input['core'], $input['origin'], $input['credentialId'],
    hex2bin($input['secret']), $input['releaseId'], $input['identity'], $input['directory'], $input['webroot'], $input['webroot']);
echo json_encode(['result' => $result, 'requests' => $requests], JSON_THROW_ON_ERROR);
