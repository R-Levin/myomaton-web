import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareOriginalCustody } from "../lib/platform/intake/presence-original-custody";
import type { OriginalMaterialGrant } from "../lib/platform/intake/presence-source-material";

test("complete original preparation verifies every byte before writing, is resumable, and refuses conflicting custody", async () => {
  const root = await mkdtemp(join(tmpdir(), "miopages-original-preparation-"));
  const bytes = Buffer.from("First original line.\n" + "Original source material. ".repeat(700) + "\nFinal original line.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const grant: OriginalMaterialGrant = { version: 1, contextDigest: "fixture-context", requestBytes: 100_000,
    records: [{ id: "business-original", sha256: hash, bytes: bytes.length, reference: "Offline customer original",
      author: "Fixture owner", date: "2026-11-18", mime: "text/plain", status: "unconfirmed", purpose: "business-context",
      operations: ["report", "page", "editorial"] }] };
  try {
    await assert.rejects(prepareOriginalCustody(root, grant, "fixture-context", async () => Buffer.from("changed")), /differs/);
    await assert.rejects(readFile(join(root, "index.json")));
    const result = await prepareOriginalCustody(root, grant, "fixture-context", async () => bytes);
    assert.equal(result.bytes, bytes.length);
    assert.deepEqual(await readFile(join(root, hash + ".source")), bytes);
    assert.deepEqual(await prepareOriginalCustody(root, grant, "fixture-context", async () => bytes), result);
    await writeFile(join(root, hash + ".source"), Buffer.from("replaced"));
    await assert.rejects(prepareOriginalCustody(root, grant, "fixture-context", async () => bytes), /conflict/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
