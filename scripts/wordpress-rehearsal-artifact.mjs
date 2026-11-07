// CI only: exercise and package a Linux build. No hosted credentials or deploy.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readdir, readFile, readlink, rm, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { portableDependencyLink } from "./wordpress-artifact-links.mjs";
import { request, routingSmoke } from "./wordpress-routing-smoke.mjs";

assert.equal(process.platform, "linux", "Build the rehearsal artifact on Linux, never on the hosted server");
assert.equal(process.arch, "x64");
assert.equal(process.versions.node.split(".")[0], "22");
// Refuse ambient dotenv files, even if ignored by Git.
assert.equal((await readdir(".")).some(name => name.startsWith(".env")), false, "Clean CI checkout required");
const origin = "https://rehearsal.example.test";

async function smoke(directory) {
// Explicit environment: importantly no DATABASE_URL, operator credentials or signer.
const compiled = JSON.parse(await readFile(path.join(directory, '.next/required-server-files.json'), 'utf8')).config;
assert.equal(compiled.skipTrailingSlashRedirect, true);
assert.equal(compiled.skipProxyUrlNormalize, true);
const child = spawn(process.execPath, ["--max-old-space-size=256", path.join(directory, '.rehearsal/private-server.cjs')], {
  cwd: directory,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    MIOPAGES_ROUTING_MODE: "shared-hostnames",
    MIOPAGES_WP_PRIVATE_STAGE: "enabled", MIOPAGES_WP_CORE_ORIGIN: origin,
    MIOPAGES_WP_PULL_URL: "postgresql://miopages_wp_pull:build-only@127.0.0.1:1/build_only?sslmode=verify-full" },
  stdio: "ignore",
});
const exited = new Promise(resolve => child.once("exit", resolve));
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error("Isolated Next runtime exited before readiness");
    try { ready = (await request(8081, origin, "/", "GET")).status === 404; } catch { /* booting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Isolated runtime readiness without DATABASE_URL");
  return await routingSmoke(8081, origin);
} finally {
  child.kill("SIGTERM");
  const stopped = await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))]);
  if (!stopped) { child.kill("SIGKILL"); await exited; }
}
}

const output = "runtime-content/wordpress-rehearsal-artifact";
const staging = path.join(output, "application");
await mkdir(output, { recursive: true });
// Only this fixed generated staging directory may be replaced.
await rm(staging, { recursive: true, force: true });
await mkdir(staging);
const hashes = {};
const links = {};
async function copyEntry(source, relative = source) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) {
    const portable = await portableDependencyLink(process.cwd(), relative, staging);
    await symlink(portable, path.join(staging, relative));
    links[relative] = portable;
    return;
  }
  if (relative === ".next/cache") return;
  if (info.isDirectory()) {
    await mkdir(path.join(staging, relative), { recursive: true });
    for (const name of (await readdir(source)).sort()) await copyEntry(path.join(source, name), path.join(relative, name));
  } else {
    assert.ok(info.isFile(), "Regular artifact files only");
    await cp(source, path.join(staging, relative));
    hashes[relative] = createHash("sha256").update(await readFile(source)).digest("hex");
  }
}
for (const item of [".next", "public", "package.json", "package-lock.json", "next.config.ts"]) await copyEntry(item);
await mkdir(path.join(staging, '.rehearsal'));
await cp('scripts/wordpress-private-server.cjs', path.join(staging, '.rehearsal/private-server.cjs'));
hashes['.rehearsal/private-server.cjs'] = createHash('sha256').update(await readFile('scripts/wordpress-private-server.cjs')).digest('hex');
// Emulate npm ci at the destination, then test the relocated bytes and rewritten
// links. This temporary dependency link is removed before creating the archive.
await symlink(path.resolve("node_modules"), path.join(staging, "node_modules"), "dir");
let routingSmokeResult;
try { routingSmokeResult = await smoke(path.resolve(staging)); }
finally { await unlink(path.join(staging, "node_modules")); }
for (const [file, digest] of Object.entries(hashes)) {
  assert.equal(createHash("sha256").update(await readFile(path.join(staging, file))).digest("hex"), digest, "Smoke changed packaged file: " + file);
}
for (const [file, target] of Object.entries(links)) assert.equal(await readlink(path.join(staging, file)), target);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.match(sourceCommit, /^[a-f0-9]{40}$/);
const manifest = { sourceCommit, node: process.version, platform: process.platform, arch: process.arch,
  isolatedRuntimeSmoke: "PASS", normalCoreDatabaseCredential: false, privateRoutingBuild: true,
  entrypoint: '.rehearsal/private-server.cjs', routingSmoke: routingSmokeResult, files: hashes, symlinks: links };
await writeFile(path.join(staging, "rehearsal-build.json"), JSON.stringify(manifest, null, 2) + "\n");
const archive = path.join(output, "wordpress-rehearsal-linux-x64.tar.gz");
execFileSync("tar", ["--exclude=./.next/cache", "-czf", archive, "-C", staging, "."]);
const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
await writeFile(archive + ".sha256", sha256 + "  " + path.basename(archive) + "\n");
await writeFile(path.join(output, "rehearsal-build.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ status: "PASS", sourceCommit, isolatedRuntimeSmoke: true, sha256, hostedChanges: 0 }));
