import assert from "node:assert/strict";
import test from "node:test";
import { designProjection, readSiteDesign } from "../lib/platform/design-systems/site-design";
import { contrast } from "../lib/platform/presentation/tokens";
import { readDirection } from "../lib/platform/intake/presence-workflow-artifacts";

const pair = (background: string, text: string) => ({ background, text });
export function exampleDesign() {
  return {
    palette: { light: pair("#fbf7f0", "#1d1a16"), strong: pair("#e8dccb", "#1d1a16"), tonal: pair("#f1ebe2", "#1d1a16"),
      brand: pair("#1f5f4a", "#ffffff"), supporting: pair("#dbe8e1", "#123528"), contrast: pair("#14201b", "#f5efe4"),
      border: "#d8cdbd", muted: "#5a5247" },
    typography: { headingFamily: "fraunces", bodyFamily: "work-sans", baseSize: 17, headingScale: 3, lineHeight: 1.6, headingWeight: 600 },
    shape: "soft", density: "airy",
    imagery: { style: "photography", direction: "Warm, natural-light photographs of real working situations." },
    rationale: "Example design for tests.", sourceIds: ["peer-1"],
  };
}

test("Core keeps the AI's design choices and repairs only unreadable colours, recording each repair", () => {
  const ok = readSiteDesign(exampleDesign(), ["peer-1"]);
  assert.deepEqual(ok.adjustments, []);
  assert.equal(ok.typography.headingFamily, "fraunces");
  const weak = exampleDesign();
  weak.palette.tonal = pair("#f1ebe2", "#c9c2b8");
  weak.palette.brand = pair("#9fd3bf", "#ffffff");
  const repaired = readSiteDesign(weak, ["peer-1"]);
  assert.ok(contrast(repaired.palette.tonal.text, repaired.palette.tonal.background) >= 4.5);
  assert.ok(contrast(repaired.palette.brand.background, repaired.palette.light.background) >= 4.5);
  assert.ok(contrast(repaired.palette.brand.text, repaired.palette.brand.background) >= 4.5);
  assert.equal(repaired.palette.tonal.background, "#f1ebe2", "backgrounds the AI chose are kept");
  assert.equal(repaired.palette.brand.text, "#ffffff", "text on an adjusted brand colour starts again from the AI's choice");
  assert.equal(repaired.adjustments.length >= 2, true);
});

test("unknown fonts, unknown sources and markup are refused; the projection is data only", () => {
  assert.throws(() => readSiteDesign({ ...exampleDesign(), typography: { ...exampleDesign().typography, bodyFamily: "comic-sans" } }, ["peer-1"]));
  assert.throws(() => readSiteDesign(exampleDesign(), []), /unknown source/);
  assert.throws(() => readSiteDesign({ ...exampleDesign(), rationale: "<script>x</script>" }, ["peer-1"]));
  assert.throws(() => readSiteDesign({ ...exampleDesign(), extra: true }, ["peer-1"]));
  const projection = designProjection(readSiteDesign(exampleDesign(), ["peer-1"]));
  assert.deepEqual(Object.keys(projection).sort(), ["density", "grammar", "motion", "palette", "shape", "typography", "version"]);
  assert.equal(projection.version, 4);
});

test("a Direction may carry the site design; older Directions without one still read", () => {
  const base = { positioning: "P.", approach: "A.", visitorDecisions: ["Decide."], sourceIds: ["peer-1"] };
  assert.equal(readDirection(base, ["peer-1"]).design, undefined);
  assert.equal(readDirection({ ...base, design: exampleDesign() }, ["peer-1"]).design?.density, "airy");
  assert.throws(() => readDirection({ ...base, design: { ...exampleDesign(), shape: "blob" } }, ["peer-1"]), /Site design refused/);
});

test("design rule 4 in the stylesheet: a background and text set together must read together", () => {
  const withSheet = (stylesheet: string) => ({ ...exampleDesign(), stylesheet });
  // The contrast pair is dark: its own text reads; another pair's dark text on it does not.
  assert.ok(readSiteDesign(withSheet(".miopages-node-surface-tonal { background: var(--miopages-contrast-surface); color: var(--miopages-contrast-ink); }"), ["peer-1"]).stylesheet);
  assert.throws(() => readSiteDesign(withSheet(".miopages-node-surface-tonal { background: var(--miopages-contrast-surface); color: rgb(36, 31, 75); }"), ["peer-1"]),
    /unreadable \(design rule 4\).*surface-tonal.*#241f4b on background #14201b/u);
  // What cannot be known from the sheet alone (gradients, transparency, inherited text) is left to the rendered-page check.
  assert.ok(readSiteDesign(withSheet(".a { background: linear-gradient(#000, #111); color: #000; } .b { background: rgba(0,0,0,.5); color: #000; } .c { background: #000; }"), ["peer-1"]).stylesheet);
});
