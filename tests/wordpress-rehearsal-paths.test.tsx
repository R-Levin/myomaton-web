import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { configurationCheck, rehearsalConfigurationDiagnostic, rehearsalHome, rehearsalManifestPath, rehearsalPrivateRoot } from "../scripts/db/wordpress-rehearsal-paths";

const home = "/home/virtual/vps-bef564/5/53b4381d42";
const original = home + "/miopages-wp-principals-20261106T144226Z/manifest.json";
const next = home + "/miopages-wp-principals-20261106T174621Z/manifest.json";
const root = path.posix.dirname(next);

test("provider trailing HOME slash and doubled tilde-expanded separators normalize to the same pinned manifest", () => {
  const suppliedHome = home + "/", suppliedOriginal = suppliedHome + "/miopages-wp-principals-20261106T144226Z/manifest.json";
  assert.notEqual(suppliedOriginal, path.posix.join(suppliedHome, "miopages-wp-principals-20261106T144226Z/manifest.json"), "Reproduce original assertion failure");
  assert.equal(rehearsalHome(suppliedHome, path.posix), home);
  assert.equal(rehearsalManifestPath(suppliedHome, suppliedOriginal, true, path.posix), original);
  assert.equal(rehearsalManifestPath(home + "///", home + "//miopages-wp-principals-20261106T174621Z//manifest.json", false, path.posix), next);
  assert.equal(rehearsalPrivateRoot(suppliedHome, root + "///", path.posix), root);
});

test("canonical inputs remain exact and normalization is native-platform consistent", () => {
  assert.equal(rehearsalManifestPath(home, original, true, path.posix), original);
  assert.equal(rehearsalManifestPath(home, next, false, path.posix), next);
  assert.equal(rehearsalPrivateRoot(home, root, path.posix), root);
  const native = path.resolve("runtime-content");
  const nativeFile = path.join(native, "miopages-wp-principals-20261106T174621Z", "manifest.json");
  assert.equal(rehearsalManifestPath(native + path.sep, nativeFile), nativeFile);
  assert.equal(rehearsalPrivateRoot(native + path.sep, path.dirname(nativeFile) + path.sep), path.dirname(nativeFile));
});

test("normalization does not permit relative inputs, foreign manifests, public roots or escaped/nested locations", () => {
  for (const input of [undefined, "", "relative/home"])
    assert.throws(() => rehearsalHome(input, path.posix));
  for (const input of ["manifest.json", "/other/miopages-wp-principals-20261106T174621Z/manifest.json",
    home + "/public_html/manifest.json", home + "/miopages-wp-principals-20261106T174621Z/nested/manifest.json",
    home + "/miopages-wp-principals-20261106T174621Z/../../manifest.json"])
    assert.throws(() => rehearsalManifestPath(home + "/", input, false, path.posix));
  for (const input of [next, original.replace("manifest.json", "different.json")])
    assert.throws(() => rehearsalManifestPath(home, input, true, path.posix));
  for (const input of ["relative", home + "/public_html", root + "/nested", "/other/miopages-wp-principals-20261106T174621Z"])
    assert.throws(() => rehearsalPrivateRoot(home + "/", input, path.posix));
});

test("configuration diagnostics name the check and never mislabel assertions as migration failures or expose values", () => {
  let error: unknown;
  try { rehearsalManifestPath(home, next, true, path.posix); } catch (e) { error = e; }
  assert.deepEqual(rehearsalConfigurationDiagnostic(error), { stage: "configuration", code: "WP_REHEARSAL_CONFIGURATION_INVALID",
    assertion: "original_manifest_location", detail: "The named protected rehearsal configuration check failed; no database operation was started." });
  const secret = "postgresql://secret-user:secret-password@secret-host/database?token=private-token";
  for (const e of [Object.assign(Error(secret), { code: "ERR_ASSERTION", actual: secret, expected: secret, assertion: secret }),
    Object.assign(Error(secret), { code: "ENOENT", path: secret }), secret]) {
    const diagnostic = rehearsalConfigurationDiagnostic(e, "manifest_checksum");
    assert.equal(diagnostic.assertion, "manifest_checksum");
    assert.ok(!JSON.stringify(diagnostic).includes(secret));
    assert.ok(!diagnostic.detail.includes("migration ledger"));
  }
  assert.throws(() => configurationCheck(false, "manifest_file_protection"), { code: "WP_REHEARSAL_CONFIGURATION_INVALID" });
});
