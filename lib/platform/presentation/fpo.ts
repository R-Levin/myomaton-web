import { exact, plain } from "./content";
export const fpoRoles = ["service-illustration", "process-relationship", "review-artifact", "evidence-project", "explanatory-visual"] as const;
export const assetSources = ["customer-owned", "existing-site-reuse", "customer-photography", "commissioned-photography", "licensed-stock", "generated-illustrated", "optional-remove"] as const;
export type Fpo = { version: 1; role: typeof fpoRoles[number]; importance: "important" | "optional"; aspect: "landscape-3:2" | "wide-5:2" | "portrait-4:5"; purpose: string; source: typeof assetSources[number]; permission: "unresolved" };
export function validateFpo(value: unknown): Fpo {
  const v = exact(value, ["version", "role", "importance", "aspect", "purpose", "source", "permission"]);
  if (v.version !== 1 || !fpoRoles.includes(v.role as never) || !["important", "optional"].includes(String(v.importance)) || !["landscape-3:2", "wide-5:2", "portrait-4:5"].includes(String(v.aspect)) || !assetSources.includes(v.source as never) || v.permission !== "unresolved") throw Error("Unsupported preview FPO");
  return { ...v, purpose: plain(v.purpose, 350) } as Fpo;
}
// Configuration cannot authorize publication. Only an operator-created, read-only
// disposable schema can activate FPO. Real schemas and ordinary deployment fail closed.
export function disposablePreviewEnabled(env: Record<string, string | undefined>): boolean {
  const schema = env.PRESENTATION_PREVIEW_SCHEMA;
  if (!schema || !/^canonical_test_[a-f0-9]{32}_preview$/.test(schema)) return false;
  try { const options = new URL(env.DATABASE_URL ?? "").searchParams.get("options"); return options === `-c search_path=${schema} -c default_transaction_read_only=on`; } catch { return false; }
}
export function resolveFpo(value: unknown, preview: boolean): Fpo | null {
  if (!preview) return null;
  try { return validateFpo(value); } catch { return null; }
}
