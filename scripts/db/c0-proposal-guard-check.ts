import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

export const legacyProposalGuardSha256 = "8d3f2dc8666ddf9a3d41087982e4556745fa4475e117b652cf5d8cacc71fa91c";
export const correctedProposalGuardSha256 = "2e1c3df2dfd9fbf0ddc4db184e81ba649f7655d0beb03f6c1b01f72a6b603a97";
export const sqlSha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export async function proposalGuardState(db: Pick<PoolClient, "query">) {
  const { rows } = await db.query(`SELECT pg_get_functiondef(p.oid) AS definition,
    to_jsonb(p)-'prosrc' AS function_metadata,
    to_jsonb(t) AS trigger_metadata
    FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid
    WHERE p.oid='public.site_proposal_revision_guard()'::regprocedure
      AND t.tgrelid='public.site_change_revisions'::regclass
      AND t.tgname='site_proposal_revision_guard' AND NOT t.tgisinternal`);
  if (rows.length !== 1) throw Error("Exact proposal guard required");
  const { definition, function_metadata: fn, trigger_metadata: trigger } = rows[0];
  return { definition, sha256: sqlSha256(definition), fn, trigger };
}

export async function assertC0ProposalGuard(db: Pick<PoolClient, "query">) {
  const guard = await proposalGuardState(db);
  if (guard.sha256 !== correctedProposalGuardSha256 || guard.fn.prosecdef || guard.fn.proconfig !== null ||
      guard.trigger.tgenabled !== "O") {
    throw Object.assign(new Error("Installed proposal guard is incompatible with this reviewed workflow"),
      { code: guard.sha256 === legacyProposalGuardSha256 ? "C0_PROPOSAL_GUARD_0013" : "C0_PROPOSAL_GUARD_UNVERIFIED" });
  }
}
