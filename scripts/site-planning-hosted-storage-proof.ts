import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolClient } from "pg";
import { fingerprint } from "../lib/platform/canonical/model";
import type { PreparedUnderstanding } from "../lib/platform/intake/adaptive";
import { IntakeService, newResumeToken, resumeHash } from "../lib/platform/intake/service";
import { ProtectedSitePlanning, reviewedSitePlanning } from "../lib/platform/intake/protected-site-planning";
import { prepareSitePlanning, readCompactSitePlanning } from "../lib/platform/intake/site-planning";
import { protectedConnection, protectedPool } from "../lib/platform/wordpress-delivery/protected-connection";
import { c2 } from "../tests/fixtures/site-planning-compact";

const home = "/home/virtual/vps-bef564/e/e494602172";
const scope = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const role = "miopages_core_development";
const view = "miopages_wp.core_development_drafts";
let stage = "custody";
let queryKind = "none";

async function main() {
  assert.equal(process.platform, "linux");
  assert.equal(await realpath(process.env.HOME ?? ""), home);
  assert.deepEqual(process.argv.slice(2), ["VERIFY-STORAGE-6d64706"]);
  const root = join(home, "miopages-private-acceptance");
  const directory = await lstat(root);
  assert.ok(directory.isDirectory() && directory.uid === process.getuid?.() &&
    (directory.mode & 0o777) === 0o700 && await realpath(root) === root);
  const build = JSON.parse(await readFile(join(home, "public_html/rehearsal-build.json"), "utf8"));
  assert.equal(build.sourceCommit, "6d64706cb255087f2fc707c668cc5d28a6759c3e");
  const path = join(root, "core-config.json");
  const info = await lstat(path);
  assert.ok(info.isFile() && info.uid === process.getuid?.() && (info.mode & 511) === 384 && await realpath(path) === path);
  const { databaseUrl, ca } = JSON.parse(await readFile(path, "utf8"));
  assert.ok(typeof ca === "string" && ca.length > 0);
  const pool = protectedPool(databaseUrl, role, ca);
  const token = newResumeToken();
  let db: PoolClient | undefined;
  let result;
  try {
    stage = "scoped-session";
    db = await pool.connect();
    const client = db;
    await protectedConnection(client, role, "postgres");
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const before = await client.query(`SELECT count(*)::int AS n FROM ${view}`);
    // Use the actual PostgreSQL view and service SQL under one outer rollback.
    // The service's transactions become savepoints on this connection.
    const query = async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN") return client.query("SAVEPOINT scoped_step");
      if (sql === "COMMIT") return client.query("RELEASE SAVEPOINT scoped_step");
      if (sql === "ROLLBACK") {
        await client.query("ROLLBACK TO SAVEPOINT scoped_step");
        return client.query("RELEASE SAVEPOINT scoped_step");
      }
      queryKind = sql.startsWith("UPDATE") ? "draft-update" :
        sql.startsWith("INSERT") ? "draft-insert" :
        sql.includes("FOR UPDATE") ? "draft-lock" :
        sql.includes("core_development_drafts") ? "draft-read" : "scope-check";
      return client.query(sql, values);
    };
    const adapter = { query, connect: async () => ({ query, release() {} }) } as unknown as Pool;
    const prepared: PreparedUnderstanding = {
      scenario: "c2", name: "Fictional storage fixture", context: "Offline copy only.", summary: "A fictional tree-service business.",
      scopeSummary: "Storage test.", sources: [], reconciliation: { title: "Scope", sources: [], status: "needs confirmation", detail: "Synthetic only." },
      reviewGap: "No real review.", offeringPrompt: "Synthetic.", proposal: "Synthetic.", fit: "Synthetic.", inventory: [],
    };
    const makeIntake = () => new IntakeService(adapter, scope, { database: "postgres", answers: {}, provenance: {}, prepared, step: 3,
      protectedScope: async (db) => {
        await protectedConnection(db, role, "postgres");
        await db.query("SET search_path TO miopages_core_guard, miopages_wp, public");
        assert.equal((await db.query("SELECT 1 FROM miopages_wp.core_development_scope WHERE web_presence_id=$1 AND managed_site_id=$2",
          [scope.webPresenceId, scope.managedSiteId])).rowCount, 1);
      },
    });
    stage = "fixture";
    const intake = makeIntake(), initial = await intake.create(token, "DIRECT_START");
    const seeded = await intake.editProtectedInterview(token, initial.version, state => ({
      ...state, turns: Array.from({ length: 5 }, (_, index) => ({
        id: randomUUID(), gapId: "synthetic-storage-fixture", question: "Synthetic question " + index + "?",
        rationale: "Emulates retained interview context for the storage check.", sourceIds: [], respondsTo: null,
        generatorVersion: "offline-fixture", assessment: null, at: "2026-11-14T12:00:00Z",
        answer: { disposition: "provided" as const, text: "Fictional onboarding context. ".repeat(24), at: "2026-11-14T12:00:00Z" },
      })),
    }));
    const shape = structuredClone(c2);
    for (const page of shape.pages) {
      const initialSections = page.sections.slice();
      for (let i = 0; i < 3; i++) {
        const original = initialSections[i % initialSections.length];
        page.sections.push({ ...original, heading: `${page.title}: ${i + 1}`,
          body: [original.body, initialSections.at(-1)!.body, original.body].join(" ") });
      }
    }
    const evidence = [{ id: "tree-offerings", kind: "synthetic-review" as const, statement: "Fictional tree work.", reference: "Offline storage fixture", at: "2026-11-14" },
      { id: "tree-needs", kind: "synthetic-review" as const, statement: "Fictional storm and estimate needs.", reference: "Offline storage fixture", at: "2026-11-14" }];
    const ownerDigest = fingerprint(scope), expiresAt = Date.now() + 60_000;
    const project = prepareSitePlanning(ownerDigest, evidence, [], { ownerDigest, evidenceDigest: fingerprint(evidence),
      expiresAt, approvedAnswerDigests: [] });
    const expected = readCompactSitePlanning(shape, project);
    let offlineCalls = 0;
    stage = "save";
    const gen = new ProtectedSitePlanning(intake, { model: "offline-fixture", input: async () => project,
      async generate(input) { offlineCalls++; return readCompactSitePlanning(shape, await input()); } });
    const saved = await gen.generate(token, seeded.version);
    assert.equal(offlineCalls, 1);
    assert.deepEqual(saved.sitePlanning?.proposal?.generated, expected);
    const row = (await client.query(`SELECT provenance FROM ${view} WHERE resume_hash=$1`, [resumeHash(token)])).rows[0];
    assert.match(row.provenance.protectedSitePlanning, /^deflate-raw\/1:/);
    const uncompressed = Buffer.byteLength(JSON.stringify({ ...row.provenance, protectedSitePlanning: saved.sitePlanning }));
    assert.ok(uncompressed > 14_000);
    const compressed = Buffer.byteLength(JSON.stringify(row.provenance));
    console.log(JSON.stringify({ status: "PASS", stage: "save-readback", uncompressed, compressed }));
    stage = "reload";
    const reloaded = makeIntake();
    const review = new ProtectedSitePlanning(reloaded);
    assert.deepEqual(await reloaded.resume(token), saved);
    const previous = reviewedSitePlanning(saved.sitePlanning!.proposal!);
    stage = "verify-unapproved-refusal";
    await assert.rejects(review.delivery(token, saved.version), /authorization_required/);
    const plan = structuredClone(previous.plan);
    plan.pages[0].title = "Review the fictional tree work";
    const destinations = Object.fromEntries(previous.actions.map(action => [action.from, action.destination ?? (action.from === "/" ? "/storm-damage" : "/")]));
    stage = "edit";
    const edited = await review.edit(token, saved.version, previous.digest, plan, destinations);
    assert.deepEqual(edited.sitePlanning?.proposal?.generated, expected);
    const current = reviewedSitePlanning(edited.sitePlanning!.proposal!);
    assert.notEqual(current.digest, previous.digest);
    assert.equal(current.plan.pages[0].title, plan.pages[0].title);
    const actor = { operatorId: "offline-fixture", authorityReference: "storage-verification-only" };
    stage = "reject";
    const rejected = await review.decide(token, edited.version, current.digest, "rejected", "Verify fictional review history.", actor);
    assert.equal(reviewedSitePlanning(rejected.sitePlanning!.proposal!).decision?.status, "rejected");
    stage = "approve-fixture";
    const approved = await review.decide(token, rejected.version, current.digest, "approved", "Synthetic preparation check only.", actor);
    stage = "review-packet";
    assert.equal((await review.delivery(token, approved.version)).packet.plan.pages[0].title, plan.pages[0].title);
    stage = "verify-edited-reload";
    assert.deepEqual(await makeIntake().resume(token), approved);
    assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${view}`)).rows[0].n, before.rows[0].n + 1);
    result = { pages: shape.pages.length, sections: shape.pages.reduce((count, page) => count + page.sections.length, 0),
      uncompressed, compressed, reloaded: true, edits: true, decisions: true, deliveryInput: true };
  } finally {
    const proofStage = stage;
    try {
      if (db) {
        stage = "cleanup-verification";
        try { await db.query("ROLLBACK"); } finally { db.release(); }
        assert.equal((await pool.query(`SELECT 1 FROM ${view} WHERE resume_hash=$1`, [resumeHash(token)])).rowCount, 0);
        stage = proofStage;
      }
      if (result) console.log(JSON.stringify({ status: "PASS", ...result, fixtureRolledBack: true, providerCalls: 0 }));
    } finally { await pool.end(); }
  }
}
main().catch(error => {
  console.error(JSON.stringify({ status: "BLOCKED", stage, queryKind, code: (error as { code?: string }).code ?? "VALIDATION" }));
  process.exitCode = 1;
});
