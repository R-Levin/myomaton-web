import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { manifest } from "../../scripts/customer-initializers/miopages-c0";
import { prepareDisposablePreview, assertCommittedCustomer, snapshotPublic } from "../../scripts/customer-previews/disposable";
import { focusMioPagesPreview as mioPagesPreview } from "../../scripts/customer-previews/miopages-focus";
import { validateMioPagesPreview } from "../../scripts/preview-miopages-focus";
import { projectCanonicalSections } from "../../lib/platform/canonical/projections";
import { relationship } from "../../lib/platform/presentation/content";

test("business focus disposable preview preserves canonical customers, isolates serving, and delivers only approved media", async () => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url, "PostgreSQL fixture URL required");
  const source = new Pool({ connectionString: url, options: "-c default_transaction_read_only=on" });
  try {
    const before = await snapshotPublic(source);
    const drifted = structuredClone(before); drifted.pages.find(p => p.id === manifest.rows.pages[0].id)!.title = "Changed";
    assert.throws(() => assertCommittedCustomer(drifted, manifest), /Committed customer differs/);
    const preview = await prepareDisposablePreview(url, manifest, mioPagesPreview);
    try {
      const runtime = new Pool({ connectionString: url, options: `-c search_path=${preview.schema} -c default_transaction_read_only=on -c timezone=UTC` });
      try {
        await runtime.query("SET TIME ZONE 'UTC'");
        assert.equal((await runtime.query("SELECT count(*)::integer count FROM web_presences")).rows[0].count, 1);
        assert.deepEqual((await runtime.query("SELECT id FROM web_presences")).rows.map(r => r.id), [manifest.webPresenceId]);
        await assert.rejects(runtime.query("UPDATE pages SET title='Refused'"), /read-only/);
        const references = await runtime.query(`SELECT target_ns.nspname FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class target ON target.oid=con.confrelid JOIN pg_namespace target_ns ON target_ns.oid=target.relnamespace WHERE n.nspname=$1 AND con.contype='f'`, [preview.schema]);
        assert.ok(references.rows.length); assert.ok(references.rows.every(r => r.nspname === preview.schema));
        for (const table of ["business_knowledge", "offerings", "business_knowledge_revisions", "offering_revisions"]) {
          const current = (await runtime.query(`SELECT to_jsonb(t) row FROM ${table} t`)).rows.map(r => r.row);
          assert.deepEqual(current, before[table].filter(r => r.web_presence_id === manifest.webPresenceId), `${table} copied without edits`);
        }
        const sourceBinding = { role: "offering-relationship", offeringId: manifest.offering.id, kind: "stages", componentKeys: ["standard-launch", "ongoing"] };
        const projected = await projectCanonicalSections(runtime, manifest.webPresenceId, [{ type: "relationship", content: { source: sourceBinding } }]);
        assert.equal(projected.length, 1); assert.equal(relationship(projected[0].content).kind, "stages");
        assert.doesNotMatch(JSON.stringify(projected), /109500|24900/);
        assert.deepEqual(await projectCanonicalSections(runtime, "00000000-0000-4000-8000-000000000000", [{ type: "relationship", content: { source: sourceBinding } }]), []);
        const server = await preview.start();
        await validateMioPagesPreview(server.base, preview.logo);
        for (const asset of before.assets) assert.equal((await fetch(`${server.base}/media/assets/${asset.id}`)).status, 404);
        assert.equal((await preview.verifyPreservation()).allRealCustomersUnchanged, true);
      } finally { await runtime.end(); }
    } finally { await preview.stop(); }
    assert.deepEqual(await snapshotPublic(source), before);
  } finally { await source.end(); }
});
