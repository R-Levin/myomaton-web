// Isolated, opt-in browser evidence. Never attaches to an operator profile.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { JSDOM } from 'jsdom';
const { values } = parseArgs({ options: { baseline: { type: 'boolean' }, url: { type: 'string' }, 'representative-only': { type: 'boolean' } } });
assert.ok(!(values.baseline && values['representative-only']), 'Fixture-only review is not a baseline capture');
const phase = values.baseline ? 'baseline' : values['representative-only'] ? 'fixtures' : 'final';
const output = path.resolve('runtime-content', `visual-grammar-${phase}`);
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(path.resolve('runtime-content/browser-tools/node_modules/playwright-core/index.mjs')).href);
const children = [];
async function start(schema, selection, root) {
  assert.ok(schema === 'public' || /^canonical_test_[a-f0-9]{32}_preview$/.test(schema));
  const reserve = createServer().listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise(r => reserve.close(r));
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema} -c default_transaction_read_only=on`);
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, DATABASE_URL: url.href, WEB_PRESENCE_ID: selection.web_presence_id, MANAGED_SITE_ID: selection.id, ...(root ? { MANAGED_ASSET_ROOT: root } : {}) }, windowsHide: true, stdio: 'ignore',
  }); children.push(child);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, 'Read-only inspection server exited');
    try { if ((await fetch(base + '/media/assets/invalid', { signal: AbortSignal.timeout(5000) })).status === 404) return base; } catch { /* startup */ }
    await new Promise(r => setTimeout(r, 200));
  } throw Error('Inspection server did not start');
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: '-c default_transaction_read_only=on -c timezone=UTC' });
let browser, fixtureServer;
const findings = [];
try {
  const intended = JSON.parse(await readFile('scripts/customer-updates/myomaton-visual-direction-v2-intended.json', 'utf8'));
  for (const [table, rows] of Object.entries(intended)) {
    if (table === 'migrations') continue;
    assert.match(table, /^[a-z_]+$/);
    for (const row of rows) assert.deepEqual((await pool.query(`SELECT to_jsonb(t) row FROM public.${table} t WHERE id=$1`, [row.id])).rows[0]?.row, row);
  }
  const myomaton = await start('public', intended.managed_sites[0]);
  const oldReport = JSON.parse(await readFile(values.baseline ? 'runtime-content/miopages-preview.json' : 'runtime-content/visual-grammar-baseline/previous-preview.json', 'utf8'));
  if (values.baseline) await writeFile(path.join(output, 'previous-preview.json'), JSON.stringify(oldReport));
  const mioSite = { id: '312b8081-4582-47fa-bedb-a551fd6e2b36', web_presence_id: '926cb772-7507-4542-8acd-e7e57ce71324' };
  const oldMio = await start(oldReport.schema, mioSite, oldReport.assetRoot);
  const cases = [{ name: 'myomaton', base: myomaton, routes: ['/', '/about', '/projects', '/principles'] }, { name: 'previous-miopages', base: oldMio, routes: ['/', '/service', '/experience', '/review'] }];
  if (!values.baseline) {
    const base = new URL(values.url); assert.equal(base.hostname, '127.0.0.1'); assert.equal(base.protocol, 'http:');
    cases.push({ name: 'miopages', base: base.origin, routes: ['/', '/service', '/experience', '/review'] });
    const { renderGrammarFixtures } = await import('../tests/fixtures/visual-grammar-pages.tsx');
    const fixtures = renderGrammarFixtures();
    const template = new JSDOM(await (await fetch(myomaton)).text()).window.document;
    fixtureServer = createServer(async (request, response) => {
      try {
        if (request.url.startsWith('/_next/')) { const upstream = await fetch(myomaton + request.url); response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') }); response.end(Buffer.from(await upstream.arrayBuffer())); return; }
        const markup = fixtures[request.url]; if (!markup) { response.writeHead(404).end(); return; }
        const css = [...template.querySelectorAll('link[rel=stylesheet]')].map(e => e.outerHTML).join('');
        response.setHeader('content-type', 'text/html; charset=utf-8'); response.end(`<!doctype html><html class="${template.documentElement.className}"><head>${css}</head><body>${markup}</body></html>`);
      } catch { response.writeHead(500).end(); }
    }).listen(0, '127.0.0.1'); await once(fixtureServer, 'listening');
    cases.push({ name: 'representative', base: `http://127.0.0.1:${fixtureServer.address().port}`, routes: Object.keys(fixtures) });
  }
  if (values['representative-only']) cases.splice(0, cases.length, ...cases.filter(c => c.name === 'representative'));
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const site of cases) for (const [device, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await context.route('**/*', r => new URL(r.request().url()).origin === site.base ? r.continue() : r.abort());
    const page = await context.newPage(); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(60000);
    try { for (const route of site.routes) {
      console.log(`${phase}: ${site.name} ${device} ${route}`);
      assert.equal((await page.goto(site.base + route, { waitUntil: 'domcontentloaded' })).status(), 200);
      await page.locator('main h1').waitFor();
      await page.evaluate(() => Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.decode(); })));
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
      const result = await page.evaluate(() => {
        const info = e => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { width: r.width, height: r.height, font: parseFloat(c.fontSize), lineHeight: c.lineHeight, letterSpacing: c.letterSpacing, paddingTop: c.paddingTop, paddingBottom: c.paddingBottom }; };
        return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, heading: info(document.querySelector('h1')), hero: info(document.querySelector('main > section')), support: info(document.querySelector('.managed-site-hero-narrative') ?? document.querySelector('main p')), h2: info(document.querySelector('main h2')), header: info(document.querySelector('header')), grammar: document.querySelector('[data-visual-grammar]')?.dataset.visualGrammar, sections: [...document.querySelectorAll('main > section')].map(e => ({ role: e.dataset.sectionRole, spacing: e.dataset.spacing, ...info(e) })), markup: document.querySelector('.managed-site').outerHTML };
      });
      assert.ok(result.scrollWidth <= width + 1);
      const key = `${site.name}-${device}-${route.slice(1).replaceAll('/', '-') || 'home'}`;
      const screenshot = await page.screenshot({ fullPage: true });
      await writeFile(path.join(output, `${key}.png`), screenshot);
      if (!values.baseline && site.name === 'myomaton') {
        assert.ok(screenshot.equals(await readFile(path.resolve('runtime-content/visual-grammar-baseline', `${key}.png`))), `Myomaton pixel regression: ${key}`);
        const prior = JSON.parse(await readFile('runtime-content/visual-grammar-baseline/findings.json', 'utf8')).find(e => e.key === key);
        // The saved JSON omits undefined optional markers; compare equal serialization.
        assert.deepEqual(JSON.parse(JSON.stringify(result)), prior.result, `Myomaton DOM/measure regression: ${key}`);
      }
      if (!values.baseline && ['miopages', 'representative'].includes(site.name)) {
        assert.equal(result.grammar, 'restrained-editorial');
        assert.ok(result.support.width < (width > 1000 ? 800 : width), 'Bounded support measure');
        assert.ok(result.h2.font < result.heading.font, 'Coherent hierarchy');
        const limits = await page.evaluate(() => {
          const root = document.querySelector('.managed-site');
          const probe = document.createElement('span'); probe.style.cssText = 'display:block;width:54ch'; root.append(probe);
          const supportLimit = probe.getBoundingClientRect().width; probe.style.width = '64ch';
          const proseLimit = probe.getBoundingClientRect().width; probe.remove();
          const wide = document.querySelector('section[data-width="wide"]');
          const cta = document.querySelector('.managed-site-section-cta h2');
          const action = document.querySelector('[data-action-role="primary"]');
          return { supportLimit, proseLimit, wideContainer: wide?.querySelector('.managed-site-section-inner').getBoundingClientRect().width,
            wideProse: wide?.querySelector('p')?.getBoundingClientRect().width,
            ctaFont: parseFloat(getComputedStyle(cta).fontSize), actionHeight: action?.getBoundingClientRect().height };
        });
        assert.ok(result.support.width <= limits.supportLimit + 1, 'Support measure survives selector specificity');
        assert.equal(limits.ctaFont, result.h2.font, 'Restrained conversion hierarchy');
        assert.ok(limits.actionHeight >= 44, 'Primary Action touch target');
        if (site.name === 'representative' && device === 'desktop') {
          assert.ok(limits.wideProse <= limits.proseLimit + 1 && limits.wideContainer > limits.wideProse * 1.5, 'Container/prose measures are distinct');
        }
        result.limits = limits;
        if (site.name === 'miopages' && device === 'mobile') assert.ok(result.header.height < 120, 'Natural wordmark header fit');
      }
      findings.push({ key, site: site.name, device, route, result });
    } } finally { await context.close(); }
  }
  if (!values.baseline) {
    for (const site of cases.filter(s => ['miopages', 'representative'].includes(s.name))) for (const route of site.routes) {
      const rows = findings.filter(f => f.site === site.name && f.route === route);
      assert.ok(rows[0].result.heading.font >= rows[1].result.heading.font && rows[1].result.heading.font >= rows[2].result.heading.font, 'No tablet inversion');
    }
    for (const device of ['desktop', 'tablet', 'mobile']) {
      const normal = findings.find(f => f.key === `representative-${device}-professional`).result;
      const airy = findings.find(f => f.key === `representative-${device}-professional-airy`).result;
      assert.ok(parseFloat(airy.hero.paddingTop) > parseFloat(normal.hero.paddingTop), 'Density survives responsive scaling');
    }
  }
  await writeFile(path.join(output, 'findings.json'), JSON.stringify(findings, null, 2));
  console.log(`Passed ${findings.length} browser cases; evidence: ${output}`);
} finally {
  await browser?.close(); if (fixtureServer) await new Promise(r => fixtureServer.close(r));
  for (const child of children) if (child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; }
  await pool.end();
}
