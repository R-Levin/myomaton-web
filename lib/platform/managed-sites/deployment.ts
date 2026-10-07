import { actionId } from "../actions/model";
export type DeploymentSelection = { webPresenceId: string; managedSiteId: string };
export function deploymentSelection(env: Record<string,string | undefined> = process.env): DeploymentSelection {
  const webPresenceId=actionId(env.WEB_PRESENCE_ID), managedSiteId=actionId(env.MANAGED_SITE_ID);
  if (!webPresenceId || !managedSiteId) throw Error("WEB_PRESENCE_ID and MANAGED_SITE_ID must both be explicit UUIDs");
  return {webPresenceId,managedSiteId};
}
