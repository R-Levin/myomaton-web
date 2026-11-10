import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fingerprint } from "../../lib/platform/canonical/model";
import { IntelligentOnboarding } from "../../lib/platform/intake/intelligent";
import type { InterviewEvidence, InterviewGap, InterviewTurn, QuestionContext, QuestionProvider } from "../../lib/platform/intake/intelligent-model";
import { controlledProofResponsesProvider, initializeOfflineUsageLedger, type Rates, type ResponsesTransport } from "../../lib/platform/intake/intelligent-responses";
import { IntakeService } from "../../lib/platform/intake/service";
import { openIntelligentFixture } from "./intelligent-proof-fixture";

const manifestFile = "docs/shared-intelligent-onboarding-live-proof-allowlist-2026-11-10.json";
export const manifestSha = "11d47ae88f1df63d4d6e70fbf1f694197bffa782c81b35c6e8e98eb90208457d";
export const proofModel = "gpt-5.4-mini-2026-03-17";
const authorization = "6775948557";
const proofRoot = resolve("runtime-content/openai-onboarding-proof");
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
type Trace = {
  id: string; context: "c0" | "c2"; entryPath: QuestionContext["entryPath"]; gap: string;
  firstQuestion: "generate" | "replay-validated-c0-buyer-a";
  answer: { disposition: "provided"; text: string };
};
type Manifest = { contexts: Record<Trace["context"], { sources: InterviewEvidence[]; gaps: InterviewGap[] }>; traces: Trace[] };
type Attestation = {
  authorization: string; commit: string; manifestSha: string; project: string; organization: string;
  credentialSha256: string; validUntil: string; rateCard: string; countMicros: number; countPriceEvidence: string;
  projectAccessEvidence: string; dataControlsEvidence: string; verified: {
    pinnedModelEnabled: true; restrictedEndpoints: true; billingAndPhaseBudget: true; trainingOptInDisabled: true;
    retentionAndCachingReviewed: true; projectCredentialProtected: true;
  };
};
const rateCard = "openai-gpt54mini-standard-usd/2026-11-10.1";
const fixedRates = (countMicros: number): Rates => ({
  model: proofModel, verifiedOn: "2026-11-10", inputPerMillion: 750_000, cachedPerMillion: 75_000,
  cacheWritePerMillion: 0, outputPerMillion: 4_500_000, countMicros,
});

export async function readManifest(): Promise<Manifest> {
  const bytes = await readFile(manifestFile);
  if (sha(bytes) !== manifestSha) throw Error("Approved manifest digest mismatch");
  return JSON.parse(bytes.toString("utf8"));
}

export function checkAttestation(receipt: Attestation, commit: string, key: string, now = Date.now()) {
  const expires = Date.parse(receipt.validUntil);
  const evidence = [receipt.countPriceEvidence, receipt.projectAccessEvidence, receipt.dataControlsEvidence];
  if (!/^[a-f0-9]{40}$/.test(commit) || receipt.commit !== commit || receipt.manifestSha !== manifestSha ||
    receipt.authorization !== authorization || receipt.rateCard !== rateCard ||
    !/^proj_[A-Za-z0-9_-]{5,100}$/.test(receipt.project) || !/^org[-_][A-Za-z0-9_-]{5,100}$/.test(receipt.organization) ||
    !/^sk-proj-[A-Za-z0-9_-]{20,}$/.test(key) || sha(key) !== receipt.credentialSha256 ||
    !Number.isSafeInteger(receipt.countMicros) || receipt.countMicros < 0 || receipt.countMicros > 10_000 ||
    !evidence.every(item => typeof item === "string" && item.trim().length >= 12 && item.length <= 240) ||
    !Number.isFinite(expires) || expires <= now || expires > now + 2 * 60 * 60_000 ||
    !isDeepStrictEqual(receipt.verified, { pinnedModelEnabled: true, restrictedEndpoints: true,
      billingAndPhaseBudget: true, trainingOptInDisabled: true, retentionAndCachingReviewed: true, projectCredentialProtected: true })) {
    throw Error("Development project preflight evidence refused");
  }
}

function git(...args: string[]) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw Error("Reviewed Git checkout required");
  return result.stdout.trim();
}

async function preflight() {
  if (process.env.NODE_ENV === "production" || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw Error("Development TLS configuration refused");
  const key = process.env.MIOPAGES_OPENAI_DEV_API_KEY;
  delete process.env.MIOPAGES_OPENAI_DEV_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const commit = git("rev-parse", "HEAD");
  if (git("status", "--porcelain", "--untracked-files=normal")) throw Error("Clean reviewed Git checkout required");
  if (!key) throw Error("Verified dedicated development credential unavailable");
  const receiptPath = join(proofRoot, "preflight.json");
  if (await realpath(receiptPath) !== receiptPath || !(await lstat(receiptPath)).isFile() ||
    (await lstat(receiptPath)).size > 8192) throw Error("Protected preflight evidence required");
  git("check-ignore", "--", receiptPath);
  const receipt: Attestation = JSON.parse(await readFile(receiptPath, "utf8"));
  checkAttestation(receipt, commit, key);
  return { receipt, key, commit };
}

function httpsTransport(receipt: Attestation, key: string): ResponsesTransport {
  return { async send(path, body) {
    if (path !== "/v1/responses/input_tokens" && path !== "/v1/responses") throw Error("Unapproved API route");
    if (Date.now() >= Date.parse(receipt.validUntil)) throw Error("Proof authorization expired");
    const bytes = Buffer.from(JSON.stringify(body));
    if (bytes.length > 18_000) throw Error("API request exceeded envelope limit");
    return new Promise((resolveReply, reject) => {
      const refuse = () => reject(Error("Provider HTTPS or response validation failed"));
      const outgoing = request({
        protocol: "https:", hostname: "api.openai.com", port: 443, path, method: "POST",
        agent: false, rejectUnauthorized: true, signal: AbortSignal.timeout(90_000),
        headers: { Authorization: "Bearer " + key, "OpenAI-Project": receipt.project,
          "OpenAI-Organization": receipt.organization, "Content-Type": "application/json", "Content-Length": bytes.length },
      }, incoming => {
        if (incoming.statusCode !== 200 || !incoming.headers["content-type"]?.startsWith("application/json")) {
          incoming.destroy();
          reject(Error("Provider response refused"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 131_072) { incoming.destroy(); refuse(); }
          else chunks.push(chunk);
        });
        incoming.on("error", refuse);
        incoming.on("end", () => {
          try {
            const requestId = incoming.headers["x-request-id"];
            if (typeof requestId !== "string" || !/^req_[a-zA-Z0-9_-]{1,110}$/.test(requestId)) return refuse();
            resolveReply({ body: JSON.parse(Buffer.concat(chunks).toString("utf8")), requestId });
          } catch { refuse(); }
        });
      });
      outgoing.on("error", refuse);
      outgoing.end(bytes);
    });
  } };
}

export function exactProjection(context: QuestionContext, entryPath: Trace["entryPath"], gap: InterviewGap,
  evidence: InterviewEvidence[], first?: InterviewTurn, answer?: Trace["answer"]) {
  if (!isDeepStrictEqual(context, { entryPath, gap, evidence, history: first ? [first] : [] }) ||
      (first && (!answer || !first.answer || first.answer.text !== answer.text || first.answer.disposition !== answer.disposition))) {
    throw Error("Approved wire projection mismatch");
  }
  // Transmit the previous question and its citations. Timestamps, draft
  // metadata, local identities and alternate answers stay in the fixture.
  return { entryPath, gap, evidence, history: first ? [{
    id: first.id, question: first.question, sourceIds: first.sourceIds, answer,
  }] : [] };
}

function reviewedTurn(turn: InterviewTurn | undefined, context: Trace["context"], followUp = false): InterviewTurn {
  if (!turn?.question || (followUp && !turn.assessment)) throw Error("Required generated question or assessment missing");
  const text = [turn.question, turn.rationale, turn.assessment?.recommendation, turn.assessment?.evidenceNeeded].join(" ");
  const foreign = context === "c2" ? /\b(?:MioPages|HostShop|Web Presence|Ongoing)\b/i : /\b(?:tree service|urgent tree work|northern service area)\b/i;
  if (foreign.test(text) || /https?:\/\/|\b\S+@\S+\.\S+|\bsk-(?:proj-)?[\w-]{8,}|(?:\(\d{3}\)|\b\d{3})[ .-]?\d{3}[ .-]?\d{4}\b/i.test(text)) {
    throw Error("Generated output failed the protected evidence screen");
  }
  return turn;
}

export async function runProof(directory: string, bin: string, rates: Rates, transport: ResponsesTransport) {
  const manifest = await readManifest();
  if (!isDeepStrictEqual(rates, fixedRates(rates.countMicros))) throw Error("Pinned proof rate card required");
  await initializeOfflineUsageLedger(directory, rates);
  const fixture = await openIntelligentFixture(bin);
  try {
    const { pool, activation, database } = fixture;
    const owners = { c0: await fixture.owner(), c2: await fixture.owner() };
    let initialBuyer: InterviewTurn | undefined;
    const findings = [];
    for (const trace of manifest.traces) {
      const owner = owners[trace.context], entry = await fixture.createEntry(owner, trace.entryPath);
      await entry.authorize();
      const data = manifest.contexts[trace.context];
      const selected = data.gaps.find(item => item.id === trace.gap)!;
      const evidence = data.sources.filter(item => selected.sourceIds.includes(item.id));
      const gap = { ...selected, sourceIds: evidence.map(item => item.id) };
      const history: InterviewTurn[] = [];
      let replay = trace.firstQuestion !== "generate";
      const adapter = controlledProofResponsesProvider(directory, rates, transport, (context, attribution) => {
        if (attribution.ownerDigest !== fingerprint(owner)) throw Error("Proof tenant attribution mismatch");
        return exactProjection(context, trace.entryPath, gap, evidence, history[0], trace.answer);
      });
      const provider: QuestionProvider = { version: adapter.version, async propose(context, attribution) {
        if (!replay) return adapter.propose(context, attribution);
        exactProjection(context, trace.entryPath, gap, evidence);
        if (!initialBuyer?.question) throw Error("Validated first question required for replay");
        replay = false;
        return { question: initialBuyer.question, rationale: initialBuyer.rationale, sourceIds: initialBuyer.sourceIds, assessment: null };
      } };
      const engine = new IntelligentOnboarding(activation, new IntakeService(pool, owner, { database, answers: {}, provenance: {} }), {
        scope: entry.scope, evidence: data.sources.map(item => ({ ...item, ...owner,
          ...(item.kind === "synthetic-review" && { reviewDigest: entry.review?.digest }) })), gaps: data.gaps,
      }, provider);
      const before = await engine.open(entry);
      const asked = await engine.propose(entry, before.version, trace.gap);
      const first = reviewedTurn(asked.state.turns[0], trace.context);
      if (trace.id === "c0-buyer-a") initialBuyer = first;
      const answered = await engine.answer(entry, asked.version, first.id, trace.answer.disposition, trace.answer.text);
      history.push(answered.state.turns[0]);
      const followed = await engine.propose(entry, answered.version, trace.gap);
      const second = reviewedTurn(followed.state.turns[1], trace.context, true);
      assert.deepEqual(await engine.resume(entry), followed);
      assert.equal(second.respondsTo, first.id + ":answer");
      const receipt = { trace: trace.id, initialQuestion: first.question, initialSourceIds: first.sourceIds,
        followUp: second.question, followUpSourceIds: second.sourceIds, assessment: second.assessment,
        before: before.readiness.find(item => item.gapId === trace.gap), after: followed.readiness.find(item => item.gapId === trace.gap) };
      await writeFile(join(directory, trace.id + ".json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      findings.push(receipt);
    }
    assert.equal(findings[0].initialQuestion, findings[1].initialQuestion);
    assert.notDeepEqual(findings[0].assessment, findings[1].assessment, "Opposite answers must change the draft assessment");
    return findings;
  } finally { await fixture.close(); }
}

async function main() {
  const mode = process.argv[2];
  if (!["--preflight", "--execute"].includes(mode) || process.argv.length !== 3) throw Error("Explicit proof mode required");
  await readManifest();
  const { receipt, key, commit } = await preflight();
  const bin = process.env.PG_BIN_DIR;
  if (!bin) throw Error("Local PostgreSQL binary directory required");
  if (mode === "--preflight") {
    console.log("PASS: local attestation checked. No API requests.");
    return;
  }
  const directory = join(proofRoot, "attempt");
  await mkdir(directory, { mode: 0o700 }); // Exclusive across process restarts. Preserve on every outcome.
  await writeFile(join(directory, "authorization.json"), JSON.stringify({ authorization, commit, manifestSha,
    rateCard, countMicros: receipt.countMicros, validUntil: receipt.validUntil }) + "\n", { flag: "wx", mode: 0o600 });
  Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
  await runProof(directory, bin, fixedRates(receipt.countMicros), httpsTransport(receipt, key));
  console.log("PASS: four traces completed. Review sanitized evidence and usage before acceptance.");
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/intake/intelligent-live-proof.ts")) {
  main().catch(error => {
    const safe = ["Verified dedicated development credential unavailable", "Clean reviewed Git checkout required",
      "Protected preflight evidence required", "Development project preflight evidence refused",
      "Approved manifest digest mismatch", "Local PostgreSQL binary directory required"];
    console.error("BLOCKED: " + (safe.includes(error?.message) ? error.message : "Proof refused or interrupted. Preserve any existing attempt and usage evidence."));
    process.exitCode = 1;
  });
}
