<?php
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');

function esc_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function esc_url(string $value): string
{
    return esc_html($value);
}
function home_url(string $value): string
{
    return 'https://development.example.test' . $value;
}
function check(bool $ok, string $message): void
{
    if (!$ok) {
        throw new RuntimeException($message);
    }
}
function refuses(callable $callback): void
{
    try {
        $callback();
    } catch (InvalidArgumentException $error) {
        return;
    }
    throw new RuntimeException('Expected draft projection refusal.');
}

require dirname(__DIR__) . '/includes/class-miopages-native-draft-content.php';
$candidate = [
    'pages' => [
        ['path' => '/', 'title' => 'Home', 'sections' => [
            ['type' => 'intro', 'content' => ['heading' => 'What’s next', 'text' => 'MioPages is transitioning.']],
        ]],
        ['path' => '/service', 'title' => 'Service', 'sections' => [
            ['type' => 'intro', 'content' => ['heading' => 'What to bring', 'text' => "Bring your site address.\nExample: <example>"]],
        ]],
    ],
    'navigation' => ['/', '/service'],
    'actions' => [['from' => '/', 'destination' => '/service', 'type' => 'page', 'label' => 'Explore the planned service']],
];
$ids = ['/' => 21, '/service' => 22];
$posts = MioPages_Native_Draft_Content::posts($candidate, $ids);
check(array_column($posts, 'post_status') === ['draft', 'draft'], 'Draft status is fixed.');
check(array_column($posts, 'ID') === [21, 22], 'Exact target IDs are retained.');
check(str_contains($posts['/']['post_content'], 'page_id=22&amp;preview=true'), 'Home links to the Service draft.');
check(str_contains($posts['/service']['post_content'], 'page_id=21&amp;preview=true'), 'Service links back to the Home draft.');
check(str_contains($posts['/']['post_content'], 'Explore the planned service'), 'The Home Action is included.');
check(!str_contains($posts['/service']['post_content'], 'Explore the planned service'), 'The Action stays on Home.');
check(str_contains($posts['/service']['post_content'], '&lt;example&gt;'), 'Draft text is escaped.');
refuses(fn() => MioPages_Native_Draft_Content::posts($candidate, ['/' => 21, '/service' => 21]));
refuses(fn() => MioPages_Native_Draft_Content::posts($candidate, ['/' => 21, '/foreign' => 22]));
$foreign = $candidate;
$foreign['actions'][0]['destination'] = '/foreign';
refuses(fn() => MioPages_Native_Draft_Content::posts($foreign, $ids));
$unsupported = $candidate;
$unsupported['actions'][0]['type'] = 'contact';
refuses(fn() => MioPages_Native_Draft_Content::posts($unsupported, $ids));
echo "Native draft content projection passed.\n";
