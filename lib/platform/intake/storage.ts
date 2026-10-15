import type { DeploymentSelection } from "../managed-sites/deployment";
import { intakeEnabled } from "./availability";

// Keep the disposable boundary; shared storage requires a separate exact local mode.
export function intakeStorageSchema(connectionString: string, env: Record<string, string | undefined> = process.env,
  selection: DeploymentSelection = { webPresenceId: env.WEB_PRESENCE_ID ?? "", managedSiteId: env.MANAGED_SITE_ID ?? "" }) {
  const writer = new URL(connectionString), options = writer.searchParams.get("options") ?? "";
  const match = /^-c search_path=(canonical_test_[a-f0-9]{32}_intake) -c timezone=UTC$/.exec(options);
  if (match && env.MIOPAGES_REVIEW_INTAKE !== "shared-development") return match[1];
  if (env.MIOPAGES_REVIEW_INTAKE === "shared-development" && intakeEnabled(selection, env)
    && options === "-c search_path=public -c timezone=UTC" && env.DATABASE_URL) {
    const canonical = new URL(env.DATABASE_URL);
    if (["localhost", "127.0.0.1", "[::1]"].includes(writer.hostname) && writer.pathname === "/myomaton_dev"
      && (writer.port || "5432") === "5432" && ["postgres:", "postgresql:"].includes(writer.protocol)
      && canonical.hostname === writer.hostname && canonical.pathname === writer.pathname
      && (canonical.port || "5432") === (writer.port || "5432")) return "public";
  }
  throw Error("Dedicated disposable or explicitly selected shared DEVELOPMENT intake storage required");
}
