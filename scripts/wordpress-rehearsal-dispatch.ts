import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { choice, object, uuid } from "../lib/platform/canonical/model";
import { binding } from "../lib/platform/content-editing/proposal";
import { ProtectedOperator } from "../lib/platform/wordpress-delivery/operator";
import { protectedPool, protectedConnection, operatorRole } from "../lib/platform/wordpress-delivery/protected-connection";
import { reviewedPrivateSource } from "../lib/platform/wordpress-delivery/private-source";
import { childEnvironment } from "./wordpress-database-rollout";
import { rehearsalPermissions, rehearsalSite } from "./db/wordpress-rehearsal-principals";
import { exactRehearsal, rehearsalOperators, verifyExactRehearsalCandidate } from "./db/wordpress-rehearsal-candidate";

type Permission = Parameters<ProtectedOperator["authorize"]>[1];
export const rehearsalGrantRefs = [
  ["7f444272-73e3-45e4-9ea3-e8496f6a5011", "eb438c3f-395b-4980-9758-f507048f9990", "da70a65e-a89e-4b38-938f-87290bf1447e"],
  ["761eeade-0d4b-479b-97a6-f847936179ad", "449f7c04-7534-4f89-8483-c571e3224426", "bf9f0cac-4ca4-4118-af2a-296605c0ea00", "dd627df4-58b8-480d-8ac2-bdde7c3577b7", "0ac7484a-f076-4e9c-a59b-af077bc749d4", "f9b1db32-5c88-4bc9-868b-f81ace5f87b1", "8b097b11-0b61-4d70-b1fb-35d246bda3a6"],
];
type Deps = {
  authenticate(token: unknown): Promise<unknown>;
  authorize(context: unknown, permission: Permission): Promise<{ operatorId: string; authorityReference: string }>;
  denyOtherScope(context: unknown, permission: Permission): Promise<void>;
  candidate(approved: boolean): Promise<string | null>;
  installation(id: string, active: boolean): Promise<void>;
  release(id?: string): Promise<void>;
  signer(): Promise<string>;
  invoke(command: Record<string, unknown>, signer?: string): Promise<unknown>;
};

// A fixed, candidate-pinned adapter around Core, never an alternate authority.
export async function dispatchRehearsal(value: unknown, d: Deps) {
  const command = object(value, ["token", "operation", "input"]);
  const operation = choice(command.operation, ["authenticate", "approve", "verify-approval", "review", "enroll", "issue", "revoke"]);
  const input = object(command.input, operation === "verify-approval" ? [] : operation === "authenticate" ? ["principal"] : operation === "approve"
    ? ["binding", "previewDigest", "previewEvent", "requestId", "reference"] : operation === "review"
      ? ["site", "proposalId", "approvalId", "commit"] : operation === "enroll"
        ? ["organizationId", "webPresenceId", "managedSiteId", "installationId", "credentialId", "origin", "keyId", "publicKeyBase64"]
        : operation === "issue" ? ["installationId", "releaseId"] : ["installationId"]);
  const context = await d.authenticate(command.token);
  if (operation === "authenticate") {
    assert.ok(input.principal === 0 || input.principal === 1);
    const i = input.principal, permissions = Object.values(rehearsalPermissions)[i];
    const grants = [];
    for (const [index, permission] of permissions.entries()) {
      const actor = await d.authorize(context, permission);
      assert.equal(actor.operatorId, rehearsalOperators[i]);
      assert.equal(actor.authorityReference, rehearsalGrantRefs[i][index]);
      grants.push({ permission, id: actor.authorityReference });
    }
    await assert.rejects(d.authorize(context, i === 0 ? "review-private-stage" : "approve-site-proposal"));
    await d.denyOtherScope(context, permissions[0]);
    return { authenticated: true, operatorId: rehearsalOperators[i], grants, separationVerified: true, c0AccessRefused: true };
  }
  const permission = operation === "approve" || operation === "verify-approval" ? "approve-site-proposal" : operation === "review" ? "review-private-stage" : operation;
  const actor = await d.authorize(context, permission);
  const selected = operation === "approve" || operation === "verify-approval" ? 0 : 1;
  assert.equal(actor.operatorId, rehearsalOperators[selected], "Exact independent operator required");
  const permissions: readonly string[] = Object.values(rehearsalPermissions)[selected];
  assert.equal(actor.authorityReference, rehearsalGrantRefs[selected][permissions.indexOf(permission)]);
  if (operation === "verify-approval") return { verified: true, approvalId: await d.candidate(true),
    proposalId: exactRehearsal.proposalId, revision: 1, previewDigest: exactRehearsal.previewDigest };
  if (operation === "approve") {
    assert.deepEqual(binding(input.binding), { proposalId: exactRehearsal.proposalId, revision: 1,
      digest: exactRehearsal.digest, baseFingerprint: exactRehearsal.baseFingerprint,
      scope: { webPresenceId: rehearsalSite.webPresenceId, managedSiteId: rehearsalSite.managedSiteId } });
    assert.equal(input.previewDigest, exactRehearsal.previewDigest); assert.equal(input.previewEvent, exactRehearsal.previewEvent);
    await d.candidate(false);
  } else if (operation === "review") {
    assert.deepEqual(input.site, rehearsalSite); assert.equal(input.proposalId, exactRehearsal.proposalId);
    assert.equal(input.approvalId, await d.candidate(true));
    if (input.commit !== undefined) {
      const commit = object(input.commit, ["releaseId", "projectionDigest"]); uuid(commit.releaseId);
      assert.equal(commit.projectionDigest, exactRehearsal.projectionDigest);
    }
  } else if (operation === "enroll") {
    for (const [key, expected] of Object.entries(rehearsalSite)) assert.equal(input[key], expected);
    assert.equal(input.origin, "https://miopages.org"); await d.candidate(true); await d.release();
  } else {
    const id = uuid(input.installationId); await d.installation(id, operation === "issue");
    if (operation === "issue") { await d.candidate(true); await d.release(uuid(input.releaseId)); }
  }
  // No signer access during authentication, approval, review, enrollment/revoke,
  // or on a failed authentication/grant/candidate/installation/release gate.
  const key = operation === "issue" ? await d.signer() : undefined;
  return d.invoke(command, key); // Existing Core CLI authenticates/authorizes again.
}

async function privateFile(file: string) {
  const s = await lstat(file);
  assert.ok(s.isFile() && !s.isSymbolicLink() && s.uid === process.getuid!() && (s.mode & 0o777) === 0o600);
  return readFile(file, "utf8");
}

async function main() {
  assert.equal(process.platform, "linux");
  const home = process.env.HOME!, repository = path.join(home, "miopages-wp-rehearsal");
  assert.equal(await realpath(process.cwd()), repository);
  const root = process.env.WP_REHEARSAL_PRIVATE_ROOT!;
  assert.equal(path.dirname(root), home); assert.match(path.basename(root), /^miopages-wp-principals-[0-9TZ]+$/);
  const stat = await lstat(root);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid!() && (stat.mode & 0o777) === 0o700);
  let length = 0; const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) { const b = Buffer.from(chunk); length += b.length; assert.ok(length <= 65536); chunks.push(b); }
  const command = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const credentials = JSON.parse(await privateFile(path.join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json")));
  const ca = await readFile(path.join(home, "supabase-ca.crt"), "utf8");
  const pool = protectedPool(credentials.operator.url, operatorRole, ca);
  const database = new URL(credentials.operator.url).pathname.slice(1);
  const authority = new ProtectedOperator(pool, db => protectedConnection(db, operatorRole, database));
  const read = async <T,>(fn: (db: PoolClient) => Promise<T>) => {
    const db = await pool.connect();
    try { await protectedConnection(db, operatorRole, database); await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      try { return await fn(db); } finally { await db.query("ROLLBACK"); }
    } finally { db.release(); }
  };
  try {
    const result = await dispatchRehearsal(command, {
      authenticate: token => authority.authenticate(token), authorize: (context, permission) => authority.authorize(context, permission, rehearsalSite),
      denyOtherScope: async (context, permission) => { await assert.rejects(authority.authorize(context, permission,
        { webPresenceId: "926cb772-7507-4542-8acd-e7e57ce71324", managedSiteId: "312b8081-4582-47fa-bedb-a551fd6e2b36" })); },
      candidate: approved => read(async db => { const state = await verifyExactRehearsalCandidate(db, approved); return state.approval ? state.events.at(-1)!.hash : null; }),
      installation: (id, active) => read(async db => { const row = (await db.query("SELECT organization_id,web_presence_id,managed_site_id,status FROM wordpress_installations WHERE id=$1", [id])).rows[0];
        assert.ok(row); if (active) assert.equal(row.status, "active");
        assert.deepEqual({ ...row, status: undefined }, { organization_id: rehearsalSite.organizationId, web_presence_id: rehearsalSite.webPresenceId, managed_site_id: rehearsalSite.managedSiteId, status: undefined }); }),
      release: id => read(async db => { const source = await reviewedPrivateSource(db, rehearsalSite); assert.ok(source); if (id) assert.equal(source.releaseId, id); assert.equal(source.projectionDigest, exactRehearsal.projectionDigest); }),
      signer: () => privateFile(path.join(root, "signing-key.pem")),
      invoke: async (c, signer) => {
        const env = childEnvironment(process.env, { MIOPAGES_WP_PRIVATE_STAGE: "enabled", MIOPAGES_WP_CORE_ORIGIN: "https://wp-acceptance.miopages.com",
          MIOPAGES_WP_OPERATOR_URL: credentials.operator.url, MIOPAGES_WP_DATABASE_CA: ca }, signer ? { MIOPAGES_WP_SIGNING_KEY: signer } : {});
        // execFile callback API supports a bounded stdin pipe without shell/argv secrets.
        const output = await new Promise<string>((resolve, reject) => {
          const child = execFile(process.execPath, ["--import", "tsx", "scripts/wordpress-private-operator.ts"],
            { cwd: repository, env, timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout) => error ? reject(Error("Core command refused; inspect outcome before retry")) : resolve(stdout));
          child.stdin!.end(JSON.stringify(c));
        });
        assert.ok(!output.includes(String(c.token)) && (!signer || !output.includes(signer)) && !output.includes("PRIVATE KEY-----"));
        return JSON.parse(output);
      },
    });
    console.log(JSON.stringify(result));
  } finally { await pool.end(); }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/wordpress-rehearsal-dispatch.ts")) {
  main().catch(() => { console.error("Fixed rehearsal operation refused. Stop and inspect before retry."); process.exitCode = 1; });
}
