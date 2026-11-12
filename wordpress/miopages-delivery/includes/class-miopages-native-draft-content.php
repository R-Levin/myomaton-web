<?php
/** Native WordPress draft content projection. No hooks or writes. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Native_Draft_Content
{
    /**
     * Compose native Gutenberg content from the exact reviewed draft candidate
     * and IDs allocated by its materializer. The caller must authenticate the
     * candidate and verify the target posts before using these inputs.
     */
    public static function posts(array $candidate, array $postIds): array
    {
        $pages = $candidate['pages'];
        $navigation = $candidate['navigation'];
        $actions = $candidate['actions'];
        $paths = array_column($pages, 'path');
        if (count($paths) !== count(array_unique($paths))
            || count($paths) !== count($postIds)
            || count($paths) !== count($navigation)
            || count($navigation) !== count(array_unique($navigation))
            || array_diff($paths, array_keys($postIds)) !== []
            || array_diff($paths, $navigation) !== []) {
            throw new InvalidArgumentException('Native draft target set mismatch.');
        }
        if (count(array_unique($postIds)) !== count($postIds)) {
            throw new InvalidArgumentException('Duplicate native draft target.');
        }
        foreach ($postIds as $id) {
            if (!is_int($id) || $id < 1) {
                throw new InvalidArgumentException('Invalid native draft target.');
            }
        }
        foreach ($actions as $action) {
            if ($action['type'] !== 'page'
                || !isset($postIds[$action['from']], $postIds[$action['destination']])) {
                throw new InvalidArgumentException('Native draft Action is unsupported.');
            }
        }

        $titles = array_column($pages, 'title', 'path');
        $posts = [];
        foreach ($pages as $page) {
            $path = $page['path'];
            $links = [];
            foreach ($navigation as $target) {
                $links[] = self::link($postIds[$target], $titles[$target]);
            }
            $blocks = [self::paragraph(implode(' · ', $links))];
            foreach ($page['sections'] as $section) {
                if ($section['type'] !== 'intro') {
                    throw new InvalidArgumentException('Native draft section is unsupported.');
                }
                $blocks[] = '<!-- wp:heading --><h2 class="wp-block-heading">'
                    . esc_html($section['content']['heading']) . '</h2><!-- /wp:heading -->';
                $blocks[] = self::paragraph(nl2br(esc_html($section['content']['text']), false));
            }
            foreach ($actions as $action) {
                if ($action['from'] === $path) {
                    $blocks[] = self::paragraph(self::link($postIds[$action['destination']], $action['label']));
                }
            }
            $posts[$path] = [
                'ID' => $postIds[$path],
                'post_type' => 'page',
                'post_status' => 'draft',
                'post_title' => $page['title'],
                'post_content' => implode("\n\n", $blocks),
            ];
        }
        return $posts;
    }

    private static function paragraph(string $html): string
    {
        return '<!-- wp:paragraph --><p>' . $html . '</p><!-- /wp:paragraph -->';
    }

    private static function link(int $postId, string $label): string
    {
        return '<a href="' . esc_url(home_url('/?page_id=' . $postId . '&preview=true')) . '">'
            . esc_html($label) . '</a>';
    }
}
