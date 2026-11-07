// Bounded new-account launcher; no public-runtime lifecycle or arbitrary commands.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS entry for the provider's process manager. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const HOME = '/home/virtual/vps-bef564/e/e494602172';
const WEB = HOME + '/public_html';
const PRIVATE = HOME + '/miopages-private-acceptance';
const ORIGIN = 'https://wp-acceptance.miopages.com';
const CREDENTIAL = '421ef5e7-06da-4485-830c-91b1611c7225';
const RSS_LIMIT = 384 * 1024 * 1024;
const MIN_AVAILABLE = 512 * 1024 * 1024;

function configuration(value) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), ['pullUrl', 'ca', 'installationId', 'credentialId', 'secretHex', 'coreOrigin'].sort());
  assert.equal(value.installationId, '9a511424-79af-4d02-801e-8d191d4b0d2f');
  assert.equal(value.credentialId, CREDENTIAL); assert.equal(value.coreOrigin, ORIGIN);
  assert.match(value.secretHex, /^[a-f0-9]{64}$/);
  assert.ok(typeof value.ca === 'string' && value.ca.includes('BEGIN CERTIFICATE'));
  // The existing Core protectedPool/protectedConnection remains authoritative.
  const url = new URL(value.pullUrl), login = decodeURIComponent(url.username);
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.port, '5432');
  assert.match(url.hostname, /^[a-z0-9-]+\.pooler\.supabase\.com$/);
  assert.match(login, /^miopages_wp_pull\.[a-z0-9]{1,63}$/);
  assert.ok(url.password); assert.match(url.pathname, /^\/[A-Za-z0-9_-]+$/);
  assert.equal(url.search, '?sslmode=verify-full'); assert.equal(url.hash, '');
  return value;
}

function childEnvironment(value) {
  const c = configuration(value);
  return { PATH: '/usr/bin:/bin', HOME, LANG: 'C.UTF-8', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    MIOPAGES_ROUTING_MODE: 'shared-hostnames', MIOPAGES_WP_PRIVATE_STAGE: 'enabled', MIOPAGES_WP_CORE_ORIGIN: ORIGIN,
    MIOPAGES_WP_PULL_URL: c.pullUrl, MIOPAGES_WP_DATABASE_CA: c.ca,
    ['MIOPAGES_WP_CREDENTIAL_' + CREDENTIAL.replaceAll('-', '_')]: c.secretHex };
}

function procStat(text) {
  const end = text.lastIndexOf(')'); assert.ok(end > 0);
  const fields = text.slice(end + 1).trim().split(/\s+/);
  assert.ok(fields.length >= 20);
  const result = { group: Number(fields[2]), session: Number(fields[3]), started: fields[19] };
  assert.ok(Number.isInteger(result.group) && Number.isInteger(result.session) && /^\d+$/.test(result.started));
  return result;
}

function resourceGate(rss, available) {
  assert.ok(Number.isFinite(rss) && rss >= 0 && Number.isFinite(available) && available >= 0);
  return rss <= RSS_LIMIT && available >= MIN_AVAILABLE;
}

function ownedMembers(members, group, uid, known) {
  return members.length > 0 && members.every(p => p.group === group && p.session === group && p.uid === uid)
    && members.some(p => known.get(p.pid) === p.started);
}

function privateFile(file) {
  const s = fs.lstatSync(file);
  assert.ok(s.isFile() && !s.isSymbolicLink() && s.uid === process.getuid() && (s.mode & 511) === 384);
  return fs.readFileSync(file, 'utf8');
}

function availableMemory() {
  const match = fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+) kB$/m);
  assert.ok(match); return Number(match[1]) * 1024;
}

function groupMembers(group) {
  const members = [];
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const dir = '/proc/' + name, uid = fs.statSync(dir).uid;
      if (uid !== process.getuid()) continue; // Never inspect another hosting account's process metadata.
      const stat = procStat(fs.readFileSync(dir + '/stat', 'utf8'));
      if (stat.group !== group) continue;
      const match = fs.readFileSync(dir + '/status', 'utf8').match(/^VmRSS:\s+(\d+) kB$/m);
      members.push({ pid: Number(name), uid, ...stat, rss: match ? Number(match[1]) * 1024 : 0 });
    } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
  }
  return members;
}

async function main() {
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 3326411);
  assert.equal(fs.realpathSync(process.env.HOME), HOME);
  assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--smoke'));
  const root = fs.lstatSync(PRIVATE);
  assert.ok(root.isDirectory() && !root.isSymbolicLink() && root.uid === process.getuid() && (root.mode & 511) === 448);
  assert.equal(fs.realpathSync(WEB), WEB);
  assert.equal(fs.readFileSync(WEB + '/.env', 'utf8'), 'PORT=8081\nNODE_ENV=production\n');
  assert.deepEqual(fs.readdirSync(WEB).filter(name => name.startsWith('.env')), ['.env']);
  const env = childEnvironment(JSON.parse(privateFile(PRIVATE + '/pull-config.json')));
  assert.ok(resourceGate(process.memoryUsage().rss, availableMemory()));
  const child = spawn('/usr/bin/node', ['--max-old-space-size=256', WEB + '/.rehearsal/private-server.cjs'],
    { cwd: WEB, env, detached: true, stdio: 'ignore' });
  const known = new Map();
  try { const first = procStat(fs.readFileSync('/proc/' + child.pid + '/stat', 'utf8')); known.set(child.pid, first.started); } catch { /* No broad signal without verified identity. */ }
  let stopped = false, failure = false, peak = process.memoryUsage().rss, minimum = availableMemory();
  const event = (name, fields = {}) => console.log(JSON.stringify({ event: name, ...fields }));
  const stop = async (reason, bad = false) => {
    if (stopped) return; stopped = true; failure ||= bad;
    clearInterval(monitor); clearTimeout(deadline);
    const signal = which => {
      const members = groupMembers(child.pid);
      if (!members.length) return;
      assert.ok(ownedMembers(members, child.pid, process.getuid(), known), 'Unverified process group; stop for operator inspection');
      process.kill(-child.pid, which);
    };
    try {
      child.kill('SIGTERM'); // Direct child handle remains safe if procfs inspection fails.
      signal('SIGTERM');
      for (let i = 0; i < 50 && groupMembers(child.pid).length; i++) await new Promise(r => setTimeout(r, 100));
      if (groupMembers(child.pid).length) signal('SIGKILL');
      for (let i = 0; i < 20 && groupMembers(child.pid).length; i++) await new Promise(r => setTimeout(r, 100));
      assert.equal(groupMembers(child.pid).length, 0, 'Private child cleanup unverified');
      event('private-listener-stopped', { reason, peakRssBytes: peak, minimumAvailableBytes: minimum, cleanupVerified: true });
    } catch { child.kill('SIGKILL'); failure = true; event('private-listener-cleanup-blocked'); }
    process.exitCode = failure ? 1 : 0;
  };
  const monitor = setInterval(() => {
    try {
      const members = groupMembers(child.pid); assert.ok(ownedMembers(members, child.pid, process.getuid(), known));
      for (const member of members) known.set(member.pid, member.started);
      const rss = process.memoryUsage().rss + members.reduce((n, p) => n + p.rss, 0), available = availableMemory();
      peak = Math.max(peak, rss); minimum = Math.min(minimum, available);
      if (!resourceGate(rss, available)) void stop('resource-gate', true);
    } catch { void stop('identity-or-monitor-gate', true); }
  }, 500);
  const deadline = process.argv[2] === '--smoke' ? setTimeout(() => { void stop('90-second-smoke-deadline'); }, 90000) : undefined;
  process.once('SIGTERM', () => { void stop('requested-stop'); }); process.once('SIGINT', () => { void stop('requested-stop'); });
  child.once('error', () => { void stop('spawn-failed', true); });
  child.once('exit', () => { if (!stopped) void stop('unexpected-child-exit', true); });
  event('private-listener-spawned', { pid: child.pid, bind: '127.0.0.1', port: 8081 });
}

module.exports = { configuration, childEnvironment, procStat, resourceGate, ownedMembers, HOME, WEB, PRIVATE };
if (require.main === module) main().catch(() => { console.error('Private listener configuration refused; inspect before retry.'); process.exitCode = 1; });
