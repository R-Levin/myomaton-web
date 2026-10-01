import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { assetRoot } from "../lib/platform/assets/local-storage";
import { requireAssetUuid } from "../lib/platform/assets/model";
import { bootstrapMyomatonPhoto } from "./customer-bootstrap/myomaton-photo";

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: "string" }, "asset-id": { type: "string" }, name: { type: "string" }, alt: { type: "string" },
  }, strict: true, allowPositionals: false });
  if (!values.file || !values["asset-id"] || !values.name?.trim() || !values.alt?.trim()) {
    throw new Error("Required: --file <JPEG/PNG/WebP/SVG> --asset-id <stable UUID> --name <name> --alt <approved descriptive text>");
  }
  requireAssetUuid(values["asset-id"]);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await bootstrapMyomatonPhoto(drizzle({ client: pool }), {
      file: values.file, assetId: values["asset-id"], name: values.name, altText: values.alt, root: assetRoot(),
    });
    console.log(`${result.created ? "Attached" : "Already associated; unchanged"}: ${result.assetId}`);
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Photo bootstrap failed."); process.exitCode = 1; });
