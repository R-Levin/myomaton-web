import assert from "node:assert/strict";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { migrationRole, protectedPool, verifyProtectedSession } from "../../lib/platform/wordpress-delivery/protected-connection";

const role = "miopages_core_development";
const view = "miopages_wp.core_development_inquiries";
const definitionId = "e113a3ed-ca49-4f23-9c25-2ffd40443c55";
let stage = "recovery";

async function main() {
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/5/53b4381d42");
  const evidence = join(home, "miopages-wp-db-20261105T181534Z", "database-rollout-evidence.json");
  const metadata = await lstat(evidence);
  assert.ok(metadata.isFile() && metadata.uid === process.getuid?.() && !(metadata.mode & 0o077) && await realpath(evidence) === evidence);
  const recovery = JSON.parse(await readFile(evidence, "utf8"));
  assert.equal(recovery.status, "PASS");
  assert.equal(recovery.recovery?.verified, true);

  stage = "migration-session";
  const pool = protectedPool(process.env.MIOPAGES_WP_MIGRATION_URL ?? "", migrationRole, process.env.MIOPAGES_WP_DATABASE_CA);
  try {
    const db = await pool.connect();
    try {
      await verifyProtectedSession(db, migrationRole, "postgres");
      stage = "scope-and-policy";
      await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      try {
        await db.query("SELECT pg_advisory_xact_lock(hashtext('miopages-protected-core-inquiry'))");
        assert.equal((await db.query("SELECT 1 FROM miopages_wp.core_development_scope")).rowCount, 1);
        const prior = await db.query("SELECT to_regclass($1) AS relation, EXISTS(SELECT FROM public.contact_definitions WHERE id=$2) AS definition", [view, definitionId]);
        assert.deepEqual(prior.rows[0], { relation: null, definition: false });
        await db.query(await readFile("lib/platform/intake/protected-core-inquiry.sql", "utf8"));
        stage = "verify-before-commit";
        const checked = (await db.query(`SELECT
          has_table_privilege($1,'public.contact_submissions','SELECT,INSERT,UPDATE,DELETE') AS direct,
          has_table_privilege($1,$2,'UPDATE,DELETE,TRUNCATE') AS mutate,
          has_column_privilege($1,$2,'id','SELECT') AS readback,
          has_column_privilege($1,$2,'fields','INSERT') AS accept,
          EXISTS (SELECT 1 FROM miopages_wp.core_development_scope s JOIN public.contact_definitions d
            USING (web_presence_id) WHERE d.id=$3 AND d.version=1 AND d.status='active' AND d.delivery_route_key IS NULL) AS definition`,
        [role, view, definitionId])).rows[0];
        assert.deepEqual(checked, { direct: false, mutate: false, readback: true, accept: true, definition: true });
        await db.query("COMMIT");
        console.log(JSON.stringify({ status: "PASS", operation: "protected-core-inquiry-policy", scopedDefinition: true,
          restrictedView: true, canonicalTableGrants: false, inquiryCreated: false }));
      } catch (error) { await db.query("ROLLBACK"); throw error; }
    } finally { db.release(); }
  } finally { await pool.end(); }
}

main().catch(error => {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : "VALIDATION";
  console.error(JSON.stringify({ status: "BLOCKED", stage, code }));
  process.exitCode = 1;
});
