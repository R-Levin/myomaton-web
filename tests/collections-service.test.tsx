import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as subjects from "../lib/platform/db/schema/subjects";
import * as presences from "../lib/platform/db/schema/web-presences";
import * as sites from "../lib/platform/db/schema/microsites";
import * as pages from "../lib/platform/db/schema/pages";
import * as sections from "../lib/platform/db/schema/sections";
import * as actions from "../lib/platform/db/schema/actions";
import * as subjectModel from "../lib/platform/subjects/presentation";
import * as actionModel from "../lib/platform/actions/model";
import * as paths from "../lib/platform/microsites/paths";
import * as sectionModel from "../lib/platform/microsites/sections";
import * as collections from "../lib/platform/microsites/collections";
import { SectionRenderer } from "../components/microsites/section-renderer";
import { loadService } from "./helpers/load-service";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

test("Subject presentation lookup validates requested IDs, tenant and active eligibility and returns only public copy", async () => {
  let queries = 0;
  let rows: unknown[][] = [
    [id(3), id(1), "Third", "Description", "active"],
    [id(2), id(1), "Second", null, "active"],
    [id(4), id(1), "Inactive", "Hidden", "inactive"],
    [id(5), id(99), "Foreign", "Hidden", "active"],
    [id(6), id(1), " ", "Invalid name", "active"],
    [id(8), id(1), "Not requested", null, "active"],
  ];
  const client = { async query(query: { text: string }, params: unknown[]) {
    queries++;
    assert.match(query.text, /inner join "web_presences"/);
    assert.match(query.text, /"subjects"\."web_presence_id" = \$1/);
    assert.match(query.text, /"subjects"\."status" = \$2/);
    assert.match(query.text, /"web_presences"\."status" = \$3/);
    assert.match(query.text, /"subjects"\."id" in/);
    assert.deepEqual(params, [id(1), "active", "active", id(2), id(3), id(4), id(5), id(6), id(7)]);
    return { rows };
  } };
  const service = loadService("lib/platform/subjects/presentation-service.ts", {
    "drizzle-orm": orm, "@/lib/platform/db/connection": { db: drizzle({ client: client as unknown as Pool }) },
    "@/lib/platform/db/schema/subjects": subjects, "@/lib/platform/db/schema/web-presences": presences, "./presentation": subjectModel,
  }) as typeof import("../lib/platform/subjects/presentation-service");
  assert.equal((await service.getPresentedSubjectsByIds("bad", [id(2)])).size, 0);
  assert.equal((await service.getPresentedSubjectsByIds(id(1), ["bad"])).size, 0);
  assert.equal(queries, 0);
  const requested = [id(2), id(3), id(4), id(5), id(6), id(7), id(2), "bad"];
  const found = await service.getPresentedSubjectsByIds(id(1), requested);
  assert.equal(queries, 1); assert.equal(found.size, 2);
  assert.deepEqual(found.get(id(2)), { id: id(2), name: "Second", description: null });
  assert.deepEqual(found.get(id(3)), { id: id(3), name: "Third", description: "Description" });
  rows = []; // SQL eligibility can exclude an inactive Web Presence altogether.
  assert.equal((await service.getPresentedSubjectsByIds(id(1), requested)).size, 0);
});

test("microsite batches Subject and item Action dependencies, preserves curated order, and keeps content canonical", async () => {
  let subjectQueries = 0, actionQueries = 0;
  let actionRows: unknown[][] = [[id(20), id(1), "Details", "link", "Learn", "/details", "active"]];
  const curated = { heading: "Services", itemSource: "subjects", items: [
    { id: "b", subjectId: id(3), actionId: id(20), heading: "Stale name", text: "Stale copy" },
    { id: "a", subjectId: id(2), actionId: id(20) },
    { id: "inactive", subjectId: id(4) }, { id: "foreign", subjectId: id(5) }, { id: "missing", subjectId: id(6) },
  ] };
  const before = structuredClone(curated);
  const client = { async query(query: { text: string }, params: unknown[]) {
    if (query.text.includes('from "subjects"')) {
      subjectQueries++; assert.deepEqual(params, [id(1), "active", "active", id(3), id(2), id(4), id(5), id(6)]);
      return { rows: [[id(2), id(1), "Service A", null, "active"], [id(3), id(1), "Service B", "Current description", "active"],
        [id(4), id(1), "Inactive", null, "inactive"], [id(5), id(99), "Foreign", null, "active"]] };
    }
    if (query.text.includes('from "actions"')) {
      actionQueries++; assert.deepEqual(params, [id(1), "active", id(20)]); return { rows: actionRows };
    }
    if (query.text.includes('from "web_presences"')) return { rows: [[id(1), id(10), "Site"]] };
    if (query.text.includes('from "pages"')) return { rows: [[id(11), "Page", "Title", "/"]] };
    if (query.text.includes('from "sections"')) return { rows: [
      [id(12), "collection", "grid", "Subjects", curated, { columns: 3 }],
      [id(13), "collection", "grid", "Inline", { itemSource: "inline", items: [{ id: "feature", heading: "Feature", actionId: id(20) }] }, { columns: 2 }],
      [id(14), "hero", "default", "Hero", { heading: "Hero", actionId: id(20) }, {}],
    ] };
    throw new Error(`Unexpected query: ${query.text}`);
  } };
  const connection = { db: drizzle({ client: client as unknown as Pool }) };
  const subjectService = loadService("lib/platform/subjects/presentation-service.ts", {
    "drizzle-orm": orm, "@/lib/platform/db/connection": connection,
    "@/lib/platform/db/schema/subjects": subjects, "@/lib/platform/db/schema/web-presences": presences, "./presentation": subjectModel,
  });
  const actionService = loadService("lib/platform/actions/service.ts", {
    "drizzle-orm": orm, "@/lib/platform/db/connection": connection, "@/lib/platform/db/schema/actions": actions, "./model": actionModel,
  });
  const service = loadService("lib/platform/microsites/service.ts", {
    "./paths": paths,
    "drizzle-orm": orm, "@/lib/platform/db/connection": connection,
    "@/lib/platform/db/schema/microsites": sites, "@/lib/platform/db/schema/pages": pages,
    "@/lib/platform/db/schema/sections": sections, "@/lib/platform/db/schema/web-presences": presences,
    "@/lib/platform/actions/model": actionModel, "@/lib/platform/actions/service": actionService,
    "@/lib/platform/subjects/presentation-service": subjectService, "./sections": sectionModel, "./collections": collections,
    "@/lib/platform/assets/presentation-service": { getSectionImages: async (_tenant: string, ids: string[]) => { assert.deepEqual(ids, []); return new Map(); } },
    "@/lib/platform/navigations/service": { getNavigationByName: async () => null },
    "@/lib/platform/design-systems/service": { getDesignSystemByWebPresenceId: async () => ({ id: null, name: null, configuration: {} }) },
  }) as typeof import("../lib/platform/microsites/service");
  const page = await service.getMicrositePage({ domain: "example.test", micrositeName: "Site" }, "/"); assert.ok(page);
  assert.equal(subjectQueries, 1); assert.equal(actionQueries, 1);
  assert.deepEqual(curated, before);
  const section = page.sections[0];
  assert.deepEqual(section.collectionItems?.map((item) => item.heading), ["Service B", "Service A"]);
  assert.deepEqual(section.content, { ...curated, items: curated.items.map(({ id, subjectId, actionId }) => ({ id, subjectId, ...(actionId ? { actionId } : {}) })) });
  const html = page.sections.map((section) => renderToStaticMarkup(<SectionRenderer section={section} />)).join("");
  assert.equal((html.match(/href="\/details"/g) ?? []).length, 4);
  assert.ok(html.indexOf("Service B") < html.indexOf("Service A")); assert.match(html, /Current description/);
  assert.ok(!html.includes("Stale")); assert.ok(!html.includes("Foreign")); assert.ok(!html.includes("Inactive"));
  for (const rows of [[], [[id(20), id(99), "Details", "link", "Foreign", "/details", "active"]],
    [[id(20), id(1), "Details", "link", "Inactive", "/details", "inactive"]],
    [[id(20), id(1), "Details", "link", "Unsafe", "javascript:alert(1)", "active"]],
    [[id(20), id(1), "Details", "link", {}, "/details", "active"]]]) {
    actionRows = rows;
    const unavailable = await service.getMicrositePage({ domain: "example.test", micrositeName: "Site" }, "/"); assert.ok(unavailable);
    const fallback = unavailable.sections.map((section) => renderToStaticMarkup(<SectionRenderer section={section} />)).join("");
    assert.match(fallback, /Service B/); assert.match(fallback, /Service A/); assert.match(fallback, /Feature/);
    assert.ok(!fallback.includes("href="));
  }
});
