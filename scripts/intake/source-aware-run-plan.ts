import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { readSourceAwareC0Plan, sourceAwareC0ProposalSha256 } from "../../lib/platform/intake/c0-source-aware-run";

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "check") throw Error("Explicit proposal-only check required");
  const plan = readSourceAwareC0Plan(await readFile("docs/c0-source-aware-run-proposal.json"));
  const root = resolve(".");
  const publicSources = plan.sources.originalMaterials.filter(source => /^(docs|brand)\//u.test(source.path));
  for (const source of publicSources) {
    const file = resolve(source.path);
    if (!file.startsWith(root + sep)) throw Error("Public source path refused");
    const bytes = await readFile(file);
    if (bytes.length !== source.bytes || createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw Error("Reviewed public original source changed");
  }
  console.log(JSON.stringify({ status: "PASS", operation: "source-aware-c0-proposal-only",
    manifest: sourceAwareC0ProposalSha256, publicOriginalsVerified: publicSources.length,
    additionalCapMicros: plan.authority.additionalProviderCapMicros, generations: plan.authority.maximumTextGenerations,
    maximumHours: plan.authority.maximumHoursAfterVerifiedActivation, providerCalls: 0, activated: false,
    hostedLinuxAndPrivateCustody: "REQUIRE_CONSOLIDATED_AUTHORIZATION_AND_VERIFICATION" }));
}
main().catch(error => { console.error(JSON.stringify({ status: "BLOCKED", operation: "proposal-only", detail: error.message })); process.exitCode = 1; });
