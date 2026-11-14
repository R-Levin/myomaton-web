import assert from "node:assert/strict";
import { readFile, lstat, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../lib/platform/canonical/model";
import { prepareSitePlanning, type PreparedPlanning } from "../lib/platform/intake/site-planning";
import { protectedSitePlanningProvider, type ResponsesRates } from "../lib/platform/intake/intelligent-responses";
import { responsesHttps } from "../lib/platform/intake/responses-https";
import type { InterviewEvidence } from "../lib/platform/intake/intelligent-model";

const manifestDigest = "3437eb2491bd7d44dea7cb707319771158b6d61db1f3ac56b4019e908e4e66d6";
const fictionalDigest = "20a4f3c074a53b53cb641fa14d49443e868711d64e6c1cc8c28a80ab4ac32ddf";
const ownerDigest = fingerprint({ fictionalCase: "c2", operation: "site-planning" });
type Manifest = { c2: { sources: Array<Pick<InterviewEvidence, "id" | "kind" | "statement">>; answerProjection: null } };
type Scope = { manifestDigest: string; inputDigest: string; expiresAt: number; revoked?: boolean };
const home = "/home/virtual/vps-bef564/e/e494602172";
const privateRoot = join(home, "miopages-private-acceptance");
const proofRoot = join(privateRoot, "site-planning-proof");

async function safeFile<T>(path: string): Promise<T> {
  const st = await lstat(path);
  assert.ok(st.isFile() && (st.mode & 0o777) === 0o600 && st.uid === process.getuid?.() && await realpath(path) === path);
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/u, "")) as T;
}

async function main() {
  assert.equal(process.platform, "linux");
  assert.equal(await realpath(process.env.HOME ?? ""), home);
  assert.deepEqual(process.argv.slice(2), ["RUN-FICTIONAL-SITE-PLAN", manifestDigest]);
  for (const path of [privateRoot, proofRoot, join(privateRoot, "core-usage")]) {
    const st = await lstat(path);
    assert.ok(st.isDirectory() && (st.mode & 0o777) === 0o700 && st.uid === process.getuid?.() && await realpath(path) === path);
  }
  const grantFile = join(proofRoot, "c2-grant.json");
  const grant = await safeFile<Scope>(grantFile);
  assert.equal(grant.manifestDigest, manifestDigest);
  assert.equal(grant.inputDigest, fictionalDigest);
  assert.ok(Number.isSafeInteger(grant.expiresAt) && grant.expiresAt <= Date.now() + 86_400_000 && grant.expiresAt > Date.now() && grant.revoked !== true);
  const cfg = await safeFile<{ apiKey: string; aiEnabled: boolean }>(join(privateRoot, "core-config.json"));
  const transportSettings = await safeFile<{ capMicros: number; maxRequests: number; rates: ResponsesRates }>(join(privateRoot, "ai-scope.json"));
  assert.equal(cfg.aiEnabled, true);
  assert.equal(transportSettings.rates.model, "gpt-5.4-mini-2026-03-17");
  assert.equal(transportSettings.rates.inputPerMillion, 750_000);
  assert.equal(transportSettings.rates.cachedPerMillion, 75_000);
  assert.equal(transportSettings.rates.outputPerMillion, 4_500_000);
  assert.equal(transportSettings.rates.countMicros, 0);
  const generate = protectedSitePlanningProvider(join(privateRoot, "core-usage"), transportSettings.rates,
    responsesHttps(cfg.apiKey, grant.expiresAt), { ownerDigest, inputDigest: fictionalDigest, expiresAt: grant.expiresAt,
      maxRequests: Math.min(14, transportSettings.maxRequests), capMicros: Math.min(22_429, transportSettings.capMicros) });
  const project = async (): Promise<PreparedPlanning> => {
    const current = await safeFile<Scope>(grantFile);
    assert.equal(fingerprint(current), fingerprint(grant));
    const manifest = await safeFile<Manifest>(join(proofRoot, "site-planning-live-proof-inputs.json"));
    assert.equal(fingerprint(manifest), manifestDigest);
    assert.equal(manifest.c2.answerProjection, null);
    const evidence = manifest.c2.sources.map(source => ({ ...source, reference: "Fictional C2 exact proof scope", at: "2026-11-13" }));
    return prepareSitePlanning(ownerDigest, evidence, [], { ownerDigest, expiresAt: grant.expiresAt,
      evidenceDigest: fingerprint(evidence), approvedAnswerDigests: [] });
  };
  const result = await generate(project);
  await writeFile(join(proofRoot, "c2-generated.json"), JSON.stringify({ scenario: "fictional-c2", model: transportSettings.rates.model,
    proposal: result }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: "PASS", scenario: "fictional-c2", generatedDigest: result.digest }));
}

main().catch(error => {
  const message = error instanceof Error ? error.message : "";
  console.error(JSON.stringify({ status: "BLOCKED", category: /^Responses HTTP status [1-5][0-9]{2}$/u.test(message) ? message : "site-planning-preflight-or-result" }));
  process.exitCode = 1;
});
