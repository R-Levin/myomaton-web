import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { ActivationService } from "../../lib/platform/activation/service";
import { localApprovedReviews } from "../../lib/platform/activation/review-source";
import { type Operation, type Scope } from "../../lib/platform/activation/model";
import { IntakeService, newResumeToken, resumeHash } from "../../lib/platform/intake/service";
import type { EntryIntent } from "../../lib/platform/intake/model";
import { evidencePacket, qualityChecks, type Claim, type ReviewDraft, type Submission } from "../../lib/platform/reviews/model";
import { LocalReviewStore, reviewRoot } from "../../lib/platform/reviews/store";
import { disposableCluster } from "../backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../db/bootstrap";
import { intakeAnswersV2 } from "../../tests/helpers/intake";

// Dedicated loopback PostgreSQL cluster and fixture Review records. Never takes a configured URL.
export async function openIntelligentFixture(bin: string) {
  const cluster = await disposableCluster(bin);
  const pool = new Pool({ connectionString: cluster.url });
  const stores: LocalReviewStore[] = [];
  const close = async () => {
    try { for (const store of stores) await rm(join(reviewRoot(), store.id), { recursive: true, force: true }); }
    finally { try { await pool.end(); } finally { await cluster.stop(); } }
  };
  try {
    await migrateWithBootstrapCompatibility(pool);
    const database = new URL(cluster.url).pathname.slice(1);
    const grants = new WeakMap<object, { scope: Scope; operations: Operation[]; actor: string }>();
    const activation = new ActivationService(pool, { async authorize(context, operation, scope) {
      const grant = typeof context === "object" && context ? grants.get(context) : undefined;
      if (!grant || !grant.operations.includes(operation) || Object.keys(scope).some(key => scope[key as keyof Scope] !== grant.scope[key as keyof Scope])) {
        throw Error("Missing scoped test authority");
      }
      return { operatorId: grant.actor, authorityReference: "offline-test-only" };
    } }, localApprovedReviews, async db => {
      const { rows: [bound] } = await db.query("SELECT current_database() AS db, current_schema() AS schema, host(inet_server_addr()) AS host");
      if (bound.db !== database || !/^migration_rehearsal_[a-f0-9]{32}$/.test(database) || bound.schema !== "public" || bound.host !== "127.0.0.1") {
        throw Error("Offline cluster boundary required");
      }
    });
    async function owner() {
      const org = randomUUID(), webPresenceId = randomUUID(), managedSiteId = randomUUID();
      await pool.query("INSERT INTO organizations(id,name,status) VALUES($1,'Disposable owner','active')", [org]);
      await pool.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES($1,$2,'Disposable presence','active')", [webPresenceId, org]);
      await pool.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES($1,$2,'Disposable site','active')", [managedSiteId, webPresenceId]);
      return { webPresenceId, managedSiteId };
    }
    async function createEntry(selection: Awaited<ReturnType<typeof owner>>, intent: EntryIntent) {
      const intake = new IntakeService(pool, selection), token = newResumeToken();
      const draft = await intake.create(token, intent), saved = await intake.save(token, draft.version, intakeAnswersV2(), 12);
      await intake.submit(token, saved.version); // Synthetic prerequisite, never the preserved or intelligent draft.
      const { rows: [row] } = await pool.query("SELECT s.* FROM prospect_intake_submissions s JOIN prospect_intakes i ON i.id=s.intake_id WHERE i.resume_hash=$1", [resumeHash(token)]);
      const submission: Submission = { id: row.id, intake_id: row.intake_id, web_presence_id: row.web_presence_id, entry_intent: row.entry_intent,
        questionnaire_version: row.questionnaire_version, draft_version: row.draft_version, answers: row.answers, provenance: row.provenance, digest: row.digest, submitted_at: row.submitted_at.toISOString() };
      let review;
      if (intent === "FREE_REVIEW") {
        const packet = evidencePacket(selection, submission, [], "Synthetic prerequisite only.");
        const proposal: Claim = { kind: "RECOMMENDATION", text: "Clarify next steps for a qualified prospect.", evidence: ["intake:project"] };
        const content: ReviewDraft = { understanding: { ...proposal, kind: "PROSPECT_SUPPLIED_UNCONFIRMED", text: "You describe an existing business presence." },
          startingPoint: { framing: "existing", content: proposal }, opportunities: [1, 2, 3].map(i => ({ title: "Option " + i, what: proposal, why: proposal, direction: proposal })),
          firstDirection: proposal, conversion: proposal, fit: { assessment: "conditional", content: proposal }, teaser: { status: "not-generated", content: { ...proposal, kind: "UNKNOWN" } } };
        const store = await LocalReviewStore.create(packet, content, "disposable-operator");
        stores.push(store);
        const binding = await store.currentBinding();
        await store.append("request-review", binding, null, "disposable-operator", "Synthetic QC");
        await store.append("approve", binding, null, "disposable-operator", "Synthetic approval only", Object.fromEntries(qualityChecks.map(key => [key, true])));
        review = { id: store.id, revision: binding.revision, digest: binding.revisionDigest };
      }
      const scope = { ...selection, pendingCustomerId: randomUUID() }, context = {}, provisioning = {};
      grants.set(provisioning, { scope, operations: ["create", "confirm-commercial"], actor: "disposable-operator" });
      grants.set(context, { scope, operations: ["draft-onboarding"], actor: "disposable-customer:" + scope.pendingCustomerId });
      const created = await activation.create(provisioning, { requestId: randomUUID(), scope, submissionId: submission.id, submissionDigest: submission.digest, review });
      const authorize = () => activation.update(provisioning, created.id, scope, created.version, randomUUID(), "confirm-commercial", {
        source: "agreement-order", reference: "Synthetic commercial prerequisite", confirmedAt: new Date().toISOString(), launchScope: "Test only", ongoingScope: "Test only",
      });
      return { scope, context, caseId: created.id, token: newResumeToken(), authorize, review };
    }
    function inspector(scope: Scope) {
      const context = {};
      grants.set(context, { scope, operations: ["inspect"], actor: "disposable-review-operator" });
      return context;
    }
    return { pool, activation, database, owner, createEntry, inspector, close };
  } catch (error) {
    await close();
    throw error;
  }
}
