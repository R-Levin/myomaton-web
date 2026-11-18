import {randomUUID,createHash} from "node:crypto";
import {createInterface} from "node:readline";
import type {Readable,Writable} from "node:stream";
import type {PublicResearchSource} from "./presence-workflow-research";
export type PeerCaptureResult={captured:{viewport:"desktop"|"mobile";bytes:Buffer;width:number;height:number}[];limitations:string[]};
export type PublicPeerCapture={verify:()=>Promise<void>;capture:(source:PublicResearchSource,html:Buffer)=>Promise<PeerCaptureResult>};
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
/** Only public-site capture crosses stdio. No controller operations, API keys,
 * customer knowledge, database access or signing authority exist in this RPC. */
export function publicCaptureBridge(input:Readable,output:Writable):PublicPeerCapture & {close:()=>void}{
 const lines=createInterface({input,crlfDelay:Infinity});
 const queue:string[]=[];let waiting:((line:string)=>void)|undefined;let ended=false;
 lines.on("line",line=>{if(line.length>32_000_000){lines.close();return}if(waiting){const resolve=waiting;waiting=undefined;resolve(line)}else queue.push(line)});
 lines.on("close",()=>{ended=true;if(waiting){const resolve=waiting;waiting=undefined;resolve("")}});
 let busy=false;
 async function ask(operation:"preflight"|"capture",payload:object={}){
  if(busy||ended||queue.length)throw Error("Public capture channel refused");
  busy=true;const id=randomUUID();
  try{
   output.write(JSON.stringify({miopagesPeerRequest:1,id,operation,...payload})+"\n");
   const line=await new Promise<string>(resolve=>{if(queue.length)resolve(queue.shift()!);else waiting=resolve});
   let value;
   try{value=JSON.parse(line)}catch{throw Error("Public capture channel unavailable")}
   if(value.miopagesPeerReply!==1||value.id!==id||value.operation!==operation||value.status!=="PASS")throw Error("Public capture verification failed");
   return value;
  }finally{busy=false}
 }
 return {close:()=>lines.close(),verify:async()=>{
  const result=await ask("preflight");
  if(result.rendererSandbox!=="Lockdown"||result.sourceData!=="public-only")throw Error("Verified sandbox required");
 },capture:async(source,html)=>{
  const result=await ask("capture",{source,html:html.toString("base64"),htmlSha256:sha(html)});
  if(result.htmlSha256!==sha(html)||!Array.isArray(result.captured)||result.captured.length!==2||
     !Array.isArray(result.limitations)||result.limitations.some((v:unknown)=>typeof v!=="string"||v.length>500))throw Error("Public capture binding differs");
  const captured=result.captured.map((item:{viewport:string;bytes:string;sha256:string;width:number;height:number},i:number)=>{
   const bytes=Buffer.from(item.bytes,"base64"),width=i?390:1440,height=i?844:1000;
   if(item.viewport!==(i?"mobile":"desktop")||item.width!==width||item.height!==height||bytes.length>12_000_000||
      sha(bytes)!==item.sha256||!bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))throw Error("Public screenshot integrity failed");
   return {viewport:item.viewport as "desktop"|"mobile",bytes,width,height};
  });
  return {captured,limitations:result.limitations};
 }};
}
