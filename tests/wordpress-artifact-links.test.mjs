import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { portableDependencyLink } from "../scripts/wordpress-artifact-links.mjs";

test("artifact dependency links relocate only exact locked installed package roots", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wp-artifact-links-"));
  try {
    const modules = path.join(root, "node_modules");
    const generated = path.join(root, ".next/node_modules");
    await mkdir(path.join(modules, "example"), { recursive: true });
    await mkdir(generated, { recursive: true });
    await writeFile(path.join(modules, "example/package.json"), '{"version":"1.0.0"}');
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ packages: {
      "node_modules/example": { version: "1.0.0", integrity: "sha512-test" },
    } }));
    const link = path.join(".next", "node_modules", "example-hash");
    await symlink(path.join(modules, "example"), path.join(root, link), "junction");
    const destination = path.join(root, "relocated");
    assert.equal(await portableDependencyLink(root, link, destination), path.join("..", "..", "node_modules", "example"));
    await assert.rejects(portableDependencyLink(root, "public/link", destination), /Unexpected artifact symlink/);
    await writeFile(path.join(modules, "example/package.json"), '{"version":"2.0.0"}');
    await assert.rejects(portableDependencyLink(root, link, destination), /differs from lockfile/);
    await writeFile(path.join(root, "package-lock.json"), '{"packages":{}}');
    await assert.rejects(portableDependencyLink(root, link, destination), /locked registry package root/);
    const outside = path.join(root, "outside");
    await mkdir(outside);
    await symlink(outside, path.join(generated, "escape"), "junction");
    await assert.rejects(portableDependencyLink(root, path.join(".next", "node_modules", "escape"), destination), /escapes node_modules/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
