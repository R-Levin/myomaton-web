import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKnowledge, type Knowledge } from "../lib/platform/canonical/model";
import { factKey, factsIn, quotedIn, statusOf, withFacts, type Fact } from "../lib/platform/knowledge/facts";

const at = "2026-11-24T12:00:00.000Z";
const fact = (said: Fact["said"], extra: Partial<Fact> = {}): Fact =>
  ({ key: factKey("abc", "f1"), statement: "We open at 9.", publicUse: true, said, source: "test", enteredBy: "sp", ...extra });

test("the Client's word on record is Confirmed; anyone else's is Proposed; an override is recorded as one", () => {
  assert.equal(statusOf({ kind: "client", person: "owner@c.example", record: "client-email:1" }), "confirmed");
  assert.equal(statusOf({ kind: "client", person: "owner@c.example", record: " " }), "proposed", "Without the record it is not the Client's word");
  assert.equal(statusOf({ kind: "specialist", person: "sp" }), "proposed");
  assert.equal(statusOf({ kind: "core" }), "proposed");
  assert.equal(statusOf({ kind: "override", person: "principal", reason: "Client confirmed by phone" }), "confirmed");
  assert.equal(statusOf({ kind: "override", person: "principal", reason: "" }), "proposed", "An override needs its reason");
});

test("Facts are entries of the one Knowledge record and read back with their standing", () => {
  const existing: Knowledge = { entries: [{ key: "audience", kind: "audience", value: "Small firms", evidence: { sourceKind: "customer",
    sourceReference: "brief", confirmation: "confirmed", visibility: "public", confirmedBy: "owner", confirmedAt: at } }],
  identityEvidence: [], approval: { by: "owner", at, scope: "public" } };
  const override = fact({ kind: "override", person: "principal", reason: "Said on a call" }, { key: factKey("abc", "f2"), publicUse: false });
  const next = normalizeKnowledge(withFacts(existing, [fact({ kind: "specialist", person: "sp" }), override], { by: "sp", at: "2026-11-24T13:00:00.000Z" }));
  assert.equal(next.entries[0].value, "Small firms", "Other Knowledge is untouched");
  assert.deepEqual(factsIn(next).map(item => [item.key, item.status, item.said.kind, item.publicUse]),
    [["fact-abc-f1", "proposed", "specialist", true], ["fact-abc-f2", "confirmed", "override", false]]);
  assert.equal(next.entries[2].evidence.sourceKind, "operator", "An override is never recorded as the Client's confirmation");
  const confirmed = normalizeKnowledge(withFacts(next, [fact({ kind: "client", person: "owner", record: "client-email:2" })], { by: "sp", at }));
  assert.deepEqual(factsIn(confirmed).map(item => item.status), ["confirmed", "confirmed"], "The Client later confirms the Proposed fact in place");
  assert.equal(confirmed.entries.length, 3);
  assert.throws(() => withFacts(existing, [fact({ kind: "core" }, { key: "audience" })], { by: "sp", at }), /cannot replace other Knowledge/);
});

test("only the Client's own words in the email count as quoted", () => {
  const email = "Hi, two updates.\nWe now answer enquiries within one working day. Thanks!";
  assert.ok(quotedIn("We now answer enquiries within one working day.", email));
  assert.ok(quotedIn("we now answer ENQUIRIES within one working day", email), "Case and punctuation do not matter");
  assert.ok(!quotedIn("We answer enquiries within one working day.", email), "A changed wording is the Specialist's, not the Client's");
  assert.ok(!quotedIn("", email));
});
