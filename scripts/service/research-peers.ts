import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { chromium, type Browser } from "playwright-core";
import { aiRunResearch, approvedRateCard } from "../../lib/platform/service/ai-run";
import type { ServiceRecord } from "../../lib/platform/service/cycle";
import { withEvidence, type Evidence } from "../../lib/platform/service/evidence";
import { peerAnalysisInstructions, peerAnalysisSchema, peerEvidence, peersFrom, peerSearchRequest, type Peer, type PeerAnalysis } from "../../lib/platform/service/research";

/**
 * Core's peer research for an approved AI run (baseline Part 1 #10), between the Report and the
 * Direction. Core searches for comparable businesses from the approved Report, opens each site in
 * a local browser (desktop and mobile), and its AI analyses each one; every peer becomes gathered
 * Evidence on the Account, with its screenshots. Spending goes to the run's ledger and cap.
 * Run it with the preview stopped: the preview keeps the run's record and would overwrite it.
 *
 *   npx tsx scripts/service/research-peers.ts --ai-run c0-milestone-3 --cap 15 --peers 8
 */
const flag = (name: string) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : undefined; };

async function main() {
  const name = flag("--ai-run"), cap = Number(flag("--cap")), wanted = Number(flag("--peers") ?? 8);
  if (!name || !/^[a-z0-9-]{3,60}$/u.test(name) || !(cap > 0 && cap <= 50) || !(wanted >= 4 && wanted <= 10)) throw Error("Needs --ai-run <name> --cap <dollars> [--peers 4-10]");
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Error("The approved AI run needs the AI key");
  const directory = join(process.cwd(), "runtime-content", "ai-runs", name), folder = join(directory, "research");
  const record = JSON.parse(await readFile(join(directory, "record.json"), "utf8")) as ServiceRecord;
  const report = record.products.find(item => item.kind === "report" && item.status === "current")?.content as Parameters<typeof peerSearchRequest>[1] | undefined;
  if (!report) throw Error("Peer research needs the Client's approved Report");
  await mkdir(join(directory, "earlier", "backups"), { recursive: true });
  const backup = join(directory, "earlier", "backups", "record-before-peer-research.json");
  if (!existsSync(backup)) await copyFile(join(directory, "record.json"), backup);
  await mkdir(folder, { recursive: true });

  const research = await aiRunResearch({ name, directory, capMicros: Math.round(cap * 1_000_000), rates: approvedRateCard }, record.account, key, 6);
  // --reuse-search looks again at the peers Core already found, without searching (and paying) again.
  const kept = join(folder, "search-answer.json");
  const answer = process.argv.includes("--reuse-search") ? JSON.parse(await readFile(kept, "utf8")) as unknown
    : (console.log("Searching for comparable businesses..."), await research.search(peerSearchRequest(approvedRateCard.model, report, wanted)));
  const peers = peersFrom(answer, ["miopages.com", "myomaton.com"]);
  console.log(`Core named ${peers.length}: ${peers.map(peer => peer.host).join(", ")}`);

  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, chromiumSandbox: true });
  const today = new Date().toISOString().slice(0, 10), gathered: Evidence[] = [];
  try {
    for (const peer of peers) {
      try {
        const seen = await capture(browser, peer, folder);
        const images = seen.shots.map(shot => ({ file: relative(process.cwd(), shot.file).replaceAll("\\", "/"), caption: `${peer.host}, ${shot.viewport}` }));
        const analysis = await research.analyze({ model: approvedRateCard.model, instructions: peerAnalysisInstructions,
          input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ customer: { business: report.title, summary: report.summary },
            peer: { url: peer.url, whyComparable: peer.why, ...seen.text } }) },
            ...seen.shots.flatMap(shot => [{ type: "input_text" as const, text: `Screenshot: ${shot.viewport}` },
              { type: "input_image" as const, image_url: "data:image/jpeg;base64," + shot.bytes.toString("base64"), detail: "high" as const }])] }],
          text: { format: { type: "json_schema", name: "core_peer_analysis", strict: true, schema: peerAnalysisSchema } } }, peer.url) as PeerAnalysis;
        gathered.push(peerEvidence(peer, analysis, today, images));
        console.log(`Analyzed ${peer.host}`);
      } catch (error) { console.log(`Skipped ${peer.host}: ${error instanceof Error ? error.message.split("\n")[0] : "failed"}`); }
    }
  } finally { await browser.close(); }

  await writeFile(join(directory, "record.json"), JSON.stringify(withEvidence(record, gathered), null, 1));
  await writeFile(join(folder, "peers.md"), `# Peer research for ${report.title ?? "the Account"}\n\n` +
    gathered.map(item => `## ${item.label}\n\n${item.reference}\n\n${item.content}\n`).join("\n"));
  console.log(`Peer research: ${gathered.length} of ${peers.length} peers kept as Evidence.`);
  if (gathered.length < 4) process.exitCode = 1;
}

/** One peer's homepage in a local browser: its words, and desktop and mobile screenshots (the top of the page, as JPEG). */
async function capture(browser: Browser, peer: Peer, folder: string) {
  const shots: { viewport: string; file: string; bytes: Buffer }[] = [];
  let text: Record<string, unknown> = {};
  for (const [viewport, width, height, longest] of [["desktop", 1440, 900, 3600], ["mobile", 390, 844, 2600]] as const) {
    const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: false, serviceWorkers: "block",
      ...(viewport === "mobile" && { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }) });
    try {
      const page = await context.newPage();
      const response = await page.goto(peer.url, { waitUntil: "load", timeout: 45_000 });
      if (!response || response.status() >= 400) throw Error(`The site answered ${response?.status() ?? "nothing"}`);
      await page.waitForTimeout(2_000);
      // Decline non-essential cookies where the site asks, so the banner does not cover the page.
      for (const label of [/^(necessary only|reject all|decline|reject|only necessary|deny)$/iu]) {
        const button = page.getByRole("button", { name: label }).first();
        if (await button.isVisible().catch(() => false)) await button.click({ timeout: 3_000 }).catch(() => undefined);
      }
      // Scroll through the page so content that appears on scroll is drawn, then back to the top.
      await page.evaluate(async longest => {
        for (let y = 0; y < Math.min(document.documentElement.scrollHeight, longest); y += 400) { window.scrollTo(0, y); await new Promise(done => setTimeout(done, 250)); }
        window.scrollTo(0, 0);
      }, longest);
      await page.waitForTimeout(1_500);
      const full = await page.evaluate(() => document.documentElement.scrollHeight);
      const bytes = await page.screenshot({ type: "jpeg", quality: 60, fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(full, longest) } });
      const file = join(folder, `${peer.host}-${viewport}.jpg`);
      await writeFile(file, bytes);
      shots.push({ viewport, file, bytes });
      if (viewport === "desktop") text = await page.evaluate(() => ({
        title: document.title, description: document.querySelector("meta[name=description]")?.getAttribute("content") ?? "",
        navigation: [...document.querySelectorAll("nav a")].map(link => (link.textContent ?? "").trim()).filter(Boolean).slice(0, 30),
        headings: [...document.querySelectorAll("h1,h2,h3")].map(heading => (heading.textContent ?? "").trim().replace(/\s+/gu, " ")).filter(Boolean).slice(0, 40),
        text: document.body.innerText.replace(/\s+\n/gu, "\n").slice(0, 6_000) }));
    } finally { await context.close(); }
  }
  return { shots, text };
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Peer research failed"); process.exitCode = 1; });
