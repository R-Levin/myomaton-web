import assert from 'node:assert/strict';
import http from 'node:http';

export const methods = ['GET', 'HEAD', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH', 'TRACE', 'CONNECT'];
export const deniedTargets = ['/', '/intake', '/intake/', '/review/intake', '/api/contact', '/favicon.ico',
  '/fonts/source-sans-3.052/regular.woff2', '/_next/static/test.js', '/_next/image?url=x',
  '/api/wordpress-delivery/pull/', '/api/wordpress-delivery/receipt/', '/api/wordpress-delivery/other',
  '/api/wordpress-delivery/pull?x=1', '/api/wordpress-delivery/receipt?', '/api/wordpress-delivery/pull?_rsc=x',
  '/api//wordpress-delivery/pull', '//api/wordpress-delivery/pull', '/api/wordpress-delivery//pull',
  '/api\\wordpress-delivery\\pull', '/api/wordpress-delivery/pull//',
  '/api/wordpress-delivery/./pull', '/api/wordpress-delivery/other/../pull',
  '/api/wordpress-delivery/%70ull', '/api/wordpress-delivery%2fpull', '/api/wordpress-delivery/pull%2f',
  '/API/wordpress-delivery/pull', '/api/wordpress-delivery/pull;param',
  '/_next/data/build/api/wordpress-delivery/pull.json', 'https://rehearsal.example.test/api/wordpress-delivery/pull'];
const exactTargets = ['/api/wordpress-delivery/pull', '/api/wordpress-delivery/receipt'];
const knownTargets = new Set([...deniedTargets, ...exactTargets]);

// Never emit response bodies, cookies, authentication headers or arbitrary URLs.
export function failureSnapshot(method, target, result) {
  const location = result.headers?.location;
  const cache = result.headers?.['cache-control'];
  return { method: methods.includes(method) ? method : '[redacted]', target: knownTargets.has(target) ? target : '[redacted]',
    status: Number.isInteger(result.status) ? result.status : null,
    headers: {
      'cache-control': ['no-store', 'no-cache', 'private', 'public', 'public, max-age=0, must-revalidate'].includes(cache) ? cache : cache == null ? null : '[redacted]',
      location: location == null ? null : exactTargets.includes(location) ? location : '[redacted]',
      'content-length': /^\d{1,12}$/.test(result.headers?.['content-length'] ?? '') ? result.headers['content-length'] : null,
      'content-type': ['text/html; charset=utf-8', 'application/json', 'text/plain'].includes(result.headers?.['content-type']) ? result.headers['content-type'] : result.headers?.['content-type'] == null ? null : '[redacted]',
    } };
}

export function expectResponse(method, target, result, status) {
  if (result.status !== status || result.headers?.['cache-control'] !== 'no-store' || result.headers?.location !== undefined) {
    throw new Error('Private routing smoke refused: ' + JSON.stringify(failureSnapshot(method, target, result)));
  }
}

export function request(port, origin, target, method, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method,
      headers: { host: new URL(origin).host, 'x-forwarded-proto': 'https', 'content-length': '0', ...headers } });
    req.on('response', res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers })); });
    req.on('connect', (res, socket) => { socket.destroy(); resolve({ status: res.statusCode, headers: res.headers }); });
    req.setTimeout(3000, () => req.destroy(new Error('Private routing smoke request timed out')));
    req.on('error', reject); req.end();
  });
}

export async function routingSmoke(port, origin) {
  let checks = 0;
  for (const target of deniedTargets) for (const method of methods) {
    expectResponse(method, target, await request(port, origin, target, method), 404); checks++;
  }
  for (const target of exactTargets) {
    for (const method of methods.filter(m => m !== 'POST')) {
      expectResponse(method, target, await request(port, origin, target, method), 404); checks++;
    }
    for (const headers of [{}, { host: 'wrong.example.test' }, { 'x-forwarded-proto': 'http' }]) {
      expectResponse('POST', target, await request(port, origin, target, 'POST', headers), 400); checks++;
    }
  }
  assert.ok(checks > 250);
  return { status: 'PASS', checks, rawPathBoundary: true, automaticRedirectsAccepted: false };
}
