import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { ResponsiveNavigation } from "../components/managed-sites/responsive-navigation";
import { PrimaryNavigation } from "../components/managed-sites/primary-navigation";
import type { NavigationItem } from "../lib/platform/navigations/model";

const item = (id: string, children: NavigationItem[] = []): NavigationItem => ({ id, name: id, label: id, href: `/${id}`, targetType: "link", targetReference: `/${id}`, children });
const tree = <ResponsiveNavigation><PrimaryNavigation navigation={{ id: "primary", name: "Primary Navigation", surface: "managedSite", items: [item("about"), item("teams", [item("northeast")])] }} /></ResponsiveNavigation>;

test("one server-rendered Navigation tree and accessible closed mobile control; desktop visibility is CSS-owned", () => {
  const doc = new JSDOM(renderToString(tree)).window.document;
  const toggle = doc.querySelector("button")!;
  assert.equal(toggle.type, "button"); assert.equal(toggle.getAttribute("aria-label"), "Primary navigation menu");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.ok(doc.getElementById(toggle.getAttribute("aria-controls")!)?.querySelector("nav"));
  assert.equal(doc.querySelectorAll("nav").length, 1);
  assert.deepEqual([...doc.querySelectorAll("nav a")].map(a => a.getAttribute("href")), ["/about", "/teams", "/northeast"]);
  assert.ok(doc.querySelector('nav li > ul a[href="/northeast"]'));
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.managed-site-menu-toggle \{ display: none; \}/);
  const narrow = css.slice(css.indexOf("@media (width < 64rem)"));
  assert.match(narrow, /\.managed-site-menu-toggle \{\s*display: inline-flex;/);
  assert.match(narrow, /\[data-open="false"\] \.managed-site-menu-panel \{ display: none; \}/);
  assert.match(narrow, /\.managed-site-menu-panel nav > ul \{ flex-direction: column;/);
  assert.ok(!css.slice(0, css.indexOf("@media (width < 64rem)")).includes('.managed-site-menu-panel { display: none;'));
});

test("hydrated menu toggles expanded state, closes on selection and Escape restores button focus", async () => {
  const dom = new JSDOM(`<div id="root">${renderToString(tree)}</div>`, { url: "http://localhost" });
  let frame: FrameRequestCallback | undefined;
  const replacements = { requestAnimationFrame: (callback: FrameRequestCallback) => { frame = callback; return 1; }, window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const descriptors = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(dom.window.document.getElementById("root")!, tree); });
    const button = dom.window.document.querySelector("button")!;
    await act(async () => { button.click(); });
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(button.textContent, "Close");
    assert.equal(button.getAttribute("aria-label"), "Close primary navigation menu");
    assert.equal(button.querySelector("path")?.getAttribute("d"), "M6 6l12 12M6 18L18 6");
    assert.equal(dom.window.document.querySelector(".managed-site-primary-menu")?.getAttribute("data-open"), "true");
    await act(async () => { dom.window.document.body.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })); });
    assert.equal(button.getAttribute("aria-expanded"), "false");
    await act(async () => { button.click(); });
    const link = dom.window.document.querySelector("nav a") as HTMLAnchorElement;
    link.focus();
    await act(async () => { link.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    assert.equal(button.getAttribute("aria-expanded"), "false"); assert.equal(dom.window.document.activeElement, button);
    await act(async () => { button.click(); });
    link.addEventListener("click", event => event.preventDefault());
    await act(async () => { link.click(); });
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(dom.window.document.querySelectorAll("nav a").length, 3);
    assert.equal(dom.window.document.activeElement, button);
    await act(async () => { button.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    frame!(0);
    assert.equal(dom.window.document.activeElement, link);
    assert.equal(button.getAttribute("aria-expanded"), "true");
  } finally {
    if (root) await act(async () => { root!.unmount(); });
    dom.window.close();
    for (const key of Object.keys(replacements)) {
      const descriptor = descriptors[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
