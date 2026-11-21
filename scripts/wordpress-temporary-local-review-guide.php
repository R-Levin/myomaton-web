<?php
/** Removable engineering-review annotation, outside customer Page content. */
if (!defined('ABSPATH')) exit;
add_action('wp_body_open', static function () {
 if (PHP_SAPI !== 'cli-server' || ($_SERVER['HTTP_HOST'] ?? '') !== '127.0.0.1:4474' || !is_preview()) return;
 $root=dirname(ABSPATH); $id=get_queried_object_id(); $which=null;
 foreach (['source-aware-render.json','originals-render.json'] as $name) {
  $map=json_decode(file_get_contents($root.'/'.$name),true);
  if (in_array($id,$map['pages']??[],true)) { $which=['current'=>$name==='source-aware-render.json','version'=>$map['sourceVersion']??null];break; }
 }
 if (!$which) return;
 echo '<aside aria-label="Temporary review guide" style="margin:12px auto;padding:12px 16px;max-width:72rem;border:2px solid #35536b;border-radius:6px;background:#edf4f8;color:#183445;font:16px/1.5 system-ui,sans-serif"><strong>Actual local WordPress draft · '.esc_html(get_the_title($id)).'</strong><div>';
 echo $which['current']?'Engineering rendering of the saved Core candidate':'Earlier retained website candidate for comparison';
 if (is_int($which['version'])) echo ' · Core version '.esc_html((string)$which['version']);
 echo '. Shown for desktop/mobile content and layout inspection. This is separate from the hosted WordPress candidate and is not public.</div><small>Temporary development guide · no customer approval or publication implied</small></aside>';
},1);
