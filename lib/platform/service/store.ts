import type { Pool } from "pg";
import { fingerprint } from "../canonical/model";
import { openRecord, type ServiceRecord } from "./cycle";

export class StoreError extends Error { constructor(readonly code: "changed" | "corrupt") { super("Service record " + code); } }

/**
 * Each Account's service record in the database. Reading gives the latest version; saving adds
 * the next one only if nobody else saved since it was read, so two people never overwrite each
 * other. Every version stays.
 */
export class ServiceStore {
  constructor(private pool: Pick<Pool, "query">) {}

  async read(account: ServiceRecord["account"]): Promise<ServiceRecord> {
    const { rows: [row] } = await this.pool.query(`SELECT version,payload,digest FROM service_records
      WHERE web_presence_id=$1 AND managed_site_id=$2 ORDER BY version DESC LIMIT 1`, [account.webPresenceId, account.managedSiteId]);
    if (!row) return openRecord(account);
    if (fingerprint(row.payload) !== row.digest) throw new StoreError("corrupt");
    return { ...(row.payload as Omit<ServiceRecord, "version">), account, version: Number(row.version) };
  }

  /** Save `next` as the version after `read`. Refused if the record changed in between. */
  async save(read: ServiceRecord, next: ServiceRecord): Promise<ServiceRecord> {
    if (fingerprint(read.account) !== fingerprint(next.account)) throw new StoreError("changed");
    const { version: _version, ...payload } = { ...next, version: read.version + 1 };
    void _version;
    try {
      await this.pool.query(`INSERT INTO service_records(web_presence_id,managed_site_id,version,payload,digest) VALUES($1,$2,$3,$4,$5)`,
        [next.account.webPresenceId, next.account.managedSiteId, read.version + 1, JSON.stringify(payload), fingerprint(payload)]);
    } catch (error) {
      const { code, message } = error as { code?: string; message?: string };
      if (code === "23505" || (code === "P0001" && message?.includes("Next version"))) throw new StoreError("changed");
      throw error;
    }
    return { ...next, version: read.version + 1 };
  }

  /**
   * Read, change and save in one step; retried once if someone else saved first. Only for steps
   * that call nothing outside Core: an AI step is read, written and saved once, never retried here.
   */
  async update(account: ServiceRecord["account"], change: (record: ServiceRecord) => ServiceRecord | Promise<ServiceRecord>) {
    for (let attempt = 0; ; attempt++) {
      const record = await this.read(account);
      try { return await this.save(record, await change(record)); }
      catch (error) { if (!(error instanceof StoreError && error.code === "changed") || attempt) throw error; }
    }
  }
}
