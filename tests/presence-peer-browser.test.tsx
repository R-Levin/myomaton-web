import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { capturePublicPeer } from "../lib/platform/intake/presence-peer-browser";

test("Core captures actual desktop/mobile pixels through a clean read-only browser context", async () => {
  const browser = await chromium.launch({ executablePath: process.env.MIOPAGES_RESEARCH_CHROMIUM ??
    (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined), headless: true });
  let unsafeCalls = 0;
  try {
    const html = Buffer.from('<!doctype html><html><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#fbf7ef;color:#322f7e}main{display:grid;grid-template-columns:2fr 1fr;gap:30px}h1{font-size:42px}@media(max-width:680px){main{display:block}}</style><main><h1>Independent fixture</h1><p>Only a synthetic browser integration.</p></main><script>fetch("https://private.invalid/write",{method:"POST"});new WebSocket("wss://private.invalid/ws")</script></html>');
    const result = await capturePublicPeer(browser, { id: "research:fixture", url: "https://example.org/", label: "Fixture" },
      html, async () => { unsafeCalls++; throw Error("Unexpected network request"); }, async () => {}, 4_000_000);
    assert.deepEqual(result.captured.map(row => row.viewport), ["desktop", "mobile"]);
    assert.equal(unsafeCalls, 0);
    for (const row of result.captured) {
      const metadata = await sharp(row.bytes).metadata();
      assert.equal(metadata.format, "png");
      assert.equal(metadata.width, row.width);
      assert.ok((metadata.height ?? 0) >= row.height);
    }
    assert.notDeepEqual(result.captured[0].bytes, result.captured[1].bytes);
  } finally { await browser.close(); }
});
