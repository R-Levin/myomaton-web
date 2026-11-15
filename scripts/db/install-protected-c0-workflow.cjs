'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { lstat, readFile, realpath } = require('node:fs/promises');
const { join } = require('node:path');
const { checkServerIdentity } = require('node:tls');
const { Client } = require('pg');

const home = '/home/virtual/vps-bef564/5/53b4381d42';
const intakeId = '91733e9a-70d5-4799-92c7-d045422f0e5b';
const webPresenceId = '819d007a-595d-4374-a2f0-96b900d46559';
const managedSiteId = '1d92a248-416f-4e22-baaf-d2f1fca70352';
const migration = 'miopages_migration';
const development = 'miopages_core_development';
const schema = 'miopages_core_workflow';
const sqlPins = new Map([
  ['presence-workflow.sql', '15bb73a6b0dcbcab4538edb9cdf7423d5cf3fae02a41097141943cbb292bcae6'],
  ['protected-presence-workflow-policy.sql', 'a03c64a143ed0f3fd2e1cef7154f1f3f593b789c0226d2442b453d8acc45d03e'],
]);
let phase = 'custody';
let commitStarted = false;

async function privateFile(file) {
  const info = await lstat(file);
  assert.ok(info.isFile() && info.uid === process.getuid() && (info.mode & 0o777) === 0o600 && await realpath(file) === file);
  return readFile(file, 'utf8');
}

async function verifyPolicy(db) {
  const { rows } = await db.query(`
    SELECT c.relname AS relation, pg_get_userbyid(c.relowner) AS owner,
      c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
      has_table_privilege($1,c.oid,'SELECT') AS read,
      has_table_privilege($1,c.oid,'INSERT') AS insert,
      has_table_privilege($1,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS elevated,
      EXISTS(SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) AS public,
      ARRAY(SELECT p.policyname FROM pg_policies p
        WHERE p.schemaname=n.nspname AND p.tablename=c.relname AND p.roles=ARRAY[$1::name] ORDER BY p.policyname)::text AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$2 AND c.relkind='r' ORDER BY c.relname`, [development, schema]);
  assert.deepEqual(rows, [
    { relation: 'authorized_intake', owner: migration, rls: false, forced: false, read: true, insert: false, elevated: false, public: false, policies: '{}' },
    { relation: 'presence_workflow_events', owner: migration, rls: true, forced: true, read: true, insert: true, elevated: false, public: false, policies: '{presence_case}' },
    { relation: 'presence_workflow_outputs', owner: migration, rls: true, forced: true, read: true, insert: true, elevated: false, public: false, policies: '{presence_output}' },
  ]);
  const scope = (await db.query(`SELECT intake_id FROM ${schema}.authorized_intake`)).rows;
  assert.deepEqual(scope, [{ intake_id: intakeId }]);
}

async function install() {
  assert.equal(await realpath(process.env.HOME), home);
  assert.equal(process.cwd(), join(home, 'miopages-c0-workflow-3bf0209a'));
  assert.equal(process.argv.length, 2);
  const password = (await readFile('/dev/stdin', 'utf8')).replace(/\n$/, '');
  assert.ok(password);
  const custody = join(home, 'miopages-wp-db-20261105T181534Z');
  const recovery = JSON.parse(await privateFile(join(custody, 'database-rollout-evidence.json')));
  assert.equal(recovery.status, 'PASS');
  assert.equal(recovery.recovery?.verified, true);
  const config = JSON.parse(await privateFile(join(custody, 'wordpress-role-credentials.json')));
  const url = new URL(config.operator.url);
  assert.ok(url.protocol === 'postgresql:' && url.hostname === 'aws-0-us-east-1.pooler.supabase.com' &&
    url.port === '5432' && url.pathname === '/postgres' && url.search === '?sslmode=verify-full' &&
    /^miopages_wp_operator\.[a-z0-9]+$/.test(url.username) && !url.hash);
  const ca = await readFile(join(home, 'supabase-ca.crt'), 'utf8');
  assert.match(ca, /BEGIN CERTIFICATE/);
  const reviewed = [];
  for (const [file, hash] of sqlPins) {
    const sql = await privateFile(join(process.cwd(), file));
    assert.equal(createHash('sha256').update(sql).digest('hex'), hash);
    reviewed.push(sql);
  }
  const client = new Client({ host: url.hostname, port: 5432, database: 'postgres',
    user: url.username.replace(/^miopages_wp_operator\./, migration + '.'), password,
    ssl: { ca, rejectUnauthorized: true, checkServerIdentity: (_name, cert) => checkServerIdentity(url.hostname, cert) },
    connectionTimeoutMillis: 7000, statement_timeout: 12000 });
  try {
    phase = 'owner-identity';
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const identity = (await client.query(`
      SELECT session_user::text AS login,current_user::text AS actor,current_database() AS database,
        (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls,
        rolbypassrls OR rolsuper AS privileged
      FROM pg_roles WHERE rolname=current_user`)).rows[0];
    assert.deepEqual(identity, { login: migration, actor: migration, database: 'postgres', tls: true, privileged: false });
    await client.query("SET LOCAL lock_timeout='2s'");
    phase = 'exact-baseline';
    const before = (await client.query(`
      SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked,
        to_regnamespace($1) IS NULL AS absent,
        (SELECT count(*)::int FROM miopages_wp.core_development_drafts
          WHERE id=$2 AND web_presence_id=$3 AND managed_site_id=$4 AND version=28) AS matches`,
    [schema, intakeId, webPresenceId, managedSiteId])).rows[0];
    assert.deepEqual(before, { locked: true, absent: true, matches: 1 });
    phase = 'install-reviewed-policy';
    await client.query('CREATE SCHEMA miopages_core_workflow AUTHORIZATION miopages_migration');
    await client.query('SET LOCAL search_path TO miopages_core_workflow, public');
    await client.query("SELECT set_config('miopages.workflow_intake',$1,true)", [intakeId]);
    for (const sql of reviewed) await client.query(sql);
    phase = 'verify-before-commit';
    await verifyPolicy(client);
    phase = 'commit';
    commitStarted = true;
    await client.query('COMMIT');
    phase = 'verify-after-commit';
    await verifyPolicy(client);
    console.log(JSON.stringify({ status: 'PASS', operation: 'install-protected-c0-workflow', scopedDraft: 28, forcedRls: true, appendOnly: true }));
  } catch (error) {
    if (!commitStarted) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

install().catch(error => {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : 'VALIDATION';
  console.error(JSON.stringify({ status: 'BLOCKED', phase, code, commitStarted }));
  process.exitCode = 1;
});
