import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { privateStageIngress } from "../lib/platform/wordpress-delivery/ingress";

test("isolated listener denies all but exact delivery POSTs; normal Core remains unchanged", async () => {
  const previous = process.env.MIOPAGES_WP_PRIVATE_STAGE;
  try {
    delete process.env.MIOPAGES_WP_PRIVATE_STAGE;
    assert.equal(proxy(new NextRequest("https://rehearsal.example.test/" )).headers.get("x-middleware-next"), "1");
    process.env.MIOPAGES_WP_PRIVATE_STAGE = "enabled";
    for (const path of ["/", "/intake", "/api/contact", "/favicon.ico", "/_next/static/test.js", "/_next/image?url=x", "/api/wordpress-delivery/pull/", "/api/wordpress-delivery/other", "/api/wordpress-delivery/pull?x=1"]) {
      for (const method of ["GET", "HEAD", "POST", "OPTIONS", "PUT", "DELETE"]) {
        const response = proxy(new NextRequest("https://rehearsal.example.test" + path, { method }));
        assert.equal(response.status, 404, method + " " + path);
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
    }
    for (const operation of ["pull", "receipt"]) {
      const url = "https://rehearsal.example.test/api/wordpress-delivery/" + operation;
      assert.equal(proxy(new NextRequest(url, { method: "POST" })).headers.get("x-middleware-next"), "1");
      for (const method of ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]) {
        assert.equal(proxy(new NextRequest(url, { method })).status, 404);
      }
      const wrongHost = new NextRequest(url, { method: "POST", headers: { host: "wrong.example.test" } });
      assert.equal(proxy(wrongHost).headers.get("x-middleware-next"), "1");
      assert.equal(await privateStageIngress(wrongHost, "https://rehearsal.example.test"), null);
    }
  } finally {
    if (previous === undefined) delete process.env.MIOPAGES_WP_PRIVATE_STAGE;
    else process.env.MIOPAGES_WP_PRIVATE_STAGE = previous;
  }
});
