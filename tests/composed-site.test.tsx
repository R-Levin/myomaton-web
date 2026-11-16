import assert from "node:assert/strict";
import { test } from "node:test";
import { composedFixture } from "./fixtures/composed-site";
import { bindSiteDraft } from "../lib/platform/wordpress-delivery/site-draft";
import { validatePages } from "../lib/platform/wordpress-delivery/authority";

test("Core compiles two scoped composed sites with different buyer journeys and no unverified action", () => {
  const c0 = composedFixture("c0"), c2 = composedFixture("c2");
  for (const record of [c0, c2]) {
    const { candidate } = record;
    const home = candidate.pages[0];
    assert.equal(home.composition, "managed-v1");
    assert.deepEqual(home.sections.map(section => section.type), record === c0 ? ["hero", "intro", "cta"] : ["hero", "intro"]);
    assert.equal(candidate.actions.find(action => action.from === "/")?.sectionId, home.sections[0].id);
    assert.ok(!JSON.stringify(candidate).includes("Unverified destination"));
    assert.throws(() => validatePages(candidate.pages), /Projection page refused/);
  }
  assert.notEqual(c0.candidate.scope.managedSiteId, c2.candidate.scope.managedSiteId);
  assert.notDeepEqual(c0.candidate.navigation, c2.candidate.navigation);
  assert.equal(c0.candidate.pages.length, 4);
  assert.equal(c2.candidate.pages.length, 2);
  assert.deepEqual(c0.candidate.actions.filter(action => action.sectionId === c0.candidate.pages[0].sections[2].id)
    .map(action => action.destination), ["/free-review", "/direct-start"]);
  assert.notEqual(c0.candidate.actions[0].label, c2.candidate.actions[0].label);
  const { candidate, reviewed } = c0;
  const request = { siteProposalId: candidate.siteProposalId, installationId: candidate.installationId,
    revision: 1, previousDigest: null, navigation: candidate.navigation, actions: candidate.actions };
  assert.throws(() => bindSiteDraft(candidate.scope, reviewed, { ...request,
    actions: [{ ...candidate.actions[0], sectionId: candidate.pages[1].sections[0].id }] }), /Action placement/);
  assert.throws(() => bindSiteDraft(candidate.scope, reviewed, { ...request,
    actions: [{ ...candidate.actions[0], sectionId: candidate.pages[0].sections[1].id }] }), /Action placement/);
});
