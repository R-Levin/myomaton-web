<?php
/** Disposable CLI bridge over the existing native content projector; no signed approval. */
declare(strict_types=1);
if (PHP_SAPI!=='cli'||count($argv)!==3||!preg_match('/^(home|site)-[1-9][0-9]*(?:-media|-fpo)?\.json$/D',$argv[2])) exit(1);
if(!extension_loaded('pdo_sqlite')){fwrite(STDERR,"BLOCKED: run with the existing WordPress SQLite PHP extension options.\n");exit(20);}
$root=realpath($argv[1]);if(!$root||basename($root)!=='p022-wp-validation'||!is_file($root.'/wordpress/wp-load.php')||str_contains(str_replace('\\','/',$root),'/public_html/'))exit(2);
// The first rebuilt-Core test case (MIOPAGES_RUN=rebuilt) is bound to its own plan file.
$rebuilt=getenv('MIOPAGES_RUN')==='rebuilt';
$manifest=dirname(__DIR__,2).($rebuilt?'/docs/c0-rebuilt-run.json':'/docs/c0-source-aware-run-proposal.json');
$plan=json_decode(file_get_contents($manifest),true,512,JSON_THROW_ON_ERROR);
$manifestSha=$rebuilt?hash('sha256',json_encode($plan,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)):'f560374969b7abdff53fa33917c9b84f7053f5f9b092b0dccf9a505bcc8f9ddd';
if(!$rebuilt&&hash_file('sha256',$manifest)!==$manifestSha)exit(3);
$file=$root.'/source-aware-incoming/'.$argv[2];$receiptFile=$file.'.receipt.json';
if(!is_file($file)||is_link($file)||!is_file($receiptFile)||is_link($receiptFile))exit(4);
$packet=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
$receipt=json_decode(file_get_contents($receiptFile),true,512,JSON_THROW_ON_ERROR);
if(($receipt['runManifestSha256']??null)!==$manifestSha||($receipt['intakeId']??null)!==$plan['destination']['intakeId']||
 ($receipt['scope']??null)!==$plan['destination']['scope']||($receipt['packetSha256']??null)!==hash_file('sha256',$file)||
 ($receipt['packetDigest']??null)!==($packet['digest']??null)||($packet['localDraftOnly']??null)!==true)exit(5);
$candidate=$packet['candidate'];$sourceAwareCase=$plan['destination']['intakeId'];
$_SERVER['HTTP_HOST']='127.0.0.1:4474';putenv('MIOPAGES_FIXTURE_CASE=c0');
require $root.'/wordpress/wp-load.php';
foreach(['home_url','site_url','admin_url'] as $filter)add_filter($filter,static fn($url)=>str_replace('127.0.0.1:4473','127.0.0.1:4474',$url));
if(get_option('home')!=='http://127.0.0.1:4473'||get_stylesheet()!=='miopages-managed-site')exit(6);
require_once WP_CONTENT_DIR.'/plugins/miopages-delivery/includes/class-miopages-native-draft-media.php';
require_once WP_CONTENT_DIR.'/plugins/miopages-delivery/includes/class-miopages-native-draft-content.php';
$user=get_user_by('login','localreview');if(!$user)exit(7);wp_set_current_user($user->ID);
$brand=json_decode(file_get_contents($root.'/source-aware-brand.json'),true,512,JSON_THROW_ON_ERROR);
// The rebuilt case inherits the same reviewed brand (matched by digest); its record names the earlier site.
if(($brand['digest']??null)!==$receipt['brandDigest']||(!$rebuilt&&($brand['projection']['scope']??null)!==$plan['destination']['scope']))exit(18);
$oldRender=json_decode(file_get_contents($root.'/originals-render.json'),true,512,JSON_THROW_ON_ERROR);
$oldBrand=get_post_meta((int)$oldRender['pages']['/'],'_miopages_draft_brand',true);
$logo=$oldBrand['logoAttachment']??null;$logoFile=is_int($logo)?get_attached_file($logo,true):false;
if(!$logoFile||!is_file($logoFile)||hash_file('sha256',$logoFile)!==$brand['projection']['logo']['sha256'])exit(19);
$projection=$brand['projection'];$projection['logoAttachment']=$logo;
// A design Core's AI chose for this candidate (brand projection v4) replaces the stored design; the logo stays.
if(isset($packet['design'])){$d=$packet['design'];
 if(!is_array($d)||($d['grammar']??null)!=='core-designed'||($d['version']??null)!==4||count($d)!==7)exit(21);
 $projection['design']=$d;}
$validationIds=array_combine(array_column($candidate['pages'],'path'),range(1,count($candidate['pages'])));
MioPages_Native_Draft_Content::posts($candidate,$validationIds,[],true,$packet['unresolvedActions']??$packet['pendingActions']??[]);
// The rebuilt case gets its own draft pages; the earlier case's pages are left untouched.
$track=$root.($rebuilt?'/source-aware-ids-rebuilt.json':'/source-aware-ids.json');$ids=is_file($track)?json_decode(file_get_contents($track),true,512,JSON_THROW_ON_ERROR):[];
$existing=$wpdb->get_results("SELECT ID,post_type,post_status,post_name,post_title,post_content FROM {$wpdb->posts} ORDER BY ID",ARRAY_A);
$owned=array_map('intval',array_values($ids));$before=[];$beforeMeta=[];
foreach($ids as $route=>$id){$post=get_post($id,ARRAY_A);if(!$post||$post['post_status']!=='draft'||get_post_meta($id,'_miopages_source_aware_case',true)!==$sourceAwareCase)exit(8);
 $before[$route]=array_intersect_key($post,array_flip(['ID','post_title','post_content','post_excerpt','post_name','post_status','post_type']));
 foreach(['_miopages_source_aware_case','_miopages_source_candidate_digest','_miopages_draft_brand'] as $key)$beforeMeta[$route][$key]=get_post_meta($id,$key,true);}
$snapshot=$root.'/source-aware-before-'.$argv[2];
if(is_file($snapshot))throw new RuntimeException('Preserve existing materialization evidence; inspect before retry.');
file_put_contents($snapshot,json_encode(['pages'=>$before,'metadata'=>$beforeMeta,'renderText'=>is_file($root.'/source-aware-render.json')?file_get_contents($root.'/source-aware-render.json'):null,'render'=>is_file($root.'/source-aware-render.json')?json_decode(file_get_contents($root.'/source-aware-render.json'),true):null],JSON_THROW_ON_ERROR));
$visible=[];
foreach($candidate['pages'] as $page){
 $route=$page['path'];if(!is_string($route)||!str_starts_with($route,'/')||str_contains($route,'..'))exit(9);
 if(isset($ids[$route]))$id=$ids[$route];
 else{
  $id=wp_insert_post(['post_title'=>$page['title'],'post_type'=>'page','post_status'=>'draft','post_name'=>($rebuilt?'mio-rb-':'mio-sa-').($route==='/'?'home':sanitize_title($route))],true);
  if(is_wp_error($id)||$id<1)exit(10);update_post_meta($id,'_miopages_source_aware_case',$sourceAwareCase);
  $ids[$route]=$id;file_put_contents($track,json_encode($ids,JSON_THROW_ON_ERROR));
 }
 $visible[$route]=$id;
}
$attachments=[];
foreach($packet['images']??[] as $image){
 if(!preg_match('/^[a-f0-9]{64}$/D',$image['digest'])||!preg_match('/^(home|site)-[1-9][0-9]*-[a-f0-9-]{36}\.png$/D',$image['file']))exit(11);
 $source=$root.'/source-aware-incoming/'.$image['file'];
 if(!is_file($source)||is_link($source)||hash_file('sha256',$source)!==$image['digest'])exit(12);
 $size=getimagesize($source);if(!$size||$size['mime']!=='image/png'||$size[0]!==$image['width']||$size[1]!==$image['height'])exit(13);
 $asset=$root.'/assets/'.$image['digest'].'.png';if(!is_file($asset)&&!copy($source,$asset))exit(14);
 $existingAttachments=get_posts(['post_type'=>'attachment','post_status'=>'inherit','meta_key'=>'_miopages_evaluation_digest','meta_value'=>$image['digest'],'posts_per_page'=>2,'fields'=>'ids']);
 if(count($existingAttachments)>1)exit(15);
 $attachment=$existingAttachments[0]??wp_insert_attachment(['post_mime_type'=>'image/png','post_title'=>$image['alt'],'post_status'=>'inherit'],false,0,true);
 if(is_wp_error($attachment)||$attachment<1)exit(16);
 if(!$existingAttachments)update_post_meta($attachment,'_miopages_evaluation_digest',$image['digest']);
 $attachments[$image['sectionId']]=['id'=>$attachment,'media'=>['alt'=>$image['alt'],'width'=>$size[0],'height'=>$size[1]]];
}
foreach(MioPages_Native_Draft_Content::posts($candidate,$visible,$attachments,true,$packet['unresolvedActions']??$packet['pendingActions']??[]) as $post){
 $id=wp_update_post(wp_slash($post),true);if(is_wp_error($id)||get_post_status($id)!=='draft')exit(17);
 update_post_meta($id,'_miopages_source_candidate_digest',$packet['digest']);
}
foreach($visible as $id)update_post_meta($id,'_miopages_draft_brand',$projection);
$after=$wpdb->get_results("SELECT ID,post_type,post_status,post_name,post_title,post_content FROM {$wpdb->posts} ORDER BY ID",ARRAY_A);
$afterById=array_column($after,null,'ID');
foreach($existing as $old)if(!in_array((int)$old['ID'],$owned,true)&&($afterById[$old['ID']]??null)!==$old)throw new RuntimeException('An unrelated existing WordPress post changed.');
$render=['packet'=>$argv[2],'digest'=>$packet['digest'],'pages'=>$visible,'images'=>count($attachments),'case'=>$sourceAwareCase,'brandDigest'=>$brand['digest'],'sourceVersion'=>$receipt['workflowVersion'],'packetSha256'=>$receipt['packetSha256']];
file_put_contents($root.'/source-aware-render.json',json_encode($render,JSON_THROW_ON_ERROR));
echo json_encode(['status'=>'PASS','operation'=>'isolated-source-aware-native-materialization','pages'=>count($visible),'images'=>count($attachments),'pageIds'=>$visible,'existingUnrelatedPostsUnchanged'=>true,'protectedWordPressWrites'=>false,'theme'=>get_stylesheet(),'wordpress'=>get_bloginfo('version')],JSON_THROW_ON_ERROR),PHP_EOL;
