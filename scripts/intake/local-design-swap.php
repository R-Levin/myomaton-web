<?php
/** Local-only: swap the brand design on the local source-aware draft pages for a labelled test fixture, or restore. */
declare(strict_types=1);
[$self, $root, $mode] = $argv + [null, null, null];
$root = realpath($root); if (!$root || basename($root) !== 'p022-wp-validation') exit(2);
$_SERVER['HTTP_HOST'] = '127.0.0.1:4474'; putenv('MIOPAGES_FIXTURE_CASE=c0');
require $root . '/wordpress/wp-load.php';
$render = json_decode(file_get_contents($root . '/source-aware-render.json'), true, 512, JSON_THROW_ON_ERROR);
$backup = $root . '/design-swap-original-brand.json';
if (!is_file($backup)) {
    $orig = []; foreach ($render['pages'] as $route => $id) $orig[$id] = get_post_meta((int)$id, '_miopages_draft_brand', true);
    file_put_contents($backup, json_encode($orig, JSON_THROW_ON_ERROR));
}
$orig = json_decode(file_get_contents($backup), true, 512, JSON_THROW_ON_ERROR);
$p = fn($b, $t) => ['background' => $b, 'text' => $t];
$fixtures = [
  'A' => ['palette' => ['light'=>$p('#fbf7f0','#1d1a16'),'strong'=>$p('#e8dccb','#1d1a16'),'tonal'=>$p('#f1ebe2','#1d1a16'),'brand'=>$p('#1f5f4a','#ffffff'),
          'supporting'=>$p('#dbe8e1','#123528'),'contrast'=>$p('#14201b','#f5efe4'),'border'=>'#d8cdbd','muted'=>'#5a5247'],
          'typography'=>['headingFamily'=>'fraunces','bodyFamily'=>'work-sans','baseSize'=>17,'headingScale'=>3.2,'lineHeight'=>1.6,'headingWeight'=>600],
          'shape'=>'soft','density'=>'airy'],
  'B' => ['palette' => ['light'=>$p('#ffffff','#0b0b14'),'strong'=>$p('#eef0ff','#0b0b14'),'tonal'=>$p('#f3f4f8','#0b0b14'),'brand'=>$p('#2b2bd6','#ffffff'),
          'supporting'=>$p('#d9ff5c','#0b0b14'),'contrast'=>$p('#0b0b14','#ffffff'),'border'=>'#0b0b14','muted'=>'#4a4a5c'],
          'typography'=>['headingFamily'=>'space-grotesk','bodyFamily'=>'inter','baseSize'=>16,'headingScale'=>3.4,'lineHeight'=>1.5,'headingWeight'=>700],
          'shape'=>'square','density'=>'compact'],
  'C' => ['palette' => ['light'=>$p('#f4f6f8','#1f2430'),'strong'=>$p('#e4e9f0','#1f2430'),'tonal'=>$p('#efe7ec','#2a1a22'),'brand'=>$p('#7a2e4d','#ffffff'),
          'supporting'=>$p('#f7efe2','#3a2a14'),'contrast'=>$p('#2a1a22','#fbf3f6'),'border'=>'#cfd6df','muted'=>'#4d5566'],
          'typography'=>['headingFamily'=>'playfair-display','bodyFamily'=>'source-sans-3','baseSize'=>18,'headingScale'=>2.6,'lineHeight'=>1.7,'headingWeight'=>500],
          'shape'=>'round','density'=>'balanced'],
];
foreach ($render['pages'] as $route => $id) {
    $brand = $orig[$id];
    if ($mode !== 'restore') {
        if (!isset($fixtures[$mode])) exit(3);
        $brand['design'] = ['grammar'=>'core-designed','version'=>4,'motion'=>'minimal'] + $fixtures[$mode];
    }
    update_post_meta((int)$id, '_miopages_draft_brand', $brand);
}
echo json_encode(['status'=>'PASS','mode'=>$mode,'pages'=>count($render['pages'])]), PHP_EOL;
