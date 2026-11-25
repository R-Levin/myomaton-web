import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Pool } from "pg";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { migrateWithBootstrapCompatibility } from "../../scripts/db/bootstrap";
import { fingerprint } from "../../lib/platform/canonical/model";
import { canonicalWritePool } from "../../lib/platform/canonical/transaction";
import { initializeResponsesUsageLedger } from "../../lib/platform/intake/intelligent-responses";
import { readMyBusiness } from "../../lib/platform/intake/my-business";
import { accountKnowledge } from "../../lib/platform/knowledge/account";
import { factKey } from "../../lib/platform/knowledge/facts";
import { importOnboarding, onboardingFromManifest } from "../../lib/platform/knowledge/import";
import { confirmOnPublish, factsToConfirmOnPublish } from "../../lib/platform/knowledge/publish";
import { recordFacts } from "../../lib/platform/knowledge/store";
import { createAiWriter } from "../../lib/platform/service/ai-writer";
import { citedBySite, currentSite, proposePublish, respond, startLaunch, tasks, work, CycleError, type ServiceRecord } from "../../lib/platform/service/cycle";
import { deliverDraft, takeInReadBack } from "../../lib/platform/service/delivery";
import { ServiceStore } from "../../lib/platform/service/store";
import { readBackOperatorSite } from "../../lib/platform/wordpress-delivery/operator-review";
import { offlineAi } from "../helpers/simulated-ai";
import { localWordPress } from "../helpers/wordpress";

/**
 * Milestone 1 acceptance (rebuild plan): one Account runs on the rebuilt Core from its imported
 * onboarding to an approved Publish, saved at every step, through WordPress drafts and a Review
 * Round of Notes, with the AI behind the metered connection (offline here). The old workflow is
 * not used anywhere in this run.
 */
test("C0 runs on the rebuilt Core: imported Knowledge, Launch, WordPress drafts, a Review Round and the Client's Publish approval", async () => {
  const cluster = await disposableCluster(process.env.PG_BIN_DIR ?? "C:/Program Files/PostgreSQL/18/bin");
  const pool = new Pool({ connectionString: cluster.url });
  const root = await mkdtemp(join(tmpdir(), "miopages-service-launch-"));
  try {
    await migrateWithBootstrapCompatibility(pool);
    await pool.query(await readFile("lib/platform/service/records.sql", "utf8"));
    const organization = randomUUID(), account = { webPresenceId: randomUUID(), managedSiteId: randomUUID() };
    await pool.query("INSERT INTO organizations(id,name) VALUES($1,'C0 (test Account)')", [organization]);
    await pool.query("INSERT INTO web_presences(id,organization_id,name) VALUES($1,$2,'C0 (test Account)')", [account.webPresenceId, organization]);
    await pool.query("INSERT INTO managed_sites(id,web_presence_id,name) VALUES($1,$2,'C0 (test Account)')", [account.managedSiteId, account.webPresenceId]);

    // C0's onboarding, done before Core, comes in as its Knowledge; a Specialist adds one Proposed fact.
    const manifest = JSON.parse(await readFile("scripts/customer-initializers/miopages-c0-manifest.json", "utf8"));
    await importOnboarding(pool, account.webPresenceId, onboardingFromManifest(manifest), "principal", "C0 onboarding, done before Core");
    const db = await pool.connect();
    const proposedKey = factKey("launch", "f1");
    try {
      await db.query("BEGIN");
      await recordFacts(db, account, [{ key: proposedKey, statement: "MioPages replies to new enquiries within one working day.", publicUse: true,
        said: { kind: "specialist", person: "specialist" }, source: "test", enteredBy: "specialist" }], "specialist", "2026-11-25T09:00:00.000Z", "Specialist's fact");
      await db.query("COMMIT");
    } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
    const known = await accountKnowledge(pool, account.webPresenceId);
    assert.equal(known.items.filter(item => item.status === "confirmed").length, manifest.knowledge.payload.entries.length);
    // The stand-in AI cites the first source it is offered; offer the Proposed fact first so the site relies on it.
    const knowledge = [...known.items.filter(item => item.status === "proposed"), ...known.items.filter(item => item.status === "confirmed"), ...known.offerings];

    const rates = { model: "offline-model", verifiedOn: "2026-11-25", inputPerMillion: 750_000, cachedPerMillion: 75_000, outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(root, rates);
    const budget = { id: fingerprint("service-launch"), startingLedger: createHash("sha256").update(await readFile(join(root, "onboarding-usage.json"))).digest("hex"),
      baselineAttempts: 0, requests: 60, generations: 30, inputTokens: 4_000_000, inputBytes: 20_000_000, capMicros: 20_000_000 };
    const { transport, sent } = offlineAi(rates.model);
    const writer = createAiWriter({ account, ledgerDirectory: root, rates, transport, budget, outputLimit: 20_000 });
    const store = new ServiceStore(pool);
    const principal = { id: "principal", role: "customer" as const }, specialist = { id: "specialist", role: "operator" as const };
    let minute = 0;
    const at = () => new Date(Date.UTC(2026, 10, 25, 14, minute++)).toISOString();
    // Each step is read, done and saved: Core writes; the right person reviews.
    const step = async (change: (record: ServiceRecord) => ServiceRecord | Promise<ServiceRecord>) => { const read = await store.read(account); return store.save(read, await change(read)); };
    const runAll = async () => {
      for (let round = 0; round < 8 && tasks(await store.read(account)).some(task => task.who !== "specialist" || task.changeId); round++) {
        for (const task of tasks(await store.read(account)).filter(item => item.who === "core")) await step(record => work(record, task, writer, knowledge, at()));
        for (const task of tasks(await store.read(account)).filter(item => item.changeId))
          await step(record => respond(record, task.changeId!, task.who === "client" ? principal : specialist, "approve", at()));
      }
    };

    await step(record => startLaunch(record, at(), specialist));
    await runAll();
    let record = await store.read(account);
    assert.ok(currentSite(record)?.complete, "Launch reaches a complete site");
    assert.deepEqual(sent.slice(0, 3).map(item => item.name), ["core_report", "core_direction", "core_blueprint"]);
    assert.match(sent[0].input, /MioPages/, "Core writes from C0's own Knowledge");

    // WordPress drafts, then a Review Round: a Note becomes a Request; Core reworks; the Note is answered.
    const { config, wordpress, fetcher } = await localWordPress(root, account);
    const first = await deliverDraft({ config, record, previous: null, fetcher });
    wordpress({ mode: "operator", edits: { "/start": ['{"metadata":{"mio":"', '{"metadata":{"noteId":[901],"mio":"'] },
      notes: [{ id: 901, path: "/start", text: "Say how long the first step takes." }] });
    const { readback } = await readBackOperatorSite(config, fetcher);
    await step(current => takeInReadBack(current, readback, specialist, at()));
    await runAll();
    record = await store.read(account);
    const second = await deliverDraft({ config, record, previous: first.delivery, fetcher });
    assert.deepEqual(second.delivery.answeredNotes, [901]);

    // Publish: the Client approves exactly this site, and that approval confirms the Proposed fact it relies on.
    const relies = await factsToConfirmOnPublish(pool, account.webPresenceId, citedBySite(record));
    assert.deepEqual(relies.map(fact => fact.key), [proposedKey], "The Publish lists the Proposed fact the site cites");
    record = await step(current => proposePublish(current, { at: at(), by: specialist, relies }));
    const publish = tasks(record).find(task => task.who === "client")!;
    assert.match(publish.what, /Approving also confirms/);
    assert.throws(() => respond(record, publish.changeId!, specialist, "approve", at()), CycleError, "Only the Client approves a Publish");
    record = await step(current => respond(current, publish.changeId!, principal, "approve", at()));
    const publication = record.publications!.at(-1)!;
    assert.equal(publication.beacon, "public delivery not built yet");
    assert.deepEqual(publication.pages.map(page => page.path), ["/", "/service", "/start"]);
    const confirmer = await pool.connect();
    try {
      await confirmer.query("BEGIN");
      await confirmOnPublish(canonicalWritePool(confirmer) as unknown as typeof confirmer, account, publication, principal);
      await confirmer.query("COMMIT");
    } catch (error) { await confirmer.query("ROLLBACK"); throw error; } finally { confirmer.release(); }
    const business = await readMyBusiness(pool, account.webPresenceId);
    assert.ok(!business.proposed.some(item => item.key === proposedKey), "Nothing waits for the Client any more");
    assert.ok(business.facts.some(item => item.value === relies[0].statement), "My Business shows it as the Client's confirmed word");
    assert.deepEqual(tasks(record), [], "Nothing waits on anyone");
  } finally { await pool.end(); await cluster.stop(); await rm(root, { recursive: true, force: true }); }
});
