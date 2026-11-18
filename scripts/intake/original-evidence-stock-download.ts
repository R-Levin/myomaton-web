import {readFile,open,writeFile,realpath,lstat} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {fingerprint} from "../../lib/platform/canonical/model";
import {privateStockSearchCache} from "../../lib/platform/acquisition/stock-search-cache";
import {downloadPixabaySelection,pixabayPrivateSelection} from "../../lib/platform/acquisition/pixabay-download";
const approved="db5eea3ef55b24a4f0c9229b14968f6be4bcc49e1cc902f186961ec985ae2a75";
async function main(){
 const [cacheArg,outArg,mode]=process.argv.slice(2);
 if(mode!==undefined&&mode!=="resume-second")throw Error("Unknown download operation");
 const cache=await realpath(cacheArg),out=await realpath(outArg);
 if((await lstat(out)).isSymbolicLink())throw Error("Private output directory required");
 const planBytes=await readFile("docs/c0-original-evidence-run-proposal.json");
 if(createHash("sha256").update(planBytes).digest("hex")!==approved)throw Error("Exact approved scope required");
 const plan=JSON.parse(planBytes.toString()),store=privateStockSearchCache(cache);
 const found=await store.readOrCreate(plan.stock.humanInitiatedQueries[0],async()=>{throw Error("No additional search authorized")});
 const selected=["5467838","593371"];
 if(plan.stock.maximumSelectedDownloads!==selected.length||Date.now()>=Date.parse("2026-11-19T16:03:51.397Z"))throw Error("Selection authority unavailable");
 const results=[];
 for(const id of mode==="resume-second"?["593371"]:selected){
 if(mode==="resume-second"){
 const first=JSON.parse(await readFile(join(out,"stock-5467838.receipt.json"),"utf8"));
 const firstBytes=await readFile(join(out,"stock-5467838.png"));
 if(first.preparedSha256!==createHash("sha256").update(firstBytes).digest("hex")||first.proposal!==approved)throw Error("Prior download integrity differs");
 await readFile(join(out,"stock-593371.attempt.json"));
 }
 const hit=found.results.find(r=>r.sourceId===id);
 if(!hit)throw Error("Exact cached candidate missing");
 const attempt=await open(join(out,"stock-"+id+(mode==="resume-second"?".diagnosed-resume":".attempt")+".json"),"wx",0o600);
 try{await attempt.writeFile(JSON.stringify({proposal:approved,at:new Date().toISOString(),hit,selectionDigest:fingerprint(hit),automaticRetries:0}));await attempt.sync()}finally{await attempt.close()}
 const recheck=async()=>{if(Date.now()>=found.expiresAt||Date.now()>=Date.parse("2026-11-19T16:03:51.397Z"))throw Error("Download authority expired")};
 const bytes=await downloadPixabaySelection(hit,recheck,fetch,async(source,mime)=>{
 await writeFile(join(out,"stock-"+id+".received"),source,{mode:0o600,flag:"wx"});
 await writeFile(join(out,"stock-"+id+".transport.json"),JSON.stringify({status:200,mime,bytes:source.length,sha256:createHash("sha256").update(source).digest("hex")}),{mode:0o600,flag:"wx"});
 });
 await writeFile(join(out,"stock-"+id+".original"),bytes.source,{mode:0o600,flag:"wx"});
 await writeFile(join(out,"stock-"+id+".png"),bytes.prepared.bytes,{mode:0o600,flag:"wx"});
 const receipt={proposal:approved,hit,selection:pixabayPrivateSelection(hit,bytes.sourceSha256,"2026-11-19T16:03:51.397Z"),
 sourceSha256:bytes.sourceSha256,preparedSha256:bytes.preparedSha256,width:bytes.prepared.width,height:bytes.prepared.height,
 state:"private-candidate-awaiting-contextual-rights-review",downloadedAt:new Date().toISOString()};
 await writeFile(join(out,"stock-"+id+".receipt.json"),JSON.stringify(receipt,null,2),{mode:0o600,flag:"wx"});
 results.push({id,sourceUrl:hit.sourceUrl,creator:hit.creator,width:bytes.prepared.width,height:bytes.prepared.height,preparedSha256:bytes.preparedSha256});
 }
 console.log(JSON.stringify({status:"PASS",operation:"two-selected-private-downloads",results}));
}
main().catch((error:Error&{code?:string})=>{console.error(JSON.stringify({status:"BLOCKED",operation:"selected-stock-download",category:error.code??error.name,detail:/^(Selected|Stored|MIME|Current|Exact|Stock|Unsupported|Download|Invalid|Prior|Animated|Malformed)/.test(error.message)?error.message:"Transport or private custody failed",requirement:"Preserve attempts and bytes; no automatic retry"}));process.exitCode=1});
