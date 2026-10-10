import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { AcquisitionService } from "../lib/platform/acquisition/service";
import { loadNeed } from "../lib/platform/acquisition/context";
import { openAIImageProvider } from "../lib/platform/acquisition/openai";
import { ingestDisposable,cleanupCandidates } from "../lib/platform/acquisition/application";
import { readManagedObject } from "../lib/platform/assets/local-storage";
import { micros,type Decision } from "../lib/platform/acquisition/contracts";
import { createPilot,disposablePool,assertRealPreserved,type PilotReceipt } from "./acquisition/disposable";
import { escalatePilot } from "./acquisition/escalation";
import { startProductionFixture } from "../tests/integration/production-server";

async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:{receipt:{type:"string"},"budget-micros":{type:"string"},"reserve-micros":{type:"string"},candidate:{type:"string"},digest:{type:"string"},revision:{type:"string"},actor:{type:"string"},reason:{type:"string"},alt:{type:"string"},template:{type:"string"}}});
  const command=positionals[0];const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw Error("DATABASE_URL required");
  let receipt:PilotReceipt;let receiptPath=values.receipt;
  if(command==="create"){
    const budget=micros(Number(values["budget-micros"])),reserve=micros(Number(values["reserve-micros"]));if(reserve>budget)throw Error("Reservation exceeds budget");
    receipt=await createPilot(databaseUrl,budget,reserve);
    receiptPath=path.resolve("runtime-content/acquisition",`${receipt.schema}.json`);await mkdir(path.dirname(receiptPath),{recursive:true});
  }else{if(!receiptPath)throw Error("--receipt required");receipt=JSON.parse(await readFile(receiptPath,"utf8"));}
  if(receipt.version!==1||!receiptPath)throw Error("Invalid operator receipt");
  const pool=disposablePool(databaseUrl,receipt.schema),service=new AcquisitionService(pool,receipt.quarantineRoot),provider=openAIImageProvider();
  try{
    if(command==="create"){
      const need=await loadNeed(pool,receipt.webPresenceId,receipt.sectionId);const work=await service.create(need,provider,receipt.budgetMicros);receipt.workId=work.id;
      // Persist resumable local identity before the paid network boundary.
      await writeFile(receiptPath,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
      await service.dispatch(receipt.webPresenceId,work.id,provider,receipt.reserveMicros);
    }else{
      if(!receipt.workId)throw Error("Receipt has no work");
      const args=[receipt.webPresenceId,receipt.workId] as const;
      if(["approve","reject","revoke"].includes(command)){
        if(!values.candidate||!values.digest||!values.revision||!values.actor||!values.reason)throw Error("Decision requires exact subject, actor and reason");
        await service.decide(...args,{candidateId:values.candidate,digest:values.digest,revision:Number(values.revision),decision:command as Decision["decision"],actor:values.actor,reason:values.reason});
      }else if(command==="materialize"){
        const state=await service.inspect(...args);const candidate=state.candidates.find(c=>c.id===values.candidate);if(!candidate)throw Error("Owned candidate required");
        const bytes=await readManagedObject(receipt.quarantineRoot,receipt.webPresenceId,candidate.quarantine_key);const file=path.resolve("runtime-content/acquisition",`${candidate.id}.png`);
        try{await writeFile(file,bytes,{flag:"wx"});}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST"||!(await readFile(file)).equals(bytes))throw Error("Review output differs");}console.log(JSON.stringify({reviewFile:file,subjectDigest:candidate.subject_digest,preparedDigest:candidate.bytes_digest,revision:candidate.revision,humanApproved:false}));
      }else if(command==="escalate"){
        if(!values.actor||!values.reason)throw Error("Explicit operator authority/reason required");
        const next=await escalatePilot(service,receipt.webPresenceId,receipt.workId,provider,values.actor,values.reason);
        receipt.workId=next.id;receipt.budgetMicros=1500000;
        await writeFile(receiptPath,JSON.stringify(receipt,null,2)+"\n");
        await service.dispatch(receipt.webPresenceId,next.id,provider,receipt.reserveMicros);
      }else if(command==="iterate"){
        const current=await service.inspect(...args);const next=await service.create(current.work.context,provider,receipt.budgetMicros,current.work.iteration+1,values.template);
        receipt.workId=next.id;await writeFile(receiptPath,JSON.stringify(receipt,null,2)+"\n");await service.dispatch(receipt.webPresenceId,next.id,provider,receipt.reserveMicros);
      }else if(command==="retry"){await service.retry(...args);await service.dispatch(...args,provider,receipt.reserveMicros);}
      else if(command==="cancel")await service.cancel(...args);
      else if(command==="expire-lease")await service.expireLease(...args);
      else if(command==="expire")console.log(JSON.stringify({expired:await service.expireCandidates(receipt.webPresenceId)}));
      else if(command==="cleanup")console.log(JSON.stringify({removed:await cleanupCandidates(service,receipt.webPresenceId)}));
      else if(command==="ingest"){if(!values.candidate||!values.alt)throw Error("Candidate and meaningful alt required");console.log(JSON.stringify({disposableAssetId:await ingestDisposable(service,...args,values.candidate,receipt.root,values.alt)}));}
      else if(command==="preview"){
        const server=await startProductionFixture(databaseUrl,receipt.schema,receipt.root,receipt);
        console.log(JSON.stringify({preview:server.base,disposable:true,processId:server.processId}));
        for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>void server.stop().then(()=>process.exit(0)));
        await new Promise(()=>{});
      }else if(command==="list")console.log(JSON.stringify({jobs:await service.list(receipt.webPresenceId)}));
      else if(command!=="inspect")throw Error("Unknown operator command");
    }
    console.log(JSON.stringify({receipt:receiptPath,state:await service.inspect(receipt.webPresenceId,receipt.workId!),realCustomerFingerprint:await assertRealPreserved(databaseUrl,receipt)},null,2));
  }finally{await pool.end();}
}
// Never print raw provider, database connection or credential-bearing errors.
main().catch(()=>{console.error("Acquisition command refused. Check bounded job events and operator arguments; no raw credentials/errors logged.");process.exitCode=1;});
