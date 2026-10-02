import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  defaultDesignConfiguration,
  resolveDesignConfiguration,
} from "../lib/platform/design-systems/configuration";
import { myomatonDesignConfiguration } from "../scripts/customer-bootstrap/myomaton-design-system";
import { ManagedSitePageView } from "../components/managed-sites/managed-site-page";
import { SectionRenderer } from "../components/managed-sites/section-renderer";
import type { ManagedSitePage } from "../lib/platform/managed-sites/service";

test("seed configuration resolves unchanged and reaches server-rendered tokens", () => {
  const configuration = resolveDesignConfiguration(myomatonDesignConfiguration);
  assert.deepEqual(configuration, myomatonDesignConfiguration);
  const page: ManagedSitePage = {
    managedSite: { id: "managedSite", name: "Example tenant" },
    page: { id: "page", name: "Home", title: "Home", slug: "/" },
    designSystem: { id: "design", name: "Example design", configuration },
    sections: [
      { id: "hero", type: "hero", variant: "default", name: "Hero", content: { heading: "Hero title" }, configuration: {} },
      { id: "intro", type: "intro", variant: "default", name: "Intro", content: { heading: "Introduction" }, configuration: { anchor: "about" } },
      { id: "cta", type: "cta", variant: "default", name: "CTA", content: { heading: "Follow", actionId: "11111111-1111-4111-8111-111111111111" }, configuration: {}, action: { id: "11111111-1111-4111-8111-111111111111", name: "Learn more", type: "section", label: "Learn more", destination: "#about" } },
      { id: "unknown", type: "future", variant: null, name: null, content: { heading: "Not supported" }, configuration: {} },
    ],
  };
  const html = renderToStaticMarkup(<ManagedSitePageView page={page} />);
  for (const token of ["--design-accent:#214e43", "--design-base-size:18px", "--design-section-space:72px", "--design-radius:12px"]) {
    assert.ok(html.includes(token), token);
  }
  assert.ok(html.includes("<h1>Hero title</h1>"));
  assert.ok(html.indexOf("Hero title") < html.indexOf("Introduction"));
  assert.ok(html.indexOf("Introduction") < html.indexOf("Follow"));
  assert.ok(html.includes('id="about"'));
  assert.ok(html.includes('href="#about"'));
  assert.ok(!html.includes("Not supported"));

  const fallback = renderToStaticMarkup(<ManagedSitePageView page={{
    ...page,
    designSystem: { id: null, name: null, configuration: resolveDesignConfiguration(undefined) },
  }} />);
  assert.ok(fallback.includes("--design-background:#ffffff"));
  assert.ok(fallback.includes("Hero title"));
});

test("missing and malformed JSON use platform defaults", () => {
  for (const input of [undefined, null, false, 42, "css", [], {}, { typography: [], colors: null, spacing: "large", shape: false }]) {
    assert.deepEqual(resolveDesignConfiguration(input), defaultDesignConfiguration);
  }
});

test("valid fields survive alongside invalid fields; arbitrary CSS is discarded", () => {
  const resolved = resolveDesignConfiguration({
    typography: { bodyFont: "serif", headingFont: "url(https://example.com/font)", baseSize: 999, headingScale: NaN, lineHeight: Infinity },
    colors: { accent: "#123456", background: "red; background: url(https://example.com)", text: "var(--anything)" },
    spacing: { unit: -1, section: "72px" },
    shape: { radius: 0 },
    css: "body { display: none }",
  });
  assert.deepEqual(resolved, {
    ...defaultDesignConfiguration,
    typography: { ...defaultDesignConfiguration.typography, bodyFont: "serif" },
    colors: { ...defaultDesignConfiguration.colors, accent: "#123456" },
    shape: { radius: 0 },
  });
});

test("resolving one tenant never mutates another tenant's defaults", () => {
  const first = resolveDesignConfiguration(null);
  first.colors.accent = "#ff0000";
  assert.deepEqual(resolveDesignConfiguration(null), defaultDesignConfiguration);
  assert.notEqual(defaultDesignConfiguration.colors.accent, first.colors.accent);
});

test("section content remains escaped and unsafe links and unknown types are omitted", () => {
  const section = { id: "section", type: "cta", variant: null, name: null, configuration: {}, content: { heading: "<script>", actionLabel: "Click", actionHref: "javascript:alert(1)" } };
  const html = renderToStaticMarkup(<SectionRenderer section={section} />);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("href="));
  assert.equal(renderToStaticMarkup(<SectionRenderer section={{ ...section, type: "unknown" }} />), "");
  assert.doesNotThrow(() => renderToStaticMarkup(<SectionRenderer section={{ ...section, content: null }} />));
});
