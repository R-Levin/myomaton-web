import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { sourceAwareC0ProposalSha256, SourceAwareRunValidation } from "../../lib/platform/intake/c0-source-aware-run";
import plan from "../../docs/c0-source-aware-run-proposal.json";
import { evaluationCommand } from "./presence-evaluation-worker";

const [operation, value, ...extra] = process.argv.slice(2);
const operations = ["activate", "work", "inspect", "continue", "local-home", "local-site", "concept-review-input", "editorial-review-input", "critique-home", "critique-site",
  "review-quality", "commercial-replan", "continue-local-home", "revise-home", "review-site", "revise-site", "revise-local-page", "decide-editorial", "recover", "retry", "resume-undispatched"];
let operationStage = "argument-validation";
async function main() {
  if (!operations.includes(operation) || extra.length) throw Error("Fixed fresh-run operation required");
  if (process.platform !== "linux" || process.env.NODE_ENV === "production") throw Error("Linux isolated development worker required");
  operationStage = "existing-db-credential-custody";
  const home = await realpath(process.env.HOME ?? "");
  const password = (await readFile(join(home, "miopages-private-acceptance/p0-22-c0-runtime/db/password"), "utf8")).trim();
  if (!/^[a-f0-9]{64}$/u.test(password)) throw Error("Existing isolated database credential unavailable");
  const url = new URL("postgresql://postgres@127.0.0.1:36339/migration_rehearsal_" + plan.destination.intakeId.replaceAll("-", ""));
  url.password = password;
  operationStage = "evaluation-operation";
  const result = await evaluationCommand([operation, "c0", sourceAwareC0ProposalSha256, ...(value ? [value] : [])],
    { ...process.env, MIOPAGES_EVALUATION_DATABASE_URL: url.href });
  const failed = result && typeof result === "object" && "failure" in result && result.failure;
  console.log(JSON.stringify({ miopagesRunResult: 1, status: failed ? "BLOCKED" : "PASS", operation, result }));
  if (failed) process.exitCode = 1;
}
main().catch((error: Error & { code?: string }) => {
  const known = error instanceof SourceAwareRunValidation;
  const rendered = ["Required rendered review is unavailable or not authorized for this operation",
    "Required original source is unavailable", "Rendered review input changed",
    "Rendered review index binding changed", "Complete matching desktop and mobile Page review required"].includes(error.message);
  console.error(JSON.stringify({ miopagesRunResult: 1, status: "BLOCKED", operation: operations.includes(operation) ? operation : "unrecognized",
    stage: known ? error.stage : rendered ? "rendered-review-preflight" : operationStage,
    category: error.code && /^[A-Z0-9_]+$/u.test(error.code) ? error.code : rendered ? "RENDERED_EVIDENCE_NOT_READY" : "FRESH_RUN_VALIDATION_FAILED",
    detail: known || rendered ? error.message : "Stop and retain private activation, source and usage evidence; inspect this stage. No automatic retry." }));
  process.exitCode = 1;
});
