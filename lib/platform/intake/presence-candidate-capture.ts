import { createHash } from "node:crypto";
import type { Browser } from "playwright-core";
import { fingerprint } from "../canonical/model";
import type { WorkflowRun } from "./presence-workflow";
import { validateOriginalGrant, verifyCandidateReview, type OriginalMaterial, type OriginalMaterialGrant } from "./presence-source-material";

export type RenderedCandidateBinding = {
  contextDigest: string;
  inputDigest: string;
  representationDigest: string;
  nativeReadbackDigest: string;
  variant: "core-candidate" | "operator-proposed-preview";
  origin: string;
  pages: readonly { path: string; wordpressPageId: number }[];
};

export function validateRenderedCandidateBinding(run: WorkflowRun, grant: OriginalMaterialGrant, binding: RenderedCandidateBinding) {
  validateOriginalGrant(grant, fingerprint(run.context));
  const origin = new URL(binding.origin);
  const expected = run.work.operation === "editorial" ? run.input.pages.map(page => page.path) :
    run.work.path ? [run.work.path] : [];
  if (!grant.candidateReview?.operations.some(operation => operation === run.work.operation) ||
      fingerprint(run.context) !== grant.contextDigest || fingerprint(run.input) !== run.work.inputDigest ||
      binding.contextDigest !== grant.contextDigest || binding.inputDigest !== run.work.inputDigest ||
      ![binding.representationDigest, binding.nativeReadbackDigest].every(digest => /^[a-f0-9]{64}$/u.test(digest)) || !expected.length ||
      !["core-candidate", "operator-proposed-preview"].includes(binding.variant) ||
      binding.variant === "operator-proposed-preview" && !grant.candidateReview.includeOperatorProjections ||
      origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || origin.username || origin.password ||
      origin.origin !== binding.origin || binding.pages.length !== expected.length ||
      new Set(binding.pages.map(page => page.path)).size !== expected.length ||
      new Set(binding.pages.map(page => page.wordpressPageId)).size !== expected.length ||
      binding.pages.some(page => !expected.includes(page.path) || !Number.isSafeInteger(page.wordpressPageId) || page.wordpressPageId < 1) ||
      expected.length * 2 > grant.candidateReview.maximumRecords) throw Error("Exact disposable WordPress capture binding required");
}

/** The trusted renderer must verify native draft readback before returning its
 * exact Page/packet mapping, and recheck it on each read. A stored export index
 * alone does not establish that the live WordPress rows remain unchanged.
 * Capture cannot authorize content or prove a caller's claim of canonicality.
 * Only an existing loopback WordPress preview is read; no network discovery,
 * media acquisition, provider request, application write or approval occurs. */
export async function captureRenderedCandidate(browser: Browser, run: WorkflowRun, grant: OriginalMaterialGrant,
  readBinding: () => Promise<RenderedCandidateBinding>, now = Date.now) {
  const binding = await readBinding();
  validateRenderedCandidateBinding(run, grant, binding);
  const initial = fingerprint(binding);
  const rows: { source: OriginalMaterial; bytes: Buffer }[] = [];
  const observations: { path: string; viewport: "desktop" | "mobile"; status: number; overflow: boolean; images: number; textDigest: string }[] = [];
  let total = 0;
  for (const [viewport, width] of [["desktop", 1440], ["mobile", 390]] as const) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: "block" });
    try {
      await context.route("**/*", route => {
        const request = route.request(), url = new URL(request.url());
        return url.origin === binding.origin && !url.username && !url.password && ["GET", "HEAD"].includes(request.method()) ?
          route.continue() : route.abort();
      });
      await context.routeWebSocket("**/*", socket => socket.close());
      const page = await context.newPage();
      for (const entry of binding.pages) {
        if (fingerprint(await readBinding()) !== initial) throw Error("WordPress capture binding changed");
        const url = binding.origin + "/?page_id=" + entry.wordpressPageId + "&preview=true";
        const response = await page.goto(url, { waitUntil: "networkidle" });
        if (response?.status() !== 200 || new URL(page.url()).origin !== binding.origin) throw Error("Exact private WordPress Page unavailable");
        await page.evaluate(async () => {
          for (const image of document.images) { image.loading = "eager"; await image.decode().catch(() => {}); }
          await document.fonts.ready;
        });
        const observed = await page.evaluate(() => ({
          heading: document.querySelector("main h1")?.textContent?.trim(),
          text: document.querySelector("main")?.textContent ?? "",
          images: [...document.images].map(image => image.complete && image.naturalWidth > 0),
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        const expected = run.input.pages.find(page => page.path === entry.path);
        if (!expected || observed.heading !== expected.heading.trim() || !observed.text.trim() || observed.images.some(loaded => !loaded)) {
          throw Error("Rendered WordPress content or image differs from prepared scope");
        }
        const bytes = await page.screenshot({ fullPage: true });
        total += bytes.length;
        if (total > grant.candidateReview!.maximumBytes) throw Error("WordPress capture exceeds its authorized image envelope");
        const source: OriginalMaterial = { id: "candidate-" + fingerprint(entry.path).slice(0, 16) + "-" + viewport,
          bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), mime: "image/png",
          reference: url, author: "Core disposable WordPress browser capture", date: new Date(now()).toISOString(),
          status: "unconfirmed", purpose: "candidate-review", operations: [run.work.operation],
          reviewOf: { contextDigest: grant.contextDigest, inputDigest: run.work.inputDigest,
            representationDigest: binding.representationDigest, path: entry.path, viewport,
            representation: "wordpress-native-draft", variant: binding.variant } };
        rows.push({ source, bytes });
        observations.push({ path: entry.path, viewport, status: response.status(), overflow: observed.overflow,
          images: observed.images.length, textDigest: fingerprint(observed.text) });
      }
    } finally { await context.close(); }
  }
  if (fingerprint(await readBinding()) !== initial) throw Error("WordPress capture binding changed");
  verifyCandidateReview(run, grant, rows);
  return { rows, observations };
}
