import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as model from "../lib/platform/navigations/model";
import * as actionModel from "../lib/platform/actions/model";
import * as actionsSchema from "../lib/platform/db/schema/actions";
import * as navigationSchema from "../lib/platform/db/schema/navigations";
import * as itemSchema from "../lib/platform/db/schema/navigation-items";
import * as pageSchema from "../lib/platform/db/schema/pages";
import * as sectionSchema from "../lib/platform/db/schema/sections";
import * as managedSiteSchema from "../lib/platform/db/schema/managed-sites";
import * as presenceSchema from "../lib/platform/db/schema/web-presences";
import { PrimaryNavigation } from "../components/managed-sites/primary-navigation";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import { loadService } from "./helpers/load-service";

const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

test("Navigation service resolves entity targets, scopes every lookup, and filters canonical items by surface", async () => {
  const tenant = uuid(1), nav = uuid(2), pageId = uuid(3), sectionId = uuid(4), actionId = uuid(5);
  const managedSiteId = uuid(6), homePageId = uuid(7), otherManagedSiteId = uuid(8);
  const routing = { managedSiteId, pageId: homePageId };
  let expectedManagedSiteId = managedSiteId;
  const item = (id: number, type: string, ref: string, configuration = {}, parent: string | null = null) => [uuid(id), nav, parent, `Item ${id}`, `Label ${id}`, type, ref, id, "active", configuration];
  // There is deliberately no primary_domain in the navigation query or fixture.
  let navRows: unknown[][] = [[nav, "Primary Navigation", {}]];
  let itemRows: unknown[][] = [
    item(13, "link", "https://example.com/docs"),
    item(12, "action", actionId),
    item(11, "section", sectionId),
    item(10, "page", pageId),
    item(14, "link", "/journal", { surfaces: { managedSite: false, content: true } }),
    item(15, "link", "/hidden-child", {}, uuid(14)),
  ];
  let pageRows: unknown[][] = [[pageId, managedSiteId, "/guide"]];
  let sectionRows: unknown[][] = [[sectionId, { anchor: "about" }, homePageId, managedSiteId, "/"]];
  let actionRows: unknown[][] = [[actionId, tenant, "Learn about Myomaton", "section", "Learn more", "#about", "active"]];
  let queries = 0;
  let sectionQueries = 0;
  const client = {
    async query(query: { text: string }, params: unknown[]) {
      queries += 1;
      if (query.text.includes('from "navigations"')) {
        assert.ok(!query.text.includes("primary_domain"));
        assert.match(query.text, /"navigations"\."web_presence_id" = \$1/);
        assert.deepEqual(params, [tenant, "Primary Navigation", "active", "active", 1]);
        return { rows: navRows };
      }
      if (query.text.includes('from "navigation_items"')) {
        assert.deepEqual(params, [nav, "active"]);
        assert.ok(query.text.includes('order by "navigation_items"."sort_order" asc'));
        return { rows: itemRows };
      }
      if (query.text.includes('from "actions"')) {
        assert.deepEqual(params, [tenant, "active", actionId]);
        assert.ok(query.text.includes('"actions"."web_presence_id" = $1'));
        return { rows: actionRows };
      }
      if (query.text.includes('from "pages"')) {
        assert.deepEqual(params.slice(-4), [expectedManagedSiteId, tenant, "active", "active"]);
        assert.ok(query.text.includes('"managed_sites"."id" ='));
        assert.ok(query.text.includes('"managed_sites"."web_presence_id"'));
        return { rows: pageRows };
      }
      if (query.text.includes('from "sections"')) {
        sectionQueries += 1;
        assert.ok(!query.text.includes("->>"), "No global anchor search");
        assert.ok(query.text.includes('"managed_sites"."id" ='));
        assert.ok(params.includes(expectedManagedSiteId));
        assert.ok(params.includes(tenant));
        assert.ok(params.includes(sectionId));
        assert.ok(query.text.includes('"managed_sites"."web_presence_id"'));
        assert.equal(params.filter((value) => value === "active").length, 3);
        return { rows: sectionRows };
      }
      throw new Error(`Unexpected query: ${query.text}`);
    },
  };
  const db = drizzle({ client: client as unknown as Pool });
  const actionService = loadService("lib/platform/actions/service.ts", {
    "drizzle-orm": orm, "@/lib/platform/db/connection": { db }, "@/lib/platform/db/schema/actions": actionsSchema, "./model": actionModel,
  }) as typeof import("../lib/platform/actions/service");
  const service = loadService("lib/platform/navigations/service.ts", {
    "drizzle-orm": orm,
    "@/lib/platform/db/connection": { db },
    "@/lib/platform/db/schema/navigations": navigationSchema,
    "@/lib/platform/db/schema/navigation-items": itemSchema,
    "@/lib/platform/db/schema/web-presences": presenceSchema,
    "@/lib/platform/db/schema/managed-sites": managedSiteSchema,
    "@/lib/platform/db/schema/pages": pageSchema,
    "@/lib/platform/db/schema/sections": sectionSchema,
    "@/lib/platform/actions/service": actionService,
    "@/lib/platform/actions/model": actionModel,
    "./model": model,
  }) as typeof import("../lib/platform/navigations/service");
  const resolve = (surface: model.NavigationSurface = "managedSite", context: model.NavigationContext | null = routing) =>
    service.getNavigationByName(tenant, "Primary Navigation", surface, context ?? undefined);

  assert.equal(await service.getNavigationByName("invalid", "Primary Navigation", "managedSite"), null);
  assert.equal(queries, 0);
  const managedSite = await resolve();
  const content = await resolve("content");
  assert.ok(managedSite && content);
  assert.deepEqual(managedSite.items.map((item) => item.href), ["/guide", "#about", "#about", "https://example.com/docs"]);
  assert.deepEqual(content.items.slice(0, 4), managedSite.items);
  assert.equal(content.items[4].href, "/journal");
  assert.equal(content.items[4].children[0].href, "/hidden-child");
  assert.equal(managedSite.items[2].targetReference, actionId);
  assert.ok(renderToStaticMarkup(<PrimaryNavigation navigation={managedSite} />).includes('href="#about"'));
  const loadedAction = (await actionService.getActionsByIds(tenant, [actionId])).get(actionId);
  const cta = renderToStaticMarkup(<SectionRenderer section={{ id: "cta", type: "cta", variant: null, name: null, content: { actionId }, configuration: {}, action: loadedAction }} />);
  assert.ok(cta.includes('href="#about"'), "CTA and Navigation share contextual semantics");

  const anotherPage = await resolve("managedSite", { managedSiteId, pageId });
  assert.equal(anotherPage?.items.find((item) => item.targetType === "section")?.href, "/#about");
  assert.equal(anotherPage?.items.find((item) => item.targetType === "action")?.href, "#about");
  const noContext = await resolve("content", null);
  assert.deepEqual(noContext?.items.map((item) => item.href), ["#about", "https://example.com/docs", "/journal"]);
  const malformedContext = await resolve("managedSite", { managedSiteId, pageId: "invalid" });
  assert.deepEqual(malformedContext?.items.map((item) => item.targetType), ["action", "link"]);

  // Missing/inactive/cross-tenant records are excluded by the asserted SQL predicates.
  pageRows = [];
  sectionRows = [];
  actionRows = [[actionId, uuid(99), "Other tenant", "section", "Other", "#about", "active"]];
  const missing = await resolve();
  assert.deepEqual(missing?.items.map((item) => item.targetType), ["link"]);

  pageRows = [[pageId, managedSiteId, "//evil.example"]];
  sectionRows = [[sectionId, { anchor: "<unsafe>" }, homePageId, managedSiteId, "/"]];
  actionRows = [[actionId, tenant, "Unsafe", "link", "Unsafe", "javascript:alert(1)", "active"]];
  const unsafe = await resolve();
  assert.deepEqual(unsafe?.items.map((item) => item.targetType), ["link"]);

  actionRows = [[actionId, tenant, "About", "section", "About", "#about", "active"]];
  sectionRows = [[sectionId, { anchor: "about" }, homePageId, managedSiteId, "/"], [uuid(77), { anchor: "about" }, pageId, managedSiteId, "/other"]];
  const repeatedAnchors = await resolve();
  assert.equal(repeatedAnchors?.items.find((item) => item.targetType === "action")?.href, "#about");
  assert.ok(repeatedAnchors?.items.some((item) => item.targetType === "section"));

  // Anchor-only Actions need no ManagedSite Section records on either surface.
  itemRows = [item(12, "action", actionId)];
  const previousSectionQueries = sectionQueries;
  sectionRows = [];
  for (const surface of ["managedSite", "content"] as const) {
    assert.equal((await resolve(surface, null))?.items[0].href, "#about");
  }
  assert.equal(sectionQueries, previousSectionQueries);
  actionRows = [[actionId, tenant, "Homepage About", "link", "About", "/#about", "active"]];
  assert.equal((await resolve())?.items[0].href, "/#about");

  // Distinct Page UUIDs with identical slugs must not resolve across ManagedSites.
  itemRows = [item(10, "page", pageId), item(11, "page", uuid(88)), item(12, "section", sectionId)];
  pageRows = [[pageId, managedSiteId, "/about"], [uuid(88), otherManagedSiteId, "/about"]];
  sectionRows = [[sectionId, { anchor: "about" }, homePageId, otherManagedSiteId, "/"]];
  const firstSite = await resolve();
  assert.deepEqual(firstSite?.items.map((item) => [item.targetReference, item.href]), [[pageId, "/about"]]);
  expectedManagedSiteId = otherManagedSiteId;
  const secondSite = await resolve("managedSite", { managedSiteId: otherManagedSiteId });
  assert.deepEqual(secondSite?.items.map((item) => [item.targetReference, item.href]), [[uuid(88), "/about"], [sectionId, "/#about"]]);
  assert.deepEqual((await resolve("managedSite", null))?.items, []);
  expectedManagedSiteId = managedSiteId;

  itemRows = [item(10, "link", "javascript:alert(1)"), item(11, "page", "invalid")];
  assert.deepEqual((await resolve())?.items, []);
  navRows = [[nav, "Primary Navigation", { surfaces: { managedSite: false } }]];
  assert.equal(await resolve(), null);
  navRows = [];
  assert.equal(await resolve(), null);
});
