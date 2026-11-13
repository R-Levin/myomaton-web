import { createPrivateKey } from "node:crypto";
import { object, uuid } from "../lib/platform/canonical/model";
import { prepareInterviewPages } from "../lib/platform/content-editing/prospect-proposal";
import { binding, hash, pageProposal, proposalScope } from "../lib/platform/content-editing/proposal";
import { operatorRole, protectedConnection, protectedPool } from "../lib/platform/wordpress-delivery/protected-connection";
import { protectedOperatorServices } from "../lib/platform/wordpress-delivery/protected-services";
import type { Enrollment } from "../lib/platform/wordpress-delivery/service";
import { NativeDraftReceiptJournal } from "../lib/platform/wordpress-delivery/native-draft-receipt";

async function main() {
  if (process.env.MIOPAGES_WP_PRIVATE_STAGE !== "enabled") throw Error("Protected stage disabled");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > 1_048_576) throw Error("Protected command too large");
    chunks.push(bytes);
  }
  const command = object(JSON.parse(Buffer.concat(chunks).toString("utf8")), ["token", "operation", "input"]);
  if (length > 65536 && command.operation !== "reconcile-site-draft") throw Error("Protected command too large");
  const pool = protectedPool(process.env.MIOPAGES_WP_OPERATOR_URL ?? "", operatorRole, process.env.MIOPAGES_WP_DATABASE_CA);
  try {
    const service = protectedOperatorServices(pool, db => protectedConnection(db, operatorRole), process.env.MIOPAGES_WP_CORE_ORIGIN ?? "");
    const context = await service.operator.authenticate(command.token);
    const proposals = service.proposals(context);
    let result: unknown;
    switch (command.operation) {
      case "review-interview-pages": {
        const p = object(command.input, ["packet", "digest", "destinations"]);
        const prepared = prepareInterviewPages(p.packet, p.digest, p.destinations);
        await service.operator.authorize(context, "prepare-site-proposal", proposalScope(prepared.scope));
        result = prepared;
        break;
      }
      case "prepare": {
        const p = object(command.input, ["scope", "proposalId", "requestId", "page", "expected"]);
        const event = await proposals.prepare(context, uuid(p.proposalId), proposalScope(p.scope), uuid(p.requestId),
          pageProposal(p.page), p.expected === undefined ? null : binding(p.expected));
        result = { binding: event.revision?.binding };
        break;
      }
      case "preview": {
        const p = object(command.input, ["binding", "requestId"]);
        result = await proposals.preview(context, binding(p.binding), uuid(p.requestId));
        break;
      }
      case "approve": {
        const event = await proposals.approve(context, command.input as Parameters<typeof proposals.approve>[1]);
        result = { approvalId: event.hash };
        break;
      }
      case "review":
        result = await service.review.review(context, command.input as Parameters<typeof service.review.review>[1]);
        break;
      case "preview-site-draft":
      case "authorize-site-draft":
      case "issue-site-draft":
      case "issue-site-draft-restore": {
        const issuing = command.operation === "issue-site-draft" || command.operation === "issue-site-draft-restore";
        const authorizing = command.operation !== "preview-site-draft";
        const input = object(command.input, ["site", "references", "draft", ...(authorizing ? ["reviewerToken", "expectedDigest", "recoveryCredentialId"] : [])]);
        const site = object(input.site, ["organizationId", "webPresenceId", "managedSiteId"]);
        if (!Array.isArray(input.references) || input.references.length < 1 || input.references.length > 16) {
          throw Error("Invalid draft page references");
        }
        const references = input.references.map(value => {
          const ref = object(value, ["proposalId", "approvalId"]);
          return { proposalId: uuid(ref.proposalId), approvalId: hash(ref.approvalId) };
        });
        const scope = { organizationId: uuid(site.organizationId),
          webPresenceId: uuid(site.webPresenceId), managedSiteId: uuid(site.managedSiteId) };
        if (authorizing) {
          const reviewer = await service.operator.authenticate(input.reviewerToken);
          const credentialId = input.recoveryCredentialId === undefined ? undefined : uuid(input.recoveryCredentialId);
          const hex = credentialId && process.env["MIOPAGES_WP_CREDENTIAL_" + credentialId.toUpperCase().replaceAll("-", "_")];
          if (credentialId && !/^[a-f0-9]{64}$/.test(hex ?? "")) throw Error("Native draft recovery credential unavailable");
          const secret = hex ? Buffer.from(hex, "hex") : undefined;
          const recovery = credentialId && secret ? { credentialId, secret,
            journal: new NativeDraftReceiptJournal(process.env.MIOPAGES_WP_NATIVE_DRAFT_RECEIPTS ?? "") } : undefined;
          try {
            result = issuing
              ? await service.review.issueSiteDraft(context, reviewer, scope, references, input.draft, input.expectedDigest,
                createPrivateKey(process.env.MIOPAGES_WP_SIGNING_KEY ?? ""),
                command.operation === "issue-site-draft-restore" ? "restore" : "apply", recovery)
              : await service.review.authorizeSiteDraft(context, reviewer, scope, references, input.draft, input.expectedDigest, recovery);
          } finally { secret?.fill(0); }
        } else result = await service.review.previewSiteDraft(context, scope, references, input.draft);
        break;
      }
      case "enroll":
        await service.delivery.enroll(context, command.input as Enrollment);
        result = { enrolled: true };
        break;
      case "reconcile-site-draft": {
        const p = object(command.input, ["site", "installationId", "envelope", "receipt"]);
        const site = object(p.site, ["organizationId", "webPresenceId", "managedSiteId"]);
        const decision = await service.review.nativeDraftReceiptDecision(context, {
          organizationId: uuid(site.organizationId), webPresenceId: uuid(site.webPresenceId), managedSiteId: uuid(site.managedSiteId),
        }, uuid(p.installationId), p.envelope);
        const key = process.env["MIOPAGES_WP_CREDENTIAL_" + decision.credentialId.toUpperCase().replaceAll("-", "_")] ?? "";
        if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Native draft receipt credential unavailable");
        const journal = new NativeDraftReceiptJournal(process.env.MIOPAGES_WP_NATIVE_DRAFT_RECEIPTS ?? "");
        result = await journal.record(decision.expected, Buffer.from(key, "hex"), p.receipt);
        break;
      }
      case "rotate": {
        const p = object(command.input, ["installationId", "expectedGeneration", "key"]);
        await service.delivery.rotate(context, uuid(p.installationId), p.expectedGeneration as number,
          p.key as Pick<Enrollment, "keyId" | "publicKeyBase64" | "credentialId">);
        result = { rotated: true };
        break;
      }
      case "revoke": {
        const p = object(command.input, ["installationId"]);
        await service.delivery.revoke(context, uuid(p.installationId));
        result = { revoked: true };
        break;
      }
      case "issue": {
        const p = object(command.input, ["installationId", "releaseId"]);
        result = await service.delivery.issue(context, uuid(p.installationId), uuid(p.releaseId),
          createPrivateKey(process.env.MIOPAGES_WP_SIGNING_KEY ?? ""));
        if (!result) throw Error("Private release issuance refused");
        break;
      }
      default: throw Error("Unsupported protected command");
    }
    console.log(JSON.stringify(result));
  } finally { await pool.end(); }
}

main().catch(() => { console.error("Protected command refused or failed. Verify state before retry."); process.exitCode = 1; });
