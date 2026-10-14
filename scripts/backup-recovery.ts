import { parseArgs } from "node:util";
import { backup, copyPoint, defaultConfig, planRetention, restoreTest, verify } from "./backup/core";

async function main() {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{root:{type:"string"},point:{type:"string"},destination:{type:"string"}},strict:true});
  if(!values.root||positionals.length!==1)throw Error("Use backup|verify|restore-test|copy|retention-plan with an explicit absolute --root");
  const config=defaultConfig(values.root),operation=positionals[0];let result:unknown;
  if(operation==="backup")result=await backup(config);
  else if(operation==="retention-plan")result=await planRetention(config);
  else {if(!values.point)throw Error("Explicit --point required");
    if(operation==="verify"){const {manifest}=await verify(config,values.point);result={id:manifest.id,verified:true,canonicalFingerprint:manifest.state.canonicalFingerprint,managedObjects:manifest.state.managed.length};}
    else if(operation==="restore-test")result=await restoreTest(config,values.point);
    else if(operation==="copy"&&values.destination)result=await copyPoint(config,values.point,values.destination);
    else throw Error("Unknown operation or missing destination");
  }
  console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Backup/recovery failed");process.exitCode=1;});
