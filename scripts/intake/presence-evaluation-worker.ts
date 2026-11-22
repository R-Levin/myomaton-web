import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath, lstat } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";
import { validatePages } from "../../lib/platform/wordpress-delivery/authority";
import { composeHomeConcept } from "../../lib/platform/intake/presence-home-concept";
import { sectionVisual, workflowEvaluationPreviewInput, workflowLocalDraftInput } from "../../lib/platform/intake/presence-workflow-delivery";
import { bindFictionalEvaluation, bindOriginalEvaluation, evaluationGrant, readEvaluationManifest,
  type EvaluationManifest, type EvaluationScenario } from "../../lib/platform/intake/presence-evaluation-activation";
import { initializeResponsesUsageLedger } from "../../lib/platform/intake/intelligent-responses";
import { intakeVersion } from "../../lib/platform/intake/model";
import { composeIsolatedPresenceEvaluation, openProtectedPresenceWorkspace, privateWorkflowBytes, privateWorkflowFile,
  protectedWorkflowRole, verifyDirectory, workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import { IntakeService, resumeHash } from "../../lib/platform/intake/service";
import type { WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";
import { protectedConnection } from "../../lib/platform/wordpress-delivery/protected-connection";
import { migrateWithBootstrapCompatibility } from "../db/bootstrap";
import { commercialApproval, openCommercialActivation } from "./commercial-evaluation-activation";
import { repairP022Blueprint } from "./p022-evaluation-activation";
import { p022RunProposalSha256 } from "../../lib/platform/intake/c0-p022-source-pack";
import {originalEvidenceApproval} from "./original-evidence-activation";
import {sourceAwareC0ProposalSha256} from "../../lib/platform/intake/c0-source-aware-run";
import {openSourceAwareActivation} from "./source-aware-evaluation-activation";
import {prepareOriginalCustody} from "../../lib/platform/intake/presence-original-custody";
import {publicCaptureBridge} from "../../lib/platform/intake/presence-public-capture-bridge";
import { summarizePresenceWorkflowUsage } from "../../lib/platform/intake/intelligent-responses";

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const manifestFile = "docs/presence-evaluation-activation.json";
const retainedManifestSha256 = "82f78a03b7a523a9a16600a29ab21cfcae91eac87582a6ea17d465c4f2fdfc7a";
type Options = { scenario: EvaluationScenario; approval: string; databaseUrl: string; home: string };

async function createPrivate(path: string, bytes: string | Buffer) {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
}

async function readOriginal(plan: EvaluationManifest, connection: { url: string; ca: string }) {
  const { pool, workspace, intake, token } = await openProtectedPresenceWorkspace(false, connection);
  try {
    const [originalGrant, ledger] = await Promise.all([privateWorkflowFile<PresenceWorkflowGrant>(workspace.grantFile, workspace.root),
      privateWorkflowBytes(join(workspace.ledgerDirectory, "onboarding-usage.json"), workspace.root)]);
    if (originalGrant.contextDigest !== plan.original.contextDigest || fingerprint(originalGrant.approvedSources) !== plan.original.approvedProjectionDigest ||
        digest(ledger) !== plan.original.ledgerDigest || JSON.parse(ledger.toString("utf8")).attempts?.length !== plan.original.attempts) {
      throw Error("Hosted C0 grant or usage evidence differs");
    }
    const owned = await intake.workflowContext(token);
    if (owned.intakeId !== plan.original.intakeId || fingerprint(owned.scope) !== fingerprint(plan.original.scope)) {
      throw Error("Hosted C0 intake differs");
    }
    const db = await pool.connect();
    try {
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await protectedConnection(db, protectedWorkflowRole, "postgres");
      const { rows: [event] } = await db.query(`SELECT version, digest, payload FROM miopages_core_workflow.presence_workflow_events
        WHERE intake_id=$1 AND web_presence_id=$2 AND managed_site_id=$3 ORDER BY version DESC LIMIT 1`,
        [owned.intakeId, owned.scope.webPresenceId, owned.scope.managedSiteId]);
      if (event?.version !== plan.original.revision || event.digest !== plan.original.eventDigest) throw Error("Hosted C0 revision differs");
      return bindOriginalEvaluation(plan, event.payload);
    } finally { try { await db.query("ROLLBACK"); } finally { db.release(); } }
  } finally { await pool.end(); }
}

async function seedEvaluation(pool: Pool, item: Pick<EvaluationManifest["cases"][EvaluationScenario], "organizationId" | "scope" | "entry" | "intakeId">, token: string) {
  await migrateWithBootstrapCompatibility(pool);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(4117500)");
    const { rows: [existing] } = await db.query(`SELECT (SELECT count(*)::int FROM organizations) AS organizations,
      (SELECT count(*)::int FROM web_presences) AS presences, (SELECT count(*)::int FROM managed_sites) AS sites,
      (SELECT count(*)::int FROM prospect_intakes) AS intakes`);
    if (Object.values(existing).some(count => count !== 0)) throw Error("Expected a fresh dedicated evaluation database");
    const name = "MioPages private evaluation";
    await db.query("INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')", [item.organizationId, name]);
    await db.query("INSERT INTO web_presences(id,organization_id,name,status) VALUES($1,$2,$3,'active')", [item.scope.webPresenceId, item.organizationId, name]);
    await db.query("INSERT INTO managed_sites(id,web_presence_id,name,status) VALUES($1,$2,$3,'active')", [item.scope.managedSiteId, item.scope.webPresenceId, name]);
    await db.query(`INSERT INTO prospect_intakes(id,web_presence_id,managed_site_id,entry_intent,questionnaire_version,resume_hash,expires_at,resume_expires_at)
      VALUES($1,$2,$3,$4,$5,$6,now()+interval '30 days',now()+interval '30 days')`,
      [item.intakeId, item.scope.webPresenceId, item.scope.managedSiteId, item.entry, intakeVersion, resumeHash(token)]);
    await db.query(await readFile("lib/platform/intake/presence-workflow.sql", "utf8"));
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}

export async function openEvaluationWorker(options: Options, allowExpiredReview = false) {
  if (process.platform !== "linux" || process.env.NODE_ENV === "production") throw Error("Linux development worker required");
  const p022 = options.approval === p022RunProposalSha256;
  const originals = options.approval === originalEvidenceApproval;
  const fresh = options.approval === sourceAwareC0ProposalSha256;
  const isCommercial = options.approval === commercialApproval || p022 || originals || fresh;
  if (isCommercial && options.scenario !== "c0") throw Error("Commercial C0 scope required");
  const parent = join(await realpath(options.home), "miopages-private-acceptance");
  if (parent.includes("/public_html/")) throw Error("Off-webroot evaluation workspace required");
  await verifyDirectory(parent);
  const manifestBytes = await readFile(manifestFile);
  const plan = readEvaluationManifest(manifestBytes, isCommercial ? retainedManifestSha256 : options.approval,
    isCommercial || allowExpiredReview ? null : Date.now());
  const commercial = fresh ? await openSourceAwareActivation(parent, options.databaseUrl, allowExpiredReview) :
    isCommercial ? await openCommercialActivation(parent, allowExpiredReview, p022, originals) : null;
  const item = commercial?.item ?? plan.cases[options.scenario];
  const name = "migration_rehearsal_" + item.intakeId.replaceAll("-", "");
  const url = new URL(options.databaseUrl);
  const port = Number(url.port);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/" + name ||
      port < 1024 || port === 5432 || !url.username || !url.password || url.search || url.hash) throw Error("Dedicated loopback evaluation database required");
  const group = join(parent, "presence-evaluation");
  const root = join(group, item.intakeId);
  const workspace = { root, grantFile: join(root, "grant.json"), ledgerDirectory: join(root, "usage"), visualDirectory: join(root, "media") };
  const pool = new Pool({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  try {
    const { rows: [database] } = await pool.query("SELECT current_database() AS name, host(inet_server_addr()) AS host, inet_server_port() AS port, current_schema() AS schema");
    if (database.name !== name || database.host !== "127.0.0.1" || database.port !== port || database.schema !== "public") {
      throw Error("Evaluation connection identity differs");
    }
  } catch (error) { await pool.end(); throw error; }
  const intake = new IntakeService(pool, item.scope);
  const contextFile = join(root, "context.json");
  let peerCapture:ReturnType<typeof publicCaptureBridge>|undefined;
  async function openCase(apiKey?: string, researchReplay = false, recovery = false) {
    await verifyDirectory(group);
    try { await lstat(join(root,"source-evidence-repair.lock")); throw Error("Source evidence repair is in progress; retain state"); }
    catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error; }
    const storedGrant = await privateWorkflowFile<PresenceWorkflowGrant>(workspace.grantFile, root);
    const {context,token} = await privateWorkflowFile<{context:WorkflowContext;token:string}>(contextFile,root,
      storedGrant.originalMaterials?.requestBytes ?? 256_000);
    const commercialBinding = commercial ? await privateWorkflowFile<{ activation: string; grant: string }>(join(root, "activation.json"), root) : null;
    if (commercial && (commercialBinding?.activation !== commercial.fingerprint || commercialBinding?.grant !== fingerprint(storedGrant))) {
      throw Error("Stored commercial activation differs");
    }
    if (commercial && apiKey) await commercial.verifyGrant(pool);
    const compiled = commercial ? storedGrant : evaluationGrant(plan, options.approval, options.scenario, context);
    if (fingerprint(storedGrant) !== fingerprint(compiled) || !/^[0-9a-f]{64}$/u.test(token)) throw Error("Local evaluation grant or token differs");
    const bound = composeIsolatedPresenceEvaluation(pool, intake, token, context, workspace,
      p022 && recovery ? { kind: "blueprint-recovery", repair: repairP022Blueprint } :
        researchReplay && commercial ? { kind: "research-replay" } :
        apiKey === undefined ? { kind: "review" } : { kind: "worker", apiKey, resumeMarketResearch: Boolean(commercial), reportHold: commercial?.reportHold,
          ...((originals || fresh) && apiKey && process.env.MIOPAGES_PUBLIC_RESEARCH_BRIDGE==="1" && {peerCapture:peerCapture??=publicCaptureBridge(process.stdin,process.stdout)}) });
    return { context: await bound.context(), workflow: await bound.open(), root };
  }
  function protectedConfig() {
    return privateWorkflowFile<{ databaseUrl: string; ca: string; aiEnabled: boolean; apiKey: string }>(join(parent, "core-config.json"), parent);
  }
  return { stop: () => {peerCapture?.close();return pool.end()}, openCase, reviewer: commercial && ((token: unknown) => commercial.reviewer(pool, token)), async providerKey() {
    const config = await protectedConfig();
    if (!config.aiEnabled || !/^sk-[a-zA-Z0-9_-]{20,512}$/u.test(config.apiKey)) throw Error("Approved development provider credential required");
    return config.apiKey;
  }, async activate() {
    const end = Date.parse(plan.approval.expiresAt);
    const remaining = end - Date.now();
    if (!commercial && (remaining <= 0 || remaining > 72 * 3600_000)) throw Error("Evaluation approval window refused");
    const config = options.scenario === "c0" ? await protectedConfig() : undefined;
    const original = config ? await readOriginal(plan, { url: config.databaseUrl, ca: config.ca }) : bindFictionalEvaluation(plan);
    const prepared = commercial ? await commercial.compile(original) : null;
    const context = prepared?.context ?? original;
    const token = randomBytes(32).toString("hex");
    const grant = prepared?.grant ?? evaluationGrant(plan, options.approval, options.scenario, context);
    await mkdir(group, { mode: 0o700, recursive: true });
    await verifyDirectory(group);
    await mkdir(root, { mode: 0o700 });
    await mkdir(workspace.ledgerDirectory, { mode: 0o700 });
    await mkdir(workspace.visualDirectory, { mode: 0o700 });
    await createPrivate(contextFile, JSON.stringify({ context, token }) + "\n");
    await seedEvaluation(pool, item, token);
    if ((await intake.workflowContext(token)).intakeId !== item.intakeId) throw Error("Fresh evaluation intake differs");
    const reviewerGrant = await commercial?.bindReviewer(pool);
    if (commercial?.previousLedger) {
      await createPrivate(join(workspace.ledgerDirectory, "onboarding-usage.json"), commercial.previousLedger);
      const usage = await summarizePresenceWorkflowUsage(workspace.ledgerDirectory, grant.ledger, fingerprint(context.scope));
      if (usage.total.requests !== 0) throw Error("A fresh isolated metering suffix is required");
    } else await initializeResponsesUsageLedger(workspace.ledgerDirectory, commercial?.primary ?? plan.provider.rates);
    const bytes = await privateWorkflowBytes(join(workspace.ledgerDirectory, "onboarding-usage.json"), root);
    if (digest(bytes) !== grant.ledger.startingLedger) throw Error("Fresh evaluation ledger differs");
    await createPrivate(workspace.grantFile, JSON.stringify(grant) + "\n");
    if (prepared && "originals" in prepared && "readOriginal" in prepared && typeof prepared.readOriginal==="function" && grant.originalMaterials) {
      const directory=join(root,"originals");await mkdir(directory,{mode:0o700});
      await prepareOriginalCustody(directory,grant.originalMaterials,fingerprint(context),prepared.readOriginal as (source:import("../../lib/platform/intake/presence-source-material").OriginalMaterial)=>Promise<Buffer>);
    }
    if (commercial) await createPrivate(join(root, "activation.json"), JSON.stringify({
      activation: commercial.fingerprint, grant: fingerprint(grant),
    }) + "\n");
    return { intakeId: item.intakeId, scope: item.scope, ledger: grant.ledger.startingLedger, sources: grant.approvedSources.length,
      ...(commercial && { reviewerGrant, expiresAt: new Date(grant.expiresAt).toISOString() }) };
  } };
}

export async function evaluationCommand(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const [operation, scenario, approval, value, ...extra] = args;
  const localCommercial = approval === commercialApproval || approval === p022RunProposalSha256 || approval === originalEvidenceApproval || approval === sourceAwareC0ProposalSha256;
  const readOnly = ["inspect", "home", "site", "concept-review-input", "editorial-review-input"].includes(operation) || (["local-site", "local-home"].includes(operation) && localCommercial);
  const editing = ["continue", "review-home", "revise-home", "review-site", "revise-site", "decide-editorial", "retry", "resume-undispatched", "recover", "queue-image", "decide-image", "review-quality", "commercial-replan", "concept-review-input", "editorial-review-input", "critique-home", "critique-site", "repair-sources"].includes(operation) ||
    (["continue-local-home", "revise-local-page"].includes(operation) && localCommercial);
  const replaceReport = operation === "replace-report" && approval === commercialApproval;
  const researchReplay = operation === "replay-research";
  const completeResearch = (operation === "complete-research" || researchReplay) && approval === commercialApproval;
  if ((scenario !== "c0" && scenario !== "c2") || !approval || extra.length ||
      !(readOnly || editing || operation === "activate" || operation === "work" || operation === "preflight" || completeResearch || replaceReport) || (editing ? !value : Boolean(value))) {
    throw Error("Evaluation command refused");
  }
  const instance = await openEvaluationWorker({ scenario, approval, databaseUrl: env.MIOPAGES_EVALUATION_DATABASE_URL ?? "",
    home: env.HOME ?? "" }, readOnly);
  try {
    if (operation === "activate") return await instance.activate();
    const { workflow, context, root } = await instance.openCase(
      operation === "preflight" || operation === "work" || operation === "critique-home" || operation === "critique-site" || (operation==="recover" && (approval===originalEvidenceApproval || approval===sourceAwareC0ProposalSha256)) || replaceReport || (completeResearch && !researchReplay) ? await instance.providerKey() : undefined, researchReplay, operation === "recover");
    const prior = await workflow.review(context);
    if(operation==="preflight")return{version:await workflow.verifyResumeState(context),providerCalls:0,configurationVerified:true};
    if (completeResearch) {
      if (!prior) throw Error("Retained research required");
      const completed = await workflow.completeMarketResearch(context, prior.version);
      return { next: completed?.next, version: completed?.version, ...(completed?.failure && { failure: completed.failure }) };
    }
    if (replaceReport) {
      if (!prior) throw Error("Retained report claim required");
      const result = await workflow.replaceTimedOutReport(context, prior.version);
      return { next: result?.next, version: result?.version, ...(result?.failure && { failure: result.failure, artifact: result.artifactIssue }) };
    }
    if (operation === "work") {
      if (!prior) await workflow.start(context);
      const result = await workPresenceCase(workflow, context);
      return { next: result?.next, version: result?.version, ...(result?.canRenderForEditorial && { requiresRenderedReview: true }),
        ...(result?.failure && { failure: result.failure, artifact: result.artifactIssue }) };
    }
    if (operation === "inspect") {
      if (!prior) return { next: "ready" };
      const path = join(root, `review-${prior.version}.json`);
      await createPrivate(path, JSON.stringify(prior, null, 2) + "\n");
      return { next: prior.next, version: prior.version, file: path };
    }
    if (!prior) throw Error("Evaluation workflow is not started");
    if (["home", "site", "local-site", "local-home"].includes(operation)) {
      const localDraft = operation.startsWith("local-");
      const packetType = operation === "local-home" ? "home" : operation === "local-site" ? "site" : operation;
      const home = packetType === "home" ? composeHomeConcept(context, prior) : null;
      const publishImage = async (id: string, preparedDigest: string) => {
        const bytes = await (localDraft ? workflow.localDraftImage(context, prior.version, id) : workflow.visualImage(context, id));
        if (digest(bytes) !== preparedDigest) throw Error("Preview image bytes differ");
        const file = `${packetType}-${prior.version}-${id}.png`;
        await createPrivate(join(root, file), bytes);
        return file;
      };
      const pendingHome = localDraft ? prior.visuals?.find(item => item.state === "review" && item.briefId === "journey-diagram" &&
        item.result && item.placement.path === "/" && item.placement.sectionIndex === 0) : undefined;
      const pendingImage = async (sectionId: string) => {
        if (!pendingHome?.result) return [];
        const { width, height, masterDigest } = pendingHome.result;
        return [{ sectionId, width, height, digest: masterDigest, alt: "Illustration of the stages of a managed Web Presence",
          file: await publishImage(pendingHome.id, masterDigest), status: "pending-local-review" }];
      };
      let packet: object;
      if (home) {
        packet = { ...home, ...(home.image && { image: { ...home.image, file: await publishImage(home.image.id, home.image.digest) } }),
          ...(localDraft && { localDraftOnly: true, ...(pendingHome && { images: await pendingImage(home.candidate.pages[0].sections[0].id) }) }) };
      } else {
        const input = operation === "local-site" ? workflowLocalDraftInput(context, prior) : workflowEvaluationPreviewInput(context, prior, null, []);
        const editorial = (copy: { kind: string; text?: string } | undefined) => {
          if (copy?.kind !== "editorial" || typeof copy.text !== "string") throw Error("Expected reviewed editorial copy");
          return copy.text;
        };
        const pages = input.pages.map(page => ({ id: page.pageId, path: page.slug, title: editorial(page.title),
          composition: page.composition, navigationLabel: page.navigationLabel, sections: page.sections.map((section, index) => {
            const block = prior.pages.find(candidate => candidate.path === page.slug)?.sections[index].block;
            return { id: section.id, type: section.type, content: { heading: editorial(section.heading), text: editorial(section.text) },
              ...(localDraft && block && { block }), ...(localDraft && page.composition && sectionVisual(prior, page.slug, index)) };
          }) }));
        validatePages(pages, true, localDraft);
        const images = await Promise.all(input.pages.flatMap(page => page.sections.flatMap(section => section.image ? [async () => {
          const use = section.image!;
          const visual = prior.visuals?.find(item => item.association?.usageId === use.usageId && item.state === "approved");
          if (!visual?.result || visual.association?.assetId !== use.assetId || use.altText !== visual.decision?.alt) {
            throw Error("Exact approved preview image required");
          }
          const { width, height, masterDigest } = visual.result;
          return { sectionId: section.id, width, height, digest: masterDigest, alt: use.altText, file: await publishImage(visual.id, masterDigest) };
        }] : [])).map(prepare => prepare()));
        if (pendingHome) images.push(...await pendingImage(pages.find(page => page.path === "/")!.sections[0].id));
        const candidate = { pages, navigation: input.navigation, actions: input.actions };
        const unresolvedActions=operation==="local-site"&&"unresolvedActions" in input?input.unresolvedActions:undefined;
        const decisionTrace = localDraft && prior.blueprint?.strategyBasis ? {
          basis: prior.blueprint.strategyBasis,
          pages: prior.blueprint.pages.map(page => ({ path: page.path, findingIds: page.decisionBrief?.findingIds,
            directionSteps: page.decisionBrief?.directionSteps, claimIds: page.decisionBrief?.claimIds,
            influences: page.decisionBrief?.influences.map(({ sourceIds, use }) => ({ sourceIds, use })),
            sections: prior.pages.find(item => item.path === page.path)?.sections.map(section => ({
              sourceIds: section.sourceIds, ...(section.block && { semanticBlock: section.block.name }),
            })) })),
        } : undefined;
        packet = { candidate, images, ...(unresolvedActions&&{unresolvedActions}), ...(localDraft && { localDraftOnly: true }), ...(decisionTrace && { decisionTrace }),
          digest: fingerprint({ candidate, images, review: input.candidateDigest, ...(decisionTrace && { decisionTrace }) }) };
      }
      const path = join(root, `${packetType}-${prior.version}.json`);
      await createPrivate(path, JSON.stringify(packet, null, 2) + "\n");
      return { file: path, version: prior.version };
    }
    const input = JSON.parse(value) as { authorization?: string; version: number; digest?: string; reference?: string; concern?: string; path?: string; paths?: string[]; index?: number; brief?: string; decision?: unknown };
    if (input.version !== prior.version) throw Error("Evaluation view is stale");
    const actor = { id: "local-evaluation-operator", role: "operator" as const, simulated: false,
      authority: "private evaluation workspace " + approval };
    if (operation === "repair-sources") {
      const repaired = await workflow.reassessFromRepairedSources(context,prior.version,actor,input.authorization);
      return {next:repaired?.next,version:repaired?.version,providerCalls:0};
    }
    if (operation === "concept-review-input" || operation === "editorial-review-input") {
      const run = operation === "concept-review-input" ? await workflow.conceptCritiqueInput(context, prior.version, actor) :
        await workflow.editorialCritiqueInput(context, prior.version, actor);
      const file = join(root, "concept-review-input-" + run.work.inputDigest + ".json");
      const bytes = JSON.stringify(run) + "\n";
      try { await createPrivate(file, bytes); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const meta = await lstat(file);
        if (!meta.isFile() || meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o600 ||
            await realpath(file) !== file || !(await readFile(file)).equals(Buffer.from(bytes))) throw Error("Concept preparation custody conflict");
      }
      return { file, version: prior.version, inputDigest: run.work.inputDigest, target: run.work.reviewStage?.target ?? run.work.inputDigest, providerCalls: 0 };
    }
    if (operation === "review-quality") {
      if (!instance.reviewer) throw Error("Scoped commercial reviewer required");
      process.stdin.setEncoding("utf8");
      let token = "";
      for await (const chunk of process.stdin) {
        token += chunk;
        if (token.length > 66) throw Error("Operator authentication refused");
      }
      const reviewer = await instance.reviewer(token.trimEnd());
      const reviewed = await workflow.recordQualityReview(context, prior.version, reviewer, input.decision);
      return { next: reviewed?.next, version: reviewed?.version };
    }
    const result = operation === "critique-site" ? await workflow.critiqueSite(context, prior.version, actor)
      : operation === "critique-home" ? await workflow.critiqueHomeConcept(context, prior.version, actor)
      : operation === "continue" ? await workflow.confirmReport(context, prior.version, actor, true)
      : operation === "review-home" || operation === "continue-local-home" ?
        await workflow.reviewHomeConcept(context, prior.version, actor, input.digest, input.reference, operation === "continue-local-home")
      : operation === "revise-home" ? await workflow.reviseHomeConcept(context, prior.version, actor, input.digest, input.concern)
      : operation === "commercial-replan" ? await workflow.requestCommercialReplan(context, prior.version, actor)
      : operation === "review-site" ? await workflow.reviewCandidate(context, prior.version, actor)
      : operation === "revise-site" || operation === "revise-local-page" ?
        await workflow.requestEditorialRevision(context, prior.version, actor, operation === "revise-local-page" ? input.paths ?? input.path ?? "" : undefined)
      : operation === "decide-editorial" ? await workflow.decideEditorialFinding(context, prior.version, actor, input.decision)
      : operation === "recover" ? await workflow.recover(context, prior.version)
      : operation === "resume-undispatched" ? await workflow.resumeUndispatchedRequest(context,prior.version,actor)
      : operation === "retry" ? await workflow.retryRejectedOutput(context, prior.version, actor)
      : operation === "queue-image" ? await workflow.queueVisual(context, prior.version, actor, input.path ?? "", input.index ?? -1, input.brief)
      : await workflow.decideVisual(context, prior.version, actor, input.decision);
    return { next: result?.next, version: result?.version };
  } finally { await instance.stop(); }
}
