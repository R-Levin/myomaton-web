import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { fingerprint } from "../canonical/model";
import { PresenceWorkflow, type WorkflowContext } from "./presence-workflow";
import type { PresenceWorkflowGrant } from "./presence-workflow-provider";
import { protectedOwnerId, protectedOwnerScope } from "./protected-owner";
import { projectRetainedSite, type ArtifactHistoryRow } from "./retained-site-review";
import { workflowNativeReviewCandidate } from "./presence-workflow-delivery";

const caseId = "41a83e7e-1765-4517-941a-b2b151bb7c4a";
const proposal = "f560374969b7abdff53fa33917c9b84f7053f5f9b092b0dccf9a505bcc8f9ddd";
const sourceScope = { webPresenceId: "2a08e054-902c-400b-9b96-3c2274bcadc2", managedSiteId: "2c0d637d-4ded-4597-ac8b-661519aba358" };
export const retainedCoreAssociation = { schema: "retained-core-review/1", ownerId: protectedOwnerId,
  parentScope: protectedOwnerScope, sourceCaseId: caseId, sourceScope, sourceManifestSha256: proposal,
  revision: 106, baselineRevision: 97, eventDigest: "d60864ea449c2d44e5c24e7a5935c6d261d50388070fc42148a62eb0f391a083" } as const;

async function privateBytes(file: string) {
  const info = await lstat(file);
  assert.ok(info.isFile() && info.uid === process.getuid?.() && (info.mode & 0o777) === 0o600 && await realpath(file) === file);
  return readFile(file);
}

/** Explicit read association, not a tenant reparent/import or another model
 * grant. The original account writer and its privileges remain unchanged. */
export async function protectedRetainedSiteReader() {
  const home = await realpath(process.env.HOME ?? "");
  assert.equal(home, "/home/virtual/vps-bef564/e/e494602172");
  const parent = join(home, "miopages-private-acceptance");
  let binding: Buffer;
  try { binding = await privateBytes(join(parent, "current-site-review.json")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  assert.equal(fingerprint(JSON.parse(binding.toString("utf8"))), fingerprint(retainedCoreAssociation));
  const root = join(parent, "presence-evaluation", caseId);
  let pool: Pool | undefined;
  let last: { context: WorkflowContext; current: NonNullable<Awaited<ReturnType<PresenceWorkflow["review"]>>>;
    previous: NonNullable<Awaited<ReturnType<PresenceWorkflow["review"]>>> } | undefined;
  async function read(ownerId: string) {
      assert.equal(ownerId, protectedOwnerId);
      assert.deepEqual(await privateBytes(join(parent, "current-site-review.json")), binding);
      if (!pool) {
        const password = (await privateBytes(join(parent, "p0-22-c0-runtime/db/password"))).toString("utf8").trim();
        const url = new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_" + caseId.replaceAll("-", ""));
        url.password = password;
        pool = new Pool({ connectionString: url.href, options: "-c default_transaction_read_only=on", max: 1,
          connectionTimeoutMillis: 5000, idleTimeoutMillis: 1000, statement_timeout: 10000 });
      }
      const contextFile = JSON.parse((await privateBytes(join(root, "context.json"))).toString("utf8")) as { context: WorkflowContext };
      const grant = JSON.parse((await privateBytes(join(root, "grant.json"))).toString("utf8")) as PresenceWorkflowGrant;
      assert.equal(fingerprint(grant), "f024b7997144524a4194cf93a6d7e9ca78783db1d0473d73fa16163102d48995");
      const context = contextFile.context;
      assert.equal(context.intakeId, caseId); assert.deepEqual(context.scope, sourceScope);
      assert.equal(context.evaluation?.basis, proposal); assert.equal(fingerprint(context), grant.contextDigest);
      assert.ok(grant.marketingAuthority);
      const db = await pool.connect();
      let released = false;
      try {
        const identity = (await db.query("SELECT current_database() AS database,host(inet_server_addr()) AS host,current_setting('default_transaction_read_only') AS readonly")).rows[0];
        assert.deepEqual(identity, { database: "migration_rehearsal_" + caseId.replaceAll("-", ""), host: "127.0.0.1", readonly: "on" });
        const rows = (await db.query("SELECT version,payload,digest FROM public.presence_workflow_events WHERE intake_id=$1 AND version=ANY($2::integer[]) ORDER BY version", [caseId, [97, 106]])).rows;
        assert.equal(rows.length, 2); assert.equal(rows[1].digest, retainedCoreAssociation.eventDigest);
        for (const row of rows) { assert.equal(row.digest, fingerprint(row.payload)); assert.equal(row.payload.contextDigest, grant.contextDigest); }
        const history = (await db.query(`SELECT version,payload->>'contextDigest' AS context,
          CASE WHEN payload->'report'<>'null'::jsonb THEN md5((payload->'report')::text) END AS report,
          CASE WHEN payload->'direction'<>'null'::jsonb THEN md5((payload->'direction')::text) END AS direction,
          CASE WHEN payload->'blueprint'<>'null'::jsonb THEN md5((payload->'blueprint')::text) END AS blueprint
          FROM public.presence_workflow_events WHERE intake_id=$1 ORDER BY version`, [caseId])).rows as ArtifactHistoryRow[];
        const noOutbound = async (): Promise<never> => { throw Error("Retained review has no provider or write capability"); };
        const operations = { mode: "provider" as const, marketingAuthority: grant.marketingAuthority, reviewSequence: grant.reviewSequence,
          maxEditorialRevisions: grant.maxEditorialRevisions, maxCommercialReplans: grant.maxCommercialReplans, run: noOutbound, recover: noOutbound };
        // The store reads the exact last event; refuse drift rather than show a
        // historical number beside different content. No mutation API is exposed.
        const latest = { version: history.at(-1)?.version ?? 0 };
        assert.ok(latest.version >= 106);
        db.release(); released = true;
        const workflow = new PresenceWorkflow(pool, operations, grant.previewActionDestinations, Date.now, "disposable");
        const current = await workflow.review(context); assert.ok(current); assert.equal(current.version, latest.version);
        const previous = { ...current, ...rows[0].payload, version: 97 };
        last = { context, current, previous };
        const review = projectRetainedSite(context, current, previous, grant.marketingAuthority, history);
        review.referenceImages = (grant.originalMaterials?.records ?? []).filter(source => source.mime === "image/png" && source.purpose === "editorial-reference")
          .map(source => ({ id: source.id, label: ["home", "service", "experience", "review"].find(label => source.id.includes(label)) ?? "Earlier website reference" }));
        return review;
      } finally { if (!released) db.release(); }
    }
  return {
    read,
    async preview(ownerId: string, path: string, before: boolean) {
      await read(ownerId); assert.ok(last);
      const view = before ? last.previous : last.current;
      assert.ok(view.pages.some(page => page.path === path));
      const input = workflowNativeReviewCandidate(last.context, view);
      return { ...input, path };
    },
    async reference(ownerId: string, id: string) {
      const review = await read(ownerId);
      assert.ok(review.referenceImages.some(source => source.id === id));
      const grant = JSON.parse((await privateBytes(join(root, "grant.json"))).toString("utf8")) as PresenceWorkflowGrant;
      const source = grant.originalMaterials!.records.find(item => item.id === id)!;
      const bytes = await privateBytes(join(root, "originals", source.sha256 + ".source"));
      assert.equal(bytes.length, source.bytes); assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    },
    close: () => pool?.end(),
  };
}
