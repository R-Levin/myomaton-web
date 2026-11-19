import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {prepareC0ExistingWork} from "../../lib/platform/intake/c0-existing-work";
import type {OriginalMaterial} from "../../lib/platform/intake/presence-source-material";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
async function main(){
 const root=resolve("runtime-content/source-aware-run-e0fef9d-20261119/site-recovery");
 await mkdir(root,{recursive:true});
 const old=prepareC0ExistingWork(await readFile("scripts/customer-previews/miopages-c0-accepted.json"),await readFile("scripts/customer-previews/miopages-editorial-r3.json"));
 const texts=[
  ["owned-service-model","docs/web-presence-service-model.md","business-context"],
  ["owned-content-growth","docs/content-growth-loop.md","business-context"],
  ["owned-conversion-architecture","docs/conversion-architecture.md","business-context"],
  ["owned-design-direction","docs/miopages-business-focus.md","brand-reference"],
 ] as const;
 const material=[{source:old.source,bytes:old.bytes},...await Promise.all(texts.map(async([id,path,purpose])=>{
  const bytes=await readFile(path);
  const source:OriginalMaterial={id,sha256:sha(bytes),bytes:bytes.length,mime:"text/markdown",reference:path,
   author:"MioPages canonical service/design contract; intent and boundaries, not evidence of deployed operations",date:"2026-11-19",
   status:"approved-direction",purpose,operations:["research","report","direction","blueprint","page","editorial"]};
  return{source,bytes};
 }))];
 const plan={
  version:1,ownerDirection:"2026-11-19 direct owner continuation: use the full former site/design and system business knowledge with proper weight; retain useful new work, synthesize outside research, rewind as needed. No new spending ceiling inferred.",
  contextDigest:"082d9074fc8a10e6345d2cb138bc7ac87496ab057947ff54d3fbb61c77320a0a",
  baseVersion:54,previousStateDigest:"b17fc53a15373dffce55c637c5c8d0465aa0d74bdd828028ae8b5131925de515",
  previousGrantDigest:"24ff644f54b3bcf1d0665a43f28ea70dffc476cd85d0d5059bd188df2329372d",
  previousGrantSha256:"228af86143bb2528d6dccbdbabb30af3bee2f0774896549728d2f04cec5d42b9",
  previousMaterialsDigest:"4411aa64914bb2f55b3bc7e2ae4d3e7cd4f6ad84a1df7e590284acdfa60ba220",
  ledgerSha256:"ef1ddaa1d06c378169e4355bba7b6a855e12744cda90aa927b0a09ac7e3edba2",
  expiresAt:"2026-11-22T15:58:31.154Z",
  scope:{intakeId:"41a83e7e-1765-4517-941a-b2b151bb7c4a",webPresenceId:"2a08e054-902c-400b-9b96-3c2274bcadc2",managedSiteId:"2c0d637d-4ded-4597-ac8b-661519aba358"},
  additionalMaterials:material.map(m=>m.source),existingWorkCoverage:old.coverage,
  existingModel:"gpt-5.4-2026-03-05",
  limitsPreserved:{totalRunCapMicros:8000000,maximumGenerations:32,maximumProviderRequests:65,commercialReplans:2,editorialRounds:4,automaticRetries:0},
  custody:"Same existing wp-acceptance private case and approved OpenAI Responses only. Existing local WordPress visitor rendering/capture; no protected report/source export to a new destination.",
  operation:"One append-only source-repair event reopens report, preserving actual research, prior useful report/Direction/blueprint/Home, all events/usage/consumed allowances and protected41/6/75.",
 };
 const manifest=Buffer.from(JSON.stringify(plan,null,2)+"\n");
 for(const m of material)await writeFile(join(root,m.source.sha256+".source"),m.bytes,{flag:"wx",mode:0o600});
 await writeFile("docs/c0-source-recovery-amendment.json",manifest,{flag:"wx"});
 await writeFile(join(root,"manifest.json"),manifest,{flag:"wx",mode:0o600});
 assert.equal(material.length,5);
 console.log(JSON.stringify({status:"PASS",operation:"prepare-complete-existing-work",manifestSha256:sha(manifest),coverage:old.coverage,addedOriginals:material.length,bytes:material.reduce((n,m)=>n+m.bytes.length,0),providerCalls:0,hostedWrites:false}));
}
main().catch(()=>{console.error('{"status":"BLOCKED","operation":"prepare-complete-existing-work","detail":"Preserve prepared sources and inspect; no external request ran."}');process.exitCode=1});
