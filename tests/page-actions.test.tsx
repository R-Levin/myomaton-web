import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { drizzle } from "drizzle-orm/node-postgres";
import * as orm from "drizzle-orm";
import type { Pool } from "pg";
import * as model from "../lib/platform/actions/model";
import * as schema from "../lib/platform/db/schema/actions";
import * as targets from "../lib/platform/managed-sites/page-destinations";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import { loadService } from "./helpers/load-service";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

test("Page Actions resolve stable identity within active presence/site context, fail closed and preserve content", async () => {
  const presence = id(1), site = id(2), pageId = id(3), actionId = id(4);
  const page = { id: pageId, site, presence, slug: "/projects", status: "active", siteStatus: "active", presenceStatus: "active" };
  let state = { ...page }, duplicate = false, destination = pageId, pageQueries = 0;
  const client = { async query(query: { text: string }, params: unknown[]) {
    if (query.text.includes('from "actions"')) {
      assert.deepEqual(params, [presence, "active", actionId]);
      return { rows: [[actionId, presence, "Projects", "page", "See projects", destination, "active"]] };
    }
    assert.ok(query.text.includes('from "pages"'));
    assert.deepEqual(params, [pageId, site, presence, "active", "active", "active"]);
    for (const column of ['"managed_sites"."id"', '"managed_sites"."web_presence_id"', '"pages"."status"', '"managed_sites"."status"', '"web_presences"."status"']) assert.ok(query.text.includes(column));
    pageQueries++;
    const eligible = state.id === params[0] && state.site === params[1] && state.presence === params[2]
      && state.siteStatus === params[3] && state.status === params[4] && state.presenceStatus === params[5];
    const rows = eligible ? [[state.id, state.site, state.slug]] : [];
    return { rows: duplicate ? [...rows, ...rows] : rows };
  } };
  const db = drizzle({ client: client as unknown as Pool });
  const service = loadService("lib/platform/actions/service.ts", {
    "drizzle-orm": orm, "@/lib/platform/db/connection": { db },
    "@/lib/platform/db/schema/actions": schema, "./model": model,
    "../managed-sites/page-destinations": targets,
  }) as typeof import("../lib/platform/actions/service");
  const resolve = () => service.getActionsByIds(presence, [actionId], { managedSiteId: site });
  for (const slug of ["/projects", "/teams/northeast", "/"]) {
    state.slug = slug;
    const action = (await resolve()).get(actionId)!;
    assert.equal(action.type, "page"); assert.equal(action.destination, slug);
    for (const type of ["hero", "intro", "cta", "collection"]) {
      const content = type === "collection" ? { itemSource: "inline", items: [{ id: "stable", heading: "Keep", actionId }] } : { heading: "Keep", actionId };
      const section = { id: id(5), type, name: null, variant: null, content, configuration: {}, action,
        ...(type === "collection" ? { collectionItems: [{ id: "stable", heading: "Keep", action }] } : {}) };
      const html = renderToStaticMarkup(<SectionRenderer section={section} />);
      assert.ok(html.includes(`href="${slug}"`)); assert.ok(html.includes("Keep"));
      assert.ok(!JSON.stringify(content).includes(slug));
    }
  }
  for (const change of [{ id: id(99) }, { site: id(99) }, { presence: id(99) }, { status: "inactive" },
    { siteStatus: "inactive" }, { presenceStatus: "inactive" }, { slug: "/media/assets/foo" },
    { slug: "/not-canonical/" }, { slug: "//evil.test" }, { slug: "/x%2Fy" }]) {
    state = { ...page, ...change };
    const action = (await resolve()).get(actionId); assert.equal(action, undefined);
    for (const type of ["hero", "intro", "cta"]) {
      const html = renderToStaticMarkup(<SectionRenderer section={{ id: id(5), type, name: null, variant: null,
        content: { heading: "Keep", text: "Body remains", actionId }, configuration: {}, action }} />);
      assert.ok(html.includes("Keep") && html.includes("Body remains")); assert.ok(!html.includes("href="));
    }
  }
  state = { ...page }; duplicate = true; assert.equal((await resolve()).size, 0); duplicate = false;
  const before = pageQueries;
  for (const invalid of ["not-a-uuid", "/projects", "https://example.test/projects"]) {
    destination = invalid; assert.equal((await resolve()).size, 0);
  }
  destination = pageId;
  assert.equal((await service.getActionsByIds(presence, [actionId])).size, 0);
  assert.equal((await service.getActionsByIds(presence, [actionId], { managedSiteId: "bad" })).size, 0);
  assert.equal(pageQueries, before, "Malformed identities and missing context do not query Pages");
  const raw = { id: actionId, webPresenceId: presence, name: "Page", label: "Go", type: "page", destination: pageId, status: "active" };
  assert.equal(model.normalizeAction(raw, presence), null, "Unresolved UUID is not a presentation URL");
  assert.equal(model.normalizeDestination("page", pageId), null);
});
