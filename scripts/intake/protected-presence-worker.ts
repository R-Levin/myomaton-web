import { setTimeout } from "node:timers/promises";
import { join } from "node:path";
import { open } from "node:fs/promises";
import { c0DisclosureManifest } from "../../lib/platform/intake/c0-workflow-knowledge";
import { c0HostedRunGrant } from "../../lib/platform/intake/c0-workflow-activation";
import { composePresenceCase, openProtectedPresenceWorkspace, privateWorkflowBytes, privateWorkflowFile, recoverRetainedPresenceOutput, workPresenceCase } from "../../lib/platform/intake/protected-presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";

async function main() {
  const action = process.argv[2];
  const activating = action === "ACTIVATE-EXACT-WORKFLOW-GRANT";
  const inspecting = action === "INSPECT-WORKFLOW-MANIFEST";
  const recoverResearch = action === "RECOVER-RETAINED-WORKFLOW-RESEARCH";
  const recoverReport = action === "RECOVER-RETAINED-WORKFLOW-REPORT";
  const recoverBlueprint = action === "RECOVER-RETAINED-WORKFLOW-BLUEPRINT";
  const recoverFromCustody = recoverReport || recoverBlueprint;
  if (process.argv.length !== (activating ? 4 : 3) ||
      !(activating || inspecting || recoverResearch || recoverFromCustody || action === "WATCH-AUTHORIZED-WORKFLOW")) throw Error("Workflow command refused");
  const { workspace, pool, intake, token } = await openProtectedPresenceWorkspace();
  try {
    const mode = activating || inspecting || recoverFromCustody ? { kind: "review" as const } :
      { kind: "worker" as const, apiKey: process.env.MIOPAGES_OPENAI_DEV_API_KEY ?? "" };
    const workflowCase = composePresenceCase(pool, intake, token, workspace, mode);
    if (activating || inspecting) {
      const context = await workflowCase.context();
      if (!activating) {
        console.log(JSON.stringify(c0DisclosureManifest(context)));
        return;
      }
      const { rows } = await pool.query("SELECT intake_id FROM miopages_core_workflow.authorized_intake");
      if (rows.length !== 1 || rows[0].intake_id !== context.intakeId) throw Error("Protected workflow policy refused");
      const plan = await privateWorkflowBytes(join(workspace.root, "c0-hosted-presence-run.json"), workspace.root);
      const ledger = await privateWorkflowBytes(join(workspace.ledgerDirectory, "onboarding-usage.json"), workspace.root);
      if (process.argv[3] === "f7cf560dfdb8f16e809dc0ba535c5d86520a28654953c28b14c84558bab00545") {
        throw Error("The 24-hour C0 launch manifest was superseded");
      }
      const grant = c0HostedRunGrant(context, plan, process.argv[3], ledger);
      const file = await open(workspace.grantFile, "wx", 0o600);
      try { await file.writeFile(JSON.stringify(grant) + "\n"); await file.sync(); } finally { await file.close(); }
      console.log(JSON.stringify({ status: "PASS", operation: "activate-workflow-grant", expiresAt: new Date(grant.expiresAt).toISOString() }));
      return;
    }
    const grant = await privateWorkflowFile<PresenceWorkflowGrant>(workspace.grantFile, workspace.root);
    const workflow = await workflowCase.open();
    if (recoverResearch || recoverFromCustody) {
      const operation = recoverResearch ? "research" : recoverBlueprint ? "blueprint" : "report";
      const review = await recoverRetainedPresenceOutput(workflow, await workflowCase.context(), operation);
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
      if (review?.failure || review?.next === "evidence-changed" ||
          (review?.next === "review-complete" && (!grant.images || review.visuals?.some(visual => visual.state === "unverified")))) return;
      await setTimeout(2_000);
    }
  } finally { await pool.end(); }
}
main().catch(() => {
  console.error(JSON.stringify({ status: "BLOCKED", operation: "protected-workflow", detail: "Check the protected case, grant, role and retained outcome." }));
  process.exitCode = 1;
});
