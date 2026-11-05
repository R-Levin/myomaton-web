import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ActivationService, readActivationCase } from "../../lib/platform/activation/service";
import { source, type OperatorAuthority } from "../../lib/platform/activation/model";
import { informationRevision } from "../../lib/platform/activation/information";
import { fingerprint, normalizeKnowledge } from "../../lib/platform/canonical/model";
import { inspectCanonical, writeApprovedInactiveKnowledge } from "../../lib/platform/canonical/writes";
import { projectContent } from "../../lib/platform/canonical/projections";
import { IntakeService, newResumeToken, resumeHash } from "../../lib/platform/intake/service";
import { areas, goals, projects, responsesV2 } from "../../lib/platform/intake/model";
import type { Submission } from "../../lib/platform/reviews/model";
import { sharedInventorySnapshot } from "../db/wordpress-shared-inventory";
import ownership from "../backup/application-ownership.json";

const kind = "miopages-wordpress-rehearsal/1";
const receiptKey = "wordpressRehearsal";
const actor = { operatorId: "synthetic-wp-rehearsal-operator", authorityReference: kind };
const sourceOwner = { webPresenceId: "926cb772-7507-4542-8acd-e7e57ce71324", managedSiteId: "312b8081-4582-47fa-bedb-a551fd6e2b36" };
const activationScope = { ...sourceOwner, pendingCustomerId: "918b3c67-6782-4ba4-a9f8-4a28160764c3" };
const createRequest = "de70622c-2667-4edc-910e-302ce06e8b48";
const title = "Synthetic MioPages WordPress rehearsal";
const factKey = "rehearsal-purpose";
const factValue = "Synthetic content used only for the private MioPages HTTPS staging rehearsal.";
const reference = "Synthetic rehearsal authorization only. No customer or publication authorization.";
const addedCounts: Record<string, number> = {
  organizations: 1, web_presences: 1, managed_sites: 1, prospect_intakes: 1, prospect_intake_submissions: 1,
  activation_cases: 1, activation_case_events: 3, activation_customer_bindings: 1,
  business_knowledge: 1, business_knowledge_revisions: 1,
};
type Row = Record<string, unknown>;
type Snapshot = Record<string, Row[]>;
type FixtureIds = { organizationId: string; webPresenceId: string; managedSiteId: string;
  intakeId: string; submissionId: string; caseId: string; knowledgeId: string };
type Receipt = { kind: string; at: string; ids: FixtureIds; baselineDigest: string; fixtureDigest: string };

function knowledge(at: string) {
  return normalizeKnowledge({ entries: [{ key: factKey, kind: "goal", value: factValue,
    evidence: { sourceKind: "operator", sourceReference: reference, confirmation: "confirmed", visibility: "public",
      confirmedBy: actor.operatorId, confirmedAt: at } }], identityEvidence: [],
    approval: { by: actor.operatorId, at, scope: "public" } });
}

async function snapshot(db: PoolClient): Promise<Snapshot> {
  const result: Snapshot = {};
  for (const name of ownership.tables) {
    const [schema, table] = name.split(".");
    const rows = (await db.query(`SELECT to_jsonb(t) row FROM "${schema}"."${table}" t ORDER BY to_jsonb(t)::text LIMIT 1001`)).rows;
    assert.ok(rows.length <= 1000, "Fixture operation requires bounded synthetic inventory");
    result[table] = rows.map(row => row.row);
  }
  return result;
}

function split(state: Snapshot, ids: FixtureIds) {
  const fixture: Snapshot = {}, rest: Snapshot = {};
  const isFixture = (table: string, row: Row) =>
    (table === "organizations" && row.id === ids.organizationId)
    || (table === "prospect_intakes" && row.id === ids.intakeId)
    || (table === "activation_cases" && row.id === ids.caseId)
    || row.web_presence_id === ids.webPresenceId || row.managed_site_id === ids.managedSiteId
    || row.organization_id === ids.organizationId || row.intake_id === ids.intakeId || row.case_id === ids.caseId;
  for (const [table, rows] of Object.entries(state)) {
    fixture[table] = rows.filter(row => isFixture(table, row)).map(row => {
      if (table !== "organizations") return row;
      const { [receiptKey]: omitted, ...metadata } = row.metadata as Record<string, unknown>;
      void omitted;
      return { ...row, metadata };
    });
    rest[table] = rows.filter(row => !isFixture(table, row));
  }
  return { fixture, rest };
}

function snapshotDigest(state: Snapshot) {
  return fingerprint(Object.fromEntries(Object.entries(state).map(([name, rows]) =>
    [name, [...rows].sort((a, b) => fingerprint(a).localeCompare(fingerprint(b)))])));
}

async function verify(db: PoolClient, receipt: Receipt) {
  assert.equal(receipt.kind, kind);
  const { ids, at } = receipt;
  assert.equal(Object.keys(ids).sort().join(","), "caseId,intakeId,knowledgeId,managedSiteId,organizationId,submissionId,webPresenceId");
  assert.equal(new Set(Object.values(ids)).size, 7);
  assert.ok(Number.isFinite(Date.parse(at)) && Date.parse(at) <= Date.now());
  const { fixture, rest } = split(await snapshot(db), ids);
  for (const [table, rows] of Object.entries(fixture)) assert.equal(rows.length, addedCounts[table] ?? 0, "Conflicting fixture row count");
  assert.equal(snapshotDigest(rest), receipt.baselineDigest, "Existing baseline changed");
  assert.equal(snapshotDigest(fixture), receipt.fixtureDigest, "Conflicting fixture content");

  for (const table of ["organizations", "web_presences", "managed_sites"]) {
    assert.equal(fixture[table][0].name, title);
    assert.equal(fixture[table][0].status, "inactive");
    assert.equal(fixture[table][0].version, 1);
    assert.deepEqual(fixture[table][0].configuration, {});
  }
  assert.equal(fixture.organizations[0].id, ids.organizationId);
  assert.equal(fixture.web_presences[0].id, ids.webPresenceId);
  assert.equal(fixture.web_presences[0].organization_id, ids.organizationId);
  assert.equal(fixture.web_presences[0].primary_domain, null);
  assert.equal(fixture.managed_sites[0].id, ids.managedSiteId);
  assert.equal(fixture.managed_sites[0].web_presence_id, ids.webPresenceId);
  assert.equal((await db.query("SELECT 1 FROM managed_site_hostnames WHERE web_presence_id=$1 OR managed_site_id=$2",
    [ids.webPresenceId, ids.managedSiteId])).rowCount, 0);

  const activation = await readActivationCase(db, ids.caseId, activationScope);
  assert.equal(activation.version, 3);
  assert.equal(activation.createdBy, actor.operatorId);
  assert.deepEqual(activation.history.map(event => event.operation), ["create", "confirm-commercial", "initialize-customer"]);
  assert.ok(activation.history.every(event => event.actor === actor.operatorId && event.authorityReference === kind));
  assert.equal(activation.state.status, "AUTHORIZED_FOR_ONBOARDING");
  assert.equal(activation.state.commercial?.reference, reference);
  assert.equal(activation.review, null);
  const binding = activation.canonicalBinding;
  assert.ok(binding);
  assert.equal(binding.organizationId, ids.organizationId);
  assert.equal(binding.webPresenceId, ids.webPresenceId);
  assert.equal(binding.managedSiteId, ids.managedSiteId);
  assert.equal(binding.eventVersion, 3);

  const row = fixture.prospect_intake_submissions[0] as unknown as Submission;
  const submission = row;
  assert.equal(row.id, ids.submissionId);
  assert.equal(row.intake_id, ids.intakeId);
  assert.deepEqual(source(submission), activation.source);
  assert.equal(row.entry_intent, "DIRECT_START");

  const fact = await inspectCanonical(db as unknown as Pool, "knowledge", ids.webPresenceId, ids.knowledgeId);
  assert.ok(fact);
  assert.equal(fact.row.version, 1);
  assert.deepEqual(normalizeKnowledge(fact.row.payload), knowledge(at));
  await informationRevision(db, { domain: "knowledge", recordId: ids.knowledgeId, revision: 1,
    revisionFingerprint: fact.fingerprint }, ids.webPresenceId);
  assert.ok(projectContent("intro", {}, { role: "knowledge", knowledgeId: ids.knowledgeId, keys: [factKey] }, fact.row));
  const report = await sharedInventorySnapshot(db, [], ids);
  assert.equal(report.c0.graph, true);
  assert.ok(Object.values(report.c0.bindings).every(Boolean));
  assert.equal(report.inventory.unknownOrReal, 0);
  assert.equal(report.publicGrants.acceptable, true);
  assert.equal(report.fixture.approvedProjectionSource, true);
  return { verified: true, kind, site: { organizationId: ids.organizationId, webPresenceId: ids.webPresenceId,
    managedSiteId: ids.managedSiteId }, canonicalFact: { id: ids.knowledgeId, key: factKey, revision: 1,
    fingerprint: fact.fingerprint }, inserted: 0, updated: 0, deleted: 0 };
}

// A single fixture operation on an already authenticated migration connection.
// Caller owns BEGIN/COMMIT. Tests exercise the same transaction on disposable data.
export async function wordpressRehearsalFixture(db: PoolClient, operation: "create" | "verify", failAfterFoundation = false) {
  assert.ok(operation === "create" || operation === "verify");
  await db.query("SET LOCAL search_path=public; SET LOCAL TIME ZONE 'UTC'; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  if (operation === "verify") assert.equal((await db.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on");
  if (operation === "create") {
    assert.equal((await db.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "off");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [kind]);
    await db.query(`LOCK TABLE ${ownership.tables.map(name => name.split(".").map(part => '"' + part + '"').join(".")).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
  }
  const existing = (await db.query("SELECT metadata->$1 AS receipt FROM organizations WHERE metadata ? $1", [receiptKey])).rows;
  assert.ok(existing.length <= 1, "Multiple rehearsal fixture receipts");
  if (existing.length) return verify(db, existing[0].receipt);
  assert.equal(operation, "create", "Rehearsal fixture does not exist");
  const before = await snapshot(db);
  const inventory = await sharedInventorySnapshot(db, []);
  assert.equal(inventory.c0.graph, true);
  assert.ok(Object.values(inventory.c0.bindings).every(Boolean));
  assert.equal(inventory.inventory.unknownOrReal, 0);
  assert.equal(inventory.publicGrants.acceptable, true);
  assert.equal(inventory.fixture.inactiveUnhostedActivationBoundCandidates, 0);
  assert.equal((await db.query("SELECT 1 FROM activation_cases WHERE request_id=$1 OR pending_customer_id=$2",
    [createRequest, activationScope.pendingCustomerId])).rowCount, 0, "Partial/conflicting fixture activation");

  // Each existing writer runs in a savepoint on this exact outer transaction.
  const client = { release() {},
    query: (sql: string, values?: unknown[]) => db.query(sql === "BEGIN" ? "SAVEPOINT wp_rehearsal_writer" :
      sql === "COMMIT" ? "RELEASE SAVEPOINT wp_rehearsal_writer" :
      sql === "ROLLBACK" ? "ROLLBACK TO SAVEPOINT wp_rehearsal_writer" : sql, values),
  };
  const transactional = { connect: async () => client } as unknown as Pool;
  const intake = new IntakeService(transactional, sourceOwner);
  const token = newResumeToken();
  const draft = await intake.create(token, "DIRECT_START");
  const saved = await intake.save(token, draft.version, { project: projects[0], businessName: title,
    website: "https://example.test/", publicProfile: "", goals: [goals[0]], audience: "Synthetic rehearsal audience",
    offer: "Synthetic rehearsal", difference: "Synthetic rehearsal", problem: "Synthetic rehearsal",
    reviewFocus: "Synthetic rehearsal", primaryResponse: responsesV2[0], secondaryResponses: [],
    serviceArea: areas[0], locations: "Synthetic location", contactName: "Synthetic rehearsal operator",
    email: "synthetic@example.test", role: "", phone: "", additional: reference }, 12);
  await intake.submit(token, saved.version);
  // Locate the new submission by its resume hash rather than another queued intake.
  const created = (await db.query(`SELECT s.id,s.digest,s.intake_id FROM prospect_intake_submissions s
    JOIN prospect_intakes i ON i.id=s.intake_id WHERE i.resume_hash=$1`,
  [resumeHash(token)])).rows[0];
  assert.ok(created);
  const context = Object.freeze({});
  const authority: OperatorAuthority = { async authorize(input, operationName, owner) {
    assert.equal(input, context);
    assert.deepEqual(owner, activationScope);
    assert.ok(["create", "confirm-commercial", "initialize-customer"].includes(operationName));
    return actor;
  } };
  const activation = new ActivationService(transactional, authority, { read: async () => { throw Error("Rehearsal does not use a Review"); } }, async client => {
    assert.equal(client, await transactional.connect());
  });
  const caseResult = await activation.create(context, { requestId: createRequest, scope: activationScope,
    submissionId: created.id, submissionDigest: created.digest });
  const at = new Date().toISOString();
  await activation.update(context, caseResult.id, activationScope, 1, randomUUID(), "confirm-commercial",
    { source: "agreement-order", reference, confirmedAt: at, launchScope: "One synthetic private staging test",
      ongoingScope: "None. Rehearsal only." });
  const ready = await activation.canonicalReadiness(context, caseResult.id, activationScope);
  const initialized = await activation.initializeCanonicalCustomer(context, caseResult.id, activationScope,
    { requestId: randomUUID(), expectedVersion: 2, expectedCustomerFingerprint: ready.customerStateFingerprint,
      identity: { organizationName: title, webPresenceName: title, managedSiteName: title,
        confirmation: { reference, confirmedAt: at } } });
  assert.ok(initialized.canonicalBinding);
  if (failAfterFoundation) throw Error("Forced rehearsal fixture rollback");
  const { organizationId, webPresenceId, managedSiteId } = initialized.canonicalBinding;
  const knowledgeId = randomUUID();
  await writeApprovedInactiveKnowledge(transactional, { domain: "knowledge", id: knowledgeId, webPresenceId,
    expectedVersion: null, expectedFingerprint: null, payload: knowledge(at),
    responsibleIdentity: actor.operatorId, changeReason: reference },
  { caseId: caseResult.id, organizationId, webPresenceId, managedSiteId });
  const ids: FixtureIds = { organizationId, webPresenceId, managedSiteId, knowledgeId, caseId: caseResult.id,
    intakeId: created.intake_id, submissionId: created.id };
  const state = split(await snapshot(db), ids);
  assert.equal(snapshotDigest(state.rest), snapshotDigest(before), "Existing records changed during fixture creation");
  const receipt: Receipt = { kind, at, ids, baselineDigest: snapshotDigest(before), fixtureDigest: snapshotDigest(state.fixture) };
  await db.query("UPDATE organizations SET metadata=metadata || jsonb_build_object($2::text,$3::jsonb) WHERE id=$1",
    [organizationId, receiptKey, JSON.stringify(receipt)]);
  const checked = await verify(db, receipt);
  return { ...checked, inserted: Object.values(addedCounts).reduce((sum, count) => sum + count, 0), updated: 4 };
}
