<?php
/**
 * Read-only, admin-scoped renderer for the frozen C0 v3 proof fixture.
 * This is NOT the production release validator or publishing transport.
 */

if (!defined('ABSPATH')) {
    exit;
}

final class MioPages_Fixture_Preview
{
    private const SECTION_TYPES = ['hero', 'intro', 'relationship', 'collection', 'cta'];

    /**
     * @return array<string,mixed>|WP_Error
     */
    public static function parse(string $json)
    {
        try {
            $data = json_decode($json, true, 128, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            return new WP_Error('invalid_json', 'Fixture JSON could not be parsed.');
        }

        if (!is_array($data)
            || ($data['schema'] ?? '') !== 'miopages.wordpress.public-projection-fixture'
            || ($data['version'] ?? null) !== 1
            || ($data['publishable'] ?? null) !== false
            || !is_array($data['pages'] ?? null)
            || !is_array($data['actions'] ?? null)
            || !is_array($data['navigation'] ?? null)
            || count($data['pages']) !== 4) {
            return new WP_Error('fixture_gate', 'Only the explicitly nonpublishable C0 v3 proof fixture is accepted.');
        }

        $expectedPaths = ['/', '/service', '/experience', '/review'];
        $paths = [];
        $sectionCount = 0;
        foreach ($data['pages'] as $page) {
            if (!is_array($page) || !is_string($page['path'] ?? null)
                || !is_string($page['title'] ?? null) || !is_array($page['sections'] ?? null)) {
                return new WP_Error('fixture_page', 'Invalid page structure.');
            }
            $paths[] = $page['path'];
            foreach ($page['sections'] as $section) {
                if (!is_array($section)
                    || !in_array($section['type'] ?? null, self::SECTION_TYPES, true)
                    || !is_array($section['content'] ?? null)) {
                    return new WP_Error('fixture_section', 'Unknown section type or invalid section structure.');
                }
                ++$sectionCount;
            }
        }

        if ($paths !== $expectedPaths || $sectionCount !== 23) {
            return new WP_Error('fixture_inventory', 'C0 v3 must contain exactly the reviewed four routes and 23 sections.');
        }

        return $data;
    }

    /**
     * Visual proof only: deterministic, escaped HTML based on reviewed section types,
     * palette surfaces and recipes. This remains admin-only and nonpublishable.
     *
     * @param array<string,mixed> $data
     */
    public static function render(array $data): string
    {
        $actions = [];
        foreach ($data['actions'] as $action) {
            if (is_array($action) && is_string($action['id'] ?? null)
                && is_string($action['label'] ?? null)
                && in_array($action['path'] ?? '', ['/', '/service', '/experience', '/review'], true)) {
                $actions[$action['id']] = $action;
            }
        }

        $html = '<div class="miopages-fixture-preview">';
        $html .= '<p class="miopages-proof-warning">Protected development preview — not an approved release. '
            . 'Navigation and calls to action are illustrative and not clickable. '
            . 'Wordmark assets, illustrations, forms, publication and release transport are not implemented.</p>';

        foreach ($data['pages'] as $page) {
            $recipe = $page['recipe']['id'] ?? 'unknown';
            $recipe = is_string($recipe) && in_array($recipe, ['arrival', 'service', 'evidence', 'assessment'], true)
                ? $recipe : 'unknown';

            $html .= '<article class="miopages-proof-page miopages-recipe-' . esc_attr($recipe) . '">';
            $html .= '<header class="miopages-proof-header"><div class="miopages-proof-brand">MioPages'
                . '<span>Wordmark pending verified asset</span></div>';
            $html .= '<nav aria-label="Illustrative site navigation"><span class="miopages-proof-navitem">Home</span>';
            foreach ($data['navigation'] as $nav) {
                if (is_array($nav) && is_string($nav['label'] ?? null)
                    && in_array($nav['path'] ?? '', ['/service', '/experience', '/review'], true)) {
                    $html .= '<span class="miopages-proof-navitem">' . esc_html($nav['label']) . '</span>';
                }
            }
            $html .= '</nav></header>';
            $html .= '<div class="miopages-proof-meta">Private page preview · ' . esc_html($page['path'])
                . ' · ' . esc_html($recipe) . ' recipe</div>';

            foreach ($page['sections'] as $section) {
                $type = $section['type'];
                $body = $section['content'];
                $presentation = is_array($section['presentation'] ?? null) ? $section['presentation'] : [];
                $surface = $presentation['surface'] ?? 'light';
                $allowedSurfaces = ['light', 'strong', 'tonal', 'brand', 'supporting', 'contrast'];
                if (!is_string($surface) || !in_array($surface, $allowedSurfaces, true)) {
                    $surface = 'light';
                }
                $region = $presentation['region'] ?? 'connected';
                $allowedRegions = ['connected', 'emphasized', 'closing'];
                if (!is_string($region) || !in_array($region, $allowedRegions, true)) {
                    $region = 'connected';
                }
                $html .= '<section class="miopages-proof-section miopages-section-' . esc_attr($type)
                    . ' miopages-surface-' . esc_attr($surface)
                    . ' miopages-region-' . esc_attr($region) . '">';
                $html .= '<div class="miopages-proof-inner">';
                if (!empty($body['eyebrow']) && is_string($body['eyebrow'])) {
                    $html .= '<p class="miopages-proof-eyebrow">' . esc_html($body['eyebrow']) . '</p>';
                }
                if (!empty($body['heading']) && is_string($body['heading'])) {
                    $tag = $type === 'hero' ? 'h1' : 'h2';
                    $html .= '<' . $tag . '>' . esc_html($body['heading']) . '</' . $tag . '>';
                }
                if (!empty($body['text']) && is_string($body['text'])) {
                    $html .= '<p class="miopages-proof-body">' . nl2br(esc_html($body['text']), false) . '</p>';
                }

                foreach (['items', 'extensions'] as $field) {
                    if (!is_array($body[$field] ?? null)) {
                        continue;
                    }
                    $html .= '<ul class="miopages-proof-cards ' . ($field === 'extensions' ? 'miopages-proof-extensions' : '') . '">';
                    foreach ($body[$field] as $item) {
                        if (!is_array($item)) {
                            continue;
                        }
                        $heading = is_string($item['heading'] ?? null) ? $item['heading'] : '';
                        $text = is_string($item['text'] ?? null) ? $item['text'] : '';
                        $html .= '<li class="miopages-proof-card"><h3>' . esc_html($heading) . '</h3><p>'
                            . nl2br(esc_html($text), false) . '</p></li>';
                    }
                    $html .= '</ul>';
                }

                if (is_array($body['rows'] ?? null) && is_array($body['parties'] ?? null)) {
                    $parties = [];
                    foreach ($body['parties'] as $party) {
                        if (is_array($party) && is_string($party['id'] ?? null)
                            && is_string($party['label'] ?? null)) {
                            $parties[$party['id']] = $party['label'];
                        }
                    }
                    $html .= '<div class="miopages-proof-responsibilities">';
                    foreach ($body['rows'] as $row) {
                        if (!is_array($row) || !is_array($row['cells'] ?? null)) {
                            continue;
                        }
                        $label = is_string($row['label'] ?? null) ? $row['label'] : '';
                        $html .= '<div class="miopages-proof-responsibility"><h3>' . esc_html($label) . '</h3>';
                        $html .= '<div class="miopages-proof-responsibility-cells">';
                        foreach ($row['cells'] as $cell) {
                            if (!is_array($cell) || !is_string($cell['text'] ?? null)
                                || !is_string($cell['partyId'] ?? null)
                                || !isset($parties[$cell['partyId']])) {
                                continue;
                            }
                            $html .= '<p><strong>' . esc_html($parties[$cell['partyId']]) . '</strong>'
                                . nl2br(esc_html($cell['text']), false) . '</p>';
                        }
                        $html .= '</div></div>';
                    }
                    $html .= '</div>';
                }

                $html .= '<div class="miopages-proof-actions">';
                foreach (['actionId', 'secondaryActionId'] as $field) {
                    $id = $body[$field] ?? null;
                    if (is_string($id) && isset($actions[$id])) {
                        $action = $actions[$id];
                        $html .= '<span class="miopages-proof-action" aria-label="Illustrative action only">'
                            . esc_html($action['label']) . '<span class="miopages-proof-action-path">'
                            . esc_html($action['path']) . '</span></span>';
                    }
                }
                $html .= '</div></div></section>';
            }
            $html .= '<footer class="miopages-proof-footer">MioPages · Private C0 v3 visual-development proof · '
                . esc_html($page['path']) . '</footer></article>';
        }

        return $html . '</div>';
    }
}
