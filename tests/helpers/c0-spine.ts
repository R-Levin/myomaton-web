import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "../../lib/platform/canonical/model";
import { IntelligentOnboarding } from "../../lib/platform/intake/intelligent";
import type { QuestionProvider } from "../../lib/platform/intake/intelligent-model";
import { IntakeService, newResumeToken } from "../../lib/platform/intake/service";
import type { siteReleaseFixture } from "../../scripts/site-releases/disposable";
import { intakeAnswersV2 } from "./intake";

export async function c0SpineInterview(fixture: Awaited<ReturnType<typeof siteReleaseFixture>>) {
  const intakeOwner = fixture.intake.selection;
  const activation = fixture.activation;
  const database = (await fixture.pool.query("SELECT current_database() AS name")).rows[0].name;
  const prerequisite = await fixture.submit("FREE_REVIEW", intakeAnswersV2());
  const review = await fixture.review(prerequisite.submission);
  const created = await activation.create(prerequisite.context, {
    requestId: randomUUID(), scope: prerequisite.scope, submissionId: prerequisite.submission.id,
    submissionDigest: prerequisite.submission.digest, review: review.request,
  });
  const directScope = (await fixture.pool.query("SELECT pending_customer_id FROM activation_cases WHERE id=$1",
    [fixture.caseId])).rows[0].pending_customer_id;
  const inspect = fixture.grantScopes([{ ...intakeOwner, pendingCustomerId: directScope }], ["inspect"]);
  const directCase = await activation.inspect(inspect, fixture.caseId, { ...intakeOwner, pendingCustomerId: directScope });
  assert.equal(directCase.canonicalBinding?.webPresenceId, fixture.scope.webPresenceId);
  assert.equal(directCase.canonicalBinding?.managedSiteId, fixture.scope.managedSiteId);

  const walk = async (entry: typeof created, answer: string) => {
    const draftContext = fixture.grantScopes([entry.scope], ["draft-onboarding"]);
    const access = { caseId: entry.id, context: draftContext, token: newResumeToken() };
    const siteEvidence = "old-site";
    const brief = "managed-service";
    const reviewEvidence = "fixture-review";
    const sources: ConstructorParameters<typeof IntelligentOnboarding>[2] = {
      scope: entry.scope,
      evidence: [
        { ...intakeOwner, id: brief, kind: "owner-confirmed", at: "2026-11-09",
          reference: "docs/miopages-c0-business-brief.md#launch-and-ongoing-offer",
          statement: "MioPages offers a managed Web Presence service from Launch to Ongoing." },
        { ...intakeOwner, id: siteEvidence, kind: "website-observation", at: "2026-11-10",
          reference: "docs/c0-adaptive-onboarding-walkthrough.md",
          statement: "The legacy site markets standalone hosting and website services." },
        { ...intakeOwner, id: reviewEvidence, kind: "synthetic-review", at: "2026-11-10",
          reference: "Disposable Review", reviewDigest: review.request.digest,
          statement: "The fixture Review recommends clarifying what a qualified prospect should do next." },
      ],
      gaps: [{ id: "launch-handoff", questionPurpose: "Learn which Launch handoff to explain first.",
        sourceIds: [brief, siteEvidence, reviewEvidence], known: ["What do you offer?"] }],
    };
    const provider: QuestionProvider = {
      version: "c0-spine-deterministic/1",
      async propose(context) {
        assert.equal(context.evidence.some(item => item.id === reviewEvidence), entry.source.path === "FREE_REVIEW");
        const sources = context.evidence.map(item => item.id);
        const previous = context.history.at(-1);
        if (!previous) return { question: "Which prospective customer needs clearer Launch guidance first?",
          rationale: "Explain the handoff within the confirmed managed-service offer.", sourceIds: sources, assessment: null };
        const existing = previous.answer?.text === "Prospects who already have a website.";
        return {
          question: existing ? "Which existing pages or tools should they flag during the first conversation?"
            : "Which business material can a founder bring to the first conversation?",
          rationale: "Ask about the starting point identified in the saved answer.",
          sourceIds: [...sources, previous.id + ":answer"],
          assessment: { recommendation: existing ? "Lead with the existing-website handoff." : "Lead with preparing business information.",
            evidenceNeeded: existing ? null : "Confirm which materials the customer can provide." },
        };
      },
    };
    const makeEngine = (intelligentFixtureSchema: string) => new IntelligentOnboarding(activation,
      new IntakeService(fixture.pool, intakeOwner, { database, answers: {}, provenance: {}, intelligentFixtureSchema }),
      sources, provider);
    const engine = makeEngine(fixture.schema);
    if (entry.source.path === "FREE_REVIEW") {
      await assert.rejects(engine.open(access), /Commercial confirmation/);
      await activation.update(prerequisite.context, entry.id, entry.scope, entry.version, randomUUID(), "confirm-commercial", {
        source: "agreement-order", reference: "Disposable fixture only", confirmedAt: new Date().toISOString(),
        launchScope: "Local rehearsal", ongoingScope: "Local rehearsal",
      });
    }
    await assert.rejects(engine.open({ ...access, context: {} }), /scoped operator/);
    const wrongScope = fixture.grantScopes([{ ...entry.scope, managedSiteId: randomUUID() }], ["draft-onboarding"]);
    await assert.rejects(engine.open({ ...access, context: wrongScope }), /scoped operator/);
    await assert.rejects(makeEngine(`canonical_test_${"0".repeat(32)}_intake`).open(access), /unavailable/);
    const opened = await engine.open(access);
    const asked = await engine.propose(access, opened.version, "launch-handoff");
    const first = asked.state.turns[0];
    await engine.answer(access, asked.version, first.id, "provided", answer);
    const answered = await engine.resume(access);
    await assert.rejects(engine.propose(access, asked.version, "launch-handoff"), /draft_changed/);
    await engine.propose(access, answered.version, "launch-handoff");
    const readback = await engine.resume(access);
    const [saved, followUp] = readback.state.turns;
    assert.equal(saved.answer?.text, answer);
    assert.equal(followUp.respondsTo, saved.id + ":answer");
    assert.equal(readback.readiness[0].publication, "separate-approval-required");
    return { caseId: entry.id, path: entry.source.path, submissionDigest: entry.source.digest,
      reviewDigest: entry.review?.digest ?? null, draftVersion: readback.version, draftDigest: fingerprint(readback.state),
      answerRef: followUp.respondsTo, question: saved.question, answer: saved.answer?.text,
      followUp: followUp.question, finding: readback.readiness[0] };
  };
  const direct = await walk(directCase, "Prospects who already have a website.");
  const reviewLed = await walk(created, "Founders who are starting without a website.");
  assert.equal(direct.finding.status, "planning-review");
  assert.equal(reviewLed.finding.status, "open");
  assert.notEqual(direct.finding.recommendation, reviewLed.finding.recommendation);
  assert.notEqual(direct.followUp, reviewLed.followUp);
  return { direct, reviewLed };
}

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export async function writeC0SpineReview(
  interview: Awaited<ReturnType<typeof c0SpineInterview>>,
  evidence: Record<string, string | number>, stagedIntro: string,
) {
  const directory = await mkdtemp(path.resolve("runtime-content/c0-spine-review-"));
  const file = path.join(directory, "index.html");
  const fields = (record: Record<string, unknown>) => "<dl>" + Object.entries(record)
    .map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join("") + "</dl>";
  const interviewDetails = (entry: typeof interview.direct) => fields({
    "Question": entry.question, "Saved answer": entry.answer, "Follow-up": entry.followUp,
    "Operator finding": entry.finding.recommendation, "Readiness": entry.finding.status,
    "Evidence still needed": entry.finding.evidenceNeeded ?? "Ready for planning review",
    "Case": entry.caseId, "Intake submission digest": entry.submissionDigest,
    "Review digest": entry.reviewDigest ?? "Direct start", "Draft version": entry.draftVersion,
    "Draft digest": entry.draftDigest, "Answer reference": entry.answerRef, "Finding sources": entry.finding.sourceIds.join(", "),
  });
  await writeFile(file, `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
<title>MioPages · Private C0 rehearsal</title><style>
body{margin:0;background:#f3f6fa;color:#182637;font:1rem/1.55 system-ui}main{max-width:52rem;margin:auto;padding:1.5rem}
h1,h2,h3{line-height:1.2}section,article{background:white;border:1px solid #d6dfe9;border-radius:.8rem;padding:1.2rem;margin:1rem 0}
nav{display:flex;flex-wrap:wrap;gap:1rem}a{color:#075581}dt{font-weight:700}dd{margin:0 0 .5rem;overflow-wrap:anywhere}
summary{cursor:pointer;font-weight:700}.status{color:#174e48;font-weight:700}</style></head>
<body><main><p>MioPages · Operator evidence · Simulated identity</p><h1>From onboarding answer to private page review</h1>
<p>Local evidence snapshot from a completed disposable test. The question provider and network transport were simulated. Core approval, signing, WordPress storage, rendering and receipt checks ran against real local components.</p>
<nav aria-label="Walkthrough"><a href="#interview">1. Interview</a><a href="#operator">2. Operator</a><a href="#customer">3. Customer preview</a></nav>
<section id="interview"><h2>1. Interview</h2><p>Managed Launch and Ongoing came from the C0 brief. Both answers below are rehearsal inputs and remain staged.</p>
<details open><summary>Direct start · delivered path</summary>${interviewDetails(interview.direct)}</details>
<details><summary>Free Review · comparison path</summary>${interviewDetails(interview.reviewLed)}</details></section>
<section id="operator"><h2>2. Operator decision</h2><p>Emphasize the existing-website starting point. Use an already confirmed public fixture fact for the body copy. Distinct authenticated fixture principals authored, approved and independently reviewed the proposal.</p>
<details><summary>Version, authority and receipt evidence</summary>${fields(evidence)}</details></section>
<section id="customer"><h2>3. Customer preview</h2><p class="status">Technical stage passed · Ready for review</p>
<p>Exact staged Service Intro at capture time. Whole-site approval is pending. This record is read-only and does not represent current release eligibility after teardown.</p>
${stagedIntro}<p>Example Ongoing question: Are prospects with existing sites finding the right next step? No traffic or lead counts were collected.</p>
</section></main></body></html>`, { flag: "wx", mode: 0o600 });
  return file;
}
