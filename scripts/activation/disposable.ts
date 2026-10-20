import { randomUUID } from "node:crypto";
import { createIntakeFixture } from "../intake/disposable";
import { newResumeToken, resumeHash } from "../../lib/platform/intake/service";
import { ActivationService } from "../../lib/platform/activation/service";
import { same, type Operation, type OperatorAuthority, type Scope } from "../../lib/platform/activation/model";
import { localApprovedReviews } from "../../lib/platform/activation/review-source";
import { evidencePacket, qualityChecks, type Claim, type ReviewDraft, type Submission } from "../../lib/platform/reviews/model";
import { LocalReviewStore, reviewRoot } from "../../lib/platform/reviews/store";
import { rm } from "node:fs/promises";
import path from "node:path";

// Only synthetic disposable proof setup. This is NOT a production identity adapter.
export async function activationFixture(databaseUrl: string) {
  const f = await createIntakeFixture(databaseUrl), stores: LocalReviewStore[] = [];
  const grants = new WeakMap<object, { scope: Scope; operations: Operation[] }>();
  const authority: OperatorAuthority = { async authorize(context, operation, scope) {
    const grant = context && typeof context === "object" ? grants.get(context) : undefined;
    if (!grant || !same(scope, grant.scope) || !grant.operations.includes(operation)) throw Error("Missing scoped operator authority");
    return { operatorId: "synthetic-activation-operator", authorityReference: "disposable-proof-capability" };
  } };
  const grant = (scope: Scope, operations: Operation[] = ["create", "inspect", "confirm-commercial", "assess", "confirm-information"]) => { const context = Object.freeze({}); grants.set(context, { scope: structuredClone(scope), operations: [...operations] }); return context; };
  const service = () => new ActivationService(f.pool, authority, localApprovedReviews);
  const submit = async (intent: "FREE_REVIEW" | "DIRECT_START", answers: Record<string, string | string[]>) => {
    const token = newResumeToken(), draft = await f.service.create(token, intent), saved = await f.service.save(token, draft.version, answers, 12);
    await f.service.submit(token, saved.version);
    const r = (await f.pool.query("SELECT s.* FROM prospect_intake_submissions s JOIN prospect_intakes i ON i.id=s.intake_id WHERE i.resume_hash=$1", [resumeHash(token)])).rows[0];
    const submission: Submission = { id: r.id, intake_id: r.intake_id, web_presence_id: r.web_presence_id, entry_intent: r.entry_intent, questionnaire_version: r.questionnaire_version, draft_version: r.draft_version, answers: r.answers, provenance: r.provenance, digest: r.digest, submitted_at: r.submitted_at.toISOString() };
    const scope = { ...f.service.selection, pendingCustomerId: randomUUID() };
    return { submission, scope, context: grant(scope) };
  };
  const review = async (submission: Submission, approve = true) => {
    const packet = evidencePacket(f.service.selection, submission, [], "Synthetic intake only; no external inspection.");
    const claim = (kind: Claim["kind"] = "RECOMMENDATION"): Claim => ({ kind, text: kind === "PROSPECT_SUPPLIED_UNCONFIRMED" ? "You describe an existing business presence." : "Clarify the next useful step for interested visitors.", evidence: ["intake:project"] });
    const draft: ReviewDraft = { understanding: claim("PROSPECT_SUPPLIED_UNCONFIRMED"), startingPoint: { framing: "existing", content: claim("UNKNOWN") }, opportunities: [1, 2, 3].map(n => ({ title: `Opportunity ${n}`, what: claim(), why: claim(), direction: claim() })), firstDirection: claim(), conversion: claim(), fit: { assessment: "conditional", content: claim() }, teaser: { status: "not-generated", content: claim("UNKNOWN") } };
    const store = await LocalReviewStore.create(packet, draft, "synthetic-activation-operator"); stores.push(store);
    const binding = await store.currentBinding();
    if (approve) { await store.append("request-review", binding, null, "synthetic-activation-operator", "Synthetic QC"); await store.append("approve", binding, null, "synthetic-activation-operator", "Synthetic approval only", Object.fromEntries(qualityChecks.map(k => [k, true]))); }
    return { store, request: { id: store.id, revision: binding.revision, digest: binding.revisionDigest } };
  };
  const stop = async () => { try { for (const store of stores) { const directory = path.resolve(reviewRoot(), store.id); if (path.dirname(directory) !== reviewRoot()) throw Error("Synthetic cleanup scope refused"); await rm(directory, { recursive: true, force: true }); } } finally { await f.stop(); } };
  return { ...f, intake: f.service, authority, grant, service, submit, review, stop };
}
