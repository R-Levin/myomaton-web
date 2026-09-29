import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as sites from "../lib/platform/db/schema/microsites";
import * as pages from "../lib/platform/db/schema/pages";
import * as sections from "../lib/platform/db/schema/sections";
import * as presences from "../lib/platform/db/schema/web-presences";
import * as actions from "../lib/platform/actions/model";
import { myomatonDesignConfiguration } from "../scripts/seed-data/myomaton-design-system";
import { MicrositePageView } from "../components/microsites/microsite-page";
import { loadService } from "./helpers/load-service";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

test("microsite resolves intro images through the Asset service and renders optional image without content URLs", async () => {
  const client = { async query(query: { text: string }) {
    if (query.text.includes('from "web_presences"')) return { rows: [[id(1), id(2), "Myomaton", id(3), "Home", "Myomaton", "/"]] };
    if (query.text.includes('from "sections"')) return { rows: [[id(4), "intro", "default", "Introduction", { heading: "Robots", text: "Keep text" }, {}]] };
    throw new Error("Unexpected SQL");
  } };
  let hasImage = true;
  const image = { assetId: id(5), src: `/media/assets/${id(5)}`, width: 640, height: 480, alt: "A real robot" };
  const service = loadService("lib/platform/microsites/service.ts", {
    "drizzle-orm": orm,
    "@/lib/platform/db/connection": { db: drizzle({ client: client as unknown as Pool }) },
    "@/lib/platform/db/schema/microsites": sites, "@/lib/platform/db/schema/pages": pages,
    "@/lib/platform/db/schema/sections": sections, "@/lib/platform/db/schema/web-presences": presences,
    "@/lib/platform/actions/model": actions,
    "@/lib/platform/actions/service": { getActionsByIds: async () => new Map() },
    "@/lib/platform/navigations/service": { getNavigationByName: async () => null },
    "@/lib/platform/design-systems/service": { getDesignSystemByWebPresenceId: async () => ({ id: id(6), name: "Design", configuration: myomatonDesignConfiguration }) },
    "@/lib/platform/assets/presentation-service": { getSectionImages: async (presenceId: string, ids: string[]) => {
      assert.equal(presenceId, id(1)); assert.deepEqual(ids, [id(4)]);
      return new Map(hasImage ? [[id(4), image]] : []);
    } },
  }) as typeof import("../lib/platform/microsites/service");
  const page = await service.getMicrositePageByDomain("myomaton.com", "/");
  assert.ok(page); assert.deepEqual(page.sections[0].image, image);
  assert.deepEqual(page.sections[0].content, { heading: "Robots", text: "Keep text" });
  assert.ok(renderToStaticMarkup(<MicrositePageView page={page} />).includes(image.src));
  hasImage = false;
  const absent = await service.getMicrositePageByDomain("myomaton.com", "/"); assert.ok(absent);
  assert.equal(absent.sections[0].image, null);
  const html = renderToStaticMarkup(<MicrositePageView page={absent} />);
  assert.ok(!html.includes("<img")); assert.ok(html.includes("Keep text"));
});
