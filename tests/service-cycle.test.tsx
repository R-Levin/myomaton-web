import assert from "node:assert/strict";
import test from "node:test";
import { ask, CycleError, currentSite, direct, openRecord, outcome, respond, startLaunch, tasks, work, type ServiceRecord, type WriteInput, type Writer } from "../lib/platform/service/cycle";
import { pageIdentity, reportIdentity } from "../lib/platform/work-products/pages";

const account = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const client = { id: "client@example.test", role: "customer" as const };
const specialist = { id: "specialist", role: "operator" as const };
const at = (minute: number) => new Date(Date.UTC(2026, 10, 25, 12, minute)).toISOString();

/** A labelled Beacon standing in for Core's AI: it records what it was given and writes plain stand-in content. */
function beacon() {
  const seen: WriteInput[] = [];
  const writer: Writer = { async write(input) {
    seen.push(input);
    const note = input.requests.length ? ` (answering: ${input.requests.join(" / ")})` : "";
    switch (input.kind) {
      case "report": return { title: "Beacon Report" + note, findings: [{ id: "audience", body: "Who the business serves." }] };
      case "direction": return { positioning: "Beacon Direction", basedOn: (input.report as { title: string }).title };
      case "site-plan": return { pages: [{ path: "/", label: "Home", purpose: "Introduce the service", inMenu: true },
        { path: "/start", label: "Start", purpose: "Begin onboarding", inMenu: true }] };
      case "page": return { path: input.page!.path, heading: input.page!.label + note,
        sections: [{ heading: "Opening", body: "Beacon copy for " + input.page!.purpose }, { heading: "Next", body: "Beacon next step" }] };
    }
  } };
  return { writer, seen };
}

/** Run every Core Task that is waiting. */
async function coreWork(record: ServiceRecord, writer: Writer, minute: number) {
  for (const task of tasks(record).filter(item => item.who === "core")) record = await work(record, task, writer, ["Knowledge entry"], at(minute));
  return record;
}
const reviewTask = (record: ServiceRecord, who: "client" | "specialist") => {
  const found = tasks(record).filter(item => item.who === who);
  assert.ok(found.length, "A review Task for the " + who);
  return found;
};

test("one engine runs Launch from the start of the Stage to a complete site, on the shared objects", async () => {
  const { writer, seen } = beacon();
  let record = startLaunch(openRecord(account), at(0), specialist);
  assert.deepEqual(tasks(record).map(task => [task.who, task.what]), [["core", "Write the Report"]]);

  // The Report is the Client's to confirm; the Client corrects it once, in their own words.
  record = await coreWork(record, writer, 1);
  const [first] = reviewTask(record, "client");
  await assert.rejects(async () => respond(record, first.changeId!, specialist, "approve", at(2)), CycleError, "Only the Client approves the Report");
  record = respond(record, first.changeId!, client, "correct", at(2), "We serve owner-led businesses.");
  assert.deepEqual(tasks(record).map(task => task.who), ["core"], "The correction is a Request for Core to rework the Report");
  record = await coreWork(record, writer, 3);
  assert.deepEqual(seen.at(-1)!.requests, ["We serve owner-led businesses."], "Core reworks it with the Client's words");
  assert.ok(seen.at(-1)!.previous, "and the current Version it builds on");
  record = respond(record, reviewTask(record, "client")[0].changeId!, client, "approve", at(4));
  const report = record.products.filter(item => item.id === reportIdentity(account.managedSiteId));
  assert.deepEqual(report.map(item => [item.version, item.status]), [[1, "declined"], [2, "current"]]);

  // Each approval raises what builds on it: Direction, then the Site plan, then one Request per page.
  for (let minute = 5; minute < 12 && !currentSite(record)?.complete; minute += 2) {
    record = await coreWork(record, writer, minute);
    for (const task of tasks(record).filter(item => item.who === "specialist")) record = respond(record, task.changeId!, specialist, "approve", at(minute + 1));
  }
  const site = currentSite(record)!;
  assert.ok(site.complete);
  assert.deepEqual(site.pages.map(page => [page.path, page.id, page.version]), [["/", pageIdentity(account.managedSiteId, "/"), 1],
    ["/start", pageIdentity(account.managedSiteId, "/start"), 1]], "Pages are Work products with the identities delivery uses");
  assert.deepEqual(site.menu, ["/", "/start"]);
  assert.equal(seen.find(input => input.kind === "direction")!.report && (seen.find(input => input.kind === "direction")!.report as { title: string }).title,
    "Beacon Report (answering: We serve owner-led businesses.)", "The Direction is written from the confirmed Report");
  assert.deepEqual(tasks(record), [], "Nothing waits on anyone");

  // Ongoing is the same cycle at a smaller grain: a Specialist asks for a page to change.
  record = ask(record, { id: "note-1", at: at(20), by: specialist, kind: "page", path: "/start", words: "Make the first step shorter." });
  record = await coreWork(record, writer, 21);
  const proposed = record.products.findLast(item => item.path === "/start")!;
  assert.equal(proposed.status, "proposed");
  const before = currentSite(record)!.pages.find(page => page.path === "/start")!;
  const after = proposed.content as typeof before;
  assert.deepEqual(after.sections.map(section => section.id), before.sections.map(section => section.id), "Sections keep their identities");
  assert.deepEqual(after.sections.map(section => section.version), [1, 1], "Unchanged Sections keep their Versions");
  assert.equal(after.version, 2, "The page is its next Version");
  record = respond(record, proposed.changeId, specialist, "approve", at(22));
  assert.match(currentSite(record)!.pages.find(page => page.path === "/start")!.heading, /Make the first step shorter/);
  const change = record.ledger.changes.find(item => item.id === proposed.changeId)!;
  assert.deepEqual([change.status, change.target.workProduct], ["applied", { id: pageIdentity(account.managedSiteId, "/start"), version: 1 }],
    "The Change names the Version it was made against");
});

test("a Client's email is the Client's Request: a Specialist directs it to a Work product or answers it, and the Client sees what became of it", async () => {
  const { writer, seen } = beacon();
  let record = startLaunch(openRecord(account), at(0), specialist);
  for (let minute = 1; minute < 12 && !currentSite(record)?.complete; minute += 2) {
    record = await coreWork(record, writer, minute);
    for (const task of tasks(record).filter(item => item.changeId))
      record = respond(record, task.changeId!, task.who === "client" ? client : specialist, "approve", at(minute + 1));
  }
  assert.ok(currentSite(record)?.complete);

  // Entered by a Specialist, about the site in general: it stays the Client's word, and waits for the Specialist to direct.
  record = ask(record, { id: "email:1", at: at(30), by: client, enteredBy: specialist, kind: "site", words: "Say the first month is free.",
    channel: "email", channelRef: "client@example.test 2026-11-25" });
  const email = record.ledger.requests.find(item => item.id === "email:1:request")!;
  assert.deepEqual([email.origin.kind, email.origin.by, email.origin.enteredBy, email.origin.channel], ["customer", client, specialist, "email"]);
  assert.deepEqual(tasks(record).map(task => task.who), ["specialist"]);
  assert.equal(outcome(record, email).state, "working");
  assert.throws(() => direct(record, email.id, client, at(31), { kind: "page", path: "/start" }), CycleError, "Only a Specialist directs");
  assert.throws(() => direct(record, email.id, specialist, at(31), { kind: "page", path: "/missing" }), CycleError, "Only to a page the site has");

  record = direct(record, email.id, specialist, at(31), { kind: "page", path: "/start" });
  assert.deepEqual(tasks(record).map(task => [task.who, task.what]), [["core", "Write the page /start"]]);
  record = await coreWork(record, writer, 32);
  assert.deepEqual(seen.at(-1)!.requests, ["Say the first month is free."], "Core works from the Client's own words");
  assert.equal(outcome(record, email).words, "Done; waiting for review.");
  record = respond(record, tasks(record)[0].changeId!, specialist, "approve", at(33));
  assert.equal(outcome(record, email).words, "Done: in the page /start, version 2.");
  assert.throws(() => direct(record, email.id, specialist, at(34), { answer: "Twice" }), CycleError, "A Request is directed once");

  // Or answered with no change: that is a Decision too, and the Client sees the answer.
  record = ask(record, { id: "email:2", at: at(40), by: client, enteredBy: specialist, kind: "site", words: "Is the site live yet?", channel: "email" });
  const question = record.ledger.requests.find(item => item.id === "email:2:request")!;
  record = direct(record, question.id, specialist, at(41), { answer: "Not yet: it goes live when you approve Publish." });
  assert.deepEqual(outcome(record, question), { state: "answered", words: "Not yet: it goes live when you approve Publish." });
  assert.deepEqual(tasks(record), [], "Nothing waits on anyone");
});
