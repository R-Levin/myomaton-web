import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/platform/db/connection";
import { actions } from "@/lib/platform/db/schema/actions";
import { actionId, normalizeAction, type Action } from "./model";

export async function getActionsByIds(
  webPresenceId: string,
  ids: readonly string[],
): Promise<Map<string, Action>> {
  const validIds = [...new Set(ids.map(actionId).filter((id) => id !== null))];
  const resolved = new Map<string, Action>();
  const presenceId = actionId(webPresenceId);
  if (!presenceId || validIds.length === 0) return resolved;

  const rows = await db
    .select({
      id: actions.id,
      webPresenceId: actions.webPresenceId,
      name: actions.name,
      type: actions.type,
      label: actions.label,
      destination: actions.destination,
      status: actions.status,
    })
    .from(actions)
    .where(and(
      eq(actions.webPresenceId, presenceId),
      eq(actions.status, "active"),
      inArray(actions.id, validIds),
    ));

  for (const row of rows) {
    const action = normalizeAction(row, presenceId);
    if (action && validIds.includes(action.id)) resolved.set(action.id, action);
  }
  return resolved;
}
