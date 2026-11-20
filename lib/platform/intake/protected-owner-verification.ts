import assert from "node:assert/strict";

/** Existing owner HTTPS check, shared by setup and non-mutating activation.
 * Fixed origin; password/cookie/response stay in memory and are never logged. */
export async function verifyProtectedOwner(password:string,expected?:{draftVersion:number;workflowRevision:number},send:typeof fetch=fetch) {
  const origin="https://wp-acceptance.miopages.com",endpoint=origin+"/api/protected-core";
  const headers={Origin:origin,"X-Intake-Request":"1","Content-Type":"application/json"};
  const login=await send(endpoint,{method:"POST",headers,redirect:"error",signal:AbortSignal.timeout(20000),
    body:JSON.stringify({operation:"sign-in",username:"owner",password})});
  assert.equal(login.status,200);
  const issued=login.headers.get("set-cookie");
  assert.ok(issued&&issued.startsWith("__Host-miopages_core=")&&["HttpOnly","Secure","SameSite=Strict","Max-Age=28800"].every(value=>issued.includes(value)));
  const cookie=issued.split(";")[0];let version=0,workflowVersion:number|undefined;
  try {
    const response=await send(endpoint,{headers:{...headers,Cookie:cookie},redirect:"error",signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200);const view=await response.json();
    assert.ok(view.prepared?.scenario==="c0"&&view.sitePlanning?.proposal&&view.sitePlanningReview?.current);
    assert.ok(Number.isSafeInteger(view.version)&&view.version>=28);version=view.version;workflowVersion=view.workflow?.version;
    if(expected){assert.equal(version,expected.draftVersion);assert.equal(workflowVersion,expected.workflowRevision);}
  } finally {
    const logout=await send(endpoint,{method:"POST",headers:{...headers,Cookie:cookie,"X-Core-Operation":"logout"},
      redirect:"error",signal:AbortSignal.timeout(10000)});assert.equal(logout.status,200);
  }
  const refused=await send(endpoint,{headers:{...headers,Cookie:cookie},redirect:"error",signal:AbortSignal.timeout(10000)});
  assert.equal(refused.status,401);
  return {draftVersion:version,workflowRevision:workflowVersion,logoutVerified:true};
}
