import assert from "node:assert/strict";
import test from "node:test";
import { CycleError, currentSite, edit, openRecord, respond, startLaunch, tasks, work, type ServiceRecord, type Writer } from "../lib/platform/service/cycle";
import { editedItems } from "../lib/platform/service/delivery";
import { renderPage } from "../lib/platform/site/render";

const account = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const client = { id: "client@example.test", role: "customer" as const };
const specialist = { id: "specialist", role: "operator" as const };
const at = (minute: number) => new Date(Date.UTC(2026, 10, 25, 12, minute)).toISOString();

const writer: Writer = { async write(input) {
  switch (input.kind) {
    case "report": return { title: "Beacon Report", findings: [] };
    case "direction": return { positioning: "Beacon Direction" };
    case "site-plan": return { pages: [{ path: "/", label: "Home", purpose: "Introduce", inMenu: true }] };
    case "page": return { path: "/", title: "Home", menuLabel: "Home", searchTitle: "Home", searchDescription: "Home", sourceIds: [],
      content: [{ id: "c1", type: "heading", text: "Welcome" }, { id: "c2", type: "text", text: "First words." },
        { id: "c3", type: "heading", text: "Next" }, { id: "c4", type: "text", text: "Second words." }],
      layout: [{ id: "s1", component: "opening", variant: null, band: "light", slots: { heading: ["c1"], text: ["c2"] } },
        { id: "s2", component: "text", variant: null, band: "tonal", slots: { heading: ["c3"], text: ["c4"] } }] };
  }
} };

async function launched() {
  let record: ServiceRecord = startLaunch(openRecord(account), at(0), specialist);
  for (let minute = 1; minute < 12 && !currentSite(record)?.complete; minute++) {
    for (const task of tasks(record).filter(item => item.who === "core")) record = await work(record, task, writer, [], at(minute));
    for (const task of tasks(record).filter(item => item.changeId)) record = respond(record, task.changeId!, task.who === "client" ? client : specialist, "approve", at(minute));
  }
  return record;
}

/** The page as WordPress holds it: each heading and paragraph carries its section. */
test("a Specialist's hand edit is their own Change: read item by item, it becomes the page's next Version at once", async () => {
  let record = await launched();
  const page = currentSite(record)!.pages[0]!;
  const ctx = { link: (path: string) => `/?p=${path}`, picture: () => null, defaultVariant: () => "split" };
  const delivered = renderPage(page, ctx);
  const text = page.content.find(item => item.type === "text")!;
  // A person changes a paragraph in WordPress's editor; the block keeps its name.
  const edited = delivered.replace(/(<!-- wp:paragraph \{"metadata":\{"name":"mp:c2"\}\} -->\n<p>)[^<]*/u, "$1First words, &amp; <strong>edited</strong> by hand.");
  const items = editedItems(edited, page)!;
  assert.deepEqual(items.find(item => item.id === text.id)!.fields, { text: "First words, & edited by hand." });
  assert.throws(() => edit(record, { id: "e0", at: at(20), by: client, path: "/", items, channel: "hand-edit", words: "x" }), CycleError, "Only a Specialist");

  record = edit(record, { id: "wp-edit:/:abc", at: at(20), by: specialist, path: "/", items, channel: "hand-edit", channelRef: "/:abc", words: "Hand edit" });
  const now = currentSite(record)!.pages[0]!;
  assert.equal(record.products.find(item => item.status === "current" && item.path === "/")!.version, 2, "The edit is the page's next Version, current at once");
  assert.equal((now.content.find(item => item.id === text.id) as { text: string }).text, "First words, & edited by hand.");
  assert.deepEqual(now.layout, page.layout, "The layout stays as it is");
  const change = record.ledger.changes.at(-1)!;
  assert.deepEqual([change.status, change.reviews[0].by, change.consequence], ["applied", specialist, "operator-review"]);
  assert.deepEqual(tasks(record), [], "Core has nothing to rework");
  assert.equal(edit(record, { id: "wp-edit:/:abc", at: at(21), by: specialist, path: "/", items, channel: "hand-edit", words: "Hand edit" }), record, "Taking it in twice changes nothing");

  // What can't be read item by item goes to Core as a Request, so a hand edit is never lost.
  assert.equal(editedItems(delivered + "\n<!-- wp:paragraph -->\n<p>A new paragraph</p>\n<!-- /wp:paragraph -->", page), null, "an unnamed paragraph someone added");
  assert.equal(editedItems(delivered.replace(/<!-- wp:paragraph \{"metadata":\{"name":"mp:c2"\}\} -->[\s\S]*?<!-- \/wp:paragraph -->/u, ""), page), null, "an item removed");
});
