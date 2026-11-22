import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { coreDesignProjection, draftBrand, readSignedDraftBrand } from "../lib/platform/wordpress-delivery/draft-brand";

// Fictional fixture design in the shape Core's AI produces (design projection v4).
const design = {
  grammar: "core-designed", version: 4, motion: "minimal",
  palette: {
    light: { background: "#fbf8f2", text: "#1f1b16" }, strong: { background: "#16324f", text: "#ffffff" },
    tonal: { background: "#efe7d8", text: "#2a241c" }, brand: { background: "#7a3b12", text: "#ffffff" },
    supporting: { background: "#e3ecf4", text: "#14273a" }, contrast: { background: "#111111", text: "#f5f5f5" },
    border: "#d9cfbf", muted: "#5f574c",
  },
  typography: { headingFamily: "fraunces", bodyFamily: "inter", baseSize: 17, headingScale: 2.6, lineHeight: 1.6, headingWeight: 600 },
  shape: "soft", density: "balanced",
};
const scope = { webPresenceId: "15f39243-ff57-4609-bc3b-9dd90622ef17", managedSiteId: "099f9bfa-1cb2-41bb-a360-81ade5dbd630" };
// Smallest valid PNG (1x1), standing in for the reviewed wordmark.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const logo = { assetId: "7b0f8a52-3d43-4d38-9b1f-0d6f7f0c2a11", usageId: "c2d9a7e4-8b8f-4b55-8a3c-5f1e2d3c4b5a",
  sha256: createHash("sha256").update(png).digest("hex"), alt: "Fixture wordmark" };

test("the design Core's AI chose travels in the signed brand and the WordPress plugin accepts it unchanged", () => {
  const brand = draftBrand({ scope, logo, coreDesign: design });
  assert.deepEqual(brand.projection.design, design);
  const signed = { ...brand, pngBase64: png.toString("base64") };
  assert.equal(readSignedDraftBrand(signed, scope).digest, brand.digest);
  const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["-r", `
    define('ABSPATH', __DIR__ . '/');
    require 'wordpress/miopages-delivery/includes/class-miopages-native-draft-brand.php';
    $input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
    echo strlen(MioPages_Native_Draft_Brand::bytes($input['brand'], $input['scope']));`],
  { input: JSON.stringify({ brand: signed, scope }), encoding: "utf8" });
  assert.equal(php.status, 0, php.stderr + php.stdout);
  assert.equal(Number(php.stdout), png.length);
});

test("an altered or unreadable chosen design is refused before signing", () => {
  assert.throws(() => coreDesignProjection({ ...design, shape: "blob" }));
  assert.throws(() => coreDesignProjection({ ...design, typography: { ...design.typography, bodyFamily: "comic-sans" } }));
  assert.throws(() => coreDesignProjection({ ...design, extra: true }));
  // A brand colour that cannot serve as a readable link colour on the light surface.
  assert.throws(() => coreDesignProjection({ ...design, palette: { ...design.palette, brand: { background: "#f0f0f0", text: "#000000" } } }), /contrast/);
  const brand = draftBrand({ scope, logo, coreDesign: design });
  const tampered = { ...brand, projection: { ...brand.projection, design: { ...design, density: "airy" } }, pngBase64: png.toString("base64") };
  assert.throws(() => readSignedDraftBrand(tampered, scope), /refused/);
});
