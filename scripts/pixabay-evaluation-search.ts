import {createHash} from "node:crypto";
import {readFile,open} from "node:fs/promises";
import {join} from "node:path";
import {pixabaySearch} from "../lib/platform/acquisition/pixabay";
import {privateStockSearchCache} from "../lib/platform/acquisition/stock-search-cache";
import {readPixabayResponse,type PixabaySend} from "../lib/platform/acquisition/pixabay-https";
import {fingerprint} from "../lib/platform/canonical/model";
export const approvedProposal="db5eea3ef55b24a4f0c9229b14968f6be4bcc49e1cc902f186961ec985ae2a75";
export async function searchApprovedPhotos(directory:string,key:string,send?:PixabaySend){
 const bytes=await readFile("docs/c0-original-evidence-run-proposal.json");
 if(createHash("sha256").update(bytes).digest("hex")!==approvedProposal)throw Error("Exact approved search scope required");
 const plan=JSON.parse(bytes.toString()),cache=privateStockSearchCache(directory);
 const provider=pixabaySearch(async params=>{
  const query=params.get("q");
  if(!plan.stock.humanInitiatedQueries.includes(query))throw Error("Unauthorized search");
  const file=await open(join(directory,fingerprint({query})+".attempt.json"),"wx",0o600);
  try{await file.writeFile(JSON.stringify({query,at:new Date().toISOString(),proposal:approvedProposal,automaticRetries:0}));await file.sync()}finally{await file.close()}
  return readPixabayResponse(key,params,send);
 });
 const results=[];
 for(const query of plan.stock.humanInitiatedQueries){
  const saved=await cache.readOrCreate(query,()=>provider.search(query));
  results.push({query,results:saved.results.length,expiresAt:saved.expiresAt});
 }
 return {status:"PASS",operation:"approved-pixabay-searches",searches:results,directory,downloads:0};
}
async function main(){
 const directory=process.argv[2];
 if(!directory)throw Error("Protected search directory required");
 let key="";
 for await(const chunk of process.stdin){key+=String(chunk);if(key.length>140)throw Error("Invalid key input")}
 try{console.log(JSON.stringify(await searchApprovedPhotos(directory,key.trim())))}finally{key=""}
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/scripts/pixabay-evaluation-search.ts")){
 main().catch(()=>{console.log(JSON.stringify({status:"BLOCKED",operation:"approved-pixabay-searches",requirement:"Preserve private attempt evidence; no automatic retry"}));process.exitCode=1});
}
