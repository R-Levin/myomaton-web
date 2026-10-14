import { Pool } from "pg";
import { deploymentSelection } from "@/lib/platform/managed-sites/deployment";
import { developmentGuard } from "@/lib/platform/contact/boundaries";
import { intakeEnabled } from "@/lib/platform/intake/availability";
import { intakeHttp, localBrowserRequest } from "@/lib/platform/intake/http";
import { IntakeService } from "@/lib/platform/intake/service";
import { intakeStorageSchema } from "@/lib/platform/intake/storage";

export const runtime = "nodejs";
const abuse = developmentGuard(100);
let pool: Pool | undefined;
async function handle(request: Request) {
  const selection = deploymentSelection();
  if (!intakeEnabled(selection)) return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try { intakeStorageSchema(process.env.INTAKE_DATABASE_URL!); }
  catch { return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  pool ??= new Pool({ connectionString: process.env.INTAKE_DATABASE_URL, max: 4 });
  return intakeHttp(localBrowserRequest(request), new IntakeService(pool, selection), abuse, true);
}
export const GET = handle;
export const POST = handle;
