import "server-only";
import { db } from "../db/connection";
import { headers } from "next/headers";
import { resolveTenant } from "./hostname";
import { cache } from "react";

// React memoization is scoped to this server render/request. Metadata and body
// share one immutable binding even if registry data changes during the render.
export const deploymentContext = cache(async () => {
  return resolveTenant(db.$client, await headers());
});
