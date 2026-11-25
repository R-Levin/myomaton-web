import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

/**
 * The Account's Client people (Account area: Person and authority). These are the people who
 * speak for the Client on this Account. A Client email entered by a Specialist is the Client's
 * word only when it comes from one of them (Principal, Nov 24–25). A Specialist or the Principal
 * keeps the list; every addition and removal stays on record with who made it and why.
 */
export type ClientPerson = {
  id: string; name: string; email: string;
  /** The sign-in identity this person uses, where they have one, so the person is one Person. */
  subjectId?: string;
  since: string; addedBy: string;
};
export type PeopleAuthority = { operatorId: string; authorityReference: string };
type Db = Pick<Pool | PoolClient, "query">;

export class AccountPeopleError extends Error {
  constructor(readonly code: "invalid" | "unavailable" | "conflict") { super("Account people " + code); }
}

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const email = (value: unknown) => {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text.length < 3 || text.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(text)) throw new AccountPeopleError("invalid");
  return text;
};
const words = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/u.test(text)) throw new AccountPeopleError("invalid");
  return text;
};

/** The current list. Before the list is installed on an Account's database, it is empty: nobody's email counts. */
export async function clientPeople(db: Db, webPresenceId: string): Promise<ClientPerson[]> {
  let rows: Record<string, unknown>[];
  try {
    ({ rows } = await db.query(`SELECT DISTINCT ON (person_id) person_id,version,event,name,email,subject_id,recorded_by,at
      FROM account_people_events WHERE web_presence_id=$1 ORDER BY person_id,version DESC`, [webPresenceId]));
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  // The latest event of a current person is the addition that put them on the list.
  return rows.filter(row => row.event === "add").map(row => ({
    id: String(row.person_id), name: String(row.name), email: String(row.email),
    ...(row.subject_id ? { subjectId: String(row.subject_id) } : {}),
    since: new Date(row.at as string).toISOString(), addedBy: String(row.recorded_by),
  })).sort((a, b) => a.since.localeCompare(b.since) || a.email.localeCompare(b.email));
}

/** Who may give the Client's word by email: the current Client people's addresses. */
export async function clientAddresses(db: Db, webPresenceId: string) {
  return (await clientPeople(db, webPresenceId)).map(person => person.email);
}

/** A client passed in must already be inside a transaction; a pool gets its own. */
async function inTransaction<T>(pool: Pool | PoolClient, work: (db: PoolClient | Pool) => Promise<T>) {
  const owned = "release" in pool ? null : await (pool as Pool).connect();
  const db = owned ?? pool;
  // Savepoint inside a caller's transaction; our own transaction otherwise.
  const nested = !owned;
  await db.query(nested ? "SAVEPOINT account_people" : "BEGIN");
  try {
    const result = await work(db);
    await db.query(nested ? "RELEASE SAVEPOINT account_people" : "COMMIT");
    return result;
  } catch (error) {
    await db.query(nested ? "ROLLBACK TO SAVEPOINT account_people" : "ROLLBACK");
    throw error;
  } finally { owned?.release(); }
}

/** Add someone who speaks for the Client. One email or sign-in belongs to one person on the Account. */
export async function addClientPerson(pool: Pool | PoolClient, webPresenceId: string,
  value: { name: unknown; email: unknown; subjectId?: unknown }, by: PeopleAuthority, reason: unknown, at = new Date().toISOString()) {
  if (!uuid.test(webPresenceId)) throw new AccountPeopleError("invalid");
  const person = { name: words(value.name, 200), email: email(value.email),
    subjectId: value.subjectId === undefined || value.subjectId === null ? null : String(value.subjectId) };
  if (person.subjectId !== null && !uuid.test(person.subjectId)) throw new AccountPeopleError("invalid");
  const why = words(reason, 1000), recordedBy = words(by.operatorId, 200), authority = words(by.authorityReference, 300);
  return inTransaction(pool, async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('account-people:' || $1, 0))", [webPresenceId]);
    const current = await clientPeople(db, webPresenceId);
    const same = current.find(item => item.email === person.email);
    if (same && same.name === person.name && (same.subjectId ?? null) === person.subjectId) return same;
    if (same || (person.subjectId && current.some(item => item.subjectId === person.subjectId))) throw new AccountPeopleError("conflict");
    // Someone removed earlier and added again keeps their identity and history.
    const { rows: [earlier] } = await db.query(`SELECT person_id,max(version)::int AS version FROM account_people_events
      WHERE web_presence_id=$1 AND email=$2 GROUP BY person_id ORDER BY max(at) DESC LIMIT 1`, [webPresenceId, person.email]);
    const id = earlier ? String(earlier.person_id) : randomUUID(), version = earlier ? Number(earlier.version) + 1 : 1;
    await db.query(`INSERT INTO account_people_events(web_presence_id,person_id,version,event,role,name,email,subject_id,recorded_by,authority_reference,reason,at)
      VALUES($1,$2,$3,'add','client',$4,$5,$6,$7,$8,$9,$10)`,
      [webPresenceId, id, version, person.name, person.email, person.subjectId, recordedBy, authority, why, at]);
    return (await clientPeople(db, webPresenceId)).find(item => item.id === id)!;
  });
}

/** Remove someone who no longer speaks for the Client. Their history, and what they said before, stays. */
export async function removeClientPerson(pool: Pool | PoolClient, webPresenceId: string, personId: unknown,
  by: PeopleAuthority, reason: unknown, at = new Date().toISOString()) {
  if (!uuid.test(webPresenceId) || typeof personId !== "string" || !uuid.test(personId)) throw new AccountPeopleError("invalid");
  const why = words(reason, 1000), recordedBy = words(by.operatorId, 200), authority = words(by.authorityReference, 300);
  return inTransaction(pool, async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('account-people:' || $1, 0))", [webPresenceId]);
    const { rows: [last] } = await db.query(`SELECT * FROM account_people_events WHERE web_presence_id=$1 AND person_id=$2
      ORDER BY version DESC LIMIT 1`, [webPresenceId, personId]);
    if (!last) throw new AccountPeopleError("invalid");
    if (last.event === "remove") return clientPeople(db, webPresenceId);
    await db.query(`INSERT INTO account_people_events(web_presence_id,person_id,version,event,role,name,email,subject_id,recorded_by,authority_reference,reason,at)
      VALUES($1,$2,$3,'remove',$4,$5,$6,$7,$8,$9,$10,$11)`,
      [webPresenceId, personId, Number(last.version) + 1, last.role, last.name, last.email, last.subject_id, recordedBy, authority, why, at]);
    return clientPeople(db, webPresenceId);
  });
}

/**
 * Keeping the list through Core: each change is authorized as "manage-account-people" for the
 * exact Account (a Specialist or the Principal holds it; no customer mandate is needed to keep it).
 */
export class AccountPeople {
  constructor(private pool: Pool, private authorize: (scope: { webPresenceId: string; managedSiteId: string }) => Promise<PeopleAuthority>) {}
  private async authority(scope: { webPresenceId: string; managedSiteId: string }) {
    return this.authorize(scope).catch(() => { throw new AccountPeopleError("unavailable"); });
  }
  async list(scope: { webPresenceId: string; managedSiteId: string }) {
    await this.authority(scope);
    return clientPeople(this.pool, scope.webPresenceId);
  }
  async add(scope: { webPresenceId: string; managedSiteId: string }, value: { name: unknown; email: unknown; subjectId?: unknown }, reason: unknown) {
    return addClientPerson(this.pool, scope.webPresenceId, value, await this.authority(scope), reason);
  }
  async remove(scope: { webPresenceId: string; managedSiteId: string }, personId: unknown, reason: unknown) {
    return removeClientPerson(this.pool, scope.webPresenceId, personId, await this.authority(scope), reason);
  }
}
