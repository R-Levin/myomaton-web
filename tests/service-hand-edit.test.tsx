import assert from "node:assert/strict";
import test from "node:test";
import { CycleError, currentSite, edit, openRecord, respond, startLaunch, tasks, work, type ServiceRecord, type Writer } from "../lib/platform/service/cycle";
import { editedSections } from "../lib/platform/service/delivery";

const account = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const client = { id: "client@example.test", role: "customer" as const };
const specialist = { id: "specialist", role: "operator" as const };
const at = (minute: number) => new Date(Date.UTC(2026, 10, 25, 12, minute)).toISOString();

const writer: Writer = { async write(input) {
  switch (input.kind) {
    case "report": return { title: "Beacon Report", findings: [] };
    case "direction": return { positioning: "Beacon Direction" };
    case "site-plan": return { pages: [{ path: "/", label: "Home", purpose: "Introduce", inMenu: true }] };
    case "page": return { path: "/", heading: "Home", sections: [{ heading: "Welcome", body: "First words." }, { heading: "Next", body: "Second words." }] };
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
const wordpressPage = (ids: string[], first: string, extra = "") => `<!-- wp:group {"className":"miopages-composed"} --><div class="wp-block-group">
<!-- wp:html --><nav>Home</nav><!-- /wp:html -->
<!-- wp:heading {"level":1,"metadata":{"mio":"${ids[0]}:heading"}} --><h1 class="wp-block-heading">Welcome</h1><!-- /wp:heading -->
<!-- wp:paragraph {"metadata":{"mio":"${ids[0]}:text"}} --><p>${first}</p><!-- /wp:paragraph -->
<!-- wp:heading {"metadata":{"mio":"${ids[1]}:heading"}} --><h2 class="wp-block-heading">Next</h2><!-- /wp:heading -->
<!-- wp:paragraph {"metadata":{"mio":"${ids[1]}:text"}} --><p>Second words.</p><!-- /wp:paragraph -->${extra}
</div><!-- /wp:group -->`;

test("a Specialist's hand edit is their own Change: read section by section, it becomes the page's next Version at once", async () => {
  let record = await launched();
  const page = currentSite(record)!.pages[0] as unknown as { sections: { id: string; version: number }[]; version: number };
  const ids = page.sections.map(section => section.id);

  const sections = editedSections(wordpressPage(ids, "First words, &amp; <strong>edited</strong> by hand."), ids)!;
  assert.deepEqual(sections, [{ id: ids[0], heading: "Welcome", body: "First words, & edited by hand." }, { id: ids[1], heading: "Next", body: "Second words." }]);
  assert.throws(() => edit(record, { id: "e0", at: at(20), by: client, path: "/", sections, channel: "hand-edit", words: "x" }), CycleError, "Only a Specialist");

  record = edit(record, { id: "wp-edit:/:abc", at: at(20), by: specialist, path: "/", sections, channel: "hand-edit", channelRef: "/:abc", words: "Hand edit" });
  const now = currentSite(record)!.pages[0] as unknown as { sections: { id: string; version: number; body: string }[]; version: number };
  assert.equal(now.version, 2, "The edit is the page's next Version, current at once");
  assert.equal(now.sections[0].body, "First words, & edited by hand.");
  assert.deepEqual(now.sections.map(section => [section.id, section.version]), [[ids[0], 2], [ids[1], 1]], "Only the edited Section moves on");
  const change = record.ledger.changes.at(-1)!;
  assert.deepEqual([change.status, change.reviews[0].by, change.consequence], ["applied", specialist, "operator-review"]);
  assert.deepEqual(tasks(record), [], "Core has nothing to rework");
  assert.equal(edit(record, { id: "wp-edit:/:abc", at: at(21), by: specialist, path: "/", sections, channel: "hand-edit", words: "Hand edit" }), record, "Taking it in twice changes nothing");

  // What cannot be read section by section goes to Core as before, so a hand edit is never lost.
  assert.equal(editedSections(wordpressPage(ids, "First words.", `<!-- wp:list --><ul><li>New list</li></ul><!-- /wp:list -->`), ids), null, "an added block");
  assert.equal(editedSections(wordpressPage(ids, "First words.", `<!-- wp:paragraph --><p>A new paragraph</p><!-- /wp:paragraph -->`), ids), null, "an unmarked paragraph");
  assert.equal(editedSections(wordpressPage([ids[0], "other"], "First words."), ids), null, "a removed section");
});
