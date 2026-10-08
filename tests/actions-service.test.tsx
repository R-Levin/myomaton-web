import { disposablePreviewEnabled } from "../lib/platform/presentation/fpo";
import * as pageDestinations from "../lib/platform/managed-sites/page-destinations";
import * as visualModel from "../lib/platform/visual-direction/model";
import * as visualPolicy from "../lib/platform/policy/site-policy";
import * as globalModel from "../lib/platform/site-globals/model";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as actionModel from "../lib/platform/actions/model";
import * as collections from "../lib/platform/managed-sites/collections";
import * as sectionModel from "../lib/platform/managed-sites/sections";
import * as paths from "../lib/platform/managed-sites/paths";
import * as actionsSchema from "../lib/platform/db/schema/actions";
import * as managedSitesSchema from "../lib/platform/db/schema/managed-sites";
import * as pagesSchema from "../lib/platform/db/schema/pages";
import * as sectionsSchema from "../lib/platform/db/schema/sections";
import * as presencesSchema from "../lib/platform/db/schema/web-presences";
import { myomatonAction } from "../scripts/customer-bootstrap/myomaton-action";
import { myomatonDesignConfiguration } from "../scripts/customer-bootstrap/myomaton-design-system";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { loadService } from "./helpers/load-service";

test("services load seeded Action, enforce tenant scope, and resolve shared Hero/Intro/CTA references", async () => {
  const tenant = "11111111-1111-4111-8111-111111111111";
  const id = "22222222-2222-4222-8222-222222222222";
  const otherTenant = "33333333-3333-4333-8333-333333333333";
  let actionRows: unknown[][] = [[id, tenant, myomatonAction.name, myomatonAction.type, myomatonAction.label, myomatonAction.destination, "active"]];
  let actionQueries = 0;
  const client = {
    async query(query: { text: string }, params: unknown[]) {
      if (query.text.includes('from "actions"')) {
        actionQueries += 1;
        assert.match(query.text, /"actions"\."web_presence_id" = \$1/);
        assert.match(query.text, /"actions"\."status" = \$2/);
        assert.ok(query.text.includes('"actions"."id"'));
        assert.deepEqual(params, [tenant, "active", id]);
        return { rows: actionRows };
      }
      if (query.text.includes('from "web_presences"')) {
        return { rows: [[tenant, "managedSite", "Myomaton"]] };
      }
      if (query.text.includes('from "pages"')) {
        return { rows: [["page", "Home", "Myomaton", "/"]] };
      }
      if (query.text.includes('from "sections"')) {
        return { rows: [
          ["first", "hero", "default", "Hero", { heading: "First", actionId: id }, {}],
          ["second", "intro", "split-image-first", "Introduction", { heading: "Second", actionId: id }, {}],
          ["third", "cta", "default", "CTA", { heading: "Third", actionId: id }, {}],
          ["unknown", "future", null, null, { actionId: "33333333-3333-4333-8333-333333333333" }, {}],
        ] };
      }
      throw new Error(`Unexpected SQL: ${query.text}`);
    },
  };
  const db = drizzle({ client: client as unknown as Pool });
  const actionService = loadService("lib/platform/actions/service.ts", {
    "../managed-sites/page-destinations": pageDestinations,
    "drizzle-orm": orm,
    "@/lib/platform/db/connection": { db },
    "@/lib/platform/db/schema/actions": actionsSchema,
    "./model": actionModel,
  }) as typeof import("../lib/platform/actions/service");

  const loaded = await actionService.getActionsByIds(tenant, [id, id, "invalid"]);
  assert.deepEqual(loaded.get(id), { ...myomatonAction, id });
  assert.equal(loaded.size, 1);
  assert.equal(actionQueries, 1);
  assert.equal((await actionService.getActionsByIds(tenant, ["invalid"])).size, 0);
  assert.equal((await actionService.getActionsByIds("invalid", [id])).size, 0);
  assert.equal(actionQueries, 1);

  const managedSiteService = loadService("lib/platform/managed-sites/service.ts", {
    "../presentation/fpo": { disposablePreviewEnabled },
    "../canonical/projections": { projectCanonicalSections: async (_pool: unknown,_owner: unknown,rows: unknown) => rows },
    "../canonical/media": { offeringImages: async () => new Map() },
    "../visual-direction/model": visualModel, "../policy/site-policy": visualPolicy, "../site-globals/model": globalModel,
    "../site-globals/service": { getSiteGlobals: async () => undefined },
    "../contact/presentation": { contactPresentations: async () => new Map() },
    "./paths": paths,
    "./sections": sectionModel,
    "./collections": collections,
    "@/lib/platform/subjects/presentation-service": { getPresentedSubjectsByIds: async () => new Map() },
    "drizzle-orm": orm,
    "@/lib/platform/db/connection": { db },
    "@/lib/platform/db/schema/managed-sites": managedSitesSchema,
    "@/lib/platform/db/schema/pages": pagesSchema,
    "@/lib/platform/db/schema/sections": sectionsSchema,
    "@/lib/platform/db/schema/web-presences": presencesSchema,
    "@/lib/platform/assets/presentation-service": { getSectionImages: async () => new Map() },
    "@/lib/platform/actions/service": actionService,
    "@/lib/platform/actions/model": actionModel,
    "@/lib/platform/navigations/service": {
      async getNavigationByName(presenceId: string, name: string, surface: string, context: unknown) {
        assert.equal(presenceId, tenant);
        assert.equal(name, "Primary Navigation");
        assert.equal(surface, "managedSite");
        assert.deepEqual(context, { managedSiteId: "managedSite", pageId: "page" });
        return null;
      },
    },
    "@/lib/platform/design-systems/service": {
      async getDesignSystemByWebPresenceId(presenceId: string) {
        assert.equal(presenceId, tenant);
        return { id: "design", name: "Myomaton", configuration: myomatonDesignConfiguration };
      },
    },
  }) as typeof import("../lib/platform/managed-sites/service");

  const page = await managedSiteService.getManagedSitePage({ domain: "myomaton.com", managedSiteName: "Myomaton" }, "/");
  assert.ok(page);
  assert.equal(actionQueries, 2, "One batch query for all three presentations");
  assert.equal(page.sections.length, 3, "Unsupported types are omitted before dependency resolution");
  assert.equal(page.sections[0].action?.id, id);
  assert.strictEqual(page.sections[0].action, page.sections[1].action);
  const html = renderToStaticMarkup(<ManagedSitePageView page={page} />);
  assert.equal((html.match(/href="#about"/g) ?? []).length, 3);
  assert.ok(html.includes("--design-accent:#214e43"));

  for (const rows of [[], [[id, otherTenant, "Other", "section", "Other tenant", "#about", "active"]], [[id, tenant, "Inactive", "section", "Inactive", "#about", "inactive"]], [[id, tenant, "Unsafe", "link", "Unsafe", "javascript:alert(1)", "active"]]]) {
    actionRows = rows;
    const unavailable = await managedSiteService.getManagedSitePage({ domain: "myomaton.com", managedSiteName: "Myomaton" }, "/");
    assert.ok(unavailable);
    assert.ok(unavailable.sections.every((section) => section.action === null));
    const fallback = renderToStaticMarkup(<ManagedSitePageView page={unavailable} />);
    assert.ok(fallback.includes("First"));
    assert.ok(fallback.includes("Second"));
    assert.ok(fallback.includes("Third"));
    assert.ok(!fallback.split("<main>")[1].split("</main>")[0].includes("href="), "unresolved Section Actions are omitted; branding may still link Home");
  }
});
