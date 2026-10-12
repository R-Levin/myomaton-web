import assert from "node:assert/strict";
import test from "node:test";
import { prepareC0TransitionFixture } from "../../scripts/customer-previews/miopages-c0-transition-fixture";
import { applyC0Transition, planC0Transition, after, before, target, transitionChanges } from "../../scripts/customer-updates/miopages-c0-revamp";
import { validateTransitionRendering } from "../../scripts/prepare-miopages-c0-transition";
import { stateFingerprint } from "../../lib/platform/customer-initialization";
import { customerGraph, otherCustomerState } from "../../lib/platform/customer-state";
import { inspectCanonical, writeCanonical } from "../../lib/platform/canonical/writes";
import { prepareAcceptedRevamp } from "../../scripts/customer-previews/miopages-c0-fixture";
import { validateAcceptedRevamp } from "../../scripts/preview-miopages-c0";
import { JSDOM } from "jsdom";

test("guarded C0 transition proves exact application, rollback, retry, refusal and isolated rendering", async t => {
  const url = process.env.ASSET_TEST_DATABASE_URL; assert.ok(url,"ASSET_TEST_DATABASE_URL required; do not silently skip");
  const fixture = await prepareC0TransitionFixture(url);
  try {
    await t.test("first and last write failure roll back every row, including immutable revisions", async () => {
      const changes = transitionChanges();
      for (const failAfter of [1,changes.inserts.length+changes.updates.length]) {
        await assert.rejects(applyC0Transition(fixture.wrapped,{failAfter}),/Forced/);
        assert.equal(stateFingerprint(await fixture.read()),stateFingerprint(fixture.baseline));
      }
    });
    await t.test("unexpected MioPages, foreign customer, migration, asset and collision state safely refuse", async () => {
      for (const table of ["pages","organizations","migrations","assets"]) {
        const changed = structuredClone(fixture.baseline);
        changed[table][0].unexpected = "drift"; assert.throws(()=>planC0Transition(changed));
      }
      const partial = structuredClone(fixture.baseline); partial.pages = partial.pages.filter(p=>p.id!==before.pages[0].id);
      assert.throws(()=>planC0Transition(partial));
      await fixture.pool.query("UPDATE pages SET title='Unexpected' WHERE id=$1",[before.pages[0].id]);
      const drift = stateFingerprint(await fixture.read());
      await assert.rejects(applyC0Transition(fixture.wrapped),/conflict/);
      assert.equal(stateFingerprint(await fixture.read()),drift);
      await fixture.pool.query("UPDATE pages SET title=$2 WHERE id=$1",[before.pages[0].id,before.pages[0].title]);
      const collision = structuredClone(fixture.baseline), added = transitionChanges().inserts.find(c=>c.table==="pages")!;
      collision.pages.push({...added.row,managed_site_id:fixture.baseline.managed_sites.find(r=>r.id!==target.managedSiteId)!.id});
      assert.throws(()=>planC0Transition(collision));
    });
    await t.test("apply exact accepted state once; retry performs zero writes; all other state stays exact", async () => {
      const result = await applyC0Transition(fixture.wrapped); assert.equal(result.updated,34); assert.equal(result.inserted,31);
      const state = await fixture.read(); assert.equal(stateFingerprint(customerGraph(state,target)),stateFingerprint(after));
      assert.deepEqual(otherCustomerState(state,target),otherCustomerState(fixture.baseline,target));
      for (const table of ["assets","asset_usages","migrations"]) assert.deepEqual(state[table],fixture.baseline[table]);
      const retry = await applyC0Transition(fixture.wrapped); assert.equal(retry.changed,false); assert.equal(retry.updated+retry.inserted,0);
      assert.equal(stateFingerprint(await fixture.read()),result.after);
      await fixture.pool.query("UPDATE pages SET title='Post-application drift' WHERE id=$1",[before.pages[0].id]);
      await assert.rejects(applyC0Transition(fixture.wrapped),/conflict/);
      await fixture.pool.query("UPDATE pages SET title=$2 WHERE id=$1",[before.pages[0].id,after.pages.find(p=>p.id===before.pages[0].id)!.title]);
    });
    await t.test("new canonical revision snapshots satisfy the existing canonical writer's exact retry contract", async () => {
      for (const domain of ["knowledge","offering"] as const) {
        const row = (domain==="knowledge"?after.business_knowledge:after.offerings)[0];
        const current = await inspectCanonical(fixture.pool,domain,target.webPresenceId,String(row.id)); assert.ok(current);
        const result = await writeCanonical(fixture.pool,{domain,id:String(row.id),webPresenceId:target.webPresenceId,
          expectedVersion:Number(row.version),expectedFingerprint:current.fingerprint,payload:row.payload,
          ...(domain==="offering"?{offering:{key:String(row.key),name:String(row.name),type:"service" as const,status:"active" as const}}:{}),
          responsibleIdentity:(row.payload as {approval:{by:string}}).approval.by,changeReason:"Verify exact canonical retry"});
        assert.equal(result.updated+result.revisions,0);
      }
      assert.equal(planC0Transition(await fixture.read()).changed,false);
    });
    await t.test("all approved copy matches accepted preview except the explicitly removed Review scaffolding", async () => {
      const preview = await fixture.start(true), production = await fixture.start(false);
      const state = await fixture.read();
      assert.equal((await validateTransitionRendering(preview.base,production.base,state)).routes.length,7);
      const accepted = await prepareAcceptedRevamp(url);
      try {
        const server = await accepted.start();
        assert.equal((await validateAcceptedRevamp(server.base,accepted.previewState)).length,7);
        for (const page of customerGraph(state,target).pages.filter(p=>p.status==="active")) {
          const a = new JSDOM(await (await fetch(server.base+page.slug)).text()).window.document;
          const b = new JSDOM(await (await fetch(preview.base+page.slug)).text()).window.document;
          if (page.slug==="/review") {
            const controls = [...a.querySelectorAll("main button")]; assert.equal(controls.length,2);
            for (const control of controls) control.remove();
            const paragraphs = [...a.querySelectorAll("main p")].filter(p=>p.textContent==="This preview control is disabled. No information is collected or submitted.");
            assert.equal(paragraphs.length,1); paragraphs[0].remove();
            assert.doesNotMatch(b.querySelector("main")!.textContent!,/preview control|control is disabled|Start My Free Review/i);
          }
          for (const selector of ["main","header nav","footer nav"]) assert.equal(a.querySelector(selector)?.outerHTML,b.querySelector(selector)?.outerHTML,String(page.slug));
        }
      } finally { await accepted.stop(); }
      for (const asset of fixture.managed) {
        const response = await fetch(production.base+"/media/assets/"+asset.id);
        if (asset.owner===target.webPresenceId) { assert.equal(response.status,200); assert.ok(Buffer.from(await response.arrayBuffer()).equals(asset.bytes)); }
        else assert.equal(response.status,404);
      }
      await fixture.verify();
    });
  } finally { await fixture.stop(); }
});
