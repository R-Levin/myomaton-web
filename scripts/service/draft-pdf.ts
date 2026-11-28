/**
 * A PDF of the review draft as a visitor sees it, desktop width, one page after another, with a
 * plain count of pictures per page (real pictures, FPO frames, spots awaiting a picture).
 * Local preview only: signs in with the throwaway preview login and never prints it.
 *
 *   npx tsx scripts/service/draft-pdf.ts --base http://127.0.0.1:4481 --login runtime-content/preview-wordpress-login.txt --out <folder>
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const arg = (name: string, fallback: string) => { const at = process.argv.indexOf("--" + name); return at > 0 ? process.argv[at + 1]! : fallback; };

async function main() {
  const base = arg("base", "http://127.0.0.1:4481").replace(/\/$/u, ""), out = arg("out", "runtime-content/draft-pdf");
  const overrideAt = process.argv.indexOf("--stylesheet");
  const override = overrideAt > 0 ? await readFile(process.argv[overrideAt + 1]!, "utf8") : undefined;
  const login = await readFile(arg("login", "runtime-content/preview-wordpress-login.txt"), "utf8");
  const user = /^User:\s*(.+)$/mu.exec(login)?.[1]?.trim(), password = /^Password:\s*(.+)$/mu.exec(login)?.[1]?.trim();
  // The review site's password gate, when the login file names one (miopages.org); never printed.
  const gateUser = /^Gate user:\s*(.+)$/mu.exec(login)?.[1]?.trim(), gatePassword = /^Gate password:\s*(.+)$/mu.exec(login)?.[1]?.trim();
  const named = /https?:\/\/[^/\s]+/u.exec(login)?.[0];
  if (!user || !password || !(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/u.test(base) || base === named)) throw Error("A local preview, or the review site named in the login file, and its login are required");
  const gate = gateUser && gatePassword ? { httpCredentials: { username: gateUser, password: gatePassword } } : {};
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const context = await browser.newContext({ ...gate, viewport: { width: 1440, height: 1000 } });
    await context.addInitScript("window.__name = (f) => f");
    const page = await context.newPage();
    await page.goto(base + "/wp-login.php");
    await page.fill("#user_login", user); await page.fill("#user_pass", password);
    await Promise.all([page.waitForNavigation(), page.click("#wp-submit")]);
    // The pages in menu order, as the site's own menu lists them.
    await page.goto(base + "/wp-admin/edit.php?post_type=page&post_status=draft");
    // Only the pages Core delivered (WordPress's own sample pages are not part of the site).
    const drafts = await page.$$eval("a.row-title", links => links.filter(a => !/^(Privacy Policy|Sample Page)$/u.test(a.textContent!.trim()))
      .map(a => (a.closest("tr")!.querySelector(".view a, .preview a") as HTMLAnchorElement | null)?.href).filter(Boolean) as string[]);
    await page.goto(drafts[0]!, { waitUntil: "networkidle" });
    const menu = await page.$$eval("nav.miopages-draft-nav > *", items => items.map(i => ({ label: i.textContent!.trim(), href: (i as HTMLAnchorElement).href ?? "" })));
    const sorted = [...drafts].sort((a, b) => {
      const ia = menu.findIndex(m => m.href && m.href.split("&")[0] === a.split("&")[0]), ib = menu.findIndex(m => m.href && m.href.split("&")[0] === b.split("&")[0]);
      return (ia < 0 ? -1 : ia) - (ib < 0 ? -1 : ib); // the current page (Home, not a link) first
    });
    const shots: { title: string; png: string; counts: { pictures: number; fpo: number; awaiting: number } }[] = [];
    for (const [index, url] of sorted.entries()) {
      await page.goto(url, { waitUntil: "networkidle" });
      // --stylesheet <file>: show a proposed design in place of the current one; pages without the current design are left out.
      if (override !== undefined) {
        const swapped = await page.evaluate((css: string) => {
          const style = document.getElementById("miopages-managed-site-inline-css");
          const text = style?.textContent ?? "", start = text.indexOf("body.miopages-branded-draft{"), end = start < 0 ? -1 : text.indexOf("}", start);
          if (!style || end < 0) return false;
          style.textContent = text.slice(0, end + 1) + String.fromCharCode(10) + css;
          return true;
        }, override);
        if (!swapped) continue;
        await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      }
      await page.evaluate(async () => { await document.fonts.ready; for (const img of [...document.images]) { img.loading = "eager"; try { await img.decode(); } catch { /* shown as is */ } } });
      await page.addStyleTag({ content: "#wpadminbar{display:none!important} html{margin-top:0!important}" });
      const info = await page.evaluate(() => ({ title: document.querySelector("main h1")?.textContent?.trim() ?? document.title,
        pictures: document.querySelectorAll("main img").length, fpo: document.querySelectorAll("main .miopages-fpo").length,
        awaiting: document.querySelectorAll("main .miopages-pending-media").length }));
      const png = join(out, `page-${String(index + 1).padStart(2, "0")}.jpg`);
      await writeFile(png, await page.screenshot({ fullPage: true, type: "jpeg", quality: 70 }));
      shots.push({ title: info.title, png, counts: { pictures: info.pictures, fpo: info.fpo, awaiting: info.awaiting } });
      console.log(`${info.title}: ${info.pictures} pictures, ${info.fpo} FPO frames, ${info.awaiting} awaiting`);
    }
    const total = shots.reduce((t, s) => ({ pictures: t.pictures + s.counts.pictures, fpo: t.fpo + s.counts.fpo, awaiting: t.awaiting + s.counts.awaiting }), { pictures: 0, fpo: 0, awaiting: 0 });
    const esc = (s: string) => s.replace(/&/gu, "&amp;").replace(/</gu, "&lt;");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:1440px 2400px;margin:0}body{margin:0;font-family:Segoe UI,sans-serif}
      .cover{padding:80px;font-size:28px;line-height:1.5}h1{font-size:44px;margin:0 0 24px}table{border-collapse:collapse;font-size:24px}td,th{border:1px solid #ccc;padding:8px 14px;text-align:left}
      .shot{break-before:page}.shot h2{font-size:26px;margin:20px 40px}.shot img{width:1440px;display:block}</style></head><body>
      <div class="cover"><h1>MioPages (C0): Core's redesign, review draft</h1><p>Local preview WordPress, desktop width, ${new Date().toISOString().slice(0, 10)}. Drafts only; nothing published.</p>
      <table><tr><th>Page</th><th>Real pictures</th><th>FPO frames</th><th>Awaiting a picture</th></tr>
      ${shots.map(s => `<tr><td>${esc(s.title)}</td><td>${s.counts.pictures}</td><td>${s.counts.fpo}</td><td>${s.counts.awaiting}</td></tr>`).join("")}
      <tr><th>All pages</th><th>${total.pictures}</th><th>${total.fpo}</th><th>${total.awaiting}</th></tr></table></div>
      ${shots.map(s => `<div class="shot"><h2>${esc(s.title)}</h2><img src="${s.png.split(/[\\/]/u).pop()}"></div>`).join("")}</body></html>`;
    await writeFile(join(out, "draft.html"), html);
    const pdfPage = await context.newPage();
    await pdfPage.goto("file:///" + join(process.cwd(), out, "draft.html").replaceAll("\\", "/"), { waitUntil: "load" });
    await pdfPage.pdf({ path: join(out, "review-draft.pdf"), width: "1440px", height: "2400px", printBackground: true });
    console.log("PDF:", join(out, "review-draft.pdf"));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
