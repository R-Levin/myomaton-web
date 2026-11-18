import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import proposal from "../../docs/c0-commercial-authorization-proposal.json";
import { fingerprint, uuid } from "../../lib/platform/canonical/model";
import { commercialC0Inputs, prepareCommercialC0, readC0CommercialProposal } from "../../lib/platform/intake/c0-commercial-authorization";
import { privateWorkflowFile, verifyDirectory } from "../../lib/platform/intake/protected-presence-workflow";
import type { ReportReservation } from "../../lib/platform/intake/intelligent-responses";
import type { WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import { ProtectedOperator } from "../../lib/platform/wordpress-delivery/operator";
import { verifiedP022Runtime } from "./p022-evaluation-activation";
import {verifiedOriginalEvidenceRuntime} from "./original-evidence-activation";

export const commercialApproval = "79ab938feb2e2a33447d8328c4666988a51726a87a15d1009d3fd89503a8f924";
const sourceAmendment = "169178bb9a8f4a148f0cdb6307389df34a6cc0dee460097856fffc2b4ce2f1fe";
const innodbProof = "3f9787b162032ff3a4f13cfb5d776b77dc485afd9fd49974aecce2a8547c8e83";
const existingReviewerId = "1a3febb6-5f06-448c-a9b5-77749af82d07";
const existingCredentialExpiry = Date.parse("2026-11-19T16:03:51.397Z");
const directory = "p0-17-c0-runtime";
const sha256 = /^[a-f0-9]{64}$/u;

type Activation = {
  manifestSha256: string;
  sourceAmendmentSha256: string;
  artifactSha256: string;
  innodbProofSha256: string;
  reviewerAuthorizer: "same-owner-separate-permissions";
  reviewerId: string;
  reviewerVerifier: string;
  reviewerExpiresAt: number;
  startsAt: number;
};

export function commercialBinding(activation: Activation, artifact: string, now: number, allowExpiredReview: boolean) {
  const { startsAt, reviewerExpiresAt } = activation;
  if (activation.manifestSha256 !== commercialApproval || activation.sourceAmendmentSha256 !== sourceAmendment ||
      activation.artifactSha256 !== artifact || !sha256.test(artifact) || activation.innodbProofSha256 !== innodbProof ||
      activation.reviewerAuthorizer !== "same-owner-separate-permissions" || !sha256.test(activation.reviewerVerifier) ||
      activation.reviewerId !== existingReviewerId || reviewerExpiresAt !== existingCredentialExpiry || !Number.isSafeInteger(startsAt) || startsAt > now) {
    throw Error("Exact commercial activation scope refused");
  }
  const expiresAt = Math.min(reviewerExpiresAt, startsAt + proposal.approval.maximumHours * 3_600_000);
  if (expiresAt <= startsAt || (expiresAt <= now && !allowExpiredReview)) throw Error("Commercial activation window refused");
  return { manifestSha256: commercialApproval, sourceAmendmentSha256: sourceAmendment, artifactSha256: artifact,
    independentReviewerId: uuid(activation.reviewerId), startsAt, expiresAt };
}

export async function openCommercialActivation(parent: string, allowExpiredReview: boolean, p022 = false, originalEvidence = false) {
  const root = join(parent, directory);
  await verifyDirectory(root);
  const [activation, entry, planBytes] = await Promise.all([
    privateWorkflowFile<Activation>(join(root, "activation.json"), root),
    realpath(process.argv[1] ?? ""),
    readFile("docs/c0-commercial-authorization-proposal.json"),
  ]);
  const original = join(root, "worker.cjs");
  const artifact = createHash("sha256").update(await readFile(original)).digest("hex");
  if (!p022 && !originalEvidence && entry !== original) {
    if (entry !== join(root, "worker-p018.cjs")) throw Error("Protected commercial executable required");
    const continuation = await privateWorkflowFile<{ original: string; worker: string }>(join(root, "p018-executable.json"), root);
    if (continuation.original !== artifact || continuation.worker !== createHash("sha256").update(await readFile(entry)).digest("hex")) {
      throw Error("Exact approved continuation artifact required");
    }
  }
  const binding = commercialBinding(activation, artifact, Date.now(), allowExpiredReview);
  const upgraded = originalEvidence ? await verifiedOriginalEvidenceRuntime(parent,binding.independentReviewerId,activation.reviewerExpiresAt,allowExpiredReview)
    : p022 ? await verifiedP022Runtime(parent, binding.independentReviewerId, activation.reviewerExpiresAt, allowExpiredReview) : null;
  const reportHold = await privateWorkflowFile<ReportReservation>(join(root, "p018-report-hold.json"), root).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (reportHold && ![reportHold.receiptDigest, reportHold.originalWorkDigest, reportHold.replacementWorkDigest].every(value => sha256.test(value))) {
    throw Error("Exact report hold refused");
  }
  const plan = readC0CommercialProposal(planBytes, binding.manifestSha256);
  const { primary } = await commercialC0Inputs(plan);
  const scope = upgraded?.item.scope ?? plan.destination.scope;
  const intakeId = upgraded?.item.intakeId ?? plan.destination.intakeId;

  async function verifyGrant(pool: Pool) {
    const { rows } = await pool.query(`SELECT c.id,c.expires_at,c.token_sha256,g.id AS grant_id,g.permission
      FROM wordpress_operator_credentials c JOIN wordpress_operator_grants g ON g.operator_id=c.id
      WHERE g.web_presence_id=$1 AND g.managed_site_id=$2 AND g.revoked_at IS NULL AND c.revoked_at IS NULL`,
    [scope.webPresenceId, scope.managedSiteId]);
    if (rows.length !== 1 || rows[0].id !== binding.independentReviewerId || rows[0].permission !== "review-private-stage" ||
        rows[0].expires_at.getTime() !== activation.reviewerExpiresAt ||
        rows[0].token_sha256 !== activation.reviewerVerifier) throw Error("Exact review-only binding refused");
    return uuid(rows[0].grant_id);
  }

  return {
    item: upgraded?.item ?? { ...plan.destination, entry: "DIRECT_START" as const },
    reportHold: upgraded ? undefined : reportHold,
    primary: upgraded?.primary ?? primary,
    previousLedger: upgraded?.previousLedger,
    compile: upgraded?.compile ?? ((original: WorkflowContext) => prepareCommercialC0(plan, original, binding)),
    async bindReviewer(pool: Pool) {
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        await db.query(await readFile("lib/platform/wordpress-delivery/0016_wordpress_delivery.sql", "utf8"));
        await db.query(await readFile("lib/platform/wordpress-delivery/0017_private_stage_authority.sql", "utf8"));
        await db.query("INSERT INTO wordpress_operator_credentials(id,token_sha256,expires_at) VALUES($1,$2,$3)",
          [binding.independentReviewerId, activation.reviewerVerifier, new Date(activation.reviewerExpiresAt)]);
        await db.query(`INSERT INTO wordpress_operator_grants(id,operator_id,web_presence_id,managed_site_id,permission)
          VALUES($1,$2,$3,$4,'review-private-stage')`,
        [randomUUID(), binding.independentReviewerId, scope.webPresenceId, scope.managedSiteId]);
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally { db.release(); }
      return verifyGrant(pool);
    },
    fingerprint: upgraded?.fingerprint ?? fingerprint(binding),
    verifyGrant,
    async reviewer(pool: Pool, token: unknown) {
      const grantId = await verifyGrant(pool);
      const operator = new ProtectedOperator(pool, async db => {
        const { rows: [identity] } = await db.query("SELECT current_database() AS name,host(inet_server_addr()) AS host");
        if (identity.name !== "migration_rehearsal_" + intakeId.replaceAll("-", "") ||
            identity.host !== "127.0.0.1") throw Error("Isolated review connection required");
      });
      const actor = await operator.authorize(await operator.authenticate(token), "review-private-stage", scope);
      if (actor.operatorId !== binding.independentReviewerId || actor.authorityReference !== grantId) throw Error("Reviewer authority differs");
      return { id: actor.operatorId, role: "operator" as const, simulated: false, authority: actor.authorityReference };
    },
  };
}
