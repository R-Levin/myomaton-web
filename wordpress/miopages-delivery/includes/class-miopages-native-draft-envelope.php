<?php
/** Verify the separate, draft-only Core envelope against the enrolled key. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-miopages-native-draft-media.php';
require_once __DIR__ . '/class-miopages-native-draft-brand.php';

final class MioPages_Native_Draft_Envelope
{
    private const PREFIX = "MioPages-WP-Native-Draft-v";

    public static function verify(string $wire, array $identity, ?int $now = null): array
    {
        if (strlen($wire) > 1048576 || !function_exists('sodium_crypto_sign_verify_detached')) {
            throw new InvalidArgumentException('Native draft envelope refused.');
        }
        $envelope = json_decode($wire, true, 48, JSON_THROW_ON_ERROR);
        if (!is_array($envelope) || count($envelope) !== 6
            || ($envelope['schema'] ?? null) !== 'miopages.wordpress.native-draft-envelope'
            || !in_array($envelope['version'] ?? null, [1, 2, 3, 4, 5], true) || !is_string($identity['keyId'] ?? null)
            || ($envelope['keyId'] ?? null) !== $identity['keyId']) {
            throw new InvalidArgumentException('Native draft envelope refused.');
        }
        $raw = self::decode($envelope['payloadBase64'] ?? null, 700000);
        $signature = self::decode($envelope['signatureBase64'] ?? null, SODIUM_CRYPTO_SIGN_BYTES);
        $public = self::decode($identity['publicKeyBase64'] ?? null, SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES);
        if (strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES || strlen($public) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || !is_string($envelope['payloadSha256'] ?? null) || !hash_equals(hash('sha256', $raw), $envelope['payloadSha256'])
            || !sodium_crypto_sign_verify_detached($signature, self::PREFIX . $envelope['version'] . "\n" . $raw, $public)) {
            throw new InvalidArgumentException('Native draft signature refused.');
        }
        $payload = json_decode($raw, true, 48, JSON_THROW_ON_ERROR);
        $clock = $now ?? time();
        if (!is_array($payload) || count($payload) !== 8
            || ($payload['schema'] ?? null) !== 'miopages.wordpress.native-draft' || ($payload['version'] ?? null) !== $envelope['version']
            || ($payload['purpose'] ?? null) !== 'non-public-draft-only'
            || !in_array($payload['operation'] ?? null, ['apply', 'restore'], true)
            || !is_int($payload['issuedAt'] ?? null) || !is_int($payload['expiresAt'] ?? null)
            || $payload['issuedAt'] > $clock + 60 || $payload['expiresAt'] <= $clock
            || $payload['expiresAt'] - $payload['issuedAt'] !== 900
            || !is_string($payload['digest'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $payload['digest'])
            || !is_array($payload['candidate'] ?? null)) {
            throw new InvalidArgumentException('Native draft payload refused.');
        }
        $candidate = $payload['candidate'];
        $rollback = $candidate['rollback'] ?? null;
        if (array_key_exists('brand', $candidate) !== ($payload['version'] === 5)
            || (array_key_exists('brand', $candidate) && !is_array($candidate['brand']))) {
            throw new InvalidArgumentException('Native draft brand version refused.');
        }
        if ($payload['version'] < 5 && array_key_exists('baselinePages', $candidate) !== ($payload['version'] === 4)) {
            throw new InvalidArgumentException('Native draft Page membership version refused.');
        }
        if (array_key_exists('baselinePages', $candidate)) {
            self::baseline($candidate);
        }
        $media = array_key_exists('media', $candidate);
        if ($payload['version'] < 4 && $media !== ($payload['version'] === 3)) {
            throw new InvalidArgumentException('Native draft media version refused.');
        }
        if ($media) {
            MioPages_Native_Draft_Media::validate($candidate);
        }
        $requiresRollback = $payload['version'] === 2;
        if (($requiresRollback && !array_key_exists('rollback', $candidate))
            || ($payload['version'] === 1 && array_key_exists('rollback', $candidate))
            || (array_key_exists('rollback', $candidate) && (
            !is_array($rollback) || count($rollback) !== 2 || !is_int($rollback['revision'] ?? null)
            || !is_int($candidate['revision'] ?? null) || $rollback['revision'] < 1
            || $rollback['revision'] >= $candidate['revision'] - 1
            || !is_string($rollback['digest'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $rollback['digest'])
            || $rollback['digest'] === ($candidate['previousDigest'] ?? null)))) {
            throw new InvalidArgumentException('Native draft rollback claim refused.');
        }
        foreach (['organizationId', 'webPresenceId', 'managedSiteId', 'installationId'] as $field) {
            $actual = $field === 'installationId' ? ($candidate[$field] ?? null) : ($candidate['scope'][$field] ?? null);
            if (!is_string($identity[$field] ?? null) || $actual !== $identity[$field]) {
                throw new InvalidArgumentException('Native draft target refused.');
            }
        }
        if (isset($candidate['brand'])) {
            MioPages_Native_Draft_Brand::bytes($candidate['brand'], $candidate['scope']);
        }
        return $payload;
    }

    private static function baseline(array $candidate): void
    {
        $pages = $candidate['baselinePages'];
        if (!is_int($candidate['revision'] ?? null) || $candidate['revision'] < 2 || !is_string($candidate['previousDigest'] ?? null)
            || !preg_match('/^[a-f0-9]{64}$/D', $candidate['previousDigest']) || !is_array($pages) || !array_is_list($pages)) {
            throw new InvalidArgumentException('Native draft Page membership refused.');
        }
        $paths = [];
        $ids = [];
        foreach ($pages as $page) {
            if (!is_array($page) || count($page) !== 2 || !is_string($page['path'] ?? null) || strlen($page['path']) > 160
                || !preg_match('~^/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*/?)?$~D', $page['path'])
                || !is_string($page['id'] ?? null) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $page['id'])
                || isset($ids[$page['id']]) || isset($paths[rtrim($page['path'], '/')])) {
                throw new InvalidArgumentException('Native draft prior Page identity refused.');
            }
            $ids[$page['id']] = true;
            $paths[rtrim($page['path'], '/')] = $page['path'];
        }
        if (!isset($paths[''])) {
            throw new InvalidArgumentException('Native draft prior Home required.');
        }
    }

    private static function decode(mixed $value, int $limit): string
    {
        $decoded = is_string($value) ? base64_decode($value, true) : false;
        if ($decoded === false || strlen($decoded) > $limit || base64_encode($decoded) !== $value) {
            throw new InvalidArgumentException('Native draft encoding refused.');
        }
        return $decoded;
    }
}
