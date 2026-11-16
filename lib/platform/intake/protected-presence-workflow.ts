import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import { fingerprint } from "../canonical/model";
import { IntakeError, normalizeAnswers } from "./model";
import { adaptiveOnboardingVersion, type PreparedUnderstanding } from "./adaptive";
import { c0DisclosureManifest, addC0WorkflowKnowledge } from "./c0-workflow-knowledge";
import { protectedOwnerScope } from "./protected-owner";
import { IntakeService, type IntakeEvidence } from "./service";
import { protectedConnection, protectedPool } from "../wordpress-delivery/protected-connection";
import { PresenceWorkflow, WorkflowBlocked, type WorkflowActor } from "./presence-workflow";
import { createResponsesPresenceWorkflow, type PresenceWorkflowGrant } from "./presence-workflow-provider";
import { researchUrlAllowed } from "./presence-workflow-research";
import { pinnedResearchFetch } from "./presence-workflow-egress";
import { responsesHttps } from "./responses-https";
import { confirmPresenceWorkflowImage, meteredPresenceWorkflowImage, type ResponsesRates, type ResponsesTransport } from "./intelligent-responses";
import { acquirePresenceVisual, presenceVisualRequest, readPresenceVisual, validatePresenceImageGrant, type PresenceVisual,
  type PresenceVisualOperations, type PresenceVisualResult } from "./presence-workflow-visual";
import { openAIImageProvider } from "../acquisition/openai";
import type { ImageProvider } from "../acquisition/contracts";

export const protectedWorkflowRole = "miopages_core_development";
type Workspace = { root: string; grantFile: string; ledgerDirectory: string; referenceDirectory?: string; visualDirectory?: string };

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
export async function protectedWorkflowWorkspace(requireEvidence = true): Promise<Workspace> {
  const home = await realpath(process.env.HOME ?? "");
  const root = join(home, "miopages-private-acceptance");
  const ledgerDirectory = join(root, "core-usage");
  const referenceDirectory = join(root, "presence-workflow-evidence");
  await verifyDirectory(root);
  await verifyDirectory(ledgerDirectory);
  if (requireEvidence) await verifyDirectory(referenceDirectory);
  return { root, ledgerDirectory, referenceDirectory, visualDirectory: join(root, "presence-workflow-media"), grantFile: join(root, "presence-workflow-grant.json") };
}

type ProtectedInput = { webPresenceId: string; managedSiteId: string; draftToken: string; answers: unknown;
  provenance: Record<string, IntakeEvidence>; prepared: PreparedUnderstanding; step: number };

export async function openProtectedPresenceWorkspace(requireEvidence = true) {
  const workspace = await protectedWorkflowWorkspace(requireEvidence);
  const input = await privateWorkflowFile<ProtectedInput>(join(workspace.root, "core-input.json"), workspace.root);
  const selection = { webPresenceId: input.webPresenceId, managedSiteId: input.managedSiteId };
  if (fingerprint(selection) !== fingerprint(protectedOwnerScope) || input.step !== 3 || input.prepared.scenario !== "c0" ||
      !/^[0-9a-f]{64}$/u.test(input.draftToken)) throw Error("Protected C0 binding refused");
  const answers = normalizeAnswers(input.answers, adaptiveOnboardingVersion);
  if (fingerprint(answers) !== fingerprint(input.answers) ||
      Object.keys(answers).some(key => input.provenance[key]?.confirmation !== "unconfirmed")) throw Error("Protected C0 intake evidence refused");
  const ca = process.env.MIOPAGES_WP_DATABASE_CA;
  if (!ca) throw Error("Pinned CA required");
  const pool = protectedPool(process.env.MIOPAGES_PROTECTED_CORE_DB_URL ?? "", protectedWorkflowRole, ca);
  const intake = new IntakeService(pool, selection, { database: "postgres", answers, provenance: input.provenance, prepared: input.prepared, step: input.step,
    async protectedScope(db) {
      await protectedConnection(db, protectedWorkflowRole, "postgres");
      const result = await db.query("SELECT 1 FROM miopages_wp.core_development_scope WHERE web_presence_id=$1 AND managed_site_id=$2",
        [selection.webPresenceId, selection.managedSiteId]);
      if (result.rowCount !== 1) throw Error("Protected C0 scope refused");
    },
  });
  return { workspace, pool, intake, token: input.draftToken };
}

export function composePresenceCase(pool: Pool, intake: IntakeService, token: string, workspace: Workspace, capability:
  { kind: "review" } | { kind: "worker"; apiKey: string } |
  { kind: "offline-test"; transport: ResponsesTransport; fetchPage: typeof fetch; readGrant: () => Promise<PresenceWorkflowGrant>; rates: ResponsesRates; imageProvider?: ImageProvider }) {
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
      let visuals: PresenceVisualOperations | undefined;
      if (grant.images) {
        const images = validatePresenceImageGrant(grant.images);
        const directory = workspace.visualDirectory;
        if (!directory) throw Error("Private workflow image directory required");
        if (capability.kind !== "offline-test") await verifyDirectory(directory);
        const provider = capability.kind === "worker" ? openAIImageProvider({ key: capability.apiKey, model: images.model, timeoutMs: 120_000 })
          : capability.kind === "offline-test" ? capability.imageProvider : undefined;
        const choices = images.briefs.map(brief => ({ id: brief.id, label: brief.label, request: presenceVisualRequest(brief.prompt) }));
        const attribution = (visual: PresenceVisual) => ({ ownerDigest: fingerprint(current.scope), workDigest: fingerprint({
          workflow: grant.ledger.id, visualId: visual.id, placement: visual.placement, imageRequest: visual.requestDigest,
        }) });
        const recheck = async () => {
          const latest = await readGrant();
          if (latest.revoked || Date.now() >= latest.expiresAt || fingerprint(latest) !== fingerprint(grant) ||
              fingerprint(await context()) !== grant.contextDigest) throw new WorkflowBlocked("Image authorization unavailable");
        };
        visuals = {
          requestable: !grant.revoked && Date.now() < grant.expiresAt,
          briefs: choices.map(({ id, label, request }) => ({ id, label, requestDigest: fingerprint(request) })),
          ...(provider && { execute: async (visual, retain) => {
            const request = choices.find(brief => brief.id === visual.briefId)?.request;
            if (!request || fingerprint(request) !== visual.requestDigest || provider.model !== images.model) {
              throw new WorkflowBlocked("Exact approved visual brief required");
            }
            return meteredPresenceWorkflowImage(workspace.ledgerDirectory, rates, grant.ledger, attribution(visual), images.model,
              async () => {
                const result = await acquirePresenceVisual(provider, visual.placement, request, directory, visual.id, recheck);
                await retain(result);
                return result;
              }, recheck, grant.retainedReservation);
          } }),
          recover: async (visual, bytes) => {
            const result = JSON.parse(bytes.toString("utf8")) as PresenceVisualResult;
            await confirmPresenceWorkflowImage(workspace.ledgerDirectory, grant.ledger, attribution(visual), images.model, result);
            await readPresenceVisual(directory, { ...visual, result });
            return result;
          },
          read: async visual => {
            await confirmPresenceWorkflowImage(workspace.ledgerDirectory, grant.ledger, attribution(visual), images.model, visual.result);
            return readPresenceVisual(directory, visual);
          },
        };
      }
      const scoped = { ...operations, visuals };
      return new PresenceWorkflow(pool, capability.kind === "review" ? { ...scoped, run: noOutbound } : scoped, {}, Date.now, "protected");
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
    } else if (previous.next === "review-complete" && previous.visuals?.some(visual => ["queued", "running", "unverified"].includes(visual.state))) {
      return workflow.advanceVisual(current, previous.version);
    } else return previous;
  }
  return previous;
}

export async function recoverRetainedPresenceOutput(workflow: PresenceWorkflow,
  current: Awaited<ReturnType<ReturnType<typeof composePresenceCase>["context"]>>, operation: "research" | "report") {
  const review = await workflow.review(current);
  if (!review?.recoverable || review.pendingOperation !== operation) throw Error("Retained workflow recovery unavailable");
  return workflow.recover(current, review.version);
}

export async function reviewWorkflowChange(workflow: PresenceWorkflow,
  current: Awaited<ReturnType<ReturnType<typeof composePresenceCase>["context"]>>, operation: unknown, version: number, actor: WorkflowActor, details?: { finding?: unknown; correction?: unknown; visual?: unknown }) {
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
    case "workflow-visual-queue": {
      const input = details?.visual as { path?: unknown; index?: unknown; briefId?: unknown } | undefined;
      if (typeof input?.path !== "string" || typeof input.index !== "number") throw new IntakeError("invalid_request");
      return workflow.queueVisual(current, version, actor, input.path, input.index, input.briefId);
    }
    case "workflow-visual-decide": return workflow.decideVisual(current, version, actor, details?.visual);
    default: throw new IntakeError("invalid_request");
  }
}
