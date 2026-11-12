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
import type { Pool } from "pg";
import { contactHttp } from "../../lib/platform/contact/http";
import { acceptContactSubmission } from "../../lib/platform/contact/submissions";
import type { ContactEvents } from "../../lib/platform/contact/boundaries";

export function presenceDirection(interview: Awaited<ReturnType<typeof c0SpineInterview>>) {
  return [interview.direct, interview.reviewLed].map(entry => ({
    path: entry.path, draftDigest: entry.draftDigest, assessment: entry.finding.status,
    audience: entry.finding.recommendation === "Lead with the existing-website handoff."
      ? "Established businesses with an existing website" : "Founders preparing their first website",
    offering: "Managed Web Presence from Launch to Ongoing",
    pages: { home: "Explain the managed service and direct visitors to its details",
      service: entry.finding.recommendation! },
    action: "Ask about your website",
    open: entry.finding.evidenceNeeded ?? "Confirm which existing assets a visitor should bring to the first conversation.",
  }));
}

export async function cycleInquiry(pool: Pool, scope: { webPresenceId: string; managedSiteId: string }) {
  // Private Contact configuration bridge on the same disposable tenant. The
  // signed Intro contract cannot carry a native WordPress form yet.
  const definitionId = randomUUID(), sectionId = randomUUID(), pageId = randomUUID();
  await pool.query("INSERT INTO contact_definitions(id,web_presence_id,name,configuration) VALUES($1,$2,'Local inquiry',$3)",
    [definitionId, scope.webPresenceId, { fields: [{ key: "message", label: "Message", required: true }] }]);
  await pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title) VALUES($1,$2,'/local-inquiry','Local inquiry','Local inquiry')", [pageId, scope.managedSiteId]);
  await pool.query("INSERT INTO sections(id,page_id,type,content) VALUES($1,$2,'contact',$3)", [sectionId, pageId, { contact_definition_id: definitionId }]);
  const fixtureMessage = "I already have a website. Should I send its URL before we talk?";
  const events: Parameters<ContactEvents["accepted"]>[0][] = [];
  const origin = "https://private-cycle.example.test";
  const input = { definitionId, sectionId, version: 1, idempotencyKey: randomUUID(), fields: { message: fixtureMessage } };
  const submit = (selection = scope) => contactHttp(new Request(origin + "/api/contact", { method: "POST",
    headers: { origin, "content-type": "application/json" }, body: JSON.stringify(input) }),
  value => acceptContactSubmission(pool, { ...selection, domain: "private-cycle.example.test", managedSiteName: "Disposable" }, value, {
    abuse: { allow: async () => true }, events: { accepted: async event => { events.push(event); } },
  }));
  const statuses = (await pool.query("SELECT w.status AS presence, m.status AS site FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id WHERE w.id=$1 AND m.id=$2",
    [scope.webPresenceId, scope.managedSiteId])).rows[0];
  try {
    await pool.query("UPDATE web_presences SET status='active' WHERE id=$1", [scope.webPresenceId]);
    await pool.query("UPDATE managed_sites SET status='active' WHERE id=$1", [scope.managedSiteId]);
    assert.equal((await submit({ ...scope, managedSiteId: randomUUID() })).status, 404);
    const accepted = await submit();
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { accepted: true, duplicate: false, successText: "Your message has been received." });
    assert.equal((await (await submit()).json()).duplicate, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].webPresenceId, scope.webPresenceId);
    const row = (await pool.query("SELECT fields, delivery_status FROM contact_submissions WHERE id=$1 AND managed_site_id=$2", [events[0].submissionId, scope.managedSiteId])).rows[0];
    assert.equal(row.delivery_status, "disabled");
    assert.equal(row.fields.message, fixtureMessage);
    const message: string = row.fields.message;
    assert.match(message, /already have a website.*send its URL/i, "Fixture rule needs an accepted request about sharing an existing site address");
    return { message, submissionId: events[0].submissionId, accepted: events.length, notification: row.delivery_status as string,
      recommendation: "Already have a website? Bring its address to the first conversation." };
  } finally {
    await pool.query("UPDATE managed_sites SET status=$2 WHERE id=$1", [scope.managedSiteId, statuses.site]);
    await pool.query("UPDATE web_presences SET status=$2 WHERE id=$1", [scope.webPresenceId, statuses.presence]);
    await pool.query("DELETE FROM sections WHERE id=$1", [sectionId]);
    await pool.query("DELETE FROM pages WHERE id=$1", [pageId]);
  }
}

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
  evidence: Record<string, string | number>, stagedIntro: string, cycle: {
    directions: ReturnType<typeof presenceDirection>;
    home: { html: string; receipt: string; release: string; previewDigest: string };
    inquiry: Awaited<ReturnType<typeof cycleInquiry>>;
    improved: { html: string; receipt: string; release: string; previewDigest: string };
  },
) {
  const directory = await mkdtemp(path.resolve("runtime-content/c0-spine-review-"));
  const file = path.join(directory, "index.html");
  const fields = (record: Record<string, unknown>) => "<dl>" + Object.entries(record)
    .map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join("") + "</dl>";
  const interviewDetails = (entry: typeof interview.direct) => fields({
    "Question": entry.question, "Saved answer": entry.answer, "Follow-up": entry.followUp,
    "Operator finding": entry.finding.recommendation, "Readiness": entry.finding.status,
    "Evidence still needed": entry.finding.evidenceNeeded ?? "Ready for planning review",
  });
  await writeFile(file, `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
<title>MioPages · Private C0 rehearsal</title><style>
body{margin:0;background:#f3f6fa;color:#182637;font:1rem/1.55 system-ui}main{max-width:52rem;margin:auto;padding:1.5rem}
h1,h2,h3{line-height:1.2}section,article{background:white;border:1px solid #d6dfe9;border-radius:.8rem;padding:1.2rem;margin:1rem 0}
nav{display:flex;flex-wrap:wrap;gap:1rem}a{color:#075581}dt{font-weight:700}dd{margin:0 0 .5rem;overflow-wrap:anywhere}
summary{cursor:pointer;font-weight:700}.status{color:#174e48;font-weight:700}</style></head>
<body><main><p>MioPages · Disposable C0-derived rehearsal</p><h1>From onboarding to a better website</h1>
<p>Follow a saved business answer through private staging, a synthetic inquiry and a reviewed improvement. This is a read-only capture of the local run.</p>
<nav aria-label="Walkthrough"><a href="#interview">1. Business knowledge</a><a href="#customer">2. Customer preview</a><a href="#measurement">3. Inquiry and measurement</a><a href="#operator">4. Operator review</a><a href="#after">5. Improved preview</a></nav>
<section id="interview"><h2>1. Interview</h2><p>Managed Launch and Ongoing came from the C0 brief. Both answers below are rehearsal inputs and remain staged.</p>
<details open><summary>Direct start · delivered path</summary>${interviewDetails(interview.direct)}</details>
<details><summary>Free Review · comparison path</summary>${interviewDetails(interview.reviewLed)}</details>
<h3>Proposed Presence Direction · Fixture mapping</h3>
${cycle.directions.map(direction => `<details><summary>${escape(direction.path === "DIRECT_START" ? "Direct start" : "Free Review-led")}</summary>${fields({
  "Audience": direction.audience, "Offering": direction.offering, "Home": direction.pages.home, "Service": direction.pages.service,
  "Visitor action": direction.action, "Still to confirm": direction.open,
})}</details>`).join("")}</section>
<section id="customer"><h2>2. Customer preview</h2><p class="status">Two private page captures ready for review</p>
<p>Home introduces the service. Service explains where an existing website fits. These are separate signed Intro stages. The links below are the local navigation and contact bridge.</p>
<nav aria-label="Candidate navigation"><a href="#home">Home</a><a href="#service">Service</a><a href="#measurement">Ask about your website</a></nav>
<div id="home">${cycle.home.html}</div><div id="service">${stagedIntro}</div></section>
<section id="measurement"><h2>3. Inquiry and measurement · Synthetic</h2>
<p><q>${escape(cycle.inquiry.message)}</q></p>
${fields({ "Accepted inquiries": cycle.inquiry.accepted, "Notifications delivered": "None · delivery disabled",
  "Qualified leads and conversions": "Unknown", "Visits and inquiry rate": "Unavailable", "Source": "One accepted Core Contact event from the local fixture" })}
<p>A single question identifies a point of confusion. It cannot establish how common that confusion is.</p></section>
<section id="operator"><h2>4. Operator review · Fixture decision</h2>
<p>Add an explicit instruction about bringing the existing website address. Preserve the managed-service description. The author, exact preview approver and independent projection reviewer used separate scoped test authority.</p>
<details><summary>Version, authority and receipt evidence</summary>${fields({ ...evidence,
  "Direct draft digest": interview.direct.draftDigest, "Review-led draft digest": interview.reviewLed.draftDigest,
  "Direct assessment sources": interview.direct.finding.sourceIds.join(", "), "Review-led assessment sources": interview.reviewLed.finding.sourceIds.join(", "),
  "Review-led approved fixture Review digest": interview.reviewLed.reviewDigest,
  "Inquiry": cycle.inquiry.submissionId, "Home release": cycle.home.release, "Home receipt": cycle.home.receipt,
  "Service revision 2 preview digest": cycle.improved.previewDigest, "Updated release": cycle.improved.release,
  "Updated receipt": cycle.improved.receipt })}</details></section>
<section id="after"><h2>5. Improved private Service preview</h2>
${cycle.improved.html}
<p><strong>Next measurement.</strong> Check whether future visitors provide a site address without asking what to bring. No follow-up data or effect is recorded.</p>
<p>Customer signoff and publication remain separate decisions. The fixture was disposed after capture.</p>
</section></main></body></html>`, { flag: "wx", mode: 0o600 });
  return file;
}
