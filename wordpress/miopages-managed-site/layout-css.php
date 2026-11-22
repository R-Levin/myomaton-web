<?php
/** Column templates for Core's layout classes. Pure function; no WordPress calls. */
declare(strict_types=1);

/**
 * Column templates for Core's layout classes. A block carries "miopages-cols-7-5"
 * (7fr 5fr; "1p5" is 1.5fr) instead of an inline style, so the WordPress editor
 * accepts and keeps it. Only well-formed class tokens become CSS.
 */
function miopages_layout_css(string $content): string {
    if (!preg_match_all('/(?<![\w-])miopages-cols-((?:[0-9]{1,2}(?:p[0-9]{1,2})?)(?:-[0-9]{1,2}(?:p[0-9]{1,2})?){1,11})(?![\w-])/', $content, $found)) return '';
    $css = '';
    foreach (array_unique($found[1]) as $token) {
        $tracks = array_map(static fn(string $w): string => 'minmax(0,' . str_replace('p', '.', $w) . 'fr)', explode('-', $token));
        $css .= '.miopages-cols-' . $token . '{--mp-columns:' . implode(' ', $tracks) . ';}';
    }
    return $css;
}
