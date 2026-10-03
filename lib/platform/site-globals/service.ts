import "server-only";
import { db } from "../db/connection";
import { logoImage } from "../assets/presentation-queries";
import { getNavigationByName } from "../navigations/service";
import { getActionsByIds } from "../actions/service";
import type { Action } from "../actions/model";
import { object, resolveBusinessIdentity, resolveSitePresentation } from "./model";
import { resolveSitePolicy, servicePolicyFromEnvironment } from "../policy/site-policy";

export async function getSiteGlobals(input: {
  webPresenceId: string; presenceName: string; presenceConfiguration: unknown;
  managedSiteId: string; siteName: string; siteConfiguration: unknown; pageId: string;
}) {
  const identity = resolveBusinessIdentity(input.presenceConfiguration, input.presenceName, input.siteName);
  const presentation = resolveSitePresentation(input.siteConfiguration);
  const policy = resolveSitePolicy(servicePolicyFromEnvironment(process.env.WEB_PRESENCE_SERVICE_POLICY),
    object(input.presenceConfiguration).policy, object(input.siteConfiguration).policy);
  const context = { managedSiteId: input.managedSiteId, pageId: input.pageId };
  const [logo, utilityNavigation, actions] = await Promise.all([
    logoImage(db, input.webPresenceId),
    presentation.footer.showUtilityNavigation ? getNavigationByName(input.webPresenceId, "Utility Navigation", "managedSite", context) : null,
    presentation.header.contactActionId ? getActionsByIds(input.webPresenceId, [presentation.header.contactActionId], context) : new Map<string, Action>(),
  ]);
  return { identity, presentation, policy, logo, utilityNavigation,
    contactAction: actions.get(presentation.header.contactActionId ?? "") ?? null };
}
export type SiteGlobals = Awaited<ReturnType<typeof getSiteGlobals>>;
