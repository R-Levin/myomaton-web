import { access, lstat, open, readFile, realpath } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Pool } from "pg";
import { fingerprint } from "../canonical/model";
import { requireEvaluationContext } from "./presence-evaluation";
import type { WorkflowContext, WorkflowRun } from "./presence-workflow";
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
import { confirmPresenceWorkflowImage, meteredPresenceWorkflowImage, type ReportReservation, type ResponsesRates, type ResponsesTransport } from "./intelligent-responses";
import { acquirePresenceVisual, presenceVisualRequest, readPresenceVisual, validatePresenceImageGrant, type PresenceVisual,
  type PresenceVisualOperations, type PresenceVisualResult } from "./presence-workflow-visual";
import { openAIImageProvider } from "../acquisition/openai";
import type { ImageProvider } from "../acquisition/contracts";
import type { OriginalMaterial } from "./presence-source-material";
import { researchMaterialCustody } from "./presence-research-material";
import { capturePublicPeer } from "./presence-peer-browser";
import { chromium } from "playwright-core";
import type {PublicPeerCapture} from "./presence-public-capture-bridge";
import {retainedResearchFetch} from "./presence-research-cache";
import {approvedSuppliedEvidence,type SuppliedPlacement,type SuppliedLineage} from "../acquisition/supplied-evidence";
import {readManagedObject} from "../assets/local-storage";
import {eligibleStock} from "../acquisition/stock";
import {createHash} from "node:crypto";

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

export async function verifyDirectory(path: string) {
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

export async function openProtectedPresenceWorkspace(requireEvidence = true, connection?: { url: string; ca: string }) {
  const workspace = await protectedWorkflowWorkspace(requireEvidence);
  const input = await privateWorkflowFile<ProtectedInput>(join(workspace.root, "core-input.json"), workspace.root);
  const selection = { webPresenceId: input.webPresenceId, managedSiteId: input.managedSiteId };
  if (fingerprint(selection) !== fingerprint(protectedOwnerScope) || input.step !== 3 || input.prepared.scenario !== "c0" ||
      !/^[0-9a-f]{64}$/u.test(input.draftToken)) throw Error("Protected C0 binding refused");
  const answers = normalizeAnswers(input.answers, adaptiveOnboardingVersion);
  if (fingerprint(answers) !== fingerprint(input.answers) ||
      Object.keys(answers).some(key => input.provenance[key]?.confirmation !== "unconfirmed")) throw Error("Protected C0 intake evidence refused");
  const ca = connection?.ca ?? process.env.MIOPAGES_WP_DATABASE_CA;
  if (!ca) throw Error("Pinned CA required");
  const pool = protectedPool(connection?.url ?? process.env.MIOPAGES_PROTECTED_CORE_DB_URL ?? "", protectedWorkflowRole, ca);
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

type PresenceCapability = { kind: "review" } | { kind: "blueprint-recovery"; repair: (output: unknown, run: WorkflowRun, bytes: Buffer) => unknown } | { kind: "research-replay" } | { kind: "worker"; apiKey: string; resumeMarketResearch?: boolean; reportHold?: ReportReservation; peerCapture?: PublicPeerCapture } |
  { kind: "offline-test"; transport: ResponsesTransport; fetchPage: typeof fetch; readGrant: () => Promise<PresenceWorkflowGrant>; rates: ResponsesRates; imageProvider?: ImageProvider };

export function composePresenceCase(pool: Pool, intake: IntakeService, token: string, workspace: Workspace, capability: PresenceCapability) {
  async function context() {
    if (fingerprint(intake.selection) !== fingerprint(protectedOwnerScope) && capability.kind !== "offline-test") {
      throw Error("Protected workflow site refused");
    }
    return addC0WorkflowKnowledge(await intake.workflowContext(token), workspace.referenceDirectory, capability.kind !== "offline-test");
  }
  return composeBoundPresenceCase(pool, context, workspace, capability, "protected", (current, grant) => {
    const manifest = c0DisclosureManifest(current);
    return !grant.ledger.carryForward && grant.contextDigest === manifest.contextDigest &&
      grant.approvedSources.every(digest => manifest.approvedSourceCandidates.some(source => source.digest === digest));
  });
}

export function composeIsolatedPresenceEvaluation(pool: Pool, intake: IntakeService, token: string, bound: WorkflowContext,
  workspace: Workspace, capability: PresenceCapability) {
  const binding = requireEvaluationContext(bound);
  if (process.env.NODE_ENV === "production") throw Error("Evaluation runner is isolated from production");
  const expected = structuredClone(bound);
  async function context() {
    const { rows: [database] } = await pool.query("SELECT current_database() AS name, host(inet_server_addr()) AS host");
    if (!/^migration_rehearsal_[a-f0-9]{32}$/u.test(database?.name ?? "") || database.host !== "127.0.0.1") {
      throw Error("Isolated evaluation requires the disposable loopback database");
    }
    const owned = await intake.workflowContext(token);
    if (owned.intakeId !== expected.intakeId || fingerprint(owned.scope) !== fingerprint(expected.scope) || owned.entry !== expected.entry) {
      throw Error("Evaluation intake ownership changed");
    }
    return structuredClone(expected);
  }
  const evaluation = composeBoundPresenceCase(pool, context, workspace, capability, "disposable", (current, grant) =>
    grant.siteComposition === "managed-v1" && (grant.ledger.baselineAttempts === 0 ||
      Boolean(grant.marketingAuthority?.strategy && grant.ledger.carryForward)) && Boolean(grant.ledger.breakdown) &&
    grant.contextDigest === fingerprint(current) &&
    fingerprint([...grant.approvedSources].sort()) === fingerprint(current.evidence.map(fingerprint).sort()));
  return { context, async open() {
    if (basename(workspace.root) !== binding.intake || workspace.grantFile !== join(workspace.root, "grant.json") ||
        workspace.ledgerDirectory !== join(workspace.root, "usage") ||
        (workspace.visualDirectory && workspace.visualDirectory !== join(workspace.root, "media"))) {
      throw Error("Case-specific private evaluation workspace required");
    }
    if (capability.kind !== "offline-test") {
      await verifyDirectory(workspace.root);
      await verifyDirectory(workspace.ledgerDirectory);
    }
    return evaluation.open();
  } };
}

function composeBoundPresenceCase(pool: Pool, context: () => Promise<WorkflowContext>, workspace: Workspace,
  capability: PresenceCapability, boundary: "disposable" | "protected", permitted: (current: WorkflowContext, grant: PresenceWorkflowGrant) => boolean) {
  if (capability.kind === "offline-test" && process.env.NODE_ENV === "production") throw Error("Fixture transport refused");
  const readGrant = capability.kind === "offline-test" ? capability.readGrant : () => privateWorkflowFile<PresenceWorkflowGrant>(workspace.grantFile, workspace.root);
  return {
    context,
    async open() {
      const [grant, current] = await Promise.all([readGrant(), context()]);
      if (!permitted(current, grant)) throw Error("Workflow source binding refused");
      const rates = capability.kind === "offline-test" ? capability.rates : (await privateWorkflowFile<{ rateCard: ResponsesRates }>(
        join(workspace.ledgerDirectory, "onboarding-usage.json"), workspace.root)).rateCard;
      if (rates.model !== "gpt-5.4-mini-2026-03-17" || rates.inputPerMillion !== 750_000 || rates.cachedPerMillion !== 75_000 ||
          rates.outputPerMillion !== 4_500_000 || rates.cacheWritePerMillion !== 0 || rates.countMicros !== 0) throw Error("Pinned workflow rates refused");
      async function noOutbound(): Promise<never> { throw new WorkflowBlocked("The worker owns provider dispatch"); }
      const isolatedCommercialWorker = boundary === "disposable" && capability.kind === "worker" && capability.resumeMarketResearch === true;
      const transport = capability.kind === "worker" ? responsesHttps(capability.apiKey, grant.expiresAt, grant.ledger.inputBytes + 48_000,
        isolatedCommercialWorker ? 150_000 : undefined)
        : capability.kind === "offline-test" ? capability.transport : { send: noOutbound };
      const mayFetch = capability.kind === "worker" || (boundary === "disposable" && capability.kind === "research-replay");
      const retainFetch=(live:typeof fetch)=>grant.originalMaterials?retainedResearchFetch(join(workspace.root,"originals"),live):live;
      const fetchPage = mayFetch ? retainFetch(pinnedResearchFetch(url => researchUrlAllowed(url, grant.researchSources, grant.discovery), grant.researchResponseBytes))
        : capability.kind === "offline-test" ? capability.fetchPage : noOutbound;
      const reportHold = isolatedCommercialWorker ? capability.reportHold : undefined;
      const originals = grant.originalMaterials;
      const recheckResearch = async () => {
        const [latestGrant, latestContext] = await Promise.all([readGrant(), context()]);
        if (latestGrant.revoked || fingerprint(latestGrant) !== fingerprint(grant) || latestGrant.contextDigest !== fingerprint(latestContext) ||
            Date.now() < (latestGrant.startsAt ?? 0) || Date.now() >= latestGrant.expiresAt) throw Error("Research material authority unavailable");
      };
      const delegatedCapture = boundary === "disposable" && capability.kind === "worker" ? capability.peerCapture : undefined;
      const renderPeer = delegatedCapture ? delegatedCapture.capture : originals?.publicResearch?.screenshots && (capability.kind === "worker" || capability.kind === "research-replay")
        ? async (source: { id: string; url: string; label: string }, html: Buffer) => {
          if (!process.env.MIOPAGES_RESEARCH_CHROMIUM) throw Error("Configured Core research browser is unavailable");
          const browser = await chromium.launch({ executablePath: process.env.MIOPAGES_RESEARCH_CHROMIUM, headless: true,
            chromiumSandbox: process.platform === "linux", args: ["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
          try {
            const resources = pinnedResearchFetch(url => url.protocol === "https:" && !url.username && !url.password &&
              !url.port && !url.hash && url.href.length <= 2000, grant.researchResponseBytes, true);
            return await capturePublicPeer(browser, source, html, resources, recheckResearch, originals.publicResearch!.maximumBytes);
          } finally { await browser.close(); }
        } : undefined;
      const researchOriginals = originals?.publicResearch && (capability.kind === "worker" || capability.kind === "research-replay")
        ? researchMaterialCustody(join(workspace.root, "originals"), originals, recheckResearch, renderPeer) : undefined;
      const operations = createResponsesPresenceWorkflow({ grant, readGrant, readContext: context, ledgerDirectory: workspace.ledgerDirectory, rates, transport, fetchPage, reportHold,
        resumeMarketResearch: isolatedCommercialWorker || (boundary === "disposable" && capability.kind === "research-replay"),
        marketResearchReplayOnly: capability.kind === "research-replay",
        researchOriginals,
        async verifyResearchAccess() {
          if (delegatedCapture) return delegatedCapture.verify();
          if (capability.kind !== "worker" || !process.env.MIOPAGES_RESEARCH_CHROMIUM) throw new WorkflowBlocked("Configured research browser required");
          await access(process.env.MIOPAGES_RESEARCH_CHROMIUM);
          const browser = await chromium.launch({ executablePath: process.env.MIOPAGES_RESEARCH_CHROMIUM, headless: true,
            chromiumSandbox: process.platform === "linux", args: ["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
          await browser.close();
        },
        ...(grant.originalMaterials && {
          ...(boundary==="disposable"&&current.evaluation&&{async readAvailableMedia(run:WorkflowRun){
            const file=join(workspace.root,"media/stock-selection.json");
            let supplied:{contextDigest:string;entries:{hit:{sourceId:string;sourceUrl:string;creator:string|null;representation:{url:string}};selection:unknown;sourceSha256:string;preparedSha256:string}[]};
            try{supplied=await privateWorkflowFile(file,workspace.root)}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return [];throw error}
            if(supplied.contextDigest!==fingerprint(run.context)||supplied.entries.length!==2||new Set(supplied.entries.map(item=>item.hit.sourceId)).size!==2)throw Error("Selected stock scope differs");
            const stock=run.context.evidence.find(source=>source.id==="stock-discovery");
            if(!stock||stock.kind!=="public-research")throw Error("Approved stock evidence missing");
            for(const item of supplied.entries){
              const selected=eligibleStock(item.selection);
              if(selected.sourceId!==item.hit.sourceId||selected.sourceUrl!==item.hit.sourceUrl||selected.representation.sourceDigest!==item.sourceSha256||!stock.content.includes(JSON.stringify(item.hit.sourceId))||!stock.content.includes(item.hit.representation.url))throw Error("Selected stock evidence differs");
              const bytes=await privateWorkflowBytes(join(workspace.root,"media",item.sourceSha256+".original"),workspace.root);
              if(createHash("sha256").update(bytes).digest("hex")!==item.sourceSha256)throw Error("Selected stock custody differs");
            }
            return reviewedStockForWorkflow(pool,workspace.root,run,supplied);
          }}),
          async readOriginalMaterials() {
            const root = join(workspace.root, "originals");
            await verifyDirectory(root);
            const manifest = await privateWorkflowFile<OriginalMaterial[]>(join(root, "index.json"), root);
            if (!Array.isArray(manifest)) throw Error("Original source index refused");
            return Promise.all(manifest.map(async source => {
              if (!/^[a-f0-9]{64}$/u.test(source.sha256) || !Number.isSafeInteger(source.bytes) ||
                  source.bytes < 1 || source.bytes > grant.originalMaterials!.requestBytes) throw Error("Original source envelope refused");
              const path = join(root, source.sha256 + ".source");
              const meta = await lstat(path);
              if (!meta.isFile() || meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o600 ||
                  meta.size !== source.bytes || await realpath(path) !== path) throw Error("Original source custody refused");
              return { source, bytes: await readFile(path) };
            }));
          },
          async retainRequest(run: WorkflowRun, bytes: Buffer) {
            const root = join(workspace.root, "originals");
            await verifyDirectory(root);
            if (!/^[a-f0-9-]{36}$/u.test(run.work.attempt)) throw Error("Request custody identity refused");
            const path = join(root, run.work.attempt + ".request.json");
            let output;
            try { output = await open(path, "wx", 0o600); }
            catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
              const meta = await lstat(path);
              if (!meta.isFile() || meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o600 ||
                  await realpath(path) !== path || !(await readFile(path)).equals(bytes)) throw Error("Retained request differs");
              return;
            }
            try { await output.writeFile(bytes); await output.sync(); } finally { await output.close(); }
          },
        }),
        recoverBlueprint: boundary === "disposable" && capability.kind === "blueprint-recovery" ? capability.repair : undefined,
        fetchMarketPages: sources => mayFetch
          ? retainFetch(pinnedResearchFetch(url => researchUrlAllowed(url, sources), grant.researchResponseBytes)) : fetchPage,
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
          if (latest.revoked || Date.now() < (latest.startsAt ?? 0) || Date.now() >= latest.expiresAt || fingerprint(latest) !== fingerprint(grant) ||
              fingerprint(await context()) !== grant.contextDigest) throw new WorkflowBlocked("Image authorization unavailable");
        };
        visuals = {
          requestable: !grant.revoked && Date.now() >= (grant.startsAt ?? 0) && Date.now() < grant.expiresAt,
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
              }, recheck, grant.retainedReservation, reportHold);
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
      return new PresenceWorkflow(pool, capability.kind === "review" ? { ...scoped, run: noOutbound } : scoped,
        boundary === "disposable" ? grant.previewActionDestinations ?? {} : {}, Date.now, boundary);
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
    } else if (["review-complete", "home-concept"].includes(previous.next) && previous.visuals?.some(visual => ["queued", "running", "unverified"].includes(visual.state))) {
      return workflow.advanceVisual(current, previous.version);
    } else return previous;
  }
  return previous;
}

export async function recoverRetainedPresenceOutput(workflow: PresenceWorkflow,
  current: Awaited<ReturnType<ReturnType<typeof composePresenceCase>["context"]>>, operation: "research" | "report" | "blueprint" | "page" | "editorial") {
  const review = await workflow.review(current);
  if (!review?.recoverable || review.pendingOperation !== operation) throw Error("Retained workflow recovery unavailable");
  return workflow.recover(current, review.version);
}

export async function reviewWorkflowChange(workflow: PresenceWorkflow,
  current: Awaited<ReturnType<ReturnType<typeof composePresenceCase>["context"]>>, operation: unknown, version: number, actor: WorkflowActor, details?: { finding?: unknown; correction?: unknown; visual?: unknown; editorial?: unknown; quality?: unknown }) {
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
    case "workflow-editorial-decision": return workflow.decideEditorialFinding(current, version, actor, details?.editorial);
    case "workflow-revise": return workflow.requestEditorialRevision(current, version, actor);
    case "workflow-commercial-replan": return workflow.requestCommercialReplan(current, version, actor);
    case "workflow-review": return workflow.reviewCandidate(current, version, actor);
    case "workflow-quality-review": return workflow.recordQualityReview(current, version, actor, details?.quality);
    case "workflow-visual-queue": {
      const input = details?.visual as { path?: unknown; index?: unknown; briefId?: unknown } | undefined;
      if (typeof input?.path !== "string" || typeof input.index !== "number") throw new IntakeError("invalid_request");
      return workflow.queueVisual(current, version, actor, input.path, input.index, input.briefId);
    }
    case "workflow-visual-decide": return workflow.decideVisual(current, version, actor, details?.visual);
    default: throw new IntakeError("invalid_request");
  }
}

export async function reviewedStockForWorkflow(pool:Pool,root:string,run:WorkflowRun,supplied:{entries:{hit:{sourceId:string}}[]}) {
            let reviewed:{contextDigest:string;schema:string;homeDigest:string;records:{target:SuppliedPlacement;assetId:string;lineage:SuppliedLineage;sourceId:string;image:{usageId:string;digest:string;width:number;height:number;alt:string}}[]}|undefined;
            try{reviewed=await privateWorkflowFile(join(root,"media/reviewed-stock-context.json"),root)}
            catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error}
            if(!reviewed)return {state:"downloaded-awaiting-contextual-permission-review",entries:supplied.entries};
            const home=run.input.pages.find(page=>page.path==="/");
            if(!home||reviewed.homeDigest!==fingerprint(home))return {state:"new-contextual-placement-review-required",entries:supplied.entries};
            if(reviewed.contextDigest!==fingerprint(run.context)||!/^canonical_test_[a-f0-9]{32}_intake$/.test(reviewed.schema)||reviewed.records.length!==2)throw Error("Private stock review scope differs");
            const db=await pool.connect();
            try{await db.query("BEGIN");await db.query("SELECT set_config('search_path',$1,true)",[reviewed.schema]);
              for(const record of reviewed.records){
                if(record.target.webPresenceId!==run.context.scope.webPresenceId||record.target.managedSiteId!==run.context.scope.managedSiteId||!supplied.entries.some(entry=>entry.hit.sourceId===record.sourceId))throw Error("Private stock placement differs");
                const asset=(await db.query("SELECT * FROM assets WHERE id=$1 AND web_presence_id=$2 AND status='active'",[record.assetId,record.target.webPresenceId])).rows[0];
                const usage=(await db.query("SELECT * FROM asset_usages WHERE id=$1",[record.image.usageId])).rows[0];
                if(!asset||usage?.asset_id!==asset.id||usage.entity_type!=="section"||usage.entity_id!==record.target.sectionId||usage.web_presence_id!==record.target.webPresenceId||usage.role!=="image")throw Error("Current stock usage differs");
                await approvedSuppliedEvidence(db,record.target,asset.id,record.lineage,{preparedDigest:record.image.digest,width:record.image.width,height:record.image.height,altText:record.image.alt});
                const bytes=await readManagedObject(join(root,"media/stock-managed"),record.target.webPresenceId,asset.source_reference);
                if(createHash("sha256").update(bytes).digest("hex")!==record.image.digest)throw Error("Reviewed stock bytes differ");
              }

            }finally{try{await db.query("ROLLBACK")}finally{db.release()}}
            return {state:"private-contextual-rights-and-usage-verified",publicUseApproved:false,entries:supplied.entries,
              reviewedPlacements:reviewed.records.map(record=>({sourceId:record.sourceId,placement:record.target,preparedDigest:record.image.digest,alt:record.image.alt,lineage:record.lineage}))};
}
