// Packaging only. The application source is the exact separately approved commit.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, readlink, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { portableDependencyLink } from "./wordpress-artifact-links.mjs";

const approved = "62439fc0c8bde7fe98339625d33a845102a7995a";
const repository = process.cwd();
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), approved);
execFileSync("git", ["diff", "--exit-code"]);
assert.equal(process.platform, "linux");
assert.equal(process.arch, "x64");
assert.equal(process.version, "v22.23.2");
assert.equal((await readdir(repository)).some(n => n.startsWith(".env")), false);
await assert.rejects(lstat("app/api/wordpress-delivery"));
await assert.rejects(lstat("proxy.ts"));
const output = path.join(repository, "runtime-content/public-security-release");
const staging = path.join(output, "application");
await mkdir(staging, { recursive: true });
const files = {}, links = {};
const digest = data => createHash("sha256").update(data).digest("hex");
async function copy(source, relative) {
  if (relative === ".next/cache") return;
  const info = await lstat(source), destination = path.join(staging, relative);
  if (info.isSymbolicLink()) {
    let target = await readlink(source);
    if (relative.startsWith(".next/")) target = await portableDependencyLink(repository, relative, staging);
    assert.ok(!path.isAbsolute(target), "Absolute dependency link refused");
    const resolved = path.relative(staging, path.resolve(path.dirname(destination), target));
    assert.ok(resolved && !resolved.split(path.sep).includes("..") && !path.isAbsolute(resolved), "Escaping dependency link refused");
    await mkdir(path.dirname(destination), { recursive: true });
    await symlink(target, destination);
    links[relative] = target;
  } else if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const name of (await readdir(source)).sort()) await copy(path.join(source, name), path.join(relative, name));
  } else {
    assert.ok(info.isFile());
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
    files[relative] = { sha256: digest(await readFile(source)), mode: info.mode & 0o777 };
  }
}
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const name of tracked) {
  assert.ok(!name.split("/").some(part => part.startsWith(".env")));
  await copy(path.join(repository, name), name);
}
for (const name of [".next", "node_modules"]) await copy(path.join(repository, name), name);

const require = createRequire(path.join(staging, "package.json"));
const versions = Object.fromEntries(await Promise.all(["next", "sharp", "dompurify", "react", "react-dom"].map(async name =>
  [name, JSON.parse(await readFile(path.join(staging, "node_modules", name, "package.json"), "utf8")).version])));
assert.deepEqual(versions, { next: "16.4.5", sharp: "0.35.5", dompurify: "3.4.17", react: "19.2.8", "react-dom": "19.2.8" });
assert.equal(typeof require("@next/swc-linux-x64-gnu").transformSync, "function");
assert.ok((await require("sharp")({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer()).length > 0);
const { JSDOM } = require("jsdom"), window = new JSDOM("").window;
try { assert.equal(require("dompurify")(window).sanitize('<p>safe</p><script>bad()</script>'), "<p>safe</p>"); }
finally { window.close(); }

const request = (url, method = "GET") => new Promise((resolve, reject) => {
  const req = http.request({ hostname: "127.0.0.1", port: 18080, path: url, method, headers: { host: "invalid", "content-length": "0" } }, res => {
    const chunks = []; res.on("data", d => chunks.push(d));
    res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
  });
  req.setTimeout(3000, () => req.destroy(new Error("Runtime smoke timeout")));
  req.on("error", reject); req.end();
});
const child = spawn(process.execPath, [path.join(staging, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "18080"], {
  cwd: staging, stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1", MIOPAGES_ROUTING_MODE: "shared-hostnames", DATABASE_URL: "postgresql://build:unused@127.0.0.1:1/build_only" },
});
const exited = new Promise(resolve => child.once("exit", resolve));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error("Packaged runtime exited");
    try { ready = (await request("/media/assets/invalid")).status === 404; } catch { /* booting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready);
  for (const [url, method] of [["/", "GET"], ["/api/intake", "GET"], ["/api/contact", "POST"]]) assert.equal((await request(url, method)).status, 404);
  const font = "public/fonts/source-sans-3.052/regular.woff2";
  const result = await request("/" + font.slice(7));
  assert.equal(result.status, 200);
  assert.equal(digest(result.body), files[font].sha256);
} finally {
  child.kill("SIGTERM");
  if (!await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))])) { child.kill("SIGKILL"); await exited; }
}
for (const [name, info] of Object.entries(files)) assert.equal(digest(await readFile(path.join(staging, name))), info.sha256, name);
for (const [name, target] of Object.entries(links)) assert.equal(await readlink(path.join(staging, name)), target);
const manifest = { sourceCommit: approved, node: process.version, platform: process.platform, arch: process.arch,
  versions, packagedRuntimeSmoke: "PASS", nativeProbe: "PASS", hostedChanges: 0, files, symlinks: links };
await writeFile(path.join(output, "public-security-build.json"), JSON.stringify(manifest) + "\n");
await writeFile(path.join(staging, "public-security-build.json"), JSON.stringify(manifest) + "\n");
const archive = path.join(output, "public-security-62439fc-linux-x64.tar.gz");
execFileSync("tar", ["--exclude=./.next/cache", "-czf", archive, "-C", staging, "."]);
const sha256 = digest(await readFile(archive));
await writeFile(archive + ".sha256", sha256 + "  " + path.basename(archive) + "\n");
console.log(JSON.stringify({ status: "PASS", sourceCommit: approved, versions, nativeProbe: true, packagedRuntimeSmoke: true, files: Object.keys(files).length, sha256, hostedChanges: 0 }));
