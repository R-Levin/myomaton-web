import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";
import { SourceAwareRunValidation, compileSourceAwareC0, readSourceAwareC0Plan, sourceAwareC0ProposalSha256, type SourceAwareC0Activation } from "../../lib/platform/intake/c0-source-aware-run";
import { privateWorkflowFile, verifyDirectory } from "../../lib/platform/intake/protected-presence-workflow";
import type { WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";
import type { OriginalMaterial } from "../../lib/platform/intake/presence-source-material";
import { ProtectedOperator } from "../../lib/platform/wordpress-delivery/operator";
import { draftBrand } from "../../lib/platform/wordpress-delivery/draft-brand";
import { focusMioPagesPreview } from "../customer-previews/miopages-focus";

export type SourceAwareRuntimeActivation = SourceAwareC0Activation & { reviewerVerifier: string };
type Activation = SourceAwareRuntimeActivation;
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sha256 = /^[a-f0-9]{64}$/u;

/** Pure gate shared by activation and offline refusal tests. A PASS marker alone
 * is insufficient: the retained proof must bind the exact reviewed artifact. */
export function verifySourceAwareRuntimeProof(activation: Activation, artifact: Buffer, proofBytes: Buffer,
  maximumHours: number, now = Date.now(), allowExpiredReview = false) {
  const proof = JSON.parse(proofBytes.toString("utf8"));
  if (hash(artifact) !== activation.artifactSha256 || hash(proofBytes) !== activation.linuxProofSha256 ||
      !sha256.test(activation.reviewerVerifier) || proof.status !== "PASS" ||
      proof.artifactSha256 !== activation.artifactSha256 || proof.proposalSha256 !== sourceAwareC0ProposalSha256 ||
      proof.failed !== 0 || !Number.isSafeInteger(proof.passed) || proof.passed < 1 || proof.providerCalls !== 0) {
    throw new SourceAwareRunValidation("activation", "Verified fresh-run artifact and Linux proof required");
  }
  const expiresAt = Math.min(activation.startsAt + maximumHours * 3_600_000, activation.reviewerCredentialExpiresAt);
  if (activation.proposalSha256 !== sourceAwareC0ProposalSha256 || activation.reviewerId !== "1a3febb6-5f06-448c-a9b5-77749af82d07" ||
      !Number.isSafeInteger(activation.approvalRecord) || activation.approvalRecord < 1 ||
      !Number.isSafeInteger(activation.startsAt) || !Number.isSafeInteger(activation.reviewerCredentialExpiresAt) ||
      maximumHours < 1 || maximumHours > 72 || activation.reviewerCredentialExpiresAt > activation.startsAt + maximumHours * 3_600_000 ||
      activation.startsAt > now || expiresAt <= activation.startsAt || !allowExpiredReview && expiresAt <= now) {
    throw new SourceAwareRunValidation("activation", "Fresh-run owner approval or expiry unavailable");
  }
  return expiresAt;
}

async function privateBytes(file: string, root: string) {
  const meta = await lstat(file);
  if (!file.startsWith(root + "/") || !meta.isFile() || meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o600 ||
      await realpath(file) !== file) throw new SourceAwareRunValidation("source-custody", "Fresh-run private custody refused");
  return readFile(file);
}

/** Protected adapter for the existing evaluation worker. No provider dispatch or
 * writes occur here. Activation/enrollment remains behind exact owner consent,
 * reviewed artifact/Linux evidence and the existing isolated database contract. */
export async function openSourceAwareActivation(parent: string, databaseUrl: string, allowExpiredReview: boolean) {
  const plan = readSourceAwareC0Plan(await readFile("docs/c0-source-aware-run-proposal.json"));
  const root = join(parent, "p0-source-aware-c0-runtime");
  await verifyDirectory(root);
  const activation = await privateWorkflowFile<Activation>(join(root, "activation.json"), root);
  const entry = await realpath(process.argv[1] ?? "");
  const artifact = await privateBytes(join(root, "worker.cjs"), root);
  const proofBytes = await privateBytes(join(root, "linux-verification.json"), root);
  if (entry !== join(root, "worker.cjs")) throw new SourceAwareRunValidation("activation", "Declared private worker entrypoint required");
  verifySourceAwareRuntimeProof(activation, artifact, proofBytes, plan.authority.maximumHoursAfterVerifiedActivation, Date.now(), allowExpiredReview);
  const oldRoot = join(parent, "presence-evaluation", plan.preserve.previousIntakeId);
  await verifyDirectory(oldRoot);
  const ledgerBytes = await privateBytes(join(oldRoot, "usage/onboarding-usage.json"), oldRoot);
  const oldGrantBytes = await privateBytes(join(oldRoot, "grant.json"), oldRoot);
  if (hash(ledgerBytes) !== plan.preserve.previousLedgerSha256 || hash(oldGrantBytes) !== plan.preserve.previousGrantSha256) {
    throw new SourceAwareRunValidation("source-custody", "Prior ledger or grant changed; no reset permitted");
  }
  const previousContext = (await privateWorkflowFile<{ context: WorkflowContext }>(join(oldRoot, "context.json"), oldRoot)).context;
  if (fingerprint(previousContext) !== plan.preserve.previousContextDigest) throw new SourceAwareRunValidation("source-custody", "Retained source context changed");
  const oldGrant = JSON.parse(oldGrantBytes.toString()) as PresenceWorkflowGrant;
  const sourceRoot = join(parent, "p0-original-evidence-c0-runtime", "sources");
  await verifyDirectory(sourceRoot);
  const originals = plan.sources.originalMaterials.map(source => ({
    id: source.id, sha256: source.sha256, bytes: source.bytes, mime: source.mime, reference: source.path,
    author: source.author, date: source.date, status: source.status, purpose: source.purpose, operations: source.operations,
  } as OriginalMaterial));
  async function readOriginal(source: OriginalMaterial) {
    const bytes = await privateBytes(join(sourceRoot, source.sha256 + ".source"), sourceRoot);
    if (bytes.length !== source.bytes || hash(bytes) !== source.sha256) throw new SourceAwareRunValidation("source-custody", "Retained original bytes differ");
    return bytes;
  }
  const material = await Promise.all(originals.map(async source => ({ source, bytes: await readOriginal(source) })));
  const brand = draftBrand({ scope: plan.destination.scope, visualDirection: focusMioPagesPreview.siteConfiguration.visualDirection,
    design: focusMioPagesPreview.designConfiguration, logo: { assetId: "cd7d9a9f-76a1-4615-957a-0ebaa8e6427d", usageId: "bf7fbc72-50ef-461f-974b-f4dbcc7a62df",
      sha256: originals.find(source => source.id === "c0-original-wordmark")!.sha256, alt: "MioPages" } });
  function checkDatabase(db: Pool | PoolClient) {
    return db.query("SELECT current_database() AS name,host(inet_server_addr()) AS host").then(({ rows: [row] }) => {
      if (row.name !== "migration_rehearsal_" + plan.destination.intakeId.replaceAll("-", "") || row.host !== "127.0.0.1") throw new SourceAwareRunValidation("database", "Exact isolated new-case database required");
    });
  }
  async function verifyGrant(db: Pool) {
    await checkDatabase(db);
    const { rows } = await db.query(`SELECT c.id,c.token_sha256,c.expires_at,g.id AS grant_id,g.permission
      FROM wordpress_operator_credentials c JOIN wordpress_operator_grants g ON c.id=g.operator_id
      WHERE g.web_presence_id=$1 AND g.managed_site_id=$2 AND g.revoked_at IS NULL AND c.revoked_at IS NULL`, Object.values(plan.destination.scope));
    if (rows.length !== 1 || rows[0].id !== activation.reviewerId || rows[0].permission !== plan.review.permission ||
        rows[0].token_sha256 !== activation.reviewerVerifier || rows[0].expires_at.getTime() !== activation.reviewerCredentialExpiresAt) throw new SourceAwareRunValidation("reviewer", "Exact isolated review-only grant required");
    return rows[0].grant_id as string;
  }
  return {
    item: { ...plan.destination, entry: "DIRECT_START" as const }, previousLedger: ledgerBytes, reportHold: undefined,
    primary: JSON.parse(ledgerBytes.toString()).rateCard,
    fingerprint: fingerprint({ proposal: sourceAwareC0ProposalSha256, approvalRecord: activation.approvalRecord, startsAt: activation.startsAt,
      reviewerId: activation.reviewerId, reviewerVerifier: activation.reviewerVerifier, reviewerExpiresAt: activation.reviewerCredentialExpiresAt }),
    async compile(_original: WorkflowContext) {
      void _original;
      const url = new URL(databaseUrl);
      if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || !url.password || Number(url.port) < 1024 || url.port === "5432" ||
          url.pathname !== "/migration_rehearsal_" + plan.destination.intakeId.replaceAll("-", "") || url.search || url.hash) throw new SourceAwareRunValidation("database", "Isolated source-connection binding refused");
      url.pathname = "/migration_rehearsal_" + plan.preserve.previousIntakeId.replaceAll("-", "");
      const source = new Pool({ connectionString: url.href, options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 5000 });
      try {
        const { rows: [event] } = await source.query("SELECT version,payload,digest FROM public.presence_workflow_events WHERE intake_id=$1 ORDER BY version DESC LIMIT 1", [plan.preserve.previousIntakeId]);
        if (event?.version !== plan.preserve.previousVersion || event.digest !== plan.preserve.previousEventDigest ||
            fingerprint(event.payload) !== event.digest || event.payload.contextDigest !== fingerprint(previousContext)) throw new SourceAwareRunValidation("source-custody", "Preserved source revision changed");
      } finally { await source.end(); }
      const compiled = compileSourceAwareC0(plan, activation, { context: previousContext, grant: oldGrant, ledger: ledgerBytes, materials: material, brandDigest: brand.digest });
      return { ...compiled, brand, originals, readOriginal };
    },
    verifyGrant,
    async bindReviewer(db: Pool) {
      await checkDatabase(db);
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(await readFile("lib/platform/wordpress-delivery/0016_wordpress_delivery.sql", "utf8"));
        await client.query(await readFile("lib/platform/wordpress-delivery/0017_private_stage_authority.sql", "utf8"));
        await client.query("INSERT INTO wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,$3)", [activation.reviewerId, activation.reviewerVerifier, new Date(activation.reviewerCredentialExpiresAt)]);
        await client.query("INSERT INTO wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), activation.reviewerId, plan.destination.scope.webPresenceId, plan.destination.scope.managedSiteId, plan.review.permission]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
      return verifyGrant(db);
    },
    async reviewer(db: Pool, token: unknown) {
      const grantId = await verifyGrant(db);
      const operator = new ProtectedOperator(db, checkDatabase);
      const actor = await operator.authorize(await operator.authenticate(token), "review-private-stage", plan.destination.scope);
      if (actor.operatorId !== activation.reviewerId || actor.authorityReference !== grantId) throw new SourceAwareRunValidation("reviewer", "Exact reviewer session required");
      return { id: actor.operatorId, role: "operator" as const, simulated: false, authority: actor.authorityReference };
    },
  };
}
