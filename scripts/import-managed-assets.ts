import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { assetRoot } from "../lib/platform/assets/local-storage";
import { importManagedAssets } from "./operator-assets/import-managed-assets";

async function main() {
  const { values } = parseArgs({ options: {
    "web-presence-id": { type: "string" }, file: { type: "string", multiple: true },
    "asset-id": { type: "string", multiple: true }, name: { type: "string", multiple: true },
    alt: { type: "string", multiple: true },
  }, strict: true, allowPositionals: false });
  const files = values.file ?? [], ids = values["asset-id"] ?? [], names = values.name ?? [], alts = values.alt ?? [];
  if (!values["web-presence-id"] || !files.length || [ids, names, alts].some(list => list.length !== files.length)) {
    throw new Error("Required: --web-presence-id <UUID> and one --file, --asset-id, --name, --alt per Asset (matched by occurrence order).");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log(JSON.stringify(await importManagedAssets(drizzle({ client: pool }), {
      webPresenceId: values["web-presence-id"], root: assetRoot(),
      items: files.map((file, i) => ({ file, assetId: ids[i], name: names[i], altText: alts[i] })),
    }), null, 2));
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Asset import failed."); process.exitCode = 1; });
