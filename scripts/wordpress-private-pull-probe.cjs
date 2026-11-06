// Run only in the new private account. The companion protected-connection.cjs is
// an off-server TypeScript transpilation of the existing Core connection module.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS probe reuses the compiled Core connection checks. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { configuration, HOME, PRIVATE } = require('./wordpress-private-listener.cjs');
const { protectedPool, verifyProtectedSession, pullRole } = require('./protected-connection.cjs');

async function main() {
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 3326411);
  assert.equal(fs.realpathSync(process.env.HOME), HOME);
  const root = fs.lstatSync(PRIVATE), file = path.join(PRIVATE, 'pull-config.json'), stat = fs.lstatSync(file);
  assert.ok(root.isDirectory() && !root.isSymbolicLink() && root.uid === process.getuid() && (root.mode & 511) === 448);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 511) === 384);
  const config = configuration(JSON.parse(fs.readFileSync(file, 'utf8')));
  const database = new URL(config.pullUrl).pathname.slice(1), pool = protectedPool(config.pullUrl, pullRole, config.ca);
  try {
    const db = await pool.connect();
    try {
      await verifyProtectedSession(db, pullRole, database);
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try {
        await db.query("SET LOCAL statement_timeout='20s'");
        const row = (await db.query('SELECT id,origin,status,generation FROM wordpress_installations WHERE id=$1', [config.installationId])).rows[0];
        assert.deepEqual(row, { id: config.installationId, origin: 'https://miopages.org', status: 'active', generation: 1 });
        const key = (await db.query('SELECT credential_id FROM wordpress_installation_keys WHERE installation_id=$1 AND generation=1', [config.installationId])).rows[0];
        assert.equal(key.credential_id, config.credentialId);
        const release = (await db.query('SELECT proposal_id,projection_digest FROM wordpress_private_releases WHERE id=$1', ['7c3c0030-ac9d-42ca-8222-3412b282da95'])).rows[0];
        assert.equal(release.proposal_id, 'b6beda24-564c-4e19-9de0-09861ec32f24');
        assert.equal(release.projection_digest, 'f71a65739ec0b18d75516b27584d4042446e9c4df8721f0d49b346cef5f1327e');
        console.log(JSON.stringify({ status: 'PASS', readOnly: true, role: pullRole, verifiedTls: true, sessionVerified: true,
          exactInstallationVerified: true, reviewedReleaseVerified: true, signerRead: false }));
      } finally { await db.query('ROLLBACK'); }
    } finally { db.release(); }
  } finally { await pool.end(); }
}
main().catch(error => {
  const code = ['28P01', '28000', '42501', 'ERR_ASSERTION', 'WP_ROLE_MISMATCH', 'WP_DATABASE_MISMATCH', 'WP_BACKEND_TLS_UNVERIFIED'].includes(error?.code) ? error.code : 'PRIVATE_PULL_PROBE_REFUSED';
  console.error(JSON.stringify({ status: 'BLOCKED', code, requirement: 'Stop; do not start the listener or change credentials.' }));
  process.exitCode = 1;
});
