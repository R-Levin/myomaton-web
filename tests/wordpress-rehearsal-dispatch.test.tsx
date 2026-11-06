import assert from "node:assert/strict";
import test from "node:test";
import { dispatchRehearsal, rehearsalGrantRefs } from "../scripts/wordpress-rehearsal-dispatch";
import { rehearsalPermissions, rehearsalSite } from "../scripts/db/wordpress-rehearsal-principals";
import { exactRehearsal, rehearsalOperators } from "../scripts/db/wordpress-rehearsal-candidate";

function fixture(owner = false) {
  const calls: string[] = [], i = owner ? 0 : 1;
  const permissions: readonly string[] = Object.values(rehearsalPermissions)[i];
  const d = {
    authenticate: async () => { calls.push("authenticate"); return {}; },
    authorize: async (_context: unknown, permission: string) => {
      calls.push("authorize:" + permission);
      assert.ok(permissions.includes(permission), "permission refused");
      return { operatorId: rehearsalOperators[i], authorityReference: rehearsalGrantRefs[i][permissions.indexOf(permission)] };
    },
    denyOtherScope: async () => { calls.push("C0-denied"); },
    candidate: async (approved: boolean) => { calls.push("candidate:" + approved); return approved ? "a".repeat(64) : null; },
    installation: async (_id: string, active: boolean) => { calls.push("installation:" + active); },
    release: async () => { calls.push("release"); },
    signer: async () => { calls.push("signer"); return "PRIVATE-SIGNER-TEST-ONLY"; },
    invoke: async (_command: Record<string, unknown>, signer?: string) => { calls.push("invoke:" + Boolean(signer)); return { ok: true }; },
  };
  return { d, calls };
}
const token = "0".repeat(64), id = "29796cfe-a70b-4ca0-a05b-d5febdedc221";
const approve = { token, operation: "approve", input: { binding: { proposalId: exactRehearsal.proposalId, revision: 1,
  digest: exactRehearsal.digest, baseFingerprint: exactRehearsal.baseFingerprint,
  scope: { webPresenceId: rehearsalSite.webPresenceId, managedSiteId: rehearsalSite.managedSiteId } },
previewDigest: exactRehearsal.previewDigest, previewEvent: exactRehearsal.previewEvent, requestId: id, reference: "Owner exact approval" } };

test("owner/reviewer separation and exact candidate guard cannot be overridden by input", async () => {
  const owner = fixture(true); await dispatchRehearsal(approve, owner.d);
  assert.deepEqual(owner.calls, ["authenticate", "authorize:approve-site-proposal", "candidate:false", "invoke:false"]);
  await assert.rejects(dispatchRehearsal(approve, fixture().d), /permission refused/);
  await assert.rejects(dispatchRehearsal({ token, operation: "review", input: {} }, fixture(true).d), /permission refused/);
  for (const patch of [{ previewDigest: "f".repeat(64) }, { previewEvent: "f".repeat(64) },
    { binding: { ...approve.input.binding, revision: 2 } }, { operatorId: rehearsalOperators[0] }]) {
    const f = fixture(true); await assert.rejects(dispatchRehearsal({ ...approve, input: { ...approve.input, ...patch } }, f.d));
    assert.ok(!f.calls.some(c => c.startsWith("invoke") || c === "signer"));
  }
});

test("signer access is issuance-only and follows every live authority/eligibility gate", async () => {
  const command = { token, operation: "issue", input: { installationId: id, releaseId: id } };
  const f = fixture(); await dispatchRehearsal(command, f.d);
  assert.deepEqual(f.calls, ["authenticate", "authorize:issue", "installation:true", "candidate:true", "release", "signer", "invoke:true"]);
  for (const gate of ["authenticate", "authorize", "installation", "candidate", "release"] as const) {
    const g = fixture();
    Object.assign(g.d, { [gate]: async () => { throw Error("Gate refused"); } });
    await assert.rejects(dispatchRehearsal(command, g.d), /Gate refused/);
    assert.ok(!g.calls.includes("signer") && !g.calls.some(c => c.startsWith("invoke")));
  }
  const foreign = fixture(); foreign.d.authorize = async () => ({ operatorId: rehearsalOperators[0], authorityReference: rehearsalGrantRefs[1][5] });
  await assert.rejects(dispatchRehearsal(command, foreign.d)); assert.ok(!foreign.calls.includes("signer"));
});

test("allowlist denies code, credential changes, wrong destinations and signer arguments", async () => {
  for (const operation of ["exec", "eval", "rotate", "prepare", "preview", "publish", "migrate", "read-signer"]) {
    const f = fixture(); await assert.rejects(dispatchRehearsal({ token, operation, input: {} }, f.d)); assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  await assert.rejects(dispatchRehearsal({ token, operation: "issue", input: { installationId: id, releaseId: id, signingKeyFile: "/other" } }, f.d));
  assert.equal(f.calls.length, 0);
  await assert.rejects(dispatchRehearsal({ token, operation: "enroll", input: { ...rehearsalSite, origin: "https://other.example" } }, f.d));
});

test("verification/review/enrollment/revocation cannot access the signer", async () => {
  const owner = fixture(true);
  const verified = await dispatchRehearsal({ token, operation: "verify-approval", input: {} }, owner.d) as { verified: boolean };
  assert.equal(verified.verified, true); assert.ok(!owner.calls.includes("signer") && !owner.calls.some(c => c.startsWith("invoke")));
  for (const command of [
    { operation: "review", input: { site: rehearsalSite, proposalId: exactRehearsal.proposalId, approvalId: "a".repeat(64) } },
    { operation: "enroll", input: { ...rehearsalSite, origin: "https://miopages.org", installationId: id, credentialId: id, keyId: "test", publicKeyBase64: "test" } },
    { operation: "revoke", input: { installationId: id } },
  ]) {
    const f = fixture(); await dispatchRehearsal({ token, ...command }, f.d);
    assert.ok(!f.calls.includes("signer") && f.calls.includes("invoke:false"));
  }
});

test("both authentications verify every original grant plus denied cross-permission and C0 scope", async () => {
  for (const principal of [0, 1]) {
    const f = fixture(principal === 0);
    const result = await dispatchRehearsal({ token, operation: "authenticate", input: { principal } }, f.d) as { authenticated: boolean; grants: unknown[] };
    assert.equal(result.authenticated, true); assert.equal(result.grants.length, principal ? 7 : 3);
    assert.ok(f.calls.includes("C0-denied") && !f.calls.includes("signer"));
  }
});
