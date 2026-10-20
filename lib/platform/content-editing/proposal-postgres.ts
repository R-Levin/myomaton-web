import type { Pool, PoolClient } from "pg";
import { fingerprint, uuid } from "../canonical/model";
import type { Scope } from "./authority";
import { proposalExecution, proposalScope, type Event } from "./proposal";
import { nextProposalEvent, replayProposal, type AppendProposalEvent, type ProposalPersistence, type ProposalStore } from "./proposal-history";

export const proposalRendererIdentity = "site-proposal-section-renderer/1";
type TransactionBoundary = { beforeBegin(c: PoolClient): Promise<void>; afterBegin(c: PoolClient): Promise<void> };
export class PostgresProposalPersistence implements ProposalPersistence {
  readonly kind = "postgres" as const;
  constructor(private pool: Pool, private boundary?: TransactionBoundary) {}
  open(id: string, scope: Scope): ProposalStore { return new PostgresProposalStore(this.pool, uuid(id), proposalScope(scope), this.boundary); }
}
class PostgresProposalStore implements ProposalStore {
  constructor(private pool: Pool, private id: string, private scope: Scope, private boundary?: TransactionBoundary) {}
  async locked<T>(create: boolean, fn: Parameters<ProposalStore["locked"]>[1]): Promise<T> {
    proposalExecution("postgres");
    for (let attempt = 0; ; attempt++) {
      const c = await this.pool.connect();
      try {
        // Acquire before establishing the serializable snapshot so a waiting
        // duplicate creator rereads the committed predecessor, including retries.
        await c.query("SELECT pg_advisory_lock(hashtextextended($1,0))", ["site-proposal:" + this.id]);
        await this.boundary?.beforeBegin(c);
        await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        // Utility LOCK commands run before the first snapshot-bearing SELECT.
        // Only the separate disposable release service supplies this boundary.
        await this.boundary?.afterBegin(c);
        const schema = (await c.query("SELECT current_schema() s")).rows[0].s;
        if (!/^canonical_test_[a-f0-9]{32}_intake$/.test(schema) && !(schema === "public" && process.env.MIOPAGES_SITE_PROPOSALS === "shared-development")) throw Error("Durable proposals require disposable schema or explicit shared-development execution");
        await c.query(`SET LOCAL search_path="${schema}"`);
        const identity = (await c.query("SELECT * FROM site_change_proposals WHERE id=$1 FOR UPDATE", [this.id])).rows[0];
        if (!identity && !create) throw Error("Missing proposal");
        if (identity && (identity.web_presence_id !== this.scope.webPresenceId || identity.managed_site_id !== this.scope.managedSiteId)) throw Error("Foreign proposal scope");
        const rows = identity ? (await c.query("SELECT e.*,r.data revision_data FROM site_change_events e JOIN site_change_revisions r ON r.proposal_id=e.proposal_id AND r.revision=e.revision WHERE e.proposal_id=$1 ORDER BY e.sequence", [this.id])).rows : [];
        const events = rows.map(row => {
          const event = { ...row.data, ...(row.operation === "revise" ? { revision: row.revision_data } : {}) } as Event;
          if (event.hash !== row.digest || event.sequence !== row.sequence || event.requestId !== row.request_id || event.requestDigest !== row.request_digest || event.action !== row.operation) throw Error("Durable proposal event differs from stored identity");
          return event;
        });
        const state = replayProposal(this.id, this.scope, events);
        if (identity && (!events.length || identity.created_at.toISOString() !== state.createdAt)) throw Error("Incomplete durable proposal identity/history");
        const append: AppendProposalEvent = async value => {
          const next = nextProposalEvent(state, value); replayProposal(this.id, this.scope, [...events, next]);
          const revision = next.revision ?? state.revisions.at(-1); if (!revision) throw Error("Proposal revision required");
          if (!identity) {
            const graph = (await c.query("SELECT organization_id FROM web_presences WHERE id=$1", [this.scope.webPresenceId])).rows[0];
            if (!graph) throw Error("Owned proposal foundation required");
            await c.query("INSERT INTO site_change_proposals(id,organization_id,web_presence_id,managed_site_id,created_at) VALUES($1,$2,$3,$4,$5)", [this.id, graph.organization_id, this.scope.webPresenceId, this.scope.managedSiteId, next.at]);
          }
          if (next.revision) await c.query("INSERT INTO site_change_revisions(proposal_id,revision,digest,base_fingerprint,data,created_at) VALUES($1,$2,$3,$4,$5,$6)", [this.id, revision.binding.revision, revision.binding.digest, revision.binding.baseFingerprint, revision, revision.at]);
          const { revision: omitted, ...data } = next; void omitted;
          const a = next.approval;
          await c.query(`INSERT INTO site_change_events(proposal_id,sequence,request_id,request_digest,operation,revision,proposal_digest,base_fingerprint,previous,digest,preview_digest,preview_event,renderer,actor,authority_reference,customer,approval_reference,at,data)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [this.id, next.sequence, next.requestId, next.requestDigest, next.action, revision.binding.revision, revision.binding.digest, revision.binding.baseFingerprint, next.previous, next.hash, next.preview?.digest ?? a?.previewDigest ?? null, a?.previewEvent ?? null, next.action === "revise" ? null : proposalRendererIdentity, next.actor.operatorId, next.actor.authorityReference, a?.customer ?? null, a?.reference ?? null, next.at, data]);
          return next;
        };
        const result = await fn(state, append, c); await c.query("COMMIT"); return result as T;
      } catch (error) {
        await c.query("ROLLBACK");
        const code = (error as { code?: string }).code;
        if (attempt < 2 && ["40001", "40P01"].includes(code ?? "")) continue;
        throw error;
      } finally {
        try { await c.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", ["site-proposal:" + this.id]); } finally { c.release(); }
      }
    }
  }
}

// Reopen/recovery consumers use the same replay contract, not a mutable status flag.
export async function durableProposalFingerprint(c: PoolClient) {
  const result: Record<string, unknown> = {};
  for (const table of ["site_change_proposals", "site_change_revisions", "site_change_events"]) result[table] = (await c.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
  return fingerprint(result);
}
