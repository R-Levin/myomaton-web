// Run only in the new private account. The companion protected-connection.cjs is
// an off-server TypeScript transpilation of the existing Core connection module.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS probe reuses the compiled Core connection checks. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { configuration, HOME, PRIVATE } = require('./wordpress-private-listener.cjs');
let stage = 'configuration';

function safeProbeFailure(error, failedStage) {
  const stages = ['configuration', 'connection-tls', 'role-session', 'read-only-transaction', 'installation', 'credential', 'reviewed-release', 'cleanup'];
  const code = value => typeof value === 'string' &&
    (/^[0-9A-Z]{5}$/.test(value) || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH',
      'ENOTFOUND', 'EAI_AGAIN', 'ERR_ASSERTION', 'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED',
      'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'WP_ROLE_MISMATCH', 'WP_ROLE_PRIVILEGES',
      'WP_DATABASE_MISMATCH', 'WP_BACKEND_TLS_UNVERIFIED'].includes(value)) ? value : 'PRIVATE_PULL_PROBE_REFUSED';
  return { status: 'BLOCKED', stage: stages.includes(failedStage) ? failedStage : 'configuration', code: code(error?.code),
    ...(Array.isArray(error?.errors) ? { connectionErrors: error.errors.slice(0, 8).map(item => ({ code: code(item?.code) })) } : {}),
    requirement: 'Stop; do not start the listener or change credentials.' };
}

async function main() {
  const { protectedPool, verifyProtectedSession, pullRole } = require('./protected-connection.cjs');
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 3326411);
  assert.equal(fs.realpathSync(process.env.HOME), HOME);
  const root = fs.lstatSync(PRIVATE), file = path.join(PRIVATE, 'pull-config.json'), stat = fs.lstatSync(file);
  assert.ok(root.isDirectory() && !root.isSymbolicLink() && root.uid === process.getuid() && (root.mode & 511) === 448);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 511) === 384);
  const config = configuration(JSON.parse(fs.readFileSync(file, 'utf8')));
  const database = new URL(config.pullUrl).pathname.slice(1), pool = protectedPool(config.pullUrl, pullRole, config.ca);
  try {
    stage = 'connection-tls';
    const db = await pool.connect();
    try {
      stage = 'role-session';
      await verifyProtectedSession(db, pullRole, database);
      stage = 'read-only-transaction';
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      try {
        await db.query("SET LOCAL statement_timeout='20s'");
        stage = 'installation';
        const row = (await db.query('SELECT id,origin,status,generation FROM wordpress_installations WHERE id=$1', [config.installationId])).rows[0];
        assert.deepEqual(row, { id: config.installationId, origin: 'https://miopages.org', status: 'active', generation: 1 });
        stage = 'credential';
        const key = (await db.query('SELECT credential_id FROM wordpress_installation_keys WHERE installation_id=$1 AND generation=1', [config.installationId])).rows[0];
        assert.equal(key.credential_id, config.credentialId);
        stage = 'reviewed-release';
        const release = (await db.query('SELECT proposal_id,projection_digest FROM wordpress_private_releases WHERE id=$1', ['7c3c0030-ac9d-42ca-8222-3412b282da95'])).rows[0];
        assert.equal(release.proposal_id, 'b6beda24-564c-4e19-9de0-09861ec32f24');
        assert.equal(release.projection_digest, 'f71a65739ec0b18d75516b27584d4042446e9c4df8721f0d49b346cef5f1327e');
        console.log(JSON.stringify({ status: 'PASS', readOnly: true, role: pullRole, verifiedTls: true, sessionVerified: true,
          exactInstallationVerified: true, reviewedReleaseVerified: true, signerRead: false }));
      } finally { await db.query('ROLLBACK'); }
    } finally { db.release(); }
  } finally { await pool.end(); }
}
module.exports = { safeProbeFailure };
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify(safeProbeFailure(error, stage)));
  process.exitCode = 1;
});
