import assert from "node:assert/strict";
import {PassThrough} from "node:stream";
import {createHash} from "node:crypto";
import test from "node:test";
import {chromium} from "playwright-core";
import {publicCaptureBridge} from "../lib/platform/intake/presence-public-capture-bridge";
import {publicResearchReply} from "../scripts/intake/presence-research-controller";
test("public-only stdio uses the actual existing Windows renderer sandbox and binds both screenshots to the original HTML",async()=>{
 const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,chromiumSandbox:true});
 const input=new PassThrough(),output=new PassThrough(),bridge=publicCaptureBridge(input,output);
 output.setEncoding("utf8");
 let buffered="";const operations:string[]=[];
 output.on("data",async chunk=>{
  buffered+=chunk;const i=buffered.indexOf("\n");if(i<0)return;
  const frame=JSON.parse(buffered.slice(0,i));buffered=buffered.slice(i+1);operations.push(frame.operation);
  assert.ok(!JSON.stringify(frame).includes("apiKey"));
  input.write(JSON.stringify(await publicResearchReply(browser,frame))+"\n");
 });
 try{
  await bridge.verify();
  const html=Buffer.from('<html><body><h1>Public fixture only</h1></body></html>');
  const result=await bridge.capture({id:"research:fixture",label:"Fixture",url:"https://example.org/"},html);
  assert.deepEqual(result.captured.map(row=>row.viewport),["desktop","mobile"]);
  assert.deepEqual(operations,["preflight","capture"]);
  assert.ok(result.captured[0].bytes.length>1000);
  await assert.rejects(publicResearchReply(browser,{miopagesPeerRequest:1,id:"11111111-1111-4111-8111-111111111111",operation:"capture",
   source:{id:"research:private",label:"Refuse",url:"https://127.0.0.1/"},html:html.toString("base64"),htmlSha256:createHash("sha256").update(html).digest("hex")}));
  await assert.rejects(publicResearchReply(browser,{miopagesPeerRequest:1,id:"11111111-1111-4111-8111-111111111111",operation:"capture",
   source:{id:"research:fixture",label:"Fixture",url:"https://example.org/"},html:html.toString("base64"),htmlSha256:"0".repeat(64)}),/integrity/);
 }finally{bridge.close();input.end();output.end();await browser.close()}
});

test("the public controller selects only the legacy or exact new-case worker and refuses argument injection",async()=>{
 const {publicResearchCommand}=await import("../scripts/intake/presence-research-controller");
 assert.match(publicResearchCommand(["work"]),/p0-original-evidence-c0-runtime\/app/);
 assert.match(publicResearchCommand(["--source-aware","work"]),/p0-source-aware-c0-runtime &&/);
 assert.match(publicResearchCommand(["--source-aware","recover","42"]),/recover '\{"version":42\}'$/);
 for(const args of [["--other","work"],["--source-aware","work","unexpected"],["recover","1;echo"],["work","","extra"],["recover","9007199254740992"]]){
  assert.throws(()=>publicResearchCommand(args),/Controlled operation/);
 }
});
