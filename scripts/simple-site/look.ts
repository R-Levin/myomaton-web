import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

/**
 * Screenshots of the site's draft pages on miopages.org, desktop and phone, signed in as a reviewer,
 * so Claude looks at what the Principal will see before saying anything about it.
 *
 *   npx tsx scripts/simple-site/look.ts --site runtime-content/simple-site/c0
 */
const flag = (name: string) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : undefined; };

async function main() {
  const folder = flag("--site") ?? "runtime-content/simple-site/c0";
  const state = JSON.parse(await readFile(join(folder, "wordpress.json"), "utf8")) as { pages: Record<string, number> };
  const login = await readFile("runtime-content/private/review-sites/miopages-org-login.txt", "utf8");
  const get = (k: string) => new RegExp("^" + k + ":\\s*(.+)$", "mu").exec(login)?.[1]?.trim() ?? "";
  const out = join(folder, "look"); await mkdir(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const context = await browser.newContext({ httpCredentials: { username: get("Gate user"), password: get("Gate password") } });
    const page = await context.newPage();
    await page.goto("https://miopages.org/wp-login.php");
    await page.fill("#user_login", get("User")); await page.fill("#user_pass", get("Password"));
    await Promise.all([page.waitForNavigation(), page.click("#wp-submit")]);
    for (const [view, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      for (const [path, id] of Object.entries(state.pages)) {
        await page.goto(`https://miopages.org/?page_id=${id}&preview=true`, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: "#wpadminbar{display:none!important} html{margin-top:0!important}" });
        const file = join(out, `${view}-${path === "/" ? "home" : path.slice(1).replace(/\//gu, "-")}.jpg`);
        await writeFile(file, await page.screenshot({ fullPage: true, type: "jpeg", quality: 75 }));
        console.log(file);
      }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
