import assert from "node:assert/strict";
import { managedOperatorEnvironment,managedOperatorDiagnostic } from "./db/managed-operator";
import { initializeFreshHostedC0 } from "./customer-initializers/fresh-hosted-miopages-c0";
async function main(){
  const config=managedOperatorEnvironment("fresh-hosted-c0");
  const action=process.env.MIOPAGES_C0_ACTION;assert.ok(action==="create"||action==="verify");
  console.log(JSON.stringify(await initializeFreshHostedC0(config,action)));
}
main().catch(error=>{console.error(JSON.stringify(managedOperatorDiagnostic(error)));process.exitCode=1;});
