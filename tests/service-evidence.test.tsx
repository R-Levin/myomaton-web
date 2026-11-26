import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evidenceSources } from "../lib/platform/service/ai-writer";
import { openRecord, startLaunch, tasks, work, type WriteInput, type Writer } from "../lib/platform/service/cycle";
import { evidenceFrom, withEvidence, type EvidenceSpec } from "../lib/platform/service/evidence";

const account = { webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559", managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352" };
const specialist = { id: "specialist", role: "operator" as const };
const doc = "# Brief\n\n## Customers\n\nStartups and established firms.\n\n### Detail\n\nStill customers.\n\n## Pricing\n\nProvisional.\n";
const spec: EvidenceSpec = { documents: [{ file: "brief.md", id: "brief", label: "Brief", date: "2026-10-06", standing: "client",
  sections: [{ heading: "Customers" }, { heading: "Pricing", date: "2026-11-09", forWebsite: false }] }] };

test("Evidence is each named section word for word, dated, and a missing section is refused", () => {
  const [customers, pricing] = evidenceFrom(spec, () => doc);
  assert.equal(customers!.id, "brief:customers");
  assert.equal(customers!.content, "Startups and established firms.\n\n### Detail\n\nStill customers.");
  assert.deepEqual([pricing!.content, pricing!.date, pricing!.forWebsite], ["Provisional.", "2026-11-09", false]);
  assert.throws(() => evidenceFrom({ documents: [{ ...spec.documents[0]!, sections: [{ heading: "Proof" }] }] }, () => doc), /No section "Proof"/);
  assert.deepEqual(evidenceSources([pricing!]).map(source => [source.id, source.kind, source.label]),
    [["evidence:brief:pricing", "owner-confirmed", "Brief: Pricing (not for the website)"]]);
});

test("Core's writer reads the Account's Evidence with its Knowledge, and an item replaces its earlier copy", async () => {
  let seen: WriteInput | undefined;
  const writer: Writer = { async write(input) { seen = input; return { title: "Report", summary: "s", findings: [] }; } };
  const evidence = evidenceFrom(spec, () => doc);
  let record = withEvidence(withEvidence(openRecord(account), evidence), [{ ...evidence[0]!, content: "Updated." }]);
  assert.deepEqual(record.evidence!.map(item => [item.id, item.content]), [["brief:pricing", "Provisional."], ["brief:customers", "Updated."]]);
  record = startLaunch(record, "2026-11-25T12:00:00.000Z", specialist);
  await work(record, tasks(record).find(task => task.who === "core")!, writer, [], "2026-11-25T12:01:00.000Z");
  assert.equal(seen?.evidence?.length, 2);
});

test("C0's Evidence specification names real sections of C0's own documents", () => {
  const c0 = JSON.parse(readFileSync("scripts/customer-initializers/miopages-c0-evidence.json", "utf8")) as EvidenceSpec;
  const items = evidenceFrom(c0, file => readFileSync(file, "utf8"));
  assert.ok(items.length >= 10);
  assert.ok(items.some(item => item.content.includes("Startups remain an important market")));
});
