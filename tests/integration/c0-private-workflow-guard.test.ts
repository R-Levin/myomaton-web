import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { Pool } from "pg";
import { IntakeService, newResumeToken, resumeHash } from "../../lib/platform/intake/service";
import { ActivationService } from "../../lib/platform/activation/service";
import { fingerprint } from "../../lib/platform/canonical/model";
import { inspectCanonical, writeApprovedInactiveKnowledge } from "../../lib/platform/canonical/writes";
import { managedKey, provisionManagedObject } from "../../lib/platform/assets/local-storage";
import { resolveProposalCandidate } from "../../lib/platform/content-editing/proposal-media";
import { siteBase } from "../../lib/platform/content-editing/proposal-context";
import { durableProposalFingerprint } from "../../lib/platform/content-editing/proposal-postgres";
import { revisionDigest, type Actor, type PageProposal } from "../../lib/platform/content-editing/proposal";
import type { Site } from "../../lib/platform/wordpress-delivery/authority";
import { protectedOperatorServices } from "../../lib/platform/wordpress-delivery/protected-services";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { integratePrivateStage, advanceActiveInstallationOrigin } from "../../scripts/db/wordpress-private-stage";
import { assertC0ProposalGuard, correctedProposalGuardSha256, legacyProposalGuardSha256, proposalGuardState } from "../../scripts/db/c0-proposal-guard-check";
import { exactPacket, stableId } from "../../scripts/wordpress-stage-c0-visual";
import { intakeAnswersV2 } from "../helpers/intake";

const qaRoot = process.env.MIOPAGES_C0_QA_ROOT;
const c0 = { organizationId: "b3b46645-0364-4329-83c7-86a6ea9e56c4",
  webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const installationId = "d84ebc69-46d5-4c64-adc6-ac7b87468f89";
const baseline = "8c342e25aa3c962b98a9292bfd871873aca87364b0a6d44b3be6847c09a11ebd";
const path = "lib/platform/wordpress-delivery/c0-private-workflow-proposal-guard";
const scopeOf = ({ webPresenceId, managedSiteId }: Site) => ({ webPresenceId, managedSiteId });
const label = "Disposable proposal guard check";
const runGuardChange = async (pool: Pool, sql: string) => {
  const db = await pool.connect();
  try { return await db.query(sql); }
  catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
};

async function seedSite(admin: Pool, site: Site) {
  const scope = scopeOf(site);
  await admin.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [site.organizationId, label]);
  await admin.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,$3)", [site.webPresenceId, site.organizationId, label]);
  await admin.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,$3)", [site.managedSiteId, site.webPresenceId, label]);

  const intake = new IntakeService(admin, scope), token = newResumeToken();
  const draft = await intake.create(token, "DIRECT_START");
  const saved = await intake.save(token, draft.version, intakeAnswersV2(), 12);
  await intake.submit(token, saved.version);
  const { rows: [submission] } = await admin.query(
    "SELECT s.id,s.digest FROM prospect_intake_submissions s JOIN prospect_intakes i ON i.id=s.intake_id WHERE i.resume_hash=$1",
    [resumeHash(token)]);
  const actor = { operatorId: "disposable-activation-actor", authorityReference: label };
  const activation = new ActivationService(admin, { authorize: async () => actor },
    { read: async () => { throw Error("No review in this fixture"); } }, async () => {});
  const inputScope = { ...scope, pendingCustomerId: randomUUID() };
  const created = await activation.create({}, { scope: inputScope, requestId: randomUUID(),
    submissionId: submission.id, submissionDigest: submission.digest });
  const at = new Date().toISOString();
  await activation.update({}, created.id, inputScope, 1, randomUUID(), "confirm-commercial",
    { source: "agreement-order", reference: label, confirmedAt: at, launchScope: label, ongoingScope: label });
  const confirmation = { reference: label, confirmedAt: at, confirmedBy: actor.operatorId };
  const identity = { organizationName: label, webPresenceName: label, managedSiteName: label, confirmation };
  const db = await admin.connect();
  try {
    await db.query("BEGIN");
    await db.query("UPDATE organizations SET status='inactive',metadata=$2 WHERE id=$1", [site.organizationId,
      { initialization: { kind: "customer-foundation/1", sourceReference: "activation-case:" + created.id, confirmation } }]);
    await db.query("UPDATE web_presences SET status='inactive' WHERE id=$1", [site.webPresenceId]);
    await db.query("UPDATE managed_sites SET status='inactive' WHERE id=$1", [site.managedSiteId]);
    await db.query("INSERT INTO activation_case_events(case_id,version,request_id,request_digest,operation,actor,authority_reference,at,previous,digest,snapshot) SELECT case_id,3,$2,$3,'initialize-customer',actor,authority_reference,$4,digest,$5,snapshot FROM activation_case_events WHERE case_id=$1 AND version=2",
      [created.id, randomUUID(), fingerprint(["request", created.id]), at, fingerprint(["event", created.id])]);
    await db.query("INSERT INTO activation_customer_bindings(case_id,organization_id,web_presence_id,managed_site_id,event_version,identity,identity_digest) VALUES($1,$2,$3,$4,3,$5,$6)",
      [created.id, site.organizationId, site.webPresenceId, site.managedSiteId, identity, fingerprint(identity)]);
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
  return created.id;
}

async function principal(admin: Pool, site: Site, permissions: string[], lifetime = "1 day") {
  const token = randomBytes(32).toString("hex"), id = randomUUID();
  const grants = new Map(permissions.map(permission => [permission, randomUUID()]));
  await admin.query("INSERT INTO miopages_wp.wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,clock_timestamp()+$3::interval)",
    [id, createHash("sha256").update(Buffer.from(token, "hex")).digest("hex"), lifetime]);
  for (const [permission, grantId] of grants) {
    const mandate = permission === "approve-site-proposal"
      ? { kind: "accepted-authority", subjectId: label, authorityReference: label } : null;
    await admin.query("INSERT INTO miopages_wp.wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission,customer) VALUES($1,$2,$3,$4,$5,$6)",
      [grantId, id, site.webPresenceId, site.managedSiteId, permission, mandate]);
  }
  return { token, id, grants };
}

type Material = { page: PageProposal } & Pick<Awaited<ReturnType<typeof resolveProposalCandidate>>, "candidate" | "resolved">;
async function persist(operator: Pool, site: Site, id: string, author: Actor, material: Material, baseFingerprint = baseline) {
  // Test the real triggers independently of the application replay check. The
  // disposable tenant has different canonical rows from the pinned host base.
  const at = new Date().toISOString();
  const identity = { proposalId: id, scope: scopeOf(site), revision: 1, baseFingerprint };
  const body = { at, author, ...material, base: {} };
  const digest = revisionDigest(body, identity);
  const revision = { binding: { ...identity, digest }, ...body };
  const event = { sequence: 1, previous: null, requestId: randomUUID(), requestDigest: fingerprint(material),
    action: "revise", actor: author, at };
  const data = { ...event, hash: fingerprint({ ...event, revision }) };
  const db = await operator.connect();
  try {
    await db.query("BEGIN");
    await db.query("INSERT INTO site_change_proposals(id,organization_id,web_presence_id,managed_site_id,created_at) VALUES($1,$2,$3,$4,$5)",
      [id, site.organizationId, site.webPresenceId, site.managedSiteId, at]);
    await db.query("INSERT INTO site_change_revisions(proposal_id,revision,digest,base_fingerprint,data,created_at) VALUES($1,1,$2,$3,$4,$5)",
      [id, digest, baseFingerprint, revision, at]);
    await db.query("INSERT INTO site_change_events(proposal_id,sequence,request_id,request_digest,operation,revision,proposal_digest,base_fingerprint,digest,actor,authority_reference,at,data) VALUES($1,1,$2,$3,'revise',1,$4,$5,$6,$7,$8,$9,$10)",
      [id, data.requestId, data.requestDigest, digest, baseFingerprint, data.hash, author.operatorId, author.authorityReference, at, data]);
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}

test("exact private workflow through the installed 0013 guard, grants and paired rollback",
  { timeout: 120_000, skip: !qaRoot && "Protected local packet location is required" }, async t => {
  assert.ok(qaRoot && process.env.WORDPRESS_TEST_PG_BIN);
  const cluster = await disposableCluster(process.env.WORDPRESS_TEST_PG_BIN);
  const url = new URL(cluster.url);
  url.pathname = "/postgres";
  const admin = new Pool({ connectionString: url.toString() });
  const secret = randomBytes(32).toString("hex");
  const poolFor = (role: string) => {
    const login = new URL(url);
    login.username = role;
    login.password = secret;
    return new Pool({ connectionString: login.toString(), options: "-c search_path=miopages_wp,public -c TimeZone=UTC" });
  };
  const migration = poolFor("miopages_migration"), writer = poolFor("miopages_wp_operator");
  try {
    await migrateWithBootstrapCompatibility(admin);
    await admin.query("CREATE ROLE miopages_migration LOGIN PASSWORD '" + secret + "'; CREATE ROLE miopages_wp_operator LOGIN PASSWORD '" + secret + "'; CREATE ROLE miopages_wp_pull LOGIN; CREATE ROLE miopages_runtime LOGIN; CREATE ROLE miopages_backup LOGIN;");
    await admin.query("GRANT CREATE ON SCHEMA public TO miopages_migration; ALTER FUNCTION public.site_proposal_revision_guard() OWNER TO miopages_migration; ALTER TABLE public.site_change_revisions OWNER TO miopages_migration");
    const install = await admin.connect();
    try {
      await install.query("BEGIN");
      await integratePrivateStage(install, "public", true);
      await advanceActiveInstallationOrigin(install);
      await install.query("COMMIT");
    } catch (error) { await install.query("ROLLBACK"); throw error; }
    finally { install.release(); }

    const foreign = { organizationId: randomUUID(), webPresenceId: randomUUID(), managedSiteId: randomUUID() };
    await seedSite(admin, c0);
    const foreignCase = await seedSite(admin, foreign);
    const factAt = new Date().toISOString(), factId = randomUUID();
    await writeApprovedInactiveKnowledge(admin, { domain: "knowledge", id: factId, webPresenceId: foreign.webPresenceId,
      expectedVersion: null, expectedFingerprint: null, responsibleIdentity: label, changeReason: label,
      payload: { entries: [{ key: "fact", kind: "goal", value: label, evidence: { sourceKind: "operator", sourceReference: label,
        confirmation: "confirmed", visibility: "public", confirmedBy: label, confirmedAt: factAt } }],
        identityEvidence: [], approval: { by: label, scope: "public", at: factAt } } },
      { ...foreign, caseId: foreignCase });
    await admin.query("INSERT INTO miopages_wp.wordpress_installations(id,organization_id,web_presence_id,managed_site_id,origin,generation,status) VALUES($1,$2,$3,$4,'https://miopages.org',1,'active')",
      [installationId, c0.organizationId, c0.webPresenceId, c0.managedSiteId]);

    const author = await principal(admin, c0, ["prepare-site-proposal", "preview-site-proposal"]);
    const approver = await principal(admin, c0, ["approve-site-proposal"]);
    const otherAuthor = await principal(admin, foreign, ["prepare-site-proposal", "preview-site-proposal", "inspect-site-proposal"]);
    const otherApprover = await principal(admin, foreign, ["approve-site-proposal"]);
    const expired = await principal(admin, c0, ["prepare-site-proposal", "preview-site-proposal"], "-1 day");
    const noPreview = await principal(admin, c0, ["prepare-site-proposal"]);
    const revoked = await principal(admin, c0, ["prepare-site-proposal", "preview-site-proposal"]);
    await admin.query("UPDATE miopages_wp.wordpress_operator_grants SET revoked_at=now() WHERE id=$1", [revoked.grants.get("preview-site-proposal")]);

    const asActor = (p: typeof author) => ({ operatorId: p.id, authorityReference: p.grants.get("prepare-site-proposal")! });
    const packet = await exactPacket(cluster.root, name => readFile(basename(name) === "manifest.json"
      ? "docs/c0-protected-visual-staging-authorization.json" : join(resolve(qaRoot), basename(name))));
    for (const bytes of packet.mediaBytes.values()) await provisionManagedObject(packet.mediaRoot, c0.webPresenceId, managedKey(bytes), bytes);
    const materials = new Map<string, Material>();
    const projection = await writer.connect();
    try {
      await projection.query("BEGIN READ ONLY");
      const base = await siteBase(projection, scopeOf(c0));
      for (const page of packet.pages) {
        const { candidate, resolved } = await resolveProposalCandidate(projection, scopeOf(c0), page, base,
          undefined, undefined, packet.resolve);
        materials.set(page.slug, { page, candidate, resolved });
      }
    } finally { await projection.query("ROLLBACK"); projection.release(); }
    const home = materials.get("/")!, homeId = stableId(["proposal", "/"]);
    const services = protectedOperatorServices(writer, async () => {}, "https://example.test");
    const connection = await writer.connect();
    const snapshot = async () => {
      const db = await admin.connect();
      try { return await durableProposalFingerprint(db); } finally { db.release(); }
    };
    try {
      const original = await proposalGuardState(admin);
      assert.equal(original.sha256, legacyProposalGuardSha256);
      await assert.rejects(assertC0ProposalGuard(connection), { code: "C0_PROPOSAL_GUARD_0013" });
      const empty = await snapshot();
      const reject = /Site proposal revision\/destination conflict|Exact reviewed private workflow proposal required/u;
      await assert.rejects(persist(writer, c0, homeId, asActor(author), home), reject);
      assert.equal(await snapshot(), empty, "0013 refusal should be atomic");

      const apply = await readFile(path + ".sql", "utf8"), restore = await readFile(path + ".rollback.sql", "utf8");
      await t.test("refuses unauthorized migration and rolls back a failed post-change check", async () => {
        await assert.rejects(runGuardChange(writer, apply), /Exact protected migration role/u);
        assert.equal(fingerprint(await proposalGuardState(admin)), fingerprint(original));
        await assert.rejects(runGuardChange(migration, apply.replace(correctedProposalGuardSha256, "0".repeat(64))), /resulting definition changed/u);
        assert.equal(fingerprint(await proposalGuardState(admin)), fingerprint(original));
        assert.equal(await snapshot(), empty);
      });
      await runGuardChange(migration, apply);
      await assertC0ProposalGuard(connection);
      const installed = await proposalGuardState(admin);
      assert.equal(installed.sha256, correctedProposalGuardSha256);
      assert.deepEqual([installed.fn, installed.trigger], [original.fn, original.trigger]);

      await t.test("refuses wrong caller, tenant, base, bytes, identity, missing or expired grants", async () => {
        const changed = structuredClone(home);
        changed.page.navigationLabel += " changed";
        const changedProjection = structuredClone(home);
        changedProjection.candidate.sections[0].content.heading += " changed";
        const alteredEvidence = structuredClone(home);
        alteredEvidence.page.workflowReview!.candidateDigest = "a".repeat(64);
        const cases = [
          [admin, c0, homeId, asActor(author), home, baseline],
          [writer, c0, randomUUID(), asActor(author), home, baseline],
          [writer, foreign, homeId, asActor(otherAuthor), home, baseline],
          [writer, c0, homeId, asActor(author), home, "0".repeat(64)],
          [writer, c0, homeId, asActor(author), changed, baseline],
          [writer, c0, homeId, asActor(author), changedProjection, baseline],
          [writer, c0, homeId, asActor(author), alteredEvidence, baseline],
          [writer, c0, homeId, asActor(expired), home, baseline],
          [writer, c0, homeId, asActor(noPreview), home, baseline],
          [writer, c0, homeId, asActor(revoked), home, baseline],
        ] as const;
        for (const [pool, site, id, actor, material, base] of cases) {
          await assert.rejects(persist(pool, site, id, actor, material, base), reject);
        }
        const wrong = await services.operator.authenticate(approver.token);
        await assert.rejects(services.proposals(wrong).prepare(wrong, homeId, scopeOf(c0), randomUUID(), home.page), /authorization refused/u);
        await assert.rejects(services.operator.authenticate(expired.token), /authentication refused/u);
        const active = await services.operator.authenticate(author.token);
        await assert.rejects(services.operator.authorize(active, "approve-site-proposal", scopeOf(c0)), /authorization refused/u);
        await assert.rejects(services.operator.authorize(active, "prepare-site-proposal", scopeOf(foreign)), /authorization refused/u);
        assert.equal(await snapshot(), empty);
      });

      await t.test("ordinary canonical proposal and independent exact approval continue through the real service", async () => {
        const identity = await inspectCanonical(admin, "knowledge", foreign.webPresenceId, factId);
        assert.ok(identity);
        const title = { kind: "canonical" as const, source: { domain: "knowledge" as const, recordId: factId,
          field: "fact", revision: identity.row.version, fingerprint: identity.fingerprint } };
        const context = await services.operator.authenticate(otherAuthor.token);
        const approval = await services.operator.authenticate(otherApprover.token);
        const page: PageProposal = { operation: "create-page", pageId: randomUUID(), slug: "/", title, purpose: label,
          sections: [{ id: randomUUID(), type: "intro", heading: title }] };
        const prepared = await services.proposals(context).prepare(context, randomUUID(), scopeOf(foreign), randomUUID(), page);
        const preview = await services.proposals(context).preview(context, prepared.revision!.binding, randomUUID());
        const input = { binding: preview.binding, previewDigest: preview.digest, previewEvent: preview.event, requestId: randomUUID(), reference: label };
        await assert.rejects(services.proposals(context).approve(context, input), /authorization refused/u);
        await services.proposals(approval).approve(approval, input);
        assert.equal((await services.proposals(context).inspect(context, input.binding.proposalId, scopeOf(foreign))).approvalValid, true);
        const invalid = { ...home, page: { ...home.page, workflowReview: undefined, composition: undefined, navigationLabel: undefined } };
        await assert.rejects(persist(writer, foreign, randomUUID(), asActor(otherAuthor), invalid), reject);
        const forged = { ...invalid, resolved: [{ path: "title", value: "Incorrect canonical text", origin: title }] };
        await assert.rejects(persist(writer, foreign, randomUUID(), asActor(otherAuthor), forged), /Confirmed owned Knowledge revision required/u);
      });

      await t.test("rollback refuses further private writes and retains exact append-only history", async () => {
        // Exercise every production pin against the exact attested bytes in the disposable database.
        const values = [...materials.entries()].sort(([a], [b]) => (a === "/" ? 1 : b === "/" ? -1 : 0));
        for (const [route, material] of values) await persist(writer, c0, stableId(["proposal", route]), asActor(author), material);
        assert.equal((await admin.query("SELECT count(*)::int n FROM site_change_proposals WHERE managed_site_id=$1", [c0.managedSiteId])).rows[0].n, 13);
        await assert.rejects(admin.query("UPDATE public.site_change_revisions SET data='{}'::jsonb WHERE proposal_id=$1", [homeId]), /immutable/u);
        await assert.rejects(admin.query("DELETE FROM public.site_change_events WHERE proposal_id=$1", [homeId]), /immutable/u);
        const history = await snapshot();
        await runGuardChange(migration, restore);
        assert.equal(fingerprint(await proposalGuardState(admin)), fingerprint(original));
        await assert.rejects(assertC0ProposalGuard(connection), { code: "C0_PROPOSAL_GUARD_0013" });
        await assert.rejects(persist(writer, c0, randomUUID(), asActor(author), home), reject);
        assert.equal(await snapshot(), history);
        assert.equal((await admin.query("SELECT count(*)::int n FROM public.pages")).rows[0].n, 0);
        assert.equal((await admin.query("SELECT count(*)::int n FROM miopages_wp.wordpress_native_draft_authorizations")).rows[0].n, 0);
      });
    } finally { connection.release(); }
  } finally {
    await Promise.all([admin.end(), migration.end(), writer.end()]);
    await cluster.stop();
  }
});
