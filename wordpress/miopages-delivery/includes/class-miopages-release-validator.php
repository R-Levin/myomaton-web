<?php
/**
 * Offline release-envelope verifier. No WordPress hooks or persistence.
 * NOT a production publication/approval mechanism.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Release_Validator
{
    private const PREFIX = "MioPages-WP-Release-v1\n";
    private const ENVELOPE_SCHEMA = 'miopages.wordpress.release-envelope';
    private const PAYLOAD_SCHEMA = 'miopages.wordpress.managed-release';
    private const TYPES = ['hero', 'intro', 'relationship', 'collection', 'cta'];
    private const MAX_ENVELOPE_BYTES = 1048576;
    private const MAX_PAYLOAD_BYTES = 786432;

    /**
     * @param array<string,mixed> $identity trusted locally configured target and pinned key
     * @param array<string,mixed> $active trusted durable active-release snapshot; compare-and-swap not provided here
     * @return array<string,mixed>|WP_Error
     */
    public static function validate(string $json, array $identity, array $active, ?int $now = null)
    {
        if (strlen($json) > self::MAX_ENVELOPE_BYTES || !function_exists('sodium_crypto_sign_verify_detached')) {
            return self::fail('size_or_crypto');
        }

        try {
            $envelope = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            return self::fail('envelope_json');
        }

        if (!is_array($envelope)
            || !self::exactKeys($envelope, ['schema', 'version', 'keyId', 'payloadBase64', 'payloadSha256', 'signatureBase64'])
            || $envelope['schema'] !== self::ENVELOPE_SCHEMA || $envelope['version'] !== 1
            || !is_string($envelope['keyId']) || !is_string($identity['keyId'] ?? null)
            || !hash_equals($identity['keyId'], $envelope['keyId'])
            || !is_string($envelope['payloadBase64']) || !is_string($envelope['payloadSha256'])
            || !is_string($envelope['signatureBase64']) || !is_string($identity['publicKeyBase64'] ?? null)) {
            return self::fail('envelope_shape');
        }

        $payloadBytes = base64_decode($envelope['payloadBase64'], true);
        $signature = base64_decode($envelope['signatureBase64'], true);
        $publicKey = base64_decode($identity['publicKeyBase64'], true);
        if (!is_string($payloadBytes) || strlen($payloadBytes) > self::MAX_PAYLOAD_BYTES
            || !is_string($signature) || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES
            || !is_string($publicKey) || strlen($publicKey) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || !preg_match('/^[0-9a-f]{64}$/D', $envelope['payloadSha256'])
            || !hash_equals(hash('sha256', $payloadBytes), $envelope['payloadSha256'])
            || !sodium_crypto_sign_verify_detached($signature, self::PREFIX . $payloadBytes, $publicKey)) {
            return self::fail('signature_or_integrity');
        }

        try {
            $payload = json_decode($payloadBytes, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            return self::fail('payload_json');
        }
        if (!is_array($payload) || !self::exactKeys($payload, [
                'schema', 'version', 'releaseId', 'organizationId', 'webPresenceId',
                'managedSiteId', 'installationId', 'sequence', 'previousReleaseId',
                'issuedAt', 'expiresAt', 'approval', 'pages', 'assets'
            ])
            || $payload['schema'] !== self::PAYLOAD_SCHEMA || $payload['version'] !== 1) {
            return self::fail('payload_shape');
        }

        foreach (['organizationId', 'webPresenceId', 'managedSiteId', 'installationId'] as $field) {
            if (!self::identifier($identity[$field] ?? null)
                || !is_string($payload[$field]) || !hash_equals($identity[$field], $payload[$field])) {
                return self::fail('target_mismatch');
            }
        }
        if (!self::identifier($payload['releaseId'])
            || !is_array($payload['approval'])
            || !self::exactKeys($payload['approval'], ['state', 'approvalId'])
            || $payload['approval']['state'] !== 'approved'
            || !self::identifier($payload['approval']['approvalId'])) {
            return self::fail('approval_claim');
        }

        $previousId = $active['releaseId'] ?? null;
        $previousSequence = $active['sequence'] ?? null;
        if (!is_int($previousSequence) || $previousSequence < 0
            || ($previousId !== null && !self::identifier($previousId))
            || !is_int($payload['sequence']) || $payload['sequence'] !== $previousSequence + 1
            || $payload['previousReleaseId'] !== $previousId
            || $payload['releaseId'] === $previousId) {
            return self::fail('release_order');
        }

        // Strict UTC timestamp shape; strtotime also validates calendar/time values.
        foreach (['issuedAt', 'expiresAt'] as $field) {
            if (!is_string($payload[$field])
                || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/D', $payload[$field])) {
                return self::fail('release_time');
            }
        }
        $issued = strtotime($payload['issuedAt']);
        $expires = strtotime($payload['expiresAt']);
        $clock = $now ?? time();
        if ($issued === false || $expires === false || $issued >= $expires
            || $expires - $issued > 86400 || $issued > $clock + 300 || $clock >= $expires
            || $clock < $issued - 300) {
            return self::fail('release_time');
        }

        if (!is_array($payload['assets']) || $payload['assets'] !== []
            || !is_array($payload['pages']) || count($payload['pages']) < 1
            || count($payload['pages']) > 16) {
            return self::fail('content_shape');
        }
        $paths = [];
        $pageIds = [];
        $sectionIds = [];
        foreach ($payload['pages'] as $page) {
            if (!is_array($page)
                || !self::exactKeys($page, ['id', 'path', 'title', 'sections'])
                || !self::identifier($page['id']) || !is_string($page['title'])
                || trim($page['title']) === '' || strlen($page['title']) > 160
                || !is_string($page['path'])
                || !preg_match('#^/(?:[a-z0-9]+(?:-[a-z0-9]+)*/?)*$#D', $page['path'])
                || strlen($page['path']) > 160
                || isset($paths[$page['path']]) || isset($pageIds[$page['id']])
                || !is_array($page['sections']) || count($page['sections']) < 1
                || count($page['sections']) > 32) {
                return self::fail('page_shape');
            }
            $paths[$page['path']] = true;
            $pageIds[$page['id']] = true;
            foreach ($page['sections'] as $section) {
                if (!is_array($section)
                    || !self::exactKeys($section, ['id', 'type', 'content'])
                    || !self::identifier($section['id']) || isset($sectionIds[$section['id']])
                    || !in_array($section['type'], self::TYPES, true)
                    || !is_array($section['content'])
                    || !self::safeContent($section['content'])) {
                    return self::fail('section_shape');
                }
                $sectionIds[$section['id']] = true;
            }
        }

        // Eligibility only: does not store or activate any release.
        return $payload;
    }

    private static function identifier($value): bool
    {
        return is_string($value) && (bool) preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/D', $value);
    }

    /** @param array<mixed> $object @param string[] $expected */
    private static function exactKeys(array $object, array $expected): bool
    {
        $keys = array_keys($object);
        sort($keys);
        sort($expected);
        return $keys === $expected;
    }

    /** Strict first-slice text-only content; no arbitrary HTML, media, nested fields or URL. */
    private static function safeContent(array $content): bool
    {
        if (!self::exactKeys($content, ['heading', 'text'])
            || !is_string($content['heading']) || !is_string($content['text'])
            || trim($content['heading']) === '' || strlen($content['heading']) > 300
            || strlen($content['text']) > 10000) {
            return false;
        }
        // Rendering still must escape all text. Disallow tags in the minimal proof contract.
        return $content['heading'] === strip_tags($content['heading'])
            && $content['text'] === strip_tags($content['text']);
    }

    private static function fail(string $reason): WP_Error
    {
        return new WP_Error('miopages_release_rejected', 'MioPages release rejected: ' . $reason);
    }
}
