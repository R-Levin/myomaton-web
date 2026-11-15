import { setTimeout } from "node:timers/promises";
import { join } from "node:path";
import { open } from "node:fs/promises";
import { fingerprint } from "../../lib/platform/canonical/model";
import { IntakeService, type IntakeEvidence } from "../../lib/platform/intake/service";
import { c0DisclosureManifest } from "../../lib/platform/intake/c0-workflow-knowledge";
import { c0ActivationGrant } from "../../lib/platform/intake/c0-workflow-activation";
import { adaptiveOnboardingVersion, type PreparedUnderstanding } from "../../lib/platform/intake/adaptive";
import { normalizeAnswers } from "../../lib/platform/intake/model";
import { protectedOwnerScope } from "../../lib/platform/intake/protected-owner";
import { protectedConnection, protectedPool } from "../../lib/platform/wordpress-delivery/protected-connection";
import { composePresenceCase, privateWorkflowBytes, privateWorkflowFile, protectedWorkflowRole, protectedWorkflowWorkspace, recoverPresenceResearch, workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";

type Input = { webPresenceId: string; managedSiteId: string; draftToken: string; answers: unknown;
  provenance: Record<string, IntakeEvidence>; prepared: PreparedUnderstanding; step: number };

async function main() {
  const action = process.argv[2];
  const activating = action === "ACTIVATE-EXACT-WORKFLOW-GRANT";
  const recoverResearch = action === "RECOVER-RETAINED-WORKFLOW-RESEARCH";
  if (process.argv.length !== (activating ? 4 : 3) ||
      !["ACTIVATE-EXACT-WORKFLOW-GRANT", "INSPECT-WORKFLOW-MANIFEST", "WATCH-AUTHORIZED-WORKFLOW", "RECOVER-RETAINED-WORKFLOW-RESEARCH"].includes(action)) throw Error("Workflow command refused");
  const workspace = await protectedWorkflowWorkspace();
  const input = await privateWorkflowFile<Input>(join(workspace.root, "core-input.json"), workspace.root);
  const selection = { webPresenceId: input.webPresenceId, managedSiteId: input.managedSiteId };
  if (fingerprint(selection) !== fingerprint(protectedOwnerScope) || input.step !== 3 || input.prepared.scenario !== "c0" ||
      !/^[0-9a-f]{64}$/u.test(input.draftToken)) throw Error("Protected C0 binding refused");
  const answers = normalizeAnswers(input.answers, adaptiveOnboardingVersion);
  if (fingerprint(answers) !== fingerprint(input.answers) ||
      Object.keys(answers).some(key => input.provenance[key]?.confirmation !== "unconfirmed")) throw Error("Protected C0 intake evidence refused");
  const ca = process.env.MIOPAGES_WP_DATABASE_CA;
  if (!ca) throw Error("Pinned CA required");
  const pool = protectedPool(process.env.MIOPAGES_PROTECTED_CORE_DB_URL ?? "", protectedWorkflowRole, ca);
  try {
    const intake = new IntakeService(pool, selection, { database: "postgres", answers, provenance: input.provenance, prepared: input.prepared, step: input.step,
      async protectedScope(db) {
        await protectedConnection(db, protectedWorkflowRole, "postgres");
        const result = await db.query("SELECT 1 FROM miopages_wp.core_development_scope WHERE web_presence_id=$1 AND managed_site_id=$2",
          [selection.webPresenceId, selection.managedSiteId]);
        if (result.rowCount !== 1) throw Error("Protected C0 scope refused");
      },
    });
    const mode = action !== "WATCH-AUTHORIZED-WORKFLOW" && !recoverResearch ? { kind: "review" as const } :
      { kind: "worker" as const, apiKey: process.env.MIOPAGES_OPENAI_DEV_API_KEY ?? "" };
    const workflowCase = composePresenceCase(pool, intake, input.draftToken, workspace, mode);
    if (mode.kind === "review") {
      const context = await workflowCase.context();
      if (!activating) {
        console.log(JSON.stringify(c0DisclosureManifest(context)));
        return;
      }
      const { rows } = await pool.query("SELECT intake_id FROM miopages_core_workflow.authorized_intake");
      if (rows.length !== 1 || rows[0].intake_id !== context.intakeId) throw Error("Protected workflow policy refused");
      const plan = await privateWorkflowBytes(join(workspace.root, "c0-protected-workflow-authorization.json"), workspace.root);
      const ledger = await privateWorkflowBytes(join(workspace.ledgerDirectory, "onboarding-usage.json"), workspace.root);
      if (process.argv[3] === "f7cf560dfdb8f16e809dc0ba535c5d86520a28654953c28b14c84558bab00545") {
        throw Error("The 24-hour C0 launch manifest was superseded");
      }
      const grant = c0ActivationGrant(context, plan, process.argv[3], ledger);
      const file = await open(workspace.grantFile, "wx", 0o600);
      try { await file.writeFile(JSON.stringify(grant) + "\n"); await file.sync(); } finally { await file.close(); }
      console.log(JSON.stringify({ status: "PASS", operation: "activate-workflow-grant", expiresAt: new Date(grant.expiresAt).toISOString() }));
      return;
    }
    const grant = await privateWorkflowFile<PresenceWorkflowGrant>(workspace.grantFile, workspace.root);
    const workflow = await workflowCase.open();
    if (recoverResearch) {
      const review = await recoverPresenceResearch(workflow, await workflowCase.context());
      console.log(JSON.stringify({ status: review?.next, version: review?.version, failure: review?.failure }));
      if (review?.failure) process.exitCode = 1;
      return;
    }
    let lastVersion = 0;
    while (Date.now() < grant.expiresAt) {
      const review = await workPresenceCase(workflow, await workflowCase.context());
      if (review && review.version !== lastVersion) {
        lastVersion = review.version;
        console.log(JSON.stringify({ status: review.next, version: review.version, failure: review.failure }));
      }
      if (review?.failure || review?.next === "evidence-changed" || review?.next === "review-complete") return;
      await setTimeout(2_000);
    }
  } finally { await pool.end(); }
}
main().catch(() => {
  console.error(JSON.stringify({ status: "BLOCKED", operation: "protected-workflow", detail: "Check the protected case, grant, role and retained outcome." }));
  process.exitCode = 1;
});
