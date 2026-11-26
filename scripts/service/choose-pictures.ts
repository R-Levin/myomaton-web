import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { aiRunCall, approvedRateCard } from "../../lib/platform/service/ai-run";
import { newAsset, pictureChoiceInstructions, pictureChoiceSchema, pictureFrames, pictureQueryInstructions, pictureQuerySchema,
  withAssets, type Asset, type PictureFrame } from "../../lib/platform/service/assets";
import { current, type ServiceRecord } from "../../lib/platform/service/cycle";
import { directionIdentity } from "../../lib/platform/work-products/pages";

/**
 * Core chooses real pictures for the Sections that asked for one (Part 1 #12), from Pixabay, the
 * free source the Principal named (Nov 26). For each Page, Core writes a search phrase per frame;
 * Pixabay is searched once per phrase (responses kept 24 hours, as its terms ask); Core looks at the
 * candidates and chooses one, or none (the frame stays FPO). Chosen pictures are kept as local
 * copies, as Pixabay's terms require, and recorded as Assets with their source and creator.
 * Spending goes to the run's ledger and cap. Run it with the preview stopped.
 *
 *   npx tsx scripts/service/choose-pictures.ts --ai-run c0-milestone-3 --cap 15 [--pages /,/pricing]
 */
const flag = (name: string) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : undefined; };
type Hit = { id: number; pageURL: string; user: string; tags: string; webformatURL: string; largeImageURL: string; imageWidth: number; imageHeight: number };

async function search(folder: string, key: string, query: string): Promise<Hit[]> {
  const cache = join(folder, "search", createHash("sha256").update(query.toLowerCase()).digest("hex").slice(0, 16) + ".json");
  if (existsSync(cache)) {
    const kept = JSON.parse(await readFile(cache, "utf8")) as { at: number; hits: Hit[] };
    if (Date.now() - kept.at < 24 * 3_600_000) return kept.hits;
  }
  const url = new URL("https://pixabay.com/api/");
  for (const [name, value] of Object.entries({ key, q: query.slice(0, 100), image_type: "all", safesearch: "true", per_page: "12", orientation: "horizontal" }))
    url.searchParams.set(name, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await response.text();
  if (body.includes(key)) throw Error("Pixabay answer reflected the key");
  if (!response.ok) throw Error(`Pixabay search failed (${response.status})`);
  const hits = (JSON.parse(body) as { hits: Hit[] }).hits.map(({ id, pageURL, user, tags, webformatURL, largeImageURL, imageWidth, imageHeight }) =>
    ({ id, pageURL, user, tags, webformatURL, largeImageURL, imageWidth, imageHeight }));
  await mkdir(join(folder, "search"), { recursive: true });
  await writeFile(cache, JSON.stringify({ at: Date.now(), query, hits }));
  return hits;
}

async function fetchImage(url: string) {
  if (!/^https:\/\/(cdn\.)?pixabay\.com\//u.test(url)) throw Error("Picture outside Pixabay refused");
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw Error(`Picture download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const name = flag("--ai-run"), cap = Number(flag("--cap")), only = flag("--pages")?.split(",");
  if (!name || !/^[a-z0-9-]{3,60}$/u.test(name) || !(cap > 0 && cap <= 50)) throw Error("Needs --ai-run <name> --cap <dollars> [--pages /,/x]");
  const aiKey = process.env.OPENAI_API_KEY;
  if (!aiKey) throw Error("The approved AI run needs the AI key");
  const pixabayKey = (await readFile(join(process.cwd(), "runtime-content", "private", "pixabay.key"), "utf8")).trim();
  if (!/^[A-Za-z0-9_-]{12,128}$/u.test(pixabayKey)) throw Error("Pixabay key file refused");
  const directory = join(process.cwd(), "runtime-content", "ai-runs", name), folder = join(directory, "pictures");
  // Each run chooses afresh for the pages it covers.
  const read = JSON.parse(await readFile(join(directory, "record.json"), "utf8")) as ServiceRecord;
  const record: ServiceRecord = { ...read, assets: (read.assets ?? []).filter(asset => only && !only.includes(asset.path)) };
  await mkdir(join(directory, "earlier", "backups"), { recursive: true });
  await copyFile(join(directory, "record.json"), join(directory, "earlier", "backups", `record-before-pictures-${Date.now()}.json`));
  await mkdir(join(folder, "chosen"), { recursive: true });
  const call = await aiRunCall({ name, directory, capMicros: Math.round(cap * 1_000_000), rates: approvedRateCard }, record.account, aiKey);
  const direction = current(record, directionIdentity(record.account.managedSiteId))?.content as { positioning?: string; design?: { imagery?: unknown } } | undefined;
  const frames = pictureFrames(record).filter(frame => !only || only.includes(frame.path));
  const byPage = new Map<string, PictureFrame[]>();
  for (const frame of frames) byPage.set(frame.path, [...byPage.get(frame.path) ?? [], frame]);
  const chosen: Asset[] = [];
  // Each picture is used once across the site.
  const used = new Set<number>();
  const round = Number(flag("--round") ?? 1);
  for (const [path, pageFrames] of byPage) {
    const context = { round, business: direction?.positioning, imagery: direction?.design?.imagery, page: path,
      frames: pageFrames.map(({ sectionId, heading, purpose, brief, altIntent }) => ({ sectionId, heading, purpose, brief, altIntent })) };
    const queries = await call({ model: approvedRateCard.model, instructions: pictureQueryInstructions, input: JSON.stringify(context),
      text: { format: { type: "json_schema", name: "core_picture_queries", strict: true, schema: pictureQuerySchema } } }, "picture-queries:" + path) as
      { frames: { sectionId: string; query: string }[] };
    const candidates = new Map<string, { query: string; hits: Hit[]; thumbs: Buffer[] }>();
    for (const frame of pageFrames) {
      const query = queries.frames.find(item => item.sectionId === frame.sectionId)?.query;
      if (!query) continue;
      const hits = (await search(folder, pixabayKey, query)).filter(hit => !used.has(hit.id)).slice(0, 6);
      const thumbs = await Promise.all(hits.map(async hit => sharp(await fetchImage(hit.webformatURL)).resize(480).jpeg({ quality: 70 }).toBuffer()));
      if (hits.length) candidates.set(frame.sectionId, { query, hits, thumbs });
    }
    if (!candidates.size) { console.log(`${path}: no candidates`); continue; }
    const content: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" })[] =
      [{ type: "input_text", text: JSON.stringify({ round, business: direction?.positioning, imagery: direction?.design?.imagery, page: path }) }];
    for (const frame of pageFrames) {
      const found = candidates.get(frame.sectionId);
      if (!found) continue;
      content.push({ type: "input_text", text: JSON.stringify({ frame: frame.sectionId, heading: frame.heading, purpose: frame.purpose, brief: frame.brief }) });
      found.thumbs.forEach((thumb, index) => content.push({ type: "input_text", text: `Frame ${frame.sectionId}, candidate ${index}` },
        { type: "input_image", image_url: "data:image/jpeg;base64," + thumb.toString("base64"), detail: "high" }));
    }
    const choice = await call({ model: approvedRateCard.model, instructions: pictureChoiceInstructions, input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "core_picture_choice", strict: true, schema: pictureChoiceSchema } } }, "picture-choice:" + path) as
      { choices: { sectionId: string; candidate: number | null; alt: string; reason: string }[] };
    for (const pick of choice.choices) {
      const found = candidates.get(pick.sectionId), hit = pick.candidate === null ? undefined : found?.hits[pick.candidate];
      if (found && hit && used.has(hit.id)) { console.log(`${path} ${pick.sectionId.slice(0, 8)}: already used elsewhere, stays FPO`); continue; }
      if (!found || !hit || !pick.alt.trim()) { console.log(`${path} ${pick.sectionId.slice(0, 8)}: stays FPO (${pick.reason.slice(0, 90)})`); continue; }
      used.add(hit.id);
      const master = await fetchImage(hit.largeImageURL);
      const meta = await sharp(master).metadata();
      const file = join(folder, "chosen", `pixabay-${hit.id}.jpg`);
      await writeFile(file, master);
      chosen.push(newAsset({ path, sectionId: pick.sectionId, file: file.slice(process.cwd().length + 1).replaceAll("\\", "/"),
        sha256: createHash("sha256").update(master).digest("hex"), width: meta.width!, height: meta.height!, alt: pick.alt.trim().slice(0, 300),
        source: { provider: "pixabay", id: hit.id, pageURL: hit.pageURL, creator: hit.user, query: found.query }, chosenAt: new Date().toISOString() }));
      console.log(`${path} ${pick.sectionId.slice(0, 8)}: "${found.query}" -> Pixabay ${hit.id} (${pick.reason.slice(0, 80)})`);
    }
    // Kept after every page, so a stop part-way loses nothing already paid for.
    await writeFile(join(directory, "record.json"), JSON.stringify(withAssets(record, chosen), null, 1));
  }
  await writeFile(join(directory, "record.json"), JSON.stringify(withAssets(record, chosen), null, 1));
  console.log(`Chose ${chosen.length} pictures for ${frames.length} frames.`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
