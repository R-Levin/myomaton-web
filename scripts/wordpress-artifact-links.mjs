import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

// Turbopack creates package-root links in .next/node_modules. They must be
// rewritten for the destination npm ci, never copied as CI absolute paths.
export async function portableDependencyLink(repository, relative, staging) {
  assert.equal(path.dirname(relative), path.join(".next", "node_modules"), "Unexpected artifact symlink location");
  const target = await realpath(path.join(repository, relative));
  const modules = await realpath(path.join(repository, "node_modules"));
  const packagePath = path.relative(modules, target);
  assert.ok(packagePath && !packagePath.split(path.sep).includes("..") && !path.isAbsolute(packagePath), "Dependency link escapes node_modules");
  const key = "node_modules/" + packagePath.split(path.sep).join("/");
  const lock = JSON.parse(await readFile(path.join(repository, "package-lock.json"), "utf8"));
  const entry = lock.packages[key];
  assert.ok(entry?.version && entry.integrity && !entry.link, "Dependency link must name a locked registry package root");
  const installed = JSON.parse(await readFile(path.join(target, "package.json"), "utf8"));
  assert.equal(installed.version, entry.version, "Dependency link version differs from lockfile");
  return path.relative(path.dirname(path.join(staging, relative)), path.join(staging, key));
}
