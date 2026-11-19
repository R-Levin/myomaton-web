import assert from"node:assert/strict";import{readFile,mkdir,writeFile}from"node:fs/promises";import{execFileSync}from"node:child_process";import{join,resolve}from"node:path";
import{createHash}from"node:crypto";import{chromium}from"playwright-core";
import{captureRenderedIntent,type RenderedCandidateBinding}from"../../lib/platform/intake/presence-candidate-capture";
import{fingerprint}from"../../lib/platform/canonical/model";
async function main(){
 const [name,...extra]=process.argv.slice(2);assert.ok(!extra.length&&/^(home|site)-[1-9][0-9]*(?:-media)?\.json$/.test(name??""));
 const wp="C:/Users/mplxs/Projects/myomaton-web/runtime-content/p022-wp-validation",incoming=wp+"/source-aware-incoming";
 const packetBytes=await readFile(incoming+"/"+name),packet=JSON.parse(packetBytes.toString()),envelope=JSON.parse(await readFile(incoming+"/"+name+".capture-intent.json","utf8"));
 const receipt=JSON.parse(await readFile(incoming+"/"+name+".receipt.json","utf8"));assert.deepEqual(envelope.receipt,receipt);
 assert.equal(createHash("sha256").update(packetBytes).digest("hex"),receipt.packetSha256);
 const mapBytes=await readFile(wp+"/source-aware-render.json"),render=JSON.parse(mapBytes.toString());assert.equal(render.packet,name);
 assert.equal(render.digest,packet.digest);assert.equal(render.brandDigest,receipt.brandDigest);
 const script=resolve("scripts/intake/source-aware-native-readback.py");
 const readback=()=>JSON.parse(execFileSync("C:/Python314/python.exe",[script,wp],{encoding:"utf8"}));
 const before=readback();
 const binding:RenderedCandidateBinding={contextDigest:receipt.contextDigest,inputDigest:receipt.inputDigest,representationDigest:fingerprint({packet:packet.digest,brand:render.brandDigest}),
  nativeReadbackDigest:before.digest,variant:name.endsWith("-media.json")?"operator-proposed-preview":"core-candidate",origin:"http://127.0.0.1:4474",pages:Object.entries(render.pages).map(([path,wordpressPageId])=>({path,wordpressPageId:wordpressPageId as number}))};
 const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,chromiumSandbox:true,
  args:["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"]});
 let result;
 try{result=await captureRenderedIntent(browser,envelope.intent,async()=>{
  assert.deepEqual(await readFile(wp+"/source-aware-render.json"),mapBytes);const current=readback();assert.deepEqual(current,before);return binding;
 })}finally{await browser.close()}
 const target=incoming+"/capture-"+receipt.workflowVersion+(name.endsWith("-media.json")?"-media":"");await mkdir(target);
 for(const row of result.rows)await writeFile(join(target,row.source.sha256+".source"),row.bytes,{flag:"wx"});
 const index={packetSha256:receipt.packetSha256,packetDigest:packet.digest,brandDigest:render.brandDigest,binding,sources:result.rows.map(x=>x.source),observations:result.observations,oldPostsDigest:before.oldPostsDigest};
 await writeFile(join(target,"index.json"),JSON.stringify(index,null,2),{flag:"wx"});
 assert.deepEqual(readback(),before);
 console.log(JSON.stringify({status:"PASS",operation:"actual-source-aware-wordpress-capture",version:receipt.workflowVersion,pages:binding.pages.length,
 frames:result.rows.length,bytes:result.rows.reduce((n,r)=>n+r.bytes.length,0),nativeReadbackDigest:before.digest,representationDigest:binding.representationDigest,
 observations:result.observations,providerCalls:0,oldPostsUnchanged:true}));
}
main().catch((e:Error&{code?:string})=>{console.error(JSON.stringify({status:"BLOCKED",stage:"native-capture",category:e.code??e.name,detail:e.message}));process.exitCode=1});
