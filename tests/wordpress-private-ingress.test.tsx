import assert from "node:assert/strict";
import test from "node:test";
import { privateStageIngress } from "../lib/platform/wordpress-delivery/ingress";

const origin = "https://rehearsal.example.test";
const path = "/api/wordpress-delivery/pull";
const proxy = { host: "rehearsal.example.test", "x-forwarded-proto": "https" };

test("private stage accepts a bodyless HTTPS POST from the protected reverse proxy", async () => {
  const empty = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  const input = new Request("https://localhost:8080" + path, {
    method: "POST", headers: { ...proxy, "content-length": "0", "x-miopages-mac": "fixture" },
    body: empty, duplex: "half",
  } as RequestInit);
  const normalized = await privateStageIngress(input, origin);
  assert.equal(normalized?.url, origin + path);
  assert.equal(normalized?.headers.get("x-miopages-mac"), "fixture");
  assert.equal(normalized?.body, null);
});

test("private stage refuses wrong origins, proxy metadata, paths and request bodies", async () => {
  for (const [url, headers] of [
    ["https://localhost:8080" + path, {}],
    ["http://localhost:8080" + path, { ...proxy, "x-forwarded-proto": "http" }],
    ["https://localhost:8080" + path, { ...proxy, "x-forwarded-proto": "https,http" }],
    [origin + path, { ...proxy, host: "foreign.example.test" }],
    [origin + path + "?x=1", proxy],
    [origin + "/api/wordpress-delivery/unknown", proxy],
    [origin + path, { ...proxy, "content-length": "1" }],
    [origin + path, { ...proxy, "transfer-encoding": "chunked" }],
  ] as const) {
    assert.equal(await privateStageIngress(new Request(url, { method: "POST", headers }), origin), null);
  }
  assert.equal(await privateStageIngress(new Request(origin + path, { method: "POST", headers: proxy, body: "x" }), origin), null);
});
