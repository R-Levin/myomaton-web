import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { principalManifest, rehearsalPermissions } from "../scripts/db/wordpress-rehearsal-principals";

function manifest() {
  return { version: 1, principals: Object.entries(rehearsalPermissions).map(([reference, permissions], i) => ({
    reference, id: randomUUID(), tokenSha256: (i ? "b" : "a").repeat(64),
    grants: permissions.map(permission => ({ id: randomUUID(), permission })),
  })) };
}

test("rehearsal enrollment accepts only two distinct hash-only principals with exact separated permissions", () => {
  const valid = manifest();
  assert.deepEqual(principalManifest(valid), valid);
  for (const corrupt of [
    (m: ReturnType<typeof manifest>) => { m.principals[1].tokenSha256 = m.principals[0].tokenSha256; },
    (m: ReturnType<typeof manifest>) => { m.principals[1].id = m.principals[0].id; },
    (m: ReturnType<typeof manifest>) => { m.principals[0].grants[0].permission = "issue"; },
    (m: ReturnType<typeof manifest>) => { m.principals[0].grants[0].id = m.principals[1].grants[0].id; },
    (m: ReturnType<typeof manifest>) => { Object.assign(m.principals[0], { token: "never-accept-raw-token-input" }); },
    (m: ReturnType<typeof manifest>) => { m.principals.reverse(); },
  ]) {
    const value = manifest(); corrupt(value); assert.throws(() => principalManifest(value));
  }
});
