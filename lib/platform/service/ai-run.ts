import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fingerprint } from "../canonical/model";
import { initializeResponsesUsageLedger, type ResponsesRates, type WorkflowUsageScope } from "../intake/intelligent-responses";
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

export async function aiRunWriter(run: AiRun, account: { webPresenceId: string; managedSiteId: string }, key: string): Promise<Writer> {
  await mkdir(run.directory, { recursive: true });
  const scopeFile = join(run.directory, "scope.json");
  // Earlier parts of the run (each its own closed ledger, kept in `earlier/`) count against the same cap.
  const before = await earlierMicros(run);
  let budget: WorkflowUsageScope;
  try { budget = JSON.parse(await readFile(scopeFile, "utf8")) as WorkflowUsageScope; }
  catch {
    await initializeResponsesUsageLedger(run.directory, run.rates);
    budget = { id: fingerprint(run.name), startingLedger: createHash("sha256").update(await readFile(join(run.directory, "onboarding-usage.json"))).digest("hex"),
      baselineAttempts: 0, requests: 100, generations: 45, inputTokens: 4_000_000, inputBytes: 20_000_000, capMicros: run.capMicros - before };
    await writeFile(scopeFile, JSON.stringify(budget, null, 2));
  }
  if (budget.capMicros !== run.capMicros - before || budget.capMicros <= 0) throw Error("This run's cap differs from the one it started with, or is used up");
  const transport = responsesHttps(key, Date.now() + 12 * 3_600_000, 4_000_000, 120_000);
  return createAiWriter({ account, ledgerDirectory: run.directory, rates: run.rates, transport, budget, outputLimit: 32_000,
    retain: async entry => { await appendFile(join(run.directory, "answers.jsonl"), JSON.stringify(entry) + "\n"); } });
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
