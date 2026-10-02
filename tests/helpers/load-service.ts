import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget, JsxEmit } from "typescript";

// Exercise real service code and Drizzle row mapping with an in-memory driver.
export function loadService(file: string, dependencies: Record<string, unknown>) {
  const compiled = transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2017, jsx: JsxEmit.ReactJSX },
  });
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled.outputText)((name: string) => {
    if (name === "server-only") return {};
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}
