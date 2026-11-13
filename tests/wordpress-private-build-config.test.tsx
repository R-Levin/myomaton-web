import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("private routing flags are absent in normal Core and explicit only in the private build", () => {
  const config = (mode: string) => JSON.parse(execFileSync(process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", "import c from './next.config.ts'; console.log(JSON.stringify(c.default ?? c))"],
    { cwd: process.cwd(), env: { ...process.env, MIOPAGES_PROTECTED_CORE: "", MIOPAGES_WP_PRIVATE_STAGE: mode }, encoding: "utf8" }));
  const normal = config("");
  assert.equal(normal.skipTrailingSlashRedirect, undefined);
  assert.equal(normal.skipProxyUrlNormalize, undefined);
  assert.deepEqual(normal.serverExternalPackages, ["react-dom"]);
  const isolated = config("enabled");
  assert.equal(isolated.skipTrailingSlashRedirect, true);
  assert.equal(isolated.skipProxyUrlNormalize, true);
  delete isolated.skipTrailingSlashRedirect; delete isolated.skipProxyUrlNormalize;
  assert.deepEqual(isolated, normal);
});
