import { object, text } from "../canonical/model";
import type { Authority } from "./model";

export type IdentityInput = { organizationName: string; webPresenceName: string; managedSiteName: string; confirmation: { reference: string; confirmedAt: string } };
export type ConfirmedIdentity = Omit<IdentityInput,"confirmation"> & { confirmation: IdentityInput["confirmation"] & { confirmedBy: string } };
export type CanonicalBinding = { organizationId: string; webPresenceId: string; managedSiteId: string; eventVersion: number; identity: ConfirmedIdentity; identityDigest: string };
export type CanonicalRequest = { requestId: string; expectedVersion: number; expectedCustomerFingerprint: string; identity: IdentityInput };
export function confirmedIdentity(value: unknown, authority: Authority): ConfirmedIdentity {
  const r=object(value,["organizationName","webPresenceName","managedSiteName","confirmation"]);
  if(!r.confirmation)throw Error("Explicit canonical identity confirmation required");
  const c=object(r.confirmation,["reference","confirmedAt"]);
  if(typeof c.confirmedAt!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(c.confirmedAt)||!Number.isFinite(Date.parse(c.confirmedAt))||Date.parse(c.confirmedAt)>Date.now())throw Error("Explicit canonical identity confirmation required");
  const name=(key:"organizationName"|"webPresenceName"|"managedSiteName")=>{try{return text(r[key]);}catch{throw Error("Confirmed canonical identity requires a valid "+key);}};
  return {organizationName:name("organizationName"),webPresenceName:name("webPresenceName"),managedSiteName:name("managedSiteName"),confirmation:{reference:text(c.reference,300),confirmedAt:new Date(c.confirmedAt).toISOString(),confirmedBy:authority.operatorId}};
}
