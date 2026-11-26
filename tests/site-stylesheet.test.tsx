import assert from "node:assert/strict";
import test from "node:test";
import { readSiteStylesheet } from "../lib/platform/design-systems/site-stylesheet";

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
  const scope = "body.miopages-designed:not(#mp-core-design)";
  assert.ok(css.startsWith(scope + "{background:"), "body itself becomes the site's scope");
  assert.ok(css.includes(scope + " header.wp-block-template-part{position:sticky"));
  assert.ok(css.includes("@media (max-width: 680px){" + scope + " nav.miopages-draft-nav{display:flex"));
  assert.ok(css.includes("@keyframes mp-rise{from{opacity:0"));
  assert.ok(!css.includes("/*"), "the sheet is rebuilt from what passed");
  assert.equal(readSiteStylesheet(css), css, "checking a rebuilt sheet again (at delivery) leaves it unchanged");
});

test("anything that loads, runs, hides content or hides the FPO and placeholder marks is refused", () => {
  const refused = [
    "body { background: url(https://example.com/x.png); }",
    "@import 'https://example.com/a.css';",
    ".miopages-draft-hero { display: none; }",
    ".miopages-draft-section { visibility: hidden; }",
    "figure.miopages-fpo { height: 0; }",
    "aside.miopages-placeholder { transform: scale(0); }",
    ".miopages-placeholder-label { opacity: .1; }",
    "header.wp-block-template-part { position: fixed; }",
    ".miopages-draft-hero::after { content: 'Guaranteed results'; }",
    "#wpadminbar { color: red; }",
    ".x { color: red; }",
    "h1 { font-family: 'Comic Sans MS'; }",
    "h1 { color: red; } </style><script>alert(1)</script>",
    "@supports (display: grid) { h1 { color: red; } }",
  ];
  for (const css of refused) assert.throws(() => readSiteStylesheet(css), /Site stylesheet refused/u, css);
});
