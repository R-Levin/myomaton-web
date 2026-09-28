import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getTableConfig } from "drizzle-orm/pg-core";

import { navigations } from "../lib/platform/db/schema/navigations";
import { navigationItems } from "../lib/platform/db/schema/navigation-items";
import { navigationDestination, navigationTree, normalizeNavigationItem, pageDestination, sectionAnchor, visibleOnSurface } from "../lib/platform/navigations/model";
import { PrimaryNavigation } from "../components/microsites/primary-navigation";

const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const nav = uuid(1);
const row = (n: number, extra = {}) => ({ id: uuid(n), navigationId: nav, parentId: null, name: `Item ${n}`, label: `Label ${n}`, targetType: "link", targetReference: "/about", sortOrder: n, status: "active", configuration: {}, ...extra });

test("Navigation is Web Presence owned and parent FK is scoped to the same Navigation", () => {
  const config = getTableConfig(navigations);
  assert.equal(config.foreignKeys[0].reference().foreignTable, config.foreignKeys[0].reference().foreignColumns[0].table);
  assert.equal(getTableConfig(config.foreignKeys[0].reference().foreignTable).name, "web_presences");
  assert.deepEqual(config.uniqueConstraints[0].columns.map((column) => column.name), ["web_presence_id", "name"]);
  const items = getTableConfig(navigationItems);
  const parent = items.foreignKeys.find((key) => key.getName() === "navigation_items_same_navigation_parent_fk")!;
  assert.deepEqual(parent.reference().columns.map((column) => column.name), ["navigation_id", "parent_id"]);
  assert.deepEqual(parent.reference().foreignColumns.map((column) => column.name), ["navigation_id", "id"]);
  assert.equal(parent.onDelete, "no action");
  assert.equal(items.checks[0].name, "navigation_items_not_own_parent");
});

test("surface visibility defaults to shared; only explicit exceptions differ", () => {
  for (const surface of ["microsite", "content"] as const) {
    assert.equal(visibleOnSurface({}, surface), true);
    assert.equal(visibleOnSurface({ surfaces: {} }, surface), true);
    assert.equal(visibleOnSurface({ surfaces: { [surface]: true } }, surface), true);
    assert.equal(visibleOnSurface({ surfaces: { [surface]: false } }, surface), false);
    for (const malformed of [null, [], { surfaces: [] }, { surfaces: { microsite: "false" } }]) {
      assert.equal(visibleOnSurface(malformed, surface), false);
    }
  }
  const contentOnly = { surfaces: { microsite: false, content: true } };
  assert.equal(visibleOnSurface(contentOnly, "microsite"), false);
  assert.equal(visibleOnSurface(contentOnly, "content"), true);
});

test("invalid references, inactive items, wrong navigation, and unsafe links are omitted", () => {
  for (const invalid of [row(2, { status: "inactive" }), row(2, { navigationId: uuid(9) }), row(2, { parentId: uuid(2) }), row(2, { parentId: "invalid" }), row(2, { label: " " }), row(2, { targetType: "page", targetReference: "not-a-uuid" }), row(2, { targetType: "future" }), row(2, { targetReference: "javascript:alert(1)" }), row(2, { sortOrder: Infinity })]) {
    assert.equal(normalizeNavigationItem(invalid, nav, "microsite"), null);
  }
});

test("destinations preserve paths and contextual anchors without a deployment domain", () => {
  assert.equal(navigationDestination("/about"), "/about");
  assert.equal(navigationDestination("/#about"), "/#about");
  assert.equal(navigationDestination("#about"), "#about");
  assert.equal(navigationDestination("https://example.com/docs"), "https://example.com/docs");
  assert.equal(navigationDestination("//evil.example"), null);
  const context = { micrositeId: uuid(2) };
  assert.equal(pageDestination({ micrositeId: uuid(2), slug: "/" }, context), "/");
  assert.equal(pageDestination({ micrositeId: uuid(2), slug: "/about?unsafe=1" }, context), null);
  assert.equal(pageDestination({ micrositeId: uuid(2), slug: "/" }), null);
  assert.equal(sectionAnchor({ anchor: "about" }), "#about");
  assert.equal(sectionAnchor({ anchor: "<script>" }), null);
});

test("identical slugs retain Microsite identity and require a matching routing context", () => {
  const first = { micrositeId: uuid(2), slug: "/about" };
  const second = { micrositeId: uuid(3), slug: "/about" };
  assert.equal(pageDestination(first, { micrositeId: first.micrositeId }), "/about");
  assert.equal(pageDestination(second, { micrositeId: first.micrositeId }), null);
  assert.equal(pageDestination(first, { micrositeId: second.micrositeId }), null);
  assert.equal(pageDestination(second, { micrositeId: second.micrositeId }), "/about");
  assert.equal(pageDestination(first, { micrositeId: "invalid" }), null);
});

test("tree keeps sibling order and rejects cycles, orphans, hidden branches and excessive depth", () => {
  const rows = [row(3, { sortOrder: 0 }), row(2), row(4, { parentId: uuid(2) }), row(5, { parentId: uuid(6) }), row(6, { parentId: uuid(5) }), row(7, { parentId: uuid(99) }), row(8, { parentId: uuid(5) })];
  const items = rows.map((value) => normalizeNavigationItem(value, nav, "microsite")!);
  const links = new Map(items.map((item) => [item.id, "/about"]));
  const tree = navigationTree(items, links);
  assert.deepEqual(tree.map((item) => item.id), [uuid(3), uuid(2)]);
  assert.deepEqual(tree[1].children.map((item) => item.id), [uuid(4)]);
  links.delete(uuid(2));
  assert.deepEqual(navigationTree(items, links).map((item) => item.id), [uuid(3)]);
  const deep = Array.from({ length: 12 }, (_, i) => normalizeNavigationItem(row(i + 20, { parentId: i === 0 ? null : uuid(i + 19) }), nav, "microsite")!);
  const limited = navigationTree(deep, new Map(deep.map((item) => [item.id, "/"])));
  let depth = 0;
  let current = limited[0];
  while (current) { depth += 1; current = current.children[0]; }
  assert.equal(depth, 8);
});

test("navigation renderer is semantic, escaped, and quiet for missing navigation", () => {
  assert.equal(renderToStaticMarkup(<PrimaryNavigation navigation={null} />), "");
  const item = normalizeNavigationItem(row(2, { label: "<About>" }), nav, "microsite")!;
  const items = navigationTree([item], new Map([[item.id, "/about"]]));
  const html = renderToStaticMarkup(<PrimaryNavigation navigation={{ id: nav, name: "Primary Navigation", surface: "microsite", items }} />);
  assert.ok(html.includes('<nav aria-label="Primary Navigation">'));
  assert.ok(html.includes("&lt;About&gt;"));
  assert.ok(html.includes('<a href="/about">'));
});
