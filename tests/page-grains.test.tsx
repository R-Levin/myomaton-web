import assert from "node:assert/strict";
import test from "node:test";
import { beaconWriter } from "../lib/platform/service/beacon-writer";
import { ask, current, currentSite, openRecord, respond, restore, startLaunch, tasks, work, type PageContent, type ServiceRecord, type WriteInput, type Writer }
  from "../lib/platform/service/cycle";
import { pageIdentity } from "../lib/platform/work-products/pages";

/**
 * A page's content and its layout change independently (docs/rendering-design.md), at Launch and in
 * Ongoing: a change to one keeps the other from the approved version, whatever wrote the answer.
 */
const account = { webPresenceId: "6a1f3e0c-3f53-4d43-9d0e-6f1c2a7b9e11", managedSiteId: "2c4e6a80-1b3d-4f57-8a9c-0e2f4a6c8e01" };
const knowledge = [{ key: "audience", kind: "audience", value: "Owner-led service businesses", status: "confirmed", forWebsite: true }];
const specialist = { id: "specialist", role: "operator" as const }, client = { id: "client@example.test", role: "customer" as const };
const at = (n: number) => `2026-11-29T10:${String(n).padStart(2, "0")}:00.000Z`;

async function launched(writer: Writer = beaconWriter) {
  let record: ServiceRecord = startLaunch(openRecord(account), at(0), specialist);
  for (let step = 0; step < 8 && !currentSite(record)?.complete; step++) {
    for (const task of tasks(record).filter(item => item.who === "core")) record = await work(record, task, writer, knowledge, at(step + 1));
    for (const task of tasks(record).filter(item => item.who !== "core")) record = respond(record, task.changeId!, task.who === "client" ? client : specialist, "approve", at(step + 1));
  }
  return record;
}
const page = (record: ServiceRecord, path: string) => current(record, pageIdentity(account.managedSiteId, path))!.content as PageContent;
const proposed = (record: ServiceRecord) => record.products.find(item => item.status === "proposed")!;
const runCore = async (record: ServiceRecord, writer: Writer, n: number) => {
  for (const task of tasks(record).filter(item => item.who === "core")) record = await work(record, task, writer, knowledge, at(n));
  return record;
};

test("each page is written with the site's other pages in view", async () => {
  const seen: WriteInput[] = [];
  const watching: Writer = { write: input => { seen.push(input); return beaconWriter.write(input); } };
  await launched(watching);
  const last = seen.filter(input => input.kind === "page").at(-1)!;
  assert.ok(last.pages?.length, "the pages already written are supplied");
  assert.ok(!last.pages!.some(other => other.path === last.page!.path), "but not the page being written");
});

test("a layout-only change keeps the content exactly; a content-only change keeps the layout", async () => {
  let record = await launched();
  const before = page(record, "/service");
  // A writer that tries to change both: the engine keeps the part that wasn't asked for.
  const both: Writer = { write: async input => {
    const previous = input.previous as PageContent;
    return { ...previous, content: previous.content.map(item => item.type === "heading" ? { ...item, text: "Changed by the writer" } : item),
      layout: previous.layout.map(section => ({ ...section, band: "brand" as const })) };
  } };
  record = ask(record, { id: "layout-1", at: at(20), by: specialist, kind: "page", path: "/service", grain: "page-layout", words: "Calmer bands." });
  record = await runCore(record, both, 21);
  const laid = proposed(record).content as PageContent;
  assert.deepEqual(laid.content, before.content, "the content is the approved version's");
  assert.ok(laid.layout.every(section => section.band === "brand"), "the layout changed");
  assert.equal(record.ledger.changes.find(change => change.id === proposed(record).changeId)!.target.grain, "page-layout");

  record = respond(record, proposed(record).changeId, specialist, "decline", at(22));
  record = ask(record, { id: "words-1", at: at(23), by: specialist, kind: "page", path: "/service", grain: "page-words", words: "Reword the heading." });
  record = await runCore(record, both, 24);
  const worded = proposed(record).content as PageContent;
  assert.deepEqual(worded.layout, before.layout, "the layout is the approved version's");
  assert.ok(worded.content.some(item => item.type === "heading" && item.text === "Changed by the writer"), "the content changed");
});

test("a change that doesn't fit the page is refused, with the reason", async () => {
  let record = await launched();
  const dropping: Writer = { write: async input => ({ ...(input.previous as PageContent), content: [] }) };
  record = ask(record, { id: "words-2", at: at(20), by: specialist, kind: "page", path: "/service", grain: "page-words", words: "Remove everything." });
  await assert.rejects(runCore(record, dropping, 21), /doesn't fit the page: .*isn't in the page's content/u);
});

test("a correction keeps its scope; going back restores an earlier version exactly, with no AI", async () => {
  let record = await launched();
  const first = page(record, "/service");
  record = ask(record, { id: "words-3", at: at(20), by: specialist, kind: "page", path: "/service", grain: "page-words", words: "Reword it." });
  record = await runCore(record, beaconWriter, 21);
  record = respond(record, proposed(record).changeId, specialist, "correct", at(22), "Shorter, please.");
  assert.ok(record.ledger.requests.some(request => request.status === "open" && request.target.grain === "page-words"), "the correction stays a content-only change");
  record = await runCore(record, beaconWriter, 23);
  record = respond(record, proposed(record).changeId, specialist, "approve", at(24));
  assert.notDeepEqual(page(record, "/service").content, first.content);
  record = restore(record, { id: "restore-1", at: at(25), by: specialist, path: "/service", version: 1 });
  assert.deepEqual(page(record, "/service"), first, "the earlier version, exactly");
  assert.throws(() => restore(record, { id: "restore-2", at: at(26), by: client, path: "/service", version: 1 }), /Only a Specialist/u);
});

test("an existing site moves to the component format with the same words and no AI; every earlier version stays", async () => {
  // A site whose pages were written in the earlier format (before Nov 29).
  const earlier: Writer = { write: async input => input.kind === "page"
    ? { path: input.page!.path, heading: input.page!.label, searchTitle: input.page!.label, searchDescription: "Earlier", composition: "managed-v1",
      sections: [{ id: "a1b2c3d4-0000-4000-8000-000000000001", heading: input.page!.label, body: "Opening words.\n\nSecond paragraph.", role: "hero", sourceIds: [],
        visual: { purpose: "Show it", brief: "A person at work", altIntent: "Person at work", status: "asset-needed" } },
        { id: "a1b2c3d4-0000-4000-8000-000000000002", heading: "What you get", body: "Everything that matters.", role: "intro", sourceIds: [],
          visual: { purpose: "", brief: "", altIntent: "", status: "text-only" },
          block: { version: 1, name: "points", purpose: "Points", layout: "grid", groups: [{ heading: "Clarity", body: "Plain words.", items: [] }, { heading: "Care", body: "Ongoing work.", items: ["Updates"] }] } }],
      actions: [], internalLinks: [] }
    : beaconWriter.write(input) };
  let record = await launched(earlier);
  const before = page(record, "/");
  const { migrateSite } = await import("../lib/platform/service/migrate-site");
  record = migrateSite(record, { id: "move-1", at: at(30), by: specialist });
  const moved = page(record, "/");
  assert.ok(Array.isArray(moved.layout) && moved.layout.length >= 2, "laid out with components");
  const text = JSON.stringify(moved.content);
  for (const words of ["Opening words.", "Second paragraph.", "What you get", "Everything that matters.", "Clarity", "Plain words.", "Care", "Ongoing work.", "Updates"])
    assert.ok(text.includes(words), `"${words}" carried over`);
  assert.ok(moved.content.some(item => item.type === "picture" && item.shows === "A person at work"), "the picture frame carried over");
  assert.throws(() => migrateSite(record, { id: "move-2", at: at(31), by: client }), /Only a Specialist/u);
  record = restore(record, { id: "back-1", at: at(32), by: specialist, path: "/", version: 1 });
  assert.deepEqual(page(record, "/"), before, "the earlier version is still there");
});
