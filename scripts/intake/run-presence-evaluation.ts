import { evaluationCommand } from "./presence-evaluation-worker";

evaluationCommand(process.argv.slice(2)).then(result => {
  const failed = "failure" in result && Boolean(result.failure);
  console.log(JSON.stringify({ status: failed ? "BLOCKED" : "PASS", ...result }));
  if (failed) process.exitCode = 1;
}).catch(() => {
  console.error(JSON.stringify({ status: "BLOCKED", detail: "Check the exact evaluation approval, Linux private workspace, intake binding or pending workflow decision." }));
  process.exitCode = 1;
});
