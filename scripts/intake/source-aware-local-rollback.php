<?php
/** Existing disposable WordPress only: exact content/metadata/routing round trip. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'||count($argv)!==3||!extension_loaded('pdo_sqlite'))exit(1);
$root=realpath($argv[1]);$name=$argv[2];
if(!$root||basename($root)!=='p022-wp-validation'||str_contains(str_replace('\\','/',$root),'/public_html/')||
 !preg_match('/^source-aware-before-(home|site)-[1-9][0-9]*(?:-media)?\\.json$/D',$name))exit(2);
$sourceAwareCase='41a83e7e-1765-4517-941a-b2b151bb7c4a';$keys=['_miopages_source_aware_case','_miopages_source_candidate_digest','_miopages_draft_brand'];
$file=$root.'/'.$name;if(!is_file($file)||is_link($file))exit(3);
$baseline=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
if(!isset($baseline['metadata'],$baseline['pages'],$baseline['renderText'])||!is_string($baseline['renderText']))exit(4);
$priorRender=json_decode($baseline['renderText'],true,512,JSON_THROW_ON_ERROR);
$currentText=file_get_contents($root.'/source-aware-render.json');$render=json_decode($currentText,true,512,JSON_THROW_ON_ERROR);
if(($render['case']??null)!==$sourceAwareCase||($priorRender['case']??null)!==$sourceAwareCase||!count($baseline['pages']))exit(5);
$_SERVER['HTTP_HOST']='127.0.0.1:4474';putenv('MIOPAGES_FIXTURE_CASE=c0');require $root.'/wordpress/wp-load.php';
if(get_option('home')!=='http://127.0.0.1:4473'||get_stylesheet()!=='miopages-managed-site')exit(6);
$user=get_user_by('login','localreview');if(!$user)exit(7);wp_set_current_user($user->ID);
$fields=array_flip(['ID','post_title','post_content','post_excerpt','post_name','post_status','post_type']);
$read=static function(array $ids)use($fields,$keys,$sourceAwareCase):array{
 $pages=[];$metadata=[];
 foreach($ids as $route=>$id){
  $p=get_post($id,ARRAY_A);if(!is_int($id)||$id<=202||!$p||$p['post_type']!=='page'||$p['post_status']!=='draft'||get_post_meta($id,'_miopages_source_aware_case',true)!==$sourceAwareCase)throw new RuntimeException('Exact owned draft identity required');
  $pages[$route]=array_intersect_key($p,$fields);
  foreach($keys as $key)$metadata[$route][$key]=get_post_meta($id,$key,true);
 }
 return ['pages'=>$pages,'metadata'=>$metadata];
};
$current=$read($render['pages']);
foreach($baseline['pages'] as $route=>$p)if(($render['pages'][$route]??null)!==$p['ID']||($priorRender['pages'][$route]??null)!==$p['ID']||
 ($baseline['metadata'][$route]['_miopages_source_aware_case']??null)!==$sourceAwareCase)exit(8);
$evidence=$root.'/source-aware-rollback-'.$render['sourceVersion'].'.json';if(file_exists($evidence))throw new RuntimeException('Preserve prior rollback evidence');
$retain=$root.'/source-aware-rollback-'.$render['sourceVersion'].'-current.json';if(file_exists($retain))exit(9);
file_put_contents($retain,json_encode($current+['renderText'=>$currentText],JSON_THROW_ON_ERROR));
$write=static function(array $snapshot)use($keys):void{
 foreach($snapshot['pages'] as $route=>$post){
  $id=wp_update_post(wp_slash($post),true);if(is_wp_error($id)||$id!==$post['ID'])throw new RuntimeException('Exact draft write failed');
  foreach($keys as $key)update_post_meta($id,$key,$snapshot['metadata'][$route][$key]);
 }
};
$failure=null;$restoredHash=null;
try{
 $write($baseline);file_put_contents($root.'/source-aware-render.json',$baseline['renderText']);
 $restored=$read($priorRender['pages']);
 if($restored!==['pages'=>$baseline['pages'],'metadata'=>$baseline['metadata']]||file_get_contents($root.'/source-aware-render.json')!==$baseline['renderText'])throw new RuntimeException('Prior content metadata or routing differed');
 $restoredHash=hash('sha256',json_encode($restored,JSON_THROW_ON_ERROR));
}catch(Throwable $e){$failure=$e;}
finally{
 $write($current);file_put_contents($root.'/source-aware-render.json',$currentText);
 if($read($render['pages'])!==$current||file_get_contents($root.'/source-aware-render.json')!==$currentText)throw new RuntimeException('Current draft recovery differed');
}
if($failure)throw $failure;
$counts=[];foreach($render['pages'] as $route=>$id)$counts[$route]=count(wp_get_post_revisions($id,['posts_per_page'=>-1]));
$result=['status'=>'PASS','operation'=>'source-aware-content-metadata-routing-roundtrip','baseline'=>$name,'pages'=>count($render['pages']),
 'stableIds'=>true,'stableSlugs'=>true,'priorDigest'=>$restoredHash,'currentDigest'=>hash('sha256',json_encode($current,JSON_THROW_ON_ERROR)),
 'routingRestoredExactly'=>true,'revisionCounts'=>$counts,'retainedNewDraftsAsHistory'=>true,'protectedWordPressWrites'=>false,'signedApproval'=>false];
file_put_contents($evidence,json_encode($result,JSON_THROW_ON_ERROR));echo json_encode($result,JSON_THROW_ON_ERROR),PHP_EOL;
