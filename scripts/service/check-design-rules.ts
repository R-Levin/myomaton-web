/**
 * Checks the rendered draft against the design rules (lib/platform/design-systems/design-rules.ts)
 * on desktop and phone, as a visitor sees it. Rules 1, 2 and 8 are enforced in code before
 * anything reaches WordPress (the stylesheet check, the component reader, the licensed fonts);
 * this checks rules 3 to 7 and 9 on the finished pages.
 *
 *   npx tsx scripts/service/check-design-rules.ts --base http://127.0.0.1:4481 \
 *     --login runtime-content/preview-wordpress-login.txt --out runtime-content/ai-runs/c0-milestone-3/rules-check
 *
 * Local preview only: it signs in with the throwaway preview login and never prints it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";
import { designRules } from "../../lib/platform/design-systems/design-rules";

const arg = (name: string, fallback?: string) => {
  const at = process.argv.indexOf("--" + name);
  const value = at > 0 ? process.argv[at + 1] : fallback;
  if (!value) throw Error(`--${name} is required`);
  return value;
};
const base = arg("base", "http://127.0.0.1:4481").replace(/\/$/u, "");
const out = arg("out", "runtime-content/design-rules-check");
const overrideAt = process.argv.indexOf("--stylesheet");
const overrideFile = overrideAt > 0 ? process.argv[overrideAt + 1] : undefined;

type Finding = { rule: number; page: string; view: string; issue: string; trace?: string };
const views = [["desktop", 1440, 1000], ["phone", 390, 844]] as const;

/** Runs in the page: everything a visitor would meet that the rules speak to. */
function inspect() {
  const findings: { rule: number; issue: string; trace?: string }[] = [];
  const say = (rule: number, issue: string, trace?: string) => findings.push({ rule, issue, ...(trace && { trace }) });
  // Which of Core's own style rules set a property on an element, in source order (the later or more specific one wins).
  const coreRules: CSSStyleRule[] = [];
  const coreSheet = [...document.styleSheets].find(sheet => (sheet.ownerNode as Element | null)?.id === "miopages-managed-site-inline-css");
  const collect = (rules: CSSRuleList) => { for (const r of [...rules]) {
    if (r instanceof CSSMediaRule) { if (matchMedia(r.media.mediaText).matches) collect(r.cssRules); }
    else if (r instanceof CSSStyleRule && r.selectorText.includes("miopages-designed")) coreRules.push(r);
    else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) collect((r as CSSGroupingRule).cssRules);
  } };
  if (coreSheet) collect(coreSheet.cssRules);
  const short = (selector: string) => selector.replace(/body\.miopages-designed:not\(#mp-core-design\)\s*/gu, "").trim().slice(0, 150);
  const setting = (el: Element, ...props: string[]) => coreRules.filter(r => { try { return el.matches(r.selectorText) && props.some(p => r.style.getPropertyValue(p)); } catch { return false; } })
    .map(r => `${short(r.selectorText)} { ${props.filter(p => r.style.getPropertyValue(p)).map(p => `${p}: ${r.style.getPropertyValue(p)}`).join("; ")} }`);
  const source = (el: Element, ...props: string[]) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const rules = setting(n, ...props);
      if (rules.length) return `${n === el ? "on the element" : "inherited from " + label(n)}: ${rules.slice(-3).join(" then ")}`;
    }
    return "not set by your stylesheet";
  };
  const label = (el: Element) => (el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/u).slice(0, 2).join(".") : "")
    + ' "' + (el.textContent ?? "").trim().replace(/\s+/gu, " ").slice(0, 50) + '"');
  const visible = (el: Element) => (el as HTMLElement).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
  const main = document.querySelector("main") ?? document.body;

  // Rule 3, structured: one page title, headings in order, pictures described.
  const h1 = main.querySelectorAll("h1").length;
  if (h1 !== 1) say(3, `${h1} page titles (h1); there should be exactly one`);
  let last = 0;
  for (const h of main.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) say(3, `heading skips from h${last} to h${level}: ${label(h)}`);
    last = level;
  }
  for (const img of document.querySelectorAll("img")) if (!img.getAttribute("alt")?.trim() && !img.closest(".miopages-draft-wordmark, #wpadminbar")) say(3, `picture without a description: ${img.src.slice(-40)}`);

  // Rule 4, readable: contrast against the solid color behind the text; body text size on phones.
  // Any CSS color (rgb, color(srgb …), oklch, color-mix results) read back as the pixel the browser paints.
  const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const parse = (value: string) => {
    pixel.clearRect(0, 0, 1, 1); pixel.fillStyle = "#000"; pixel.fillStyle = value; pixel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
    return { r: r!, g: g!, b: b!, a: a! / 255 };
  };
  const lum = (c: { r: number; g: number; b: number }) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const blend = (top: { r: number; g: number; b: number; a: number }, under: { r: number; g: number; b: number }) =>
    ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a) });
  let unmeasured = 0, lowContrast = 0;
  const textNodes = [...document.querySelectorAll("main p, main li, main h1, main h2, main h3, main h4, main a, main span, main blockquote, main cite, main figcaption, header a, header span, footer a, footer p")]
    .filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim()));
  for (const el of textNodes) {
    const style = getComputedStyle(el);
    // The colors behind the text, nearest first. A gradient is judged at its worst color stop;
    // text over a photograph is listed for a person to look at.
    const layers: { r: number; g: number; b: number; a: number }[][] = [];
    let node: Element | null = el, onPicture = false, backgroundAt: Element | null = null;
    while (node) {
      const s = getComputedStyle(node);
      const bg = parse(s.backgroundColor);
      if (s.backgroundImage.includes("url(")) { onPicture = true; break; }
      // An element's background images are painted top first, each over the next, then over its
      // background color; a fully opaque one hides everything beneath it.
      const images: string[] = [];
      if (s.backgroundImage !== "none") {
        let depth = 0, start = 0;
        for (let i = 0; i < s.backgroundImage.length; i++) {
          const ch = s.backgroundImage[i];
          if (ch === "(") depth++; else if (ch === ")") depth--;
          else if (ch === "," && depth === 0) { images.push(s.backgroundImage.slice(start, i)); start = i + 1; }
        }
        images.push(s.backgroundImage.slice(start));
      }
      let covered = false;
      for (const image of images) {
        const stops = (image.match(/(rgba?|color)\([^()]*\)/gu) ?? []).map(parse);
        if (!stops.length) continue;
        layers.push(stops);
        if (stops.every(stop => stop.a >= 1)) { covered = true; break; }
      }
      if (covered) { backgroundAt = node; break; }
      if (bg.a > 0) { layers.push([bg]); backgroundAt = node; if (bg.a >= 1) break; }
      node = node.parentElement;
    }
    if (onPicture) { unmeasured++; continue; }
    // Every combination of stops, from the page's white upwards; the worst one counts.
    let backs = [{ r: 255, g: 255, b: 255 }];
    for (const layer of layers.reverse()) backs = layer.flatMap(stop => backs.map(back => blend(stop, back))).slice(0, 64);
    const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
    const needed = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const ratio = Math.min(...backs.map(back => {
      const fore = blend(parse(style.color), back);
      const [a, b] = [lum(fore) + 0.05, lum(back) + 0.05];
      return Math.max(a, b) / Math.min(a, b);
    }));
    if (ratio < needed) {
      lowContrast++;
      const fore = parse(style.color);
      const trace = `text ${style.color} (${source(el, "color")}); background behind it from ${backgroundAt ? label(backgroundAt) : "the page"}` +
        (backgroundAt ? ` (${source(backgroundAt, "background", "background-color", "background-image")})` : "");
      void fore;
      say(4, `contrast ${ratio.toFixed(2)} (needs ${needed}): ${label(el)}`, trace);
    }
  }
  if (innerWidth < 600) for (const p of main.querySelectorAll("p")) {
    if (visible(p) && p.textContent!.trim().length > 80 && parseFloat(getComputedStyle(p).fontSize) < 15) { say(4, `body text under 15px on a phone: ${label(p)}`); break; }
  }

  // Rule 5, reachable: approved words are not hidden unless a control the visitor can use reveals them.
  for (const el of main.querySelectorAll("p, li, h1, h2, h3, h4, blockquote, a")) {
    if (!el.textContent!.trim() || visible(el)) continue;
    if (el.closest("details") || el.closest("nav")) continue;
    say(5, `hidden text a visitor cannot reach: ${label(el)}`);
  }
  const header = document.querySelector("header.wp-block-template-part");
  const nav = document.querySelector("nav.miopages-draft-nav");
  if (nav && !visible(nav)) {
    const button = header?.querySelector<HTMLButtonElement>(".miopages-menu-toggle");
    if (!button || !visible(button)) say(5, "the menu is hidden and there is no visible menu button");
  }

  // Rule 6, fits the phone: no sideways page scroll, pinned parts small, targets big enough to tap.
  if (document.documentElement.scrollWidth > innerWidth + 1) say(6, `the page scrolls sideways (${document.documentElement.scrollWidth}px wide in a ${innerWidth}px window)`);
  for (const el of document.querySelectorAll("body *:not(#wpadminbar *):not(#wpadminbar)")) {
    const position = getComputedStyle(el).position;
    if ((position === "fixed" || position === "sticky") && visible(el)) {
      const box = el.getBoundingClientRect();
      if (box.height > innerHeight * 0.25 && !el.closest(".miopages-menu-open")) say(6, `a pinned part covers ${Math.round(box.height / innerHeight * 100)}% of the screen: ${label(el)}`);
    }
  }
  let small = 0;
  for (const el of document.querySelectorAll("main a, main button, header a, header button")) {
    if (!visible(el) || el.closest("p, li")) continue; // links inside running text are exempt (WCAG 2.5.8)
    const box = el.getBoundingClientRect();
    if (box.width < 24 || box.height < 24) { small++; if (small <= 5) say(6, `too small to tap (${Math.round(box.width)}x${Math.round(box.height)}): ${label(el)}`); }
  }

  // Rule 7, honest about gaps: FPO frames and missing-material notices are clearly visible.
  for (const el of document.querySelectorAll(".miopages-fpo, .miopages-placeholder")) {
    const box = el.getBoundingClientRect();
    if (!visible(el) || box.width < 120 || box.height < 60) say(7, `an FPO frame or missing-material notice is hidden or too small (${Math.round(box.width)}x${Math.round(box.height)})`);
  }

  // Rule 9, motion: with reduced motion asked for, nothing keeps animating.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const moving = document.getAnimations().filter(a => a.playState === "running" && Number(a.effect?.getComputedTiming().duration ?? 0) > 50);
    if (moving.length) say(9, `${moving.length} animations still run when the visitor asks for reduced motion`);
  }
  return { findings, measuredText: textNodes.length - unmeasured, unmeasured };
}

async function main() {
const override = overrideFile ? await readFile(overrideFile, "utf8") : undefined;
const login = await readFile(arg("login", "runtime-content/preview-wordpress-login.txt"), "utf8");
const user = /^User:\s*(.+)$/mu.exec(login)?.[1]?.trim(), password = /^Password:\s*(.+)$/mu.exec(login)?.[1]?.trim();
// The review site's password gate, when the login file names one (miopages.org); never printed.
  const gateUser = /^Gate user:\s*(.+)$/mu.exec(login)?.[1]?.trim(), gatePassword = /^Gate password:\s*(.+)$/mu.exec(login)?.[1]?.trim();
  const named = /https?:\/\/[^/\s]+/u.exec(login)?.[0];
  if (!user || !password || !(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/u.test(base) || base === named)) throw Error("A local preview, or the review site named in the login file, and its login are required");
  const gate = gateUser && gatePassword ? { httpCredentials: { username: gateUser, password: gatePassword } } : {};
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const findings: Finding[] = [];
const notes: string[] = [];
try {
  const signIn = await browser.newContext({ ...gate });
  const page = await signIn.newPage();
  await page.goto(base + "/wp-login.php");
  await page.fill("#user_login", user);
  await page.fill("#user_pass", password);
  await Promise.all([page.waitForNavigation(), page.click("#wp-submit")]);
  await page.goto(base + "/wp-admin/edit.php?post_type=page&post_status=draft");
  // Only the pages Core delivered: WordPress's own sample pages are not part of the site.
  const pages = await page.$$eval("a.row-title", links => links.filter(a => !/^(Privacy Policy|Sample Page)$/u.test(a.textContent!.trim()))
    .map(a => ({ title: a.textContent!.trim(), href: (a.closest("tr")!.querySelector(".view a, .preview a") as HTMLAnchorElement | null)?.href })).filter(p => p.href));
  const state = await signIn.storageState();
  await signIn.close();
  await mkdir(out, { recursive: true });
  for (const [view, width, height] of views) {
    for (const motion of ["no-preference", "reduce"] as const) {
      const context = await browser.newContext({ ...gate, viewport: { width, height }, reducedMotion: motion, storageState: state });
      // tsx names functions with a helper the page does not have; give the page a no-op one.
      await context.addInitScript("window.__name = (f) => f");
      const tab: Page = await context.newPage();
      for (const { title, href } of pages) {
        await tab.goto(href!, { waitUntil: "networkidle" });
        // Checking a proposed design: Core's current stylesheet (after the theme's color variables) is swapped for it.
        if (override !== undefined) {
          const swapped = await tab.evaluate((css: string) => {
            const style = document.getElementById("miopages-managed-site-inline-css");
            const text = style?.textContent ?? "", start = text.indexOf("body.miopages-branded-draft{");
            const end = start < 0 ? -1 : text.indexOf("}", start);
            if (!style || end < 0) return false;
            style.textContent = text.slice(0, end + 1) + String.fromCharCode(10) + css;
            return true;
          }, override);
          if (!swapped) throw Error("Could not find the site's stylesheet to swap in the proposed one");
          await tab.evaluate(() => window.dispatchEvent(new Event("resize")));
          await tab.waitForTimeout(300);
        }
        await tab.evaluate(async () => { await document.fonts.ready; });
        const result = await tab.evaluate(inspect);
        for (const finding of result.findings) if (motion === "reduce" ? finding.rule === 9 : finding.rule !== 9)
          findings.push({ rule: finding.rule, page: title, view, issue: finding.issue, ...(finding.trace && { trace: finding.trace }) });
        if (motion === "no-preference" && result.unmeasured) notes.push(`${title} (${view}): ${result.unmeasured} text elements sit on a photograph; contrast there needs a look`);
        // The phone menu: opens, shows every link, closes with Escape.
        if (motion === "no-preference" && await tab.locator(".miopages-menu-toggle").isVisible()) {
          await tab.click(".miopages-menu-toggle");
          const shown = await tab.locator("nav.miopages-draft-nav > *").evaluateAll(items => items.every(i => (i as HTMLElement).checkVisibility()));
          if (!shown) findings.push({ rule: 5, page: title, view, issue: "the opened phone menu does not show every link" });
          await tab.keyboard.press("Escape");
          if (await tab.locator("header.miopages-menu-open").count()) findings.push({ rule: 5, page: title, view, issue: "the phone menu does not close with Escape" });
        }
      }
      await context.close();
    }
  }
} finally { await browser.close(); }

const summary = designRules.filter(rule => [3, 4, 5, 6, 7, 9].includes(rule.number)).map(rule => {
  // The same issue on several pages or screen sizes is one line, with where it occurs.
  const grouped = new Map<string, { pages: Set<string>; views: Set<string>; times: number; trace?: string }>();
  for (const f of findings.filter(f => f.rule === rule.number)) {
    const entry = grouped.get(f.issue) ?? { pages: new Set(), views: new Set(), times: 0, trace: f.trace };
    entry.pages.add(f.page); entry.views.add(f.view); entry.times++;
    grouped.set(f.issue, entry);
  }
  return `${rule.number}. ${rule.name}: ${grouped.size ? grouped.size + " issue" + (grouped.size > 1 ? "s" : "") : "passes"}`
    + [...grouped].map(([issue, { pages, views, times, trace }]) => `\n   - ${issue} (${times}x, ${[...pages].join(", ")}; ${[...views].join(" and ")})`
      + (trace ? `\n     why: ${trace}` : "")).join("");
}).join("\n");
const report = `Design rules check, ${new Date().toISOString().slice(0, 16)} (${base})\nRules 1, 2 and 8 are enforced in code before delivery.\n\n${summary}\n`
  + (notes.length ? `\nNot measured automatically:\n${notes.map(n => "- " + n).join("\n")}\n` : "");
await writeFile(join(out, "design-rules-check.txt"), report);
await writeFile(join(out, "design-rules-check.json"), JSON.stringify({ base, findings, notes }, null, 2));
console.log(report);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
