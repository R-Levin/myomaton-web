import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";
import { bindFictionalEvaluation, evaluationGrant, readEvaluationManifest } from "../../lib/platform/intake/presence-evaluation-activation";
import { disposableCluster } from "../../scripts/backup/disposable-cluster";
import { openEvaluationWorker } from "../../scripts/intake/presence-evaluation-worker";

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test("exact activation pins separate case budgets, permanent evidence and the operating window", async () => {
  const bytes = await readFile("docs/presence-evaluation-activation.json");
  const approved = digest(bytes);
  const historical = readEvaluationManifest(bytes, approved, null);
  const now = Date.parse(historical.approval.expiresAt) - 60_000;
  const plan = readEvaluationManifest(bytes, approved, now);
  const c2 = bindFictionalEvaluation(plan);
  const grant = evaluationGrant(plan, approved, "c2", c2);
  assert.equal(grant.ledger.capMicros + plan.cases.c0.budget.capMicros, 7_500_000);
  assert.deepEqual(grant.ledger.breakdown, { text: 15, images: 2, searchCalls: 3 });
  assert.equal(grant.ledger.baselineAttempts, 0);
  assert.equal(grant.approvedSources.length, 1);
  assert.notEqual(plan.original.intakeId, plan.cases.c0.intakeId);
  assert.equal(fingerprint(plan.original.sources), plan.original.approvedProjectionDigest);
  assert.throws(() => readEvaluationManifest(bytes, "0".repeat(64), now), /Exact reviewed/);
  const changed = Buffer.from(bytes.toString().replace("7500000", "7600000"));
  assert.throws(() => readEvaluationManifest(changed, digest(changed), now), /Exact reviewed/);
  assert.throws(() => readEvaluationManifest(bytes, approved, Date.parse(plan.approval.expiresAt)), /window/);
  assert.throws(() => readEvaluationManifest(bytes, approved, now - 72 * 3600_000), /window/);
  assert.throws(() => evaluationGrant(plan, approved, "c0", c2), /evidence and case/);
});

test("Linux worker activates one real case, reopens its private ledger and refuses foreign or unsafe custody", { skip: process.platform !== "linux" }, async () => {
  const bytes = await readFile("docs/presence-evaluation-activation.json");
  const approved = digest(bytes);
  const plan = readEvaluationManifest(bytes, approved, null);
  const previous = Date.now;
  const now = Date.parse(plan.approval.expiresAt) - 60_000;
  Date.now = () => now;
  const home = await realpath(await mkdtemp(join(tmpdir(), "miopages-eval-linux-")));
  const parent = join(home, "miopages-private-acceptance");
  try {
    await mkdir(parent, { mode: 0o700 });
    const cluster = await disposableCluster(process.env.PG_BIN_DIR ?? "/usr/lib/postgresql/17/bin", plan.cases.c2.intakeId);
    try {
      const options = { scenario: "c2" as const, approval: approved, databaseUrl: cluster.url, home };
      await assert.rejects(openEvaluationWorker({ ...options, scenario: "c0" }), /Dedicated loopback/);
      await assert.rejects(openEvaluationWorker({ ...options, databaseUrl: cluster.url.replace("127.0.0.1", "example.org") }), /Dedicated loopback/);
      const activation = await openEvaluationWorker(options);
      const scope = await activation.activate();
      await activation.stop();
      assert.equal(scope.intakeId, plan.cases.c2.intakeId);
      assert.equal(scope.sources, 1);
      const processTwo = await openEvaluationWorker(options);
      try {
        const { workflow, context, root } = await processTwo.openCase();
        assert.deepEqual(context, bindFictionalEvaluation(plan));
        const started = await workflow.start(context);
        assert.equal(started?.next, "research");
        assert.equal((await workflow.advance(context, started!.version))?.failure, "operation-blocked");
        const ledger = join(root, "usage", "onboarding-usage.json");
        assert.equal(digest(await readFile(ledger)), scope.ledger);
        const grant = join(root, "grant.json");
        await chmod(grant, 0o644);
        await assert.rejects(processTwo.openCase(), /Protected workflow file refused/);
        await chmod(grant, 0o600);
        const foreign = join(root, "other.json");
        await rename(grant, foreign);
        await symlink(foreign, grant);
        await assert.rejects(processTwo.openCase(), /Protected workflow file refused/);
        await unlink(grant);
        await rename(foreign, grant);
        await assert.rejects(processTwo.activate(), /EEXIST/);
        const database = new Pool({ connectionString: cluster.url });
        try {
          const rows = (await database.query("SELECT id FROM prospect_intakes")).rows;
          assert.deepEqual(rows, [{ id: plan.cases.c2.intakeId }]);
        } finally { await database.end(); }
      } finally { await processTwo.stop(); }
    } finally { await cluster.stop(); }
  } finally { Date.now = previous; await rm(home, { recursive: true }); }
});
