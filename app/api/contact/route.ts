import { db } from "@/lib/platform/db/connection";
import { deploymentContext } from "@/lib/platform/managed-sites/context";
import { acceptContactSubmission } from "@/lib/platform/contact/submissions";
import { contactHttp } from "@/lib/platform/contact/http";
import { developmentGuard } from "@/lib/platform/contact/boundaries";
import { servicePolicyFromEnvironment } from "@/lib/platform/policy/site-policy";
import { UnavailableHostname } from "@/lib/platform/managed-sites/hostname";

const abuse = developmentGuard();
export const runtime = "nodejs";
export async function POST(request: Request) {
  const selection = await deploymentContext().catch(error => { if (error instanceof UnavailableHostname) return null; throw error; });
  if (!selection) return Response.json({ error: "unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  // Public production activation requires reviewed distributed abuse protection,
  // delivery routing and privacy operations. No environment switch bypasses this.
  if (process.env.NODE_ENV !== "development") return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return contactHttp(request, input => acceptContactSubmission(db.$client, selection, input, {
    abuse, servicePolicy: servicePolicyFromEnvironment(process.env.WEB_PRESENCE_SERVICE_POLICY),
  }), selection.hostname ? `http://${request.headers.get("host")}` : undefined);
}
