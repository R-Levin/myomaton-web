<?php
/** Explicit private pull adapter. The plugin registers no caller or scheduler. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Release_Pull
{
    /**
     * Local protected configuration supplies the Core origin, credential and release pins.
     * The caller supplies the trusted local WordPress origin and document roots.
     * Retry a transient failure with a fresh request. Staging the same bytes is idempotent.
     */
    public static function stage(
        string $coreOrigin,
        string $wordpressOrigin,
        string $credentialId,
        string $secret,
        string $releaseId,
        array $identity,
        string $directory,
        string $wordpressRoot,
        string $documentRoot
    ): array|WP_Error {
        foreach ([$credentialId, $releaseId, $identity['installationId'] ?? ''] as $id) {
            if (!is_string($id) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $id)) {
                return self::refuse('invalid_identity');
            }
        }
        if (!self::httpsOrigin($coreOrigin) || !self::httpsOrigin($wordpressOrigin) || strlen($secret) !== 32
            || !MioPages_Filesystem_Probe::safeDirectory($directory, $wordpressRoot, $documentRoot)) {
            return self::refuse('invalid_configuration');
        }
        $root = realpath($directory);
        if ($root === false) {
            return self::refuse('invalid_configuration');
        }
        $installation = $identity['installationId'];
        $pull = self::request($coreOrigin, $wordpressOrigin, $installation, $credentialId, $secret, $releaseId, 'pull');
        if ($pull instanceof WP_Error) {
            return $pull;
        }
        if (wp_remote_retrieve_response_code($pull) !== 200) {
            return self::refuse('pull_denied');
        }
        $envelope = wp_remote_retrieve_body($pull);
        $expected = wp_remote_retrieve_header($pull, 'x-miopages-envelope-sha256');
        if (strlen($envelope) > 1048576 || !is_string($expected)
            || !hash_equals(hash('sha256', $envelope), $expected)) {
            return self::refuse('envelope_integrity');
        }

        $store = new MioPages_Release_Store($root, $identity);
        $staged = $store->stage($envelope, null, $releaseId);
        if ($staged instanceof WP_Error) {
            return $staged;
        }
        if ($staged !== ['state' => 'staged', 'releaseId' => $releaseId, 'sequence' => 1, 'objectSha256' => $expected]) {
            return self::refuse('stage_mismatch');
        }

        $receipt = self::request($coreOrigin, $wordpressOrigin, $installation, $credentialId, $secret,
            $releaseId, 'receipt', 'staged:1:' . $expected);
        if ($receipt instanceof WP_Error) {
            return $receipt;
        }
        return wp_remote_retrieve_response_code($receipt) === 204 ? $staged : self::refuse('receipt_denied');
    }

    private static function httpsOrigin(string $value): bool
    {
        return strlen($value) <= 253 && (bool) preg_match('#^https://[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::[1-9][0-9]{0,4})?$#D', $value);
    }

    private static function request(
        string $core,
        string $origin,
        string $installation,
        string $credential,
        string $secret,
        string $release,
        string $action,
        string $receipt = ''
    ): array|WP_Error {
        $nonce = bin2hex(random_bytes(16));
        $time = (string) (int) floor(microtime(true) * 1000);
        $signed = implode("\n", ['MioPages-WP-Delivery-v1', $core, $action, $installation,
            $origin, $credential, $release, $nonce, $time, $receipt]);
        return wp_safe_remote_post($core . '/api/wordpress-delivery/' . $action, [
            'sslverify' => true,
            'redirection' => 0,
            'timeout' => 10,
            'limit_response_size' => $action === 'pull' ? 1048577 : 1,
            'headers' => [
                'X-MioPages-Origin' => $origin,
                'X-MioPages-Installation' => $installation,
                'X-MioPages-Credential' => $credential,
                'X-MioPages-Release' => $release,
                'X-MioPages-Nonce' => $nonce,
                'X-MioPages-Time' => $time,
                'X-MioPages-Receipt' => $receipt,
                'X-MioPages-Mac' => hash_hmac('sha256', $signed, $secret),
            ],
        ]);
    }

    private static function refuse(string $reason): WP_Error
    {
        return new WP_Error('miopages_pull_refused', 'Private delivery refused: ' . $reason);
    }
}
