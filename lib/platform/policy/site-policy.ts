import { object } from "../site-globals/model";

// A capability flag, not business truth or CSS. Only trusted service settings
// grant override permission. Unknown settings never enter the resolved contract.
export function resolveSitePolicy(service: unknown = {}, presence: unknown = {}, site: unknown = {}) {
  const rule = object(object(service).socialLinksEnabled);
  let socialLinksEnabled = typeof rule.value === "boolean" ? rule.value : true;
  const presenceValue = object(presence).socialLinksEnabled, siteValue = object(site).socialLinksEnabled;
  if (rule.allowPresenceOverride === true && typeof presenceValue === "boolean") socialLinksEnabled = presenceValue;
  if (rule.allowSiteOverride === true && typeof siteValue === "boolean") socialLinksEnabled = siteValue;
  return { socialLinksEnabled };
}

export function servicePolicyFromEnvironment(value: string | undefined): unknown {
  if (!value) return {};
  try { return object(JSON.parse(value)); } catch { return {}; }
}
