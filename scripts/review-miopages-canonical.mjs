import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const report=JSON.parse(await readFile('runtime-content/miopages-promotion/render.json','utf8'));
const base=new URL(report.url);assert.equal(base.hostname,'127.0.0.1');assert.equal(base.protocol,'http:');assert.equal(report.schema,'public');assert.equal(report.productionSafe,true);
const {chromium}=await import(pathToFileURL(path.resolve('runtime-content/browser-tools/node_modules/playwright-core/index.mjs')).href);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const output=path.resolve('runtime-content/miopages-promotion/render');await mkdir(output,{recursive:true});const findings=[];
try{
 for(const [device,width,height]of [['desktop',1440,1000],['tablet',820,1180],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});await context.route('**/*',r=>new URL(r.request().url()).origin===base.origin?r.continue():r.abort());const page=await context.newPage();
  try{for(const [route,count]of [['/',5],['/service',8],['/experience',5],['/review',5]]){
   assert.equal((await page.goto(base.origin+route,{waitUntil:'domcontentloaded'})).status(),200);await page.locator('main h1').waitFor();await page.evaluate(()=>Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode();})));await page.evaluate(()=>document.fonts.ready);
   const result=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,version:document.querySelector('.focus-presence').dataset.grammarVersion,family:document.querySelector('.p-hero').dataset.family,sections:document.querySelectorAll('main>section').length,forms:document.querySelectorAll('form,input,textarea').length,fpo:document.querySelectorAll('[data-fpo-role],[data-layer]').length,images:document.images.length,heroBackground:getComputedStyle(document.querySelector('main>section')).backgroundColor,headingFont:getComputedStyle(document.querySelector('h1')).fontFamily,headingSize:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),bodyFont:getComputedStyle(document.querySelector('.focus-presence')).fontFamily,sansLoaded:document.fonts.check('400 20px "Source Sans 3"'),footer:document.querySelector('footer').dataset.chrome,stages:[...document.querySelectorAll('.focus-continuity h3')].map(e=>e.textContent),extensions:document.querySelectorAll('.focus-extension').length,nav:[...document.querySelectorAll('header nav a')].map(a=>({href:a.getAttribute('href'),current:a.getAttribute('aria-current'),emphasis:a.dataset.actionTarget})),actions:[...document.querySelectorAll('main .p-action')].map(a=>({height:a.getBoundingClientRect().height,href:a.getAttribute('href')}))}));
   assert.ok(result.scrollWidth<=width+1);assert.equal(result.version,'3');assert.equal(result.sections,count);assert.equal(result.forms+result.fpo,0);assert.equal(result.images,2);assert.match(result.headingFont,/Source Sans 3/);assert.match(result.bodyFont,/Source Sans 3/);assert.ok(result.sansLoaded);assert.equal(result.heroBackground,'rgb(50, 47, 126)');assert.equal(result.footer,'graphic-signoff');assert.ok(result.actions.every(a=>a.height>=48));assert.equal(result.nav.filter(a=>a.emphasis==='true').length,1);assert.equal(result.nav.find(a=>a.emphasis==='true').href,'/review');assert.equal(result.nav.filter(a=>a.current==='page').length,route==='/'?0:1);
   if(route==='/')assert.equal(result.family,'orientation');if(route==='/service'){assert.deepEqual(result.stages,['Standard Launch','Ongoing']);assert.equal(result.extensions,1);}
   if(device!=='desktop'){const menu=page.locator('.managed-site-menu-toggle');if(await menu.count()){await menu.click();const review=page.locator('header nav a[href="/review"]');await review.waitFor({state:'visible'});assert.ok((await review.boundingBox()).height>=44);await page.keyboard.press('Escape');}}
   const key=`${device}-${route.slice(1)||'home'}`;await page.screenshot({path:path.join(output,key+'.png'),fullPage:true});findings.push({key,device,route,result});console.log(`canonical: ${device} ${route}`);
  }}finally{await context.close();}
 }
 for(const route of ['/','/service','/experience','/review']){const rows=findings.filter(f=>f.route===route);assert.ok(rows[0].result.headingSize>=rows[1].result.headingSize&&rows[1].result.headingSize>=rows[2].result.headingSize);}
 await writeFile(path.join(output,'findings.json'),JSON.stringify(findings,null,2)+'\n');console.log(`Passed ${findings.length} canonical responsive cases.`);
}finally{await browser.close();}
