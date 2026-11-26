import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fingerprint } from "../canonical/model";
import { initializeResponsesUsageLedger, meteredPresenceWorkflow, type ResponsesRates, type ResponsesRequest, type WorkflowUsageScope } from "../intake/intelligent-responses";
import { responsesHttps } from "../intake/responses-https";
import { createAiWriter } from "./ai-writer";
import type { Writer } from "./cycle";

/**
 * A local run with Core's real AI (rebuild plan, milestone 3), only when the Principal has approved
 * it and its cap. Every call is priced against the approved rate card and stops at the cap. The
 * usage ledger and each checked answer are kept in `directory` (outside Git), so the run's spending
 * and work survive the preview. Restarting the preview continues the same run and the same cap.
 */
export type AiRun = { name: string; directory: string; capMicros: number; rates: ResponsesRates };

/** The rate card the Principal approved for C0 on Nov 19. */
export const approvedRateCard: ResponsesRates = { model: "gpt-5.4-2026-03-05", verifiedOn: "2026-11-19", inputPerMillion: 2_500_000,
  cachedPerMillion: 250_000, outputPerMillion: 15_000_000, cacheWritePerMillion: 0, countMicros: 0 };

export async function aiRunWriter(run: AiRun, account: { webPresenceId: string; managedSiteId: string }, key: string): Promise<Writer> {
  const { budget, transport } = await connection(run, key);
  return createAiWriter({ account, ledgerDirectory: run.directory, rates: run.rates, transport, budget, outputLimit: 32_000,
    retain: async entry => { await appendFile(join(run.directory, "answers.jsonl"), JSON.stringify(entry) + "\n"); },
    readImage: file => readFile(inside(file)),
    refusals: async digest => (await readFile(join(run.directory, "answers.jsonl"), "utf8").catch(() => "")).split("\n").filter(Boolean)
      .map(line => JSON.parse(line) as { digest?: string; answer?: { refused?: string } }).filter(entry => entry.digest === digest && entry.answer?.refused).length,
    refused: async digest => (await readFile(join(run.directory, "answers.jsonl"), "utf8").catch(() => "")).split("\n").filter(Boolean)
      .map(line => JSON.parse(line) as { digest?: string; answer?: { refused?: string; output?: unknown } })
      .filter(entry => entry.digest === digest && entry.answer?.refused && entry.answer.output !== undefined).map(entry => entry.answer!.output) });
}

/**
 * Core's research calls in the same run, under the same ledger and cap: one web search, and the
 * checked analyses that follow it. The raw search answer is kept with the run.
 */
export async function aiRunResearch(run: AiRun, account: { webPresenceId: string; managedSiteId: string }, key: string, searchCalls: number) {
  const { budget, transport } = await connection(run, key);
  const ownerDigest = fingerprint(account);
  const searching = meteredPresenceWorkflow(run.directory, run.rates, transport, budget, 8_000, undefined, searchCalls);
  const analysing = meteredPresenceWorkflow(run.directory, run.rates, transport, budget, 6_000);
  return {
    search: (request: ResponsesRequest) => searching({ ownerDigest, workDigest: fingerprint({ research: "peer-search", request }) }, request,
      async () => undefined, async raw => {
        await mkdir(join(run.directory, "research"), { recursive: true });
        await writeFile(join(run.directory, "research", "search-answer.json"), raw);
      }),
    analyse: (request: ResponsesRequest, about: string) =>
      analysing({ ownerDigest, workDigest: fingerprint({ research: "peer-analysis", about, input: request.input }) }, request),
  };
}

/** Evidence images are read only from inside the project (brand assets, the run's own screenshots). */
function inside(file: string) {
  const path = resolve(process.cwd(), file), within = relative(process.cwd(), path);
  if (!within || within.startsWith("..") || isAbsolute(within)) throw Error("Evidence image outside the project: " + file);
  return path;
}

async function connection(run: AiRun, key: string) {
  await mkdir(run.directory, { recursive: true });
  const scopeFile = join(run.directory, "scope.json");
  // Earlier parts of the run (each its own closed ledger, kept in `earlier/`) count against the same cap.
  const before = await earlierMicros(run);
  let budget: WorkflowUsageScope;
  try { budget = JSON.parse(await readFile(scopeFile, "utf8")) as WorkflowUsageScope; }
  catch {
    await initializeResponsesUsageLedger(run.directory, run.rates);
    budget = { id: fingerprint(run.name), startingLedger: createHash("sha256").update(await readFile(join(run.directory, "onboarding-usage.json"))).digest("hex"),
      // inputTokens is each call's input ceiling, and every call reserves its worst case against the cap; 250k is well above any real call.
      baselineAttempts: 0, requests: 200, generations: 90, inputTokens: 250_000, inputBytes: 20_000_000, capMicros: run.capMicros - before };
    await writeFile(scopeFile, JSON.stringify(budget, null, 2));
  }
  if (budget.capMicros !== run.capMicros - before || budget.capMicros <= 0) throw Error("This run's cap differs from the one it started with, or is used up");
  // Requests may carry Evidence images (brand assets, peer screenshots), within the run's input-bytes envelope.
  return { budget, transport: responsesHttps(key, Date.now() + 12 * 3_600_000, budget.inputBytes + 1_000_000, 150_000) };
}

/** What the run has spent so far, in dollars, from its usage ledger (estimated where a call is still settling). */
export async function aiRunSpent(run: AiRun) {
  return (await earlierMicros(run) + await ledgerMicros(run.directory)) / 1_000_000;
}

async function ledgerMicros(directory: string) {
  try {
    const ledger = JSON.parse(await readFile(join(directory, "onboarding-usage.json"), "utf8")) as { attempts: { estimatedMicros?: number; reservedMicros?: number }[] };
    return ledger.attempts.reduce((total, attempt) => total + (attempt.estimatedMicros ?? attempt.reservedMicros ?? 0), 0);
  } catch { return 0; }
}

async function earlierMicros(run: AiRun) {
  const parts = await readdir(join(run.directory, "earlier")).catch(() => [] as string[]);
  let total = 0;
  for (const part of parts) total += await ledgerMicros(join(run.directory, "earlier", part));
  return total;
}
