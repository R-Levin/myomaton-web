import { Pool } from "pg";
import { deploymentSelection } from "@/lib/platform/managed-sites/deployment";
import { UnavailableHostname } from "@/lib/platform/managed-sites/hostname";
import { developmentGuard } from "@/lib/platform/contact/boundaries";
import { intakeEnabled } from "@/lib/platform/intake/availability";
import { intakeHttp, localBrowserRequest } from "@/lib/platform/intake/http";
import { IntakeService } from "@/lib/platform/intake/service";
import { intakeStorageSchema } from "@/lib/platform/intake/storage";

export const runtime = "nodejs";
const abuse = developmentGuard(100);
let pool: Pool | undefined;
async function handle(request: Request) {
  const selection = process.env.MIOPAGES_ROUTING_MODE === "shared-hostnames"
    ? await (await import("@/lib/platform/managed-sites/context")).deploymentContext().catch(error => { if (error instanceof UnavailableHostname) return null; throw error; })
    : deploymentSelection();
  if (!selection) return Response.json({ error: "unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!intakeEnabled(selection)) return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try { intakeStorageSchema(process.env.INTAKE_DATABASE_URL!, process.env, selection); }
  catch { return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  pool ??= new Pool({ connectionString: process.env.INTAKE_DATABASE_URL, max: 4 });
  return intakeHttp(localBrowserRequest(request), new IntakeService(pool, selection), abuse, true, process.env.MIOPAGES_REVIEW_INTAKE === "shared-development");
}
export const GET = handle;
export const POST = handle;
