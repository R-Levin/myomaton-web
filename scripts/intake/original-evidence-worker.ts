import {evaluationCommand} from "./presence-evaluation-worker";
import {originalEvidenceApproval,originalEvidenceCandidate} from "./original-evidence-activation";
import {readFile,writeFile,rename} from "node:fs/promises";
import {Pool} from "pg";
import {fingerprint} from "../../lib/platform/canonical/model";
import {openCommercialActivation} from "./commercial-evaluation-activation";
import {createHash} from "node:crypto";
import {join} from "node:path";
import {realpath as resolveRealPath} from "node:fs/promises";
const [operation,value]=process.argv.slice(2);
const allowed=["rebind-executable","rebind-unused","activate","work","recover","inspect","continue","continue-local-home","revise-local-page","review-site","revise-site","decide-editorial","retry","resume-undispatched","local-site","local-home"];
async function main(){
 if(!allowed.includes(operation))throw Error("Operation refused");
 const home=await resolveRealPath(process.env.HOME??"");
 const password=(await readFile(join(home,"miopages-private-acceptance/p0-22-c0-runtime/db/password"),"utf8")).trim();
 if(!/^[a-f0-9]{64}$/.test(password))throw Error("Dedicated database credential unavailable");
 const url=new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_"+originalEvidenceCandidate.intakeId.replaceAll("-",""));
 url.password=password;process.env.MIOPAGES_EVALUATION_DATABASE_URL=url.href;
 if(operation==="rebind-unused"||operation==="rebind-executable"){
  const parent=join(home,"miopages-private-acceptance"),root=join(parent,"presence-evaluation",originalEvidenceCandidate.intakeId);
  const db=new Pool({connectionString:url.href});
  try{
   const count=(await db.query("SELECT count(*)::int AS n FROM public.presence_workflow_events")).rows[0].n;
   const ledger=await readFile(join(root,"usage/onboarding-usage.json"));
   if(operation==="rebind-unused"&&(count!==0||createHash("sha256").update(ledger).digest("hex")!=="bfae3dd16adcec2e5ea06f12b9ce4305b3e4ced5d4a62ab897633720406d426b"))throw Error("Unused binding prerequisite failed");
   const oldGrant=await readFile(join(root,"grant.json")),oldBinding=await readFile(join(root,"activation.json"));
   const old=JSON.parse(oldGrant.toString()),binding=JSON.parse(oldBinding.toString());
   if(old.ledger.generations!==(operation==="rebind-unused"?50:49)||old.ledger.requests!==99||binding.grant!==fingerprint(old))throw Error("Original unused scope differs");
   const compiled=await openCommercialActivation(parent,false,false,true);
   const context=JSON.parse(await readFile(join(root,"context.json"),"utf8")).context;
   const next=await compiled.compile(context);
   if(fingerprint(next.context)!==fingerprint(context)||next.grant.ledger.generations!==49)throw Error("Scope changed");
   if(operation==="rebind-executable"){
    if(fingerprint(next.grant)!==fingerprint(old)||count!==3)throw Error("Existing scope or workflow changed");
    await writeFile(join(root,"binding-before-source-recovery.json"),oldBinding,{flag:"wx",mode:0o600});
    await writeFile(join(root,"binding.next"),JSON.stringify({activation:compiled.fingerprint,grant:fingerprint(old)})+"\n",{flag:"wx",mode:0o600});
    await rename(join(root,"binding.next"),join(root,"activation.json"));
    console.log(JSON.stringify({miopagesRunResult:1,status:"PASS",operation,grantUnchanged:true,ledgerUnchanged:true,retainedOutputs:true}));return;
   }
   await writeFile(join(root,"grant-before-counter-correction.json"),oldGrant,{flag:"wx",mode:0o600});
   await writeFile(join(root,"binding-before-counter-correction.json"),oldBinding,{flag:"wx",mode:0o600});
   await writeFile(join(root,"grant.next"),JSON.stringify(next.grant)+"\n",{flag:"wx",mode:0o600});
   await writeFile(join(root,"activation.next"),JSON.stringify({activation:compiled.fingerprint,grant:fingerprint(next.grant)})+"\n",{flag:"wx",mode:0o600});
   await rename(join(root,"grant.next"),join(root,"grant.json"));await rename(join(root,"activation.next"),join(root,"activation.json"));
   console.log(JSON.stringify({miopagesRunResult:1,status:"PASS",operation,providerCalls:0,ledgerUnchanged:true,generations:49,requests:99}));return;
  }finally{await db.end()}
 }
 let argument=value;
 if(operation==="recover"&&value){
  argument=JSON.stringify({version:Number(value)});
 }
 const result=await evaluationCommand([operation,"c0",originalEvidenceApproval,...argument?[argument]:[]]);
 console.log(JSON.stringify({miopagesRunResult:1,status:"PASS",operation,result}));
}
main().catch((error:Error & {code?:string})=>{
 console.log(JSON.stringify({miopagesRunResult:1,status:"BLOCKED",operation,stage:"original-evidence-worker",
  code:/^[A-Z0-9_]{1,50}$/.test(error.code??"")?error.code:"VALIDATION_OR_OPERATION_FAILED"}));
 process.exitCode=1;
});
