import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fingerprint } from "../../lib/platform/canonical/model";
import { initializeResponsesUsageLedger } from "../../lib/platform/intake/intelligent-responses";
import { createAiWriter } from "../../lib/platform/service/ai-writer";
import { currentSite, openRecord, respond, startLaunch, tasks, work, type ServiceRecord, type Writer } from "../../lib/platform/service/cycle";
import { deliverDraft, takeInReadBack } from "../../lib/platform/service/delivery";
import { readBackOperatorSite } from "../../lib/platform/wordpress-delivery/operator-review";
import { offlineAi } from "../helpers/simulated-ai";
import { localWordPress } from "../helpers/wordpress";

const knowledge = [{ key: "audience", kind: "audience", value: "Owner-led service businesses", status: "confirmed", forWebsite: true }];

test("the engine delivers its site to WordPress drafts, takes Notes and hand edits back in as Requests, and answers them", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-service-delivery-"));
  try {
    const account = { webPresenceId: randomUUID(), managedSiteId: randomUUID() };
    const rates = { model: "offline-model", verifiedOn: "2026-11-25", inputPerMillion: 750_000, cachedPerMillion: 75_000, outputPerMillion: 4_500_000, cacheWritePerMillion: 0, countMicros: 0 };
    await initializeResponsesUsageLedger(root, rates);
    const budget = { id: fingerprint("service-delivery"), startingLedger: createHash("sha256").update(await readFile(join(root, "onboarding-usage.json"))).digest("hex"),
      baselineAttempts: 0, requests: 60, generations: 30, inputTokens: 2_000_000, inputBytes: 10_000_000, capMicros: 10_000_000 };
    const { transport } = offlineAi(rates.model);
    const writer: Writer = createAiWriter({ account, ledgerDirectory: root, rates, transport, budget, outputLimit: 20_000 });
    const client = { id: "client@example.test", role: "customer" as const }, specialist = { id: "specialist", role: "operator" as const };
    let minute = 0;
    const at = () => new Date(Date.UTC(2026, 10, 25, 13, minute++)).toISOString();
    const run = async (record: ServiceRecord) => {
      for (let step = 0; step < 8 && tasks(record).length; step++) {
        for (const task of tasks(record).filter(item => item.who === "core")) record = await work(record, task, writer, knowledge, at());
        for (const task of tasks(record).filter(item => item.who !== "core")) record = respond(record, task.changeId!, task.who === "client" ? client : specialist, "approve", at());
      }
      return record;
    };
    let record = await run(startLaunch(openRecord(account), at(), specialist));
    assert.deepEqual(currentSite(record)!.pages.map(page => page.path), ["/", "/service", "/start"]);

    // A WordPress review site, as the plugin runs it.
    const { config, wordpress, fetcher } = await localWordPress(root, account);

    const first = await deliverDraft({ config, record, previous: null, fetcher });
    assert.deepEqual([first.delivery.revision, first.receipt.posts.map(post => post.path)], [1, ["/", "/service", "/start"]]);
    assert.deepEqual(first.delivery.pages.map(page => page.id), currentSite(record)!.pages.map(page => page.id), "WordPress holds the Work products' own identities");

    // A Specialist adds a Note on /start in WordPress; it must be taken in before the next delivery.
    wordpress({ mode: "operator", edits: { "/start": ['{"metadata":{"mio":"', '{"metadata":{"noteId":[801],"mio":"'] },
      notes: [{ id: 801, path: "/start", text: "Make the first step shorter." }] });
    await assert.rejects(deliverDraft({ config, record, previous: first.delivery, fetcher }), /Take in the Notes/);
    const { readback } = await readBackOperatorSite(config, fetcher);
    record = takeInReadBack(record, readback, specialist, at());
    const raised = record.ledger.requests.filter(request => request.status === "open");
    assert.deepEqual(raised.map(request => [request.origin.channel, request.target.path]).sort(), [["hand-edit", "/start"], ["wordpress-note", "/start"]]);
    assert.equal(raised.find(request => request.origin.channel === "wordpress-note")!.words, "Make the first step shorter.");
    assert.deepEqual(takeInReadBack(record, readback, specialist, at()).ledger.requests.length, record.ledger.requests.length, "Taking the same Note in twice changes nothing");
    await assert.rejects(deliverDraft({ config, record, previous: first.delivery, fetcher }), /work the hand edits into their pages/);

    // Core reworks /start for both Requests at once; the Specialist approves; the next delivery answers the Note.
    assert.deepEqual(tasks(record).filter(task => task.who === "core").map(task => task.requestIds!.length), [2]);
    record = await run(record);
    const second = await deliverDraft({ config, record, previous: first.delivery, fetcher });
    assert.deepEqual([second.delivery.revision, second.delivery.answeredNotes], [2, [801]]);
    const after = await readBackOperatorSite(config, fetcher);
    assert.ok(!after.readback.notes.some(note => note.id === 801 && note.status !== "resolved"), "The Note is answered and resolved in WordPress");
  } finally { await rm(root, { recursive: true, force: true }); }
});
