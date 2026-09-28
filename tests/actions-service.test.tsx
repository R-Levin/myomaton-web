import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as actionModel from "../lib/platform/actions/model";
import * as actionsSchema from "../lib/platform/db/schema/actions";
import * as micrositesSchema from "../lib/platform/db/schema/microsites";
import * as pagesSchema from "../lib/platform/db/schema/pages";
import * as sectionsSchema from "../lib/platform/db/schema/sections";
import * as presencesSchema from "../lib/platform/db/schema/web-presences";
import { myomatonAction } from "../scripts/seed-data/myomaton-action";
import { myomatonDesignConfiguration } from "../scripts/seed-data/myomaton-design-system";
import { MicrositePageView } from "../components/microsites/microsite-page";
import { loadService } from "./helpers/load-service";

test("services load seeded Action, enforce tenant scope, and resolve shared CTA references", async () => {
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
        return { rows: [[tenant, "microsite", "Myomaton", "page", "Home", "Myomaton", "/"]] };
      }
      if (query.text.includes('from "sections"')) {
        return { rows: [
          ["first", "cta", "default", "CTA", { heading: "First", actionId: id }, {}],
          ["second", "cta", "default", "CTA", { heading: "Second", actionId: id }, {}],
        ] };
      }
      throw new Error(`Unexpected SQL: ${query.text}`);
    },
  };
  const db = drizzle({ client: client as unknown as Pool });
  const actionService = loadService("lib/platform/actions/service.ts", {
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

  const micrositeService = loadService("lib/platform/microsites/service.ts", {
    "drizzle-orm": orm,
    "@/lib/platform/db/connection": { db },
    "@/lib/platform/db/schema/microsites": micrositesSchema,
    "@/lib/platform/db/schema/pages": pagesSchema,
    "@/lib/platform/db/schema/sections": sectionsSchema,
    "@/lib/platform/db/schema/web-presences": presencesSchema,
    "@/lib/platform/actions/service": actionService,
    "@/lib/platform/actions/model": actionModel,
    "@/lib/platform/navigations/service": {
      async getNavigationByName(presenceId: string, name: string, surface: string, context: unknown) {
        assert.equal(presenceId, tenant);
        assert.equal(name, "Primary Navigation");
        assert.equal(surface, "microsite");
        assert.deepEqual(context, { micrositeId: "microsite", pageId: "page" });
        return null;
      },
    },
    "@/lib/platform/design-systems/service": {
      async getDesignSystemByWebPresenceId(presenceId: string) {
        assert.equal(presenceId, tenant);
        return { id: "design", name: "Myomaton", configuration: myomatonDesignConfiguration };
      },
    },
  }) as typeof import("../lib/platform/microsites/service");

  const page = await micrositeService.getMicrositePageByDomain("myomaton.com", "/");
  assert.ok(page);
  assert.equal(actionQueries, 2, "One batch query for both presentations");
  assert.equal(page.sections[0].action?.id, id);
  assert.strictEqual(page.sections[0].action, page.sections[1].action);
  const html = renderToStaticMarkup(<MicrositePageView page={page} />);
  assert.equal((html.match(/href="#about"/g) ?? []).length, 2);
  assert.ok(html.includes("--design-accent:#214e43"));

  for (const rows of [[], [[id, otherTenant, "Other", "section", "Other tenant", "#about", "active"]], [[id, tenant, "Inactive", "section", "Inactive", "#about", "inactive"]], [[id, tenant, "Unsafe", "link", "Unsafe", "javascript:alert(1)", "active"]]]) {
    actionRows = rows;
    const unavailable = await micrositeService.getMicrositePageByDomain("myomaton.com", "/");
    assert.ok(unavailable);
    assert.equal(unavailable.sections[0].action, null);
    const fallback = renderToStaticMarkup(<MicrositePageView page={unavailable} />);
    assert.ok(fallback.includes("First"));
    assert.ok(!fallback.includes("href="));
  }
});
