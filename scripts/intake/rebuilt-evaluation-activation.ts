/**
 * Activation for the first rebuilt-Core test case (2026-11-22). Plugs into the
 * existing evaluation worker the same way the Codex-era activations did, but with one
 * plain plan file and no pinned proposal, ledger continuation or worker certificate.
 * Reads the previous source-aware case's knowledge and originals read-only.
 */
import { lstat, readFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Pool } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";
import { compileRebuiltRun, rebuiltRunPlan, validateRebuiltRunPlan } from "../../lib/platform/intake/c0-rebuilt-run";
import { privateWorkflowFile, verifyDirectory } from "../../lib/platform/intake/protected-presence-workflow";
import type { WorkflowContext } from "../../lib/platform/intake/presence-workflow";
import type { PresenceWorkflowGrant } from "../../lib/platform/intake/presence-workflow-provider";
import type { OriginalMaterial } from "../../lib/platform/intake/presence-source-material";

async function privateBytes(file: string, root: string) {
  const meta = await lstat(file);
  if (!file.startsWith(root + "/") || !meta.isFile() || meta.uid !== process.getuid?.() || (meta.mode & 0o777) !== 0o600 ||
      await realpath(file) !== file) throw Error("Private custody refused");
  return readFile(file);
}

export async function openRebuiltActivation(parent: string, databaseUrl: string) {
  const plan = validateRebuiltRunPlan(rebuiltRunPlan);
  const priorRoot = join(parent, "presence-evaluation", plan.knowledgeFrom.intakeId);
  await verifyDirectory(priorRoot);
  const name = "migration_rehearsal_" + plan.destination.intakeId.replaceAll("-", "");
  async function checkDatabase(db: Pool) {
    const { rows: [row] } = await db.query("SELECT current_database() AS name, host(inet_server_addr()) AS host");
    if (row.name !== name || row.host !== "127.0.0.1") throw Error("Exact isolated new-case database required");
  }
  if (new URL(databaseUrl).pathname !== "/" + name) throw Error("Exact isolated new-case database required");
  return {
    item: { ...plan.destination, entry: "DIRECT_START" as const },
    previousLedger: undefined, reportHold: undefined, primary: plan.provider.ledgerRateCard, // Core's standard base rate card; stages meter at their own rates
    fingerprint: fingerprint({ run: "rebuilt-2026-11-22", plan }),
    async compile(_original: WorkflowContext) {
      void _original;
      const { context } = await privateWorkflowFile<{ context: WorkflowContext }>(join(priorRoot, "context.json"), priorRoot, 2_000_000);
      const grant = await privateWorkflowFile<PresenceWorkflowGrant>(join(priorRoot, "grant.json"), priorRoot, 2_000_000);
      const compiled = compileRebuiltRun({ context, grant });
      const originals = compiled.grant.originalMaterials!.records as readonly OriginalMaterial[];
      async function readOriginal(source: OriginalMaterial) {
        const bytes = await privateBytes(join(priorRoot, "originals", source.sha256 + ".source"), priorRoot);
        if (bytes.length !== source.bytes || createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw Error("Retained original bytes differ");
        return bytes;
      }
      return { ...compiled, originals, readOriginal };
    },
    async verifyGrant(db: Pool) { await checkDatabase(db); return "owner-approved-rebuilt-run"; },
    async bindReviewer(db: Pool) { await checkDatabase(db); return "owner-approved-rebuilt-run"; },
    async reviewer() { throw Error("Owner review happens on local WordPress for this test; no Core reviewer session is used"); },
  };
}
