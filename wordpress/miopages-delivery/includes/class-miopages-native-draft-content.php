<?php
/** Native WordPress draft content projection. No hooks or writes. */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-miopages-native-component.php';

final class MioPages_Native_Draft_Content
{
    /**
     * Compose native Gutenberg content from the exact reviewed draft candidate
     * and IDs allocated by its materializer. The caller must authenticate the
     * candidate and verify the target posts before using these inputs.
     */
    public static function posts(array $candidate, array $postIds, array $attachments = [], bool $localSemanticBlocks = false, array $pendingActions = []): array
    {
        $pages = $candidate['pages'];
        $navigation = $candidate['navigation'];
        $actions = $candidate['actions'];
        $paths = array_column($pages, 'path');
        if (count($paths) !== count(array_unique($paths))
            || count($paths) !== count($postIds)
            || !in_array('/', $navigation, true) || count($navigation) !== count(array_unique($navigation))
            || array_diff($paths, array_keys($postIds)) !== []
            || array_diff($navigation, $paths) !== []) {
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
            if (!$localSemanticBlocks && isset($action['componentReference'])) throw new InvalidArgumentException('Local component Action reference refused.');
            if ($action['type'] !== 'page'
                || !isset($postIds[$action['from']], $postIds[$action['destination']])) {
                throw new InvalidArgumentException('Native draft Action is unsupported.');
            }
        }

        $byPath = array_column($pages, null, 'path');
        foreach ($actions as $action) {
            if (!array_key_exists('sectionId', $action)) {
                continue;
            }
            $page = $byPath[$action['from']];
            $sections = array_column($page['sections'], 'type', 'id');
            if (($page['composition'] ?? null) !== 'managed-v1' || $action['destination'] === $action['from']
                || !is_string($action['sectionId'])
                || !in_array($sections[$action['sectionId']] ?? null, ['hero', 'cta'], true)) {
                throw new InvalidArgumentException('Native draft Action placement is unsupported.');
            }
        }

        $titles = array_column($pages, 'title', 'path');
        $labels = $titles;
        foreach ($pages as $page) {
            if (($page['composition'] ?? null) === 'managed-v1') {
                $label = $page['navigationLabel'] ?? null;
                if (!is_string($label) || trim($label) === '' || strlen($label) > 100) {
                    throw new InvalidArgumentException('Invalid managed navigation label.');
                }
                $labels[$page['path']] = $label;
            }
        }
        $posts = [];
        foreach ($pages as $page) {
            $path = $page['path'];
            foreach ($page['sections'] as $section) {
                if (array_key_exists('block', $section) && (!$localSemanticBlocks || PHP_SAPI !== 'cli' || ($page['composition'] ?? null) !== 'managed-v1')) {
                    throw new InvalidArgumentException('Semantic draft blocks are local-only.');
                }
            }
            if (array_key_exists('composition', $page)) {
                if ($page['composition'] !== 'managed-v1') {
                    throw new InvalidArgumentException('Unknown managed composition.');
                }
                $posts[$path] = [
                    'ID' => $postIds[$path], 'post_type' => 'page', 'post_status' => 'draft',
                    'post_title' => $page['title'],
                    'post_content' => self::composed($page, $postIds, $navigation, $labels, $actions, $attachments, $localSemanticBlocks, $pendingActions),
                ];
                continue;
            }
            $links = [];
            foreach ($navigation as $target) {
                $links[] = self::link($postIds[$target], $titles[$target]);
            }
            $blocks = [self::paragraph(implode(' · ', $links))];
            foreach ($page['sections'] as $section) {
                if (!in_array($section['type'], ['hero', 'intro', 'relationship', 'collection', 'cta'], true)) {
                    throw new InvalidArgumentException('Native draft section is unsupported.');
                }
                $blocks[] = '<!-- wp:heading --><h2 class="wp-block-heading">'
                    . MioPages_Native_Component::text($section['content']['heading']) . '</h2><!-- /wp:heading -->';
                $blocks[] = self::paragraph(nl2br(MioPages_Native_Component::text($section['content']['text']), false));
                $sectionId = $section['id'] ?? '';
                if (isset($attachments[$sectionId])) $blocks[] = self::image($attachments[$sectionId]);
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

    private static function composed(array $page, array $postIds, array $navigation, array $titles, array $actions, array $attachments, bool $localComposition, array $pendingActions = []): string
    {
        $path = $page['path'];
        $links = [];
        foreach ($navigation as $target) {
            $links[] = $target === $path ? '<span aria-current="page">' . esc_html($titles[$target]) . '</span>'
                : self::link($postIds[$target], $titles[$target]);
        }
        $blocks = ['<!-- wp:html --><nav class="miopages-draft-nav" aria-label="Site navigation">'
            . implode('', $links) . '</nav><!-- /wp:html -->'];
        $placedActions = [];
        $related = [];
        foreach ($actions as $action) {
            if ($action['from'] !== $path || $action['destination'] === $path) {
                continue;
            }
            if (isset($action['sectionId'])) {
                $placedActions[$action['sectionId']][] = $action;
            } else {
                $related[] = self::link($postIds[$action['destination']], $action['label']);
            }
        }
        $componentImages = [];
        foreach ($page['sections'] as $index => $section) {
            if (isset($attachments[$section['id']])) $componentImages['section-' . $index] = $attachments[$section['id']];
            elseif (self::wantsFpo($section)) $componentImages['section-' . $index] = ['fpo'=>$section['visual']];
            elseif ($localComposition && PHP_SAPI === 'cli') $componentImages['section-' . $index] = ['pendingLocal'=>true];
        }
        $componentActions = [];
        if ($localComposition && PHP_SAPI === 'cli' && $actions === []) {
            foreach ($pendingActions as $index => $label) {
                if (!is_string($label) || trim($label) === '') throw new InvalidArgumentException('Pending Action label required.');
                $componentActions['action-' . $index] = ['pendingLocal'=>true];
            }
        }
        foreach (array_values(array_filter($actions, static fn($action) => $action['from'] === $path)) as $index => $action) {
            $reference = $localComposition && isset($action['componentReference']) ? $action['componentReference'] : 'action-' . $index;
            if (!is_string($reference) || !preg_match('/^(action-[0-9]+|related-[a-f0-9-]+)$/D',$reference)) throw new InvalidArgumentException('Local Action reference refused.');
            $componentActions[$reference] = $action;
        }
        if ($localComposition && PHP_SAPI === 'cli') foreach($pendingActions as $pending) {
            if (is_array($pending) && ($pending['from']??null)===$path && preg_match('/^action-[0-9]+$/D',$pending['reference']??'')) {
                if(isset($componentActions[$pending['reference']])) throw new InvalidArgumentException('Local pending Action conflicts with active binding.');
                $componentActions[$pending['reference']]=['pendingLocal'=>true];
            }
        }
        foreach ($page['sections'] as $index => $section) {
            $type = $section['type'];
            if (!in_array($type, ['hero', 'intro', 'cta'], true) || (($index === 0) !== ($type === 'hero'))) {
                throw new InvalidArgumentException('Invalid managed composition hierarchy.');
            }
            $id = $section['id'];
            $tag = $type === 'hero' ? 'h1' : 'h2';
            $attrs = $type === 'hero' ? ' {"level":1}' : '';
            $content = '<!-- wp:heading' . $attrs . ' --><' . $tag . ' class="wp-block-heading">'
                . MioPages_Native_Component::text($section['content']['heading']) . '</' . $tag . '><!-- /wp:heading -->';
            if (($section['block']['version'] ?? null) === 2 && ($section['block']['mode'] ?? null) === 'section') {
                $levels = [];
                $collect = static function (array $node) use (&$collect, &$levels): void {
                    if (($node['kind'] ?? null) === 'heading') $levels[] = ['level'=>$node['level']??null,'text'=>$node['text']??null];
                    foreach ($node['children']??[] as $child) $collect($child);
                };
                $collect($section['block']['root']);
                $matched = array_filter($levels, static fn($heading) => $heading['level'] === ($type === 'hero' ? 1 : 2)
                    && $heading['text'] === $section['content']['heading']);
                $h1 = count(array_filter($levels, static fn($heading) => $heading['level'] === 1));
                if ($matched === [] || $h1 !== ($type === 'hero' ? 1 : 0)) throw new InvalidArgumentException('Authored Section heading differs.');
                $authored = self::semanticBlock($section['block'], $type === 'hero' ? 2 : 3, $componentImages, $componentActions, $postIds);
                // Core requested an image for this section but authored no placement:
                // place the acquired image, or its FPO frame, beside the authored content.
                $aside = '';
                if (!MioPages_Native_Component::hasImage($section['block']['root'])) {
                    if (isset($attachments[$id])) $aside = self::image($attachments[$id]);
                    elseif (self::wantsFpo($section)) $aside = MioPages_Native_Component::fpo($section['visual']);
                }
                $class = 'miopages-draft-section miopages-draft-' . $type . ' miopages-authored-section' . ($aside !== '' ? ' miopages-draft-with-image' : '');
                if ($aside !== '') $authored = '<!-- wp:group {"className":"miopages-draft-copy"} --><div class="wp-block-group miopages-draft-copy">' . $authored . '</div><!-- /wp:group -->' . $aside;
                $blocks[] = '<!-- wp:group {"tagName":"section","className":"' . $class . '"} -->'
                    . '<section class="wp-block-group ' . $class . '">' . $authored . '</section><!-- /wp:group -->';
                continue;
            }
            $content .= self::paragraph(nl2br(MioPages_Native_Component::text($section['content']['text']), false));
            if (!empty($placedActions[$id])) {
                $buttons = [];
                foreach ($placedActions[$id] as $action) {
                    $buttons[] = '<!-- wp:button --><div class="wp-block-button">'
                        . self::link($postIds[$action['destination']], $action['label'], 'wp-block-button__link wp-element-button')
                        . '</div><!-- /wp:button -->';
                }
                $content .= '<!-- wp:buttons --><div class="wp-block-buttons">' . implode('', $buttons) . '</div><!-- /wp:buttons -->';
            }
            if (array_key_exists('block', $section)) $content .= self::semanticBlock($section['block'], $type === 'hero' ? 2 : 3, $componentImages, $componentActions, $postIds);
            $media = $attachments[$id] ?? null;
            $fpo = !$media && self::wantsFpo($section) && !(array_key_exists('block', $section) && MioPages_Native_Component::hasImage($section['block']['root'] ?? null));
            $style = $type === 'cta' && empty($placedActions[$id]) ? 'intro' : $type;
            $class = 'miopages-draft-section miopages-draft-' . $style . ($media || $fpo ? ' miopages-draft-with-image' : '');
            $blocks[] = '<!-- wp:group {"tagName":"section","className":"' . $class . '"} -->'
                . '<section class="wp-block-group ' . $class . '">'
                . '<!-- wp:group {"className":"miopages-draft-copy"} --><div class="wp-block-group miopages-draft-copy">'
                . $content . '</div><!-- /wp:group -->' . ($media ? self::image($media) : ($fpo ? MioPages_Native_Component::fpo($section['visual']) : '')) . '</section><!-- /wp:group -->';
        }
        if ($related !== []) {
            $blocks[] = '<!-- wp:html --><nav class="miopages-draft-related" aria-label="Related pages">'
                . implode('', $related) . '</nav><!-- /wp:html -->';
        }
        $siteClass = 'miopages-composed' . ($localComposition && PHP_SAPI === 'cli' ? ' miopages-draft-creative' : '');
        return '<!-- wp:group {"className":"' . $siteClass . '"} --><div class="wp-block-group ' . $siteClass . '">'
            . implode("\n", $blocks) . '</div><!-- /wp:group -->';
    }

    private static function semanticText(mixed $text, int $bytes): string
    {
        if (!is_string($text) || trim($text) === '' || strlen($text) > $bytes || preg_match('/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/', $text)) {
            throw new InvalidArgumentException('Semantic draft text refused.');
        }
        return MioPages_Native_Component::text($text);
    }

    private static function semanticBlock(mixed $value, int $headingLevel, array $images = [], array $actions = [], array $postIds = []): string
    {
        if (!is_array($value)) throw new InvalidArgumentException('Semantic draft specification required.');
        if (($value['version'] ?? null) === 2) {
            require_once __DIR__ . '/class-miopages-native-component.php';
            return MioPages_Native_Component::render($value, $images, $actions, $postIds, true);
        }
        $keys = array_keys($value);
        sort($keys);
        if ($keys !== ['groups', 'layout', 'listStyle', 'name', 'purpose', 'version'] || $value['version'] !== 1
            || !is_string($value['name']) || strlen($value['name']) > 65 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $value['name'])
            || !in_array($value['layout'], ['stack', 'grid'], true) || !in_array($value['listStyle'], ['bullets', 'steps'], true)
            || !is_array($value['groups']) || !array_is_list($value['groups']) || $value['groups'] === []
            || strlen(json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) > 32000) {
            throw new InvalidArgumentException('Semantic draft specification refused.');
        }
        self::semanticText($value['purpose'], 1440);
        $class = 'miopages-semantic miopages-semantic-' . $value['layout'];
        $content = '<!-- wp:group {"className":"' . $class . '"} --><div class="wp-block-group ' . $class . '">';
        $heading = 'h' . $headingLevel;
        foreach ($value['groups'] as $group) {
            if (!is_array($group)) throw new InvalidArgumentException('Semantic draft group refused.');
            $keys = array_keys($group);
            sort($keys);
            if ($keys !== ['body', 'heading', 'items'] || !is_array($group['items']) || !array_is_list($group['items'])) {
                throw new InvalidArgumentException('Semantic draft group refused.');
            }
            $content .= '<!-- wp:group {"className":"miopages-semantic-group"} --><div class="wp-block-group miopages-semantic-group">'
                . '<!-- wp:heading' . ($headingLevel === 2 ? '' : ' {"level":' . $headingLevel . '}') . ' --><' . $heading . ' class="wp-block-heading">'
                . self::semanticText($group['heading'], 960) . '</' . $heading . '><!-- /wp:heading -->'
                . self::paragraph(nl2br(self::semanticText($group['body'], 6000), false));
            if ($group['items'] !== []) {
                $ordered = $value['listStyle'] === 'steps';
                $tag = $ordered ? 'ol' : 'ul';
                $content .= '<!-- wp:list' . ($ordered ? ' {"ordered":true}' : '') . ' --><' . $tag . ' class="wp-block-list">';
                foreach ($group['items'] as $item) {
                    $content .= '<!-- wp:list-item --><li>' . self::semanticText($item, 1440) . '</li><!-- /wp:list-item -->';
                }
                $content .= '</' . $tag . '><!-- /wp:list -->';
            }
            $content .= '</div><!-- /wp:group -->';
        }
        return $content . '</div><!-- /wp:group -->';
    }

    private static function image(array $attachment): string
    {
        $id = $attachment['id'];
        $image = $attachment['media'];
        // Exactly what WordPress's own image block saves, so the editor accepts it. Width and
        // height attributes are not part of that markup; the image keeps its own proportions.
        return '<!-- wp:image {"id":' . $id . '} --><figure class="wp-block-image">'
            . '<img src="' . MioPages_Native_Component::href(MioPages_Native_Draft_Media::url($id)) . '" alt="' . htmlspecialchars($image['alt'], ENT_COMPAT | ENT_SUBSTITUTE, 'UTF-8')
            . '" class="wp-image-' . $id . '"/></figure><!-- /wp:image -->';
    }

    /** Core asked for an image (asset-needed / rights-review) in its section visual. */
    private static function wantsFpo(array $section): bool
    {
        return is_array($section['visual'] ?? null) && in_array($section['visual']['status'] ?? null, ['asset-needed','rights-review'], true);
    }

    private static function paragraph(string $html): string
    {
        return '<!-- wp:paragraph --><p>' . $html . '</p><!-- /wp:paragraph -->';
    }

    private static function link(int $postId, string $label, string $class = ''): string
    {
        return '<a' . ($class !== '' ? ' class="' . esc_attr($class) . '"' : '') . ' href="'
            . MioPages_Native_Component::href(home_url('/?page_id=' . $postId . '&preview=true')) . '">'
            . MioPages_Native_Component::text($label) . '</a>';
    }
}
