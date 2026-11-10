import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, open, readdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fingerprint } from "../../lib/platform/canonical/model";
import { IntelligentOnboarding, type InterviewStage } from "../../lib/platform/intake/intelligent";
import type { InterviewEvidence, InterviewGap, InterviewTurn, QuestionContext, QuestionProvider } from "../../lib/platform/intake/intelligent-model";
import { controlledProofResponsesProvider, initializeOfflineUsageLedger, type Rates, type ResponsesTransport } from "../../lib/platform/intake/intelligent-responses";
import { IntakeService } from "../../lib/platform/intake/service";
import { openIntelligentFixture } from "./intelligent-proof-fixture";

const manifestFile = "docs/shared-intelligent-onboarding-live-proof-allowlist-2026-11-10.json";
export const manifestSha = "11d47ae88f1df63d4d6e70fbf1f694197bffa782c81b35c6e8e98eb90208457d";
export const proofModel = "gpt-5.4-mini-2026-03-17";
const authorization = "6775948557";
const ownerDiagnosticAuthorization = "6778994149";
const developmentAuthorization = "6779329635";
const proofRoot = resolve("runtime-content/openai-onboarding-proof");
const runCapMicros = 500_000, phaseCapMicros = 5_000_000;
const isNumberedAttempt = (name: string) => /^attempt-(?:0[2-9]|[1-9][0-9])$/.test(name);
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

async function preflight(ownerDiagnostic: boolean) {
  if (process.env.NODE_ENV === "production" || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw Error("Development TLS configuration refused");
  const key = ownerDiagnostic ? process.env.OPENAI_API_KEY : process.env.MIOPAGES_OPENAI_DEV_API_KEY;
  delete process.env.MIOPAGES_OPENAI_DEV_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const commit = git("rev-parse", "HEAD");
  if (git("status", "--porcelain", "--untracked-files=normal")) throw Error("Clean reviewed Git checkout required");
  if (ownerDiagnostic) {
    if (!key || !/^sk-proj-[A-Za-z0-9_-]{20,}$/.test(key)) throw Error("Existing project key unavailable");
    // The owner verified the available Default project settings. The first
    // authorized trace tests the key's actual project capability and snapshot.
    return { receipt: { validUntil: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), countMicros: 0 }, key, commit };
  }
  if (!key) throw Error("Verified dedicated development credential unavailable");
  const receiptPath = join(proofRoot, "preflight.json");
  if (await realpath(receiptPath) !== receiptPath || !(await lstat(receiptPath)).isFile() ||
    (await lstat(receiptPath)).size > 8192) throw Error("Protected preflight evidence required");
  git("check-ignore", "--", receiptPath);
  const receipt: Attestation = JSON.parse(await readFile(receiptPath, "utf8"));
  checkAttestation(receipt, commit, key);
  return { receipt, key, commit };
}

type Destination = { validUntil: string; project?: string; organization?: string };
type ProofPath = Parameters<ResponsesTransport["send"]>[0];

export function providerFailure(path: ProofPath, status: number | null, body?: unknown) {
  const error = (body as { error?: { code?: unknown; type?: unknown; param?: unknown } } | null)?.error;
  const atom = (value: unknown) => typeof value === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(value) &&
    !/^(?:sk|org|proj|req|user)_/.test(value) ? value : null;
  const param = typeof error?.param === "string" &&
    /^(?:model|input|instructions|store|service_tier|max_output_tokens|text(?:\.format(?:\.schema)?)?)$/.test(error.param) ? error.param : null;
  return { path, status, code: atom(error?.code), type: atom(error?.type), param };
}

function httpsTransport(receipt: Destination, key: string, recordFailure: (failure: ReturnType<typeof providerFailure>) => Promise<void>): ResponsesTransport {
  return { async send(path, body) {
    if (path !== "/v1/responses/input_tokens" && path !== "/v1/responses") throw Error("Unapproved API route");
    if (Date.now() >= Date.parse(receipt.validUntil)) throw Error("Proof authorization expired");
    const bytes = Buffer.from(JSON.stringify(body));
    if (bytes.length > 18_000) throw Error("API request exceeded envelope limit");
    return new Promise((resolveReply, reject) => {
      let status: number | null = null, settled = false;
      const refuse = (body?: unknown) => {
        if (settled) return;
        settled = true;
        recordFailure(providerFailure(path, status, body)).then(
          () => reject(Error("Provider HTTPS or response validation failed")), reject);
      };
      const outgoing = request({
        protocol: "https:", hostname: "api.openai.com", port: 443, path, method: "POST",
        agent: false, rejectUnauthorized: true, signal: AbortSignal.timeout(90_000),
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Content-Length": bytes.length,
          ...(receipt.project && { "OpenAI-Project": receipt.project }),
          ...(receipt.organization && { "OpenAI-Organization": receipt.organization }) },
      }, incoming => {
        status = incoming.statusCode ?? null;
        if (!incoming.headers["content-type"]?.startsWith("application/json") || (status !== null && status >= 300 && status < 400)) {
          refuse();
          incoming.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 131_072) { refuse(); incoming.destroy(); }
          else chunks.push(chunk);
        });
        incoming.on("error", () => refuse());
        incoming.on("end", () => {
          try {
            if (settled) return;
            const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (status !== 200) return refuse(body);
            const requestId = incoming.headers["x-request-id"];
            if (typeof requestId !== "string" || !/^req_[a-zA-Z0-9_-]{1,110}$/.test(requestId)) return refuse();
            settled = true;
            resolveReply({ body, requestId });
          } catch { refuse(); }
        });
      });
      outgoing.on("error", () => refuse());
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

export function reviewedTurn(turn: InterviewTurn | undefined, context: Trace["context"], followUp = false): InterviewTurn {
  if (!turn?.question || (followUp && !turn.assessment)) throw Error("Required generated question or assessment missing");
  const text = [turn.question, turn.rationale, turn.assessment?.recommendation, turn.assessment?.evidenceNeeded].join(" ");
  const foreign = context === "c2" ? /\b(?:MioPages|HostShop|Web Presence|Ongoing)\b/i : /\b(?:tree service|urgent tree work|northern service area)\b/i;
  if (foreign.test(text) || /[\u200b-\u200f\u202a-\u202e\u2060-\u206f]|https?:\/\/|\b\S+@\S+\.\S+|\bsk-(?:proj-)?[\w-]{8,}|(?:\(\d{3}\)|\b\d{3})[ .-]?\d{3}[ .-]?\d{4}\b/i.test(text)) {
    throw Error("Generated output failed the protected evidence screen");
  }
  const statements = [turn.rationale, turn.assessment?.recommendation, turn.assessment?.evidenceNeeded];
  if (statements.some(statement => statement && !/[.!?]$/.test(statement))) throw Error("Incomplete proof sentence");
  return turn;
}

export async function phaseExposure(root: string) {
  let total = 0;
  for (const name of await readdir(root)) {
    if (name !== "attempt" && !isNumberedAttempt(name)) continue;
    const directory = join(root, name);
    if (!(await lstat(directory)).isDirectory() || await realpath(directory) !== directory) throw Error("Phase evidence boundary refused");
    const path = join(directory, "onboarding-usage.json");
    const file = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!file) { total += runCapMicros; continue; }
    if (!file.isFile() || file.size > 32768) throw Error("Phase ledger refused");
    const { attempts } = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(attempts) || attempts.length > 7) throw Error("Phase ledger refused");
    for (const entry of attempts) {
      const settled = entry.status === "completed" || entry.status === "rejected";
      const amount = settled ? entry.estimatedMicros : entry.reservedMicros;
      if (!["completed", "rejected", "uncertain", "pending"].includes(entry.status) ||
          !Number.isSafeInteger(amount) || amount < 0 || amount > runCapMicros) throw Error("Phase ledger refused");
      total += amount;
    }
  }
  return total;
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
      async function generate(version: number, index: number) {
        let latest: InterviewStage | { stage: "output-screen"; code: string } = { stage: "draft-reservation", code: "started" };
        try {
          const draft = await engine.propose(entry, version, trace.gap, stage => { latest = stage; });
          if (draft.state.failure) throw Error("Interview turn refused");
          latest = { stage: "output-screen", code: "refused" };
          return { draft, turn: reviewedTurn(draft.state.turns[index], trace.context, index === 1) };
        } catch (error) {
          if (latest.stage === "output-screen" && error instanceof Error && error.message === "Incomplete proof sentence") {
            latest = { stage: "output-screen", code: "incomplete_sentence" };
          }
          await writeFile(join(directory, "local-error.json"),
            JSON.stringify({ trace: trace.id, turn: index + 1, ...latest }) + "\n", { flag: "wx", mode: 0o600 });
          throw error;
        }
      }
      async function saveFinding(file: string, content: object, turn: number) {
        try { await writeFile(join(directory, file), JSON.stringify(content, null, 2) + "\n", { flag: "wx", mode: 0o600 }); }
        catch (error) {
          await writeFile(join(directory, "local-error.json"),
            JSON.stringify({ trace: trace.id, turn, stage: "evidence-persistence", code: "write_failed" }) + "\n", { flag: "wx", mode: 0o600 });
          throw error;
        }
      }
      const before = await engine.open(entry);
      const { draft: asked, turn: first } = await generate(before.version, 0);
      if (trace.id === "c0-buyer-a") {
        initialBuyer = first;
        await saveFinding("diagnostic-question.json", { question: first.question, sourceIds: first.sourceIds }, 1);
      }
      const answered = await engine.answer(entry, asked.version, first.id, trace.answer.disposition, trace.answer.text);
      history.push(answered.state.turns[0]);
      const { draft: followed, turn: second } = await generate(answered.version, 1);
      assert.deepEqual(await engine.resume(entry), followed);
      assert.equal(second.respondsTo, first.id + ":answer");
      const receipt = { trace: trace.id, initialQuestion: first.question, initialSourceIds: first.sourceIds,
        followUp: second.question, followUpSourceIds: second.sourceIds, assessment: second.assessment,
        before: before.readiness.find(item => item.gapId === trace.gap), after: followed.readiness.find(item => item.gapId === trace.gap) };
      await saveFinding(trace.id + ".json", receipt, 2);
      findings.push(receipt);
    }
    assert.equal(findings[0].initialQuestion, findings[1].initialQuestion);
    assert.notDeepEqual(findings[0].assessment, findings[1].assessment, "Opposite answers must change the draft assessment");
    return findings;
  } finally { await fixture.close(); }
}

async function main() {
  const [mode, flag, attempt = "attempt", scope, ...rest] = process.argv.slice(2);
  const ownerDiagnostic = flag === "--owner-diagnostic";
  const research = scope === "--research" || scope === "--research-c0";
  if (!["--preflight", "--execute"].includes(mode) || (flag && !ownerDiagnostic) || rest.length ||
      (attempt !== "attempt" && (!ownerDiagnostic || !isNumberedAttempt(attempt))) ||
      (scope && (!research || !ownerDiagnostic || !isNumberedAttempt(attempt)))) throw Error("Explicit proof mode required");
  await readManifest();
  const { receipt, key, commit } = await preflight(ownerDiagnostic);
  const bin = process.env.PG_BIN_DIR;
  if (!bin) throw Error("Local PostgreSQL binary directory required");
  if (mode === "--preflight") {
    console.log(ownerDiagnostic ? "PASS: bounded owner diagnostic inputs checked. No API requests." : "PASS: local attestation checked. No API requests.");
    return;
  }
  if (await realpath(dirname(proofRoot)) !== dirname(proofRoot)) throw Error("Protected attempt directory required");
  git("check-ignore", "--", proofRoot);
  await mkdir(proofRoot, { recursive: true, mode: 0o700 });
  if (await realpath(proofRoot) !== proofRoot) throw Error("Protected attempt directory required");
  const lockPath = join(proofRoot, ".phase.lock"), lock = await open(lockPath, "wx", 0o600);
  try {
    const previousExposureMicros = await phaseExposure(proofRoot);
    if (previousExposureMicros + runCapMicros > phaseCapMicros) throw Error("Development phase budget exhausted");
    const directory = join(proofRoot, attempt);
    await mkdir(directory, { mode: 0o700 }); // Existing attempts are never replaced.
    await writeFile(join(directory, "authorization.json"), JSON.stringify({
      authorization: attempt !== "attempt" ? developmentAuthorization : ownerDiagnostic ? ownerDiagnosticAuthorization : authorization,
      commit, manifestSha, ...(research && { scope: "public-research-and-synthetic-interview", c0Only: scope === "--research-c0" }),
      rateCard, countMicros: receipt.countMicros, validUntil: receipt.validUntil, previousExposureMicros,
    }) + "\n", { flag: "wx", mode: 0o600 });
    Object.assign(process.env, { NODE_ENV: "development", MIOPAGES_REVIEW_SYNTHESIS: "local-operator" });
    const transport = httpsTransport(receipt, key, async failure => {
      await writeFile(join(directory, "provider-error.json"), JSON.stringify(failure) + "\n", { flag: "wx", mode: 0o600 });
      console.error("Provider failure " + JSON.stringify(failure));
    });
    if (research) {
      const { runResearchProof } = await import("./research-first");
      await runResearchProof(directory, bin, fixedRates(receipt.countMicros), transport, scope === "--research-c0");
    } else await runProof(directory, bin, fixedRates(receipt.countMicros), transport);
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
  console.log(research ? "PASS: research-led interview evidence saved." : "PASS: four traces completed. Review sanitized evidence and usage before acceptance.");
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/intake/intelligent-live-proof.ts")) {
  main().catch(error => {
    const safe = ["Verified dedicated development credential unavailable", "Existing project key unavailable", "Clean reviewed Git checkout required",
      "Protected preflight evidence required", "Development project preflight evidence refused",
      "Approved manifest digest mismatch", "Local PostgreSQL binary directory required"];
    console.error("BLOCKED: " + (safe.includes(error?.message) ? error.message : "Proof refused or interrupted. Preserve any existing attempt and usage evidence."));
    process.exitCode = 1;
  });
}
