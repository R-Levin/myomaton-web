import assert from "node:assert/strict";
import test from "node:test";
import { confirmedIdentity } from "../lib/platform/activation/canonical";

const authority={operatorId:"test-operator",authorityReference:"test-authority"};
const identity={organizationName:"Confirmed organization",webPresenceName:"Confirmed presence",managedSiteName:"Confirmed site",confirmation:{reference:"Identity explicitly checked with customer",confirmedAt:"2026-10-19T00:00:00Z"}};
test("canonical identity is explicit, bounded and separately attested; it has no intake/Review fallback",()=>{
  assert.deepEqual(confirmedIdentity(identity,authority),{...identity,confirmation:{...identity.confirmation,confirmedAt:"2026-10-19T00:00:00.000Z",confirmedBy:authority.operatorId}});
  for(const value of [{},{...identity,organizationName:""},{...identity,webPresenceName:undefined},{...identity,managedSiteName:"<unsafe>"},{...identity,confirmation:undefined},{...identity,confirmation:{...identity.confirmation,reference:""}},{...identity,confirmation:{...identity.confirmation,confirmedAt:"2999-01-01T00:00:00Z"}},{...identity,confirmation:{...identity.confirmation,confirmedBy:"forged"}},{...identity,organizationId:"existing graph"},{...identity,knowledge:{entries:[]}}])assert.throws(()=>confirmedIdentity(value,authority));
});
