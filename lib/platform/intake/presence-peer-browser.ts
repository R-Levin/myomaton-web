import type { Browser } from "playwright-core";
import type { PublicResearchSource } from "./presence-workflow-research";

export async function capturePublicPeer(browser: Browser, source: PublicResearchSource, html: Buffer,
  readAsset: typeof fetch, recheck: () => Promise<void>, maximumBytes: number) {
  const captured: { viewport: "desktop" | "mobile"; bytes: Buffer; width: number; height: number }[] = [];
  const failures = new Set<string>();
  for (const [viewport, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
    await recheck();
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block",
      acceptDownloads: false, extraHTTPHeaders: { DNT: "1" } });
    await context.routeWebSocket("**", route => route.close());
    let resourceBytes = 0;
    let resourceCount = 0;
    try {
      await context.route("**/*", async route => {
        const request = route.request();
        if (request.method() !== "GET" || ++resourceCount > 120) return route.abort();
        if (request.isNavigationRequest()) {
          if (request.url() !== source.url || request.frame() !== request.frame().page().mainFrame()) return route.abort();
          return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html,
            headers: { "Content-Security-Policy": "connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'",
              "X-DNS-Prefetch-Control": "off" } });
        }
        if (!["stylesheet", "font", "image", "script"].includes(request.resourceType())) return route.abort();
        try {
          await recheck();
          const response = await readAsset(request.url(), { method: "GET", redirect: "error" });
          if (!response.ok) throw Error("Peer asset unavailable");
          const body = Buffer.from(await response.arrayBuffer());
          resourceBytes += body.length;
          if (resourceBytes > maximumBytes) throw Error("Peer resource envelope exceeded");
          return route.fulfill({ status: 200, contentType: response.headers.get("content-type") ?? "application/octet-stream", body });
        } catch {
          failures.add(request.resourceType());
          return route.abort();
        }
      });
      const page = await context.newPage();
      const response = await page.goto(source.url, { waitUntil: "networkidle", timeout: 30_000 });
      if (response?.status() !== 200 || page.url() !== source.url) throw Error("Peer viewport could not be verified");
      await page.evaluate(() => document.fonts.ready);
      const bytes = await page.screenshot({ fullPage: true, animations: "disabled", timeout: 15_000 });
      if (bytes.length > maximumBytes) throw Error("Peer screenshot exceeds authorized envelope");
      await recheck();
      captured.push({ viewport, bytes, width, height });
    } finally { await context.close(); }
  }
  return { captured, limitations: [...failures].map(type => "Some public " + type + " resources could not be retrieved") };
}
