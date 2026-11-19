import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import proposal from "../docs/c0-source-aware-run-proposal.json";
import { fingerprint } from "../lib/platform/canonical/model";
import { p022CandidateInputs } from "../lib/platform/intake/c0-p022-source-pack";
import { compileSourceAwareC0, readSourceAwareC0Plan, sourceAwareC0ProposalSha256, validateSourceAwareC0Plan } from "../lib/platform/intake/c0-source-aware-run";
import { emptyResponsesUsageLedger, verifyWorkflowUsageBaseline } from "../lib/platform/intake/intelligent-responses";
import type { OriginalMaterial } from "../lib/platform/intake/presence-source-material";
import type { PresenceWorkflowGrant } from "../lib/platform/intake/presence-workflow-provider";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQioAAAAASUVORK5CYII=", "base64");

function fixture() {
  const plan = structuredClone(proposal);
  const prepared = p022CandidateInputs(readFileSync("docs/c0-generation-p0-22-sources.json"),
    { brandDigest: fingerprint("fixture brand"), qualityReviewerId: proposal.review.existingReviewerId });
  const materials = proposal.sources.originalMaterials.map(source => {
    const bytes = /^(docs|brand|scripts)\//u.test(source.path) && existsSync(source.path) ? readFileSync(source.path) :
      source.mime.startsWith("image/") ? png : Buffer.from('{"answers":"Isolated synthetic fixture, not actual owner text."}');
    return { bytes, source: { id: source.id, bytes: bytes.length, sha256: hash(bytes), mime: source.mime,
      reference: source.path, author: source.author, date: source.date, status: source.status, purpose: source.purpose, operations: source.operations } as OriginalMaterial };
  });
  for (const row of materials.filter(row => row.source.mime.startsWith("text/"))) {
    prepared.context.evidence.push({ id: row.source.id, label: row.source.id, date: row.source.date, reference: row.source.reference,
      kind: row.source.status === "unconfirmed" ? "customer-unconfirmed" : "service-direction", content: row.bytes.toString() });
    prepared.authority.sources = [...prepared.authority.sources, { digest: fingerprint(prepared.context.evidence.at(-1)), use: "analysis" }];
  }
  prepared.authority.contextDigest = fingerprint(prepared.context);
  const rates = { model: "gpt-5.4-mini-2026-03-17", verifiedOn: "2026-11-19", inputPerMillion: 750_000, cachedPerMillion: 75_000,
    outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
  const pending = { ownerDigest: fingerprint("prior owner"), workDigest: fingerprint("held prior report"), reservedMicros: 450_000,
    countDispatched: true, generationDispatched: true, countRequestId: "count-fixture",
    status: "pending" as const, workflowStage: "report" as const };
  const reportHold = { receiptDigest: fingerprint(pending), originalWorkDigest: pending.workDigest, replacementWorkDigest: fingerprint("old replacement") };
  const ledger = emptyResponsesUsageLedger(rates);
  ledger.attempts.push(pending, { ownerDigest: fingerprint("prior owner"), workDigest: fingerprint("prior web research"),
    reservedMicros: 60_000, estimatedMicros: 30_000, countDispatched: true, generationDispatched: true, status: "completed", webSearchCalls: 1 });
  const bytes = Buffer.from(JSON.stringify(ledger) + "\n");
  plan.preserve.previousIntakeId = prepared.context.intakeId; plan.preserve.previousContextDigest = fingerprint(prepared.context);
  plan.sources.previousContextDigest = plan.preserve.previousContextDigest;
  plan.sources.previousEvidenceRecords = prepared.context.evidence.length;
  plan.preserve.previousLedgerSha256 = hash(bytes); plan.preserve.baselineAttempts = 2; plan.preserve.previousDebitMicros = 510_000;
  plan.authority.cumulativeAccountedCeilingMicros = 8_510_000;
  plan.sources.originalMaterials = plan.sources.originalMaterials.map((source, index) => ({ ...source,
    sha256: materials[index].source.sha256, bytes: materials[index].bytes.length }));
  const grant: PresenceWorkflowGrant = { contextDigest: fingerprint(prepared.context), marketingAuthority: prepared.authority,
    approvedSources: prepared.context.evidence.map(fingerprint), approvedCorrections: [], researchSources: [], researchResponseBytes: 1000,
    maxOutputTokens: 1000, expiresAt: 0, ledger: { id: fingerprint("old fixture grant"), baselineAttempts: 0, startingLedger: hash(bytes),
      requests: 0, generations: 0, capMicros: 510_000, inputTokens: 1000, inputBytes: 10_000,
      carryForward: { debitMicros: 510_000, totalCapMicros: 510_000, reportHold } } };
  const now = Date.now();
  const activation = { proposalSha256: sourceAwareC0ProposalSha256, approvalRecord: 1, artifactSha256: fingerprint("offline worker"),
    linuxProofSha256: fingerprint("offline fixture marker, not actual Linux proof"), reviewerId: plan.review.existingReviewerId,
    startsAt: now - 1000, reviewerCredentialExpiresAt: now + 72 * 3600_000 - 1000 };
  return { plan, activation, prior: { context: prepared.context, grant, ledger: bytes, materials, brandDigest: fingerprint("new fixture brand") }, now };
}

test("the exact reviewable proposal balances realistic rates, resource limits and unchanged public source bytes", () => {
  const bytes = readFileSync("docs/c0-source-aware-run-proposal.json");
  const plan = readSourceAwareC0Plan(bytes);
  assert.equal(plan.status, "PROPOSED_NOT_AUTHORIZED");
  assert.equal(hash(bytes), sourceAwareC0ProposalSha256);
  assert.equal(plan.authority.additionalProviderCapMicros, 8_000_000);
  assert.equal(plan.authority.cumulativeAccountedCeilingMicros, 19_881_103);
  assert.equal(plan.preserve.baselineAttempts, 85);
  for (const source of plan.sources.canonicalKnowledge) assert.equal(hash(readFileSync(source.path)), source.sha256);
  assert.equal(plan.provider.model, "gpt-5.4-2026-03-05");
  assert.equal(plan.media.newDownloads + plan.media.newProviderSearches + plan.media.newImageGenerations, 0);
  assert.throws(() => readSourceAwareC0Plan(Buffer.concat([bytes, Buffer.from(" ")])), /Exact/);
  const wrong = structuredClone(plan); wrong.provider.stages.editorial.capMicros += 1;
  assert.throws(() => validateSourceAwareC0Plan(wrong), /ceiling refused/);
});

test("a new C0 grant compiles full knowledge, exact originals, early rendered critique and conservative prior reservation without side effects", () => {
  const f = fixture(), before = fingerprint(f.prior);
  const output = compileSourceAwareC0(f.plan, f.activation, f.prior, f.now);
  assert.equal(fingerprint(f.prior), before);
  assert.deepEqual(output.context.scope, f.plan.destination.scope);
  assert.notEqual(output.context.intakeId, f.prior.context.intakeId);
  assert.equal(output.context.evidence.length, f.prior.context.evidence.length + 6);
  assert.equal(output.context.evidence.find(source => source.id === "c0-retained-ten-answers")!.kind, "customer-unconfirmed");
  assert.ok(output.grant.marketingAuthority?.earlyConceptReview);
  assert.equal(output.grant.marketingAuthority?.projectionVersion, 2);
  assert.equal(output.grant.maxRetries, f.plan.authority.maximumDeliberateRetries);
  assert.equal(output.grant.ledger.baselineAttempts, 2);
  assert.equal(output.grant.ledger.carryForward!.debitMicros, 510_000);
  assert.deepEqual(output.grant.ledger.carryForward!.reportHold, f.prior.grant.ledger.carryForward!.reportHold);
  assert.deepEqual(verifyWorkflowUsageBaseline(f.prior.ledger, output.grant.ledger), { attempts: 2, debitMicros: 510_000 });
  assert.equal(output.grant.originalMaterials!.records.length, f.prior.materials.length);
  assert.deepEqual(output.grant.originalMaterials!.candidateReview!.operations, ["editorial"]);
  assert.ok(output.grant.expiresAt <= f.activation.startsAt + 72 * 3600_000);
  assert.equal(f.prior.grant.expiresAt, 0, "Historical grant remains expired; it is evidence, not renewed authority");
});

test("changed source/customer/ledger/reservation, unconfirmed promotion and expired activation cannot be compiled into a live grant", () => {
  const changes = [
    (f: ReturnType<typeof fixture>) => { f.prior.ledger = Buffer.concat([f.prior.ledger, Buffer.from(" ")]); },
    (f: ReturnType<typeof fixture>) => { f.prior.context.evaluation!.scenario = "c2"; },
    (f: ReturnType<typeof fixture>) => { f.prior.context.evidence[0].content += " changed"; },
    (f: ReturnType<typeof fixture>) => { f.prior.materials[0].bytes = Buffer.from("changed"); },
    (f: ReturnType<typeof fixture>) => { f.prior.grant.ledger.carryForward!.reportHold.receiptDigest = "f".repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.activation.reviewerCredentialExpiresAt = f.now; },
    (f: ReturnType<typeof fixture>) => { f.activation.approvalRecord = 0; },
    (f: ReturnType<typeof fixture>) => { f.activation.reviewerCredentialExpiresAt = f.activation.startsAt + 73 * 3600_000; },
    (f: ReturnType<typeof fixture>) => { f.activation.proposalSha256 = "f".repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.plan.destination.scope.webPresenceId = f.prior.context.scope.webPresenceId; },
  ];
  for (const change of changes) { const f = fixture(); change(f); assert.throws(() => compileSourceAwareC0(f.plan, f.activation, f.prior, f.now)); }
  const f = fixture(), output = compileSourceAwareC0(f.plan, f.activation, f.prior, f.now);
  assert.throws(() => verifyWorkflowUsageBaseline(f.prior.ledger, { ...output.grant.ledger, baselineAttempts: 1 }), /Complete prior/);
  assert.throws(() => verifyWorkflowUsageBaseline(f.prior.ledger, { ...output.grant.ledger,
    carryForward: { ...output.grant.ledger.carryForward!, debitMicros: 30_000 } }), /Carried-forward/);
});

test("runtime activation requires a matching offline Linux result and refuses an altered worker, failed proof or expired reviewer", async () => {
  const { verifySourceAwareRuntimeProof } = await import("../scripts/intake/source-aware-evaluation-activation");
  const f = fixture(), artifact = Buffer.from("Offline fixture worker, never an executed Linux artifact.");
  const proof = { status: "PASS", artifactSha256: hash(artifact), proposalSha256: sourceAwareC0ProposalSha256, passed: 10, failed: 0, providerCalls: 0 };
  const bytes = Buffer.from(JSON.stringify(proof));
  const activation = { ...f.activation, artifactSha256: hash(artifact), linuxProofSha256: hash(bytes), reviewerVerifier: fingerprint("fixture verifier") };
  assert.equal(verifySourceAwareRuntimeProof(activation, artifact, bytes, 72, f.now), activation.reviewerCredentialExpiresAt);
  for (const change of [{ ...proof, failed: 1 }, { ...proof, providerCalls: 1 }, { ...proof, artifactSha256: "f".repeat(64) },
    { ...proof, proposalSha256: "f".repeat(64) }, { ...proof, passed: 0 }]) {
    const wrong = Buffer.from(JSON.stringify(change));
    assert.throws(() => verifySourceAwareRuntimeProof({ ...activation, linuxProofSha256: hash(wrong) }, artifact, wrong, 72, f.now));
  }
  assert.throws(() => verifySourceAwareRuntimeProof(activation, Buffer.from("changed"), bytes, 72, f.now));
  assert.throws(() => verifySourceAwareRuntimeProof({ ...activation, reviewerId: "another-principal" }, artifact, bytes, 72, f.now));
  assert.throws(() => verifySourceAwareRuntimeProof({ ...activation, reviewerCredentialExpiresAt: f.now - 1 }, artifact, bytes, 72, f.now));
});

test("launcher configuration refusal identifies its stage without echoing unexpected arguments or reading credentials", async () => {
  const { spawnSync } = await import("node:child_process");
  const marker = "DO_NOT_ECHO_UNEXPECTED_PRIVATE_ARGUMENT";
  const compiled = process.env.MIOPAGES_TEST_COMPILED_WORKER;
  const result = spawnSync(process.execPath, compiled ? [compiled, marker] : ["--import", "tsx", "scripts/intake/source-aware-evaluation-worker.ts", marker],
    { encoding: "utf8", env: { ...process.env, HOME: "unavailable-for-this-offline-test" } });
  assert.equal(result.status, 1);
  assert.ok(!result.stderr.includes(marker) && !result.stdout.includes(marker));
  const diagnostic = JSON.parse(result.stderr.trim());
  assert.equal(diagnostic.status, "BLOCKED");
  assert.equal(diagnostic.operation, "unrecognized");
  assert.equal(diagnostic.stage, "argument-validation");
});

test("shared stage accounting permits useful repetition but the same aggregate ceiling still stops paid dispatch", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { initializeResponsesUsageLedger, meteredPresenceWorkflow, validateWorkflowStagePlan } = await import("../lib/platform/intake/intelligent-responses");
  const root = await mkdtemp(join(tmpdir(), "miopages-shared-stage-fixture-"));
  try {
    const rates = proposal.provider.rates;
    await initializeResponsesUsageLedger(root, rates);
    const stages = Object.fromEntries(Object.entries(proposal.provider.stages).map(([name, stage]) => [name, {
      ...stage, requestInputTokens: 1000, requestOutputTokens: 100, capMicros: 8000,
    }])) as import("../lib/platform/intake/intelligent-responses").WorkflowStagePlan;
    const scope = { id: fingerprint("shared scope fixture"), startingLedger: hash(await readFile(join(root, "onboarding-usage.json"))),
      baselineAttempts: 0, requests: 6, generations: 3, capMicros: 8000, inputTokens: 1000, inputBytes: 10_000,
      stages, stageSpendingPolicy: "shared-aggregate" as const, breakdown: { text: 3, images: 0, searchCalls: 0 } };
    validateWorkflowStagePlan(stages, scope);
    assert.throws(() => validateWorkflowStagePlan(stages, { ...scope, stageSpendingPolicy: undefined }), /exceeds workflow cap/,
      "Old grants still enforce their additive stage allocations");
    let calls = 0;
    const transport = { async send(path: string) {
      calls++;
      if (path.endsWith("/input_tokens")) return { body: { input_tokens: 1000 } };
      const response = { id: "resp_offline_shared_" + calls, model: rates.model, status: "completed", service_tier: "default",
        usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
        output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ fixture: true }) }] }] };
      return { body: response, rawBody: Buffer.from(JSON.stringify(response)) };
    } };
    const run = meteredPresenceWorkflow(root, rates, transport, scope, 100, undefined, undefined, "direction");
    const retained: Buffer[] = [];
    const request = { model: rates.model, input: "Offline budget fixture", instructions: "No network exists in this test.", text: { format: { type: "json_object" } } };
    for (const id of ["one", "two"]) {
      await run({ ownerDigest: fingerprint("owner"), workDigest: fingerprint(id) }, request, async () => {}, async bytes => { retained.push(bytes); });
    }
    assert.equal(calls, 4); assert.equal(retained.length, 2);
    await assert.rejects(run({ ownerDigest: fingerprint("owner"), workDigest: fingerprint("third") }, request, async () => {}, async bytes => { retained.push(bytes); }));
    assert.equal(calls, 4, "No third count or generation reaches transport after the aggregate cap");
    const ledger = JSON.parse((await readFile(join(root, "onboarding-usage.json"))).toString());
    assert.equal(ledger.attempts.filter((attempt: { generationDispatched: boolean }) => attempt.generationDispatched).length, 2);
    assert.equal(ledger.attempts.reduce((sum: number, attempt: { estimatedMicros?: number }) => sum + (attempt.estimatedMicros ?? 0), 0), 8000);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("explicit source-aware recovery proves an absent reservation under lock and refuses actual or uncertain dispatch",async()=>{
 const {mkdtemp,readFile,writeFile,rm,unlink}=await import("node:fs/promises");
 const {join}=await import("node:path");const {tmpdir}=await import("node:os");
 const {initializeResponsesUsageLedger,confirmUndispatchedPlanningRequest}=await import("../lib/platform/intake/intelligent-responses");
 const root=await mkdtemp(join(tmpdir(),"miopages-never-dispatched-"));
 try{
  await initializeResponsesUsageLedger(root,proposal.provider.rates);
  const file=join(root,"onboarding-usage.json"),before=await readFile(file),owner=fingerprint("offline owner"),work=fingerprint("offline work");
  const scope={id:fingerprint("offline missing-reservation scope"),startingLedger:hash(before),baselineAttempts:0,requests:4,generations:2,capMicros:10000,inputTokens:1000,inputBytes:10000};
  await assert.rejects(confirmUndispatchedPlanningRequest(root,scope,owner,work));
  await confirmUndispatchedPlanningRequest(root,scope,owner,work,true);
  assert.deepEqual(await readFile(file),before,"No fabricated receipt or ledger reset");
  await writeFile(file+".lock","held",{flag:"wx",mode:0o600});
  await assert.rejects(confirmUndispatchedPlanningRequest(root,scope,owner,work,true),{code:"EEXIST"});await unlink(file+".lock");
  await assert.rejects(confirmUndispatchedPlanningRequest(root,{...scope,startingLedger:"f".repeat(64)},owner,work,true));
  for(const status of ["pending","uncertain","completed"]){
   const ledger=JSON.parse(before.toString());
   ledger.attempts.push({ownerDigest:owner,workDigest:work,workflowScope:scope.id,status,reservedMicros:4000,countDispatched:true,generationDispatched:true});
   await writeFile(file,JSON.stringify(ledger)+"\n",{mode:0o600});
   await assert.rejects(confirmUndispatchedPlanningRequest(root,scope,owner,work,true),"Existing generation cannot be classified as unstarted");
   await assert.rejects(confirmUndispatchedPlanningRequest(root,scope,owner,fingerprint("different work"),true),"An unrelated unsettled receipt blocks absence proof too");
  }
 }finally{await rm(root,{recursive:true,force:true})}
});
