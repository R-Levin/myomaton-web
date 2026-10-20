import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { siteProposalFixture, writeProposalProof } from "../../scripts/site-proposals/disposable";
import { fingerprint } from "../../lib/platform/canonical/model";
import { writeOnboardingCanonical } from "../../lib/platform/canonical/writes";
import { SiteProposalService } from "../../lib/platform/content-editing/proposals";
import { proposalRoot } from "../../lib/platform/content-editing/proposal-store";
import type { Binding, Copy, PageProposal } from "../../lib/platform/content-editing/proposal";
import { customerTables } from "../../lib/platform/customer-initialization";

test("site proposals: disposable confirmed source, isolated candidate, exact human approval and immutable history", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url, "Isolated PostgreSQL URL required");
  const old = { NODE_ENV: process.env.NODE_ENV, MIOPAGES_REVIEW_SYNTHESIS: process.env.MIOPAGES_REVIEW_SYNTHESIS, MIOPAGES_SITE_PROPOSALS: process.env.MIOPAGES_SITE_PROPOSALS };
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator", MIOPAGES_SITE_PROPOSALS: "local-operator" });
  const f = await siteProposalFixture(url), svc = f.service, id = randomUUID(), createRequest = randomUUID();
  const databaseState = async () => {
    const rows: Record<string, unknown> = {};
    for (const table of [...customerTables, "activation_cases", "activation_case_events", "activation_customer_bindings", "prospect_intakes", "prospect_intake_submissions"])
      rows[table] = (await f.pool.query(`SELECT to_jsonb(t) r FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    return fingerprint(rows);
  };
  let baseline: string;
  let first: Binding, preview: Awaited<ReturnType<typeof svc.preview>>;
  try {
    baseline = await databaseState();
    await t.test("requires exact owned confirmed immutable facts; intake, Review and arbitrary actor strings refuse", async () => {
      for (const kind of ["intake", "review", "unconfirmed"])
        await assert.rejects(svc.prepare(f.operator, randomUUID(), f.scope, randomUUID(), { ...f.page, title: { kind, text: "Unconfirmed input" } as unknown as Copy }));
      await assert.rejects(svc.prepare("operator-name-is-not-authority", id, f.scope, randomUUID(), f.page), /authority/);
      const wrong = { ...f.scope, webPresenceId: randomUUID() };
      await assert.rejects(svc.prepare(f.operator, id, wrong, randomUUID(), f.page), /authority/);
      const forged = structuredClone(f.page); forged.sections[0].heading = { kind: "canonical", source: { ...(f.fact(1, "name") as Extract<Copy, { kind: "canonical" }>).source, recordId: randomUUID() } };
      await assert.rejects(svc.prepare(f.operator, randomUUID(), f.scope, randomUUID(), forged), /owned canonical/);
      const editorial = { ...f.page, sections: [{ ...f.page.sections[0], heading: f.editorial("A headline"), text: f.editorial("No factual sources") }] };
      await assert.rejects(svc.prepare(f.operator, randomUUID(), f.scope, randomUUID(), editorial), /confirmed canonical/);
      const publicPool = new Pool({ connectionString: url });
      try { await assert.rejects(new SiteProposalService(publicPool, f.authority).prepare(f.operator, randomUUID(), f.scope, randomUUID(), f.page), /disposable schema/); } finally { await publicPool.end(); }
    });
    await t.test("candidate creation/retry has immutable identity, complete source receipts and zero database mutations", async () => {
      const created = await svc.prepare(f.operator, id, f.scope, createRequest, f.page); first = created.revision!.binding;
      assert.deepEqual(await svc.prepare(f.operator, id, f.scope, createRequest, f.page), created);
      await assert.rejects(svc.prepare(f.operator, id, f.scope, createRequest, { ...f.page, purpose: "Changed retry" }), /idempotency conflict/);
      assert.equal(first.revision, 1); assert.equal(await databaseState(), baseline);
      const state = await svc.inspect(f.operator, id, f.scope); assert.equal(state.published, false); assert.equal(state.stale, false); assert.equal(state.approvalValid, false);
      assert.equal(state.revisions[0].resolved.filter(r => r.origin.kind === "canonical").length, 4);
      assert.equal((await f.pool.query("SELECT count(*)::int n FROM pages WHERE managed_site_id=$1", [f.scope.managedSiteId])).rows[0].n, 0);
      const foreignScope = { ...f.scope, managedSiteId: randomUUID() };
      await assert.rejects(svc.inspect(f.grant(["inspect-site-proposal"], undefined, foreignScope), id, foreignScope), /Broken proposal revision/);
    });
    await t.test("full shared-renderer preview is readable, inert, exact and separate from active routes", async () => {
      const requestId = randomUUID(); preview = await svc.preview(f.operator, first, requestId);
      assert.deepEqual(await svc.preview(f.operator, first, requestId), preview);
      for (const value of ["Business advisory", "Independent regional businesses", "Confirmed business planning", "Editorial judgment", "Confirmed canonical", "Private development proposal"]) assert.ok(preview.html.includes(value), value);
      assert.doesNotMatch(preview.html, /<form|<script|<a /); assert.equal(await databaseState(), baseline);
    });
    const approvalRequest = () => ({ binding: first, requestId: randomUUID(), previewDigest: preview.digest, previewEvent: preview.event, reference: "Synthetic exact human approval" });
    await t.test("operator-only or forged customer approval, changed digest, destination and missing preview refuse", async () => {
      await assert.rejects(svc.approve(f.operator, approvalRequest()), /authority/);
      await assert.rejects(svc.approve(f.grant(["approve-site-proposal"]), approvalRequest()), /object/);
      await assert.rejects(svc.approve(f.approver, { ...approvalRequest(), customer: { subjectId: "spoofed" } } as unknown as ReturnType<typeof approvalRequest>), /Unknown/);
      await assert.rejects(svc.approve(f.approver, { ...approvalRequest(), binding: { ...first, digest: "0".repeat(64) } }), /Stale/);
      await assert.rejects(svc.approve(f.approver, { ...approvalRequest(), previewDigest: "0".repeat(64) }), /preview/);
      await assert.rejects(svc.approve(f.approver, { ...approvalRequest(), previewEvent: "0".repeat(64) }), /preview/);
      await assert.rejects(svc.approve(f.approver, { ...approvalRequest(), binding: { ...first, scope: { ...f.scope, managedSiteId: randomUUID() } } }), /authority/);
      assert.equal((await svc.inspect(f.operator, id, f.scope)).state, "PROPOSED");
    });
    await t.test("approval records customer representative separately from operator and does not publish", async () => {
      const input = approvalRequest(), approved = await svc.approve(f.approver, input);
      assert.deepEqual(await svc.approve(f.approver, input), approved);
      await assert.rejects(svc.approve(f.approver, { ...input, reference: "Conflicting retry" }), /idempotency conflict/);
      assert.equal(approved.approval!.customer.kind, "business-representative"); assert.notEqual(approved.approval!.customer.subjectId, approved.actor.operatorId);
      const state = await svc.inspect(f.operator, id, f.scope); assert.equal(state.approvalValid, true); assert.equal(state.approval!.binding.digest, first.digest);
      assert.equal((await svc.preview(f.operator, first, randomUUID())).html, preview.html);
      await assert.rejects(svc.publish(), /not implemented/); assert.equal(await databaseState(), baseline);
    });
    await t.test("changed site base invalidates approval; explicit new revision/review is required", async () => {
      await f.pool.query("UPDATE managed_sites SET name='Changed disposable baseline' WHERE id=$1", [f.scope.managedSiteId]);
      const changed = await svc.inspect(f.operator, id, f.scope); assert.equal(changed.stale, true); assert.equal(changed.approvalValid, false);
      await assert.rejects(svc.preview(f.operator, first, randomUUID()), /Stale site base/);
      await assert.rejects(svc.approve(f.approver, approvalRequest()), /already approved|Stale site base/);
      const edited = { ...f.page, title: f.editorial("Revised editorial direction") };
      const next = await svc.prepare(f.operator, id, f.scope, randomUUID(), edited, first);
      const current = next.revision!.binding; assert.equal(current.revision, 2); assert.notEqual(current.digest, first.digest); assert.notEqual(current.baseFingerprint, first.baseFingerprint);
      const state = await svc.inspect(f.operator, id, f.scope); assert.equal(state.state, "PROPOSED"); assert.equal(state.approval, null); assert.equal(state.events.filter(e => e.approval).length, 1); assert.deepEqual(state.revisions[0].binding, first);
      await assert.rejects(svc.preview(f.operator, first, randomUUID()), /Stale proposal/);
      await assert.rejects(svc.approve(f.approver, approvalRequest()), /Stale proposal/);
      await assert.rejects(svc.prepare(f.operator, id, f.scope, randomUUID(), edited, first), /Stale proposal/);
      const beforeProof = await databaseState(), proof = await writeProposalProof(f, id);
      assert.equal(proof.state, "APPROVED"); assert.equal(proof.approvalValid, true); assert.equal(await databaseState(), beforeProof);
    });
    await t.test("unapproved stale site content and competing revisions refuse; exact latest Page replacement is isolated", async () => {
      const other = randomUUID(), start = await svc.prepare(f.operator, other, f.scope, randomUUID(), f.page), bound = start.revision!.binding, rendered = await svc.preview(f.operator, bound, randomUUID());
      await f.pool.query("INSERT INTO pages(id,managed_site_id,slug,name,title,status) VALUES($1,$2,'/','Synthetic existing','Existing title','inactive')", [f.page.pageId, f.scope.managedSiteId]);
      await assert.rejects(svc.approve(f.approver, { binding: bound, requestId: randomUUID(), previewDigest: rendered.digest, previewEvent: rendered.event, reference: "Stale page test" }), /Stale site base/);
      const replacement: PageProposal = { ...f.page, operation: "replace-page" };
      const results = await Promise.allSettled([svc.prepare(f.operator, other, f.scope, randomUUID(), replacement, bound), svc.prepare(f.operator, other, f.scope, randomUUID(), { ...replacement, purpose: "Concurrent edit" }, bound)]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.filter(r => r.status === "rejected").length, 1);
      const updated = await svc.inspect(f.operator, other, f.scope), r = updated.revisions.at(-1)!;
      assert.equal((await svc.preview(f.operator, r.binding, randomUUID())).html.includes("Replacement Page"), true);
      assert.equal((await f.pool.query("SELECT title FROM pages WHERE id=$1", [f.page.pageId])).rows[0].title, "Existing title");
      await f.pool.query("UPDATE pages SET title='Newer content' WHERE id=$1", [f.page.pageId]);
      await assert.rejects(svc.preview(f.operator, r.binding, randomUUID()), /Stale site base/);
    });
    await t.test("provisional canonical revisions refuse even when owned and exact; history corruption fails closed", async () => {
      const current = (await f.canonical(0))!, owner = (await f.pool.query("SELECT organization_id FROM web_presences WHERE id=$1", [f.scope.webPresenceId])).rows[0].organization_id;
      const payload = structuredClone(current.row.payload); payload.entries[0].evidence = { sourceKind: "operator", sourceReference: "Synthetic unconfirmed context", confirmation: "provisional", visibility: "internal" };
      payload.approval.at = new Date().toISOString();
      await writeOnboardingCanonical(f.pool, { domain: "knowledge", id: current.row.id, webPresenceId: f.scope.webPresenceId, expectedVersion: current.row.version, expectedFingerprint: current.fingerprint, payload, responsibleIdentity: payload.approval.by, changeReason: "Synthetic provisional source refusal proof" }, { caseId: f.caseId, organizationId: owner, ...f.scope });
      const provisional = (await f.canonical(0))!, input = structuredClone(f.page); input.pageId = randomUUID(); input.slug = "/other";
      input.sections[1].text = { kind: "canonical", source: { domain: "knowledge", recordId: provisional.row.id, revision: provisional.row.version, fingerprint: provisional.fingerprint, field: "audience" } };
      await assert.rejects(svc.prepare(f.operator, randomUUID(), f.scope, randomUUID(), input), /Confirmed Knowledge/);
      const offering = (await f.canonical(1))!, offerPayload = structuredClone(offering.row.payload);
      offerPayload.evidence = { sourceKind: "operator", sourceReference: "Synthetic unconfirmed Offering", confirmation: "provisional", visibility: "internal" };
      offerPayload.approval.at = new Date().toISOString();
      await writeOnboardingCanonical(f.pool, { domain: "offering", id: offering.row.id, webPresenceId: f.scope.webPresenceId, expectedVersion: offering.row.version, expectedFingerprint: offering.fingerprint, payload: offerPayload, offering: { key: offering.row.key, type: offering.row.type, name: offering.row.name, status: "inactive" }, responsibleIdentity: offerPayload.approval.by, changeReason: "Synthetic provisional Offering refusal" }, { caseId: f.caseId, organizationId: owner, ...f.scope });
      const nextOffer = (await f.canonical(1))!, offerInput = structuredClone(input);
      offerInput.sections = [{ ...f.page.sections[0], heading: { kind: "canonical", source: { domain: "offering", recordId: nextOffer.row.id, revision: nextOffer.row.version, fingerprint: nextOffer.fingerprint, field: "name" } }, text: undefined }];
      await assert.rejects(svc.prepare(f.operator, randomUUID(), f.scope, randomUUID(), offerInput), /Confirmed Offering/);
      const file = path.join(proposalRoot(), id, "000001.json"), bytes = await readFile(file); await writeFile(file, bytes.toString().replace("Representative synthetic", "Tampered synthetic"));
      try { await assert.rejects(svc.inspect(f.operator, id, f.scope), /Broken proposal history/); } finally { await writeFile(file, bytes); }
    });
    await f.verify();
  } finally { await f.stop(); Object.assign(process.env, old); }
});
