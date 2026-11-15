import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../wordpress/miopages-delivery/tests/native-draft-membership.php", import.meta.url));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const scope = { organizationId: randomUUID(), webPresenceId: randomUUID(), managedSiteId: randomUUID() };
const installationId = randomUUID(), siteProposalId = randomUUID();
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const keyId = "test-key";
const identity = { ...scope, installationId, keyId, publicKeyBase64: Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url").toString("base64") };
const section = (type, heading) => ({ id: randomUUID(), type, content: { heading, text: "Synthetic evidence for draft-only delivery." } });
const page = (path, title, sections) => ({ id: randomUUID(), path, title, sections });
const home = page("/", "Home", [section("hero", "Private presentation"), section("intro", "More context")]);
const service = page("/service", "Service", [section("intro", "Read about service")]);
const retired = page("/old", "Previous information", [section("intro", "Historical introduction")]);
const added = page("/new", "New information", [section("intro", "Current introduction")]);
const baseline = { scope, installationId, siteProposalId, revision: 1, previousDigest: null,
  pages: [home, service, retired], navigation: ["/", "/service", "/old"], actions: [] };
const original = sha(JSON.stringify(baseline));
const image = Buffer.from("UklGRjoAAABXRUJQVlA4IC4AAADQAQCdASoIAAYAAUAmJaACdLoB+AADsAD++LUX/zNDPJR5cP/SbPE2eJs+AAAA", "base64");
const copyDigest = sha(image);
const media = home.sections.map(({ id, content }) => ({ pageId: home.id, sectionId: id, assetId: randomUUID(), usageId: randomUUID(),
  masterDigest: sha("synthetic master"), evidenceDigest: sha("distinct private approval " + id), copyDigest, width: 8, height: 6,
  alt: "Test image for " + content.heading }));
const baselinePages = baseline.pages.map(({ id, path }) => ({ id, path }));
const candidate = { ...baseline, revision: 2, previousDigest: original, baselinePages, media,
  pages: [home, added, service], navigation: ["/", "/new", "/service"], actions: [{ id: randomUUID(), from: "/", destination: "/new", type: "page", label: "New Action" }] };
const changed = sha(JSON.stringify(candidate));
const next = { ...candidate, revision: 3, previousDigest: changed, rollback: { revision: 1, digest: original } };
const wrongPrior = { ...candidate, baselinePages: baselinePages.map((p, index) => index ? p : { ...p, id: randomUUID() }) };
const wrongMedia = { ...candidate, media: [media[0], { ...media[1], sectionId: media[0].sectionId }] };

function envelope(version, candidate, operation = "apply") {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ schema: "miopages.wordpress.native-draft", version, operation,
    purpose: "non-public-draft-only", issuedAt, expiresAt: issuedAt + 900,
    digest: sha(JSON.stringify(candidate)), candidate }));
  const signature = sign(null, Buffer.concat([Buffer.from("MioPages-WP-Native-Draft-v" + version + "\n"), payload]), privateKey);
  return { schema: "miopages.wordpress.native-draft-envelope", version, keyId, payloadBase64: payload.toString("base64"),
    payloadSha256: sha(payload), signatureBase64: signature.toString("base64") };
}

const apply = envelope(4, candidate);
const result = spawnSync(process.env.PHP_BINARY || "php", [path], { encoding: "utf8",
  input: JSON.stringify({ identity, original: envelope(1, baseline), apply, restore: envelope(4, candidate, "restore"),
    forward: envelope(4, next), invalidPrior: envelope(4, wrongPrior), duplicate: envelope(4, wrongMedia),
    transfer: { envelope: apply, copyDigest, bytesBase64: image.toString("base64") } }) });
assert.equal(result.status, 0, result.stderr || result.stdout);
const status = JSON.parse(result.stdout);
assert.equal(status.verified, true);
if (process.platform !== "win32") assert.equal(status.posix, true, "Linux/Unix attachment custody and rollback must run");
console.log(status.posix ? "PASS: POSIX protected media transfer, two placements, membership change, archive, readback and rollback."
  : "PASS: signed membership and multi-placement validation. POSIX attachment transactions require Linux or Unix.");
