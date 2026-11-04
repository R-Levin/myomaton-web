import { operatorRole, pullRole } from "./protected-connection";

export const privateStageSource = ["organizations", "web_presences", "managed_sites", "activation_customer_bindings", "pages", "sections", "actions",
  "navigations", "navigation_items", "design_systems", "business_knowledge", "offerings", "assets", "asset_usages",
  "subjects", "contact_definitions", "business_knowledge_revisions", "offering_revisions", "site_change_proposals",
  "site_change_revisions", "site_change_events"];
export const privateStageProposalTables = ["site_change_proposals", "site_change_revisions", "site_change_events"];

export function allowedPrivateStageCanonicalGrant(role: string, object: string, field: string, permission: string) {
  if (role !== operatorRole && role !== pullRole) return false;
  if (!object.startsWith("public.")) return false;
  const table = object.slice("public.".length);
  if (permission === "SELECT" && field === "") return privateStageSource.includes(table);
  if (role !== operatorRole) return false;
  return (permission === "INSERT" && field === "" && privateStageProposalTables.includes(table))
    || (permission === "UPDATE" && table === "site_change_proposals" && field === "id");
}
