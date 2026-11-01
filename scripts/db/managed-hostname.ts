import assert from "node:assert/strict";
import { normalizeHostname } from "../../lib/platform/managed-sites/hostname";
import { uuid } from "../../lib/platform/canonical/model";
import { managedOperatorTransaction, verifyManagedOperator, type ManagedOperatorConfig } from "./managed-operator";

export type HostnameBinding = {hostname:string;webPresenceId:string;managedSiteId:string};
export function validateHostnameBinding(binding:HostnameBinding) {
  assert.equal(normalizeHostname(binding.hostname),binding.hostname,"Supply exact normalized hostname");
  assert.equal(uuid(binding.webPresenceId),binding.webPresenceId,"Supply canonical Web Presence UUID");
  assert.equal(uuid(binding.managedSiteId),binding.managedSiteId,"Supply canonical Managed Site UUID");
}
export async function manageHostname(input:ManagedOperatorConfig,operation:"bind"|"verify",binding:HostnameBinding) {
  assert.ok(operation==="bind"||operation==="verify");validateHostnameBinding(binding);
  return managedOperatorTransaction(input,operation==="verify",async(c,stage)=>{
    if(operation==="bind"){stage("lock");await c.query("LOCK TABLE public.managed_site_hostnames IN SHARE ROW EXCLUSIVE MODE");}
    stage("preflight");await verifyManagedOperator(c,input);
    const target=(await c.query(`SELECT m.id FROM public.managed_sites m JOIN public.web_presences w ON w.id=m.web_presence_id JOIN public.organizations o ON o.id=w.organization_id WHERE m.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active' AND o.status='active' ${operation==="bind"?"FOR SHARE OF m,w,o":""}`,[binding.managedSiteId,binding.webPresenceId])).rows;
    assert.equal(target.length,1,"Active owned hostname target required");stage("hostname");
    const existing=(await c.query("SELECT id,web_presence_id,managed_site_id,status FROM public.managed_site_hostnames WHERE hostname=$1",[binding.hostname])).rows[0];
    if(existing){assert.equal(existing.web_presence_id,binding.webPresenceId);assert.equal(existing.managed_site_id,binding.managedSiteId);assert.equal(existing.status,"active");return {verified:true,hostname:binding.hostname,bindingId:existing.id,inserted:0,updated:0,deleted:0};}
    assert.equal(operation,"bind","Hostname binding does not exist");
    const row=(await c.query("INSERT INTO public.managed_site_hostnames(hostname,web_presence_id,managed_site_id) VALUES($1,$2,$3) RETURNING id",[binding.hostname,binding.webPresenceId,binding.managedSiteId])).rows[0];
    return {verified:true,hostname:binding.hostname,bindingId:row.id,inserted:1,updated:0,deleted:0};
  });
}
