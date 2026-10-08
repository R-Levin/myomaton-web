import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';
import {review,planPromotion} from './customer-updates/miopages-focus.ts';
import {snapshotPublic} from './customer-previews/disposable.ts';
import {stateFingerprint} from '../lib/platform/customer-initialization.ts';
import {prepareManagedAsset} from '../lib/platform/assets/ingestion.ts';
import {JSDOM} from 'jsdom';
const render=JSON.parse(await readFile('runtime-content/miopages-promotion/render.json','utf8'));
const url=new URL(render.url);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');assert.equal(render.schema,'public');assert.equal(render.productionSafe,true);assert.deepEqual(render.target,review.target);assert.equal(render.completeFingerprint,review.completeAfter);
const pool=new Pool({connectionString:process.env.DATABASE_URL,options:'-c default_transaction_read_only=on -c timezone=UTC'});
try{
const before=await snapshotPublic(pool);assert.equal(planPromotion(before).changed,false);
const [dark,light]=await Promise.all(review.after.assets.map(a=>prepareManagedAsset(a.metadata.source)));
for(const [route,count]of [['/',5],['/service',8],['/experience',5],['/review',5]]){const response=await fetch(render.url+route);assert.equal(response.status,200);const doc=new JSDOM(await response.text()).window.document;assert.equal(doc.querySelectorAll('main>section').length,count);assert.equal(doc.querySelectorAll('[data-fpo-role],[data-layer],form,input,textarea').length,0);assert.equal(doc.querySelectorAll('img').length,2);assert.doesNotMatch(doc.body.textContent,/\$1,095|\$249|Myomaton|TSG Performance/);}
for(const [i,media]of [dark,light].entries()){const response=await fetch(render.url+'/media/assets/'+review.after.assets[i].id);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),media.mimeType);assert.ok(Buffer.from(await response.arrayBuffer()).equals(media.bytes));}
assert.equal((await fetch(render.url+'/api/contact',{method:'POST'})).status,503);
const page=review.after.pages.find(p=>p.slug==='/'),section=review.after.sections.find(s=>s.page_id===page.id&&s.sort_order===0);
// Exercise the real CLI using a private temporary working directory, so existing
// operator drafts and run outputs are never overwritten. No canonical writer runs.
const temporary=await mkdtemp(path.join(os.tmpdir(),'miopages-harness-check-'));
const args=['--import',pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href,path.resolve('scripts/edit-text-draft.ts'),'--web-presence',review.target.webPresenceId,'--managed-site',review.target.managedSiteId,'--section',section.id];
const run=a=>{const r=spawnSync(process.execPath,a,{cwd:temporary,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
const fields=run(args);assert.equal(fields.find(f=>f.path==='/heading').sourceType,'page-editorial');
const textFile=path.join(temporary,'draft-text.txt');await writeFile(textFile,'A clearer presence. A local wording draft.');
const result=run([...args,'--field',fields.find(f=>f.path==='/heading').id,'--text-file',textFile,'--actor','operator:development-validation','--reason','Demonstrate a local draft without publication']);
assert.equal(result.published,false);assert.equal(result.canonicalStateChanged,false);assert.equal(stateFingerprint(await snapshotPublic(pool)),stateFingerprint(before));console.log(JSON.stringify({routes:4,managedLogoByteChecks:2,temporary,customerFingerprint:stateFingerprint(before),harness:result},null,2));
}finally{await pool.end();}
