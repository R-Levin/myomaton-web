import type { ManagedSitePage } from "../managed-sites/service";
import { intakeEnabled } from "./availability";
import type { DeploymentSelection } from "../managed-sites/deployment";

export type OperationalConversions = Record<string, { label: string; href: string }>;
export function reviewConversions(page: ManagedSitePage, selection: DeploymentSelection, env: Record<string, string | undefined> = process.env): OperationalConversions {
  const result: OperationalConversions = {};
  if (!intakeEnabled(selection, env) || page.managedSite.id !== selection.managedSiteId || page.page.slug !== "/review" || page.presentationPreview) return result;
  // Activation adds controls; it never writes approved content or reinterprets other Actions.
  for (const s of page.sections) if (["4af04629-9b7a-4ffd-b6b3-322af962ee5d", "267b46a6-105b-4d14-8d4b-2fe171834c94"].includes(s.id)) result[s.id] = { label: "Start My Free Review", href: "/review/intake" };
  return result;
}
