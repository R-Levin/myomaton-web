import assert from "node:assert/strict";
import test from "node:test";
import { acceptedRevamp } from "../scripts/customer-previews/miopages-c0";
import { before, after, preparedAt, target, transitionChanges, transitionInventory, planC0Transition } from "../scripts/customer-updates/miopages-c0-revamp";
import { stateFingerprint } from "../lib/platform/customer-initialization";
import { customerGraph } from "../lib/platform/customer-state";

test("C0 transition is deterministic, identity-preserving and confined to its ownership closure", () => {
  assert.equal(stateFingerprint(customerGraph(after,target)), stateFingerprint(after));
  const changes = transitionChanges(); assert.equal(changes.updates.length, 34); assert.equal(changes.inserts.length, 31);
  for (const table of ["pages", "sections", "actions", "navigation_items"]) assert.ok(before[table].every(row=>after[table].some(r=>r.id===row.id)));
  for (const table of ["assets", "asset_usages", "managed_sites", "design_systems", "navigations"]) assert.deepEqual(after[table],before[table]);
  assert.equal(transitionInventory().find(r=>r.table==="pages")?.retire,1);
});
test("canonical intent changes only disposable receipts, two Review labels and their specific explanation", () => {
  const draft = acceptedRevamp(before,preparedAt);
  for (const [table,rows] of [["pages",draft.pages],["sections",draft.sections],["actions",draft.actions],["navigation_items",draft.navigationItems]] as const) {
    for (const row of rows) {
      const canonical = after[table].find(r=>r.id===row.id)!;
      const expected = structuredClone(row);
      if (table==="sections" && ["4af04629-9b7a-4ffd-b6b3-322af962ee5d","267b46a6-105b-4d14-8d4b-2fe171834c94"].includes(String(row.id))) {
        const content = expected.content as Record<string,unknown>;
        assert.equal(content.previewControlLabel,"Start My Free Review"); delete content.previewControlLabel;
        if (row.id==="267b46a6-105b-4d14-8d4b-2fe171834c94") {
          assert.equal(content.text,"This preview control is disabled. No information is collected or submitted."); delete content.text;
        }
      }
      for (const key of Object.keys(expected).filter(k=>!["created_at","updated_at","metadata"].includes(k))) assert.deepEqual(canonical[key],expected[key]);
      assert.ok(!Object.hasOwn(canonical.metadata as object,"c0Preview"));
    }
  }
  assert.deepEqual(after.business_knowledge[0].payload,draft.business.knowledge);
  assert.deepEqual(after.offerings[0].payload,draft.business.offering);
  assert.ok(!JSON.stringify(after.sections).includes("This preview control is disabled"));
  assert.ok(!JSON.stringify(after.sections).includes("previewControlLabel"));
});
test("unscoped/partial customer graphs cannot substitute for the exact complete baseline", () => {
  assert.throws(()=>planC0Transition(before),/Complete/);
  assert.throws(()=>planC0Transition(after),/Complete/);
});
