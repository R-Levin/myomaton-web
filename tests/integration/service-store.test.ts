import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { respond, startLaunch, tasks, work } from "../../lib/platform/service/cycle";
import { ServiceStore, StoreError } from "../../lib/platform/service/store";
import { accountKnowledge } from "../../lib/platform/knowledge/account";
import { importOnboarding, onboardingFromManifest } from "../../lib/platform/knowledge/import";
import { writeCanonical } from "../../lib/platform/canonical/writes";

test("an Account's service record is saved as append-only versions, and two saves never overwrite each other", async () => {
  const cluster = await disposableCluster(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const pool = new Pool({ connectionString: cluster.url });
  try {
    await migrateWithBootstrapCompatibility(pool);
    await pool.query(await readFile("lib/platform/service/records.sql", "utf8"));
    const organization = randomUUID(), webPresenceId = randomUUID(), managedSiteId = randomUUID();
    await pool.query("INSERT INTO organizations(id,name) VALUES($1,'Store test')", [organization]);
    await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'Store test')", [webPresenceId, organization]);
    await pool.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'Store test')", [managedSiteId, webPresenceId]);
    const account = { webPresenceId, managedSiteId }, specialist = { id: "specialist", role: "operator" as const };
    const store = new ServiceStore(pool);

    const empty = await store.read(account);
    assert.equal(empty.version, 0);
    const started = await store.save(empty, startLaunch(empty, "2026-11-25T12:00:00.000Z", specialist));
    assert.equal(started.version, 1);
    await assert.rejects(store.save(empty, startLaunch(empty, "2026-11-25T12:00:01.000Z", specialist)), StoreError, "A save from a stale read is refused");

    // The Account's Knowledge, read from the one Knowledge record, is what Core writes from.
    const at = "2026-11-25T11:00:00.000Z";
    await writeCanonical(pool, { domain: "knowledge", id: randomUUID(), webPresenceId, expectedVersion: null, expectedFingerprint: null,
      responsibleIdentity: "principal", changeReason: "Store test Knowledge", payload: { identityEvidence: [], approval: { by: "principal", at, scope: "public" }, entries: [
        { key: "audience", kind: "audience", value: "Owner-led businesses", evidence: { sourceKind: "customer", sourceReference: "test", confirmation: "confirmed",
          visibility: "public", confirmedBy: "principal", confirmedAt: at } },
        { key: "margin", kind: "fact", value: "Margins are thin", evidence: { sourceKind: "operator", sourceReference: "test", confirmation: "provisional", visibility: "internal" } }] } });
    const known = await accountKnowledge(pool, webPresenceId);
    assert.deepEqual(known.items.map(item => [item.key, item.status, item.forWebsite]), [["audience", "confirmed", true], ["margin", "proposed", false]],
      "Each item with its standing, and whether it may appear on the website");
    // Core writes the Report (a Beacon writer), and the Client approves it: each step a new version.
    const given: unknown[] = [];
    const writer = { write: async (input: { knowledge: readonly unknown[] }) => { given.push(input.knowledge); return { title: "Beacon Report" }; } };
    const read = await store.read(account);
    const written = await store.save(read, await work(read, tasks(read)[0], writer, known.items, "2026-11-25T12:01:00.000Z"));
    assert.deepEqual(given, [known.items], "The writer receives the Account's Knowledge");
    const client = { id: "client@example.test", role: "customer" as const };
    const approved = await store.update(account, record => respond(record, tasks(record)[0].changeId!, client, "approve", "2026-11-25T12:02:00.000Z"));
    assert.deepEqual([written.version, approved.version], [2, 3]);
    const again = await store.read(account);
    assert.deepEqual(again, approved, "What is read back is exactly what was saved");
    assert.deepEqual(tasks(again).map(task => task.what), ["Write the Direction"]);

    await assert.rejects(pool.query("UPDATE service_records SET payload='{}'"), /append only/);
    await assert.rejects(pool.query("DELETE FROM service_records"), /append only/);
    const other = randomUUID();
    await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'Other')", [other, organization]);
    await assert.rejects(store.save(await store.read({ webPresenceId: other, managedSiteId }), startLaunch(await store.read({ webPresenceId: other, managedSiteId }),
      "2026-11-25T12:03:00.000Z", specialist)), /another Account/, "A record is only ever saved for the Account that owns the site");

    // Onboarding done outside Core (C0's, from its reviewed manifest) enters a fresh Account as its Knowledge.
    const c0 = randomUUID();
    await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'C0 test Account')", [c0, organization]);
    const manifest = JSON.parse(await readFile("scripts/customer-initializers/miopages-c0-manifest.json", "utf8"));
    await importOnboarding(pool, c0, onboardingFromManifest(manifest), "principal", "C0 onboarding, done before Core");
    const c0Known = await accountKnowledge(pool, c0);
    assert.equal(c0Known.items.length, manifest.knowledge.payload.entries.length);
    assert.ok(c0Known.items.every(item => item.status === "confirmed"), "The Client's confirmed word");
    assert.deepEqual(c0Known.offerings.map(item => item.name), [manifest.offering.name]);
    await assert.rejects(importOnboarding(pool, c0, onboardingFromManifest(manifest), "principal", "Again"), /already has Knowledge/);
  } finally { await pool.end(); await cluster.stop(); }
});
