import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readSiteFooter } from "../lib/platform/service/site-footer";

const paths = ["/", "/service", "/privacy"];

test("Core's footer is part of the Site plan: plain words, links only to the plan's own pages", () => {
  const footer = readSiteFooter({ columns: [
    { heading: "MioPages", text: "Managed web presence\nhello@example.test", links: [] },
    { heading: null, text: null, links: ["/service", "/privacy"] },
  ], note: "  " }, paths);
  assert.deepEqual(footer.columns[1], { heading: null, text: null, links: ["/service", "/privacy"] });
  assert.equal(footer.note, null, "an empty line becomes no line");
  assert.throws(() => readSiteFooter({ columns: [{ heading: null, text: null, links: ["https://elsewhere.test"] }], note: null }, paths), /pages in the plan/u);
  assert.throws(() => readSiteFooter({ columns: [{ heading: "<script>", text: null, links: [] }], note: null }, paths));
  assert.throws(() => readSiteFooter({ columns: [{ heading: null, text: null, links: [] }], note: null }, paths), /Empty/u);
  assert.throws(() => readSiteFooter({ columns: [], note: null, script: "x" }, paths), /refused/u);
});

test("WordPress shows the footer, marked so the theme can place it in the site footer", () => {
  const candidate = { pages: [
    { path: "/", title: "Home", composition: "managed-v1", navigationLabel: "Home", sections: [
      { id: "hero", type: "hero", content: { heading: "Welcome", text: "Opening." } }] },
    { path: "/service", title: "Service", composition: "managed-v1", navigationLabel: "Our service", sections: [
      { id: "service-hero", type: "hero", content: { heading: "Service", text: "What we do." } }] },
  ], navigation: ["/", "/service"], actions: [],
  footer: { columns: [{ heading: "Reach us", text: "hello@example.test", links: ["/service"] }], note: "© MioPages" } };
  const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/native-component.php"],
    { input: JSON.stringify({ candidate, postIds: { "/": 99, "/service": 100 } }), encoding: "utf8" });
  assert.equal(php.status, 0, php.stderr);
  assert.match(php.stdout, /<!-- miopages-site-footer --><div class="miopages-site-footer">.*<p class="miopages-footer-heading">Reach us<\/p>.*page_id=100.*>Our service<\/a>.*<p class="miopages-footer-note">© MioPages<\/p><\/div><!-- \/miopages-site-footer -->/u);
  const foreign = { ...candidate, footer: { columns: [{ heading: null, text: null, links: ["/elsewhere"] }], note: null } };
  assert.equal(spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/native-component.php"],
    { input: JSON.stringify({ candidate: foreign, postIds: { "/": 99, "/service": 100 } }), encoding: "utf8" }).status, 1);
});
