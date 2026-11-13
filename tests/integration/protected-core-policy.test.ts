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
