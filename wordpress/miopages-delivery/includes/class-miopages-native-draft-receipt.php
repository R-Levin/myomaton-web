<?php
/** Authenticated readback from the native draft writer. */
declare(strict_types=1);
if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Native_Draft_Receipt
{
    public static function create(array $result, string $secret): array
    {
        if (strlen($secret) !== 32) {
            throw new InvalidArgumentException('Native draft receipt key refused.');
        }
        $applied = $result['applied'];
        $posts = [];
        foreach ($applied['posts'] as $route => $post) {
            $posts[] = ['path' => $route, 'id' => $post['ID'], 'status' => $post['post_status'],
                'contentSha256' => hash('sha256', $post['post_content'])];
        }
        $body = json_encode([
            'schema' => 'miopages.wordpress.native-draft-receipt', 'version' => 1,
            'installationId' => $result['installationId'], 'siteProposalId' => $applied['siteProposalId'],
            'operation' => $result['operation'], 'requestedDigest' => $result['requestedDigest'],
            'appliedDigest' => $applied['digest'], 'revision' => $applied['revision'], 'posts' => $posts,
        ], JSON_THROW_ON_ERROR);
        return ['receiptBase64' => base64_encode($body),
            'mac' => hash_hmac('sha256', "MioPages-WP-Native-Draft-Receipt-v1\n" . $body, $secret)];
    }
}
