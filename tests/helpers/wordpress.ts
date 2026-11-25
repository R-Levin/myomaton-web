import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readOperatorSiteConfig } from "../../lib/platform/wordpress-delivery/operator-review";

/** A local WordPress review site as the delivery plugin runs it (PHP), with Core's signed delivery configuration. */
export async function localWordPress(root: string, account: { webPresenceId: string; managedSiteId: string }) {
  const php = process.platform === "win32" ? "C:/php/php.exe" : "php";
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await writeFile(join(root, "wordmark.png"), png);
  const config = readOperatorSiteConfig({ name: "local", origin: "https://operator.example.test", gate: { user: "gate", password: "fixture-only" },
    organizationId: randomUUID(), installationId: randomUUID(), streamId: randomUUID(), keyId: "local-key",
    signingKeyPkcs8Base64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKeyBase64: Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64"), receiptSecretHex: "cd".repeat(32),
    logo: { assetId: randomUUID(), usageId: randomUUID(), alt: "Wordmark", file: join(root, "wordmark.png"), sha256: createHash("sha256").update(png).digest("hex") } });
  const site = { store: join(root, "wordpress.bin"), identity: { organizationId: config.organizationId, ...account, installationId: config.installationId,
    keyId: config.keyId, publicKeyBase64: config.publicKeyBase64, deliveryUser: "core-delivery" },
    pull: { secretHex: config.receiptSecretHex, identity: { installationId: config.installationId } } };
  const wordpress = (input: object) => {
    const result = spawnSync(php, ["-d", "serialize_precision=17", "wordpress/miopages-delivery/tests/review-draft-writer.php"], { input: JSON.stringify({ ...site, ...input }), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr + result.stdout.slice(0, 400));
    return JSON.parse(result.stdout);
  };
  const fetcher = (async (url: URL, init: RequestInit) => {
    const route = new URL(url).searchParams.get("rest_route");
    const out = route === "/miopages/v1/draft" ? wordpress({ mode: "endpoint", wires: [init.body] }) : route === "/miopages/v1/readback" ? wordpress({ mode: "readback", request: init.body }) : null;
    assert.ok(out, "Unexpected WordPress route " + route);
    return new Response(JSON.stringify(out.responses[0].body), { status: out.responses[0].status });
  }) as unknown as typeof fetch;
  return { config, wordpress, fetcher };
}
