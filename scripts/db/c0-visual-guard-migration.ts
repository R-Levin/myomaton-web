import assert from "node:assert/strict";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PoolClient } from "pg";
import { NativeDraftReceiptJournal } from "../../lib/platform/wordpress-delivery/native-draft-receipt";
import { ProtectedOperator } from "../../lib/platform/wordpress-delivery/operator";
import { migrationRole, operatorRole, protectedConnection, protectedPool, verifyProtectedSession } from "../../lib/platform/wordpress-delivery/protected-connection";
import { assertC0ProposalGuard, correctedProposalGuardSha256, legacyProposalGuardSha256, proposalGuardState, sqlSha256 } from "./c0-proposal-guard-check";

const manifestSha = "36f5dbffa00da0a8a407fa268adb83177def9adeb21b219b62f0cded2eb8b28d";
const forwardSha = "6c7efb1789e4d434f4f9857c8949434923e862e3c94e6ab6f6a5ec5113327898";
const rollbackSha = "a5d0b3390fd0925a4a58dc270057bbafb0a5f4ffbbcfa4800aec599276de2e81";
const installationId = "d84ebc69-46d5-4c64-adc6-ac7b87468f89";
const siteProposalId = "1e28f792-624d-4141-96db-45c4ba05e17d";
const predecessor = "2fd1dd2b6780a5f4e8af35c45f80845578032de06b632b05a9012ff52a455ae0";
const baselineDigest = "85786f251ed5b93e42d9ae2b8c7247d85d99280aa9b1bc5932a1321330a043db";
const org = "b3b46645-0364-4329-83c7-86a6ea9e56c4";
const scope = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const grants = [["prepare-site-proposal", "preview-site-proposal"], ["approve-site-proposal"], ["review-private-stage"], ["authorize-native-draft"]] as const;
type Credential = { id: string; token: string; grants: { id: string; permission: (typeof grants)[number][number] }[] };
type Guard = Awaited<ReturnType<typeof proposalGuardState>>;
let stage = "custody", outcome = "unchanged";

async function protectedPath(path: string, directory = false) {
  const s = await lstat(path);
  assert.ok((directory ? s.isDirectory() : s.isFile()) && !s.isSymbolicLink() &&
    s.uid === process.getuid?.() && (s.mode & 0o777) === (directory ? 0o700 : 0o600) && await realpath(path) === path);
}
async function protectedFile(path: string) {
  await protectedPath(path);
  return readFile(path, "utf8");
}
const json = async (path: string) => JSON.parse(await protectedFile(path));

async function readGuard(db: PoolClient, expected: string, reference?: Guard) {
  const state = await proposalGuardState(db);
  assert.equal(state.sha256, expected);
  assert.equal(state.trigger.tgenabled, "O");
  assert.equal(state.fn.prosecdef, false);
  assert.equal(state.fn.proconfig, null);
  const { rows: [owner] } = await db.query("SELECT pg_get_userbyid($1::oid) AS owner", [state.fn.proowner]);
  assert.equal(owner.owner, migrationRole);
  if (reference) assert.deepEqual([state.fn, state.trigger], [reference.fn, reference.trigger]);
  return state;
}

async function main() {
  const [operation] = process.argv.slice(2);
  assert.ok(process.argv.length === 3 && ["preflight", "apply"].includes(operation));
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/5/53b4381d42");
  const root = join(home, "miopages-c0-stage-36f5dbff"), run = join(root, "guard-5b8e2c8");
  assert.equal(await realpath(process.cwd()), run);
  await protectedPath(root, true);
  await protectedPath(run, true);
  const [forward, rollback, manifestBytes] = await Promise.all([
    protectedFile(join(run, "c0-private-workflow-proposal-guard.sql")),
    protectedFile(join(run, "c0-private-workflow-proposal-guard.rollback.sql")),
    protectedFile(join(root, "manifest.json")),
  ]);
  assert.deepEqual([sqlSha256(forward), sqlSha256(rollback), sqlSha256(manifestBytes)], [forwardSha, rollbackSha, manifestSha]);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.destination.installationId, installationId);
  const { principals, expiresAt, manifestSha: custodySha } = await json(join(root, "custody.json")) as {
    principals: Credential[]; expiresAt: string; manifestSha: string;
  };
  assert.equal(custodySha, manifestSha);
  assert.equal(new Set(principals.map(p => p.id)).size, 4);
  assert.deepEqual(principals.map(p => p.grants.map(g => g.permission)), grants);
  assert.ok(Date.parse(expiresAt) > Date.now());
  const retained = join(home, "miopages-native-draft-enrollment-LaSVWc");
  await protectedPath(retained, true);
  const { installation, secretHex } = await json(join(retained, "session.json"));
  assert.equal(installation.installationId, installationId);
  assert.equal(installation.origin, "https://miopages.org");
  const secret = Buffer.from(secretHex, "hex");
  stage = "recovery-receipt";
  try {
    const receipt = await new NativeDraftReceiptJournal(join(retained, "receipts")).verifyMaterializedBaseline({
      installationId, siteProposalId, requestedDigest: predecessor, appliedDigest: baselineDigest, revision: 3, paths: ["/", "/service"],
    }, secret);
    assert.deepEqual(receipt.posts, manifest.baseline.drafts.map((p: { path: string; wordPressId: number; sha256: string }) =>
      ({ path: p.path, id: p.wordPressId, contentSha256: p.sha256 })));
  } finally { secret.fill(0); }

  const saved = await json(join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json"));
  const ca = await readFile(join(home, "supabase-ca.crt"), "utf8");
  const url = new URL(saved.operator.url);
  assert.ok(url.username.startsWith(operatorRole + ".") && url.hostname === "aws-0-us-east-1.pooler.supabase.com");
  const pool = protectedPool(saved.operator.url, operatorRole, ca);
  async function verify(expected: string, reference?: Guard) {
    const operator = new ProtectedOperator(pool, db => protectedConnection(db, operatorRole, "postgres"));
    for (const p of principals) {
      const actor = await operator.authenticate(p.token);
      for (const g of p.grants) {
        const rule = await operator.authorize(actor, g.permission, scope);
        assert.equal(rule.operatorId, p.id);
        assert.equal(rule.authorityReference, g.id);
      }
      for (const permission of grants.flat()) {
        if (!p.grants.some(g => g.permission === permission)) await assert.rejects(operator.authorize(actor, permission, scope), /refused/);
      }
    }
    const db = await pool.connect();
    try {
      await verifyProtectedSession(db, operatorRole, "postgres");
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      try {
        assert.equal(Math.floor(Number((await db.query("SHOW server_version_num")).rows[0].server_version_num) / 10000), 17);
        const actual = await readGuard(db, expected, reference);
        if (expected === correctedProposalGuardSha256) await assertC0ProposalGuard(db);
        const { rows: [target] } = await db.query(
          "SELECT i.origin,i.status,i.generation,i.organization_id,i.web_presence_id,i.managed_site_id,k.key_id,k.public_key,k.credential_id FROM wordpress_installations i JOIN wordpress_installation_keys k ON k.installation_id=i.id AND k.generation=i.generation WHERE i.id=$1",
          [installationId]);
        assert.deepEqual(target, { origin: installation.origin, status: "active", generation: 1, organization_id: org,
          web_presence_id: scope.webPresenceId, managed_site_id: scope.managedSiteId, key_id: installation.keyId,
          public_key: installation.publicKeyBase64, credential_id: installation.credentialId });
        const { rows: [head] } = await db.query("SELECT revision,candidate_digest,site_proposal_id FROM wordpress_native_draft_authorizations WHERE installation_id=$1 ORDER BY revision DESC LIMIT 1", [installationId]);
        assert.deepEqual(head, { revision: 5, candidate_digest: predecessor, site_proposal_id: siteProposalId });
        return actual;
      } finally { await db.query("ROLLBACK"); }
    } finally { db.release(); }
  }
  try {
    stage = "read-only-preflight";
    const original = await verify(legacyProposalGuardSha256);
    if (operation === "preflight") {
      console.log(JSON.stringify({ status: "PASS", operation, exactSql: true, pgMajor: 17, grants: 5, expiresAt, legacyGuard: original.sha256, recoveryRevision: 3 }));
      return;
    }
    stage = "protected-migration-session";
    const [password, extra] = (await readFile("/dev/stdin", "utf8")).split("\n");
    assert.ok(password && extra === "");
    url.username = url.username.replace(operatorRole + ".", migrationRole + ".");
    url.password = encodeURIComponent(password);
    const migration = protectedPool(url.href, migrationRole, ca);
    try {
      const db = await migration.connect();
      try {
        await verifyProtectedSession(db, migrationRole, "postgres");
        await readGuard(db, legacyProposalGuardSha256, original);
        await writeFile(join(run, "original-definition.sql"), original.definition, { flag: "wx", mode: 0o600, flush: true });
        await writeFile(join(run, "original-metadata.json"), JSON.stringify({ fn: original.fn, trigger: original.trigger }) + "\n",
          { flag: "wx", mode: 0o600, flush: true });
        stage = "forward-sql";
        outcome = "uncertain";
        try {
          await db.query(forward);
        } catch (error) {
          // Report an interrupted result without retrying or restoring blindly.
          try {
            await db.query("ROLLBACK");
            await verify(legacyProposalGuardSha256, original);
            outcome = "unchanged";
          } catch { /* The original state could not be confirmed. */ }
          throw error;
        }

        stage = "independent-result-verification";
        outcome = "committed-unverified";
        try {
          const verified = await verify(correctedProposalGuardSha256, original);
          await writeFile(join(run, "migration-evidence.json"), JSON.stringify({ guard: verified.sha256, original: original.sha256,
            forwardSha, rollbackSha, expiresAt, permissionMetadataUnchanged: true }) + "\n", { flag: "wx", mode: 0o600, flush: true });
          outcome = "verified";
          console.log(JSON.stringify({ status: "PASS", operation, guard: verified.sha256, owner: migrationRole,
            permissionMetadataUnchanged: true, grants: 5, recoveryRetained: true, rolledBack: false }));
        } catch (error) {
          stage = "paired-rollback-precondition";
          await readGuard(db, correctedProposalGuardSha256, original);
          stage = "paired-rollback";
          outcome = "rollback-uncertain";
          await db.query(rollback);
          await readGuard(db, legacyProposalGuardSha256, original);
          outcome = "restored";
          throw error;
        }
      } finally { db.release(); }
    } finally { await migration.end(); }
  } finally { await pool.end(); }
}

void main().catch((error: { code?: string }) => {
  const code = error.code && /^[0-9A-Z_]{3,50}$/u.test(error.code) ? error.code : "VERIFICATION";
  console.error(JSON.stringify({ status: "BLOCKED", stage, outcome, code }));
  process.exitCode = 1;
});
