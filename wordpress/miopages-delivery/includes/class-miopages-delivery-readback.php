<?php
/**
 * Read-back for Core: the pages Core delivered to this site, as they are now, and the
 * Operator's Notes on them (owner direction, Nov 22: Core keeps the Operator's edits and
 * treats Notes as revision requests for those exact spots).
 *
 * POST /wp-json/miopages/v1/readback with a small Core-signed request. Read-only. The
 * answer is HMAC-signed with this site's receipt key so Core can trust it.
 */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Delivery_Readback
{
    private const REQUEST = "MioPages-WP-Readback-Request-v1\n";
    private const RESPONSE = "MioPages-WP-Readback-v1\n";

    /** Verify Core's signed request; returns the installation it names. */
    public static function verify(string $wire, array $identity, ?int $now = null): string
    {
        if (strlen($wire) > 8192 || !function_exists('sodium_crypto_sign_verify_detached')) {
            throw new InvalidArgumentException('Read-back request refused.');
        }
        $request = json_decode($wire, true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($request) || count($request) !== 4 || ($request['schema'] ?? null) !== 'miopages.wordpress.readback-request'
            || ($request['keyId'] ?? null) !== ($identity['keyId'] ?? false)) {
            throw new InvalidArgumentException('Read-back request refused.');
        }
        $raw = base64_decode((string) ($request['payloadBase64'] ?? ''), true);
        $signature = base64_decode((string) ($request['signatureBase64'] ?? ''), true);
        $public = base64_decode((string) ($identity['publicKeyBase64'] ?? ''), true);
        if ($raw === false || $signature === false || $public === false || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES
            || strlen($public) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || !sodium_crypto_sign_verify_detached($signature, self::REQUEST . $raw, $public)) {
            throw new InvalidArgumentException('Read-back signature refused.');
        }
        $payload = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        $clock = $now ?? time();
        if (!is_array($payload) || count($payload) !== 4 || ($payload['installationId'] ?? null) !== ($identity['installationId'] ?? false)
            || !is_int($payload['issuedAt'] ?? null) || !is_int($payload['expiresAt'] ?? null)
            || $payload['issuedAt'] > $clock + 60 || $payload['expiresAt'] <= $clock || $payload['expiresAt'] - $payload['issuedAt'] > 300
            || !is_string($payload['nonce'] ?? null) || !preg_match('/^[a-f0-9]{32}$/D', $payload['nonce'])) {
            throw new InvalidArgumentException('Read-back request refused.');
        }
        return $payload['installationId'];
    }

    /** The delivered pages now, and their Notes, as a signed answer. */
    public static function answer(string $installation, string $nonce, string $secret): array
    {
        if (strlen($secret) !== 32) {
            throw new InvalidArgumentException('Read-back key refused.');
        }
        $state = get_option('miopages_native_draft_' . hash('sha256', $installation));
        $state = is_string($state) ? json_decode($state, true, 48, JSON_THROW_ON_ERROR) : null;
        $current = $state['current'] ?? null;
        $pages = [];
        $ids = [];
        foreach (($current['posts'] ?? []) as $path => $delivered) {
            $post = get_post((int) $delivered['ID']);
            if (!$post || $post->post_type !== 'page') {
                $pages[] = ['path' => $path, 'id' => (int) $delivered['ID'], 'missing' => true];
                continue;
            }
            $ids[] = (int) $post->ID;
            $pages[] = ['path' => $path, 'id' => (int) $post->ID, 'status' => $post->post_status, 'title' => $post->post_title,
                'content' => $post->post_content, 'contentSha256' => hash('sha256', $post->post_content),
                'deliveredSha256' => hash('sha256', $delivered['post_content']),
                'edited' => $post->post_title !== $delivered['post_title'] || $post->post_content !== $delivered['post_content'],
                'modifiedGmt' => $post->post_modified_gmt];
        }
        $notes = [];
        if ($ids !== []) {
            foreach (get_comments(['post__in' => $ids, 'type' => 'note', 'status' => 'all', 'orderby' => 'comment_ID', 'order' => 'ASC']) as $note) {
                $notes[] = ['id' => (int) $note->comment_ID, 'postId' => (int) $note->comment_post_ID, 'parent' => (int) $note->comment_parent,
                    'author' => $note->comment_author, 'content' => $note->comment_content, 'dateGmt' => $note->comment_date_gmt,
                    'status' => (string) get_comment_meta((int) $note->comment_ID, '_wp_note_status', true)];
            }
        }
        $body = json_encode(['schema' => 'miopages.wordpress.readback', 'version' => 1, 'installationId' => $installation,
            'nonce' => $nonce, 'revision' => $current['revision'] ?? null, 'digest' => $current['digest'] ?? null,
            'siteProposalId' => $current['siteProposalId'] ?? null, 'pages' => $pages, 'notes' => $notes],
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return ['bodyBase64' => base64_encode($body), 'mac' => hash_hmac('sha256', self::RESPONSE . $body, $secret)];
    }

    /** [HTTP status, body] for the REST route. */
    public static function handle(string $wire, array $identity, ?array $pull): array
    {
        try {
            $key = $pull['secretHex'] ?? null;
            if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/D', $key)
                || ($pull['identity']['installationId'] ?? null) !== ($identity['installationId'] ?? false)) {
                return [503, ['error' => 'delivery-unavailable']];
            }
            $installation = self::verify($wire, $identity);
            $nonce = json_decode((string) base64_decode((string) json_decode($wire, true)['payloadBase64'], true), true)['nonce'];
            return [200, self::answer($installation, $nonce, hex2bin($key))];
        } catch (Throwable $error) {
            return [422, ['error' => 'refused']];
        }
    }
}
