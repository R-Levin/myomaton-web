import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Use the project's existing TypeScript compiler; no test-runner dependency needed.
const load = createRequire(import.meta.url);
const Module = load("node:module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(this, id.startsWith("@/") ? path.join(process.cwd(), id.slice(2)) : id, ...args);
};
for (const extension of [".ts", ".tsx"]) {
  load.extensions[extension] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, file);
}
load.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
};

const { JsonFileContentRepository } = load("../lib/content/json-file-repository.ts");
const { initialEditorData } = load("../lib/editor/initial-data.ts");
const { defaultSiteTheme, siteThemeVariables } = load("../lib/site-theme.ts");
const { sameWorkingCopy, parseWorkingCopy, parseHomepageContent } = load("../lib/content/validation.ts");
const browserStorage = load("../lib/editor/browser-storage.ts");
const copy = () => structuredClone({ page: initialEditorData, theme: defaultSiteTheme });

test("legacy content gains bounded style defaults without mutating stored data", () => {
  const legacy = copy();
  legacy.theme = { headingFont: "geist", bodyFont: "system-sans" };
  delete legacy.page.content[0].props.width;
  delete legacy.page.content[0].props.spacing;
  legacy.page.content[1].props.width = "normal";
  delete legacy.page.content[1].props.alignment;
  delete legacy.page.content[1].props.spacing;
  const before = JSON.stringify(legacy);
  const migrated = parseWorkingCopy(legacy);
  assert.deepEqual(migrated.theme, { ...defaultSiteTheme, bodyFont: "system-sans" });
  assert.equal(migrated.page.content[0].props.width, "standard");
  assert.equal(migrated.page.content[1].props.width, "standard");
  assert.equal(migrated.page.content[1].props.alignment, "left");
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(sameWorkingCopy(legacy, migrated), true);
  const state = parseHomepageContent({ schemaVersion: 1, draft: { snapshot: legacy, savedAt: "2026-01-01" }, published: { snapshot: legacy, savedAt: "2026-01-01", publishedAt: "2026-01-02" } });
  assert.deepEqual(state.published.snapshot, migrated);
  for (const [key, value] of [["baseTextSize", "24px"], ["headingScale", "huge"], ["contentWidth", "100vw"], ["sectionSpacing", "6em"], ["accentColor", "red; background: url(x)"]]) {
    assert.throws(() => parseWorkingCopy({ ...copy(), theme: { ...defaultSiteTheme, [key]: value } }));
  }
  const invalidBlock = copy(); invalidBlock.page.content[0].props.width = "narrow";
  assert.throws(() => parseWorkingCopy(invalidBlock));
});

test("draft/publish persistence, optimistic conflicts, and corrupt-file protection", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "myomaton-storage-test-"));
  try {
    const repository = new JsonFileContentRepository(directory);
    assert.equal((await repository.read()).published, null);
    await assert.rejects(repository.publish(new Date().toISOString()));
    const first = await repository.saveDraft(copy(), null);
    const reloaded = await new JsonFileContentRepository(directory).read();
    assert.deepEqual(first, reloaded);
    const working = copy();
    working.page.content[0].props.heading = "Unsaved test heading";
    working.theme.headingFont = "system-serif";
    working.theme.bodyFont = "system-sans";
    assert.equal(sameWorkingCopy(working, first.draft.snapshot), false);
    assert.deepEqual((await repository.read()).draft, first.draft);
    const published = await repository.publish(first.draft.savedAt);
    assert.deepEqual(published.published.snapshot, first.draft.snapshot);
    const second = await repository.saveDraft(working, first.draft.savedAt);
    assert.deepEqual(second.published, published.published);
    await assert.rejects(repository.publish(first.draft.savedAt));
    await assert.rejects(repository.saveDraft(copy(), first.draft.savedAt));
    const result = await repository.publish(second.draft.savedAt);
    assert.deepEqual(result.published.snapshot, working);
    const race = await Promise.allSettled([
      repository.saveDraft(copy(), second.draft.savedAt),
      new JsonFileContentRepository(directory).saveDraft(working, second.draft.savedAt),
    ]);
    assert.equal(race.filter(({ status }) => status === "fulfilled").length, 1);
    await writeFile(path.join(directory, "homepage.json"), "damaged");
    await assert.rejects(repository.read());
    await assert.rejects(repository.saveDraft(copy(), null));
    assert.equal(readFileSync(path.join(directory, "homepage.json"), "utf8"), "damaged");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("browser recovery and preview remain distinct from saved content", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const draft = { snapshot: copy(), savedAt: new Date().toISOString() };
  const working = copy(); working.theme.headingFont = "system-serif";
  browserStorage.writeRecovery(storage, working, draft.savedAt);
  assert.deepEqual(browserStorage.readRecovery(storage, draft).snapshot, working);
  assert.equal(browserStorage.readPreview(storage), null);
  browserStorage.writePreview(storage, working);
  assert.deepEqual(browserStorage.readPreview(storage), working);
  assert.equal(draft.snapshot.theme.headingFont, "geist");
  assert.equal(browserStorage.readRecovery(storage, { snapshot: working, savedAt: draft.savedAt }), null);
  assert.equal(browserStorage.readRecovery(storage, { ...draft, savedAt: "2100-01-01T00:00:00.000Z" }), null);
});

test("write access requires development and a same-origin request", () => {
  const { checkEditorRequest } = load("../lib/content/access.ts");
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(checkEditorRequest(new Request("http://localhost:3000/api/editor/home"), true).status, 404);
    process.env.NODE_ENV = "development";
    assert.equal(checkEditorRequest(new Request("http://localhost:3000/api/editor/home", { headers: { origin: "https://example.com" } }), true).status, 403);
    assert.equal(checkEditorRequest(new Request("http://localhost:3000/api/editor/home", { headers: { origin: "http://localhost:3000" } }), true), null);
    assert.equal(checkEditorRequest(new Request("http://localhost:3000/api/editor/home", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }), true), null);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});

test("editor controls, preview, recovery choice, and theme follow the workflow", async () => {
  // Simulated DOM; Puck's canvas is replaced to drive its onChange callback directly.
  // The real editor controller, Site Styles, Render, preview, and repository are used.
  const { Window } = await import("happy-dom");
  const window = new Window({ url: "http://localhost:3000/editor" });
  for (const key of ["document", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "ResizeObserver", "MutationObserver", "localStorage"]) globalThis[key] = window[key];
  globalThis.window = window;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const sheet = document.createElement("style");
  sheet.textContent = readFileSync("components/editor/blocks.module.css", "utf8");
  document.head.append(sheet);
  const React = load("react");
  const { createRoot } = load("react-dom/client");
  const core = load("@puckeditor/core");
  let puck;
  const corePath = load.resolve("@puckeditor/core");
  load.cache[corePath].exports = { ...core, Puck: (props) => {
    const [page, setPage] = React.useState(props.data);
    puck = { ...props, onChange: (next) => { setPage(next); props.onChange(next); } };
    return React.createElement(core.Render, { config: props.config, data: page });
  } };
  const { SiteEditor } = load("../components/editor/site-editor.tsx");
  const { WorkingPreview } = load("../components/editor/working-preview.tsx");
  const directory = await mkdtemp(path.join(os.tmpdir(), "myomaton-ui-test-"));
  const repository = new JsonFileContentRepository(directory);
  const originalFetch = globalThis.fetch;
  let pendingRequest;
  globalThis.fetch = (_, options) => pendingRequest = (async () => {
    const body = JSON.parse(options.body);
    const result = options.method === "PUT" ? await repository.saveDraft(body.snapshot, body.expectedSavedAt) : await repository.publish(body.expectedSavedAt);
    return Response.json(result);
  })();
  const host = document.createElement("div"); document.body.append(host);
  // This simulated DOM does not lay out clamp()/rem values. Verify that actual
  // stylesheet declarations bind both blocks to the changing page tokens.
  const boundSize = (selector) => {
    const declaration = [...sheet.sheet.cssRules].find((rule) => rule.selectorText === selector).style.fontSize;
    const match = declaration.match(/^var\((--site-[a-z-]+)\)$/);
    assert.ok(match, `${selector} must use a global size token`);
    return host.querySelector("main").style.getPropertyValue(match[1]);
  };
  let root = createRoot(host);
  const button = (label) => [...host.querySelectorAll("button")].find((node) => node.textContent === label);
  const mount = async () => {
    const initialContent = await repository.read();
    await React.act(async () => root.render(React.createElement(SiteEditor, { initialContent })));
  };
  try {
    await mount();
    assert.equal(button("Publish").disabled, true);
    await React.act(async () => { button("Save Draft").click(); await pendingRequest; });
    assert.match(host.textContent, /Saved Draft/);
    assert.equal(button("Publish").disabled, false);
    const saved = await repository.read();
    const beforeHeroSize = boundSize(".heroHeading");
    const beforeSectionSize = boundSize(".sectionHeading");
    const beforeBodySize = boundSize(".page");
    await React.act(async () => button("Site Styles").click());
    const changedTheme = {
      headingFont: "system-serif", bodyFont: "system-sans", baseTextSize: "large",
      headingScale: "editorial", accentColor: "#cc6633", backgroundColor: "#101820",
      textColor: "#f3efdf", contentWidth: "wide", sectionSpacing: "generous",
    };
    for (const [name, value] of Object.entries(changedTheme)) {
      const control = host.querySelector(`[name="${name}"]`);
      assert.ok(control, name);
      await React.act(async () => {
        if (control.tagName === "SELECT") control.value = value;
        else Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(control, value);
        control.dispatchEvent(new window.Event("input", { bubbles: true }));
        control.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
    }
    assert.match(host.textContent, /Unsaved changes/);
    assert.equal(button("Publish").disabled, true);
    const tokens = siteThemeVariables(changedTheme);
    for (const [key, value] of Object.entries(tokens)) assert.equal(host.querySelector("main").style.getPropertyValue(key), value, key);
    assert.notEqual(boundSize(".heroHeading"), beforeHeroSize);
    assert.notEqual(boundSize(".sectionHeading"), beforeSectionSize);
    assert.notEqual(boundSize(".page"), beforeBodySize);
    const appearance = (element) => {
      const style = getComputedStyle(element);
      return { font: style.fontFamily, size: style.fontSize, color: style.color };
    };
    const heroAppearance = appearance(host.querySelector("h1"));
    const sectionAppearance = appearance(host.querySelector("main h2"));
    const working = copy(); working.page.content[0].props.heading = "Unsaved preview heading";
    Object.assign(working.page.content[0].props, { alignment: "center", width: "wide", spacing: "compact" });
    Object.assign(working.page.content[1].props, { alignment: "center", width: "narrow", spacing: "generous" });
    await React.act(async () => puck.onChange(working.page));
    assert.deepEqual(appearance(host.querySelector("h1")), heroAppearance);
    assert.deepEqual(appearance(host.querySelector("main h2")), sectionAppearance);
    await React.act(async () => button("Publish").click());
    assert.equal((await repository.read()).published, null);
    await React.act(async () => host.querySelector('a[href="/preview/home"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })));
    const previewHost = document.createElement("div"); document.body.append(previewHost);
    const previewRoot = createRoot(previewHost);
    await React.act(async () => previewRoot.render(React.createElement(WorkingPreview)));
    assert.equal(previewHost.querySelector("h1").textContent, "Unsaved preview heading");
    assert.match(previewHost.querySelector("main").style.getPropertyValue("--site-heading-font"), /Georgia/);
    for (const [key, value] of Object.entries(tokens)) assert.equal(previewHost.querySelector("main").style.getPropertyValue(key), value, key);
    assert.ok(previewHost.querySelector('.hero[data-spacing="compact"][data-alignment="center"] [data-width="wide"]'));
    assert.ok(previewHost.querySelector('.contentSection[data-spacing="generous"][data-alignment="center"] [data-width="narrow"]'));
    assert.equal(previewHost.querySelector("button"), null);
    assert.deepEqual(await repository.read(), saved);
    await React.act(async () => previewRoot.unmount());
    await React.act(async () => window.dispatchEvent(new window.Event("pagehide")));
    assert.ok(localStorage.getItem(browserStorage.RECOVERY_KEY));
    await React.act(async () => root.unmount()); root = createRoot(host);
    await mount();
    assert.ok(button("Restore recovery copy"));
    assert.equal(host.querySelector("h1"), null);
    await React.act(async () => button("Restore recovery copy").click());
    assert.equal(host.querySelector("h1").textContent, "Unsaved preview heading");
    assert.equal(button("Publish").disabled, true);
    assert.deepEqual(await repository.read(), saved);
    await React.act(async () => { button("Save Draft").click(); await pendingRequest; });
    assert.equal(localStorage.getItem(browserStorage.RECOVERY_KEY), null);
    await React.act(async () => { button("Publish").click(); await pendingRequest; });
    assert.deepEqual((await repository.read()).published.snapshot.theme, changedTheme);
    await React.act(async () => root.unmount()); root = createRoot(host);
    await mount();
    assert.equal(host.querySelector("h1").textContent, "Unsaved preview heading");
    assert.equal(button("Save Draft").disabled, true);
    for (const [key, value] of Object.entries(tokens)) assert.equal(host.querySelector("main").style.getPropertyValue(key), value, key);
    const next = copy(); next.page.content[0].props.heading = "Discard this recovery";
    browserStorage.writeRecovery(localStorage, next, (await repository.read()).draft.savedAt);
    await React.act(async () => root.unmount()); root = createRoot(host); await mount();
    await React.act(async () => button("Discard recovery copy").click());
    assert.equal(host.querySelector("h1").textContent, "Unsaved preview heading");
    assert.equal(localStorage.getItem(browserStorage.RECOVERY_KEY), null);
  } finally {
    await React.act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    load.cache[corePath].exports = core;
    await window.happyDOM.close();
    await rm(directory, { recursive: true, force: true });
  }
});
