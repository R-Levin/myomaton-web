import type { Pool, PoolClient } from "pg";
import { fingerprint } from "../canonical/model";
import { PostgresProposalPersistence } from "../content-editing/proposal-postgres";
import { SiteProposalService } from "../content-editing/proposals";
import { ProtectedOperator } from "./operator";
import { PrivateReleaseReview } from "./private-source";
import { WordPressDelivery } from "./service";

export function protectedOperatorServices(pool: Pool, boundary: (db: PoolClient) => Promise<void>, origin: string) {
  const operator = new ProtectedOperator(pool, boundary);
  return {
    operator,
    proposals(context: unknown) {
      return new SiteProposalService(pool, operator, new PostgresProposalPersistence(pool, undefined, {
        connect: boundary,
        async appended(db, event) {
          const binding = event.revision?.binding ?? event.preview?.binding ?? event.approval?.binding;
          if (!binding) throw Error("Missing protected proposal binding");
          const permission = event.action === "approve" ? "approve-site-proposal" :
            event.action === "preview" ? "preview-site-proposal" :
            event.sequence === 1 ? "prepare-site-proposal" : "revise-site-proposal";
          const actor = await operator.authorizeIn(db, context, permission, binding.scope);
          if (actor.operatorId !== event.actor.operatorId || actor.authorityReference !== event.actor.authorityReference) {
            throw Error("Operator authority changed");
          }
          if (event.approval) {
            if (fingerprint(actor.customer) !== fingerprint(event.approval.customer)) throw Error("Customer mandate changed");
            await db.query("INSERT INTO wordpress_proposal_approvals VALUES($1,$2,$3)",
              [binding.proposalId, event.hash, actor.authorityReference]);
          }
        },
      }));
    },
    review: new PrivateReleaseReview(pool, operator, boundary),
    delivery: new WordPressDelivery(pool, async (context, action, site, db) =>
      (await operator.authorizeIn(db, context, action, site)).operatorId, async () => null, origin, undefined, boundary),
  };
}
