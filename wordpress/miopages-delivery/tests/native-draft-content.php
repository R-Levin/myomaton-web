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

$local = $candidate;
$local['pages'][0]['composition'] = 'managed-v1';
$local['pages'][0]['navigationLabel'] = 'Home';
$local['pages'][0]['sections'][0]['id'] = 'hero';
$local['pages'][0]['sections'][0]['type'] = 'hero';
$local['pages'][0]['sections'][0]['block'] = ['version' => 1, 'name' => 'responsibility-handoff', 'purpose' => 'Clarify who handles the work',
    'layout' => 'grid', 'listStyle' => 'steps', 'groups' => [
        ['heading' => 'You confirm the details', 'body' => 'Bring what you know about your business.', 'items' => ['Confirm important facts']],
        ['heading' => 'We organize the next steps', 'body' => 'Give visitors a clear path forward.', 'items' => []],
    ]];
refuses(fn() => MioPages_Native_Draft_Content::posts($local, $ids));
$preview = MioPages_Native_Draft_Content::posts($local, $ids, [], true);
check(str_contains($preview['/']['post_content'], 'miopages-semantic-grid'), 'The local composition is rendered, not flattened.');
check(str_contains($preview['/']['post_content'], '<ol class="wp-block-list">'), 'Ordered content is accessible.');
check(str_contains($preview['/']['post_content'], '<h2 class="wp-block-heading">You confirm the details</h2>'), 'The Hero subgroup maintains heading hierarchy.');
$local['pages'][0]['sections'][0]['block']['groups'][0]['body'] = '<script>unsafe()</script>';
refuses(fn() => MioPages_Native_Draft_Content::posts($local, $ids, [], true));
echo "Native draft content projection passed.\n";
