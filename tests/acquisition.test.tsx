import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { openAIImageProvider } from "../lib/platform/acquisition/openai";
import { AcquisitionFailure,illustrationRequest,micros,workIdentity,requestForTemplate,ITERATION_TWO_TEMPLATE } from "../lib/platform/acquisition/contracts";
import { candidateSubject } from "../lib/platform/acquisition/service";

const attemptId="b5f04eb7-a1d2-4675-b97b-e78234534279";
test("image adapter refuses absent credentials without transport",async()=>{
  let calls=0;const p=openAIImageProvider({key:"",transport:async()=>{calls++;throw Error();}});
  await assert.rejects(p.generateImage(illustrationRequest,{attemptId}),e=>e instanceof AcquisitionFailure&&e.code==="credentials-absent");assert.equal(calls,0);
});
test("image adapter validates configured model and bounded request before transport",async()=>{
  await assert.rejects(openAIImageProvider({key:"synthetic",model:"unknown"}).generateImage(illustrationRequest,{attemptId}),{code:"invalid-request"});
  await assert.rejects(openAIImageProvider({key:"synthetic"}).generateImage({...illustrationRequest,size:"auto" as never},{attemptId}),{code:"invalid-request"});
});
test("image adapter normalizes one PNG, usage and request identity",async()=>{
  const bytes=await sharp({create:{width:1536,height:1024,channels:3,background:"#6843cf"}}).png().toBuffer();
  const p=openAIImageProvider({key:"synthetic",transport:async(url,init)=>{
    assert.equal(url,"https://api.openai.com/v1/images/generations");const body=JSON.parse(init!.body as string);
    assert.equal(body.n,1);assert.equal(body.size,"1536x1024");assert.equal(body.response_format,undefined);assert.equal(body.output_format,"png");
    return Response.json({data:[{b64_json:bytes.toString("base64")}],usage:{input_tokens:10,output_tokens:20,secret:"never-retained"}},{headers:{"x-request-id":"req_synthetic"}});
  }});const r=await p.generateImage(illustrationRequest,{attemptId});assert.deepEqual(r.usage,{input_tokens:10,output_tokens:20});assert.equal(r.actualMicros,null);assert.equal(r.requestId,"req_synthetic");assert.ok(r.bytes.equals(bytes));assert.equal(r.width,1536);
});
for(const [status,body,code] of [[429,{error:{message:"secret raw detail"}},"rate-limit"],[500,{},"transient"],[400,{error:{code:"moderation_blocked"}},"refusal"],[401,{},"invalid-request"],[200,{data:[]},"invalid-response"],[200,{data:[{url:"https://unsafe.example"}]},"invalid-response"]] as const){
  test(`adapter normalizes ${status} ${code} without raw error leakage`,async()=>{
    const p=openAIImageProvider({key:"synthetic",transport:async()=>Response.json(body,{status})});
    await assert.rejects(p.generateImage(illustrationRequest,{attemptId}),e=>e instanceof AcquisitionFailure&&e.code===code&&!e.message.includes("secret"));
  });
}
test("adapter timeout is explicitly uncertain and does not redispatch",async()=>{
  let calls=0;const p=openAIImageProvider({key:"synthetic",timeoutMs:10,transport:async(_url,options)=>{calls++;return new Promise((_resolve,reject)=>{options!.signal!.addEventListener("abort",()=>reject(new DOMException("timeout","TimeoutError")));});}});
  const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(p.generateImage(illustrationRequest,{attemptId}),{code:"timeout-uncertain"});assert.equal(calls,1);}finally{clearTimeout(keepAlive);}
});
test("adapter dropped connection is uncertain; invalid dimensions and oversized output refuse",async()=>{
  await assert.rejects(openAIImageProvider({key:"synthetic",transport:async()=>{throw new TypeError("network detail with secret");}}).generateImage(illustrationRequest,{attemptId}),{code:"timeout-uncertain"});
  const bytes=await sharp({create:{width:20,height:20,channels:3,background:"#6843cf"}}).png().toBuffer();
  await assert.rejects(openAIImageProvider({key:"synthetic",transport:async()=>Response.json({data:[{b64_json:Buffer.from("not image bytes").toString("base64")}]})}).generateImage(illustrationRequest,{attemptId}),{code:"invalid-response"});
  await assert.rejects(openAIImageProvider({key:"synthetic",transport:async()=>Response.json({data:[{b64_json:bytes.toString("base64")} ]})}).generateImage(illustrationRequest,{attemptId}),{code:"invalid-response"});
  await assert.rejects(openAIImageProvider({key:"synthetic",transport:async()=>new Response("x".repeat(30_000_000))}).generateImage(illustrationRequest,{attemptId}),{code:"invalid-response"});
});
test("bounded budget and representation identity are deterministic and revision-specific",()=>{
  for(const value of [0,-1,NaN,Infinity,1.2,3_000_000_000])assert.throws(()=>micros(value));assert.equal(micros(500000),500000);
  const c={id:attemptId,web_presence_id:attemptId,revision:1,bytes_digest:"a".repeat(64),provenance_digest:"b".repeat(64),width:1536,height:1024,mime_type:"image/png",policy_version:"acquired-hero/1"};
  assert.notEqual(candidateSubject(c),candidateSubject({...c,revision:2}));assert.notEqual(candidateSubject(c),candidateSubject({...c,bytes_digest:"c".repeat(64)}));
  const context={webPresenceId:attemptId,strategy:"generated-illustrated"} as never;
  assert.equal(workIdentity(context,{id:"openai",model:"gpt-image-1.5"},1),workIdentity(context,{id:"openai",model:"gpt-image-1.5"},1));
  assert.notEqual(workIdentity(context,{id:"openai",model:"gpt-image-1.5"},1),workIdentity(context,{id:"openai",model:"gpt-image-1.5"},2));
});

test("historical brief remains frozen and second brief has a separate request identity",()=>{
  assert.equal(requestForTemplate("miopages-service-illustration/1").prompt,illustrationRequest.prompt);
  const next=requestForTemplate(ITERATION_TWO_TEMPLATE);assert.notEqual(next.prompt,illustrationRequest.prompt);
  assert.ok(next.prompt.includes("checklist"));assert.ok(next.prompt.includes("refresh/update cycle"));
  assert.throws(()=>requestForTemplate("unknown"),{code:"invalid-request"});
  const context={webPresenceId:attemptId,strategy:"generated-illustrated"} as never;
  assert.notEqual(workIdentity(context,{id:"openai",model:"gpt-image-1.5"},2),workIdentity(context,{id:"openai",model:"gpt-image-1.5"},2,ITERATION_TWO_TEMPLATE));
});
