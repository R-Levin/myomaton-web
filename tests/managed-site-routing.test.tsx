import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import { notFound } from "next/navigation";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as sites from "../lib/platform/db/schema/managed-sites";
import * as pages from "../lib/platform/db/schema/pages";
import * as sections from "../lib/platform/db/schema/sections";
import * as presences from "../lib/platform/db/schema/web-presences";
import * as actions from "../lib/platform/actions/model";
import * as collections from "../lib/platform/managed-sites/collections";
import * as sectionModel from "../lib/platform/managed-sites/sections";
import * as paths from "../lib/platform/managed-sites/paths";
import { pageDestination } from "../lib/platform/navigations/model";
import { managedSiteDeployment } from "../lib/platform/managed-sites/deployment";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { myomatonDesignConfiguration } from "../scripts/customer-bootstrap/myomaton-design-system";
import { loadService } from "./helpers/load-service";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const selection = { domain: "example.test", managedSiteName: "Selected" };

function fixture() {
  const state = {
    siteStatus: "active", presenceStatus: "active", ambiguousSite: false, duplicatePage: false,
    pages: [
      { id: id(3), managedSiteId: id(2), slug: "/", name: "Home", title: "Myomaton", status: "active" },
      { id: id(4), managedSiteId: id(2), slug: "/teams/northeast", name: "Northeast", title: "Our Northeast team", status: "active" },
      { id: id(5), managedSiteId: id(2), slug: "/inactive", name: "Inactive", title: "Hidden", status: "inactive" },
      { id: id(6), managedSiteId: id(99), slug: "/foreign", name: "Foreign", title: "Foreign", status: "active" },
      { id: id(7), managedSiteId: id(2), slug: "/trailing/", name: "Noncanonical", title: "Hidden", status: "active" },
    ],
    queries: 0, renderedPageIds: [] as string[], navigationContexts: [] as unknown[],
  };
  const client = { async query(query: { text: string }, params: unknown[]) {
    state.queries++;
    assert.match(query.text, /^select /, "read-only service");
    if (query.text.includes('from "web_presences"')) {
      assert.match(query.text, /"web_presences"\."primary_domain" = \$1/);
      assert.match(query.text, /"managed_sites"\."name" = \$2/);
      assert.match(query.text, /"web_presences"\."status" = \$3/);
      assert.match(query.text, /"managed_sites"\."status" = \$4/);
      assert.deepEqual(params, [selection.domain, selection.managedSiteName, "active", "active", 2]);
      if (state.siteStatus !== "active" || state.presenceStatus !== "active") return { rows: [] };
      const rows = [[id(1), id(2), selection.managedSiteName]];
      return { rows: state.ambiguousSite ? [...rows, [id(1), id(98), selection.managedSiteName]] : rows };
    }
    if (query.text.includes('from "pages"')) {
      assert.match(query.text, /"pages"\."managed_site_id" = \$1/);
      assert.match(query.text, /"pages"\."slug" = \$2/);
      assert.match(query.text, /"pages"\."status" = \$3/);
      assert.equal(params[0], id(2)); assert.equal(params[2], "active"); assert.equal(params[3], 2);
      const rows = state.pages.filter(p => p.managedSiteId === params[0] && p.slug === params[1] && p.status === params[2])
        .map(p => [p.id, p.name, p.title, p.slug]);
      return { rows: state.duplicatePage ? [...rows, ...rows] : rows };
    }
    if (query.text.includes('from "sections"')) {
      assert.match(query.text, /"sections"\."page_id" = \$1/);
      assert.match(query.text, /"sections"\."status" = \$2/);
      assert.match(query.text, /order by "sections"\."sort_order" asc, "sections"\."id" asc/);
      assert.equal(params[1], "active");
      state.renderedPageIds.push(params[0] as string);
      return { rows: [[id(8), "intro", "stack", "Story", { heading: "Team story", text: "First paragraph.\n\nSecond paragraph." }, { anchor: "story" }]] };
    }
    throw new Error(`Unexpected query: ${query.text}`);
  } };
  const service = loadService("lib/platform/managed-sites/service.ts", {
    "../site-globals/service": { getSiteGlobals: async () => undefined },
    "../contact/presentation": { contactPresentations: async () => new Map() },
    "./paths": paths, "./sections": sectionModel, "./collections": collections,
    "drizzle-orm": orm, "@/lib/platform/db/connection": { db: drizzle({ client: client as unknown as Pool }) },
    "@/lib/platform/db/schema/managed-sites": sites, "@/lib/platform/db/schema/pages": pages,
    "@/lib/platform/db/schema/sections": sections, "@/lib/platform/db/schema/web-presences": presences,
    "@/lib/platform/actions/model": actions,
    "@/lib/platform/actions/service": { getActionsByIds: async (presenceId: string, _ids: readonly string[], context: unknown) => {
      assert.equal(presenceId, id(1)); assert.deepEqual(context, { managedSiteId: id(2) }); return new Map();
    } },
    "@/lib/platform/subjects/presentation-service": { getPresentedSubjectsByIds: async () => new Map() },
    "@/lib/platform/assets/presentation-service": { getSectionImages: async () => new Map() },
    "@/lib/platform/design-systems/service": { getDesignSystemByWebPresenceId: async () => ({ id: id(9), name: "Design", configuration: myomatonDesignConfiguration }) },
    "@/lib/platform/navigations/service": { getNavigationByName: async (presenceId: string, name: string, surface: string, context: unknown) => {
      assert.equal(presenceId, id(1)); assert.equal(name, "Primary Navigation"); assert.equal(surface, "managedSite");
      state.navigationContexts.push(context); return null;
    } },
  }) as typeof import("../lib/platform/managed-sites/service");
  return { state, service };
}

test("path contract shares canonical root-relative, case-sensitive nested paths with Navigation", () => {
  assert.equal(paths.pagePathFromSegments(undefined), "/");
  assert.equal(paths.pagePathFromSegments(["teams", "northeast"]), "/teams/northeast");
  assert.equal(paths.normalizePagePath("/teams/northeast/"), "/teams/northeast");
  for (const slug of ["/", "/about", "/teams/northeast", "/Team_1/a.b~c-d"]) {
    assert.equal(paths.canonicalPagePath(slug), slug);
    assert.equal(pageDestination({ managedSiteId: id(2), slug }, { managedSiteId: id(2) }), slug);
  }
  for (const invalid of [null, "", "about", "//", "//evil.test", "/a//b", "/a//", "/a/../b", "/./a", "/a%2fb", "/%252e", "/a?b", "/a#b", "/a\\b", "/a b", "/a\n", "/<x>", "/" + "a".repeat(2048)]) {
    assert.equal(paths.normalizePagePath(invalid), null, String(invalid));
  }
  for (const invalid of [null, [], [""], ["a/b"], [".."], ["%2f"], ["a", ""], [1]]) {
    assert.equal(paths.pagePathFromSegments(invalid), null);
  }
  for (const slug of ["/about/", "about", "/media", "/media/assets/test", "/_next", "/_next/static/a.js", "/_not-found", "/_global-error"]) {
    assert.equal(pageDestination({ managedSiteId: id(2), slug }, { managedSiteId: id(2) }), null);
  }
  assert.equal(paths.canonicalPagePath("/media-guide"), "/media-guide");
});

test("root and Navigation Page destinations resolve exact canonical identities and share Section rendering", async () => {
  const { service, state } = fixture();
  const home = await service.getManagedSitePage(selection, "/"); assert.ok(home);
  assert.equal(home.page.id, id(3));
  const href = pageDestination(state.pages[1], { managedSiteId: id(2), pageId: home.page.id }); assert.ok(href);
  const secondary = await service.getManagedSitePage(selection, href); assert.ok(secondary);
  assert.equal(secondary.page.id, id(4)); assert.equal(secondary.page.slug, href);
  assert.equal((await service.getManagedSitePage(selection, `${href}/`))?.page.id, id(4));
  assert.deepEqual(state.renderedPageIds, [id(3), id(4), id(4)]);
  assert.deepEqual(state.navigationContexts[1], { managedSiteId: id(2), pageId: id(4) });
  const html = renderToStaticMarkup(<ManagedSitePageView page={secondary} />);
  assert.match(html, /id="story"/); assert.match(html, /Team story/);
  assert.match(html, /<p[^>]*>First paragraph\.<\/p><p[^>]*>Second paragraph\.<\/p>/);
});

test("unknown, inactive, cross-ManagedSite, noncanonical and ambiguous lookups fail closed", async () => {
  const { service, state } = fixture();
  for (const path of ["/unknown", "/inactive", "/foreign", "/trailing", "/Teams/northeast"]) {
    assert.equal(await service.getManagedSitePage(selection, path), null, path);
  }
  assert.deepEqual(state.renderedPageIds, []);
  const before = state.queries;
  for (const path of ["//evil.test", "/a/../b", "/media/assets/test", "/_next/static/test", "/_not-found", "/_global-error"]) {
    assert.equal(await service.getManagedSitePage(selection, path), null);
  }
  assert.equal(state.queries, before, "unsafe/reserved input causes no database query");
  state.siteStatus = "inactive"; assert.equal(await service.getManagedSitePage(selection, "/"), null);
  state.siteStatus = "active"; state.presenceStatus = "inactive";
  assert.equal(await service.getManagedSitePage(selection, "/"), null);
  state.presenceStatus = "active"; state.ambiguousSite = true;
  assert.equal(await service.getManagedSitePage(selection, "/"), null);
  state.ambiguousSite = false; state.duplicatePage = true;
  assert.equal(await service.getManagedSitePage(selection, "/"), null);
  assert.deepEqual(state.renderedPageIds, []);
});

test("App Router shares metadata/render lookup, preserves Home title and throws Next not-found", async () => {
  const { service, state } = fixture();
  let calls = 0;
  const route = loadService("app/[[...path]]/page.tsx", {
    "react": { cache: (fn: unknown) => fn }, "react/jsx-runtime": jsxRuntime,
    "next/navigation": { notFound }, "next/server": { connection: async () => {} },
    "@/components/managed-sites/managed-site-page": { ManagedSitePageView },
    "@/lib/platform/managed-sites/paths": paths,
    "@/lib/platform/managed-sites/deployment": { managedSiteDeployment },
    "@/lib/platform/managed-sites/service": { getManagedSitePage: async (selected: unknown, path: string) => {
      calls++; assert.deepEqual(selected, managedSiteDeployment);
      return service.getManagedSitePage(selection, path);
    } },
  }) as typeof import("../app/[[...path]]/page");
  const props = (path?: string[]) => ({ params: Promise.resolve({ path }) });
  assert.deepEqual(await route.generateMetadata(props()), { title: "Myomaton" });
  assert.deepEqual(await route.generateMetadata(props(["teams", "northeast"])), { title: "Our Northeast team" });
  const rendered = await route.default(props(["teams", "northeast"]));
  assert.equal(rendered.type, ManagedSitePageView); assert.equal(rendered.props.page.page.id, id(4));
  assert.match(renderToStaticMarkup(rendered), /Team story/);
  state.pages[1].title = " "; assert.deepEqual(await route.generateMetadata(props(["teams", "northeast"])), { title: "Northeast" });
  state.pages[1].name = " "; assert.deepEqual(await route.generateMetadata(props(["teams", "northeast"])), { title: "Selected" });
  for (const path of [["unknown"], ["inactive"], ["foreign"], ["media", "assets", "x"], ["a/b"], ["%2f"]]) {
    await assert.rejects(route.default(props(path)), /NEXT_HTTP_ERROR_FALLBACK;404/);
    await assert.rejects(route.generateMetadata(props(path)), /NEXT_HTTP_ERROR_FALLBACK;404/);
  }
  state.ambiguousSite = true;
  await assert.rejects(route.default(props()), /NEXT_HTTP_ERROR_FALLBACK;404/);
  state.ambiguousSite = false; state.duplicatePage = true;
  await assert.rejects(route.default(props()), /NEXT_HTTP_ERROR_FALLBACK;404/);
  assert.ok(calls > 0);
});
