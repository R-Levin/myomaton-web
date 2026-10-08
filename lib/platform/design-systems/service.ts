import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/platform/db/connection";
import { designSystems } from "@/lib/platform/db/schema/design-systems";
import {
  type DesignConfiguration,
  resolveDesignConfiguration,
} from "./configuration";

export type ResolvedDesignSystem = {
  id: string | null;
  name: string | null;
  configuration: DesignConfiguration;
  rawConfiguration?: unknown;
};

export async function getDesignSystemByWebPresenceId(
  webPresenceId: string,
): Promise<ResolvedDesignSystem> {
  const [designSystem] = await db
    .select({
      id: designSystems.id,
      name: designSystems.name,
      configuration: designSystems.configuration,
    })
    .from(designSystems)
    .where(and(
      eq(designSystems.webPresenceId, webPresenceId),
      eq(designSystems.status, "active"),
    ))
    .limit(1);

  return {
    id: designSystem?.id ?? null,
    name: designSystem?.name ?? null,
    configuration: resolveDesignConfiguration(designSystem?.configuration),
    ...(designSystem?.configuration && Object.hasOwn(designSystem.configuration, "palette") ? { rawConfiguration: designSystem.configuration } : {}),
  };
}
