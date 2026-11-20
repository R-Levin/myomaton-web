/** Read-only visual/geometry check of the existing six-page WordPress candidate. No provider access. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {chromium} from "playwright-core";

const wp="C:/Users/mplxs/Projects/myomaton-web/runtime-content/p022-wp-validation";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
type Box={x:number;y:number;w:number;h:number;font:number;marginTop:number};
type Geometry={text:string;overflow:boolean;minCopyFont:number;minButtonHeight:number;hero:Box;title:Box;
 heroColumns:Box[];rows:{parent:Box;buttons:Box[]}[];headers:Box[];nav:Box[];hrefs:string[]};
async function main(){
 const [label,...extra]=process.argv.slice(2);
 assert.ok(!extra.length&&/^(before|after)-layout(?:-[a-z]+)?$/.test(label));
 const out=resolve("runtime-content/c0-presentation-20261119",label);
 await mkdir(out,{recursive:false});
 const mapBytes=await readFile(join(wp,"source-aware-render.json"));
 const map=JSON.parse(mapBytes.toString()) as {case:string;pages:Record<string,number>;sourceVersion:number};
 assert.equal(map.case,"41a83e7e-1765-4517-941a-b2b151bb7c4a");
 const native=()=>JSON.parse(execFileSync("C:/Python314/python.exe",[resolve("scripts/intake/source-aware-native-readback.py"),wp],{encoding:"utf8"}));
 const before=native();
 const baseline=label.startsWith("after-")?JSON.parse(await readFile(resolve("runtime-content/c0-presentation-20261119/before-layout/review.json"),"utf8")):null;
 if(baseline){assert.equal(before.digest,baseline.nativeDigest);assert.equal(before.oldPostsDigest,baseline.oldPostsDigest);}
 const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,chromiumSandbox:true});
 const results=[];
 try{
  for(const width of [1440,768,390]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:"reduce"});
   await page.route("**/*",route=>new URL(route.request().url()).origin==="http://127.0.0.1:4474"?route.continue():route.abort());
   for(const [path,id]of Object.entries(map.pages)){
    const response=await page.goto("http://127.0.0.1:4474/?page_id="+id+"&preview=true",{waitUntil:"networkidle"});
    assert.equal(response?.status(),200);
    // A literal browser program avoids TS runners injecting Node-only __name helpers.
    const data=await page.evaluate<Geometry>(String.raw`(()=>{
     const rect=(e)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,font:parseFloat(s.fontSize),marginTop:parseFloat(s.marginTop)}};
     const main=document.querySelector("main");
     const visible=(e)=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=="hidden";
     const copy=[...main.querySelectorAll("p,li,summary,.wp-block-button__link")].filter(visible);
     const rows=[...main.querySelectorAll(".miopages-node-row")].map(row=>({parent:rect(row),buttons:[...row.querySelectorAll(":scope > .wp-block-buttons .wp-block-button__link")].map(rect)})).filter(r=>r.buttons.length>1);
     const hero=main.querySelector(".miopages-draft-hero");
     const heroColumns=hero.querySelector(".miopages-node-columns");
     const headers=[...main.querySelectorAll(".miopages-native-component h1,.miopages-native-component h2")].filter(visible).map(rect);
     return {text:main.textContent.replace(/\s+/g," ").trim(),overflow:document.documentElement.scrollWidth>innerWidth+1,
      minCopyFont:Math.min(...copy.map(e=>rect(e).font)),minButtonHeight:Math.min(...[...main.querySelectorAll(".wp-block-button__link")].filter(visible).map(e=>rect(e).h)),
      hero:rect(hero),title:rect(hero.querySelector("h1")),heroColumns:heroColumns?[...heroColumns.children].map(rect):[],rows,headers,
      nav:[...main.querySelectorAll(".miopages-draft-nav > *")].map(rect),
      hrefs:[...main.querySelectorAll("a")].map(a=>a.href)};
    })()`);
    const {text,...geometry}=data;
    assert.ok(!geometry.overflow,"Horizontal overflow: "+path+"/"+width);
    if(baseline){
     assert.equal(sha(text),baseline.results.find((v:{path:string;width:number})=>v.path===path&&v.width===width)?.textDigest,"Visitor copy changed");
     assert.ok(geometry.minCopyFont>=16,"Unreadable copy/control text");assert.ok(geometry.minButtonHeight>=44,"Button target too small");
     if(width===1440&&geometry.heroColumns.length>1)assert.ok(Math.max(...geometry.heroColumns.map(c=>c.y))-Math.min(...geometry.heroColumns.map(c=>c.y))<1,"Hero column misalignment");
     for(const row of geometry.rows)for(let i=1;i<row.buttons.length;i++)if(row.buttons[i].x>row.buttons[i-1].x)
      assert.ok(Math.abs(row.buttons[i].y-row.buttons[i-1].y)<1,"Button row misalignment");
    }
    const screenshot=width===768?undefined:join(out,(path==="/"?"home":path.slice(1))+"-"+width+".png");
    if(screenshot)await page.screenshot({path:screenshot,fullPage:true});
    results.push({path,width,status:response!.status(),textDigest:sha(text),...geometry,screenshot});
   }
   await page.close();
  }
 }finally{await browser.close()}
 assert.deepEqual(await readFile(join(wp,"source-aware-render.json")),mapBytes);
 assert.deepEqual(native(),before,"Read-only review changed native state");
 await writeFile(join(out,"review.json"),JSON.stringify({sourceVersion:map.sourceVersion,nativeDigest:before.digest,oldPostsDigest:before.oldPostsDigest,results,providerCalls:0},null,2));
 console.log(JSON.stringify({status:"PASS",operation:"read-only-existing-site-presentation",label,pages:Object.keys(map.pages).length,views:results.length,nativeDigest:before.digest,oldPostsDigest:before.oldPostsDigest,
  minCopyFont:Math.min(...results.map(r=>r.minCopyFont)),minButtonHeight:Math.min(...results.map(r=>r.minButtonHeight)),maxHeroHeight:Math.max(...results.filter(r=>r.width===1440).map(r=>r.hero.h)),providerCalls:0,review:join(out,"review.json")}));
}
main().catch(e=>{console.error(JSON.stringify({status:"BLOCKED",operation:"local-presentation",detail:e.message}));process.exitCode=1});
