// Optional operator QA, using an isolated headless Chrome process. Never attaches
// to an operator browser/profile. Install the driver into ignored tooling:
// npm install --prefix runtime-content/browser-tools --no-package-lock playwright-core
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { values } = parseArgs({ options: { url: { type: "string" }, chrome: { type: "string" } }, strict: true });
const base = new URL(values.url ?? "");
assert.equal(base.protocol, "http:"); assert.equal(base.hostname, "127.0.0.1"); assert.ok(base.port);
assert.equal(base.pathname, "/"); assert.equal(base.search + base.hash + base.username + base.password, "");
const { chromium } = await import(pathToFileURL(path.resolve("runtime-content/browser-tools/node_modules/playwright-core/index.mjs")).href);
const output = path.resolve("runtime-content", `preview-review-${base.port}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: values.chrome ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const findings = [];
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 820, 1180], ["mobile", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    // Keep this QA session local, including any unexpected network request.
    await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(60_000); page.setDefaultNavigationTimeout(60_000);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    try {
      for (const route of ["/", "/service", "/experience", "/review"]) {
        console.log(`Checking ${name} ${route}`);
        const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
        assert.equal(response.status(), 200);
        await page.locator("header img").waitFor({ state: "visible" });
        await page.locator("main h1").waitFor();
        // Full-page QA must load offscreen lazy images before checking their bytes.
        await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading = "eager"; return image.decode(); })));
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const visible = element => !!(element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
          const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
          return {
            viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            heading: document.querySelector("h1").textContent,
            heroFont: getComputedStyle(document.querySelector("h1")).fontSize,
            headerLogo: rect(document.querySelector("header img")),
            logoLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
            clippedText: [...document.querySelectorAll("main h1,main h2,main h3,main p")].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent),
            visibleNavigation: [...document.querySelectorAll('nav[aria-label="Primary Navigation"] a')].filter(visible).map(element => element.textContent),
            menuVisible: [...document.querySelectorAll("header button")].some(visible),
            forms: document.querySelectorAll("form,input,textarea").length,
            motion: document.querySelectorAll("[data-motion-slot]").length,
            animations: document.getAnimations().length,
            previewNotice: document.body.textContent.includes("MioPages is not open for service or Review requests"),
            footerIdentity: document.querySelector("footer").textContent.trim(),
          };
        });
        assert.ok(layout.scrollWidth <= width + 1, `Horizontal overflow ${name} ${route}`);
        assert.deepEqual(layout.clippedText, []); assert.equal(layout.logoLoaded, true);
        assert.equal(layout.forms + layout.motion + layout.animations, 0); assert.equal(layout.previewNotice, true);
        assert.match(layout.footerIdentity, /MioPages/);
        const key = `${name}-${route === "/" ? "home" : route.slice(1)}`;
        await page.screenshot({ path: path.join(output, `${key}.png`), fullPage: true });
        if (route === "/") await page.screenshot({ path: path.join(output, `${name}-arrival.png`) });
        if (width < 1024) {
          const menu = page.getByRole("button", { name: "Primary navigation menu", exact: true });
          await menu.click(); await page.locator('header').getByRole("link", { name: "Service", exact: true }).waitFor({ state: "visible" });
          assert.equal(await page.getByRole("button", { name: "Close primary navigation menu", exact: true }).getAttribute("aria-expanded"), "true");
          if (route === "/") await page.screenshot({ path: path.join(output, `${name}-navigation.png`) });
          await page.keyboard.press("Escape");
          assert.equal(await menu.getAttribute("aria-expanded"), "false");
        } else assert.deepEqual(layout.visibleNavigation, ["Service", "Experience", "Review"]);
        findings.push({ name, route, width, height, ...layout });
      }
      assert.deepEqual(errors, [], `Browser errors in ${name}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
await writeFile(path.join(output, "findings.json"), JSON.stringify({ url: base.href, screenshots: output, findings, operatorVisualApproval: false }, null, 2) + "\n");
console.log(JSON.stringify({ url: base.href, screenshots: output, checksPassed: findings.length, operatorVisualApproval: false }, null, 2));
