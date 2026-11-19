import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {createHash} from "node:crypto";
import {homedir} from "node:os";
import {join} from "node:path";
import {chromium,type Browser} from "playwright-core";
import {capturePublicPeer} from "../../lib/platform/intake/presence-peer-browser";
import {pinnedResearchFetch} from "../../lib/platform/intake/presence-workflow-egress";
import {validateResearchSources,type PublicResearchSource} from "../../lib/platform/intake/presence-workflow-research";
const digest=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
export async function publicResearchReply(browser:Browser,frame:Record<string,unknown>){
 if(frame.miopagesPeerRequest!==1||typeof frame.id!=="string"||!/^[-a-f0-9]{36}$/.test(frame.id)||
    !["preflight","capture"].includes(String(frame.operation)))throw Error("Public capture request refused");
 if(frame.operation==="preflight"){
  const page=await browser.newPage();
  try{
   await page.goto("chrome://sandbox");
   const status=await page.locator("body").innerText();
   if(!/Renderer\s+.*Renderer\s+Lockdown/.test(status))throw Error("Renderer sandbox not verified");
   return {miopagesPeerReply:1,id:frame.id,operation:frame.operation,status:"PASS",rendererSandbox:"Lockdown",sourceData:"public-only"};
  }finally{await page.close()}
 }
 const source=frame.source as PublicResearchSource;
 validateResearchSources([source]);
 const html=Buffer.from(String(frame.html),"base64");
 if(html.length>2_000_000||digest(html)!==frame.htmlSha256)throw Error("Public source integrity failed");
 const read=pinnedResearchFetch(url=>url.protocol==="https:"&&!url.username&&!url.password&&!url.port&&!url.hash,2_000_000,true);
 const result=await capturePublicPeer(browser,source,html,read,async()=>{},12_000_000);
 return {miopagesPeerReply:1,id:frame.id,operation:frame.operation,status:"PASS",htmlSha256:digest(html),
  captured:result.captured.map(row=>({...row,bytes:row.bytes.toString("base64"),sha256:digest(row.bytes)})),limitations:result.limitations};
}
export function publicResearchCommand(args:readonly string[]){
 const fresh=args[0]==="--source-aware";
 const [operation,value,...extra]=fresh?args.slice(1):args;
 if(extra.length||!["work","recover"].includes(operation)||operation==="work"&&value||
  operation==="recover"&&(!/^\d+$/.test(value??"")||!Number.isSafeInteger(Number(value))||Number(value)<1))throw Error("Controlled operation required");
 const folder=fresh?"p0-source-aware-c0-runtime":"p0-original-evidence-c0-runtime/app";
 const script=fresh?"./worker.cjs":"../worker.cjs";
 const argument=value?(fresh?" '"+JSON.stringify({version:Number(value)})+"'":" "+value):"";
 return "cd ~/miopages-private-acceptance/"+folder+" && exec env NODE_ENV=development MIOPAGES_PUBLIC_RESEARCH_BRIDGE=1 NODE_PATH=$HOME/miopages-private-acceptance/p0-original-evidence-c0-runtime/node_modules:$HOME/public_html/node_modules node "+script+" "+operation+argument;
}
async function main(){
 const remote=publicResearchCommand(process.argv.slice(2));
 const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,chromiumSandbox:true,args:["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"]});
 const child=spawn("ssh",["-o","BatchMode=yes","-o","StrictHostKeyChecking=yes","-o","ConnectTimeout=8","-i",
  join(homedir(),".ssh","miopages_20i"),"-p","39304","wp-acceptance.miopages.com@ssh.iad.stackcp.com",remote],{stdio:["pipe","pipe","pipe"]});
 child.stderr.on("data",()=>{}); // Never relay remote errors containing protected context.
 try{
  for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})){
   if(line.length>4_000_000)throw Error("Public capture frame exceeds source envelope");
   let frame;try{frame=JSON.parse(line)}catch{throw Error("Remote channel is not a public capture frame")}
   if(frame.miopagesPeerRequest===1){
    const reply=await publicResearchReply(browser,frame);
    child.stdin.write(JSON.stringify(reply)+"\n");
   }else if(frame.miopagesRunResult===1){console.log(JSON.stringify(frame));child.stdin.end()}
   else throw Error("Unexpected remote output refused");
  }
  const code=await new Promise<number>(resolve=>{if(child.exitCode!==null)resolve(child.exitCode);else child.once("close",code=>resolve(code??1))});
  if(code)throw Error("Core operation failed");
 }finally{child.kill();await browser.close()}
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/scripts/intake/presence-research-controller.ts")){
 main().catch(()=>{console.error('{"status":"BLOCKED","stage":"public-capture-controller","requirement":"Preserve remote response and ledger; no automatic retry"}');process.exitCode=1});
}
