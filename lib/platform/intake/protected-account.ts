import type { Pool, PoolClient } from "pg";
import type { ProtectedOperator } from "../wordpress-delivery/operator";
import type { PresenceWorkflowOperations } from "./presence-workflow";
import { protectedOwnerId, protectedOwnerScope } from "./protected-owner";
import { fingerprint } from "../canonical/model";
import { protectedConnection } from "../wordpress-delivery/protected-connection";
import type { OnboardingOwner } from "../canonical/writes";
import { AccountPeople } from "../accounts/people";

export const protectedAccountFoundation = Object.freeze({
  caseId: "e3e75949-f2af-4d58-9b31-d91e43862b4f", organizationId: "b3b46645-0364-4329-83c7-86a6ea9e56c4",
  ...protectedOwnerScope,
});

/** Only enabled by the reviewed deployment. Missing SQL/capability fails closed;
 * no new credentials, activation or synthetic customer proof is manufactured. */
export async function protectedAccountBoundary(db: Pick<PoolClient,"query">, foundation: OnboardingOwner = protectedAccountFoundation) {
  const { rows } = await db.query(`SELECT case_id,organization_id,web_presence_id,managed_site_id
    FROM miopages_core_account.activation_customer_bindings`);
  if (rows.length !== 1 || fingerprint(rows[0]) !== fingerprint({ case_id: foundation.caseId,
    organization_id: foundation.organizationId, web_presence_id: foundation.webPresenceId,
    managed_site_id: foundation.managedSiteId })) throw Error("Exact inactive account binding required");
  await db.query("SET search_path TO miopages_core_account,miopages_core_guard,miopages_wp,public");
}

/** Set and check the boundary on every borrowed connection, not just whichever
 * pool session happened to read the intake first. No pooler startup options. */
export function protectedAccountPool(base: Pool): Pool {
  const connect = async () => {
    const db = await base.connect();
    try { await protectedConnection(db,"miopages_core_development","postgres"); await protectedAccountBoundary(db); return db; }
    catch (error) { db.release(); throw error; }
  };
  return { connect, async query(sql: string, values?: unknown[]) {
    const db = await connect(); try { return await db.query(sql,values); } finally { db.release(); }
  }, end: () => base.end() } as unknown as Pool;
}

export function protectedAccountConfirmation(pool: Pool, operators: ProtectedOperator, authenticated: unknown,
  foundation: OnboardingOwner = protectedAccountFoundation):
  NonNullable<PresenceWorkflowOperations["knowledgeConfirmation"]> {
  return { async authorize(actor, context) {
    if (actor.simulated || fingerprint(context.scope) !== fingerprint(protectedOwnerScope)) throw Error("Account confirmation scope refused");
    const grant = await operators.authorize(authenticated,"confirm-business-information",context.scope);
    if (grant.operatorId !== protectedOwnerId || grant.operatorId !== actor.id ||
      grant.customer?.kind !== "business-representative" || grant.customer.subjectId !== protectedOwnerId) throw Error("Customer authority required");
    const db=await pool.connect();
    try { await protectedAccountBoundary(db,foundation); } finally { db.release(); }
    return { ...grant, customer:grant.customer, foundation };
  } };
}

/** The Account's Client people on the protected inactive account, kept by whoever holds "manage-account-people" there. */
export function protectedAccountPeople(pool: Pool, operators: ProtectedOperator, authenticated: unknown) {
  return new AccountPeople(pool, async scope => {
    if (fingerprint(scope) !== fingerprint(protectedOwnerScope)) throw Error("Account people scope refused");
    const grant = await operators.authorize(authenticated, "manage-account-people", scope);
    return { operatorId: grant.operatorId, authorityReference: grant.authorityReference };
  });
}
