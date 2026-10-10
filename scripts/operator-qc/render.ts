import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { fingerprint } from "../../lib/platform/canonical/model";
import type { Basis,Row,Technical } from "../../lib/platform/operator-qc/model";

type Page={goto:(url:string,options:unknown)=>Promise<unknown>;evaluate:<T>(fn:()=>T)=>Promise<Awaited<T>>;screenshot:(options:unknown)=>Promise<Buffer>};
type Browser={newContext:(options:unknown)=>Promise<{newPage:()=>Promise<Page>;close:()=>Promise<void>;route:(pattern:string,fn:(r:{request:()=>{url:()=>string};continue:()=>Promise<void>;abort:()=>Promise<void>})=>Promise<void>)=>Promise<void>}>;close:()=>Promise<void>};
export async function buildIdentity(){try{return (await readFile(".next/BUILD_ID","utf8")).trim();}catch{return null;}}
export async function gatherRender(databaseUrl:string,basis:Basis,folder:string):Promise<Technical>{
  if(!basis.technical.buildId)throw Error("Build the production renderer before QC evidence");
  const reservation=createServer().listen(0,"127.0.0.1");await once(reservation,"listening");const port=(reservation.address() as {port:number}).port;await new Promise<void>(r=>reservation.close(()=>r()));
  const connection=new URL(databaseUrl);connection.searchParams.set("options","-c search_path=public -c default_transaction_read_only=on -c timezone=UTC");
  const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(port)],{env:{...process.env,DATABASE_URL:connection.toString(),WEB_PRESENCE_ID:basis.target.webPresenceId,MANAGED_SITE_ID:basis.target.managedSiteId,PRESENTATION_PREVIEW_SCHEMA:""},windowsHide:true,stdio:"ignore"});
  const base=`http://127.0.0.1:${port}`;let browser:Browser|undefined;const routes:Row[]=[],views:Row[]=[];
  try{
    let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error("Read-only rendering process exited");try{if((await fetch(`${base}/media/assets/invalid`,{signal:AbortSignal.timeout(1000)})).status===404){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error("Rendering startup timed out");
    await mkdir(folder,{recursive:true});
    for(const route of basis.routes){const response=await fetch(`${base}${route.slug}`,{signal:AbortSignal.timeout(15000)}),html=await response.text(),doc=new JSDOM(html).window.document;routes.push({pageId:route.id,route:route.slug,status:response.status,markupDigest:fingerprint(doc.querySelector(".managed-site")?.outerHTML??html),acquiredImages:doc.querySelectorAll("[data-acquired-role]").length,fpos:doc.querySelectorAll("[data-fpo-role]").length,anchors:[...doc.querySelectorAll("a[href]")].map(a=>({label:a.textContent?.trim(),destination:a.getAttribute("href")}))});}
    const browserTools=await import(pathToFileURL(path.resolve("runtime-content/browser-tools/node_modules/playwright-core/index.mjs")).href) as {chromium:{launch:(o:unknown)=>Promise<Browser>}};
    browser=await browserTools.chromium.launch({headless:true,executablePath:process.env.QC_BROWSER_EXECUTABLE??"C:/Program Files/Google/Chrome/Application/chrome.exe"});
    for(const [name,width,height] of [["desktop",1440,1000],["tablet",768,1024],["mobile",390,844]] as const){const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});try{
      await context.route("**/*",async r=>{if(new URL(r.request().url()).origin!==base)await r.abort();else await r.continue();});const page=await context.newPage();
      for(const route of basis.routes){await page.goto(`${base}${route.slug}`,{waitUntil:"networkidle",timeout:20000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async i=>{i.loading="eager";try{await i.decode();}catch{}}));});
        const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,h1Count:document.querySelectorAll("main h1").length,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length,missingAlt:document.querySelectorAll("img:not([alt])").length}));const file=`${String(route.id)}-${name}.png`;await writeFile(path.join(folder,file),await page.screenshot({fullPage:true}));views.push({pageId:route.id,route:route.slug,view:name,width,height,...metrics,screenshot:file});}
    }finally{await context.close();}}
    return {status:"collected",buildId:basis.technical.buildId,renderContext:fingerprint({input:basis.technical.renderContext,routes:routes.map(r=>({route:r.route,status:r.status,markupDigest:r.markupDigest})),views}),routes,views,limitations:["Automated layout/image/heading evidence only; no aesthetic approval","Keyboard behavior, contrast, reading order and semantics require operator assessment","Loopback production render against selected real canonical site using read-only database sessions; no public deployment"]};
  }finally{await browser?.close();if(child.exitCode===null){const done=once(child,"exit");child.kill();await done;}}
}
