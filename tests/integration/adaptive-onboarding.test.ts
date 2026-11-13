import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { source } from "../../lib/platform/activation/model";
import { fingerprint } from "../../lib/platform/canonical/model";
import { adaptiveAssessmentStep, adaptiveGaps, adaptiveOfferStep, adaptiveOnboardingVersion, adaptiveQuestions, adaptiveScopeStep } from "../../lib/platform/intake/adaptive";
import { fieldApplies } from "../../lib/platform/intake/model";
import { IntakeService, type IntakeView } from "../../lib/platform/intake/service";
import { createC0Onboarding } from "../../scripts/intake/c0-onboarding";
import { prospectDirection } from "../../lib/platform/intake/prospect-direction";

test("adaptive local drafts preserve source conflicts and dispositions without repeating intake", async () => {
  const rehearsal = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true);
  const server = rehearsal.listener().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = "http://127.0.0.1:" + address.port;
  function request(scenario: "c0" | "c2", body?: object, cookie?: string, requestOrigin = origin) {
    return fetch(origin + "/api/onboarding" + (scenario === "c2" ? "/customer-2" : ""), {
      method: body ? "POST" : "GET", headers: { "X-Intake-Request": "1", ...(cookie && { Cookie: cookie }),
        ...(body && { Origin: requestOrigin, "Content-Type": "application/json" }) }, ...(body && { body: JSON.stringify(body) }),
    });
  }
  const read = async (response: Response): Promise<IntakeView> => {
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    assert.equal((await fetch(origin + "/onboarding/customer-2")).status, 200);
    assert.equal((await request("c0", { operation: "begin" }, undefined, "https://external.example")).status, 403);
    const c0 = await request("c0", { operation: "begin" });
    const c0Cookie = c0.headers.get("set-cookie")!.split(";", 1)[0];
    const first = await read(c0);
    assert.equal(first.questionnaireVersion, adaptiveOnboardingVersion);
    assert.equal((await request("c0", { operation: "site-priority", version: first.version, priority: "Review first" }, c0Cookie)).status, 404);
    assert.deepEqual(first.answers, {});
    assert.equal(first.prepared?.reconciliation.status, "conflict");
    assert.equal(first.prepared?.sources.find(s => s.id === "discovery")?.kind, "Owner-confirmed");
    assert.equal(first.prepared?.sources.find(s => s.id === "site")?.kind, "Website observation");
    assert.ok(first.prepared?.inventory.some(item => item.item.includes("QR/self-managed") && item.disposition.includes("Exclude")));
    assert.ok(first.prepared?.inventory.some(item => item.item.includes("https://my.miopages.com/login")));
    assert.ok(!adaptiveQuestions.flatMap(q => q.fields).some(f => ["businessName", "offer", "audience", "serviceArea", "website"].includes(f.key)));
    assert.equal((await request("c0", { operation: "save", version: first.version, answers: { sourceDecision: "Needs a correction", preparedDigest: "fake" }, step: 1 }, c0Cookie)).status, 400);
    assert.equal((await request("c0", { operation: "submit", version: first.version }, c0Cookie)).status, 400);

    const second = await request("c2", { operation: "begin" }, c0Cookie);
    const c2Cookie = second.headers.get("set-cookie")!.split(";", 1)[0];
    const tree = await read(second);
    assert.equal(tree.prepared?.scenario, "c2");
    assert.deepEqual(tree.prepared.sources.map(s => s.kind), ["Website observation"]);
    assert.match(tree.prepared.reviewGap, /No actual Free Review/);
    assert.match(tree.prepared.proposal, /replacement site.*FAQs/);
    assert.equal((await request("c2", undefined, c0Cookie.replace("adaptive_c0", "adaptive_c2"))).status, 404);
    assert.equal((await request("c0", undefined, c2Cookie.replace("adaptive_c2", "adaptive_c0"))).status, 404);

    const urgent = "Emergency calls and routine estimates";
    const fields = adaptiveQuestions[adaptiveOfferStep].fields;
    assert.ok(fields.some(f => f.key === "urgentCoverage" && fieldApplies(f, { visitorRoute: urgent })));
    assert.ok(fields.some(f => f.key === "reviewHandoff" && !fieldApplies(f, { visitorRoute: urgent })));
    const foundation = { sourceDecision: "Needs a correction", sourceCorrection: "Winter plowing is historical.", foundationGoal: "Get better-qualified routine estimates." };
    assert.equal((await request("c2", { operation: "save", version: tree.version, answers: foundation, step: adaptiveOfferStep }, c2Cookie)).status, 400);
    assert.equal((await request("c2", { operation: "save", version: tree.version, answers: { sourceDecision: "Accurate as summarized" }, step: adaptiveScopeStep }, c2Cookie)).status, 400);
    const scope = await read(await request("c2", { operation: "save", version: tree.version, answers: foundation, step: adaptiveScopeStep }, c2Cookie));
    assert.equal((await request("c2", { operation: "save", version: scope.version, answers: foundation, step: adaptiveOfferStep }, c2Cookie)).status, 400);
    assert.equal((await request("c2", { operation: "save", version: scope.version, answers: { ...foundation, workIncluded: "Early paid answer" }, step: adaptiveScopeStep }, c2Cookie)).status, 409);
    const acknowledged = { ...foundation, rehearsalCommitment: "Continue in this rehearsal" };
    const deeper = await read(await request("c2", { operation: "save", version: scope.version, answers: acknowledged, step: adaptiveOfferStep }, c2Cookie));
    assert.equal(deeper.answers.foundationGoal, foundation.foundationGoal);
    const answers = { ...acknowledged,
      workIncluded: "Preventive pruning", workExcluded: "Utility line work", visitorRoute: urgent, urgentCoverage: "Limited to published hours",
      estimateHandoff: "Describe the tree issue and service area", siteDisposition: "Explicitly exclude from future drafts", siteItem: "Old winter plowing offer" };
    const inventory = await read(await request("c2", { operation: "save", version: deeper.version, answers, step: adaptiveAssessmentStep - 1 }, c2Cookie));
    const save = { operation: "save", version: inventory.version, answers, step: adaptiveAssessmentStep };
    const saved = await read(await request("c2", save, c2Cookie));
    assert.deepEqual(await read(await request("c2", undefined, c2Cookie)), saved);
    assert.deepEqual(await read(await request("c2", save, c2Cookie)), saved);
    assert.equal(saved.provenance?.sourceCorrection.confirmation, "unconfirmed");
    assert.deepEqual(saved.prepared, tree.prepared);
    const gaps = adaptiveGaps(saved.prepared!, saved.answers).join(" ");
    assert.match(gaps, /Reconcile the new correction/);
    assert.doesNotMatch(gaps, /Free Review/);
    assert.equal((await request("c2", { ...save, answers: { ...answers, siteItem: "Stale overwrite" } }, c2Cookie)).status, 409);
    const changed = await read(await request("c2", { ...save, version: saved.version, answers: { ...answers, visitorRoute: "Request an estimate" } }, c2Cookie));
    assert.equal(changed.answers.urgentCoverage, undefined);
    assert.equal(changed.provenance?.urgentCoverage, undefined);
    assert.equal(changed.answers.siteItem, answers.siteItem);
    const submitted = await read(await request("c2", { operation: "submit", version: changed.version }, c2Cookie));
    assert.equal(submitted.state, "needs_operator_review");
    assert.deepEqual(await read(await request("c2", undefined, c2Cookie)), submitted);
    const { rows: [snapshot] } = await rehearsal.pool.query("SELECT * FROM prospect_intake_submissions");
    assert.equal(snapshot.provenance.preparedDigest, fingerprint(tree.prepared));
    assert.throws(() => source(snapshot), /not activation evidence/);
    await assert.rejects(rehearsal.pool.query("UPDATE prospect_intake_submissions SET answers='{}'"), /immutable/);

    const { rows: [{ database, cases, knowledge }] } = await rehearsal.pool.query("SELECT current_database() AS database, (SELECT count(*)::int FROM activation_cases) AS cases, (SELECT count(*)::int FROM business_knowledge) AS knowledge");
    assert.equal(cases, 0);
    assert.equal(knowledge, 0);
    const stale = new IntakeService(rehearsal.pool, rehearsal.selection, {
      database, answers: {}, provenance: {}, prepared: { ...first.prepared!, context: "Changed source context" },
    });
    await assert.rejects(stale.resume(c0Cookie.split("=")[1]), /prepared_source_changed/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rehearsal.stop();
  }
});

const retainedFile = process.env.MIOPAGES_LOCAL_RETAINED_C0;
test("protected C0 resume and priority correction preserve the retained answers", { skip: !retainedFile }, async () => {
  const rehearsal = await createC0Onboarding(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin", true, retainedFile);
  const server = rehearsal.listener().listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = "http://127.0.0.1:" + address.port;
    const endpoint = origin + "/api/onboarding";
    const request = (body?: object, cookie?: string) => fetch(endpoint, { method: body ? "POST" : "GET",
      headers: { "X-Intake-Request": "1", ...(cookie && { Cookie: cookie }),
        ...(body && { Origin: origin, "Content-Type": "application/json" }) }, body: body && JSON.stringify(body) });
    assert.equal((await request()).status, 401);
    assert.equal((await fetch(origin + "/onboarding/customer-2")).status, 404);
    const unlock = await fetch(endpoint + "/access", { method: "POST", headers: {
      Origin: origin, "X-Intake-Request": "1", "X-Local-Access": rehearsal.accessCode!,
    } });
    assert.equal(unlock.status, 204);
    const gate = unlock.headers.get("Set-Cookie")!.split(";", 1)[0];
    const begin = await request({ operation: "begin" }, gate);
    assert.equal(begin.status, 200);
    const cookie = gate + "; " + begin.headers.get("Set-Cookie")!.split(";", 1)[0];
    const before: IntakeView = await begin.json();
    assert.equal(Object.keys(before.answers).length, 10);
    assert.equal(prospectDirection(before.answers)?.primary.action, "Request a Free Review");
    const correction = { operation: "site-priority", version: before.version, priority: "Conversation first" };
    const saved = await request(correction, cookie);
    assert.equal(saved.status, 200);
    const after: IntakeView = await saved.json();
    assert.deepEqual(after.answers, { ...before.answers, sitePriority: "Conversation first" });
    assert.deepEqual(after.provenance, { ...before.provenance, sitePriority: after.provenance!.sitePriority });
    assert.equal(after.provenance!.sitePriority.confirmation, "unconfirmed");
    assert.equal(prospectDirection(after.answers)?.primary.action, "Talk about getting started");
    assert.equal(prospectDirection(after.answers)?.secondary.action, "Request a Free Review");
    assert.deepEqual(await (await request(correction, cookie)).json(), after);
    assert.equal((await request({ ...correction, priority: "Review first" }, cookie)).status, 409);
    assert.deepEqual(await (await request(undefined, cookie)).json(), after);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rehearsal.stop();
  }
});
