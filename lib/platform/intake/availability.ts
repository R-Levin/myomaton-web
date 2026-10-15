import type { DeploymentSelection } from "../managed-sites/deployment";
// The sole pilot activation binding. Never infer a customer from prospect text/URLs.
export const mioPagesIntakeOwner = { webPresenceId: "926cb772-7507-4542-8acd-e7e57ce71324", managedSiteId: "312b8081-4582-47fa-bedb-a551fd6e2b36" };
export function intakeEnabled(selection: DeploymentSelection, env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "development" && ["local-development", "shared-development"].includes(env.MIOPAGES_REVIEW_INTAKE ?? "") && !!env.INTAKE_DATABASE_URL
    && selection.webPresenceId === mioPagesIntakeOwner.webPresenceId && selection.managedSiteId === mioPagesIntakeOwner.managedSiteId;
}
export function loopbackOrigin(url: string) { return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname); }
