import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { managedBackup, restoreManagedBundle, restoreManagedMedia, verifyManagedRestore, managedSnapshot, assertManagedEquivalent, type ManagedConfig } from "../../scripts/backup/managed";
import ownership from "../../scripts/backup/application-ownership.json";
import { managedEnvironment, roleGrants, seedManagedTenants } from "../helpers/managed-postgres";
import { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { PostgresProposalPersistence } from "../../lib/platform/content-editing/proposal-postgres";
import { SiteReleaseService } from "../../lib/platform/content-editing/releases";
import { resolveTenant } from "../../lib/platform/managed-sites/hostname";
import { acceptContactSubmission } from "../../lib/platform/contact/submissions";
import { startProductionFixture } from "./production-server";
import { hostRequest } from "../helpers/host-request";
import { native } from "../../scripts/backup/core";
import { recoveryCatalog } from "../../scripts/backup/catalog";
import { writeCanonical } from "../../lib/platform/canonical/writes";
import { approval, knowledge } from "../helpers/canonical";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

test("PG17 raw historical SQL refusal remains explicit; live catalog semantics are readable", { skip: !process.env.PG17_BIN_DIR }, async () => {
  const cluster = await disposableCluster(process.env.PG17_BIN_DIR!);
  const pool = new Pool({ connectionString: cluster.url });
  try {
    await pool.query("CREATE TABLE public.compatibility_probe(id uuid PRIMARY KEY, value text NOT NULL CHECK(length(value)>0))");
    const c = await pool.connect(); try { await c.query("BEGIN READ ONLY"); const catalog = await recoveryCatalog(c, ["public"]); assert.ok(catalog.semantic.columns.some(r => r.attname === "value" && r.attnotnull === true)); assert.ok(catalog.semantic.constraints.every(r => r.contype !== "n" && r.conenforced === true)); } finally { await c.query("ROLLBACK"); c.release(); }
    await assert.rejects(migrate(drizzle(pool), { migrationsFolder: "lib/platform/db/migrations" }), (error: unknown) => { const e = error as { cause?: { message?: string } }; return !!e.cause?.message?.includes('constraint "microsites_id_not_null"'); });
    await mkdir("runtime-content/managed-postgres-proof", { recursive: true });
    await writeFile("runtime-content/managed-postgres-proof/pg17.json", JSON.stringify({ version: (await pool.query("SHOW server_version")).rows[0].server_version, catalogVerified: true, rawSqlReplay: "known PG18-only naming refusal; explicit adapter required", historyRewritten: false }, null, 2));
  } finally { await pool.end(); await cluster.stop(); }
});

for (const sourceMajor of [17, 18]) test(`managed PG${sourceMajor} bootstrap and recovery preserve owned histories/media`, { skip: !process.env[`PG${sourceMajor}_BIN_DIR`], timeout: 300000 }, async t => {
  const pg18 = process.env.PG18_BIN_DIR!;
  const sourceBin = process.env[`PG${sourceMajor}_BIN_DIR`]!;
  const work = await mkdtemp(path.join(tmpdir(), "miopages-managed-proof-")), clusters: Awaited<ReturnType<typeof disposableCluster>>[] = [], pools: Pool[] = [];
  const old = { ...process.env }; Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_SITE_PROPOSALS: "local-operator", MIOPAGES_SITE_RELEASES: "disposable-operator", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  const proofs: unknown[] = [];
  const check = async (name: string, run: () => Promise<void>) => { let failure: unknown; await t.test(name, async () => { try { await run(); } catch (error) { failure = error; throw error; } }); if (failure) throw failure; };
  try {
    const source = await disposableCluster(sourceBin); clusters.push(source);
    const env = await managedEnvironment(source.url, true); pools.push(env.admin);
    const runtime = new Pool({ connectionString: env.urls.runtime }); pools.push(runtime);
    const mediaRoot = path.join(work, "source-media"), tenants = await seedManagedTenants(runtime, mediaRoot);
    assert.equal((await env.admin.query("SELECT count(*)::int n FROM drizzle.__drizzle_migrations")).rows[0].n, 16);
    const provider = (await env.admin.query("SHOW server_version")).rows[0].server_version;
    await check("non-superuser runtime uses hostname scope and Contact idempotency", async () => {
      for (const tenant of tenants) {
        const context = await resolveTenant(runtime, new Headers({ host: tenant.hostname }), { NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "shared-hostnames" }); assert.equal(context.webPresenceId, tenant.presence);
        const input = { sectionId: tenant.contact, definitionId: tenant.definition, version: 1, fields: { email: "synthetic@example.test" }, idempotencyKey: randomUUID() };
        const responses = await Promise.all([1, 2].map(() => acceptContactSubmission(runtime, context, input, { abuse: { allow: async () => true } }))); assert.ok(responses.every(r => r.accepted)); assert.deepEqual(responses.map(r => r.duplicate).sort(), [false, true]);
        await assert.rejects(acceptContactSubmission(runtime, context, { ...input, sectionId: tenants.find(x => x !== tenant)!.contact }, { abuse: { allow: async () => true } }));
      }
      assert.equal((await env.admin.query("SELECT count(*)::int n FROM contact_submissions")).rows[0].n, 2);
      const input = { domain: "knowledge" as const, id: randomUUID(), webPresenceId: tenants[0].presence, expectedVersion: null, expectedFingerprint: null, payload: knowledge, responsibleIdentity: approval.by, changeReason: "Synthetic managed runtime canonical proof" };
      assert.equal((await writeCanonical(runtime, input)).revisions, 1); assert.equal((await writeCanonical(runtime, input)).revisions, 0);
    });
    // Existing fixture establishes Direct Start -> activation -> guarded customer
    // initialization -> confirmed facts through supported services on this major.
    const f = await siteReleaseFixture(source.url); let history: Record<string, unknown[]> = {};
    const scoped = new Pool({ connectionString: env.urls.runtime, options: `-c search_path=${f.schema} -c timezone=UTC` });
    try {
      await roleGrants(env.admin, env.roles, f.schema);
      const proposals = new SiteProposalService(scoped, f.authority, new PostgresProposalPersistence(scoped)), releases = new SiteReleaseService(scoped, f.releaseAuthority);
      await check("runtime proposal/revision/approval/release/rollback obey immutable and deferred guards", async () => {
        const id = randomUUID(), initial = await proposals.prepare(f.operator, id, f.scope, randomUUID(), f.page);
        const revision = await proposals.prepare(f.operator, id, f.scope, randomUUID(), { ...f.page, title: f.editorial("Revised synthetic direction") }, initial.revision!.binding);
        const binding = revision.revision!.binding, preview = await proposals.preview(f.operator, binding, randomUUID()), approved = await proposals.approve(f.approver, { binding, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Synthetic exact approval" });
        const input = { binding, approvalEvent: approved.hash, previewDigest: preview.digest, requestId: randomUUID(), reference: "Synthetic release" };
        const [a, b] = await Promise.all([releases.release(f.releaseContext, input), releases.release(f.releaseContext, input)]); assert.deepEqual(a, b);
        await assert.rejects(releases.rollback(f.rollbackContext, f.scope, { releaseId: a.id, expectedFingerprint: "0".repeat(64), requestId: randomUUID(), reference: "Stale" }));
        await releases.rollback(f.rollbackContext, f.scope, { releaseId: a.id, expectedFingerprint: a.after_fingerprint, requestId: randomUUID(), reference: "Synthetic rollback" });
        for (const sql of ["UPDATE business_knowledge_revisions SET change_reason='forged'", "DELETE FROM activation_case_events", "UPDATE activation_customer_bindings SET identity=identity", "DELETE FROM site_change_events", "UPDATE site_content_events SET reference='forged'", "TRUNCATE site_content_events", "ALTER TABLE site_content_events DISABLE TRIGGER ALL", "CREATE SCHEMA unauthorized", "CREATE TABLE unauthorized(id int)", "ALTER FUNCTION site_content_guard() RENAME TO altered_guard"]) await assert.rejects(scoped.query(sql));
        const client = await scoped.connect(); try { await client.query("BEGIN"); await client.query("INSERT INTO site_change_proposals(id,organization_id,web_presence_id,managed_site_id,created_at) VALUES($1,$2,$3,$4,now())", [randomUUID(), (await scoped.query("SELECT organization_id FROM web_presences WHERE id=$1", [f.scope.webPresenceId])).rows[0].organization_id, f.scope.webPresenceId, f.scope.managedSiteId]); await assert.rejects(client.query("COMMIT"), /complete|revision/i); } finally { await client.query("ROLLBACK"); client.release(); }
      });
      for (const table of ownership.tables.filter(s => s.startsWith("public.")).map(s => s.slice(7))) history[table] = (await f.pool.query(`SELECT to_jsonb(t) row FROM ${table} t`)).rows.map(r => r.row);
    } finally { await scoped.end(); await f.stop(); }
    // Move the valid synthetic history into the private backup source only after
    // the fixture's own preservation check. No shared rows are ever cloned.
    const c = await env.admin.connect(); try { await c.query("BEGIN"); await c.query("SET LOCAL session_replication_role=replica"); for (const [table, rows] of Object.entries(history)) for (const row of rows) await c.query(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_record(NULL::public.${table},$1::jsonb) ON CONFLICT DO NOTHING`, [JSON.stringify(row)]); await c.query("COMMIT"); } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); } history = {};
    const bundle = path.join(work, "bundle"), config: ManagedConfig = { mode: "managed-postgres", root: bundle, databaseUrl: env.urls.backup, objectsRoot: mediaRoot, pgBin: sourceBin, repository: process.cwd(), roles: env.roles };
    const manifest = await managedBackup(config); assert.equal(manifest.state.migrations.length, 16); assert.equal(manifest.objects.length, 2);
    const toc = await native(sourceBin, "pg_restore", ["--list", path.join(bundle, "application.dump")]); assert.ok(!toc.includes("provider_marker"));
    for (const bin of sourceMajor === 17 ? [sourceBin, pg18] : [pg18]) {
      const cluster = await disposableCluster(bin); clusters.push(cluster); const target = await managedEnvironment(cluster.url, false); pools.push(target.admin);
      const objects = path.join(work, `restored-${proofs.length}`), cfg: ManagedConfig = { ...config, pgBin: bin, databaseUrl: target.urls.migration, roles: target.roles, objectsRoot: objects };
      await restoreManagedBundle(bundle, cfg); await restoreManagedMedia(bundle, objects);
      const proof = await verifyManagedRestore(bundle, cfg); proofs.push(proof);
      assert.equal((await target.admin.query("SELECT count(*)::int n FROM provider_marker")).rows[0].n, 1);
      const targetRuntime = new Pool({ connectionString: target.urls.runtime });
      try {
        for (const tenant of tenants) assert.equal((await resolveTenant(targetRuntime, new Headers({ host: tenant.hostname }), { NODE_ENV: "production", MIOPAGES_ROUTING_MODE: "shared-hostnames" })).webPresenceId, tenant.presence);
        await assert.rejects(targetRuntime.query("UPDATE business_knowledge_revisions SET change_reason='hostile'")); await assert.rejects(targetRuntime.query("TRUNCATE site_change_events"));
        await assert.rejects(targetRuntime.query("UPDATE managed_site_hostnames SET managed_site_id=$1 WHERE hostname=$2", [tenants[1].site, tenants[0].hostname]));
        if (process.env.ASSET_TEST_PRODUCTION === "1") { const server = await startProductionFixture(target.urls.runtime, "public", objects, { webPresenceId: tenants[0].presence, managedSiteId: tenants[0].site }, false, true); try { for (const [i, tenant] of tenants.entries()) { const response = await hostRequest(server.base, "/", tenant.hostname), html = await response.text(); assert.equal(response.status, 200); for (const marker of [tenant.label + " Home", tenant.label + " body", tenant.label + " Navigation", tenant.label + " CTA", `https://${tenant.hostname}/`]) assert.ok(html.includes(marker), marker); assert.ok(!html.includes(tenants[1 - i].label)); assert.equal((await hostRequest(server.base, `/media/assets/${tenant.asset}`, tenant.hostname)).status, 200); assert.equal((await hostRequest(server.base, `/media/assets/${tenants[1 - i].asset}`, tenant.hostname)).status, 404); } } finally { await server.stop(); } }
      } finally { await targetRuntime.end(); }
      await check(`restore ${proof.sourceMajor} -> ${proof.targetMajor} rejects semantic/security/data/dependency drift`, async () => {
        const client = await target.admin.connect();
        try { for (const sql of ["ALTER TABLE actions RENAME TO missing_actions", "ALTER TABLE managed_sites ALTER COLUMN name DROP NOT NULL", "ALTER TABLE managed_site_hostnames DROP CONSTRAINT hostname_normalized", "CREATE OR REPLACE FUNCTION site_content_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$", "DROP TRIGGER site_proposal_complete_guard ON site_change_proposals", "DROP INDEX site_approval_once", "UPDATE drizzle.__drizzle_migrations SET hash='wrong' WHERE id=16", "GRANT TRUNCATE ON site_change_events TO proof_runtime", "GRANT SELECT ON pages TO PUBLIC", "GRANT SELECT ON pages TO proof_backup WITH GRANT OPTION", "UPDATE pages SET title='tampered'", "UPDATE managed_site_hostnames SET hostname='drift.localhost' WHERE hostname='c0.localhost'", "DROP EXTENSION plpgsql CASCADE", ...(sourceMajor === 17 ? ["COMMENT ON TABLE drizzle.__drizzle_migrations IS NULL"] : [])]) { await client.query("BEGIN"); try { await client.query(sql); await assert.rejects(async () => assertManagedEquivalent(manifest.state, await managedSnapshot(client, cfg.databaseUrl, target.roles))); } finally { await client.query("ROLLBACK"); } } } finally { client.release(); }
        const item = manifest.objects[0], file = path.join(objects, item.owner, item.key); await rename(file, file + ".missing"); try { await assert.rejects(verifyManagedRestore(bundle, cfg)); } finally { await rename(file + ".missing", file); }
        await verifyManagedRestore(bundle, cfg);
      });
    }
    await mkdir("runtime-content/managed-postgres-proof", { recursive: true });
    await writeFile(`runtime-content/managed-postgres-proof/manifest-${sourceMajor}.json`, JSON.stringify(manifest, null, 2));
    await writeFile(`runtime-content/managed-postgres-proof/result-${sourceMajor}.json`, JSON.stringify({ provider, migrations: 16, roles: env.roles, applicationInventory: ownership, bootstrapReceipt: manifest.state.bootstrapReceipt, proofs, providerStateExcluded: true, runtimeWorkflow: true, databaseGuards: true, syntheticTenants: true, sharedTouched: false, temporaryInfrastructureRemoved: true }, null, 2));
    console.log(JSON.stringify({ provider, proofs, sharedTouched: false }));
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key]; Object.assign(process.env, old);
    for (const pool of pools) await pool.end(); for (const cluster of clusters.reverse()) await cluster.stop(); assert.equal(path.dirname(work), path.resolve(tmpdir())); assert.match(path.basename(work), /^miopages-managed-proof-/); await rm(work, { recursive: true });
  }
});

// The existing libc PG17/PG18 proofs above remain unchanged. This independent
// ICU proof uses only disposable loopback clusters, never a hosted connection.
test("managed PG17 ICU snapshot, backup and restore retain exact locale identity", { skip: !process.env.PG17_BIN_DIR, timeout: 180000 }, async () => {
  const bin = process.env.PG17_BIN_DIR!;
  const work = await mkdtemp(path.join(tmpdir(), "miopages-managed-icu-"));
  const clusters: Awaited<ReturnType<typeof disposableCluster>>[] = [], pools: Pool[] = [];
  const icuEnvironment = async (locale: "en-US" | "de-DE", migrateNow: boolean) => {
    const cluster = await disposableCluster(bin); clusters.push(cluster);
    const database = "migration_rehearsal_" + randomUUID().replaceAll("-", "");
    const admin = new Pool({ connectionString: cluster.url });
    try { await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE '${locale}' LC_COLLATE 'C' LC_CTYPE 'C'`); }
    finally { await admin.end(); }
    const url = new URL(cluster.url); url.pathname = "/" + database;
    const env = await managedEnvironment(url.toString(), migrateNow); pools.push(env.admin);
    return env;
  };
  try {
    const source = await icuEnvironment("en-US", true);
    const runtime = new Pool({ connectionString: source.urls.runtime }); pools.push(runtime);
    const mediaRoot = path.join(work, "source-media"); await seedManagedTenants(runtime, mediaRoot);
    const config: ManagedConfig = { mode: "managed-postgres", root: path.join(work, "bundle"), databaseUrl: source.urls.backup, objectsRoot: mediaRoot, pgBin: bin, repository: process.cwd(), roles: source.roles };
    const manifest = await managedBackup(config), locale = manifest.state.provider.locale;
    assert.equal(manifest.state.provider.major, 17); assert.equal(locale.datlocprovider, "i");
    assert.equal(locale.datlocale, "en-US"); assert.equal(typeof locale.datcollversion, "string");
    assert.equal(manifest.state.migrations.length, 16); assert.ok(manifest.state.bootstrapReceipt);
    const actual = (await source.admin.query("SELECT pg_encoding_to_char(encoding) encoding,datlocprovider,datcollate,datctype,datlocale,datcollversion FROM pg_database WHERE datname=current_database()")).rows[0];
    assert.deepEqual(locale, actual);

    const wrong = await icuEnvironment("de-DE", false);
    await assert.rejects(restoreManagedBundle(config.root, { ...config, databaseUrl: wrong.urls.migration, roles: wrong.roles }));
    assert.equal((await wrong.admin.query("SELECT to_regclass('public.pages') name")).rows[0].name, null, "Locale mismatch must refuse before restore writes");

    const target = await icuEnvironment("en-US", false);
    const restored: ManagedConfig = { ...config, databaseUrl: target.urls.migration, roles: target.roles, objectsRoot: path.join(work, "restored-media") };
    await restoreManagedBundle(config.root, restored); await restoreManagedMedia(config.root, restored.objectsRoot);
    const proof = await verifyManagedRestore(config.root, restored); assert.equal(proof.verified, true); assert.equal(proof.objects, 2);
    const c = await target.admin.connect();
    try {
      await c.query("BEGIN READ ONLY");
      const state = await managedSnapshot(c, restored.databaseUrl, target.roles);
      assert.deepEqual(state.provider.locale, locale); assertManagedEquivalent(manifest.state, state);
      for (const changed of [{ ...locale, datlocprovider: "b" }, { ...locale, datlocprovider: "c", datlocale: null }, { ...locale, datlocale: "de-DE" }, { ...locale, datcollversion: String(locale.datcollversion) + ".drift" }]) {
        const drifted = structuredClone(state); drifted.provider.locale = changed;
        assert.throws(() => assertManagedEquivalent(manifest.state, drifted));
      }
    } finally { await c.query("ROLLBACK"); c.release(); }
    await mkdir("runtime-content/managed-postgres-proof", { recursive: true });
    await writeFile("runtime-content/managed-postgres-proof/icu-17.json", JSON.stringify({ ...proof, locale, migrations: 16, localeMismatchRefusesBeforeWrites: true, negativeControls: true, sharedTouched: false, hostedTouched: false }, null, 2));
  } finally {
    for (const pool of pools) await pool.end(); for (const cluster of clusters.reverse()) await cluster.stop();
    assert.equal(path.dirname(work), path.resolve(tmpdir())); assert.match(path.basename(work), /^miopages-managed-icu-/); await rm(work, { recursive: true });
  }
});
