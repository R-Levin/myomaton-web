import "server-only";
import { cookies, headers } from "next/headers";
import { Pool } from "pg";
import type { Person } from "../change/model";
import { beaconWriter } from "./beacon-writer";
import { ServiceStore } from "./store";

/**
 * What the workspace and portal run on. Until sign-in on protected Core is connected
 * (milestone 4), they run only in a local preview: on this computer, outside production, against
 * the preview's own throwaway database. Anywhere else they do not exist.
 */
let pool: Pool | undefined;

export async function serviceRuntime() {
  const host = (await headers()).get("host") ?? "";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/u.test(host);
  if (process.env.NODE_ENV === "production" || process.env.MIOPAGES_WORKSPACE !== "local-preview" || !local || !process.env.SERVICE_DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: process.env.SERVICE_DATABASE_URL, max: 4 });
  return { pool, store: new ServiceStore(pool), writer: beaconWriter, writerLabel: "Beacon (stand-in for Core's AI)" };
}

/** Who is acting, as chosen on the local preview's sign-in. Every action checks it again. */
export type Acting = Person & { name: string };
const cookieName = "miopages-preview-person";

export async function acting(): Promise<Acting | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  try {
    const person = JSON.parse(value) as Acting;
    return ["operator", "customer"].includes(person.role) && typeof person.id === "string" && typeof person.name === "string" ? person : null;
  } catch { return null; }
}
export async function actAs(person: Acting | null) {
  const jar = await cookies();
  if (person) jar.set(cookieName, JSON.stringify(person), { httpOnly: true, sameSite: "strict", path: "/" });
  else jar.delete(cookieName);
}

/** The Accounts Core serves: each Web Presence and its site. */
export async function accounts(db: Pool) {
  const { rows } = await db.query(`SELECT w.id AS web_presence_id, w.name, m.id AS managed_site_id FROM web_presences w
    JOIN managed_sites m ON m.web_presence_id=w.id ORDER BY w.name`);
  return rows.map(row => ({ name: String(row.name), account: { webPresenceId: String(row.web_presence_id), managedSiteId: String(row.managed_site_id) } }));
}
