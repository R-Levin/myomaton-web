import { credentialFromEnvironment, protectedConnection, protectedPool, pullRole } from "@/lib/platform/wordpress-delivery/protected-connection";
import { WordPressDelivery } from "@/lib/platform/wordpress-delivery/service";

export const runtime = "nodejs";
let service: WordPressDelivery | undefined;

export async function POST(request: Request) {
  const unavailable = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (process.env.MIOPAGES_WP_PRIVATE_STAGE !== "enabled") return unavailable(404);
  try {
    if (!service) {
      const origin = process.env.MIOPAGES_WP_CORE_ORIGIN ?? "";
      if (new URL(request.url).origin !== origin) return unavailable(400);
      const pool = protectedPool(process.env.MIOPAGES_WP_PULL_URL ?? "", pullRole, process.env.MIOPAGES_WP_DATABASE_CA);
      service = new WordPressDelivery(pool, async () => null, credentialFromEnvironment, origin,
        undefined, db => protectedConnection(db, pullRole));
    }
    return await service.handle(request);
  } catch { return unavailable(503); }
}
