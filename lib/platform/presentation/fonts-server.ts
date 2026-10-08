import { existsSync } from "node:fs";
import path from "node:path";
import { sourceEditorial } from "./fonts";
export function fontDiagnostics() {
  return sourceEditorial.resources.flatMap(resource => existsSync(path.join(process.cwd(), "public", resource.path)) ? [] : [`Missing curated font resource: ${resource.id}; deterministic fallback active`]);
}
