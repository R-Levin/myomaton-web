<?php
/**
 * Experimental, synthetic-only WordPress staging facade.
 * No site publication, active-release mutation, APIs or key creation.
 * Call only from restricted admin workflow, never from frontend requests.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Private_Staging
{
    /**
     * @param mixed $config Trusted non-Git/local constant; never extracted from a submitted envelope.
     * @return array<string,mixed>|WP_Error
     */
    public static function stage(string $envelope, $config, string $wordpressRoot, string $documentRoot)
    {
        $checked = self::checkedConfig($config, $wordpressRoot, $documentRoot);
        if ($checked instanceof WP_Error) {
            return $checked;
        }
        if (strlen($envelope) > 1048576) {
            return self::fail('oversized_envelope');
        }

        $identity = $checked['identity'];
        $store = new MioPages_Release_Store($checked['directory'], $identity);
        // No signed payload can be trusted until verified; storage must independently
        // verify under the same exclusive lock before writing an immutable object.
        $result = $store->stage($envelope);
        if ($result instanceof WP_Error) {
            return $result;
        }

        // This facade does NOT call activate(). No WordPress posts, options,
        // pages or frontend routes are written, and no release signer exists here.
        return $result;
    }

    /**
     * @param mixed $config
     * @return array<string,mixed>|WP_Error
     */
    public static function status($config, string $wordpressRoot, string $documentRoot)
    {
        $checked = self::checkedConfig($config, $wordpressRoot, $documentRoot);
        if ($checked instanceof WP_Error) {
            return $checked;
        }
        $store = new MioPages_Release_Store($checked['directory'], $checked['identity']);
        $active = $store->status();
        if ($active instanceof WP_Error) {
            return $active;
        }
        return [
            'state' => 'private_staging_only',
            'activeSequence' => $active['sequence'],
            'activeReleaseId' => $active['releaseId'],
            'publicationEnabled' => false,
        ];
    }

    /**
     * @param mixed $config
     * @return array{directory:string,identity:array<string,string>}|WP_Error
     */
    public static function checkedConfig($config, string $wordpressRoot, string $documentRoot)
    {
        if (!is_array($config) || array_keys($config) !== ['directory', 'identity']
            || !is_string($config['directory']) || !is_array($config['identity'])) {
            return self::fail('no_explicit_enrollment');
        }
        $identity = $config['identity'];
        $required = ['keyId', 'publicKeyBase64', 'organizationId',
            'webPresenceId', 'managedSiteId', 'installationId'];
        $actual = array_keys($identity);
        sort($required);
        sort($actual);
        if ($actual !== $required) {
            return self::fail('invalid_enrollment_shape');
        }
        foreach ($identity as $name => $value) {
            if (!is_string($value) || trim($value) === '' || strlen($value) > 256) {
                return self::fail('invalid_enrollment_value');
            }
            if ($name !== 'publicKeyBase64'
                && !preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/D', $value)) {
                return self::fail('invalid_identity');
            }
        }
        $pub = base64_decode($identity['publicKeyBase64'], true);
        if (!is_string($pub) || strlen($pub) !== 32
            || !function_exists('sodium_crypto_sign_verify_detached')) {
            return self::fail('invalid_or_unsupported_verification_key');
        }
        // A deliberately separate test-identity namespace prevents accidentally
        // treating genuine production installation IDs as enrolled by this adapter.
        foreach (['organizationId', 'webPresenceId', 'managedSiteId', 'installationId'] as $name) {
            if (!str_starts_with($identity[$name], 'synthetic-')) {
                return self::fail('synthetic_identity_required');
            }
        }
        if (!MioPages_Filesystem_Probe::safeDirectory(
            $config['directory'], $wordpressRoot, $documentRoot
        )) {
            return self::fail('unsafe_private_directory');
        }
        return ['directory' => realpath($config['directory']), 'identity' => $identity];
    }

    private static function fail(string $reason): WP_Error
    {
        return new WP_Error('miopages_private_staging_refused',
            'Private staging refused: ' . $reason);
    }
}
