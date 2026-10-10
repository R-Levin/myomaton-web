import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { Pool } from "pg";
import reviewed from "./customer-updates/miopages-focus-reviewed.json";
import { readBasis,type Scope } from "../lib/platform/operator-qc/context";
import { assessment,assertFresh,attest,checks,choices,classifications,createPacket,saveBrief,saveFinding,saveResolution,setCheck,statuses,type Packet } from "../lib/platform/operator-qc/model";
import { choice,uuid } from "../lib/platform/canonical/model";
import { buildIdentity,gatherRender } from "./operator-qc/render";
import { report } from "./operator-qc/report";

async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:{miopages:{type:"boolean"},organization:{type:"string"},"web-presence":{type:"string"},"managed-site":{type:"string"},"acquisition-receipt":{type:"string"},packet:{type:"string"},render:{type:"boolean"},actor:{type:"string"},check:{type:"string"},status:{type:"string"},note:{type:"string"},decision:{type:"string"}}});
  const command=positionals[0],url=process.env.DATABASE_URL;if(!url)throw Error("DATABASE_URL required");
  const pool=new Pool({connectionString:url,options:"-c default_transaction_read_only=on -c timezone=UTC"});let rl:ReturnType<typeof createInterface>|undefined;
  const answers:string[]=[];let closed=false,pending:{resolve:(s:string)=>void;reject:(e:Error)=>void}|undefined;
  const ask=async(label:string)=>{
    if(!rl){rl=createInterface({input:process.stdin,output:process.stdout,terminal:false});rl.on("line",line=>{if(pending){const waiter=pending;pending=undefined;waiter.resolve(line);}else answers.push(line);});rl.on("close",()=>{closed=true;pending?.reject(Error("Operator input ended"));pending=undefined;});}
    process.stdout.write(`${label}: `);if(answers.length)return answers.shift()!.trim();if(closed)throw Error("Operator input ended");return (await new Promise<string>((resolve,reject)=>{pending={resolve,reject};})).trim();
  };
  const select=async<T extends string>(label:string,options:readonly T[])=>{const v=await ask(`${label} (${options.join(" | ")})`);return choice(v,options);};
  const list=async(label:string)=>(await ask(`${label} (separate with ;)`)).split(";").map(s=>s.trim()).filter(Boolean);
  const root=path.resolve("runtime-content/operator-qc");let id:string,scope:Scope,packet:Packet;
  try{
    if(command==="prepare"){
      id=randomUUID();const target=values.miopages?reviewed.target:{organizationId:uuid(values.organization),webPresenceId:uuid(values["web-presence"]),managedSiteId:uuid(values["managed-site"])};scope={target,buildId:await buildIdentity()};
      if(values["acquisition-receipt"]){const receipt=JSON.parse(await readFile(values["acquisition-receipt"],"utf8"));if(receipt.webPresenceId!==target.webPresenceId||receipt.managedSiteId!==target.managedSiteId)throw Error("Foreign acquisition receipt");scope.acquisitionSchema=receipt.schema;}
      const basis=await readBasis(pool,scope);if(values.render){try{basis.technical=await gatherRender(url,basis,path.join(root,id,"evidence"));}catch{basis.technical.status="failed";basis.technical.limitations.push("Browser/render evidence failed or tooling unavailable; no technical pass inferred");}const current=await readBasis(pool,{...scope,buildId:await buildIdentity()});if(current.contextFingerprint!==basis.contextFingerprint)throw Error("Context changed during evidence collection");}
      packet=createPacket(basis);
    }else{
      id=uuid(values.packet);const saved=JSON.parse(await readFile(path.join(root,id,"packet.json"),"utf8")) as {scope:Scope;packet:Packet};scope=saved.scope;packet=saved.packet;
      assertFresh(packet,await readBasis(pool,{...scope,buildId:await buildIdentity()}));
      if(command!=="show"&&command!=="readiness"){
        const actor=values.actor??await ask("Operator identity");
        if(command==="check")packet=setCheck(packet,choice(values.check,checks),choice(values.status,statuses),values.note??await ask("Assessment evidence/reason"),actor);
        else if(command==="finding"){
          const pageId=await ask("Page UUID (blank for site)"),sectionId=await ask("Section UUID (optional)"),field=await ask("Field reference (optional)"),candidateId=await ask("Candidate UUID (optional)");
          packet=saveFinding(packet,{reference:{...(pageId?{pageId}:{}),...(sectionId?{sectionId}:{}),...(field?{field}:{}),...(candidateId?{candidateId}:{})},check:await select("Check",checks),severity:await select("Severity",["blocker","required correction","non-critical observation"]),problem:await ask("Observed problem"),evidence:await ask("Evidence/context"),effects:await list("Effects: accuracy/relevance/clarity/trust/conversion"),visitorProblem:await ask("Visitor problem"),expectedImprovement:await ask("Reviewable improvement"),responsible:await ask("Responsible party"),nextAction:await ask("Next bounded action"),status:"open"},actor);
        }else if(command==="close"){
          const findingId=await ask("Finding UUID"),existing=packet.findings.find(f=>f.id===findingId);if(!existing)throw Error("Unknown finding");const status=await select("Disposition",["resolved","deferred"]),evidence=await ask("Closure evidence / permitted deferral reason");packet=saveFinding(packet,{...existing,status,closure:status==="resolved"?evidence:undefined,deferral:status==="deferred"?evidence:undefined},actor);
        }else if(command==="resolve")packet=saveResolution(packet,{sectionId:await ask("VisualNeed Section UUID"),choice:await select("Proposed strategy",choices),classification:await select("Classification",classifications),criticality:await select("QC criticality",["critical","non-critical"]),disposition:await select("Current safe fallback",["requires-resolution","adequate-fallback"]),reason:await ask("Reason / adequacy evidence"),disclosure:await ask("Customer disclosure for remaining limitation")},actor);
        else if(command==="brief"){
          const sectionId=await ask("VisualNeed Section UUID"),classification=await select("Classification",classifications),semanticGoal=await ask("Semantic goal"),subject=await ask("Subject (optional)"),scene=await ask("Scene (optional)"),setting=await ask("Setting (optional)");
          packet=saveBrief(packet,{context:{sectionId,fingerprint:packet.basis.contextFingerprint},classification,semanticGoal,...(subject?{subject}:{}),...(scene?{scene}:{}),...(setting?{setting}:{}),visualStory:await ask("Visual story"),keyElements:await list("Key elements (maximum 5)"),exclusions:await list("Exclusions"),composition:await ask("Composition / negative space"),orientation:await select("Orientation",["landscape","portrait","square"]),styleTone:await ask("Style / tone"),brandConstraints:await list("Brand constraints"),truthBoundary:await select("Truth boundary",["illustrative","representative","actual-evidence"]),acceptanceCriteria:await list("Acceptance criteria"),workPolicy:{maxAttempts:Number(await ask("Proposed maximum attempts (does not authorize work)")),maxRetries:Number(await ask("Proposed maximum retries")),budgetMicros:Number(await ask("Proposed budget ceiling USD micros")),stopCondition:await ask("Stop condition")}},actor);
        }else throw Error("Commands: prepare, show, check, finding, close, resolve, brief, readiness");
      }
      if(command==="readiness"&&values.decision)packet=attest(packet,choice(values.decision,["ready","not-ready"]),values.actor??await ask("Human operator identity"),values.note??await ask("Readiness reason"));
    }
    assertFresh(packet,await readBasis(pool,{...scope,buildId:await buildIdentity()}));
    const folder=path.join(root,id);await mkdir(folder,{recursive:true});
    if(command!=="show"&&!(command==="readiness"&&!values.decision)){await writeFile(path.join(folder,"packet.json"),JSON.stringify({scope,packet},null,2)+"\n");await writeFile(path.join(folder,"report.md"),report(packet));}
    console.log(command==="show"?report(packet):JSON.stringify({packetId:id,report:path.join(folder,"report.md"),assessment:assessment(packet)},null,2));
  }finally{rl?.close();await pool.end();}
}
main().catch(()=>{console.error("QC command refused: invalid/stale context, operator input or unavailable evidence. No canonical writes or provider dispatch are supported.");process.exitCode=1;});
