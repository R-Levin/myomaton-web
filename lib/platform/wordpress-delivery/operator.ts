import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Scope } from "../content-editing/authority";
import { object, text } from "../canonical/model";
import type { Actor, CustomerAuthority, Permission, ProposalAuthority } from "../content-editing/proposal";

type Operation = Permission | "review-private-stage" | "authorize-native-draft" | "enroll" | "rotate" | "revoke" | "issue";
type Grant = Actor & { customer?: CustomerAuthority };

export function customerMandate(value: unknown): CustomerAuthority {
  const row = object(value, ["kind", "subjectId", "authorityReference"]);
  if (row.kind !== "business-representative" && row.kind !== "accepted-authority") throw Error("Customer mandate required");
  return { kind: row.kind, subjectId: text(row.subjectId), authorityReference: text(row.authorityReference, 500) };
}

// Credentials are presented only to the protected operator process. Capability
// objects never cross its boundary and the token hash is never written to audit.
export class ProtectedOperator implements ProposalAuthority {
  #sessions = new WeakMap<object, string>();

  constructor(private pool: Pool, private boundary: (db: PoolClient) => Promise<void>, private developmentViews = false) {}

  private get credentials() { return this.developmentViews ? "miopages_wp.core_development_credentials" : "wordpress_operator_credentials"; }
  private get grants() { return this.developmentViews ? "miopages_wp.core_development_grants" : "wordpress_operator_grants"; }

  async authenticate(token: unknown) {
    if (typeof token !== "string" || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) throw Error("Operator authentication refused");
    const digest = createHash("sha256").update(Buffer.from(token, "hex")).digest("hex");
    const db = await this.pool.connect();
    try {
      await this.boundary(db);
      const result = await db.query(`SELECT id FROM ${this.credentials} WHERE token_sha256=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp()`, [digest]);
      if (!result.rowCount) throw Error("Operator authentication refused");
      const context = Object.freeze({});
      this.#sessions.set(context, digest);
      return context;
    } finally { db.release(); }
  }

  async authorize(context: unknown, permission: Operation, scope: Scope): Promise<Grant> {
    const db = await this.pool.connect();
    try {
      await this.boundary(db);
      return await this.authorizeIn(db, context, permission, scope);
    } finally { db.release(); }
  }

  async authorizeIn(db: PoolClient, context: unknown, permission: Operation, scope: Scope): Promise<Grant> {
    const digest = context && typeof context === "object" ? this.#sessions.get(context) : undefined;
    if (!digest) throw Error("Operator authorization refused");
    const row = (await db.query(`SELECT g.id, g.operator_id, g.customer FROM ${this.grants} g
      JOIN ${this.credentials} c ON c.id=g.operator_id
      WHERE c.token_sha256=$1 AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()
      AND g.revoked_at IS NULL AND g.web_presence_id=$2 AND g.managed_site_id=$3 AND g.permission=$4`,
    [digest, scope.webPresenceId, scope.managedSiteId, permission])).rows[0];
    if (!row) throw Error("Operator authorization refused");
    return { operatorId: row.operator_id, authorityReference: row.id,
      ...(permission === "approve-site-proposal" ? { customer: customerMandate(row.customer) } : {}) };
  }
}
