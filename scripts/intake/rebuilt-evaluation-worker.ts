/**
 * Server entry for the first rebuilt-Core test case. Same operations as the earlier
 * evaluation workers, plus prepare-database to create the case's own database once.
 * Run from ~/public_html with NODE_ENV=development (see presence-research-controller).
 */
import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { rebuiltRunApproval, rebuiltRunPlan } from "../../lib/platform/intake/c0-rebuilt-run";
import { evaluationCommand } from "./presence-evaluation-worker";

const [operation, value, ...extra] = process.argv.slice(2);
const operations = ["prepare-database", "activate", "preflight", "work", "inspect", "continue", "local-site", "editorial-review-input",
  "critique-site", "commercial-replan", "revise-site", "revise-local-page", "decide-editorial", "recover", "retry", "resume-undispatched",
  // Review drafts to Operator WordPress and read-back (owner decisions, Nov 22).
  "deliver-review", "read-back"];

async function main() {
  if (!operations.includes(operation) || extra.length) throw Error("Fixed rebuilt-run operation required");
  if (process.platform !== "linux" || process.env.NODE_ENV === "production") throw Error("Linux isolated development worker required");
  const home = await realpath(process.env.HOME ?? "");
  const password = (await readFile(join(home, "miopages-private-acceptance/p0-22-c0-runtime/db/password"), "utf8")).trim();
  if (!/^[a-f0-9]{64}$/u.test(password)) throw Error("Isolated database credential unavailable");
  const name = "migration_rehearsal_" + rebuiltRunPlan.destination.intakeId.replaceAll("-", "");
  const url = new URL("postgresql://postgres@127.0.0.1:36339/" + name);
  url.password = password;
  if (operation === "prepare-database") {
    const admin = new URL(url.href); admin.pathname = "/postgres";
    const pool = new Pool({ connectionString: admin.href, connectionTimeoutMillis: 5000 });
    try {
      const { rows } = await pool.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]);
      if (!rows.length) await pool.query(`CREATE DATABASE ${name}`); // name is a fixed UUID-derived identifier
      return { miopagesRunResult: 1, status: "PASS", operation, result: { database: name, created: !rows.length } };
    } finally { await pool.end(); }
  }
  const result = await evaluationCommand([operation, "c0", rebuiltRunApproval, ...(value ? [value] : [])],
    { ...process.env, MIOPAGES_EVALUATION_DATABASE_URL: url.href });
  const failed = result && typeof result === "object" && "failure" in result && result.failure;
  if (failed) process.exitCode = 1;
  return { miopagesRunResult: 1, status: failed ? "BLOCKED" : "PASS", operation, result };
}

main().then(output => console.log(JSON.stringify(output))).catch((error: Error) => {
  // Only fixed, non-sensitive text leaves the server; details stay in retained evidence.
  const safe = /^[A-Za-z0-9 ,.;:'()/-]{1,200}$/u.test(error.message) && !/postgres|password|sk-/iu.test(error.message);
  console.error(JSON.stringify({ miopagesRunResult: 1, status: "BLOCKED", operation, detail: safe ? error.message : "Inspect retained evidence on the server" }));
  process.exitCode = 1;
});
