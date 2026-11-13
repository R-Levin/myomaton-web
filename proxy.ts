import { NextResponse, type NextRequest } from "next/server";

// Deliberately no matcher: the isolated listener must also deny public assets,
// image optimization and every normal Core page/API before their code runs.
export function proxy(request: NextRequest) {
  if (process.env.MIOPAGES_PROTECTED_CORE === "enabled") {
    const { pathname, search } = request.nextUrl;
    const method = request.method;
    if (!search && ((method === "GET" && pathname === "/core")
      || ((method === "GET" || method === "POST") && pathname === "/api/protected-core")
      || (method === "GET" && /^\/_next\/static\/[\w./-]+$/.test(pathname) && !pathname.endsWith(".map")))) return NextResponse.next();
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (process.env.MIOPAGES_WP_PRIVATE_STAGE !== "enabled") return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (request.method === "POST" && !search &&
    (pathname === "/api/wordpress-delivery/pull" || pathname === "/api/wordpress-delivery/receipt")) {
    // Existing privateStageIngress and the service still authenticate this request.
    return NextResponse.next();
  }
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
