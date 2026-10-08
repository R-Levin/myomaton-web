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
const { values } = parseArgs({ options: { baseline: { type: 'boolean' }, url: { type: 'string' }, 'representative-only': { type: 'boolean' }, 'service-v1-only': { type: 'boolean' } } });
assert.ok(!(values.baseline && values['representative-only']), 'Fixture-only review is not a baseline capture');
const phase = values.baseline ? 'baseline' : values['representative-only'] ? 'fixtures' : 'final';
const output = path.resolve('runtime-content', `business-focus-${phase}`);
await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(path.resolve('runtime-content/browser-tools/node_modules/playwright-core/index.mjs')).href);
const children = [];
async function start(schema, selection, root, preview = false) {
  assert.ok(schema === 'public' || /^canonical_test_[a-f0-9]{32}_preview$/.test(schema));
  const reserve = createServer().listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise(r => reserve.close(r));
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('options', `-c search_path=${schema} -c default_transaction_read_only=on`);
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, DATABASE_URL: url.href, PRESENTATION_PREVIEW_SCHEMA: preview ? schema : "", WEB_PRESENCE_ID: selection.web_presence_id, MANAGED_SITE_ID: selection.id, ...(root ? { MANAGED_ASSET_ROOT: root } : {}) }, windowsHide: true, stdio: 'ignore',
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
  const oldReport = JSON.parse(await readFile(values.baseline ? 'runtime-content/miopages-preview.json' : 'runtime-content/phase1-previous-preview.json', 'utf8'));
  if (values.baseline) await writeFile(path.join(output, 'previous-preview.json'), JSON.stringify(oldReport));
  const mioSite = { id: '312b8081-4582-47fa-bedb-a551fd6e2b36', web_presence_id: '926cb772-7507-4542-8acd-e7e57ce71324' };
  const oldMio = await start(oldReport.schema, mioSite, oldReport.assetRoot);
  const cases = [{ name: 'myomaton', base: myomaton, routes: ['/', '/about', '/projects', '/principles'] }, { name: 'previous-miopages', base: oldMio, routes: ['/', '/service', '/experience', '/review'] }];
  if (!values.baseline) {
    const base = new URL(values.url); assert.equal(base.hostname, '127.0.0.1'); assert.equal(base.protocol, 'http:');
    cases.push({ name: 'miopages', base: base.origin, routes: ['/', '/service', '/experience', '/review'] });
    const previous = JSON.parse(await readFile('runtime-content/continuing-care-previous-preview.json', 'utf8'));
    cases.push({ name: 'phase1-miopages', base: await start(previous.schema, mioSite, previous.assetRoot), routes: ['/', '/service', '/experience', '/review'] });
    const care = JSON.parse(await readFile('runtime-content/miopages-preview.json', 'utf8'));
    cases.push({ name: 'continuing-care', base: await start(care.schema, mioSite, care.assetRoot, true), routes: ['/', '/service', '/experience', '/review'] });
    const current = JSON.parse(await readFile('runtime-content/miopages-focus-preview.json', 'utf8'));
    cases.push({ name: 'production-refusal', base: await start(current.schema, mioSite, current.assetRoot), routes: ['/', '/service', '/experience', '/review'] });

  }
  if (values['representative-only']) cases.splice(0, cases.length, ...cases.filter(c => c.name === 'representative'));
  if (values['service-v1-only']) cases.splice(0,cases.length,...cases.filter(c=>c.name==='phase1-miopages'));
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
      await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
      const result = await page.evaluate(() => {
        const info = e => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { width: r.width, height: r.height, font: parseFloat(c.fontSize), lineHeight: c.lineHeight, letterSpacing: c.letterSpacing, paddingTop: c.paddingTop, paddingBottom: c.paddingBottom }; };
        return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, heading: info(document.querySelector('h1')), hero: info(document.querySelector('main > section')), support: info(document.querySelector('.p-hero-introduction') ?? document.querySelector('.managed-site-hero-narrative') ?? document.querySelector('main p')), h2: info(document.querySelector('main h2')), header: info(document.querySelector('header')), grammar: document.querySelector('[data-grammar]')?.dataset.grammar ?? document.querySelector('[data-visual-grammar]')?.dataset.visualGrammar, sections: [...document.querySelectorAll('main > section')].map(e => ({ role: e.dataset.sectionRole, spacing: e.dataset.spacing, ...info(e) })), markup: document.querySelector('.p-presence,.managed-site').outerHTML };
      });
      assert.ok(result.scrollWidth <= width + 1);
      const key = `${site.name}-${device}-${route.slice(1).replaceAll('/', '-') || 'home'}`;
      let screenshot = await page.screenshot({ fullPage: true });
      if (site.name === 'myomaton' || site.name === 'previous-miopages') {
        const directory = site.name === 'myomaton' ? 'visual-grammar-baseline' : 'visual-grammar-final';
        const baselineKey = key.replace('previous-miopages','miopages');
        const expected = await readFile(path.resolve('runtime-content',directory,`${baselineKey}.png`));
        // A bounded repaint retry addresses transient rasterization only; no pixel
        // threshold, masking, baseline rewrite or layout normalization is allowed.
        for (let attempt=0; !screenshot.equals(expected) && attempt<2; attempt++) {
          await page.waitForTimeout(500); screenshot=await page.screenshot({fullPage:true});
        }
      }
      await writeFile(path.join(output, `${key}.png`), screenshot);
      if (!values.baseline && site.name === 'myomaton') {
        assert.ok(screenshot.equals(await readFile(path.resolve('runtime-content/visual-grammar-baseline', `${key}.png`))), `Myomaton pixel regression: ${key}`);
        const prior = JSON.parse(await readFile('runtime-content/visual-grammar-baseline/findings.json', 'utf8')).find(e => e.key === key);
        // The saved JSON omits undefined optional markers; compare equal serialization.
        assert.deepEqual(JSON.parse(JSON.stringify(result)), prior.result, `Myomaton DOM/measure regression: ${key}`);
      }
      if (site.name === 'previous-miopages') {
        const oldKey=key.replace('previous-miopages','miopages');
        assert.ok(screenshot.equals(await readFile(path.resolve('runtime-content/visual-grammar-final', `${oldKey}.png`))), `Pinned restrained-editorial regression: ${key}`);
        const old=JSON.parse(await readFile('runtime-content/visual-grammar-final/findings.json','utf8')).find(f=>f.key===oldKey).result;
        const {limits,...prior}=old; void limits;
        // Disposable schemas assign new Asset IDs. Pixels remain exact; normalize
        // only managed media UUIDs after verifying this preview serves approved bytes.
        const mediaIds=[...result.markup.matchAll(/\/media\/assets\/([a-f0-9-]{36})/g)].map(m=>m[1]);
        const { prepareManagedAsset }=await import('../lib/platform/assets/ingestion.ts');
        const logo=await prepareManagedAsset('brand/miopages/MioPagesDV.png');
        assert.ok(mediaIds.length);
        for(const id of new Set(mediaIds)) { const media=await fetch(site.base+'/media/assets/'+id); assert.equal(media.status,200); assert.ok(Buffer.from(await media.arrayBuffer()).equals(logo.bytes),'Pinned approved logo bytes'); }
        const comparable=v=>({...v,markup:v.markup.replace(/\/media\/assets\/[a-f0-9-]{36}/g,'/media/assets/preview-logo')});
        assert.deepEqual(comparable(JSON.parse(JSON.stringify(result))),comparable(prior), `Pinned DOM/measure regression: ${key}`);
      }
      if (['miopages','representative'].includes(site.name)) {
        assert.equal(result.grammar,'service-led');
        assert.ok(result.h2.font < result.heading.font, 'Hero hierarchy');
        const structure=await page.evaluate(()=>{
          const root=document.querySelector('.p-presence');
          const info=e=>e&&{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,display:getComputedStyle(e).display,columns:getComputedStyle(e).gridTemplateColumns};
          return {recipe:root.dataset.recipe, family:document.querySelector('.p-hero').dataset.family,
            value:info(document.querySelector('.p-value-scaffold')), stages:[...document.querySelectorAll('.focus-continuity h3')].map(e=>e.textContent),
            responsibilities:document.querySelectorAll('.focus-party > div').length,scope:document.querySelectorAll('.focus-scope > div').length,
            conversion:document.querySelector('[data-conversion]').dataset.conversion,header:document.querySelector('header').dataset.chrome,
            footer:document.querySelector('footer').dataset.chrome,formCount:document.querySelectorAll('form,input,textarea').length,
            actions:[...document.querySelectorAll('main .p-action')].map(e=>({height:e.getBoundingClientRect().height,href:e.getAttribute('href')})),
            legacy:document.querySelectorAll('.managed-site,[data-visual-direction]').length};
        });
        assert.equal(structure.legacy+structure.formCount,0);
        assert.ok(structure.actions.length); assert.ok(structure.actions.every(a=>a.height>=48));
        if(route==='/') { assert.equal(structure.family,'service-illustrated'); assert.equal(await page.locator('[data-fpo-role=service-illustration]').count(),1); }
        if(route==='/service') { assert.deepEqual(structure.stages,['Standard Launch','Ongoing']); assert.equal(structure.scope,3); assert.equal(structure.responsibilities,6); }
        if(route==='/experience') assert.equal(await page.locator('[data-fpo-role=evidence-project]').count(),2);
        if(route==='/review') { assert.equal(structure.family,'orientation'); assert.equal(await page.locator('.focus-priorities li').count(),3); }
        if(site.name==='miopages'&&device==='mobile') assert.ok(result.header.height<120,'Wide logo/header intrinsic fit');
        const fonts = await page.evaluate(() => ({ heading: getComputedStyle(document.querySelector('h1')).fontFamily, body: getComputedStyle(document.querySelector('.p-presence')).fontFamily, serifLoaded: document.fonts.check('600 20px "Source Serif 4"'), sansLoaded: document.fonts.check('400 20px "Source Sans 3"') }));
        assert.match(fonts.heading,/Source Sans 3/); assert.match(fonts.body,/Source Sans 3/); assert.ok(fonts.sansLoaded);
        const nav = await page.evaluate(() => [...document.querySelectorAll('header nav a')].map(a => ({ href:a.getAttribute('href'), current:a.getAttribute('aria-current'), emphasis:a.dataset.actionTarget, decoration:getComputedStyle(a).textDecorationLine })));
        assert.equal(nav.filter(a=>a.emphasis==='true').length,1); assert.equal(nav.find(a=>a.emphasis==='true').href,'/review');
        assert.equal(nav.filter(a=>a.current==='page').length,route==='/'?0:1); assert.ok(nav.every(a=>a.decoration==='none'));
        if(device!=='desktop') { const menu=page.locator('.managed-site-menu-toggle'); if(await menu.count()) { await menu.click(); const review=page.locator('header nav a[href="/review"]'); await review.waitFor({state:'visible'}); assert.ok((await review.boundingBox()).height>=44); await page.keyboard.press('Escape'); } }
        const visual=await page.evaluate(()=>{
          const root=document.querySelector('.focus-presence');
          const hero=document.querySelector('main>section');
          const slot=document.querySelector('[data-fpo-role]');
          return {version:root.dataset.grammarVersion,heroBackground:getComputedStyle(hero).backgroundColor,
            visualWidth:slot?.getBoundingClientRect().width??0, fontsRequested:[...document.querySelectorAll('link[as=font]')].map(l=>l.getAttribute('href')),
            layers:[...document.querySelectorAll('[data-layer]')].map(e=>e.dataset.layer), footer:document.querySelector('footer').dataset.chrome};
        });
        assert.equal(visual.version,'3'); assert.equal(visual.heroBackground,'rgb(50, 47, 126)');
        assert.ok(visual.fontsRequested.every(p=>!p.includes('serif')));
        assert.equal(visual.footer,'graphic-signoff');
        if(route==='/') {assert.ok(visual.visualWidth>=Math.min(width*.35,600));assert.ok(visual.layers.includes('field-bridge'));}
        result.structure=structure; result.fonts=fonts; result.nav=nav; result.visual=visual;
      }
      if (site.name === 'phase1-miopages') {
        const oldKey = key.replace('phase1-miopages', 'miopages');
        const expected = await readFile(path.resolve('runtime-content/presentation-phase1-final', `${oldKey}.png`));
        for (let attempt = 0; !screenshot.equals(expected) && attempt < 2; attempt++) { await page.waitForTimeout(500); screenshot = await page.screenshot({ fullPage: true }); }
        assert.ok(screenshot.equals(expected), `Pinned service-led v1 pixel regression: ${key}`);
        const old = JSON.parse(await readFile('runtime-content/presentation-phase1-final/findings.json', 'utf8')).find(f => f.key === oldKey).result;
        const { structure, ...prior } = old; void structure;
        assert.deepEqual(JSON.parse(JSON.stringify(result)), prior, `Pinned service-led v1 DOM/measure regression: ${key}`);
      }
      if (site.name === 'continuing-care') {
        const oldKey=key.replace('continuing-care','miopages');
        const expected=await readFile(path.resolve('runtime-content/continuing-care-final',oldKey+'.png'));
        for(let attempt=0; !screenshot.equals(expected)&&attempt<2;attempt++){await page.waitForTimeout(500);screenshot=await page.screenshot({fullPage:true});}
        assert.ok(screenshot.equals(expected),`Pinned service-led v2 pixel regression: ${key}`);
        const old=JSON.parse(await readFile('runtime-content/continuing-care-final/findings.json','utf8')).find(f=>f.key===oldKey).result;
        const {structure,fonts,nav,...prior}=old; void structure;void fonts;void nav;
        assert.deepEqual(JSON.parse(JSON.stringify(result)),prior,`Pinned service-led v2 DOM/measure regression: ${key}`);
      }
      if (site.name === 'production-refusal') {
        assert.equal(await page.locator('[data-fpo-role]').count(),0,'Ordinary deployment refuses all FPO');
        assert.equal(await page.locator('form,input,textarea').count(),0);
        if(route==='/') assert.equal(await page.locator('.p-hero').getAttribute('data-family'),'orientation');
      }
      findings.push({ key, site: site.name, device, route, result });
    } } finally { await context.close(); }
  }
  if (!values.baseline) {
    for (const site of cases.filter(s => ['miopages', 'representative'].includes(s.name))) for (const route of site.routes) {
      const rows = findings.filter(f => f.site === site.name && f.route === route);
      assert.ok(rows[0].result.heading.font >= rows[1].result.heading.font && rows[1].result.heading.font >= rows[2].result.heading.font, 'No tablet inversion');
    }
  }
  await writeFile(path.join(output, 'findings.json'), JSON.stringify(findings, null, 2));
  console.log(`Passed ${findings.length} browser cases; evidence: ${output}`);
} finally {
  await browser?.close(); if (fixtureServer) await new Promise(r => fixtureServer.close(r));
  for (const child of children) if (child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; }
  await pool.end();
}
