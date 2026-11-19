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

export type RenderedCaptureIntent = {
  version: 1; contextDigest: string; inputDigest: string; operation: "editorial" | "page";
  expectedPages: readonly { path: string; title: string; heading: string }[];
  maximumRecords: number; maximumBytes: number; includeOperatorProjections: boolean;
};

/** Only proposed visitor headings, routes and bindings cross to the renderer.
 * Protected source records/answers and the full review input stay on Core. */
export function renderedCaptureIntent(run: WorkflowRun, grant: OriginalMaterialGrant): RenderedCaptureIntent {
  validateOriginalGrant(grant, fingerprint(run.context));
  const paths = run.work.operation === "editorial" ? run.input.pages.map(page => page.path) : run.work.path ? [run.work.path] : [];
  if (!grant.candidateReview?.operations.some(operation => operation === run.work.operation) ||
      !["editorial", "page"].includes(run.work.operation) || !paths.length ||
      fingerprint(run.context) !== grant.contextDigest || fingerprint(run.input) !== run.work.inputDigest) throw Error("Exact Core capture intent required");
  return { version: 1, contextDigest: grant.contextDigest, inputDigest: run.work.inputDigest, operation: run.work.operation as "editorial" | "page",
    expectedPages: paths.map(path => { const page = run.input.pages.find(page => page.path === path);
      if (!page) throw Error("Prepared Page missing from capture intent");
      return { path, title: page.heading, heading: page.sections.find(section => section.role === "hero")?.heading ?? page.heading }; }),
    maximumRecords: grant.candidateReview.maximumRecords, maximumBytes: grant.candidateReview.maximumBytes,
    includeOperatorProjections: grant.candidateReview.includeOperatorProjections === true };
}

export function validateRenderedCandidateBinding(run: WorkflowRun, grant: OriginalMaterialGrant, binding: RenderedCandidateBinding) {
  validateRenderedCaptureIntent(renderedCaptureIntent(run, grant), binding);
}

export function validateRenderedCaptureIntent(intent: RenderedCaptureIntent, binding: RenderedCandidateBinding) {
  const origin = new URL(binding.origin);
  const expected = intent.expectedPages.map(page => page.path);
  if (intent.version !== 1 || !["editorial", "page"].includes(intent.operation) ||
      ![intent.contextDigest, intent.inputDigest].every(value => /^[a-f0-9]{64}$/u.test(value)) ||
      !Number.isSafeInteger(intent.maximumRecords) || !Number.isSafeInteger(intent.maximumBytes) || intent.maximumBytes < 1 ||
      new Set(expected).size !== expected.length || intent.expectedPages.some(page => !page.title.trim() || !page.heading.trim()) ||
      binding.contextDigest !== intent.contextDigest || binding.inputDigest !== intent.inputDigest ||
      ![binding.representationDigest, binding.nativeReadbackDigest].every(digest => /^[a-f0-9]{64}$/u.test(digest)) || !expected.length ||
      !["core-candidate", "operator-proposed-preview"].includes(binding.variant) ||
      binding.variant === "operator-proposed-preview" && !intent.includeOperatorProjections ||
      origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || origin.username || origin.password ||
      origin.origin !== binding.origin || binding.pages.length !== expected.length ||
      new Set(binding.pages.map(page => page.path)).size !== expected.length ||
      new Set(binding.pages.map(page => page.wordpressPageId)).size !== expected.length ||
      binding.pages.some(page => !expected.includes(page.path) || !Number.isSafeInteger(page.wordpressPageId) || page.wordpressPageId < 1) ||
      expected.length * 2 > intent.maximumRecords) throw Error("Exact disposable WordPress capture binding required");
}

/** The trusted renderer must verify native draft readback before returning its
 * exact Page/packet mapping, and recheck it on each read. A stored export index
 * alone does not establish that the live WordPress rows remain unchanged.
 * Capture cannot authorize content or prove a caller's claim of canonicality.
 * Only an existing loopback WordPress preview is read; no network discovery,
 * media acquisition, provider request, application write or approval occurs. */
export async function captureRenderedCandidate(browser: Browser, run: WorkflowRun, grant: OriginalMaterialGrant,
  readBinding: () => Promise<RenderedCandidateBinding>, now = Date.now) {
  const result = await captureRenderedIntent(browser, renderedCaptureIntent(run, grant), readBinding, now);
  verifyCandidateReview(run, grant, result.rows);
  return result;
}

/** Rendering half of the same capture contract. Core must independently bind
 * returned pixels to the retained full run via prepareRenderedCandidateCustody. */
export async function captureRenderedIntent(browser: Browser, intent: RenderedCaptureIntent,
  readBinding: () => Promise<RenderedCandidateBinding>, now = Date.now) {
  const binding = await readBinding();
  validateRenderedCaptureIntent(intent, binding);
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
        const expected = intent.expectedPages.find(page => page.path === entry.path);
        if (!expected || observed.heading !== expected.heading.trim() || !observed.text.trim() || observed.images.some(loaded => !loaded)) {
          throw Error("Rendered WordPress content or image differs from prepared scope");
        }
        const bytes = await page.screenshot({ fullPage: true });
        total += bytes.length;
        if (total > intent.maximumBytes) throw Error("WordPress capture exceeds its authorized image envelope");
        const source: OriginalMaterial = { id: "candidate-" + fingerprint(entry.path).slice(0, 16) + "-" + viewport,
          bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), mime: "image/png",
          reference: url, author: "Core disposable WordPress browser capture", date: new Date(now()).toISOString(),
          status: "unconfirmed", purpose: "candidate-review", operations: [intent.operation],
          reviewOf: { contextDigest: intent.contextDigest, inputDigest: intent.inputDigest,
            representationDigest: binding.representationDigest, path: entry.path, viewport,
            representation: "wordpress-native-draft", variant: binding.variant } };
        rows.push({ source, bytes });
        observations.push({ path: entry.path, viewport, status: response.status(), overflow: observed.overflow,
          images: observed.images.length, textDigest: fingerprint(observed.text) });
      }
    } finally { await context.close(); }
  }
  if (fingerprint(await readBinding()) !== initial) throw Error("WordPress capture binding changed");
  return { rows, observations };
}
