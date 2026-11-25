import assert from "node:assert/strict";
import test from "node:test";
import { fingerprint } from "../lib/platform/canonical/model";
import { logicalId, pageIdentity, sectionIdentity, versionPages, workDigest, withoutIdentity } from "../lib/platform/work-products/pages";

const site = "1d92a248-416f-4e22-baaf-d2f1fca70352";
const page = (path: string, ...bodies: string[]) => ({ path, heading: "H " + path, sections: bodies.map(body => ({ heading: "S", body })) });

test("a Page keeps one identity, and the identity WordPress already holds, through every draft and revision", () => {
  const first = versionPages(site, [], [page("/", "a", "b"), page("/service", "c")]);
  const home = first.pages[0];
  assert.equal(home.id, pageIdentity(site, "/"));
  assert.equal(home.id, logicalId({ site, path: "/" }), "The same identity delivery has always given the Page");
  assert.deepEqual(home.sections.map(section => section.id), [sectionIdentity(home.id, 0), sectionIdentity(home.id, 1)]);
  assert.deepEqual([home.version, ...home.sections.map(section => section.version)], [1, 1, 1]);

  // Core revises one section: that Section and its Page get their next version; the rest keep theirs.
  const revised = versionPages(site, first.pages, [{ ...home, sections: [home.sections[0], { ...home.sections[1], body: "b2" }] }, first.pages[1]], first.index);
  assert.deepEqual([revised.pages[0].id, revised.pages[0].version, revised.pages[0].sections.map(section => [section.id, section.version])],
    [home.id, 2, [[home.sections[0].id, 1], [home.sections[1].id, 2]]]);
  assert.equal(revised.pages[1].version, 1, "An untouched Page keeps its version");

  // Core redrafts the whole Page without identities: Sections match their places; a new one takes the next identity.
  const redrafted = versionPages(site, revised.pages, [page("/", "a", "b3", "new"), page("/service", "c")], revised.index);
  assert.deepEqual(redrafted.pages[0].sections.map(section => [section.id, section.version]),
    [[home.sections[0].id, 1], [home.sections[1].id, 3], [sectionIdentity(home.id, 2), 1]]);

  // Set aside and drafted again later: the same Page continues its history.
  const cleared = versionPages(site, redrafted.pages, [] as ReturnType<typeof page>[], redrafted.index);
  const again = versionPages(site, cleared.pages, [page("/", "z")], cleared.index);
  assert.deepEqual([again.pages[0].id, again.pages[0].version, again.pages[0].sections[0].version], [home.id, 4, 2], "Its first Section, at version 1 before, is now at 2");
});

test("a Page's content digest is the same before and after it carried an identity", () => {
  const legacy = page("/", "a", "b");
  const { pages: [identified] } = versionPages(site, [], [legacy]);
  assert.notEqual(fingerprint(identified), fingerprint(legacy));
  assert.equal(workDigest(identified), fingerprint(legacy), "Reviews recorded before step 4 still match the pages they reviewed");
  assert.equal(workDigest([identified]), fingerprint([legacy]));
  assert.deepEqual(withoutIdentity(identified), legacy);

  // Pages saved before step 4 take the identities delivery already gave them, at version 1.
  const upgraded = versionPages(site, [legacy], [legacy]);
  assert.deepEqual([upgraded.pages[0].version, upgraded.pages[0].sections.map(section => section.id)],
    [1, [sectionIdentity(pageIdentity(site, "/"), 0), sectionIdentity(pageIdentity(site, "/"), 1)]]);
});
