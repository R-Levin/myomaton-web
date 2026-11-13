// Private artifact entry only: one loopback listener, no extra proxy/service.
/* eslint-disable @typescript-eslint/no-require-imports -- Fixed Node CommonJS artifact entry. */
'use strict';
const http = require('node:http');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function allowed(method, rawTarget) {
  return method === 'POST' && (rawTarget === '/api/wordpress-delivery/pull' || rawTarget === '/api/wordpress-delivery/receipt');
}

function createGuardedServer(handle, permit = allowed) {
  const serve = (req, res) => {
    // Inspect IncomingMessage.url verbatim, before URL parsing/normalization.
    if (!permit(req.method, req.url)) {
      res.writeHead(404, { 'Cache-Control': 'no-store', 'Content-Length': '0', Connection: 'close' });
      res.end(); return;
    }
    Promise.resolve().then(() => handle(req, res)).catch(() => {
      if (!res.headersSent) res.writeHead(503, { 'Cache-Control': 'no-store', 'Content-Length': '0', Connection: 'close' });
      res.end();
    });
  };
  const server = http.createServer(serve);
  const refuseSocket = (_req, socket) => {
    socket.end('HTTP/1.1 404 Not Found\r\nCache-Control: no-store\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
  };
  server.on('connect', refuseSocket);
  server.on('upgrade', refuseSocket);
  server.on('checkContinue', (req, res) => {
    if (permit(req.method, req.url)) res.writeContinue();
    serve(req, res);
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 1000;
  return server;
}

async function main() {
  assert.equal(process.env.NODE_ENV, 'production');
  const core = process.env.MIOPAGES_PROTECTED_CORE === 'enabled';
  assert.notEqual(core, process.env.MIOPAGES_WP_PRIVATE_STAGE === 'enabled');
  for (const name of ['DATABASE_URL', 'MIOPAGES_WP_OPERATOR_URL', 'MIOPAGES_WP_MIGRATION_URL', 'MIOPAGES_WP_SIGNING_KEY']) {
    assert.ok(!process.env[name]);
  }
  const dir = core ? path.resolve(process.cwd()) : path.resolve(__dirname, '..');
  const compiled = JSON.parse(fs.readFileSync(path.join(dir, '.next/required-server-files.json'), 'utf8')).config;
  assert.equal(compiled.skipTrailingSlashRedirect, true);
  assert.equal(compiled.skipProxyUrlNormalize, true);
  const next = require('next');
  const app = next({ dev: false, dir, hostname: '127.0.0.1', port: 8081, quiet: true });
  await app.prepare();
  const server = createGuardedServer(app.getRequestHandler(), core ? allowedCore : allowed);
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen(8081, '127.0.0.1', resolve);
  });
  const stop = () => {
    server.close(() => { Promise.resolve(app.close()).catch(() => { process.exitCode = 1; }); });
    server.closeIdleConnections();
  };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}

function allowedCore(method, target) {
  return (method === 'GET' && target === '/core') ||
    ((method === 'GET' || method === 'POST') && target === '/api/protected-core') ||
    (method === 'GET' && /^\/_next\/static\/[\w./-]+$/.test(target) &&
      !target.includes('//') && !target.split('/').some(part => part === '..' || part === '.') && !target.endsWith('.map'));
}

module.exports = { allowed, allowedCore, createGuardedServer };
if (require.main === module) main().catch(() => {
  console.error('Private server startup refused; stop and inspect.'); process.exitCode = 1;
});
