import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { IntakeService, newResumeToken } from "../../lib/platform/intake/service";
import { prepareC2 } from "../../scripts/intake/adaptive-sources";
import { protectedInquiry } from "../../lib/platform/contact/protected-inquiry";
import { protectedDevelopmentDraft } from "../../lib/platform/wordpress-delivery/cycle-measurement";
import { interviewDirection } from "../../lib/platform/intake/interview-direction";
import { fingerprint } from "../../lib/platform/canonical/model";
import { ProtectedSitePlanning, reviewedSitePlanning } from "../../lib/platform/intake/protected-site-planning";
import { prepareSitePlanning, readSitePlanning } from "../../lib/platform/intake/site-planning";
import { prepareGeneratedPages } from "../../lib/platform/content-editing/prospect-proposal";
import { ProtectedInterview } from "../../lib/platform/intake/protected-interview";

test("Core development policy confines the existing draft writer to the inactive fixture", async () => {
  const cluster = await disposableCluster(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const admin = new Pool({ connectionString: cluster.url });
  const selection = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
  const org = randomUUID();
  const url = new URL(cluster.url);
  url.username = "miopages_core_development";
  const password = randomUUID();
  url.password = password;
  const role = new Pool({ connectionString: url.href, options: "-c search_path=miopages_core_guard,miopages_wp,public" });
  try {
    await migrateWithBootstrapCompatibility(admin);
    await admin.query("CREATE SCHEMA miopages_wp");
    await admin.query(`CREATE ROLE miopages_core_development LOGIN NOINHERIT PASSWORD '${password}'`);
    // Minimal read dependencies mirror the adapter tables. The actual intake,
    // constraints and trigger code come from the existing migrations.
    await admin.query(`CREATE TABLE miopages_wp.wordpress_operator_credentials
      (id uuid, token_sha256 text, expires_at timestamptz, revoked_at timestamptz);
      CREATE TABLE miopages_wp.wordpress_operator_grants
      (id uuid, operator_id uuid, web_presence_id uuid, managed_site_id uuid, permission text, customer jsonb, revoked_at timestamptz)`);
    await admin.query("INSERT INTO organizations(id,name,status) VALUES ($1,'Fixture','inactive')", [org]);
    await admin.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES ($1,$2,'Fixture','inactive')", [selection.webPresenceId, org]);
    await admin.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES ($1,$2,'Fixture','inactive')", [selection.managedSiteId, selection.webPresenceId]);
    // Exercise the real draft table and trigger. The activation binding is a
    // read-only dependency here and is already covered by its own suite.
    await admin.query(`ALTER TABLE public.activation_customer_bindings RENAME TO original_activation_customer_bindings;
      CREATE TABLE public.activation_customer_bindings (managed_site_id uuid, web_presence_id uuid, organization_id uuid)`);
    await admin.query("INSERT INTO public.activation_customer_bindings VALUES ($1,$2,$3)", [selection.managedSiteId, selection.webPresenceId, org]);
    await admin.query(await readFile("lib/platform/intake/protected-core-policy.sql", "utf8"));
    assert.equal((await role.query("SELECT count(*)::int AS n FROM miopages_wp.core_development_scope")).rows[0].n, 1);
    const service = new IntakeService(role, selection, { database: url.pathname.slice(1), answers: {}, provenance: {},
      prepared: prepareC2(), step: 3, protectedScope: async db => { await db.query("SET search_path TO miopages_core_guard, miopages_wp, public"); } });
    const token = newResumeToken();
    const result = await service.create(token, "DIRECT_START");
    assert.equal(result.version, 2);
    assert.deepEqual(await service.create(token, "DIRECT_START"), result);
    const evidence = [{ id: "offer", kind: "owner-confirmed" as const, at: "2026-11-13", reference: "Fictional policy test",
      statement: "Customers can ask about an existing website." }];
    let dispatches = 0;
    const interview = new ProtectedInterview(service, { version: "offline-policy-test", async propose(context) {
      dispatches++;
      const previous = context.history.at(-1);
      return previous ? { question: previous.replacesAnswerTo ? "When does the team need the site address?" : "Who checks whether a migration is suitable?", rationale: "Determine who handles the next step.",
        sourceIds: ["offer", previous.id + ":answer"],
        assessment: { recommendation: previous.answer?.text?.includes("visitor goal") ? "Lead with the visitor goal and defer the address." : "Ask for the current website address before discussing migration.", evidenceNeeded: "Identify the reviewer." },
        presencePlan: previous.replacesAnswerTo ? null : { positioning: "Keep a useful existing site during a migration review", offering: "Migration review",
          audience: "Businesses with an existing website", pages: [{ path: "/", title: previous.answer?.text?.includes("visitor goal") ? "Start with your visitor goal" : "Plan your move", purpose: "Explain the handoff",
            seoDescription: "Plan a website migration review.", action: "Bring your current site address",
            sections: [{ heading: "Start with the site you have", body: "Share the existing website address for review." }] }] } }
        : { question: "What should someone bring to discuss their current website?", rationale: "Identify what is needed for the handoff.",
          sourceIds: ["offer"], assessment: null };
    } }, evidence);
    const asked = await interview.next(token, result.version);
    const first = asked.interview!.turns[0];
    await assert.rejects(interview.next(token, asked.version), /question_unavailable/);
    const answered = await interview.answer(token, asked.version, first.id, "Bring the current website address.");
    assert.equal(dispatches, 1);
    const followed = await interview.next(token, answered.version);
    assert.equal(followed.interview?.turns[1].respondsTo, first.id + ":answer");
    assert.match(followed.interview?.turns[1].assessment?.recommendation ?? "", /migration/);
    assert.deepEqual(await service.resume(token), followed);
    const finding = followed.interview!.turns[1];
    const plan = finding.presencePlan!;
    assert.equal(plan.pages[0].action, "Bring your current site address");
    await assert.rejects(interview.editPlan(token, followed.version, first.id, plan), /draft_changed/);
    const edited = await interview.editPlan(token, followed.version, finding.id, {
      ...plan, pages: plan.pages.map(page => ({ ...page, title: "Review your website move" })),
    });
    assert.equal(edited.interview?.reviewedPlan?.plan.pages[0].title, "Review your website move");
    assert.equal(edited.interview?.turns[1].presencePlan?.pages[0].title, "Plan your move");
    assert.deepEqual(await service.resume(token), edited);
    const corrected = await interview.correctAnswer(token, edited.version, first.id, "Bring only the visitor goal.");
    assert.equal(corrected.interview?.turns[0].answer?.text, "Bring the current website address.");
    assert.equal(corrected.interview?.turns.at(-1)?.replacesAnswerTo, first.id);
    assert.equal(interviewDirection(corrected.interview!.turns), null);
    assert.deepEqual(await interview.correctAnswer(token, corrected.version, corrected.interview!.turns.at(-1)!.id,
      "Bring only the visitor goal."), corrected);
    await assert.rejects(interview.editPlan(token, corrected.version, finding.id, plan), /draft_changed/);
    const rechecked = await interview.next(token, corrected.version);
    assert.equal(rechecked.interview?.turns.at(-1)?.respondsTo, corrected.interview!.turns.at(-1)!.id + ":answer");
    assert.match(interviewDirection(rechecked.interview!.turns)?.recommendation ?? "", /defer the address/);
    assert.equal(interviewDirection(rechecked.interview!.turns)?.plan, undefined);
    const currentFinding = rechecked.interview!.turns.at(-1)!;
    const operatorPlan = { ...plan, pages: plan.pages.map(page => ({ ...page, title: "Start with your visitor goal" })) };
    const authored = await interview.editPlan(token, rechecked.version, currentFinding.id, operatorPlan);
    assert.equal(authored.interview?.reviewedPlan?.origin, "operator");
    assert.equal(authored.interview?.reviewedPlan?.plan.pages[0].title, "Start with your visitor goal");
    assert.equal(authored.interview?.turns.at(-1)?.presencePlan, undefined);
    assert.deepEqual(await service.resume(token), authored);


    const source = { id: "tree-routes", kind: "synthetic-review" as const, reference: "Fictional C2 policy test",
      at: "2026-11-13", statement: "Storm damage needs triage. Routine pruning needs an estimate. Hours and coverage are unverified." };
    const draft = {
      plan: { positioning: "Tree work with appropriate triage", offering: "Storm assessment and routine pruning", audience: "People managing trees on their property",
        pages: [
          { path: "/", title: "Tree care", purpose: "Choose based on urgency", seoDescription: "Options for tree care and storm damage.", action: "Check storm damage next steps",
            sections: [{ heading: "Start with the situation", body: "Storm damage and routine pruning need different information." }] },
          { path: "/storm", title: "Storm damage", purpose: "Explain information needed for triage", seoDescription: "Prepare for a storm damage assessment.", action: "Request an assessment",
            sections: [{ heading: "Share the location", body: "Describe damage from a safe place." }] },
          { path: "/pruning", title: "Planned pruning", purpose: "Prepare a routine estimate", seoDescription: "Plan a pruning estimate for your property.", action: "Request a pruning estimate",
            sections: [{ heading: "Tell us about the trees", body: "Share the number and general location of trees in the request." }] },
        ] },
      directionSourceIds: [source.id], unresolved: ["Emergency coverage and hours are unknown."],
      pages: [
        { path: "/", sourceIds: [source.id], sectionSourceIds: [[source.id]], actionKind: "learn", destination: "/storm" },
        { path: "/storm", sourceIds: [source.id], sectionSourceIds: [[source.id]], actionKind: "request-contact", destination: null },
        { path: "/pruning", sourceIds: [source.id], sectionSourceIds: [[source.id]], actionKind: "request-contact", destination: null },
      ],
    };
    const ownerDigest = fingerprint(selection), expiresAt = Date.now() + 60_000;
    const planning = new ProtectedSitePlanning(service, { model: "offline-test",
      async input() { return prepareSitePlanning(ownerDigest, [source], [], {
        ownerDigest, expiresAt, evidenceDigest: fingerprint([source]), approvedAnswerDigests: [],
      }); },
      async generate(input) { return readSitePlanning(draft, await input()); },
    });
    await assert.rejects(new ProtectedSitePlanning(service).generate(token, authored.version), /ai_authorization_required/);
    const generated = await planning.generate(token, authored.version);
    const resumed = await service.resume(token);
    assert.deepEqual(resumed, generated);
    assert.equal(resumed.interview?.reviewedPlan?.origin, "operator");
    const original = reviewedSitePlanning(resumed.sitePlanning!.proposal!);
    assert.deepEqual(original.plan.pages.map(page => page.path), ["/", "/storm", "/pruning"]);
    assert.equal(original.actions[1].destination, null);
    assert.equal(resumed.provenance?.protectedSitePlanning, undefined);
    await assert.rejects(planning.delivery(token, resumed.version), /authorization_required/);
    const actor = { operatorId: randomUUID(), authorityReference: randomUUID() };
    const rejected = await planning.decide(token, resumed.version, original.digest, "rejected", "Resolve contact paths.", actor);
    const editedPlan = structuredClone(original.plan);
    editedPlan.pages[1].title = "Assess storm damage";
    await assert.rejects(planning.edit(token, resumed.version, original.digest, editedPlan, {}), /draft_changed/);
    const revised = await planning.edit(token, rejected.version, original.digest, editedPlan,
      { "/": "/storm", "/storm": "/", "/pruning": "/" });
    const revisedPlan = reviewedSitePlanning(revised.sitePlanning!.proposal!);
    assert.equal(revisedPlan.decision, undefined);
    assert.equal(revised.sitePlanning?.proposal?.generated.plan.pages[1].title, "Storm damage");
    const approved = await planning.decide(token, revised.version, revisedPlan.digest, "approved", "Reviewed draft destinations.", actor);
    const { packet, digest } = await planning.delivery(token, approved.version);
    assert.equal(packet.plan.pages[1].title, "Assess storm damage");
    assert.equal(packet.actions[0].destination, "/storm");
    assert.deepEqual(packet.decision.actor, actor);
    const mappings = packet.plan.pages.map((page, index) => ({
      page: { operation: "create-page", slug: page.path, pageId: randomUUID(), purpose: "Scoped test",
        title: { kind: "canonical", source: { domain: "knowledge", recordId: randomUUID(), revision: 1, fingerprint: "a".repeat(64), field: "offer" } },
        sections: [{ id: randomUUID(), type: "intro", heading: { kind: "editorial", text: "Business details", rationale: "Policy test" },
          text: { kind: "canonical", source: { domain: "knowledge", recordId: randomUUID(), revision: 1, fingerprint: "a".repeat(64), field: "offer" } } }] },
      sectionIds: page.sections.map(() => randomUUID()), action: { id: randomUUID(), type: "page", destination: packet.actions[index].destination },
    }));
    assert.deepEqual(prepareGeneratedPages(packet, digest, mappings).navigation, ["/", "/storm", "/pruning"]);
    assert.throws(() => prepareGeneratedPages(packet, digest, mappings.map(m => ({ ...m, action: { ...m.action, destination: "/pruning" } }))), /mapping differs/);
    const changed = await interview.correctAnswer(token, approved.version, corrected.interview!.turns.at(-1)!.id, "Prioritize a new visitor action.");
    await assert.rejects(planning.delivery(token, changed.version), /draft_changed/);

    await admin.query(await readFile("lib/platform/intake/protected-core-inquiry.sql", "utf8"));
    assert.equal((await protectedInquiry(role, selection, protectedDevelopmentDraft)).accepted, 0);
    const submitted = await Promise.all([protectedInquiry(role, selection, protectedDevelopmentDraft, true),
      protectedInquiry(role, selection, protectedDevelopmentDraft, true)]);
    assert.deepEqual(submitted[0], submitted[1]);
    assert.equal(submitted[0].accepted, 1);
    assert.equal(submitted[0].source, "synthetic-development");
    assert.ok(submitted[0].recommendation?.evidenceId);
    const row = (await admin.query("SELECT id, delivery_status FROM public.contact_submissions")).rows[0];
    assert.deepEqual(row, { id: submitted[0].recommendation?.evidenceId, delivery_status: "disabled" });
    await assert.rejects(protectedInquiry(role, { ...selection, managedSiteId: randomUUID() }, protectedDevelopmentDraft, true), /check option/);
    await assert.rejects(protectedInquiry(role, selection, { ...protectedDevelopmentDraft, revision: 4 }, true), /check option/);
    await assert.rejects(role.query("SELECT * FROM public.contact_submissions"), /permission denied/);
    await assert.rejects(role.query("UPDATE miopages_wp.core_development_inquiries SET delivery_status='pending'"), /permission denied/);
    await assert.rejects(role.query("SELECT * FROM public.prospect_intakes"), /permission denied/);
    await assert.rejects(role.query("DELETE FROM miopages_wp.core_development_drafts"), /permission denied/);
    await assert.rejects(role.query("UPDATE miopages_wp.core_development_drafts SET web_presence_id=$1", [randomUUID()]), /permission denied/);
    await assert.rejects(role.query("UPDATE miopages_wp.core_development_drafts SET state='needs_operator_review'"), /permission denied/);
    await assert.rejects(role.query(`INSERT INTO miopages_wp.core_development_drafts
      (web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at)
      VALUES($1,$2,'DIRECT_START','paid-onboarding/2',$3,now(),now())`,
    [randomUUID(), selection.managedSiteId, "f".repeat(64)]), /check option|owner mismatch/);
  } finally {
    await role.end();
    await admin.end();
    await cluster.stop();
  }
});
