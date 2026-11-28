/**
 * A Review of the rendered draft against the design rules (design-rules.ts), as a visitor sees it
 * on desktop and phone, run on the preview WordPress. It also checks a design Core has proposed
 * before anyone approves it, by showing the pages with the proposed stylesheet. The findings,
 * with which of Core's own style rules produced each, go back to Core as a Request (or as the
 * correction of a proposed Change), so Core sees what its design does on the real pages.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type RenderedFinding = { rule: number; page: string; view: string; issue: string; trace?: string };
export type RenderedCheck = { at: string; subject: string; findings: RenderedFinding[]; notes: string[] };

const folder = (webPresenceId: string) => join(tmpdir(), "miopages-rendered-checks", webPresenceId.replace(/[^a-z0-9-]/giu, ""));
const fileFor = (webPresenceId: string, key: string) => join(folder(webPresenceId), key.replace(/[^a-z0-9.-]/giu, "_") + ".json");

/** The WordPress the drafts go to (miopages.org, or the local preview) and the login for checking it. */
async function previewSite(configFile: string) {
  // The review site keeps its check login beside its settings (<name>-login.txt); the local preview keeps WORDPRESS-LOGIN.txt.
  const beside = configFile.replace(/\.json$/u, "-login.txt");
  const login = (await readFile(beside, "utf8").then(() => true, () => false)) ? beside : join(dirname(dirname(configFile)), "WORDPRESS-LOGIN.txt");
  const base = /https?:\/\/[^/\s]+/u.exec(await readFile(login, "utf8"))?.[0];
  if (!base) throw Error("The preview WordPress login file names no address");
  return { base, login };
}

/** Run the check (minutes: every page, desktop and phone) and keep its result under `key`. */
export async function runRenderedCheck(input: { webPresenceId: string; key: string; subject: string; configFile: string; stylesheet?: string }): Promise<RenderedCheck> {
  const { base, login } = await previewSite(input.configFile);
  const out = join(folder(input.webPresenceId), "run-" + input.key.replace(/[^a-z0-9-]/giu, "_"));
  await mkdir(out, { recursive: true });
  const args = ["node_modules/tsx/dist/cli.mjs", "scripts/service/check-design-rules.ts", "--base", base, "--login", login, "--out", out];
  if (input.stylesheet !== undefined) {
    const sheet = join(out, "proposed.css");
    await writeFile(sheet, input.stylesheet);
    args.push("--stylesheet", sheet);
  }
  const failure = await new Promise<string | null>(resolve => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true });
    let errors = "";
    child.stderr.on("data", chunk => { errors += String(chunk); });
    child.on("close", code => resolve(code === 0 ? null : errors.trim().split("\n").at(-1) ?? "The check did not finish"));
  });
  if (failure) throw Error("The rendered-page check did not finish: " + failure.slice(0, 200));
  const raw = JSON.parse(await readFile(join(out, "design-rules-check.json"), "utf8")) as { findings: RenderedFinding[]; notes: string[] };
  const result: RenderedCheck = { at: new Date().toISOString(), subject: input.subject, findings: raw.findings, notes: raw.notes };
  await writeFile(fileFor(input.webPresenceId, input.key), JSON.stringify(result, null, 2));
  return result;
}

/** The last check kept under `key`, if any. */
export async function lastRenderedCheck(webPresenceId: string, key: string): Promise<RenderedCheck | null> {
  try { return JSON.parse(await readFile(fileFor(webPresenceId, key), "utf8")) as RenderedCheck; } catch { return null; }
}

/** The same issue on several pages or sizes, once, with where it occurs and what caused it. */
function grouped(findings: RenderedFinding[]) {
  const groups = new Map<string, { rule: number; pages: Set<string>; views: Set<string>; trace?: string }>();
  for (const f of findings) {
    const g = groups.get(f.issue) ?? { rule: f.rule, pages: new Set(), views: new Set(), trace: f.trace };
    g.pages.add(f.page); g.views.add(f.view); groups.set(f.issue, g);
  }
  return [...groups].map(([issue, g]) => ({ issue, ...g }));
}

/** A short plain summary for the Specialist. */
export function checkSummary(check: RenderedCheck) {
  const groups = grouped(check.findings);
  return groups.length ? `${groups.length} problem${groups.length > 1 ? "s" : ""} on the rendered pages (${check.findings.length} places, desktop and phone)` : "No problems on the rendered pages, desktop and phone";
}

/** The findings in words Core can act on, with the rules of its own stylesheet behind each. */
export function findingsForCore(check: RenderedCheck) {
  const groups = grouped(check.findings);
  const lines = groups.slice(0, 40).map(g => `- Rule ${g.rule}: ${g.issue}, on ${[...g.pages].join(", ")} (${[...g.views].join(" and ")})${g.trace ? `. Why: ${g.trace}` : ""}`);
  const more = groups.length > 40 ? `\n…and ${groups.length - 40} more of the same kinds.` : "";
  return (`The check of ${check.subject} on the rendered pages (desktop and phone) found the problems below against the design rules. ` +
    "For each, \"Why\" names the rules of your stylesheet that set the text and the background behind it, in source order (a later or more specific rule wins). " +
    "Fix every one at its cause, keeping the design otherwise as it is:\n" + lines.join("\n") + more).slice(0, 19_500);
}
