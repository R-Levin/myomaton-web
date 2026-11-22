<?php
/** Data-only original component projection into native Gutenberg block content. */
declare(strict_types=1);
if (!defined('ABSPATH')) exit;

final class MioPages_Native_Component
{
    /** Visible label for each kind of material Core marked as still needed. */
    private const NEEDS = [
        'need-testimonial'=>'Customer testimonial needed', 'need-price'=>'Pricing to be confirmed',
        'need-result'=>'Result or outcome needed', 'need-case-study'=>'Case study needed',
        'need-credential'=>'Credential or qualification needed', 'need-guarantee'=>'Guarantee terms to be confirmed',
        'need-contact'=>'Contact detail needed', 'need-team'=>'Team information needed', 'need-detail'=>'Business detail needed',
    ];

    /**
     * A clearly marked notice where Core's plan calls for material that does not exist
     * yet. It states what is needed; it is never presented as the material itself.
     */
    public static function placeholder(string $need, string $copy, string $class = ''): string
    {
        if (!isset(self::NEEDS[$need])) throw new InvalidArgumentException('Placeholder need refused.');
        $classes = trim('miopages-placeholder ' . $class);
        return '<!-- wp:html --><aside class="' . esc_attr($classes) . '" role="note" aria-label="' . esc_attr('Content needed: ' . self::NEEDS[$need]) . '">'
            . '<span class="miopages-placeholder-badge">Content needed</span>'
            . '<span class="miopages-placeholder-label">' . esc_html(self::NEEDS[$need]) . '</span>'
            . '<span class="miopages-placeholder-text">' . $copy . '</span>'
            . '</aside><!-- /wp:html -->';
    }

    public static function render(array $value, array $images, array $actions, array $postIds, bool $localPending = false): string
    {
        self::keys($value, ['version','name','purpose','mode','root']);
        if ($value['version'] !== 2 || !in_array($value['mode'], ['supplement','section'], true) || !is_string($value['name']) || strlen($value['name']) > 65
            || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $value['name'])) {
            throw new InvalidArgumentException('Native component identity refused.');
        }
        self::copy($value['purpose']);
        if ($value['mode'] === 'supplement' && self::hasTitle($value['root'])) {
            throw new InvalidArgumentException('Supporting component cannot introduce a Page title.');
        }
        $class = 'miopages-native-component miopages-component-' . $value['name'];
        return '<!-- wp:group ' . self::json(['className'=>$class,'metadata'=>['name'=>$value['name']]]) . ' -->'
            . '<div class="wp-block-group ' . $class . '">' . self::node($value['root'], $images, $actions, $postIds, 0, false, $localPending)
            . '</div><!-- /wp:group -->';
    }

    /**
     * A clearly marked for-position-only frame carrying Core's own visual brief.
     * Used only where Core requested an image and no approved acquired asset is
     * bound. It is never an image file and never real customer or project media.
     */
    public static function fpo(mixed $visual, string $class = ''): string
    {
        self::keys($visual, ['purpose','brief','altIntent','status']);
        if (!in_array($visual['status'], ['asset-needed','rights-review'], true)) throw new InvalidArgumentException('FPO requires an image request.');
        $label = $visual['status'] === 'rights-review' ? 'Selected image awaiting rights review' : 'Image for position only. Final art pending';
        $classes = trim('miopages-fpo ' . $class);
        return '<!-- wp:html --><figure class="' . esc_attr($classes) . '" role="img" aria-label="' . esc_attr('For position only: ' . $visual['altIntent']) . '">'
            . '<span class="miopages-fpo-badge" aria-hidden="true">FPO</span>'
            . '<span class="miopages-fpo-label" aria-hidden="true">' . esc_html($label) . '</span>'
            . '<span class="miopages-fpo-brief" aria-hidden="true">' . self::copy($visual['brief']) . '</span>'
            . '</figure><!-- /wp:html -->';
    }

    public static function hasImage(mixed $node): bool
    {
        if (!is_array($node)) return false;
        if (($node['kind'] ?? null) === 'image') return true;
        foreach (($node['children'] ?? []) as $child) if (self::hasImage($child)) return true;
        return false;
    }

    private static function hasTitle(mixed $node): bool
    {
        if (!is_array($node)) return false;
        if (($node['kind'] ?? null) === 'heading' && ($node['level'] ?? null) === 1) return true;
        foreach (($node['children'] ?? []) as $child) if (self::hasTitle($child)) return true;
        return false;
    }

    private static function keys(mixed $row, array $expected): void
    {
        if (!is_array($row) || array_is_list($row)) throw new InvalidArgumentException('Native component object refused.');
        $keys = array_keys($row);
        sort($keys); sort($expected);
        if ($keys !== $expected) throw new InvalidArgumentException('Native component fields refused.');
    }

    private static function copy(mixed $value): string
    {
        if (!is_string($value) || trim($value) === '' || preg_match('/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/', $value)) {
            throw new InvalidArgumentException('Native component text refused.');
        }
        return esc_html($value);
    }

    private static function json(array $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private static function node(mixed $node, array $images, array $actions, array $postIds, int $depth, bool $insideDetails = false, bool $localPending = false): string
    {
        if ($depth > 24) throw new InvalidArgumentException('Native component nesting refused.');
        self::keys($node, ['kind','text','level','items','ordered','reference','layout','children']);
        $kind = $node['kind'];
        if (!in_array($kind, ['group','heading','paragraph','list','image','action','separator','details','placeholder'], true)
            || !is_array($node['items']) || !array_is_list($node['items'])
            || !is_array($node['children']) || !array_is_list($node['children']) || !is_bool($node['ordered'])) {
            throw new InvalidArgumentException('Native component structure refused.');
        }
        $layout = $node['layout'];
        self::keys($layout, ['arrangement','columns','gap','inset','surface','align','measure','typeScale','span','mobileOrder','border','rounded']);
        $sizes = ['none','small','medium','large'];
        if (!in_array($layout['arrangement'], ['flow','row','columns'], true)
            || !in_array($layout['gap'], $sizes, true) || !in_array($layout['inset'], $sizes, true)
            || !in_array($layout['surface'], ['none','light','brand','tonal','strong','supporting','contrast'], true)
            || !in_array($layout['align'], ['start','center','end','stretch'], true)
            || !in_array($layout['measure'], ['narrow','reading','wide','full'], true)
            || !in_array($layout['typeScale'], ['small','body','lead','display'], true)
            || !is_int($layout['span']) || $layout['span'] < 1 || $layout['span'] > 12 || $layout['mobileOrder'] !== 0
            || !is_bool($layout['border']) || !is_bool($layout['rounded'])
            || !is_array($layout['columns']) || !array_is_list($layout['columns'])) {
            throw new InvalidArgumentException('Native component style refused.');
        }
        $columns = [];
        foreach ($layout['columns'] as $width) {
            if ((!is_int($width) && !is_float($width)) || !is_finite((float)$width) || $width <= 0 || $width > 12) {
                throw new InvalidArgumentException('Native component column refused.');
            }
            $columns[] = 'minmax(0,' . $width . 'fr)';
        }
        if (($layout['arrangement'] === 'columns' && (count($columns) < 2 || count($columns) > 12))
            || ($layout['arrangement'] !== 'columns' && $columns !== [])
            || (!in_array($kind, ['group','details'], true) && $node['children'] !== [])
            || ($kind === 'group' && $node['children'] === [])
            || ($kind === 'details' && ($insideDetails || $node['children'] === []))
            || ($kind !== 'list' && $node['items'] !== []) || ($kind === 'list' && $node['items'] === [])) {
            throw new InvalidArgumentException('Native component child contract refused.');
        }
        $hasText = in_array($kind, ['heading','paragraph','action','details','placeholder'], true);
        $copy = $hasText ? self::copy($node['text']) : '';
        // Image text is retained planning intent, never approved alt text or visitor copy.
        if (in_array($kind, ['image','list'], true) && $node['text'] !== null) self::copy($node['text']);
        if ((!$hasText && !in_array($kind, ['image','list'], true) && $node['text'] !== null)
            || ($kind === 'heading' ? !is_int($node['level']) || $node['level'] < 1 || $node['level'] > 6 : $node['level'] !== null)
            || ($kind === 'placeholder' ? !is_string($node['reference']) || !isset(self::NEEDS[$node['reference']])
                : (in_array($kind, ['image','action'], true) ? !is_string($node['reference'])
                || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/D', $node['reference']) : $node['reference'] !== null))) {
            throw new InvalidArgumentException('Native component content refused.');
        }
        $nativeClass = match ($kind) {
            'group'=>'wp-block-group', 'heading'=>'wp-block-heading', 'list'=>'wp-block-list',
            'details'=>'wp-block-details', 'separator'=>'wp-block-separator has-alpha-channel-opacity',
            'image'=>'wp-block-image', 'action'=>'wp-block-button', default=>'',
        };
        $class = trim($nativeClass . ' miopages-node miopages-node-' . $layout['arrangement'])
            . ' miopages-node-gap-' . $layout['gap'] . ' miopages-node-inset-' . $layout['inset']
            . ' miopages-node-surface-' . $layout['surface'] . ' miopages-node-align-' . $layout['align']
            . ' miopages-node-measure-' . $layout['measure'] . ' miopages-node-type-' . $layout['typeScale']
            . ($layout['border'] ? ' miopages-node-border' : '') . ($layout['rounded'] ? ' miopages-node-rounded' : '');
        $style = '--mp-span:' . $layout['span'] . ';' . ($columns ? '--mp-columns:' . implode(' ', $columns) . ';' : '');
        $attrs = ' class="' . $class . '" style="' . esc_attr($style) . '"';
        $block = self::json(['className'=>$class]);
        $children = '';
        foreach ($node['children'] as $child) $children .= self::node($child, $images, $actions, $postIds, $depth + 1, $insideDetails || $kind === 'details', $localPending);
        if ($kind === 'group') return '<!-- wp:group ' . $block . ' --><div' . $attrs . '>' . $children . '</div><!-- /wp:group -->';
        if ($kind === 'heading') {
            $tag = 'h' . $node['level'];
            return '<!-- wp:heading ' . self::json(['level'=>$node['level'],'className'=>$class]) . ' --><' . $tag . $attrs . '>'
                . $copy . '</' . $tag . '><!-- /wp:heading -->';
        }
        if ($kind === 'paragraph') return '<!-- wp:paragraph ' . $block . ' --><p' . $attrs . '>' . nl2br($copy, false) . '</p><!-- /wp:paragraph -->';
        if ($kind === 'list') {
            $tag = $node['ordered'] ? 'ol' : 'ul';
            $items = '';
            foreach ($node['items'] as $item) $items .= '<!-- wp:list-item --><li>' . self::copy($item) . '</li><!-- /wp:list-item -->';
            return ($node['text'] !== null ? '<!-- wp:paragraph --><p>' . self::copy($node['text']) . '</p><!-- /wp:paragraph -->' : '')
                . '<!-- wp:list ' . self::json(['ordered'=>$node['ordered'],'className'=>$class]) . ' --><' . $tag . $attrs . '>' . $items
                . '</' . $tag . '><!-- /wp:list -->';
        }
        if ($kind === 'details') return '<!-- wp:details ' . $block . ' --><details' . $attrs . '><summary>' . $copy . '</summary>'
            . $children . '</details><!-- /wp:details -->';
        if ($kind === 'placeholder') return self::placeholder($node['reference'], $copy, $class);
        if ($kind === 'separator') return '<!-- wp:separator ' . $block . ' --><hr' . $attrs . ' /><!-- /wp:separator -->';
        $reference = $node['reference'];
        if ($kind === 'image') {
            $image = $images[$reference] ?? null;
            if (isset($image['fpo'])) return self::fpo($image['fpo'], $class);
            if ($localPending && PHP_SAPI === 'cli' && ($image['pendingLocal'] ?? false) === true) {
                return '<!-- wp:paragraph --><p class="miopages-pending-media" role="note">Image placement awaiting asset review.</p><!-- /wp:paragraph -->';
            }
            if (!$image || !is_int($image['id']) || $image['id'] < 1) throw new InvalidArgumentException('Native component media is unbound.');
            return '<!-- wp:image ' . self::json(['id'=>$image['id'],'className'=>$class]) . ' --><figure' . $attrs . '><img src="'
                 . esc_url(MioPages_Native_Draft_Media::url($image['id'])) . '" class="wp-image-' . $image['id'] . '" alt="' . esc_attr($image['media']['alt'])
                . '" width="' . (int)$image['media']['width'] . '" height="' . (int)$image['media']['height'] . '" /></figure><!-- /wp:image -->';
        }
        $action = $actions[$reference] ?? null;
        if ($localPending && PHP_SAPI === 'cli' && ($action['pendingLocal'] ?? false) === true) {
            return '<!-- wp:paragraph --><p class="miopages-pending-action"><span aria-disabled="true">' . $copy . ' — preview only; submissions disabled</span></p><!-- /wp:paragraph -->';
        }
        if (!$action || !isset($postIds[$action['destination']])) throw new InvalidArgumentException('Native component Action is unbound.');
        return '<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button ' . $block . ' --><div' . $attrs
            . '><a class="wp-block-button__link wp-element-button" href="'
            . esc_url(home_url('/?page_id=' . $postIds[$action['destination']] . '&preview=true')) . '">' . $copy
            . '</a></div><!-- /wp:button --></div><!-- /wp:buttons -->';
    }
}
