/**
 * Enrol an Operator WordPress site for Core's review drafts and read-back
 * (docs/hosted-delivery-and-control-plan.md). Creates new credentials, so running it for
 * a real site is an owner decision; writing it is not.
 *
 * Creates, in the given private output directory (mode 0700), two files (mode 0600):
 *   <name>.json                 Core's settings: goes to the Core server at
 *                               ~/miopages-private-acceptance/wordpress-sites/<name>.json
 *   <name>-wordpress-config.php The site's settings: goes outside the WordPress web root and
 *                               is required from wp-config.php
 * Core keeps the signing key; WordPress gets only the public key. The receipt key is shared.
 *
 * Usage (on the Core server):
 *   MIOPAGES_SITE_GATE_USER=… MIOPAGES_SITE_GATE_PASSWORD=… npx tsx scripts/wordpress-enrol-review-site.ts \
 *     <out-dir> <name> <origin> <organizationId> <webPresenceId> <managedSiteId> <deliveryUser> \
 *     <logo.png> <logoAssetId> <logoUsageId> <logoAlt>
 * The gate login is read from the environment, never from the command line.
 */
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { readOperatorSiteConfig } from "../lib/platform/wordpress-delivery/operator-review";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const php = (value: string) => "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";

async function writePrivate(file: string, text: string) {
  const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
}

export async function enrolReviewSite(args: string[], env: Record<string, string | undefined>) {
  const [out, name, origin, organizationId, webPresenceId, managedSiteId, deliveryUser, logoFile, logoAssetId, logoUsageId, logoAlt, ...extra] = args;
  if (extra.length || !logoAlt) throw Error("Usage: see the header of scripts/wordpress-enrol-review-site.ts");
  if (![organizationId, webPresenceId, managedSiteId, logoAssetId, logoUsageId].every(id => uuid.test(id))) throw Error("Identifiers must be UUIDs");
  if (!/^[a-zA-Z0-9._-]{1,60}$/u.test(deliveryUser)) throw Error("WordPress delivery account name refused");
  const directory = await realpath(out);
  const status = await lstat(directory);
  // Windows has no Unix permission bits; the Core server (Linux) enforces 0700.
  if (!status.isDirectory() || (process.platform !== "win32" && (status.mode & 0o077) !== 0) || directory.includes("public_html")) throw Error("Private output directory (0700, outside web roots) required");
  if (!isAbsolute(logoFile)) throw Error("Absolute wordmark path required");
  const png = await readFile(logoFile);
  if (!png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) throw Error("Wordmark must be a PNG");
  // MIOPAGES_SITE_GATE_PASSWORD=generate: Core gets its own random gate login; only its
  // Apache hash leaves this machine (<name>-gate-htpasswd-line.txt, for the site's password file).
  const generated = env.MIOPAGES_SITE_GATE_PASSWORD === "generate";
  if (env.MIOPAGES_SITE_GATE_USER && !/^[a-zA-Z0-9._-]{1,60}$/u.test(env.MIOPAGES_SITE_GATE_USER)) throw Error("Gate user name refused");
  const gate = env.MIOPAGES_SITE_GATE_USER ? { user: env.MIOPAGES_SITE_GATE_USER,
    password: generated ? randomBytes(24).toString("hex") : env.MIOPAGES_SITE_GATE_PASSWORD ?? "" } : undefined;
  let gateLine: string | undefined;
  if (gate && generated) {
    const hashed = spawnSync("openssl", ["passwd", "-apr1", "-stdin"], { input: gate.password + "\n", encoding: "utf8" });
    if (hashed.status !== 0 || !/^\$apr1\$[./0-9A-Za-z]{1,8}\$[./0-9A-Za-z]{22}$/u.test(hashed.stdout.trim())) throw Error("Gate login hash unavailable");
    gateLine = gate.user + ":" + hashed.stdout.trim() + "\n";
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const config = readOperatorSiteConfig({
    name, origin, ...(gate && { gate }), organizationId, installationId: randomUUID(), streamId: randomUUID(), keyId: "review-" + name,
    signingKeyPkcs8Base64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKeyBase64: Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64"),
    receiptSecretHex: randomBytes(32).toString("hex"),
    logo: { assetId: logoAssetId, usageId: logoUsageId, alt: logoAlt, file: logoFile, sha256: createHash("sha256").update(png).digest("hex") },
  });
  const identity = { organizationId, webPresenceId, managedSiteId, installationId: config.installationId, keyId: config.keyId,
    publicKeyBase64: config.publicKeyBase64, deliveryUser };
  const wordpress = `<?php
// MioPages review drafts and read-back for ${name} (${origin}). Created ${new Date().toISOString()}.
// Private: keep outside the web root, mode 0600; require from wp-config.php. Core holds the signing key.
define('MIOPAGES_NATIVE_DRAFT_IDENTITY', [${Object.entries(identity).map(([key, value]) => php(key) + " => " + php(value)).join(", ")}]);
define('MIOPAGES_PRIVATE_PULL', ['secretHex' => ${php(config.receiptSecretHex)}, 'identity' => ['installationId' => ${php(config.installationId)}]${env.MIOPAGES_DOCUMENT_ROOT ? ", 'documentRoot' => " + php(env.MIOPAGES_DOCUMENT_ROOT) : ""}]);
${env.MIOPAGES_DRAFT_MEDIA_DIRECTORY ? "define('MIOPAGES_NATIVE_DRAFT_MEDIA_DIRECTORY', " + php(env.MIOPAGES_DRAFT_MEDIA_DIRECTORY) + ");\n" : ""}`;
  await writePrivate(join(directory, name + ".json"), JSON.stringify(config, null, 2) + "\n");
  await writePrivate(join(directory, name + "-wordpress-config.php"), wordpress);
  if (gateLine) await writePrivate(join(directory, name + "-gate-htpasswd-line.txt"), gateLine);
  // Only non-secret identifiers are printed.
  return { name, origin, installationId: config.installationId, streamId: config.streamId, keyId: config.keyId,
    files: [name + ".json", name + "-wordpress-config.php", ...(gateLine ? [name + "-gate-htpasswd-line.txt"] : [])] };
}

if (/(wordpress-enrol-review-site\.ts|enrol-review-site\.cjs)$/u.test(process.argv[1] ?? "")) {
  enrolReviewSite(process.argv.slice(2), process.env).then(result => console.log(JSON.stringify(result)))
    .catch((error: Error) => {
      console.error(JSON.stringify({ status: "BLOCKED", detail: /^[A-Za-z0-9 ,.;:'()/-]{1,200}$/u.test(error.message) ? error.message : "Enrolment refused" }));
      process.exitCode = 1;
    });
}
