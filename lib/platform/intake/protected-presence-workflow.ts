import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import { fingerprint } from "../canonical/model";
import { IntakeError } from "./model";
import { c0DisclosureManifest, addC0WorkflowKnowledge } from "./c0-workflow-knowledge";
import { protectedOwnerScope } from "./protected-owner";
import type { IntakeService } from "./service";
import { PresenceWorkflow, WorkflowBlocked, type WorkflowActor } from "./presence-workflow";
import { createResponsesPresenceWorkflow, type PresenceWorkflowGrant } from "./presence-workflow-provider";
import { researchUrlAllowed } from "./presence-workflow-research";
import { pinnedResearchFetch } from "./presence-workflow-egress";
import { responsesHttps } from "./responses-https";
import type { ResponsesRates, ResponsesTransport } from "./intelligent-responses";

export const protectedWorkflowRole = "miopages_core_development";
type Workspace = { root: string; grantFile: string; ledgerDirectory: string; referenceDirectory?: string };

export async function privateWorkflowBytes(file: string, root: string): Promise<Buffer> {
  const meta = await lstat(file);
  if (!meta.isFile() || meta.size > 256_000 || meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o600 ||
      await realpath(file) !== file || !file.startsWith(root + "/") || file.includes("/public_html/")) throw Error("Protected workflow file refused");
  return readFile(file);
}
export async function privateWorkflowFile<T>(file: string, root: string): Promise<T> {
  return JSON.parse((await privateWorkflowBytes(file, root)).toString("utf8")) as T;
}

async function verifyDirectory(path: string) {
  const status = await lstat(path);
  if (!status.isDirectory() || status.uid !== process.getuid?.() || (status.mode & 0o777) !== 0o700 ||
      await realpath(path) !== path) throw Error("Protected workflow directory refused");
}
export async function protectedWorkflowWorkspace(): Promise<Workspace> {
  const home = await realpath(process.env.HOME ?? "");
  const root = join(home, "miopages-private-acceptance");
  const ledgerDirectory = join(root, "core-usage");
  const referenceDirectory = join(root, "presence-workflow-evidence");
  await verifyDirectory(root);
  await verifyDirectory(ledgerDirectory);
  await verifyDirectory(referenceDirectory);
  return { root, ledgerDirectory, referenceDirectory, grantFile: join(root, "presence-workflow-grant.json") };
}

export function composePresenceCase(pool: Pool, intake: IntakeService, token: string, workspace: Workspace, capability:
  { kind: "review" } | { kind: "worker"; apiKey: string } |
  { kind: "offline-test"; transport: ResponsesTransport; fetchPage: typeof fetch; readGrant: () => Promise<PresenceWorkflowGrant>; rates: ResponsesRates }) {
  if (capability.kind === "offline-test" && process.env.NODE_ENV === "production") throw Error("Fixture transport refused");
  const readGrant = capability.kind === "offline-test" ? capability.readGrant : () => privateWorkflowFile<PresenceWorkflowGrant>(workspace.grantFile, workspace.root);
  async function context() {
    if (fingerprint(intake.selection) !== fingerprint(protectedOwnerScope) && capability.kind !== "offline-test") {
      throw Error("Protected workflow site refused");
    }
    return addC0WorkflowKnowledge(await intake.workflowContext(token), workspace.referenceDirectory, capability.kind !== "offline-test");
  }
  return {
    context,
    async open() {
      const [grant, current] = await Promise.all([readGrant(), context()]);
      const manifest = c0DisclosureManifest(current);
      if (grant.contextDigest !== manifest.contextDigest ||
          grant.approvedSources.some(digest => !manifest.approvedSourceCandidates.some(source => source.digest === digest))) throw Error("Protected workflow source binding refused");
      const rates = capability.kind === "offline-test" ? capability.rates : (await privateWorkflowFile<{ rateCard: ResponsesRates }>(
        join(workspace.ledgerDirectory, "onboarding-usage.json"), workspace.root)).rateCard;
      if (rates.model !== "gpt-5.4-mini-2026-03-17" || rates.inputPerMillion !== 750_000 || rates.cachedPerMillion !== 75_000 ||
          rates.outputPerMillion !== 4_500_000 || rates.cacheWritePerMillion !== 0 || rates.countMicros !== 0) throw Error("Pinned workflow rates refused");
      async function noOutbound(): Promise<never> { throw new WorkflowBlocked("The worker owns provider dispatch"); }
      const transport = capability.kind === "worker" ? responsesHttps(capability.apiKey, grant.expiresAt, grant.ledger.inputBytes + 48_000)
        : capability.kind === "offline-test" ? capability.transport : { send: noOutbound };
      const fetchPage = capability.kind === "worker" ? pinnedResearchFetch(url => researchUrlAllowed(url, grant.researchSources, grant.discovery), grant.researchResponseBytes)
        : capability.kind === "offline-test" ? capability.fetchPage : noOutbound;
      const operations = createResponsesPresenceWorkflow({ grant, readGrant, readContext: context, ledgerDirectory: workspace.ledgerDirectory, rates, transport, fetchPage,
        fetchMarketPages: sources => capability.kind === "worker"
          ? pinnedResearchFetch(url => researchUrlAllowed(url, sources), grant.researchResponseBytes) : fetchPage,
      });
      return new PresenceWorkflow(pool, capability.kind === "review" ? { ...operations, run: noOutbound } : operations, {}, Date.now, "protected");
    },
  };
}

export async function workPresenceCase(workflow: PresenceWorkflow, current: Awaited<ReturnType<ReturnType<typeof composePresenceCase>["context"]>>) {
  let previous = await workflow.review(current);
  while (previous) {
    if (previous.recoverable && !previous.failure) {
      previous = await workflow.recover(current, previous.version);
    } else if (!previous.failure && ["research", "report", "direction", "blueprint", "page", "editorial"].includes(previous.next)) {
      previous = await workflow.advance(current, previous.version);
    } else return previous;
  }
  return previous;
}

export async function recoverPresenceResearch(workflow: PresenceWorkflow,
  current: Awaited<ReturnType<ReturnType<typeof composePresenceCase>["context"]>>) {
  const review = await workflow.review(current);
  if (!review?.recoverable || review.pendingOperation !== "research") throw Error("Retained research recovery unavailable");
  return workflow.recover(current, review.version);
}

export async function reviewWorkflowChange(workflow: PresenceWorkflow,
  current: Awaited<ReturnType<ReturnType<typeof composePresenceCase>["context"]>>, operation: unknown, version: number, actor: WorkflowActor, details?: { finding?: unknown; correction?: unknown }) {
  // Existing protected Operator can continue a development report. This grants
  // no authority to confirm business facts as a customer or publish anything.
  switch (operation) {
    case "workflow-start": return workflow.start(current);
    case "workflow-continue": return workflow.confirmReport(current, version, actor, true);
    case "workflow-correct": {
      if (typeof details?.finding !== "string" || typeof details.correction !== "string") throw new IntakeError("invalid_request");
      return workflow.correctReport(current, version, details.finding, details.correction, actor, true);
    }
    case "workflow-recover": return workflow.recover(current, version);
    case "workflow-retry": return workflow.retryRejectedOutput(current, version, actor);
    case "workflow-revise": return workflow.requestEditorialRevision(current, version, actor);
    case "workflow-review": return workflow.reviewCandidate(current, version, actor);
    default: throw new IntakeError("invalid_request");
  }
}
