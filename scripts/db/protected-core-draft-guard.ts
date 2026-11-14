import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PoolClient } from "pg";
import { protectedConnection, protectedPool } from "../../lib/platform/wordpress-delivery/protected-connection";

const home = "/home/virtual/vps-bef564/5/53b4381d42";
const role = "miopages_migration";
const original = "039d1df064a3a7117d7b318b2a09a033bcb68ccd77e12653a2a95df83e4821e3";
const corrected = "1ed36464403915c24606bbeaeac6edf40d89320cdb0e11a01894303dd39b7696";
const expectedAcl = "{miopages_migration=X/miopages_migration,miopages_runtime=X/miopages_migration}";
const expectedTrigger = "CREATE TRIGGER prospect_intake_guard BEFORE INSERT OR UPDATE ON public.prospect_intakes FOR EACH ROW EXECUTE FUNCTION prospect_intake_guard()";
const sha = (source: string) => createHash("sha256").update(source).digest("hex");
let stage = "custody";
let commitStarted = false;

async function privateFile(path: string) {
  const info = await lstat(path);
  assert.ok(info.isFile() && info.uid === process.getuid?.() && (info.mode & 0o777) === 0o600 && await realpath(path) === path);
  return readFile(path, "utf8");
}

async function snapshot(db: PoolClient) {
  const { rows } = await db.query(`SELECT p.oid::text AS oid, pg_get_userbyid(p.proowner) AS owner,
    p.proacl::text AS acl, p.prosecdef AS definer, p.proconfig AS config, p.prosrc AS body,
    t.oid::text AS trigger_oid, t.tgenabled AS enabled, pg_get_triggerdef(t.oid) AS trigger,
    pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid AND t.tgrelid='public.prospect_intakes'::regclass AND NOT t.tgisinternal
    WHERE p.oid='public.prospect_intake_guard()'::regprocedure`);
  assert.equal(rows.length, 1);
  const { owner, acl, definer, config, enabled, trigger, oid, trigger_oid, body, definition } = rows[0];
  assert.deepEqual({ owner, acl, definer, config, enabled, trigger }, {
    owner: role, acl: expectedAcl, definer: false, config: null, enabled: "O", trigger: expectedTrigger,
  });
  return { oid, triggerOid: trigger_oid, bodyHash: sha(body), definition };
}

async function main() {
  const [action, ...extra] = process.argv.slice(2);
  assert.ok(["APPLY-PROTECTED-CORE-DRAFT-GUARD", "RESTORE-PROTECTED-CORE-DRAFT-GUARD"].includes(action) && !extra.length);
  assert.equal(await realpath(process.env.HOME ?? ""), home);
  const password = (await readFile("/dev/stdin", "utf8")).replace(/\n$/, "");
  assert.ok(password);
  const recovery = join(home, "miopages-wp-db-20261105T181534Z");
  const roleFile = JSON.parse(await privateFile(join(recovery, "wordpress-role-credentials.json")));
  const url = new URL(roleFile.operator.url);
  assert.ok(url.protocol === "postgresql:" && url.hostname === "aws-0-us-east-1.pooler.supabase.com" &&
    url.port === "5432" && url.pathname === "/postgres" && url.search === "?sslmode=verify-full" &&
    /^miopages_wp_operator\.[a-z0-9]+$/.test(url.username));
  url.username = url.username.replace(/^miopages_wp_operator\./, role + ".");
  url.password = encodeURIComponent(password);
  const ca = await readFile(join(home, "supabase-ca.crt"), "utf8");
  assert.match(ca, /BEGIN CERTIFICATE/);
  const dir = join(home, "miopages-protected-draft-guard-a3b5d83");
  const stat = await lstat(dir);
  assert.ok(stat.isDirectory() && (stat.mode & 0o777) === 0o700 && stat.uid === process.getuid?.() && await realpath(dir) === dir);
  const rollback = join(dir, "original.sql");
  const replacement = await privateFile(join(dir, "replacement.sql"));
  assert.equal(sha(replacement), "a695a286f238ca70292fe1b436b3c78aa018dbc855c8492249479b7843e55045");
  const body = replacement.match(/AS \$\$([\s\S]*?)\$\$;/)?.[1];
  assert.equal(sha(body ?? ""), corrected);
  const restoring = action.startsWith("RESTORE");
  const pool = protectedPool(url.href, role, ca);
  let db: PoolClient | undefined;
  try {
    stage = "owner-session";
    db = await pool.connect();
    await protectedConnection(db, role, "postgres");
    await db.query("BEGIN");
    stage = "exclusive-writer-gate";
    await db.query("SET LOCAL lock_timeout = '2s'");
    await db.query("SET LOCAL statement_timeout = '15s'");
    assert.equal((await db.query("SELECT pg_try_advisory_xact_lock(hashtext('miopages-protected-core-draft-guard')) AS locked")).rows[0].locked, true);
    await db.query("LOCK TABLE public.prospect_intakes IN SHARE ROW EXCLUSIVE MODE NOWAIT");
    stage = "baseline";
    const before = await snapshot(db);
    assert.equal(before.bodyHash, restoring ? corrected : original);
    const path = restoring ? rollback : join(dir, "replacement.sql");
    if (!restoring) await writeFile(rollback, before.definition, { mode: 0o600, flag: "wx", flush: true });
    const sql = await privateFile(path);
    if (restoring) {
      const originalBody = sql.match(/AS \$function\$([\s\S]*?)\$function\$/)?.[1];
      assert.equal(sha(originalBody ?? ""), original);
    }
    stage = "replace-function";
    await db.query(sql);
    stage = "verify-before-commit";
    const after = await snapshot(db);
    assert.deepEqual([after.bodyHash, after.oid, after.triggerOid], [restoring ? original : corrected, before.oid, before.triggerOid]);
    commitStarted = true;
    await db.query("COMMIT");
    stage = "verify-after-commit";
    const durable = await snapshot(db);
    assert.deepEqual(durable, after);
    console.log(JSON.stringify({ status: "PASS", operation: action, bodyHash: durable.bodyHash, owner: role,
      permissionsUnchanged: true, triggerEnabled: true, recoveryDefinitionRetained: true }));
  } catch (error) {
    if (db && !commitStarted) await db.query("ROLLBACK");
    throw error;
  } finally {
    db?.release();
    await pool.end();
  }
}
main().catch((error: { code?: string }) => {
  console.error(JSON.stringify({ status: "BLOCKED", stage, code: error.code ?? "VALIDATION", commitStarted }));
  process.exitCode = 1;
});
