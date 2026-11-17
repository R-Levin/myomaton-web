import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";
import { validatePages } from "../../lib/platform/wordpress-delivery/authority";
import { composeHomeConcept } from "../../lib/platform/intake/presence-home-concept";
import { workflowDeliveryInput } from "../../lib/platform/intake/presence-workflow-delivery";
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

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const manifestFile = "docs/presence-evaluation-activation.json";
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

async function seedEvaluation(pool: Pool, item: EvaluationManifest["cases"][EvaluationScenario], token: string) {
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
  const plan = readEvaluationManifest(await readFile(manifestFile), options.approval, allowExpiredReview ? null : Date.now());
  const item = plan.cases[options.scenario];
  const name = "migration_rehearsal_" + item.intakeId.replaceAll("-", "");
  const url = new URL(options.databaseUrl);
  const port = Number(url.port);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/" + name ||
      port < 1024 || port === 5432 || !url.username || !url.password || url.search || url.hash) throw Error("Dedicated loopback evaluation database required");
  const parent = join(await realpath(options.home), "miopages-private-acceptance");
  if (parent.includes("/public_html/")) throw Error("Off-webroot evaluation workspace required");
  await verifyDirectory(parent);
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
  async function openCase(apiKey?: string) {
    await verifyDirectory(group);
    const [{ context, token }, storedGrant] = await Promise.all([
      privateWorkflowFile<{ context: WorkflowContext; token: string }>(contextFile, root),
      privateWorkflowFile<PresenceWorkflowGrant>(workspace.grantFile, root),
    ]);
    const compiled = evaluationGrant(plan, options.approval, options.scenario, context);
    if (fingerprint(storedGrant) !== fingerprint(compiled) || !/^[0-9a-f]{64}$/u.test(token)) throw Error("Local evaluation grant or token differs");
    const bound = composeIsolatedPresenceEvaluation(pool, intake, token, context, workspace,
      apiKey === undefined ? { kind: "review" } : { kind: "worker", apiKey });
    return { context: await bound.context(), workflow: await bound.open(), root };
  }
  function protectedConfig() {
    return privateWorkflowFile<{ databaseUrl: string; ca: string; aiEnabled: boolean; apiKey: string }>(join(parent, "core-config.json"), parent);
  }
  return { stop: () => pool.end(), openCase, async providerKey() {
    const config = await protectedConfig();
    if (!config.aiEnabled || !/^sk-[a-zA-Z0-9_-]{20,512}$/u.test(config.apiKey)) throw Error("Approved development provider credential required");
    return config.apiKey;
  }, async activate() {
    const end = Date.parse(plan.approval.expiresAt);
    const remaining = end - Date.now();
    if (remaining <= 0 || remaining > 72 * 3600_000) throw Error("Evaluation approval window refused");
    const config = options.scenario === "c0" ? await protectedConfig() : undefined;
    const context = config ? await readOriginal(plan, { url: config.databaseUrl, ca: config.ca }) : bindFictionalEvaluation(plan);
    const token = randomBytes(32).toString("hex");
    const grant = evaluationGrant(plan, options.approval, options.scenario, context);
    await mkdir(group, { mode: 0o700, recursive: true });
    await verifyDirectory(group);
    await mkdir(root, { mode: 0o700 });
    await mkdir(workspace.ledgerDirectory, { mode: 0o700 });
    await mkdir(workspace.visualDirectory, { mode: 0o700 });
    await createPrivate(contextFile, JSON.stringify({ context, token }) + "\n");
    await seedEvaluation(pool, item, token);
    if ((await intake.workflowContext(token)).intakeId !== item.intakeId) throw Error("Fresh evaluation intake differs");
    await initializeResponsesUsageLedger(workspace.ledgerDirectory, plan.provider.rates);
    const bytes = await privateWorkflowBytes(join(workspace.ledgerDirectory, "onboarding-usage.json"), root);
    if (digest(bytes) !== grant.ledger.startingLedger) throw Error("Fresh evaluation ledger differs");
    await createPrivate(workspace.grantFile, JSON.stringify(grant) + "\n");
    return { intakeId: item.intakeId, scope: item.scope, ledger: grant.ledger.startingLedger, sources: grant.approvedSources.length };
  } };
}

export async function evaluationCommand(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const [operation, scenario, approval, value, ...extra] = args;
  const readOnly = ["inspect", "home", "site"].includes(operation);
  const editing = ["continue", "review-home", "revise-home", "review-site", "revise-site", "decide-editorial", "retry", "recover", "queue-image", "decide-image"].includes(operation);
  if ((scenario !== "c0" && scenario !== "c2") || !approval || extra.length ||
      !(readOnly || editing || operation === "activate" || operation === "work") || (editing ? !value : Boolean(value))) {
    throw Error("Evaluation command refused");
  }
  const instance = await openEvaluationWorker({ scenario, approval, databaseUrl: env.MIOPAGES_EVALUATION_DATABASE_URL ?? "",
    home: env.HOME ?? "" }, readOnly);
  try {
    if (operation === "activate") return await instance.activate();
    const { workflow, context, root } = await instance.openCase(operation === "work" ? await instance.providerKey() : undefined);
    const prior = await workflow.review(context);
    if (operation === "work") {
      if (!prior) await workflow.start(context);
      const result = await workPresenceCase(workflow, context);
      return { next: result?.next, version: result?.version, ...(result?.failure && { failure: result.failure, artifact: result.artifactIssue }) };
    }
    if (operation === "inspect") {
      if (!prior) return { next: "ready" };
      const path = join(root, `review-${prior.version}.json`);
      await createPrivate(path, JSON.stringify(prior, null, 2) + "\n");
      return { next: prior.next, version: prior.version, file: path };
    }
    if (!prior) throw Error("Evaluation workflow is not started");
    if (operation === "home" || operation === "site") {
      const home = operation === "home" ? composeHomeConcept(context, prior) : null;
      const publishImage = async (id: string, preparedDigest: string) => {
        const bytes = await workflow.visualImage(context, id);
        if (digest(bytes) !== preparedDigest) throw Error("Preview image bytes differ");
        const file = `${operation}-${prior.version}-${id}.png`;
        await createPrivate(join(root, file), bytes);
        return file;
      };
      let packet: object;
      if (home) {
        packet = { ...home, ...(home.image && { image: { ...home.image, file: await publishImage(home.image.id, home.image.digest) } }) };
      } else {
        const input = workflowDeliveryInput(context, prior, null, []);
        const editorial = (copy: { kind: string; text?: string } | undefined) => {
          if (copy?.kind !== "editorial" || typeof copy.text !== "string") throw Error("Expected reviewed editorial copy");
          return copy.text;
        };
        const pages = input.pages.map(page => ({ id: page.pageId, path: page.slug, title: editorial(page.title),
          composition: page.composition, navigationLabel: page.navigationLabel, sections: page.sections.map(section =>
            ({ id: section.id, type: section.type, content: { heading: editorial(section.heading), text: editorial(section.text) } })) }));
        validatePages(pages, true);
        const images = await Promise.all(input.pages.flatMap(page => page.sections.flatMap(section => section.image ? [async () => {
          const use = section.image!;
          const visual = prior.visuals?.find(item => item.association?.usageId === use.usageId && item.state === "approved");
          if (!visual?.result || visual.association?.assetId !== use.assetId || use.altText !== visual.decision?.alt) {
            throw Error("Exact approved preview image required");
          }
          const { width, height, masterDigest } = visual.result;
          return { sectionId: section.id, width, height, digest: masterDigest, alt: use.altText, file: await publishImage(visual.id, masterDigest) };
        }] : [])).map(prepare => prepare()));
        const candidate = { pages, navigation: input.navigation, actions: input.actions };
        packet = { candidate, images, digest: fingerprint({ candidate, images, review: input.candidateDigest }) };
      }
      const path = join(root, `${operation}-${prior.version}.json`);
      await createPrivate(path, JSON.stringify(packet, null, 2) + "\n");
      return { file: path, version: prior.version };
    }
    const input = JSON.parse(value) as { version: number; digest?: string; reference?: string; concern?: string; path?: string; index?: number; brief?: string; decision?: unknown };
    if (input.version !== prior.version) throw Error("Evaluation view is stale");
    const actor = { id: "local-evaluation-operator", role: "operator" as const, simulated: false,
      authority: "private evaluation workspace " + approval };
    const result = operation === "continue" ? await workflow.confirmReport(context, prior.version, actor, true)
      : operation === "review-home" ? await workflow.reviewHomeConcept(context, prior.version, actor, input.digest, input.reference)
      : operation === "revise-home" ? await workflow.reviseHomeConcept(context, prior.version, actor, input.digest, input.concern)
      : operation === "review-site" ? await workflow.reviewCandidate(context, prior.version, actor)
      : operation === "revise-site" ? await workflow.requestEditorialRevision(context, prior.version, actor)
      : operation === "decide-editorial" ? await workflow.decideEditorialFinding(context, prior.version, actor, input.decision)
      : operation === "recover" ? await workflow.recover(context, prior.version)
      : operation === "retry" ? await workflow.retryRejectedOutput(context, prior.version, actor)
      : operation === "queue-image" ? await workflow.queueVisual(context, prior.version, actor, input.path ?? "", input.index ?? -1, input.brief)
      : await workflow.decideVisual(context, prior.version, actor, input.decision);
    return { next: result?.next, version: result?.version };
  } finally { await instance.stop(); }
}
