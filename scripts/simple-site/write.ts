import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { aiRunCall, approvedRateCard } from "../../lib/platform/service/ai-run";
import { current, type ServiceRecord } from "../../lib/platform/service/cycle";
import { reportIdentity } from "../../lib/platform/work-products/pages";
import { readSite, siteSchema, type Site } from "../../lib/simple-site/site";

/**
 * Core writes the whole site once, from the business's own material, the approved Report and the
 * research on comparable websites (the Principal, Nov 28: "a nice site using the AI research").
 *
 *   npx tsx scripts/simple-site/write.ts --ai-run c0-milestone-3 --cap 28 --out runtime-content/simple-site/c0
 *   npx tsx scripts/simple-site/write.ts --stand-in --ai-run c0-milestone-3 --out runtime-content/simple-site/c0-stand-in   (free)
 */
const flag = (name: string) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : undefined; };

export const instructions = [
  "You write the website for the business described in the material below.",
  "Use the business's own material, its approved Business Understanding Report, and the research on comparable businesses' websites.",
  "Plan the pages a visitor needs and write each page as a sequence of sections. For each section choose its layout and write its words.",
  "Layouts: opening (the page's main statement; first on every page), text (a heading and a passage), points (a heading, a passage if needed, and a few short items), call (an invitation to act, with a button).",
  "Tone sets the section's background: light, tint or dark.",
  "The Principal's direction on how much goes on a page: \"a natural limit to what a visitor can comprehend on a page\" and \"neither extravagant nor too constricted\".",
  "State only what the material supports. Do not invent testimonials, prices, results or other facts.",
  "Write in U.S. English for the business's visitors. The footer is one short line about the business.",
].join("\n");

async function main() {
  const name = flag("--ai-run") ?? "c0-milestone-3", out = flag("--out") ?? "runtime-content/simple-site/c0";
  const directory = join("runtime-content", "ai-runs", name);
  const record = JSON.parse(await readFile(join(directory, "record.json"), "utf8")) as ServiceRecord;
  const knowledge = JSON.parse(await readFile(join(directory, "knowledge.json"), "utf8").catch(() => "[]")) as unknown;
  const report = current(record, reportIdentity(record.account.managedSiteId))?.content;
  const material = { knowledge, report, evidence: (record.evidence ?? []).map(item => ({ label: item.label, content: item.content })) };
  await mkdir(out, { recursive: true });
  let site: Site;
  if (process.argv.includes("--stand-in")) {
    // Free: a labeled stand-in site from the Report's own findings, to try the path without the AI.
    const findings = (report as { title: string; summary: string; findings: { heading: string; body: string }[] }).findings;
    site = readSite({ business: "MioPages (stand-in)", footer: "Stand-in text, not Core's AI.", pages: [
      { path: "/", menuLabel: "Home", title: "Home", sections: [
        { layout: { kind: "opening", tone: "dark" }, words: { heading: "Stand-in: " + (report as { title: string }).title, text: (report as { summary: string }).summary, items: [], button: { label: "How it works", page: "/how-it-works" } } },
        { layout: { kind: "points", tone: "light" }, words: { heading: "What the Report found", text: "", items: findings.slice(0, 3).map(f => ({ title: f.heading, text: f.body.slice(0, 220) })), button: null } },
        { layout: { kind: "call", tone: "tint" }, words: { heading: "Next step", text: "A stand-in call to action.", items: [], button: { label: "See how it works", page: "/how-it-works" } } }] },
      { path: "/how-it-works", menuLabel: "How It Works", title: "How It Works", sections: [
        { layout: { kind: "opening", tone: "tint" }, words: { heading: "Stand-in: how it works", text: findings[3]?.body ?? "", items: [], button: null } },
        { layout: { kind: "text", tone: "light" }, words: { heading: findings[4]?.heading ?? "More", text: findings[4]?.body ?? "", items: [], button: { label: "Home", page: "/" } } }] }] });
  } else {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw Error("OPENAI_API_KEY is not set");
    const cap = Number(flag("--cap"));
    if (!(cap > 0)) throw Error("--cap <dollars> is required (the run's approved cap)");
    const call = await aiRunCall({ name, directory, capMicros: Math.round(cap * 1_000_000), rates: approvedRateCard }, record.account, key, 24_000);
    const answer = await call({ model: approvedRateCard.model, instructions, input: JSON.stringify(material),
      text: { format: { type: "json_schema", name: "simple_site", strict: true, schema: siteSchema } } }, "simple-site:" + Date.now());
    await writeFile(join(out, `answer-${Date.now()}.json`), JSON.stringify(answer, null, 1));
    site = readSite(answer);
  }
  await writeFile(join(out, "site.json"), JSON.stringify(site, null, 1));
  for (const page of site.pages) console.log(`${page.path.padEnd(22)} ${page.sections.length} sections, ~${JSON.stringify(page.sections.map(s => s.words)).split(/\s+/u).length} words`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
