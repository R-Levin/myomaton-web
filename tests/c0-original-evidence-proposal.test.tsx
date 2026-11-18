import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateWorkflowStagePlan, type WorkflowStagePlan } from "../lib/platform/intake/intelligent-responses";

test("proposed original-evidence stage budgets fit the new ceiling and preserve the prior debit", async () => {
  const p=JSON.parse(await readFile("docs/c0-original-evidence-run-proposal.json","utf8"));
  assert.equal(p.status,"PROPOSED_NOT_AUTHORIZED");
  assert.equal(p.authority.newProviderSpendingMicros+p.preserve.priorDebitMicros,p.authority.cumulativeAccountedCeilingMicros);
  assert.equal(p.preserve.baselineAttempts,54);
  assert.equal(p.authority.automaticRetries,0);
  const scope={id:"offline-proposal",startingLedger:p.preserve.priorLedgerSha256,baselineAttempts:54,
    requests:p.authority.maximumProviderRequests,generations:p.authority.maximumTextGenerations,capMicros:p.authority.newProviderSpendingMicros,
    inputTokens:p.provider.maxInputTokens,inputBytes:p.provider.inputBytes,
    breakdown:{text:p.authority.maximumTextGenerations,images:0,searchCalls:p.authority.maximumPaidWebSearchCalls}};
  validateWorkflowStagePlan(p.provider.stages as WorkflowStagePlan,scope,scope.breakdown.searchCalls);
  for (const source of p.originalMaterials.filter((row:{path:string})=>/^(docs|brand)\//.test(row.path))) {
    const bytes=await readFile(source.path);
    assert.equal(bytes.length,source.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),source.sha256);
  }
  assert.equal(p.originalMaterials.find((row:{id:string})=>row.id==="c0-retained-ten-answers").status,"unconfirmed");
  assert.deepEqual(p.stock.excludedIds,["384740","6389104","7642551"]);
});
