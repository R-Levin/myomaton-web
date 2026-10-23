import { mkdir, writeFile } from "node:fs/promises";
import { hostnameFixture } from "./hostname-routing/fixture";
import { resolveTenant } from "../lib/platform/managed-sites/hostname";
import { startProductionFixture } from "../tests/integration/production-server";

async function main() {
  if (!process.env.ASSET_TEST_DATABASE_URL) throw Error("Explicit private rehearsal database required");
  const fixture = await hostnameFixture(process.env.ASSET_TEST_DATABASE_URL);
  const server = await startProductionFixture(process.env.ASSET_TEST_DATABASE_URL, fixture.schema, fixture.root,
    { webPresenceId: fixture.tenants[0].presence, managedSiteId: fixture.tenants[0].site }, false, true).catch(async error => { await fixture.stop(); throw error; });
  const env = { NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "shared-hostnames" };
  const diagnostics = await Promise.all(fixture.tenants.map(async tenant => ({
    label: tenant.label, url: server.base.replace("127.0.0.1", tenant.hostname),
    context: await resolveTenant(fixture.pool, new Headers({ host: tenant.hostname }), env),
  })));
  await mkdir("runtime-content/hostname-routing", { recursive: true });
  await writeFile("runtime-content/hostname-routing/viewer.json", JSON.stringify({ processId: server.processId,
    diagnostics, unknown: server.base.replace("127.0.0.1", "unknown.localhost"), sharedDatabaseTouched: false }, null, 2));
  console.log(JSON.stringify(diagnostics));
  const stop = async () => { await server.stop(); await fixture.stop(); process.exit(0); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
