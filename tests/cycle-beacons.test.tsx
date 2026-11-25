import assert from "node:assert/strict";
import test from "node:test";
import { decide, emptyLedger, takeIn, type Person } from "../lib/platform/change/model";
import { observeDelivery } from "../lib/platform/measurement/observation-beacon";
import { accountTasks, queue } from "../lib/platform/work/tasks";

const at = "2026-11-24T12:00:00.000Z";
const operator: Person = { id: "op", role: "operator" };

test("a Delivery is followed by a labelled stand-in Observation that Core decides to watch", () => {
  const { observation, ledger } = observeDelivery(emptyLedger(), { account: "a", at, version: 4 });
  assert.match(observation.beacon!, /^Beacon:/);
  assert.deepEqual(ledger.requests.map(item => [item.origin.kind, item.origin.channel, item.target.grain, item.status]),
    [["observation", "measurement", "site", "decided"]]);
  assert.deepEqual(ledger.decisions.map(item => [item.outcome, item.changeIds]), [["watch", []]]);
  assert.throws(() => observeDelivery(ledger, { account: "a", at, version: 4 }), /already taken in/, "One Observation per Delivered Version");
});

test("open work shows as labelled Tasks, and the Queue orders them across Accounts", () => {
  let ledger = takeIn(emptyLedger(), { id: "R", at, by: operator },
    [{ id: "r1", at, origin: { kind: "operator", by: operator, channel: "core-screen" }, target: { grain: "page", path: "/" }, words: "Publish" }]);
  ledger = decide(ledger, { id: "D", at, by: { id: "core", role: "core" }, requestIds: ["r1"], outcome: "change", reasoning: "" },
    [{ id: "P", label: "P1", at: "2026-11-24T11:00:00.000Z", requestIds: ["r1"], target: { grain: "site" }, base: { version: 3 },
      difference: { summary: "Publish the site" }, preserve: [], consequence: "customer-approval" }]);
  const first = accountTasks("a", { next: "review-summary", changes: ledger }, at);
  assert.deepEqual(first.map(task => [task.who, task.what]),
    [["specialist", "Answer the Review summary in WordPress"], ["client", "Review the Proposed change P1: Publish the site"]]);
  const second = accountTasks("b", { next: "in-progress", work: { operation: "page" } }, "2026-11-24T10:00:00.000Z");
  assert.deepEqual(queue([...first, ...second]).map(task => task.id), ["b:in-progress", "a:review:P", "a:review-summary"]);
  assert.deepEqual(queue([...first, ...second], "client").map(task => task.account), ["a"]);
  assert.deepEqual(accountTasks("c", { next: "review-complete" }, at), [], "Nothing waits once the site is reviewed");
  assert.ok([...first, ...second].every(task => /^Beacon:/.test(task.beacon)));
});
