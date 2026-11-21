// CI only: exercise and package a Linux build. No hosted credentials or deploy.
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readdir, readFile, readlink, rm, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { portableDependencyLink } from "./wordpress-artifact-links.mjs";
import { request, routingSmoke } from "./wordpress-routing-smoke.mjs";
import launcher from "./wordpress-private-listener.cjs";

assert.equal(process.platform, "linux", "Build the rehearsal artifact on Linux, never on the hosted server");
assert.equal(process.arch, "x64");
assert.equal(process.versions.node.split(".")[0], "22");
// Refuse ambient dotenv files, even if ignored by Git.
assert.equal((await readdir(".")).some(name => name.startsWith(".env")), false, "Clean CI checkout required");
const core = process.env.MIOPAGES_PROTECTED_CORE === "enabled";
const origin = core ? "https://wp-acceptance.miopages.com" : "https://rehearsal.example.test";

async function smoke(directory) {
// Explicit environment: importantly no DATABASE_URL, operator credentials or signer.
const compiled = JSON.parse(await readFile(path.join(directory, '.next/required-server-files.json'), 'utf8')).config;
assert.equal(compiled.skipTrailingSlashRedirect, true);
assert.equal(compiled.skipProxyUrlNormalize, true);
const child = spawn(process.execPath, [...launcher.runtimeOptions(core), path.join(directory, '.rehearsal/private-server.cjs')], {
  cwd: directory,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    MIOPAGES_ROUTING_MODE: "shared-hostnames",
    ...(core ? { MIOPAGES_PROTECTED_CORE: "enabled", MIOPAGES_PROTECTED_CORE_ORIGIN: origin } : {
      MIOPAGES_WP_PRIVATE_STAGE: "enabled", MIOPAGES_WP_CORE_ORIGIN: origin,
      MIOPAGES_WP_PULL_URL: "postgresql://miopages_wp_pull:build-only@127.0.0.1:1/build_only?sslmode=verify-full",
    }) },
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
  if (!core) return await routingSmoke(8081, origin);
  assert.equal((await request(8081, origin, "/core", "GET")).status, 200);
  const api = await request(8081, origin, "/api/protected-core", "GET", { "x-intake-request": "1" });
  assert.equal(api.status, 401);
  assert.equal(api.headers["cache-control"], "no-store");
  const canonical = await request(8081, origin, "/core/", "GET");
  assert.equal(canonical.status, 307);
  assert.equal(canonical.headers.location, "/core");
  assert.equal(canonical.headers["cache-control"], "no-store");
  for (const target of ["/core/?x=1", "/core?x=1", "/api/protected-core/", "/api/contact", "/_next/static/../core"]) {
    const response = await request(8081, origin, target, "GET");
    assert.equal(response.status, 404);
    assert.equal(response.headers["cache-control"], "no-store");
  }
  return { checks: 8, anonymousApi: 401, shell: 200, slashRedirect: 307 };
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
const protectedCommands = [];
if (core) {
  const launcher = '.rehearsal/private-listener.cjs';
  await cp('scripts/wordpress-private-listener.cjs', path.join(staging, launcher));
  hashes[launcher] = createHash('sha256').update(await readFile(path.join(staging, launcher))).digest('hex');
  for (const [source, target] of [
    ['scripts/core-native-preview.php', 'core-native-preview.php'],
    ['wordpress/miopages-delivery/includes/class-miopages-native-component.php', 'class-miopages-native-component.php'],
    ['wordpress/miopages-delivery/includes/class-miopages-native-draft-content.php', 'class-miopages-native-draft-content.php'],
    ['wordpress/miopages-managed-site/style.css', 'managed-site.css'],
  ]) {
    const relative = path.join('.rehearsal', target);
    await cp(source, path.join(staging, relative));
    hashes[relative] = createHash('sha256').update(await readFile(source)).digest('hex');
  }
  const previewInput = { candidate: { pages: [
    { path: '/', title: 'Controlled Home', sections: [{ type: 'intro', content: { heading: '<script>escaped</script>', text: 'Controlled renderer check' } }] },
    { path: '/service', title: 'Controlled Service', sections: [{ type: 'intro', content: { heading: 'Service', text: 'Controlled renderer check' } }] },
  ], navigation: ['/', '/service'], actions: [{ from: '/', destination: '/service', type: 'page', label: 'Explore service' }] }, unresolvedActions: [], path: '/' };
  const nativePreview = input => spawnSync('php', [path.resolve(staging, '.rehearsal/core-native-preview.php')], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 10_000,
    env: { PATH: process.env.PATH, LANG: 'C.UTF-8' },
  });
  const rendered = nativePreview(previewInput);
  assert.equal(rendered.status, 0, 'Packaged native PHP renderer must run on Linux');
  assert.match(rendered.stdout, /&lt;script&gt;escaped&lt;\/script&gt;/u);
  assert.match(rendered.stdout, /page_id=2&amp;preview=true/u);
  for (const refused of [{ ...previewInput, path: '/foreign' }, { ...previewInput, extra: true }]) {
    const result = nativePreview(refused);
    assert.equal(result.status, 2); assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Native preview validation failed.');
  }
  for (const [source, executable] of [
    ["scripts/intake/protected-presence-worker.ts", "protected-presence-worker.cjs"],
    ["scripts/wordpress-private-operator.ts", "wordpress-private-operator.cjs"],
    ["scripts/intake/run-presence-evaluation.ts", "presence-evaluation-worker.cjs"],
  ]) {
    const relative = path.join(".rehearsal", executable);
    const outfile = path.join(staging, relative);
    await build({ entryPoints: [source], outfile, bundle: true, packages: "external",
      format: "cjs", platform: "node", target: "node22", jsx: "automatic" });
    protectedCommands.push(relative);
    hashes[relative] = createHash("sha256").update(await readFile(outfile)).digest("hex");
  }
  await copyEntry("lib/platform/db/migrations");
  for (const file of ["lib/platform/intake/presence-workflow.sql", "lib/platform/intake/protected-presence-workflow-policy.sql",
    "docs/presence-evaluation-activation.json",
    "docs/miopages-c0-business-brief.md", "docs/c0-discovery-question-recovery-audit.md", "docs/miopages-c0-product-model.md"]) {
    await mkdir(path.dirname(path.join(staging, file)), { recursive: true });
    await copyEntry(file);
  }
}
// Emulate npm ci at the destination, then test the relocated bytes and rewritten
// links. This temporary dependency link is removed before creating the archive.
await symlink(path.resolve("node_modules"), path.join(staging, "node_modules"), "dir");
let routingSmokeResult;
try {
  routingSmokeResult = await smoke(path.resolve(staging));
  for (const [index, command] of protectedCommands.entries()) {
    const result = spawnSync(process.execPath, [command, "INVALID"], { cwd: staging, input: "",
      encoding: "utf8", timeout: 10_000, env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production" } });
    assert.equal(result.status, 1, "Packaged protected entry must fail safely without configuration");
    assert.match(result.stderr, index === 1 ? /Protected command refused/u : /"status":"BLOCKED"/u);
    assert.equal(result.stdout, "");
  }
}
finally { await unlink(path.join(staging, "node_modules")); }
for (const [file, digest] of Object.entries(hashes)) {
  assert.equal(createHash("sha256").update(await readFile(path.join(staging, file))).digest("hex"), digest, "Smoke changed packaged file: " + file);
}
for (const [file, target] of Object.entries(links)) assert.equal(await readlink(path.join(staging, file)), target);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.match(sourceCommit, /^[a-f0-9]{40}$/);
const manifest = { sourceCommit, node: process.version, platform: process.platform, arch: process.arch,
  isolatedRuntimeSmoke: "PASS", normalCoreDatabaseCredential: false, privateRoutingBuild: true,
  entrypoint: '.rehearsal/private-server.cjs', routingSmoke: routingSmokeResult, files: hashes, symlinks: links,
  ...(core && { protectedCommands, unconfiguredCommandsRefused: true, nativePreviewSmoke: 'PASS' }) };
await writeFile(path.join(staging, "rehearsal-build.json"), JSON.stringify(manifest, null, 2) + "\n");
const archive = path.join(output, core ? "protected-core-linux-x64.tar.gz" : "wordpress-rehearsal-linux-x64.tar.gz");
execFileSync("tar", ["--exclude=./.next/cache", "-czf", archive, "-C", staging, "."]);
const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
await writeFile(archive + ".sha256", sha256 + "  " + path.basename(archive) + "\n");
await writeFile(path.join(output, "rehearsal-build.json"), JSON.stringify(manifest, null, 2) + "\n");
let wordpressPlugin;
if (core) {
  const plugin = "miopages-delivery";
  const files = execFileSync("git", ["ls-tree", "-r", "--name-only", sourceCommit, "wordpress/" + plugin], { encoding: "utf8" })
    .trim().split("\n").filter(file => !file.startsWith("wordpress/" + plugin + "/tests/"))
    .map(file => file.slice("wordpress/".length));
  assert.ok(files.includes(plugin + "/miopages-delivery.php"));
  const zip = path.resolve(output, "miopages-delivery-development.zip");
  execFileSync("zip", ["-X", "-q", zip, ...files], { cwd: "wordpress" });
  wordpressPlugin = createHash("sha256").update(await readFile(zip)).digest("hex");
  await writeFile(zip + ".sha256", wordpressPlugin + "  " + path.basename(zip) + "\n");
}
console.log(JSON.stringify({ status: "PASS", sourceCommit, isolatedRuntimeSmoke: true, sha256, wordpressPlugin,
  protectedCommands: protectedCommands.length, hostedChanges: 0 }));
