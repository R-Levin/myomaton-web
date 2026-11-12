<?php
/** Verify the separate, draft-only Core envelope against the enrolled key. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Native_Draft_Envelope
{
    private const PREFIX = "MioPages-WP-Native-Draft-v1\n";

    public static function verify(string $wire, array $identity, ?int $now = null): array
    {
        if (strlen($wire) > 1048576 || !function_exists('sodium_crypto_sign_verify_detached')) {
            throw new InvalidArgumentException('Native draft envelope refused.');
        }
        $envelope = json_decode($wire, true, 48, JSON_THROW_ON_ERROR);
        if (!is_array($envelope) || count($envelope) !== 6
            || ($envelope['schema'] ?? null) !== 'miopages.wordpress.native-draft-envelope'
            || ($envelope['version'] ?? null) !== 1 || !is_string($identity['keyId'] ?? null)
            || ($envelope['keyId'] ?? null) !== $identity['keyId']) {
            throw new InvalidArgumentException('Native draft envelope refused.');
        }
        $raw = self::decode($envelope['payloadBase64'] ?? null, 700000);
        $signature = self::decode($envelope['signatureBase64'] ?? null, SODIUM_CRYPTO_SIGN_BYTES);
        $public = self::decode($identity['publicKeyBase64'] ?? null, SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES);
        if (strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES || strlen($public) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || !is_string($envelope['payloadSha256'] ?? null) || !hash_equals(hash('sha256', $raw), $envelope['payloadSha256'])
            || !sodium_crypto_sign_verify_detached($signature, self::PREFIX . $raw, $public)) {
            throw new InvalidArgumentException('Native draft signature refused.');
        }
        $payload = json_decode($raw, true, 48, JSON_THROW_ON_ERROR);
        $clock = $now ?? time();
        if (!is_array($payload) || count($payload) !== 8
            || ($payload['schema'] ?? null) !== 'miopages.wordpress.native-draft' || ($payload['version'] ?? null) !== 1
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
        foreach (['organizationId', 'webPresenceId', 'managedSiteId', 'installationId'] as $field) {
            $actual = $field === 'installationId' ? ($candidate[$field] ?? null) : ($candidate['scope'][$field] ?? null);
            if (!is_string($identity[$field] ?? null) || $actual !== $identity[$field]) {
                throw new InvalidArgumentException('Native draft target refused.');
            }
        }
        return $payload;
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
