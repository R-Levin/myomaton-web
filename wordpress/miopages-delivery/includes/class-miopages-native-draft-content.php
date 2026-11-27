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
     *
     * $reviewDraft: a private draft for Operator review (owner decision, Nov 22). It may
     * carry Core's own page designs, marked FPO frames, "content needed" notices and
     * not-yet-connected Actions. A release (false) carries none of these.
     */
    public static function posts(array $candidate, array $postIds, array $attachments = [], bool $reviewDraft = false, array $pendingActions = []): array
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
            if (!$reviewDraft && isset($action['componentReference'])) throw new InvalidArgumentException('Component Action reference belongs only in review drafts.');
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
                if (array_key_exists('block', $section) && (!$reviewDraft || ($page['composition'] ?? null) !== 'managed-v1')) {
                    throw new InvalidArgumentException('Core-designed blocks belong only in review drafts.');
                }
            }
            if (array_key_exists('composition', $page)) {
                if ($page['composition'] !== 'managed-v1') {
                    throw new InvalidArgumentException('Unknown managed composition.');
                }
                $posts[$path] = [
                    'ID' => $postIds[$path], 'post_type' => 'page', 'post_status' => 'draft',
                    'post_title' => $page['title'],
                    'post_content' => self::composed($page, $postIds, $navigation, $labels, $actions, $attachments, $reviewDraft, $pendingActions)
                        . self::footer($candidate['footer'] ?? null, $postIds, $labels),
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
                // In a review draft every block names its Core text, so a Note on it can be answered
                // (the Review summary is a plain page, Nov 23).
                $origin = $reviewDraft && is_string($section['id'] ?? null) ? $section['id'] : '';
                $blocks[] = '<!-- wp:heading' . ($origin === '' ? '' : ' ' . json_encode(MioPages_Native_Component::origin($origin . ':heading'),
                        JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . ' --><h2 class="wp-block-heading">'
                    . MioPages_Native_Component::text($section['content']['heading']) . '</h2><!-- /wp:heading -->';
                $blocks[] = self::paragraph(nl2br(MioPages_Native_Component::text($section['content']['text']), false), $origin === '' ? '' : $origin . ':text');
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

    private static function composed(array $page, array $postIds, array $navigation, array $titles, array $actions, array $attachments, bool $reviewDraft, array $pendingActions = []): string
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
            elseif ($reviewDraft) $componentImages['section-' . $index] = ['pending'=>true];
            // Further pictures Core asked for in this section, each in its own frame.
            foreach (self::moreVisuals($section) as $n => $visual) {
                $key = 'section-' . $index . '-' . ($n + 1);
                if (isset($attachments[$visual['id']])) $componentImages[$key] = $attachments[$visual['id']];
                elseif (in_array($visual['status'], ['asset-needed','rights-review'], true)) $componentImages[$key] = ['fpo'=>array_diff_key($visual, ['id'=>true])];
                elseif ($reviewDraft) $componentImages[$key] = ['pending'=>true];
            }
        }
        $componentActions = [];
        if ($reviewDraft && $actions === []) {
            foreach ($pendingActions as $index => $label) {
                if (!is_string($label) || trim($label) === '') throw new InvalidArgumentException('Pending Action label required.');
                $componentActions['action-' . $index] = ['pending'=>true];
            }
        }
        foreach (array_values(array_filter($actions, static fn($action) => $action['from'] === $path)) as $index => $action) {
            $reference = $reviewDraft && isset($action['componentReference']) ? $action['componentReference'] : 'action-' . $index;
            if (!is_string($reference) || !preg_match('/^(action-[0-9]+|related-[a-f0-9-]+)$/D',$reference)) throw new InvalidArgumentException('Action reference refused.');
            $componentActions[$reference] = $action;
        }
        if ($reviewDraft) foreach($pendingActions as $pending) {
            if (is_array($pending) && ($pending['from']??null)===$path && preg_match('/^action-[0-9]+$/D',$pending['reference']??'')) {
                if(isset($componentActions[$pending['reference']])) throw new InvalidArgumentException('Pending Action conflicts with active binding.');
                $componentActions[$pending['reference']]=['pending'=>true];
            }
        }
        foreach ($page['sections'] as $index => $section) {
            $type = $section['type'];
            if (!in_array($type, ['hero', 'intro', 'cta'], true) || (($index === 0) !== ($type === 'hero'))) {
                throw new InvalidArgumentException('Invalid managed composition hierarchy.');
            }
            $id = $section['id'];
            $tag = $type === 'hero' ? 'h1' : 'h2';
            // In a review draft each text block names Core's text it came from (read-back).
            $origin = $reviewDraft ? (string) $id : '';
            $headingAttrs = ($type === 'hero' ? ['level' => 1] : []) + MioPages_Native_Component::origin($origin === '' ? '' : $origin . ':heading');
            $attrs = $headingAttrs === [] ? '' : ' ' . json_encode($headingAttrs, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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
                $authored = self::semanticBlock($section['block'], $type === 'hero' ? 2 : 3, $componentImages, $componentActions, $postIds, $origin);
                // Core requested an image for this section but authored no placement:
                // place the acquired image, or its FPO frame, beside the authored content.
                $aside = '';
                if (!MioPages_Native_Component::hasImage($section['block']['root'], 'section-' . $index)) {
                    if (isset($attachments[$id])) $aside = self::image($attachments[$id]);
                    elseif (self::wantsFpo($section)) $aside = MioPages_Native_Component::fpo($section['visual']);
                }
                $aside .= self::unplaced($section, $index, $componentImages);
                $class = 'miopages-draft-section miopages-draft-' . $type . ' miopages-authored-section' . ($aside !== '' ? ' miopages-draft-with-image' : '');
                if ($aside !== '') $authored = '<!-- wp:group {"className":"miopages-draft-copy"} --><div class="wp-block-group miopages-draft-copy">' . $authored . '</div><!-- /wp:group -->' . $aside;
                $blocks[] = '<!-- wp:group {"tagName":"section","className":"' . $class . '"} -->'
                    . '<section class="wp-block-group ' . $class . '">' . $authored . '</section><!-- /wp:group -->';
                continue;
            }
            $content .= self::paragraph(nl2br(MioPages_Native_Component::text($section['content']['text']), false), $origin === '' ? '' : $origin . ':text');
            if (!empty($placedActions[$id])) {
                $buttons = [];
                foreach ($placedActions[$id] as $action) {
                    $buttons[] = '<!-- wp:button --><div class="wp-block-button">'
                        . self::link($postIds[$action['destination']], $action['label'], 'wp-block-button__link wp-element-button')
                        . '</div><!-- /wp:button -->';
                }
                $content .= '<!-- wp:buttons --><div class="wp-block-buttons">' . implode('', $buttons) . '</div><!-- /wp:buttons -->';
            }
            if (array_key_exists('block', $section)) $content .= self::semanticBlock($section['block'], $type === 'hero' ? 2 : 3, $componentImages, $componentActions, $postIds, $origin);
            $media = $attachments[$id] ?? null;
            $fpo = !$media && self::wantsFpo($section) && !(array_key_exists('block', $section) && MioPages_Native_Component::hasImage($section['block']['root'] ?? null, 'section-' . $index));
            $more = self::unplaced($section, $index, $componentImages);
            $style = $type === 'cta' && empty($placedActions[$id]) ? 'intro' : $type;
            $class = 'miopages-draft-section miopages-draft-' . $style . ($media || $fpo ? ' miopages-draft-with-image' : '');
            $blocks[] = '<!-- wp:group {"tagName":"section","className":"' . $class . '"} -->'
                . '<section class="wp-block-group ' . $class . '">'
                . '<!-- wp:group {"className":"miopages-draft-copy"} --><div class="wp-block-group miopages-draft-copy">'
                . $content . '</div><!-- /wp:group -->' . ($media ? self::image($media) : ($fpo ? MioPages_Native_Component::fpo($section['visual']) : '')) . $more . '</section><!-- /wp:group -->';
        }
        if ($related !== []) {
            $blocks[] = '<!-- wp:html --><nav class="miopages-draft-related" aria-label="Related pages">'
                . implode('', $related) . '</nav><!-- /wp:html -->';
        }
        $siteClass = 'miopages-composed' . ($reviewDraft ? ' miopages-draft-creative' : '');
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

    private static function semanticBlock(mixed $value, int $headingLevel, array $images = [], array $actions = [], array $postIds = [], string $origin = ''): string
    {
        if (!is_array($value)) throw new InvalidArgumentException('Semantic draft specification required.');
        if (($value['version'] ?? null) === 2) {
            require_once __DIR__ . '/class-miopages-native-component.php';
            return MioPages_Native_Component::render($value, $images, $actions, $postIds, true, $origin);
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
        foreach ($value['groups'] as $groupIndex => $group) {
            if (!is_array($group)) throw new InvalidArgumentException('Semantic draft group refused.');
            // In a review draft each text names Core's text: "<section>:g<group>/heading|body|i<item>".
            $named = static fn(string $part): string => $origin === '' ? '' : ' ' . json_encode(MioPages_Native_Component::origin($origin . ':g' . $groupIndex . '/' . $part),
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $keys = array_keys($group);
            sort($keys);
            if ($keys !== ['body', 'heading', 'items'] || !is_array($group['items']) || !array_is_list($group['items'])) {
                throw new InvalidArgumentException('Semantic draft group refused.');
            }
            $content .= '<!-- wp:group {"className":"miopages-semantic-group"} --><div class="wp-block-group miopages-semantic-group">'
                . '<!-- wp:heading' . ($origin === '' ? ($headingLevel === 2 ? '' : ' {"level":' . $headingLevel . '}')
                    : ' ' . json_encode(($headingLevel === 2 ? [] : ['level' => $headingLevel]) + MioPages_Native_Component::origin($origin . ':g' . $groupIndex . '/heading'),
                        JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
                . ' --><' . $heading . ' class="wp-block-heading">'
                . self::semanticText($group['heading'], 960) . '</' . $heading . '><!-- /wp:heading -->'
                . self::paragraph(nl2br(self::semanticText($group['body'], 6000), false), $origin === '' ? '' : $origin . ':g' . $groupIndex . '/body');
            if ($group['items'] !== []) {
                $ordered = $value['listStyle'] === 'steps';
                $tag = $ordered ? 'ol' : 'ul';
                $content .= '<!-- wp:list' . ($ordered ? ' {"ordered":true}' : '') . ' --><' . $tag . ' class="wp-block-list">';
                foreach ($group['items'] as $itemIndex => $item) {
                    $content .= '<!-- wp:list-item' . $named('i' . $itemIndex) . ' --><li>' . self::semanticText($item, 1440) . '</li><!-- /wp:list-item -->';
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

    /**
     * The site's footer, written by Core in the Site plan (the Principal, Nov 27). It travels with every
     * page; the theme shows it in the site footer. Marked so the theme can find it.
     */
    private static function footer(mixed $footer, array $postIds, array $labels): string
    {
        if ($footer === null) return '';
        if (!is_array($footer) || !is_array($footer['columns'] ?? null) || !array_is_list($footer['columns'])
            || !(is_string($footer['note'] ?? null) || ($footer['note'] ?? null) === null)) throw new InvalidArgumentException('Native draft footer refused.');
        $html = '';
        foreach ($footer['columns'] as $column) {
            $heading = $column['heading'] ?? null; $text = $column['text'] ?? null; $links = $column['links'] ?? null;
            if (!(is_string($heading) || $heading === null) || !(is_string($text) || $text === null) || !is_array($links) || !array_is_list($links)) {
                throw new InvalidArgumentException('Native draft footer refused.');
            }
            $items = '';
            foreach ($links as $path) {
                if (!is_string($path) || !isset($postIds[$path], $labels[$path])) throw new InvalidArgumentException('Native draft footer link refused.');
                $items .= '<li>' . self::link($postIds[$path], $labels[$path]) . '</li>';
            }
            $html .= '<div class="miopages-footer-column">'
                . ($heading !== null ? '<p class="miopages-footer-heading">' . MioPages_Native_Component::text($heading) . '</p>' : '')
                . ($text !== null ? '<p class="miopages-footer-text">' . nl2br(MioPages_Native_Component::text($text), false) . '</p>' : '')
                . ($items !== '' ? '<ul class="miopages-footer-links">' . $items . '</ul>' : '') . '</div>';
        }
        $note = $footer['note'] !== null ? '<p class="miopages-footer-note">' . MioPages_Native_Component::text($footer['note']) . '</p>' : '';
        return "
" . '<!-- wp:html --><!-- miopages-site-footer --><div class="miopages-site-footer"><div class="miopages-footer-columns">'
            . $html . '</div>' . $note . '</div><!-- /miopages-site-footer --><!-- /wp:html -->';
    }

    /** A section's further pictures (design rules: Core decides how many), each with its frame identity. */
    private static function moreVisuals(array $section): array
    {
        $more = $section['moreVisuals'] ?? [];
        if (!is_array($more) || !array_is_list($more)) throw new InvalidArgumentException('Native draft pictures refused.');
        foreach ($more as $visual) {
            if (!is_array($visual) || !is_string($visual['id'] ?? null) || !is_string($visual['brief'] ?? null) || !is_string($visual['purpose'] ?? null)
                || !is_string($visual['altIntent'] ?? null) || !in_array($visual['status'] ?? null, ['text-only','asset-needed','rights-review'], true)) {
                throw new InvalidArgumentException('Native draft pictures refused.');
            }
        }
        return $more;
    }

    /** Further pictures Core's block did not place: they follow the section's content. */
    private static function unplaced(array $section, int $index, array $images): string
    {
        $html = '';
        foreach (self::moreVisuals($section) as $n => $visual) {
            $key = 'section-' . $index . '-' . ($n + 1);
            if (isset($section['block']['root']) && MioPages_Native_Component::hasImage($section['block']['root'], $key)) continue;
            $image = $images[$key] ?? null;
            if (isset($image['fpo'])) $html .= MioPages_Native_Component::fpo($image['fpo']);
            elseif (isset($image['id'])) $html .= self::image($image);
        }
        return $html;
    }

    /** Core asked for an image (asset-needed / rights-review) in its section visual. */
    private static function wantsFpo(array $section): bool
    {
        return is_array($section['visual'] ?? null) && in_array($section['visual']['status'] ?? null, ['asset-needed','rights-review'], true);
    }

    private static function paragraph(string $html, string $origin = ''): string
    {
        return '<!-- wp:paragraph' . ($origin === '' ? '' : ' ' . json_encode(MioPages_Native_Component::origin($origin), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
            . ' --><p>' . $html . '</p><!-- /wp:paragraph -->';
    }

    private static function link(int $postId, string $label, string $class = ''): string
    {
        return '<a' . ($class !== '' ? ' class="' . esc_attr($class) . '"' : '') . ' href="'
            . MioPages_Native_Component::href(home_url('/?page_id=' . $postId . '&preview=true')) . '">'
            . MioPages_Native_Component::text($label) . '</a>';
    }
}
