import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readOperatorSiteConfig } from "../lib/platform/wordpress-delivery/operator-review";
import { enrolReviewSite } from "../scripts/wordpress-enrol-review-site";

test("enrolment creates matching Core and WordPress settings; WordPress gets no signing key and the gate login stays off the command line", async () => {
  const dir = await mkdtemp(join(tmpdir(), "miopages-enrol-"));
  try {
    const logo = join(dir, "wordmark.png");
    await writeFile(logo, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const result = await enrolReviewSite([dir, "fixture-site", "https://operator.example.test", ids[0], ids[1], ids[2], "core-delivery",
      logo, ids[3], ids[4], "Fixture wordmark"], { MIOPAGES_SITE_GATE_USER: "gate", MIOPAGES_SITE_GATE_PASSWORD: "fixture-only" });
    const core = readOperatorSiteConfig(JSON.parse(await readFile(join(dir, "fixture-site.json"), "utf8")));
    assert.equal(core.installationId, result.installationId);
    assert.deepEqual(core.gate, { user: "gate", password: "fixture-only" });
    const wordpress = await readFile(join(dir, "fixture-site-wordpress-config.php"), "utf8");
    assert.ok(!wordpress.includes(core.signingKeyPkcs8Base64), "WordPress never receives Core's signing key");
    assert.ok(!wordpress.includes("fixture-only"), "WordPress settings carry no gate login");
    assert.ok(!JSON.stringify(result).includes(core.receiptSecretHex), "Printed output carries no secret");
    const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["-r",
      "require $argv[1]; echo json_encode([MIOPAGES_NATIVE_DRAFT_IDENTITY, MIOPAGES_PRIVATE_PULL]);", join(dir, "fixture-site-wordpress-config.php")],
      { encoding: "utf8" });
    assert.equal(php.status, 0, php.stderr);
    const [identity, pull] = JSON.parse(php.stdout);
    assert.deepEqual(identity, { organizationId: ids[0], webPresenceId: ids[1], managedSiteId: ids[2], installationId: core.installationId,
      keyId: core.keyId, publicKeyBase64: core.publicKeyBase64, deliveryUser: "core-delivery" });
    assert.equal(pull.secretHex, core.receiptSecretHex);
    await assert.rejects(enrolReviewSite([dir, "fixture-site", "https://operator.example.test", ids[0], ids[1], ids[2], "core-delivery",
      logo, ids[3], ids[4], "Fixture wordmark"], {}), /EEXIST/, "Existing credentials are never overwritten");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
