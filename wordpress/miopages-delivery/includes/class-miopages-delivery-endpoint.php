<?php
/**
 * Core's web endpoint into this WordPress site (owner decision, Nov 22: Core reaches
 * WordPress over HTTPS, never by shell access to the hosting).
 *
 * POST /wp-json/miopages/v1/draft with a Core-signed draft package as the body
 * (read-back: /readback, see MioPages_Delivery_Readback). The
 * signature is the authentication: the package must verify against this site's enrolled
 * Core key, name this installation, and follow the last applied revision. The reply is
 * the same HMAC-signed receipt the command-line path returns.
 *
 * Enabled only when the site's private configuration names the WordPress account that
 * delivery writes as (MIOPAGES_NATIVE_DRAFT_IDENTITY['deliveryUser']).
 */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-miopages-native-draft-writer.php';
require_once __DIR__ . '/class-miopages-native-draft-receipt.php';
require_once __DIR__ . '/class-miopages-delivery-readback.php';

final class MioPages_Delivery_Endpoint
{
    public const NAMESPACE = 'miopages/v1';
    private const LIMIT = 1048576;

    public static function enabled(): bool
    {
        return defined('MIOPAGES_NATIVE_DRAFT_IDENTITY') && is_array(MIOPAGES_NATIVE_DRAFT_IDENTITY)
            && is_string(MIOPAGES_NATIVE_DRAFT_IDENTITY['deliveryUser'] ?? null)
            && MIOPAGES_NATIVE_DRAFT_IDENTITY['deliveryUser'] !== '';
    }

    public static function register(): void
    {
        if (!self::enabled()) {
            return;
        }
        // A password-protected development site sends its gate login with every request.
        // WordPress would read that as an application password and refuse the call;
        // this endpoint is authenticated by Core's signature instead.
        add_filter('application_password_is_api_request', static function ($isApi) {
            return self::isOwnRequest() ? false : $isApi;
        });
        add_action('rest_api_init', static function (): void {
            register_rest_route(self::NAMESPACE, '/draft', [
                'methods' => 'POST',
                'permission_callback' => '__return_true',
                'callback' => static function (WP_REST_Request $request) {
                    nocache_headers();
                    [$status, $body] = self::draft($request->get_body(), MIOPAGES_NATIVE_DRAFT_IDENTITY,
                        defined('MIOPAGES_PRIVATE_PULL') ? MIOPAGES_PRIVATE_PULL : null);
                    return new WP_REST_Response($body, $status);
                },
            ]);
            // Read-only: the delivered pages as they are now, and their Notes.
            register_rest_route(self::NAMESPACE, '/readback', [
                'methods' => 'POST',
                'permission_callback' => '__return_true',
                'callback' => static function (WP_REST_Request $request) {
                    nocache_headers();
                    [$status, $body] = MioPages_Delivery_Readback::handle($request->get_body(), MIOPAGES_NATIVE_DRAFT_IDENTITY,
                        defined('MIOPAGES_PRIVATE_PULL') ? MIOPAGES_PRIVATE_PULL : null);
                    return new WP_REST_Response($body, $status);
                },
            ]);
        });
    }

    /** Apply one Core-signed package and return [HTTP status, response body]. */
    public static function draft(string $wire, array $identity, ?array $pull): array
    {
        try {
            $key = $pull['secretHex'] ?? null;
            if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/D', $key)
                || !is_string($identity['installationId'] ?? null)
                || ($pull['identity']['installationId'] ?? null) !== $identity['installationId']) {
                return [503, ['error' => 'delivery-unavailable']];
            }
            if ($wire === '') {
                return [400, ['error' => 'refused']];
            }
            if (strlen($wire) > self::LIMIT) {
                return [413, ['error' => 'refused']];
            }
            $user = get_user_by('login', (string) ($identity['deliveryUser'] ?? ''));
            if (!$user) {
                return [503, ['error' => 'delivery-unavailable']];
            }
            wp_set_current_user($user->ID);
            $applied = MioPages_Native_Draft_Writer::apply($wire, $identity, true);
            return [200, MioPages_Native_Draft_Receipt::create($applied, hex2bin($key))];
        } catch (Throwable $error) {
            // No detail leaves the site; Core keeps its own record of what it sent.
            return [422, ['error' => 'refused']];
        }
    }

    private static function isOwnRequest(): bool
    {
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
        return str_contains($uri, '/wp-json/' . self::NAMESPACE . '/')
            || str_contains(rawurldecode($uri), 'rest_route=/' . self::NAMESPACE . '/');
    }
}
