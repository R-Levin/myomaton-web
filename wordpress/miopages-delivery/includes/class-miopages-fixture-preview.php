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

        $html = '<div class="miopages-fixture-preview" style="max-width:1100px">';
        $html .= '<p><strong>Read-only prototype:</strong> WordPress content storage, theme parity, assets, signatures, approvals and publication have not been implemented.</p>';
        foreach ($data['pages'] as $page) {
            $html .= '<article style="margin:24px 0;padding:18px;border:1px solid #aaa;background:#fff">';
            $html .= '<h2>' . esc_html($page['title']) . ' <small>(' . esc_html($page['path']) . ')</small></h2>';
            foreach ($page['sections'] as $section) {
                $type = $section['type'];
                $body = $section['content'];
                $html .= '<section style="margin:12px 0;padding:15px;border-left:4px solid #6f56a2;background:#f7f5fb">';
                $html .= '<p style="margin:0;font-size:11px;letter-spacing:.07em;text-transform:uppercase">'
                    . esc_html($type) . '</p>';
                foreach (['eyebrow', 'heading', 'text'] as $field) {
                    if (isset($body[$field]) && is_string($body[$field]) && $body[$field] !== '') {
                        $tag = $field === 'heading' ? 'h3' : 'p';
                        $html .= '<' . $tag . '>' . nl2br(esc_html($body[$field]), false) . '</' . $tag . '>';
                    }
                }

                foreach (['items', 'extensions'] as $field) {
                    if (!is_array($body[$field] ?? null)) {
                        continue;
                    }
                    $html .= '<ul>';
                    foreach ($body[$field] as $item) {
                        if (!is_array($item)) {
                            continue;
                        }
                        $heading = is_string($item['heading'] ?? null) ? $item['heading'] : '';
                        $text = is_string($item['text'] ?? null) ? $item['text'] : '';
                        $html .= '<li><strong>' . esc_html($heading) . '</strong> '
                            . nl2br(esc_html($text), false) . '</li>';
                    }
                    $html .= '</ul>';
                }

                foreach (['actionId', 'secondaryActionId'] as $field) {
                    $id = $body[$field] ?? null;
                    if (is_string($id) && isset($actions[$id])) {
                        $action = $actions[$id];
                        // Display intent, but do not expose a clickable link to an unapproved target.
                        $html .= '<p><em>Proposed action: ' . esc_html($action['label'])
                            . ' (' . esc_html($action['path']) . ')</em></p>';
                    }
                }
                $html .= '</section>';
            }
            $html .= '</article>';
        }

        return $html . '</div>';
    }
}
