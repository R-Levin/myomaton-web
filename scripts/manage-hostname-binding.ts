import assert from "node:assert/strict";
import { managedOperatorEnvironment,managedOperatorDiagnostic } from "./db/managed-operator";
import { manageHostname } from "./db/managed-hostname";
async function main(){
  const config=managedOperatorEnvironment("managed-hostname");
  const action=process.env.MIOPAGES_HOSTNAME_ACTION;assert.ok(action==="bind"||action==="verify");
  const required=(key:string)=>{const value=process.env[key];assert.ok(value,"Missing protected hostname configuration");return value;};
  console.log(JSON.stringify(await manageHostname(config,action,{hostname:required("MIOPAGES_HOSTNAME"),webPresenceId:required("MIOPAGES_WEB_PRESENCE_ID"),managedSiteId:required("MIOPAGES_MANAGED_SITE_ID")})));
}
main().catch(error=>{console.error(JSON.stringify(managedOperatorDiagnostic(error)));process.exitCode=1;});
