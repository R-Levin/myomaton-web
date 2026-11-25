import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

/**
 * The protected account database as one ordered sequence of updates (safeguards review item 3,
 * Principal, Nov 25). Each update is applied once, in order, and recorded with its checksum; a
 * new change is the next entry, reviewed at the deploy the Principal approves. This replaces
 * composing each change as a further checksummed amendment chained onto the last.
 */
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const publicRefs = (sql: string, tables: readonly string[]) =>
  tables.reduce((text, table) => text.replaceAll(`REFERENCES ${table}(`, `REFERENCES public.${table}(`), sql);
const inAccount = "SET LOCAL search_path TO miopages_core_account,public;\n";

export async function protectedAccountUpdates() {
  const read = (path: string) => readFile(path, "utf8");
  const list = [
    { name: "0001-account-policy", sql: await read("lib/platform/intake/protected-account-policy.sql") },
    { name: "0002-inquiry-outcomes", sql: inAccount + publicRefs(await read("lib/platform/contact/outcomes.sql"), ["web_presences", "managed_sites", "contact_submissions"])
      + "\n" + await read("lib/platform/intake/protected-account-outcomes.sql") },
    { name: "0003-customer-mandate", sql: await read("lib/platform/intake/protected-account-customer-mandate.sql") },
    { name: "0004-client-people", sql: inAccount + publicRefs(await read("lib/platform/accounts/people.sql"), ["web_presences"])
      + "\n" + await read("lib/platform/intake/protected-account-people.sql") },
    { name: "0005-rules-per-account", sql: await read("lib/platform/intake/protected-account-per-account.sql") },
  ];
  return list.map(update => ({ ...update, sha256: sha(update.sql) }));
}

export type ProtectedUpdate = Awaited<ReturnType<typeof protectedAccountUpdates>>[number];

/**
 * What a database installed before the sequence already has, so the sequence starts after it.
 * The original installer applied 0001 and 0002 together; the mandate amendment shows in the
 * grants constraint; the people list in its table.
 */
async function installedBefore(db: PoolClient) {
  const exists = async (sql: string) => Boolean((await db.query(sql)).rows[0]?.found);
  if (!await exists("SELECT to_regnamespace('miopages_core_account') IS NOT NULL AS found")) return [];
  const names = ["0001-account-policy", "0002-inquiry-outcomes"];
  if (await exists(`SELECT pg_get_constraintdef(oid) LIKE '%confirm-business-information%' AS found FROM pg_constraint
    WHERE conrelid='miopages_wp.wordpress_operator_grants'::regclass AND conname='wordpress_operator_grants_check'`)) names.push("0003-customer-mandate");
  if (await exists("SELECT to_regclass('miopages_core_account.account_people_events') IS NOT NULL AS found")) names.push("0004-client-people");
  return names;
}

/** Apply the updates not yet applied, in order, inside the caller's transaction. Returns what was applied. */
export async function applyProtectedUpdates(db: PoolClient, updates: readonly ProtectedUpdate[], transform = (sql: string) => sql) {
  const before = await installedBefore(db);
  await db.query(`CREATE TABLE IF NOT EXISTS public.miopages_core_account_updates (name text PRIMARY KEY, sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(), baseline boolean NOT NULL DEFAULT false)`);
  const recorded = new Map((await db.query("SELECT name,sha256 FROM public.miopages_core_account_updates")).rows.map(row => [row.name as string, row.sha256 as string]));
  if (!recorded.size) for (const name of before) {
    const update = updates.find(item => item.name === name)!;
    await db.query("INSERT INTO public.miopages_core_account_updates(name,sha256,baseline) VALUES($1,$2,true)", [name, update.sha256]);
    recorded.set(name, update.sha256);
  }
  const applied: string[] = [];
  for (const update of updates) {
    const done = recorded.get(update.name);
    if (done) {
      if (done !== update.sha256) throw Object.assign(Error(`Update ${update.name} differs from what was applied`), { code: "UPDATE_CHANGED" });
      continue;
    }
    await db.query(transform(update.sql));
    await db.query("INSERT INTO public.miopages_core_account_updates(name,sha256) VALUES($1,$2)", [update.name, update.sha256]);
    applied.push(update.name);
  }
  return applied;
}
