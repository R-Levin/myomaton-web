import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdtemp, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { migrationRole, operatorRole, protectedConnection, protectedPool, verifyProtectedSession } from "../lib/platform/wordpress-delivery/protected-connection";
import { protectedOperatorServices } from "../lib/platform/wordpress-delivery/protected-services";
import { wordpressRehearsalFixture } from "./customer-initializers/wordpress-rehearsal";
import { rehearsalSite } from "./db/wordpress-rehearsal-principals";
import { privateStageDiagnostic, verifyPrivateStageAdapter } from "./db/wordpress-private-stage";

const origin = "https://miopages.org";
const oldInstallation = "9a511424-79af-4d02-801e-8d191d4b0d2f";
const grants = {
  author: ["prepare-site-proposal", "revise-site-proposal", "preview-site-proposal"],
  approver: ["approve-site-proposal"],
  reviewer: ["review-private-stage", "enroll", "revoke"],
  authorizer: ["authorize-native-draft"],
} as const;

async function main() {
  let stage = "configuration", directory: string | undefined;
  try {
    assert.equal(process.platform, "linux");
    assert.equal(process.env.MIOPAGES_WP_SCHEMA_ACTION, "enroll");
    const home = await realpath(process.env.HOME ?? "");
    assert.equal(home, "/home/virtual/vps-bef564/5/53b4381d42");
    assert.equal(await realpath(process.cwd()), path.join(home, "miopages-wp-rehearsal"));
    const credentialsFile = path.join(home, "miopages-wp-db-20261105T181534Z/wordpress-role-credentials.json");
    const metadata = await lstat(credentialsFile);
    assert.ok(metadata.isFile() && metadata.uid === process.getuid!() && (metadata.mode & 0o777) === 0o600);
    const saved = JSON.parse(await readFile(credentialsFile, "utf8"));
    const ca = process.env.MIOPAGES_WP_DATABASE_CA;
    const migration = protectedPool(process.env.MIOPAGES_WP_MIGRATION_URL ?? "", migrationRole, ca);
    const operator = protectedPool(saved.operator.url, operatorRole, ca);
    const keys = generateKeyPairSync("ed25519");
    const installation = { ...rehearsalSite, origin, installationId: randomUUID(), credentialId: randomUUID(), keyId: "native-draft-1",
      publicKeyBase64: Buffer.from(keys.publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64") };
    const principals = (Object.keys(grants) as (keyof typeof grants)[]).map(reference => ({
      reference, id: randomUUID(), token: randomBytes(32).toString("hex"),
      grants: grants[reference].map(permission => ({ id: randomUUID(), permission })),
    }));
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const scope = [rehearsalSite.webPresenceId, rehearsalSite.managedSiteId];
    try {
      stage = "enrollment-preflight";
      const db = await migration.connect();
      try {
        await verifyProtectedSession(db, migrationRole, "postgres");
        await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        try {
          await db.query("SET LOCAL search_path=miopages_wp,public");
          await db.query("SELECT pg_advisory_xact_lock(hashtextextended('miopages-native-draft-enrollment',0))");
          await verifyPrivateStageAdapter(db, true, true);
          assert.deepEqual((await wordpressRehearsalFixture(db, "verify")).site, rehearsalSite);
          const old = (await db.query("SELECT id,status,web_presence_id,managed_site_id FROM wordpress_installations WHERE origin=$1", [origin])).rows;
          assert.deepEqual(old, [{ id: oldInstallation, status: "revoked",
            web_presence_id: rehearsalSite.webPresenceId, managed_site_id: rehearsalSite.managedSiteId }]);
          assert.equal((await db.query(`SELECT 1 FROM wordpress_operator_grants g JOIN wordpress_operator_credentials c ON c.id=g.operator_id
            WHERE g.web_presence_id=$1 AND g.managed_site_id=$2 AND g.revoked_at IS NULL
            AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()`, scope)).rowCount, 0);
          stage = "protected-custody";
          directory = await mkdtemp(path.join(home, "miopages-native-draft-enrollment-"));
          const custody = await open(path.join(directory, "session.json"), "wx", 0o600);
          try {
            await custody.writeFile(JSON.stringify({ principals, expiresAt, installation, secretHex: randomBytes(32).toString("hex"),
              signingKey: keys.privateKey.export({ type: "pkcs8", format: "pem" }) }) + "\n");
            await custody.sync();
          } finally { await custody.close(); }
          stage = "principal-enrollment";
          for (const person of principals) {
            await db.query("INSERT INTO wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,$3)",
              [person.id, createHash("sha256").update(Buffer.from(person.token, "hex")).digest("hex"), expiresAt]);
            for (const grant of person.grants) {
              await db.query(`INSERT INTO wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission,customer)
                VALUES($1,$2,$3,$4,$5,$6)`, [grant.id, person.id, ...scope, grant.permission,
                grant.permission === "approve-site-proposal" ? { kind: "accepted-authority", subjectId: "synthetic-native-draft-fixture",
                  authorityReference: "Owner-authorized synthetic non-public native draft rehearsal only" } : null]);
            }
          }
          await db.query("COMMIT");
        } catch (error) { await db.query("ROLLBACK"); throw error; }
      } finally { db.release(); }
      stage = "independent-grant-verification";
      const service = protectedOperatorServices(operator, db => protectedConnection(db, operatorRole, "postgres"), "https://wp-acceptance.miopages.com");
      let reviewer: object | undefined;
      for (const person of principals) {
        const context = await service.operator.authenticate(person.token);
        if (person.reference === "reviewer") reviewer = context;
        for (const grant of person.grants) {
          const authority = await service.operator.authorize(context, grant.permission, rehearsalSite);
          assert.equal(authority.operatorId, person.id);
          assert.equal(authority.authorityReference, grant.id);
        }
        for (const permission of Object.values(grants).flat()) {
          if (!person.grants.some(grant => grant.permission === permission)) {
            await assert.rejects(service.operator.authorize(context, permission, rehearsalSite), /authorization refused/);
          }
        }
      }
      stage = "installation-enrollment";
      assert.ok(reviewer);
      await service.delivery.enroll(reviewer, installation);
      stage = "installation-verification";
      const rows = (await operator.query(`SELECT i.id,i.status,i.generation,k.credential_id,k.public_key
        FROM miopages_wp.wordpress_installations i JOIN miopages_wp.wordpress_installation_keys k
        ON k.installation_id=i.id AND k.generation=i.generation WHERE i.origin=$1 ORDER BY i.status`, [origin])).rows;
      assert.equal(rows.length, 2);
      assert.deepEqual(rows[0], { id: installation.installationId, status: "active", generation: 1,
        credential_id: installation.credentialId, public_key: installation.publicKeyBase64 });
      assert.equal(rows[1].id, oldInstallation);
      assert.equal(rows[1].status, "revoked");
      console.log(JSON.stringify({ status: "PASS", operation: "enroll-native-draft", directory, expiresAt,
        installationId: installation.installationId, grantsVerified: true,
        principals: principals.map(({ reference, id, grants }) => ({ reference, id, grants })) }));
    } finally { await Promise.all([migration.end(), operator.end()]); }
  } catch (error) {
    console.error(JSON.stringify({ status: "BLOCKED", stage, directory, code: privateStageDiagnostic("adapter_validation", error).code }));
    process.exitCode = 1;
  }
}

void main();
