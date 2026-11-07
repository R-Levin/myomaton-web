import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { routingSmoke, failureSnapshot, expectResponse, request } from '../scripts/wordpress-routing-smoke.mjs';
const { allowed, createGuardedServer } = createRequire(import.meta.url)('../scripts/wordpress-private-server.cjs');

test('raw boundary rejects normalization, redirects, CONNECT and upgrades before Next handles a request', async () => {
  let handedOff = 0;
  const server = createGuardedServer((_req, res) => {
    handedOff++; res.writeHead(400, { 'Cache-Control': 'no-store' }); res.end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port;
  try {
    const summary = await routingSmoke(port, 'https://rehearsal.example.test');
    assert.ok(summary.checks > 250); assert.equal(handedOff, 6);
    const result = await request(port, 'https://rehearsal.example.test', '/api/wordpress-delivery/pull', 'GET', { Connection: 'Upgrade', Upgrade: 'websocket' });
    expectResponse('GET', '/api/wordpress-delivery/pull', result, 404); assert.equal(handedOff, 6);
    assert.equal(allowed('POST', '/api/wordpress-delivery/pull'), true);
    assert.equal(allowed('POST', '/api/wordpress-delivery/receipt'), true);
  } finally { server.close(); server.closeAllConnections(); await once(server, 'close'); }
});

test('failure evidence keeps safe status/header details and redacts credential-bearing values', () => {
  const observed = { status: 308, headers: { location: '/api/wordpress-delivery/pull', 'cache-control': 'no-store', 'content-length': '0' } };
  assert.throws(() => expectResponse('GET', '/api/wordpress-delivery/pull/', observed, 404), /"status":308/);
  assert.equal(failureSnapshot('GET', '/api/wordpress-delivery/pull/', observed).headers.location, '/api/wordpress-delivery/pull');
  const secret = 'never-export-token';
  const value = failureSnapshot('GET', '/api/wordpress-delivery/pull/', { status: 503, body: secret,
    headers: { location: 'https://user:' + secret + '@example.test/', 'set-cookie': secret, authorization: secret, 'cache-control': secret, 'content-type': secret } });
  assert.ok(!JSON.stringify(value).includes(secret)); assert.equal(value.headers.location, '[redacted]');
});
