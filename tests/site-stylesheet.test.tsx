import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { designRules } from "../lib/platform/design-systems/design-rules";
import { readSiteStylesheet } from "../lib/platform/design-systems/site-stylesheet";

const scope = "body.miopages-designed:not(#mp-core-design)";

test("Core's stylesheet designs the whole page and is scoped to the site's own pages", () => {
  const css = readSiteStylesheet(`
    /* the opening */
    body { background: linear-gradient(160deg, var(--wp--preset--color--surface), #f4efe6); }
    header.wp-block-template-part { position: sticky; top: 0; backdrop-filter: blur(8px); }
    nav.miopages-draft-nav a[aria-current="page"], nav.miopages-draft-nav a:hover { color: var(--wp--preset--color--brand); text-decoration: underline 2px; }
    .miopages-draft-hero h1 { font-family: var(--miopages-heading-font), 'MP Fraunces', serif; font-size: clamp(2.6rem, 6vw, 5.4rem); letter-spacing: -.04em; }
    .miopages-node-columns > .miopages-node:nth-child(2n) { transform: translateY(1.5rem); }
    figure.miopages-fpo { border: 2px dashed var(--miopages-border); background: var(--wp--preset--color--support); }
    .miopages-draft-intro::before { content: "→"; color: var(--miopages-muted); }
    @media (max-width: 680px) { nav.miopages-draft-nav { display: flex; overflow-x: auto; gap: 1rem; } }
    @keyframes mp-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
    @media (prefers-reduced-motion: no-preference) { .miopages-draft-section { animation: mp-rise .6s ease-out both; } }
  `);
  assert.ok(css.startsWith(scope + "{background:"), "body itself becomes the site's scope");
  assert.ok(css.includes(scope + " header.wp-block-template-part{position:sticky"));
  assert.ok(css.includes("@media (max-width: 680px){" + scope + " nav.miopages-draft-nav{display:flex"));
  assert.ok(css.includes("@keyframes mp-rise{from{opacity:0"));
  assert.ok(!css.includes("/*"), "the sheet is rebuilt from what passed");
  assert.equal(readSiteStylesheet(css), css, "checking a rebuilt sheet again (at delivery) leaves it unchanged");
});

test("ordinary contemporary CSS is Core's to use: menus that hide, pinned headers, queries, new properties", () => {
  const css = readSiteStylesheet(`
    header.miopages-menu-compact nav.miopages-draft-nav { display: none; }
    header.miopages-menu-open nav.miopages-draft-nav { display: grid; position: fixed; inset: 4rem 0 auto; }
    details:not([open]) > .panel { visibility: hidden; }
    .miopages-draft-section { container-type: inline-size; grid-template-areas: "copy media"; text-wrap: pretty; }
    @supports (display: grid) { @container (min-width: 40rem) { .miopages-node-columns { grid-template-columns: 2fr 1fr; } } }
    .alignfull > section, section.custom-band { margin-inline: calc(50% - 50vw); }
    html body p { hanging-punctuation: first; }
  `);
  assert.ok(css.includes(scope + " header.miopages-menu-compact nav.miopages-draft-nav{display:none}"));
  assert.ok(css.includes("@supports (display: grid){@container (min-width: 40rem){"));
  assert.ok(css.includes(scope + " p{hanging-punctuation:first}"));
  assert.equal(readSiteStylesheet(css), css);
});

test("only the design rules refuse: loading anything, words added by styling, hidden gap marks, unlicensed fonts, admin", () => {
  const refused = [
    "body { background: url(https://example.com/x.png); }",          // rule 1
    "@import 'https://example.com/a.css';",                           // rule 1
    "h1 { color: red; } </style><script>alert(1)</script>",           // rule 1
    "#wpadminbar { color: red; }",                                    // rule 1
    ".miopages-draft-hero::after { content: 'Guaranteed results'; }", // rule 2
    "figure.miopages-fpo { height: 0; }",                             // rule 7
    "figure.miopages-fpo { display: none; }",                         // rule 7
    "aside.miopages-placeholder { transform: scale(0); }",            // rule 7
    ".miopages-placeholder-label { opacity: .1; }",                   // rule 7
    "h1 { font-family: 'Comic Sans MS'; }",                           // rule 8
  ];
  for (const css of refused) assert.throws(() => readSiteStylesheet(css), /Site stylesheet refused/u, css);
});

test("the design rules people review and the rules in code are the same list", () => {
  const doc = readFileSync("docs/design-rules.md", "utf8");
  for (const r of designRules)
    assert.ok(doc.includes(`${r.number}. **${r.name}.** ${r.rule} *Why: ${r.reason}*`), `rule ${r.number} differs from docs/design-rules.md`);
  assert.equal((doc.match(/^\d+\. \*\*/gmu) ?? []).length, designRules.length, "the document lists exactly the rules in code");
});
