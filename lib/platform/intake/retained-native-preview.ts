import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
import { validatePages } from "../wordpress-delivery/authority";
import brandRecord from "./c0-review-brand.json";
import type { workflowNativeReviewCandidate } from "./presence-workflow-delivery";

type Input = ReturnType<typeof workflowNativeReviewCandidate> & { path: string };
const escape = (value: string) => value.replace(/[&<>"']/gu, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** The preview uses WordPress's existing pure content renderer, not a second
 * page builder. No WP load, hook, installation, post write, media fetch or script. */
export async function renderRetainedNativePreview(input: Input) {
  validatePages(input.candidate.pages, true, true);
  const selected = input.candidate.pages.find(page => page.path === input.path);
  assert.ok(selected);
  const renderer = join(process.cwd(), ".rehearsal", "core-native-preview.php");
  const bytes = JSON.stringify(input);
  const html = await new Promise<string>((resolve, reject) => {
    const child = execFile("/usr/bin/php", [renderer], { timeout: 10000, maxBuffer: Math.max(1_000_000, Buffer.byteLength(bytes) * 8),
      encoding: "utf8", env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", NODE_ENV: "production" } }, (error, stdout) => error ? reject(Error("Native preview renderer refused")) : resolve(stdout));
    child.stdin?.end(bytes);
  });
  const root = join(await realpath(process.env.HOME ?? ""), "miopages-private-acceptance", "presence-evaluation",
    "41a83e7e-1765-4517-941a-b2b151bb7c4a", "originals");
  const logoFile = join(root, brandRecord.logoSource.sha256 + ".source");
  const meta = await lstat(logoFile);
  assert.ok(meta.isFile() && meta.uid === process.getuid?.() && (meta.mode & 0o777) === 0o600 && await realpath(logoFile) === logoFile);
  const logo = await readFile(logoFile);
  assert.equal(createHash("sha256").update(logo).digest("hex"), brandRecord.logoSource.sha256);
  assert.equal(brandRecord.logoSource.mime, "image/png");
  const design = brandRecord.brand.projection.design, p = design.palette, t = design.typography;
  const stacks = { sans: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", serif: "Georgia,'Times New Roman',serif", mono: "ui-monospace,Consolas,monospace" };
  const variables = { "--wp--preset--color--surface": p.light.background, "--wp--preset--color--ink": p.light.text,
    "--wp--preset--color--brand": p.brand.background, "--wp--preset--color--on-brand": p.brand.text,
    "--wp--preset--color--support": p.tonal.background, "--miopages-tonal-ink": p.tonal.text,
    "--miopages-accent-surface": p.strong.background, "--miopages-accent-ink": p.strong.text, "--miopages-border": p.border,
    "--miopages-body-font": stacks[t.bodyFont as keyof typeof stacks], "--miopages-heading-font": stacks[t.headingFont as keyof typeof stacks],
    "--miopages-body-size": t.baseSize + "px", "--miopages-body-leading": String(t.lineHeight), "--miopages-title-size": t.baseSize * t.headingScale + "px" };
  const style = Object.entries(variables).map(([key, value]) => key + ":" + value).join(";");
  const css = await readFile(join(process.cwd(), ".rehearsal", "managed-site.css"), "utf8");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(selected.title)}</title><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;padding:clamp(1rem,3vw,2.5rem);background:var(--wp--preset--color--surface);color:var(--wp--preset--color--ink)}header,main{max-width:72rem;margin:auto}header{padding:.5rem 0 1.5rem}header img{width:190px;max-width:55vw;height:auto}a{color:var(--wp--preset--color--brand)}${css}</style></head><body class="miopages-branded-draft miopages-motion-off" style="${escape(style)}"><header><img src="data:image/png;base64,${logo.toString("base64")}" alt="MioPages"></header><main><div class="wp-block-post-content">${html}</div></main></body></html>`;
}
